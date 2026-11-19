/* Octavus Stage 2.6: pure placement/LOD checks for source mapmodel batches.
 * The original MPZ transforms and OBJ geometry are unchanged.
 */
export const OCTAVUS_PROP_CAPS=Object.freeze({
 performance:110,auto:160,high:215,ultra:320,native:320
});
export function octavusPropInside(sourcePosition,playBounds,margin=6){
 if(!playBounds)return true;
 if(!Array.isArray(sourcePosition)||sourcePosition.length<2)return false;
 const x=(sourcePosition[0]-4096)*.05;
 const z=(sourcePosition[1]-4096)*.05;
 return Number.isFinite(x)&&Number.isFinite(z)&&
  x>=playBounds.x0-margin&&x<=playBounds.x1+margin&&
  z>=playBounds.z0-margin&&z<=playBounds.z1+margin;
}
export function octavusPropVisible(x,z,playerX,playerZ,tier,alias=''){
 const cap=OCTAVUS_PROP_CAPS[tier]||OCTAVUS_PROP_CAPS.auto;
 const radius=tier==='performance'&&/weed/i.test(alias)?cap*.58:cap;
 const dx=x-playerX,dz=z-playerZ;
 return dx*dx+dz*dz<radius*radius;
}
