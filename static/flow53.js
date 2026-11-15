// CROSSFIRE 05.3 — lightweight visual movement cues.
// No gameplay state changes; the Python server controls the actual movement.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
export function movementCue53(player={},input={},now=0,slideHopUntil=0){
 const speed=Math.hypot(player.vx||0,player.vz||0);
 if(player.mantle)return 'VAULTING';
 if(now<slideHopUntil&&!player.grounded)return 'SLIDE HOP';
 if(player.slide_until>player.motion_time)return 'SLIDING';
 if(!player.grounded)return player.wall_kick_used?'WALL KICK':'AIRBORNE';
 if(player.crouch)return 'CROUCHING';
 if(input.sprint&&speed>5)return 'SPRINTING';
 if(speed>.5)return 'MOVING';
 return 'READY';
}
export function cameraFeel53(player={},yaw=0,{motion=true,aim=0}={}){
 if(!motion)return {roll:0,fovBoost:0,vaultDip:0};
 const vx=Number.isFinite(player.vx)?player.vx:0;
 const vz=Number.isFinite(player.vz)?player.vz:0;
 const speed=Math.hypot(vx,vz);
 const strafe=vx*Math.cos(yaw)-vz*Math.sin(yaw);
 const roll=(player.crouch?-.025:0)-clamp(strafe/8,-1,1)*.011;
 // Do not alter zoom optics: only modestly widen the world on a fast run.
 const fovBoost=clamp((speed-6)*.75,0,2.3)*(1-clamp(aim,0,1));
 const vaultDip=player.mantle?-.04:0;
 return {roll,fovBoost,vaultDip};
}
