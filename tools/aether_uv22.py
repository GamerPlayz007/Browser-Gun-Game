"""AETHER Phase 2.2 — material-aware UV preparation for Blender game art.

All UV work is for fictional, nonfunctional game-prop surfaces. Blender 3.x.
The 60 authored mesh objects share one nonoverlapping UV layout per named
material family. Curves remain editable in the native .blend; their exported
visual ribbon meshes get dedicated standalone UV coordinates, not atlas tiles.
No texture bakes or atlas bitmap images are created at this stage.
"""
from __future__ import annotations

import html
import json
import math
from collections import defaultdict

import bpy

ATLAS_RESOLUTION = 2048
EDGE_GUTTER_PIXELS = 10
SMART_PROJECT_MARGIN = 0.023
SMALL_OBJECT_MIN_WEIGHT = 0.19


def _smart_unwrap(obj, margin=SMART_PROJECT_MARGIN):
    """Run Blender's seam-aware UV projection on one clean mesh, headlessly."""
    if obj.type != "MESH" or not obj.data.polygons:
        raise ValueError("Object must be a nonempty Blender mesh: " + obj.name)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # Include the provisional UV layer in the native scene, but replace its
    # content with an actual unfolded layout before this file is saved.
    layer = obj.data.uv_layers.get("UVMap")
    if layer is None:
        layer = obj.data.uv_layers.new(name="UVMap")
    obj.data.uv_layers.active = layer
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(64),
        island_margin=margin,
        area_weight=.20,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    result = obj.data.uv_layers.active
    if result is None or len(result.data) != len(obj.data.loops):
        raise RuntimeError("Blender UV unwrapping produced no usable loops: " + obj.name)
    data = [tuple(loop.uv) for loop in result.data]
    if not all(math.isfinite(a) and math.isfinite(b) for a,b in data):
        raise RuntimeError("Nonfinite UV coordinates: " + obj.name)
    return result, data


def _shelf_layout(entries, edge):
    """Deterministically allocate separate, area-weighted UV rectangles.

    Allocates an inner rectangle for every source object, with a fixed
    texture-space gutter between objects; binary search guarantees it fits.
    A very small minimum relative area deliberately protects tiny accents.
    """
    max_area = max(e["area"] for e in entries)
    ordered = sorted(
        entries,
        key=lambda e: (-max(SMALL_OBJECT_MIN_WEIGHT,
                            math.sqrt(e["area"]/max_area)), e["name"])
    )
    weights = {
        e["name"]:max(SMALL_OBJECT_MIN_WEIGHT, math.sqrt(e["area"]/max_area))
        for e in ordered
    }

    def attempt(scale):
        x = edge
        y = edge
        row_height = 0.0
        boxes = {}
        for entry in ordered:
            name = entry["name"]
            extent = weights[name]*scale + 2*edge
            if x+extent > 1-edge+1e-8:
                x=edge
                y+=row_height
                row_height=0.0
            if y+extent > 1-edge+1e-8:
                return None
            boxes[name]=(x+edge,y+edge,x+extent-edge,y+extent-edge)
            x+=extent
            row_height=max(row_height,extent)
        return boxes

    lo=0.0;hi=1.0
    for _ in range(38):
        midpoint=(lo+hi)/2
        if attempt(midpoint) is None:
            hi=midpoint
        else:
            lo=midpoint
    boxes=attempt(lo*0.985)
    if boxes is None or len(boxes)!=len(entries):
        raise RuntimeError("Could not construct disjoint UV material atlas")
    return boxes, weights


def _uv_polygon_area(coordinates):
    area=0.0
    for i,p in enumerate(coordinates):
        q=coordinates[(i+1)%len(coordinates)]
        area+=p[0]*q[1]-p[1]*q[0]
    return abs(area)*.5


def _verify_mesh_uv(obj):
    uv=obj.data.uv_layers.active
    if uv is None or len(uv.data)!=len(obj.data.loops):
        raise RuntimeError("Missing UV data: " + obj.name)
    empty=0
    for polygon in obj.data.polygons:
        coords=[tuple(uv.data[i].uv) for i in polygon.loop_indices]
        if not all(math.isfinite(v) and -1e-7<=v<=1+1e-7
                   for pair in coords for v in pair):
            raise RuntimeError("UV lies outside 0..1: " + obj.name)
        if _uv_polygon_area(coords)<1e-13:
            empty+=1
    if empty:
        raise RuntimeError(f"UV collapsed polygons on {obj.name}: {empty}")
    return len(uv.data)


def _material_family(obj):
    mats=[m for m in obj.data.materials if m]
    if len(mats)!=1:
        raise RuntimeError("Phase 2.2 expects exactly one authored material per object: "+obj.name)
    return mats[0].name


def prepare_uv_atlases(objects, output_dir):
    """Make distinct per-material UV layouts for authored Blender meshes."""
    entries=[]
    for obj in sorted((o for o in objects if o.type=="MESH"),key=lambda o:o.name):
        layer,coords=_smart_unwrap(obj)
        bmin=(min(u for u,v in coords),min(v for u,v in coords))
        bmax=(max(u for u,v in coords),max(v for u,v in coords))
        if bmax[0]-bmin[0]<1e-8 or bmax[1]-bmin[1]<1e-8:
            raise RuntimeError("Flat unwrapped UV bounds: "+obj.name)
        area=sum(p.area for p in obj.data.polygons)
        if area<=0:
            raise RuntimeError("Surface has zero area: "+obj.name)
        entries.append(dict(name=obj.name,obj=obj,layer=layer,
                            raw=coords,bounds=(bmin,bmax),area=area,
                            family=_material_family(obj)))
    by_mat=defaultdict(list)
    for entry in entries:
        by_mat[entry["family"]].append(entry)
    margin=EDGE_GUTTER_PIXELS/ATLAS_RESOLUTION
    audit={"phase":"2.2","asset_id":"AETHER9_SPECTER",
        "status":"authored mesh UV islands packed by material family",
        "atlas_resolution":ATLAS_RESOLUTION,
        "object_edge_gutter_pixels":EDGE_GUTTER_PIXELS,
        "blender_island_margin":SMART_PROJECT_MARGIN,
        "adaptive_island_margin":"max(default, 0.12*300/tile_pixel_side), capped at 0.20",
        "source_mesh_count":len(entries),
        "families":{},"objects":{},
        "editable_curves":"UVs generated after conversion for GLB only",
        "baked_texture_maps":"none (Phase 3)"}
    for family in sorted(by_mat):
        group=by_mat[family]
        atlas,weights=_shelf_layout(group,margin)
        tiles={}
        ratios=[]
        for entry in group:
            name=entry["name"]
            x0,y0,x1,y1=atlas[name]
            # The Phase 2.3 audit found that fixed Smart UV margins are
            # insufficient on small mapped decorative objects. Allocate
            # proportionally more island padding where the eventual tile
            # is small; keep a lighter split on the large hero shell.
            tile_side_px=min(x1-x0,y1-y0)*ATLAS_RESOLUTION
            dynamic_margin=min(.20,max(SMART_PROJECT_MARGIN,
                                        .12*300.0/max(tile_side_px,1.0)))
            final_layer,final_coords=_smart_unwrap(
                entry["obj"],margin=dynamic_margin
            )
            entry["layer"]=final_layer
            entry["raw"]=final_coords
            entry["bounds"]=(
                (min(u for u,v in final_coords),min(v for u,v in final_coords)),
                (max(u for u,v in final_coords),max(v for u,v in final_coords))
            )
            (umin,vmin),(umax,vmax)=entry["bounds"]
            du=umax-umin;dv=vmax-vmin
            inner=min(x1-x0,y1-y0)
            scalar=inner/max(du,dv)
            uoffset=x0+((x1-x0)-du*scalar)*.5
            voffset=y0+((y1-y0)-dv*scalar)*.5
            for loop, (u,v) in zip(entry["layer"].data,entry["raw"]):
                loop.uv=(uoffset+(u-umin)*scalar,
                         voffset+(v-vmin)*scalar)
            if not _verify_mesh_uv(entry["obj"]):
                raise RuntimeError("Empty repacked UV object: "+name)
            # This is a coarse layout density estimate, not proof that
            # every smart-projected island has equal distortion.
            density=scalar*ATLAS_RESOLUTION/math.sqrt(entry["area"])
            ratios.append(density)
            objdata=dict(
                material=family,
                uv_layer="UVMap",
                slot=[round(x,6) for x in atlas[name]],
                surface_area=round(entry["area"],7),
                relative_weight=round(weights[name],5),
                authored_island_margin=round(dynamic_margin,5),
                target_tile_side_px=round(tile_side_px,2),
                approx_density=round(density,3),
                polygon_count=len(entry["obj"].data.polygons),
                uv_loops=len(entry["layer"].data),
            )
            audit["objects"][name]=objdata
            tiles[name]=objdata["slot"]
        # Object bounding boxes are disjoint per shared material map.
        names=sorted(tiles)
        for i,a in enumerate(names):
            ax0,ay0,ax1,ay1=tiles[a]
            if min(ax0,ay0)<0 or max(ax1,ay1)>1:
                raise RuntimeError("Atlas tile out of bounds: "+a)
            for b in names[i+1:]:
                bx0,by0,bx1,by1=tiles[b]
                overlap=(min(ax1,bx1)-max(ax0,bx0)>1e-7 and
                         min(ay1,by1)-max(ay0,by0)>1e-7)
                if overlap:
                    raise RuntimeError("UV tile overlap: "+a+" / "+b)
        audit["families"][family]=dict(
            object_count=len(group),
            uv_tiles=tiles,
            reserved_edge_px=EDGE_GUTTER_PIXELS,
            approximate_density_min=round(min(ratios),2),
            approximate_density_max=round(max(ratios),2),
            packed_tile_area_fraction=round(
                sum((r[2]-r[0])*(r[3]-r[1]) for r in atlas.values()),4),
        )
    audit["material_family_count"]=len(audit["families"])
    audit["total_uv_loops"]=sum(o["uv_loops"] for o in audit["objects"].values())
    if audit["source_mesh_count"]<55 or audit["material_family_count"]<8:
        raise RuntimeError("Unwrap omitted source meshes or material families")
    from pathlib import Path
    target=Path(output_dir)
    (target/"aether9-phase2-uv.json").write_text(
        json.dumps(audit,indent=2),encoding="utf-8"
    )
    (target/"aether9-phase2-uv-layout.svg").write_text(
        _make_svg(audit),encoding="utf-8"
    )
    return audit


def unwrap_export_curves(mesh_objects):
    """UV-enable derived ribbon meshes after keeping native curves editable."""
    objects=sorted((o for o in mesh_objects if o.type=="MESH"),key=lambda o:o.name)
    count=0
    for obj in objects:
        _smart_unwrap(obj)
        _verify_mesh_uv(obj)
        obj["aether_uv_state"]="individual-ribbon-uv / unbaked"
        count+=1
    return count


def _make_svg(report):
    families=sorted(report["families"])
    background=['#142b3d','#173648','#203047','#29313d',
                '#243d41','#343047','#333946','#243542','#292e3e']
    width=1260;height=1280
    chunks=[
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="1260" height="1280" fill="#07141f"/>',
        '<text x="36" y="38" fill="#cfeeff" font-family="sans-serif" font-size="23" font-weight="bold">AETHER-9 · UV ATLAS / PHASE 2.2</text>',
        '<text x="36" y="61" fill="#8dacbd" font-family="sans-serif" font-size="13">60 source meshes · nine independently bakeable material layouts · 2048 px target</text>',
    ]
    palette=("#66d5ec","#e5a96a","#9ba8f1","#7bd6ad","#c1b7ef","#f3ce83")
    for i,family in enumerate(families):
        x=30+(i%3)*410
        y=90+(i//3)*389
        chunks.append(f'<rect x="{x}" y="{y}" width="387" height="375" rx="10" fill="{background[i%len(background)]}" stroke="#426174"/>')
        chunks.append(f'<text x="{x+16}" y="{y+24}" fill="#e7faff" font-size="13" font-family="sans-serif">{html.escape(family)}</text>')
        count=report["families"][family]["object_count"]
        chunks.append(f'<text x="{x+16}" y="{y+43}" fill="#8eb1c1" font-size="11" font-family="sans-serif">{count} mesh objects</text>')
        left=x+20;top=y+56;span=292
        chunks.append(f'<rect x="{left}" y="{top}" width="{span}" height="{span}" fill="#07141b" stroke="#416f81"/>')
        for j,(name,tile) in enumerate(sorted(report["families"][family]["uv_tiles"].items())):
            u0,v0,u1,v1=tile
            rx=left+u0*span
            ry=top+(1-v1)*span
            w=(u1-u0)*span
            h=(v1-v0)*span
            clr=palette[j%len(palette)]
            chunks.append(f'<rect x="{rx:.2f}" y="{ry:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{clr}" fill-opacity=".76" stroke="#e0f7ff" stroke-width=".5"/>')
    chunks.append('</svg>')
    return "\n".join(chunks)
