/** CROSSFIRE 3.0 release candidate — safe optional local preferences and
 * purely cosmetic avatar colors. No advantage, scores, or gameplay effects.
 */
export const SKINS56=Object.freeze([
 Object.freeze({id:0,name:'EMBER',hex:0xd38165}),
 Object.freeze({id:1,name:'GLACIER',hex:0x54b2ba}),
 Object.freeze({id:2,name:'GOLDEN',hex:0xc5a65f}),
 Object.freeze({id:3,name:'NOVA',hex:0x9f8cd4})
]);
export function skinId56(raw){
 const n=Number(raw);
 return raw!==null&&raw!==undefined&&String(raw).trim()!==''&&
  Number.isInteger(n)&&n>=0&&n<SKINS56.length?n:0;
}
export function skinColor56(raw){return SKINS56[skinId56(raw)].hex;}
export function safeRead56(key,fallback=''){
 try{return localStorage.getItem(key)??fallback;}catch{return fallback;}
}
export function safeWrite56(key,value){
 try{localStorage.setItem(key,String(value));return true;}catch{return false;}
}
export function safeName56(raw){return String(raw||'').trim().slice(0,16)||'Player';}
export function safeQuality56(raw){
 return ['auto','performance','high','ultra','native'].includes(raw)?raw:'auto';
}
