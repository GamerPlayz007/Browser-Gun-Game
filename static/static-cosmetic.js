/** Optional static sci-fi cosmetic artwork. No gameplay, network or animation changes. */
import * as T from 'three';
import {readAssetBytes,chooseGalleryFinish} from './gallery-assets.js';

export function cosmeticAssetPath(finish,tier,report,weaponId=0){
 // S9 is the approved-for-preview sculpted VESPER; the other asset families stay unchanged.
 const tag=['aether9-specter','aether-s9-vesper','aether-w12','aether-l7'][Number(weaponId)]||'aether9-specter';
 const name=tag+'-'+chooseGalleryFinish(finish);
 const original='/static/assets/'+name+'.glb';
 // School laptops keep cheap geometry on Performance; larger VESPER texture variants
 // are optional cosmetics on Auto/High and never participate in gameplay logic.
 if(Number(weaponId)===1&&tier==='performance')return null;
 const profile=tier==='performance'?'performance':tier==='auto'?'balanced':null;
 if(profile){
  const item=report?.[name+'.glb']?.[profile];
  if(!item||!Number.isSafeInteger(item.output_bytes)||item.output_bytes<=0||item.output_bytes>=item.input_bytes)return null;
  return '/static/assets/'+name+'-'+profile+'.glb';
 }
 return ['high','ultra','native'].includes(tier)?original:null;
}
function disposeArtwork(root){
 const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
 root.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);
  if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material])){
   materials.add(m);
   for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
  }
 });
 root.removeFromParent();
 for(const g of geometries)g.dispose();
 for(const t of textures){if(t.source?.data?.close)images.add(t.source.data);t.dispose();}
 for(const m of materials)m.dispose();
 for(const image of images)image.close();
}
function localArtBounds(group){
 group.updateWorldMatrix(true,true);
 const inverse=new T.Matrix4().copy(group.matrixWorld).invert();
 const bounds=new T.Box3();
 group.traverseVisible(o=>{
  if(!o.isMesh||!o.geometry)return;
  if(o.isInstancedMesh){if(!o.boundingBox)o.computeBoundingBox();}
  else if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  const box=o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox;
  if(box&&!box.isEmpty())bounds.union(box.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
 });
 return bounds;
}
function fitStaticArt(scene,bounds){
 const container=new T.Group();container.add(scene);
 const source=new T.Box3().setFromObject(container);
 if(source.isEmpty()||bounds.isEmpty())throw Error('Empty cosmetic bounds');
 const a=source.getSize(new T.Vector3()),b=bounds.getSize(new T.Vector3());
 const scale=Math.max(b.x,b.y,b.z)/Math.max(a.x,a.y,a.z);
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid cosmetic scale');
 container.scale.setScalar(scale);
 container.position.copy(bounds.getCenter(new T.Vector3())).addScaledVector(source.getCenter(new T.Vector3()),-scale);
 container.name='Imported fictional cosmetic';
 return container;
}
export function createStaticCosmetic(rig,{finish='midnight',weaponId=0}={}){
 // AR-01 v0.4 is now the canonical art in every quality tier.
 // Do not restore older AETHER-9 gallery assets over the active AR.
 if(Number(weaponId)===0)return {update(){},dispose(){}};
 const group=rig?.userData?.aetherArtGun71;
 if(!group)return {update(){},dispose(){}};
 const old=group.children.filter(o=>o!==rig.userData.flash&&o!==rig.userData.reloadGlyph70);
 const visibility=new Map(old.map(o=>[o,o.visible]));
 let bounds;
 try{bounds=localArtBounds(group);}catch(error){console.warn('Optional cosmetic bounds unavailable',error);return {update(){},dispose(){}};}
 if(bounds.isEmpty())return {update(){},dispose(){}};
 let report=null,reportRequested=false,lastTier=null,art=null,pending=null,attempted=null;
 function restore(){
  if(art){disposeArtwork(art);art=null;}
  for(const [o,visible] of visibility)o.visible=visible;
 }
 function cancel(){pending?.abort();pending=null;}
 function requestManifest(){
  if(reportRequested)return;
  reportRequested=true;
  fetch(Number(weaponId)===1?'/static/assets/vesper-texture-profile-report.json':'/static/assets/texture-profile-report.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(data=>{report=data;}).catch(()=>{});
 }
 async function load(path){
  const controller=new AbortController();pending=controller;attempted=path;
  try{
   const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   if(controller.signal.aborted)return;
   const bytes=await readAssetBytes(path,{signal:controller.signal});
   if(controller.signal.aborted)return;
   const loader=new GLTFLoader();
   const gltf=await new Promise((resolve,reject)=>loader.parse(bytes,new URL('.',new URL(path,location.href)).href,resolve,reject));
   if(controller.signal.aborted||pending!==controller){disposeArtwork(gltf.scene);return;}
   let fitted;
   try{fitted=fitStaticArt(gltf.scene,bounds);}catch(e){disposeArtwork(gltf.scene);throw e;}
   restore();
   for(const o of old)o.visible=false;
   group.add(fitted);art=fitted;
  }catch(error){if(!controller.signal.aborted)console.warn('Optional cosmetic unavailable; retaining existing art',error);}
  finally{if(pending===controller)pending=null;}
 }
 return {
  update(visible,nextTier){
   const tier=nextTier;
   if(tier!==lastTier){cancel();restore();attempted=null;lastTier=tier;}
   if(!visible)return;
   if(tier==='performance'||tier==='auto')requestManifest();
   const path=cosmeticAssetPath(finish,tier,report,weaponId);
   if(!path||art||pending||attempted===path)return;
   load(path);
  },
  dispose(){cancel();restore();attempted=null;lastTier=null;}
 };
}
