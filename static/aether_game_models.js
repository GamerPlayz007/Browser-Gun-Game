/**
 * CROSSFire / AETHER collection in-game visual integration.
 * Pure Three.js render geometry, reused from the approved 3D showrooms.
 * ID 0 AETHER-9, 1 AETHER-S9, 2 AETHER-12, 3 AETHER-L7.
 * No network calls, physics, collision, damage, projectiles or weapon controls.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const FINISHES=[
 {shell:0x303d47,plate:0x465961,poly:0x1e2a31,trim:0x9caeb4,glow:0x37dfff,accent:0xf5a65a},
 {shell:0x8a9ca3,plate:0xc0c8c9,poly:0x4f606b,trim:0xf1ece2,glow:0x5af3ed,accent:0xe9bc6c},
 {shell:0x24252d,plate:0x483d51,poly:0x171921,trim:0xaaa0ba,glow:0xb579ff,accent:0xff7468}
];
export const AETHER_FINISH_NAMES=['ONYX','TITANIUM','OBSIDIAN'];
const FINISH_KEYS=['shell','plate','poly','trim','glow','accent'];
const muzzles=[
 {y:.205,z:-1.186},{y:.205,z:-.77},{y:.211,z:-1.08},{y:.225,z:-1.694}
];
const MAG_GROUPS=['aether-energy-mag','aether-energy-mag',null,'longwatch-lower-battery'];
// Collect and merge the vast majority of surface meshes by material.
// This preserves the geometry of the showrooms while keeping browser draw calls low.
function batchStaticMeshes(gun){
 gun.updateMatrixWorld(true);
 const inverse=new T.Matrix4().copy(gun.matrixWorld).invert();
 const buckets=new Map(),instBuckets=new Map(),staticMeshes=[];
 const instanceMatrix=new T.Matrix4(),relative=new T.Matrix4();
 gun.traverse(o=>{
  if(!o.isMesh)return;
  if(o.isInstancedMesh){
   const key=o.material.uuid+'|'+(o.userData.detailTier67??0);
   if(!instBuckets.has(key))instBuckets.set(key,{material:o.material,tier:o.userData.detailTier67??0,transforms:[],members:[]});
   const bucket=instBuckets.get(key);
   relative.copy(inverse).multiply(o.matrixWorld);
   for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,instanceMatrix);
    bucket.transforms.push(new T.Matrix4().copy(relative).multiply(instanceMatrix));
   }
   bucket.members.push(o);
   return;
  }
  // Keep transparent lens elements and image decals unbatched for proper sorting.
  if(o.material.transparent||o.material.depthWrite===false)return;
  const geometry=o.geometry;
  const attrs=Object.keys(geometry.attributes).sort().map(name=>{
   const a=geometry.attributes[name];return name+':'+a.itemSize+':'+(a.normalized?'1':'0');
  }).join(';');
  const key=o.material.uuid+'|'+(geometry.index?'i':'n')+'|'+attrs;
  if(!buckets.has(key))buckets.set(key,{material:o.material,parts:[],members:[]});
  const bucket=buckets.get(key);
  const baked=geometry.clone();
  relative.copy(inverse).multiply(o.matrixWorld);
  baked.applyMatrix4(relative);
  bucket.parts.push(baked);bucket.members.push(o);
 });
 let batches=0;
 for(const bucket of buckets.values()){
  if(bucket.parts.length<=1){for(const g of bucket.parts)g.dispose();continue;}
  const geo=mergeGeometries(bucket.parts,false);
  for(const part of bucket.parts)part.dispose();
  if(!geo)continue;
  const merged=new T.Mesh(geo,bucket.material);
  merged.castShadow=true;merged.receiveShadow=true;
  merged.userData.collidable=false;
  for(const old of bucket.members){old.removeFromParent();old.geometry.dispose();}
  gun.add(merged);batches++;
 }
 for(const bucket of instBuckets.values()){
  if(bucket.members.length<=1)continue;
  const g=new T.BoxGeometry(1,1,1);
  const merged=new T.InstancedMesh(g,bucket.material,bucket.transforms.length);
  for(let i=0;i<bucket.transforms.length;i++)merged.setMatrixAt(i,bucket.transforms[i]);
  merged.instanceMatrix.needsUpdate=true;merged.castShadow=true;
  merged.userData.detailTier67=bucket.tier;
  merged.userData.collidable=false;
  for(const old of bucket.members){old.removeFromParent();old.geometry.dispose();}
  gun.add(merged);batches++;
 }
 return batches;
}
export function buildAetherGameVisuals(model,magazine,id,initialFinish=0){
 const weaponId=Math.max(0,Math.min(3,Math.trunc(Number(id)||0)));
 const gun=new T.Group();
 gun.name='aether-game-prop';
 gun.position.set(0,-.31,0);
 gun.scale.setScalar(.80);
 model.add(gun);
 const elements={};let geometryCount=0;
 const mat={
 shell:new T.MeshStandardMaterial({color:0x303d47,roughness:.46,metalness:.64}),
 plate:new T.MeshStandardMaterial({color:0x465961,roughness:.35,metalness:.61}),
 poly:new T.MeshStandardMaterial({color:0x1e2a31,roughness:.79,metalness:.15}),
 trim:new T.MeshStandardMaterial({color:0x9caeb4,roughness:.25,metalness:.80}),
 glow:new T.MeshStandardMaterial({color:0x37dfff,emissive:0x37dfff,emissiveIntensity:1.55,roughness:.24,metalness:.25}),
 accent:new T.MeshStandardMaterial({color:0xf5a65a,emissive:0xf5a65a,emissiveIntensity:.24,roughness:.34,metalness:.52}),
 steel:new T.MeshStandardMaterial({color:0x111b23,roughness:.35,metalness:.85}),
 recess:new T.MeshStandardMaterial({color:0x091218,roughness:.86,metalness:.18}),
 rubber:new T.MeshStandardMaterial({color:0x111b22,roughness:.93,metalness:.05}),
 lens:new T.MeshBasicMaterial({color:0x5feeff,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false})
 };
 const labelNames=['AETHER-9','AETHER-S9','AETHER-12','AETHER-L7'];
 const labelMaterial=makeLabelOnce(labelNames[weaponId]);
 // Keep helpers and all four exact showroom builder functions in this scope.
 function makeLabelOnce(name){return makeLabel(name,'CF / '+(['GHOST CIRCUIT','GHOST CIRCUIT','WARDRUM','LONGWATCH'][weaponId]));}
function node(name,parent=gun){const g=new T.Group();g.name=name;parent.add(g);elements[name]=g;return g;}
function add(parent,mesh,x=0,y=0,z=0){
 mesh.position.set(x,y,z);parent.add(mesh);
 if(mesh.isMesh&&!mesh.material?.transparent){mesh.castShadow=true;mesh.receiveShadow=true;}
 geometryCount++;return mesh;
}
function slab(p,w,h,d,m,x,y,z,r=.008){
 const geo=r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d);
 return add(p,new T.Mesh(geo,mat[m]),x,y,z);
}
function tube(p,r,h,m,x,y,z,n=16){
 const mesh=add(p,new T.Mesh(new T.CylinderGeometry(r,r,h,n),mat[m]),x,y,z);
 mesh.rotation.x=Math.PI/2;return mesh;
}
function sidewaysTube(p,r,h,m,x,y,z,n=16){
 const mesh=add(p,new T.Mesh(new T.CylinderGeometry(r,r,h,n),mat[m]),x,y,z);
 mesh.rotation.z=Math.PI/2;return mesh;
}
function ellipse(p,r,t,m,x,y,z){
 return add(p,new T.Mesh(new T.TorusGeometry(r,t,7,24),mat[m]),x,y,z);
}
// Sculpted side silhouettes extruded across X: points use (forward Z, height Y).
function contour(p,points,width,m,x=0,y=0,z=0){
 const sh=new T.Shape();
 points.forEach(([zz,yy],i)=>i?sh.lineTo(-zz,yy):sh.moveTo(-zz,yy));
 sh.closePath();
 const geo=new T.ExtrudeGeometry(sh,{depth:width,steps:1,bevelEnabled:true,
  bevelThickness:.005,bevelSize:.005,bevelSegments:2});
 geo.translate(0,0,-width/2);
 geo.rotateY(Math.PI/2);
 return add(p,new T.Mesh(geo,mat[m]),x,y,z);
}
// Tiny repeated decorative marks rendered as one draw call per material.
function details(p,data,m){
 if(!data.length)return;
 const im=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat[m],data.length);
 const obj=new T.Object3D();
 for(let i=0;i<data.length;i++){
  const [x,y,z,w,h,d]=data[i];
  obj.position.set(x,y,z);obj.scale.set(w,h,d);obj.updateMatrix();
  im.setMatrixAt(i,obj.matrix);
 }
 im.instanceMatrix.needsUpdate=true;im.castShadow=true;
 im.userData.detailTier67=1;im.userData.collidable=false;
 p.add(im);geometryCount++;
}
// A bright line segment made from a thin 3D prism following a surface.
function tracer(p,side,points,m,thickness=.012){
 for(let i=0;i<points.length-1;i++){
  const [z1,y1]=points[i],[z2,y2]=points[i+1];
  const dz=z2-z1,dy=y2-y1;
  const len=Math.hypot(dz,dy);
  const seg=slab(p,.008,thickness,len,m,side,(y1+y2)/2,(z1+z2)/2,.002);
  seg.rotation.x=-Math.atan2(dy,dz);
 }
}
function makeLabel(line1,line2){
 const cv=document.createElement('canvas');cv.width=512;cv.height=128;
 const ctx=cv.getContext('2d');
 ctx.clearRect(0,0,512,128);
 ctx.font='bold 45px Arial';ctx.fillStyle='#e7f6fd';ctx.fillText(line1,12,52);
 ctx.font='25px Arial';ctx.fillStyle='#6ae7f5';ctx.fillText(line2,13,93);
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;
 return new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide,depthWrite:false});
}


function buildChassis(){
 const g=node('aether-chassis');
 // Angular armor shell, distinct upper and lower visual masses.
 contour(g,[[-.28,.053],[-.23,.245],[-.115,.310],[.115,.308],[.243,.20],
  [.235,.092],[.104,.031],[-.125,.015]],.211,'shell');
 contour(g,[[.087,.045],[.142,.163],[.249,.190],[.293,.131],[.258,.060]],.198,'poly');
 slab(g,.228,.057,.525,'steel',0,.274,-.027,.009);
 slab(g,.23,.047,.412,'plate',0,.292,.010,.012);
 for(const side of [-1,1]){
  contour(g,[[-.225,.07],[-.196,.246],[-.047,.265],[.113,.235],[.165,.122],
   [.085,.087]],.015,'plate',side*.115);
  slab(g,.016,.082,.174,'recess',side*.13,.197,-.077,.003);
  slab(g,.018,.019,.143,'accent',side*.139,.238,-.078,.004);
  slab(g,.012,.022,.132,'trim',side*.141,.110,.062,.003);
  const inset=slab(g,.009,.068,.069,'steel',side*.141,.156,.151,.003);
  const badge=add(g,new T.Mesh(new T.PlaneGeometry(.147,.036),labelMaterial),
   side*.142,.161,-.05);badge.rotation.y=side*Math.PI/2;
 }
 // Belly / trigger guard suggestion, strictly aesthetic.
 slab(g,.174,.031,.230,'poly',0,.036,.128,.007);
 const under=contour(g,[[.125,.049],[.238,.050],[.260,-.022],[.178,-.039]],.104,'steel');
 return g;
}
function buildSmartHandguard(){
 const g=node('aether-handguard');
 contour(g,[[-.82,.105],[-.78,.252],[-.675,.309],[-.266,.310],
  [-.221,.261],[-.247,.120],[-.72,.085]],.196,'shell');
 slab(g,.207,.038,.555,'plate',0,.293,-.515,.012);
 slab(g,.183,.021,.605,'steel',0,.345,-.496,.005);
 // Floating armor layers leave dark recessed channels.
 for(const side of [-1,1]){
  contour(g,[[-.748,.146],[-.724,.271],[-.308,.281],[-.284,.146]],
   .015,'plate',side*.109);
  const grooves=[];
  for(let i=0;i<7;i++)grooves.push([side*.123,.226,-.694+i*.057,.010,.021,.034]);
  details(g,grooves,'recess');
  slab(g,.012,.055,.418,'steel',side*.124,.129,-.514,.005);
  slab(g,.012,.017,.287,'glow',side*.134,.159,-.495,.003);
  tracer(g,side*.138,[[-.735,.198],[-.614,.195],[-.559,.173],
   [-.448,.173],[-.405,.191],[-.305,.191]],'accent',.012);
  tracer(g,side*.140,[[-.720,.272],[-.575,.273],[-.531,.245],
   [-.440,.245]],'glow',.009);
  // Forward chevron sculpt on both sides.
  slab(g,.022,.064,.07,'trim',side*.137,.226,-.736,.006);
 }
 return g;
}
function buildRail(){
 const g=node('aether-rail');
 slab(g,.129,.027,.795,'steel',0,.369,-.30,.005);
 const rack=[];
 for(let i=0;i<27;i++)rack.push([0,.387,-.692+i*.028,.128,.010,.012]);
 details(g,rack,'trim');
 slab(g,.126,.019,.190,'poly',0,.402,.158,.003);
 return g;
}
function buildBarrelArt(){
 const g=node('aether-front');
 tube(g,.032,.495,'steel',0,.205,-.93,18);
 tube(g,.044,.078,'shell',0,.205,-1.139,14);
 tube(g,.026,.020,'recess',0,.205,-1.185,14);
 ellipse(g,.032,.006,'accent',0,.205,-1.186);
 // Decorative soft-edge shroud, purely visual shape.
 slab(g,.072,.042,.104,'plate',0,.192,-1.084,.006);
 return g;
}
function buildStock(){
 const g=node('aether-stock');
 // Negative space between upper/lower stylized stock struts.
 tube(g,.046,.195,'steel',0,.209,.307,14);
 contour(g,[[.31,.155],[.345,.271],[.62,.298],[.735,.249],
  [.80,.187],[.79,.068],[.691,.046],[.606,.106],[.43,.123]],.092,'poly');
 contour(g,[[.38,.24],[.626,.267],[.718,.234],[.733,.198],
  [.622,.193],[.49,.212]],.107,'plate');
 slab(g,.15,.235,.067,'rubber',0,.164,.786,.017);
 for(const side of [-1,1]){
  tracer(g,side*.059,[[.41,.255],[.568,.255],[.684,.227]],'accent',.015);
  slab(g,.014,.047,.224,'glow',side*.060,.146,.545,.004);
 }
 // Unrealistic luminous technology capsule mounted inside the stock frame.
 sidewaysTube(g,.043,.145,'steel',0,.145,.376,18);
 sidewaysTube(g,.030,.085,'glow',0,.145,.376,18);
 return g;
}
function buildGrip(){
 const g=node('aether-grip');
 g.position.set(0,.05,.197);g.rotation.x=-.21;
 contour(g,[[-.05,.028],[.085,.038],[.126,-.223],
  [.055,-.269],[-.067,-.229]],.119,'poly');
 slab(g,.143,.029,.146,'steel',0,-.25,.020,.006);
 for(const side of [-1,1]){
  slab(g,.011,.173,.091,'shell',side*.062,-.118,.017,.007);
  const ribs=[];for(let i=0;i<7;i++)ribs.push([side*.070,-.223+i*.034,.020,.007,.010,.080]);
  details(g,ribs,'recess');
  slab(g,.006,.05,.056,'glow',side*.071,-.008,.030,.003);
 }
 return g;
}
function buildEnergyPack(){
 const g=node('aether-energy-mag');
 g.position.set(0,.048,-.055);g.rotation.x=.14;
 contour(g,[[-.095,.029],[.090,.022],[.120,-.335],
  [.066,-.414],[-.091,-.396]],.151,'steel');
 contour(g,[[-.071,-.036],[.070,-.036],[.103,-.315],
  [.052,-.359],[-.070,-.343]],.157,'poly');
 slab(g,.162,.031,.185,'shell',0,-.395,-.010,.008);
 for(const side of [-1,1]){
  slab(g,.009,.27,.042,'plate',side*.081,-.181,-.018,.004);
  slab(g,.010,.228,.026,'glow',side*.088,-.175,.035,.003);
  const lights=[];
  for(let i=0;i<7;i++)lights.push([side*.094,-.305+i*.038,.035,.013,.014,.030]);
  details(g,lights,'glow');
 }
 slab(g,.14,.018,.16,'accent',0,.025,-.002,.005);
 return g;
}
function buildHoloOptic(){
 const g=node('aether-holo-optic');
 g.position.set(0,.402,-.016);
 slab(g,.151,.061,.19,'steel',0,.008,0,.013);
 slab(g,.124,.043,.105,'plate',0,.052,.045,.008);
 for(const side of [-1,1]){
  contour(g,[[-.071,.07],[-.045,.212],[.044,.222],[.074,.088]],
   .018,'shell',side*.062);
  slab(g,.018,.072,.027,'accent',side*.077,.158,-.046,.008);
  slab(g,.014,.019,.018,'glow',side*.079,.085,.024,.003);
 }
 slab(g,.170,.035,.060,'steel',0,.224,-.023,.012);
 const glass=add(g,new T.Mesh(new T.PlaneGeometry(.115,.115),mat.lens),
  0,.159,-.028);
 const reticle=add(g,new T.Mesh(new T.RingGeometry(.012,.014,24),
  new T.MeshBasicMaterial({color:0xafffff,transparent:true,opacity:.88,
    side:T.DoubleSide,depthWrite:false})),0,.154,-.030);
 return g;
}
function buildAccessoryPod(){
 const g=node('aether-underslung-unit');
 // Fictional rectangular sensor block and sculpted support handle.
 slab(g,.121,.054,.200,'steel',0,.089,-.570,.015);
 slab(g,.102,.026,.133,'plate',0,.050,-.588,.008);
 slab(g,.100,.023,.140,'accent',0,.111,-.567,.005);
 tube(g,.031,.160,'poly',0,-.062,-.541,12);
 slab(g,.081,.037,.100,'rubber',0,-.141,-.541,.009);
 for(const side of [-1,1]){
  slab(g,.011,.034,.056,'glow',side*.064,.070,-.644,.003);
 }
 return g;
}
function buildDetailPass(){
 const g=node('aether-finish-details');
 const fasteners=[];
 for(const side of [-1,1]){
  for(const z of [-.22,-.03,.16])fasteners.push([side*.147,.118,z,.013,.013,.012]);
  for(let i=0;i<5;i++)fasteners.push([side*.125,.139,-.722+i*.104,.009,.015,.012]);
  // Signature luminous battery indicators and decorative rails.
  slab(g,.013,.076,.020,'glow',side*.153,.167,.217,.005);
  slab(g,.013,.014,.096,'accent',side*.145,.100,.068,.004);
  slab(g,.015,.015,.140,'trim',side*.140,.271,-.054,.003);
  const dots=[];for(let i=0;i<5;i++)dots.push([side*.150,.186,.207-i*.023,.010,.011,.012]);
  details(g,dots,'glow');
 }
 details(g,fasteners,'trim');
 return g;
}

function buildAether(){
 buildChassis();buildSmartHandguard();buildRail();buildBarrelArt();
 buildStock();buildGrip();buildEnergyPack();buildHoloOptic();
 buildAccessoryPod();buildDetailPass();
 gun.rotation.y=.06;
}

function buildCompactShell(){
 const g=node('s9-compact-side-armor');
 // Broad visual side panels distinguish this from the longer AR concept.
 for(const s of [-1,1]){
  contour(g,[[-.318,.135],[-.295,.265],[-.115,.293],
    [.075,.283],[.150,.202],[.098,.125]],.015,'plate',s*.143);
  slab(g,.015,.037,.135,'poly',s*.159,.245,-.18,.006);
  slab(g,.013,.011,.135,'glow',s*.167,.263,-.185,.003);
  slab(g,.012,.055,.091,'recess',s*.159,.153,-.04,.004);
  const ticks=[];
  for(let i=0;i<4;i++)ticks.push([s*.168,.192,-.062+i*.033,.012,.009,.012]);
  details(g,ticks,'accent');
  slab(g,.018,.065,.049,'trim',s*.149,.200,.115,.006);
 }
 return g;
}
function buildShortFrontAccent(){
 const g=node('s9-front-accents');
 // Futuristic illuminated cowling and a central sensor-like decorative eye.
 contour(g,[[-.660,.176],[-.624,.262],[-.508,.280],
   [-.420,.236],[-.447,.166]],.184,'shell');
 for(const s of [-1,1]){
  slab(g,.014,.020,.104,'glow',s*.102,.246,-.558,.005);
  slab(g,.020,.041,.063,'accent',s*.106,.199,-.618,.006);
 }
 tube(g,.035,.069,'steel',0,.205,-.734,16);
 ellipse(g,.034,.008,'glow',0,.205,-.772);
 return g;
}
function buildCompactStockAccent(){
 const g=node('s9-stock-end-cap');
 // A short, sculpted rear housing with luminous insets.
 contour(g,[[.475,.170],[.535,.260],[.635,.269],
   [.690,.205],[.685,.096],[.618,.071],[.540,.107]],.117,'shell');
 slab(g,.145,.171,.044,'rubber',0,.166,.693,.013);
 for(const s of [-1,1]){
  slab(g,.014,.016,.110,'glow',s*.067,.237,.579,.004);
  slab(g,.018,.059,.040,'plate',s*.072,.161,.650,.006);
 }
 return g;
}
function buildSMG(){
 buildChassis();
 const guard=buildSmartHandguard();
 const rail=buildRail();
 const front=buildBarrelArt();
 const stock=buildStock();
 const grip=buildGrip();
 const energy=buildEnergyPack();
 const optic=buildHoloOptic();
 const under=buildAccessoryPod();
 const finishing=buildDetailPass();
 // Decorative details follow the shortened body, rather than floating ahead.
 finishing.scale.z=.76;
 finishing.position.z=.080;
 // Scale entire art assemblies rather than distorting individual surfaces.
 // All positions are display-only scene coordinates, not physical dimensions.
 guard.scale.z=.76;
 guard.position.z=.095;
 rail.scale.z=.74;
 rail.position.z=.095;
 front.scale.z=.67;
 front.position.z=.038;
 stock.scale.z=.78;
 stock.position.z=.020;
 under.scale.set(.92,.83,.84);
 under.position.z=.100;
 optic.scale.set(.90,.86,.87);
 optic.position.z=.071;
 energy.scale.set(.90,.83,.84);
 energy.position.z=.026;
 grip.scale.set(.96,.95,.96);
 buildCompactShell();
 buildShortFrontAccent();
 buildCompactStockAccent();
 gun.rotation.y=.07;
}

function buildWideForwardShell(){
 const g=node('wardrum-heavy-shroud');
 // Raised crown and a wide, cut-away front profile distinguish this from ARs.
 contour(g,[[-.795,.131],[-.779,.270],[-.687,.337],[-.296,.346],
  [-.211,.281],[-.243,.134],[-.690,.077]],.278,'shell');
 slab(g,.293,.060,.500,'plate',0,.318,-.510,.012);
 slab(g,.253,.026,.574,'poly',0,.365,-.507,.006);
 for(const side of [-1,1]){
  contour(g,[[-.748,.149],[-.717,.270],[-.623,.289],
   [-.343,.284],[-.291,.171]],.013,'plate',side*.153);
  const slots=[];
  for(let i=0;i<5;i++)slots.push([side*.169,.246,-.661+i*.079,.012,.033,.047]);
  details(g,slots,'recess');
  slab(g,.012,.017,.274,'glow',side*.169,.176,-.499,.004);
  tracer(g,side*.172,[[-.722,.304],[-.600,.302],[-.543,.282],
   [-.394,.282]],'accent',.014);
  slab(g,.019,.080,.093,'trim',side*.172,.193,-.737,.008);
 }
 // Distinct chunky layered top housing.
 slab(g,.218,.027,.410,'steel',0,.385,-.453,.005);
 const vents=[];for(let i=0;i<9;i++)vents.push([0,.404,-.659+i*.052,.218,.009,.014]);
 details(g,vents,'trim');
 return g;
}
function buildTwinFront(){
 const g=node('wardrum-twin-visual-front');
 // Two dark circular cores and cyan face rings create the shotgun silhouette.
 // They are purely decorative 3D forms, not physical designs.
 for(const side of [-1,1]){
  tube(g,.063,.28,'steel',side*.073,.211,-.869,18);
  tube(g,.074,.087,'shell',side*.073,.211,-1.017,18);
  tube(g,.041,.014,'recess',side*.073,.211,-1.068,20);
  ellipse(g,.055,.009,'trim',side*.073,.211,-1.078);
  ellipse(g,.045,.004,'glow',side*.073,.211,-1.080);
 }
 slab(g,.225,.061,.170,'shell',0,.211,-.931,.013);
 slab(g,.246,.024,.119,'accent',0,.277,-.978,.009);
 for(const side of [-1,1])slab(g,.014,.018,.102,'glow',side*.135,.177,-.990,.004);
 return g;
}
function buildPumpSleeve(){
 const g=node('wardrum-pump-sleeve');
 // Heavier, visibly separate lower handhold with broad ribs.
 contour(g,[[-.716,.041],[-.692,.113],[-.597,.149],[-.366,.146],
  [-.310,.078],[-.348,.002],[-.641,-.009]],.268,'poly');
 slab(g,.288,.047,.330,'shell',0,.045,-.515,.010);
 for(const side of [-1,1]){
  const ridges=[];
  for(let i=0;i<7;i++)ridges.push([side*.144,.061,-.657+i*.048,.011,.072,.017]);
  details(g,ridges,'plate');
  slab(g,.010,.013,.288,'glow',side*.155,.119,-.525,.003);
  slab(g,.024,.030,.078,'accent',side*.156,.087,-.690,.008);
 }
 return g;
}
function buildUnderbodyPod(){
 const g=node('wardrum-lower-energy-pod');
 // Fantasy glowing status capsule replaces the AR's big box magazine.
 slab(g,.175,.112,.245,'steel',0,-.009,-.102,.021);
 slab(g,.141,.069,.198,'poly',0,-.048,-.090,.012);
 for(const side of [-1,1]){
  slab(g,.011,.032,.138,'glow',side*.091,-.020,-.099,.004);
  const pips=[];for(let i=0;i<5;i++)pips.push([side*.100,-.050,-.164+i*.037,.012,.013,.012]);
  details(g,pips,'accent');
 }
 // Large underbody brace keeps profile visually balanced.
 contour(g,[[-.310,.017],[-.229,.059],[-.161,.038],
  [-.150,-.085],[-.240,-.114]],.119,'shell');
 return g;
}
function buildHeavyRear(){
 const g=node('wardrum-heavy-rear');
 const stock=buildStock();
 stock.scale.set(1.10,1.04,.87);
 stock.position.z=-.010;
 // Heavier cheek and squared rear pad.
 contour(g,[[.287,.200],[.393,.307],[.602,.316],
  [.686,.261],[.689,.147],[.579,.106],[.390,.135]],.106,'plate');
 slab(g,.186,.272,.052,'rubber',0,.165,.695,.019);
 slab(g,.175,.041,.222,'poly',0,.305,.478,.008);
 for(const side of [-1,1]){
  tracer(g,side*.064,[[.360,.264],[.530,.271],[.623,.223]],'glow',.011);
  slab(g,.014,.039,.111,'accent',side*.100,.134,.516,.005);
 }
 return g;
}
function buildHeavyOptic(){
 const g=buildHoloOptic();
 g.scale.set(1.05,.86,1.04);
 g.position.y=.427;
 g.position.z=-.055;
 return g;
}
function buildShotgunTrim(){
 const g=node('wardrum-trim-details');
 for(const side of [-1,1]){
  // Separate decals and contrasting armor seams.
  slab(g,.015,.035,.161,'accent',side*.147,.276,.006,.004);
  slab(g,.012,.019,.123,'glow',side*.156,.130,-.057,.003);
  slab(g,.018,.014,.112,'trim',side*.154,.101,.086,.003);
  const fast=[];
  for(let i=0;i<5;i++)fast.push([side*.171,.142,-.719+i*.110,.015,.012,.015]);
  details(g,fast,'trim');
 }
 // Rugged raised rear spine.
 slab(g,.144,.041,.243,'steel',0,.365,-.032,.006);
 const top=[];for(let i=0;i<6;i++)top.push([0,.390,-.141+i*.043,.139,.011,.014]);
 details(g,top,'accent');
 return g;
}
function buildWardrum(){
 buildChassis();
 buildGrip();
 buildWideForwardShell();
 buildTwinFront();
 buildPumpSleeve();
 buildUnderbodyPod();
 buildHeavyRear();
 buildHeavyOptic();
 buildShotgunTrim();
 gun.rotation.y=.055;
}

function buildLongwatchCore(){
 const g=node('longwatch-core');
 // Slim armor overlays on the family-standard inner chassis.
 for(const side of [-1,1]){
  contour(g,[[-.314,.119],[-.272,.284],[-.087,.317],
   [.129,.299],[.241,.236],[.197,.117]],.024,'shell',side*.133);
  slab(g,.014,.040,.205,'poly',side*.153,.227,-.104,.004);
  tracer(g,side*.167,[[-.271,.255],[-.162,.260],[-.101,.239],
   [.080,.239]],'glow',.012);
  slab(g,.012,.058,.075,'accent',side*.157,.159,.095,.005);
  const buttons=[];for(let i=0;i<5;i++)buttons.push([side*.168,.194,-.06+i*.029,.011,.012,.012]);
  details(g,buttons,'trim');
 }
 // Elongated upper spine with gently stepped futuristic panels.
 slab(g,.186,.050,.485,'plate',0,.323,-.075,.010);
 slab(g,.149,.026,.375,'steel',0,.361,-.080,.005);
 return g;
}
function buildLongwatchForebody(){
 const g=node('longwatch-long-forebody');
 // Tapered shield from central receiver into a narrow extended front.
 contour(g,[[-1.104,.155],[-1.054,.246],[-.920,.316],
  [-.386,.321],[-.304,.265],[-.334,.130],[-.935,.115]],.178,'shell');
 contour(g,[[-1.062,.158],[-1.009,.257],[-.827,.280],
  [-.421,.282],[-.371,.179]],.192,'plate');
 slab(g,.170,.035,.646,'poly',0,.310,-.693,.006);
 slab(g,.130,.025,.738,'steel',0,.355,-.680,.006);
 for(const side of [-1,1]){
  const vents=[];
  for(let i=0;i<10;i++)vents.push([side*.103,.236,-.992+i*.056,.011,.022,.032]);
  details(g,vents,'recess');
  slab(g,.011,.015,.442,'glow',side*.111,.170,-.701,.003);
  tracer(g,side*.115,[[-1.008,.286],[-.911,.289],[-.833,.259],
   [-.687,.259],[-.618,.287],[-.425,.286]],'accent',.010);
  slab(g,.015,.037,.093,'trim',side*.114,.205,-1.032,.006);
  const fins=[];
  for(let i=0;i<6;i++)fins.push([side*.106,.132,-.939+i*.092,.016,.011,.048]);
  details(g,fins,'steel');
 }
 // A dense but draw-call-efficient crown of ornamental segments.
 const spine=[];
 for(let i=0;i<24;i++)spine.push([0,.379,-1.033+i*.029,.134,.009,.012]);
 details(g,spine,'trim');
 return g;
}
function buildLongwatchFront(){
 const g=node('longwatch-extended-front');
 // Extended slender sci-fi outer tube, far past the armor shroud.
 tube(g,.029,.90,'steel',0,.225,-1.303,20);
 tube(g,.040,.18,'shell',0,.225,-1.556,16);
 tube(g,.048,.067,'trim',0,.225,-1.650,16);
 tube(g,.026,.015,'recess',0,.225,-1.687,20);
 ellipse(g,.035,.007,'glow',0,.225,-1.694);
 for(const side of [-1,1]){
  slab(g,.012,.019,.273,'plate',side*.036,.240,-1.352,.005);
  slab(g,.008,.009,.161,'accent',side*.049,.263,-1.359,.003);
 }
 // Fantasy energy-band section, a material choice not a mechanism.
 tube(g,.044,.105,'poly',0,.225,-1.161,16);
 ellipse(g,.047,.008,'glow',0,.225,-1.212);
 return g;
}
function buildLongwatchScope(){
 const g=node('longwatch-precision-optic');
 g.position.set(0,.485,-.114);
 // Long scope with chunky sci-fi objective housing and glowing lens rims.
 slab(g,.145,.057,.410,'steel',0,-.068,.006,.008);
 for(const z of [-.125,.125]){
  slab(g,.056,.10,.056,'trim',0,-.026,z,.008);
 }
 tube(g,.055,.52,'poly',0,.083,-.005,20);
 tube(g,.069,.080,'shell',0,.083,-.263,20);
 tube(g,.079,.038,'steel',0,.083,-.310,24);
 ellipse(g,.071,.008,'glow',0,.083,-.332);
 tube(g,.043,.087,'shell',0,.083,.280,20);
 ellipse(g,.045,.006,'accent',0,.083,.322);
 const frontLens=add(g,new T.Mesh(new T.CircleGeometry(.066,28),mat.lens),
  0,.083,-.336);
 const rearLens=add(g,new T.Mesh(new T.CircleGeometry(.040,24),mat.lens),
  0,.083,.329);
 frontLens.rotation.y=0;rearLens.rotation.y=0;
 // Distinctive angular side guards make it look authored rather than a pipe.
 for(const side of [-1,1]){
  contour(g,[[-.332,.045],[-.315,.175],[-.203,.194],
   [-.139,.152],[-.151,.042]],.014,'plate',side*.079);
  slab(g,.011,.024,.233,'glow',side*.092,.166,-.224,.003);
  slab(g,.020,.050,.062,'accent',side*.082,.035,.120,.006);
  const rangePips=[];for(let i=0;i<6;i++)rangePips.push([side*.062,.114,.020+i*.028,.007,.015,.013]);
  details(g,rangePips,'glow');
 }
 slab(g,.071,.035,.072,'shell',0,.156,-.050,.008);
 slab(g,.044,.024,.043,'accent',0,.188,-.050,.005);
 return g;
}
function buildLongwatchStock(){
 const g=node('longwatch-extended-stock');
 // Rear silhouette extends distinctly past AETHER-9.
 contour(g,[[.290,.140],[.353,.291],[.542,.339],[.842,.302],
  [1.007,.240],[1.061,.145],[1.041,.055],[.921,.029],
  [.787,.121],[.493,.132]],.103,'poly');
 contour(g,[[.394,.255],[.575,.293],[.889,.269],
  [.963,.225],[.909,.184],[.586,.203]],.116,'plate');
 slab(g,.188,.258,.079,'rubber',0,.157,1.038,.017);
 slab(g,.161,.044,.340,'steel',0,.325,.690,.009);
 for(const side of [-1,1]){
  tracer(g,side*.062,[[.405,.278],[.620,.298],
   [.836,.285],[.944,.238]],'glow',.013);
  slab(g,.012,.061,.183,'accent',side*.068,.132,.742,.006);
  slab(g,.013,.018,.104,'trim',side*.114,.196,.415,.004);
 }
 sidewaysTube(g,.037,.134,'steel',0,.157,.386,16);
 sidewaysTube(g,.023,.085,'glow',0,.157,.386,16);
 return g;
}
function buildLongwatchLower(){
 const g=node('longwatch-lower-battery');
 // A short compact science-fiction cartridge keeps the long profile elegant.
 contour(g,[[-.095,.018],[.064,.015],[.075,-.163],
  [.026,-.202],[-.102,-.187]],.125,'steel');
 slab(g,.151,.030,.139,'plate',0,-.191,-.011,.008);
 for(const side of [-1,1]){
  slab(g,.009,.120,.022,'glow',side*.068,-.087,.002,.004);
  const dots=[];for(let i=0;i<4;i++)dots.push([side*.078,-.161+i*.036,.001,.012,.010,.015]);
  details(g,dots,'accent');
 }
 return g;
}
function buildLongwatchBraces(){
 const g=node('longwatch-display-braces');
 // Stylized folded presentation braces and utility fins under the shroud.
 for(const side of [-1,1]){
  const brace=slab(g,.028,.207,.038,'steel',side*.092,-.019,-.907,.008);
  brace.rotation.z=side*.23;
  slab(g,.041,.031,.130,'poly',side*.108,-.129,-.906,.008);
  slab(g,.014,.107,.018,'glow',side*.120,-.017,-.902,.004);
  for(let i=0;i<3;i++)slab(g,.013,.010,.033,'accent',side*.113,.087-i*.054,-.906,.003);
 }
 slab(g,.150,.024,.324,'shell',0,.095,-.794,.006);
 return g;
}
function buildLongwatchFinishing(){
 const g=node('longwatch-final-polish');
 for(const side of [-1,1]){
  slab(g,.017,.036,.135,'accent',side*.145,.263,.091,.004);
  slab(g,.011,.020,.138,'glow',side*.152,.108,-.071,.004);
  const screws=[];
  for(let i=0;i<5;i++)screws.push([side*.120,.149,-.989+i*.130,.014,.011,.013]);
  for(let i=0;i<3;i++)screws.push([side*.164,.138,-.190+i*.087,.011,.011,.011]);
  details(g,screws,'trim');
 }
 const rail=[];
 for(let i=0;i<8;i++)rail.push([0,.401,-.268+i*.061,.136,.012,.013]);
 details(g,rail,'trim');
 return g;
}
function buildLongwatch(){
 buildChassis();
 buildGrip();
 buildLongwatchCore();
 buildLongwatchForebody();
 buildLongwatchFront();
 buildLongwatchScope();
 buildLongwatchStock();
 buildLongwatchLower();
 buildLongwatchBraces();
 buildLongwatchFinishing();
 gun.rotation.y=.055;
}

 const build=[buildAether,buildSMG,buildWardrum,buildLongwatch][weaponId];
 build();
 // Detach only the pieces that must retain animation independence.
 // The visual group remains in the same muzzle-forward coordinates as the showroom.
 const magArt=elements[MAG_GROUPS[weaponId]];
 if(magArt){
  magArt.removeFromParent();
  magazine.position.set(0,-.10,-.035);
  gun.add(magazine);
  magazine.add(magArt);
  magArt.position.add(new T.Vector3(0,.10,.035));
 }else{
  // Shotgun's lower unit is integral to its body, not a detachable magazine.
  magazine.position.set(0,-.10,-.035);
  gun.add(magazine);
 }
 const action={};
 if(weaponId===2){
  action.pump=elements['wardrum-pump-sleeve'];
  action.pump.removeFromParent();
 }
 // Batch all stationary geometry before attaching the animated parts.
 // Magazine is temporarily removed so its animation isn't baked away.
 magazine.removeFromParent();
 const batchCount=batchStaticMeshes(gun);
 gun.add(magazine);
 if(action.pump)gun.add(action.pump);
 if(weaponId!==2){
  action.bolt=slab(gun,.017,.028,.083,'trim',.143,.264,-.10,.004);
 }
 const muzzle=muzzles[weaponId];
 const flash=new T.Mesh(new T.OctahedronGeometry(.078,0),
  new T.MeshBasicMaterial({color:0xffe6b6,depthWrite:false}));
 flash.name='aether-muzzle-flash';
 flash.position.set(0,muzzle.y,muzzle.z);
 flash.visible=false;gun.add(flash);
 let chosen=-1;
 function setFinish(index){
  const next=Math.max(0,Math.min(2,Math.trunc(Number(index)||0)));
  if(next===chosen)return false;
  chosen=next;
  const palette=FINISHES[next];
  for(const key of FINISH_KEYS)mat[key].color.setHex(palette[key]);
  mat.glow.emissive.setHex(palette.glow);
  mat.accent.emissive.setHex(palette.accent);
  mat.lens.color.setHex(palette.glow);
  return true;
 }
 setFinish(initialFinish);
 const uniqueMaterials=new Set(Object.values(mat));
 gun.traverse(o=>{
  if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))
   uniqueMaterials.add(m);
 });
 return {flash,action,setFinish,uniqueMaterials:[...uniqueMaterials],batchCount,
  geometryCount,gun};
}
export function disposeAetherMaterials(root){
 const list=root?.userData?.aetherMaterials;
 if(!list)return;
 for(const m of list){m.map?.dispose();m.dispose();}
 root.userData.aetherMaterials=null;
}
