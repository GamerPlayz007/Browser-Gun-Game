/** CROSSFIRE Stage 3.4 — procedural avatar pose & short nonviolent feedback.
 * Pure simulation of animation state (no geometry, no network authority).
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const pulse=(time,at,duration)=>{
 const age=time-at;
 return age<0||age>=duration?0:Math.sin((1-age/duration)*Math.PI/2);
};
export function makeAvatarAnim(){
 return {lastGrounded:null,spawn:undefined,spawnAt:-Infinity,shotAt:-Infinity,
   hitAt:-Infinity,landAt:-Infinity,phase:0};
}
export function markAvatar(anim,type,time){
 if(!Number.isFinite(time))return;
 if(type==='shot')anim.shotAt=time;
 if(type==='hit')anim.hitAt=time;
 if(type==='spawn')anim.spawnAt=time;
 if(type==='land')anim.landAt=time;
}
export function trackAvatar(anim,p,time){
 if(!anim||!p||!Number.isFinite(time))return;
 if(anim.spawn!==p.spawn){
  anim.spawn=p.spawn;anim.lastGrounded=!!p.grounded;anim.phase=0;
  anim.spawnAt=time;anim.landAt=anim.shotAt=anim.hitAt=-Infinity;
  return;
 }
 if(anim.lastGrounded===false&&p.grounded)markAvatar(anim,'land',time);
 anim.lastGrounded=!!p.grounded;
}
/** All output angles in radians; active states are derived from server movement. */
export function avatarPose(p={},time=0,anim=makeAvatarAnim()){
 const vx=finite(p.vx),vz=finite(p.vz),vy=finite(p.vy),
       yaw=finite(p.yaw),pitch=finite(p.pitch);
 const speed=Math.min(12,Math.hypot(vx,vz)),grounded=p.grounded!==false,
       crouch=!!p.crouch,slide=grounded&&crouch&&finite(p.slide)>0&&speed>2.8;
 const run=grounded&&!crouch&&speed>=6,walk=grounded&&!crouch&&speed>.25&&!run;
 const state=!grounded?'air':slide?'slide':crouch?'crouch':run?'run':walk?'walk':'idle';
 const effort=clamp(speed/8,0,1);
 const stride=time*(7+speed*.73)+finite(anim.phase);
 const wave=Math.sin(stride),bounce=Math.abs(Math.sin(stride));
 const strafe=vx*Math.cos(yaw)-vz*Math.sin(yaw);
 const weight=(state==='run'?.68:state==='walk'?.44:state==='crouch'?.22:0)*effort;
 const landing=pulse(time,anim.landAt,.27);
 const shot=pulse(time,anim.shotAt,.14);
 const hit=pulse(time,anim.hitAt,.32);
 const spawn=clamp((time-anim.spawnAt)/.65,0,1);
 return {
  state,speed,grounded,
  bodyY:(crouch?-.52:0)+(grounded?bounce*weight*.06:0)-landing*.07,
  torsoPitch:slide?.36:state==='run'?.12:state==='air'?-.055:crouch?.12:0,
  torsoRoll:clamp(-strafe*.026,-.16,.16)+(hit*.08),
  legSwing:grounded&&!slide?wave*weight:0,
  kneeBend:slide?-.72:state==='air'?-.29:crouch?-.42:0,
  armSwing:grounded&&!slide?wave*weight*.64:0,
  armBrace:slide?-.6:state==='air'?-.35:crouch?-.12:0,
  headPitch:clamp(pitch*.38,-.45,.45),
  gunKick:shot*.22,
  hitGlow:hit,
  landing,spawnPulse:spawn>=0&&spawn<1?(1-spawn):0,
  visibilityScale:spawn>=0&&spawn<1?.93+spawn*.07:1,
  tagY:crouch?1.56:2.12
 };
}
export function feedbackGain(anim,time){
 return {
  shot:pulse(time,anim.shotAt,.14),
  hit:pulse(time,anim.hitAt,.32),
  land:pulse(time,anim.landAt,.27)
 };
}
