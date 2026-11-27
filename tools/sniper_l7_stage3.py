"""Export fictional AETHER-L7 cosmetic game-art from the EXISTING Blender .blend source.
No gameplay, ballistics, or functional weapon mechanisms. Use Blender background mode.
"""
from pathlib import Path
import importlib.util, json, sys
import bpy
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/"art/blender/aether-l7.blend"
OUT=Path(sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else ROOT/"build/sniper-l7").resolve()
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location("aether_material_source",str(ROOT/"tools/aether_collection_blender.py"))
art=importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)
art.OUT=OUT
def objects():
    art.PARTS.clear()
    art.PARTS.extend(o for o in bpy.data.objects if o.type=="MESH" and o.get("role") in art.ROLES)
    if len(art.PARTS)<70:raise RuntimeError("Existing native source is incomplete")
    for o in art.PARTS:
        if not o.data.uv_layers:raise RuntimeError("Missing source UVs: "+o.name)
    return art.PARTS
def profile(label,dimension):
    art.assign_mats("l7","midnight")
    for img in bpy.data.images:
        if not img.name.startswith("l7-midnight-"):continue
        width,height=img.size
        if max(width,height)>dimension:
            factor=dimension/max(width,height)
            img.scale(max(1,int(width*factor)),max(1,int(height*factor)))
        img.pack()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in art.PARTS:obj.select_set(True)
    bpy.context.view_layer.objects.active=art.PARTS[0]
    path=OUT/("CROSSFIRE_L7_"+label+".glb")
    props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    opts=dict(filepath=str(path),export_format="GLB")
    for key in ("use_selection","export_normals","export_texcoords","export_apply"):
        if key in props:opts[key]=True
    bpy.ops.export_scene.gltf(**opts)
    if not path.is_file() or path.stat().st_size<1024:raise RuntimeError("GLB export failed")
    return {"file":path.name,"bytes":path.stat().st_size,"texture_max":dimension,"meshes":len(art.PARTS)}
def main():
    if not SOURCE.exists() or SOURCE.read_bytes()[:7]!=b"BLENDER":
        raise RuntimeError("Missing authored Blender source")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    objects()
    original_tris=0
    for obj in art.PARTS:
        obj.data.calc_loop_triangles()
        original_tris+=len(obj.data.loop_triangles)
    hero=profile("Hero",384)
    blend=OUT/"CROSSFIRE_L7_Hero_Source.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    objects()
    performance=profile("Performance",128)
    if performance["bytes"]>=hero["bytes"]:raise RuntimeError("Performance export was not smaller")
    report={"name":"AETHER-L7 Longwatch","type":"fictional cosmetic game art",
        "source":str(SOURCE.relative_to(ROOT)),"source_meshes":len(art.PARTS),
        "source_triangles":original_tris,"hero":hero,"performance":performance,
        "native":blend.name,"multiplayer_changed":False}
    (OUT/"CROSSFIRE_L7_Stage3_Report.json").write_text(json.dumps(report,indent=2))
    print("L7_STAGE3_SUCCESS",json.dumps(report))
if __name__=="__main__":main()
