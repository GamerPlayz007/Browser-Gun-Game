import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeAvatarAnim,trackAvatar,markAvatar,avatarPose} from './animation34.js';
const materials=new Map();const material=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.48,metalness:.25}));return materials.get(c);};
function box(parent,w,h,d,c,x,y,z,r=.018){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),material(c));m.position.set(x,y,z);parent.add(m);return m;}
function cylinder(parent,r1,r2,h,c,x,y,z){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,12),material(c));m.position.set(x,y,z);parent.add(m);return m;}
function barrel(parent,r,len,c,x,y,z){const m=cylinder(parent,r,r,len,c,x,y,z);m.rotation.x=Math.PI/2;return m;}
export function makeWeapon(id,arms=true){
 const root=new T.Group(),model=new T.Group();root.add(model);const dark=0x233941,black=0x17252b,metal=0x667b7e,acc=[0xe7b258,0x60d4be,0xef8a79,0xb1b4ee][id];
 const length=[.45,.31,.56,.65][id];box(model,.13,.15,length,dark,0,0,0);box(model,.145,.05,length*.65,acc,0,.072,-.02);
 barrel(model,id===2?.043:.026,id===3?.43:.25,black,0,.016,-length/2-.1);
 barrel(model,.041,.07,metal,0,.016,-length/2-(id===3?.32:.23));
 box(model,.09,.13,.25,dark,0,-.005,length/2+.14);box(model,.115,.17,.055,black,0,-.008,length/2+.28);
 box(model,.085,.19,.1,black,0,-.15,.12).rotation.x=-.3;
 const magazine=new T.Group();magazine.position.set(0,-.1,-.035);model.add(magazine);box(magazine,.09,id===2?.08:.24,.105,black,0,-.1,0).rotation.x=id===1?-.14:.12;box(magazine,.102,.035,.12,metal,0,-.23,0);
 for(let i=0;i<5;i++)box(model,.145,.016,.025,black,0,.105,.1-i*.045,.004);
 if(id===3){barrel(model,.062,.25,black,0,.17,-.01);barrel(model,.05,.008,0x5abbb9,0,.17,.12);box(model,.045,.08,.09,metal,0,.1,0);}
 else{box(model,.015,.065,.02,black,-.035,.135,.1);box(model,.015,.065,.02,black,.035,.135,.1);box(model,.02,.06,.02,black,0,.12,-length/2);box(model,.012,.014,.012,0x97f3d6,0,.153,-length/2);}
 if(id===2){box(model,.15,.1,.23,0x9d5e4e,0,-.06,-.24);barrel(model,.03,.46,metal,0,-.07,-.16);}
 if(id===1)box(model,.06,.055,.045,metal,.09,.005,.06);
 const flash=new T.Mesh(new T.OctahedronGeometry(.085),new T.MeshBasicMaterial({color:0xffe1a0}));flash.position.set(0,.016,-length/2-(id===3?.38:.28));flash.scale.z=2;model.add(flash);flash.visible=false;
 const left=new T.Group();root.add(left);
 if(arms){box(root,.13,.13,.35,0x536d68,.035,-.16,.40).rotation.x=.17;box(root,.115,.11,.14,0x2f4547,.015,-.11,.20);box(left,.13,.13,.37,0x536d68,-.13,-.18,-.08).rotation.z=-.22;box(left,.12,.10,.15,0x2f4547,-.065,-.09,-.23);}
 root.userData={model,magazine,left,flash,id};return root;
}
export function animateWeapon(root,{time,ads,reload,kick,moving,slide,motion,switched}){
 const d=root.userData,id=d.id;root.position.set(T.MathUtils.lerp(.28,0,ads),T.MathUtils.lerp(-.29,id===3?-.17:-.145,ads),T.MathUtils.lerp(-.50,-.39,ads)+kick*.65);
 const bob=moving&&motion?Math.sin(time*12)*.008*(1-ads*.8):0;root.position.y+=bob-switched*.22;
 root.rotation.set(kick*.4,0,(moving&&motion?Math.cos(time*6)*.012:0)-slide*.22);
 // 05.2: a short mechanical receiver snap and hand follow-through.
 // Purely first-person visual motion; server recoil and hit logic unchanged.
 d.model.position.set(0,Math.min(.018,kick*.16),Math.min(.015,kick*.1));
 d.model.rotation.x=-kick*.21;
 d.magazine.position.set(0,-.1, -.035);d.left.position.set(0,0,0);
 d.left.rotation.x=-kick*.18;
 if(reload>0){const p=1-reload;const wave=Math.sin(p*Math.PI);root.rotation.z-=wave*.4;root.rotation.x+=wave*.18;root.position.y-=wave*.04;const drop=p<.48?Math.sin(p/.48*Math.PI/2):Math.cos((p-.48)/.52*Math.PI/2);d.magazine.position.y-=drop*.32;d.magazine.position.x-=drop*.12;d.left.position.y-=drop*.15;}
}
export function makePlayer(name,color=0xd38165){
 const root=new T.Group(),body=new T.Group();root.add(body);
 box(body,.56,.64,.34,0x3b5559,0,1.13,0,.07);
 const chestSkin56=box(body,.60,.25,.38,color,0,1.36,0,.05);
 box(body,.43,.22,.31,0x263b40,0,.76,0);
 box(body,.47,.055,.36,0x67c6b9,0,1.06,-.015,.012);
 const head=new T.Group();head.position.y=1.67;body.add(head);
 const helmet=new T.Mesh(new T.SphereGeometry(.23,12,8),material(color));
 helmet.scale.y=.9;head.add(helmet);
 box(head,.36,.12,.12,0x173841,0,.015,-.18,.035);
 box(head,.27,.055,.025,0x7bd6d1,0,.03,-.25,.01);
 const legs=[],knees=[],arms=[],elbows=[],skinMeshes56=[chestSkin56,helmet];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.16,.79,0);body.add(leg);
  box(leg,.21,.38,.23,0x68807a,0,-.18,0,.05);
  const knee=new T.Group();knee.position.y=-.37;leg.add(knee);
  box(knee,.18,.3,.2,0x3b5559,0,-.12,.015,.04);
  box(knee,.22,.13,.32,0x263b40,0,-.36,-.055);
  legs.push(leg);knees.push(knee);
  const arm=new T.Group();arm.position.set(side*.37,1.39,0);body.add(arm);
  skinMeshes56.push(box(arm,.18,.38,.21,color,0,-.16,-.05,.06));
  const elbow=new T.Group();elbow.position.set(0,-.32,-.16);arm.add(elbow);
  box(elbow,.16,.34,.18,0x526e70,0,-.14,-.06,.04).rotation.x=-.3;
  arms.push(arm);elbows.push(elbow);
 }
 const gun=makeWeapon(0,false);gun.scale.setScalar(.8);
 gun.position.set(.26,1.1,-.34);body.add(gun);
 const impact=new T.Mesh(new T.BoxGeometry(.61,.09,.40),
  new T.MeshBasicMaterial({color:0xffba78,transparent:true,opacity:0,depthWrite:false}));
 impact.position.set(0,1.35,0);impact.userData.uniqueMaterial=true;body.add(impact);
 // Spawn marker is a brief graphical signal, not an active hitbox.
 const spawnRing=new T.Mesh(new T.TorusGeometry(.43,.025,4,32),
  new T.MeshBasicMaterial({color:0x67ede5,transparent:true,opacity:0,depthWrite:false}));
 spawnRing.rotation.x=-Math.PI/2;spawnRing.position.y=.05;
 spawnRing.userData.uniqueMaterial=true;root.add(spawnRing);
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=48;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#17353bba';
 ctx.fillRect(0,0,256,48);ctx.fillStyle='#fff4dc';
 ctx.textAlign='center';ctx.font='bold 22px sans-serif';
 ctx.fillText(name,128,31);
 const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
 const tag=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:true}));
 tag.position.y=2.12;tag.scale.set(1.5,.28,1);root.add(tag);
 root.traverse(o=>{if(o.isMesh&&o!==spawnRing&&o!==impact)o.castShadow=true;});
 root.userData={body,head,limbs:legs,legs,knees,arms,elbows,gun,
  tag,spawnRing,impact,skinMeshes56,skinColor56:color,animation:makeAvatarAnim()};
 return root;
}
// Material references are shared; recoloring swaps references instead of mutating
// the palette for every other player. Works for in-round cosmetic changes.
export function setPlayerSkin56(root,color){
 if(!root?.userData?.skinMeshes56||root.userData.skinColor56===color)return false;
 for(const piece of root.userData.skinMeshes56)piece.material=material(color);
 root.userData.skinColor56=color;
 return true;
}
export function markPlayerEvent(root,type,time){
 if(root?.userData?.animation)markAvatar(root.userData.animation,type,time);
}
export function animatePlayer(root,p,time){
 const d=root.userData;
 trackAvatar(d.animation,p,time);
 const pose=avatarPose(p,time,d.animation);
 d.body.position.set(0,pose.bodyY,0);
 d.body.rotation.set(pose.torsoPitch,0,pose.torsoRoll);
 d.head.rotation.x=pose.headPitch-pose.torsoPitch*.35;
 d.legs.forEach((leg,i)=>{
  const side=i===0?1:-1;
  leg.rotation.x=pose.legSwing*side+(pose.state==='slide'?-.30:0);
  leg.rotation.z=pose.state==='slide'?(i===0?-.09:.09):0;
  d.knees[i].rotation.x=pose.kneeBend+Math.max(0,pose.legSwing*side)*.22;
 });
 d.arms.forEach((arm,i)=>{
  const side=i===0?1:-1;
  arm.rotation.x=-.16-pose.armBrace+pose.armSwing*side*.55;
  arm.rotation.z=(i===0?-.04:.04);
  d.elbows[i].rotation.x=-.26+(pose.state==='run'?.15:0);
 });
 d.gun.rotation.x=-pose.gunKick*.7;
 d.gun.position.set(.26,1.1-pose.gunKick*.04,-.34+pose.gunKick*.07);
 d.gun.userData.flash.visible=pose.gunKick>.06;
 d.impact.material.opacity=pose.hitGlow*.65;
 d.spawnRing.visible=pose.spawnPulse>0;
 d.spawnRing.material.opacity=pose.spawnPulse*.46;
 d.spawnRing.scale.setScalar(1+(1-pose.spawnPulse)*.7);
 d.tag.position.y=pose.tagY;
 root.rotation.y=Number.isFinite(p.yaw)?p.yaw:0;
 root.scale.setScalar(pose.visibilityScale);
 return pose;
}
export function disposePlayer(root){
 root.traverse(o=>{
  o.geometry?.dispose();
  if(o.isSprite){o.material.map?.dispose();o.material.dispose();}
  else if(o.userData.uniqueMaterial)o.material.dispose();
 });
 root.removeFromParent();
}
