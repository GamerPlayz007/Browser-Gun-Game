// Cache the architecture layer at the actual display density, including expanded M view.
export function createMinimap(canvas,label,map){
 const SIZE=240,PAD=10,SCALE=(SIZE-PAD*2)/map.size;
 const base=document.createElement('canvas'),bg=base.getContext('2d'),ctx=canvas.getContext('2d');
 const px=x=>SIZE/2+x*SCALE;let resolution=0,last=-1,lastZone='';
 function resize(){
  const dpr=typeof devicePixelRatio==='number'?devicePixelRatio:1;
  const needed=Math.max(1,Math.round((canvas.clientWidth||SIZE)*dpr));
  if(needed===resolution)return false;
  resolution=needed;canvas.width=canvas.height=base.width=base.height=needed;
  const ratio=needed/SIZE;bg.setTransform(ratio,0,0,ratio,0,0);ctx.setTransform(ratio,0,0,ratio,0,0);
  bg.fillStyle='#243044';bg.fillRect(0,0,SIZE,SIZE);
  for(const zone of map.zones){bg.globalAlpha=.24;bg.fillStyle=zone.color;bg.fillRect(px(zone.x-zone.w/2),px(zone.z-zone.d/2),zone.w*SCALE,zone.d*SCALE);}
  bg.globalAlpha=1;
  for(const b of map.boxes){
   if(['floor','routeFloor','deck','ramp','stationRoof'].includes(b.kind))continue;
   bg.fillStyle=map.palette[b.style]||'#53667c';bg.fillRect(px(b.x-b.w/2),px(b.z-b.d/2),Math.max(1,b.w*SCALE),Math.max(1,b.d*SCALE));
  }
  bg.font='bold 9px sans-serif';bg.textAlign='center';bg.fillStyle='#e8f7ff';
  for(const z of map.zones)bg.fillText(z.name,px(z.x),px(z.z));
  return true;
 }
 resize();
 return {draw(p,yaw,time,markers={}){
  const changed=resize();if(!changed&&time-last<.1)return;last=time;
  ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(base,0,0,SIZE,SIZE);
  // Draw only teammates, never enemy positions or other hidden game state.
  const team=markers.team;
  if(team==='azure'||team==='ember'){
   ctx.fillStyle=team==='azure'?'#57ddff':'#ff996c';
   for(const mate of markers.players||[]){
    if(mate.id===markers.meId||mate.team!==team||mate.hp<=0||
       !Number.isFinite(mate.x)||!Number.isFinite(mate.z))continue;
    ctx.beginPath();ctx.arc(px(mate.x),px(mate.z),3.5,0,Math.PI*2);ctx.fill();
   }
  }
  const point=markers.objective;
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
   const color=point.contested?'#ffe5a1':point.controller==='azure'?'#57ddff':
    point.controller==='ember'?'#ff996c':'#fff0bd';
   ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.fillStyle='#091a26';
   ctx.beginPath();ctx.arc(px(point.x),px(point.z),Math.max(6,(point.radius||6)*SCALE),0,Math.PI*2);
   ctx.fill();ctx.stroke();
   ctx.fillStyle=color;ctx.font='bold 12px sans-serif';ctx.textAlign='center';
   ctx.fillText('C',px(point.x),px(point.z)+4);
  }
  ctx.save();ctx.translate(px(p.x),px(p.z));ctx.rotate(-yaw);
  ctx.fillStyle='#ff558f';ctx.strokeStyle='#112333';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  const zone=map.zones.find(z=>Math.abs(p.x-z.x)<=z.w/2&&Math.abs(p.z-z.z)<=z.d/2)?.name||'CITY STREETS';
  const text=zone+(p.y>=4.5?' / UPPER LEVEL':'');if(lastZone!==text){lastZone=text;label.textContent=text;}
 }};
}
