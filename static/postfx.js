import * as T from 'three';

// 02.5 self-contained Three.js EffectComposer / UnrealBloomPass-style pipeline.
// The offline build vendors only Three core. This implementation provides a
// thresholded, two-pass Gaussian neon bloom with optional native-resolution
// multisampled render targets (4x High / 8x Ultra) and no external CDN.
const vertex=`varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const sample=`uniform sampler2D tDiffuse; varying vec2 vUv;`;
function shader(fragment,uniforms){return new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`${sample}\n${fragment}`,depthTest:false,depthWrite:false,toneMapped:false});}
class Fullscreen{
 constructor(){this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial());this.quad.frustumCulled=false;this.scene.add(this.quad);}
 draw(renderer,material,target){renderer.setRenderTarget(target);this.quad.material=material;renderer.render(this.scene,this.camera);}
 dispose(){this.quad.geometry.dispose();}
}
export class UnrealBloomPass{
 constructor(strength=1.15,threshold=.62,radius=1){this.strength=strength;this.threshold=threshold;this.radius=radius;
  this.bright=shader(`uniform float threshold;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=max(max(c.r,c.g),c.b);float k=smoothstep(threshold-.16,threshold+.36,l);gl_FragColor=vec4(c*k,1.);}`,{tDiffuse:{value:null},threshold:{value:threshold}});
  this.blur=shader(`uniform vec2 resolution;uniform vec2 direction;void main(){vec2 d=direction/resolution;vec3 c=texture2D(tDiffuse,vUv).rgb*.227027;
   c+=texture2D(tDiffuse,vUv+d*1.384615).rgb*.316216;c+=texture2D(tDiffuse,vUv-d*1.384615).rgb*.316216;
   c+=texture2D(tDiffuse,vUv+d*3.230769).rgb*.070270;c+=texture2D(tDiffuse,vUv-d*3.230769).rgb*.070270;
   gl_FragColor=vec4(c,1.);}`,{tDiffuse:{value:null},resolution:{value:new T.Vector2(1,1)},direction:{value:new T.Vector2(1,0)}});
  this.compose=shader(`uniform sampler2D tBloom;uniform float strength;void main(){vec3 base=texture2D(tDiffuse,vUv).rgb;
   vec3 glow=texture2D(tBloom,vUv).rgb*strength;vec3 hdr=base+glow;
   // Filmic rolloff preserves vivid sign colors rather than clipping to white.
   vec3 mapped=(hdr*(2.51*hdr+.03))/(hdr*(2.43*hdr+.59)+.14);
   gl_FragColor=vec4(pow(clamp(mapped,0.,1.),vec3(1./2.2)),1.);}`,{
    tDiffuse:{value:null},tBloom:{value:null},strength:{value:strength}});
 }
 dispose(){this.bright.dispose();this.blur.dispose();this.compose.dispose();}
}
export class EffectComposer{
 constructor(renderer,scene,camera){this.renderer=renderer;this.scene=scene;this.camera=camera;this.pass=new UnrealBloomPass();this.fullscreen=new Fullscreen();
  const target=(samples=0)=>new T.WebGLRenderTarget(16,16,{type:T.HalfFloatType,format:T.RGBAFormat,depthBuffer:true,stencilBuffer:false,samples});
  this.beauty=target();this.bloomA=target();this.bloomB=target();this.width=0;this.height=0;this.mode='high';this.setMode('high');}
 setMode(mode){this.mode=mode;this.beauty.samples=mode==='ultra'?8:mode==='high'||mode==='native'?4:0;
  this.pass.strength=mode==='ultra'?1.35:1.0;this.pass.threshold=.59;this.pass.radius=mode==='ultra'?1.7:1;
  // Reset targets so sample-count changes allocate a fresh framebuffer.
  if(this.width){this.beauty.dispose();this.beauty.setSize(this.width,this.height);}
 }
 setSize(w,h){w=Math.max(1,Math.floor(w));h=Math.max(1,Math.floor(h));if(this.width===w&&this.height===h)return;
  this.width=w;this.height=h;this.beauty.setSize(w,h);this.bloomA.setSize(Math.max(1,Math.floor(w/2)),Math.max(1,Math.floor(h/2)));
  this.bloomB.setSize(Math.max(1,Math.floor(w/2)),Math.max(1,Math.floor(h/2)));}
 render(){const r=this.renderer,p=this.pass;
  if(this.mode==='performance'){r.setRenderTarget(null);r.render(this.scene,this.camera);return;}
  r.setRenderTarget(this.beauty);r.clear(true,true,true);r.render(this.scene,this.camera);
  p.bright.uniforms.tDiffuse.value=this.beauty.texture;p.bright.uniforms.threshold.value=p.threshold;
  this.fullscreen.draw(r,p.bright,this.bloomA);
  p.blur.uniforms.resolution.value.set(this.bloomA.width,this.bloomA.height);
  p.blur.uniforms.tDiffuse.value=this.bloomA.texture;p.blur.uniforms.direction.value.set(p.radius,0);
  this.fullscreen.draw(r,p.blur,this.bloomB);
  p.blur.uniforms.tDiffuse.value=this.bloomB.texture;p.blur.uniforms.direction.value.set(0,p.radius);
  this.fullscreen.draw(r,p.blur,this.bloomA);
  p.compose.uniforms.tDiffuse.value=this.beauty.texture;p.compose.uniforms.tBloom.value=this.bloomA.texture;
  p.compose.uniforms.strength.value=p.strength;
  this.fullscreen.draw(r,p.compose,null);
 }
 dispose(){this.beauty.dispose();this.bloomA.dispose();this.bloomB.dispose();this.pass.dispose();this.fullscreen.dispose();}
}
export function createPostProcessing(renderer,scene,camera,mode='high'){
 const composer=new EffectComposer(renderer,scene,camera);composer.setMode(mode);
 return {composer,setMode(value){composer.setMode(value);},setSize(w,h){composer.setSize(w,h);},
  render(){composer.render();},dispose(){composer.dispose();}};
}
