// The map layer is painted once. Only your marker is redrawn at 10 Hz.
export function createMinimap(canvas,label,map){
 const SIZE=240,PAD=10,SCALE=(SIZE-PAD*2)/map.size;
 const base=document.createElement('canvas');base.width=base.height=SIZE;
 canvas.width=canvas.height=SIZE;
 const bg=base.getContext('2d'),ctx=canvas.getContext('2d');
 const px=x=>SIZE/2+x*SCALE;
 bg.fillStyle='#18353c';bg.fillRect(0,0,SIZE,SIZE);
 for(const zone of map.zones){bg.globalAlpha=.24;bg.fillStyle=zone.color;bg.fillRect(px(zone.x-zone.w/2),px(zone.z-zone.d/2),zone.w*SCALE,zone.d*SCALE);}
 bg.globalAlpha=1;
 for(const b of map.boxes){
  if(['lintel','canopy','ringSegment'].includes(b.kind))continue;
  bg.globalAlpha=['roof','bridge'].includes(b.kind)?.45:1;
  bg.fillStyle=map.palette[b.style]||'#e0c49a';bg.fillRect(px(b.x-b.w/2),px(b.z-b.d/2),Math.max(1,b.w*SCALE),Math.max(1,b.d*SCALE));
 }
 bg.globalAlpha=1;bg.font='bold 9px sans-serif';bg.textAlign='center';bg.fillStyle='#fff1d8';
 for(const [text,x,z] of [['N',0,-36],['EMBER',-26,0],['AZURE',0,13],['GARDENS',27,0]])bg.fillText(text,px(x),px(z));
 let last=-1,lastZone='';
 return {draw(p,yaw,time){
  if(time-last<.1)return;last=time;
  ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(base,0,0);
  ctx.save();ctx.translate(px(p.x),px(p.z));ctx.rotate(-yaw);
  ctx.fillStyle='#ff875d';ctx.strokeStyle='#112f38';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  const zone=map.zones.find(z=>Math.abs(p.x-z.x)<=z.w/2&&Math.abs(p.z-z.z)<=z.d/2)?.name||'DISTRICT';
  const text=zone+(p.y>=5?' / ROOFTOPS':'');if(lastZone!==text){lastZone=text;label.textContent=text;}
 }};
}
