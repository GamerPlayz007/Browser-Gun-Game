// Phase 4.1 — shared, deterministic procedural PBR surfaces.
// All detail is visual-only: no physics, collision or network state changes.
export const SURFACE_STYLES=[
 'facade','concrete','dark','road','asphalt','metal','grate','rust','wood',
 'pale','glass','tile','garden','leather','window'
];
export const NEON_STYLES=['cyan','magenta','amber','white'];
const NEON={cyan:'#38eff7',magenta:'#ff4b9e',amber:'#ffb454',white:'#c8f8ff'};
const SPECS={
 facade:{base:[54,70,87],rough:.77,metal:.18,bump:.065,glow:1.55},
 concrete:{base:[105,115,129],rough:.88,metal:.04,bump:.07},
 dark:{base:[46,60,76],rough:.76,metal:.20,bump:.052},
 road:{base:[48,54,65],rough:.88,metal:.04,bump:.075},
 asphalt:{base:[42,48,56],rough:.87,metal:.03,bump:.075},
 metal:{base:[120,135,149],rough:.43,metal:.78,bump:.045},
 grate:{base:[99,111,124],rough:.55,metal:.72,bump:.07},
 rust:{base:[122,92,84],rough:.81,metal:.48,bump:.085},
 wood:{base:[114,82,71],rough:.88,metal:.02,bump:.055},
 pale:{base:[145,163,174],rough:.59,metal:.18,bump:.04},
 glass:{base:[45,76,103],rough:.24,metal:.16,bump:.012,glow:.11},
 window:{base:[41,72,95],rough:.19,metal:.12,bump:.012,glow:1.7},
 tile:{base:[112,126,143],rough:.47,metal:.14,bump:.047},
 garden:{base:[69,104,81],rough:.94,metal:0,bump:.075},
 leather:{base:[87,69,82],rough:.77,metal:.02,bump:.045}
};
const clamp=n=>Math.max(0,Math.min(255,Math.round(n)));
const rgb=a=>'rgb('+a.map(clamp).join(',')+')';
const hash=s=>{let h=2166136261;for(const c of s){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;}return h;};
const random=s=>{let n=hash(s);return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
function atlas(T,style,size=512){
 const spec=SPECS[style]||SPECS.concrete,r=random('crossfire-41-'+style);
 const canvases=Array.from({length:4},()=>{
  const c=document.createElement('canvas');c.width=c.height=size;return c;
 });
 const c=canvases.map(canvas=>canvas.getContext('2d'));
 const paint=(x,y,w,h,color,rough=196,height=128,light=[0,0,0])=>{
  const values=[rgb(color),'rgb('+clamp(rough)+','+clamp(rough)+','+clamp(rough)+')',
   'rgb('+clamp(height)+','+clamp(height)+','+clamp(height)+')',rgb(light)];
  for(let i=0;i<4;i++){c[i].fillStyle=values[i];c[i].fillRect(x,y,w,h);}
 };
 const line=(x,y,ex,ey,width=1,opacity=.2)=>{
  c[0].strokeStyle='rgba(2,9,19,'+opacity+')';c[0].lineWidth=width;
  c[0].beginPath();c[0].moveTo(x,y);c[0].lineTo(ex,ey);c[0].stroke();
  c[2].strokeStyle='rgba(32,32,32,'+opacity+')';c[2].lineWidth=width;
  c[2].beginPath();c[2].moveTo(x,y);c[2].lineTo(ex,ey);c[2].stroke();
 };
 paint(0,0,size,size,spec.base,spec.rough*255,124);
 const cell=['facade','glass','window'].includes(style)?64:
  ['metal','grate','rust','tile','wood','dark'].includes(style)?128:128;
 for(let y=0;y<size;y+=cell)for(let x=0;x<size;x+=cell){
  const delta=(r()-.5)*20,base=spec.base.map(v=>v+delta);
  if(style==='facade'||style==='dark'||style==='glass'||style==='window'){
   // Recessed facade bays with differently lit interiors and reflective glazing.
   paint(x+2,y+2,cell-4,cell-4,base,202,144);
   paint(x+8,y+8,cell-16,cell-16,[9,22,37],65,54);
   const lit=style==='window'||(style==='facade'?r()>.46:style==='glass'?r()>.89:r()>.88);
   const color=style==='window'?[197,222,235]:
    r()>.73?[255,175,99]:r()>.47?[229,67,152]:[63,209,244];
   const glass=lit?color:[18+r()*15,34+r()*22,53+r()*20];
   paint(x+11,y+11,cell-22,cell-22,glass,lit?52:80,lit?86:58,
    lit?style==='window'?[255,255,255]:color:[0,0,0]);
   // Metallic mullions, ledges and interior floor strips.
   paint(x+cell/2-2,y+7,4,cell-14,[31,39,51],161,191);
   paint(x+7,y+cell-13,cell-14,5,[24,32,47],166,192);
   if(lit){c[0].fillStyle='rgba(255,255,255,.18)';c[0].fillRect(x+13,y+12,3,cell-30);}
   if(style==='facade'){paint(x,y+cell-5,cell,5,[87,103,120],194,212);}
  }else if(style==='metal'||style==='rust'||style==='grate'){
   paint(x+2,y+2,cell-4,cell-4,base,style==='rust'?215:115,146);
   paint(x+8,y+8,cell-16,cell-16,base.map(v=>v-18),175,98);
   if(style==='grate'){
    for(let k=12;k<cell-8;k+=13)paint(x+k,y+9,6,cell-18,[13,24,36],82,39);
   }else{
    for(let k=0;k<3;k++)line(x+12,y+26+k*39,x+cell-12,y+26+k*39,2,.34);
    if(style==='rust')for(let k=0;k<7;k++){
     const px=x+8+r()*(cell-20),py=y+8+r()*(cell-20);
     paint(px,py,5+r()*15,2+r()*7,[132+r()*42,63+r()*30,43+r()*17],224,94);
    }
   }
   for(const bx of [x+8,x+cell-12])for(const by of [y+8,y+cell-12])
    paint(bx,by,4,4,[170,181,188],68,226);
  }else if(style==='tile'||style==='concrete'||style==='pale'){
   paint(x+3,y+3,cell-6,cell-6,base,210,138);
   line(x,y+2,x+cell,y+2,3,.27);
   if(r()>.55)line(x+cell/2,y+5,x+cell/2-5,y+cell-6,1,.24);
   if(style==='tile')paint(x+8,y+8,cell-16,cell-16,base.map(v=>v+16),132,169);
  }else if(style==='wood'){
   paint(x+2,y+2,cell-4,cell-4,base,230,124);
   for(let k=0;k<10;k++)line(x+4,y+r()*cell,x+cell-4,y+r()*cell,1+r()*1.4,.25);
  }else if(style==='road'||style==='asphalt'){
   paint(x+1,y+1,cell-2,cell-2,base,225,126);
   for(let k=0;k<4;k++){
    const px=x+r()*cell,py=y+r()*cell;
    line(px,py,px+(r()-.5)*36,py+14+r()*35,.6+r(),.28);
   }
  }else if(style==='garden'){
   paint(x,y,cell,cell,base,245,134);
   for(let k=0;k<28;k++){
    const px=x+r()*cell,py=y+r()*cell;
    paint(px,py,2+r()*8,1+r()*5,[35+r()*55,83+r()*60,55+r()*35],242,146);
   }
  }else{
   paint(x+2,y+2,cell-4,cell-4,base,208,134);
  }
 }
 // Microscopic speckles and grime provide material information up close.
 for(let i=0;i<size*2;i++){
  const x=r()*size,y=r()*size,s=.8+r()*2.4,dark=r()>.54;
  c[0].fillStyle=dark?'rgba(4,9,18,.24)':'rgba(242,247,255,.10)';c[0].fillRect(x,y,s,s);
  c[1].fillStyle=dark?'rgba(35,35,35,.22)':'rgba(240,240,240,.11)';c[1].fillRect(x,y,s,s);
  c[2].fillStyle=dark?'rgba(0,0,0,.12)':'rgba(245,245,245,.09)';c[2].fillRect(x,y,s,s);
 }
 if(['concrete','road','asphalt','facade','rust'].includes(style))
  for(let i=0;i<26;i++){
   const x=r()*size,y=r()*size;
   line(x,y,x+(r()-.5)*55,y+12+r()*80,.6+r()*.8,.12+r()*.2);
  }
 return Object.fromEntries(['map','roughnessMap','bumpMap','emissiveMap'].map((name,i)=>{
  const t=new T.CanvasTexture(canvases[i]);t.wrapS=t.wrapT=T.RepeatWrapping;
  t.anisotropy=4;t.colorSpace=(i===0||i===3)?T.SRGBColorSpace:T.NoColorSpace;
  return [name,t];
 }));
}
export function createSurfaceBoxGeometry(T,b,unit=2.4){
 const g=new T.BoxGeometry(b.w,b.h,b.d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
  uv.setXY(i,(nx>.5?z:x)/unit,(ny>.5?z:y)/unit);
 }
 g.translate(b.x,b.y+b.h/2,b.z);
 return g;
}
export function createCyberMaterialLibrary(T){
 const textureCache=new Map(),materialCache=new Map();
 const get=(style,options={})=>{
  const known=NEON_STYLES.includes(style)||SURFACE_STYLES.includes(style)?style:'concrete';
  const key=[known,options.tint||'',options.glow??'',options.emissive||'',options.roughness??''].join('|');
  if(materialCache.has(key))return materialCache.get(key);
  if(NEON_STYLES.includes(known)){
   const m=new T.MeshBasicMaterial({color:NEON[known],toneMapped:false,side:T.DoubleSide});
   materialCache.set(key,m);return m;
  }
  if(!textureCache.has(known))textureCache.set(known,atlas(T,known));
  const maps=textureCache.get(known),spec=SPECS[known];
  const m=new T.MeshStandardMaterial({
   color:options.tint||'#f3f6fc',map:maps.map,roughnessMap:maps.roughnessMap,
   bumpMap:maps.bumpMap,emissiveMap:maps.emissiveMap,
   roughness:options.roughness??spec.rough,metalness:spec.metal,bumpScale:spec.bump,
   emissive:options.emissive||'#ffffff',emissiveIntensity:options.glow??spec.glow??0,
   envMapIntensity:1.1,side:T.FrontSide
  });
  m.userData.baseMaps=maps;m.userData.baseBump=spec.bump;
  materialCache.set(key,m);return m;
 };
 const setQuality=mode=>{
  const low=mode==='performance';
  for(const m of materialCache.values()){
   if(!m.isMeshStandardMaterial)continue;
   const maps=m.userData.baseMaps;
   m.map=maps.map;m.roughnessMap=maps.roughnessMap;
   m.bumpMap=low?null:maps.bumpMap;
   // Preserve neon window emission even on Performance.
   m.emissiveMap=maps.emissiveMap;
   m.bumpScale=mode==='ultra'?m.userData.baseBump*1.28:m.userData.baseBump;
   m.envMapIntensity=low?.28:mode==='ultra'?1.55:1.08;
   m.needsUpdate=true;
  }
 };
 return {get,setQuality,dispose(){
  for(const m of materialCache.values())m.dispose();
  for(const maps of textureCache.values())for(const t of Object.values(maps))t.dispose();
 },get materialCount(){return materialCache.size;},get atlasCount(){return textureCache.size;}};
}
