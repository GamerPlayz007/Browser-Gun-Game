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
from mathutils import Vector


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
                faces.append((a,b,c,d))
        start=len(verts)
        verts.append((rings[0][4],rings[0][1],rings[0][0]))
        verts.append((rings[-1][4],rings[-1][1],rings[-1][0]))
        uv.extend([(.5,.5),(.5,.5)])
        for j in range(sides):
            faces.append((start,(j+1)%sides,j))
            last=(len(rings)-1)*sides
            faces.append((start+1,last+j,last+(j+1)%sides))
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
            mod.affect="EDGES" if hasattr(mod,"affect") else None
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
    ],M["ceramic"],sides=24,power=.62)

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

    # Scene setup: only models in ASSET collection are exported.
    ground = cuboid("STUDIO / Background", (0,-.98,0),
                    (11,.16,9), material("STUDIO gray",(.018,.034,.051),.2,.75),
                    .02,studio)
    ground.hide_render=False

    def area(name,location,power,scale,temperature_color):
        light=bpy.data.lights.new(name,"AREA")
        light.energy=power
        light.shape="DISK"
        light.size=scale
        obj=bpy.data.objects.new(name,light)
        studio.objects.link(obj)
        obj.location=location
        direction=Vector((0,.05,-.25))-obj.location
        obj.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
        light.color=temperature_color

    area("STUDIO | Keybox",(3,5,4),1100,6.0,(.83,.91,1.0))
    area("STUDIO | Cyan rim",(-2,4,-3),980,4.0,(.30,.76,1.0))
    area("STUDIO | Warm fill",(1,-1,4),500,3.5,(1.0,.72,.49))

    camera=bpy.data.cameras.new("STUDIO camera / hero three-quarter")
    cam=bpy.data.objects.new("STUDIO camera / hero three-quarter",camera)
    studio.objects.link(cam)
    cam.location=(5.9,3.05,6.8)
    focus=Vector((0,.02,-.35))
    cam.rotation_euler=(focus-Vector(cam.location)).to_track_quat("-Z","Y").to_euler()
    camera.type="ORTHO";camera.ortho_scale=7.6
    scene=bpy.context.scene;scene.camera=cam
    scene.render.resolution_x=1360
    scene.render.resolution_y=820
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    scene.world.color=(.015,.026,.043)

    # Blender file is the editable source of truth.
    blend=out/"aether9-specter-phase1.blend"
    glb=out/"aether9-specter-phase1.glb"
    preview=out/"aether9-specter-phase1.png"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in asset.objects:
        obj.select_set(True)
    if list(asset.objects):
        bpy.context.view_layer.objects.active=next(iter(asset.objects))
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
    bpy.ops.export_scene.gltf(**kwargs)

    # Render uses CPU-compatible Cycles instead of depending on GPU drivers.
    try:
        scene.render.engine="CYCLES"
        scene.cycles.samples=18
        scene.cycles.use_denoising=True
        scene.render.filepath=str(preview)
        bpy.ops.render.render(write_still=True)
    except Exception as exc:
        print("PREVIEW_NOT_RENDERED:",str(exc),flush=True)

    mesh_count=sum(1 for x in asset.objects if x.type=="MESH")
    named=len(list(asset.objects))
    tri_count=0
    for obj in asset.objects:
        if obj.type!="MESH":
            continue
        obj.data.calc_loop_triangles()
        tri_count+=len(obj.data.loop_triangles)

    report={
        "phase":"1","status":"Blender sculpt/export pass",
        "source":str(blend),"asset":str(glb),
        "preview":str(preview) if preview.exists() else None,
        "native_objects":named,"mesh_objects":mesh_count,
        "base_triangles_before_modifiers":tri_count,
        "uv_islands":"provisional / atlas pending Phase 2",
        "texture_bakes":"pending Phase 3",
        "glb_bytes":glb.stat().st_size
    }
    (out/"aether9-phase1-report.json").write_text(json.dumps(report,indent=2))
    print("CROSSFIRE_BLENDER_PHASE1 "+json.dumps(report),flush=True)


if __name__=="__main__":
    main()
