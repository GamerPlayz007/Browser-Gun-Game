"""CROSSFire / AETHER armory: three distinct, original sci-fi game-art props.
Creates Blender source projects and texture-mapped GLB art for S9, W12 and L7.
Everything is visual-only; game physics and weapon behaviour are untouched.
Usage: blender -b --python tools/aether_collection_blender.py -- OUTPUT_DIRECTORY
"""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector
from PIL import Image, ImageFilter
import numpy as np

OUT=Path(sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "build/aether-armory").resolve()
OUT.mkdir(parents=True,exist_ok=True)
KINDS=("s9","w12","l7")
FINISHES=("midnight","glacier","eclipse")
ROLES=("shell","plate","poly","metal","accent","glow","recess","rubber","glass")
PAL={
 "s9":{"shell":(45,37,65),"plate":(111,76,146),"poly":(29,25,48),"metal":(144,135,173),"accent":(224,142,248),"glow":(185,79,255),"recess":(16,15,29),"rubber":(27,26,37),"glass":(91,58,141)},
 "w12":{"shell":(68,42,35),"plate":(169,88,50),"poly":(39,27,23),"metal":(182,147,120),"accent":(255,198,118),"glow":(255,116,54),"recess":(26,18,15),"rubber":(36,29,26),"glass":(115,61,35)},
 "l7":{"shell":(48,60,43),"plate":(111,149,86),"poly":(31,43,34),"metal":(171,189,151),"accent":(225,236,167),"glow":(154,255,85),"recess":(18,25,20),"rubber":(30,38,28),"glass":(92,140,76)}
}
METALS={"shell":(.48,.48),"plate":(.64,.32),"poly":(.07,.81),"metal":(.83,.27),"accent":(.58,.36),"glow":(.17,.22),"recess":(.22,.87),"rubber":(.02,.92),"glass":(.31,.16)}
MAT={}
PARTS=[]
def hex_rgb(t):return tuple(x/255 for x in t)
def textures(kind,finish,role):
    base=np.array(PAL[kind][role],dtype=np.float32)
    if finish=="glacier":
        base=base*.46+np.array([203,214,224])*.54
    elif finish=="eclipse":
        base=base*.52+np.array([30,28,49])*.48
    seed=sum(ord(x) for x in kind+finish+role)
    rng=np.random.default_rng(seed)
    size=384
    coarse=rng.integers(0,255,(48,48),dtype=np.uint8)
    smooth=np.array(Image.fromarray(coarse,"L").resize((size,size),Image.Resampling.BICUBIC),dtype=np.float32)/255-.5
    yy,xx=np.mgrid[:size,:size]
    grain=np.sin(xx*.48+yy*.045)*.6+np.sin(yy*.23+xx*.018)*.34
    lines=((xx+yy*.08)%63<1.4).astype(np.float32)
    tiny=rng.normal(0,1,(size,size)).astype(np.float32)
    surface=smooth*14+grain*2+tiny*1.7-lines*9
    if role in ("glow","glass"):surface=surface*.18
    img=np.clip(base[None,None,:]+surface[:,:,None],0,255).astype(np.uint8)
    prefix=f"{kind}-{finish}-{role}"
    Image.fromarray(img,"RGB").save(OUT/f"{prefix}-color.png",optimize=True)
    gx=np.gradient(surface,axis=1);gy=np.gradient(surface,axis=0)
    norm=np.stack((-gx*.008,-gy*.008,np.ones_like(gx)),axis=-1)
    norm/=np.maximum(np.linalg.norm(norm,axis=-1,keepdims=True),1e-6)
    Image.fromarray(np.uint8(np.clip((norm*.5+.5)*255,0,255)),"RGB").save(OUT/f"{prefix}-normal.png",optimize=True)
    return OUT/f"{prefix}-color.png",OUT/f"{prefix}-normal.png"
def make_mat(kind,finish,role):
    mat=bpy.data.materials.new(f"{kind.upper()} / {finish} / {role}")
    mat.use_nodes=True
    nt=mat.node_tree;nt.nodes.clear()
    out=nt.nodes.new("ShaderNodeOutputMaterial")
    bs=nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bs.outputs["BSDF"],out.inputs["Surface"])
    metallic,roughness=METALS[role]
    bs.inputs["Metallic"].default_value=metallic
    bs.inputs["Roughness"].default_value=roughness
    color,normal=textures(kind,finish,role)
    base=nt.nodes.new("ShaderNodeTexImage")
    base.image=bpy.data.images.load(str(color),check_existing=False)
    nt.links.new(base.outputs["Color"],bs.inputs["Base Color"])
    tex=nt.nodes.new("ShaderNodeTexImage")
    tex.image=bpy.data.images.load(str(normal),check_existing=False)
    tex.image.colorspace_settings.name="Non-Color"
    n=nt.nodes.new("ShaderNodeNormalMap")
    n.inputs["Strength"].default_value=.42
    nt.links.new(tex.outputs["Color"],n.inputs["Color"])
    nt.links.new(n.outputs["Normal"],bs.inputs["Normal"])
    if role in ("glow","accent"):
        emission=hex_rgb(PAL[kind][role])
        try:
            bs.inputs["Emission"].default_value=(*emission,1)
            bs.inputs["Emission Strength"].default_value=1.4 if role=="glow" else .18
        except KeyError:pass
    if role=="glass":
        bs.inputs["Alpha"].default_value=.72
        mat.blend_method="BLEND"
    return mat
def assign_mats(kind,finish):
    global MAT
    MAT={r:make_mat(kind,finish,r) for r in ROLES}
    for ob in PARTS:
        ob.data.materials.clear()
        ob.data.materials.append(MAT[ob["role"]])
def register(ob,name,role):
    ob.name=name
    ob["role"]=role
    PARTS.append(ob)
    return ob
def bevel(ob,r=.012):
    if r>0:
        mod=ob.modifiers.new("Machined rim / real bevel","BEVEL")
        mod.width=r;mod.segments=2
        if hasattr(mod,"affect"):mod.affect="EDGES"
        smooth=ob.modifiers.new("Surface normals","WEIGHTED_NORMAL")
        smooth.keep_sharp=True
    return ob
def box(name,xyz,whd,role="shell",r=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz)
    ob=bpy.context.object
    ob.dimensions=whd
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel(ob,min(r,min(whd)*.29))
    return register(ob,name,role)
def cylinder(name,xyz,radius,length,role="metal",vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=length,location=xyz)
    ob=bpy.context.object
    bevel(ob,min(.007,radius*.16))
    return register(ob,name,role)
def ring(name,xyz,radius,minor,role="glow"):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=minor,
                                   major_segments=28,minor_segments=8,location=xyz)
    return register(bpy.context.object,name,role)
def plate(name,side,points,x=.20,thickness=.024,role="plate"):
    # z/y silhouette, closed with a real volumetric side wall and beveled perimeter
    p=[(side*x,y,z) for z,y in points]
    q=[(side*(x-thickness),y,z) for z,y in points]
    n=len(p);vs=p+q
    faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    mesh=bpy.data.meshes.new(name+" / topology")
    mesh.from_pydata(vs,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    # explicit UVs for the authored polygon
    uv=mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=((v.z+2.5)/5,(v.y+.8)/2)
    bevel(ob,.006)
    return register(ob,name,role)
def beam(name,p1,p2,width,role="metal"):
    a,b=Vector(p1),Vector(p2);delta=b-a
    ob=box(name,tuple((a+b)/2),(width,width,delta.length),role,min(width*.2,.014))
    ob.rotation_euler=delta.to_track_quat("Z","Y").to_euler()
    return ob
def fins(prefix,z0,count,step,x,y,role="metal"):
    for s in (-1,1):
        for i in range(count):
            box(f"{prefix} / {['L','R'][s>0]} / vent {i:02d}",
                (s*x,y,z0+i*step),(.014,.034,.018),role,.003)
def common(kind):
    # Shared design language, not shared silhouettes.
    box("01 / central monocoque",(0,.17,.04),(.386,.272,.655),"shell",.039)
    box("02 / receiver crown",(0,.335,-.012),(.31,.065,.50),"metal",.013)
    box("03 / matte lower receiver",(0,.030,.098),(.292,.120,.350),"poly",.023)
    box("04 / pistol grip",(0,-.20,.19),(.135,.39,.145),"rubber",.022)
    box("05 / rear handle ferrule",(0,-.012,.25),(.190,.062,.20),"metal",.012)
    for side in (-1,1):
        plate("06 / sculpted receiver cheek"+str(side),side,
              [(-.25,.24),(-.18,.296),(.19,.29),(.355,.22),(.286,.105),(-.18,.106)],
              .211,.023,"plate")
        beam("07 / inset diagonal piping "+str(side),
             (side*.246,.261,-.20),(side*.25,.207,.23),.012,"glow")
        box("08 / exposed rivet A "+str(side),(side*.244,.235,.29),(.017,.017,.017),"metal",.003)
        box("08 / exposed rivet B "+str(side),(side*.244,.20,-.19),(.017,.017,.017),"metal",.003)
    # Decorative trigger-shaped recess, not an operational assembly
    box("09 / dark open negative-space insert",(0,-.081,.056),(.160,.025,.232),"recess",.009)
def smg():
    common("s9")
    box("S9 / compact angular forebody",(0,.200,-.46),(.385,.242,.45),"shell",.035)
    box("S9 / forward ceramic wings",(0,.275,-.48),(.41,.083,.39),"plate",.021)
    cylinder("S9 / recessed emitter housing",(0,.205,-.78),.073,.30,"recess")
    cylinder("S9 / violet optical tip",(0,.205,-.945),.063,.07,"metal")
    ring("S9 / charged emitter outline",(0,.205,-.986),.052,.008)
    box("S9 / grip lower cell",(0,-.28,-.020),(.164,.235,.190),"poly",.020)
    box("S9 / short magazine",(0,-.332,-.048),(.141,.24,.149),"metal",.017)
    box("S9 / luminous cartridge",(0,-.35,-.122),(.080,.145,.018),"glow",.007)
    # Distinct open skeleton rear: NOT a shortened AR stock
    for side in (-1,1):
        beam("S9 / skeleton stock top "+str(side),(side*.16,.255,.30),(side*.18,.260,.68),.039,"metal")
        beam("S9 / floating rear strut "+str(side),(side*.15,.053,.31),(side*.18,.215,.67),.036,"plate")
        plate("S9 / faceted cowl "+str(side),side,
            [(-.68,.21),(-.60,.328),(-.42,.337),(-.36,.255),(-.50,.12),(-.64,.14)],
            .228,.027,"plate")
        box("S9 / twin intake "+str(side),(side*.24,.18,-.59),(.012,.04,.15),"recess",.004)
        beam("S9 / light stroke "+str(side),(side*.248,.31,-.61),(side*.248,.26,-.43),.012,"accent")
    box("S9 / folding butt",(0,.180,.719),(.37,.184,.074),"rubber",.021)
    fins("S9 / handguard",-.675,6,.052,.212,.28,"metal")
    box("S9 / optic base",(0,.388,-.067),(.170,.050,.22),"recess")
    ring("S9 / compact holo ring",(0,.488,-.085),.095,.012,"glow")
    cylinder("S9 / optic eye",(0,.485,-.106),.044,.014,"glass")
def shotgun():
    common("w12")
    box("W12 / heavy armor shroud",(0,.224,-.560),(.56,.285,.76),"shell",.042)
    box("W12 / heatshield upper armor",(0,.390,-.530),(.43,.080,.65),"plate",.019)
    box("W12 / broad rugged pump sleeve",(0,.050,-.56),(.50,.16,.46),"rubber",.027)
    box("W12 / underbody plasma unit",(0,-.055,-.27),(.26,.17,.39),"metal",.024)
    for side in (-1,1):
        plate("W12 / aggressive twin cheek armor "+str(side),side,
             [(-.93,.21),(-.82,.356),(-.29,.36),(-.19,.20),(-.43,.085),(-.86,.12)],
             .303,.025,"plate")
        for j in range(7):
            box(f"W12 / pump rib {side} {j}",(side*.26,.065,-.76+j*.065),(.021,.120,.025),"metal",.006)
        for j in range(4):
            box(f"W12 / heat shield vent {side} {j}",(side*.312,.293,-.78+j*.15),(.018,.047,.083),"recess",.004)
        beam("W12 / ember long strip "+str(side),(side*.319,.148,-.81),(side*.319,.145,-.37),.014,"glow")
        # Twin decorative emitter cores, not a physical gun tube specification
        cylinder("W12 / twin front port "+str(side),(side*.142,.233,-.99),.104,.27,"recess")
        cylinder("W12 / port hub "+str(side),(side*.142,.233,-1.15),.073,.06,"metal")
        ring("W12 / glowing eye "+str(side),(side*.142,.233,-1.185),.063,.010)
        beam("W12 / stock side truss "+str(side),(side*.16,.20,.33),(side*.17,.17,.75),.052,"metal")
        beam("W12 / rear diagonal "+str(side),(side*.15,.07,.40),(side*.17,.17,.72),.043,"plate")
    box("W12 / thick recoil pad art",(0,.166,.81),(.42,.246,.08),"rubber",.024)
    box("W12 / rear shoulder crown",(0,.315,.560),(.31,.09,.43),"plate",.024)
    for i in range(7):
        box(f"W12 / dorsal heat vent {i}",(0,.439,-.815+i*.082),(.27,.018,.027),"metal",.004)
    box("W12 / chunky sight",(0,.480,-.07),(.155,.100,.22),"metal",.025)
    ring("W12 / aim reticle",(0,.545,-.11),.083,.015)
def sniper():
    common("l7")
    box("L7 / elongated chassis spine",(0,.304,-.62),(.24,.125,1.58),"metal",.019)
    box("L7 / long matte handguard",(0,.220,-.88),(.336,.212,.95),"shell",.038)
    box("L7 / tip assembly",(0,.210,-1.45),(.17,.135,.50),"poly",.018)
    cylinder("L7 / elegant tapered emitter",(0,.215,-1.76),.052,.58,"recess")
    cylinder("L7 / frosted flash cap",(0,.215,-2.08),.068,.065,"metal")
    ring("L7 / charged tip bezel",(0,.215,-2.115),.049,.010)
    box("L7 / precision optics backbone",(0,.502,-.22),(.165,.085,.67),"recess",.018)
    cylinder("L7 / long illuminated optic",(0,.584,-.23),.092,.65,"metal")
    cylinder("L7 / objective glass bezel",(0,.584,-.595),.116,.090,"plate")
    cylinder("L7 / ocular glass bezel",(0,.584,.140),.079,.074,"poly")
    ring("L7 / forward lens halo",(0,.584,-.65),.095,.008)
    ring("L7 / ocular halo",(0,.584,.185),.066,.007)
    for side in (-1,1):
        plate("L7 / split shell side "+str(side),side,
              [(-1.28,.19),(-1.15,.319),(-.44,.33),(-.30,.22),(-.47,.10),(-1.24,.11)],
              .186,.023,"plate")
        for i in range(10):
            box(f"L7 / longitudinal vent {side} {i}",(side*.203,.232,-1.23+i*.075),(.013,.045,.035),"recess",.003)
        beam("L7 / luminous rail "+str(side),(side*.205,.143,-1.25),(side*.205,.152,-.51),.013,"glow")
        beam("L7 / hollow stock outer rail "+str(side),(side*.145,.21,.36),(side*.17,.26,1.19),.058,"metal")
        beam("L7 / hollow stock diagonal "+str(side),(side*.145,.04,.40),(side*.18,.20,1.24),.047,"plate")
        beam("L7 / scope lattice "+str(side),(side*.09,.43,-.47),(side*.09,.52,-.35),.025,"metal")
        beam("L7 / nonfunctional stabilizer "+str(side),(side*.145,.04,-1.13),(side*.19,-.22,-1.17),.028,"rubber")
    box("L7 / fixed stock cushion",(0,.180,1.32),(.38,.220,.098),"rubber",.024)
    box("L7 / lower energy capsule",(0,-.115,-.08),(.18,.255,.17),"poly",.024)
    box("L7 / status window",(0,-.13,-.18),(.10,.135,.018),"glow",.008)
    for i in range(16):
        box(f"L7 / dorsal scallop {i}",(0,.378,-1.32+i*.078),(.16,.022,.019),"metal",.004)
def setup_studio(kind):
    sc=bpy.context.scene
    sc.render.engine="BLENDER_EEVEE"
    sc.render.resolution_x=1200;sc.render.resolution_y=720;sc.render.resolution_percentage=100
    sc.render.film_transparent=True
    sc.world.color=(.06,.08,.12)
    bpy.ops.object.camera_add(location=(3.5,2.0,4.1))
    cam=bpy.context.object
    from mathutils import Vector
    center=Vector((0,.19,-.31 if kind=="l7" else -.08))
    cam.rotation_euler=(center-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.type="ORTHO";cam.data.ortho_scale=4.8 if kind=="l7" else 3.5
    sc.camera=cam
    for name,loc,power,size in [
        ("key",(1.2,3.6,2.3),850,4.0),
        ("rim",(-2.6,1.8,-2.1),1050,3.6),
        ("fill",(-1.4,.4,3.1),470,3.0)]:
        bpy.ops.object.light_add(type="AREA",location=loc)
        light=bpy.context.object;light.name=name
        light.data.energy=power;light.data.shape="DISK";light.data.size=size
        light.rotation_euler=(center-light.location).to_track_quat("-Z","Y").to_euler()
def main():
    for kind,builder in (("s9",smg),("w12",shotgun),("l7",sniper)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        PARTS.clear()
        builder()
        assert len(PARTS)>55,(kind,len(PARTS))
        setup_studio(kind)
        for finish in FINISHES:
            assign_mats(kind,finish)
            bpy.ops.object.select_all(action="DESELECT")
            for ob in PARTS:ob.select_set(True)
            bpy.context.view_layer.objects.active=PARTS[0]
            dst=OUT/f"aether-{kind}-{finish}.glb"
            export_args=dict(filepath=str(dst),export_format="GLB",export_apply=True,export_materials="EXPORT")
            properties=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
            if "use_selection" in properties:export_args["use_selection"]=True
            if "export_selected" in properties:export_args["export_selected"]=True
            bpy.ops.export_scene.gltf(**export_args)
            assert dst.is_file() and dst.stat().st_size>1024,dst
            bpy.ops.object.select_all(action="DESELECT")
            bpy.context.scene.render.filepath=str(OUT/f"aether-{kind}-{finish}.png")
            bpy.ops.render.render(write_still=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f"aether-{kind}.blend"))
        (OUT/f"aether-{kind}-report.json").write_text(json.dumps({
            "id":kind,"mesh_parts":len(PARTS),"variants":list(FINISHES),
            "geometry":"independent Blender scene","materials":len(ROLES),
            "texture_resolution":384},indent=2))
        print("AETHER ARMORY",kind,len(PARTS),"parts, all variants")
if __name__=="__main__":main()
