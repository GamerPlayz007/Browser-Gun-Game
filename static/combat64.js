/** Daybreak 6.4: health display and weapon cycling. Server owns HP and ammo. */
export const MAX_HEALTH64=200;
export function healthPercent64(hp,maxHp=MAX_HEALTH64){
 if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0)return 0;
 return Math.max(0,Math.min(100,hp/maxHp*100));
}
export function wheelWeapon64(current,delta,count){
 if(!Number.isFinite(delta)||delta===0||!Number.isInteger(count)||count<1)return current;
 const index=Number.isInteger(current)?((current%count)+count)%count:0;
 return (index+(delta>0?1:count-1))%count;
}
export function healthStatus64(p,maxHp=MAX_HEALTH64){
 if(!p||p.hp<=0)return '';
 if(p.shield>0)return '/ PROTECTED';
 if(p.hp>=maxHp)return '';
 return p.regenDelay>0?'/ REGEN '+p.regenDelay.toFixed(1)+'s':'/ REGENERATING';
}
