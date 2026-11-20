// CROSSFire AR Studio — standalone, purely fictional game-art concept viewer.
// Three.js is served locally by the game; this page does not join game rooms.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const canvas=document.getElementById('canvas');
const loading=document.getElementById('loading');
const scene=new T.Scene();
scene.background=new T.Color(0x0a1218);
scene.fog=new T.FogExp2(0x0a1218,.055);
const camera=new T.PerspectiveCamera(43,1,.05,100);
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.24;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
scene.add(new T.HemisphereLight(0xcbe8ff,0x30383b,1.85));
const key=new T.DirectionalLight(0xffedce,4);
key.position.set(2.8,5.4,3.6);
key.castShadow=true;key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left=-4;key.shadow.camera.right=4;
key.shadow.camera.top=4;key.shadow.camera.bottom=-4;
key.shadow.normalBias=.035;scene.add(key);
const rim=new T.DirectionalLight(0x53d9e1,2.8);rim.position.set(-3,2,-3);scene.add(rim);
const fill=new T.PointLight(0xb5c8ff,45,11);fill.position.set(-3,1.2,2);scene.add(fill);
const floorMaterial=new T.MeshStandardMaterial({color:0x152329,roughness:.55,metalness:.3});
const floor=new T.Mesh(new T.CylinderGeometry(2.4,2.7,.12,64),floorMaterial);
floor.position.y=-.94;floor.receiveShadow=true;scene.add(floor);
const annulus=new T.Mesh(new T.RingGeometry(2.05,2.09,80),
 new T.MeshBasicMaterial({color:0x4b7e82,side:T.DoubleSide,transparent:true,opacity:.55}));
annulus.rotation.x=-Math.PI/2;annulus.position.y=-.873;scene.add(annulus);
const stage=new T.GridHelper(5,28,0x43646a,0x223941);stage.position.y=-.869;scene.add(stage);

// Stage A low-poly matte finishes. Sand is reference-matched default.
const finishes={
 sand:{shell:0xd5c2ae,panels:0xe1c9ae,accent:0x858b91,poly:0x464b50,trim:0x2d3136},
 slate:{shell:0x858b8f,panels:0xa0a4a1,accent:0x606a70,poly:0x3d474c,trim:0x242b30},
 charcoal:{shell:0x434c54,panels:0x68737b,accent:0x8c969a,poly:0x252c31,trim:0x171d21}
};
const materials={
 shell:new T.MeshStandardMaterial({color:0xd5c2ae,roughness:.74,metalness:.07,flatShading:true}),
 panels:new T.MeshStandardMaterial({color:0xe1c9ae,roughness:.72,metalness:.09,flatShading:true}),
 accent:new T.MeshStandardMaterial({color:0x858b91,roughness:.50,metalness:.40,flatShading:true}),
 poly:new T.MeshStandardMaterial({color:0x464b50,roughness:.82,metalness:.10,flatShading:true}),
 trim:new T.MeshStandardMaterial({color:0x2d3136,roughness:.48,metalness:.56,flatShading:true}),
 steel:new T.MeshStandardMaterial({color:0x242a2f,roughness:.44,metalness:.68,flatShading:true}),
 recess:new T.MeshStandardMaterial({color:0x10161a,roughness:.91,metalness:.04}),
 rubber:new T.MeshStandardMaterial({color:0x171d20,roughness:.96,metalness:.03})
};
const prop=new T.Group();prop.rotation.y=-.16;scene.add(prop);
const gun=new T.Group();gun.position.y=.12;prop.add(gun);
function add(parent,mesh,x=0,y=0,z=0){
 mesh.position.set(x,y,z);parent.add(mesh);
 if(mesh.isMesh&&!mesh.material?.transparent){mesh.castShadow=true;mesh.receiveShadow=true;}
 return mesh;
}
function slab(parent,w,h,d,mat,x,y,z,r=.015){
 const geo=new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3));
 return add(parent,new T.Mesh(geo,materials[mat]||mat),x,y,z);
}
function cyl(parent,r,len,mat,x,y,z,segments=16){
 const object=add(parent,new T.Mesh(new T.CylinderGeometry(r,r,len,segments),
  materials[mat]||mat),x,y,z);
 object.rotation.x=Math.PI/2;return object;
}
function torus(parent,r,t,mat,x,y,z){
 return add(parent,new T.Mesh(new T.TorusGeometry(r,t,8,32),
  materials[mat]||mat),x,y,z);
}
function micro(parent,items,mat){
 const geometry=new T.BoxGeometry(1,1,1);
 const mesh=new T.InstancedMesh(geometry,materials[mat],items.length);
 const dummy=new T.Object3D();
 for(let i=0;i<items.length;i++){
  const [x,y,z,w,h,d,angle=0]=items[i];
  dummy.position.set(x,y,z);dummy.rotation.set(0,0,angle);
  dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;parent.add(mesh);return mesh;
}
function plate(parent,points,thickness,mat,side=0){
 // A bevelled game-art silhouette with no physical component specifications.
 const shape=new T.Shape();
 for(let i=0;i<points.length;i++){
  const [z,y]=points[i];if(i===0)shape.moveTo(-z,y);else shape.lineTo(-z,y);
 }
 shape.closePath();
 const geo=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,steps:1,
  bevelThickness:.005,bevelSize:.006,bevelSegments:2});
 // z/y silhouette into the local Z/Y plane; extrusion becomes the X thickness.
 geo.translate(0,0,-thickness/2);geo.rotateY(Math.PI/2);
 return add(parent,new T.Mesh(geo,materials[mat]),side,0,0);
}
// Stage A: MRX-17 SANDLINE — low-poly tan rifle silhouette.
// Geometry is artistic and nonfunctional. Add-ons and kit props follow in Stage B/C.
const parts={};
function part(name){const root=new T.Group();root.name='MRX17_'+name;gun.add(root);parts[name]=root;return root;}
function buildLowerReceiver(){
 const g=part('lower_receiver');
 slab(g,.176,.154,.334,'shell',0,.141,.082,.005);
 plate(g,[[-.17,.18],[-.16,.075],[-.065,.053],[.13,.066],[.19,.12],[.17,.211],[.08,.228],[-.1,.23]],.168,'shell');
 slab(g,.175,.029,.29,'panels',0,.217,.06,.003);
 for(const side of [-1,1]){
  slab(g,.009,.065,.20,'panels',side*.093,.143,.06,.002);
  slab(g,.01,.018,.108,'accent',side*.10,.117,.013,.002);
  slab(g,.009,.043,.031,'poly',side*.101,.167,.165,.002);
 }
 return g;
}
function buildUpperReceiver(){
 const g=part('upper_receiver');
 slab(g,.172,.070,.393,'panels',0,.263,.04,.005);
 slab(g,.166,.022,.375,'accent',0,.305,.043,.003);
 slab(g,.118,.014,.25,'trim',0,.327,.062,.003);
 for(const s of [-1,1])slab(g,.009,.026,.108,'poly',s*.091,.271,.005,.002);
 return g;
}
function buildHandguard(){
 const g=part('long_handguard');
 // Slim, uninterrupted front mass with two tiers of dark inset vents.
 slab(g,.162,.102,.633,'shell',0,.240,-.451,.003);
 slab(g,.175,.021,.654,'panels',0,.291,-.458,.003);
 slab(g,.149,.017,.604,'accent',0,.183,-.456,.003);
 const vents=[];
 for(const s of [-1,1]){
  for(let i=0;i<6;i++)vents.push([s*.085,.259,-.691+i*.085,.009,.028,.054]);
  for(let i=0;i<5;i++)vents.push([s*.085,.213,-.658+i*.095,.009,.009,.046]);
  slab(g,.009,.015,.46,'trim',s*.091,.190,-.448,.002);
 }
 micro(g,vents,'recess');
 // Continuous spine; teeth added as low-draw-call instances.
 slab(g,.115,.027,.670,'trim',0,.323,-.425,.003);
 const teeth=[];
 for(let i=0;i<18;i++)teeth.push([0,.341,-.731+i*.034,.119,.011,.012]);
 micro(g,teeth,'accent');
 return g;
}
function buildBarrelGroup(){
 const g=part('barrel');
 cyl(g,.020,.357,'steel',0,.242,-.823,10);
 cyl(g,.026,.059,'accent',0,.242,-.986,8);
 return g;
}
function buildMuzzle(){
 const g=part('muzzle');
 cyl(g,.032,.061,'trim',0,.242,-1.046,8);
 cyl(g,.016,.010,'recess',0,.242,-1.078,8);
 return g;
}
function buildStock(){
 const g=part('integrated_stock');
 // Solid tan rear silhouette with a lower structural line; no sci-fi skeleton.
 plate(g,[[.226,.134],[.319,.240],[.433,.272],[.720,.258],[.859,.214],
  [.893,.152],[.875,.057],[.801,.043],[.697,.103],[.445,.102],[.361,.108]],.149,'shell');
 plate(g,[[.430,.124],[.502,.183],[.741,.182],[.806,.139],[.783,.100],[.472,.100]],.159,'panels');
 slab(g,.176,.173,.040,'poly',0,.139,.889,.007);
 slab(g,.180,.026,.046,'rubber',0,.067,.902,.004);
 slab(g,.158,.029,.085,'trim',0,.257,.315,.003);
 for(const s of [-1,1]){
  slab(g,.009,.028,.23,'accent',s*.083,.250,.605,.002);
  slab(g,.008,.031,.153,'poly',s*.083,.135,.608,.002);
 }
 return g;
}
function buildGrip(){
 const g=part('grip');
 g.position.set(0,.055,.232);g.rotation.x=-.22;
 plate(g,[[-.06,.03],[.069,.03],[.11,-.213],[.055,-.259],[-.095,-.035]],.106,'shell');
 slab(g,.120,.023,.138,'panels',0,-.248,.028,.003);
 for(const side of [-1,1]){
  slab(g,.008,.150,.09,'poly',side*.059,-.116,.015,.003);
  const ribs=[];
  for(let i=0;i<5;i++)ribs.push([side*.065,-.185+i*.029,.014,.007,.008,.075]);
  micro(g,ribs,'trim');
 }
 return g;
}
function buildMagazine(){
 const g=part('magazine');
 g.position.set(0,.052,-.084);g.rotation.x=.065;
 plate(g,[[-.078,.021],[.063,.021],[.103,-.323],[.055,-.386],[-.095,-.367]],.121,'panels');
 for(const s of [-1,1]){
  slab(g,.008,.220,.072,'shell',s*.066,-.165,-.02,.002);
  const seams=[];
  for(let i=0;i<4;i++)seams.push([s*.073,-.143-i*.056,-.012,.007,.009,.08]);
  micro(g,seams,'accent');
 }
 slab(g,.147,.030,.160,'accent',0,-.376,-.006,.003);
 return g;
}
function buildStageA(){
 buildLowerReceiver();buildUpperReceiver();buildHandguard();
 buildBarrelGroup();buildMuzzle();buildStock();buildGrip();buildMagazine();
 gun.rotation.y=.05;
}
buildStageA();
const orbit={azimuth:1.04,polar:1.23,distance:3.0,targetAzimuth:1.04,
 targetPolar:1.23,targetDistance:3.0,auto:true,dragging:false,x:0,y:0};
const target=new T.Vector3(.04,.09,-.02);
function resetView(){orbit.targetAzimuth=1.04;orbit.targetPolar=1.23;orbit.targetDistance=3.0;orbit.auto=false;setAuto(false);}
function setAuto(value){
 orbit.auto=!!value;
 const button=document.getElementById('auto');
 button.classList.toggle('active',orbit.auto);button.setAttribute('aria-pressed',String(orbit.auto));
}
function chooseFinish(name){
 const palette=finishes[name]||finishes.sand;
 for(const keyName of ['shell','panels','accent','poly','trim'])materials[keyName].color.setHex(palette[keyName]);
 materials.accent.emissive.setHex(palette.accent).multiplyScalar(.11);
 for(const button of document.querySelectorAll('[data-finish]')){
  const active=button.dataset.finish===name;
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 }
}
for(const button of document.querySelectorAll('[data-finish]'))button.addEventListener('click',()=>chooseFinish(button.dataset.finish));
document.getElementById('auto').addEventListener('click',()=>setAuto(!orbit.auto));
document.getElementById('reset').addEventListener('click',resetView);
canvas.addEventListener('dblclick',resetView);
const pointers=new Map();
let pinch=0;
canvas.addEventListener('pointerdown',e=>{
 canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 orbit.dragging=true;setAuto(false);
 if(pointers.size>1){const arr=[...pointers.values()];pinch=Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y);}
});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 const old=pointers.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===1){
  orbit.targetAzimuth-=dx*.007;
  orbit.targetPolar=Math.min(2.7,Math.max(.24,orbit.targetPolar-dy*.006));
 }else if(pointers.size===2){
  const arr=[...pointers.values()],next=Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y);
  if(pinch>0)orbit.targetDistance=Math.min(6,Math.max(1.5,orbit.targetDistance*pinch/Math.max(1,next)));
  pinch=next;
 }
});
function releasePointer(e){pointers.delete(e.pointerId);orbit.dragging=pointers.size>0;if(pointers.size<2)pinch=0;}
canvas.addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',releasePointer);
canvas.addEventListener('wheel',e=>{
 e.preventDefault();setAuto(false);
 orbit.targetDistance=Math.max(1.5,Math.min(6,orbit.targetDistance*Math.exp(e.deltaY*.0011)));
},{passive:false});
function resize(){
 const w=innerWidth,h=innerHeight;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
 renderer.setSize(w,h,false);camera.aspect=w/h;
 camera.fov=w<720?49:43;camera.updateProjectionMatrix();
 const compact=w<760;
 prop.position.x=compact?0:.36;
 target.x=prop.position.x;
 orbit.targetDistance=Math.max(orbit.targetDistance,compact?3.5:2.8);
}
window.addEventListener('resize',resize);resize();chooseFinish('sand');
loading.hidden=true;
let previous=performance.now(),raf=0;
function animate(now){
 const dt=Math.min(.05,(now-previous)/1000);previous=now;
 if(orbit.auto&&!orbit.dragging)orbit.targetAzimuth+=dt*.17;
 orbit.azimuth+=(orbit.targetAzimuth-orbit.azimuth)*Math.min(1,dt*9);
 orbit.polar+=(orbit.targetPolar-orbit.polar)*Math.min(1,dt*9);
 orbit.distance+=(orbit.targetDistance-orbit.distance)*Math.min(1,dt*9);
 const s=Math.sin(orbit.polar),c=Math.cos(orbit.polar);
 camera.position.set(target.x+orbit.distance*s*Math.sin(orbit.azimuth),
  target.y+orbit.distance*c,target.z+orbit.distance*s*Math.cos(orbit.azimuth));
 camera.lookAt(target);
 renderer.render(scene,camera);
 raf=requestAnimationFrame(animate);
}
raf=requestAnimationFrame(animate);
document.addEventListener('visibilitychange',()=>{previous=performance.now();});
