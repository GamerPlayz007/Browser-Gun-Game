import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createSurfaceBoxGeometry} from './materials41.js';

// Phase 4.1: authored architecture becomes textured, batched PBR geometry.
// UVs are baked in metres before merging, avoiding stretched textures on large
// walls and retaining the old ~one draw call per finish/tier batch.
export function createStage5VisualLayer(THREE,map,quality='high',library=null){
 const level={performance:0,high:1,ultra:2}[quality];
 if(level===undefined)throw Error('Unknown Stage 5 quality: '+quality);
 const finishes=map?.stage5?.material_finishes||{};
 const boxes=(map?.decor||[]).filter(b=>b.stage5VisualOnly&&(b.qualityTier||0)<=level);
 const groups=new Map();
 for(const b of boxes){
  const key=b.finish+'::'+(b.qualityTier||0);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(b);
 }
 const sceneGroup=new THREE.Group();sceneGroup.name='stage5-noncolliding-architecture';
 sceneGroup.userData.collidable=false;
 const fallbackMaterials=[];
 const family={
  masonry:'concrete',masonry_dark:'dark',oxidized:'rust',iron:'metal',
  frame:'dark',glass_unlit:'glass',glass_office:'window',glass_warm:'window',
  glass_teal:'window',glass_pink:'window',concrete:'concrete',light_metal:'metal',
  plaza:'tile',platform:'grate',tactile:'tile',awning:'leather',awning_gold:'wood',
  pipe:'metal',light:'window',lamp:'window',shadow:'dark',tile:'tile',rust:'rust'
 };
 for(const [key,entries] of groups){
  const [finish,tierText]=key.split('::'),tier=Number(tierText);
  const isLit=/^glass_(?!unlit)/.test(finish)||finish==='light'||finish==='lamp';
  const isUnlit=finish==='glass_unlit';
  const source=family[finish]||'concrete';
  const tint=new THREE.Color(finishes[finish]||'#9aa9b8');
  tint.lerp(new THREE.Color('#ffffff'),isLit?.55:.48);
  const emissive=isLit?(finishes[finish]||'#87d8f2'):'#ffffff';
  const mat=library?library.get(source,{tint:'#'+tint.getHexString(),emissive,glow:isLit?(finish==='lamp'?2.3:1.35):isUnlit?.02:undefined}):
   new THREE.MeshStandardMaterial({color:tint,roughness:isLit?.3:.79,metalness:isLit?.09:.22,
     emissive:isLit?emissive:'#000000',emissiveIntensity:isLit?1.1:0});
  if(!library)fallbackMaterials.push(mat);
  const geometries=entries.map(b=>createSurfaceBoxGeometry(THREE,b,source==='window'?1.6:2.4));
  const geometry=mergeGeometries(geometries,false);
  for(const g of geometries)g.dispose();
  if(!geometry)throw Error('Stage 5 merge failed: '+key);
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.name='stage5-'+finish+'-tier'+tier;
  mesh.userData.stage5VisualOnly=true;mesh.userData.stage5Tier=tier;
  mesh.userData.collidable=false;
  mesh.receiveShadow=true;
  // Architectural cladding is visual only: never used for physics.
  sceneGroup.add(mesh);
 }
 sceneGroup.userData.disposeStage5=()=>{
  sceneGroup.traverse(mesh=>{mesh.geometry?.dispose();});
  for(const mat of fallbackMaterials)mat.dispose();
 };
 return sceneGroup;
}
export function filterStage5FromLegacyDecor(map){
 return (map?.decor||[]).filter(b=>!b.stage5VisualOnly);
}
