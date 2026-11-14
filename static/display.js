// Native display pixels first. Auto reduces optional detail before resolution.
// The HUD stays in CSS pixels; scaling affects only the 3D drawing buffer.
export function displaySize(width,height,dpr,scale=1,limit=16384){
 const ratio=Math.min(Math.max(1,dpr)*scale,limit/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio)),ratio};
}
export class AutoQuality{
 constructor(mode='auto'){this.mode=mode;this.reset();}
 reset(){this.scale=1;this.detail=true;this.total=0;this.count=0;this.slow=0;this.fast=0;this.warmup=150;}
 setMode(mode){this.mode=mode;this.reset();}
 sample(ms,dpr=1,visible=true){
  if(this.mode!=='auto'||!visible||ms<=0||ms>100){this.total=0;this.count=0;return false;}
  if(this.warmup>0){this.warmup--;return false;}
  this.total+=ms;this.count++;
  if(this.count<120)return false;
  const avg=this.total/this.count;this.total=0;this.count=0;
  this.slow=avg>20?this.slow+1:0;this.fast=avg<17.2?this.fast+1:0;
  const floor=Math.max(.75,1/Math.max(1,dpr));
  if(this.slow>=2){
   this.slow=this.fast=0;
   if(this.detail){this.detail=false;return true;}
   if(this.scale>floor){this.scale=Math.max(floor,Math.round((this.scale-.05)*100)/100);return true;}
  }
  if(this.fast>=5){
   this.fast=this.slow=0;
   if(this.scale<1){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);return true;}
   if(!this.detail){this.detail=true;return true;}
  }
  return false;
 }
}
export function createDisplay(renderer,cameras,onDetail,mode){
 const quality=new AutoQuality(mode),gl=renderer.getContext(),limit=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
 let width=0,height=0,dpr=0,buffer={width:0,height:0};
 function resize(force=false){
  const w=window.innerWidth,h=window.innerHeight,p=window.devicePixelRatio||1;
  if(!force&&w===width&&h===height&&p===dpr)return;
  const changed=p!==dpr||w!==width||h!==height;width=w;height=h;dpr=p;
  if(changed)quality.reset();
  buffer=displaySize(w,h,p,quality.scale,limit);
  renderer.setPixelRatio(buffer.ratio);renderer.setSize(w,h);
  for(const camera of cameras){camera.aspect=w/h;camera.updateProjectionMatrix();}
  onDetail(quality.detail);
 }
 resize(true);
 return {quality,resize,get buffer(){return buffer;},setMode(mode){quality.setMode(mode);resize(true);},
  frame(ms){resize();if(quality.sample(ms,dpr,!document.hidden)){onDetail(quality.detail);resize(true);}},
  label(){return `${quality.mode==='auto'?'AUTO':'NATIVE'} ${Math.round(quality.scale*100)}%`;}};
}
