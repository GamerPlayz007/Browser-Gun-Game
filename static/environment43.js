import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// CROSSFIRE 04.3 — visual-only environmental storytelling.
// The simulation's map.boxes, routes, spawns and network payload are never edited.
// Instanced surfaces and four shared sign atlases keep the layer affordable.
export const DISTRICT_STORIES={
 market:{color:'#ff5aa6',neon:'magenta',theme:'After-hours food, repairs and tiny independent shops'},
 plaza:{color:'#52ebff',neon:'cyan',theme:'Public plaza, arcade advertising and civic wayfinding'},
 atrium:{color:'#60efd0',neon:'cyan',theme:'Corporate campus, data services and security'},
 transit:{color:'#ffbc69',neon:'amber',theme:'Late-night transit, maintenance and logistics'}
};
export const STORY_SIGNS=[
 // All wall signs sit on existing physical facades. Normal points away from wall.
 {zone:'market',text:'NOCTURNE NOODLES',sub:'OPEN ALL NIGHT',x:-30.89,y:3.55,z:-6,rotation:Math.PI/2},
 {zone:'market',text:'CHROME TEA',sub:'STREET LEVEL 01',x:-30.89,y:3.55,z:-1,rotation:Math.PI/2},
 {zone:'market',text:'BYTE REPAIR',sub:'DEVICE SERVICE',x:-30.89,y:3.55,z:9,rotation:Math.PI/2},
 {zone:'market',text:'SYNTH RECORDS',sub:'ANALOG / DIGITAL',x:-30.89,y:3.55,z:19,rotation:Math.PI/2},
 {zone:'market',text:'MOON MARKET',sub:'EST. 2088',x:-27.91,y:3.55,z:25,rotation:Math.PI/2},
 {zone:'market',text:'NEON BENTO',sub:'TAKEAWAY 24/7',x:-27.91,y:3.55,z:31,rotation:Math.PI/2},
 {zone:'plaza',text:'KINETIC ARCADE',sub:'INSERT CREDIT',x:-8.30,y:8.05,z:-6,rotation:Math.PI/2},
 {zone:'plaza',text:'CIVIC NETWORK',sub:'DISTRICT ONLINE',x:-8.30,y:8.05,z:-2,rotation:Math.PI/2},
 {zone:'plaza',text:'CITY EXCHANGE',sub:'OPEN / ACCESS',x:-8.30,y:8.05,z:2,rotation:Math.PI/2},
 {zone:'plaza',text:'SKYLINE MEDIA',sub:'EAST PLAZA',x:-8.30,y:8.05,z:5.5,rotation:Math.PI/2},
 {zone:'plaza',text:'WAYPOINT 02',sub:'PLAZA CONNECTION',x:5.52,y:4.15,z:-5,rotation:-Math.PI/2},
 {zone:'plaza',text:'NOVA 24',sub:'HOLO DISPLAY',x:5.52,y:4.15,z:3,rotation:-Math.PI/2},
 {zone:'atrium',text:'AXIOM SYSTEMS',sub:'CAMPUS ACCESS',x:18.53,y:11.55,z:-2,rotation:-Math.PI/2},
 {zone:'atrium',text:'DATA CONCOURSE',sub:'LEVEL TWO',x:18.53,y:11.55,z:4,rotation:-Math.PI/2},
 {zone:'atrium',text:'LUMIN LABS',sub:'OPTICAL RESEARCH',x:18.53,y:11.55,z:10,rotation:-Math.PI/2},
 {zone:'atrium',text:'CIRCUIT HOUSE',sub:'SECURE NETWORK',x:18.53,y:11.55,z:16,rotation:-Math.PI/2},
 {zone:'atrium',text:'UNIT 07',sub:'AUTHORIZED ENTRY',x:18.53,y:11.55,z:22,rotation:-Math.PI/2},
 {zone:'atrium',text:'ORBITAL GRID',sub:'ROUTING ACTIVE',x:18.53,y:11.55,z:28,rotation:-Math.PI/2},
 {zone:'transit',text:'LAST SERVICE',sub:'NIGHT NETWORK',x:-29,y:3.55,z:-26.92,rotation:0},
 {zone:'transit',text:'PLATFORM 07',sub:'EASTBOUND',x:-23,y:3.55,z:-26.92,rotation:0},
 {zone:'transit',text:'NIGHT FREIGHT',sub:'LOGISTICS',x:-17,y:3.55,z:-26.92,rotation:0},
 {zone:'transit',text:'LINE CONTROL',sub:'TRANSIT AUTHORITY',x:-11,y:3.55,z:-26.92,rotation:0},
 {zone:'transit',text:'METRO ACCESS',sub:'DECK CONNECTION',x:33.43,y:4.2,z:-14,rotation:-Math.PI/2},
 {zone:'transit',text:'MAINTENANCE',sub:'STATION SERVICES',x:33.43,y:4.2,z:-8,rotation:-Math.PI/2}
];
const round=(n,p=3)=>Math.round(n*10**p)/10**p;
const isFiniteBox=b=>[b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite)&&b.w>0&&b.h>0&&b.d>0;
const mk=(x,y,z,w,h,d,style,tier,zone,tag)=>({x:round(x),y:round(y),z:round(z),w:round(w),h:round(h),d:round(d),style,tier,zone,tag});
const toTier=i=>i<2?0:i<5?1:2;
export function planEnvironment43(map){
 const parts=[],wires=[],signs=[],zoneCounts={market:0,plaza:0,atrium:0,transit:0};
 const add=(...args)=>{const box=mk(...args);if(!isFiniteBox(box))throw Error('Invalid environmental component');parts.push(box);zoneCounts[box.zone]++;};
 const zoneMeta=map.zones||[];
 // Ground markings only on authoritative road slabs: flush to their surface,
 // never blocking the corridors, and avoiding decorations on unknown floors.
 for(const b of (map.boxes||[])){
  if(b.kind!=='floor'||b.style!=='road'||!DISTRICT_STORIES[b.zone]||b.w<5.5||b.d<22)continue;
  const y=b.y+b.h+.012;
  const n=Math.min(8,Math.floor((b.d-3)/4));
  for(let i=0;i<n;i++){
   const z=b.z-b.d/2+2.5+i*3.8;
   add(b.x,y,z,Math.min(2.5,b.w*.48),.014,.12,b.zone==='transit'?'amber':'pale',1,b.zone,'traffic-marker');
  }
  // Long thin side-markings make streets feel mapped and maintained.
  for(const side of [-1,1]){
   add(b.x+side*(b.w/2-.28),y,b.z,.09,.014,Math.max(.5,b.d-1.8),
    'tile',0,b.zone,'lane-edge');
  }
 }
 // Author-led facade trim, weathered service boxes, cable trunks and
 // ventilation banks are attached flush to existing collider surfaces.
 const surfaces=(map.boxes||[]).filter(b=>DISTRICT_STORIES[b.zone]&&
  (b.kind==='building'||b.kind==='atriumShell')&&b.h>=4&&Math.max(b.w,b.d)>=6);
 const used=new Set();
 for(const b of surfaces){
  // Skip repeated modular shell fragments belonging to same broad wall.
  const key=[b.zone,Math.round(b.x*2),Math.round(b.z*2),Math.round(b.y),Math.round(Math.max(b.w,b.d))].join(':');
  if(used.has(key))continue;used.add(key);
  const zInfo=zoneMeta.find(z=>z.id===b.zone)||{x:0,z:0};
  const alongZ=b.d>=b.w;
  const facing=alongZ?(zInfo.x>=b.x?1:-1):(zInfo.z>=b.z?1:-1);
  const span=alongZ?b.d:b.w,face=(alongZ?b.x+facing*b.w/2:b.z+facing*b.d/2);
  const centerY=b.y+Math.min(2.7,b.h-.7),accent=DISTRICT_STORIES[b.zone].neon;
  const put=(offset,offsetY,width,height,depth,style,tier,tag)=>{
   const side=face+facing*.055;
   if(alongZ)
    add(side+facing*(depth/2),centerY+offsetY,b.z+offset,depth,height,width,style,tier,b.zone,tag);
   else
    add(b.x+offset,centerY+offsetY,side+facing*(depth/2),width,height,depth,style,tier,b.zone,tag);
  };
  put(0,.86,span*.86,.11,.14,'metal',0,'weathered-canopy-rail');
  put(0,-.9,span*.72,.075,.13,'rust',1,'utility-raceway');
  put(-span*.27,-.1,.78,.60,.14,'grate',1,'exhaust-intake');
  put(-span*.27,-.1,.06,.6,.17,'dark',1,'exhaust-louver');
  put(-span*.27+.17,-.1,.06,.6,.17,'dark',1,'exhaust-louver');
  put(span*.28,-.1,.66,.85,.1,'metal',1,'service-cabinet');
  put(span*.28,.16,.42,.22,.12,accent,2,'status-terminal');
  put(span*.28,-.42,.38,.06,.12,'dark',2,'cabinet-access');
  if(b.h>8){
   const higher=Math.min(4.0,b.h-2.0);
   put(-span*.40,higher,.12,Math.max(1,higher*1.35),.11,'dark',1,'vertical-utility-pipe');
   put(span*.43,higher,.08,Math.max(1,higher),.11,'metal',2,'rain-downpipe');
   put(0,higher+1.0,span*.7,.075,.14,'metal',2,'floor-service-trim');
  }
  if(span>=9&&b.h>=9){
   const wireY=b.y+Math.min(b.h-1,7.8);
   const u=span*.42;
   const xyz=(a,y)=>alongZ?[face+facing*.10,y,b.z+a]:[b.x+a,y,face+facing*.10];
   wires.push({a:xyz(-u,wireY),b:xyz(u,wireY),mid:xyz(0,wireY-.45),tier:2,zone:b.zone});
  }
 }
 // Hand-curated signage attached to real facade coordinates. The sign card
 // faces outward; shallow metal housings support the holographic print.
 for(const zone of Object.keys(DISTRICT_STORIES)){
  const local=STORY_SIGNS.filter(s=>s.zone===zone);
  local.forEach((s,i)=>{
   const tier=toTier(i),w=2.4,h=.8,accent=DISTRICT_STORIES[zone].neon;
   const isX=Math.abs(Math.sin(s.rotation))>.5;
   const box=(dy,width,height,depth,style,tag)=>{
    const px=s.x+(isX?Math.sin(s.rotation)*.018:0);
    const pz=s.z+(!isX?Math.cos(s.rotation)*.018:0);
    add(px,s.y+dy,pz,isX?depth:width,height,isX?width:depth,style,tier,zone,tag);
   };
   box(0,w+.15,h+.16,.13,'dark','business-sign-housing');
   box(h*.48,w+.2,.045,.18,accent,'sign-top-light');
   box(-h*.48,w+.2,.04,.17,'metal','sign-rail');
   for(const signSide of [-1,1]){
    // Narrow rigid side brackets without protruding into routes.
    const dx=isX?0:signSide*(w/2+.06),dz=isX?signSide*(w/2+.06):0;
    add(s.x+dx,s.y,s.z+dz,isX?.12:.06,h+.12,isX?.06:.12,'metal',tier,zone,'sign-bracket');
   }
   // Cantilevered rain awnings project over the sidewalk, safely above eye
   // level; no gameplay collision is added anywhere beneath the awning.
   const outward=.32;
   add(s.x+(isX?Math.sin(s.rotation)*outward:0),s.y-.77,
    s.z+(!isX?Math.cos(s.rotation)*outward:0),
    isX?.64:w*1.03,.08,isX?w*1.03:.64,'metal',tier,zone,'shop-rain-awning');
   for(const offset of [-.79,0,.79]){
    const sx=isX?0:offset,sz=isX?offset:0;
    add(s.x+sx+(isX?Math.sin(s.rotation)*.63:0),s.y-.72,
     s.z+sz+(!isX?Math.cos(s.rotation)*.63:0),
     isX?.045:.045,.04,isX?.045:.045,accent,Math.max(1,tier),zone,'awning-led');
   }
   box(-.65,w*.73,.045,.08,'grate','service-awning');
   signs.push({...s,tier,localIndex:i,width:w,height:h});
  });
 }
 return {parts,wires,signs,zoneCounts,
  stats:{parts:parts.length,wires:wires.length,signs:signs.length,facades:used.size,
   floorMarkings:parts.filter(p=>p.tag==='traffic-marker'||p.tag==='lane-edge').length}};
}
function paintSignAtlas(T,zone,signs){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const c=canvas.getContext('2d'),accent=DISTRICT_STORIES[zone].color;
 for(let i=0;i<16;i++){
  const x=(i%4)*256,y=Math.floor(i/4)*128;
  c.fillStyle='#0b1728';c.fillRect(x,y,256,128);
  c.fillStyle='#1b3247';c.fillRect(x+4,y+4,248,120);
  c.fillStyle=accent;c.fillRect(x+7,y+7,242,5);
  c.fillRect(x+7,y+116,242,4);
  c.fillStyle='#091522';c.fillRect(x+12,y+18,232,87);
  c.textBaseline='middle';c.textAlign='center';
  const sign=signs[i];
  if(!sign)continue;
  // Big legible bilingual-feeling glyph hierarchy without an external font.
  c.shadowColor=accent;c.shadowBlur=9;c.fillStyle=accent;
  c.font='bold 25px sans-serif';c.fillText(sign.text,x+128,y+53,226);
  c.shadowBlur=0;c.fillStyle='#d3eff7';c.font='bold 12px monospace';
  c.fillText(sign.sub,x+128,y+88,222);
  c.fillStyle=accent;c.fillRect(x+21,y+99,27,2);c.fillRect(x+208,y+99,27,2);
 }
 const tex=new T.CanvasTexture(canvas);
 tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;tex.needsUpdate=true;
 return tex;
}
export function createEnvironment43(T,map,materials){
 const plan=planEnvironment43(map);
 const group=new T.Group();group.name='phase43-environmental-storytelling';
 group.userData.collidable=false;
 const geometries=[],ownedMaterials=[],textures=[];
 const unit=new T.BoxGeometry(1,1,1),matrix=new T.Matrix4(),pos=new T.Vector3();
 const quat=new T.Quaternion(),scale=new T.Vector3();
 const buckets=new Map();
 for(const b of plan.parts){
  const key=b.style+'::'+b.tier;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(b);
 }
 for(const [key,items] of buckets){
  const [style,tierName]=key.split('::'),tier=Number(tierName);
  const material=materials.get(style);
  const mesh=new T.InstancedMesh(unit,material,items.length);
  mesh.name='phase43-'+style+'-tier'+tier;
  mesh.userData={environment43:true,environmentTier:tier,collidable:false};
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  items.forEach((b,i)=>{
   pos.set(b.x,b.y,b.z);scale.set(b.w,b.h,b.d);
   matrix.compose(pos,quat,scale);mesh.setMatrixAt(i,matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;group.add(mesh);
 }
 const signsByZone=new Map();
 for(const zone of Object.keys(DISTRICT_STORIES)){
  const local=plan.signs.filter(s=>s.zone===zone);
  if(!local.length)continue;
  const tex=paintSignAtlas(T,zone,local);textures.push(tex);
  const mat=new T.MeshBasicMaterial({map:tex,toneMapped:false,side:T.DoubleSide});
  ownedMaterials.push(mat);
  const perTier=new Map();
  local.forEach(sign=>{
   const g=new T.PlaneGeometry(sign.width,sign.height),uv=g.attributes.uv;
   const col=sign.localIndex%4,row=Math.floor(sign.localIndex/4);
   for(let j=0;j<uv.count;j++){
    const u=uv.getX(j),v=uv.getY(j);
    uv.setXY(j,(col+u)/4,1-(row+1-v)/4);
   }
   g.rotateY(sign.rotation);
   g.translate(sign.x+Math.sin(sign.rotation)*.105,sign.y,sign.z+Math.cos(sign.rotation)*.105);
   if(!perTier.has(sign.tier))perTier.set(sign.tier,[]);
   perTier.get(sign.tier).push(g);
  });
  for(const [tier,gs] of perTier){
   const merged=mergeGeometries(gs,false);
   for(const g of gs)g.dispose();
   if(!merged)throw Error('Environment sign atlas could not merge');
   geometries.push(merged);
   const mesh=new T.Mesh(merged,mat);
   mesh.name='phase43-signs-'+zone+'-tier'+tier;
   mesh.userData={environment43:true,environmentTier:tier,collidable:false};
   mesh.frustumCulled=false;group.add(mesh);
  }
  signsByZone.set(zone,local.length);
 }
 if(plan.wires.length){
  const gs=plan.wires.map(w=>{
   const curve=new T.QuadraticBezierCurve3(new T.Vector3(...w.a),
    new T.Vector3(...w.mid),new T.Vector3(...w.b));
   return new T.TubeGeometry(curve,14,.022,4,false);
  });
  const merged=mergeGeometries(gs,false);
  for(const g of gs)g.dispose();
  if(merged){
   geometries.push(merged);
   const mesh=new T.Mesh(merged,materials.get('dark'));
   mesh.name='phase43-overhead-cables';
   mesh.userData={environment43:true,environmentTier:2,collidable:false};
   mesh.frustumCulled=false;group.add(mesh);
  }
 }
 let detailEnabled=true,active='high';
 function visibility(){
  const level=active==='performance'?0:active==='ultra'?2:1;
  for(const mesh of group.children){
   const tier=mesh.userData.environmentTier||0;
   mesh.visible=tier<=level&&(detailEnabled||tier===0);
  }
 }
 function setQuality(mode='high'){active=mode;visibility();}
 function setDetail(enabled){detailEnabled=Boolean(enabled);visibility();}
 function dispose(){
  unit.dispose();
  for(const g of geometries)g.dispose();
  for(const material of ownedMaterials)material.dispose();
  for(const t of textures)t.dispose();
  group.removeFromParent();
 }
 setQuality('high');
 return {group,plan,stats:{...plan.stats,batches:group.children.length,signsByZone:Object.fromEntries(signsByZone)},
  setQuality,setDetail,dispose};
}
