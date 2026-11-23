"""CROSSFire AETHER-9 / Phase 3 PBR game-art authoring.

Original fictional, nonfunctional sci-fi prop. Offline Blender 3.x build.
Generates image-based base-color, metallic/roughness/AO, procedural height-
derived normal and emissive maps; uses Cycles to bake actual geometric AO
at a reduced computation resolution (upscaled to 2048 atlas format).
Exports Midnight, Glacier and Eclipse material variants as self-contained GLBs.
No runtime construction, gameplay or real-world operational components.
"""
from __future__ import annotations
import json
import math
import os
import struct
from pathlib import Path

import bpy
import numpy as np
from PIL import Image, ImageFilter

MAP_SIZE=2048
AO_BAKE_SIZE=512
AO_RAYS=8
STYLES=("midnight","glacier","eclipse")
PALETTES={
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
ENERGY_FAMILIES={"cyan","copper"}
FAMILIES=list(PALETTES["midnight"])


def _save(array,path,mode="RGB"):
    Image.fromarray(np.uint8(np.clip(array,0,255)),mode).save(str(path),optimize=True,compress_level=6)


def _noise_family(key):
    # A smooth, deterministic structure shared by all three skins.
    rng=np.random.default_rng(851+FAMILIES.index(key)*127)
    n=Image.fromarray(rng.integers(0,256,(128,128),dtype=np.uint8),"L")
    return np.asarray(n.resize((MAP_SIZE,MAP_SIZE),Image.Resampling.BICUBIC),dtype=np.float32)/255.0-.5


def _detail_maps(key):
    n=_noise_family(key)
    y,x=np.meshgrid(np.arange(MAP_SIZE,dtype=np.float32)/MAP_SIZE,
                    np.arange(MAP_SIZE,dtype=np.float32)/MAP_SIZE,indexing="ij")
    # Fine etched patterns and brushed motifs, in UV rather than geometry.
    directional=np.sin(2*np.pi*(x*42+y*3.1))
    micro=np.sin(2*np.pi*(y*109+x*1.75))
    seams=(np.sin(2*np.pi*(x*9.4+y*.27))>0.982).astype(np.float32)
    panel=(np.sin(2*np.pi*(y*7.1-x*.17))>0.985).astype(np.float32)
    texture_grade={
      "ceramic":(.24,.16,.28),"frame":(.13,.27,.15),"mid":(.18,.24,.18),
      "polymer":(.16,.24,.10),"silver":(.09,.33,.09),"cyan":(.20,.10,.12),
      "glass":(.11,.06,.04),"copper":(.11,.24,.12),"carbon":(.18,.19,.16)
    }
    noise,brush,scratch=texture_grade[key]
    surface=noise*n+brush*directional*.18+micro*scratch*.13
    if key in ("ceramic","mid","carbon"):
        surface-=.18*seams+.11*panel
    if key in ("frame","silver","copper"):
        surface+=.065*np.cos(2*np.pi*x*111)
    height=(surface*.035+(.005 if key in ("frame","silver") else .0)).astype(np.float32)
    # A tangent normal map "baked" from the created microheight field,
    # NOT falsely presented as a high-to-low sculpt geometry bake.
    gy,gx=np.gradient(height)
    strength=175.0 if key!="glass" else 40.0
    vx=-gx*strength;vy=-gy*strength
    vz=np.ones_like(vx)
    magnitude=np.sqrt(vx*vx+vy*vy+vz*vz)
    normal=np.stack((
        (vx/magnitude*.5+.5)*255,
        (vy/magnitude*.5+.5)*255,
        (vz/magnitude*.5+.5)*255),axis=-1)
    return n,surface,normal


def bake_ambient_occlusion(objects,material_family,out_dir):
    """Blender Cycles AO bake on the *authored* mesh and shared UV layout.

    The 512px bake is enlarged to the target 2048px atlas size; the
    report documents this distinction and does not claim 2K AO detail.
    """
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.samples=AO_RAYS
    scene.render.bake.use_clear=False
    scene.render.bake.margin=4
    mat=material_family
    slot_family=next(k for k,m in material_family_map.items() if m==mat)
    AO_IMAGE=bpy.data.images.new(
        f"AETHER_AO_{slot_family}",width=AO_BAKE_SIZE,height=AO_BAKE_SIZE,
        alpha=False,float_buffer=False)
    AO_IMAGE.generated_color=(1,1,1,1)
    try:
        AO_IMAGE.colorspace_settings.name="Non-Color"
    except TypeError:
        AO_IMAGE.colorspace_settings.name="Linear"  # Blender 3.0 minimal OCIO
    nd=mat.node_tree.nodes.new("ShaderNodeTexImage")
    nd.name="AETHER_TEMP_AO_BAKE"
    nd.image=AO_IMAGE
    for node in mat.node_tree.nodes:
        node.select=False
    nd.select=True
    mat.node_tree.nodes.active=nd
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    if not objects:
        raise RuntimeError("No AO bake objects for "+slot_family)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.bake(type="AO")
    path=Path(out_dir)/f"aether9_{slot_family}_ao_baked_512.png"
    AO_IMAGE.filepath_raw=str(path)
    AO_IMAGE.file_format="PNG"
    AO_IMAGE.save()
    mat.node_tree.nodes.remove(nd)
    # PBR texture-pack red channel contains real geometrical AO data.
    image=Image.open(path).convert("L")
    full=image.resize((MAP_SIZE,MAP_SIZE),Image.Resampling.BICUBIC)
    values=np.asarray(full,dtype=np.uint8)
    return {
        "source_path":str(path),"bake_resolution":AO_BAKE_SIZE,
        "atlas_resolution":MAP_SIZE,
        "min":int(values.min()),"max":int(values.max()),
        "mean":float(np.mean(values))
    },values


# Assigned when build is invoked. Material instances are from builder.
material_family_map={}


def _image(path,noncolor=False):
    im=bpy.data.images.load(str(path),check_existing=True)
    im.filepath=str(Path(path).resolve())
    if noncolor:
        try:
            im.colorspace_settings.name="Non-Color"
        except TypeError:
            im.colorspace_settings.name="Linear"  # Blender 3.0 minimal OCIO
    else:
        im.colorspace_settings.name="sRGB"
    return im


def _texture_node(nodes,path,label,noncolor=False):
    node=nodes.new("ShaderNodeTexImage")
    node.name="AETHER / "+label
    node.label=label
    node.image=_image(path,noncolor)
    node.interpolation="Linear"
    node.extension="REPEAT"
    return node


def _attach_pbr(mat,role,skin,texture_paths):
    """Real image textures, explicitly wired to Principled PBR sockets."""
    nodes=mat.node_tree.nodes
    nodes.clear()
    output=nodes.new("ShaderNodeOutputMaterial")
    output.location=(820,50)
    bsdf=nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location=(510,50)
    mat.node_tree.links.new(bsdf.outputs["BSDF"],output.inputs["Surface"])
    base=_texture_node(nodes,texture_paths[(skin,role,"base")],"BaseColor")
    base.location=(-770,400)
    mat.node_tree.links.new(base.outputs["Color"],bsdf.inputs["Base Color"])
    orm=_texture_node(nodes,texture_paths[("shared",role,"orm")],"Occlusion_Roughness_Metal",True)
    orm.location=(-780,-90)
    separate=nodes.new("ShaderNodeSeparateRGB")
    separate.location=(-460,-95)
    mat.node_tree.links.new(orm.outputs["Color"],separate.inputs["Image"])
    mat.node_tree.links.new(separate.outputs["G"],bsdf.inputs["Roughness"])
    mat.node_tree.links.new(separate.outputs["B"],bsdf.inputs["Metallic"])
    normal=_texture_node(nodes,texture_paths[("shared",role,"normal")],"TangentNormal",True)
    normal.location=(-800,-440)
    normalmap=nodes.new("ShaderNodeNormalMap")
    normalmap.location=(-380,-390)
    normalmap.inputs["Strength"].default_value=.85 if role!="glass" else .28
    mat.node_tree.links.new(normal.outputs["Color"],normalmap.inputs["Color"])
    mat.node_tree.links.new(normalmap.outputs["Normal"],bsdf.inputs["Normal"])
    if role in ENERGY_FAMILIES:
        glow=_texture_node(nodes,texture_paths[(skin,role,"emission")],"EmissiveGlow")
        glow.location=(-660,-680)
        socket="Emission" if "Emission" in bsdf.inputs else "Emission Color"
        mat.node_tree.links.new(glow.outputs["Color"],bsdf.inputs[socket])
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value=2.7 if role=="cyan" else .7
    if role=="glass":
        bsdf.inputs["Alpha"].default_value=.60
        mat.blend_method="BLEND"
    mat["aether_phase"]="3"
    mat["aether_role"]=role
    mat["aether_skin"]=skin
    mat["aether_maps"]="basecolor, packed ORM, tangent normal, optional emission"
    # glTF exporter can read the glTF Material Output node's Occlusion
    # channel. A GLB postpass also links ORM to occlusionTexture directly.
    group=bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group=bpy.data.node_groups.new("glTF Material Output","ShaderNodeTree")
        group.inputs.new("NodeSocketFloat","Occlusion")
    settings=nodes.new("ShaderNodeGroup")
    settings.node_tree=group
    settings.name="glTF Settings"
    mat.node_tree.links.new(separate.outputs["R"],settings.inputs["Occlusion"])


def make_images(out_dir,source_objects,materials):
    """Create source PNGs and actual Cycles AO maps before variant exports."""
    global material_family_map
    material_family_map={k:v for k,v in materials.items()}
    out=Path(out_dir)
    tex=out/"textures"
    tex.mkdir(exist_ok=True,parents=True)
    texture_paths={}
    bake_info={}
    all_objects=list(source_objects)
    for role in FAMILIES:
        family_obj=[o for o in all_objects if o.type=="MESH" and
                    any(m==materials[role] for m in o.data.materials)]
        if not family_obj:
            raise RuntimeError("No source object for PBR material "+role)
        ao_stats,ao=bake_ambient_occlusion(family_obj,materials[role],tex)
        bake_info[role]=ao_stats
        n,detail,normal=_detail_maps(role)
        rough_base=PALETTES["midnight"][role][2]
        metal_base=PALETTES["midnight"][role][1]
        rough=np.uint8(np.clip((rough_base+detail*.20)*255,0,255))
        metal=np.uint8(np.clip((metal_base+detail*.045)*255,0,255))
        # glTF combined texture: R=ambient occlusion, G=roughness, B=metalness
        orm=np.stack((ao,rough,metal),axis=-1)
        orm_path=tex/f"aether9_{role}_orm.png"
        norm_path=tex/f"aether9_{role}_normal.png"
        _save(orm,orm_path)
        _save(normal,norm_path)
        texture_paths[("shared",role,"orm")]=orm_path
        texture_paths[("shared",role,"normal")]=norm_path
        for skin in STYLES:
            rgb,metallic,roughness=PALETTES[skin][role]
            base=np.asarray(rgb,dtype=np.float32)[None,None,:] * (
                1+detail[:,:,None]*.36
            )
            # Delicate seam edges and brushed grain without random speckle.
            if role in ("ceramic","frame","mid","polymer","carbon"):
                base+=detail[:,:,None]*3.6
            base_path=tex/f"aether9_{skin}_{role}_base.png"
            _save(base,base_path)
            texture_paths[(skin,role,"base")]=base_path
            if role in ENERGY_FAMILIES:
                power=np.clip(.91+.17*n,0,1)
                if role=="copper":
                    power*=.45
                glow=np.asarray(rgb,dtype=np.float32)[None,None,:]*power[:,:,None]
                glow_path=tex/f"aether9_{skin}_{role}_emission.png"
                _save(glow,glow_path)
                texture_paths[(skin,role,"emission")]=glow_path
    return texture_paths,bake_info


def patch_glb_occlusion(path):
    """Embed occlusionTexture references to the existing packed ORM image.

    Three.js and glTF readers then sample R for baked AO while the same
    image contributes roughness (G) and metallic (B). No duplicate image.
    """
    path=Path(path)
    raw=path.read_bytes()
    if raw[:4]!=b"glTF":
        raise RuntimeError("Invalid glTF binary header")
    glb_len=struct.unpack_from("<I",raw,8)[0]
    if glb_len!=len(raw):
        raise RuntimeError("Invalid glTF length")
    jsonlen,jtype=struct.unpack_from("<II",raw,12)
    if jtype!=0x4e4f534a:
        raise RuntimeError("Missing glTF JSON")
    gltf=json.loads(raw[20:20+jsonlen])
    binchunk=raw[20+jsonlen:]
    count=0
    for mat in gltf["materials"]:
        mr=mat.get("pbrMetallicRoughness",{})
        tex=mr.get("metallicRoughnessTexture")
        if tex:
            mat["occlusionTexture"]={"index":tex["index"],"strength":1}
            count+=1
    if count<9:
        raise RuntimeError(f"Expected nine packed PBR materials, got {count}")
    text=json.dumps(gltf,separators=(",",":"),ensure_ascii=True).encode("utf-8")
    text+=b" " * ((-len(text))%4)
    new=bytearray()
    new+=struct.pack("<III",0x46546c67,2,12+8+len(text)+len(binchunk))
    new+=struct.pack("<II",len(text),0x4e4f534a)
    new+=text
    new+=binchunk
    path.write_bytes(new)
    return count,{"materials":len(gltf["materials"]),"textures":len(gltf.get("textures",[])),
                  "images":len(gltf.get("images",[])),
                  "normal_materials":sum(bool(m.get("normalTexture")) for m in gltf["materials"]),
                  "occlusion_materials":sum(bool(m.get("occlusionTexture")) for m in gltf["materials"]),
                  "basecolor_materials":sum(bool(m.get("pbrMetallicRoughness",{}).get("baseColorTexture"))
                                            for m in gltf["materials"]),
                  "emissive_materials":sum(bool(m.get("emissiveTexture")) for m in gltf["materials"])}


def build_pbr(obj_source,mat_map,asset_objects,out,export_func,scene,camera):
    """One Blender source file with three distinct exportable material skins."""
    out=Path(out)
    texture_paths,bake_info=make_images(out,obj_source,mat_map)
    report={"phase":"3","asset_id":"AETHER9_SPECTER",
        "status":"complete, pending external visual review",
        "atlas_resolution":MAP_SIZE,
        "geometric_ao_bake_resolution":AO_BAKE_SIZE,
        "normal_source":"procedural microheight-derived tangent normals; not a high-poly sculpt bake",
        "bake_details":bake_info,
        "pbr_families":len(mat_map),
        "variants":{},"source_texture_count":len(texture_paths),
        "source_textures":[str(p.name) for p in sorted(set(texture_paths.values()))],
        "limitations":["AO baked at 512px and upsampled to 2048px",
                       "normal maps derived from procedural surface height, not high-to-low geometry",
                       "PBR art is authored procedurally, not hand-painted"]}
    for skin in STYLES:
        for role,material in mat_map.items():
            _attach_pbr(material,role,skin,texture_paths)
        if skin=="midnight":
            bpy.ops.file.pack_all()
            editable=out/"aether9-specter-pbr.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(editable))
        glb=out/f"aether9-specter-{skin}.glb"
        export_func(glb)
        ao_count,metrics=patch_glb_occlusion(glb)
        if metrics["normal_materials"]<9 or metrics["basecolor_materials"]<9:
            raise RuntimeError("GLB is missing material image bindings: "+str(metrics))
        report["variants"][skin]={"glb":glb.name,"bytes":glb.stat().st_size,
                                  "image_bindings":metrics}
        # True lit physically based material previews, not Workbench colors.
        scene.render.engine="CYCLES"
        scene.cycles.samples=12
        scene.cycles.use_denoising=True
        scene.render.resolution_x=1050
        scene.render.resolution_y=630
        scene.render.resolution_percentage=100
        scene.render.image_settings.file_format="PNG"
        scene.render.filepath=str(out/f"aether9-specter-{skin}-pbr.png")
        bpy.ops.render.render(write_still=True)
        preview=Path(scene.render.filepath)
        if not preview.exists() or preview.stat().st_size<8000:
            raise RuntimeError("No real PBR render for "+skin)
        report["variants"][skin]["preview"]=preview.name
        report["variants"][skin]["preview_bytes"]=preview.stat().st_size
    report_path=out/"aether9-phase3-report.json"
    report_path.write_text(json.dumps(report,indent=2))
    return report
