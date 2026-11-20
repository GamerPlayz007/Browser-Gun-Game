/**
 * CROSSFire 07.0 — cinematic AETHER reload choreography.
 * Purely fictional, stylized, non-functional visual motions.
 * Time-normalized to the existing authoritative server reload timer:
 * no ammunition, firing, collision, or gameplay mechanics are modified.
 */
const clamp23=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
const ease23=v=>{v=clamp23(v);return v*v*(3-2*v);};
const up23=(p,a,b)=>ease23((p-a)/(b-a));
const hold23=(p,a,b,c,d)=>up23(p,a,b)*(1-up23(p,c,d));
const pulse23=(p,a,b,c)=>up23(p,a,b)*(1-up23(p,b,c));
function writePose23(out,x=0,y=0,z=0,rx=0,ry=0,rz=0,
 mx=0,my=0,mz=0,mrx=0,mrz=0,hx=0,hy=0,hz=0,hrx=0,hrz=0,action=0,signal=0){
 out.x=x;out.y=y;out.z=z;out.rx=rx;out.ry=ry;out.rz=rz;
 out.magX=mx;out.magY=my;out.magZ=mz;out.magRX=mrx;out.magRZ=mrz;
 out.handX=hx;out.handY=hy;out.handZ=hz;
 out.handRX=hrx;out.handRZ=hrz;out.actionZ=action;
 out.signal=signal;
 return out;
}
export function sampleReloadPose23(out,id,remaining){
 const p=remaining>0?1-clamp23(remaining):-1;
 if(p<0)return writePose23(out);
 // Four readable phases: presentation, colorful sci-fi energy exchange,
 // return to the centered view, and a brief finish flash.
 const present=hold23(p,.015,.14,.77,.97);
 const shift=hold23(p,.11,.28,.54,.80);
 const flourish=pulse23(p,.59,.76,.96);
 const signal=hold23(p,.16,.32,.71,.95);
 if(id===0){
  // AETHER-9: large central choreography and broad energy pack sweep.
  return writePose23(out,.060*present,-.153*present,.104*present,
   .135*present,.012*present,-.105*present,
   .260*shift,-.520*shift,.160*shift,-.36*shift,.26*shift,
   .205*shift,-.272*shift,.095*shift,-.25*shift,.19*shift,
   .09*flourish,signal);
 }
 if(id===1){
  // AETHER-S9: compact, fast-looking side sweep and snappy re-center.
  return writePose23(out,-.035*present,-.132*present,.085*present,
   .115*present,-.010*present,.100*present,
   -.270*shift,-.495*shift,.170*shift,.28*shift,-.30*shift,
   -.188*shift,-.265*shift,.120*shift,.30*shift,-.22*shift,
   .125*flourish,signal);
 }
 if(id===2){
  // Wardrum: fictional energized fore-end sweep, no detachable magazine.
  const stageOne=pulse23(p,.16,.32,.55);
  const stageTwo=pulse23(p,.48,.65,.87);
  const cascade=Math.max(stageOne,stageTwo);
  return writePose23(out,.045*present,-.172*present,.125*present,
   .170*present,0,-.105*present,
   0,0,0,0,0,
   -.130*present,-.270*present,-.185*cascade,-.28*present,-.13*present,
   -.275*cascade,Math.max(signal,cascade));
 }
 // LONGWATCH: long ceremonial energy pack arc, then a bright reset beat.
 return writePose23(out,.045*present,-.165*present,.145*present,
   .165*present,.018*present,-.105*present,
   -.240*shift,-.520*shift,.165*shift,-.34*shift,.21*shift,
   -.188*shift,-.290*shift,.078*shift,-.31*shift,.13*shift,
   .135*flourish,signal);
}
