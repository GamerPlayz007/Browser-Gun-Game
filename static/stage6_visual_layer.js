import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createSurfaceBoxGeometry} from './materials41.js';

// Phase 4.1: the surrounding skyline now participates in the material system.
// The 160 m context remains purely visual; it creates no collision meshes.
export function createStage6VisualLayer(THREE,map,quality='high',library=null){
 const level={performance:0,high:1,ultra:2}[quality];
 if(level===undefined)throw Error('Invalid Stage 6 quality: '+quality);
 const entries=(map?.decor||[]).filter(b=>b.stage6VisualOnly&&(b.stage6Tier||0)<=level);
 const groups=new Map();
 const pseudoRandom=b=>{
  const n=Math.floor((b.x+503)*71+(b.y+277)*131+(b.z+311)*197);
  return ((Math.imul(n,2654435761)>>>0)%11);
 };
 for(const b of entries){
  const window=b.kind==='urbanWindow';
  const lit=window&&pseudoRandom(b)>2;
  const key=[b.kind,b.style,b.urbanFamily||'none',b.stage6Tier||0,lit?'lit':'dark'].join('::');
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(b);
 }
 const sceneGroup=new THREE.Group();sceneGroup.name='stage6-visual-city-context';
 sceneGroup.userData.collidable=false;
 const colorByFamily={market:'#f16fa7',industrial:'#f4a66c',corporate:'#72cbee',
  transit:'#ffd18b',civic:'#70e9d3'};
 const fallbackMaterials=[];
 for(const [key,items] of groups){
  const sample=items[0],isWindow=sample.kind==='urbanWindow',lit=key.endsWith('::lit');
  const family=sample.urbanFamily||'none',familyColor=colorByFamily[family]||'#a5c8e2';
  const style=isWindow?(lit?'window':'glass'):
   sample.style==='facade'?'facade':sample.style==='glass'?'glass':
   sample.style==='metal'?'metal':sample.style==='rust'?'rust':
   sample.style==='road'?'road':sample.style==='dark'?'dark':'concrete';
  const tint=isWindow?'#edf5ff':new THREE.Color(map?.palette?.[sample.style]||'#a8b6c4')
   .lerp(new THREE.Color('#e5e9ed'),.55).getStyle();
  const material=library?library.get(style,{tint,emissive:familyColor,
   glow:isWindow?(lit?1.55:.015):0}):
   new THREE.MeshStandardMaterial({color:isWindow?familyColor:tint,
    roughness:isWindow?.27:.79,metalness:isWindow?.08:.22,
    emissive:isWindow&&lit?familyColor:'#000000',
    emissiveIntensity:isWindow&&lit?.9:0});
  if(!library)fallbackMaterials.push(material);
  const geos=items.map(b=>createSurfaceBoxGeometry(THREE,b,isWindow?1.7:2.7));
  const merged=mergeGeometries(geos,false);for(const g of geos)g.dispose();
  if(!merged)throw Error('Stage 6 merge failed: '+key);
  const mesh=new THREE.Mesh(merged,material);
  mesh.name='stage6-context-'+key;mesh.receiveShadow=false;
  mesh.userData.collidable=false;mesh.userData.stage6VisualOnly=true;
  mesh.userData.stage6Tier=sample.stage6Tier||0;
  sceneGroup.add(mesh);
 }
 sceneGroup.userData.disposeStage6=()=>{
  sceneGroup.traverse(mesh=>{mesh.geometry?.dispose();});
  for(const mat of fallbackMaterials)mat.dispose();
 };
 return sceneGroup;
}
export function excludeStage6FromLegacyDecor(map){
 return (map?.decor||[]).filter(box=>!box.stage6VisualOnly);
}
