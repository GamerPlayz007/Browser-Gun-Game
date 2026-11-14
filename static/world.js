import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {topAt} from './physics.js';

// One shared lit material and one shared unlit material; batches are per district.
// Geometry remains map-driven, so new maps do not need a new rendering pipeline.
export function buildWorld(scene,map){
 const root=new T.Group();scene.add(root);
 const lit=new T.MeshLambertMaterial({vertexColors:true});
 const neon=new T.MeshBasicMaterial({vertexColors:true,toneMapped:false});
 const batches=new Map(),detailMeshes=[];
 const background=map.theme==='cyberpunk'?'#111c30':'#a3c7d0';
 scene.background=new T.Color(background);scene.fog=new T.Fog(background,65,160);
 const hemi=new T.HemisphereLight('#c2ddff','#4f5265',2);root.add(hemi);
 const sun=new T.DirectionalLight('#f5e9ee',2.2);sun.position.set(-30,55,25);root.add(sun);
 function add(g,b){
  if(g.index){const next=g.toNonIndexed();g.dispose();g=next;}
  g.deleteAttribute('uv');g.deleteAttribute('tangent');
  const c=new T.Color(map.palette[b.style]||b.style),p=g.attributes.position;
  const values=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){values[i*3]=c.r;values[i*3+1]=c.g;values[i*3+2]=c.b;}
  g.setAttribute('color',new T.BufferAttribute(values,3));
  const unlit=['cyan','magenta','amber','white'].includes(b.style),optional=!!b.detail;
  const key=`${b.zone||'district'}:${unlit}:${optional}`;
  if(!batches.has(key))batches.set(key,{geos:[],material:unlit?neon:lit,optional,zone:b.zone});
  batches.get(key).geos.push(g);
 }
 function rampGeometry(b){
  const corners=[[b.x-b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z+b.d/2],[b.x-b.w/2,b.z+b.d/2]],v=[];
  for(const lower of [true,false])for(const [x,z] of corners)v.push(x,topAt(b,x,z)-(lower?b.thickness:0),z);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));
  g.setIndex([4,6,5,4,7,6,0,1,2,0,2,3,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);g.computeVertexNormals();return g;
 }
 for(const b of [...map.boxes,...(map.decor||[])]){
  const g=b.kind==='ramp'?rampGeometry(b):new T.BoxGeometry(b.w,b.h,b.d).translate(b.x,b.y+b.h/2,b.z);
  add(g,b);
 }
 for(const {geos,material,optional,zone} of batches.values()){
  const geometry=mergeGeometries(geos);if(!geometry)throw Error('Map batching failed');
  geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.userData.zone=zone;root.add(mesh);
  if(optional)detailMeshes.push(mesh);for(const g of geos)g.dispose();
 }
 // One high-resolution atlas and one batch for all fixed signs. No DOM per sign.
 let signTexture,signMaterial;
 if(map.signs?.length){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128*map.signs.length;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#122332';ctx.fillRect(0,0,canvas.width,canvas.height);
  const geometries=[];
  map.signs.forEach((s,i)=>{
   ctx.fillStyle=map.palette[s.color];ctx.fillRect(12,i*128+8,1000,4);ctx.fillRect(12,i*128+116,1000,4);
   ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.text,512,i*128+65,950);
   const g=new T.PlaneGeometry(s.w,s.h);const uv=g.attributes.uv;
   for(let j=0;j<uv.count;j++)uv.setY(j,(map.signs.length-i-1+uv.getY(j))/map.signs.length);
   g.rotateY(s.rotationY||0);g.translate(s.x,s.y,s.z);geometries.push(g);
  });
  signTexture=new T.CanvasTexture(canvas);signTexture.colorSpace=T.SRGBColorSpace;
  signMaterial=new T.MeshBasicMaterial({map:signTexture,side:T.DoubleSide,toneMapped:false});
  const g=mergeGeometries(geometries);root.add(new T.Mesh(g,signMaterial));geometries.forEach(g=>g.dispose());
 }
 const targetMat=new T.MeshLambertMaterial({color:'#fcb457'}),targetHead=new T.MeshBasicMaterial({color:'#53f4ee'}),targets=new Map();
 for(const [i,p] of map.practiceTargets.entries()){
  const group=new T.Group(),body=new T.Mesh(new T.CylinderGeometry(.36,.4,1.05,8),targetMat),head=new T.Mesh(new T.IcosahedronGeometry(.25,1),targetHead);
  body.position.y=.95;head.position.y=1.62;group.add(body,head);group.position.set(...p);root.add(group);targets.set('t'+i,group);
 }
 return {sun,targets,staticBatches:batches.size+(map.signs?.length?1:0),
  setDetail(enabled){for(const mesh of detailMeshes)mesh.visible=enabled;},animate(){},
  dispose(){root.traverse(o=>o.geometry?.dispose());for(const m of [lit,neon,targetMat,targetHead,signMaterial])m?.dispose();signTexture?.dispose();root.removeFromParent();}
 };
}
