import {confirmedHit} from './combat32.js';

// Phase 5.2 — visual/UX feedback only. Never infer a hit from client shots.
// The authoritative server's 'hit' and 'kill' events drive confirmation.
export const FEEDBACK52={hitSeconds:.28,killSeconds:1.8,stackWindow:.115,hitPulse:.21,maxTracers:36};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export function makeCombatFeedback52(){
 let until=-1,at=-1,damage=0,head=false,killed=false,hits=0;
 function confirm(event,myId,now){
  const hit=confirmedHit(event,myId);
  if(!hit||!Number.isFinite(now))return null;
  const stack=now-at<=FEEDBACK52.stackWindow&&now>=at;
  damage=stack?damage+hit.damage:hit.damage;
  hits=stack?hits+1:1;
  head=(stack&&head)||hit.head;
  killed=(stack&&killed)||hit.killed;
  at=now;until=now+FEEDBACK52.hitSeconds;
  return {damage,head,killed,hits,at,until};
 }
 function sample(now){
  const remaining=Math.max(0,until-(Number.isFinite(now)?now:Infinity));
  const strength=clamp(remaining/FEEDBACK52.hitSeconds,0,1);
  return {active:strength>0,strength,scale:1+strength*.3,damage,head,killed,hits,
   alpha:Math.min(1,strength*2.2)};
 }
 function reset(){until=-1;at=-1;damage=0;head=false;killed=false;hits=0;}
 return {confirm,sample,reset};
}
export function crosshairSpread52({speed=0,grounded=true,crouch=false,aim=0,recoil=0,sprint=false,weapon=0}={}){
 const v=clamp(speed,0,16),a=clamp(aim,0,1),r=clamp(recoil,0,1);
 const weaponBias=[0,2,5,1][Math.max(0,Math.min(3,Math.floor(Number(weapon)||0)))];
 const movement=v*(grounded?.8:1.1);
 const air=grounded?0:7;
 const crouchBonus=crouch?3:0;
 const sprintBonus=sprint&&v>5?6:0;
 const open=clamp(24+weaponBias+movement+air+sprintBonus+r*115-crouchBonus,19,58);
 return Math.round((open*(1-a*.2))*10)/10;
}
export function tracerCount52(quality,endsLength){
 const n=Math.max(0,Math.floor(Number(endsLength)||0));
 const limit=quality==='performance'?2:quality==='auto'?4:quality==='ultra'?10:6;
 if(n<=limit)return Array.from({length:n},(_,i)=>i);
 if(limit===1)return [0];
 const picked=new Set();
 for(let i=0;i<limit;i++)picked.add(Math.min(n-1,Math.round(i*(n-1)/(limit-1))));
 return [...picked].sort((a,b)=>a-b);
}
export function recoilFeel52(weaponId,aim){
 const base=[1.0,.63,1.55,1.35][Math.max(0,Math.min(3,weaponId|0))];
 return {flashScale:base*(1-clamp(aim,0,1)*.17),shakeScale:(1-clamp(aim,0,1)*.38)};
}
