import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// CROSSFIRE 04.4. Atmospheric visuals only; no collision or server state.
export const ATMOSPHERE_PRESETS={
 performance:{rain:0,motes:0,puddles:false,wetness:0,fog:.0020,opacity:0},
 auto:{rain:0,motes:80,puddles:false,wetness:0,fog:.0022,opacity:.15},
 high:{rain:0,motes:140,puddles:false,wetness:0,fog:.0025,opacity:.18},
 ultra:{rain:0,motes:220,puddles:false,wetness:0,fog:.0028,opacity:.22},
 native:{rain:0,motes:140,puddles:false,wetness:0,fog:.0025,opacity:.18}
};
const PALETTE={market:'#ddcfbd',plaza:'#d9e5e8',atrium:'#b8d8cf',transit:'#f2e6c7'};
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const RAIN_VERTEX=`
attribute float aPhase;
attribute float aSize;
attribute vec3 color;
varying vec3 vColor;
uniform float uTime;
uniform float uSpeed;
uniform float uSize;
void main(){
 vec3 p=position;
 p.y=1.0+mod(position.y-uTime*uSpeed+aPhase*4.5,22.0);
 p.x+=sin(uTime*.32+aPhase*6.283185)*.26;
 p.z+=cos(uTime*.19+aPhase*5.2)*.18;
 vec4 mv=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uSize*aSize*(65.0/max(1.0,-mv.z)),1.0,11.0);
 vColor=color;
}`;
const RAIN_FRAGMENT=`
varying vec3 vColor;
uniform float uOpacity;
uniform float uStretch;
void main(){
 vec2 p=(gl_PointCoord-vec2(.5))*vec2(uStretch,1.0);
 float alpha=(1.0-smoothstep(.25,.52,length(p)))*uOpacity;
 if(alpha<.012)discard;
 gl_FragColor=vec4(vColor,alpha);
}`;
const PUDDLE_VERTEX=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const PUDDLE_FRAGMENT=`
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform vec3 uTint;
void main(){
 vec2 p=(vUv-.5)*2.0;
 float wobble=.045*sin(p.x*13.0+p.y*8.0)+.025*sin(p.y*21.0);
 float d=length(p*vec2(1.0,.85))+wobble;
 float fade=1.0-smoothstep(.55,.98,d);
 // Layered cool reflected signage, soft dark border, and subtle slow ripples.
 float longGlow=pow(max(0.0,1.0-abs(p.x+.22*sin(p.y*3.0+uTime*.12))),5.0);
 float ripples=.5+.5*sin(d*32.0-uTime*.75);
 vec3 asphalt=vec3(.026,.045,.070);
 vec3 neon=mix(asphalt,uTint*.36,longGlow*.42+.12*ripples);
 float alpha=fade*uOpacity*(.59+longGlow*.18);
 gl_FragColor=vec4(neon,alpha);
}`;
function seedCloud(T,zones,count,seed){
 const r=rng(seed),positions=new Float32Array(count*3),colors=new Float32Array(count*3),
  phases=new Float32Array(count),sizes=new Float32Array(count);
 const valid=(zones||[]).filter(z=>PALETTE[z.id]);
 for(let i=0;i<count;i++){
  const z=valid[i%valid.length]||{id:'plaza',x:0,y:0,z:0,w:20,d:20};
  const phase=r(),size=.65+r()*.75;
  positions.set([z.x+(r()-.5)*z.w*1.15,(z.y||0)+r()*18.0,z.z+(r()-.5)*z.d*1.15],i*3);
  const base=new T.Color(PALETTE[z.id]);const light=.64+r()*.32;
  colors.set([base.r*light,base.g*light,base.b*light],i*3);
  phases[i]=phase;sizes[i]=size;
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.BufferAttribute(positions,3));
 g.setAttribute('color',new T.BufferAttribute(colors,3));
 g.setAttribute('aPhase',new T.BufferAttribute(phases,1));
 g.setAttribute('aSize',new T.BufferAttribute(sizes,1));
 g.setDrawRange(0,count);return g;
}
export function planPuddles44(map){
 const puddles=[],zones=new Set(Object.keys(PALETTE));
 for(const floor of map.boxes||[]){
  if(floor.kind!=='floor'||!['road','tile'].includes(floor.style)||!zones.has(floor.zone))continue;
  if(floor.w<5||floor.d<16)continue;
  const count=Math.min(8,Math.max(2,Math.floor(floor.d/9)));
  for(let i=0;i<count;i++){
   const z=floor.z-floor.d/2+(i+.65)*floor.d/(count+1);
   const offset=((i*47+floor.zone.length*11)%7-3)*.26;
   const x=floor.x+offset+(i%2?floor.w*.22:-floor.w*.22);
   puddles.push({zone:floor.zone,x,y:floor.y+floor.h+.027,z,w:1.6+(i%3)*.22,d:.72+(i%2)*.25});
  }
 }
 return puddles;
}
export function createAtmosphere44(T,map,scene){
 const group=new T.Group();group.name='phase44-weather-and-reflections';
 group.userData.collidable=false;
 const clouds=[];
 function cloud(name,count,seed,speed,size,stretch){
  const geometry=seedCloud(T,map.zones,count,seed);
  const uniforms={uTime:{value:0},uSpeed:{value:speed},uSize:{value:size},
   uOpacity:{value:.4},uStretch:{value:stretch}};
  const material=new T.ShaderMaterial({
   uniforms,vertexShader:RAIN_VERTEX,fragmentShader:RAIN_FRAGMENT,
   transparent:true,depthWrite:false,depthTest:true,blending:T.NormalBlending
  });
  const mesh=new T.Points(geometry,material);
  mesh.name='phase44-'+name;mesh.frustumCulled=false;
  mesh.userData={collidable:false,atmosphere44:true};
  group.add(mesh);clouds.push({mesh,geometry,material,count,uniforms,name});return mesh;
 }
 const rain=cloud('rain',850,44081,7.5,2.15,2.35);
 const motes=cloud('floating-motes',320,44082,.32,1.6,1.05);
 const puddles=planPuddles44(map),puddleMeshes=[],puddleGeometries=[],puddleMaterials=[];
 for(const zone of Object.keys(PALETTE)){
  const inZone=puddles.filter(p=>p.zone===zone);
  if(!inZone.length)continue;
  const parts=inZone.map(p=>{
   const g=new T.PlaneGeometry(p.w,p.d);g.rotateX(-Math.PI/2);g.translate(p.x,p.y,p.z);
   return g;
  });
  const geometry=mergeGeometries(parts,false);
  for(const g of parts)g.dispose();
  if(!geometry)throw Error('Could not merge wet pavement for '+zone);
  const uniforms={uTime:{value:0},uOpacity:{value:0},uTint:{value:new T.Color(PALETTE[zone])}};
  const material=new T.ShaderMaterial({
   uniforms,vertexShader:PUDDLE_VERTEX,fragmentShader:PUDDLE_FRAGMENT,
   transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-1
  });
  const mesh=new T.Mesh(geometry,material);
  mesh.name='phase44-wet-pavement-'+zone;mesh.frustumCulled=false;
  mesh.renderOrder=2;mesh.userData={collidable:false,atmosphere44:true};
  group.add(mesh);puddleMeshes.push(mesh);puddleGeometries.push(geometry);puddleMaterials.push(material);
 }
 let active='high',detailEnabled=true;
 function setQuality(mode='high'){
  active=ATMOSPHERE_PRESETS[mode]?mode:'high';
  const cfg=ATMOSPHERE_PRESETS[active];
  const fraction=active==='auto'&&!detailEnabled?.43:1;
  rain.geometry.setDrawRange(0,Math.floor(cfg.rain*fraction));
  motes.geometry.setDrawRange(0,Math.floor(cfg.motes*fraction));
  rain.visible=cfg.rain>0;motes.visible=cfg.motes>0;
  clouds[0].uniforms.uOpacity.value=cfg.opacity*.68;
  clouds[1].uniforms.uOpacity.value=cfg.opacity*.58;
  for(const mesh of puddleMeshes){
   mesh.visible=cfg.puddles&&(active!=='auto'||detailEnabled);
   mesh.material.uniforms.uOpacity.value=cfg.opacity*.68;
  }
  if(scene.fog){scene.fog.density=cfg.fog;scene.fog.color.set('#cbdce8');}
 }
 function setDetail(enabled){detailEnabled=Boolean(enabled);setQuality(active);}
 function animate(time){
  if(!Number.isFinite(time))return;
  for(const {uniforms} of clouds)uniforms.uTime.value=time;
  for(const mesh of puddleMeshes)mesh.material.uniforms.uTime.value=time;
 }
 function dispose(){
  for(const c of clouds){c.geometry.dispose();c.material.dispose();}
  for(const geometry of puddleGeometries)geometry.dispose();
  for(const material of puddleMaterials)material.dispose();
  group.removeFromParent();
 }
 setQuality('high');
 return {group,rain,motes,puddleMeshes,puddles,setQuality,setDetail,animate,dispose,
  get quality(){return active;},get wetness(){return ATMOSPHERE_PRESETS[active].wetness;}};
}
