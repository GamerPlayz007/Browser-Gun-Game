/**
 * CROSSFIRE Stage 2.3 — stylized reload clips.
 * Purely visual, deterministic and time-normalized to the existing server reload.
 * Outputs a reusable pose object; no ammo accounting or weapon mechanics.
 */
const clamp23=v=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
const ease23=v=>{v=clamp23(v);return v*v*(3-2*v);};
const up23=(p,a,b)=>ease23((p-a)/(b-a));
const hold23=(p,a,b,c,d)=>up23(p,a,b)*(1-up23(p,c,d));
const pulse23=(p,a,b,c)=>up23(p,a,b)*(1-up23(p,b,c));
export function sampleReloadPose23(out,id,remaining){
 const p=remaining>0?1-clamp23(remaining):-1;
 const active=p>=0;
 const set=(x=0,y=0,z=0,rx=0,ry=0,rz=0,
   mx=0,my=0,mz=0,mrx=0,mrz=0,hx=0,hy=0,hz=0,hrx=0,hrz=0,action=0)=>{
  out.x=x;out.y=y;out.z=z;out.rx=rx;out.ry=ry;out.rz=rz;
  out.magX=mx;out.magY=my;out.magZ=mz;out.magRX=mrx;out.magRZ=mrz;
  out.handX=hx;out.handY=hy;out.handZ=hz;
  out.handRX=hrx;out.handRZ=hrz;out.actionZ=action;return out;
 };
 if(!active)return set();
 const settle=hold23(p,.02,.16,.84,.99);
 if(id===0){
  // Rifle: broad presentation dip, arcing reload prop, support arm follows.
  const arc=hold23(p,.14,.33,.52,.76),catchUp=pulse23(p,.67,.78,.94);
  return set(-.025*settle,-.065*settle,.024*settle,
    .105*settle,.028*settle,-.18*settle,
    -.115*arc,-.28*arc,.045*arc,-.18*arc,.23*arc,
    -.07*arc,-.13*arc,.025*arc,-.19*arc,.12*arc,
    .038*catchUp);
 }
 if(id===1){
  // Compact SMG: faster, shorter reload arc and a brief finishing motion.
  const arc=hold23(p,.08,.22,.40,.62),finish=pulse23(p,.58,.72,.87);
  return set(.012*settle,-.045*settle,.015*settle,
    .07*settle,-.04*settle,.14*settle,
    .09*arc,-.235*arc,.06*arc,.15*arc,-.18*arc,
    .065*arc,-.11*arc,.045*arc,.17*arc,-.10*arc,
    .027*finish);
 }
 if(id===2){
  // Shotgun: no detachable magazine animation. A deliberate, rolling
  // support-hand motion and abstract in-game fore-end cycle.
  const wind=hold23(p,.07,.24,.75,.96);
  const stageA=pulse23(p,.18,.31,.48),stageB=pulse23(p,.48,.62,.80);
  const cycle=Math.max(stageA,stageB);
  return set(-.022*wind,-.09*wind,.045*wind,
    .16*wind,.02*wind,-.24*wind,
    0,0,0,0,0,
    -.045*wind,-.12*wind,-.07*cycle,-.28*wind,-.10*wind,
    -.11*cycle);
 }
 // Sniper: deliberate long arc, softer hand motion and a final receiver tick.
 const arc=hold23(p,.20,.39,.55,.78),finish=pulse23(p,.74,.86,.97);
 return set(-.045*settle,-.075*settle,.032*settle,
   .14*settle,.065*settle,-.17*settle,
   -.085*arc,-.18*arc,.04*arc,-.18*arc,.13*arc,
   -.055*arc,-.095*arc,.015*arc,-.15*arc,.07*arc,
   .045*finish);
}
