/**
 * CROSSFire / AETHER-9 : PHANTOM EDITION
 * Independent original three-dimensional sci-fi GAME PROP.
 * Rendering/artwork only. No gameplay, physical or functional mechanisms.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const $=id=>document.getElementById(id);
const canvas=$('canvas'),loading=$('loading');
const scene=new T.Scene();
scene.background=new T.Color(0x080f1a);
scene.fog=new T.FogExp2(0x080f1a,.023);
const camera=new T.PerspectiveCamera(43,1,.08,120);
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.35;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.setClearColor(0x080f1a);
scene.add(new T.HemisphereLight(0xcbe9ff,0x1d293e,2.65));
const key=new T.DirectionalLight(0xdcefff,4.4);
key.position.set(3.4,7,4.2);key.castShadow=true;
key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-5;key.shadow.camera.right=5;
key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.bias=-.0001;
scene.add(key);
const rim=new T.DirectionalLight(0x3cbfff,3.9);rim.position.set(-3.3,2.2,-4);scene.add(rim);
const fill=new T.DirectionalLight(0xffb778,2);fill.position.set(1.8,-1.5,2.5);scene.add(fill);
const stage=new T.Group();scene.add(stage);
const floorMat=new T.MeshStandardMaterial({color:0x132634,metalness:.64,roughness:.46});
const plinth=new T.Mesh(new T.CylinderGeometry(2.65,2.85,.22,96),floorMat);
plinth.position.y=-.95;plinth.receiveShadow=true;stage.add(plinth);
const skirt=new T.Mesh(new T.CylinderGeometry(2.61,2.63,.035,96),
 new T.MeshStandardMaterial({color:0x08151f,metalness:.81,roughness:.28}));
skirt.position.y=-.816;stage.add(skirt);
const halo=new T.Mesh(new T.RingGeometry(2.28,2.30,100),
 new T.MeshBasicMaterial({color:0x3b9fc0,side:T.DoubleSide,transparent:true,opacity:.6}));
halo.rotation.x=-Math.PI/2;halo.position.y=-.796;stage.add(halo);
const innerRing=new T.Mesh(new T.RingGeometry(1.66,1.672,100),
 new T.MeshBasicMaterial({color:0x274e6b,side:T.DoubleSide,transparent:true,opacity:.65}));
innerRing.rotation.x=-Math.PI/2;innerRing.position.y=-.795;stage.add(innerRing);
const grid=new T.GridHelper(5.3,36,0x1e5869,0x173344);
grid.position.y=-.796;stage.add(grid);
const starGeometry=new T.BufferGeometry();
const starPos=[];
let seed=246812;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
for(let i=0;i<170;i++)starPos.push((rnd()-.5)*25,(rnd()-.5)*10+1,(rnd()-.5)*25);
starGeometry.setAttribute('position',new T.Float32BufferAttribute(starPos,3));
const stars=new T.Points(starGeometry,new T.PointsMaterial({color:0x577f99,size:.016,transparent:true,opacity:.46,sizeAttenuation:true}));
scene.add(stars);
const display=new T.Group();display.position.y=.18;scene.add(display);
const body=new T.Group();display.add(body);
body.rotation.y=-.06;
let parts=0,litParts=[];
function mk(name,c,metal,rough,extras={}){
 const m=new T.MeshStandardMaterial({name,color:c,metalness:metal,roughness:rough,...extras});return m;
}
function brushedTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 const img=x.createImageData(256,256);
 for(let y=0;y<256;y++)for(let xx=0;xx<256;xx++){
  const v=Math.floor(165+45*rnd()+17*Math.sin(xx*.8)+10*Math.sin(y*2.7));
  const k=(y*256+xx)*4;img.data[k]=img.data[k+1]=img.data[k+2]=v;img.data[k+3]=255;
 }
 x.putImageData(img,0,0);
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;
 t.repeat.set(2.6,1.7);t.colorSpace=T.NoColorSpace;
 return t;
}
const roughTex=brushedTexture();
const mat={
 core:mk('recessed midnight core',0x151e27,.70,.43),
 shadow:mk('dark ceramic recess',0x0b141b,.44,.80),
 armor:mk('floating forged carbon armor',0x294351,.71,.32,{roughnessMap:roughTex}),
 plate:mk('anodized machined plate',0x5e7f8d,.82,.23,{roughnessMap:roughTex}),
 trim:mk('silvery edge rails',0xbbd6d9,.91,.19),
 spine:mk('titanium skeletal frame',0x1d303a,.81,.28),
 grip:mk('matte polymer',0x1c2c36,.17,.83),
 inset:mk('recessed midnight carbon',0x11202b,.56,.67),
 screws:mk('oxide precision marks',0x91b3c1,.8,.28),
 glow:mk('cyan photonic filaments',0x4ce7ff,.27,.20,{emissive:0x4ce7ff,emissiveIntensity:2.1}),
 glowDeep:mk('core glow',0x28cbff,.12,.19,{emissive:0x00bdff,emissiveIntensity:3.6}),
 glass:new T.MeshPhysicalMaterial({name:'iridescent lightguide',color:0x6ce9ff,metalness:.08,roughness:.10,
  transmission:.38,thickness:.27,ior:1.4,transparent:true,opacity:.83,clearcoat:1,
  clearcoatRoughness:.08,depthWrite:false}),
 warning:mk('warm contrast marks',0xffc26a,.52,.36,{emissive:0x9d4d13,emissiveIntensity:.23}),
 rubber:mk('tactile rubber',0x111922,.10,.9)
};
const finishPalettes={
 midnight:{armor:0x294351,plate:0x5e7f8d,trim:0xbbd6d9,spine:0x1d303a,glow:0x4ce7ff,deep:0x00bdff,warning:0xffc26a,glass:0x6ce9ff},
 glacier:{armor:0x8baab2,plate:0xc2d8dc,trim:0xf8f8ee,spine:0x537583,glow:0x6ffff1,deep:0x26e7d8,warning:0xf7b965,glass:0xbbffff},
 eclipse:{armor:0x252839,plate:0x494b62,trim:0xa9b7d4,spine:0x1c2133,glow:0xbd91ff,deep:0x8553ef,warning:0xef829c,glass:0xd3aaff}
};
function attach(parent,geo,material,x=0,y=0,z=0){
 const mesh=new T.Mesh(geo,typeof material==='string'?mat[material]:material);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);parts++;return mesh;
}
function block(parent,w,h,d,m,x=0,y=0,z=0,r=.012){
 return attach(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)),m,x,y,z);
}
function rod(parent,radius,length,m,x,y,z,segments=20){
 const o=attach(parent,new T.CylinderGeometry(radius,radius,length,segments),m,x,y,z);
 o.rotation.x=Math.PI/2;return o;
}
function hoop(parent,r,t,m,x,y,z,seg=32){
 return attach(parent,new T.TorusGeometry(r,t,8,seg),m,x,y,z);
}
function ball(parent,r,m,x,y,z,segments=12){
 return attach(parent,new T.SphereGeometry(r,segments,8),m,x,y,z);
}
// Each side panel is a genuine beveled polygon mesh, not a cluster of boxes.
// Contours are specified in profile coordinates (Z,Y) then extruded across X.
function sculpt(parent,outline,x,thickness,m,bevel=.014,name='armor panel'){
 const s=new T.Shape();
 outline.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));s.closePath();
 const mesh=attach(parent,new T.ExtrudeGeometry(s,{
  depth:thickness,steps:1,bevelEnabled:true,bevelThickness:bevel,
  bevelSize:bevel,bevelSegments:2,curveSegments:2}),m,x+thickness/2,0,0);
 mesh.rotation.y=-Math.PI/2;mesh.name=name;return mesh;
}
function beam(parent,a,b,w,h,m){
 const A=new T.Vector3(...a),B=new T.Vector3(...b);
 const dir=B.clone().sub(A);const mesh=block(parent,w,dir.length(),h,m,
  (A.x+B.x)/2,(A.y+B.y)/2,(A.z+B.z)/2,Math.min(w,h)*.22);
 mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
 return mesh;
}
function instancedCuboids(parent,placements,m){
 const geo=new RoundedBoxGeometry(1,1,1,1,.08);
 const im=new T.InstancedMesh(geo,mat[m],placements.length);
 const dummy=new T.Object3D();
 placements.forEach((p,i)=>{
  dummy.position.set(p[0],p[1],p[2]);
  dummy.scale.set(p[3],p[4],p[5]);dummy.rotation.set(p[6]||0,p[7]||0,p[8]||0);
  dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);
 });
 im.instanceMatrix.needsUpdate=true;im.castShadow=true;parent.add(im);parts++;
 return im;
}
function textDecal(lines,accent='#58dcf2'){
 const c=document.createElement('canvas');c.width=1024;c.height=256;
 const cx=c.getContext('2d');cx.clearRect(0,0,1024,256);
 cx.fillStyle='#d7f5fa';cx.font='900 126px Arial, sans-serif';
 cx.fillText(lines[0],18,139);
 cx.fillStyle=accent;cx.font='700 44px Arial, sans-serif';
 cx.fillText(lines[1]||'',24,214);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.97,depthWrite:false,side:T.DoubleSide});
 return material;
}
const lettering=textDecal(['AETHER 09','P H A N T O M   /   C F   0 9'],'#79eaff');
const smallDecal=textDecal(['Ø9 /  X','VECTRA · SYNTHESIS'],'#75e5f0');
// Silhouette: long floating chassis with rich overlapping shell sections.
const central=new T.Group();body.add(central);
sculpt(central,[[-.94,-.12],[-.83,.25],[-.35,.32],[.47,.28],[.63,.10],[.47,-.18],[-.10,-.24],[-.70,-.18]],
  0,.395,'core',.025,'sculpted receiver backbone');
sculpt(central,[[-.89,.13],[-.72,.28],[.15,.30],[.55,.18],[.47,.055],[.12,-.025],[-.62,-.045]],
  0,.28,'spine',.017,'structural lattice');
block(central,.39,.068,2.35,'spine',0,.278,-.65,.017);
// Twin crescent side-armor sections, carved from bespoke extrusion profiles.
for(const side of [-1,1]){
 const x=side*.245;
 sculpt(central,[[-.92,.08],[-.74,.265],[-.30,.30],[.21,.255],[.39,.125],[.27,-.024],[-.27,-.055],[-.59,.012]],
  x,.074,'armor',.018,'angular floating receiver plate');
 sculpt(central,[[-.85,.085],[-.62,.212],[-.35,.214],[-.43,.12],[-.65,.058]],
  side*.302,.014,'plate',.004,'raised upper armor crest');
 sculpt(central,[[.00,.21],[.18,.228],[.34,.132],[.215,.06],[-.02,.08]],
  side*.303,.016,'plate',.006,'receiver cheek');
 sculpt(central,[[-.24,-.072],[.17,-.064],[.27,-.132],[.06,-.175],[-.24,-.166]],
  side*.267,.024,'inset',.008,'lower inlaid underpanel');
 // Raised seam drawn in metal, and an underslung light detail.
 const m=block(central,.008,.026,.61,'trim',side*.334,.088,-.33,.003);
 m.rotation.x=.07;
 block(central,.016,.017,.45,'glow',side*.330,.043,-.37,.003);
 // A coherent decal mounted above the carbon inset.
 const text=attach(central,new T.PlaneGeometry(.57,.14),lettering,side*.343,.125,-.18);
 text.rotation.y=side*Math.PI/2;
 block(central,.022,.075,.08,'warning',side*.329,.18,.238,.006);
}
const upper=new T.Group();body.add(upper);
sculpt(upper,[[-2.15,.14],[-2.04,.30],[-1.52,.335],[-.95,.32],[-.79,.255],[-.89,.105],[-1.46,.035],[-2.03,.045]],
  0,.25,'core',.012,'monocoque outer forward');
sculpt(upper,[[-2.28,.10],[-2.15,.28],[-1.89,.35],[-1.15,.354],[-.89,.27],[-.93,.12],[-1.5,.00],[-2.16,.02]],
  0,.245,'spine',.017,'inner elongated frame');
for(const side of [-1,1]){
 sculpt(upper,[[-2.18,.16],[-2.05,.318],[-1.79,.345],[-1.24,.345],[-1.08,.31],[-1.15,.205],[-1.57,.115],[-2.10,.11]],
  side*.204,.058,'armor',.014,'faceted forward shield');
 sculpt(upper,[[-2.12,.206],[-1.93,.296],[-1.69,.293],[-1.67,.241],[-1.95,.172]],
  side*.259,.017,'plate',.006,'raised angled blade');
 sculpt(upper,[[-1.54,.30],[-1.21,.294],[-1.26,.225],[-1.48,.238]],
  side*.26,.012,'trim',.004,'top blade fin');
 // Deep sculpted lateral recess, punctuated by illuminated slots.
 sculpt(upper,[[-1.96,.115],[-1.72,.133],[-1.43,.170],[-1.31,.126],[-1.42,.090],[-1.79,.064]],
  side*.268,.008,'shadow',.003,'vent recess');
 const vents=[];
 for(let k=0;k<7;k++){
  let z=-1.88+k*.071;
  vents.push([side*.282,.121+k*.003,z,.009,.056,.034,-.12]);
 }
 instancedCuboids(upper,vents,'inset');
 for(let i=0;i<4;i++)block(upper,.016,.025,.037,'glow',side*.288,.183,-1.90+i*.16,.004);
}
for(let k=0;k<10;k++){
 const z=-2.03+k*.12;
 block(upper,.205,.016,.040,k%3===0?'plate':'inset',0,.366,z,.006);
}
const front=new T.Group();body.add(front);
// Purely fantastical photonic head: nested luminous light guides and vanes.
rod(front,.093,.71,'shadow',0,.157,-2.18);
rod(front,.078,.74,'trim',0,.157,-2.20);
rod(front,.066,.78,'core',0,.157,-2.23);
rod(front,.039,.83,'glowDeep',0,.157,-2.25,24);
for(let k=0;k<4;k++){
 const z=-2.10-k*.15;
 rod(front,.116,.055,'plate',0,.157,z,24);
 rod(front,.096,.06,'inset',0,.157,z-.003,24);
 const ring=hoop(front,.110,.010,'glow',0,.157,z-.028);
 ring.rotation.y=.12*k;
}
for(const side of [-1,1]){
 for(let k=0;k<4;k++){
  let z=-2.02-k*.165;
  let fin=block(front,.032,.082,.13,k%2?'plate':'armor',
   side*.13,.150,z,.012);
  fin.rotation.z=side*.18;
 }
}
const aperture=rod(front,.129,.058,'spine',0,.157,-2.56,32);
rod(front,.105,.065,'shadow',0,.157,-2.589,32);
const frontGlow=attach(front,new T.CircleGeometry(.061,32),'glowDeep',0,.157,-2.628);
frontGlow.rotation.y=Math.PI;
for(let a=0;a<8;a++){
 const t=a*Math.PI/4;
 const bit=block(front,.026,.030,.048,'trim',Math.sin(t)*.102,.157+Math.cos(t)*.102,-2.59,.006);
 bit.rotation.z=t;
}
const stock=new T.Group();body.add(stock);
// Skeletonized rear with a trapezoidal arch. Distinct from the previous cube stock.
for(const side of [-1,1]){
 sculpt(stock,[[.46,.19],[.68,.295],[1.33,.265],[1.57,.185],[1.50,.11],[1.03,.152],[.75,.075]],
  side*.176,.070,'armor',.016,'sculpted open-frame stock');
 beam(stock,[side*.17,.25,.55],[side*.19,.03,1.38],.057,.065,'plate');
 beam(stock,[side*.17,.12,.63],[side*.21,-.055,1.34],.044,.058,'spine');
 sculpt(stock,[[.81,.014],[1.09,.057],[1.29,.04],[1.33,-.052],[1.03,-.084]],
  side*.190,.041,'inset',.008,'rear brace pad');
 block(stock,.019,.024,.44,'glow',side*.226,.231,1.034,.005);
}
block(stock,.54,.47,.14,'rubber',0,.086,1.55,.058);
block(stock,.51,.37,.063,'armor',0,.09,1.62,.036);
for(let i=-2;i<=2;i++)block(stock,.41,.014,.012,'inset',0,.084+i*.056,1.665,.004);
// Decorative floating battery and core, not real operational components.
const reactor=new T.Group();body.add(reactor);
reactor.position.set(0,-.18,-.02);
block(reactor,.29,.35,.53,'shadow',0,0,.012,.037);
block(reactor,.23,.31,.45,'spine',0,0,.01,.033);
block(reactor,.18,.27,.35,'glass',0,0,.02,.026);
for(const side of [-1,1]){
 block(reactor,.020,.31,.50,'plate',side*.151,0,.01,.011);
 block(reactor,.027,.025,.38,'glow',side*.169,-.035,.01,.008);
}
for(let k=0;k<4;k++){
 const z=-.13+k*.091;
 block(reactor,.19,.027,.017,'glowDeep',0,-.01,z,.007);
}
const reactorGlyph=hoop(reactor,.087,.012,'glow',.0,0,-.245);
reactorGlyph.rotation.y=Math.PI/2;
const grip=new T.Group();body.add(grip);
// Stylized ergonomic game-prop grip, swept backward.
sculpt(grip,[[.24,-.15],[.49,-.155],[.60,-.26],[.78,-.65],[.65,-.80],[.46,-.75],[.31,-.48]],
  0,.225,'core',.027,'swept polymer grip');
for(const side of [-1,1]){
 sculpt(grip,[[.35,-.20],[.50,-.23],[.70,-.64],[.62,-.71],[.51,-.65]],
  side*.132,.041,'grip',.010,'grip inset');
 const ribs=[];
 for(let i=0;i<8;i++)ribs.push([side*.157,-.285-i*.044,.50+i*.025,.012,.011,.095,-.08]);
 instancedCuboids(grip,ribs,'plate');
}
// Upper optical visor: floating rectangular rings, decorated glass and lens.
const optic=new T.Group();body.add(optic);
optic.position.set(0,.43,-.36);
block(optic,.31,.072,.44,'shadow',0,0,0,.015);
block(optic,.37,.048,.48,'plate',0,.046,0,.013);
for(let side of [-1,1]){
 block(optic,.034,.22,.16,'armor',side*.160,.180,0,.011);
 block(optic,.026,.22,.033,'trim',side*.146,.177,-.084,.008);
 block(optic,.012,.14,.02,'glow',side*.172,.185,-.082,.003);
}
block(optic,.29,.045,.06,'plate',0,.30,0,.011);
const apertureVisor=block(optic,.247,.143,.018,'glass',0,.192,-.097,.008);
const centralRune=hoop(optic,.032,.0045,'glow',0,.190,-.108,32);
centralRune.rotation.y=0; // Visual light ring, not targeting instrumentation.
ball(optic,.006,'glowDeep',0,.19,-.113,10);
for(let z of [-.14,.13])for(const side of [-1,1])block(optic,.033,.024,.05,'warning',side*.116,.073,z,.008);
// Small ornamental top crowns and cable-like energy traces.
for(const side of [-1,1]){
 beam(body,[side*.16,.38,-.76],[side*.18,.40,-1.49],.022,.023,'trim');
 beam(body,[side*.14,.397,-.70],[side*.14,.42,-1.23],.018,.018,'glow');
 beam(body,[side*.18,-.01,-.62],[side*.18,-.17,-.36],.027,.021,'trim');
 const accent=block(body,.021,.032,.19,'warning',side*.235,.304,-.87,.006);
 accent.rotation.x=.17;
}
// Instanced micro fasteners reinforce the scale and surface richness.
const screws=[];
for(let side of [-1,1]){
 for(let z of [-.64,-.45,-.11,.13,.26])screws.push([side*.345,.18,z,.011,.011,.011]);
 for(let z=-2.04;z<-1.10;z+=.145)screws.push([side*.275,.290,z,.009,.010,.012]);
 for(let z of [.75,1.11,1.35])screws.push([side*.25,.25,z,.012,.012,.012]);
}
instancedCuboids(body,screws,'screws');
const indexDecal=attach(body,new T.PlaneGeometry(.23,.055),smallDecal,.345,.190,-.52);
indexDecal.rotation.y=Math.PI/2;
const indexDecal2=attach(body,new T.PlaneGeometry(.23,.055),smallDecal,-.345,.190,-.52);
indexDecal2.rotation.y=-Math.PI/2;
// Suspended wisps around the podium, intentionally subtle and GPU-cheap.
for(let i=0;i<8;i++){
 const a=i/8*Math.PI*2;
 const mark=block(stage,.03,.006,.16,'glow',2.14*Math.cos(a),-.791,2.14*Math.sin(a),.002);
 mark.rotation.y=-a;
}
// Batching only the tiny repeated decorations with instanced meshes.
// The large art geometry is intentionally separate for future material editing.

function applyFinish(which){
 const p=finishPalettes[which]||finishPalettes.midnight;
 for(const name of ['armor','plate','trim','spine','warning'])mat[name].color.setHex(p[name]);
 mat.glow.color.setHex(p.glow);mat.glow.emissive.setHex(p.glow);
 mat.glowDeep.color.setHex(p.deep);mat.glowDeep.emissive.setHex(p.deep);
 mat.glass.color.setHex(p.glass);
 mat.glow.emissiveIntensity=which==='eclipse'?2.5:2.1;
 $('finish-name').textContent=which.toUpperCase();
 document.documentElement.style.setProperty('--accent','#'+p.glow.toString(16).padStart(6,'0'));
 document.querySelectorAll('[data-finish]').forEach(b=>{
  const active=b.dataset.finish===which;b.classList.toggle('active',active);
  b.setAttribute('aria-pressed',String(active));
 });
}
document.querySelectorAll('[data-finish]').forEach(b=>b.addEventListener('click',()=>applyFinish(b.dataset.finish)));
const orbit={
 yaw:1.03,pitch:.29,distance:5.7,
 yawTarget:1.03,pitchTarget:.29,distTarget:5.7,
 auto:true,drag:false
};
const target=new T.Vector3(0,.12,-.39);
function resetView(){
 orbit.yawTarget=1.03;orbit.pitchTarget=.29;orbit.distTarget=5.7;
}
function setAuto(on){
 orbit.auto=on;const b=$('auto');
 b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
 b.textContent=on?'AUTO ROTATE: ON':'AUTO ROTATE: OFF';
}
$('auto').addEventListener('click',()=>setAuto(!orbit.auto));
$('reset').addEventListener('click',()=>{resetView();setAuto(false)});
$('canvas').addEventListener('dblclick',()=>resetView());
const pointers=new Map();let pinchLast=0;
function interact(){setAuto(false);}
canvas.addEventListener('pointerdown',e=>{
 canvas.setPointerCapture(e.pointerId);
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 orbit.drag=true;interact();
});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 const p=pointers.get(e.pointerId);
 const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(pointers.size===1){
  orbit.yawTarget-=dx*.0075;
  orbit.pitchTarget=T.MathUtils.clamp(orbit.pitchTarget+dy*.0055,-.62,1.25);
 }else if(pointers.size===2){
  const ps=[...pointers.values()],distance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
  if(pinchLast>0)orbit.distTarget=T.MathUtils.clamp(orbit.distTarget+(pinchLast-distance)*.008,3.2,9.2);
  pinchLast=distance;
 }
});
function pointerDone(e){
 pointers.delete(e.pointerId);
 orbit.drag=pointers.size>0;
 if(pointers.size<2)pinchLast=0;
}
canvas.addEventListener('pointerup',pointerDone);
canvas.addEventListener('pointercancel',pointerDone);
canvas.addEventListener('wheel',e=>{
 e.preventDefault();interact();
 orbit.distTarget=T.MathUtils.clamp(orbit.distTarget+Math.sign(e.deltaY)*.34,3.2,9.2);
},{passive:false});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')setAuto(false);
 if(e.key.toLowerCase()==='r')resetView();
 if(e.key==='1')applyFinish('midnight');
 if(e.key==='2')applyFinish('glacier');
 if(e.key==='3')applyFinish('eclipse');
});
function resize(){
 const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,Math.max(1.0,innerWidth<700?1.45:1.85)));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();
applyFinish('midnight');
$('mesh-count').textContent=String(parts);
loading.hidden=true;
let previous=performance.now();
function animate(ms){
 requestAnimationFrame(animate);
 const dt=Math.min(.075,Math.max(0,(ms-previous)/1000));previous=ms;
 if(document.hidden)return;
 if(orbit.auto&&!orbit.drag)orbit.yawTarget+=dt*.155;
 const easing=1-Math.exp(-dt*8.8);
 orbit.yaw+= (orbit.yawTarget-orbit.yaw)*easing;
 orbit.pitch+= (orbit.pitchTarget-orbit.pitch)*easing;
 orbit.distance+= (orbit.distTarget-orbit.distance)*easing;
 camera.position.set(
  target.x+orbit.distance*Math.sin(orbit.yaw)*Math.cos(orbit.pitch),
  target.y+orbit.distance*Math.sin(orbit.pitch),
  target.z+orbit.distance*Math.cos(orbit.yaw)*Math.cos(orbit.pitch));
 camera.lookAt(target);
 const breathe=1+.035*Math.sin(ms*.002);
 mat.glowDeep.emissiveIntensity=3.3*breathe;
 halo.material.opacity=.55+.08*Math.sin(ms*.0012);
 reactorGlyph.rotation.z=ms*.0003;
 centralRune.rotation.z=ms*.00015;
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
document.addEventListener('visibilitychange',()=>{previous=performance.now()});
