/* Octavus Stage 2.1 — screenshot-traced, non-leapable source arena wall.
 * Shared contract: static/maps/octavus.native-boundary92.json
 * Python parity: octavus_native_boundary92.py.
 *
 * The native-source visual lab loads this staging module independently.
 * NO live game map, movement controller, server.py, or collisions import it.
 */
import * as THREE from 'three';

const PATH='/static/maps/octavus.native-boundary92.json';
const EPS=1e-7;
const norm2=v=>Math.hypot(v[0],v[1]);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function polygonArea92(vertices){
 let a=0;
 for(let i=0;i<vertices.length;i++){
  const p=vertices[i],q=vertices[(i+1)%vertices.length];
  a+=p[0]*q[1]-p[1]*q[0];
 }
 return a/2;
}
export function distanceToEdge92(x,z,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1];
 const v=dx*dx+dz*dz;
 if(v<=1e-12)return Math.hypot(x-a[0],z-a[1]);
 const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/v,0,1);
 return Math.hypot(x-(a[0]+t*dx),z-(a[1]+t*dz));
}
export function createArenaLimit92(manifest){
 if(manifest?.format!=='OCTAVUS-NATIVE-BOUNDARY92'||
    manifest.status!=='staging-only-not-live'||
    manifest.sourceRevision!==829||manifest.liveMapModified!==false)
  throw Error('Original screenshot arena mask failed staging provenance check');
 const vertices=manifest.polygonWorldXZ;
 if(!Array.isArray(vertices)||vertices.length!==58||
    vertices.some(v=>!Array.isArray(v)||v.length!==2||
      !Number.isFinite(v[0])||!Number.isFinite(v[1])))
  throw Error('Octavus source perimeter incomplete');
 if(manifest.wall.height<50||manifest.wall.topY<35||manifest.wall.baseY>-20)
  throw Error('Octavus arena wall is not tall enough to contain every source structure');
 const edges=vertices.map((p,i)=>[p,vertices[(i+1)%vertices.length]]);
 const radius=manifest.wall.playerRadius+manifest.wall.safetyMargin;
 const area=polygonArea92(vertices);
 if(!(Math.abs(area)>7000&&Math.abs(area)<12000))
  throw Error('Source arena silhouette area mismatched');
 const containsPoint=(x,z)=>{
  let inside=false;
  for(const [a,b] of edges){
   if((a[1]>z)!==(b[1]>z)){
    const edgeX=(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0];
    if(x<edgeX)inside=!inside;
   }
  }
  return inside;
 };
 const wallDistance=(x,z)=>{
  let best=Infinity;
  for(const [a,b] of edges)best=Math.min(best,distanceToEdge92(x,z,a,b));
  return best;
 };
 const allowed=(x,z,r=radius)=>containsPoint(x,z)&&wallDistance(x,z)>r-EPS;
 const firstContact=(x,z,tx,tz,r)=>{
  const dx=tx-x,dz=tz-z,delta2=dx*dx+dz*dz;
  if(delta2<1e-12)return null;
  let earliest=null;
  for(const [a,b]of edges){
   const ax=a[0],az=a[1],bx=b[0],bz=b[1];
   const ex=bx-ax,ez=bz-az,len=Math.hypot(ex,ez);
   const ux=ex/len,uz=ez/len,nx=-uz,nz=ux;
   const projected=(x-ax)*ux+(z-az)*uz,projv=dx*ux+dz*uz;
   const d0=(x-ax)*nx+(z-az)*nz,dv=dx*nx+dz*nz;
   if(Math.abs(dv)>1e-12){
    for(const side of [-r,r]){
     const t=(side-d0)/dv;
     if(t>=0&&t<=1&&projected+projv*t>=-1e-8&&
        projected+projv*t<=len+1e-8)
      earliest=earliest===null?t:Math.min(earliest,t);
    }
   }
   for(const [px,pz] of [a,b]){
    const ox=x-px,oz=z-pz;
    const qb=2*(ox*dx+oz*dz);
    const qc=ox*ox+oz*oz-r*r;
    const disc=qb*qb-4*delta2*qc;
    if(disc<0)continue;
    const t=(-qb-Math.sqrt(disc))/(2*delta2);
    if(t>=0&&t<=1)earliest=earliest===null?t:Math.min(earliest,t);
   }
  }
  return earliest;
 };
 const clipHorizontal=(start,end,r=radius)=>{
  const [x,z]=start,[tx,tz]=end;
  if(!allowed(x,z,r))return {x,z,blocked:true,invalidStart:true};
  const collision=firstContact(x,z,tx,tz,r);
  if(collision===null&&allowed(tx,tz,r))
   return {x:tx,z:tz,blocked:false,invalidStart:false};
  const dx=tx-x,dz=tz-z;
  let lo=0,hi=collision===null?1:collision;
  for(let i=0;i<30;i++){
   const mid=(lo+hi)/2;
   if(allowed(x+dx*mid,z+dz*mid,r))lo=mid;
   else hi=mid;
  }
  const t=Math.max(0,lo-.00005/Math.max(Math.hypot(dx,dz),1));
  return {x:x+dx*t,z:z+dz*t,blocked:true,invalidStart:false};
 };
 return {
  manifest,vertices,edges,area,radius,
  wallTopY:manifest.wall.topY,wallBaseY:manifest.wall.baseY,
  containsPoint,wallDistance,allowed,clipHorizontal,
  status:'staging-only-not-live'
 };
}
function outerWallVertices(arena){
 const p=arena.vertices,n=p.length,orientation=Math.sign(arena.area);
 const normals=[];
 for(let i=0;i<n;i++){
  const a=p[i],b=p[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  normals.push([orientation*dz/len,-orientation*dx/len]);
 }
 const thickness=arena.manifest.wall.thickness;
 return p.map((v,i)=>{
  const prev=normals[(i+n-1)%n],next=normals[i];
  const sum=[prev[0]+next[0],prev[1]+next[1]];
  const dot=prev[0]*next[0]+prev[1]*next[1];
  const denom=Math.max(.15,1+dot);
  const along=[clamp(sum[0]/denom,-2.25,2.25),
               clamp(sum[1]/denom,-2.25,2.25)];
  return [v[0]+along[0]*thickness,v[1]+along[1]*thickness];
 });
}
export function makeNativeArenaWall92(arena){
 if(arena.status!=='staging-only-not-live')throw Error('Not an original staging boundary');
 const inner=arena.vertices,outer=outerWallVertices(arena);
 const positions=[],uvs=[],colors=[];
 const base=arena.wallBaseY,top=arena.wallTopY;
 function tri(a,b,c,uvA,uvB,uvC,shade){
  for(const p of [a,b,c])positions.push(...p);
  for(const uv of [uvA,uvB,uvC])uvs.push(...uv);
  for(let i=0;i<3;i++)colors.push(shade,shade*.96,shade*.89);
 }
 function quad(p0,p1,p2,p3,u,v,shade){
  tri(p0,p1,p2,[0,0],[u,0],[u,v],shade);
  tri(p0,p2,p3,[0,0],[u,v],[0,v],shade);
 }
 for(let i=0;i<inner.length;i++){
  const next=(i+1)%inner.length;
  const a=inner[i],b=inner[next],c=outer[i],d=outer[next];
  const u=Math.hypot(b[0]-a[0],b[1]-a[1])/4;
  const height=(top-base)/4;
  // Perfectly joined interior/outer vertices: every wall edge shares
  // the exact same endpoint with its neighbors; no open corners.
  quad([a[0],base,a[1]],[b[0],base,b[1]],
       [b[0],top,b[1]],[a[0],top,a[1]],u,height,.72);
  quad([d[0],base,d[1]],[c[0],base,c[1]],
       [c[0],top,c[1]],[d[0],top,d[1]],u,height,.82);
  quad([a[0],top,a[1]],[b[0],top,b[1]],
       [d[0],top,d[1]],[c[0],top,c[1]],u,.4,1.1);
  quad([d[0],base,d[1]],[b[0],base,b[1]],
       [a[0],base,a[1]],[c[0],base,c[1]],u,.4,.63);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  name:'Octavus source sandstone perimeter wall',
  color:'#aa967c',vertexColors:true,side:THREE.DoubleSide,
  roughness:.98,metalness:0,
 });
 const wall=new THREE.Mesh(geometry,material);
 wall.name='Octavus original visible island non-jumpable perimeter (STAGING ONLY)';
 wall.userData.boundarySegments=arena.edges.length;
 wall.userData.wallTopY=arena.wallTopY;
 wall.userData.wallBottomY=arena.wallBaseY;
 wall.userData.invisibleOutOfBoundsGuard=!!arena.manifest.gameplayOutsideAllowed===false;
 wall.frustumCulled=false;
 return {
  mesh:wall,
  wallSegments:arena.edges.length,
  triangles:positions.length/9,
  show(on){wall.visible=!!on},
  dispose(){wall.removeFromParent();geometry.dispose();material.dispose();}
 };
}
let cached=null;
export async function loadNativeArenaBoundary92(){
 if(cached)return cached;
 cached=fetch(PATH,{cache:'no-cache'})
  .then(response=>{
    if(!response.ok)throw Error('Arena outline not deployed ('+response.status+')');
    return response.json();
  })
  .then(createArenaLimit92)
  .catch(error=>{cached=null;throw error});
 return cached;
}
