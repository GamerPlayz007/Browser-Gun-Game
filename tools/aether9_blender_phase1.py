"""CROSSFire / AETHER-9 SPECTER — Blender Phase 1 sculpt.
Original nonfunctional science-fiction game art. No operational parts.

The Blender scene is an editable native project with individual material groups,
mesh objects, bevel modifiers, UVs and review cameras. Exported GLB is a
self-contained asset, not a runtime Three.js geometry recipe.

Run:
 blender --background --python tools/aether9_blender_phase1.py -- --output-dir output/phase1
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix

# Import repeatable topology review helpers beside the source builder.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from aether_topology21 import prepare_topology
from aether_uv22 import prepare_uv_atlases, unwrap_export_curves
from aether_uvqa23 import audit_uv_quality
from aether_pbr_phase3 import build_pbr, STYLES


def main():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="output/aether9-phase1")
    args = parser.parse_args(cli)
    out = Path(args.output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    asset = bpy.data.collections.new("AETHER-9 SPECTER / EDITABLE GAME ART")
    bpy.context.scene.collection.children.link(asset)
    studio = bpy.data.collections.new("STUDIO / NOT EXPORTED")
    bpy.context.scene.collection.children.link(studio)

    def move_to(obj, collection=asset):
        for col in tuple(obj.users_collection):
            col.objects.unlink(obj)
        collection.objects.link(obj)
        return obj

    def material(name, rgba, metallic=0, roughness=.5, emission=None, alpha=1):
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = (*rgba[:3], alpha)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*rgba[:3], alpha)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission is not None:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission, 1)
                bsdf.inputs["Emission Strength"].default_value = 2.6
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emission, 1)
                bsdf.inputs["Emission Strength"].default_value = 2.6
        if alpha < 1:
            mat.diffuse_color = (*rgba[:3], alpha)
            if hasattr(mat, "blend_method"):
                mat.blend_method = "BLEND"
        return mat

    M = {
        "ceramic": material("01 | Matte graphite ceramic", (.060,.120,.165), .23,.55),
        "frame": material("02 | Satin titanium alloy", (.36,.55,.64), .87,.33),
        "mid": material("03 | Gunmetal structural inlay", (.12,.23,.30), .78,.39),
        "polymer": material("04 | Carbon-black soft polymer", (.033,.063,.09), .12,.79),
        "silver": material("05 | Honed silver edges", (.75,.84,.89), .9,.26),
        "cyan": material("06 | Photonic cyan / artwork", (.045,.63,.84), .18,.24,
                         emission=(.018,.61,.95)),
        "glass": material("07 | Blue translucent optical glass", (.10,.33,.46), .27,.17,
                          alpha=.63),
        "copper": material("08 | Warm alloy insignia", (.83,.39,.20), .66,.37),
        "carbon": material("09 | Recessed charcoal carbon", (.027,.053,.078), .28,.75),
    }

    def make_mesh(name, vertices, faces, mat, uvs=None, collection=asset):
        mesh = bpy.data.meshes.new(name + " | mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update(calc_edges=True)
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        mesh.materials.append(mat)
        if uvs:
            layer = mesh.uv_layers.new(name="UVMap")
            for polygon in mesh.polygons:
                for loop_id in polygon.loop_indices:
                    vi = mesh.loops[loop_id].vertex_index
                    layer.data[loop_id].uv = uvs[vi]
        else:
            # Initial review UVs. Dedicated UV islands + baked maps belong
            # to Phase 2 and 3; no claim of final atlas quality here.
            layer = mesh.uv_layers.new(name="UVMap")
            for poly in mesh.polygons:
                for li in poly.loop_indices:
                    vert = mesh.vertices[mesh.loops[li].vertex_index].co
                    layer.data[li].uv = (vert.x*.18+.5, vert.z*.14+.5)
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        return obj

    def loft(name, rings, mat, sides=16, power=.70):
        verts, faces, uv = [], [], []
        for ri, (z,y,w,h,x) in enumerate(rings):
            for j in range(sides):
                angle = 2*math.pi*j/sides
                ca, sa = math.cos(angle), math.sin(angle)
                xx = math.copysign(abs(ca)**power,ca)*w
                yy = math.copysign(abs(sa)**power,sa)*h
                verts.append((x+xx,y+yy,z))
                uv.append((j/sides,ri/max(1,len(rings)-1)))
        for ri in range(len(rings)-1):
            for j in range(sides):
                jn = (j+1)%sides
                a=ri*sides+j; b=ri*sides+jn
                c=(ri+1)*sides+jn; d=(ri+1)*sides+j
                faces.append((a,d,c,b))
        start=len(verts)
        verts.append((rings[0][4],rings[0][1],rings[0][0]))
        verts.append((rings[-1][4],rings[-1][1],rings[-1][0]))
        uv.extend([(.5,.5),(.5,.5)])
        for j in range(sides):
            faces.append((start,j,(j+1)%sides))
            last=(len(rings)-1)*sides
            faces.append((start+1,last+(j+1)%sides,last+j))
        return make_mesh(name,verts,faces,mat,uv)

    def plate(name,outline,side,x,depth,mat,bevel=.008):
        # Polygonal surface in z/y plane, extruded across x.
        verts=[(side*x,y,z) for z,y in outline]
        verts.extend((side*(x-depth),y,z) for z,y in outline)
        n=len(outline)
        faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
        for j in range(n):
            k=(j+1)%n
            faces.append((j,k,k+n,j+n))
        obj=make_mesh(name,verts,faces,mat)
        if bevel:
            mod=obj.modifiers.new("Subtle machined edge bevel","BEVEL")
            mod.width=bevel;mod.segments=3
            if hasattr(mod,"affect"):
                mod.affect="EDGES"
        return obj

    def cuboid(name, center, dims, mat, bevel=.012, collection=asset):
        bpy.ops.mesh.primitive_cube_add(size=1,location=center)
        obj=bpy.context.object;obj.name=name
        obj.dimensions=dims
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        move_to(obj,collection)
        obj.data.materials.append(mat)
        if bevel:
            mod=obj.modifiers.new("Studio bevel / non-destructive","BEVEL")
            mod.width=bevel;mod.segments=3
        return obj

    def tube(name,points,r,mat,resolution=3):
        crv=bpy.data.curves.new(name,"CURVE")
        crv.dimensions="3D"
        crv.resolution_u=16;crv.bevel_depth=r;crv.bevel_resolution=resolution
        spline=crv.splines.new("POLY")
        spline.points.add(len(points)-1)
        for p,co in zip(spline.points,points):
            p.co=(*co,1)
        obj=bpy.data.objects.new(name,crv);asset.objects.link(obj)
        crv.materials.append(mat)
        return obj

    def ring(name,center,major,minor,mat):
        bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=10,
                                         location=center,
                                         major_radius=major,minor_radius=minor)
        obj=bpy.context.object;obj.name=name;move_to(obj)
        obj.data.materials.append(mat)
        return obj

    # HERO: coherent tapered shell; nose faces negative Z.
    loft("01 / Ceramic monocoque : visual silhouette",[
        (.63,.17,.14,.13,0),(.41,.18,.23,.17,0),
        (.11,.19,.29,.19,0),(-.26,.19,.32,.20,0),
        (-.66,.19,.32,.19,0),(-1.06,.20,.30,.18,0),
        (-1.49,.21,.27,.17,0),(-1.91,.20,.23,.14,0),
        (-2.31,.18,.15,.11,0),(-2.53,.18,.08,.065,0)
    ],M["ceramic"],sides=28,power=.62)

    loft("02 / Raised continuous titanium spine",[
        (.51,.31,.08,.045,0),(.09,.39,.15,.070,0),
        (-.62,.41,.17,.074,0),(-1.18,.39,.13,.063,0),
        (-1.82,.35,.10,.052,0),(-2.41,.25,.04,.032,0)
    ],M["frame"],sides=16,power=.61)

    tube("03 / Single dorsal light line",[
        (0,.44,.33),(0,.47,-.09),(0,.50,-.54),
        (0,.48,-1.08),(0,.43,-1.68),(0,.35,-2.29)
    ],.009,M["cyan"])

    for side in (-1,1):
        S="LEFT" if side==-1 else "RIGHT"
        plate(S+" / Swept structural cheek",[
            (-1.00,.27),(-.62,.34),(-.12,.31),(.34,.22),
            (.42,.145),(.23,.060),(-.32,.022),(-.91,.095)
        ],side,.355,.038,M["frame"],.012)
        plate(S+" / Quiet ceramic insert",[
            (-.80,.25),(-.49,.28),(-.13,.24),
            (-.20,.18),(-.64,.16)
        ],side,.402,.013,M["carbon"],.007)
        plate(S+" / Satin highlight",[
            (-.74,.260),(-.46,.29),(-.17,.27),(-.38,.236)
        ],side,.421,.008,M["silver"],.005)
        plate(S+" / Vent-side aero fin",[
            (-2.42,.19),(-2.22,.35),(-1.85,.36),
            (-1.56,.31),(-1.61,.23),(-2.11,.11)
        ],side,.272,.060,M["ceramic"],.011)
        tube(S+" / Cyan side trace",[
            (side*.422,.08,-.93),(side*.428,.055,-.61),
            (side*.422,.060,-.31),(side*.400,.08,.05)
        ],.009,M["cyan"])
        for k in range(4):
            cuboid(S+f" / light recess {k+1}",
                   (side*.337,.285,-2.30+k*.17),
                   (.011,.023,.054),M["cyan"],.002)
        # Architectural rear frame, visibly open rather than a block.
        loft(S+" / Monolithic stock arch",[
            (.42,.27,.053,.049,side*.20),(.77,.31,.065,.061,side*.23),
            (1.08,.30,.066,.053,side*.24),
            (1.46,.26,.053,.047,side*.24),
            (1.68,.21,.041,.035,side*.23)
        ],M["ceramic"],sides=12,power=.70)
        tube(S+" / Lower open cantilever",[
            (side*.22,.12,.49),(side*.23,.055,.88),
            (side*.24,.065,1.25),(side*.24,.16,1.63)
        ],.031,M["frame"])
        tube(S+" / Upper fine rim",[
            (side*.25,.35,.79),(side*.26,.35,1.12),
            (side*.25,.30,1.48)
        ],.010,M["silver"])
        tube(S+" / Reactor visual cradle",[
            (side*.17,-.07,.26),(side*.19,-.31,.10),
            (side*.19,-.36,-.14),(side*.17,-.11,-.45)
        ],.026,M["frame"])
        tube(S+" / Core internal light",[
            (side*.182,-.18,.23),(side*.204,-.28,-.01),
            (side*.18,-.16,-.34)
        ],.008,M["cyan"])

    # Distinct lower geometric art feature; NOT a real detachable component.
    loft("04 / Graphite handguard support",[
        (.42,-.18,.145,.085,0),(.50,-.36,.16,.12,0),
        (.64,-.61,.158,.155,0),(.72,-.79,.145,.092,0)
    ],M["polymer"],sides=16)

    for k in range(7):
        for side in (-1,1):
            cuboid(f"Grip rib {side}-{k}",
                   (side*.165,-.43-k*.040,.52+k*.021),
                   (.012,.013,.084),M["mid"],.003)

    cuboid("05 / Rear ergonomic polymer pad",(0,.21,1.73),
           (.54,.32,.12),M["polymer"],.040)
    ring("06 / Rear satin inset",(0,.20,1.79),.21,.013,M["silver"])

    # Signature fictional lightguide: faceted blue core, glass shell and bars.
    loft("07 / Floating cyan energy prism",[
        (-.44,-.20,.038,.12,0),
        (-.27,-.20,.127,.18,0),
        (.08,-.20,.13,.17,0),
        (.31,-.20,.045,.12,0)
    ],M["cyan"],sides=12,power=.88)
    for side in (-1,1):
        loft(f"08 / Laminated outer core glass {side}",[
            (-.33,-.20,.019,.14,side*.154),
            (.08,-.20,.025,.16,side*.163),
            (.26,-.20,.018,.12,side*.153)
        ],M["glass"],sides=12)
    for k in range(5):
        cuboid(f"Photonic core indicator {k}",
               (0,-.20,-.24+k*.102),(.23,.025,.025),
               M["cyan"],.005)

    # Flush futuristic art visor. No target/operational mechanism represented.
    loft("09 / Integrated optical crown",[
        (-.77,.47,.18,.04,0),(-.58,.50,.205,.062,0),
        (-.29,.50,.19,.055,0),(-.17,.47,.17,.04,0)
    ],M["frame"],sides=12)
    for side in (-1,1):
        plate(f"10 / Visor sculpted cheek {side}",[
            (-.60,.48),(-.49,.62),(-.33,.63),(-.27,.49)
        ],side,.195,.028,M["ceramic"],.007)
    cuboid("11 / Cyan holographic viewing panel",(0,.55,-.64),
           (.325,.17,.025),M["glass"],.009)
    ring("12 / Translucent visor halo",(0,.55,-.668),
         .064,.007,M["cyan"])

    # Sparse designer accents, not thousands of arbitrary fasteners.
    for side in (-1,1):
        for k in range(3):
            cuboid(f"13 / Copper ID mark {side}-{k}",
                   (side*.43,.27,-.62+k*.14),(.01,.03,.052),
                   M["copper"],.003)

    # Phase 1.3: artist-directed shape refinements (purely fictional art).
    # Quiet carved surfaces and long luminous ribbons make the major forms
    # read at normal viewing distance without overwhelming them with details.
    for side in (-1,1):
        label = "LEFT" if side < 0 else "RIGHT"
        plate(label+" / Faceted floating prow shield",[
            (-2.42,.200),(-2.18,.325),(-1.91,.336),
            (-1.72,.267),(-1.84,.160),(-2.23,.113)
        ],side,.294,.023,M["frame"],.008)
        plate(label+" / Wide recessed ceramic flank",[
            (-1.49,.128),(-1.28,.205),(-1.07,.191),
            (-1.00,.090),(-1.26,.043)
        ],side,.342,.018,M["carbon"],.007)
        tube(label+" / Sweeping hero highlight",[
            (side*.375,.259,-1.72),(side*.390,.299,-1.52),
            (side*.411,.314,-1.28),(side*.423,.302,-1.06)
        ],.010,M["silver"])
        # This floating ornament provides negative space and a subtle
        # science-fiction signature, not an actual functional mechanism.
        tube(label+" / Cyan decorative back sweep",[
            (side*.273,.299,.82),(side*.285,.318,1.08),
            (side*.282,.293,1.43)
        ],.0075,M["cyan"])

    # Axis normalization: modeling profiles used Y-up because the game uses
    # Three.js Y-up. Blender uses Z-up and its glTF exporter swaps axes.
    # Rotate the authored collection +90 degrees around Blender X so the
    # resulting glTF returns to the intended horizontal game orientation.
    # We apply this before .blend is saved, so the native Blender scene
    # is also correctly oriented (Z-up, weapon longitudinal in XY plane).
    axis_rotation=Matrix.Rotation(math.pi / 2, 4, "X")
    for asset_obj in asset.objects:
        # Matrix multiplication transforms both local orientation AND world
        # location. Simply changing rotation_euler incorrectly leaves
        # detached graphic details floating at their pre-rotation positions.
        asset_obj.matrix_world = axis_rotation @ asset_obj.matrix_world

    # Phase 2.1: perform cosmetic geometry cleanup before scene organization.
    # Lightguide curves remain editable in the .blend; GLB uses their meshes.
    topology_report=prepare_topology(list(asset.objects))
    if topology_report["stats"]["meshes"]<25:
        raise RuntimeError("Too few mesh objects for the topology audit")
    (out/"aether9-phase2-topology.json").write_text(
        json.dumps(topology_report,indent=2),encoding="utf-8"
    )
    # Phase 2.2 / unwrapping and atlas allocation happen BEFORE the .blend
    # source file is saved. Separate art material families use distinct UVs.
    uv_report=prepare_uv_atlases(list(asset.objects),out)
    if uv_report["source_mesh_count"]!=topology_report["stats"]["meshes"]:
        raise RuntimeError("UV map does not cover all authored source meshes")
    # Phase 2.3: check true face-to-face island seams, overlap, gutter
    # clearance, and per-triangle world-space-to-UV distortion.
    qa_report=audit_uv_quality(list(asset.objects),out,uv_report)
    if not qa_report["passed"]:
        raise RuntimeError("Phase 2.3 UV quality review failed")

    # Phase 1.4 / deterministic scene organization for Blender editing and
    # portable scene exports. These are ART groups, never physical mechanisms.
    # Each mesh/curve retains its world transform after parenting.
    GROUP_SPECS = (
        ("SHELL", "01 | SHELL / primary sculpt"),
        ("SPINE", "02 | SPINE / crest and crown"),
        ("PANELS", "03 | PANELS / floating side sculpture"),
        ("REAR", "04 | REAR / open-frame silhouette"),
        ("VISOR", "05 | VISOR / optical ornament"),
        ("CORE", "06 | CORE / fictional light artwork"),
        ("GRIP", "07 | GRIP / lower support"),
        ("ACCENTS", "08 | ACCENTS / micro-details"),
    )
    def classify_art_group(name):
        text=name.lower()
        if "ceramic monocoque" in text:
            return "SHELL"
        if "titanium spine" in text or "dorsal light" in text:
            return "SPINE"
        if any(tag in text for tag in (
            "monolithic stock", "rear", "open cantilever", "upper fine rim",
            "cyan decorative back sweep")):
            return "REAR"
        if any(tag in text for tag in (
            "integrated optical", "visor", "holographic", "optical crown")):
            return "VISOR"
        if any(tag in text for tag in (
            "energy prism", "outer core", "photonic core", "core internal",
            "reactor", "cyan energy", "laminated outer", "core indicator")):
            return "CORE"
        if any(tag in text for tag in (
            "graphite handguard", "grip rib", "handgrip")):
            return "GRIP"
        if any(tag in text for tag in (
            "cheek", "flank", "aero fin", "hero highlight",
            "structural", "satin highlight", "ceramic insert",
            "side trace", "prow shield", "floating")):
            return "PANELS"
        return "ACCENTS"

    authored_objects=list(asset.objects)
    authored_names=[obj.name for obj in authored_objects]
    assert len(authored_names)==len(set(authored_names)), "Unstable Blender object names"
    groups={}
    group_counts={}
    root=bpy.data.objects.new("A9.ROOT.SPECTER",None)
    root["aether_asset"]="AETHER9_SPECTER"
    root["asset_version"]="2.3"
    root["asset_class"]="fictional-scifi-prop"
    asset.objects.link(root)
    for key,label in GROUP_SPECS:
        child=bpy.data.collections.new(label)
        asset.children.link(child)
        anchor=bpy.data.objects.new("A9.GRP."+key,None)
        child.objects.link(anchor)
        anchor.parent=root
        anchor["aether_group"]=key
        groups[key]=(child,anchor)
        group_counts[key]=0
    object_manifest=[]
    for obj in authored_objects:
        old_name=obj.name
        group=classify_art_group(old_name)
        if group not in groups:
            raise RuntimeError("Undefined Blender art group: "+group)
        collection,group_anchor=groups[group]
        old_transform=obj.matrix_world.copy()
        for prior in tuple(obj.users_collection):
            prior.objects.unlink(obj)
        collection.objects.link(obj)
        obj.parent=group_anchor
        obj.matrix_world=old_transform
        if (obj.matrix_world.translation-old_transform.translation).length>1e-6:
            raise RuntimeError("Regrouping shifted a sculpted element: "+old_name)
        group_counts[group]+=1
        obj["aether_group"]=group
        obj["aether_source_label"]=old_name
        obj["aether_asset"]="AETHER9_SPECTER"
        obj["aether_uv_state"]=(
            "material-family-atlas / UVMap" if obj.type=="MESH"
            else "editable-curve / generated UVs during export"
        )
        side=("L" if old_name.startswith("LEFT") or " -1" in old_name
              else "R" if old_name.startswith("RIGHT") or " 1" in old_name
              else "C")
        clean="".join(ch if ch.isalnum() else "_" for ch in old_name)
        clean="_".join(filter(None,clean.split("_")))[:25]
        obj.name=f"A9.{group}.{side}.{len(object_manifest)+1:03d}.{clean}"
        object_manifest.append({
            "id":obj.name,"group":group,"side":side,
            "source_label":old_name,"object_type":obj.type,
            "topology":topology_report["objects"].get(old_name),
            "uv":uv_report["objects"].get(old_name),
            "uv_quality":qa_report["objects"].get(old_name),
            "material_names":[m.name for m in obj.data.materials if m]
                if hasattr(obj.data,"materials") else [],
        })
    if len(object_manifest)!=len(authored_objects):
        raise RuntimeError("Grouping lost sculpted assets")
    if not all(count>0 for count in group_counts.values()):
        raise RuntimeError("An AETHER art group was left empty: "+str(group_counts))
    manifest={
        "schema":"crossfire-aether-art-asset-v1",
        "asset_id":"AETHER9_SPECTER",
        "phase":"2.3",
        "asset_kind":"original fictional sci-fi game prop",
        "asset_root":"A9.ROOT.SPECTER",
        "orientation":{"export_format":"glTF 2.0 binary",
                       "coordinate_system":"Y-up after Blender export",
                       "unit_scale":"Blender scene units"},
        "uv_status":"packed smart-projected source mesh UVs / 10px planned gutters",
        "uv_report":"aether9-phase2-uv.json",
        "uv_atlas_layout":"aether9-phase2-uv-layout.svg",
        "uv_material_family_count":uv_report["material_family_count"],
        "uv_source_mesh_count":uv_report["source_mesh_count"],
        "uv_quality_report":"aether9-phase2-uv-quality.json",
        "uv_island_layout":"aether9-phase2-islands.svg",
        "uv_qa_summary":qa_report["totals"],
        "baked_textures":"not yet (Phase 3)",
        "topology_status":"BMesh cleanup, watertight surfaces, outward normals and hard-edge shading",
        "topology_report":"aether9-phase2-topology.json",
        "topology_summary":topology_report["stats"],
        "material_families":{k:v.name for k,v in M.items()},
        "groups":{k:{"blender_collection":label,"object_count":group_counts[k],
                      "anchor":"A9.GRP."+k}
                  for k,label in GROUP_SPECS},
        "objects":object_manifest,
    }
    manifest_path=out/"aether9-phase1-manifest.json"
    manifest_path.write_text(json.dumps(manifest,indent=2),encoding="utf-8")

    # Scene setup: only models in ASSET collection are exported.
    ground = cuboid("STUDIO / Background", (0,0,-1.05),
                    (11,9,.16), material("STUDIO gray",(.018,.034,.051),.2,.75),
                    .02,studio)
    ground.hide_render=True  # uncluttered art-review renders

    def area(name,location,power,scale,temperature_color):
        light=bpy.data.lights.new(name,"AREA")
        light.energy=power
        light.shape="DISK"
        light.size=scale
        obj=bpy.data.objects.new(name,light)
        studio.objects.link(obj)
        obj.location=location
        direction=Vector((0,-.15,.05))-obj.location
        obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
        light.color=temperature_color

    area("STUDIO | Keybox",(3,-4,5),1700,6.0,(.83,.91,1.0))
    area("STUDIO | Cyan rim",(-3,2,4),1300,4.0,(.30,.76,1.0))
    area("STUDIO | Warm fill",(1,3,3),650,3.5,(1.0,.72,.49))

    camera=bpy.data.cameras.new("STUDIO camera / hero three-quarter")
    cam=bpy.data.objects.new("STUDIO camera / hero three-quarter",camera)
    studio.objects.link(cam)
    cam.location=(6.6,4.5,3.8)
    focus=Vector((0,-.35,.13))
    cam.rotation_euler=(focus-Vector(cam.location)).to_track_quat("-Z","Y").to_euler()
    camera.type="ORTHO";camera.ortho_scale=6.2
    scene=bpy.context.scene;scene.camera=cam
    scene.render.resolution_x=1360
    scene.render.resolution_y=820
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    if scene.world is None:
        scene.world=bpy.data.worlds.new("AETHER / studio environment")
    scene.world.color=(.075,.088,.115)

    # Blender file is the editable source of truth.
    blend=out/"aether9-specter-phase1.blend"
    glb=out/"aether9-specter-phase1.glb"
    preview=out/"aether9-specter-phase1.png"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    # Preserve truly editable curve objects inside .blend, then convert
    # the in-memory scene's luminous ribbons to exportable polygon meshes.
    # glTF cannot directly serialize Blender's bevel-curve primitives.
    converted_ribbons=[]
    for source_curve in [o for o in list(asset.all_objects) if o.type=="CURVE"]:
        bpy.ops.object.select_all(action="DESELECT")
        source_curve.select_set(True)
        bpy.context.view_layer.objects.active=source_curve
        bpy.ops.object.convert(target="MESH")
        converted_ribbons.append(bpy.context.view_layer.objects.active)
    # Each unbaked photonic ribbon is UV-enabled for glTF portability,
    # but reserved outside the material-family texture atlases.
    ribbon_uv_count=unwrap_export_curves(converted_ribbons)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in asset.all_objects:
        obj.select_set(True)
    if list(asset.all_objects):
        bpy.context.view_layer.objects.active=next(iter(asset.all_objects))
    props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs={"filepath":str(glb),"export_format":"GLB"}
    if "use_selection" in props:
        kwargs["use_selection"]=True
    if "export_selected" in props:
        kwargs["export_selected"]=True
    if "export_texcoords" in props:
        kwargs["export_texcoords"]=True
    if "export_normals" in props:
        kwargs["export_normals"]=True
    if "export_extras" in props:
        kwargs["export_extras"]=True
    bpy.ops.export_scene.gltf(**kwargs)

    # Phase 1.3 / review-grade geometry renders. Workbench gives robust,
    # deterministic visible MATERIAL color on headless CPU Blender 3.x.
    # These are sculpt/shape review frames, not final cinematic PBR renders.
    scene.render.engine="BLENDER_WORKBENCH"
    shade=scene.display.shading
    shade.light="STUDIO"
    shade.color_type="MATERIAL"
    shade.background_type="VIEWPORT"
    shade.background_color=(.029,.043,.067)
    shade.show_cavity=True
    shade.cavity_type="BOTH"
    shade.curvature_ridge_factor=1.12
    shade.curvature_valley_factor=1.02
    shade.show_shadows=True
    shade.show_specular_highlight=True
    shade.show_object_outline=True
    shade.object_outline_color=(.018,.030,.053)
    shade.studiolight_rotate_z=.26
    scene.view_settings.view_transform="Standard"
    scene.view_settings.look="None"  # Blender 3.0 runner uses Standard-only OCIO config
    scene.view_settings.exposure=.26
    scene.view_settings.gamma=1.0
    scene.render.image_settings.color_mode="RGBA"
    scene.render.film_transparent=False
    scene.render.resolution_percentage=100
    review_views={
        "hero": ((6.6,4.5,3.8),(0,.25,.12),6.5),
        "profile": ((9.8,.4,2.5),(0,.30,.12),6.0),
        "rear": ((-5.0,7.2,3.8),(0,.24,.12),6.6)
    }
    review_paths={}
    for label,(position,aim,scale) in review_views.items():
        cam.location=position
        target=Vector(aim)
        cam.rotation_euler=(target-Vector(position)).to_track_quat("-Z","Y").to_euler()
        camera.ortho_scale=scale
        scene.render.filepath=str(out/("aether9-specter-phase1.png" if label=="hero"
                                   else f"aether9-specter-phase1-{label}.png"))
        bpy.ops.render.render(write_still=True)
        if not Path(scene.render.filepath).is_file():
            raise RuntimeError(f"Missing Phase 1.3 {label} preview")
        review_paths[label]=scene.render.filepath
    # Return to the standard hero framing in the editable native scene.
    cam.location=review_views["hero"][0]
    cam.rotation_euler=(Vector(review_views["hero"][1])-Vector(cam.location)).to_track_quat("-Z","Y").to_euler()
    camera.ortho_scale=review_views["hero"][2]

    mesh_count=sum(1 for x in asset.all_objects if x.type=="MESH")
    named=len(list(asset.all_objects))
    tri_count=0
    for obj in asset.all_objects:
        if obj.type!="MESH":
            continue
        obj.data.calc_loop_triangles()
        tri_count+=len(obj.data.loop_triangles)

    report={
        "phase":"2.3","status":"Verified UV island integrity and Blender export",
        "source":str(blend),"asset":str(glb),
        "preview":str(preview) if preview.exists() else None,
        "review_angles":review_paths,
        "render_engine":"BLENDER_WORKBENCH / MATERIAL COLOR",
        "native_objects":named,"mesh_objects":mesh_count,
        "art_groups":group_counts,
        "topology_stats":topology_report["stats"],
        "topology_report":"aether9-phase2-topology.json",
        "uv_report":"aether9-phase2-uv.json",
        "uv_layout":"aether9-phase2-uv-layout.svg",
        "uv_quality_report":"aether9-phase2-uv-quality.json",
        "uv_island_layout":"aether9-phase2-islands.svg",
        "uv_qa_summary":qa_report["totals"],
        "uv_stats":{
            "source_mesh_count":uv_report["source_mesh_count"],
            "material_families":uv_report["material_family_count"],
            "uv_loops":uv_report["total_uv_loops"],
            "converted_ribbon_uv_meshes":ribbon_uv_count
        },
        "manifest":"aether9-phase1-manifest.json",
        "authoring_mesh_objects":len(authored_objects),
        "base_triangles_before_modifiers":tri_count,
        "uv_islands":"Phase 2.3 validated island padding, texture coordinate integrity and UV stretch",
        "texture_bakes":"pending Phase 3",
        "glb_bytes":glb.stat().st_size
    }
    (out/"aether9-phase1-report.json").write_text(json.dumps(report,indent=2))
    # Phase 3: build physically-based image textures, Cycles-baked AO,
    # height-derived surface normals, and three self-contained cosmetic GLBs.
    # The original Phase 2.3 geometry-review .blend/.glb remain unmodified;
    # this builds a new production art source and distinct PBR files.
    root["asset_version"]="3.4"
    original_meshes=[
        obj for obj in asset.all_objects
        if obj.type=="MESH" and obj.get("aether_source_label") in uv_report["objects"]
    ]
    if len(original_meshes)!=uv_report["source_mesh_count"]:
        raise RuntimeError("PBR baker did not locate all original UV meshes")
    def export_pbr_variant(filename):
        bpy.ops.object.select_all(action="DESELECT")
        for game_obj in asset.all_objects:
            game_obj.select_set(True)
        bpy.context.view_layer.objects.active=root
        options=dict(kwargs)
        options["filepath"]=str(filename)
        bpy.ops.export_scene.gltf(**options)
    pbr_report=build_pbr(
        original_meshes,M,list(asset.all_objects),out,
        export_pbr_variant,scene,cam
    )
    if set(pbr_report["variants"])!=set(STYLES):
        raise RuntimeError("Missing AETHER cosmetic finish")
    manifest["phase"]="3.4"
    manifest["material_workflow"]="external PNG PBR maps, Cycles AO and procedural height normals"
    manifest["pbr_file"]="aether9-specter-pbr.blend"
    manifest["pbr_report"]="aether9-phase3-report.json"
    manifest["pbr_variants"]={k:v["glb"] for k,v in pbr_report["variants"].items()}
    manifest["baked_textures"]="512px Cycles AO baked + upscaled 2K, height-derived normal textures"
    manifest_path.write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    report["phase"]="3.4"
    report["status"]="AETHER PBR skins, texture maps and AO baked"
    report["pbr_report"]="aether9-phase3-report.json"
    report["pbr_variants"]=pbr_report["variants"]
    report["pbr_source"]= "aether9-specter-pbr.blend"
    report["texture_bakes"]="Cycles AO 512 -> 2048; procedural height normals -> 2048"
    (out/"aether9-phase1-report.json").write_text(json.dumps(report,indent=2))
    print("CROSSFIRE_PBR_PHASE3 "+json.dumps({
        "phase":report["phase"],"variants":list(pbr_report["variants"]),
        "materials":len(M),"source_maps":pbr_report["source_texture_count"],
        "ao_bakes":len(pbr_report["bake_details"])
    }),flush=True)



if __name__=="__main__":
    main()
