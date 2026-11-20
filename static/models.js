import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeAvatarAnim,trackAvatar,markAvatar,avatarPose} from './animation34.js';
import {buildWeaponVisuals21} from './weapon_visuals21.js';
import {sampleReloadPose23} from './reload_motion23.js';
const materials=new Map();const material=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.48,metalness:.25}));return materials.get(c);};
function box(parent,w,h,d,c,x,y,z,r=.018){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),material(c));m.position.set(x,y,z);parent.add(m);return m;}
function cylinder(parent,r1,r2,h,c,x,y,z){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,12),material(c));m.position.set(x,y,z);parent.add(m);return m;}
function barrel(parent,r,len,c,x,y,z){const m=cylinder(parent,r,r,len,c,x,y,z);m.rotation.x=Math.PI/2;return m;}
// Daybreak 6.7: repeated armor/trim details draw as ONE instanced mesh.
// A whole team therefore adds only a handful of draw calls on High/Ultra.
function details67(parent,color,tier,parts){
 const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material(color),parts.length);
 const dummy=new T.Object3D();
 for(let i=0;i<parts.length;i++){
  const [x,y,z,w,h,d,rz=0]=parts[i];
  dummy.position.set(x,y,z);dummy.rotation.set(0,0,rz);
  dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 mesh.instanceMatrix.needsUpdate=true;
 mesh.userData.detailTier67=tier;mesh.userData.collidable=false;
 parent.add(mesh);return mesh;
}
const MODEL_QUALITY67={performance:0,auto:1,high:1,ultra:2,native:2};
export function setModelQuality67(root,mode='high'){
 const tier=MODEL_QUALITY67[mode]??1;
 root.traverse(o=>{if(Number.isInteger(o.userData.detailTier67))
  o.visible=o.userData.detailTier67<=tier;});
 return tier;
}
export function makeWeapon(id,arms=true){
 const root=new T.Group(),model=new T.Group(),magazine=new T.Group(),left=new T.Group();
 root.add(model,left);model.add(magazine);magazine.position.set(0,-.1,-.035);
 const {flash,action}=buildWeaponVisuals21(model,magazine,id);
 // Arm poses remain compatible with Stage 2.2's upcoming movement/animation pass.
 if(arms){
  const sleeve=0x536d68,glove=0x283941;
  box(root,.13,.13,.35,sleeve,.035,-.16,.40).rotation.x=.17;
  box(root,.117,.106,.15,glove,.015,-.11,.20);
  box(left,.13,.13,.37,sleeve,-.13,-.18,-.08).rotation.z=-.22;
  box(left,.12,.10,.15,glove,-.065,-.09,-.23);
 }
 root.userData={model,magazine,left,flash,action,id};
 return root;
}
// Stage 2.2: distinct visual handling, optimized for the school browser build.
// This changes only rendered pose, not the server's shot direction or accuracy.
const WEAPON_MOTION22=[
 {bob:.010,sway:.010,recoil:.70,back:.24,roll:.11,sprintDrop:.100},
 {bob:.014,sway:.016,recoil:.47,back:.17,roll:.18,sprintDrop:.120},
 {bob:.008,sway:.008,recoil:1.12,back:.40,roll:.10,sprintDrop:.145},
 {bob:.006,sway:.006,recoil:.97,back:.32,roll:.08,sprintDrop:.090}
];
const clamp22=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth22=v=>v*v*(3-2*v);
function motionPose22(out,{id,time=0,ads=0,reload=0,kick=0,speed=0,
 sprint=false,slide=0,motion=true,switched=0}){
 const config=WEAPON_MOTION22[id]||WEAPON_MOTION22[0];
 const aimed=smooth22(clamp22(ads)),open=1-aimed;
 const moving=motion?clamp22(Math.max(0,speed)/6):0;
 const gait=moving*(1-aimed*.95),run=sprint?moving*open:0;
 const recoil=clamp22(kick/.20),swap=clamp22(switched),low=clamp22(slide);
 const beat=time*(9+2*run);
 const step=Math.sin(beat),sway=Math.cos(beat*.5),breath=motion?Math.sin(time*1.75):0;
 // ADS reaches x=0 exactly, with idle movement nearly eliminated.
 out.x=.28*open+config.sway*sway*gait*open+.038*run;
 out.y=-.29*open+(id===3?-.17:-.145)*aimed
   +Math.abs(step)*config.bob*gait+.0025*breath*open
   -config.sprintDrop*run-.19*swap-.025*low;
 out.z=-.50*open-.39*aimed+.032*run+.042*swap
   +config.back*recoil*.25;
 out.rx=.19*config.recoil*recoil+.08*run
   +.012*step*gait*open;
 out.ry=.011*sway*gait*open;
 out.rz=.028*config.roll*recoil+.16*run-.17*swap
   +.009*step*gait*open-.16*low;
 out.bodyY=Math.min(.026,.015*config.recoil*recoil);
 out.bodyZ=Math.min(.04,.13*config.back*recoil);
 out.bodyRx=-.10*config.recoil*recoil;
 out.slideAction=id===2?recoil*.085:0;
 out.boltAction=id!==2?Math.min(.04,recoil*(id===1?.034:.026)):0;
 return out;
}
export function animateWeapon(root,{time=0,ads=0,reload=0,kick=0,moving=false,
 slide=0,motion=true,switched=0,speed=0,sprint=false}){
 const d=root.userData,id=d.id;
 // Reuse the pose buffer; animations run every frame, even on weak GPUs.
 const pose=d.motionPose22||(d.motionPose22={});
 const clip=d.reloadPose23||(d.reloadPose23={});
 motionPose22(pose,{id,time,ads,reload,kick,slide,motion,switched,
  speed:Math.max(speed,moving?.8:0),sprint});
 sampleReloadPose23(clip,id,reload);
 // Compose the movement pose and normalized reload clip; visuals never change
 // the server's weapon state, aim angles or reload duration.
 root.position.set(pose.x+clip.x,pose.y+clip.y,pose.z+clip.z);
 root.rotation.set(pose.rx+clip.rx,pose.ry+clip.ry,pose.rz+clip.rz);
 d.model.position.set(0,pose.bodyY,pose.bodyZ);
 d.model.rotation.set(pose.bodyRx,0,0);
 d.magazine.position.set(clip.magX,-.1+clip.magY,-.035+clip.magZ);
 d.magazine.rotation.set(clip.magRX,0,clip.magRZ);
 d.left.position.set(clip.handX,clip.handY,clip.handZ);
 d.left.rotation.set(-pose.bodyRx*.55+clip.handRX,0,clip.handRZ);
 const a=d.action;
 if(a?.bolt){
  if(!Number.isFinite(a.bolt.userData.homeZ22))a.bolt.userData.homeZ22=a.bolt.position.z;
  a.bolt.position.z=a.bolt.userData.homeZ22+pose.boltAction+clip.actionZ;
 }
 if(a?.pump)a.pump.position.z=-pose.slideAction+clip.actionZ;
}
export function makePlayer(name,color=0xd38165){
 const root=new T.Group(),body=new T.Group();root.add(body);
 box(body,.56,.64,.34,0x3b5559,0,1.13,0,.07);
 const chestSkin56=box(body,.60,.25,.38,color,0,1.36,0,.05);
 box(body,.43,.22,.31,0x263b40,0,.76,0);
 box(body,.47,.055,.36,0x67c6b9,0,1.06,-.015,.012);
 // Compact vest fasteners, pockets and shoulder webbing preserve silhouette
 // without creating a new mesh draw call for each piece.
 details67(body,0x283d43,1,[
  [-.225,1.27,-.20,.065,.33,.035],[.225,1.27,-.20,.065,.33,.035],
  [-.13,1.13,-.203,.19,.16,.04],[.13,1.13,-.203,.19,.16,.04],
  [-.12,.88,-.176,.20,.12,.04],[.12,.88,-.176,.20,.12,.04],
  [0,.785,-.21,.40,.05,.035],[0,1.45,.19,.23,.045,.035]]);
 details67(body,0xa7b2a2,2,[
  [0,1.28,-.22,.065,.13,.03],
  [-.20,.995,-.202,.085,.045,.035],[.20,.995,-.202,.085,.045,.035],
  [-.28,1.14,0,.038,.32,.28],[.28,1.14,0,.038,.32,.28],
  [0,.79,.18,.20,.10,.035]]);
 const head=new T.Group();head.position.y=1.67;body.add(head);
 const helmet=new T.Mesh(new T.SphereGeometry(.23,12,8),material(color));
 helmet.scale.y=.9;head.add(helmet);
 box(head,.36,.12,.12,0x173841,0,.015,-.18,.035);
 box(head,.27,.055,.025,0x7bd6d1,0,.03,-.25,.01);
 details67(head,0x34474c,1,[
  [-.205,.03,0,.045,.14,.13],[.205,.03,0,.045,.14,.13],
  [0,.142,-.11,.28,.025,.105],
  [0,-.10,.16,.26,.045,.07]]);
 details67(head,0xa6c3bb,2,[
  [-.165,.028,-.19,.025,.07,.028],[.165,.028,-.19,.025,.07],
  [0,.08,-.26,.20,.014,.014]]);
 const legs=[],knees=[],arms=[],elbows=[],skinMeshes56=[chestSkin56,helmet];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.16,.79,0);body.add(leg);
  // Matching color on the thighs makes players identifiable at a distance.
  skinMeshes56.push(box(leg,.21,.38,.23,color,0,-.18,0,.05));
  const knee=new T.Group();knee.position.y=-.37;leg.add(knee);
  box(knee,.18,.3,.2,0x3b5559,0,-.12,.015,.04);
  box(knee,.22,.13,.32,0x263b40,0,-.36,-.055);
  details67(leg,0x374f54,2,[
   [0,-.17,-.14,.13,.20,.04],[0,-.34,-.12,.14,.05,.045]]);
  details67(knee,0x9da9a2,2,[
   [0,-.08,-.11,.12,.12,.035],[0,-.35,-.16,.17,.055,.07]]);
  legs.push(leg);knees.push(knee);
  const arm=new T.Group();arm.position.set(side*.37,1.39,0);body.add(arm);
  skinMeshes56.push(box(arm,.18,.38,.21,color,0,-.16,-.05,.06));
  const elbow=new T.Group();elbow.position.set(0,-.32,-.16);arm.add(elbow);
  box(elbow,.16,.34,.18,0x526e70,0,-.14,-.06,.04).rotation.x=-.3;
  details67(arm,0x283e45,2,[
   [0,-.16,-.17,.14,.13,.04],[0,-.27,.09,.13,.08,.04]]);
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
 setModelQuality67(root,'high');
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
 const lean=Number.isFinite(p.lean)?Math.max(-1,Math.min(1,p.lean)):0;
 d.body.position.set(lean*.10,pose.bodyY+pose.idleBreath,0);
 d.body.rotation.set(pose.torsoPitch,pose.hipYaw,pose.torsoRoll-lean*.11);
 d.head.position.x=lean*.30;
 d.head.rotation.x=pose.headPitch-pose.torsoPitch*.35;
 d.legs.forEach((leg,i)=>{
  const side=i===0?1:-1;
  leg.rotation.x=pose.legSwing*side+(pose.state==='slide'?-.30:0);
  leg.rotation.z=(pose.state==='slide'?(i===0?-.09:.09):0)+pose.legSide*side;
  d.knees[i].rotation.x=pose.kneeBend+Math.max(0,pose.legSwing*side)*.22;
 });
 d.arms.forEach((arm,i)=>{
  const side=i===0?1:-1;
  arm.rotation.x=-.16-pose.armBrace+pose.armSwing*side*.55;
  arm.rotation.z=(i===0?-.04:.04);
  d.elbows[i].rotation.x=-.26+(pose.state==='run'?.15:0)+pose.armWeight*.06;
 });
 d.gun.rotation.x=-pose.gunKick*.7;
 d.gun.position.set(.26,1.1-pose.gunKick*.04,-.34+pose.gunKick*.07);
 d.gun.userData.flash.visible=pose.gunKick>.06;
 d.impact.material.opacity=pose.hitGlow*.65;
 d.spawnRing.visible=pose.spawnPulse>0;
 d.spawnRing.material.opacity=pose.spawnPulse*.46;
 d.spawnRing.scale.setScalar(1+(1-pose.spawnPulse)*.7);
 d.tag.position.y=pose.tagY;
 d.tag.position.x=lean*.32;
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
