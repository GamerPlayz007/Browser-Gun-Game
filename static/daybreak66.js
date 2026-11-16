/** Daybreak 6.6: clear blue daytime sky, one background mesh and no collisions.
 * A cheap gradient shader avoids cubemap downloads and remains free on School.
 */
export const DAYBREAK_SKY66=Object.freeze({
 zenith:'#65afe1',horizon:'#d6e8f3',low:'#edf0e5',sun:'#fff1d8',
 fog:'#cbdce8',clear:true
});
export function createDaybreakSky66(T){
 const geometry=new T.SphereGeometry(480,20,12);
 const material=new T.ShaderMaterial({
  side:T.BackSide,depthWrite:false,depthTest:false,fog:false,toneMapped:false,
  vertexShader:`varying vec3 vDir;
   void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 vDir;
   void main(){
    float height=clamp(vDir.y,0.,1.);
    vec3 zenith=vec3(.396,.686,.882);
    vec3 horizon=vec3(.839,.910,.953);
    vec3 lower=vec3(.929,.941,.914);
    vec3 sky=mix(horizon,zenith,pow(height,.67));
    sky=mix(lower,sky,smoothstep(-.16,.085,vDir.y));
    gl_FragColor=vec4(sky,1.);
   }`
 });
 const sky=new T.Mesh(geometry,material);
 sky.name='daybreak66-clear-daylight-sky';
 sky.frustumCulled=false;sky.renderOrder=-100;
 sky.userData.collidable=false;
 return sky;
}
