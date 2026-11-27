/**
 * CROSSFire Workshop · Phase 2 / Stage 1.
 * Versioned inventory of actual repository assets and a personal GLB collection.
 * This module has no game, physics, network-room, or render-loop dependencies.
 */
const assetPath = file => '/static/assets/' + file;
const profile = (id, label, filename, bytes) => ({id, label, type:filename.endsWith('.gltf')?'gltf':'url', url:assetPath(filename), bytes});
const entry = (id,title,category,status,description,profiles=[],note='',origin='CROSSFire repository') => ({id,title,category,status,description,profiles,note,origin});

export const WORKSHOP_CATALOG = Object.freeze([
  entry('fox-reference','Fox · Rigged Sample','reference','Reference',
    'Artist-made, skinned test model with Survey, Walk and Run animations.',[
      {id:'HERO',label:'Hero · 1024px',type:'embedded',bytes:162928},
      {id:'PERFORMANCE',label:'Performance · 256px',type:'embedded',bytes:150248}
    ],'Khronos sample: model CC0 (PixelMannen); rig/animations CC BY 4.0 (tomkranis); conversion CC BY 4.0 (AsoboStudio/scurest).','Khronos glTF Sample Assets'),
  entry('s12-v04','S-12 · v0.4','production','In game',
    'Approved shotgun cosmetic GLB used by the live game.',[
      profile('PERFORMANCE','Performance · v0.4','crossfire-s12-v04-performance.glb',2497928)
    ],'Only the performance GLB is present in this repository.'),
  entry('specter-midnight','SPECTER · Midnight','development','Development',
    'Original SPECTER game-art finish with three export quality levels.',[
      profile('PERFORMANCE','Performance','aether9-specter-midnight-performance.glb',6062328),
      profile('BALANCED','Balanced','aether9-specter-midnight-balanced.glb',17629452),
      profile('ORIGINAL','Original high-res','aether9-specter-midnight.glb',44529064)
    ]),
  entry('specter-glacier','SPECTER · Glacier','development','Development',
    'Alternative Glacier finish of the SPECTER GLB.',[
      profile('PERFORMANCE','Performance','aether9-specter-glacier-performance.glb',6462244),
      profile('BALANCED','Balanced','aether9-specter-glacier-balanced.glb',19236748),
      profile('ORIGINAL','Original high-res','aether9-specter-glacier.glb',48197220)
    ]),
  entry('specter-eclipse','SPECTER · Eclipse','development','Development',
    'Alternative Eclipse finish of the SPECTER GLB.',[
      profile('PERFORMANCE','Performance','aether9-specter-eclipse-performance.glb',6129964),
      profile('BALANCED','Balanced','aether9-specter-eclipse-balanced.glb',17908124),
      profile('ORIGINAL','Original high-res','aether9-specter-eclipse.glb',45218604)
    ]),
  entry('specter-early','SPECTER · Early Versions','development','Prototype',
    'Earlier source GLB exports preserved for version comparisons.',[
      profile('PHASE1','Phase 1 prototype','aether9-specter-phase1.glb',252528),
      profile('V1','Early studio export','aether9-specter.glb',841348)
    ]),
  entry('industrial-lantern','Lantern · Industrial Street Light','development','Import required',
    'CC0 artist-made street light from Khronos, prepared for Blender processing.',[],
    'Use the official pinned source link in the Production Workbench. Source is not bundled, no Blender exports have run.','Khronos glTF Sample Assets'),
  entry('beacon','Studio Beacon','reference','Reference',
    'Original neutral 3D scene for testing material import.',[
      profile('GLTF','Embedded glTF scene','studio-beacon.gltf',110079)
    ],'Standalone embedded glTF; no external texture files.'),
  entry('ar01-code','AR-01 · v0.4','production','Game-only',
    'Current game model assembled at runtime; no standalone preview GLB is present.',[],
    'Source: static/ar01_v04_model.js. Preview requires the live game.'),
  entry('smg05-code','SMG-05 · v0.2','production','Game-only',
    'Current game model assembled at runtime; no standalone preview GLB is present.',[],
    'Source: static/smg05_v02_model.js. Preview requires the live game.'),
  entry('operator03-code','Operator 03 · Camouflage','production','Game-only',
    'The player model and camouflages are imported through game runtime code.',[],
    'Source: static/operator03_model.js. No standalone GLB in this repository.'),
  entry('awp01-v03','AWP-01 · v0.3 ORIGINAL','production','In game',
    'Our original green-and-black AWP-01 sniper game artwork: extended scope, contoured stock and full horizontal silhouette. Exact original recovered, not the archived AETHER-L7.',[
      profile('ORIGINAL','Original approved artwork · v0.3','CROSSFIRE_AWP_ReferenceInspired_v03.glb',4682872)
    ],'Permanent repository GLB, 396 artist meshes and 23 materials. Verified exact SHA-256 a227f177bc1d5398ec5919aaf537a8a29ab48a2c10b9c9c51b73b74366351b4b. Loaded as the approved in-game weapon 3 cosmetic, with no changes to game mechanics.','CROSSFire / AWP-01 original')
]);
export const PERSONAL_MAX_BYTES=30_000_000;
const DB_NAME='crossfire-workshop-asset-library-v1',TABLE='assets';

export function matchCatalog(assets,{query='',category='all'}={}){
  const term=String(query).trim().toLowerCase();
  return assets.filter(a=>(category==='all'||a.category===category)&&
    (!term||[a.title,a.status,a.description,a.id,a.note,...a.profiles.map(p=>p.label)].join(' ').toLowerCase().includes(term)));
}
export function personalToEntry(record){
  return entry(record.id,record.name,'personal','Browser saved',
    'Imported from your own GLB file, stored only in this browser.',
    [{id:'LOCAL',label:'Imported GLB',type:'local',bytes:record.size}],
    'Not shared, uploaded to GitHub, or inserted into multiplayer.','This browser');
}
export function validateGLBHeader(header,total){
  if(!(header instanceof ArrayBuffer)||header.byteLength<12)throw Error('Invalid GLB header');
  const view=new DataView(header);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==total)
    throw Error('File is not a complete glTF 2.0 binary model');
  return true;
}
export async function validatePersonalGLB(file){
  if(!file||!(/\.glb$/i).test(file.name||''))throw Error('Choose a .glb file');
  if(!Number.isSafeInteger(file.size)||file.size<20||file.size>PERSONAL_MAX_BYTES)
    throw Error('GLB must be between 20 bytes and 30 MB');
  validateGLBHeader(await file.slice(0,12).arrayBuffer(),file.size);
  return true;
}
function openDatabase(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined')return reject(Error('Browser storage unavailable'));
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(TABLE))request.result.createObjectStore(TABLE,{keyPath:'id'})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Could not open personal asset library'));
    request.onblocked=()=>reject(Error('Asset database is busy in another tab'));
  });
}
async function operation(mode,callback){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const fail=e=>{if(settled)return;settled=true;db.close();reject(e||Error('Asset storage failed'))};
    let request;
    try{const tx=db.transaction(TABLE,mode);request=callback(tx.objectStore(TABLE));
      tx.oncomplete=()=>{if(settled)return;settled=true;db.close();resolve(request.result)};
      tx.onerror=()=>fail(tx.error);
      tx.onabort=()=>fail(tx.error);
    }catch(e){fail(e)}
  });
}
export async function listPersonalAssets(){
  const records=await operation('readonly',store=>store.getAll());
  return records.map(({id,name,size,createdAt})=>({id,name,size,createdAt})).sort((a,b)=>b.createdAt-a.createdAt);
}
export async function getPersonalAsset(id){return operation('readonly',store=>store.get(id))}
export async function removePersonalAsset(id){return operation('readwrite',store=>store.delete(id))}
export async function savePersonalAsset(file){
  await validatePersonalGLB(file);
  const id='personal-'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2));
  const record={id,name:file.name,size:file.size,createdAt:Date.now(),blob:file};
  await operation('readwrite',store=>store.add(record));
  return {id,name:record.name,size:record.size,createdAt:record.createdAt};
}