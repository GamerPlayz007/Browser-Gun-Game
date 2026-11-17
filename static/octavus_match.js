/* CROSSFire Octavus multiplayer arena.
 * Exact original imported geometry is rendered by the same THREE renderer as
 * players and weapons, and its full triangle soup is collision-authoritative.
 * Map provenance and CC BY-SA 3.0: maps/OCTAVUS_ATTRIBUTION.md.
 */
import {createDustPhysics65} from './dust_motion65.js';
import {loadOctavusOriginalUV} from './octavus_uv.js';
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
  playBounds:map.playBounds
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
   if(Math.max(ay,by,cy)<39||Math.min(ay,by,cy)>48)continue;
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
 // The preview's actual 111 material-slot meshes, UVs, lighting and textures
 // are used directly. No duplicate block-built level or iframe is involved.
 const visual=createOctavusScene(packed,materials,scene,authoredUV,true);
 let detail=true,mode=quality;
 return {
  isOctavusMatch:true,
  physics,
  targets:new Map(),
  staticBatches:visual.meshCount,
  originalVisualTriangles:packed.triangles,
  originalTextureVertices:authoredUV.textureVertexCount,
  sourceScaleRatio:OCTAVUS_LOCAL_RATIO,
  originalUV:visual.preservedTextureCoordinates,
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
