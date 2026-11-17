/* CROSSFire Octavus original material adapter.
 * Source image provenance is in octavus.texture-manifest.json.
 * Map geometry CC BY-SA 3.0, image licenses/credits in octavus_assets.
 * No original model, sound or weapon assets are used here.
 */
import * as THREE from 'three';

const MANIFEST='/static/maps/octavus.texture-manifest.json';
const MAX_PENDING=8;
const mapCache=new Map();
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export async function loadOctavusMaterialLibrary(quality='auto'){
 let manifest=null;
 try{
  const response=await fetch(MANIFEST);
  if(response.ok)manifest=await response.json();
 }catch(error){console.warn('Octavus material archive unavailable:',error);}
 if(manifest?.format!=='OCTAVUS-TEX2')return {
  usable:false,manifest:null,channels:new Map(),textures:[],dispose(){},
  statistics:{originalDiffuseSlots:0,sourceImages:0}
 };
 const materials=manifest.materials||{};
 const unique=new Map();
 for(const def of Object.values(materials)){
  for(const [role,asset] of Object.entries(def.channels||{})){
   if(asset?.url?.startsWith('/static/maps/octavus_assets/'))
    unique.set(asset.url,{role,url:asset.url});
  }
 }
 const loader=new THREE.TextureLoader(),pending=[...unique.values()];
 const images=new Map(),textures=[];
 let cursor=0;
 async function worker(){
  while(cursor<pending.length){
   const task=pending[cursor++];
   try{
    const tex=await loader.loadAsync(task.url);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.magFilter=THREE.LinearFilter;
    tex.minFilter=THREE.LinearMipmapLinearFilter;
    tex.anisotropy=quality==='performance'?1:4;
    if(task.role==='color'||task.role==='glow')tex.colorSpace=THREE.SRGBColorSpace;
    // Exported OBJ UV coordinates represent source-image texel offsets,
    // so normalization is performed against each material's original size.
    images.set(task.url,tex);
    textures.push(tex);
   }catch(error){
    console.warn('Octavus source texture skipped:',task.url);
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(MAX_PENDING,pending.length)},()=>worker()));
 const channels=new Map();
 let sourceDiffuseSlots=0;
 for(const [key,definition] of Object.entries(materials)){
  const slot=Number(key),info=definition.channels||{};
  const look=role=>info[role]&&images.has(info[role].url)?images.get(info[role].url):null;
  const diffuse=look('color'),normal=look('normal');
  const roughness=look('roughness'),glow=look('glow');
  const base=info.color;
  if(diffuse)sourceDiffuseSlots++;
  channels.set(slot,{
   source:definition.source,shader:definition.shader,
   tint:definition.sourceTint,
   map:diffuse,normalMap:normal,roughnessMap:roughness,emissiveMap:glow,
   width:base?.width||512,height:base?.height||512
  });
 }
 return {
  usable:true,manifest,channels,textures,dispose(){for(const t of textures)t.dispose();},
  statistics:{originalDiffuseSlots:sourceDiffuseSlots,sourceImages:images.size,
              sourceSlots:channels.size,missingSources:manifest.missingSources?.length||0}
 };
}

export function createOctavusPBRMaterial(slot,library,fallback,quality='auto'){
 const source=library?.channels.get(slot);
 if(!source?.map)return {material:null,original:false};
 const variation=clamp(.95+(slot%9)*.008,.9,1);
 const tint=Array.isArray(source.tint)&&source.tint.length===3
  ?source.tint.map(x=>clamp(Number(x)||0,.18,1))
  :[1,1,1];
 const color=new THREE.Color(
  tint[0]*variation,tint[1]*variation,tint[2]*variation);
 const isGlow=!!source.emissiveMap||/glow|light|emiss/i.test(source.shader||'');
 const m=new THREE.MeshStandardMaterial({
  name:'Octavus original slot '+slot,
  map:source.map,
  color,
  roughness:.78,
  metalness:/metal|pipe|trim|vent|rail|barrel/i.test(source.source)? .42:.12,
  normalMap:quality==='performance'?null:source.normalMap,
  roughnessMap:quality==='performance'?null:source.roughnessMap,
  emissiveMap:source.emissiveMap,
  emissive:source.emissiveMap?new THREE.Color('#d6d5ce'):new THREE.Color('#000000'),
  emissiveIntensity:isGlow?.50:0,
  side:THREE.DoubleSide
 });
 return {material:m,original:true,width:source.width,height:source.height,
         normalMap:source.normalMap,roughnessMap:source.roughnessMap};
}
