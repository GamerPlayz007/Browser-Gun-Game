"""Independent import-and-render check for the finished fictional art GLBs."""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
OUT=Path(sys.argv[sys.argv.index("--")+1]).resolve()
records={}
for variant in ("midnight","glacier","eclipse"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(OUT/f"aether-s9-{variant}.glb"))
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    assert meshes and all(o.data.uv_layers for o in meshes)
    corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    low=Vector(tuple(min(p[i] for p in corners) for i in range(3)))
    high=Vector(tuple(max(p[i] for p in corners) for i in range(3)))
    center=(low+high)/2
    span=max(high-low)
    assert span>0
    s=bpy.context.scene
    s.world=bpy.data.worlds.new("Studio world");s.world.use_nodes=True
    bg=s.world.node_tree.nodes.get("Background");bg.inputs[0].default_value=(.09,.14,.21,1);bg.inputs[1].default_value=.5
    def aim(o,target):o.rotation_euler=(target-o.location).to_track_quat("-Z","Y").to_euler()
    def light(name,location,power,color,size):
        d=bpy.data.lights.new(name,"AREA");d.energy=power;d.color=color;d.shape="DISK";d.size=size
        o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=location;aim(o,center)
    light("Key",center+Vector((1,-4,5)),1200,(.82,.93,1),4)
    light("Rim",center+Vector((-3,3,2)),1000,(.24,.72,1),3)
    light("Fill",center+Vector((4,-1,1)),650,(1,.66,.42),3)
    d=bpy.data.cameras.new("Camera");o=bpy.data.objects.new("Camera",d);s.collection.objects.link(o)
    o.location=center+Vector((.40,-1,.30)).normalized()*span*2.5;aim(o,center);d.type="ORTHO";d.ortho_scale=span*1.33;s.camera=o
    try:s.render.engine="BLENDER_EEVEE_NEXT"
    except TypeError:s.render.engine="BLENDER_EEVEE"
    s.render.resolution_x=1200;s.render.resolution_y=800;s.render.resolution_percentage=100
    s.render.film_transparent=True;s.render.image_settings.file_format="PNG";s.render.image_settings.color_mode="RGBA"
    s.render.filepath=str(OUT/f"aether-s9-{variant}.png")
    bpy.ops.render.render(write_still=True)
    records[variant]={"meshes":len(meshes),"render":Path(s.render.filepath).name}
(OUT/"aether-s9-render.json").write_text(json.dumps(records,indent=2))
