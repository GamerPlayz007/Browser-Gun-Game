/* Reconstructed native Octavus map models with original OBJ geometry.
 * Instances are taken from the MPZ map; there are NO generated substitute
 * blocks when source media cannot be faithfully converted.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {octavusEntityPosition} from './octavus_environment.js';

const base='/static/maps/';
const RAD=Math.PI/180;
async function fetchSource(path){
 try{const r=await fetch(base+path);return r.ok?await r.json():null;}
 catch{return null;}
}
export async function createOctavusProps(scene,quality='auto'){
 const [manifest,entitiesResponse,sourceCFG]=await Promise.all([
  fetchSource('octavus.props.json'),
  fetchSource('octavus.native-entities.json'),
  fetch('/static/maps/octavus.original.cfg').then(r=>r.ok?r.text():'').catch(()=> '')
 ]);
 if(manifest?.format!=='OCTAVUS-PROPS2'||!entitiesResponse?.visualEntities)
  return {instances:0,modelTypes:0,missing:0,setQuality(){},animate(){},dispose(){}};
 const aliases=[...sourceCFG.matchAll(/^mapmodel\s+"([^"]+)"/gm)].map(x=>x[1]);
 const instances=entitiesResponse.visualEntities.filter(e=>e.type==='mapmodel'&&
  Array.isArray(e.attrs)&&Number.isInteger(e.attrs[0])&&aliases[e.attrs[0]]);
 const placements=new Map();
 for(const e of instances){
  const alias=aliases[e.attrs[0]];
  const source=manifest.models?.[alias];
  if(source?.missing||!source?.url?.startsWith('/static/maps/octavus_props/'))continue;
  if(!placements.has(alias))placements.set(alias,[]);
  placements.get(alias).push(e);
 }
 const root=new THREE.Group();root.name='Octavus original native decorative models';scene.add(root);
 const loader=new GLTFLoader(),sprites=[];
 const geometries=new Set(),materials=new Set(),originalTextures=new Set();
 let modelTypes=0;
 for(const [alias,list]of placements){
  const info=manifest.models[alias];
  let original;
  try{original=await loader.loadAsync(info.url);}catch(e){continue;}
  if(!original.scene)continue;
  const prototype=original.scene;
  // Static model source is already transformed from Z-up to Y-up at build time.
  const baseScale=(Number(info.sourceScale)||100)/100*.05;
  if(!Number.isFinite(baseScale)||baseScale<=0||baseScale>35)continue;
  prototype.traverse(child=>{
   if(!child.isMesh)return;
   geometries.add(child.geometry);materials.add(child.material);
   child.castShadow=false;child.receiveShadow=true;
   child.frustumCulled=true;
   // Keep the original source geometry; make untextured surfaces readable.
   if(!child.material?.map){
    const name=alias.toLowerCase();
    const color=/weed|bush|plant/.test(name)?0x718569:
      /glow|light/.test(name)?0x89c6c9:
      /crate|door/.test(name)?0x9a7860:0x8d9397;
    const mat=new THREE.MeshStandardMaterial({
     color,roughness:.72,metalness:/metal|pipe|plate|rail|barrel/.test(name)?.48:.12,
     emissive:/glow|light/.test(name)?new THREE.Color('#2d6c76'):new THREE.Color('#000000'),
     emissiveIntensity:/glow|light/.test(name)?.65:0,
     side:THREE.DoubleSide
    });
    materials.add(mat);child.material=mat;
   }
  });
  for(const e of list){
   const node=prototype.clone(true);
   node.name='Octavus source mapmodel '+alias+' #'+e.id;
   node.position.copy(octavusEntityPosition(e.sourcePosition));
   node.rotation.order='YXZ';
   node.rotation.set((Number(e.attrs[2])||0)*RAD,-(Number(e.attrs[1])||0)*RAD,
                     (Number(e.attrs[3])||0)*RAD);
   const attrScale=Number(e.attrs[5])>0?Number(e.attrs[5])/100:1;
   node.scale.setScalar(baseScale*attrScale);
   root.add(node);sprites.push({node,pos:node.position.clone(),alias});
  }
  modelTypes++;
 }
 let level=quality,rendered=0,last=-1;
 function setQuality(tier){
  level=tier;
  for(const node of sprites)node.node.traverse(ch=>{
   if(ch.isMesh)ch.castShadow=(tier==='ultra');
  });
 }
 function animate(time,pos){
  if(time-last<.42)return;last=time;
  const p=pos&&Number.isFinite(pos.x)?pos:{x:0,y:0,z:0};
  let shown=0;
  for(const entry of sprites){
   const d=(entry.pos.x-p.x)**2+(entry.pos.z-p.z)**2;
   const cap=level==='performance'?110:level==='high'?215:level==='ultra'?320:160;
   const small=/weed/.test(entry.alias)&&level==='performance'?.58:1;
   entry.node.visible=d<(cap*small)**2;
   if(entry.node.visible)shown++;
  }
  rendered=shown;
 }
 setQuality(quality);
 return {
  instances:sprites.length,modelTypes,missing:instances.length-sprites.length,
  get renderedInstances(){return rendered;},setQuality,animate,
  dispose(){
   root.removeFromParent();
   for(const g of geometries)g.dispose();
   for(const m of materials)m?.dispose?.();
   for(const t of originalTextures)t.dispose();
  }
 };
}
