import json,struct,sys
from pathlib import Path
root=Path(sys.argv[1])
report=json.loads((root/"CROSSFIRE_L7_Stage3_Report.json").read_text())
assert report["source_meshes"]>=70 and report["source_triangles"]>1000
sizes=[];meshes=[]
for grade in ["Hero","Performance"]:
    data=(root/("CROSSFIRE_L7_"+grade+".glb")).read_bytes()
    assert struct.unpack_from("<III",data)==(0x46546C67,2,len(data))
    size,kind=struct.unpack_from("<II",data,12)
    assert kind==0x4e4f534a
    gltf=json.loads(data[20:20+size])
    meshes.append(len(gltf.get("meshes",[])))
    assert meshes[-1]>=70
    assert len(gltf.get("materials",[]))>=9
    assert len(gltf.get("images",[]))>=9
    assert any("normalTexture" in mat for mat in gltf["materials"])
    sizes.append(len(data))
assert meshes[0]==meshes[1] and sizes[1]<sizes[0]
assert (root/report["native"]).read_bytes()[:7]==b"BLENDER"
print("L7_GLTF_VALIDATED",sizes,meshes)
