/** CROSSFIRE Operator 03 — cosmetics only, not a collision or team authority. */
export const OPERATOR03_SKINS=Object.freeze([
 {id:'woodland',label:'Woodland'},
 {id:'desert',label:'Desert'},
 {id:'urban',label:'Urban'},
 {id:'arctic',label:'Arctic / White'},
 {id:'jungle',label:'Jungle'},
 {id:'navy_digital',label:'Navy Digital'},
 {id:'ranger',label:'Ranger'},
 {id:'shadow',label:'Shadow / Black'}
].map(x=>Object.freeze(x)));
export const OPERATOR03_TEAM_SKINS=Object.freeze({azure:'arctic',ember:'shadow'});
export const OPERATOR03_DEFAULT='woodland';
export function operator03Skin(value){
 return OPERATOR03_SKINS.some(s=>s.id===value)?value:OPERATOR03_DEFAULT;
}
export function operator03EffectiveSkin(choice,mode,team){
 if(mode==='teamdeathmatch'||mode==='control')
  return OPERATOR03_TEAM_SKINS[team]||operator03Skin(choice);
 return operator03Skin(choice);
}
export function operator03Color(skin){
 return ({woodland:0x6a7855,desert:0xc6b28b,urban:0x626875,arctic:0xe9edf2,
          jungle:0x4f7350,navy_digital:0x536c8e,ranger:0x8b8867,shadow:0x33383f})[operator03Skin(skin)];
}
