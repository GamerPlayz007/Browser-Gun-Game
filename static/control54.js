// CROSSFIRE 05.4 — purely visual, zero-collision Control Point beacon.
// Coordinates, ownership and contested state come from authoritative snapshots.
export const CONTROL54_COLORS={azure:'#57ddff',ember:'#ff996c',neutral:'#ffe4a3'};
export function createControlBeacon54(T,scene){
 const root=new T.Group();root.name='control54-neon-beacon';root.visible=false;
 root.userData.collidable=false;
 const ringMat=new T.MeshBasicMaterial({color:CONTROL54_COLORS.neutral,
  transparent:true,opacity:.64,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 const coreMat=new T.MeshBasicMaterial({color:CONTROL54_COLORS.neutral,
  transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
 const haloMat=new T.MeshBasicMaterial({color:CONTROL54_COLORS.neutral,
  transparent:true,opacity:.38,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 const ring=new T.Mesh(new T.TorusGeometry(6,.065,6,80),ringMat);
 ring.rotation.x=-Math.PI/2;ring.position.y=.09;root.add(ring);
 const post=new T.Mesh(new T.CylinderGeometry(.11,.22,2.7,12),coreMat);
 post.position.y=1.44;root.add(post);
 const halo=new T.Mesh(new T.TorusGeometry(.57,.055,8,36),haloMat);
 halo.position.y=3.05;root.add(halo);
 scene.add(root);
 function update(objective,time=0,show=true){
  root.visible=Boolean(show&&objective);
  if(!root.visible)return;
  root.position.set(objective.x,objective.y,objective.z);
  const owner=objective.contested?'neutral':objective.controller||'neutral';
  const color=CONTROL54_COLORS[owner]||CONTROL54_COLORS.neutral;
  for(const material of [ringMat,coreMat,haloMat])material.color.set(color);
  const t=Number.isFinite(time)?time:0;
  const pulse=.5+.5*Math.sin(t*2.2);
  ringMat.opacity=objective.contested?.44+.23*pulse:.52+.16*pulse;
  haloMat.opacity=.28+.22*pulse;
  coreMat.opacity=.48+.25*pulse;
  halo.position.y=3.05+Math.sin(t*1.7)*.16;
  halo.rotation.z=t*.5;
 }
 function dispose(){
  root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  root.removeFromParent();
 }
 return {root,ring,post,halo,update,dispose};
}
