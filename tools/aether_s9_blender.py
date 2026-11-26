"""Blender-native, nonfunctional arcade sci-fi prop. Art-only, no mechanisms."""
import bpy, math, json, struct, sys
from pathlib import Path
from mathutils import Vector
import numpy as np

OUT = Path(sys.argv[sys.argv.index("--")+1]) if "--" in sys.argv else Path("build/aether-s9")
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=12
scene.cycles.device="CPU"
roles = {
 "ceramic":(.30,.36), "alloy":(.72,.29), "rubber":(.12,.65),
 "enamel":(.28,.31), "photon":(.16,.24), "accent":(.48,.35)
}
palettes={
 "midnight":{"ceramic":(.10,.18,.24),"alloy":(.34,.52,.60),"rubber":(.045,.075,.10),"enamel":(.73,.91,.94),"photon":(.04,.72,.95),"accent":(1,.36,.08)},
 "glacier":{"ceramic":(.65,.82,.88),"alloy":(.32,.51,.65),"rubber":(.065,.15,.22),"enamel":(.91,.95,1),"photon":(.12,.83,1),"accent":(1,.55,.13)},
 "eclipse":{"ceramic":(.25,.12,.35),"alloy":(.46,.30,.62),"rubber":(.08,.04,.14),"enamel":(.81,.72,.95),"photon":(.69,.21,1),"accent":(1,.45,.13)}
}
materials={}
def material(role):
    m=bpy.data.materials.new("S9 / "+role);m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Metallic"].default_value=roles[role][0]
    p.inputs["Roughness"].default_value=roles[role][1]
    p.inputs["Base Color"].default_value=(*palettes["midnight"][role],1)
    if role=="photon":
        p.inputs["Emission" if "Emission" in p.inputs else "Emission Color"].default_value=(*palettes["midnight"][role],1)
        p.inputs["Emission Strength"].default_value=1.8
    materials[role]=m
    return m
for role in roles:material(role)
parts=[]
def finish(o,name,role,bevel=.04):
    o.name=name;o.data.materials.append(materials[role])
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new("Soft sculpted edge","BEVEL");mod.width=bevel;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new("Weighted shading","WEIGHTED_NORMAL");mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(o)
    return o
def prism(name,profile,depth,role,y=0,bevel=.035):
    n=len(profile);v=[(x,y+s*depth/2,z) for s in (-1,1) for x,z in profile]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    f.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT");o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT");bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode="OBJECT")
    return finish(o,name,role,bevel)
def cube(name,loc,size,role,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.dimensions=size
    return finish(o,name,role,bevel)
# Exaggerated asymmetric, sealed, brightly coloured arcade sculpture.
prism("Continuous sculpted shell",[(-1.48,.36),(-1.23,.66),(.68,.70),(1.30,.43),(1.43,.10),(.94,-.22),(-.71,-.20),(-1.37,-.02)],.70,"ceramic",bevel=.075)
prism("Swept rear shell",[(-1.76,.43),(-1.37,.38),(-1.16,.05),(-1.48,-.04),(-1.72,.08)],.59,"enamel",bevel=.06)
prism("Integrated curved handle silhouette",[(-.65,-.10),(.12,-.10),(.02,-.42),(-.40,-.96),(-.79,-.86),(-.85,-.57)],.46,"rubber",bevel=.075)
prism("Decorative lower fairing",[(-.47,-.82),(-.21,-.63),(-.09,-.72),(-.28,-1.00),(-.68,-.94)],.50,"accent",bevel=.05)
prism("Solid glowing terminal cap",[(1.16,.42),(1.46,.32),(1.53,.08),(1.37,-.12),(1.09,-.15),(1.24,.08)],.65,"accent",bevel=.07)
prism("Sealed light panel",[(1.44,.28),(1.59,.21),(1.58,.02),(1.43,-.06),(1.35,.08)],.49,"photon",bevel=.04)
prism("Crown fairing",[(-1.04,.63),(-.70,.86),(.43,.86),(.79,.67)],.46,"alloy",bevel=.055)
prism("Crown enamel inlay",[(-.62,.82),(-.47,.93),(.29,.93),(.52,.82)],.34,"enamel",bevel=.035)
for side in (-1,1):
    y=side*.36
    prism("Side shell / enamel", [(-1.20,.45),(-.81,.57),(.59,.57),(1.02,.34),(.79,.05),(-.93,.04)],.105,"enamel",y,bevel=.035)
    prism("Offset ceramic insert",[(-1.04,.39),(-.76,.48),(.46,.48),(.78,.31),(.62,.15),(-.80,.15)],.065,"ceramic",side*.435,bevel=.023)
    prism("Swept cyan graphic",[(-.81,.32),(.40,.32),(.59,.22),(.30,.22),(-.80,.22)],.028,"photon",side*.475,bevel=.014)
    prism("Copper accent shard",[(.67,.42),(.95,.29),(.78,.13),(.62,.20)],.035,"accent",side*.445,bevel=.018)
    for i in range(5):
        x=-.65+i*.18
        prism("Small cosmetic inlay",[(x,-.03),(x+.09,-.03),(x+.13,.04),(x+.04,.04)],.035,"alloy",side*.385,bevel=.012)
    for i in range(4):
        x=-.71+i*.08;z=-.56-i*.067
        cube("Handle texture accent",(x,side*.245,z),(.10,.035,.04),"ceramic",.012)
# One UV atlas shared across all decorative exterior surfaces.
bpy.ops.object.select_all(action="DESELECT")
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
art=bpy.context.object;art.name="AETHER S9 / arcade exterior"
bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.015)
bpy.ops.object.mode_set(mode="OBJECT")
assert art.data.uv_layers.active and len(art.data.uv_layers.active.data)>0
# Actual geometric AO bake, shared UV atlas, no functional internal geometry.
ao=bpy.data.images.new("S9 baked AO",512,512,alpha=False)
ao.colorspace_settings.name="Non-Color"
for m in materials.values():
    t=m.node_tree.nodes.new("ShaderNodeTexImage");t.image=ao;m.node_tree.nodes.active=t
scene.render.bake.margin=8
bpy.ops.object.bake(type="AO")
ao.pack()
ao.filepath_raw=str(OUT/"s9-ao.png");ao.file_format="PNG";ao.save()
# Image-based texture detail with deterministic grain; normal map is procedural.
rng=np.random.default_rng(9082);N=1024
yy,xx=np.mgrid[:N,:N]
height=(.025*np.sin(xx*.25)+.016*np.sin(yy*.40)+rng.normal(0,.012,(N,N))).astype(np.float32)
dy,dx=np.gradient(height);normals=np.stack([-dx*2,-dy*2,np.ones_like(dx)],axis=-1)
normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
def image(name,rgb,noncolor=False):
    im=bpy.data.images.new(name,N,N,alpha=True)
    if noncolor:im.colorspace_settings.name="Non-Color"
    data=np.ones((N,N,4),np.float32);data[:,:,:3]=np.clip(rgb,0,1)
    im.pixels.foreach_set(data.ravel());im.update();im.pack();return im
normal=image("S9 surface grain normal",normals*.5+.5,True)
group=bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
if hasattr(group,"interface"):group.interface.new_socket(name="Occlusion",in_out="INPUT",socket_type="NodeSocketFloat")
else:group.inputs.new("NodeSocketFloat","Occlusion")
base_nodes={}
for role,m in materials.items():
    nt=m.node_tree;p=nt.nodes.get("Principled BSDF")
    color=nt.nodes.new("ShaderNodeTexImage");color.label="Finish colour texture";base_nodes[role]=color
    nt.links.new(color.outputs["Color"],p.inputs["Base Color"])
    if role=="photon":nt.links.new(color.outputs["Color"],p.inputs["Emission" if "Emission" in p.inputs else "Emission Color"])
    n=nt.nodes.new("ShaderNodeTexImage");n.image=normal
    nm=nt.nodes.new("ShaderNodeNormalMap");nm.inputs["Strength"].default_value=.35
    nt.links.new(n.outputs["Color"],nm.inputs["Color"]);nt.links.new(nm.outputs["Normal"],p.inputs["Normal"])
    rough=image("S9 "+role+" roughness",np.repeat(np.clip(roles[role][1]+height,0,1)[:,:,None],3,axis=2),True)
    r=nt.nodes.new("ShaderNodeTexImage");r.image=rough
    nt.links.new(r.outputs["Color"],p.inputs["Roughness"])
    occ=nt.nodes.new("ShaderNodeGroup");occ.node_tree=group
    baked=next(n for n in nt.nodes if n.type=="TEX_IMAGE" and n.image==ao)
    nt.links.new(baked.outputs["Color"],occ.inputs["Occlusion"])
# Studio renders are produced independently by importing each finished GLB.
report={"asset":"AETHER-S9","kind":"fictional sealed arcade exterior","atlas":N,"ao_resolution":512,"normal_type":"procedural grain","variants":{}}
for name,palette in palettes.items():
    for role,node in base_nodes.items():
        color=np.asarray(palette[role],dtype=np.float32)
        node.image=image(name+" "+role+" base",np.clip(color[None,None,:]*(1+height[:,:,None]),0,1))
    bpy.ops.object.select_all(action="DESELECT");art.select_set(True);bpy.context.view_layer.objects.active=art
    if name=="midnight":
        bpy.ops.wm.save_as_mainfile(filepath=str((OUT/"aether-s9.blend").resolve()))
    path=(OUT/("aether-s9-"+name+".glb")).resolve()
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True)
    data=path.read_bytes();magic,version,length=struct.unpack_from("<III",data)
    assert magic==0x46546c67 and version==2 and length==len(data)
    n=struct.unpack_from("<I",data,12)[0];g=json.loads(data[20:20+n])
    assert g.get("images") and g.get("materials") and g.get("meshes")
    assert all("TEXCOORD_0" in p["attributes"] for m in g["meshes"] for p in m["primitives"])
    report["variants"][name]={"bytes":len(data),"materials":len(g["materials"]),"images":len(g["images"])}
    print("EXPORTED",name,report["variants"][name])
(OUT/"aether-s9-build.json").write_text(json.dumps(report,indent=2))
