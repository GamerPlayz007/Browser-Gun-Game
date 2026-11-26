"""CROSSFire AETHER-S9 VESPER / Phase 2 native Blender sculpt.
Original nonfunctional science-fiction GAME ART ONLY.
Geometry-first clay review followed by a Midnight material review.
Does NOT replace the playable S9 asset or touch the AETHER-9 AR.
Run: blender -b -t 2 --python tools/aether_s9_vesper_sculpt.py -- OUTPUT_DIR
"""
from __future__ import annotations
import json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

OUT=Path(sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "build/aether-s9-vesper").resolve()
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

ASSET=bpy.data.collections.new("AETHER-S9 VESPER / sculpted geometry")
bpy.context.scene.collection.children.link(ASSET)
STUDIO=bpy.data.collections.new("STUDIO / not for GLB export")
bpy.context.scene.collection.children.link(STUDIO)
ART=[]
M={}
ROLES={
 "ceramic":((.055,.117,.161),.24,.52),
 "frame":((.39,.54,.62),.82,.32),
 "mid":((.14,.25,.31),.73,.43),
 "polymer":((.03,.055,.080),.08,.78),
 "silver":((.74,.85,.89),.90,.25),
 "cyan":((.025,.57,.87),.16,.23),
 "glass":((.10,.37,.48),.24,.17),
 "copper":((.78,.39,.22),.62,.40),
 "carbon":((.025,.05,.074),.21,.77),
}
def mat(role,color,metal,rough):
    m=bpy.data.materials.new("VESPER / "+role)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=(*color,1)
    b.inputs["Metallic"].default_value=metal
    b.inputs["Roughness"].default_value=rough
    if role=="cyan":
        try:
            b.inputs["Emission"].default_value=(.02,.53,.84,1)
            b.inputs["Emission Strength"].default_value=2.3
        except KeyError:pass
    if role=="glass":
        b.inputs["Alpha"].default_value=.64
        m.blend_method="BLEND"
    return m
for r,(col,me,ro) in ROLES.items():M[r]=mat(r,col,me,ro)

def enroll(obj,name,role):
    obj.name=name
    for c in tuple(obj.users_collection):c.objects.unlink(obj)
    ASSET.objects.link(obj)
    if hasattr(obj.data,"materials"):obj.data.materials.append(M[role])
    obj["art_role"]=role
    ART.append(obj)
    return obj

def make_mesh(name,vertices,faces,role,bevel=0,smooth=False):
    mesh=bpy.data.meshes.new(name+" / geometry")
    mesh.from_pydata(vertices,[],faces)
    mesh.update(calc_edges=True)
    obj=bpy.data.objects.new(name,mesh)
    ASSET.objects.link(obj)
    mesh.materials.append(M[role])
    obj["art_role"]=role
    ART.append(obj)
    # UVs prepared now, as individually editable visual art surfaces.
    uv=mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        poly.use_smooth=smooth
        for loop_i in poly.loop_indices:
            v=mesh.vertices[mesh.loops[loop_i].vertex_index].co
            uv.data[loop_i].uv=((v.z+2.1)/4.1,(v.y+.85)/1.8)
    if bevel:
        mod=obj.modifiers.new("Soft machined art edges","BEVEL")
        mod.width=bevel
        mod.segments=3
        mod.limit_method="ANGLE"
    return obj

def loft(name,rings,role,sides=28,power=.70):
    """Designer monocoque. Rings=(longitudinal z, vertical y, half-width x, half-height y, x-offset)."""
    verts=[]
    for z,y,w,h,dx in rings:
        for j in range(sides):
            theta=j*2*math.pi/sides
            c=math.cos(theta);s=math.sin(theta)
            vx=dx+math.copysign(abs(c)**power,c)*w
            vy=y+math.copysign(abs(s)**power,s)*h
            verts.append((vx,vy,z))
    faces=[]
    for k in range(len(rings)-1):
        for j in range(sides):
            a=k*sides+j;b=k*sides+(j+1)%sides
            c=(k+1)*sides+(j+1)%sides;d=(k+1)*sides+j
            faces.append((a,b,c,d))
    faces.append(tuple(reversed(range(sides))))
    last=(len(rings)-1)*sides
    faces.append(tuple(last+j for j in range(sides)))
    return make_mesh(name,verts,faces,role,0,True)

def shell_plate(name,side,outline,at,thick,role,bev=.007):
    # Handmade decorative blade on the visible flank, outline points are (z,y).
    front=[(side*at,y,z) for z,y in outline]
    back=[(side*(at-thick),y,z) for z,y in outline]
    n=len(front)
    faces=[tuple(range(n)),tuple(reversed(range(n,n*2)))]
    for k in range(n):faces.append((k,(k+1)%n,(k+1)%n+n,k+n))
    return make_mesh(name,front+back,faces,role,bev)

def trace(name,points,r,role):
    cr=bpy.data.curves.new(name,"CURVE")
    cr.dimensions="3D";cr.resolution_u=18
    cr.bevel_depth=r;cr.bevel_resolution=3
    spline=cr.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for b,xyz in zip(spline.bezier_points,points):
        b.co=xyz;b.handle_left_type="AUTO";b.handle_right_type="AUTO"
    ob=bpy.data.objects.new(name,cr)
    ASSET.objects.link(ob)
    cr.materials.append(M[role])
    ob["art_role"]=role
    ART.append(ob)
    return ob

def handle_loft(name,rings,role,sides=18):
    """Organic *illustrative handle* taper along vertical y. Rings=(y,z,halfwidth,halfdepth)."""
    verts=[]
    for y,z,w,d in rings:
        for j in range(sides):
            t=j*2*math.pi/sides
            verts.append((math.cos(t)*w,y,z+math.sin(t)*d))
    faces=[]
    for k in range(len(rings)-1):
        for j in range(sides):
            a=k*sides+j;b=k*sides+(j+1)%sides
            c=(k+1)*sides+(j+1)%sides;d=(k+1)*sides+j
            faces.append((a,b,c,d))
    faces.extend([tuple(reversed(range(sides))),tuple((len(rings)-1)*sides+j for j in range(sides))])
    return make_mesh(name,verts,faces,role,0,True)

# ============================================================
# 01 — ONE continuous aerodynamic hero hull: NO box-centered common() shell.
# Rear/right longitudinal z is positive; stylized nose/front z is negative.
# ============================================================
loft("01 / VESPER sculpted ceramic monocoque",[
    (.89,.17,.075,.075,0),
    (.71,.19,.17,.13,0),
    (.46,.20,.25,.165,0),
    (.12,.21,.297,.195,0),
    (-.23,.22,.331,.225,0),
    (-.59,.24,.333,.205,0),
    (-.95,.245,.293,.184,0),
    (-1.27,.235,.241,.150,0),
    (-1.53,.215,.184,.113,0),
    (-1.76,.200,.095,.079,0),
    (-1.89,.20,.045,.048,0),
],"ceramic",32,.67)

loft("02 / continuous titanium flight crest",[
    (.68,.31,.055,.032,0),
    (.38,.375,.122,.053,0),
    (.04,.407,.151,.072,0),
    (-.38,.435,.146,.070,0),
    (-.84,.402,.126,.063,0),
    (-1.27,.345,.087,.046,0),
    (-1.69,.261,.026,.022,0)
],"frame",20,.64)
trace("03 / singular dorsal photonic signature",[
    (0,.385,.47),(0,.466,.10),(0,.502,-.37),(0,.464,-.80),(0,.386,-1.23)
],.009,"cyan")

# ============================================================
# 04 — layered flanks and light-gutters: AR-family swept sculpture.
# Recessed charcoal channels make each large ceramic blade readable in clay.
# ============================================================
for side in (-1,1):
    tag="LEFT" if side<0 else "RIGHT"
    shell_plate(tag+" / recessed long flank groove",side,[
        (.49,.235),(.37,.32),(-.31,.32),(-1.16,.245),(-1.47,.178),
        (-1.00,.107),(-.38,.095),(.37,.151)
    ],.339,.024,"carbon",.009)
    shell_plate(tag+" / floating swept shoulder blade",side,[
        (.48,.251),(.24,.356),(-.14,.355),(-.54,.316),
        (-.66,.218),(-.34,.172),(.12,.169),(.40,.202)
    ],.378,.027,"frame",.013)
    shell_plate(tag+" / front tapered scythe fin",side,[
        (-.69,.315),(-.95,.349),(-1.34,.315),(-1.80,.236),
        (-1.70,.165),(-1.30,.137),(-.87,.185)
    ],.308,.033,"ceramic",.011)
    shell_plate(tag+" / brushed crest accent",side,[
        (.14,.345),(-.26,.332),(-.44,.301),(-.25,.297)
    ],.401,.012,"silver",.004)
    shell_plate(tag+" / inset charcoal side-lens",side,[
        (-.79,.282),(-1.03,.296),(-1.34,.266),(-1.51,.213),
        (-1.15,.200),(-.87,.222)
    ],.343,.012,"mid",.006)
    trace(tag+" / one curved side cyan ribbon",[
        (side*.398,.224,.20),(side*.423,.20,-.10),
        (side*.379,.177,-.48),(side*.346,.192,-.82)
    ],.008,"cyan")
    trace(tag+" / trailing silver aero stitch",[
        (side*.408,.34,.12),(side*.420,.363,-.20),
        (side*.356,.35,-.57)
    ],.006,"silver")

# ============================================================
# 05 — fictional short split-petal front sculpture, no straight tube.
# ============================================================
loft("05 / buried dark nose recess",[
    (-1.66,.205,.083,.069,0),(-1.88,.205,.076,.068,0),
    (-1.97,.206,.059,.056,0)
],"carbon",18,.83)
loft("06 / recessed luminous nose jewel",[
    (-1.87,.207,.025,.029,0),(-1.96,.207,.046,.049,0),
    (-2.005,.207,.014,.017,0)
],"cyan",16,.90)
for side in (-1,1):
    tag="LEFT" if side<0 else "RIGHT"
    loft(tag+" / split-petal swept prow",[
        (-1.31,.270,.045,.055,side*.165),
        (-1.61,.242,.061,.063,side*.133),
        (-1.86,.224,.041,.051,side*.098),
        (-2.01,.207,.020,.023,side*.068)
    ],"frame",12,.72)
    trace(tag+" / tiny prow under-rim",[
        (side*.220,.192,-1.50),(side*.165,.180,-1.76),(side*.096,.185,-1.96)
    ],.008,"silver")

# ============================================================
# 07 — compact two-ribbon rear yoke, C-shape / no triangular scaffold.
# ============================================================
for side in (-1,1):
    tag="LEFT" if side<0 else "RIGHT"
    loft(tag+" / continuous rear arc",[
        (.45,.29,.048,.056,side*.20),(.65,.32,.058,.062,side*.218),
        (.91,.29,.062,.055,side*.236),(1.14,.235,.050,.046,side*.238),
        (1.27,.186,.047,.043,side*.222)
    ],"ceramic",14,.70)
    trace(tag+" / swept lower return",[
        (side*.205,.10,.49),(side*.236,.038,.73),
        (side*.238,.070,1.04),(side*.225,.161,1.26)
    ],.024,"frame")
    trace(tag+" / silver rim on rear arch",[
        (side*.252,.359,.74),(side*.263,.343,.93),(side*.258,.277,1.12)
    ],.006,"silver")
    trace(tag+" / gentle cyan inner line",[
        (side*.225,.087,.68),(side*.237,.108,.97)
    ],.007,"cyan")
loft("07 / round rear termination",[
    (1.22,.19,.22,.127,0),(1.31,.186,.238,.149,0),
    (1.39,.18,.19,.122,0)
],"polymer",18,.66)
loft("07b / rear satin rim",[
    (1.275,.186,.23,.140,0),(1.30,.185,.23,.140,0)
],"silver",16,.72)

# ============================================================
# 08 — floating faceted PHOTONIC ART capsule: nonfunctional ornament.
# ============================================================
loft("08 / levitating cyan luminous capsule",[
    (.21,-.205,.026,.075,0),(.06,-.219,.104,.122,0),
    (-.24,-.216,.118,.141,0),(-.52,-.190,.078,.102,0),
    (-.63,-.152,.020,.035,0)
],"cyan",12,.88)
for side in (-1,1):
    tag="LEFT" if side<0 else "RIGHT"
    loft(tag+" / crescent cradle underneath prism",[
        (.34,-.053,.033,.041,side*.168),
        (.21,-.236,.044,.047,side*.176),
        (-.07,-.323,.046,.055,side*.179),
        (-.40,-.278,.043,.044,side*.173),
        (-.58,-.075,.029,.039,side*.167)
    ],"frame",12,.75)
    shell_plate(tag+" / transparent capsule cheek",side,[
        (.18,-.130),(.07,-.275),(-.25,-.292),(-.49,-.172),
        (-.40,-.103),(-.04,-.110)
    ],.158,.012,"glass",.004)

# ============================================================
# 09 — compact clean downward secondary shape (illustrated grip).
# ============================================================
handle_loft("09 / curved carbon aesthetic grip",[
    (.055,.46,.115,.118),(-.08,.495,.14,.13),
    (-.26,.575,.135,.129),(-.47,.639,.123,.113),
    (-.66,.688,.108,.083),(-.725,.689,.082,.064)
],"polymer")
for side in (-1,1):
    tag="LEFT" if side<0 else "RIGHT"
    trace(tag+" / grip inset metal arc",[
        (side*.136,-.15,.51),(side*.133,-.40,.606),
        (side*.105,-.61,.686)
    ],.008,"mid")
shell_plate("09b / curved protective carbon underbody",1,[
    (.30,-.035),(.47,-.10),(.54,-.14),(.44,-.17),(.22,-.095)
],.133,.07,"carbon",.008)

# ============================================================
# 10 — visor flush with crest, no isolated round optic.
# ============================================================
loft("10 / flush integrated vision crown",[
    (-.79,.44,.135,.034,0),(-.59,.481,.160,.054,0),
    (-.37,.499,.170,.063,0),(-.18,.467,.139,.042,0)
],"frame",14,.68)
loft("10b / soft recessed translucent visor",[
    (-.59,.528,.133,.022,0),(-.51,.546,.147,.030,0),
    (-.43,.532,.136,.025,0)
],"glass",18,.85)
for side in (-1,1):
    shell_plate("10c / split optical brow "+str(side),side,[
        (-.72,.476),(-.59,.548),(-.35,.560),(-.27,.476)
    ],.164,.021,"ceramic",.006)
    # A single tiny copper family insignia, not repeating fake micro-details.
    shell_plate("11 / warm alloy family mark "+str(side),side,[
        (-.08,.267),(-.011,.278),(.025,.249),(-.050,.242)
    ],.414,.006,"copper",.003)

# Real geometric (not material) checks: reject if this ever becomes box-only art.
assert sum(o.type=="MESH" for o in ART)>=23
assert sum(o.type=="CURVE" for o in ART)>=10
assert not any("common(" in o.name for o in ART)

# AR game-axis convention: rotate all authored objects so Blender Z-up and glTF Y-up
# produce a horizontal, muzzle-negative-Z model in Three.js.
rotation=Matrix.Rotation(math.pi/2,4,"X")
for o in ART:o.matrix_world=rotation@o.matrix_world

def studio_object(obj):
    for c in tuple(obj.users_collection):c.objects.unlink(obj)
    STUDIO.objects.link(obj)
    return obj

world=bpy.data.worlds.new("VESPER charcoal studio")
bpy.context.scene.world=world
world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.028,.051,.072,1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.55
cam_obj=bpy.data.cameras.new("VESPER review camera")
cam=bpy.data.objects.new("VESPER review camera",cam_obj)
STUDIO.objects.link(cam)
cam_obj.type="ORTHO"
bpy.context.scene.camera=cam
for name,loc,power,size,color in [
    ("Key alloy gloss",(3.3,1.7,5.2),1150,4.8,(.83,.93,1)),
    ("Cyan cool rim",(-3.6,-1.0,3.0),1350,4.1,(.40,.76,1.0)),
    ("Warm studio fill",(2.4,-3.7,1.4),630,3.8,(1,.76,.57))
]:
    light=bpy.data.lights.new(name,"AREA")
    ob=bpy.data.objects.new(name,light)
    STUDIO.objects.link(ob);ob.location=loc
    light.energy=power;light.shape="DISK";light.size=size
    light.color=color
    ob.rotation_euler=(Vector((0,-.1,.1))-ob.location).to_track_quat("-Z","Y").to_euler()

scene=bpy.context.scene
scene.render.resolution_x=1360
scene.render.resolution_y=820
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.view_settings.view_transform="Standard"
scene.view_settings.look="None"
scene.view_settings.exposure=0
scene.view_settings.gamma=1
review={
    "hero":((6.6,4.5,3.8),(0,-.05,.12),4.65),
    "profile":((8.3,-.08,1.8),(0,-.05,.12),4.6),
}
def camera_at(view):
    pos,target,scale=review[view]
    cam.location=pos
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat("-Z","Y").to_euler()
    cam_obj.ortho_scale=scale

# Workbench neutral-gray renders: identical mesh, no neon and no material tricks.
scene.render.engine="BLENDER_WORKBENCH"
shade=scene.display.shading
shade.light="STUDIO"
shade.color_type="SINGLE"
shade.single_color=(.56,.59,.63)
shade.background_type="VIEWPORT"
shade.background_color=(.025,.040,.057)
shade.show_cavity=True
shade.cavity_type="BOTH"
shade.curvature_ridge_factor=1.25
shade.curvature_valley_factor=1.13
shade.show_shadows=True
shade.show_specular_highlight=True
shade.show_object_outline=True
shade.studiolight_rotate_z=.28
for view in review:
    camera_at(view)
    scene.render.filepath=str(OUT/("aether-s9-vesper-clay-"+view+".png"))
    bpy.ops.render.render(write_still=True)

# Material look-dev is deliberately plain Blender PBR at this sculpt stage,
# not falsely labeled as completed 2K AO/normal texture bake.
scene.render.engine="BLENDER_EEVEE"
scene.eevee.taa_render_samples=64
scene.camera=cam
scene.render.image_settings.color_mode="RGBA"
scene.view_settings.exposure=.25
for view in review:
    camera_at(view)
    scene.render.filepath=str(OUT/("aether-s9-vesper-midnight-"+view+".png"))
    bpy.ops.render.render(write_still=True)

# Save editable curves and custom material nodes in the source .blend.
camera_at("hero")
scene.render.filepath=""
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"aether-s9-vesper-sculpt.blend"))

# Export curves as meshes for portable self-contained GLB; studio excluded.
for obj in list(ART):
    if obj.type!="CURVE":continue
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target="MESH")
    ART[ART.index(obj)]=bpy.context.view_layer.objects.active

bpy.ops.object.select_all(action="DESELECT")
for o in ART:o.select_set(True)
bpy.context.view_layer.objects.active=ART[0]
export=OUT/"aether-s9-vesper-sculpt.glb"
opts={"filepath":str(export),"export_format":"GLB"}
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
if "use_selection" in props:opts["use_selection"]=True
if "export_selected" in props:opts["export_selected"]=True
if "export_apply" in props:opts["export_apply"]=True
if "export_texcoords" in props:opts["export_texcoords"]=True
if "export_normals" in props:opts["export_normals"]=True
bpy.ops.export_scene.gltf(**opts)

part_count=len(ART)
mesh_count=sum(o.type=="MESH" for o in ART)
report={
 "asset":"AETHER-S9 VESPER",
 "stage":"Phase 2 / new custom sculpt / clay & midnight reviews",
 "nonfunctional_fictional_game_art":True,
 "old_s9_replaced":False,
 "mesh_objects":mesh_count,
 "authoring_objects":part_count,
 "material_families":list(M),
 "geometry_methods":["tapered ring lofts","extruded hand-sketched side blades","Bezier art ribbons","swept rear arches"],
 "model":export.name,
 "clay_previews":["aether-s9-vesper-clay-"+x+".png" for x in review],
 "midnight_previews":["aether-s9-vesper-midnight-"+x+".png" for x in review],
 "notes":"Sculpt phase; not yet production UV/PBR bake/LOD or game replacement"
}
(OUT/"aether-s9-vesper-sculpt-report.json").write_text(json.dumps(report,indent=2))
print("VESPER_SCULPT_DONE",json.dumps(report))
