"""AETHER Phase 2.3: true UV island, padding, overlap and distortion QA.

Uses source mesh polygon UVs after material-family atlas allocation, not just
Phase 2.2 rectangle approximations. No texture bakes or gameplay changes.
Compatible with the Blender 3.x GitHub runner (no extra packages needed).
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import html
import json
import math

ATLAS_RES = 2048
MIN_ISLAND_PADDING_PX = 8.0
UV_WELD_EPS = 2e-6
OVERLAP_AREA_EPS_PX2 = 0.015
MAX_EDGE_SCALE_RATIO = 160.0


def cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def tri_area(a,b,c):
    return abs(cross(a,b,c))*.5


def convex_triangle_overlap_area(subject,clip):
    """True positive-area overlap. Shared triangle edges are not overlaps."""
    poly=list(subject)
    target=list(clip)
    if cross(*target)<0:
        target.reverse()
    for i in range(3):
        a=target[i];b=target[(i+1)%3]
        if not poly:
            break
        out=[]
        prev=poly[-1]
        d_prev=cross(a,b,prev)
        for curr in poly:
            d_curr=cross(a,b,curr)
            curr_in=d_curr>=-1e-8
            prev_in=d_prev>=-1e-8
            if curr_in != prev_in:
                denom=d_prev-d_curr
                t=d_prev/denom if abs(denom)>1e-12 else 0
                out.append((prev[0]+(curr[0]-prev[0])*t,
                            prev[1]+(curr[1]-prev[1])*t))
            if curr_in:
                out.append(curr)
            prev=curr;d_prev=d_curr
        poly=out
    if len(poly)<3:
        return 0.0
    return abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-
                   poly[(i+1)%len(poly)][0]*poly[i][1]
                   for i in range(len(poly))))*.5


def _segment_distance_sq(a,b,c,d):
    """Minimum distance of two closed 2D segments, including crossings."""
    o1=cross(a,b,c);o2=cross(a,b,d)
    o3=cross(c,d,a);o4=cross(c,d,b)
    if o1*o2<0 and o3*o4<0:
        return 0.0
    def point_seg(p,u,v):
        ux=v[0]-u[0];uy=v[1]-u[1]
        l2=ux*ux+uy*uy
        if l2<1e-24:
            return (p[0]-u[0])**2+(p[1]-u[1])**2
        t=max(0,min(1,((p[0]-u[0])*ux+(p[1]-u[1])*uy)/l2))
        return (p[0]-(u[0]+t*ux))**2+(p[1]-(u[1]+t*uy))**2
    return min(point_seg(a,c,d),point_seg(b,c,d),
               point_seg(c,a,b),point_seg(d,a,b))


def _weighted_percentile(entries, fraction):
    """(metric, real 3D area) pairs. Ignores tiny almost-zero surfaces."""
    data=sorted(entries)
    total=sum(w for _,w in data)
    if not total:
        return 0.0
    acc=0
    for value, weight in data:
        acc+=weight
        if acc>=fraction*total:
            return value
    return data[-1][0]


def _face_islands(mesh,uv):
    polygons=list(mesh.polygons)
    parents=list(range(len(polygons)))
    def find(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]]
            i=parents[i]
        return i
    def join(a,b):
        a=find(a);b=find(b)
        if a!=b:
            parents[max(a,b)]=min(a,b)
    occurrences=defaultdict(list)
    for face_id,p in enumerate(polygons):
        loops=list(p.loop_indices)
        for k,li in enumerate(loops):
            lj=loops[(k+1)%len(loops)]
            L=mesh.loops[li]
            R=mesh.loops[lj]
            coords={
                L.vertex_index:tuple(uv.data[li].uv),
                R.vertex_index:tuple(uv.data[lj].uv),
            }
            occurrences[L.edge_index].append((face_id,coords,li,lj))
    for occ in occurrences.values():
        if len(occ)!=2:
            continue
        fi,uv0,_,_=occ[0]
        fj,uv1,_,_=occ[1]
        if uv0.keys()!=uv1.keys():
            continue
        if all(abs(uv0[v][axis]-uv1[v][axis])<=UV_WELD_EPS
               for v in uv0 for axis in (0,1)):
            join(fi,fj)
    islands={}
    ids=[]
    for i in range(len(polygons)):
        root=find(i)
        if root not in islands:
            islands[root]=len(islands)
        ids.append(islands[root])
    boundaries=[]
    for occ in occurrences.values():
        for fi,_,li,lj in occ:
            group=ids[fi]
            if any(fj!=fi and ids[fj]==group for fj,_,_,_ in occ):
                continue
            a=tuple(v*ATLAS_RES for v in uv.data[li].uv)
            b=tuple(v*ATLAS_RES for v in uv.data[lj].uv)
            boundaries.append((group,a,b))
    return ids,len(islands),boundaries


def _audit_one_mesh(obj):
    mesh=obj.data
    uv=mesh.uv_layers.active
    if uv is None or len(uv.data)!=len(mesh.loops):
        raise RuntimeError("Missing UVMap layer: "+obj.name)
    island_ids,number,boundary=_face_islands(mesh,uv)
    triangles=[]
    densities=[]
    stretches=[]
    face_count=0
    for face_id,p in enumerate(mesh.polygons):
        face_count+=1
        loop_indices=list(p.loop_indices)
        points=[tuple(uv.data[i].uv) for i in loop_indices]
        world=[obj.matrix_world @ mesh.vertices[mesh.loops[i].vertex_index].co
               for i in loop_indices]
        for k in range(1,len(loop_indices)-1):
            uv3=[points[i] for i in (0,k,k+1)]
            world3=[world[i] for i in (0,k,k+1)]
            up=[(v[0]*ATLAS_RES,v[1]*ATLAS_RES) for v in uv3]
            uv_area=tri_area(*up)
            if uv_area<1e-7:
                raise RuntimeError("Degenerate UV triangle: "+obj.name)
            world_area=(world3[1]-world3[0]).cross(
                world3[2]-world3[0]).length*.5
            if world_area<1e-14:
                raise RuntimeError("Degenerate world triangle: "+obj.name)
            edge_ratios=[]
            for i,j in ((0,1),(1,2),(2,0)):
                world_length=(world3[j]-world3[i]).length
                uv_length=math.dist(up[i],up[j])
                if world_length<=1e-10:
                    raise RuntimeError("Near-zero world edge: "+obj.name)
                edge_ratios.append(uv_length/world_length)
            stretch=max(edge_ratios)/max(1e-8,min(edge_ratios))
            densities.append((math.sqrt(uv_area/world_area),world_area))
            stretches.append((stretch,world_area))
            xmin=min(x for x,y in up);xmax=max(x for x,y in up)
            ymin=min(y for x,y in up);ymax=max(y for x,y in up)
            triangles.append((up,(xmin,ymin,xmax,ymax),face_id,island_ids[face_id]))
    # Count actual triangle-triangle UV intersection within a single mesh.
    # This catches different islands AND folds within a connected island.
    overlap_count=0
    worst_overlap_area=0.0
    for i,(A,bbA,fa,ia) in enumerate(triangles):
        for B,bbB,fb,ib in triangles[i+1:]:
            if bbA[2]<=bbB[0] or bbB[2]<=bbA[0]:
                continue
            if bbA[3]<=bbB[1] or bbB[3]<=bbA[1]:
                continue
            area=convex_triangle_overlap_area(A,B)
            if area>OVERLAP_AREA_EPS_PX2:
                overlap_count+=1
                worst_overlap_area=max(worst_overlap_area,area)
                if overlap_count>0:
                    # Capture the first error immediately rather than spend
                    # time computing all overlaps on a broken unwrap.
                    break
        if overlap_count:
            break
    # Calculate the *actual* minimum separation of independent UV islands
    # using all UV outline segments. This includes seams within one object.
    min_dist_sq=math.inf
    for i,(isle,a,b) in enumerate(boundary):
        bbox1=(min(a[0],b[0]),min(a[1],b[1]),max(a[0],b[0]),max(a[1],b[1]))
        for other,c,d in boundary[i+1:]:
            if isle==other:
                continue
            if math.isfinite(min_dist_sq):
                left=max(0.0,max(min(c[0],d[0])-bbox1[2],
                                 bbox1[0]-max(c[0],d[0])))
                bottom=max(0.0,max(min(c[1],d[1])-bbox1[3],
                                   bbox1[1]-max(c[1],d[1])))
                if left*left+bottom*bottom>=min_dist_sq:
                    continue
            # Test exact segment distance; no assumed UV island margin.
            distance_sq=_segment_distance_sq(a,b,c,d)
            if distance_sq<min_dist_sq:
                min_dist_sq=distance_sq
    min_pad=math.sqrt(min_dist_sq) if math.isfinite(min_dist_sq) else None
    p10=_weighted_percentile(densities,.10)
    p50=_weighted_percentile(densities,.50)
    p90=_weighted_percentile(densities,.90)
    p95_stretch=_weighted_percentile(stretches,.95)
    max_stretch=max((d for d,w in stretches),default=0)
    result={
        "mesh":obj.name,
        "faces":face_count,
        "uv_triangles":len(triangles),
        "uv_islands":number,
        "boundary_segments":len(boundary),
        "min_island_padding_px":round(min_pad,3) if min_pad is not None else None,
        "overlapping_uv_triangle_pairs":overlap_count,
        "worst_overlap_px2":round(worst_overlap_area,4),
        "density_px_per_unit_p10":round(p10,2),
        "density_px_per_unit_p50":round(p50,2),
        "density_px_per_unit_p90":round(p90,2),
        "density_p90_p10_ratio":round(p90/max(p10,1e-8),3),
        "stretch_edge_ratio_p95":round(p95_stretch,3),
        "stretch_edge_ratio_max":round(max_stretch,3),
    }
    return result,boundary,[(d,w) for d,w in densities],[(d,w) for d,w in stretches]


def _make_island_gallery(audit,visual_data):
    color=['#66ddf9','#a19cf3','#e7b879','#7ad2ae','#d8a1d5','#b1bedd']
    families=sorted(visual_data)
    chunks=[
        '<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="1280" viewBox="0 0 1260 1280">',
        '<rect x="0" y="0" width="1260" height="1280" fill="#07141f"/>',
        '<text x="32" y="38" font-family="sans-serif" font-size="24" fill="#d3f3ff" font-weight="bold">AETHER · UV ISLAND QA / PHASE 2.3</text>',
        '<text x="32" y="59" font-family="sans-serif" font-size="13" fill="#95b9c9">Actual UV boundary lines, not just object tile rectangles · 2048px reference</text>',
    ]
    for index,material in enumerate(families):
        x=28+(index%3)*410
        y=80+(index//3)*393
        chunks.append(f'<rect x="{x}" y="{y}" width="390" height="383" rx="10" fill="#152633" stroke="#365669"/>')
        chunks.append(f'<text x="{x+13}" y="{y+26}" font-family="sans-serif" font-size="13" fill="#d6effa">{html.escape(material)}</text>')
        info=audit["families"][material]
        chunks.append(f'<text x="{x+13}" y="{y+45}" font-family="sans-serif" font-size="11" fill="#9ac2d2">{info["uv_islands"]} islands · {info["source_meshes"]} meshes</text>')
        ox=x+15;oy=y+60;size=306
        chunks.append(f'<rect x="{ox}" y="{oy}" width="{size}" height="{size}" fill="#071820" stroke="#41647b"/>')
        for object_index,(name,boundaries) in enumerate(sorted(visual_data[material].items())):
            strokes=defaultdict(list)
            for island,a,b in boundaries:
                px=ox+a[0]/ATLAS_RES*size
                py=oy+(1-a[1]/ATLAS_RES)*size
                qx=ox+b[0]/ATLAS_RES*size
                qy=oy+(1-b[1]/ATLAS_RES)*size
                strokes[island].append(f'M{px:.2f},{py:.2f}L{qx:.2f},{qy:.2f}')
            for island,paths in strokes.items():
                col=color[(object_index+island)%len(color)]
                chunks.append(f'<path d="{"".join(paths)}" fill="none" stroke="{col}" stroke-width=".62" stroke-opacity=".91"/>')
    chunks.append('</svg>')
    return "\n".join(chunks)


def audit_uv_quality(objects, output_dir, uv_allocation_report):
    """Validate real per-face UV islands, not merely atlas allocation."""
    sources=sorted((o for o in objects if o.type=="MESH"),key=lambda o:o.name)
    result={
        "asset_id":"AETHER9_SPECTER","phase":"2.3",
        "resolution":ATLAS_RES,
        "minimum_required_island_padding_px":MIN_ISLAND_PADDING_PX,
        "cross_object_padding":"Validated by Phase 2.2 disjoint UV tiles",
        "metric_notes":{
            "stretch":"Max/min ratio of mapped-to-3D edge scales; proxy, not full Jacobian singular values",
            "density":"sqrt(UV triangle pixel area / world triangle area), area-weighted percentiles",
            "padding":"exact minimum 2D segment distance between different islands within one mesh",
            "overlap":"positive-area triangle intersection inside individual meshes",
        },
        "source_meshes":len(sources),"families":{},"objects":{},
        "totals":{},
        "errors":[],"warnings":[],
    }
    names={o.name for o in sources}
    if names!={*uv_allocation_report["objects"]}:
        raise RuntimeError("UV QA inputs differ from Phase 2.2 authored meshes")
    visual=defaultdict(dict)
    family_density=defaultdict(list)
    family_stretch=defaultdict(list)
    counts={"faces":0,"uv_triangles":0,"uv_islands":0,
            "overlapping_uv_triangle_pairs":0,"objects_below_padding":0,
            "objects_with_island_seams":0}
    for obj in sources:
        material=next(iter(obj.data.materials)).name
        item,boundaries,den,stretch=_audit_one_mesh(obj)
        result["objects"][obj.name]=item
        visual[material][obj.name]=boundaries
        family_density[material].extend(den)
        family_stretch[material].extend(stretch)
        for key in ["faces","uv_triangles","uv_islands",
                    "overlapping_uv_triangle_pairs"]:
            counts[key]+=item[key]
        if item["uv_islands"]>1:
            counts["objects_with_island_seams"]+=1
            min_pad=item["min_island_padding_px"]
            if min_pad is None or min_pad+1e-4<MIN_ISLAND_PADDING_PX:
                counts["objects_below_padding"]+=1
                result["errors"].append({
                    "object":obj.name,"issue":"insufficient island padding",
                    "min_pad_px":min_pad
                })
        if item["overlapping_uv_triangle_pairs"]:
            result["errors"].append({
                "object":obj.name,"issue":"overlapping UV triangle interiors",
                "count":item["overlapping_uv_triangle_pairs"]
            })
        if item["stretch_edge_ratio_max"]>MAX_EDGE_SCALE_RATIO:
            result["errors"].append({
                "object":obj.name,"issue":"extreme UV geometric distortion",
                "edge_ratio":item["stretch_edge_ratio_max"]
            })
        elif item["stretch_edge_ratio_p95"]>8:
            result["warnings"].append({
                "object":obj.name,"issue":"high UV stretch proxy",
                "p95":item["stretch_edge_ratio_p95"]
            })
    for family in sorted(family_density):
        members=[item for name,item in result["objects"].items()
                 if next(iter(next(o for o in sources if o.name==name).data.materials)).name==family]
        densities=family_density[family]
        p10=_weighted_percentile(densities,.1)
        p90=_weighted_percentile(densities,.9)
        result["families"][family]={
            "source_meshes":len(members),
            "uv_islands":sum(item["uv_islands"] for item in members),
            "density_p10_px_per_unit":round(p10,2),
            "density_p90_px_per_unit":round(p90,2),
            "density_p90_p10_ratio":round(p90/max(p10,1e-8),2),
            "max_stretch_edge_ratio":round(max(d for d,w in family_stretch[family]),3),
            "min_internal_padding_px":round(min((
                item["min_island_padding_px"]
                for item in members if item["min_island_padding_px"] is not None
            ), default=1000.0),2),
        }
        if result["families"][family]["density_p90_p10_ratio"]>8:
            result["warnings"].append({
                "family":family,"issue":"uneven area-weighted texture density",
                "ratio":result["families"][family]["density_p90_p10_ratio"]
            })
    result["totals"]=counts
    result["passed"]=not result["errors"]
    directory=Path(output_dir)
    (directory/"aether9-phase2-uv-quality.json").write_text(
        json.dumps(result,indent=2),encoding="utf-8"
    )
    (directory/"aether9-phase2-islands.svg").write_text(
        _make_island_gallery(result,visual),encoding="utf-8"
    )
    if result["errors"]:
        sample=result["errors"][:6]
        raise RuntimeError(f"UV QA failed with {len(result['errors'])} findings: {sample}")
    return result
