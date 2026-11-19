/* CROSSFire Octavus multiplayer arena.
 * Exact original imported geometry is rendered by the same THREE renderer as
 * players and weapons, and its full triangle soup is collision-authoritative.
 * Map provenance and CC BY-SA 3.0: maps/OCTAVUS_ATTRIBUTION.md.
 */
import {createDustPhysics65} from './dust_motion65.js';
import {loadOctavusOriginalUV} from './octavus_uv.js';
import {loadOctavusMaterialLibrary} from './octavus_materials.js';
import {createOctavusEnvironment} from './octavus_environment.js';
import {createOctavusDecals} from './octavus_decals.js';
import {createOctavusProps} from './octavus_props.js';
import {createOctavusBoundary} from './octavus_boundary.js';
import {loadOctavusPacked,loadOctavusMaterials,createOctavusScene,
 OCTAVUS_LOCAL_RATIO,OCTAVUS_GROUND_Y} from './octavus_preview.js';

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
    positions[out+v*3]=points[src]*OCTAVUS_LOCAL_RATIO;
    positions[out+v*3+1]=points[src+1]*OCTAVUS_LOCAL_RATIO-OCTAVUS_GROUND_Y;
    positions[out+v*3+2]=points[src+2]*OCTAVUS_LOCAL_RATIO;
   }
   surfaces[triangle++]=slot;
  }
 }
 if(triangle!==86500)throw Error('Octavus multiplayer collision triangle count mismatch');
 const source={
  soup:{count:triangle,positions,surfaces},
  playBounds:map.playBounds,
  nativeOctavus:true
 };
 cachedPhysics={packed,source};
 return source;
}

export async function buildOctavusMatch(scene,map,{quality='auto'}={}){
 if(map.id!=='octavus'||map.collisionFormat!=='OCT1'||!map.octavusOriginal)
  throw Error('Refusing to load an unverified Octavus multiplayer map');
 const [packed,materials,authoredUV]=await Promise.all([
  loadOctavusPacked(),loadOctavusMaterials(),loadOctavusOriginalUV()
 ]);
 const source=collisionSource(packed,map);
 const physics=createDustPhysics65(source);
 // Map-only linework sampled from the genuine vertical geometry. This is
 // never used as collision or as a replacement for the rendered mesh.
 if(!map.octavusRadarEdges){
  const p=source.soup.positions,edges=[];
  for(let i=0;i<source.soup.count;i+=4){
   const k=i*9;
   const ax=p[k],ay=p[k+1],az=p[k+2],bx=p[k+3],by=p[k+4],bz=p[k+5],
         cx=p[k+6],cy=p[k+7],cz=p[k+8];
   const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
   if(Math.abs(ny)/Math.max(.00001,Math.hypot(nx,ny,nz))>.62)continue;
   if(Math.max(ay,by,cy)<-9||Math.min(ay,by,cy)>13)continue;
   const candidates=[[ax,ay,az,bx,by,bz],[bx,by,bz,cx,cy,cz],[cx,cy,cz,ax,ay,az]];
   let best=null,score=0;
   for(const edge of candidates){
    const dist=Math.hypot(edge[3]-edge[0],edge[5]-edge[2]);
    if(Math.abs(edge[4]-edge[1])>.35||dist<.8||dist>30)continue;
    if(dist>score){score=dist;best=edge;}
   }
   if(best){edges.push([best[0],best[2],best[3],best[5]]);if(edges.length>=5500)break;}
  }
  map.octavusRadarEdges=edges;
 }
 // Critical path: original terrain, reliable server-matched collision,
 // and source UV coordinates. Decorative resources must never block join.
 const visual=createOctavusScene(packed,materials,scene,authoredUV,true,null,map.playBounds);
 // Stage 2.4: one visible perimeter aligned exactly with client/server bounds.
 // The original source mesh and its 86,500 triangles are NOT changed.
 const boundary=createOctavusBoundary(scene,map);
 let detail=true,mode=quality,disposed=false;
 let media=null,mediaProfile=null,mediaRequest=0;
 // The lean profile downloads only source diffuse/glow textures; High/Ultra
 // upgrades to authentic normal/roughness channels without a map reload.
 function requestMedia(tier){
  const profile=tier==='high'||tier==='ultra'?'detailed':'lean';
  if(profile===mediaProfile)return;
  mediaProfile=profile;
  const ticket=++mediaRequest;
  loadOctavusMaterialLibrary(tier,visual.visibleSlots).then(value=>{
   if(disposed||ticket!==mediaRequest){value?.dispose?.();return;}
   if(!value?.usable||!value.statistics?.sourceImages){
    value?.dispose?.();mediaProfile=null;return;
   }
   visual.applyOriginalMaterials(value,mode);
   media=value;
  }).catch(error=>{
   if(ticket===mediaRequest)mediaProfile=null;
   console.warn('Octavus optional source materials unavailable:',error);
  });
 }
 const noop={count:0,materials:0,instances:0,modelTypes:0,sourceLightCount:0,
  skybox:false,setQuality(){},animate(){},dispose(){}};
 let environment=noop,decals=noop,props=noop;
 // Do not permit a failed optional source texture, sky, decal or prop file
 // to turn a playable arena into an endlessly loading join screen.
 function attach(promise,kind){
  promise.then(value=>{
   if(disposed){value?.dispose?.();return;}
   if(kind==='environment')environment=value;
   else if(kind==='decals')decals=value;
   else if(kind==='props')props=value;
   if(kind!=='media')value?.setQuality?.(mode);
  }).catch(error=>console.warn('Octavus optional '+kind+' unavailable:',error));
 }
 requestMedia(quality);
 attach(createOctavusEnvironment(scene,quality),'environment');
 attach(createOctavusDecals(scene,quality),'decals');
 attach(createOctavusProps(scene,quality,map.playBounds),'props');
 visual.setQuality(quality);
 return {
  isOctavusMatch:true,
  physics,
  targets:new Map(),
  staticBatches:visual.meshCount,
  originalVisualTriangles:packed.triangles,
  renderedVisualTriangles:visual.renderedTriangleCount,
  originalTextureVertices:authoredUV.textureVertexCount,
  sourceScaleRatio:OCTAVUS_LOCAL_RATIO,
  originalUV:visual.preservedTextureCoordinates,
  get originalMaterialSlots(){return visual.originalMaterials;},
  get originalTextureImages(){return media?.statistics?.sourceImages||0;},
  get sourceImagesSkipped(){return media?.statistics?.skippedSourceImages||0;},
  get sourceImagesRequested(){return media?.statistics?.requestedSourceImages||0;},
  get sourceTextureProfile(){return media?.statistics?.imageProfile||'pending';},
  get originalSkybox(){return environment.skybox;},
  get sourceLights(){return environment.sourceLightCount;},
  get nativeDecals(){return decals.count;},
  get nativeProps(){return props.instances;},
  get nativePropTypes(){return props.modelTypes;},
  get nativePropDrawUnits(){return props.originalDrawUnits||0;},
  get nativePropDrawBatches(){return props.instancedDrawBatches||0;},
  get nativePropRendered(){return props.renderedInstances||0;},
  get nativePropExcluded(){return props.excluded||0;},
  featureCount:packed.triangles,
  perimeterWallCount:boundary.wallCount,
  perimeterPostCount:boundary.postCount,
  get environmentCount(){return props.instances+decals.count;},
  get environmentSigns(){return decals.count;},
  packedScene66:true,
  packedTransferBytes66:917878,
  get originalMaterialLayers(){return media?.statistics?.sourceImages||0;},
  get resourceProfile68(){return{
   fullArchitecture:true,hasEnvironment:true,atlasSize:1024,atlases:media?.statistics?.sourceImages||0,
   atlasRebuilds:0,stage5Meshes:visual.meshCount,
   stage6Meshes:props.instances+decals.materials,
   originalSourceTriangles:packed.triangles,
   drawnSourceTriangles:visual.renderedTriangleCount,
   instancedPropDrawBatches:props.instancedDrawBatches||0,
   originalPropDrawUnits:props.originalDrawUnits||0,
   streamedAssets:true
  };},
  setQuality(value){mode=value;visual.setQuality(value);requestMedia(value);
   environment.setQuality(value);decals.setQuality(value);props.setQuality(value);},
  setDetail(value){detail=Boolean(value);},
  animate(time,player){environment.animate(time,player);props.animate(time,player);
   void mode;void detail;},
  dispose(){if(disposed)return;disposed=true;mediaRequest++;
   props.dispose();decals.dispose();environment.dispose();boundary.dispose();visual.dispose();
   scene.background=null;scene.fog=null;}
 };
}
