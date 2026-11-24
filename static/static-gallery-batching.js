/**
 * Conservative batching for standalone static glTF gallery scenes.
 * Reduces draw submissions, not triangle count. Never run on animated scenes.
 */
import { Matrix4, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function geometrySignature(g){
 if(!g?.isBufferGeometry||!g.getAttribute('position')||g.groups.length>1)return null;
 if(g.drawRange.start!==0||g.drawRange.count!==Infinity)return null;
 if(Object.values(g.morphAttributes).some(a=>a.length))return null;
 const attrs=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b));
 if(attrs.some(([,a])=>a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute||!a.array))return null;
 return JSON.stringify([!!g.index,attrs.map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name,a.gpuType])]);
}

export function batchStaticScene(root,{animated=false}={}){
 const report={before:0,after:0,batches:0,removed:0};
 if(!root)return report;
 root.traverse(o=>{if(o.isMesh)report.before++});
 report.after=report.before;
 if(animated)return report;
 root.updateMatrixWorld(true);
 if(!Number.isFinite(root.matrixWorld.determinant())||Math.abs(root.matrixWorld.determinant())<1e-12)return report;
 const inverse=new Matrix4().copy(root.matrixWorld).invert(), groups=new Map(), oldGeometries=new Set();
 root.traverseVisible(o=>{
  if(o===root||!o.isMesh||o.isSkinnedMesh||o.isInstancedMesh||o.isBatchedMesh||o.children.length)return;
  const m=o.material,g=o.geometry;
  if(!m||Array.isArray(m)||m.transparent||m.opacity!==1||m.transmission>0||m.alphaTest>0||m.isShaderMaterial)return;
  if(o.morphTargetInfluences?.length||!o.frustumCulled)return;
  const signature=geometrySignature(g);
  if(!signature)return;
  const matrix=new Matrix4().multiplyMatrices(inverse,o.matrixWorld);
  // Mirrored transforms need winding repair; keep those meshes untouched.
  if(!Number.isFinite(matrix.determinant())||matrix.determinant()<=1e-12)return;
  const key=JSON.stringify([m.uuid,signature,o.castShadow,o.receiveShadow,o.layers.mask,o.renderOrder]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({o,matrix});
 });
 for(const entries of groups.values()){
  if(entries.length<2)continue;
  const copies=[];
  let merged=null;
  try{
   for(const {o,matrix} of entries)copies.push(o.geometry.clone().applyMatrix4(matrix));
   merged=mergeGeometries(copies,false);
   if(!merged)continue;
   merged.computeBoundingBox();merged.computeBoundingSphere();
   const first=entries[0].o, batch=new Mesh(merged,first.material);
   batch.name='Static gallery batch';
   batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
   batch.layers.mask=first.layers.mask;batch.renderOrder=first.renderOrder;
   root.add(batch);
   for(const {o} of entries){oldGeometries.add(o.geometry);o.removeFromParent();}
   report.batches++;report.removed+=entries.length-1;
  }catch(e){merged?.dispose();console.warn('Static gallery batch skipped',e);}
  finally{for(const copy of copies)copy.dispose();}
 }
 const remaining=new Set();
 root.traverse(o=>{if(o.geometry)remaining.add(o.geometry)});
 for(const g of oldGeometries)if(!remaining.has(g))g.dispose();
 report.after=report.before-report.removed;
 root.updateMatrixWorld(true);
 return report;
}
