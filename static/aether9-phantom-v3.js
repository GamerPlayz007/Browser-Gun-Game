/**
 * CROSSFire / AETHER-9 : PHANTOM EDITION V3
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
 const m=new T.MeshPhysicalMaterial({name,color:c,metalness:metal,roughness:rough,
  clearcoat: name.includes('plate')?.17:name.includes('armor')?.24:.07,
  clearcoatRoughness:.32,...extras});return m;
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

// V2 / PBR surface pipeline: repeatable, generated maps for sculpted metals.
// Normal maps add the fine grain/scratch response absent from V1; roughness
// maps keep surfaces from reflecting like a uniform layer of plastic.
function makeSurfaceMapsV2(style,seed0){
 const size=256, heights=new Float32Array(size*size);
 let rng=seed0>>>0;
 const random=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
 const scratches=[];
 for(let i=0;i<(style==='metal'?26:style==='ceramic'?9:13);i++){
  scratches.push({y:random()*size,x:random()*size,len:28+random()*140,str:random()*.33+.05});
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let grain=(random()-.5)*.11;
  if(style==='metal')grain+=.21*Math.sin(y*.90)+.065*Math.sin(y*2.9)+.035*Math.sin(x*.13);
  else if(style==='ceramic')grain+=.13*Math.sin(x*.06+y*.16)+.065*Math.sin(x*.25);
  else grain+=.22*Math.sin(x*.52)*Math.sin(y*.45);
  for(const line of scratches){
   const dx=x-line.x,dy=y-line.y;
   const dist=style==='metal'?Math.abs(dy-.02*dx):Math.abs(dy-.32*dx);
   if(dx>-line.len*.5&&dx<line.len*.5&&dist<.8)grain-=line.str*(1-dist/.8);
  }
  heights[y*size+x]=grain;
 }
 function canvasTex(data,repeatX=2.5,repeatY=2){
  const c=document.createElement('canvas');c.width=size;c.height=size;
  const ctx=c.getContext('2d');
  const image=ctx.createImageData(size,size);
  image.data.set(data);ctx.putImageData(image,0,0);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;
  t.repeat.set(repeatX,repeatY);t.colorSpace=T.NoColorSpace;
  t.anisotropy=4;t.needsUpdate=true;
  return t;
 }
 const normals=new Uint8ClampedArray(size*size*4);
 const roughness=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,k=i*4;
  const left=heights[y*size+((x+size-1)%size)],right=heights[y*size+((x+1)%size)];
  const up=heights[((y+size-1)%size)*size+x],down=heights[((y+1)%size)*size+x];
  const gain=style==='polymer'?1.25:.64;
  const nx=(left-right)*gain,ny=(up-down)*gain,inv=1/Math.hypot(nx,ny,1);
  normals[k]=Math.round(127.5+127.5*nx*inv);
  normals[k+1]=Math.round(127.5+127.5*ny*inv);
  normals[k+2]=Math.round(127.5+127.5*inv);normals[k+3]=255;
  const value=Math.max(0,Math.min(255,Math.round(
   (style==='metal'?.65:style==='ceramic'?.82:.86)*255+
   heights[i]*(style==='metal'?48:38))));
  roughness[k]=roughness[k+1]=roughness[k+2]=value;roughness[k+3]=255;
 }
 return {normal:canvasTex(normals),rough:canvasTex(roughness)};
}
const surfaceMapsV2={
 armor:makeSurfaceMapsV2('ceramic',7913),
 metal:makeSurfaceMapsV2('metal',25601),
 grip:makeSurfaceMapsV2('polymer',34067)
};
for(const n of ['armor','core','spine','plate','trim','grip','inset']){
 const family=n==='armor'||n==='inset'?'armor':n==='grip'?'grip':'metal';
 const maps=surfaceMapsV2[family];
 mat[n].normalMap=maps.normal;mat[n].roughnessMap=maps.rough;
 mat[n].normalScale=new T.Vector2(
  n==='armor'?.29:n==='grip'?.37:.20,
  n==='armor'?.29:n==='grip'?.37:.20);
 mat[n].roughness=n==='grip'?.92:n==='armor'?.67:n==='plate'?.44:n==='trim'?.36:.61;
 mat[n].envMapIntensity=n==='grip'?.24:n==='armor'?.85:1.35;
 mat[n].needsUpdate=true;
}
mat.armor.clearcoat=.22;mat.plate.clearcoat=.14;
mat.glass.envMapIntensity=1.5;
// Broad virtual softboxes reflected through a PMREM studio environment.
function buildStudioEnvironmentV2(){
 const c=document.createElement('canvas');c.width=1024;c.height=512;
 const ctx=c.getContext('2d');
 const grad=ctx.createLinearGradient(0,0,0,512);
 grad.addColorStop(0,'#7f9eb4');grad.addColorStop(.34,'#243c52');
 grad.addColorStop(.62,'#102333');grad.addColorStop(1,'#07121e');
 ctx.fillStyle=grad;ctx.fillRect(0,0,1024,512);
 function softBox(x,y,w,h,rgb,alpha=.9){
  const g=ctx.createLinearGradient(x,y,x+w,y);
  g.addColorStop(0,'rgba('+rgb+',0)');
  g.addColorStop(.16,'rgba('+rgb+','+(alpha*.75)+')');
  g.addColorStop(.5,'rgba('+rgb+','+alpha+')');
  g.addColorStop(.85,'rgba('+rgb+','+(alpha*.75)+')');
  g.addColorStop(1,'rgba('+rgb+',0)');
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
 }
 softBox(65,62,80,230,'235,247,255',.93);
 softBox(225,105,43,190,'191,229,255',.88);
 softBox(490,58,95,220,'255,224,198',.90);
 softBox(715,105,125,185,'117,204,255',.79);
 softBox(910,72,48,215,'231,242,255',.84);
 const tex=new T.CanvasTexture(c);
 tex.colorSpace=T.SRGBColorSpace;tex.mapping=T.EquirectangularReflectionMapping;
 const generator=new T.PMREMGenerator(renderer);
 const env=generator.fromEquirectangular(tex);
 scene.environment=env.texture;scene.environmentIntensity=.91;
 tex.dispose();generator.dispose();
 return env;
}
const studioEnvironmentV2=buildStudioEnvironmentV2();
// An artist-directed contact shadow gives the floating sci-fi prop weight.
function addContactShadowV2(){
 const c=document.createElement('canvas');c.width=c.height=256;
 const ctx=c.getContext('2d');
 const gradient=ctx.createRadialGradient(128,128,8,128,128,127);
 gradient.addColorStop(0,'rgba(1,8,14,.72)');
 gradient.addColorStop(.48,'rgba(3,11,20,.39)');
 gradient.addColorStop(1,'rgba(3,11,20,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
 const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;
 const sh=new T.Mesh(new T.PlaneGeometry(4.55,2.1),
  new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,
   opacity:.7,polygonOffset:true,polygonOffsetFactor:-1}));
 sh.rotation.x=-Math.PI/2;sh.position.set(0,-.777,-.45);
 stage.add(sh);return sh;
}
const contactShadowV2=addContactShadowV2();

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

// V2 / silhouette refinement: properly connected, tapered cross-section
// surfaces rather than stacking more isolated rectangular blocks.
// The bespoke hull interpolates a sequence of designer-defined profile rings.
function loftHullV2(parent,frames,material,name){
 const contour=[
  [-.68,-.82],[-.94,-.64],[-1,-.28],[-1,.23],
  [-.88,.50],[-.46,.78],[-.19,.89],[.19,.89],
  [.46,.78],[.88,.50],[1,.23],[1,-.28],
  [.94,-.64],[.68,-.82]
 ];
 const ringCount=contour.length,positions=[],uvs=[],indices=[];
 frames.forEach((f,fi)=>{
  contour.forEach(([px,py],j)=>{
   positions.push((f.x||0)+px*f.w,f.y+py*f.h,f.z);
   uvs.push(j/(ringCount-1),fi/(frames.length-1));
  });
 });
 for(let fi=0;fi<frames.length-1;fi++)for(let j=0;j<ringCount;j++){
  const j2=(j+1)%ringCount;
  const a=fi*ringCount+j,b=fi*ringCount+j2;
  const c=(fi+1)*ringCount+j,d=(fi+1)*ringCount+j2;
  // Outward facing triangles for the clockwise XY cross-section.
  indices.push(a,b,c,b,d,c);
 }
 for(const end of [0,frames.length-1]){
  const f=frames[end],idx=positions.length/3;
  positions.push(f.x||0,f.y,f.z);uvs.push(.5,end);
  for(let j=0;j<ringCount;j++){
   const a=end*ringCount+j,b=end*ringCount+(j+1)%ringCount;
   if(end===0)indices.push(idx,b,a);else indices.push(idx,a,b);
  }
 }
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 const shell=attach(parent,geo,material);
 shell.name=name;shell.castShadow=true;return shell;
}
// Sweeping dorsal shell, with a continuous crown and tapered facets.
// This carries the Phantom silhouette at ordinary camera distance.
const V2Armor=new T.Group();body.add(V2Armor);V2Armor.name='PHANTOM V2 / sculpted armor';
loftHullV2(V2Armor,[
 {z:.43,w:.18,y:.343,h:.064},{z:.22,w:.25,y:.373,h:.083},
 {z:-.05,w:.295,y:.396,h:.098},{z:-.38,w:.316,y:.405,h:.104},
 {z:-.82,w:.319,y:.412,h:.099},{z:-1.18,w:.305,y:.429,h:.085},
 {z:-1.55,w:.284,y:.438,h:.079},{z:-1.88,w:.250,y:.425,h:.071},
 {z:-2.17,w:.157,y:.367,h:.057},{z:-2.29,w:.093,y:.326,h:.031}
],'armor','Continuous forged-carbon dorsal canopy');
// Raised central titanium ridge and low-profile luminous channel.
const ridgeV2=new T.CatmullRomCurve3([
 new T.Vector3(0,.425,.38),new T.Vector3(0,.492,-.16),
 new T.Vector3(0,.509,-.70),new T.Vector3(0,.501,-1.35),
 new T.Vector3(0,.468,-1.92),new T.Vector3(0,.394,-2.19)
]);
attach(V2Armor,new T.TubeGeometry(ridgeV2,64,.014,7,false),'trim');
const ridgeLightV2=new T.CatmullRomCurve3([
 new T.Vector3(0,.511,-.15),new T.Vector3(0,.532,-.48),
 new T.Vector3(0,.531,-1.01),new T.Vector3(0,.516,-1.50),
 new T.Vector3(0,.479,-1.90)
]);
attach(V2Armor,new T.TubeGeometry(ridgeLightV2,54,.0065,6,false),'glow');
// Articulated blade-like side cheekpieces with real open geometric cutouts.
function perforatedWingV2(side){
 const outline=[
  [-1.97,.245],[-1.75,.365],[-1.27,.363],[-.99,.31],
  [-.86,.18],[-1.04,.095],[-1.44,.123],[-1.86,.128]
 ];
 const shape=new T.Shape();
 outline.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));
 shape.closePath();
 for(let k=0;k<4;k++){
  const z=-1.72+k*.175;
  const hole=new T.Path();
  hole.absellipse(z,.244,.045,.024,0,Math.PI*2,false,0);
  shape.holes.push(hole);
 }
 const geo=new T.ExtrudeGeometry(shape,{
  depth:.025,bevelEnabled:true,bevelSize:.009,bevelThickness:.011,
  bevelSegments:3,curveSegments:14});
 const panel=attach(V2Armor,geo,'plate',side*.313,0,0);
 panel.rotation.y=-Math.PI/2;
 panel.name='Perforated titanium aero cheekpiece';
 // Light visible behind the actual holes, not painted-on faux vents.
 const inset=block(V2Armor,.011,.13,.76,'shadow',side*.347,.252,-1.49,.004);
 inset.rotation.x=.045;
 for(let k=0;k<4;k++){
  const z=-1.72+k*.175;
  const light=ball(V2Armor,.012,'glow',side*.365,.243,z,10);
  light.scale.set(.32,.75,1.15);
 }
 const tracerPoints=[
  [side*.37,.176,-1.87],[side*.365,.168,-1.69],
  [side*.362,.158,-1.45],[side*.355,.150,-1.24]
 ].map(p=>new T.Vector3(...p));
 attach(V2Armor,new T.TubeGeometry(new T.CatmullRomCurve3(tracerPoints),
  26,.0075,6,false),'glow');
}
perforatedWingV2(-1);perforatedWingV2(1);
// Rear spine, shaped as continuous frame rather than disconnected box supports.
for(const side of [-1,1]){
 loftHullV2(V2Armor,[
  {z:.38,w:.063,x:side*.20,y:.28,h:.034},
  {z:.65,w:.079,x:side*.21,y:.31,h:.051},
  {z:1.05,w:.072,x:side*.205,y:.305,h:.043},
  {z:1.43,w:.066,x:side*.216,y:.254,h:.035},
  {z:1.57,w:.053,x:side*.23,y:.196,h:.034}
 ],'spine','Full-length continuous rear structural rail');
 const curve=new T.CatmullRomCurve3([
  new T.Vector3(side*.225,.353,.66),
  new T.Vector3(side*.245,.355,1.02),
  new T.Vector3(side*.245,.300,1.41)
 ]);
 attach(V2Armor,new T.TubeGeometry(curve,28,.011,6,false),'trim');
}
// Recessed negative-space faceplate and long uninterrupted titanium blades.
for(const side of [-1,1]){
 sculpt(V2Armor,[[-.91,.185],[-.67,.300],[-.17,.292],
  [.29,.230],[.43,.126],[.25,.044],[-.22,.071],[-.77,.098]],
  side*.352,.021,'inset',.011,'V2 shadow channel');
 sculpt(V2Armor,[[-.73,.292],[-.44,.310],[-.15,.270],
  [-.13,.231],[-.47,.241]],side*.377,.023,'plate',.009,
  'Blade-cut inset bronze titanium');
 for(let k=0;k<3;k++){
  const z=-.64+k*.195;
  const cut=block(V2Armor,.019,.016,.070,'warning',
   side*.390,.306,z,.004);
  cut.rotation.x=-.23;
 }
}
// A faceted translucent inner core; glowing strips remain behind its glass.
const V2Reactor=new T.Group();body.add(V2Reactor);
V2Reactor.name='PHANTOM V2 / laminated lightguide';
V2Reactor.position.set(0,-.188,-.025);
const inner=block(V2Reactor,.183,.275,.405,'glowDeep',0,0,.020,.03);
inner.scale.y=.86;
const shellLeft=block(V2Reactor,.047,.30,.46,'glass',-.100,0,.020,.026);
const shellRight=block(V2Reactor,.047,.30,.46,'glass',.100,0,.020,.026);
shellLeft.rotation.z=-.05;shellRight.rotation.z=.05;
for(const y of [-.102,-.035,.032,.099]){
 block(V2Reactor,.242,.021,.024,'trim',0,y,.210,.004);
}
const V2Emissive=new T.MeshBasicMaterial({color:0x5af4ff,transparent:true,
 opacity:.36,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
function glowTextureV2(){
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d');
 const glow=ctx.createRadialGradient(64,64,3,64,64,64);
 glow.addColorStop(0,'rgba(255,255,255,.95)');
 glow.addColorStop(.30,'rgba(170,226,255,.36)');
 glow.addColorStop(1,'rgba(70,160,230,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
const haloTextureV2=glowTextureV2();
const haloMaterialV2=new T.SpriteMaterial({map:haloTextureV2,color:0x4ce7ff,
 transparent:true,opacity:.19,blending:T.AdditiveBlending,depthWrite:false});
const lightHaloV2=new T.Sprite(haloMaterialV2);
lightHaloV2.scale.set(.95,.65,1);
lightHaloV2.position.set(0,-.18,.0);body.add(lightHaloV2);
// Small image-backed screen graphics make details intentional up close.
function surfaceGraphicV2(title,subtitle,color='#d6f8fc'){
 const c=document.createElement('canvas');c.width=512;c.height=256;
 const ctx=c.getContext('2d');
 ctx.clearRect(0,0,512,256);
 ctx.fillStyle='rgba(4,21,33,.82)';ctx.fillRect(0,0,512,256);
 ctx.strokeStyle='rgba(146,239,255,.75)';ctx.lineWidth=5;
 ctx.strokeRect(7,7,498,242);
 for(let i=0;i<18;i++){
  ctx.strokeStyle=i%3?'rgba(58,151,171,.25)':'rgba(113,229,246,.5)';
  ctx.beginPath();ctx.moveTo(30+i*25,30);ctx.lineTo(30+i*25,54);ctx.stroke();
 }
 ctx.fillStyle=color;ctx.font='bold 61px Arial';ctx.fillText(title,29,137);
 ctx.fillStyle='#83b5c2';ctx.font='bold 23px Arial';ctx.fillText(subtitle,30,197);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
 return new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,
  side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
}
const readoutV2=surfaceGraphicV2('P H / 09','AETHER · PHANTOM EDITION');
for(const side of [-1,1]){
 const screen=attach(body,new T.PlaneGeometry(.38,.19),readoutV2,
  side*.409,.125,-.365);
 screen.rotation.y=side*Math.PI/2;
}
// Concentric low-intensity stage rings for a cleaner, premium presentation.
for(let i=0;i<3;i++){
 const rr=1.52+i*.155;
 const ring=attach(stage,new T.RingGeometry(rr,rr+.007,84),
  new T.MeshBasicMaterial({color:i===1?0x3b8ba4:0x275569,
   transparent:true,opacity:i===1?.45:.22,side:T.DoubleSide,
   depthWrite:false}),0,-.774,-.26);
 ring.rotation.x=-Math.PI/2;
}


/** PHANTOM V3 / MONOLITH
 * New coherent science-fiction game-art shell.
 * Original visual design with no real-world mechanical significance.
 */
central.visible=false;upper.visible=false;stock.visible=false;
optic.visible=false;V2Armor.visible=false;
const monolith=new T.Group();monolith.name='MONOLITH V3 / custom shell';
body.add(monolith);
const v3Micro=new T.Group();v3Micro.name='MONOLITH / fine details';
monolith.add(v3Micro);
const v3M={
 shell:new T.MeshPhysicalMaterial({color:0x263e4b,metalness:.21,
  roughness:.64,clearcoat:.24,clearcoatRoughness:.39,
  normalMap:surfaceMapsV2.armor.normal,normalScale:new T.Vector2(.20,.20),
  roughnessMap:surfaceMapsV2.armor.rough,side:T.DoubleSide,envMapIntensity:.72}),
 metal:new T.MeshPhysicalMaterial({color:0x668a98,metalness:.85,
  roughness:.39,clearcoat:.16,clearcoatRoughness:.29,
  normalMap:surfaceMapsV2.metal.normal,normalScale:new T.Vector2(.16,.16),
  roughnessMap:surfaceMapsV2.metal.rough,side:T.DoubleSide,envMapIntensity:1.4}),
 polymer:new T.MeshPhysicalMaterial({color:0x16232c,metalness:.11,
  roughness:.87,normalMap:surfaceMapsV2.grip.normal,
  normalScale:new T.Vector2(.31,.31),side:T.DoubleSide}),
 void:new T.MeshStandardMaterial({color:0x091824,roughness:.84,
  metalness:.36,side:T.DoubleSide}),
 glow:new T.MeshBasicMaterial({color:0x56eaff,toneMapped:false,
  side:T.DoubleSide})
};
function v3Line(parent,points,thickness,material){
 return attach(parent,new T.TubeGeometry(
  new T.CatmullRomCurve3(points.map(x=>new T.Vector3(...x))),
  45,thickness,7,false),material);
}
// One continuous shell governs the entire silhouette, rather than
// hundreds of independent mechanical-looking slabs.
loftHullV2(monolith,[
 {z:.55,w:.116,y:.170,h:.115},{z:.35,w:.200,y:.177,h:.159},
 {z:.08,w:.270,y:.180,h:.184},{z:-.27,w:.294,y:.180,h:.188},
 {z:-.67,w:.302,y:.191,h:.186},{z:-1.10,w:.283,y:.202,h:.175},
 {z:-1.52,w:.243,y:.216,h:.158},{z:-1.92,w:.196,y:.197,h:.140},
 {z:-2.19,w:.147,y:.179,h:.114},{z:-2.42,w:.067,y:.167,h:.047}
],v3M.shell,'MONOLITH / one continuous outer body');
loftHullV2(monolith,[
 {z:.51,w:.070,y:.308,h:.057},{z:.18,w:.121,y:.371,h:.075},
 {z:-.41,w:.130,y:.382,h:.072},{z:-1.12,w:.114,y:.364,h:.059},
 {z:-1.75,w:.083,y:.336,h:.051},{z:-2.28,w:.031,y:.267,h:.024}
],v3M.metal,'MONOLITH / unified brushed titanium crown');
v3Line(monolith,[
 [0,.407,.36],[0,.454,-.12],[0,.460,-.59],
 [0,.441,-1.07],[0,.399,-1.56],[0,.356,-1.93],[0,.302,-2.27]
],.007,mat.glow);
// Three true cutouts on each aerodynamic flank, not surface-painted vents.
for(const side of [-1,1]){
 const shape=new T.Shape();
 const edges=[[-2.13,.18],[-1.94,.323],[-1.74,.342],
  [-1.39,.327],[-1.07,.308],[-.97,.240],[-1.14,.126],
  [-1.52,.099],[-1.99,.098]];
 edges.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));
 shape.closePath();
 for(let k=0;k<3;k++){
  const opening=new T.Path();
  opening.absellipse(-1.84+k*.29,.220,.065,.030,
   0,Math.PI*2,false,0);shape.holes.push(opening);
 }
 const cheek=attach(monolith,new T.ExtrudeGeometry(shape,{
  depth:.032,bevelEnabled:true,bevelSize:.011,
  bevelThickness:.009,bevelSegments:3,curveSegments:16
 }),v3M.metal,side*.266,0,0);
 cheek.rotation.y=-Math.PI/2;
 cheek.name='MONOLITH / genuine perforated aero panel';
 block(monolith,.012,.121,.82,v3M.void,
  side*.297,.206,-1.58,.004);
 // Main lower plane: one broad intentional shield and one lightline.
 sculpt(monolith,[
  [-.92,.157],[-.63,.260],[-.19,.260],[.27,.214],
  [.34,.138],[.10,.078],[-.52,.074]
 ],side*.311,.030,v3M.metal,.013,
 'MONOLITH / single large contoured side plate');
 v3Line(monolith,[
  [side*.355,.092,-.84],[side*.356,.080,-.50],
  [side*.353,.081,-.23],[side*.344,.108,.12]
 ],.0075,mat.glow);
 for(let k=0;k<3;k++){
  const dot=ball(v3Micro,.012,'glow',
   side*.317,.220,-1.84+k*.29,10);
  dot.scale.set(.32,.80,1);
 }
 const mark=attach(v3Micro,new T.PlaneGeometry(.47,.15),
  surfaceGraphicV2('PH / 09','M O N O L I T H'),
  side*.375,.165,-.31);
 mark.rotation.y=side*Math.PI/2;
}
// Reinvented open rear stock: long, elegant cantilever instead of a block.
const rearV3=new T.Group();monolith.add(rearV3);
rearV3.name='MONOLITH / architectural skeletal rear';
for(const side of [-1,1]){
 loftHullV2(rearV3,[
  {z:.40,x:side*.198,w:.051,y:.247,h:.044},
  {z:.73,x:side*.209,w:.064,y:.286,h:.050},
  {z:1.07,x:side*.212,w:.062,y:.285,h:.053},
  {z:1.39,x:side*.221,w:.049,y:.240,h:.038},
  {z:1.58,x:side*.218,w:.036,y:.190,h:.032}
 ],v3M.shell,'MONOLITH / continuous rear cantilever');
 v3Line(rearV3,[
  [side*.225,.338,.57],[side*.234,.348,.96],
  [side*.236,.326,1.26],[side*.224,.258,1.52]
 ],.013,v3M.metal);
 v3Line(rearV3,[
  [side*.199,.095,.50],[side*.211,.069,.89],
  [side*.219,.045,1.15],[side*.225,.143,1.51]
 ],.026,v3M.metal);
 v3Line(rearV3,[
  [side*.243,.295,.75],[side*.250,.290,1.04],
  [side*.252,.263,1.38]
 ],.006,mat.glow);
}
block(rearV3,.50,.31,.14,v3M.polymer,0,.157,1.58,.032);
// The optical crown now sits integrated into the top shape.
const visorV3=new T.Group();monolith.add(visorV3);
visorV3.position.set(0,.392,-.41);
visorV3.name='MONOLITH / integrated visor';
block(visorV3,.35,.053,.43,v3M.void,0,-.006,0,.010);
block(visorV3,.292,.027,.37,v3M.metal,0,.028,0,.008);
for(const side of [-1,1]){
 block(visorV3,.028,.112,.15,v3M.shell,side*.148,.095,-.032,.008);
 block(visorV3,.010,.056,.015,v3M.glow,side*.156,.105,-.115,.003);
}
block(visorV3,.276,.030,.083,v3M.metal,0,.172,-.038,.008);
block(visorV3,.235,.132,.020,'glass',0,.104,-.117,.013);
hoop(visorV3,.033,.005,'glow',0,.104,-.139,32);
ball(visorV3,.008,'glowDeep',0,.104,-.148,10);
// A floating photonic centerpiece with substantial visible negative space.
const cradleV3=new T.Group();monolith.add(cradleV3);
for(const side of [-1,1]){
 loftHullV2(cradleV3,[
  {z:.25,x:side*.177,w:.038,y:-.02,h:.038},
  {z:.12,x:side*.187,w:.048,y:-.163,h:.053},
  {z:-.06,x:side*.190,w:.050,y:-.28,h:.047},
  {z:-.30,x:side*.169,w:.042,y:-.120,h:.037},
  {z:-.52,x:side*.154,w:.027,y:-.016,h:.029}
 ],v3M.metal,'MONOLITH / arched lightguide cradle');
 v3Line(cradleV3,[
  [side*.212,-.139,.12],[side*.223,-.276,-.06],
  [side*.214,-.153,-.28],[side*.176,-.044,-.45]
 ],.008,mat.glow);
}
const shimmerV3=new T.Sprite(new T.SpriteMaterial({
 map:haloTextureV2,color:0x4ee3ff,transparent:true,opacity:.15,
 blending:T.AdditiveBlending,depthWrite:false}));
shimmerV3.position.set(0,-.17,-.03);shimmerV3.scale.set(.88,.56,1);
monolith.add(shimmerV3);

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
 v3M.shell.color.setHex(p.armor);v3M.metal.color.setHex(p.plate);
 v3M.glow.color.setHex(p.glow);
 shimmerV3.material.color.setHex(p.glow);
 v3M.shell.needsUpdate=true;v3M.metal.needsUpdate=true;

 // V2 transparent reactor glass, halo and engraved readout harmonize with finish.
 const glowHex=p.glow;
 haloMaterialV2.color.setHex(glowHex);
 V2Emissive.color.setHex(glowHex);
 mat.armor.needsUpdate=mat.plate.needsUpdate=true;

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

const viewsV2={
 hero:{yaw:1.03,pitch:.28,dist:5.95,focus:[0,.13,-.42]},
 profile:{yaw:Math.PI/2,pitch:.08,dist:5.55,focus:[0,.12,-.46]},
 sculpt:{yaw:1.42,pitch:.41,dist:4.15,focus:[0,.27,-1.14]},
 core:{yaw:1.25,pitch:.16,dist:3.25,focus:[0,-.09,-.03]},
 back:{yaw:Math.PI*1.56,pitch:.18,dist:4.50,focus:[0,.20,.85]},
 visor:{yaw:1.02,pitch:.34,dist:3.22,focus:[0,.47,-.45]}
};
const targetFocusV2=new T.Vector3(0,.12,-.39);
function setViewV2(name){
 const view=viewsV2[name]||viewsV2.hero;
 orbit.yawTarget=view.yaw;orbit.pitchTarget=view.pitch;
 orbit.distTarget=view.dist;
 targetFocusV2.set(...view.focus);
 if(name!=='hero')setAuto(false);
 document.querySelectorAll('[data-view]').forEach(b=>{
  const active=b.dataset.view===name;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
}
document.querySelectorAll('[data-view]').forEach(b=>
 b.addEventListener('click',()=>setViewV2(b.dataset.view)));

let dramaticLightV3=false;
function setDramaticLightV3(on){
 dramaticLightV3=on;
 key.intensity=on?2.55:4.4;
 rim.intensity=on?5.3:3.9;
 fill.intensity=on?.45:2;
 scene.environmentIntensity=on?.42:(qualityHighV2?.95:.68);
 renderer.toneMappingExposure=on?1.49:(qualityHighV2?1.37:1.24);
 const button=$('lighting');
 if(button){
  button.classList.toggle('active',on);
  button.textContent=on?'LIGHT: DRAMATIC':'LIGHT: STUDIO';
  button.setAttribute('aria-pressed',String(on));
 }
}
$('lighting').addEventListener('click',()=>setDramaticLightV3(!dramaticLightV3));

let qualityHighV2=true;
function setQualityV2(high){
 qualityHighV2=high;
 renderer.shadowMap.enabled=high;
 v3Micro.visible=high;
 scene.environmentIntensity=dramaticLightV3?.42:(high?.95:.68);
 renderer.toneMappingExposure=dramaticLightV3?1.49:(high?1.37:1.24);
 resize();
 const btn=$('quality');
 btn.classList.toggle('active',high);
 btn.textContent=high?'QUALITY: STUDIO':'QUALITY: LIGHT';
 btn.setAttribute('aria-pressed',String(high));
}
$('quality').addEventListener('click',()=>setQualityV2(!qualityHighV2));

function resetView(){
 setViewV2('hero');
 orbit.yawTarget=viewsV2.hero.yaw;orbit.pitchTarget=viewsV2.hero.pitch;
 orbit.distTarget=viewsV2.hero.dist;
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
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,qualityHighV2?(innerWidth<700?1.5:1.8):1.0));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();
applyFinish('midnight');
setViewV2('hero');
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
 target.lerp(targetFocusV2,easing);
 camera.position.set(
  target.x+orbit.distance*Math.sin(orbit.yaw)*Math.cos(orbit.pitch),
  target.y+orbit.distance*Math.sin(orbit.pitch),
  target.z+orbit.distance*Math.cos(orbit.yaw)*Math.cos(orbit.pitch));
 camera.lookAt(target);
 const breathe=1+.035*Math.sin(ms*.002);
 mat.glowDeep.emissiveIntensity=3.3*breathe;
 haloMaterialV2.opacity=.16+.043*Math.sin(ms*.0017);
 lightHaloV2.scale.set(.92+.055*Math.sin(ms*.0015),.60+.035*Math.sin(ms*.0013),1);
 halo.material.opacity=.55+.08*Math.sin(ms*.0012);
 reactorGlyph.rotation.z=ms*.0003;
 centralRune.rotation.z=ms*.00015;
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
document.addEventListener('visibilitychange',()=>{previous=performance.now()});
