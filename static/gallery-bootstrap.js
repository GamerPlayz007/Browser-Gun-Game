/** Keep the static gallery usable when the optional 3D module cannot initialize. */
const controls=['load-preferred','preset','glacier','eclipse','wire','auto','reset','light','quality','batch-static','file'];
export function showGalleryFallback(doc){
 for(const id of controls){const element=doc.getElementById(id);if(element)element.disabled=true;}
 const status=doc.getElementById('status');
 if(status){status.textContent='INTERACTIVE 3D UNAVAILABLE · STATIC GALLERY REMAINS AVAILABLE';status.classList.add('error');}
 const canvas=doc.getElementById('canvas');if(canvas)canvas.hidden=true;
 const loading=doc.getElementById('loading');if(loading)loading.hidden=true;
 const profile=doc.getElementById('profile-status');if(profile)profile.textContent='3D QUALITY CONTROLS UNAVAILABLE';
 const instructions=doc.getElementById('instructions');if(instructions)instructions.textContent='OPEN ANY GALLERY IMAGE TO VIEW THE FULL RENDER';
}
if(typeof document!=='undefined'){
 import('./aether9-pbr-showroom.js').catch(error=>{
  console.warn('Optional gallery viewer unavailable',error);
  showGalleryFallback(document);
 });
}
