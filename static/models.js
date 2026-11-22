import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeAvatarAnim,trackAvatar,markAvatar,avatarPose} from './animation34.js';
import {buildAetherGameVisuals,disposeAetherMaterials} from './aether_game_models.js';
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
// CROSSFire v7.2 — inexpensive articulated sci-fi gloves for the local view.
// Deliberately stylized energy-transfer gestures, not real-world mechanisms.
// Built ONLY for first person (arms=true) to protect school laptop performance.
function buildReloadGlove72(parent,gloveColor,accentMat,x,y,z){
 const hand=new T.Group();hand.position.set(x,y,z);parent.add(hand);
 box(hand,.108,.083,.143,gloveColor,0,0,0,.019);
 box(hand,.114,.021,.102,0x748c91,0,.042,.011,.007);
 const fingers=[];
 for(let i=0;i<3;i++){
  const finger=new T.Group();finger.position.set((i-1)*.035,-.021,-.065);
  hand.add(finger);
  box(finger,.028,.032,.079,gloveColor,0,0,-.037,.009);
  box(finger,.029,.012,.045,0x64777d,0,.017,-.036,.005);
  fingers.push(finger);
 }
 const thumb=new T.Group();thumb.position.set(.066,-.019,-.013);
 box(thumb,.032,.035,.074,gloveColor,.016,-.005,-.027,.009);
 thumb.rotation.y=-.40;hand.add(thumb);
 const marker=new T.Mesh(new T.SphereGeometry(.018,8,6),accentMat);
 marker.position.set(0,.049,-.011);marker.visible=false;hand.add(marker);
 return {hand,fingers,thumb,marker,base:{x,y,z}};
}
export function makeWeapon(id,arms=true,finish=Math.floor(Math.random()*3)){
 const root=new T.Group(),model=new T.Group(),magazine=new T.Group();
 const left=new T.Group(),right=new T.Group();
 root.add(model,left,right);model.add(magazine);
 const visual=buildAetherGameVisuals(model,magazine,id,finish);
 const {flash,action}=visual;
 // Abstract glowing visual marker: the AETHER energy cycle is unmistakable.
 const reloadGlyph70=new T.Mesh(new T.TorusGeometry(.105,.009,5,24),
  new T.MeshBasicMaterial({color:0x67f1eb,transparent:true,
   opacity:.68,depthWrite:false,side:T.DoubleSide}));
 reloadGlyph70.position.set(0,.065,-.14);
 reloadGlyph70.material.color.setHex(visual.getGlowColor());
 reloadGlyph70.visible=false;
 visual.gun.add(reloadGlyph70);
 visual.uniqueMaterials.push(reloadGlyph70.material);
 // Two independent animated glove rigs; the animated geometry is used
 // only in the first-person camera. Remote avatars retain their existing rigs.
 let hands72=null;
 if(arms){
  const sleeve=0x536d68,glove=0x283941;
  box(right,.13,.13,.35,sleeve,.035,-.16,.40).rotation.x=.17;
  box(left,.13,.13,.37,sleeve,-.13,-.18,-.08).rotation.z=-.22;
  const palmGlow72=new T.MeshBasicMaterial({
   color:visual.getGlowColor(),transparent:true,opacity:.76,depthWrite:false});
  visual.uniqueMaterials.push(palmGlow72);
  const leftGlove=buildReloadGlove72(left,glove,palmGlow72,-.065,-.09,-.235);
  const rightGlove=buildReloadGlove72(right,glove,palmGlow72,.018,-.11,.18);
  hands72={left:leftGlove,right:rightGlove,palmGlow:palmGlow72};
 }
 root.userData={model,magazine,left,right,hands72,flash,action,id,adsAnchor:visual.adsAnchor,reloadGlyph70,
  aetherMaterials:visual.uniqueMaterials,aetherFinish:finish,
  aetherSetFinish:visual.setFinish,aetherGetGlowColor:visual.getGlowColor,
  aetherArtGun71:visual.gun,aetherDefaultYaw71:visual.gun.rotation.y,
  aetherBatchCount:visual.batchCount};
 return root;
}
// Material palettes are private to each rig: changing a player's finish
// never repaints another player's weapon.
export function setWeaponFinish(root,index){
 const d=root?.userData;
 if(!d?.aetherSetFinish)return false;
 const normalized=Math.max(0,Math.min(2,Math.trunc(Number(index)||0)));
 if(d.aetherFinish===normalized)return false;
 d.aetherFinish=normalized;
 const changed=d.aetherSetFinish(normalized);
 if(changed&&d.reloadGlyph70)d.reloadGlyph70.material.color.setHex(d.aetherGetGlowColor());
 if(changed&&d.hands72)d.hands72.palmGlow.color.setHex(d.aetherGetGlowColor());
 return changed;
}
export function disposeWeaponRig(root){
 if(!root)return;
 disposeAetherMaterials(root);
 root.traverse(o=>o.geometry?.dispose());
 root.removeFromParent();
}
// CROSSFire 07.1 — layered, movement-aware AETHER viewmodel animation.
// All offsets below are decorative first-person rendering only.
// Fire focus cancels side yaw and roll WITHOUT dragging the gun into ADS.
const WEAPON_MOTION22=[
 {bob:.027,sway:.034,recoil:.70,back:.24,roll:.11,sprintDrop:.100,showX:-.040,showZ:.045,showYaw:.37,showRoll:-.11,showPitch:.025},
 {bob:.038,sway:.046,recoil:.47,back:.17,roll:.18,sprintDrop:.120,showX:-.048,showZ:.035,showYaw:.43,showRoll:-.12,showPitch:.030},
 {bob:.030,sway:.030,recoil:1.12,back:.40,roll:.10,sprintDrop:.145,showX:-.030,showZ:.060,showYaw:.35,showRoll:-.105,showPitch:.020},
 {bob:.022,sway:.025,recoil:.97,back:.32,roll:.08,sprintDrop:.090,showX:-.040,showZ:.095,showYaw:.33,showRoll:-.105,showPitch:.018}
];
const clamp22=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const signed22=v=>Math.max(-1,Math.min(1,Number.isFinite(v)?v:0));
const smooth22=v=>v*v*(3-2*v);
function motionPose22(out,{id,time=0,ads=0,reload=0,kick=0,speed=0,
 sprint=0,crouch=0,slide=0,motion=true,switched=0,forward=0,
 stepPhase=0,stepStrength=0,strafe=0,forwardSpeed=0,lookX=0,lookY=0,
 grounded=true,landing=0}){
 const config=WEAPON_MOTION22[id]||WEAPON_MOTION22[0];
 const aimed=smooth22(clamp22(ads)),placeOpen=1-aimed;
 // Only the rotation is straightened when firing/reloading. The location
 // remains the SAME hip-fire carry position rather than snapping to ADS.
 const facing=Math.max(aimed,smooth22(clamp22(forward)));
 const rotationOpen=1-facing;
 const velocity=clamp22(Math.max(0,speed)/6);
 const stepEnergy=motion?clamp22(stepStrength):0;
 const slideEnergy=clamp22(slide);
 const crouchEnergy=clamp22(crouch)*(1-slideEnergy);
 const gait=stepEnergy*(1-aimed*.97)*(1-slideEnergy*.88)*
  (1-crouchEnergy*.45);
 const run=clamp22(sprint)*velocity*placeOpen;
 const lateral=motion?signed22(strafe):0;
 const longitudinal=motion?signed22(forwardSpeed):0;
 const lookSide=motion?signed22(lookX):0;
 const lookVertical=motion?signed22(lookY):0;
 const step=Math.sin(stepPhase),otherStep=Math.cos(stepPhase);
 const fall=Math.abs(step),breath=motion?Math.sin(time*1.65):0;
 const recoil=clamp22(kick/.20),swap=clamp22(switched);
 const showcase=placeOpen*(1-.12*run)*(1-.10*slideEnergy)*(1-.10*swap);
 const tilted=rotationOpen*(1-.10*run)*(1-.10*slideEnergy)*
  (1-.13*swap);
 const movementSide=config.sway*otherStep*gait+
  .052*lateral*(1-aimed)+.023*lookSide*(1-aimed);
 const movementBounce=config.bob*fall*gait+
  .006*Math.max(0,Math.sin(stepPhase*2))*gait;
 // Walking/sprinting bob, strafing displacement, crouch tuck, slide dip,
 // landing compression and mouse-look lag are independent visible layers.
 out.x=.28*placeOpen+config.showX*showcase+
  movementSide*placeOpen+.026*run+.014*slideEnergy*placeOpen;
 out.y=-.29*placeOpen+(id===3?-.17:-.145)*aimed+
  movementBounce*placeOpen+.0030*breath*placeOpen-
  config.sprintDrop*run-.19*swap-
  .066*crouchEnergy*placeOpen-.132*slideEnergy*placeOpen-
  .050*clamp22(landing)*placeOpen+.008*showcase;
 out.z=-.50*placeOpen-.39*aimed+.023*run+.042*swap+
  config.back*recoil*.25-config.showZ*showcase+
  .033*slideEnergy*placeOpen-.026*crouchEnergy*placeOpen+
  .019*longitudinal*placeOpen;
 // No horizontal aim rotation or sideways tilt during shooting. Pitch
 // remains available for purely cosmetic firing kick and footstep motion.
 out.rx=.19*config.recoil*recoil+.052*run+
  .023*step*gait*placeOpen+.012*lookVertical*placeOpen+
  config.showPitch*tilted+.075*slideEnergy*placeOpen;
 out.ry=(config.showYaw*tilted+
  .014*otherStep*gait+.055*lookSide+.032*lateral)*rotationOpen;
 out.rz=(config.showRoll*tilted+
  .060*step*gait+.095*lateral+.042*lookSide+
  .055*run-.038*crouchEnergy+.085*slideEnergy-.17*swap)*rotationOpen;
 out.bodyY=Math.min(.026,.015*config.recoil*recoil);
 out.bodyZ=Math.min(.04,.13*config.back*recoil);
 out.bodyRx=-.10*config.recoil*recoil;
 out.slideAction=id===2?recoil*.085:0;
 out.boltAction=id!==2?Math.min(.04,recoil*(id===1?.034:.026)):0;
 return out;
}
export function animateWeapon(root,{time=0,ads=0,reload=0,kick=0,moving=false,
 slide=0,crouch=0,motion=true,switched=0,speed=0,sprint=false,firing=false,
 strafe=0,forwardSpeed=0,lookX=0,lookY=0,grounded=true,landing=0}){
 const d=root.userData,id=d.id;
 // Reuse the pose buffer; animations run every frame, even on weak GPUs.
 const pose=d.motionPose22||(d.motionPose22={});
 const clip=d.reloadPose23||(d.reloadPose23={});
 // Blend discrete locomotion flags without ever shifting the ADS reticle.
 const state=d.carryState22||(d.carryState22={time,sprint:0,crouch:0,slide:0,
  forward:0,stepPhase:0,stepStrength:0,strafe:0,forwardSpeed:0,
  lookX:0,lookY:0});
 const dt=Math.max(0,Math.min(.10,time-state.time));state.time=time;
 const blend=1-Math.exp(-dt*15);
 state.sprint+=(Number(!!sprint)-state.sprint)*blend;
 state.crouch+=(clamp22(crouch)-state.crouch)*blend;
 state.slide+=(clamp22(slide)-state.slide)*blend;
 const focusTarget=Math.max(Number(!!firing),reload>0?.97:0);
 state.forward+=(focusTarget-state.forward)*Math.min(1,dt*24);
 // Movement state is smoothed independently of animation frame rate.
 const mobility=motion&&grounded?clamp22(speed/5.0):0;
 state.stepStrength+=(mobility-state.stepStrength)*Math.min(1,dt*11);
 if(mobility>.04)state.stepPhase+=dt*(5.1+Math.min(13,speed)*1.14);
 const sidestep=motion?signed22(strafe):0;
 const advancing=motion?signed22(forwardSpeed):0;
 state.strafe+=(sidestep-state.strafe)*Math.min(1,dt*12);
 state.forwardSpeed+=(advancing-state.forwardSpeed)*Math.min(1,dt*10);
 state.lookX+=(signed22(lookX)-state.lookX)*Math.min(1,dt*13);
 state.lookY+=(signed22(lookY)-state.lookY)*Math.min(1,dt*13);
 motionPose22(pose,{id,time,ads,reload,kick,slide:state.slide,crouch:state.crouch,
  motion,switched,speed:Math.max(speed,moving?.8:0),sprint:state.sprint,
  forward:state.forward,stepPhase:state.stepPhase,
  stepStrength:state.stepStrength,strafe:state.strafe,
  forwardSpeed:state.forwardSpeed,lookX:state.lookX,lookY:state.lookY,
  grounded,landing});
 sampleReloadPose23(clip,id,reload);
 // Compose the movement pose and normalized reload clip; visuals never change
 // the server's weapon state, aim angles or reload duration.
 root.position.set(pose.x+clip.x,pose.y+clip.y,pose.z+clip.z);
 root.rotation.set(pose.rx+clip.rx,pose.ry+clip.ry,pose.rz+clip.rz);
 // The display meshes have a small built-in showroom yaw. Cancel it during
 // firing/aiming so the *whole model* faces forward; reload choreography
 // may still move independently after this orientation correction.
 if(d.aetherArtGun71){
  const facing=Math.max(smooth22(clamp22(ads)),smooth22(state.forward));
  d.aetherArtGun71.rotation.y=d.aetherDefaultYaw71*(1-facing);
 }
 d.model.position.set(0,pose.bodyY,pose.bodyZ);
 d.model.rotation.set(pose.bodyRx,0,0);
 d.magazine.position.set(clip.magX,-.1+clip.magY,-.035+clip.magZ);
 d.magazine.rotation.set(clip.magRX,0,clip.magRZ);
 d.left.position.set(clip.handX,clip.handY,clip.handZ);
 d.left.rotation.set(-pose.bodyRx*.55+clip.handRX,0,clip.handRZ);
 // The left hand visibly reaches, opens, holds and lets go of the abstract
 // AETHER energy module. Right hand adds a separate complementary gesture.
 if(d.hands72){
  const {left:lh,right:rh,palmGlow}=d.hands72;
  const open=clip.handOpen||0,curl=clip.fingerCurl||0;
  lh.hand.position.set(lh.base.x+.024*(clip.handReach||0),
   lh.base.y-.038*(clip.handReach||0),lh.base.z-.074*(clip.handReach||0));
  lh.hand.rotation.set(-.12*open,(clip.handTwist||0)*.48,
   (clip.handTwist||0)*.72);
  for(let i=0;i<lh.fingers.length;i++)
   lh.fingers[i].rotation.x=-.41*open+.75*curl+(i-1)*.07*curl;
  lh.thumb.rotation.set(.17*open,.18*(clip.handTwist||0),
   -.22*curl);
  d.right.position.set(clip.rightReach||0,-(clip.rightDip||0),
   -.032*(clip.armGesture||0));
  d.right.rotation.set(-.14*(clip.rightReach||0),0,clip.rightTurn||0);
  rh.hand.rotation.set(-.14*(clip.rightReach||0),-.22*(clip.rightTurn||0),
   .34*(clip.rightTurn||0));
  rh.fingers.forEach((finger,i)=>{
   finger.rotation.x=-.19*(clip.handOpen||0)+
    .50*(clip.fingerCurl||0)*(i===1?1:.83);
  });
  rh.thumb.rotation.z=-.12*(clip.fingerCurl||0);
  const energy=clip.handGlow||0;
  lh.marker.visible=energy>.04;rh.marker.visible=energy>.19;
  if(energy>.04){
   const brightness=.30+.68*energy;
   palmGlow.opacity=brightness;
   const scale=.80+.62*energy;
   lh.marker.scale.setScalar(scale);rh.marker.scale.setScalar(scale*.8);
  }
 }
 const a=d.action;
 if(a?.bolt){
  if(!Number.isFinite(a.bolt.userData.homeZ22))a.bolt.userData.homeZ22=a.bolt.position.z;
  a.bolt.position.z=a.bolt.userData.homeZ22+pose.boltAction+clip.actionZ;
 }
 if(a?.pump)a.pump.position.z=-pose.slideAction+clip.actionZ;
 // Light-up glyph tracks the visual animation only, without gameplay effects.
 if(d.reloadGlyph70){
  d.reloadGlyph70.visible=clip.signal>.02;
  if(d.reloadGlyph70.visible){
   const pulse=clip.signal;
   d.reloadGlyph70.scale.setScalar(.87+.46*pulse);
   d.reloadGlyph70.rotation.z=time*3.0;
   d.reloadGlyph70.material.opacity=.20+.56*pulse;
  }
 }
 // ADS alignment: precisely center the actual 3D optic against the view
 // camera's -Z line. Fade in with ADS to leave the hip-fire pose intact.
 // Reuses one Vector3 buffer; visual only, never alters server hit direction.
 const aim=smooth22(clamp22(ads));
 if(aim>.0001&&d.adsAnchor){
  const sight=d.adsAnchor.getWorldPosition(d.adsWorld22||(d.adsWorld22=new T.Vector3()));
  root.position.x-=sight.x*aim;
  root.position.y-=sight.y*aim;
 }
}
export function makePlayer(name,color=0xd38165,weaponId=0,weaponFinish=0,lobbyOnly=false){
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
 const gun=lobbyOnly?new T.Group():makeWeapon(weaponId,false,weaponFinish);gun.scale.setScalar(.8);
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
// Reuses the exact match avatar body, helmet, and outfit colors without
// constructing costly AETHER weapons for the pre-match lineup.
export function makeLobbyAvatar(name,color){
 const avatar=makePlayer(name,color,0,0,true);
 avatar.userData.tag.visible=false;
 avatar.userData.spawnRing.visible=false;
 avatar.userData.impact.visible=false;
 avatar.userData.gun.visible=false;
 avatar.userData.lobbyOnly=true;
 setModelQuality67(avatar,'performance');
 return avatar;
}
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
 disposeAetherMaterials(root?.userData?.gun);
 root.traverse(o=>{
  o.geometry?.dispose();
  if(o.isSprite){o.material.map?.dispose();o.material.dispose();}
  else if(o.userData.uniqueMaterial)o.material.dispose();
 });
 root.removeFromParent();
}
