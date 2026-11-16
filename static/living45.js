import {STORY_SIGNS,DISTRICT_STORIES} from './environment43.js';

// CROSSFIRE 04.5. Purely decorative animated city actors and spatial ambience.
// The network state, map.boxes, match rules and collision queries are untouched.
export const LIVING45_PRESETS={
 performance:{ads:4,fans:2,drones:0,reactive:false},
 auto:{ads:8,fans:3,drones:2,reactive:true},
 high:{ads:8,fans:4,drones:3,reactive:true},
 ultra:{ads:12,fans:4,drones:4,reactive:true},
 native:{ads:8,fans:4,drones:3,reactive:true}
};
const STORY_ADS={
 market:['LOCAL MARKET','FRESH & OPEN','FOOD DISTRICT'],
 plaza:['CITY PLAZA','PUBLIC SQUARE','WELCOME'],
 atrium:['OFFICE TOWER','OPEN TODAY','BUSINESS DISTRICT'],
 transit:['CENTRAL LINE','SERVICE ACTIVE','NEXT ARRIVAL']
};
const DIRS=['market','plaza','atrium','transit'];
const clamp=(a,min,max)=>Math.max(min,Math.min(max,a));
const smoothed=(start,end,part)=>start+(end-start)*part;
export function planLiving45(map){
 const ads=[];
 for(const zone of DIRS){
  const existing=STORY_SIGNS.filter(s=>s.zone===zone);
  [0,2,4].forEach((i,slot)=>{
   const s=existing[i];
   if(!s)return;
   const nx=Math.sin(s.rotation),nz=Math.cos(s.rotation);
   ads.push({zone,slot,text:STORY_ADS[zone][slot],x:s.x+nx*.24,y:s.y+1.13,
    z:s.z+nz*.24,rotation:s.rotation,width:2.05,height:.55});
  });
 }
 // Existing elevated signage anchors motor housings above head height.
 const fans=DIRS.map((zone,i)=>{
  const s=STORY_SIGNS.find(x=>x.zone===zone);
  return {zone,x:s.x+Math.sin(s.rotation)*.16,y:s.y+2.05,
   z:s.z+Math.cos(s.rotation)*.16,rotation:s.rotation,speed:.88+i*.17};
 });
 const zones=map.zones||[];
 const drones=DIRS.map((zone,i)=>{
  const region=zones.find(z=>z.id===zone)||{x:0,y:1,z:0};
  return {zone,x:region.x+(i%2?3:-3),y:(region.y||0)+18.8+(i%2)*2.8,
   z:region.z+(i%2?-2:3),phase:i*1.37};
 });
 return {ads,fans,drones,labels:STORY_ADS};
}
function createAdTexture(T,zone){
 const c=document.createElement('canvas');c.width=512;c.height=256;
 const ctx=c.getContext('2d'),ink=DISTRICT_STORIES[zone].color;
 ctx.fillStyle='#ece8df';ctx.fillRect(0,0,512,256);
 // Procedural ad screen: no external image, font or media downloads.
 for(let i=0;i<28;i++){
  ctx.globalAlpha=.06+(i%3)*.02;ctx.fillStyle=ink;
  ctx.fillRect((i*53)%512,(i*47)%256,4+(i%5)*5,35+(i%7)*9);
 }
 ctx.globalAlpha=1;
 const title=STORY_ADS[zone][0],sub=STORY_ADS[zone][1];
 ctx.fillStyle=ink;ctx.fillRect(16,18,480,5);ctx.fillRect(16,226,480,4);
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowBlur=0;ctx.fillStyle='#2c505e';ctx.font='bold 65px sans-serif';
 ctx.fillText(title,256,112,470);
 ctx.fillStyle='#63777e';ctx.font='bold 24px sans-serif';ctx.fillText(sub,256,185,460);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;tex.needsUpdate=true;
 return tex;
}
const DISPLAY_V='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const DISPLAY_F=[
 'varying vec2 vUv;',
 'uniform sampler2D uMap;uniform float uTime;uniform float uBoost;uniform vec3 uTint;',
 'void main(){',
 'vec2 uv=vUv;'
 'vec3 col=texture2D(uMap,uv).rgb;',
 'float scan=1.0;'
 'float sweep=0.0;'
 'float slow=.97+.025*sin(uTime*.79);',
 'col=col*scan*slow+uTint*(.012*sweep+.02*uBoost);'
 'gl_FragColor=vec4(col,clamp(.93+.02*uBoost,0.0,.98));'
 '}'
].join('\n');
export function createLivingWorld45(T,map){
 const plan=planLiving45(map);
 const root=new T.Group();root.name='phase45-living-city';root.userData.collidable=false;
 const geometries=[],materials=[],textures=[],ads=[],fans=[],drones=[];
 const matsByZone=new Map();
 for(const zone of DIRS){
  const tex=createAdTexture(T,zone);textures.push(tex);
  const mat=new T.ShaderMaterial({
   uniforms:{uMap:{value:tex},uTime:{value:0},uBoost:{value:0},
     uTint:{value:new T.Color(DISTRICT_STORIES[zone].color)}},
   vertexShader:DISPLAY_V,fragmentShader:DISPLAY_F,transparent:true,
   depthWrite:false,side:T.DoubleSide,toneMapped:false
  });
  matsByZone.set(zone,mat);materials.push(mat);
 }
 const adGeometry=new T.PlaneGeometry(2.05,.55);geometries.push(adGeometry);
 plan.ads.forEach((p,i)=>{
  const mesh=new T.Mesh(adGeometry,matsByZone.get(p.zone));
  mesh.name='phase45-advert-'+p.zone+'-'+p.slot;
  mesh.position.set(p.x,p.y,p.z);mesh.rotation.y=p.rotation;
  mesh.renderOrder=3;mesh.userData={living45:true,collidable:false,tier:p.slot,zone:p.zone};
  root.add(mesh);ads.push({mesh,...p});
 });
 const steel=new T.MeshStandardMaterial({color:'#8b9696',metalness:.65,roughness:.58});
 const glow=new T.MeshBasicMaterial({color:'#9bc5c4',toneMapped:true,side:T.DoubleSide});
 materials.push(steel,glow);
 const hubGeo=new T.CylinderGeometry(.15,.15,.22,10),bladeGeo=new T.BoxGeometry(.08,.75,.045);
 const ringGeo=new T.TorusGeometry(.5,.055,5,24);
 geometries.push(hubGeo,bladeGeo,ringGeo);
 plan.fans.forEach((p,i)=>{
  const frame=new T.Group();frame.name='phase45-ventilation-'+p.zone;
  frame.position.set(p.x,p.y,p.z);frame.rotation.y=p.rotation;
  frame.userData={living45:true,collidable:false,tier:i>1?1:0};
  const housing=new T.Mesh(ringGeo,steel);
  const rotor=new T.Group();
  const bladeA=new T.Mesh(bladeGeo,steel),bladeB=new T.Mesh(bladeGeo,steel);
  bladeB.rotation.z=Math.PI/2;
  const hub=new T.Mesh(hubGeo,glow);
  hub.rotation.x=Math.PI/2;
  rotor.add(bladeA,bladeB,hub);frame.add(housing,rotor);
  root.add(frame);fans.push({frame,rotor,...p});
 });
 const orbGeo=new T.IcosahedronGeometry(.19,1),haloGeo=new T.TorusGeometry(.38,.028,4,20);
 geometries.push(orbGeo,haloGeo);
 plan.drones.forEach((p,i)=>{
  const group=new T.Group();group.name='phase45-rooftop-service-drone-'+p.zone;
  const shell=new T.Mesh(orbGeo,steel),halo=new T.Mesh(haloGeo,glow);
  group.add(shell,halo);group.position.set(p.x,p.y,p.z);
  group.userData={living45:true,collidable:false,tier:i>1?2:1};
  root.add(group);drones.push({group,...p});
 });
 let active='high',detail=true,lastTime=0;
 function visibility(){
  const p=LIVING45_PRESETS[active];
  const ordered=[...ads].sort((a,b)=>a.slot-b.slot);
  const available=new Set(ordered.slice(0,p.ads).map(a=>a.mesh));
  ads.forEach(a=>{a.mesh.visible=available.has(a.mesh)&&(detail||a.slot===0);});
  fans.forEach((a,i)=>{a.frame.visible=i<p.fans&&(detail||i<2);});
  drones.forEach((d,i)=>{d.group.visible=i<p.drones&&detail;});
 }
 function setQuality(mode){active=LIVING45_PRESETS[mode]?mode:'high';visibility();}
 function setDetail(enabled){detail=Boolean(enabled);visibility();}
 function animate(time,player=null){
  if(!Number.isFinite(time))return;
  lastTime=time;
  for(const mat of matsByZone.values())mat.uniforms.uTime.value=time;
  const maxReact=LIVING45_PRESETS[active].reactive&&player&&
    Number.isFinite(player.x)&&Number.isFinite(player.z);
  for(const zone of DIRS){
   const group=ads.filter(a=>a.zone===zone);
   let nearest=Infinity;
   if(maxReact)for(const a of group){
    const dx=a.x-player.x,dz=a.z-player.z;
    nearest=Math.min(nearest,Math.hypot(dx,dz));
   }
   const boost=maxReact?clamp((11-nearest)/11,0,1):0;
   const mat=matsByZone.get(zone);
   mat.uniforms.uBoost.value=smoothed(mat.uniforms.uBoost.value,boost,.10);
  }
  for(const f of fans)if(f.frame.visible)f.rotor.rotation.z=time*f.speed;
  for(const d of drones)if(d.group.visible){
   d.group.position.set(d.x+Math.sin(time*.32+d.phase)*1.15,
    d.y+Math.sin(time*.62+d.phase)*.32,
    d.z+Math.cos(time*.32+d.phase)*1.15);
   d.group.rotation.y=time*.25+d.phase;
  }
 }
 function dispose(){
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
  for(const t of textures)t.dispose();
  root.removeFromParent();
 }
 setQuality('high');
 return {root,ads,fans,drones,plan,setQuality,setDetail,animate,dispose,
  get quality(){return active;},get lastTime(){return lastTime;}};
}

// Subtle procedurally synthesized ambience: user-gesture audio unlock,
// existing master volume control, zone proximity & stereo position respected.
export function createUrbanAmbience45(audio,map){
 let zones=map.zones||[],lastCue=-Infinity,mode='high',enabled=true;
 function setMap(next){zones=next?.zones||[];lastCue=-Infinity;}
 function setQuality(next){mode=LIVING45_PRESETS[next]?next:'high';}
 function setEnabled(next){enabled=Boolean(next);}
 function update(time,listener,active=true,yaw=0){
  if(!active||!enabled||!audio?.ctx||!audio.enabled||audio.volume<=0||
   !listener||!Number.isFinite(time)||!Number.isFinite(listener.x)||!Number.isFinite(listener.z))return null;
  const period=mode==='performance'?7.4:5.2;
  if(time-lastCue<period)return null;
  const nearest=zones.filter(z=>DIRS.includes(z.id)).map(z=>{
   const dx=z.x-listener.x,dz=z.z-listener.z;
   return {zone:z.id,dist:Math.hypot(dx,dz),dx,dz};
  }).sort((a,b)=>a.dist-b.dist)[0];
  if(!nearest)return null;
  const attenuation=clamp(1-nearest.dist/45,.26,1);
  const angle=Math.atan2(nearest.dx,nearest.dz)-yaw;
  const pan=clamp(Math.sin(angle)*.45,-.45,.45);
  const volume=.14*attenuation;
  if(typeof audio.ambience==='function')audio.ambience(nearest.zone,volume,pan);
  lastCue=time;
  return {zone:nearest.zone,volume,pan};
 }
 function reset(){lastCue=-Infinity;}
 return {setMap,setQuality,setEnabled,update,reset,get zoneCount(){return zones.length;}};
}
