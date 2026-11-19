/* Octavus 2.5: only request source image channels used by current quality.
 * Performance mode retains the genuine diffuse and glowing surfaces, while
 * High/Ultra additionally fetch source normal and roughness details.
 */
export function planOctavusTextureTasks(manifest,quality='auto',usedSlots=null){
 const fullDetail=quality==='high'||quality==='ultra';
 const allowed=new Set(fullDetail?
  ['color','glow','normal','roughness']:['color','glow']);
 const selected=usedSlots==null?null:new Set([...usedSlots].map(Number));
 const wanted=new Map(),all=new Set();
 const slots=[];
 for(const [key,entry] of Object.entries(manifest?.materials||{})){
  if(selected&&!selected.has(Number(key)))continue;
  slots.push(key);
  for(const [role,asset] of Object.entries(entry.channels||{})){
   if(!asset?.url?.startsWith('/static/maps/octavus_assets/'))continue;
   all.add(asset.url);
   if(allowed.has(role))wanted.set(asset.url,{role,url:asset.url});
  }
 }
 return {tasks:[...wanted.values()],slots,
  availableImages:all.size,skippedImages:all.size-wanted.size,
  profile:fullDetail?'detailed':'lean'};
}
