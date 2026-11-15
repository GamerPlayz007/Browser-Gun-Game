import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {topAt} from './physics.js';
import {createStage5VisualLayer} from './stage5_visual_layer.js';
import {createStage6VisualLayer} from './stage6_visual_layer.js';

// 02.5: deterministic CanvasTexture PBR atlases + district/LOD mesh batching.
// Only map.boxes are authoritative colliders. All map.features and map.decor
// are purely visual. The rendering pipeline never changes simulation geometry.
const TAU=Math.PI*2;
const PAINT={cyan:'#38eff7',magenta:'#ff4b9e',amber:'#ffb454',white:'#c8f8ff'};
const MATERIALS={
 facade:{color:'#364657',metalness:.23,roughness:.77,emissive:'#bbdfff',glow:.90},
 concrete:{color:'#667281',metalness:.10,roughness:.86},
 dark:{color:'#344556',metalness:.24,roughness:.75},
 road:{color:'#45515d',metalness:.08,roughness:.88},
 asphalt:{color:'#414a53',metalness:.12,roughness:.82},
 metal:{color:'#a9afb8',metalness:.73,roughness:.43},
 grate:{color:'#a5a9aa',metalness:.82,roughness:.51},
 rust:{color:'#8f7873',metalness:.69,roughness:.67},
 wood:{color:'#ab9080',metalness:.02,roughness:.83},
 pale:{color:'#9db1c5',metalness:.19,roughness:.53},
 glass:{color:'#6cb3d5',metalness:.6,roughness:.22,emissive:'#72c6fd',glow:.13},
 tile:{color:'#b7bccb',metalness:.58,roughness:.23},
 garden:{color:'#7cae8d',metalness:0,roughness:.92},
 leather:{color:'#77626e',metalness:.08,roughness:.64},
 cyan:{color:PAINT.cyan,glow:2.7},magenta:{color:PAINT.magenta,glow:2.7},
 amber:{color:PAINT.amber,glow:2.7},white:{color:PAINT.white,glow:2.1}
};
const NEON=new Set(['cyan','magenta','amber','white']);
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function makeCanvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function atlas(style,size=1024){
 const maps=Array.from({length:4},()=>makeCanvas(size));
 const ctx=maps.map(c=>c.getContext('2d'));
 const r=random(style.split('').reduce((v,ch)=>v*33+ch.charCodeAt(0),12687)>>>0);
 const base={facade:[38,52,72],concrete:[77,86,99],dark:[31,43,59],road:[40,46,55],asphalt:[35,42,51],
   metal:[104,117,131],grate:[85,101,113],rust:[102,76,71],wood:[94,67,54],pale:[128,149,165],glass:[40,81,109],
   tile:[84,103,120],garden:[50,95,75],leather:[68,48,57]}[style]||[80,93,103];
 const step=style==='facade'?64:(style==='wood'?64:128),line=(x,y,x2,y2,width,alpha=.5)=>{
  for(let i=0;i<3;i++){const c=ctx[i];c.strokeStyle=i===0?`rgba(8,12,21,${alpha})`:i===1?'#afafaf':'#777777';c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
 };
 const block=(x,y,w,h,rgb,rough=180,bump=128,light=0)=>{
  const colors=[`rgb(${rgb.map(v=>Math.max(0,Math.min(255,v|0))).join(',')})`,`rgb(${rough},${rough},${rough})`,`rgb(${bump},${bump},${bump})`,
  `rgb(${light},${light},${light})`];
  ctx.forEach((c,i)=>{c.fillStyle=colors[i];c.fillRect(x,y,w,h);});
 };
 block(0,0,size,size,base);
 const grid=style==='facade'||style==='concrete'||style==='dark'||style==='tile'||style==='glass'||style==='wood'||style==='grate'||style==='rust';
 if(grid){
  for(let y=0;y<size;y+=step)for(let x=0;x<size;x+=step){
   const variation=(r()-.5)*25, b=base.map(c=>c+variation);
   block(x+2,y+2,step-4,step-4,b,style==='glass'?62:style==='wood'?210:style==='tile'?80:166,125+variation);
   if(style==='facade'||style==='glass'||style==='dark'){
    // The atlas contains genuinely independent lit/unlit windows and recessed mullions.
    const lit=r()>(style==='facade'?.53:.83),color=r()>.67?[255,149,92]:r()>.55?[250,71,154]:[50,199,243];
    block(x+9,y+12,step-18,step-21,lit?color:[11,24,37],lit?76:206,lit?218:70,lit?220:0);
    block(x+step/2-2,y+10,4,step-18,[20,25,38],175,100,0);
   }else if(style==='wood'){
    for(let i=0;i<7;i++){const yy=y+r()*step;line(x+3,yy,x+step-4,yy+(r()-.5)*10,.5+r()*2,.24);}
    for(const bx of [x+8,x+step-10])for(const by of [y+9,y+step-10])block(bx,by,4,4,[33,35,38],60,222);
   }else if(style==='grate'||style==='rust'){
    block(x+6,y+6,step-12,step-12,style==='rust'?[84,74,77]:[53,64,73],105,116);
    for(let i=15;i<step-10;i+=12){block(x+i,y+9,5,step-18,[13,20,28],59,30);}
    for(const bx of [x+8,x+step-12])for(const by of [y+8,y+step-12])block(bx,by,5,5,[170,162,152],60,235);
   }else if(style==='tile'){
    block(x+4,y+4,step-8,step-8,base.map(v=>v+variation+18),74,171);
   }else{
    line(x+1,y+1,x+step-1,y+1,2,.34);
   }
  }
 }
 // Fine chips, gravel, weathering and cracks. Reuse the same seeded random
 // sequence each load, so the entire map is generated reproducibly offline.
 for(let i=0;i<size*1.55;i++){
  const x=r()*size,y=r()*size,s=1+r()*3,dark=r()>.49;
  const c=ctx[0];c.fillStyle=dark?'rgba(2,7,15,.17)':'rgba(205,209,218,.08)';c.fillRect(x,y,s,s);
  ctx[1].fillStyle=dark?'#9a9a9a':'#cdcdcd';ctx[1].fillRect(x,y,s,s);
  ctx[2].fillStyle=dark?'#696969':'#bababa';ctx[2].fillRect(x,y,s,s);
 }
 if(['road','asphalt','concrete','facade','rust'].includes(style)){
  for(let i=0;i<45;i++){
   const x=r()*size,y=r()*size;
   line(x,y,x+(r()-.5)*95,y+35+r()*100,.3+r()*.8,.10+r()*.18);
  }
 }
 const names=['map','roughnessMap','bumpMap','emissiveMap'];
 return Object.fromEntries(maps.map((c,i)=>{
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;
  if(i===0||i===3)t.colorSpace=T.SRGBColorSpace;
  return [names[i],t];
 }));
}
// Plane environmental lighting is reflected by PBR surfaces; unlike screen
// space reflections it stays stable as the camera moves around wet patches.
function environment(renderer){
 if(!renderer)return null;
 const sides=Array.from({length:6},(_,side)=>{
  const c=makeCanvas(256),g=c.getContext('2d');g.fillStyle=side===2?'#667d92':'#101b30';g.fillRect(0,0,256,256);
  const colors=['#6be5f8','#ef4b9f','#ffba69'];
  for(let i=0;i<24;i++){const x=(i*73+side*41)%256,y=(i*47+17)%256;
   g.globalAlpha=.18+(i%4)*.09;g.fillStyle=colors[(i+side)%3];g.fillRect(x,y,6+(i%5)*3,30+i%7*13);
  }g.globalAlpha=1;return c;
 });
 const cubemap=new T.CubeTexture(sides);cubemap.colorSpace=T.SRGBColorSpace;cubemap.needsUpdate=true;
 const generator=new T.PMREMGenerator(renderer);const target=generator.fromCubemap(cubemap);generator.dispose();cubemap.dispose();return target;
}
function boxGeometry(b){
 const g=new T.BoxGeometry(b.w,b.h,b.d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
  const unit=(b.kind==='building'||b.kind==='atriumShell'||b.kind==='skyline')?3:2;
  uv.setXY(i,(nx>.5?z:x)/unit,(ny>.5?z:y)/unit);
 }
 g.translate(b.x,b.y+b.h/2,b.z);return g;
}
function rampGeometry(b){
 const corners=[[b.x-b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z+b.d/2],[b.x-b.w/2,b.z+b.d/2]],v=[];
 for(const lower of [true,false])for(const [x,z] of corners)v.push(x,topAt(b,x,z)-(lower?b.thickness:0),z);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));
 g.setIndex([4,6,5,4,7,6,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);
 const p=g.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)/2,p.getZ(i)/2);
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
export function buildWorld(scene,map,{renderer,quality='high'}={}){
 const root=new T.Group();scene.add(root);const batches=new Map(),details=[],mats=new Map(),textures=[];
 scene.background=new T.Color('#091525');scene.fog=new T.FogExp2('#0a1628',.0085);
 const hemi=new T.HemisphereLight('#9bb7df','#2f2736',1.25);root.add(hemi);
 const sun=new T.DirectionalLight('#f9d6bd',2.8);sun.position.set(-30,67,14);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:2,far:200});sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;root.add(sun,sun.target);sun.target.position.set(0,0,0);
 let env=null;try{env=environment(renderer);if(env)scene.environment=env.texture;}catch(error){console.warn('Environment map unavailable:',error);}
 for(const [style,info] of Object.entries(MATERIALS)){
  if(NEON.has(style)){mats.set(style,new T.MeshBasicMaterial({color:info.color,toneMapped:false,side:T.DoubleSide}));continue;}
  const tex=atlas(style,1024);textures.push(...Object.values(tex));
  const mat=new T.MeshStandardMaterial({color:info.color,map:tex.map,roughnessMap:tex.roughnessMap,bumpMap:tex.bumpMap,
    emissiveMap:tex.emissiveMap,emissive:info.emissive||'#ffffff',emissiveIntensity:info.glow||0,
    metalness:info.metalness,roughness:info.roughness,bumpScale:.045,envMapIntensity:1.2});
  mats.set(style,mat);
 }
 // Deep colored light pockets contrast with the very dark underpasses.
 const lights=[[-27,5,14,'#ff468b',17,3],[-20,5,1,'#f0a65f',14,3],[-3,5,25,'#43f5ff',18,4],
  [22,5,23,'#33cfff',20,4],[29,6,5,'#f6b774',15,3],[2,12,-22,'#ffaf50',17,3],[-28,5,24,'#fa4c93',17,3]];
 for(const [x,y,z,color,dist,intensity] of lights){const l=new T.PointLight(color,intensity,dist,2);l.position.set(x,y,z);l.userData.fxLight=true;root.add(l);}
 const steam=[];
 function queue(g,style='concrete',zone='plaza',optional=false,casts=false){
  if(g.index){const next=g.toNonIndexed();g.dispose();g=next;}
  const key=`${zone}:${style}:${optional?1:0}:${casts?1:0}`;
  if(!batches.has(key))batches.set(key,{geos:[],style,zone,optional,casts});
  batches.get(key).geos.push(g);
 }
 function cube(x,y,z,w,h,d,style='metal',zone='plaza',optional=true,casts=false){queue(boxGeometry({x,y,z,w,h,d,kind:'detail'}),style,zone,optional,casts);}
 function cylinder(x,y,z,r1,r2,h,style,zone,optional=true){const g=new T.CylinderGeometry(r1,r2,h,12);g.translate(x,y+h/2,z);queue(g,style,zone,optional,false);}
 function lightPanel(x,y,z,w,h,color,zone,rot=0){const g=new T.PlaneGeometry(w,h);g.rotateY(rot);g.translate(x,y,z);queue(g,color,zone,false,false);}
 // Stage 5/6 visual-only elements are rendered in instanced batches below.
  const legacyDecor=(map.decor||[]).filter(b=>!b.stage5VisualOnly&&!b.stage6VisualOnly);
  for(const b of [...map.boxes,...legacyDecor]){
  const style=b.style in MATERIALS?b.style:'concrete';
  const g=b.kind==='ramp'?rampGeometry(b):boxGeometry(b);
  queue(g,style,b.zone||'plaza',!!b.detail,['building','atriumShell','boundary','pillar','stationRoof','skyline','train'].includes(b.kind));
 }
 const rgb=(i)=>['cyan','magenta','amber'][i%3];
 const f=(kind)=>map.features?.filter(v=>v.kind===kind)||[];
 for(const p of map.features||[]){const {x,y,z,zone='plaza',variant=0,rotation=0}=p,style=rgb(variant);
  switch(p.kind){
   case 'shop':
    cube(x,y,z,3,.17,2.7,'rust',zone,false);cube(x,y+.2,z-.99,2.8,1.25,.13,'wood',zone,false);
    cube(x-1.2,y+.3,z+.95,.16,1.3,.2,'metal',zone);cube(x+1.2,y+.3,z+.95,.16,1.3,.2,'metal',zone);
    cube(x,y+2.3,z,3.25,.3,2.9,'grate',zone,false);cube(x,y+2.65,z+.75,3,.48,.09,style,zone,false);
    for(let n=0;n<3;n++)cube(x-.8+n*.8,y+.43,z-.42,.5,.55,.35,n%2?'metal':'tile',zone);
    break;
   case 'vending':
    cube(x,y,z,.88,2.2,.68,'rust',zone,false,true);cube(x,y+1.08,z+.357,.72,.77,.03,style,zone,false);
    cube(x-.16,y+.25,z+.367,.32,.15,.02,'amber',zone);break;
   case 'crates':
    for(let n=0;n<4;n++){const ox=n%2*.55,oz=(n>>1)*.58;cube(x+ox,y+(n%2)*.43,z+oz,.65,.58,.65,n%2?'wood':'rust',zone);}
    break;
   case 'lantern':
    cylinder(x,y-.48,z,.31,.21,.72,'amber',zone,false);cube(x,y-.92,z,.52,.06,.52,'rust',zone);
    cube(x,y,z,.065,.35,.065,'metal',zone);break;
   case 'stools':
    for(let i=0;i<3;i++){const px=x+i*.9;cube(px,y+.55,z,.55,.09,.55,'leather',zone);cylinder(px,y,z,.12,.12,.53,'metal',zone);}
    break;
   case 'streetlamp':
    cylinder(x,y,z,.12,.15,5.2,'metal',zone,false);
    cube(x+.6,y+5.07,z,1.35,.14,.22,'grate',zone,false);cube(x+1.13,y+4.9,z,.7,.08,.33,p.color||'amber',zone,false);break;
   case 'trash':cube(x,y,z,.62,1.1,.58,'dark',zone);cube(x,y+1.11,z,.75,.09,.7,'metal',zone);break;
   case 'duct':cube(x,y,z,1.5,.95,.95,'grate',zone);cube(x,y+.94,z,1.65,.08,1.1,'rust',zone);break;
   case 'reception':
    cube(x,y,z,4.1,1.05,1.25,'wood',zone,false,true);cube(x,y+1.06,z,4.4,.13,1.4,'tile',zone,false);
    lightPanel(x,y+.68,z+0.645,2.3,.27,'cyan',zone);break;
   case 'sofa':
    cube(x,y,z,2.1,.56,1,'leather',zone,false,true);cube(x,y+.6,z-.4,2.1,.95,.27,'leather',zone);
    for(const d of [-1,1])cube(x+d*.95,y+.5,z,.22,.5,1.1,'rust',zone);break;
   case 'planter':
    cube(x,y,z,1.1,.75,1.1,'concrete',zone,false);
    for(let n=0;n<5;n++){cylinder(x+(n%3-1)*.27,y+.75,z+(n%2-.5)*.35,.13,.06,.75+(n%3)*.25,'garden',zone);}
    break;
   case 'logo':lightPanel(x,y,z,4.8,.26,'cyan',zone);cube(x,y-.6,z,5.1,.09,.15,'metal',zone);break;
   case 'floorLight':cube(x,y,z,.85,.025,.85,'cyan',zone);break;
   case 'workbench':cube(x,y+.8,z,2.8,.19,1.1,'wood',zone,false,true);
    cube(x-1.12,y,z,.18,.8,.18,'rust',zone);cube(x+1.12,y,z,.18,.8,.18,'rust',zone);
    cube(x,y+1.05,z,.45,.28,.32,'glass',zone);break;
   case 'serverRack':cube(x,y,z,1.15,2.4,.65,'dark',zone,false,true);
    for(let n=0;n<7;n++)cube(x,y+.18+n*.27,z+.335,.88,.07,.026,n%2?'cyan':'amber',zone);break;
   case 'trainSeat':cube(x,y,z,.85,.45,.8,'leather',zone,false);
    cube(x,y+.45,z-.34,.85,.76,.19,'pale',zone);break;
   case 'handrail':cylinder(x,y+1.8,z,.04,.04,1.9,'metal',zone);cube(x,y+3.65,z,.8,.07,.07,'metal',zone);break;
   case 'ticket':cube(x,y,z,1.15,1.95,.64,'metal',zone,false,true);
    lightPanel(x,y+1.42,z+.325,.8,.5,'cyan',zone);break;
   case 'plankBolt':
    // Two shallow bolt heads per slat, located on the continuous route surface.
    for(const offset of [-1.24,1.24]){
      const bx=x+(p.axis==='z'?offset:0),bz=z+(p.axis==='x'?offset:0);
      cube(bx,y+.006,bz,.07,.018,.07,'rust',zone);
    }break;
   case 'cable':{
    for(let n=0;n<3;n++){
      const start=new T.Vector3(x-p.dx/2,y+(n-1)*.2,z-p.dz/2),end=new T.Vector3(x+p.dx/2,y+(n-1)*.2,z+p.dz/2);
      const mid=start.clone().add(end).multiplyScalar(.5);mid.y-=1.1+n*.3;
      const path=new T.QuadraticBezierCurve3(start,mid,end),g=new T.TubeGeometry(path,22,.024+n*.006,4,false);
      queue(g,'dark',zone,false);
    }break;}
   case 'billboard':
    cube(x,y,z,5,2.4,.22,'dark',zone,false,true);lightPanel(x,y,z+.126,4.65,1.97,p.color||'magenta',zone);
    for(let n=0;n<5;n++)cube(x-2.0+n,.0+y+.04,z+.14,.37,1.65,.05,n%2?'metal':'glass',zone);break;
   case 'pipeduct':{
    for(let n=0;n<3;n++){
      const g=new T.CylinderGeometry(.09,.09,5,8);g.rotateX(Math.PI/2);g.translate(x+n*.25,y+n*.22,z);queue(g,'rust',zone);
    }break;}
   case 'puddle':{
    const g=new T.PlaneGeometry(p.w||1,p.d||1);g.rotateX(-Math.PI/2);g.translate(x,y+.012,z);queue(g,'glass',zone,false);break;}
   case 'manhole':{
    const g=new T.CylinderGeometry(.48,.48,.026,20);g.translate(x,y+.015,z);queue(g,'grate',zone,false);break;}
   case 'ventSteam':{
    const count=11,g=new T.BufferGeometry(),positions=new Float32Array(count*3),seeds=[];
    for(let i=0;i<count;i++){const h=i/count*3;positions.set([x+Math.sin(i*2.7)*.23,y+h,z+Math.cos(i*2.7)*.23],i*3);seeds.push(i*.53);}
    g.setAttribute('position',new T.BufferAttribute(positions,3));const m=new T.PointsMaterial({color:'#a9c9db',size:.44,transparent:true,opacity:.25,depthWrite:false});
    const cloud=new T.Points(g,m);root.add(cloud);steam.push({cloud,positions,seeds,x,y,z});break;}
  }
 }
 // A single atlas for every sign: high-contrast glyphs plus luminous framing.
 let signTexture,signMaterial;
 if(map.signs?.length){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128*map.signs.length;
  const ctx=canvas.getContext('2d'),geometries=[];
  map.signs.forEach((s,i)=>{
   const y=i*128;ctx.fillStyle='#0a1020';ctx.fillRect(0,y,1024,128);
   ctx.fillStyle=map.palette[s.color]||PAINT.cyan;ctx.fillRect(10,y+7,1004,5);ctx.fillRect(10,y+116,1004,5);
   ctx.fillRect(10,y+8,5,108);ctx.fillRect(1008,y+8,5,108);
   ctx.font='bold 68px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.text,512,y+65,964);
   const g=new T.PlaneGeometry(s.w,s.h),uv=g.attributes.uv;
   for(let j=0;j<uv.count;j++)uv.setY(j,(map.signs.length-i-1+uv.getY(j))/map.signs.length);
   g.rotateY(s.rotationY||0);g.translate(s.x,s.y,s.z);geometries.push(g);
  });
  signTexture=new T.CanvasTexture(canvas);signTexture.colorSpace=T.SRGBColorSpace;
  signMaterial=new T.MeshBasicMaterial({map:signTexture,transparent:true,side:T.DoubleSide,toneMapped:false});
  const merged=mergeGeometries(geometries);if(merged){const s=new T.Mesh(merged,signMaterial);root.add(s);}geometries.forEach(g=>g.dispose());
 }
 for(const [key,b] of batches){
  const g=mergeGeometries(b.geos,false);if(!g)throw Error('Failed to merge world geometry: '+key);
  g.computeBoundingSphere();const mesh=new T.Mesh(g,mats.get(b.style));mesh.userData.zone=b.zone;mesh.castShadow=b.casts;mesh.receiveShadow=true;
  root.add(mesh);if(b.optional)details.push(mesh);for(const item of b.geos)item.dispose();
 }
 const targetMat=new T.MeshStandardMaterial({color:'#e5ad60',metalness:.5,roughness:.53}),headMat=new T.MeshBasicMaterial({color:'#53f4ee',toneMapped:false}),targets=new Map();
 for(const [i,pos] of (map.practiceTargets||[]).entries()){
  const group=new T.Group(),body=new T.Mesh(new T.CylinderGeometry(.36,.4,1.05,10),targetMat),head=new T.Mesh(new T.IcosahedronGeometry(.25,1),headMat);
  body.position.y=.95;head.position.y=1.62;body.castShadow=true;group.add(body,head);group.position.set(...pos);root.add(group);targets.set('t'+i,group);
 }
 const stage5Group=createStage5VisualLayer(T,map,'ultra');
  const stage6Group=createStage6VisualLayer(T,map,'ultra');
  root.add(stage5Group,stage6Group);
  let detailEnabled=true,activeVisualMode=quality;
  function showStageDetail(){
   const level=activeVisualMode==='performance'?0:activeVisualMode==='ultra'?2:1;
   for(const mesh of stage5Group.children)mesh.visible=detailEnabled&&(mesh.userData.stage5Tier||0)<=level;
   for(const mesh of stage6Group.children)mesh.visible=detailEnabled&&(mesh.userData.stage6Tier||0)<=level;
  }
  function setQuality(mode){activeVisualMode=mode;showStageDetail();
  const low=mode==='performance',ultra=mode==='ultra';
  for(const d of details)d.visible=!low;
  for(const l of root.children)if(l.isPointLight)l.visible=!low||l.position.y>10;
  sun.castShadow=!low;sun.shadow.mapSize.set(2048,2048);
  for(const [name,m] of mats){if(NEON.has(name))continue;
   const tex=m.userData.maps||(m.userData.maps={map:m.map,bumpMap:m.bumpMap,roughnessMap:m.roughnessMap,emissiveMap:m.emissiveMap});
   m.map=tex.map;m.roughnessMap=tex.roughnessMap;
   m.bumpMap=low?null:tex.bumpMap;m.emissiveMap=low?null:tex.emissiveMap;
   m.envMapIntensity=low?.05:ultra?1.7:1.05;m.bumpScale=ultra?.085:.047;m.needsUpdate=true;
  }
  scene.fog.density=low?.0062:.0085;
 }
 setQuality(quality);
 return {sun,targets,staticBatches:batches.size+(map.signs?.length?1:0),featureCount:map.features?.length||0,
  setDetail(enabled){detailEnabled=enabled;for(const mesh of details)mesh.visible=enabled;showStageDetail();},setQuality,
  animate(time){for(const s of steam){const p=s.cloud.geometry.attributes.position;
   for(let i=0;i<s.seeds.length;i++){const k=(time*.38+s.seeds[i])%1;p.setXYZ(i,s.x+Math.sin(time+i)*.3*k,s.y+.2+3*k,s.z+Math.cos(time*.7+i)*.25*k);}p.needsUpdate=true;
  }},
  dispose(){root.traverse(o=>{o.geometry?.dispose();if(o.isPoints||o.userData.stage5VisualOnly||o.userData.stage6VisualOnly)o.material?.dispose();});
   for(const m of mats.values())m.dispose();for(const t of textures)t.dispose();for(const m of [targetMat,headMat,signMaterial])m?.dispose();signTexture?.dispose();env?.dispose();scene.environment=null;root.removeFromParent();}
 };
}
