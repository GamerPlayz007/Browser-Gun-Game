/**
 * CROSSFire Operator 03 — async GLB cosmetic adapter.
 * Source model: /static/operators/CROSSFire_Operator_03_PBR_Game.glb
 * Per-skin 1152px colour atlas; shared GLB normal/metal/roughness stay intact.
 * Legacy player rig is animation driver and safe fallback if assets are missing.
 */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {operator03Skin,OPERATOR03_DEFAULT} from './operator03_skins.js';

const MODEL='/static/operators/CROSSFire_Operator_03_PBR_Game.glb';
const SKIN_ATLAS=id=>'/static/operators/CROSSFire_Operator_03_'+id+'_BaseColor_Atlas.png';
const gltfLoader=new GLTFLoader(),textureLoader=new T.TextureLoader();
const atlasPromises=new Map(),skinMaterials=new Map();
let modelPromise=null,modelUnavailable=false,loggedFailure=false;
function loadModel(){
 if(modelUnavailable)return Promise.reject(new Error('Operator 03 GLB unavailable'));
 if(!modelPromise)modelPromise=new Promise((resolve,reject)=>{
  gltfLoader.load(MODEL,data=>resolve(data.scene),undefined,reject);
 }).catch(e=>{modelUnavailable=true;throw e;});
 return modelPromise;
}
function loadAtlas(skin){
 if(!atlasPromises.has(skin))atlasPromises.set(skin,new Promise((resolve,reject)=>{
  textureLoader.load(SKIN_ATLAS(skin),texture=>{
   texture.colorSpace=T.SRGBColorSpace;
   texture.flipY=false;texture.anisotropy=2;
   resolve(texture);
  },undefined,reject);
 }).catch(e=>{atlasPromises.delete(skin);throw e;}));
 return atlasPromises.get(skin);
}
function materialFor(base,skin,atlas){
 if(!atlas)return base;
 const key=skin+':'+base.uuid;
 if(!skinMaterials.has(key)){
  const material=base.clone();
  material.name='CF_Operator03_'+skin;
  material.map=atlas;material.needsUpdate=true;
  skinMaterials.set(key,material);
 }
 return skinMaterials.get(key);
}
function hideLegacy(root){
 const data=root.userData;
 if(!data.operator03LegacyMeshes){
  data.operator03LegacyMeshes=[];
  data.body.traverse(o=>{
   if(!o.isMesh&&!o.isInstancedMesh)return;
   let parent=o,keep=false;
   while(parent&&parent!==data.body){
    if(parent===data.gun||parent===data.impact){keep=true;break;}
    parent=parent.parent;
   }
   if(!keep)data.operator03LegacyMeshes.push(o);
  });
 }
 data.operator03LegacyMeshes.forEach(o=>o.visible=false);
}
export function syncOperator03Rig(root){
 const d=root?.userData,rig=d?.operator03Rig;
 if(!rig)return;
 function move(node,driver){
  if(!node||!driver)return;
  node.position.copy(driver.position);
  node.quaternion.copy(driver.quaternion);
 }
 move(rig.body,d.body);
 move(rig.head,d.head);
 for(let i=0;i<2;i++){
  move(rig.legs[i],d.legs[i]);move(rig.knees[i],d.knees[i]);
  move(rig.arms[i],d.arms[i]);move(rig.elbows[i],d.elbows[i]);
 }
}
export async function setOperator03Skin(root,requestedSkin){
 const data=root?.userData;
 if(!data||data.operator03Disposed)return;
 const skin=operator03Skin(requestedSkin);
 if(data.operator03Wanted===skin&&
    (data.operator03Applied===skin||data.operator03PendingSkin===skin))return;
 data.operator03Wanted=skin;
 data.operator03PendingSkin=skin;
 try{
  const model=await loadModel();
  let atlas=null;
  try{atlas=await loadAtlas(skin);}catch(e){
   if(!loggedFailure){console.warn('Operator 03 atlas missing; using base GLB colours',e);loggedFailure=true;}
  }
  if(data.operator03Disposed||data.operator03Wanted!==skin)return;
  if(!data.operator03Visual){
   const clone=model.clone(true);
   clone.name='CROSSFIRE_OPERATOR_03';
   const rig={
    body:clone.getObjectByName('rig_body'),
    head:clone.getObjectByName('head'),
    legs:[clone.getObjectByName('leg_L'),clone.getObjectByName('leg_R')],
    knees:[clone.getObjectByName('knee_L'),clone.getObjectByName('knee_R')],
    arms:[clone.getObjectByName('arm_L'),clone.getObjectByName('arm_R')],
    elbows:[clone.getObjectByName('elbow_L'),clone.getObjectByName('elbow_R')]
   };
   if(!rig.body||!rig.head||rig.legs.some(x=>!x)||rig.knees.some(x=>!x)||
      rig.arms.some(x=>!x)||rig.elbows.some(x=>!x))
    throw new Error('Operator 03 pivot names differ from the match rig');
   clone.traverse(o=>{
    if(o.isMesh){
     o.userData.operator03Shared=true;
     o.castShadow=true;o.frustumCulled=false;
     o.userData.operator03BaseMaterial=o.material;
    }
   });
   root.add(clone);
   data.operator03Rig=rig;
   data.operator03Visual=clone;
   data.operator03Active=true;
   hideLegacy(root);
   syncOperator03Rig(root);
  }
  data.operator03Visual.traverse(o=>{
   if(o.isMesh)o.material=materialFor(o.userData.operator03BaseMaterial,skin,atlas);
  });
  data.operator03Applied=skin;
 }catch(error){
  if(!loggedFailure){
   loggedFailure=true;
   console.warn('Operator 03 could not load: retaining original avatar',error);
  }
 }finally{
  if(data.operator03PendingSkin===skin)data.operator03PendingSkin=null;
 }
}
export function keepOperator03LegacyHidden(root){
 if(root?.userData?.operator03Active)hideLegacy(root);
}
export function disposeOperator03Rig(root){
 if(!root?.userData)return;
 root.userData.operator03Disposed=true;
 root.userData.operator03Rig=null;
 root.userData.operator03Visual=null;
 // GLB geometry and PBR materials are shared by the loader cache.
}
