/** Daybreak 6.5 — read-only UI helpers. No gameplay authority here. */
export const ROOM_CODES65=Object.freeze(['MAX','ACE','FOX','RED','SKY','NEO','ZEN','PRO','WOLF','NOVA','ECHO','LIME']);
export function validRoom65(value){
 return typeof value==='string'&&ROOM_CODES65.includes(value.toUpperCase());
}
export function kd65(kills,deaths){
 const k=Math.max(0,Number(kills)||0),d=Math.max(0,Number(deaths)||0);
 return (k/Math.max(1,d)).toFixed(2);
}
export function radarType65(p,opts={}){
 if(!p||p.id===opts.meId||!(p.hp>0)||!Number.isFinite(p.x)||!Number.isFinite(p.z))return null;
 if(opts.mode==='botmatch')return p.bot?'enemy':'ally';
 if((opts.team==='azure'||opts.team==='ember')&&p.team===opts.team)return 'ally';
 return 'enemy';
}
export function roomLabel65(room){
 if(!room)return 'UNKNOWN';
 const text=room.active?room.players+'/'+room.max+' players':'EMPTY';
 return room.code+' · '+text;
}
