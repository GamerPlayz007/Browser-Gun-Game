/* CROSSFire 6.4: a 2D map of the ORIGINAL district, not a replacement
 * scene or another renderer. Uses source building footprints and validated
 * server spawn sets; draws on a tiny HUD canvas while previewing the map.
 */
const WIDTH=206, HEIGHT=324, MARGIN=19;

export function createDustMinimap64({source,contract}){
 const area=contract.playBounds,spawns=contract.spawns;
 const width=area.x1-area.x0,depth=area.z1-area.z0;
 const scale=Math.min((WIDTH-MARGIN*2)/width,(HEIGHT-MARGIN*2)/depth);
 const cx=(area.x0+area.x1)/2,cz=(area.z0+area.z1)/2;
 const px=x=>WIDTH/2+(x-cx)*scale;
 const pz=z=>HEIGHT/2-(z-cz)*scale; // north is up
 const box=(ctx,x0,z0,x1,z1)=>{
   ctx.fillRect(px(x0),pz(z1),(x1-x0)*scale,(z1-z0)*scale);
 };
 const container=document.createElement('div');
 container.id='cf-dust64-map';
 container.setAttribute('aria-label','Dust Corridor source layout and spawn minimap');
 container.style.cssText='position:fixed;z-index:9998;right:12px;top:96px;width:206px;padding:8px 8px 6px;background:#151c1adf;border:1px solid #d0be9588;border-radius:8px;box-shadow:0 10px 30px #0008;color:#f1e7ca;text-align:center;font:11px system-ui,sans-serif;pointer-events:none;';
 const title=document.createElement('strong');title.textContent='DUST CORRIDOR / SERVER MAP';
 title.style.cssText='font-size:10px;letter-spacing:.11em';
 const canvas=document.createElement('canvas');
 canvas.width=WIDTH;canvas.height=HEIGHT;
 canvas.style.cssText='width:100%;height:auto;display:block;border-radius:4px;margin:6px auto;background:#ac9371';
 const info=document.createElement('small');info.id='cf-dust64-map-info';
 info.style.cssText='display:block;font:10px ui-monospace,monospace;color:#d9e4d7';
 container.append(title,canvas,info);document.body.append(container);
 const ctx=canvas.getContext('2d');
 const base=document.createElement('canvas');base.width=WIDTH;base.height=HEIGHT;
 const bg=base.getContext('2d');
 bg.fillStyle='#b5a17b';bg.fillRect(0,0,WIDTH,HEIGHT);
 bg.fillStyle='#3d4440';box(bg,-7,area.z0,7,area.z1);
 bg.fillStyle='#817761';
 for(const sign of [-1,1]){
   box(bg,sign===1?7:-10.2,area.z0,sign===1?10.2:-7,area.z1);
   box(bg,sign===1?24:-28.6,area.z0,sign===1?28.6:-24,area.z1);
 }
 bg.fillStyle='#d4bb8c';
 box(bg,-20,35,20,62);
 bg.fillStyle='#8d7053';
 for(const b of source.buildings||[]){
   if(![b.x0,b.x1,b.z0,b.z1].every(Number.isFinite))continue;
   box(bg,b.x0,b.z0,b.x1,b.z1);
   bg.strokeStyle='#ead3a03d';bg.lineWidth=.6;
   bg.strokeRect(px(b.x0),pz(b.z1),(b.x1-b.x0)*scale,(b.z1-b.z0)*scale);
 }
 bg.strokeStyle='#ecdcac';bg.lineWidth=2;
 bg.strokeRect(px(area.x0),pz(area.z1),width*scale,depth*scale);
 bg.font='bold 9px system-ui,sans-serif';bg.textAlign='center';
 bg.fillStyle='#2c3b34';
 bg.fillText('N / PLAZA',px(0),pz(59));
 bg.fillStyle='#e9d7b5';
 bg.fillText('MARKET',px(0),pz(-12));
 bg.fillText('S / STREET',px(0),pz(-72)+10);
 bg.fillStyle='#ffebc1';bg.fillText('N ↑',WIDTH-21,20);
 let last=-1;
 function draw(player,yaw,now,mode='walk'){
   if(now-last<.09)return;last=now;
   ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(base,0,0);
   for(const side of ['A','B']){
     const safe=new Set(contract.validatedSpawns?.[side]?.safeIndices||[]);
     ctx.fillStyle=side==='A'?'#65d9ff':'#ffab79';
     for(let i=0;i<(spawns[side]||[]).length;i++){
       if(!safe.has(i))continue;
       const [x,,z]=spawns[side][i];
       ctx.beginPath();ctx.arc(px(x),pz(z),2.7,0,Math.PI*2);ctx.fill();
     }
   }
   if(player){
     ctx.save();ctx.translate(px(player.x),pz(player.z));ctx.rotate(yaw+Math.PI);
     ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();
     ctx.fillStyle='#36f3d4';ctx.strokeStyle='#173327';ctx.lineWidth=1.8;ctx.fill();ctx.stroke();ctx.restore();
     info.textContent=(mode==='walk'?'COLLISION':'FREE FLY')+' · X '+player.x.toFixed(1)+' / Z '+player.z.toFixed(1);
   }
 }
 return {element:container,draw,dispose(){container.remove();}};
}
