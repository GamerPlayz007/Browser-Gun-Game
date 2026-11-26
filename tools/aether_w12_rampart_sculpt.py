"""CROSSFire AETHER-W12 RAMPART / Phase 2 native Blender sculpt.
Original nonfunctional science-fiction GAME ART ONLY.
Geometry-first clay review followed by a Midnight material review.
Does NOT replace the playable W12 asset or touch the AETHER-9 AR.
Run: blender -b -t 2 --python tools/aether_w12_rampart_sculpt.py -- OUTPUT_DIR
"""
from __future__ import annotations
import json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

OUT=Path(sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "build/aether-w12-rampart").resolve()
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

ASSET=bpy.data.collections.new("AETHER-W12 RAMPART / sculpted geometry")
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
    m=bpy.data.materials.new("RAMPART / "+role)
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

# =====================================================================
# AETHER-W12 RAMPART · ORIGINAL HEAVY SCULPT / NONFUNCTIONAL GAME ART.
# AR-family cinematic layered morphology, NOT a conventional shotgun recipe.
# Nose faces -Z (in fictional Three.js presentation), y = visual elevation.
#
# Hero idea: manta-ray forward armor, two elegant nested prow petals,
# dual *decorative* photonic windows, solid organic torso with a floating
# central crystal, deep negative-space lateral scallops and bowed rear arc.
# =====================================================================

# 01 | Full sculpted wide armor monocoque, NO shared box receiver.
loft("01 / RAMPART sweeping cathedral monocoque",[
    (1.01,.19,.10,.095,0),(.82,.21,.19,.15,0),
    (.53,.24,.288,.205,0),(.15,.255,.35,.258,0),
    (-.29,.267,.405,.286,0),(-.76,.261,.422,.263,0),
    (-1.18,.248,.394,.238,0),(-1.53,.237,.345,.207,0),
    (-1.92,.22,.29,.166,0),(-2.18,.207,.20,.125,0),
    (-2.34,.198,.126,.088,0)
],"ceramic",36,.68)

# 02 | Long curvilinear raised ridge, from AR's titanium dorsal spine.
loft("02 / satin titanium flying spine",[
    (.88,.37,.05,.025,0),(.52,.427,.12,.054,0),
    (.10,.49,.171,.072,0),(-.45,.523,.185,.079,0),
    (-1.06,.497,.168,.069,0),(-1.67,.412,.117,.048,0),
    (-2.16,.314,.039,.020,0)
],"frame",24,.61)
trace("02b / slim unbroken central cyan light",[
    (0,.424,.73),(0,.54,.21),(0,.598,-.44),
    (0,.558,-1.09),(0,.454,-1.65)
],.009,"cyan")

# 03 | Sculpted *decorative* ventral shell / strong organic silhouette.
loft("03 / dark contoured lower keel",[
    (.56,-.06,.17,.075,0),(.25,-.13,.224,.105,0),
    (-.18,-.17,.27,.108,0),(-.74,-.17,.272,.098,0),
    (-1.30,-.12,.22,.068,0),(-1.71,-.03,.135,.049,0)
],"carbon",20,.70)

for side in (-1,1):
    S="L" if side<0 else "R"

    # Underlying black negative-space trench. This must remain visible in clay.
    shell_plate(S+" / concave architectural undercut",side,[
        (.60,.241),(.42,.381),(-.24,.402),(-1.05,.360),
        (-1.94,.247),(-2.14,.174),(-1.60,.085),(-.71,.073),
        (.12,.125),(.58,.152)
    ],.413,.028,"carbon",.009)

    # A real sculptural broad manta cheek, wrapping forward; unlike RAMPART
    # it is much deeper with an exaggerated shoulder wing at the front.
    shell_plate(S+" / broad forward swept titanium cheek",side,[
        (.52,.307),(.34,.435),(-.18,.478),(-.79,.446),
        (-1.35,.382),(-1.80,.285),(-1.67,.217),
        (-.99,.265),(-.43,.324),(.20,.280)
    ],.445,.051,"frame",.016)

    shell_plate(S+" / hero ceramic breastplate",side,[
        (.40,.332),(.17,.423),(-.39,.438),(-.97,.377),
        (-1.19,.297),(-.66,.295),(-.04,.336)
    ],.497,.018,"ceramic",.014)
    shell_plate(S+" / floating glacial silver hairline",side,[
        (.22,.431),(-.30,.444),(-.87,.386),(-1.02,.358),
        (-.32,.417)
    ],.521,.007,"silver",.004)

    # Sculpted shadow-layer around the forward intake ornament; not vent spam.
    shell_plate(S+" / deep recessed sweep channel",side,[
        (-.76,.291),(-1.08,.369),(-1.57,.321),
        (-2.05,.231),(-1.94,.168),(-1.47,.212),(-1.01,.256)
    ],.464,.018,"mid",.006)
    shell_plate(S+" / pointed floating nose wing",side,[
        (-1.12,.371),(-1.53,.361),(-2.02,.272),
        (-2.43,.217),(-2.28,.146),(-1.78,.199),(-1.34,.271)
    ],.374,.042,"ceramic",.011)
    shell_plate(S+" / raised nose alloy eyebrow",side,[
        (-1.42,.356),(-1.81,.31),(-2.24,.232),(-2.37,.218),
        (-1.88,.28)
    ],.415,.011,"silver",.005)

    # Deep oval cutouts established by TWO nested layers, not replicated
    # shallow rivet rows, making the wide side armor breathable.
    shell_plate(S+" / floating inset window",side,[
        (-.30,.335),(-.61,.373),(-.96,.351),
        (-1.16,.280),(-.86,.263),(-.47,.288)
    ],.518,.012,"carbon",.005)
    shell_plate(S+" / small translucent lens",side,[
        (-.52,.335),(-.68,.354),(-.90,.33),
        (-.77,.304),(-.59,.304)
    ],.538,.007,"glass",.004)

    trace(S+" / flowing sculptural cyan line",[
        (side*.528,.345,.14),(side*.539,.36,-.32),
        (side*.506,.318,-.81),(side*.444,.268,-1.36)
    ],.009,"cyan")
    trace(S+" / bright tapered trailing edge",[
        (side*.51,.422,.22),(side*.522,.451,-.26),
        (side*.472,.408,-.91)
    ],.006,"silver")

    # A compact swept rear wing, not the same thin rods as previous W12.
    loft(S+" / monocoque rear sweep",[
        (.70,.352,.045,.045,side*.20),
        (1.00,.375,.070,.068,side*.255),
        (1.31,.325,.072,.063,side*.276),
        (1.57,.247,.062,.055,side*.260),
        (1.70,.194,.050,.040,side*.235)
    ],"ceramic",14,.72)
    trace(S+" / bowed rear return rib",[
        (side*.19,.085,.67),(side*.253,.03,1.06),
        (side*.279,.065,1.38),(side*.259,.18,1.67)
    ],.031,"frame")
    trace(S+" / rear chrome hairline",[
        (side*.281,.425,1.00),(side*.298,.372,1.31),
        (side*.273,.288,1.55)
    ],.006,"silver")
    trace(S+" / faint inset rear light",[
        (side*.258,.08,1.02),(side*.277,.10,1.38)
    ],.008,"cyan")

    # Decorative bold nose petal shaped like a hull split; its Z sweep
    # contrasts with the soft continuous shell, deliberately NOT a barrel.
    loft(S+" / forward exposed ornamental petal",[
        (-1.63,.17,.074,.092,side*.194),
        (-1.89,.167,.076,.075,side*.184),
        (-2.16,.166,.067,.055,side*.177),
        (-2.34,.173,.040,.040,side*.163)
    ],"frame",16,.78)
    loft(S+" / inset cyan petal mirror",[
        (-2.10,.168,.028,.037,side*.174),
        (-2.26,.171,.044,.043,side*.162),
        (-2.36,.173,.018,.025,side*.150)
    ],"cyan",12,.79)
    trace(S+" / polished crescent prow edge",[
        (side*.282,.212,-1.77),(side*.262,.21,-2.06),
        (side*.195,.202,-2.29)
    ],.007,"silver")

    # A couple of tiny copper lineage markings, not repeated filler.
    shell_plate(S+" / warm family maker mark",side,[
        (.11,.302),(.19,.317),(.235,.295),(.157,.276)
    ],.548,.005,"copper",.003)

# 04 | Finishing short flat curved stern for visible width and solidity.
loft("04 / soft sculpted rear end cap",[
    (1.65,.202,.216,.141,0),
    (1.735,.205,.266,.167,0),
    (1.82,.203,.224,.143,0)
],"polymer",20,.70)
loft("04b / rear inset satin rim",[
    (1.765,.205,.24,.15,0),(1.785,.205,.244,.15,0)
],"silver",16,.70)

# 05 | Dual tiny nested cyan ornaments at the wide nose. Their only
# purpose is game-art identity; no physical function is modeled.
for side in (-1,1):
    S="L" if side<0 else "R"
    loft(S+" / fictional photonic cavity",[
        (-2.20,.19,.072,.073,side*.155),
        (-2.35,.195,.066,.064,side*.155),
        (-2.43,.198,.044,.044,side*.155)
    ],"carbon",18,.86)
    loft(S+" / inner floating blue jewel",[
        (-2.28,.196,.026,.033,side*.155),
        (-2.37,.197,.044,.041,side*.155),
        (-2.46,.196,.014,.019,side*.155)
    ],"cyan",16,.90)
    trace(S+" / inverted silver nostril highlight",[
        (side*.105,.259,-2.19),(side*.105,.261,-2.33),
        (side*.130,.245,-2.42)
    ],.004,"silver")

# 06 | AR-linked low-slung floating diamond prism, but broader than
# RAMPART: a shallow faceted chest jewel nested inside the lower sculpt.
loft("06 / long faceted floating cyan heart",[
    (.25,-.218,.038,.066,0),(.03,-.231,.135,.131,0),
    (-.37,-.243,.175,.169,0),(-.79,-.219,.146,.130,0),
    (-1.06,-.153,.028,.051,0)
],"cyan",12,.91)
for side in (-1,1):
    S="L" if side<0 else "R"
    loft(S+" / winged cradle arc",[
        (.40,-.055,.044,.046,side*.222),
        (.14,-.230,.056,.070,side*.219),
        (-.26,-.341,.062,.073,side*.218),
        (-.69,-.287,.052,.052,side*.213),
        (-1.05,-.086,.034,.037,side*.205)
    ],"frame",14,.76)
    shell_plate(S+" / captive core lens",side,[
        (.13,-.161),(-.13,-.287),(-.50,-.312),
        (-.91,-.168),(-.80,-.119),(-.34,-.130)
    ],.204,.015,"glass",.005)
    trace(S+" / delicate photonic capsule trim",[
        (side*.250,-.18,.10),(side*.273,-.33,-.28),
        (side*.251,-.23,-.72)
    ],.008,"silver")

# 07 | A single wrapped dark handle silhouette, decorative not operational.
handle_loft("07 / sculpted polymer grip",[
    (.07,.65,.133,.137),(-.12,.68,.147,.158),
    (-.34,.755,.156,.145),(-.55,.807,.149,.127),
    (-.74,.856,.122,.097),(-.83,.864,.082,.068)
],"polymer",22)
for side in (-1,1):
    S="L" if side<0 else "R"
    trace(S+" / curved shadowed grip seam",[
        (side*.142,-.15,.69),(side*.152,-.46,.80),
        (side*.106,-.72,.86)
    ],.008,"mid")
    shell_plate(S+" / ornamental underside scallop",side,[
        (.32,-.12),(.49,-.18),(.64,-.18),(.62,-.10),(.38,-.06)
    ],.164,.031,"carbon",.006)

# 08 | Flush embedded visor art integrated with the dorsal body.
loft("08 / low wide curved optical crown",[
    (-.83,.504,.151,.035,0),(-.57,.546,.217,.058,0),
    (-.32,.568,.228,.058,0),(-.10,.528,.17,.037,0)
],"frame",18,.69)
loft("08b / inset dark glass crown",[
    (-.59,.579,.151,.019,0),
    (-.45,.605,.175,.028,0),
    (-.32,.588,.16,.023,0)
],"glass",18,.85)
for side in (-1,1):
    S="L" if side<0 else "R"
    shell_plate(S+" / visor brow ceramic teardrop",side,[
        (-.75,.521),(-.59,.602),(-.31,.621),
        (-.22,.542),(-.48,.521)
    ],.205,.027,"ceramic",.007)
    trace(S+" / narrow visor flourish",[
        (side*.210,.614,-.56),(side*.235,.623,-.42)
    ],.005,"cyan")

# 09 | Paired surface sculpture in the lower forehead, distinctive to W12.
for side in (-1,1):
    S="L" if side<0 else "R"
    shell_plate(S+" / tapering forehead under-blade",side,[
        (-1.42,.084),(-1.73,.126),(-2.12,.17),
        (-1.87,.063),(-1.61,.024)
    ],.256,.020,"mid",.009)
    trace(S+" / polished shallow keel line",[
        (side*.271,.06,-1.52),(side*.26,.091,-1.83)
    ],.006,"silver")

# Real geometric (not material) checks: reject if this ever becomes box-only art.
assert sum(o.type=="MESH" for o in ART)>=40
assert sum(o.type=="CURVE" for o in ART)>=18
assert not any("common(" in o.name for o in ART)

# AR game-axis convention: rotate all authored objects so Blender Z-up and glTF Y-up
# produce a horizontal, muzzle-negative-Z model in Three.js.
rotation=Matrix.Rotation(math.pi/2,4,"X")
for o in ART:o.matrix_world=rotation@o.matrix_world

def studio_object(obj):
    for c in tuple(obj.users_collection):c.objects.unlink(obj)
    STUDIO.objects.link(obj)
    return obj

world=bpy.data.worlds.new("RAMPART charcoal studio")
bpy.context.scene.world=world
world.use_nodes=True
world.node_tree.nodes.get("Background").inputs["Color"].default_value=(.028,.051,.072,1)
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=.55
cam_obj=bpy.data.cameras.new("RAMPART review camera")
cam=bpy.data.objects.new("RAMPART review camera",cam_obj)
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
    "hero":((6.6,4.5,3.8),(0,-.05,.10),5.8),
    "profile":((8.3,-.08,1.8),(0,-.05,.10),5.7),
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
    scene.render.filepath=str(OUT/("aether-w12-rampart-clay-"+view+".png"))
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
    scene.render.filepath=str(OUT/("aether-w12-rampart-midnight-"+view+".png"))
    bpy.ops.render.render(write_still=True)

# Save editable curves and custom material nodes in the source .blend.
camera_at("hero")
scene.render.filepath=""
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"aether-w12-rampart-sculpt.blend"))

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
export=OUT/"aether-w12-rampart-sculpt.glb"
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
 "asset":"AETHER-W12 RAMPART",
 "stage":"W12 Phase 2 / original wide monocoque sculpt / clay and Midnight reviews",
 "nonfunctional_fictional_game_art":True,
 "old_w12_replaced":False,
 "mesh_objects":mesh_count,
 "authoring_objects":part_count,
 "material_families":list(M),
 "geometry_methods":["tapered ring lofts","extruded hand-sketched side blades","Bezier art ribbons","swept rear arches"],
 "model":export.name,
 "clay_previews":["aether-w12-rampart-clay-"+x+".png" for x in review],
 "midnight_previews":["aether-w12-rampart-midnight-"+x+".png" for x in review],
 "notes":"Sculpt phase; not yet production UV/PBR bake/LOD or game replacement"
}
(OUT/"aether-w12-rampart-sculpt-report.json").write_text(json.dumps(report,indent=2))
print("RAMPART_SCULPT_DONE",json.dumps(report))
