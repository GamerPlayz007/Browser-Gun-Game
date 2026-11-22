/**
 * CROSSFire / AETHER reload choreography v7.2.
 * Stylized sci-fi hand gestures, floating energy-cell visuals and celebratory
 * return-to-idle. Animation only: server reload time and combat untouched.
 */
const clamp23=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
const ease23=v=>{v=clamp23(v);return v*v*(3-2*v)};
const up23=(p,a,b)=>ease23((p-a)/(b-a));
const hold23=(p,a,b,c,d)=>up23(p,a,b)*(1-up23(p,c,d));
const pulse23=(p,a,b,c)=>up23(p,a,b)*(1-up23(p,b,c));
function writePose23(out,x=0,y=0,z=0,rx=0,ry=0,rz=0,
 mx=0,my=0,mz=0,mrx=0,mrz=0,hx=0,hy=0,hz=0,hrx=0,hrz=0,
 action=0,signal=0){
 out.x=x;out.y=y;out.z=z;out.rx=rx;out.ry=ry;out.rz=rz;
 out.magX=mx;out.magY=my;out.magZ=mz;
 out.magRX=mrx;out.magRZ=mrz;
 out.handX=hx;out.handY=hy;out.handZ=hz;
 out.handRX=hrx;out.handRZ=hrz;
 out.actionZ=action;out.signal=signal;
 return out;
}
function decorateHands23(out,id,p){
 if(p<0){
  out.handOpen=0;out.handTwist=0;out.handReach=0;out.handGlow=0;
  out.rightReach=0;out.rightTurn=0;out.rightDip=0;
  out.fingerCurl=0;out.armGesture=0;
  return out;
 }
 // Shared visual beats: arm arrival, interaction with the fictional energy
 // module, a highlighted exchange, and a controlled finish pose.
 const arrival=hold23(p,.015,.15,.76,.96);
 const interact=hold23(p,.16,.29,.55,.77);
 const release=pulse23(p,.56,.71,.93);
 const settle=pulse23(p,.72,.84,.98);
 const glow=hold23(p,.23,.33,.73,.90);
 const patterns=[
  // AR: broad two-hand reach, a deliberate energy-transfer beat.
  {open:.82,twist:-.56,reach:.22,right:.115,turn:-.26,dip:.082,curl:.80,arc:.19},
  // SMG: quicker, more playful hand swing and snap.
  {open:.91,twist:.68,reach:.26,right:.13,turn:.32,dip:.045,curl:.91,arc:.28},
  // Shotgun: heavy dual-hand sweep around the energized fore-end.
  {open:.58,twist:-.36,reach:.31,right:.092,turn:.26,dip:.11,curl:.67,arc:.34},
  // Sniper: measured, graceful recharge gesture around its glowing core.
  {open:.73,twist:.48,reach:.20,right:.16,turn:-.42,dip:.088,curl:.73,arc:.24}
 ][id]||{open:.7,twist:0,reach:.2,right:.1,turn:0,dip:.05,curl:.7,arc:.2};
 out.handOpen=patterns.open*arrival*(1-interact*.83)+.20*release;
 out.handTwist=patterns.twist*interact+.18*settle;
 out.handReach=patterns.reach*interact+.05*release;
 out.handGlow=glow;
 out.rightReach=patterns.right*interact+.038*release;
 out.rightTurn=patterns.turn*interact+.13*settle;
 out.rightDip=patterns.dip*arrival;
 out.fingerCurl=patterns.curl*interact+.25*release;
 out.armGesture=patterns.arc*interact+.10*settle;
 return out;
}
export function sampleReloadPose23(out,id,remaining){
 const p=remaining>0?1-clamp23(remaining):-1;
 if(p<0)return decorateHands23(writePose23(out),id,p);
 const present=hold23(p,.015,.14,.77,.97);
 const shift=hold23(p,.11,.28,.54,.80);
 const flourish=pulse23(p,.59,.76,.96);
 const signal=hold23(p,.16,.32,.71,.95);
 if(id===0){
  writePose23(out,.060*present,-.153*present,.104*present,
   .135*present,.012*present,-.105*present,
   .260*shift,-.520*shift,.160*shift,-.36*shift,.26*shift,
   .205*shift,-.272*shift,.095*shift,-.25*shift,.19*shift,
   .09*flourish,signal);
 }else if(id===1){
  writePose23(out,-.035*present,-.132*present,.085*present,
   .115*present,-.010*present,.100*present,
   -.270*shift,-.495*shift,.170*shift,.28*shift,-.30*shift,
   -.188*shift,-.265*shift,.120*shift,.30*shift,-.22*shift,
   .125*flourish,signal);
 }else if(id===2){
  const stageOne=pulse23(p,.16,.32,.55);
  const stageTwo=pulse23(p,.48,.65,.87);
  const cascade=Math.max(stageOne,stageTwo);
  writePose23(out,.045*present,-.172*present,.125*present,
   .170*present,0,-.105*present,
   0,0,0,0,0,
   -.130*present,-.270*present,-.185*cascade,-.28*present,-.13*present,
   -.275*cascade,Math.max(signal,cascade));
 }else{
  writePose23(out,.045*present,-.165*present,.145*present,
   .165*present,.018*present,-.105*present,
   -.240*shift,-.520*shift,.165*shift,-.34*shift,.21*shift,
   -.188*shift,-.290*shift,.078*shift,-.31*shift,.13*shift,
   .135*flourish,signal);
 }
 return decorateHands23(out,id,p);
}
