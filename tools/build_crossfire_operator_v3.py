"""CROSSFire Operator 03 — authored textured PBR multiplayer character.

Creates an articulated glTF 2.0 model (GLB) that imports natively into Blender.
The GLB has named animation pivot nodes: rig_body, head, leg_L/R,
knee_L/R, arm_L/R, elbow_L/R. Units: metres; +Y up; -Z forward.

Run: python build_crossfire_operator_v3.py
"""
from __future__ import annotations
from collections import defaultdict
from pathlib import Path
import math
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix

OUT=Path(__file__).resolve().parents[1]/'static'/'operators'
OUT.mkdir(parents=True, exist_ok=True)
colors={
 'uniform':(53,65,60,255), 'uniform_dark':(41,49,47,255),
 'cloth_highlight':(71,79,69,255), 'carrier':(76,80,65,255),
 'armor':(42,48,48,255), 'armor_edge':(85,89,77,255),
 'webbing':(111,104,76,255), 'pouches':(97,94,77,255),
 'pouch_edge':(63,66,55,255), 'helmet':(61,70,59,255),
 'helmet_trim':(39,43,42,255), 'visor':(25,38,44,255),
 'glove':(32,37,37,255), 'boots':(42,43,40,255),
 'metal':(79,85,81,255), 'highlight':(133,133,114,255),
 'patch':(69,95,105,255), 'patch_emblem':(172,180,162,255),
 'stitch':(129,126,101,255),
 'thread':(89,94,80,255), 'fold_light':(83,91,76,255), 'fold_dark':(40,47,44,255),
 'nylon':(48,55,50,255), 'nylon_edge':(90,91,75,255), 'rubber':(27,32,31,255),
 'rubber_lite':(58,63,59,255), 'cord':(118,111,86,255), 'buckle':(61,68,65,255),
 'zipper':(142,140,114,255), 'glass_dark':(19,33,40,255), 'glass_edge':(73,90,94,255),
 'ceramic':(68,73,68,255), 'warning':(141,129,86,255),
}

materials={k:trimesh.visual.material.PBRMaterial(name=k,baseColorFactor=list(v),metallicFactor=(.40 if k in ('metal','helmet_trim','buckle') else .02),roughnessFactor=(.19 if k in ('visor','glass_dark') else .78 if k in ('uniform','uniform_dark','cloth_highlight','webbing') else .57)) for k,v in colors.items()}
items=defaultdict(list)

def add(pivot, mat, mesh):
    if mesh is None:return
    mesh.process(validate=False)
    items[(pivot,mat)].append(mesh)

def ellipsoid(pivot,mat,xyz,radii,detail=2):
    m=trimesh.creation.icosphere(subdivisions=detail)
    m.apply_scale(radii);m.apply_translation(xyz)
    add(pivot,mat,m)

def R(y):
    return np.array([ [0.,math.cos(y),math.sin(y)], [0.,-math.sin(y),math.cos(y)] ])

def loft(pivot,mat,rings,segments=10):
    """loft rings [(centerXYZ, xRadius, zRadius)] with vertical axis Y."""
    # V3 fabric tailoring: intermediate rings and angular creases in the cloth
    # surface; hardware shells retain their exact previous silhouettes.
    fabric=(mat in {'uniform','uniform_dark'} and pivot!='head' and len(rings)>=3)
    if fabric:
        newrings=[]
        for a,b in zip(rings,rings[1:]):
            for t in np.linspace(0,1,4,endpoint=False):
                start,ra,za=a;end,rb,zb=b
                newrings.append((tuple((1-t)*np.array(start)+t*np.array(end)),ra*(1-t)+rb*t,za*(1-t)+zb*t))
        newrings.append(rings[-1])
        rings=newrings;segments=max(segments,18)
    verts=[];faces=[]
    for (center,rx,rz) in rings:
        for j in range(segments):
            t=2*math.pi*j/segments
            if fabric:
                # Soft gathers rise at sleeve/knee articulation and taper
                # toward the shoulders and main garment seams.
                rseed=1.4 if 'leg_' in pivot else 2.7 if 'arm_' in pivot else 3.2 if 'elbow_' in pivot else .9
                h=center[1]
                ripple=(math.sin(h*32+rseed+math.cos(t*2.4)*1.3)*.43 +
                        math.sin(h*58-rseed+math.cos(t*3.1)*.7)*.16 +
                        math.cos(t*5.0+math.sin(h*19))*.18)
                strength=.008 if pivot=='rig_body' else .011
                rx1=rx+strength*ripple
                rz1=rz+strength*ripple*.85
            else:rx1=rx;rz1=rz
            verts.append([center[0]+rx1*math.cos(t),center[1],center[2]+rz1*math.sin(t)])
    for i in range(len(rings)-1):
        for j in range(segments):
            a=i*segments+j;b=i*segments+(j+1)%segments
            c=(i+1)*segments+j;d=(i+1)*segments+(j+1)%segments
            faces.extend([(a,b,d),(a,d,c)])
    verts.append(list(rings[0][0]));bot=len(verts)-1
    verts.append(list(rings[-1][0]));top=len(verts)-1
    for j in range(segments):
        faces.append((bot,(j+1)%segments,j))
        idx=(len(rings)-1)*segments
        faces.append((top,idx+j,idx+(j+1)%segments))
    add(pivot,mat,trimesh.Trimesh(vertices=verts,faces=faces,process=False))

def box(pivot,mat,xyz,dimensions,angles=None):
    m=trimesh.creation.box(extents=dimensions)
    if angles:
        tf=trimesh.transformations.euler_matrix(*angles)
        m.apply_transform(tf)
    m.apply_translation(xyz)
    add(pivot,mat,m)

def bevelbox(pivot,mat,xyz,dimensions,frac=.12):
    """Twelve-sided vertical box with bevelled silhouette, fewer triangles than bevel modifiers."""
    w,h,d=dimensions;cx,cy,cz=xyz
    r=min(w,d)*frac
    poly=[(-w/2+r,-d/2), (w/2-r,-d/2),(w/2,-d/2+r),(w/2,d/2-r),
          (w/2-r,d/2),(-w/2+r,d/2),(-w/2,d/2-r),(-w/2,-d/2+r)]
    V=[];F=[]
    for y,shr in ((-h/2,.90),(-h/2+h*.06,1),(h/2-h*.06,1),(h/2,.90)):
        for x,z in poly:V.append([cx+x*shr,cy+y,cz+z*shr])
    n=len(poly)
    for k in range(3):
        for j in range(n):
            a=k*n+j;b=k*n+(j+1)%n;c=(k+1)*n+j;d=(k+1)*n+(j+1)%n
            F.extend(((a,d,b),(a,c,d)))
    for j in range(1,n-1):F.append((0,j+1,j));F.append((3*n,3*n+j,3*n+j+1))
    add(pivot,mat,trimesh.Trimesh(vertices=V,faces=F,process=False))

def panel(pivot,mat,xyz,width,height,thickness,cut=.08,angles=None):
    # Angular beveled-corner slab, suitable for flexible carrier front/rear armour.
    w=width/2;h=height/2;z=thickness/2;cx,cy,cz=xyz
    c=min(cut,w*.7,h*.7)
    loop=[(-w+c,-h),(w-c,-h),(w,-h+c),(w,h-c),(w-c,h),(-w+c,h),(-w,h-c),(-w,-h+c)]
    V=[(x,y,z0) for z0 in (-z,z) for x,y in loop]
    F=[]
    for j in range(8):
        q=(j+1)%8;F.extend(((j,q,q+8),(j,q+8,j+8)))
    for j in range(1,7):F.extend(((0,j+1,j),(8,8+j,8+j+1)))
    m=trimesh.Trimesh(vertices=V,faces=F,process=False)
    if angles: m.apply_transform(trimesh.transformations.euler_matrix(*angles))
    m.apply_translation(xyz);add(pivot,mat,m)

def rod(pivot,mat,start,end,radius,sides=7):
    a=np.array(start,dtype=float);b=np.array(end,dtype=float)
    v=b-a;length=np.linalg.norm(v)
    if length<1.e-6:return
    m=trimesh.creation.cylinder(radius=radius,height=length,sections=sides)
    T=trimesh.geometry.align_vectors([0,0,1],v/length)
    m.apply_transform(T);m.apply_translation((a+b)/2)
    add(pivot,mat,m)

def loopband(pivot,mat,xyz,width=.26,height=.045,depth=.25):
    x,y,z=xyz
    box(pivot,mat,(x-width/2,y,z),(height,height,depth))
    box(pivot,mat,(x+width/2,y,z),(height,height,depth))
    box(pivot,mat,(x,y,z-depth/2),(width,height,height))
    box(pivot,mat,(x,y,z+depth/2),(width,height,height))

# Origin at ground, front faces -Z. All body clothing is one realistic palette.
# Torso sculpt: tapered waist/upper trapezius, no cylindrical "robot" body.
loft('rig_body','uniform', [((0,.85,0),.207,.13),((0,1.04,0),.255,.157),((0,1.33,.005),.303,.180),((0,1.46,.012),.249,.158),((0,1.51,.014),.165,.10)],12)
loft('rig_body','uniform_dark',[((0,.79,0),.225,.145),((0,.92,0),.220,.141),((0,.975,0),.23,.141)],10)
# Rear soft tactical pack, not enormous: silhouette should stay athletic.
bevelbox('rig_body','pouches',(0,1.20,.238),(.39,.49,.18))
panel('rig_body','pouch_edge',(0,1.20,.342),.31,.35,.018,.035)
for yy in (1.30,1.19,1.08):
    box('rig_body','webbing',(0,yy,.355),(.29,.023,.012))
# Carrier: olive soft shell, front and back composite plates with chamfered corners.
panel('rig_body','carrier',(0,1.245,-.173),.48,.50,.075,.065)
panel('rig_body','armor',(0,1.28,-.217),.35,.35,.03,.050)
panel('rig_body','carrier',(0,1.25,.185),.47,.49,.045,.065)
# Carrier seam and chest collar strap.
box('rig_body','webbing',(0,1.47,-.194),(.31,.045,.038))
for side in (-1,1):
    # shoulder shoulder webbing and straps, front to back
    x=side*.24
    box('rig_body','webbing',(x,1.43,-.016),(.079,.042,.39))
    box('rig_body','armor_edge',(x,1.42,-.188),(.083,.105,.036))
    # side panels with buckles and elastic bands
    box('rig_body','pouches',(side*.267,1.18,.00),(.038,.26,.26))
    for yy in (1.31,1.15):
        box('rig_body','webbing',(side*.285,yy,.0),(.03,.027,.30))
# MOLLE rows, about 8cm pitch; rows of clearly modelled stitched channels.
for yy in (1.392,1.319,1.246,1.173):
    for xx in (-.130,-.045,.045,.130):
        box('rig_body','webbing',(xx,yy,-.242),(.059,.014,.017))
# Three load-bearing pouches and snapped down lids.
for xx,w in ((-.119,.129),(0,.12),(.119,.129)):
    bevelbox('rig_body','pouches',(xx,1.081,-.257),(w,.177,.100),.12)
    box('rig_body','pouch_edge',(xx,1.160,-.312),(w*.87,.023,.026))
    box('rig_body','webbing',(xx,1.120,-.311),(.019,.085,.013))
    box('rig_body','metal',(xx,1.098,-.322),(.023,.019,.010))
# Chest ID and team badge: muted rather than bright neon.
panel('rig_body','patch',(0,1.430,-.247),.124,.053,.008,.008)
box('rig_body','patch_emblem',(0,1.435,-.255),(.083,.012,.010))
# Belt, keeper loops and utility pouch.
box('rig_body','webbing',(0,.925,0),(.49,.062,.31))
box('rig_body','metal',(0,.925,-.166),(.090,.056,.027))
for side in (-1,1):
    bevelbox('rig_body','pouches',(side*.247,.859,-.055),(.096,.170,.150))
    box('rig_body','pouch_edge',(side*.241,.930,-.134),(.079,.027,.019))
# Wrist radio with flexible antenna at back left shoulder, purely visual.
bevelbox('rig_body','pouch_edge',(-.290,1.324,.130),(.065,.115,.065))
rod('rig_body','metal',(-.303,1.360,.16),(-.324,1.645,.18),.007,6)
# Neck shroud (no face: high-altitude charcoal balaclava).
loft('rig_body','uniform_dark',[((0,1.46,0),.114,.105),((0,1.55,0),.112,.091),((0,1.62,0),.098,.09)],10)

# Helmet as flattened realistic combat shell; visor is separate glossy mesh.
ellipsoid('head','uniform_dark',(0,-.016,-.012),(.159,.22,.151),2)
ellipsoid('head','helmet',(0,.107,.018),(.237,.169,.208),2)
# Face shroud, goggles, mandible and nose mask. Helm goggles face forward (-Z).
ellipsoid('head','uniform_dark',(0,-.064,-.114),(.169,.119,.114),2)
panel('head','visor',(0,.012,-.198),.308,.094,.033,.032)
box('head','helmet_trim',(0,-.041,-.224),(.29,.021,.03))
bevelbox('head','armor',(0,-.121,-.181),(.190,.113,.065))
box('head','helmet_trim',(0,-.112,-.217),(.100,.038,.012))
# Rear adjustment and helmet brim.
box('head','helmet_trim',(0,.096,-.209),(.37,.035,.083))
box('head','armor_edge',(0,.185,.025),(.25,.019,.17))
for side in (-1,1):
    x=side*.219
    # Tactical ear cups and helmet rails; chunky enough to be readable from distance.
    bevelbox('head','helmet_trim',(x,.043,-.003),(.078,.132,.168))
    bevelbox('head','armor',(side*.224,-.031,.015),(.078,.123,.105))
    for yy in (.025,.084):
        box('head','metal',(side*.259,yy,-.003),(.008,.020,.096))
    # Strap reaches under cheek, fitted to face shroud.
    rod('head','webbing',(side*.195,.035,-.095),(side*.104,-.151,-.112),.010,6)
# Slim side mic tube with correct non-weapon visual identity.
rod('head','helmet_trim',(.240,-.022,.033),(.264,-.123,-.067),.010,7)
rod('head','helmet_trim',(.264,-.123,-.067),(.146,-.124,-.158),.008,7)
ellipsoid('head','armor',(.146,-.124,-.158),(.027,.016,.018),1)
# Velcro patch on rear helmet.
panel('head','patch',(0,.112,.217),.128,.064,.012,.012)

# Anatomy-driven articulated legs, clear boot and knee mechanical separation.
for s,tag in ((-1,'L'),(1,'R')):
    leg='leg_'+tag;knee='knee_'+tag;arm='arm_'+tag;elbow='elbow_'+tag
    # Thigh & upper camo pant with fitted shapes and seam line.
    loft(leg,'uniform',[((0,.035,.010),.138,.145),((0,-.105,.000),.134,.142),((0,-.285,.018),.107,.114),((0,-.386,.008),.100,.108)],10)
    panel(leg,'cloth_highlight',(s*.002,-.154,-.140),.108,.230,.012,.014)
    # Cargo pocket with flap, two seams and small closure tab.
    bevelbox(leg,'uniform_dark',(s*.113,-.190,-.008),(.055,.168,.151))
    box(leg,'pouches',(s*.141,-.114,-.012),(.029,.041,.141))
    for xx in (-.039,.039):
        box(leg,'stitch',(xx,-.20,-.150),(.008,.134,.010))
    # Knee split with segmented anatomical joint and wrapping brace.
    loft(knee,'uniform_dark',[((0,.025,.016),.108,.111),((0,-.150,.012),.103,.108),((0,-.330,.007),.087,.094),((0,-.398,.003),.084,.09)],10)
    panel(knee,'armor',(0,-.076,-.110),.197,.200,.069,.046)
    panel(knee,'armor_edge',(0,-.070,-.149),.124,.114,.013,.023)
    for yy in (-.002,-.144):
        box(knee,'webbing',(0,yy,-.095),(.205,.023,.034))
    # Angle of foot and toe physically anchored to the floor.
    bevelbox(knee,'boots',(0,-.360,-.052),(.184,.148,.220),.18)
    bevelbox(knee,'boots',(0,-.393,-.154),(.214,.110,.289),.15)
    box(knee,'armor_edge',(0,-.450,-.133),(.210,.018,.294))
    # laces along instep, tiny rivets and a heel band
    for yy in (-.331,-.366,-.393):
        box(knee,'webbing',(0,yy,-.225),(.110,.009,.020))
    box(knee,'helmet_trim',(0,-.356,.081),(.155,.049,.014))
    # Shoulder cap and cuff over organic sleeve, not a mechanical cylinder.
    loft(arm,'uniform',[((0,.017,.003),.128,.139),((0,-.090,.009),.136,.130),((0,-.247,.016),.100,.104),((0,-.329,.016),.089,.097)],10)
    ellipsoid(arm,'carrier',(0,-.015,-.013),(.144,.116,.146),2)
    panel(arm,'armor',(0,-.010,-.151),.187,.140,.023,.041)
    # Shoulder patch faces outward.
    box(arm,'patch',(s*.136,-.130,-.026),(.018,.105,.136))
    box(arm,'patch_emblem',(s*.150,-.135,-.028),(.008,.038,.078))
    # Sleeve stitch and elbow guard with gloves.
    loft(elbow,'uniform_dark',[((0,.025,.003),.100,.100),((0,-.101,.000),.097,.103),((0,-.228,-.017),.077,.084),((0,-.266,-.026),.073,.081)],10)
    panel(elbow,'armor',(0,-.081,-.107),.146,.130,.042,.035)
    box(elbow,'webbing',(0,-.244,-.013),(.156,.050,.152))
    bevelbox(elbow,'glove',(0,-.304,-.031),(.158,.108,.141))
    panel(elbow,'armor_edge',(0,-.304,-.116),.108,.059,.016,.022)
    for dx in (-.045,-.016,.016,.045):
        box(elbow,'armor_edge',(dx,-.360,-.089),(.022,.052,.048))


# ───────────────────────────────────────────────────────────────────────────
# DETAIL PASS 02: HELMET / FABRICS / SOFT ARMOUR / ACCESSORIES / HARDWARE
# Authored onto the original ten pivot groups. Purely cosmetic, not mechanics.
# All geometry stays attached to its parent and can follow game locomotion.
# ───────────────────────────────────────────────────────────────────────────
def path(pivot,mat,points,r=.004,sides=5):
    for a,b in zip(points,points[1:]):rod(pivot,mat,a,b,r,sides)

def seam_rectangle(pivot,mat,x0,x1,y0,y1,z,r=.003):
    path(pivot,mat,[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z),(x0,y0,z)],r,5)

def rivet(pivot,x,y,z,r=.009):
    # Small circular fastening head, offset from cloth panels.
    rod(pivot,'metal',(x,y,z),(x,y,z-.006),r,6)

def buckle(pivot,x,y,z,w=.050,h=.040):
    # Four-sided low-profile metal clasp with nylon centre.
    box(pivot,'buckle',(x-w*.45,y,z),(.010,h,.010))
    box(pivot,'buckle',(x+w*.45,y,z),(.010,h,.010))
    box(pivot,'buckle',(x,y+h*.42,z),(w,.008,.010))
    box(pivot,'buckle',(x,y-h*.42,z),(w,.008,.010))
    box(pivot,'nylon',(x,y,z+.003),(w*.53,h*.37,.009))

def stitchline(pivot,points,r=.0027):
    path(pivot,'thread',points,r,5)

# 01. Armor hardware: chest plate perimeter, under-plate edge and webbing weave.
# Fine double-lines define a separate composite plate, instead of a painted cube.
path('rig_body','nylon_edge',[
    (-.139,1.422,-.259),(.139,1.422,-.259),(.178,1.372,-.259),
    (.178,1.226,-.259),(.126,1.111,-.259),(-.126,1.111,-.259),
    (-.178,1.226,-.259),(-.178,1.372,-.259),(-.139,1.422,-.259)],.004)
for xx in [-.194,.194]:
    # Padded vertical MOLLE webbing and edge stitching.
    box('rig_body','nylon',(xx,1.277,-.259),(.028,.31,.015))
    stitchline('rig_body',[(xx,1.123,-.273),(xx,1.430,-.273)])
for row,yy in enumerate([1.388,1.314,1.240,1.165]):
    for xx in [-.135,-.045,.045,.135]:
        # Stitch endpoints create the loop tension of the horizontal MOLLE grid.
        for delta in [-.021,.021]:
            rod('rig_body','thread',(xx+delta,yy+.011,-.265),
                (xx+delta,yy-.010,-.265),.0025,5)
        if row<3:
            box('rig_body','nylon',(xx,yy-.031,-.253),(.011,.032,.014))
# Shoulder load-lifters; buckles, straps and reinforcing stitch marks.
for s in (-1,1):
    x=s*.237
    box('rig_body','nylon',(x,1.451,-.188),(.098,.038,.052))
    buckle('rig_body',x,1.429,-.229,.070,.052)
    for zx in [-.132,-.071]:
        box('rig_body','nylon_edge',(x,1.482,zx),(.075,.009,.014))
    # Side tension strap, buckles and tab ends.
    for yy in [1.303,1.153]:
        box('rig_body','nylon',(s*.271,yy,-.025),(.025,.043,.340))
        buckle('rig_body',s*.290,yy,-.165,.039,.033)
# Lower front plate lining and padded under-vest layer.
box('rig_body','nylon',(0,1.006,-.200),(.420,.047,.031))
for xx in (-.115,0,.115):
    seam_rectangle('rig_body','thread',xx-.055,xx+.055,1.002,1.162,-.316,.0028)
    for yy in (1.071,1.119):
        stitchline('rig_body',[(xx-.041,yy,-.316),(xx+.040,yy,-.316)])
# Fastened front belt keeper and angled diagonal emergency zipper seam.
for xx in (-.205,.205):
    box('rig_body','nylon',(xx,.925,-.168),(.037,.105,.024))
    rivet('rig_body',xx,.958,-.185)
    rivet('rig_body',xx,.891,-.185)
buckle('rig_body',0,.926,-.191,.083,.047)
# Carrier recovery handle, backed by two tiny webbing loops.
path('rig_body','nylon',[(-.089,1.516,.224),(-.085,1.553,.224),(.085,1.553,.224),(.089,1.516,.224)],.014)
for xx in (-.085,.085):
    box('rig_body','thread',(xx,1.504,.218),(.022,.010,.031))

# 02. Backpack: distinctive pack silhouette, panels, compression straps,
# zipper tracks, webbing ladders, and radio cable along shoulder.
bevelbox('rig_body','nylon',(0,1.218,.355),(.320,.290,.048),.11)
seam_rectangle('rig_body','thread',-.155,.155,1.074,1.356,.384)
# central roll-pocket and two-sided compression tabs
bevelbox('rig_body','pouches',(0,1.096,.392),(.196,.121,.057))
for yy in [1.112,1.284,1.346]:
    box('rig_body','nylon_edge',(0,yy,.394),(.272,.022,.020))
for xx in (-.120,.120):
    box('rig_body','nylon',(xx,1.21,.396),(.023,.285,.019))
    buckle('rig_body',xx,1.185,.409,.043,.047)
    for yy in (1.316,1.245,1.135):rivet('rig_body',xx,yy,.419,.0065)
# vertical YKK-style zipper, pull-tab, drainage holes
for xx in (-.089,.089):
    path('rig_body','zipper',[(xx,1.081,.416),(xx,1.354,.416)],.0035)
    for iy in range(10):
        yy=1.104+iy*.025
        box('rig_body','metal',(xx,yy,.422),(.016,.005,.004))
box('rig_body','zipper',(-.089,1.287,.430),(.026,.040,.006))
rod('rig_body','cord',(-.089,1.271,.432),(-.063,1.239,.450),.005,5)
# main compression straps curving around pack side
for s in (-1,1):
    path('rig_body','webbing',[(s*.159,1.366,.305),(s*.184,1.348,.276),(s*.194,1.290,.230)],.010)
    box('rig_body','buckle',(s*.187,1.348,.288),(.020,.050,.034))
# shoulder cable drape (decorative radio headset wire)
path('rig_body','rubber',[(-.286,1.376,.135),(-.310,1.449,.161),(-.297,1.500,.143),
                         (-.250,1.534,.096),(-.189,1.531,.046)],.006,7)
for xx in [-.090,.090]:
    box('rig_body','pouch_edge',(xx,.836,.177),(.055,.110,.064))
    buckle('rig_body',xx,.864,.215,.025,.032)

# 03. Helmet: rim gasket, segmented rail pods, skull vents, front mounting base.
# The original domed shell remains, now with secondary helmet components.
# Crown ventilation: asymmetric curved rows and triangular standoffs.
for s in (-1,1):
    x=s*.125
    for i in range(3):
        z=-.091+i*.062
        box('head','helmet_trim',(x,.236-i*.006,z),(.030,.010,.028))
        box('head','rubber',(x,.242-i*.006,z),(.020,.006,.024))
    # segmented helmet shell rim, cheek and visor rim attachment rivets
    path('head','helmet_trim',[(s*.170,.155,-.119),(s*.222,.130,-.050),
                              (s*.235,.099,.036),(s*.196,.089,.150)],.010,7)
    for yy,zz in ((.121,-.101),(.090,.040)):
        rivet('head',s*.239,yy,zz,.010)
    # Side accessory rail with 3 slots and catches
    bevelbox('head','buckle',(s*.260,.061,-.016),(.032,.079,.164),.12)
    for zz in (-.065,-.016,.033):
        box('head','rubber',(s*.284,.062,zz),(.010,.043,.021))
        box('head','metal',(s*.290,.044,zz),(.005,.010,.018))
    # ear protection vents, stitching on cushioned ear cup
    for yy in (-.038,-.008,.022):
        box('head','rubber_lite',(s*.268,yy,.025),(.010,.009,.073))
    # helmet chin strap buckles
    buckle('head',s*.142,-.135,-.140,.033,.033)
# IR/name patch on forehead, at base of shroud
panel('head','nylon',(0,.162,-.179),.105,.046,.017,.011)
for x in (-.026,0,.026):box('head','thread',(x,.159,-.194),(.013,.024,.004))
# bracket for removable forehead accessories; no operative gadgets/weaponry
bevelbox('head','helmet_trim',(0,.125,-.235),(.082,.079,.038),.14)
box('head','buckle',(0,.125,-.260),(.049,.031,.012))
for x in (-.032,.032):rivet('head',x,.133,-.270,.006)
# Entire double goggle surround; depth accents break broad featureless visor.
path('head','glass_edge',[(-.159,.063,-.226),(-.157,.003,-.230),(-.125,-.044,-.232),
                         (.125,-.044,-.232),(.158,.004,-.230),(.159,.063,-.226)],.005)
box('head','glass_dark',(0,.009,-.226),(.285,.052,.007))
# nose bridge and filters on mask
bevelbox('head','rubber',(0,-.108,-.220),(.097,.078,.024),.18)
for x in (-.045,.045):
    for yy in (-.138,-.119,-.100):
        rod('head','metal',(x,yy,-.225),(x,yy,-.229),.004,6)
# Helmet shell rear adjustment ratchet and horizontal vent slits.
box('head','buckle',(0,.049,.230),(.097,.034,.020))
for yy in (.091,.132):box('head','rubber',(0,yy,.216),(.120,.011,.026))
for x in (-.098,.098):rivet('head',x,.105,.233,.008)

# 04. Tailored uniform: visible reinforced seams, tailored seams, quilting folds
# and sleeve patches. No floating, detached cosmetic parts.
for s,tag in ((-1,'L'),(1,'R')):
    leg='leg_'+tag;knee='knee_'+tag;arm='arm_'+tag;elbow='elbow_'+tag
    # Thigh cargo pocket construction; folded bellows, flap, zipper and button.
    box(leg,'nylon',(s*.144,-.203,-.005),(.022,.122,.151))
    box(leg,'nylon_edge',(s*.160,-.141,-.010),(.011,.008,.138))
    for yy in [-.174,-.200,-.225]:
        box(leg,'thread',(s*.169,yy,-.007),(.006,.004,.114))
    rivet(leg,s*.164,-.123,-.008,.006)
    path(leg,'fold_dark',[(s*.112,-.285,-.112),(s*.076,-.303,-.133),(s*.029,-.306,-.137)],.005)
    path(leg,'fold_light',[(-.084,-.090,-.133),(-.041,-.112,-.145),(.034,-.124,-.142)],.005)
    path(leg,'fold_dark',[(-.061,-.326,-.098),(.022,-.335,-.118),(.074,-.330,-.110)],.004)
    # Narrow reinforced stitching down the visible front thigh.
    stitchline(leg,[(s*.063,-.026,-.137),(s*.066,-.102,-.146),(s*.072,-.181,-.125),
                    (s*.066,-.269,-.115),(s*.060,-.346,-.102)],.003)
    # Kneepad outer cuff and capsule plate with a stitched edge.
    path(knee,'nylon_edge',[(-.096,-.035,-.155),(-.070,-.164,-.159),(.070,-.164,-.159),
                           (.096,-.035,-.155)],.006)
    for xx in (-.080,.080):
        rivet(knee,xx,-.068,-.151,.006)
        box(knee,'rubber',(xx,-.111,-.149),(.015,.034,.012))
    # Shin folds/pleats under guard; strap hardware around back.
    for yy in (-.204,-.239,-.272):
        path(knee,'fold_light',[(-.075,yy,-.076),(.008,yy-.006,-.092),(.070,yy-.003,-.076)],.0033)
    buckle(knee,0,-.144,-.123,.036,.029)
    # Multi-panel boot reinforcement: outsole, toe cap, tiny tread blocks.
    bevelbox(knee,'rubber',(0,-.454,-.145),(.225,.022,.305),.10)
    bevelbox(knee,'rubber_lite',(0,-.397,-.260),(.187,.034,.075),.20)
    box(knee,'nylon',(0,-.328,-.204),(.139,.081,.029))
    for xx in (-.064,.064):
        stitchline(knee,[(xx,-.335,-.225),(xx,-.383,-.229)],.0027)
    for yy in (-.340,-.361,-.383):
        path(knee,'cord',[(-.050,yy,-.229),(.000,yy-.008,-.238),(.050,yy,-.229)],.003)
        for xx in (-.058,.058):rivet(knee,xx,yy,-.234,.005)
    for xx in (-.077,0,.077):
        for zz in (-.252,-.135,-.035):
            box(knee,'rubber',(xx,-.471,zz),(.046,.017,.057))
    # Shoulder epaulette trim and outer sleeve multi-layered uniform folds.
    path(arm,'nylon_edge',[(-.093,.020,-.135),(-.020,.077,-.141),(.079,.025,-.137)],.006)
    stitchline(arm,[(-.096,-.085,-.111),(-.099,-.151,-.091),(-.081,-.237,-.086)],.003)
    for yy in (-.168,-.231):
        path(arm,'fold_light',[(-.075,yy,-.119),(-.016,yy+.015,-.130),(.067,yy-.004,-.112)],.004)
    # Patch border and emblem bars on external sleeve, no real unit insignia.
    box(arm,'nylon_edge',(s*.156,-.128,-.027),(.008,.117,.148))
    for yy in (-.154,-.133,-.113):
        box(arm,'patch_emblem',(s*.162,yy,-.035),(.006,.006,.069))
    # elbow composite guards, stitched sleeve edge, wrist clasp and knuckle pads.
    path(elbow,'nylon_edge',[(-.069,-.031,-.135),(-.069,-.141,-.135),
                             (.069,-.141,-.135),(.069,-.031,-.135)],.004)
    for yy in (-.159,-.194):
        path(elbow,'fold_dark',[(-.063,yy,-.082),(.005,yy+.008,-.100),(.065,yy,-.080)],.0035)
    buckle(elbow,0,-.234,-.112,.055,.031)
    for xx in (-.047,-.015,.016,.047):
        # Separate raised knuckle protectors are attached to glove geometry.
        bevelbox(elbow,'rubber_lite',(xx,-.309,-.126),(.028,.027,.018),.15)
        box(elbow,'nylon_edge',(xx,-.343,-.113),(.018,.032,.013))
    # Velcro wrist strap and stitched binding.
    box(elbow,'nylon',(0,-.248,-.089),(.165,.034,.018))
    stitchline(elbow,[(-.071,-.235,-.104),(.073,-.235,-.104)],.0026)

# 05. Small miscellaneous functional-looking but cosmetic items.
# Two service pocket zipper tracks on chest shoulder and webbing loop edges.
for s in (-1,1):
    box('rig_body','nylon',(s*.235,1.347,-.199),(.046,.056,.024))
    path('rig_body','zipper',[(s*.210,1.363,-.214),(s*.260,1.363,-.214)],.003)
    rivet('rig_body',s*.241,1.331,-.213,.007)
# Chest equipment cable clips, webbing patch stitching, ID patch frame.
for x in (-.068,.068):rivet('rig_body',x,1.433,-.262,.006)
seam_rectangle('rig_body','thread',-.063,.063,1.400,1.460,-.265,.0028)
# Mildly asymmetric operator look: generic angled tag on the right chest.
panel('rig_body','nylon',(.102,1.489,-.207),.100,.026,.011,.007)
box('rig_body','thread',(.103,1.486,-.217),(.069,.004,.003))


# ---------------------------------------------------------------------------
# REALISM PASS 03 — UV atlases / authentic PBR response / unified 10-draw rig
# ---------------------------------------------------------------------------
from PIL import Image
from scipy.ndimage import gaussian_filter
import json,struct

RNG=np.random.default_rng(271126)
TILE=192
COLS=6
KEYS=list(colors)
ROWS=math.ceil(len(KEYS)/COLS)
ATLAS_W=COLS*TILE
ATLAS_H=ROWS*TILE
albedo=np.zeros((ATLAS_H,ATLAS_W,3),dtype=np.uint8)
normal=np.zeros((ATLAS_H,ATLAS_W,3),dtype=np.uint8)
metalrough=np.zeros((ATLAS_H,ATLAS_W,3),dtype=np.uint8)

FABRIC={'uniform','uniform_dark','cloth_highlight','fold_light','fold_dark'}
NYLON={'carrier','webbing','pouches','pouch_edge','nylon','nylon_edge','thread','stitch','cord','patch'}
HARD={'helmet','helmet_trim','armor','armor_edge','ceramic','buckle'}
METAL={'metal','zipper','highlight'}
RUBBER={'glove','boots','rubber','rubber_lite','glass_edge'}
GLASS={'visor','glass_dark'}

for idx,key in enumerate(KEYS):
    row,col=divmod(idx,COLS)
    yy,xx=np.mgrid[0:TILE,0:TILE]
    edge=np.minimum.reduce([xx,yy,TILE-1-xx,TILE-1-yy]).astype(float)
    n=RNG.standard_normal((TILE,TILE)).astype(np.float32)
    low=gaussian_filter(n,12); low=low/(low.std()+1e-8)
    mid=gaussian_filter(n,2); mid=mid/(mid.std()+1e-8)
    hi=n/(n.std()+1e-8)
    # Tiny repeating microstructure: diagonal woven twill, basket nylon,
    # coarse powder-coated ceramic, faint brushed metal, and rubber grain.
    if key in FABRIC:
        weave=(np.sin((xx+yy*.24)*np.pi*.50)*np.cos((yy-xx*.17)*np.pi*.58))
        variation=.055*weave+.035*mid+.026*low+.017*hi
        rough=np.clip(.88+.024*mid+.018*hi,.76,.97)
        metall=np.zeros_like(rough)
        hgt=weave*.65+.20*mid
    elif key in NYLON:
        weave=(np.sin(xx*np.pi*.32)*np.sin(yy*np.pi*.38)+.40*np.sin((xx+yy)*np.pi*.48))
        variation=.066*weave+.034*mid+.025*low+.018*hi
        rough=np.clip(.81+.035*mid+.02*hi,.68,.95)
        metall=np.zeros_like(rough)
        hgt=weave*.78+mid*.19
    elif key in HARD:
        tiny=gaussian_filter(n,1)
        scratches=np.sin((xx*.13+yy*.22))*.5 + np.cos(xx*.08-yy*.18)*.5
        variation=.027*low+.023*mid+.020*hi+.009*scratches
        rough=np.clip(.57+.075*low+.035*mid,.35,.78)
        metall=np.full_like(rough,.17 if key=='helmet_trim' else .08)
        hgt=mid*.55+tiny*.33
    elif key in METAL:
        brush=np.sin(yy*1.8+gaussian_filter(n,2)*.5)
        variation=.048*brush+.026*mid+.018*low+.02*hi
        rough=np.clip(.40+.05*mid+.05*low,.25,.6)
        metall=np.full_like(rough,.78)
        hgt=brush*.37+mid*.17
    elif key in GLASS:
        variation=.028*low+.012*mid
        rough=np.clip(.17+.020*low,.10,.27)
        metall=np.full_like(rough,.12)
        hgt=.04*low
    else:
        variation=.036*low+.024*mid+.035*hi
        rough=np.clip(.92+.020*mid,.83,.98)
        metall=np.zeros_like(rough)
        hgt=mid*.4+hi*.22
    # Irregular abrasion around UV island boundaries. The effect is subdued
    # for garments and pronounced on composite plate and helmet surfaces.
    edge_strength=(np.clip((16-edge)/16,0,1)**2)*np.clip(.8+mid*.24,0,1)
    if key in HARD or key in METAL:
        variation+=.13*edge_strength
        rough=np.clip(rough+.11*edge_strength,0,1)
    elif key in NYLON:
        variation+=.026*edge_strength
    # Patina: faint directional streaks on hard parts, not random muddy noise.
    if key in HARD:
        scuff=(RNG.random((TILE,TILE))>.998).astype(np.float32)
        scuff=gaussian_filter(scuff,sigma=(.85,3.0))
        scuff=scuff/(scuff.max()+1e-7)
        variation+=.082*scuff
    rgb=np.array(colors[key][:3],dtype=float)
    base=np.clip(rgb[None,None,:]*(1+variation[:,:,None])+
                 (edge_strength[:,:,None]*(8 if key in HARD else 0)),0,255)
    # Preserve proper optical appearance: visor remains dark bluish glass.
    if key in GLASS: base=np.clip(base+np.stack([.8*low,1.5*low,2.0*low],axis=-1),0,255)
    grads=np.gradient(hgt.astype(np.float32))
    nx=-grads[1]*(.23 if key in FABRIC|NYLON else .14)
    ny=-grads[0]*(.23 if key in FABRIC|NYLON else .14)
    nz=np.ones_like(nx)
    vec=np.stack([nx,ny,nz],axis=-1)
    vec/=np.linalg.norm(vec,axis=-1,keepdims=True)
    nrgba=np.clip((vec*.5+.5)*255,0,255).astype(np.uint8)
    r0=row*TILE;c0=col*TILE
    albedo[r0:r0+TILE,c0:c0+TILE]=base.astype(np.uint8)
    normal[r0:r0+TILE,c0:c0+TILE]=nrgba
    metalrough[r0:r0+TILE,c0:c0+TILE,0]=255  # occlusion channel, full light
    metalrough[r0:r0+TILE,c0:c0+TILE,1]=(rough*255).astype(np.uint8)
    metalrough[r0:r0+TILE,c0:c0+TILE,2]=(metall*255).astype(np.uint8)

albedo_im=Image.fromarray(albedo,'RGB')
normal_im=Image.fromarray(normal,'RGB')
mr_im=Image.fromarray(metalrough,'RGB')
for key,img in [('BaseColor',albedo_im),('Normal',normal_im),('MetallicRoughness',mr_im)]:
    img.save(OUT/f'CROSSFire_Operator_03_{key}_Atlas.png',optimize=True)

# One shared atlas material retains physical differences between armor, soft
# fabric and metal yet takes only one draw call per articulated body pivot.
atlas=trimesh.visual.material.PBRMaterial(
    name='CF_Operator_03_PBR_Atlas',
    baseColorFactor=[255,255,255,255],
    baseColorTexture=albedo_im,
    normalTexture=normal_im,
    metallicRoughnessTexture=mr_im,
    metallicFactor=1.0,
    roughnessFactor=1.0,
    doubleSided=True)

nodeparents={'rig_body':('world',(0,0,0)),
 'head':('rig_body',(0,1.67,0)),
 'leg_L':('rig_body',(-.166,.790,0)), 'leg_R':('rig_body',(.166,.790,0)),
 'knee_L':('leg_L',(0,-.387,0)), 'knee_R':('leg_R',(0,-.387,0)),
 'arm_L':('rig_body',(-.374,1.435,0)), 'arm_R':('rig_body',(.374,1.435,0)),
 'elbow_L':('arm_L',(0,-.327,-.012)), 'elbow_R':('arm_R',(0,-.327,-.012))}

# Map one object into a private UV island inside its material texture tile.
# UVs are generated per geometric element to avoid stretching all tiny parts
# across the full player; glTF maps remain PBR compatible in Blender / Three.
def geo_uv(mesh,mat):
    verts=mesh.vertices
    ext=np.ptp(verts,axis=0)
    mi=verts.min(axis=0)
    if mat in FABRIC and ext[1]>1.25*max(ext[0],ext[2]) and ext[0]>.07 and ext[2]>.07:
        # Jacket sleeves and trouser tubes use vertical cylindrical mapping.
        center=np.mean(mesh.bounds,axis=0)
        dx=verts[:,0]-center[0];dz=verts[:,2]-center[2]
        u=(np.arctan2(dx,-dz)+np.pi)/(2*np.pi)
        v=(verts[:,1]-mi[1])/(ext[1]+1e-7)
    else:
        # Choose the pair of axes spanning the main face of an accessory.
        axes=np.argsort(ext)[-2:]
        a,b=sorted(axes.tolist())
        u=(verts[:,a]-mi[a])/(ext[a]+1e-7)
        v=(verts[:,b]-mi[b])/(ext[b]+1e-7)
    # Keep the UV safely inside one atlas tile; avoids neighbor bleeding.
    u=.045+.91*np.clip(u,0,1);v=.045+.91*np.clip(v,0,1)
    idx=KEYS.index(mat);row,col=divmod(idx,COLS)
    uv=np.column_stack(((col+u)/COLS,(ROWS-row-1+v)/ROWS))
    return uv.astype(np.float32)

def combine_uv(pieces):
    vertices=[];faces=[];uv=[];shift=0
    for mesh,mat in pieces:
        vv=np.asarray(mesh.vertices)
        vertices.append(vv)
        faces.append(mesh.faces+shift)
        uv.append(geo_uv(mesh,mat))
        shift+=len(vv)
    whole=trimesh.Trimesh(vertices=np.concatenate(vertices),faces=np.concatenate(faces),process=False)
    whole.visual=trimesh.visual.TextureVisuals(uv=np.concatenate(uv),material=atlas)
    return whole

def init_scene():
    s=trimesh.Scene()
    for child,(parent,pos) in nodeparents.items():
        s.graph.update(frame_to=child,frame_from=parent,matrix=translation_matrix(pos))
    return s

# Editable version: separate mesh for each palette material and articulated
# pivot. This retains the authoring hierarchy and individual components.
edit=init_scene()
for (pivot,mat),members in items.items():
    geo=combine_uv([(mesh,mat) for mesh in members])
    name=f'{pivot}__{mat}'
    edit.add_geometry(geo,geom_name=name,node_name=name,parent_node_name=pivot)
editpath=OUT/'CROSSFire_Operator_03_PBR_Detailed.glb'
editpath.write_bytes(edit.export(file_type='glb'))

# Ten meshes / ten articulated nodes. UV atlas is genuinely preserved even
# after mesh consolidation, unlike the old vertex-colour-only edition.
game=init_scene()
for pivot in nodeparents:
    pieces=[(mesh,mat) for (grp,mat),members in items.items() if grp==pivot for mesh in members]
    if pieces:
        geo=combine_uv(pieces)
        name=pivot+'_PBR_mesh'
        game.add_geometry(geo,geom_name=name,node_name=name,parent_node_name=pivot)
gamepath=OUT/'CROSSFire_Operator_03_PBR_Game.glb'
gamepath.write_bytes(game.export(file_type='glb'))
print('PBR detailed',editpath.stat().st_size,'bytes',len(edit.geometry),'draw calls')
print('PBR gameplay',gamepath.stat().st_size,'bytes',len(game.geometry),'draw calls')
print('Triangles',sum(len(m.faces) for m in game.geometry.values()), 'rig pivots',len(nodeparents))
print('Maps',ATLAS_W,ATLAS_H,'materials',len(KEYS))

# Technical validation, including that all three textures survived glTF export.
def inspect_glb(path):
    raw=path.read_bytes()
    assert raw[:4]==b'glTF'
    length,typ=struct.unpack('<II',raw[12:20]); assert typ==0x4e4f534a
    data=json.loads(raw[20:20+length])
    return data
for name,path in [('detailed',editpath),('game',gamepath)]:
    meta=inspect_glb(path)
    assert len(meta.get('images',[]))>=3,(name,len(meta.get('images',[])))
    assert all('TEXCOORD_0' in p['attributes'] for m in meta['meshes'] for p in m['primitives'])
    assert len(meta['materials'])>=1
    assert len(meta['nodes'])>=10
    print('Validated',name,'gltf nodes',len(meta['nodes']),'images',len(meta['images']))