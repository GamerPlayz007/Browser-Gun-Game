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

// Paintable finishes: no stock or real-world weapon specification.
const finishes={
 onyx:{shell:0x293840,panels:0x455b5e,accent:0x5ed5c2,poly:0x1b292f,trim:0xb1bdba},
 arctic:{shell:0xb8c4c2,panels:0xd8dedd,accent:0x6bcbdc,poly:0x495961,trim:0x263c45},
 cobalt:{shell:0x263a57,panels:0x4c6491,accent:0x88aaf7,poly:0x202939,trim:0xb5c7e1}
};
const materials={
 shell:new T.MeshStandardMaterial({color:0x293840,roughness:.46,metalness:.62}),
 panels:new T.MeshStandardMaterial({color:0x455b5e,roughness:.54,metalness:.42}),
 accent:new T.MeshStandardMaterial({color:0x5ed5c2,roughness:.3,metalness:.68,emissive:0x092623,emissiveIntensity:.35}),
 poly:new T.MeshStandardMaterial({color:0x1b292f,roughness:.84,metalness:.12}),
 trim:new T.MeshStandardMaterial({color:0xb1bdba,roughness:.29,metalness:.78}),
 steel:new T.MeshStandardMaterial({color:0x151c23,roughness:.32,metalness:.84}),
 recess:new T.MeshStandardMaterial({color:0x080e13,roughness:.89,metalness:.12}),
 rubber:new T.MeshStandardMaterial({color:0x10191d,roughness:.95,metalness:.02}),
 glass:new T.MeshBasicMaterial({color:0x6de0ea,transparent:true,opacity:.15,side:T.DoubleSide,depthWrite:false})
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
// Main mass: overlapping sculpted surfaces rather than a single cuboid.
slab(gun,.245,.185,.435,'steel',0,.12,.055,.03);
plate(gun,[[-.23,.16],[-.19,.27],[.12,.285],[.265,.205],[.245,.10],[.08,.07],[-.22,.09]],.275,'shell');
slab(gun,.28,.05,.46,'trim',0,.264,.045,.009);
for(const side of [-1,1]){
 plate(gun,[[-.175,.10],[-.145,.22],[.055,.23],[.185,.16],[.12,.07]],.018,'panels',side*.150);
 slab(gun,.02,.08,.19,'steel',side*.165,.18,.025,.005);
 slab(gun,.007,.034,.093,'accent',side*.179,.203,-.048,.003);
 slab(gun,.008,.026,.082,'trim',side*.182,.102,.088,.003);
 // A readable inset graphic on both sides and several tiny fasteners.
 for(const z of [-.12,.06,.19]){
  const screw=cyl(gun,.012,.008,'steel',side*.18,.117,z,10);
  screw.rotation.z=Math.PI/2;
 }
}
// Front silhouette / upper cover.
plate(gun,[[-.68,.195],[-.65,.285],[-.23,.285],[-.20,.215],
 [-.245,.085],[-.64,.105]],.22,'shell');
slab(gun,.246,.04,.43,'panels',0,.267,-.455,.009);
for(const side of [-1,1]){
 slab(gun,.019,.105,.335,'poly',side*.129,.18,-.453,.012);
 for(let j=0;j<7;j++)slab(gun,.010,.048,.016,'recess',side*.143,.173,-.30-j*.046,.002);
 slab(gun,.014,.013,.18,'accent',side*.146,.118,-.47,.003);
 slab(gun,.018,.032,.075,'trim',side*.135,.229,-.565,.005);
}
// Elegant long forward silhouette, stylized outer tube and face ring.
cyl(gun,.037,.57,'steel',0,.184,-.75,20);
cyl(gun,.049,.075,'shell',0,.184,-.972,20);
torus(gun,.037,.011,'trim',0,.184,-1.018);
cyl(gun,.021,.015,'recess',0,.184,-1.022,20);
// Decorative spaced rail + vent lines on top.
slab(gun,.13,.026,.70,'steel',0,.317,-.302,.008);
const rail=[];
for(let i=0;i<15;i++)rail.push([0,.334,-.610+i*.044,.126,.012,.019]);
micro(gun,rail,'trim');
// Rear structure with see-through negative space and panel geometry.
plate(gun,[[.225,.17],[.36,.2],[.43,.26],[.71,.22],
 [.78,.145],[.69,.07],[.40,.09],[.275,.09]],.092,'steel');
slab(gun,.17,.038,.34,'panels',0,.23,.55,.01);
slab(gun,.17,.03,.30,'trim',0,.09,.56,.008);
slab(gun,.12,.17,.074,'poly',0,.143,.792,.016);
slab(gun,.205,.235,.062,'rubber',0,.139,.838,.022);
for(const side of [-1,1]){
 slab(gun,.008,.047,.196,'accent',side*.091,.185,.55,.003);
 slab(gun,.014,.054,.13,'shell',side*.084,.13,.57,.007);
}
// Gripped silhouette with geometric surface texture (fictional prop).
const grip=new T.Group();grip.position.set(0,.015,.20);grip.rotation.x=-.24;gun.add(grip);
slab(grip,.12,.285,.135,'rubber',0,-.097,0,.019);
for(const side of [-1,1]){
 for(let j=0;j<5;j++)slab(grip,.007,.012,.091,'panels',side*.064,-.18+j*.036,0,.002);
}
slab(grip,.138,.038,.148,'poly',0,-.239,.02,.007);
// Stylized magazine-shaped block (display art only).
const pack=new T.Group();pack.position.set(0,.002,-.094);pack.rotation.x=.13;gun.add(pack);
plate(pack,[[.075,-.035],[-.062,-.043],[-.119,-.365],[.052,-.39],[.09,-.21]],.132,'poly');
slab(pack,.15,.027,.162,'shell',0,-.369,-.025,.006);
for(const side of [-1,1]){
 slab(pack,.009,.18,.017,'panels',side*.073,-.195,-.025,.004);
 slab(pack,.010,.037,.084,'accent',side*.075,-.29,-.019,.004);
}
// Oversized fictional holographic display sight.
const optic=new T.Group();optic.position.set(0,.347,-.084);gun.add(optic);
slab(optic,.135,.04,.165,'steel',0,0,0,.01);
slab(optic,.12,.052,.09,'panels',0,.025,.026,.01);
for(const side of [-1,1]){
 slab(optic,.027,.16,.039,'steel',side*.075,.102,-.031,.013);
 slab(optic,.010,.095,.025,'trim',side*.091,.102,-.041,.004);
}
slab(optic,.178,.031,.05,'steel',0,.183,-.031,.01);
slab(optic,.145,.016,.044,'panels',0,.200,-.031,.007);
const lens=add(optic,new T.Mesh(new T.PlaneGeometry(.120,.128),materials.glass),0,.11,-.034);
// Floating soft cyan HUD dot is a display cosmetic, not a live aiming aid.
const dot=add(optic,new T.Mesh(new T.CircleGeometry(.007,16),
 new T.MeshBasicMaterial({color:0xc6fff0,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide})),0,.113,-.038);
// Side decal rendered from a canvas for crisp details under close orbit.
function makeDecal(){
 const c=document.createElement('canvas');c.width=512;c.height=128;
 const context=c.getContext('2d');
 context.clearRect(0,0,512,128);
 context.textBaseline='middle';
 context.font='800 45px Arial';context.fillStyle='#d7e9e6';context.fillText('CF  /  07',22,55);
 context.font='500 19px Arial';context.fillStyle='#73ddd0';context.fillText('VANGUARD  •  MK II',26,94);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
const decalMaterial=new T.MeshBasicMaterial({map:makeDecal(),side:T.DoubleSide,transparent:true,depthWrite:false});
for(const side of [-1,1]){
 const decal=add(gun,new T.Mesh(new T.PlaneGeometry(.235,.061),decalMaterial),
  side*.166,.188,.095);
 decal.rotation.y=side*Math.PI/2;
}
// Showcase orientates the rifle long axis across the screen and exposes its right side.
gun.rotation.y=.09;
const orbit={azimuth:1.0,polar:1.28,distance:3.0,targetAzimuth:1.0,
 targetPolar:1.28,targetDistance:3.0,auto:true,dragging:false,x:0,y:0};
const target=new T.Vector3(.04,.05,0);
function resetView(){orbit.targetAzimuth=1.0;orbit.targetPolar=1.28;orbit.targetDistance=3.0;orbit.auto=false;setAuto(false);}
function setAuto(value){
 orbit.auto=!!value;
 const button=document.getElementById('auto');
 button.classList.toggle('active',orbit.auto);button.setAttribute('aria-pressed',String(orbit.auto));
}
function chooseFinish(name){
 const palette=finishes[name]||finishes.onyx;
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
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
 renderer.setSize(w,h,false);camera.aspect=w/h;
 camera.fov=w<720?49:43;camera.updateProjectionMatrix();
 const compact=w<760;
 prop.position.x=compact?0:.36;
 target.x=prop.position.x;
 orbit.targetDistance=Math.max(orbit.targetDistance,compact?3.5:2.8);
}
window.addEventListener('resize',resize);resize();chooseFinish('onyx');
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
