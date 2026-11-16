import * as T from 'three';

// CROSSFIRE 04.4: cinematic neon bloom + filmic grading in the EXISTING
// five-draw compositor. No extra full-screen passes or external assets.
export const CINEMATIC_PRESETS={
 performance:{bloom:0,threshold:1,radius:0,contrast:1,saturation:1,vignette:0,grain:0,samples:0},
 auto:{bloom:.055,threshold:1.32,radius:.6,contrast:1.005,saturation:1.025,vignette:.02,grain:0,samples:0},
 high:{bloom:.085,threshold:1.24,radius:.75,contrast:1.015,saturation:1.035,vignette:.035,grain:.001,samples:4},
 ultra:{bloom:.11,threshold:1.2,radius:.83,contrast:1.02,saturation:1.045,vignette:.045,grain:.001,samples:8},
 native:{bloom:.085,threshold:1.24,radius:.75,contrast:1.015,saturation:1.035,vignette:.035,grain:.001,samples:4}
};
const vertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const sample='uniform sampler2D tDiffuse; varying vec2 vUv;';
function shader(fragment,uniforms){
 return new T.ShaderMaterial({uniforms,vertexShader:vertex,
   fragmentShader:sample+'\n'+fragment,depthTest:false,depthWrite:false,toneMapped:false});
}
class Fullscreen{
 constructor(){
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  this.placeholder=new T.MeshBasicMaterial();
  this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.placeholder);
  this.quad.frustumCulled=false;this.scene.add(this.quad);
 }
 draw(renderer,material,target){
  renderer.setRenderTarget(target);this.quad.material=material;renderer.render(this.scene,this.camera);
 }
 dispose(){this.quad.geometry.dispose();this.placeholder.dispose();}
}
export class UnrealBloomPass{
 constructor(strength=.96,threshold=.69,radius=1.12){
  this.strength=strength;this.threshold=threshold;this.radius=radius;
  this.bright=shader(`uniform float threshold;
   void main(){
    vec3 c=texture2D(tDiffuse,vUv).rgb;
    float l=max(max(c.r,c.g),c.b);
    float k=smoothstep(threshold-.17,threshold+.31,l);
    gl_FragColor=vec4(c*k,1.);
   }`,{tDiffuse:{value:null},threshold:{value:threshold}});
  this.blur=shader(`uniform vec2 resolution;uniform vec2 direction;
   void main(){
    vec2 d=direction/resolution;
    vec3 c=texture2D(tDiffuse,vUv).rgb*.227027;
    c+=texture2D(tDiffuse,vUv+d*1.384615).rgb*.316216;
    c+=texture2D(tDiffuse,vUv-d*1.384615).rgb*.316216;
    c+=texture2D(tDiffuse,vUv+d*3.230769).rgb*.070270;
    c+=texture2D(tDiffuse,vUv-d*3.230769).rgb*.070270;
    gl_FragColor=vec4(c,1.);
   }`,{tDiffuse:{value:null},resolution:{value:new T.Vector2(1,1)},direction:{value:new T.Vector2(1,0)}});
  this.compose=shader(`uniform sampler2D tBloom;
   uniform float strength;uniform float contrast;uniform float saturation;
   uniform float vignette;uniform float grain;uniform float frameTime;
   float rand(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
   void main(){
    vec3 base=texture2D(tDiffuse,vUv).rgb;
    vec3 hdr=base+texture2D(tBloom,vUv).rgb*strength;
    // Keep luminous signage colored while preventing white clipping.
    vec3 filmic=(hdr*(2.51*hdr+.03))/(hdr*(2.43*hdr+.59)+.14);
    filmic=clamp(filmic,0.,1.);
    float lum=dot(filmic,vec3(.2126,.7152,.0722));
    float shadow=1.-smoothstep(.06,.48,lum);
    float highlight=smoothstep(.37,.86,lum);
    filmic+=vec3(-.014,.007,.024)*shadow;
    filmic+=vec3(.015,.007,-.009)*highlight;
    lum=dot(filmic,vec3(.2126,.7152,.0722));
    filmic=mix(vec3(lum),filmic,saturation);
    filmic=(filmic-.5)*contrast+.5;
    vec2 p=(vUv-.5)*vec2(1.27,1.);
    float edges=smoothstep(.22,.76,length(p));
    filmic*=1.-vignette*edges;
    float noise=rand(floor(vUv*vec2(1920.,1080.))+floor(frameTime*12.))-.5;
    filmic+=noise*grain;
    gl_FragColor=vec4(pow(clamp(filmic,0.,1.),vec3(1./2.2)),1.);
   }`,{
    tDiffuse:{value:null},tBloom:{value:null},
    strength:{value:strength},contrast:{value:1},saturation:{value:1},
    vignette:{value:0},grain:{value:0},frameTime:{value:0}
   });
 }
 dispose(){this.bright.dispose();this.blur.dispose();this.compose.dispose();}
}
export class EffectComposer{
 constructor(renderer,scene,camera){
  this.renderer=renderer;this.scene=scene;this.camera=camera;
  this.pass=new UnrealBloomPass();this.fullscreen=new Fullscreen();
  const target=()=>new T.WebGLRenderTarget(16,16,{
   type:T.HalfFloatType,format:T.RGBAFormat,depthBuffer:true,stencilBuffer:false});
  this.beauty=target();this.bloomA=target();this.bloomB=target();
  this.width=0;this.height=0;this.mode='high';this.detailEnabled=true;
  // Browsers and drivers can support fewer MSAA samples than Ultra requests.
  // Detect the hardware cap instead of allocating an incomplete framebuffer.
  let max=8;
  try{const gl=renderer.getContext?.();const supported=gl?.getParameter?.(gl.MAX_SAMPLES);
   if(Number.isFinite(supported))max=Math.max(0,supported);}catch{}
  this.maxSamples=max;this.setMode('high');
 }
 setMode(mode){
  this.mode=CINEMATIC_PRESETS[mode]?mode:'high';
  const cfg=CINEMATIC_PRESETS[this.mode],p=this.pass;
  // Render target MSAA used only on High/Ultra; no additional render passes.
  const changedSamples=this.beauty.samples!==cfg.samples;
  this.beauty.samples=Math.min(cfg.samples,this.maxSamples);
  p.strength=cfg.bloom;p.threshold=cfg.threshold;p.radius=cfg.radius;
  p.compose.uniforms.contrast.value=cfg.contrast;
  p.compose.uniforms.saturation.value=cfg.saturation;
  p.compose.uniforms.vignette.value=cfg.vignette;
  p.compose.uniforms.grain.value=cfg.grain;
  if(changedSamples&&this.width){
   this.beauty.dispose();this.beauty.setSize(this.width,this.height);
  }
 }
 setDetail(enabled){this.detailEnabled=Boolean(enabled);}
 setSize(w,h){
  w=Math.max(1,Math.floor(w));h=Math.max(1,Math.floor(h));
  if(this.width===w&&this.height===h)return;
  this.width=w;this.height=h;this.beauty.setSize(w,h);
  this.bloomA.setSize(Math.max(1,Math.floor(w/2)),Math.max(1,Math.floor(h/2)));
  this.bloomB.setSize(Math.max(1,Math.floor(w/2)),Math.max(1,Math.floor(h/2)));
 }
 render(time=0){
  const r=this.renderer,p=this.pass;
  // Auto drops the entire compositor when its frame meter disables optional
  // detail; this recovers five shader draws while retaining the base scene.
  if(this.mode==='performance'||(this.mode==='auto'&&!this.detailEnabled)){
   r.setRenderTarget(null);r.render(this.scene,this.camera);return;
  }
  r.setRenderTarget(this.beauty);r.clear(true,true,true);r.render(this.scene,this.camera);
  p.bright.uniforms.tDiffuse.value=this.beauty.texture;
  p.bright.uniforms.threshold.value=p.threshold;
  this.fullscreen.draw(r,p.bright,this.bloomA);
  p.blur.uniforms.resolution.value.set(this.bloomA.width,this.bloomA.height);
  p.blur.uniforms.tDiffuse.value=this.bloomA.texture;
  p.blur.uniforms.direction.value.set(p.radius,0);
  this.fullscreen.draw(r,p.blur,this.bloomB);
  p.blur.uniforms.tDiffuse.value=this.bloomB.texture;
  p.blur.uniforms.direction.value.set(0,p.radius);
  this.fullscreen.draw(r,p.blur,this.bloomA);
  p.compose.uniforms.tDiffuse.value=this.beauty.texture;
  p.compose.uniforms.tBloom.value=this.bloomA.texture;
  p.compose.uniforms.strength.value=p.strength;
  p.compose.uniforms.frameTime.value=Number.isFinite(time)?time:0;
  this.fullscreen.draw(r,p.compose,null);
 }
 dispose(){
  this.beauty.dispose();this.bloomA.dispose();this.bloomB.dispose();
  this.pass.dispose();this.fullscreen.dispose();
 }
}
export function createPostProcessing(renderer,scene,camera,mode='high'){
 const composer=new EffectComposer(renderer,scene,camera);composer.setMode(mode);
 return {composer,setMode(value){composer.setMode(value);},setDetail(value){composer.setDetail(value);},setSize(w,h){composer.setSize(w,h);},
  render(time=0){composer.render(time);},dispose(){composer.dispose();}};
}
