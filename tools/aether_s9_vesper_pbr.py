"""AETHER-S9 VESPER / Stage 3: AR-family PBR skin development.
Purely fictional, NONFUNCTIONAL science-fiction game cosmetic.
Reads the sculpted Blender .blend source; preserves sculpt project and original AR.
Exports three self-contained textured GLBs and side/hero proof renders.

Run with Blender 3.x:
  PYTHONPATH=/usr/lib/python3/dist-packages blender -b -t 2 --python \
      tools/aether_s9_vesper_pbr.py -- art/blender/aether-s9-vesper-sculpt.blend build/vesper-pbr
"""
from __future__ import annotations
import json, math, sys
from pathlib import Path
import bpy
import numpy as np
from PIL import Image
from mathutils import Vector

argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
SOURCE=Path(argv[0] if len(argv)>0 else "art/blender/aether-s9-vesper-sculpt.blend").resolve()
OUT=Path(argv[1] if len(argv)>1 else "build/vesper-pbr").resolve()
OUT.mkdir(parents=True,exist_ok=True)
if not SOURCE.is_file():
    raise FileNotFoundError("VESPER sculpt source missing: "+str(SOURCE))
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
asset=bpy.data.collections.get("AETHER-S9 VESPER / sculpted geometry")
if not asset:
    raise RuntimeError("Expected VESPER sculpt collection missing; wrong input .blend")
scene=bpy.context.scene

PALETTE={
 "midnight":{
  "ceramic":((15,35,48),.22,.50),"frame":((101,133,147),.83,.35),
  "mid":((35,57,72),.75,.40),"polymer":((17,27,35),.08,.82),
  "silver":((170,203,218),.91,.28),"cyan":((12,136,195),.14,.22),
  "glass":((45,104,133),.24,.13),"copper":((197,92,48),.60,.37),
  "carbon":((14,24,33),.21,.76)
 },
 "glacier":{
  "ceramic":((172,196,208),.26,.42),"frame":((135,166,180),.82,.30),
  "mid":((54,86,106),.68,.40),"polymer":((37,55,67),.10,.78),
  "silver":((205,226,233),.92,.23),"cyan":((47,192,241),.14,.19),
  "glass":((87,164,199),.25,.12),"copper":((231,165,90),.58,.33),
  "carbon":((34,60,75),.25,.73)
 },
 "eclipse":{
  "ceramic":((30,26,45),.24,.49),"frame":((91,84,125),.78,.33),
  "mid":((34,30,56),.72,.41),"polymer":((25,24,39),.09,.84),
  "silver":((158,143,182),.86,.28),"cyan":((158,64,236),.16,.20),
  "glass":((112,68,150),.22,.14),"copper":((246,176,82),.67,.33),
  "carbon":((18,17,30),.19,.81)
 }
}
ROLES=tuple(PALETTE["midnight"])
SIZE=1024
BICUBIC=getattr(getattr(Image,"Resampling",Image),"BICUBIC")
MAPS={}

def save(data,path):
    Image.fromarray(np.uint8(np.clip(data,0,255)),"RGB").save(
        str(path),format="PNG",compress_level=6,optimize=True
    )
    return path

def channel_noise(seed):
    rng=np.random.default_rng(seed)
    coarse=rng.integers(0,256,(64,64),dtype=np.uint8)
    enlarged=np.asarray(Image.fromarray(coarse,"L").resize((SIZE,SIZE),BICUBIC),dtype=np.float32)
    return (enlarged/255-.5),rng

def make_role_maps(role):
    seed=973+ROLES.index(role)*191
    noise,rng=channel_noise(seed)
    y,x=np.mgrid[:SIZE,:SIZE]
    x=x.astype(np.float32)/SIZE
    y=y.astype(np.float32)/SIZE
    # Micro-texture: fine directional brushing in alloys, quiet ceramic grain.
    # Explicitly material texture height, NOT a fake high-poly sculpt bake.
    alloy=role in ("frame","mid","silver","copper")
    bristle=np.sin(2*math.pi*(x*(137 if alloy else 43)+y*(2.9 if alloy else 1.4)))
    etch=np.sin(2*math.pi*(x*18+y*.3))
    fine=rng.normal(0,1,(SIZE,SIZE)).astype(np.float32)
    height=noise*.33+bristle*(.17 if alloy else .07)+etch*.055+fine*.02
    gradient_y,gradient_x=np.gradient(height)
    strength=3.0 if alloy else 1.15
    nx=-gradient_x*strength
    ny=-gradient_y*strength
    nz=np.ones_like(nx)
    length=np.sqrt(nx*nx+ny*ny+nz*nz)
    normal=np.stack(((nx/length*.5+.5)*255,(ny/length*.5+.5)*255,
                     (nz/length*.5+.5)*255),axis=-1)
    normal_file=save(normal,OUT/("vesper-"+role+"-tangent-normal.png"))
    rough0=PALETTE["midnight"][role][2]
    metal0=PALETTE["midnight"][role][1]
    rough=np.clip(rough0+noise*.06+bristle*.018,0.08,0.96)
    metal=np.clip(metal0+noise*.025,0,.99)
    # AO texture channel starts neutral. These are NOT claimed as baked AO.
    occlusion=np.full((SIZE,SIZE),255,np.float32)
    orm=np.stack((occlusion,rough*255,metal*255),axis=-1)
    orm_file=save(orm,OUT/("vesper-"+role+"-orm.png"))
    MAPS[("shared",role,"normal")]=normal_file
    MAPS[("shared",role,"orm")]=orm_file
    for finish in PALETTE:
        base=np.asarray(PALETTE[finish][role][0],dtype=np.float32)
        variation=noise*13+bristle*(3 if alloy else 1.5)
        if role in ("cyan","glass"):variation=variation*.16
        rgb=np.clip(base[None,None,:]+variation[:,:,None],0,255)
        base_file=save(rgb,OUT/("vesper-"+finish+"-"+role+"-basecolor.png"))
        MAPS[(finish,role,"base")]=base_file
        if role=="cyan":
            emit=rgb*.75+np.asarray(PALETTE[finish][role][0],dtype=np.float32)[None,None,:]*.25
            emit_file=save(emit,OUT/("vesper-"+finish+"-"+role+"-emissive.png"))
            MAPS[(finish,role,"emit")]=emit_file

# Convert only sculpt collection curves to exportable meshes, preserve original .blend.
for ob in list(asset.objects):
    if ob.type!="CURVE":continue
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.convert(target="MESH")

objects=[ob for ob in asset.objects if ob.type=="MESH"]
if len(objects)<32:
    raise RuntimeError("Not enough sculpted geometry: "+str(len(objects)))
if {ob.get("art_role") for ob in objects}!=set(ROLES):
    raise RuntimeError("Sculpt material roles do not cover AR's nine material families")

# UV geometry is authored here, before any image-based PBR material is applied.
for ob in objects:
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
    if ob.mode!="OBJECT":bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.2,island_margin=.025)
    bpy.ops.object.mode_set(mode="OBJECT")
    if len(ob.data.uv_layers)<1:
        raise RuntimeError("UV mapping failed on "+ob.name)

for role in ROLES:
    make_role_maps(role)

def image(path,noncolor=False):
    im=bpy.data.images.load(str(path),check_existing=True)
    if noncolor:
        try:im.colorspace_settings.name="Non-Color"
        except TypeError:im.colorspace_settings.name="Linear"
    else:im.colorspace_settings.name="sRGB"
    return im

def tex(nodes,path,name,noncolor=False):
    n=nodes.new("ShaderNodeTexImage")
    n.name="VESPER / "+name
    n.image=image(path,noncolor)
    n.interpolation="Linear"
    return n

def material(role,finish):
    base,metal,rough=PALETTE[finish][role]
    m=bpy.data.materials.new("AETHER S9 / "+finish+" / "+role)
    m.use_nodes=True
    n=m.node_tree.nodes;n.clear()
    links=m.node_tree.links
    out=n.new("ShaderNodeOutputMaterial")
    bs=n.new("ShaderNodeBsdfPrincipled")
    links.new(bs.outputs["BSDF"],out.inputs["Surface"])
    base_node=tex(n,MAPS[(finish,role,"base")],"BaseColor")
    links.new(base_node.outputs["Color"],bs.inputs["Base Color"])
    orm=tex(n,MAPS[("shared",role,"orm")],"OcclusionRoughnessMetal",True)
    split=n.new("ShaderNodeSeparateRGB")
    links.new(orm.outputs["Color"],split.inputs["Image"])
    links.new(split.outputs["G"],bs.inputs["Roughness"])
    links.new(split.outputs["B"],bs.inputs["Metallic"])
    normal_node=tex(n,MAPS[("shared",role,"normal")],"TangentNormal",True)
    norm=n.new("ShaderNodeNormalMap")
    norm.inputs["Strength"].default_value=.42 if role in ("cyan","glass") else .68
    links.new(normal_node.outputs["Color"],norm.inputs["Color"])
    links.new(norm.outputs["Normal"],bs.inputs["Normal"])
    if role=="cyan":
        e=tex(n,MAPS[(finish,role,"emit")],"Emissive")
        socket="Emission" if "Emission" in bs.inputs else "Emission Color"
        links.new(e.outputs["Color"],bs.inputs[socket])
        if "Emission Strength" in bs.inputs:
            bs.inputs["Emission Strength"].default_value=1.55
    if role=="glass":
        bs.inputs["Alpha"].default_value=.70
        m.blend_method="BLEND"
    m["aether_family"]=role;m["aether_finish"]=finish
    m["material_status"]="1024px mapped PBR; neutral AO; height-derived normals"
    return m

def apply_finish(finish):
    mats={role:material(role,finish) for role in ROLES}
    for ob in objects:
        ob.data.materials.clear()
        ob.data.materials.append(mats[ob["art_role"]])

scene.render.engine="BLENDER_EEVEE"
scene.eevee.taa_render_samples=48
scene.view_settings.view_transform="Standard"
scene.view_settings.look="Medium High Contrast" if False else "None"
scene.view_settings.exposure=-.45
scene.view_settings.gamma=1.0
scene.render.resolution_x=1360
scene.render.resolution_y=820
scene.render.resolution_percentage=100
scene.render.film_transparent=False
for light in bpy.data.lights:
    light.energy*=.54
cam=scene.camera
if not cam:
    raise RuntimeError("Sculpt source missing studio camera")
views={
 "hero":((6.6,4.5,3.8),(0,-.05,.12),4.65),
 "profile":((8.3,-.08,1.8),(0,-.05,.12),4.6)
}
def set_camera(which):
    p,t,scale=views[which]
    cam.location=p
    cam.rotation_euler=(Vector(t)-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.type="ORTHO";cam.data.ortho_scale=scale

def export(finish):
    filepath=OUT/("aether-s9-vesper-"+finish+".glb")
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    options={"filepath":str(filepath),"export_format":"GLB"}
    props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "use_selection" in props:options["use_selection"]=True
    if "export_selected" in props:options["export_selected"]=True
    if "export_texcoords" in props:options["export_texcoords"]=True
    if "export_normals" in props:options["export_normals"]=True
    if "export_apply" in props:options["export_apply"]=True
    bpy.ops.export_scene.gltf(**options)
    if not filepath.is_file() or filepath.stat().st_size<100_000:
        raise RuntimeError("GLB export failed: "+str(filepath))
    return filepath.stat().st_size

sizes={}
for finish in PALETTE:
    print("VESPER_PBR_FINISH_START",finish,flush=True)
    apply_finish(finish)
    sizes[finish]=export(finish)
    for view in views:
        set_camera(view)
        scene.render.filepath=str(OUT/("aether-s9-vesper-pbr-"+finish+"-"+view+".png"))
        bpy.ops.render.render(write_still=True)
    if finish=="midnight":
        # Textured, editable source preserving UVs and custom material node graph.
        set_camera("hero")
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"aether-s9-vesper-pbr.blend"))

report={
 "asset":"AETHER-S9 VESPER",
 "phase":"3 / texture-mapped PBR art",
 "fictional_nonfunctional_art":True,
 "old_s9_replaced":False,
 "textures": {"resolution":SIZE,"unique_maps":len(MAPS),
              "sources":"basecolor, ORM, tangent normal, cyan emissive",
              "ao":"neutral, not geometry-baked",
              "normal":"procedural height-derived, not sculpt-baked"},
 "mesh_objects":len(objects),
 "material_families":list(ROLES),
 "finish_glb_bytes":sizes,
 "review_views":list(views),
 "source_blend":"aether-s9-vesper-pbr.blend",
 "production_approval":"pending visual comparison and school-laptop performance check"
}
(OUT/"aether-s9-vesper-pbr-report.json").write_text(json.dumps(report,indent=2))
print("VESPER_PBR_DONE",json.dumps(report),flush=True)
