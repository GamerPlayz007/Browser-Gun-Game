"""CROSSFire AWP visual-only exterior prop, traced artistically from supplied side photograph.
Nonfunctional geometry; arbitrary units and cosmetic exterior only. Blender-importable GLB.
"""
from pathlib import Path
import math, json, random
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point, LineString
from shapely import constrained_delaunay_triangles
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parent
IMG_REF=ROOT/'Reference_Image.png'
scene=trimesh.Scene()
parts=[]; palette={}; rng=random.Random(17)
# Axis: +X to buttstock / -X to front, Y up, Z toward visible photographed side.
def P(x,y):return ((x-640)/100, (350-y)/100)
def Q(x,y,z):return np.array([*P(x,y),z],float)

def material(name,color,metal=.0,rough=.6):
  if name in palette:return palette[name]
  rgb=tuple(int(color.lstrip('#')[i:i+2],16) for i in (0,2,4))
  # Small tiled PBR micrograin maps keep the colored finishes from looking like flat clay.
  rng_map=np.random.default_rng(abs(sum(ord(c)*(i+11) for i,c in enumerate(name))) % 2**32)
  texsize=256
  noise=rng_map.normal(0,5.0,(texsize,texsize))
  # Neutral color map is multiplied with the physical base color in glTF.
  tone=np.clip(244+noise,208,255).astype(np.uint8)
  base=Image.fromarray(np.repeat(tone[:,:,None],3,axis=2),'RGB')
  # glTF standard packed map: G roughness, B metallic.
  mr=np.empty((texsize,texsize,3),dtype=np.uint8);mr[:,:,0]=0
  mr[:,:,1]=np.clip(255*rough+noise*1.3,0,255).astype('uint8')
  mr[:,:,2]=np.clip(255*metal+noise*.45,0,255).astype('uint8')
  metallicRoughness=Image.fromarray(mr,'RGB')
  # Flat base normal with fine, material-dependent microtexture.
  bump=np.clip(127+rng_map.normal(0,1.5 if rough<.6 else 2.8,(texsize,texsize,2)),113,142).astype('uint8')
  norm=np.empty((texsize,texsize,3),dtype=np.uint8);norm[:,:,:2]=bump;norm[:,:,2]=255
  normal=Image.fromarray(norm,'RGB')
  mat=PBRMaterial(name=name,baseColorFactor=list(rgb)+[255],baseColorTexture=base,
      metallicRoughnessTexture=metallicRoughness,normalTexture=normal,
      metallicFactor=1,roughnessFactor=1,doubleSided=True)
  palette[name]=mat; return mat
for args in [
 ('olive','#3d483a',.18,.82),('olive_light','#54604f',.17,.73),('olive_recess','#252c25',.21,.83),
 ('receiver_black','#171c1b',.63,.52),('receiver_edge','#3a3d38',.61,.45),
 ('barrel_black','#191c1d',.85,.40),('barrel_highlight','#30373a',.81,.43),
 ('scope_black','#1a1e20',.65,.46),('scope_edge','#383d40',.7,.42),
 ('rubber','#17191a',.04,.91),('grip_poly','#232624',.04,.90),
 ('steel','#656763',.74,.40),('screws','#171a19',.64,.48),
 ('silver_label','#e6e6e0',0,.75),('optic_lens','#121e29',.1,.17),
 ('dark_olive','#333b33',.18,.80),('mid_olive','#2a322c',.22,.8),
 ('shadow_slots','#0b0d0d',.17,.94),('rail_black','#262b2a',.59,.53),
 ]:material(*args)

def add(name, mesh, mat):
 mesh.visual=trimesh.visual.ColorVisuals(mesh,vertex_colors=None) if mesh.visual is None else mesh.visual
 # Standard planar art UVs. The GLB remains editable; full UV unwrapping can be refined in Blender.
 verts=np.asarray(mesh.vertices)
 uv=np.column_stack([verts[:,0]*1.8,verts[:,1]*1.8])
 mesh.visual=TextureVisuals(uv=uv,material=palette[mat])
 scene.add_geometry(mesh,geom_name=name,node_name=name)
 parts.append({'name':name,'material':mat,'triangles':int(len(mesh.faces))})

def poly2(name,points,thick,mat,holes=None,z=0, round_px=0):
  coords=[P(*p) for p in points]; hh=[[P(*p) for p in hole] for hole in (holes or [])]
  shape=Polygon(coords,hh)
  if round_px:
    r=round_px/100
    shape=shape.buffer(r,join_style=1,resolution=4).buffer(-r,join_style=1,resolution=4)
  if not shape.is_valid:shape=shape.buffer(0)
  if shape.is_empty:return
  if shape.geom_type=='MultiPolygon':
   for i,g in enumerate(shape.geoms): extrude_polygon(name+f'_{i}',g,thick,mat,z)
  else: extrude_polygon(name,shape,thick,mat,z)

def extrude_polygon(name,shape,thick,mat,z):
  tris=constrained_delaunay_triangles(shape)
  z0=z-thick/2;z1=z+thick/2
  verts=[]; faces=[]; lookup={}
  def vi(xx,yy,zz):
   key=(round(xx,8),round(yy,8),round(zz,8))
   if key not in lookup:lookup[key]=len(verts);verts.append(key)
   return lookup[key]
  for tri in tris.geoms:
   if tri.area<1e-10:continue
   vs=list(tri.exterior.coords)[:3]
   f0=[vi(a,b,z0) for a,b in vs]
   f1=[vi(a,b,z1) for a,b in vs]
   faces.extend([f0[::-1],f1])
  for ring in [shape.exterior,*shape.interiors]:
   pts=list(ring.coords)
   for a,b in zip(pts[:-1],pts[1:]):
    x0,y0=a;x1,y1=b
    v0=vi(x0,y0,z0);v1=vi(x1,y1,z0);v2=vi(x1,y1,z1);v3=vi(x0,y0,z1)
    faces.extend([[v0,v1,v2],[v0,v2,v3]])
  if not faces:return
  mesh=trimesh.Trimesh(vertices=np.array(verts,float),faces=np.array(faces,int),process=True)
  mesh.fix_normals();add(name,mesh,mat)

def box(name,pix,w,h,d,mat,z=0):
  m=trimesh.creation.box(extents=(w/100,h/100,d))
  m.apply_translation(Q(*pix,z));add(name,m,mat)

def ellipse(x,y,rx,ry,n=30):return [(x+rx*math.cos(i*2*math.pi/n),y+ry*math.sin(i*2*math.pi/n)) for i in range(n)]

def capsule(x0,y0,x1,y1,r,n=12):
  # obround interior hole described by length + radius
  dx=x1-x0;dy=y1-y0; theta=math.atan2(dy,dx);out=[]
  for i in range(n+1):
    a=theta-math.pi/2+i*math.pi/n
    out.append((x1+r*math.cos(a),y1+r*math.sin(a)))
  for i in range(n+1):
    a=theta+math.pi/2+i*math.pi/n
    out.append((x0+r*math.cos(a),y0+r*math.sin(a)))
  return out

def stripe(name,pts,thick,mat,z,depth=.009):
 shape=LineString([P(*p) for p in pts]).buffer(thick/100,cap_style=1,join_style=1,resolution=4)
 extrude_polygon(name,shape,depth,mat,z)

def cylinder_between(name,pa,pb,rad,mat,sections=28,rs=None):
 a=np.array(pa,float);b=np.array(pb,float);diff=b-a
 if np.linalg.norm(diff)<1e-6:return
 m=trimesh.creation.cylinder(radius=rad,height=np.linalg.norm(diff),sections=sections)
 rot=trimesh.geometry.align_vectors([0,0,1],diff)
 m.apply_transform(rot)
 if rs:
  # not currently used
  pass
 m.apply_translation((a+b)/2)
 add(name,m,mat)

def cx(name,x0,x1,y,z,r,mat,sections=32):
 cylinder_between(name,Q(x0,y,z),Q(x1,y,z),r/100,mat,sections=sections)

def cz(name,x,y,z0,z1,r,mat,sections=20):
 cylinder_between(name,Q(x,y,z0),Q(x,y,z1),r/100,mat,sections=sections)

def cy(name,x,y0,y1,z,r,mat,sections=20):
 cylinder_between(name,Q(x,y0,z),Q(x,y1,z),r/100,mat,sections=sections)

def lathe_x(name,profile,y,z,mat,steps=48):
 # profile is list (x pixel, radius pixel), arbitrary 2D silhouette, with planar caps
 verts=[];faces=[]
 for x,r in profile:
  for j in range(steps):
   t=2*math.pi*j/steps
   verts.append([P(x,y)[0],P(x,y)[1]+r*math.cos(t)/100,z+r*math.sin(t)/100])
 for i in range(len(profile)-1):
  for j in range(steps):
   a=i*steps+j;b=i*steps+(j+1)%steps;c=(i+1)*steps+(j+1)%steps;d=(i+1)*steps+j
   faces.append([a,b,c]);faces.append([a,c,d])
 ia=len(verts);verts.append([P(profile[0][0],y)[0],P(profile[0][0],y)[1],z]);ib=len(verts);verts.append([P(profile[-1][0],y)[0],P(profile[-1][0],y)[1],z]);
 for j in range(steps):
  faces.append([ia,(j+1)%steps,j]);faces.append([ib,(len(profile)-1)*steps+j,(len(profile)-1)*steps+(j+1)%steps]);
 m=trimesh.Trimesh(vertices=verts,faces=faces,process=True);m.fix_normals();add(name,m,mat)

def screw(name,x,y,z=0.18,r=4):
 cz(name+'_head',x,y,z,z+.008,r,'screws',12)
 cz(name+'_core',x,y,z+.009,z+.011,max(1,r*.43),'steel',10)
 stripe(name+'_slot',[(x-r*.39,y),(x+r*.39,y)],.42,'shadow_slots',z+.013,.003)

# MAIN SHELLS, as separate authoring collections/named objects.
# Fore-end: long low stock with three genuine vent windows.
fore=[(386,314),(624,313),(648,324),(675,347),(704,367),(689,385),(646,398),(384,374)]
vents=[capsule(450,348,478,348,4.3),capsule(515,348,536,348,4.2),capsule(564,348,583,348,4.1)]
poly2('F01_FOREND_olive_shell',fore,.255,'olive',holes=vents,z=0)
poly2('F02_FOREND_lower_rib',[(385,359),(639,361),(673,378),(647,396),(395,377)],.285,'olive_light',holes=[capsule(450,348,478,348,4.3),capsule(515,348,536,348,4.2),capsule(564,348,583,348,4.1)],z=-.004)
poly2('F03_FOREND_front_bezel',[(384,314),(406,312),(413,321),(411,374),(386,372)],.285,'mid_olive',z=.002)
poly2('F04_FOREND_top_rail',[(387,313),(651,308),(654,316),(387,322)],.270,'receiver_black',z=.012)
# receiver central upper/body
poly2('R01_RECEIVER_main',[(635,292),(854,289),(895,295),(898,325),(936,336),(938,380),(899,403),(830,407),(791,388),(757,371),(703,374),(654,350),(635,334)],.345,'receiver_black',z=0)
poly2('R02_RECEIVER_side_olive',[(645,317),(809,317),(839,330),(865,350),(863,390),(823,401),(759,382),(738,368),(698,368),(666,354),(646,345)],.352,'olive_light',z=.011)
poly2('R03_RECEIVER_step_top',[(652,287),(891,286),(900,300),(657,303)],.324,'receiver_edge',z=0)
poly2('R04_RECEIVER_bolt_panel',[(757,303),(840,302),(864,314),(864,337),(846,351),(794,347),(767,331)],.365,'receiver_black',z=.01)
poly2('R05_RECEIVER_side_lower_contour',[(646,356),(744,356),(768,380),(820,391),(841,404),(816,410),(785,402),(756,386),(728,378),(677,376)],.370,'dark_olive',z=0)
# buttstock with actual thumbhole cut-through
stock=[(875,323),(940,321),(959,332),(1027,330),(1190,319),(1198,339),(1189,476),(1166,476),(1124,470),(1085,467),(1051,479),(995,488),(936,497),(905,489),(899,462),(898,433),(884,417),(877,387)]
thumb=ellipse(971,405,39,35,56)
poly2('S01_STOCK_thumbhole_shell',stock,.36,'olive',holes=[thumb],z=0,round_px=10)
# cosmetic rear upper rail + lower molded accent
poly2('S02_STOCK_upper_slab',[(1017,317),(1181,312),(1191,327),(1186,347),(1023,344)],.384,'olive_light',z=.0)
poly2('S03_STOCK_lower_panel',[(1020,452),(1081,451),(1110,445),(1165,444),(1174,467),(1124,467),(1081,463),(1041,480),(993,489)],.375,'dark_olive',z=.006)
# Real reference has a mostly uninterrupted olive side; preserve that quiet silhouette.
stripe('S04_STOCK_fine_mold_seam',[(1075,348),(1180,345),(1181,451),(1140,453)],.55,'olive_recess',.205,.005)
stripe('S05_STOCK_lower_mold_seam',[(1042,467),(1094,454),(1171,453)],.65,'mid_olive',.205,.005)
poly2('S06_STOCK_visor',[(1028,315),(1161,312),(1178,320),(1175,334),(1024,334)],.379,'dark_olive',z=.0)
poly2('S07_STOCK_buttpad',[(1189,316),(1231,314),(1251,322),(1247,476),(1203,481),(1188,469)],.409,'rubber',z=.002)
poly2('S08_STOCK_buttpad_edge',[(1190,316),(1202,314),(1213,319),(1213,475),(1199,474),(1191,462)],.418,'receiver_black',z=.0)
# pronounced thumbhole lip as shallow inset ring, no closed hole
stocklip=ellipse(971,405,44,40,56);holip=ellipse(971,405,39,35,56)
poly2('S09_STOCK_thumbhole_rim',stocklip,.008,'mid_olive',holes=[holip],z=.194)
poly2('S10_STOCK_cheek_riser',[(1037,313),(1049,306),(1147,308),(1161,314),(1154,331),(1035,334)],.421,'dark_olive',z=.007)
poly2('S11_STOCK_cheek_pad',[(1045,310),(1148,310),(1159,318),(1149,324),(1038,324)],.428,'rubber',z=.007)
# Grip and trigger guard are distinct geometry (not functional).
poly2('G01_GRIP_underbody',[(875,397),(911,395),(930,432),(968,489),(916,500),(904,485),(905,452),(895,422)],.397,'grip_poly',z=.004,round_px=3)
poly2('G02_GRIP_raised_lip',[(903,416),(923,424),(952,480),(936,493),(914,488),(911,459)],.406,'rubber',z=.005)
# true trigger guard hollow oval ring
outer=[(816,370),(883,369),(891,392),(882,416),(835,419),(812,408),(805,383)]
hole=[(825,378),(871,378),(877,388),(873,404),(862,411),(833,410),(823,402)]
poly2('G03_TRIGGER_guard_ring',outer,.039,'receiver_black',holes=[hole],z=.205)
stripe('G04_TRIGGER_silhouette',[(858,381),(858,401),(850,407)],2,'steel',.223,.016)
# Box magazine (visual shell only)
poly2('M01_MAGAZINE_profile',[(700,392),(769,391),(775,449),(792,458),(790,466),(669,453),(668,445),(699,443)],.243,'receiver_black',z=.0)
poly2('M02_MAGAZINE_front_face',[(705,399),(767,398),(773,452),(696,448)],.259,'dark_olive',z=.009)
poly2('M03_MAGAZINE_baseplate',[(667,444),(794,458),(795,463),(668,452)],.270,'receiver_edge',z=.018)
for i,xx in enumerate((712,730,747,763)):
 stripe(f'M04_MAGAZINE_striation_{i}',[(xx,402),(xx+2,444)],.7,'shadow_slots',.143,.006)
# Long floating front tube, decorative cylindrical front detail (no operative internals)
cx('B01_BARREL_steel_tube',129,650,302,0,.105*100,'barrel_black',44)
cx('B02_BARREL_socket_step',615,653,302,0,12.1,'receiver_edge',36)
cx('B03_BARREL_socket_band',628,648,302,0,10.8,'steel',36)
cx('B04_BARREL_linear_highlight',147,610,299,0,2.4,'barrel_highlight',20)
# Front open-tip shroud with recessed vent shapes on each visible side
lathe_x('B05_MUZZLE_shroud',[(28,13.8),(32,15.2),(112,15.5),(129,14.5),(131,10.1)],303,0,'barrel_black',56)
for i,x in enumerate([43,58,75,90]):
 poly2(f'B06_MUZZLE_vent_recess_{i}',ellipse(x,302,5.5,10.5,20),.007,'shadow_slots',z=.160)
for x in [30,129]:cx(f'B07_MUZZLE_band_{x}',x,x+3,303,0,15.3,'receiver_edge',48)
# Upper fore-end open vents shallow dark surrounds
for i,(x0,x1) in enumerate([(430,460),(481,512),(533,560),(582,610)]):
 poly2(f'F05_FOREND_inset_slot_{i}',capsule(x0,347,x1,347,3.1),.004,'shadow_slots',z=.149)
# Lower outside panel / slopes and angular emboss
stripe('F06_FOREND_lower_seam',[(393,367),(625,367),(654,387)],.7,'olive_recess',.160,.006)
stripe('F07_FOREND_diagnostic_inlay',[(657,334),(699,369),(760,386)],.75,'olive_recess',.171,.005)
# receiver ejection cover artistic side contour, deliberately not mechanism
stripe('R06_RECEIVER_upper_line',[(659,294),(881,294)],.8,'steel',.182,.006)
stripe('R07_RECEIVER_side_step',[(765,319),(830,319),(839,346)],1.0,'olive_recess',.187,.008)
for i,(x,y) in enumerate([(442,345),(620,348),(815,351),(927,352),(1039,356),(1111,354),(1128,354),(1161,458),(1057,458),(780,394),(618,317),(1180,362)]):
 screw(f'D01_FASTENER_{i:02}',x,y,z=.214 if x>780 else .175,r=3 if i%3 else 4)
# cheek rest grooves, rear plate seams
stripe('S12_BUTTPAD_ribline',[(1215,331),(1215,462)],1,'receiver_edge',.213,.006)
for i,x in enumerate((1221,1229,1237,1244)):
 stripe(f'S13_BUTTPAD_molding_{i}',[(x,325),(x,471)],.48,'receiver_black',.218,.004)
# Fore-end trim slot facets near tip
for i,(x,y) in enumerate([(403,332),(411,353),(413,367)]):
 poly2(f'F08_FRONT_mould_recess_{i}',capsule(x,y,x+17,y,2.6),.005,'shadow_slots',z=.151)
# Scope rail / cosmetic mounts
poly2('O01_SCOPE_rail_mount',[(654,281),(853,282),(858,296),(654,300)],.185,'rail_black',z=0)
for i,x in enumerate(range(666,847,18)):
 box(f'O02_RAIL_tooth_{i}',(x,284),9,4,.19,'receiver_edge',z=.005)
for i,x in enumerate((696,799)):
 poly2(f'O03_SCOPE_ring_foot_{i}',[(x-13,270),(x+13,270),(x+17,292),(x-17,292)],.207,'scope_edge',z=0)
 cz(f'O04_SCOPE_ring_bolt_{i}',x,280,.105,.129,3,'screws')
# Scope optical silhouette: tapered objective, slender main barrel and rear ocular
lathe_x('O05_OPTIC_front_objective',[(544,33.5),(551,33.8),(568,33.2),(600,33.0),(660,21.5),(672,20.3)],241,0,'scope_black',56)
lathe_x('O06_OPTIC_center_tube',[(670,18.0),(834,18.5)],241,0,'scope_black',40)
lathe_x('O07_OPTIC_rear_eyepiece',[(834,19.4),(842,24),(948,24),(955,22.6)],241,0,'scope_black',48)
# Optic lens (visual dark glass surfaces)
cx('O08_OPTIC_front_glass',542,544,241,0,30,'optic_lens',48)
cx('O09_OPTIC_rear_glass',953,955,241,0,20,'optic_lens',48)
for i,(x0,x1,r) in enumerate([(546,553,34),(669,678,20),(837,845,23),(944,953,24)]):
 cx(f'O10_OPTIC_rim_{i}',x0,x1,241,0,r,'scope_edge',48)
for i,x in enumerate(range(846,945,10)):
 cx(f'O11_OPTIC_rear_gripring_{i}',x,x+1,241,0,24.7,'scope_edge',48)
# vertical adjustment cap + side turret (cosmetic)
cy('O12_OPTIC_top_turret',751,213,193,0,14,'scope_edge',28)
cy('O13_OPTIC_top_dial',751,194,190,0,18,'scope_black',32)
for i,x in enumerate((737,741,745,749,753,757,761)):
 box(f'O14_OPTIC_dial_serration_{i}',(x,192),2,4,.05,'receiver_edge',z=0)
cz('O15_OPTIC_side_turret',752,239,.145,.285,26,'scope_black',36)
cz('O16_OPTIC_side_turret_center',752,239,.286,.292,13,'scope_edge',32)
cz('O17_OPTIC_side_turret_badge',752,239,.294,.296,7,'steel',24)
for i,x in enumerate((699,801)):
 poly2(f'O18_OPTIC_mount_band_{i}',[(x-11,222),(x+9,222),(x+9,261),(x-11,261)],.190,'scope_edge',z=.003)
 for k,y in enumerate((231,254)):
  screw(f'O19_OPTIC_mount_screw_{i}_{k}',x+1,y,z=.109,r=2.3)
# inert bolt-handle visual near receiver
stripe('R08_BOLT_diagonal_visual',[(812,309),(846,355)],5,'receiver_black',.218,.042)
cz('R09_BOLT_handle_knob',848,356,.239,.279,8.8,'receiver_edge',20)
# rear folding foot/bipod art
poly2('S14_REAR_support_leg',[(1122,477),(1137,474),(1144,501),(1120,506)],.073,'receiver_black',z=0)
poly2('S15_REAR_support_foot',[(1110,507),(1164,510),(1186,516),(1184,526),(1109,525)],.115,'rubber',z=0)
poly2('S16_REAR_support_brace',[(1138,484),(1175,488),(1181,503),(1155,511),(1132,503)],.064,'receiver_edge',z=.005)
for i,x in enumerate((1130,1167)):
 screw(f'S17_SUPPORT_pin_{i}',x,496,.073,r=3.7)
# Cosmetic grip rough stippling and receiver diagonal scoring, subtle
for row in range(17):
 for col in range(5):
  x=914+col*4+(.9 if row%2 else 0);y=431+row*3
  if x>923+(y-431)*.25:continue
  cz(f'G05_GRIP_grain_{row}_{col}',x,y,.216,.217,0.45,'olive_recess',8)
for i,y in enumerate((342,348,354,360)):
 stripe(f'S18_STOCK_top_join_line_{i}',[(1160,y),(1179,y)],.36,'olive_recess',.222,.004)

# AWP-01 v0.3 reference-driven EXTERIOR ART ONLY: non-operational forms.
# Slightly raised cheek rest supports, decorative ventilation rims and sculpted seams.
poly2('V02_CHEEK_upper_facet',[(1041,303),(1053,298),(1144,299),(1163,307),(1158,319),(1042,319)],.390,'olive_light',z=0.005,round_px=3)
for i,x in enumerate([1060,1125]):
 poly2(f'V02_CHEEK_riser_shoulder_{i}',[(x-7,317),(x+8,315),(x+6,332),(x-5,333)],.220,'receiver_edge',z=.020)
 cz(f'V02_CHEEK_pin_{i}',x,322,.14,.157,2.9,'screws')
# Inset front vent rims give real depth around the sculpted holes.
for i,(x0,x1) in enumerate([(449,479),(515,537),(563,584)]):
 stripe(f'V02_FOREND_vent_lip_top_{i}',[(x0,340),(x1,340)],.76,'mid_olive',.153,.006)
 stripe(f'V02_FOREND_vent_lip_low_{i}',[(x0,354),(x1,354)],.55,'olive_recess',.155,.006)
# Decorative linear milling accents along the floating front tube.
for i,y in enumerate([299.4,304.4]):
 stripe(f'V02_BARREL_shallow_flute_{i}',[(211,y),(363,y)],.64,'receiver_edge',.107,.002)
# Fine body-panel transitions. Deliberately not real internals or moving assemblies.
poly2('V02_RECEIVER_side_chamfer',[(659,311),(815,310),(832,321),(825,331),(739,330),(691,323)],.011,'dark_olive',z=.192)
stripe('V02_RECEIVER_lower_engraved_seam',[(713,366),(750,372),(783,394),(817,399)],.47,'receiver_edge',.215,.004)
stripe('V02_STOCK_cheek_to_grip_curve',[(1021,347),(997,370),(1008,400)],.57,'olive_recess',.216,.004)
for i,(x,y) in enumerate([(679,320),(735,319),(793,319),(861,309),(902,343),(1137,363),(1054,476)]):
 screw(f'V02_RECEIVER_hardware_{i:02}',x,y,z=.220,r=2.6)
# Additional optic exterior detailing, separate editable geometry for a studio-grade look.
for i,x in enumerate((549,555,562,932,938)):
 cx(f'V02_SCOPE_retaining_lip_{i}',x,x+.8,241,0,33 if x<600 else 24.2,'scope_edge',56)
for k,ang in enumerate(range(0,360,36)):
 a=math.radians(ang);xx=751+17*math.cos(a);zz=.31+.015*math.sin(a)
 cz(f'V02_SCOPE_dial_facet_{k}',xx,239,zz,zz+.004,1.2,'receiver_edge',12)
# Stylized nonfunctional game-prop stand: solid visual silhouette, no working hinges.
poly2('V03_BIPOD_upper_collar',[(421,362),(458,361),(469,374),(449,390),(428,386)],.210,'receiver_edge',z=-.003,round_px=3)
for i,((sx,sy),(ex,ey),z) in enumerate([((433,377),(408,503),-.095),((452,379),(494,503),.090)]):
 cylinder_between(f'V03_BIPOD_large_leg_{i}',Q(sx,sy,z),Q(ex,ey,z),.066,'receiver_black',24)
 cylinder_between(f'V03_BIPOD_inner_leg_{i}',Q(sx+2,sy+40,z),Q(ex,ey-8,z),.042,'steel',20)
 cylinder_between(f'V03_BIPOD_foot_{i}',Q(ex-9,ey,z),Q(ex+9,ey,z),.054,'rubber',20)
 cz(f'V03_BIPOD_joint_{i}',sx,sy,z-.045,z+.045,4.5,'steel',20)
# Braced upper panels and molded button details are decorative only.
# Small decorative end cap accent.
poly2('V02_REAR_buttpad_end_cap',[(1238,330),(1246,331),(1242,464),(1238,466)],.410,'rubber',z=0,round_px=1)


# v0.3 ART REBUILD — reference-matched outer silhouette and strong depth hierarchy.
# These elements deliberately avoid working internals; all details are cosmetic only.
# Fore-end shell: pronounced layered upper/lower faces and visibly open inset vents.
poly2('V03_FOREND_outer_face',[(390,321),(620,319),(646,333),(663,354),(654,363),(634,367),(390,361)],.292,'olive',
      holes=[capsule(448,347,484,347,5.0),capsule(510,347,548,347,4.9),capsule(564,347,597,347,4.8)],z=.008,round_px=6)
poly2('V03_FOREND_side_bevel',[(398,317),(621,316),(636,327),(409,330)],.014,'olive_light',z=.17,round_px=2)
poly2('V03_FOREND_lower_bevel',[(401,366),(631,371),(643,384),(615,381),(398,374)],.014,'dark_olive',z=.18)
# Near-edge vent inner shade makes cutouts read as depth rather than black paint.
for i,(x0,x1) in enumerate([(445,486),(507,550),(560,599)]):
 stripe(f'V03_FOREND_vent_top_{i}',[(x0,337),(x1,337)],1.1,'receiver_edge',.174,.013)
 stripe(f'V03_FOREND_vent_bottom_{i}',[(x0,357),(x1,357)],1.1,'olive_recess',.174,.009)
# Receiver in three separate overlapping sculpted surfaces, not a rectangular face.
poly2('V03_RECEIVER_front_beveled_cheek',[(635,300),(729,299),(755,307),(777,323),(776,342),(741,358),(668,353),(642,339)],.016,'receiver_edge',z=.202,round_px=5)
poly2('V03_RECEIVER_large_outer_chassis',[(650,329),(756,320),(808,340),(840,365),(821,395),(782,391),(752,369),(694,361)],.024,'olive_light',z=.219,round_px=6)
poly2('V03_RECEIVER_grip_bridge',[(808,355),(843,353),(879,363),(888,392),(877,412),(840,413),(823,395)],.034,'mid_olive',z=.225,round_px=5)
poly2('V03_RECEIVER_milled_side_window',[(790,303),(857,302),(869,309),(865,327),(800,329),(790,321)],.019,'shadow_slots',z=.220,round_px=4)
poly2('V03_RECEIVER_milled_side_rim',[(789,302),(858,300),(870,309),(866,328),(798,330),(789,321)],.006,'steel',
      holes=[[(795,305),(856,304),(864,311),(860,324),(801,325),(795,319)]],z=.229)
# Receiver large sculpted face boundaries and prominent panel-bolt clusters.
stripe('V03_RECEIVER_strong_top_line',[(662,314),(771,312),(788,331)],1.2,'dark_olive',.245,.008)
stripe('V03_RECEIVER_strong_lower_line',[(662,349),(722,352),(767,376),(819,393)],1.25,'olive_recess',.242,.008)
for i,(x,y) in enumerate([(647,325),(677,339),(761,328),(829,342),(827,384),(778,368)]):
 screw(f'V03_RECEIVER_hero_fastener_{i}',x,y,z=.244,r=3.9)
# Stock: remove flat block impression with long sculpted diagonal seams and curved contoured pads.
poly2('V03_STOCK_contour_top',[(896,329),(961,321),(1018,326),(1162,325),(1173,342),(1020,342),(982,355),(935,350),(906,344)],.012,'olive_light',z=.231,round_px=4)
poly2('V03_STOCK_lower_ergonomic_scoop',[(1009,454),(1063,447),(1124,442),(1177,437),(1175,458),(1121,461),(1083,466),(1048,483),(1014,483)],.018,'dark_olive',z=.233,round_px=4)
poly2('V03_STOCK_rear_faceted_panel',[(1059,349),(1168,344),(1173,429),(1126,436),(1065,423)],.015,'olive_light',z=.228,round_px=5)
poly2('V03_STOCK_diagonal_front_neck',[(888,350),(914,346),(927,371),(926,424),(908,439),(894,400)],.017,'mid_olive',z=.228,round_px=4)
# A true open thumbhole is retained; this shallow rim adds curvature and readable depth.
poly2('V03_STOCK_thumbhole_highlight',ellipse(971,405,47,43,56),.007,'olive_light',holes=[ellipse(971,405,41,37,56)],z=.244)
# Cheek riser supports and raised rest, clearly visible in side profile.
poly2('V03_CHEEK_primary_cushion',[(1030,299),(1040,292),(1160,293),(1171,300),(1166,313),(1035,314)],.30,'rubber',z=.02,round_px=5)
for i,x in enumerate([1065,1128]):
 poly2(f'V03_CHEEK_support_tower_{i}',[(x-6,311),(x+8,311),(x+8,333),(x-7,333)],.105,'receiver_black',z=.09,round_px=2)
 cz(f'V03_CHEEK_screw_{i}',x,319,.145,.165,4,'steel',20)
for i in range(6):
 stripe(f'V03_CHEEK_pad_fine_seam_{i}',[(1045+i*19,300),(1044+i*19,309)],.58,'scope_edge',.18,.004)
# Grip overlay follows molded hand area, rather than rectangular crosshatch decals.
poly2('V03_GRIP_contoured_elbow',[(895,420),(912,420),(923,440),(936,473),(930,496),(908,491),(901,464)],.014,'grip_poly',z=.244,round_px=7)
for i in range(9):
 stripe(f'V03_GRIP_molded_ridge_{i}',[(907,444+i*5),(922,439+i*5)],.7,'dark_olive',.254,.005)
# Scope receives distinct textured housing rings and wider optic mounting feet.
for i,x in enumerate([686,702,790,805]):
 cx(f'V03_SCOPE_mount_outer_band_{i}',x,x+4,241,0,20.6,'scope_edge',48)
for i,x in enumerate(range(846,947,7)):
 cx(f'V03_SCOPE_rubber_eyecup_ring_{i}',x,x+.72,241,0,25.2,'rubber',44)
for i,x in enumerate([557,562,567,929,936,944]):
 cx(f'V03_SCOPE_highlight_rim_{i}',x,x+.5,241,0,35 if x<600 else 24.7,'steel',48)
# Exterior pin marks only; no bolt functionality.
cz('V03_RECEIVER_visual_control_big',846,345,.240,.282,7,'receiver_edge',24)
cz('V03_RECEIVER_visual_control_cap',846,345,.284,.286,3,'steel',18)
# Thick rounded heel edge catches realistic reflections in the reference.
poly2('V03_STOCK_rear_heel',[(1203,325),(1239,325),(1245,337),(1240,463),(1207,476),(1202,457)],.427,'rubber',z=.016,round_px=8)

# labels on the visible side, alpha texture planes with UVs
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
try:font=ImageFont.truetype(fontpath,46); smallfont=ImageFont.truetype(fontpath,24)
except OSError:font=ImageFont.load_default();smallfont=ImageFont.load_default()

def label(name,text,x,y,w,h,z=.23,size='normal',alpha=230):
 im=Image.new('RGBA',(768,128),(0,0,0,0));d=ImageDraw.Draw(im)
 f=smallfont if size=='small' else font
 d.text((18,19),text,font=f,fill=(230,232,225,alpha))
 # place quad in XY so side labels face +Z
 (x0,y0),(x1,y1)=P(x,y),P(x+w,y+h)
 verts=np.array([[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]])
 faces=[[0,1,2],[0,2,3]]
 m=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
 mat=PBRMaterial(name=name+'_decal',baseColorTexture=im,metallicFactor=0,roughnessFactor=.95,alphaMode='BLEND',doubleSided=True)
 uv=np.array([[0,1],[1,1],[1,0],[0,0]],float)
 m.visual=TextureVisuals(uv=uv,material=mat)
 scene.add_geometry(m,geom_name=name,node_name=name)
 parts.append({'name':name,'material':'decal','triangles':2})
label('D02_RECEIVER_branding','ACCURACY',718,331,94,17,z=.217,size='small',alpha=225)
label('D03_RECEIVER_lower_brand','INTERNATIONAL',718,347,108,14,z=.218,size='small',alpha=180)
label('D04_SCOPE_front_brand','LEUPOLD',564,237,60,11,z=.34,size='small',alpha=205)
label('D05_SCOPE_rear_brand','LEUPOLD',873,238,67,12,z=.25,size='small',alpha=205)
label('D06_BUTTPAD_foot_brand','AWP',1208,454,36,15,z=.219,size='small',alpha=208)
# small optical crest white circle, stylized icon on turret
cz('D07_SCOPE_center_logo',751,239,.297,.300,4,'receiver_edge',24)
# Write structured glb and inventory.
out=ROOT/'CROSSFIRE_AWP_ReferenceInspired_v03.glb'
scene.export(out)
(rootmeta:=ROOT/'MODEL_INFO.json').write_text(json.dumps({
 'model':'CROSSFIRE_AWP_ReferenceInspired_v03',
 'source_image':str(IMG_REF.name),
 'type':'Nonfunctional digital FPS game-art prop. Not a working mechanical reproduction.',
 'geometry':{'meshes':len(parts),'triangles':sum(x['triangles'] for x in parts)},
 'materials':list(palette),'dimensions':'Arbitrary artistic units based on image pixel proportions',
 'notes':'v0.3 major silhouette rework based on the visible external features; mechanical systems not modeled.',
 'parts':parts
},indent=2))
print(out,out.stat().st_size,'meshes',len(parts),'faces',sum(x['triangles'] for x in parts))