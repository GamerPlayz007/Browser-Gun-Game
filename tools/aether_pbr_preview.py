"""AETHER Phase 3 / standalone image-backed PBR review studio.

Render exported *.glb scene in a clean Blender setup rather than relying on
the post-AO-bake authoring scene; outputs validated visible PNG images.
No changes to visual meshes, UVs, textures, or multiplayer gameplay.
Requires Blender 3, Pillow and NumPy from system Python on Ubuntu.
"""
from pathlib import Path
import argparse
import json
import sys

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image


def studio_light(name,position,target,energy,color,size=6):
    light=bpy.data.lights.new(name,"AREA")
    light.energy=energy
    light.shape="DISK"
    light.size=size
    light.color=color
    obj=bpy.data.objects.new(name,light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def build_and_render(glb_path,out_path,skin):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if len(meshes)<70:
        raise RuntimeError(f"Only {len(meshes)} imported mesh objects")
    mins=Vector((1e20,1e20,1e20))
    maxs=Vector((-1e20,-1e20,-1e20))
    for obj in meshes:
        for p in obj.bound_box:
            q=obj.matrix_world@Vector(p)
            for j in range(3):
                mins[j]=min(mins[j],q[j])
                maxs[j]=max(maxs[j],q[j])
    center=(mins+maxs)*.5
    extent=max(maxs[i]-mins[i] for i in range(3))
    if not 1<extent<25:
        raise RuntimeError(f"Unexpected mesh bounds {mins} / {maxs}")
    scene=bpy.context.scene

    camera_data=bpy.data.cameras.new("AETHER / real asset review camera")
    camera=bpy.data.objects.new("AETHER / real asset review camera",camera_data)
    scene.collection.objects.link(camera)
    camera.location=center+Vector((1.42,-1.66,0.86)).normalized()*extent*2.5
    camera.rotation_euler=(center-camera.location).to_track_quat("-Z","Y").to_euler()
    camera_data.type="ORTHO"
    camera_data.ortho_scale=extent*1.54
    scene.camera=camera

    world=bpy.data.worlds.new("AETHER / soft neutral studio")
    world.use_nodes=True
    bg=world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=(.35,.41,.50,1)
    bg.inputs["Strength"].default_value=.70
    scene.world=world

    studio_light("KEY / large neutral softbox",center+Vector((4.2,-4.6,6.4)),
                 center,1900,(1.0,.96,.92),7)
    studio_light("FILL / cyan-blue",center+Vector((-5.0,-.8,2.5)),
                 center,1550,(.59,.81,1.0),6)
    studio_light("RIM / rear neutral",center+Vector((1.2,6.2,4.5)),
                 center,2450,(.83,.91,1.0),5)
    studio_light("LOW / front bounce",center+Vector((2.5,-1.8,-3.2)),
                 center,850,(.78,.86,1.0),4)

    scene.render.engine="CYCLES"
    scene.cycles.samples=18
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1152
    scene.render.resolution_y=720
    scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.view_settings.view_transform="Standard"
    scene.view_settings.look="None"
    scene.view_settings.exposure=.42
    scene.view_settings.gamma=1.0

    raw=out_path.with_name(out_path.stem+"-raw.png")
    scene.render.filepath=str(raw)
    bpy.ops.render.render(write_still=True)
    fg=Image.open(raw).convert("RGBA")
    colors=np.asarray(fg,dtype=np.uint8)
    alpha=colors[:,:,3]>28
    visible=int(alpha.sum())
    if visible<10000:
        raise RuntimeError(f"{skin}: model invisible in true PBR render: {visible} pixels")
    mean_luma=float(np.mean(colors[:,:,:3][alpha]))
    if mean_luma<17:
        raise RuntimeError(f"{skin}: lit model remains too dark: {mean_luma:.2f}")
    # Composite against a deliberate photographic dark studio gradient.
    h,w=colors.shape[:2]
    yy=np.linspace(0,1,h,dtype=np.float32)[:,None,None]
    top=np.array([7,18,30],dtype=np.float32)[None,None,:]
    bottom=np.array([22,37,53],dtype=np.float32)[None,None,:]
    gradient=np.clip(top*(1-yy)+bottom*yy,0,255).astype(np.uint8)
    backdrop=np.broadcast_to(gradient,(h,w,3)).copy()
    bg_image=Image.fromarray(backdrop,"RGB").convert("RGBA")
    result=Image.alpha_composite(bg_image,fg)
    result.convert("RGB").save(out_path,optimize=True)
    raw.unlink(missing_ok=True)
    if out_path.stat().st_size<10000:
        raise RuntimeError("PBR render PNG is suspiciously small")
    return {
        "skin":skin,"imported_meshes":len(meshes),
        "bounds_min":[round(v,4) for v in mins],
        "bounds_max":[round(v,4) for v in maxs],
        "visible_pixels":visible,"mean_lit_rgb":round(mean_luma,2),
        "preview_file":out_path.name,"bytes":out_path.stat().st_size,
        "render_engine":"Blender Cycles; freshly imported GLB with real PBR images"
    }


def main():
    cli=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--asset-dir",default="static/assets")
    parser.add_argument("--out-dir",default="static/previews")
    args=parser.parse_args(cli)
    asset=Path(args.asset_dir).resolve()
    out=Path(args.out_dir).resolve()
    out.mkdir(exist_ok=True,parents=True)
    result={}
    for skin in ("midnight","glacier","eclipse"):
        glb=asset/f"aether9-specter-{skin}.glb"
        if not glb.is_file():
            raise FileNotFoundError(glb)
        path=out/f"aether9-specter-{skin}-pbr.png"
        result[skin]=build_and_render(glb,path,skin)
        print("VISIBLE_PBR_RENDER "+json.dumps(result[skin]),flush=True)
    (out/"aether9-pbr-visual-qa.json").write_text(
        json.dumps(result,indent=2),encoding="utf-8"
    )


if __name__=="__main__":
    main()
