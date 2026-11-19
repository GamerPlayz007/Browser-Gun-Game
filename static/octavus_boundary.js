/* CROSSFire Octavus 2.4 — visible, lightweight central-arena rampart.
 * The authored source mesh stays intact; server/client playBounds enforce
 * collision. Walls sit OUTSIDE that boundary, so capsules stop flush with
 * the near face instead of visually clipping inside the masonry.
 */
import * as THREE from 'three';

function masonryTexture(){
 const canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#5b5850';ctx.fillRect(0,0,256,256);
 let seed=0x4f435432;
 const rand=()=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/4294967296;
 };
 const blockW=64,blockH=32;
 for(let row=0;row<8;row++){
  const offset=row%2?32:0;
  for(let col=-1;col<5;col++){
   const x=col*blockW-offset,y=row*blockH;
   const shade=Math.round(121+rand()*22);
   ctx.fillStyle=`rgb(${shade},${Math.round(shade*.91)},${Math.round(shade*.78)})`;
   ctx.fillRect(x+2,y+2,blockW-3,blockH-3);
   ctx.fillStyle='rgba(35,29,24,0.13)';
   ctx.fillRect(x+2,y+blockH-7,blockW-3,4);
   ctx.fillStyle='rgba(237,212,183,0.13)';
   ctx.fillRect(x+3,y+3,blockW-6,2);
  }
 }
 for(let i=0;i<2400;i++){
  const x=rand()*256,y=rand()*256,r=rand()*1.6+.25;
  ctx.fillStyle=rand()<.5?'rgba(30,25,24,0.13)':'rgba(245,225,190,0.10)';
  ctx.fillRect(x,y,r,r);
 }
 const tex=new THREE.CanvasTexture(canvas);
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(12,4);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.anisotropy=2;
 return tex;
}

export function createOctavusBoundary(scene,map){
 const b=map.playBounds||{};
 const config=map.arenaBoundary||{};
 const [x0,x1,z0,z1]=[b.x0,b.x1,b.z0,b.z1].map(Number);
 const bottom=Number(config.bottomY),top=Number(config.topY);
 const thick=Number(config.thickness);
 if(![x0,x1,z0,z1,bottom,top,thick].every(Number.isFinite)||
    x1<=x0||z1<=z0||top-bottom<16||thick<.5)
  throw Error('Invalid Octavus perimeter configuration');
 const width=x1-x0,depth=z1-z0,height=top-bottom;
 const midY=(top+bottom)/2;
 const texture=masonryTexture();
 const stone=new THREE.MeshStandardMaterial({map:texture,roughness:.93,metalness:0});
 const trim=new THREE.MeshStandardMaterial({color:'#74665a',roughness:.95});
 const owned=[];
 const addBox=(w,h,d,x,y,z,mat)=>{
  const geo=new THREE.BoxGeometry(w,h,d);
  const obj=new THREE.Mesh(geo,mat);
  obj.position.set(x,y,z);
  obj.castShadow=false;obj.receiveShadow=true;
  scene.add(obj);owned.push(obj);
 };
 // The inner wall face is precisely at playBounds, not an arbitrary offset.
 addBox(thick,height,depth+2*thick,x0-thick/2,midY,(z0+z1)/2,stone);
 addBox(thick,height,depth+2*thick,x1+thick/2,midY,(z0+z1)/2,stone);
 addBox(width, height,thick,(x0+x1)/2,midY,z0-thick/2,stone);
 addBox(width, height,thick,(x0+x1)/2,midY,z1+thick/2,stone);
 const capH=1.05,cap=thick+.5;
 addBox(cap,capH,depth+2*thick+cap,x0-thick/2,top+capH/2,(z0+z1)/2,trim);
 addBox(cap,capH,depth+2*thick+cap,x1+thick/2,top+capH/2,(z0+z1)/2,trim);
 addBox(width,capH,cap,(x0+x1)/2,top+capH/2,z0-thick/2,trim);
 addBox(width,capH,cap,(x0+x1)/2,top+capH/2,z1+thick/2,trim);
 // A single instanced batch gives scale and silhouette without dozens of
 // individual render calls. The posts also remain outside the collision edge.
 const stride=12.8;
 const countX=Math.floor(width/stride)+1,countZ=Math.floor(depth/stride)+1;
 const count=2*(countX+countZ);
 const postGeo=new THREE.BoxGeometry(thick+.9,height+2.1,thick+1);
 const posts=new THREE.InstancedMesh(postGeo,trim,count);
 const dummy=new THREE.Object3D();
 let i=0;
 for(let j=0;j<countZ;j++){
  const z=z0+depth*j/(countZ-1);
  for(const x of [x0-thick/2,x1+thick/2]){
   dummy.position.set(x,midY+.5,z);dummy.updateMatrix();
   posts.setMatrixAt(i++,dummy.matrix);
  }
 }
 for(let j=0;j<countX;j++){
  const x=x0+width*j/(countX-1);
  for(const z of [z0-thick/2,z1+thick/2]){
   dummy.position.set(x,midY+.5,z);dummy.updateMatrix();
   posts.setMatrixAt(i++,dummy.matrix);
  }
 }
 posts.instanceMatrix.needsUpdate=true;
 posts.castShadow=false;posts.receiveShadow=true;
 scene.add(posts);owned.push(posts);
 return {
  wallCount:4,postCount:count,
  dispose(){
   for(const obj of owned){
    obj.removeFromParent();
    obj.geometry.dispose();
   }
   stone.dispose();trim.dispose();texture.dispose();
  }
 };
}
