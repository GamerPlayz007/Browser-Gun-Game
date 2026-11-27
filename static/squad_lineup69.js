/**
 * CROSSFire — Pre-match squad lineup.
 * Reuses the actual match character body, helmet and outfit palette.
 * A separate low-cost scene renders only while the room panel is visible.
 * One canvas / one context; 24 FPS cap and modest device pixel ratio.
 * Never participates in world collision, aim, network state or gameplay.
 */
import * as T from 'three';
import {makeLobbyAvatar,disposePlayer,setOperator03Skin,syncOperator03Rig} from './models.js';
import {operator03Color,OPERATOR03_SKINS} from './operator03_skins.js';

const MAX_SLOTS=8;
const STAGE_HEIGHT=3.45;
const FRAME_INTERVAL=1000/24;
const TEAM_COLORS={azure:0x69dcff,ember:0xffae87};
const READY_COLOR=0x75ffbd;
const OPEN_COLOR=0x365b70;

export function createSquadLineup(canvas,roster){
 let renderer=null,scene=null,camera=null;
 const actors=new Map(),pedestals=[],slotCards=[];
 let active=false,raf=0,previous=0,time=0,disabled=false,lastWidth=0,lastHeight=0;
 let hostId=null,selfId=null,mode='deathmatch';
 let players=[];
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;

 function slotX(i){
  const aspect=Math.max(2,canvas.clientWidth/Math.max(1,canvas.clientHeight));
  const width=STAGE_HEIGHT*aspect;
  // The lineup camera looks toward +Z from negative Z to show the avatars'
  // faces. That reverses screen-right versus world +X. Negate the slot axis
  // so stage position i lines up with the i-th card from LEFT to RIGHT.
  return (.5-(i+.5)/MAX_SLOTS)*width;
 }
 function createScene(){
  if(renderer||disabled)return;
  try{
   renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
   renderer.outputColorSpace=T.SRGBColorSpace;
   renderer.toneMapping=T.ACESFilmicToneMapping;
   renderer.toneMappingExposure=1.18;
   scene=new T.Scene();
   camera=new T.OrthographicCamera(-5,5,STAGE_HEIGHT/2,-STAGE_HEIGHT/2,.1,30);
   camera.position.set(0,1.12,-11);
   camera.lookAt(0,1.09,0);
   scene.add(new T.HemisphereLight(0xe1f5ff,0x0b3447,2.35));
   const main=new T.DirectionalLight(0xfdf1e1,3.2);
   main.position.set(-4,6,-5);scene.add(main);
   const rim=new T.DirectionalLight(0x2fbbec,1.65);
   rim.position.set(3,4,3);scene.add(rim);
   const padGeometry=new T.CylinderGeometry(.48,.54,.085,18);
   const ringGeometry=new T.TorusGeometry(.42,.022,6,28);
   for(let i=0;i<MAX_SLOTS;i++){
    const pad=new T.Group();scene.add(pad);
    const base=new T.Mesh(padGeometry,
     new T.MeshStandardMaterial({color:0x1d3443,metalness:.42,roughness:.55}));
    base.position.y=-.10;pad.add(base);
    const ring=new T.Mesh(ringGeometry,
     new T.MeshBasicMaterial({color:OPEN_COLOR,transparent:true,opacity:.53}));
    ring.rotation.x=-Math.PI/2;
    ring.position.y=-.052;pad.add(ring);
    pedestals.push({pad,ring});
   }
   resize();
  }catch(error){
   disabled=true;renderer?.dispose();renderer=null;
   canvas.hidden=true;
   roster.classList.add('squad-fallback');
   console.warn('Squad 3D preview disabled; text lineup remains available:',error);
  }
 }
 function makeCard(index){
  const item=document.createElement('div');
  item.className='squad-slot is-empty';
  const number=document.createElement('span');number.className='squad-slot-num';
  number.textContent=String(index+1).padStart(2,'0');
  const fallback=document.createElement('span');fallback.className='squad-portrait';fallback.textContent='+';
  const name=document.createElement('strong');name.className='squad-name';name.textContent='INVITE';
  const detail=document.createElement('small');detail.className='squad-status';detail.textContent='OPEN SLOT';
  item.append(number,fallback,name,detail);
  roster.append(item);slotCards[index]={item,number,fallback,name,detail};
 }
 for(let i=0;i<MAX_SLOTS;i++)makeCard(i);
 function resize(){
  if(!renderer||!camera)return;
  const w=Math.max(1,Math.floor(canvas.clientWidth));
  const h=Math.max(1,Math.floor(canvas.clientHeight));
  lastWidth=w;lastHeight=h;
  renderer.setSize(w,h,false);
  const hw=STAGE_HEIGHT*(w/h)/2;
  camera.left=-hw;camera.right=hw;
  camera.top=STAGE_HEIGHT/2;camera.bottom=-STAGE_HEIGHT/2;
  camera.updateProjectionMatrix();
  for(let i=0;i<MAX_SLOTS;i++){
   const x=slotX(i);
   pedestals[i].pad.position.x=x;
  }
  players.forEach((p,i)=>{const actor=actors.get(p.id);if(actor)actor.position.x=slotX(i);});
 }
 function update(playersNext,host,self,currentMode){
  players=(Array.isArray(playersNext)?playersNext:[]).filter(p=>!p.bot).slice(0,MAX_SLOTS);
  hostId=host;selfId=self;mode=currentMode||'deathmatch';
  if(!renderer&&!disabled)createScene();
  const nextIds=new Set(players.map(p=>p.id));
  for(const [id,actor] of actors)if(!nextIds.has(id)){
   disposePlayer(actor);actors.delete(id);
  }
  for(let i=0;i<MAX_SLOTS;i++){
   const player=players[i],card=slotCards[i];
   const {item,number,fallback,name,detail}=card;
   const pad=pedestals[i];
   item.className='squad-slot'+(player?' is-occupied':' is-empty');
   item.removeAttribute('style');
   if(!player){
    fallback.textContent='+';
    name.textContent='INVITE';
    detail.textContent='OPEN SLOT';
    if(pad){pad.ring.material.color.setHex(OPEN_COLOR);pad.ring.material.opacity=.32;}
    continue;
   }
   const camo=player.operator_skin||'woodland';
   const color=operator03Color(camo);
   const colorCss='#'+color.toString(16).padStart(6,'0');
   item.style.setProperty('--squad-color',colorCss);
   if(player.id===selfId)item.classList.add('is-you');
   if(player.ready)item.classList.add('is-ready');
   fallback.textContent=player.name?.slice(0,1)?.toUpperCase()||'?';
   name.textContent=player.name||'Player';
   const role=player.id===hostId?'HOST':player.id===selfId?'YOU':'SQUAD';
   const team=(mode==='teamdeathmatch'||mode==='control')&&player.team?
    player.team.toUpperCase()+' · ':'';
   const skinLabel=(OPERATOR03_SKINS.find(s=>s.id===camo)?.label||'Woodland').toUpperCase();
   detail.textContent=team+role+' · '+skinLabel+' · '+(player.ready?'READY':'NOT READY');
   if(pad){
    const frameColor=player.ready?READY_COLOR:TEAM_COLORS[player.team]||color;
    pad.ring.material.color.setHex(frameColor);
    pad.ring.material.opacity=player.ready?.98:.70;
   }
   if(scene&&!disabled){
    let actor=actors.get(player.id);
    if(!actor||actor.userData.skinColor56!==color){
     if(actor)disposePlayer(actor);
     actor=makeLobbyAvatar(player.name,color);
     scene.add(actor);actors.set(player.id,actor);
     setOperator03Skin(actor,camo);
    }
    if(actor.userData.operator03Wanted!==camo)setOperator03Skin(actor,camo);
    actor.position.set(slotX(i),0,0);
    actor.rotation.y=(i%2?-.12:.12);
   }
  }
  roster.setAttribute('aria-label',players.length+' squad members, '+players.filter(p=>p.ready).length+' ready; eight slots maximum');
  if(active)renderOnce();
 }
 function renderOnce(){
  if(!renderer||!scene||!camera||!active||disabled)return;
  if(Math.max(1,Math.floor(canvas.clientWidth))!==lastWidth||
     Math.max(1,Math.floor(canvas.clientHeight))!==lastHeight)resize();
  renderer.render(scene,camera);
 }
 function tick(t){
  if(!active)return;
  raf=requestAnimationFrame(tick);
  if(t-previous<FRAME_INTERVAL)return;
  previous=t;
  time=t/1000;
  if(!reducedMotion){
   players.forEach((p,i)=>{
    const actor=actors.get(p.id);if(!actor)return;
    actor.position.y=.013*Math.sin(time*1.5+i*.7);
    actor.rotation.y=.08*Math.sin(time*.45+i*.65);
    actor.userData.head.rotation.y=.08*Math.sin(time*.9+i);
    syncOperator03Rig(actor);
   });
  }
  renderOnce();
 }
 function setVisible(visible){
  const should=!!visible&&!document.hidden;
  if(should===active)return;
  active=should;
  if(active){
   if(!renderer&&!disabled)createScene();
   if(renderer){resize();renderOnce();previous=0;raf=requestAnimationFrame(tick);}
  }else{
   cancelAnimationFrame(raf);raf=0;
  }
 }
 function dispose(){
  setVisible(false);
  for(const actor of actors.values())disposePlayer(actor);
  actors.clear();
  for(const p of pedestals){
   p.pad.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
   p.pad.removeFromParent();
  }
  renderer?.dispose();renderer=null;scene=null;
 }
 return {update,setVisible,resize,dispose,get disabled(){return disabled;}};
}
