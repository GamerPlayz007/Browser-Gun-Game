/* Red Eclipse 2 Octavus Phase 1.9: source-derived polygon-clipped decals.
 *
 * Original source: redeclipse/base src/engine/octarender.cpp gendecal()
 * This browser adaptation:
 *   - keeps native MPZ decal positions, yaw/pitch/roll, original image
 *     aspect ratio, projector size/depth (DEFAULTDECALDEPTH=1)
 *   - projects onto ACTUAL native OCN2 triangles, never onto a proxy plane
 *   - clips candidate polygons to the six sides of an oriented 3D box
 *   - computes decal UVs from projector-local X/Z, like original tc
 *   - combines clipped triangles by original decal texture material
 *   - indexes terrain in 2D spatial bins with true AABB overlap proofs
 *   - conservatively rejects back-facing world triangles
 * The input native OCN2 source still lacks original baked vertex normals,
 * blended material layers, exact decal fade and original lightmaps, so this
 * is a faithful *geometry-projection method*, not pixel-identical rendering.
 * Staging only. Do not import into live CROSSFire.
 */
import * as THREE from 'three';
import {originalNativePosition,octavusSourceQuaternion,originalDecalSize} from './octavus_native_transform89.js';

const CELL=8,MAX_CELLS_PER_TRI=48,BOUND_MARGIN=.015;
const MAX_OUTPUT_TRIANGLES=150000;
const EPS=1e-6;
const spatialCache=new WeakMap();
const finite=n=>Number.isFinite(n);
function key(x,z){return (x+4096)*16384+(z+4096)}
function overlap(a,b,c,d){return !(b<c||d<a)}
function nativeAxes(quaternion){
 return [
  new THREE.Vector3(1,0,0).applyQuaternion(quaternion),
  new THREE.Vector3(0,0,1).applyQuaternion(quaternion),
  new THREE.Vector3(0,1,0).applyQuaternion(quaternion)
 ];
}
function crossNorm(a,b,c){
 const x=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
 const y=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
 const z=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 return [x,y,z];
}
function signedAreaSquared(a,b,c){
 const n=crossNorm(a,b,c);
 return n[0]*n[0]+n[1]*n[1]+n[2]*n[2];
}
function clipHalfspace(vertices,dim,limit,positive){
 const count=vertices.length;
 if(!count)return [];
 const keep=p=>positive?p[dim]>=limit-EPS:p[dim]<=limit+EPS;
 let prior=vertices[count-1],within=keep(prior);
 const out=[];
 for(const next of vertices){
  const valid=keep(next);
  if(valid!==within){
   const denom=next[dim]-prior[dim];
   if(Math.abs(denom)>1e-14){
    const t=Math.max(0,Math.min(1,(limit-prior[dim])/denom));
    out.push([
     prior[0]+(next[0]-prior[0])*t,
     prior[1]+(next[1]-prior[1])*t,
     prior[2]+(next[2]-prior[2])*t
    ]);
   }
  }
  if(valid)out.push(next);
  within=valid;prior=next;
 }
 return out;
}
export function clipNativeDecalPolygon(localPoints,width,depth,height){
 if(localPoints.length<3||width<=0||depth<=0||height<=0)return [];
 let out=localPoints;
 for(const [axis,lo,hi] of [
  [1,0,depth], [0,-width/2,width/2],[2,-height/2,height/2]
 ]){
  out=clipHalfspace(out,axis,lo,true);
  if(out.length<3)return [];
  out=clipHalfspace(out,axis,hi,false);
  if(out.length<3)return [];
 }
 return out.length>=3?out:[];
}
function readGeometry(geometry){
 const position=geometry.getAttribute('position');
 const index=geometry.getIndex();
 if(!position||position.itemSize!==3||!index)
  throw Error('Projected native decal requires indexed OCN2 world geometry');
 return {p:position.array,idx:index.array,count:index.count/3};
}
export function buildOctavusTriangleIndex(geometry){
 if(spatialCache.has(geometry))return spatialCache.get(geometry);
 const {p,idx,count}=readGeometry(geometry);
 if(!Number.isInteger(count)||count>1700000||count<1)
  throw Error('Unexpected original Octavus source triangle count');
 const table=new Map(),overflow=[],aabbs=new Float32Array(count*6);
 // Source native slot 1 still includes hundreds of thousands of
 // unverified interior faces. The original gendecal renderer only
 // projects onto actually visible source faces. Until exact source
 // visibility parity is recovered, use authored non-plain material
 // surfaces for decals so we never paint duplicate internal shells.
 // Important: this does NOT remove slot 1 from the actual map mesh.
 const materialSlots=geometry.userData?.octavusNativeSlotByMaterial;
 const allowed=new Uint8Array(count);
 allowed.fill(1);
 let excludedUnverifiedTriangles=0;
 if(Array.isArray(materialSlots)){
  for(const group of geometry.groups){
   if(materialSlots[group.materialIndex]!==1)continue;
   const first=Math.floor(group.start/3);
   const last=Math.ceil((group.start+group.count)/3);
   for(let i=first;i<last;i++)allowed[i]=0;
  }
  excludedUnverifiedTriangles=count-allowed.reduce((n,b)=>n+b,0);
 }
 let indexedReferences=0,eligibleTriangles=0;
 for(let t=0;t<count;t++){
  if(!allowed[t])continue;
  eligibleTriangles++;
  const a=idx[3*t]*3,b=idx[3*t+1]*3,c=idx[3*t+2]*3;
  const x0=Math.min(p[a],p[b],p[c]),x1=Math.max(p[a],p[b],p[c]);
  const y0=Math.min(p[a+1],p[b+1],p[c+1]),y1=Math.max(p[a+1],p[b+1],p[c+1]);
  const z0=Math.min(p[a+2],p[b+2],p[c+2]),z1=Math.max(p[a+2],p[b+2],p[c+2]);
  const box=t*6;
  aabbs[box]=x0;aabbs[box+1]=x1;
  aabbs[box+2]=y0;aabbs[box+3]=y1;
  aabbs[box+4]=z0;aabbs[box+5]=z1;
  const loX=Math.floor(x0/CELL),hiX=Math.floor(x1/CELL);
  const loZ=Math.floor(z0/CELL),hiZ=Math.floor(z1/CELL);
  if((hiX-loX+1)*(hiZ-loZ+1)>MAX_CELLS_PER_TRI){
   overflow.push(t);continue;
  }
  for(let x=loX;x<=hiX;x++)for(let z=loZ;z<=hiZ;z++){
   const k=key(x,z);
   if(!table.has(k))table.set(k,[]);
   table.get(k).push(t);
   indexedReferences++;
  }
 }
 const seen=new Uint32Array(count);
 let stamp=0;
 const indexer={
  triangleCount:count,
  eligibleTriangles,
  excludedUnverifiedTriangles,
  referenceCount:indexedReferences,
  overflowCount:overflow.length,
  cellCount:table.size,
  candidates(bounds){
   stamp++;
   if(stamp>=0xffffffff){seen.fill(0);stamp=1;}
   const out=[];
   const accept=t=>{
    if(seen[t]===stamp)return;
    seen[t]=stamp;
    const b=t*6;
    if(!overlap(aabbs[b],aabbs[b+1],bounds.minX,bounds.maxX)||
       !overlap(aabbs[b+2],aabbs[b+3],bounds.minY,bounds.maxY)||
       !overlap(aabbs[b+4],aabbs[b+5],bounds.minZ,bounds.maxZ))return;
    out.push(t);
   };
   const x0=Math.floor(bounds.minX/CELL),x1=Math.floor(bounds.maxX/CELL);
   const z0=Math.floor(bounds.minZ/CELL),z1=Math.floor(bounds.maxZ/CELL);
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
    const list=table.get(key(x,z));
    if(list)for(const t of list)accept(t);
   }
   for(const t of overflow)accept(t);
   return out;
  }
 };
 spatialCache.set(geometry,indexer);
 return indexer;
}
function orientedBounds(origin,axes,width,depth,height){
 const mid=origin.clone().addScaledVector(axes[1],depth*.5);
 const half=new THREE.Vector3();
 for(let d=0;d<3;d++){
  const reach=Math.abs(axes[0].getComponent(d))*width*.5+
       Math.abs(axes[1].getComponent(d))*depth*.5+
       Math.abs(axes[2].getComponent(d))*height*.5;
  half.setComponent(d,reach+BOUND_MARGIN);
 }
 return {
  minX:mid.x-half.x,maxX:mid.x+half.x,
  minY:mid.y-half.y,maxY:mid.y+half.y,
  minZ:mid.z-half.z,maxZ:mid.z+half.z
 };
}
/**
 * Create source-projected world-space triangles for one authored decal.
 * The output is a non-indexed BufferGeometry (position+uv).
 * Original source orientation sign is reversed in Three due to the
 * native XYZ -> world XZY negative-determinant basis permutation.
 */
export function projectNativeDecal(geometry,indexer,entity,imageWidth,imageHeight){
 const a=entity.attrs||[],origin=originalNativePosition(entity.sourcePosition);
 const quaternion=octavusSourceQuaternion(a[1],a[2],a[3]);
 const axes=nativeAxes(quaternion);
 const size=originalDecalSize(a);
 let width=size,height=size;
 if(imageWidth>0&&imageHeight>0){
  if(imageWidth<imageHeight)width*=imageWidth/imageHeight;
  else if(imageWidth>imageHeight)height*=imageHeight/imageWidth;
 }
 const depth=size; // original DEFAULTDECALDEPTH = 1.0
 const candidates=indexer.candidates(orientedBounds(origin,axes,width,depth,height));
 const {p,idx}=readGeometry(geometry);
 const coordinates=[],uvs=[];
 let meshTriHits=0,accepted=0;
 const originalNormalSign=1; // negative determinant xzy conversion
 const invX=axes[0],invY=axes[1],invZ=axes[2];
 const toLocal=vertex=>{
  const x=vertex[0]-origin.x,y=vertex[1]-origin.y,z=vertex[2]-origin.z;
  return [x*invX.x+y*invX.y+z*invX.z,
          x*invY.x+y*invY.y+z*invY.z,
          x*invZ.x+y*invZ.y+z*invZ.z];
 };
 const toWorld=l=>[
  origin.x+l[0]*axes[0].x+l[1]*axes[1].x+l[2]*axes[2].x,
  origin.y+l[0]*axes[0].y+l[1]*axes[1].y+l[2]*axes[2].y,
  origin.z+l[0]*axes[0].z+l[1]*axes[1].z+l[2]*axes[2].z,
 ];
 const offset=0.003;
 for(const t of candidates){
  const verts=[];
  for(let n=0;n<3;n++){
   const q=idx[3*t+n]*3;
   verts.push([p[q],p[q+1],p[q+2]]);
  }
  const norm=crossNorm(verts[0],verts[1],verts[2]);
  const sq=norm[0]*norm[0]+norm[1]*norm[1]+norm[2]*norm[2];
  if(sq<1e-11)continue;
  const ndot=norm[0]*axes[1].x+norm[1]*axes[1].y+norm[2]*axes[1].z;
  // The original engine rejects source faces with norm dot orient.b >= 0.
  // OCN2's XZY basis has determinant -1, so the screen-space face
  // cross product has the opposite sign.
  if(ndot*originalNormalSign<=Math.sqrt(sq)*0.03)continue;
  const local=verts.map(toLocal);
  const poly=clipNativeDecalPolygon(local,width,depth,height);
  if(poly.length<3)continue;
  meshTriHits++;
  for(let i=1;i<poly.length-1;i++){
   const tri=[poly[0],poly[i],poly[i+1]];
   const v=tri.map(toWorld);
   if(signedAreaSquared(...v)<1e-12)continue;
   for(let j=0;j<3;j++){
    const point=v[j];
    // Bias toward the projection-facing side to avoid coplanar flicker;
    // the original surface remains underneath and unchanged.
    coordinates.push(
      point[0]+axes[1].x*offset,
      point[1]+axes[1].y*offset,
      point[2]+axes[1].z*offset
    );
    uvs.push(.5-tri[j][0]/width,.5-tri[j][2]/height);
   }
   accepted++;
  }
  if(accepted>12000)break; // hard per-entity staging performance guard
 }
 const generated=new THREE.BufferGeometry();
 generated.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
 generated.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 if(coordinates.length)generated.computeVertexNormals();
 return {geometry:generated,originalEntityID:entity.id,
  triangles:accepted,candidateTriangles:candidates.length,intersectedSourceTriangles:meshTriHits};
}
export function mergeProjectedDecalParts(parts){
 const positions=[],uvs=[];
 for(const part of parts){
  if(!part.geometry||!part.triangles)continue;
  const p=part.geometry.getAttribute('position').array;
  const uv=part.geometry.getAttribute('uv').array;
  for(let i=0;i<p.length;i++)positions.push(p[i]);
  for(let i=0;i<uv.length;i++)uvs.push(uv[i]);
  part.geometry.dispose();
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 if(positions.length)geometry.computeVertexNormals();
 return geometry;
}
export const PROJECTED_DECAL_LIMIT=MAX_OUTPUT_TRIANGLES;
export const PROJECTION_VERSION='OCTAVUS-NATIVE-DECAL90';
