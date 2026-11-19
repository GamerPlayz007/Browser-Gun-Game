/* Octavus 2.5: retain source triangles that overlap the compact arena.
 * Visual-only selection: collision, UV order, and the original OBJ are untouched.
 * Pure helpers so we can test visibility without WebGL or map downloads.
 */
export function octavusRenderBounds(playBounds,margin=10){
 if(!playBounds)return null;
 const {x0,x1,z0,z1}=playBounds;
 if(![x0,x1,z0,z1,margin].every(Number.isFinite)||x0>=x1||z0>=z1||margin<0)
  throw Error('Invalid Octavus render bounds');
 return {x0:x0-margin,x1:x1+margin,z0:z0-margin,z1:z1+margin};
}
export function octavusTriangleVisible(points,i0,i1,i2,scale,bounds){
 if(!bounds)return true;
 const ax=points[i0*3]*scale,az=points[i0*3+2]*scale;
 const bx=points[i1*3]*scale,bz=points[i1*3+2]*scale;
 const cx=points[i2*3]*scale,cz=points[i2*3+2]*scale;
 // Keep triangles crossing the border, not just ones with interior vertices.
 return Math.max(ax,bx,cx)>=bounds.x0&&Math.min(ax,bx,cx)<=bounds.x1&&
        Math.max(az,bz,cz)>=bounds.z0&&Math.min(az,bz,cz)<=bounds.z1;
}
