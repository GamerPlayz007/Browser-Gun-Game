/** CROSSFIRE 3.0 release candidate — safe optional local preferences and
 * purely cosmetic avatar colors. No advantage, scores, or gameplay effects.
 */
export const SKINS56=Object.freeze([
 Object.freeze({id:0,name:'EMBER',hex:0xff963c}),
 Object.freeze({id:1,name:'GLACIER',hex:0x31d7e3}),
 Object.freeze({id:2,name:'GOLDEN',hex:0xf3d94e}),
 Object.freeze({id:3,name:'NOVA',hex:0xb179f6}),
 Object.freeze({id:4,name:'LIME',hex:0x86e84e}),
 Object.freeze({id:5,name:'ROSE',hex:0xee78c2}),
 Object.freeze({id:6,name:'COBALT',hex:0x5a88f4}),
 Object.freeze({id:7,name:'SCARLET',hex:0xed4e5c})
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
