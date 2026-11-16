/** 06.1 / DAYBREAK: school-first dynamic rendering.
 * Resolution caps use actual framebuffer dimensions, not only devicePixelRatio.
 * No WebGL capabilities are needed to make a safe initial choice.
 */
export const QUALITY_MODES=['auto','performance','high','ultra','native'];
export const RESOLUTION_CAPS=Object.freeze({
 auto:Object.freeze({width:1280,height:720}),
 performance:Object.freeze({width:960,height:540})
});
export function displaySize(width,height,dpr,scale=1,limit=16384){
 const ratio=Math.min(Math.max(1,dpr)*scale,limit/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio)),ratio};
}
export function renderRatio(width,height,dpr,mode='auto',scale=1){
 const pixelRatio=Number.isFinite(dpr)?Math.max(1,dpr):1;
 const cap=RESOLUTION_CAPS[mode];
 if(!cap)return pixelRatio; // High / Ultra / Native preserve high-DPI choices.
 // A 1920×1080 school laptop must not silently render two million pixels.
 const budget=Math.min(1,cap.width/Math.max(1,width),cap.height/Math.max(1,height));
 return Math.max(.01,Math.min(pixelRatio,budget)*(mode==='auto'?scale:1));
}
export class AutoQuality{
 constructor(mode='auto'){this.mode=QUALITY_MODES.includes(mode)?mode:'auto';this.reset();}
 reset(){
  this.scale=1;
  // Start Auto without costly bloom, shadows, weather or optional city layers.
  // Recover them only after the machine sustains the target frame pacing.
  this.detail=this.mode!=='performance'&&this.mode!=='auto';
  this.total=0;this.count=0;this.slow=0;this.fast=0;this.warmup=120;
 }
 setMode(mode){this.mode=QUALITY_MODES.includes(mode)?mode:'auto';this.reset();}
 sample(ms,dpr=1,visible=true){
  if(this.mode!=='auto'||!visible||!Number.isFinite(ms)||ms<=0){
   this.total=this.count=0;return false;
  }
  if(this.warmup>0){this.warmup--;return false;}
  // 7-10 FPS frames must trigger downscaling, not be discarded as outliers.
  // Cap massive stalls (e.g. browser UI) so one pause cannot dominate.
  this.total+=Math.min(ms,100);this.count++;if(this.count<90)return false;
  const avg=this.total/this.count;this.total=this.count=0;
  // Hysteresis avoids quality oscillation on ordinary 60 Hz school screens.
  this.slow=avg>21.5?this.slow+1:0;
  this.fast=avg<17.4?this.fast+1:0;
  if(this.slow>=2){
   this.slow=this.fast=0;
   if(this.detail){this.detail=false;return true;}
   if(this.scale>.60){this.scale=Math.max(.60,Math.round((this.scale-.10)*100)/100);return true;}
  }
  // Restore framebuffer quality before enabling expensive effects.
  const stableWindows=this.scale<1?3:10;
  if(this.fast>=stableWindows){
   this.slow=this.fast=0;
   if(this.scale<1){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);return true;}
   if(!this.detail){this.detail=true;return true;}
  }
  return false;
 }
}
export function createDisplay(renderer,cameras,onDetail,mode='auto'){
 const quality=new AutoQuality(mode),gl=renderer.getContext(),limit=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
 let width=0,height=0,dpr=0,buffer={width:0,height:0};
 function resize(force=false){
  const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight),p=Math.max(1,window.devicePixelRatio||1);
  if(!force&&w===width&&h===height&&p===dpr)return;
  const changed=p!==dpr||w!==width||h!==height;width=w;height=h;dpr=p;
  if(changed&&quality.mode==='auto')quality.reset();
  const requested=renderRatio(w,h,p,quality.mode,quality.scale);
  buffer=displaySize(w,h,p,requested/p,limit);
  renderer.setPixelRatio(buffer.ratio);renderer.setSize(w,h);
  for(const camera of cameras){camera.aspect=w/h;camera.updateProjectionMatrix();}
  onDetail(quality.detail);
 }
 resize(true);
 return {quality,resize,get buffer(){return buffer;},setMode(mode){quality.setMode(mode);resize(true);},
  frame(ms){resize();if(quality.sample(ms,dpr,!document.hidden))resize(true);},
  label(){return `${quality.mode.toUpperCase()} ${buffer.width}×${buffer.height} · ${Math.round(buffer.ratio*100)}% DPR`;}};
}
