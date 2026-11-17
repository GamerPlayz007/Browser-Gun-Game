/* CROSSFire Octavus multiplayer arena.
 * Exact original imported geometry is rendered by the same THREE renderer as
 * players and weapons, and its full triangle soup is collision-authoritative.
 * Map provenance and CC BY-SA 3.0: maps/OCTAVUS_ATTRIBUTION.md.
 */
import {createDustPhysics65} from './dust_motion65.js';
import {loadOctavusPacked,loadOctavusMaterials,createOctavusScene} from './octavus_preview.js';

let cachedPhysics=null;
function collisionSource(packed,map){
 if(cachedPhysics?.packed===packed)return cachedPhysics.source;
 const positions=new Float32Array(packed.triangles*9);
 const surfaces=new Uint8Array(packed.triangles);
 const points=packed.points;
 let triangle=0;
 for(const [slot,indices] of packed.groups){
  for(let i=0;i<indices.length;i+=3){
   const out=triangle*9;
   for(let v=0;v<3;v++){
    const src=indices[i+v]*3;
    positions[out+v*3]=points[src];
    positions[out+v*3+1]=points[src+1];
    positions[out+v*3+2]=points[src+2];
   }
   surfaces[triangle++]=slot;
  }
 }
 if(triangle!==86500)throw Error('Octavus multiplayer collision triangle count mismatch');
 const source={
  soup:{count:triangle,positions,surfaces},
  playBounds:map.playBounds
 };
 cachedPhysics={packed,source};
 return source;
}

export async function buildOctavusMatch(scene,map,{quality='auto'}={}){
 if(map.id!=='octavus'||map.collisionFormat!=='OCT1'||!map.octavusOriginal)
  throw Error('Refusing to load an unverified Octavus multiplayer map');
 const [packed,materials]=await Promise.all([loadOctavusPacked(),loadOctavusMaterials()]);
 const source=collisionSource(packed,map);
 const physics=createDustPhysics65(source);
 // The preview's actual 111 material-slot meshes, UVs, lighting and textures
 // are used directly. No duplicate block-built level or iframe is involved.
 const visual=createOctavusScene(packed,materials,scene);
 let detail=true,mode=quality;
 return {
  isOctavusMatch:true,
  physics,
  targets:new Map(),
  staticBatches:visual.meshCount,
  originalVisualTriangles:packed.triangles,
  featureCount:packed.triangles,
  environmentCount:0,
  environmentSigns:0,
  packedScene66:true,
  packedTransferBytes66:917878,
  get originalMaterialLayers(){return 6;},
  get resourceProfile68(){return{
   fullArchitecture:true,hasEnvironment:false,atlasSize:128,atlases:6,
   atlasRebuilds:0,stage5Meshes:visual.meshCount,stage6Meshes:0
  };},
  setQuality(value){mode=value;},
  setDetail(value){detail=Boolean(value);},
  animate(_time,_player){void mode;void detail;},
  dispose(){visual.dispose();scene.background=null;scene.fog=null;}
 };
}
