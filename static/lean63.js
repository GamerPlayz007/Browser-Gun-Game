/** DAYBREAK 6.3. Horizontal first-person leaning with wall clearance.
 * Identical collision sampling is performed by movement_live.py on the server.
 */
import {nearbyBoxes} from './spatial.js';
export const LEAN_DISTANCE63=.52;
export function leanOffset63(yaw,lean){
 const f=Number.isFinite(lean)?Math.max(-1,Math.min(1,lean)):0;
 return {x:Math.cos(yaw)*LEAN_DISTANCE63*f,z:-Math.sin(yaw)*LEAN_DISTANCE63*f};
}
export function allowedLean63(p,input,boxes){
 const direction=Number(!!input.leanRight)-Number(!!input.leanLeft);
 if(!direction||!Number.isFinite(p.yaw))return 0;
 const eye=p.y+(p.crouch?.9:1.55);
 const local=nearbyBoxes(boxes,p.x,p.z,1.5);
 const delta=leanOffset63(p.yaw,direction);
 let accepted=0;
 for(let i=1;i<=8;i++){
  const t=i/8,x=p.x+delta.x*t,z=p.z+delta.z*t;
  if(local.some(b=>Math.abs(x-b.x)<b.w/2+.09&&Math.abs(z-b.z)<b.d/2+.09
   &&eye+.12>b.y&&eye-.12<b.y+b.h))break;
  accepted=t;
 }
 return direction*accepted;
}
