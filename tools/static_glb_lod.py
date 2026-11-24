"""Offline geometry LOD builder for static gallery GLB assets.

Run inside Blender. Exports separate copies; never modifies the input.
Only static opaque meshes without shape keys are simplified.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path):
    reset()
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]

def metrics(meshes):
    deps = bpy.context.evaluated_depsgraph_get()
    tris = 0
    points = []
    for obj in meshes:
        ev = obj.evaluated_get(deps)
        mesh = ev.to_mesh()
        try:
            mesh.calc_loop_triangles()
            tris += len(mesh.loop_triangles)
            points.extend(ev.matrix_world @ Vector(c) for c in ev.bound_box)
        finally:
            ev.to_mesh_clear()
    if not points:
        raise ValueError("no mesh geometry")
    lo = [min(v[i] for v in points) for i in range(3)]
    hi = [max(v[i] for v in points) for i in range(3)]
    return {"meshes":len(meshes), "triangles":tris,"min":lo,"max":hi}

def can_simplify(obj):
    if obj.animation_data or obj.data.shape_keys or obj.parent and obj.parent.type=="ARMATURE":
        return False
    if any(m.type=="ARMATURE" for m in obj.modifiers):
        return False
    for slot in obj.material_slots:
        mat = slot.material
        if mat is None:
            continue
        if getattr(mat,"blend_method","OPAQUE") not in ("OPAQUE",):
            return False
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=="BSDF_PRINCIPLED":
                    for name in ("Alpha","Transmission Weight","Transmission"):
                        socket=node.inputs.get(name)
                        if socket and (socket.is_linked or (name=="Alpha" and socket.default_value<.999) or (name!="Alpha" and socket.default_value>.001)):
                            return False
    return True

def build(source, target, ratio):
    meshes=load(source)
    if bpy.data.actions or any(o.type=="ARMATURE" for o in bpy.context.scene.objects):
        raise ValueError("animated scene is outside static LOD contract")
    before=metrics(meshes)
    changed=0
    for obj in meshes:
        if not can_simplify(obj):
            continue
        obj.data.calc_loop_triangles()
        count=len(obj.data.loop_triangles)
        if count < 120:
            continue
        mod=obj.modifiers.new("Static gallery LOD","DECIMATE")
        mod.decimate_type="COLLAPSE"
        mod.ratio=max(ratio, 60/count)
        mod.use_collapse_triangulate=True
        changed+=1
    bpy.context.view_layer.update()
    after=metrics(meshes)
    if after["triangles"]>=before["triangles"]:
        raise ValueError("LOD did not reduce triangle count")
    extent=math.dist(before["min"],before["max"])
    for a,b in zip(before["min"]+before["max"],after["min"]+after["max"]):
        if abs(a-b)>max(.00001,.025*extent):
            raise ValueError("scene bounds drift exceeds 2.5% of diagonal")
    target.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",export_apply=True)
    exported=metrics(load(target))
    if exported["triangles"]!=after["triangles"] or exported["meshes"]!=after["meshes"]:
        raise ValueError("exported geometry does not match evaluated LOD")
    if exported["triangles"]>=before["triangles"]:
        raise ValueError("export did not reduce triangle count")
    return {"source":source.name,"output":target.name,"ratio":ratio,"changed_meshes":changed,
            "before":before,"after":exported,"input_bytes":source.stat().st_size,"output_bytes":target.stat().st_size}

def fixture(directory):
    reset()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32)
    source=directory/"fixture.glb"; target=directory/"fixture-lod.glb"
    bpy.ops.export_scene.gltf(filepath=str(source),export_format="GLB")
    result=build(source,target,.5)
    assert result["after"]["triangles"]<result["before"]["triangles"]
    print("Neutral sphere LOD fixture passed",result)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir",type=Path,required=True)
    parser.add_argument("--self-test",action="store_true")
    parser.add_argument("sources",nargs="*",type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    args.out_dir=args.out_dir.resolve()
    args.out_dir.mkdir(parents=True,exist_ok=True)
    if args.self_test:
        fixture(args.out_dir)
    report=[]
    for source in args.sources:
        source=source.resolve()
        for name,ratio in (("medium",.65),("low",.35)):
            report.append(build(source,args.out_dir/(source.stem+"-lod-"+name+".glb"),ratio))
    if report:
        (args.out_dir/"geometry-lod-report.json").write_text(json.dumps(report,indent=2)+"\n")
        print(json.dumps(report,indent=2))

if __name__=="__main__":
    main()
