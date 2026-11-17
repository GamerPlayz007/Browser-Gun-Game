// Cache the architecture layer at the actual display density, including expanded M view.
import {radarType65} from './interface65.js';
export function createMinimap(canvas,label,map){
 const SIZE=240,PAD=10,SCALE=(SIZE-PAD*2)/map.size;
 const base=document.createElement('canvas'),bg=base.getContext('2d'),ctx=canvas.getContext('2d');
 const origin=map.center||{x:0,z:0};
 const px=x=>SIZE/2+(x-origin.x)*SCALE,pz=z=>SIZE/2+(map.dustOriginal?-1:1)*(z-origin.z)*SCALE;
 let resolution=0,last=-1,lastZone='';
 function resize(){
  const dpr=typeof devicePixelRatio==='number'?devicePixelRatio:1;
  const needed=Math.max(1,Math.round((canvas.clientWidth||SIZE)*dpr));
  if(needed===resolution)return false;
  resolution=needed;canvas.width=canvas.height=base.width=base.height=needed;
  const ratio=needed/SIZE;bg.setTransform(ratio,0,0,ratio,0,0);ctx.setTransform(ratio,0,0,ratio,0,0);
  bg.fillStyle='#c9d8db';bg.fillRect(0,0,SIZE,SIZE);
  for(const zone of map.zones){bg.globalAlpha=.24;bg.fillStyle=zone.color;bg.fillRect(px(zone.x-zone.w/2),pz(zone.z-zone.d/2),zone.w*SCALE,zone.d*SCALE);}
  bg.globalAlpha=1;
  if(map.dustOriginal){
   // Actual original map-generator building lots, not a guessed 2-D outline.
   bg.fillStyle='#8b7356';
   for(const lot of map.dustFootprints||[]){
    bg.fillRect(px(lot.x0),pz(lot.z1),Math.max(1,(lot.x1-lot.x0)*SCALE),
      Math.max(1,(lot.z1-lot.z0)*SCALE));
   }
   bg.strokeStyle='#e1c39b';bg.strokeRect(px(-43),pz(74),86*SCALE,148*SCALE);
   for(const side of ['A','B']){
    bg.fillStyle=side==='A'?'#4c91b5':'#be8055';
    const safe=new Set(map.validatedSpawns?.[side]?.safeIndices||[]);
    for(let i=0;i<(map.spawnSets?.[side]||[]).length;i++){
     if(!safe.has(i))continue;
     const [x,,z]=map.spawnSets[side][i];
     bg.beginPath();bg.arc(px(x),pz(z),2.2,0,Math.PI*2);bg.fill();
    }
   }
  }
  for(const b of map.boxes){
   if(['floor','routeFloor','deck','ramp','stationRoof'].includes(b.kind))continue;
   bg.fillStyle=map.palette[b.style]||'#53667c';bg.fillRect(px(b.x-b.w/2),pz(b.z-b.d/2),Math.max(1,b.w*SCALE),Math.max(1,b.d*SCALE));
  }
  bg.font='bold 9px sans-serif';bg.textAlign='center';bg.fillStyle='#304a51';
  for(const z of map.zones)bg.fillText(z.name,px(z.x),pz(z.z));
  return true;
 }
 resize();
 return {draw(p,yaw,time,markers={}){
  const changed=resize();if(!changed&&time-last<.1)return;last=time;
  ctx.clearRect(0,0,SIZE,SIZE);ctx.drawImage(base,0,0,SIZE,SIZE);
  // Live multiplayer radar; includes all living opponents in every mode.
  // The server already shares positions to render remote player models.
  for(const player of markers.players||[]){
   const type=radarType65(player,markers);
   if(!type)continue;
   const color=type==='ally'?'#5de6fc':'#ff607a';
   ctx.beginPath();ctx.arc(px(player.x),pz(player.z),type==='enemy'?4:3.5,0,Math.PI*2);
   ctx.fillStyle=color;ctx.fill();
   ctx.strokeStyle='#102335';ctx.lineWidth=1.4;ctx.stroke();
  }
  const point=markers.objective;
  if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
   const color=point.contested?'#ffe5a1':point.controller==='azure'?'#57ddff':
    point.controller==='ember'?'#ff996c':'#fff0bd';
   ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.fillStyle='#091a26';
   ctx.beginPath();ctx.arc(px(point.x),pz(point.z),Math.max(6,(point.radius||6)*SCALE),0,Math.PI*2);
   ctx.fill();ctx.stroke();
   ctx.fillStyle=color;ctx.font='bold 12px sans-serif';ctx.textAlign='center';
   ctx.fillText('C',px(point.x),pz(point.z)+4);
  }
  ctx.save();ctx.translate(px(p.x),pz(p.z));ctx.rotate(map.dustOriginal?Math.PI-yaw:-yaw);
  ctx.fillStyle='#1b86b1';ctx.strokeStyle='#eef7f3';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  const zone=map.zones.find(z=>Math.abs(p.x-z.x)<=z.w/2&&Math.abs(p.z-z.z)<=z.d/2)?.name||(map.dustOriginal?'MARKET STREETS':'CITY STREETS');
  const text=zone+(p.y>=4.5?' / UPPER LEVEL':'');if(lastZone!==text){lastZone=text;label.textContent=text;}
 }};
}
