/** CROSSFIRE 04.6 — browser frame pacing, network and GPU resource diagnostics.
 * Measures requestAnimationFrame intervals, not GPU execution time.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function percentile(input,fraction){
 const values=[...input].filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
 if(!values.length)return 0;
 return values[clamp(Math.ceil(values.length*fraction)-1,0,values.length-1)];
}
export class FrameMeter{
 constructor(capacity=360){this.capacity=Math.max(30,Math.floor(capacity));this.values=new Float32Array(this.capacity);this.reset();}
 reset(){this.count=0;this.next=0;this.total=0;}
 record(ms,visible=true){
  if(!visible||!Number.isFinite(ms)||ms<=0||ms>=250){
   if(!visible||ms>=250)this.reset();
   return false;
  }
  if(this.count===this.capacity)this.total-=this.values[this.next];
  else this.count++;
  this.values[this.next]=ms;
  this.total+=ms;
  this.next=(this.next+1)%this.capacity;
  return true;
 }
 summary(){
  if(!this.count)return {fps:0,low1Fps:0,p50Ms:0,p95Ms:0,p99Ms:0,samples:0};
  const samples=Array.from(this.values.subarray(0,this.count));
  const p99=percentile(samples,.99);
  const fps=1000/(this.total/this.count);
  return {fps:+fps.toFixed(1),low1Fps:+(1000/p99).toFixed(1),
   p50Ms:+percentile(samples,.5).toFixed(2),
   p95Ms:+percentile(samples,.95).toFixed(2),
   p99Ms:+p99.toFixed(2),samples:this.count};
 }
}
export function formatDiagnostics(frame,net,render){
 const number=(v,digits=0)=>Number.isFinite(v)?Number(v).toFixed(digits):'--';
 const stale=net.stale?'STALE':'ACTIVE';
 return [
  'CLIENT / FRAME PACING',
  `FPS AVG       ${number(frame.fps,1)}`,
  `1% LOW FPS    ${number(frame.low1Fps,1)}`,
  `FRAME P50     ${number(frame.p50Ms,2)} ms`,
  `FRAME P95     ${number(frame.p95Ms,2)} ms`,
  `FRAME P99     ${number(frame.p99Ms,2)} ms`,
  `SAMPLES       ${frame.samples}`,
  '',
  'NETWORK / SERVER SNAPSHOTS',
  `RTT           ${number(net.rttMs,0)} ms`,
  `JITTER        ${number(net.jitterMs,1)} ms`,
  `BUFFER        ${number(net.delayMs,0)} ms`,
  `LINK          ${stale}`,
  `STATE RX      ${net.received}`,
  `SEQ GAPS      ${net.missing??0}`,
  `REJECTED      ${net.rejected??0}`,
  '',
  'RENDERER',
  `PRESET        ${render.quality||'--'}`,
  `TRIANGLES     ${number(render.triangles)}`,
  `DRAW CALLS    ${number(render.drawCalls)}`,
  `GPU TEXTURES  ${number(render.textures)}`,
  `GPU GEOMETRY  ${number(render.geometries)}`,
  `SHADERS       ${number(render.shaderPrograms)}`,
  `VISIBLE MESH  ${number(render.visibleMeshes)}`,
  `INSTANCES     ${number(render.visibleInstances)}`,
  `SHADOW CAST   ${number(render.shadowCasters)}`,
  `FRAMEBUFFER   ${Number.isFinite(render.pixelWidth)?Math.round(render.pixelWidth):'--'} × ${Number.isFinite(render.pixelHeight)?Math.round(render.pixelHeight):'--'}`,
  `RAIN / MOTES  ${number(render.atmosphereRain)} / ${number(render.atmosphereMotes)}`,
  `ADS / DRONES  ${number(render.activeAds)} / ${number(render.activeDrones)}`,
  '',
  'Frame intervals are not GPU frame times.',
  'Sequence gaps are estimates, not measured Internet loss.'
 ].join('\n');
}
