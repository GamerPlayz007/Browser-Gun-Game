import * as T from 'three';
import {buildWorld} from './world.js';
import {createStaticCosmetic} from './static-cosmetic.js';
import {buildDustMatch65} from './dust_match65.js';
import {loadDustSource66} from './dust_source66.js';
import {makeWeapon,animateWeapon,makePlayer,setPlayerSkin56,setWeaponFinish,disposeWeaponRig,animatePlayer,markPlayerEvent,disposePlayer,setModelQuality67} from './models.js';
import {simulate,FIXED_DT} from './physics.js';
import {createJumpLatch62} from './input62.js';
import {leanOffset63} from './lean63.js';
import {createMovementControls63} from './controls63.js';
import {MAX_HEALTH64,healthPercent64,healthStatus64,wheelWeapon64} from './combat64.js';
import {ROOM_CODES65,validRoom65,kd65,roomLabel65} from './interface65.js';
import {movementCue53,cameraFeel53} from './flow53.js';
import {createMinimap} from './minimap.js';
import {createDisplay} from './display.js';
import {FrameMeter,formatDiagnostics} from './perf36.js';
import {captureRenderHealth46} from './polish46.js';
import {createPostProcessing} from './postfx.js';
import {AudioEngine} from './audio.js';
import {FEEDBACK52,makeCombatFeedback52,crosshairSpread52,tracerCount52,recoilFeel52} from './feedback52.js';
import {createUrbanAmbience45} from './living45.js';
import {matchPresentation,finishPresentation,matchNotice} from './match35.js';
import {createControlBeacon54} from './control54.js';
import {readyView55,spectatorCandidates55,cycleSpectator55,teamStandings55} from './competitive55.js';
import {createSquadLineup} from './squad_lineup69.js';
import {safeRead56,safeWrite56,safeName56,safeQuality56,skinColor56} from './preferences56.js';
import {createNetSync,observePong,ingestSnapshot,sampleRemote,cameraCorrection,syncStats,shouldReconcilePrediction} from './netcode33.js';
import {fireMode, makeTrigger, pressTrigger, releaseTrigger, takeTriggerPulse,
 predictedAmmo, reloadFraction, ammoState, damageBearing} from './combat32.js';
const $=id=>document.getElementById(id),clamp=T.MathUtils.clamp;
const audio=new AudioEngine();
const settings={sens:clamp(Number(safeRead56('cf-sens','1'))||1,.4,2.5),
 motion:safeRead56('cf-motion','true')!=='false',
 quality:safeQuality56(safeRead56('cf-quality-25','auto'))};
const qualityTier61=(detail=false)=>settings.quality==='auto'?(detail?'auto':'performance'):settings.quality;
const storedVolume56=clamp(Number(safeRead56('cf-volume','0.5'))||0,.0,1);
$('sensitivity').value=settings.sens;
$('motion').checked=settings.motion;$('quality').value=settings.quality;
$('volume').value=storedVolume56;audio.volume=storedVolume56;
let map,registry,renderer,world,scene,camera,viewScene,viewCamera,display,minimap,postfx,ambience45,controlBeacon54;
try{
 const catalog=await fetch('/api/maps');if(!catalog.ok)throw Error('Map list could not load.');registry=await catalog.json();
 const entry=registry.maps.find(m=>m.id===registry.default&&m.available);
 const response=await fetch(entry.url);if(!response.ok)throw Error('Arena data could not load.');map=await response.json();
 ambience45=createUrbanAmbience45(audio,map);ambience45.setQuality(qualityTier61());
 scene=new T.Scene();camera=new T.PerspectiveCamera(82,innerWidth/innerHeight,.06,600);camera.rotation.order='YXZ';
 renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.shadowMap.enabled=qualityTier61()!=='performance';renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.autoClear=false;
 renderer.info.autoReset=false; // Count draw calls across every compositor and weapon pass.
 $('viewport').appendChild(renderer.domElement);
 world=buildWorld(scene,map,{renderer,quality:qualityTier61()});
 controlBeacon54=createControlBeacon54(T,scene);
 postfx=createPostProcessing(renderer,scene,camera,settings.quality);viewScene=new T.Scene();viewCamera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.03,10);viewScene.add(new T.HemisphereLight(0xf0f8f5,0x697f7a,2.8));const light=new T.DirectionalLight(0xffe5bb,3);light.position.set(-2,4,3);viewScene.add(light);
}catch(e){$('status').textContent=e.message.includes('WebGL')?'3D graphics unavailable. Enable hardware acceleration and use Chrome or Edge.':e.message;throw e;}
let updateRigQuality67=()=>{};
display=createDisplay(renderer,[camera,viewCamera],enabled=>{
 const tier=qualityTier61(enabled);
 world.setQuality(tier);world.setDetail(enabled);
 renderer.shadowMap.enabled=tier!=='performance';
 postfx.setDetail(enabled);ambience45.setQuality(tier);updateRigQuality67(tier);
},settings.quality);
minimap=createMinimap($('minimap'),$('district-label'),map);
for(const entry of registry.maps){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name+(entry.available?'':' — coming later');option.disabled=!entry.available;$('map-select').append(option);}
$('map-select').value=map.id;
// Begin downloading the immutable, precompiled original district as soon as
// it is selected, overlapping network latency with the player's lobby setup.
$('map-select').addEventListener('change',async()=>{
 if($('map-select').value==='octavus'){
  try{const {loadOctavusPacked}=await import('./octavus_preview.js');
   await loadOctavusPacked();}
  catch(error){console.warn('Octavus preload failed (will retry on join)',error);}
  return;
 }
 if($('map-select').value!=='dust_corridor')return;
 try{
  const item=registry.maps.find(x=>x.id==='dust_corridor');
  if(!item)return;
  const response=await fetch(item.url);
  if(!response.ok)throw Error('Dust map metadata unavailable');
  const info=await response.json();
  await loadDustSource66(info.collisionSha256);
 }catch(error){console.warn('Dust scene preload failed (will retry on join)',error);}
});
async function loadArena(id){
 if(id===map.id)return;
 const entry=registry.maps.find(m=>m.id===id&&m.available);if(!entry)throw Error('This map is not available on this server.');
 const response=await fetch(entry.url);if(!response.ok)throw Error('Could not load the room map.');
 const next=await response.json();if(next.id!==id)throw Error('Map data mismatch. Refresh and try again.');
 const loadStart=performance.now();
 const dustSource=next.dustOriginal?await loadDustSource66(next.collisionSha256):null;
 const loadMs=performance.now()-loadStart;
 const nextScene=new T.Scene();
 let nextWorld;
 if(next.octavusOriginal){
  // An optional map must never prevent the lobby and other maps from loading.
  const {buildOctavusMatch}=await import('./octavus_match.js');
  nextWorld=await buildOctavusMatch(nextScene,next,{renderer,quality:qualityTier61()});
 }else if(next.dustOriginal){
  nextWorld=await buildDustMatch65(nextScene,next,{renderer,quality:qualityTier61(),source:dustSource});
 }else{
  nextWorld=buildWorld(nextScene,next,{renderer,quality:qualityTier61()});
 }
 clearVisualEffects52();controlBeacon54.dispose();world.dispose();postfx.dispose();
 scene=nextScene;world=nextWorld;controlBeacon54=createControlBeacon54(T,scene);
 if(next.dustOriginal){
  window.__crossfireDustMatch65={
   ready:true,usingMainRenderer:true,
   collisionTriangles:world.physics.source.soup.count,
   visualBatches:world.staticBatches,
   visualTriangles:world.originalVisualTriangles,
   packedScene:world.packedScene66,
   packedChunks:world.staticBatches,
   packedBytes:world.packedTransferBytes66,
   originalMaterialLayers:world.originalMaterialLayers,
   loadMs:Math.round(loadMs),
   sourceChecksum:next.collisionSha256,
   get active(){return map?.id==='dust_corridor'&&joined;}
  };
 }else delete window.__crossfireDustMatch65;
 if(next.octavusOriginal){
  window.__crossfireOctavus={
   ready:true,usingMainRenderer:true,collisionTriangles:world.physics.source.soup.count,
   visualTriangles:world.originalVisualTriangles,
   drawnSourceTriangles:world.renderedVisualTriangles,renderSections:world.staticBatches,
   loadMs:Math.round(loadMs),
   perimeterWalls:world.perimeterWallCount,
   perimeterPosts:world.perimeterPostCount,
   playableBounds:{...next.playBounds},
   // Live counters update when the optional original props/textures finish.
   get propDrawObjectsUnbatched(){return world?.nativePropDrawUnits||0;},
   get propInstancedDrawBatches(){return world?.nativePropDrawBatches||0;},
   get propInstancesVisible(){return world?.nativePropRendered||0;},
   get propInstancesTotal(){return world?.nativeProps||0;},
   get propOriginalModelTypes(){return world?.nativePropTypes||0;},
   get propSourceModelsMissing(){return world?.nativePropMissing||0;},
   get originalTextureImages(){return world?.originalTextureImages||0;},
   get sourceImagesRequested(){return world?.sourceImagesRequested||0;},
   get sourceImagesSkipped(){return world?.sourceImagesSkipped||0;},
   get qualityProfile(){return world?.sourceTextureProfile||'pending';},
   get gpuFrameDrawCalls(){return renderer.info.render.calls;},
   get gpuFrameTriangles(){return renderer.info.render.triangles;},
   get gpuTextures(){return renderer.info.memory.textures;},
   get currentFps(){return fps;}
  };
 }else delete window.__crossfireOctavus;
 postfx=createPostProcessing(renderer,scene,camera,settings.quality);map=next;
 ambience45.setMap(map);
 minimap=createMinimap($('minimap'),$('district-label'),map);$('map-select').value=id;
 display.quality.reset();display.resize(true);
}
const AETHER_NAMES68=['AETHER-9 SPECTER','AETHER-S9','AETHER-12 WARDRUM','AETHER-L7 LONGWATCH'];
 const AETHER_SHORT68=['A9','S9','W12','L7'];
 const displayWeaponName68=id=>AETHER_NAMES68[id]||weapons[id]?.name||'WEAPON';
 const displayWeaponShort68=id=>AETHER_SHORT68[id]||weapons[id]?.short||'W';
 const weapons=map.weapons,weaponModels=weapons.map(w=>makeWeapon(w.id));for(const g of weaponModels){g.visible=false;viewScene.add(g);}
const armoryCosmetics=weaponModels.map((rig,weaponId)=>createStaticCosmetic(rig,{finish:safeRead56('cf-gallery-finish','midnight'),weaponId}));
let selected=0,desiredWeapon64=null,weaponMags64=weapons.map(w=>w.mag),ws=null,myId=null,roomCode='',state=null,me=null,local=null,joined=false,keys={},aiming=false,yaw=0,pitch=0,seq=0,shotId=0,pendingShots=[];let pendingMoves=[],movementAccumulator=0,viewError=new T.Vector3(),rosterSignature='',scoreSignature='';
let groundVelocity=0,landingPulse=0,lastLocalGrounded=true,movementHint='',slideHopUntil53=0,visualLean63=0,lastReconcileAt=0,lastReconciledSeq=-1;
// Octavus only: lighter authoritative input cadence, unchanged render FPS.
const movementDt=()=>map.octavusOriginal?1/30:FIXED_DT;
let spectatorTarget55=null;
let ads=0,kick=0,eye=1.55,visualRecoil=0,lastShot=-10,flashUntil=0,hitUntil=0,damageUntil=0,elimUntil=0,noticeTimer,toastTimer,lastPhase='',lastSpawn=-1,switchVisual=0,rtt=50;
let clock=performance.now(),fpsFrames=0,fpsLast=performance.now(),fps=60,lastStep=0,shotRecovery=0,frameError=false,matchBannerUntil=0,crosshairSize52=24,flashPower52=1;
 let weaponViewYaw71=0,weaponViewPitch71=0;
const feedback52=makeCombatFeedback52();
const combatTrigger=makeTrigger();
const jumpLatch62=createJumpLatch62();
const movementControls63=createMovementControls63();
let netSync=createNetSync();
const frameMeter=new FrameMeter();
const opponents=new Map(),effects=[],hitGeometry=new T.IcosahedronGeometry(.035,0),hitMaterial=new T.MeshBasicMaterial({color:0xffc98a});
 const squadLineup69=createSquadLineup($('squad-canvas69'),$('roster'));
 function syncSquadVisibility69(){
  squadLineup69.setVisible(joined&&!$('room-panel').hidden&&
    ['lobby','results'].includes(state?.phase));
 }
let rigTier68=null,localWeaponFinishKey68='';
updateRigQuality67=tier=>{
 if(tier===rigTier68)return;
 rigTier68=tier;
 for(const rig of weaponModels)setModelQuality67(rig,tier);
 for(const rig of opponents.values())setModelQuality67(rig,tier);
 for(const cosmetic of armoryCosmetics)cosmetic.update(false,tier);
};
updateRigQuality67(qualityTier61());
const silhouette=id=>`<svg viewBox="0 0 220 60" aria-hidden="true"><path d="M20 19h${[100,80,130,135][id]}v24H70l-8 16H47l4-17H20z"/><path d="M5 16h22v30H5zM100 26h${[92,65,98,105][id]}v6h-${[92,65,98,105][id]}z"/>${id===3?'<rect x="89" y="5" width="45" height="13" rx="5"/><rect x="100" y="16" width="7" height="7"/>':'<rect x="65" y="12" width="48" height="7"/>'}${id===1?'<rect x="75" y="38" width="10" height="20"/>':''}</svg>`;
function makeCards(container){for(const w of weapons){const b=document.createElement('button');b.className='weapon-card'+(w.id===selected?' active':'');b.dataset.weapon=w.id;b.innerHTML=`<span class="number">0${w.id+1}</span>${silhouette(w.id)}<strong>${displayWeaponName68(w.id)}</strong><small>${w.type}</small>`;b.onclick=()=>selectWeapon(w.id);container.append(b);}}
makeCards($('home-weapons'));makeCards($('room-weapons'));for(const w of weapons){const s=document.createElement('span');s.className='slot';s.textContent=`${w.id+1} ${displayWeaponShort68(w.id)}`;$('weapon-slots').append(s);}
function send(data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
function selectWeapon(id){
 if(!Number.isInteger(id)||id<0||id>=weapons.length)return;
 if(joined){
  if(state?.mode==='gungame'&&state.phase!=='lobby'){
   toast('Gun Game: earn kills to advance.');return;
  }
  if(me?.hp<=0||!['lobby','playing'].includes(state?.phase))return;
  if(id===selected)return;
  // Optimistic slot selection makes rapid wheel notches cycle properly.
  selected=id;desiredWeapon64=id;updateSelection(id);switchVisual=.7;send({type:'weapon',weapon:id});
 }else{selected=id;updateSelection(id);}
}
function updateSelection(id){
 document.querySelectorAll('.weapon-card').forEach(b=>b.classList.toggle('active',Number(b.dataset.weapon)===id));
 [...$('weapon-slots').children].forEach((s,i)=>s.classList.toggle('active',i===id));
 $('crosshair').className='crosshair-aether70 '+(
  ['reticle-rifle70','reticle-smg70','reticle-shotgun70','reticle-sniper70'][id]||'reticle-rifle70');
 $('aim-ammo70').className='aim-ammo70 ammo-gun'+id+'71';
}
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,3000);}
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',3000);}
function locked(){return document.pointerLockElement===renderer.domElement;}
function controls(){
 const enabled=joined&&locked()&&me?.hp>0&&['lobby','playing'].includes(state?.phase);
 return {w:enabled&&!!keys.KeyW,a:enabled&&!!keys.KeyA,s:enabled&&!!keys.KeyS,d:enabled&&!!keys.KeyD,
  jump:enabled&&jumpLatch62.read(keys.Space),
  sprint:enabled&&(!!keys.ShiftLeft||!!keys.ShiftRight),
  ...movementControls63.input(keys,enabled),ads:enabled&&aiming};
}
function sendInput(){} // Input is sampled and sent by the fixed-step predictor below.
function predictStep(input){
 const command={type:'input',seq:++seq,spawn:me.spawn,yaw,pitch,...input};
 const stepDt=movementDt();
 local.yaw=yaw;local.motion_time+=stepDt;
 const beforeY=local.y;
 const wasSliding=local.slide_until>local.motion_time&&local.grounded;
 const beforeHeld=local.jump_held;
 if(map.dustOriginal||map.octavusOriginal)world.physics.simulate(local,input,stepDt,local.motion_time,weapons[me.weapon]);
 else simulate(local,input,stepDt,local.motion_time,map.boxes,weapons[me.weapon]);
 jumpLatch62.consume();
 if(wasSliding&&input.jump&&!beforeHeld&&local.vy>0&&!local.grounded)
  slideHopUntil53=performance.now()/1000+.48;
 if(!lastLocalGrounded&&local.grounded&&local.vy===0)landingPulse=Math.max(landingPulse,.16);
 lastLocalGrounded=!!local.grounded;
 groundVelocity=local.grounded?clamp((local.y-beforeY)/stepDt,-6,6):0;
 pendingMoves.push(command);send(command);
 if(pendingMoves.length>150){pendingMoves=[];local={...me};viewError.set(0,0,0);}
}
function resetInput(){$('map-panel').classList.remove('expanded');keys={};jumpLatch62.clear();movementControls63.reset();visualLean63=0;aiming=false;weaponViewYaw71=yaw;weaponViewPitch71=pitch;releaseTrigger(combatTrigger);sendInput();}
setInterval(()=>send({type:'ping',t:performance.now()}),2000);
function ammo(){
 if(!me)return 0;
 return predictedAmmo(selected===me.weapon?me.ammo:weaponMags64[selected],
   pendingShots,selected);
}
function tryTriggerFire(now){if(me&&takeTriggerPulse(combatTrigger,weapons[selected]))fireWeapon(now);}
function fireWeapon(now){if(!me||!locked()||me.hp<=0||!['lobby','playing'].includes(state.phase)||(me.reload>0&&selected===me.weapon))return;const w=weapons[selected];if(now-lastShot<w.interval||ammo()<=0)return;
 lastShot=now;shotId++;pendingShots.push({id:shotId,weapon:w.id});
  // The server validates and clamps this view timestamp to its own pose history.
  const viewServerTime=netSync.clockOffsetMs===null?undefined:
    (performance.now()-netSync.clockOffsetMs-netSync.delayMs)/1000;
  send({type:'shoot',shot:shotId,yaw,pitch,ads:aiming,viewServerTime});
 // Local recoil/audio/flash are immediate. Only server events show hits and kills.
 const feel52=recoilFeel52(w.id,aiming?1:0);
 audio.shot(w.id);kick=Math.min(.2,kick+w.kick*2);flashPower52=feel52.flashScale;flashUntil=now+(w.id===2?.072:.052);
 pitch=clamp(pitch+w.kick*(aiming?.55:1),-1.5,1.5);
 shotRecovery+=w.kick*(aiming?.55:1);
 visualRecoil=Math.min(.06,visualRecoil+w.kick*.3*feel52.shakeScale);
 $('ammo').textContent=ammo();
}
async function refreshRooms65(prefer){
 try{
  const response=await fetch('/api/rooms');
  if(!response.ok)throw Error('Room list unavailable');
  const data=await response.json();
  const el=$('code');
  const preferred=String(prefer||el.value||new URLSearchParams(location.search).get('room')||'MAX').toUpperCase();
  el.replaceChildren();
  for(const r of data.rooms||[]){
   if(!validRoom65(r.code))continue;
   const option=document.createElement('option');option.value=r.code;
   option.textContent=roomLabel65(r);
   option.disabled=r.active&&r.players>=r.max;el.append(option);
  }
  el.value=preferred;
  if(!el.value)el.selectedIndex=0;
 }catch{ /* The room can still be entered with a known premade code. */ }
}
async function enter(create){$('create').disabled=$('join').disabled=true;$('rejoin56').hidden=true;$('status').textContent='Connecting to arena…';try{let code=$('code').value.trim().toUpperCase();const response=await fetch(create?'/api/rooms':'/api/rooms/'+code,create?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapId:$('map-select').value})}:{});const data=await response.json();if(!response.ok)throw Error(data.error||'Connection failed.');if(create){code=data.room;$('code').value=code;}else if(data.players>=data.max)throw Error('This room is full.');
await loadArena(data.mapId);const name=safeName56($('name').value);safeWrite56('cf-name',name);const conn=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/${code}?name=${encodeURIComponent(name)}&weapon=${selected}`);ws=conn;const timeout=setTimeout(()=>{if(conn.readyState!==1)conn.close();},12000);conn.onopen=()=>clearTimeout(timeout);conn.onmessage=e=>{if(ws===conn)handle(JSON.parse(e.data));};conn.onclose=()=>{clearTimeout(timeout);if(ws===conn)disconnect('Connection closed. Rejoining creates a new player identity.',code);};conn.onerror=()=>{$('status').textContent='Could not connect. Check the server is awake.';};}catch(e){$('status').textContent=e.message;$('create').disabled=$('join').disabled=false;refreshRooms65();}}
function disconnect(message,rejoinCode56=null){
 $('aim-ammo70').hidden=true;
 squadLineup69.setVisible(false);squadLineup69.update([],null,null,'deathmatch');
 localWeaponFinishKey68='';
 const code56=validRoom65(rejoinCode56)?rejoinCode56.toUpperCase():null;
 $('rejoin56').hidden=!code56;if(code56)$('code').value=code56;
 netSync=createNetSync();frameMeter.reset();feedback52.reset();slideHopUntil53=0;spectatorTarget55=null;clearVisualEffects52();$('perf-panel').hidden=true;joined=false;state=me=local=null;myId=null;lastPhase='';lastSpawn=-1;pendingShots=[];pendingMoves=[];movementAccumulator=0;lastReconcileAt=0;lastReconciledSeq=-1;landingPulse=0;lastLocalGrounded=true;movementHint='';viewError.set(0,0,0);rosterSignature=scoreSignature='';matchBannerUntil=0;resetInput();document.exitPointerLock?.();for(const g of opponents.values())disposePlayer(g);opponents.clear();for(const id of ['hud','room-panel','death','results','scoreboard'])$(id).hidden=true;$('home').hidden=false;$('shade').style.opacity=1;$('status').textContent=message;$('create').disabled=$('join').disabled=false;refreshRooms65(code56);}
function scoreboard(players,body){
 body.replaceChildren();
 if(state?.mode==='botmatch'){
  const tr=document.createElement('tr');tr.className='bot-assault-heading';
  const td=document.createElement('td');td.colSpan=5;
  td.textContent='OPERATORS '+(state.aiScore||0)+' / '+(state.rules?.goal||20)+
   ' · BOTS '+(state.botScore||0)+' / '+(state.rules?.botGoal||12);
  tr.append(td);body.append(tr);
 }
 const scores=state?.standings?.length?state.standings:
  [...players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)
   .map((p,i)=>({...p,rank:i+1,streak:p.streak||0}));
 const isTeam=state.mode==='teamdeathmatch'||state.mode==='control';
 const groups=isTeam?teamStandings55({...state,standings:scores}):
   [{team:null,players:scores}];
 for(const group of groups){
  if(isTeam){
   const heading=document.createElement('tr');
   heading.className='team-group55 team-'+group.team;
   const cell=document.createElement('td');cell.colSpan=5;
   cell.textContent=group.team.toUpperCase()+' TEAM · '+group.score+' PTS';
   heading.append(cell);body.append(heading);
  }
  for(const p of group.players){
   const tr=document.createElement('tr');
   tr.className=(p.id===myId?'me ':'')+(p.team?'team-'+p.team:'');
   for(const value of [
    '#'+p.rank+'  '+p.name+(p.id===myId?' / YOU':''),
    p.kills,p.deaths,kd65(p.kills,p.deaths),p.streak||0
   ]){
    const td=document.createElement('td');
    td.textContent=value;tr.append(td);
   }
   body.append(tr);
  }
 }
}
function renderRoster(){
 const realPlayers=state.players.filter(p=>!p.bot);
 squadLineup69.update(realPlayers,state.host,myId,state.nextMode||state.mode);
 $('squad-size69').textContent=realPlayers.length+' / 8 OPERATORS';
 // Every participant follows the server-assigned room arena.
 $('room-map').textContent=map.name;
}
function uiRoom(){
 const host=state.host===myId,between=['lobby','results'].includes(state.phase);
 const ready55=readyView55(state,myId);
 $('ready-panel55').hidden=!between;
 $('ready-summary55').textContent=ready55.ready+' / '+ready55.total+' READY · '+(state.phase==='lobby'?'ALL REQUIRED':'REMATCH');
 $('ready-toggle55').disabled=!ready55.canReady;
 $('ready-toggle55').textContent=ready55.mine?'CANCEL READY':'MARK READY';
 $('ready-toggle55').classList.toggle('is-ready',ready55.mine);
 $('balance-teams55').hidden=!ready55.canBalance;
 const squadReady=ready55.total>0&&ready55.ready===ready55.total;
 $('start').hidden=!between;$('start').disabled=!host||(state.phase==='lobby'&&!squadReady);
 $('start').textContent=host?(state.phase==='results'?'START REMATCH →':squadReady?'START MATCH →':'WAITING FOR SQUAD READY'):'WAITING FOR HOST';
 $('resume').textContent=state.phase==='lobby'?'ENTER PRACTICE':state.phase==='results'?'VIEW RESULTS':'RESUME MATCH';
 $('room-title').textContent=state.phase==='lobby'?'Your squad.':state.phase==='results'?'Run it back.':'Stay in the fight.';
 $('room-hint').textContent=state.phase==='lobby'?
  (state.mode==='botmatch'?'Solo or co-op: defeat 20 AI opponents before they score 12 eliminations. Host starts the match.':
   state.mode==='control'?'Capture the Neon Beacon together. The host starts the match.':
   state.mode==='teamdeathmatch'?'Teams are assigned automatically. First team to 30 wins.':
   'Practice while your friends join. The host starts the match.'):
  state.phase==='results'?
  'The host can choose the next mode before starting the rematch.':
  'The match continues while this menu is open.';
 document.querySelectorAll('[data-mode]').forEach(b=>{
  b.classList.toggle('active',b.dataset.mode===(state.nextMode||state.mode));
  b.disabled=!host||!between;
 });
 document.querySelectorAll('#room-weapons button').forEach(b=>b.disabled=state.mode==='gungame'&&state.phase!=='lobby');
 syncSquadVisibility69();
}
function clearVisualEffects52(){
 for(const e of effects.splice(0)){
  e.obj.removeFromParent();
  if(e.own){e.obj.geometry.dispose();e.obj.material.dispose();}
 }
}
function addTracer(origin,end){
 if(!Array.isArray(origin)||!Array.isArray(end)||origin.length!==3||end.length!==3||
   ![...origin,...end].every(Number.isFinite))return;
 // Conservative cap prevents shotgun volleys from producing runaway meshes.
 while(effects.length>FEEDBACK52.maxTracers-2){
  const e=effects.shift();e.obj.removeFromParent();
  if(e.own){e.obj.geometry.dispose();e.obj.material.dispose();}
 }
 const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(...origin),new T.Vector3(...end)]);
 const line=new T.Line(geometry,new T.LineBasicMaterial({color:0xffdea6,transparent:true,opacity:.64,depthWrite:false}));
 scene.add(line);effects.push({obj:line,until:performance.now()/1000+.075,own:true});
 const dot=new T.Mesh(hitGeometry,hitMaterial);dot.position.set(...end);dot.scale.setScalar(1.25);
 scene.add(dot);effects.push({obj:dot,until:performance.now()/1000+.15});
}
function processEvent(e){
 const now=performance.now()/1000;
 if(e.type==='notice')notice(e.text);
 const matchText=matchNotice(e,myId,weapons);
 if(matchText){
  $('match-banner').textContent=matchText;
  matchBannerUntil=now+2.25;
  if(e.type==='tier_up'&&e.id===myId)audio.tier();
  else if(e.type==='streak'&&e.id===myId)audio.streak();
  else if(e.type==='round_end')audio.finish(e.winnerId===myId||
   (Boolean(e.winnerTeam)&&e.winnerTeam===me?.team)||
   (state?.mode==='botmatch'&&e.winner==='PLAYERS'));
  else if(e.type==='control_status'&&e.team===me?.team&&!e.contested)
   audio.tone(780,.12,.065,'triangle');
 }
 if(e.type==='shot'){if(e.id!==myId)markPlayerEvent(opponents.get(e.id),'shot',now);for(const index of tracerCount52(settings.quality,e.ends?.length))addTracer(e.origin,e.ends[index]);if(e.id!==myId&&local){const dx=e.origin[0]-local.x,dz=e.origin[2]-local.z,dist=Math.hypot(dx,dz);audio.shot(e.weapon,Math.max(0,1-dist/45)*.35,clamp((dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,dist),-1,1));}}
 if(e.type==='hit'){
   if(e.victim!==myId)markPlayerEvent(opponents.get(e.victim),'hit',now);
   // Only a server-authoritative 'hit' updates confirmation and numbers.
   const hit=feedback52.confirm(e,myId,now);
   if(hit){
    hitUntil=hit.until;
    $('hitmarker').classList.toggle('critical',hit.head);
    $('damage-number').classList.toggle('critical',hit.head);
    $('damage-number').textContent=(hit.head?'HEADSHOT / ':'')+hit.damage;
    audio.confirm52(hit.head,hit.killed);
   }
   if(e.victim===myId){
    damageUntil=now+.32;
    const bearing=damageBearing(e.origin,local||me,yaw);
    if(bearing!==null)$('damage-direction').style.setProperty('--bearing',bearing+'deg');
    audio.burst(.12,.16,500);
   }
  }
 if(e.type==='kill'){const div=document.createElement('div');div.className='feed-row';div.append(document.createTextNode(e.killer));const mid=document.createElement('span');mid.textContent=displayWeaponShort68(e.weapon)+(e.head?' ◇':' →');div.append(mid,document.createTextNode(e.victim));$('feed').prepend(div);while($('feed').children.length>5)$('feed').lastChild.remove();setTimeout(()=>div.remove(),5000);if(e.killerId===myId){$('elimination').textContent=(e.head?'HEADSHOT / ':'ELIMINATED / ')+e.victim+(e.siphon>0?' · +'+e.siphon+' SIPHON':'');elimUntil=now+1.8;audio.kill();}if(e.victimId===myId)$('killed-by').textContent=`${e.killer} · ${displayWeaponName68(e.weapon)}`;}
}
function handle(data){if(data.type==='manual_respawn_result65'){toast(data.message||'Respawn unavailable.');return;}if(data.type==='welcome'){netSync=createNetSync();seq=0;shotId=0;feedback52.reset();if(data.mapId!==map.id){ws?.close();disconnect('Map mismatch. Reload the page.');return;}$('room-map').textContent=map.name;$('score-map').textContent=map.name;myId=data.id;roomCode=data.room;joined=true;history.replaceState(null,'',`?room=${roomCode}`);$('room-code').textContent=roomCode;$('home').hidden=true;$('hud').hidden=false;$('room-panel').hidden=false;$('shade').style.opacity=0;return;}if(data.type==='pong'){if(observePong(netSync,data.t,performance.now(),data.serverTime))rtt=netSync.rttMs;return;}if(data.type!=='state'||data.mapId!==map.id)return;
 if(!ingestSnapshot(netSync,data,performance.now()))return;
 const previous=me;state=data;me=data.players.find(p=>p.id===myId);if(!me)return;const now=performance.now()/1000;
 // Server-picked finishes are shared by everyone in the room, and rerolled on spawn.
 if(Array.isArray(me.weapon_finishes)&&me.weapon_finishes.length===4){
  const finishKey=me.weapon_finishes.join(',');
  if(finishKey!==localWeaponFinishKey68){
   for(let i=0;i<weaponModels.length;i++)setWeaponFinish(weaponModels[i],me.weapon_finishes[i]);
   localWeaponFinishKey68=finishKey;
  }
 }
 pendingShots=pendingShots.filter(s=>s.id>me.ack_shot);
 if(!local||me.spawn!==lastSpawn){
  local={...me};lastReconcileAt=0;lastReconciledSeq=me.seq;lastSpawn=me.spawn;desiredWeapon64=null;selected=me.weapon;weaponMags64=weapons.map(w=>w.mag);updateSelection(selected);pendingMoves=[];movementAccumulator=0;landingPulse=0;visualLean63=0;movementControls63.reset();lastLocalGrounded=!!me.grounded;movementHint='';viewError.set(0,0,0);pendingShots=[];lastShot=-10;shotRecovery=0;feedback52.reset();slideHopUntil53=0;spectatorTarget55=null;releaseTrigger(combatTrigger);
  yaw=me.yaw;pitch=0;
 }else{
  // Every unacknowledged command must be replayed, or the predicted position
  // loses exactly the time that has not yet reached the server. Slicing off
  // the oldest commands caused a snap backwards on EACH new snapshot.
  pendingMoves=pendingMoves.filter(cmd=>cmd.seq>me.seq&&cmd.spawn===me.spawn);
  const importedMesh=!!(map.dustOriginal||map.octavusOriginal);
  // Keep local prediction moving during heavy network backlog. Rewinding a
  // detailed BVH collision mesh with dozens of commands causes frame stalls.
  // Wait until enough commands are acknowledged, then replay ALL of the rest.
  const shouldReconcile=shouldReconcilePrediction(me.seq,lastReconciledSeq,
   pendingMoves.length,importedMesh,now-lastReconcileAt);
  if(shouldReconcile){
   lastReconcileAt=now;lastReconciledSeq=me.seq;
   const old=new T.Vector3(local.x+viewError.x,local.y+viewError.y,local.z+viewError.z);
   local={...me};
   const stepDt=movementDt();
   for(const cmd of pendingMoves){
    local.yaw=cmd.yaw;local.motion_time+=stepDt;
    if(importedMesh)world.physics.simulate(local,cmd,stepDt,local.motion_time,weapons[me.weapon]);
    else simulate(local,cmd,stepDt,local.motion_time,map.boxes,weapons[me.weapon]);
   }
   // Smooth the small residual server corrections, but never conceal a
   // genuine respawn or a massive world-position disagreement.
   const correction=cameraCorrection(old,local,6);
   viewError.set(correction.x,correction.y,correction.z);
  }
 }
 weaponMags64[me.weapon]=me.ammo;
 if(!previous||previous.weapon!==me.weapon){
  if(desiredWeapon64===null||desiredWeapon64===me.weapon){
   selected=me.weapon;desiredWeapon64=null;updateSelection(selected);
  }
  switchVisual=1;
 }
 $('kills65').textContent=String(me.kills||0);
 $('deaths65').textContent=String(me.deaths||0);
 $('kd65').textContent=kd65(me.kills,me.deaths);
 $('health').textContent=Math.ceil(me.hp);
 $('healthbar').style.width=healthPercent64(me.hp,data.maxHp||MAX_HEALTH64)+'%';
 $('protection').textContent=healthStatus64(me,data.maxHp||MAX_HEALTH64);
 $('ammo').textContent=ammo();$('mag').textContent=' / '+weapons[selected].mag;
 $('weapon-name').textContent=displayWeaponName68(selected);
 $('reload-label').textContent=me.reload>0&&selected===me.weapon?`RELOADING ${me.reload.toFixed(1)}s`:ammo()===0?'EMPTY — R TO RELOAD':'R / RELOAD';
  $('fire-mode-label').textContent=fireMode(weapons[selected])==='auto'?'AUTO':'SINGLE CLICK';
  $('ammo-panel').classList.toggle('low-ammo',ammoState(ammo(),weapons[selected].mag)==='low');
  $('ammo-panel').classList.toggle('empty-ammo',ammoState(ammo(),weapons[selected].mag)==='empty');
  $('ammo-panel').classList.toggle('reloading',me.reload>0);
  $('reload-progress').style.width=(100*reloadFraction(selected===me.weapon?me.reload:0,weapons[selected].reload))+'%';
 const match=matchPresentation(data,me);
 const spectateChoices55=spectatorCandidates55(data,myId);
 if(!spectateChoices55.some(p=>p.id===spectatorTarget55))
  spectatorTarget55=spectateChoices55[0]?.id||null;
 const spectating55=me.hp<=0&&data.phase==='playing'&&!!spectatorTarget55;
 $('death').hidden=me.hp>0||data.phase!=='playing';
 $('spectate-panel55').hidden=!spectating55;
 $('spectate-label55').textContent=spectating55?
  'FOLLOWING '+(spectateChoices55.find(p=>p.id===spectatorTarget55)?.name||'PLAYER'):
  (data.mode==='teamdeathmatch'||data.mode==='control'?'NO TEAMMATE AVAILABLE':'NO PLAYER AVAILABLE');
 $('respawn-time').textContent=Math.ceil(me.respawn);
 $('timer').textContent=data.phase==='lobby'?'PRACTICE':
  `${Math.floor(match.remaining/60)}:${String(Math.floor(match.remaining%60)).padStart(2,'0')}`;
 $('mode-label').textContent=({deathmatch:'DEATHMATCH',gungame:'GUN GAME',
  teamdeathmatch:'TEAM DEATHMATCH',control:'CONTROL POINT',botmatch:'BOT ASSAULT'})[data.mode]||'DEATHMATCH';
 $('objective').textContent=match.objective;
 $('round-label').textContent=`ROUND ${Math.max(1,match.round)} · ${match.rankText}`;
 $('lead-status').textContent=match.leaderText;
 $('team-bar').hidden=!(match.teamMode||match.botMode);
 $('team-bar').classList.toggle('bot-assault-ui',match.botMode);
 $('team-bar').classList.toggle('contested',!!data.objective?.contested);
 $('team-azure').textContent=match.botMode?'OPERATORS '+match.aiScore+' / '+match.goal:'AZURE '+match.azure;
 $('team-ember').textContent=match.botMode?'BOTS '+match.botScore+' / '+match.botGoal:'EMBER '+match.ember;
 $('team-control').textContent=match.botMode?'BOT ASSAULT':data.mode==='control'?match.pointStatus:'TEAM SCORE';
 $('progress').style.width=match.progress+'%';
 $('countdown').hidden=data.phase!=='countdown';
 $('countdown').textContent=Math.ceil(data.countdown);
 $('slide-label').textContent=me.slide>0?'C / SLIDING':'C / SLIDE · CTRL / CROUCH';
 const present=new Set();for(const p of data.players){if(p.id===myId)continue;present.add(p.id);let g=opponents.get(p.id);
  const visualSkin=p.bot?0xef6a86:skinColor56(p.skin);
  if(!g){g=makePlayer(p.name,visualSkin,p.weapon,p.weapon_finishes?.[p.weapon]??0);setModelQuality67(g,qualityTier61());scene.add(g);g.position.set(p.x,p.y,p.z);opponents.set(p.id,g);}
  setPlayerSkin56(g,visualSkin);
  if(g.userData.team54!==p.team){
   g.userData.team54=p.team;
   g.userData.tag.material.color.set(p.bot?'#ff8ba7':p.team==='azure'?'#7de4ff':p.team==='ember'?'#ffb69b':'#ffffff');
   g.userData.spawnRing.material.color.set(p.bot?'#ff6586':p.team==='azure'?'#7de4ff':p.team==='ember'?'#ffb69b':'#67ede5');
  }
  if(g.userData.target?.spawn!==p.spawn){g.position.set(p.x,p.y,p.z);g.userData.animation.spawn=undefined;}g.userData.target=p;g.visible=p.hp>0;if(g.userData.gun.userData.id!==p.weapon){
   disposeWeaponRig(g.userData.gun);
   const gun=makeWeapon(p.weapon,false,p.weapon_finishes?.[p.weapon]??0);
   setModelQuality67(gun,qualityTier61());
   gun.scale.setScalar(.8);gun.position.set(.26,1.1,-.34);
   g.userData.body.add(gun);g.userData.gun=gun;
  }else if(Array.isArray(p.weapon_finishes)){
   setWeaponFinish(g.userData.gun,p.weapon_finishes[p.weapon]);
  }}
 for(const [id,g] of opponents)if(!present.has(id)){disposePlayer(g);opponents.delete(id);}for(const t of data.targets)world.targets.get(t.id).visible=t.hp>0;
 const rosterKey=JSON.stringify([data.host,data.mode,data.nextMode,data.players.map(p=>[p.id,p.name,p.team,p.ready,p.bot,p.skin])]);
 if(rosterKey!==rosterSignature){renderRoster();rosterSignature=rosterKey;}
 const scoreKey=JSON.stringify([data.mode,data.round,data.standings,data.teamScores]);
 if(scoreKey!==scoreSignature){scoreboard(data.players,$('scores'));scoreSignature=scoreKey;}
 uiRoom();
 if(data.phase!==lastPhase){
  if(data.phase==='countdown'){resetInput();$('room-panel').hidden=true;$('results').hidden=true;audio.tone(600,.1,.1);if(!locked())notice('Click the arena to capture your mouse.');}
  if(data.phase==='playing'){notice('GO — make it count.');audio.tone(1100,.16,.13);}
  if(data.phase==='results'){
   resetInput();document.exitPointerLock?.();
   $('room-panel').hidden=true;$('results').hidden=false;
   const outcome=finishPresentation(data);
   $('winner').textContent=outcome.headline;
   $('result-subtitle').textContent=`${map.name} / ${data.mode.toUpperCase()} · ${outcome.detail}`;
   $('match-award').textContent=outcome.podium;
   const table=$('scoreboard').querySelector('table').cloneNode(true);
   table.querySelector('tbody').removeAttribute('id');
   $('final-scores').replaceChildren(table);
  }
  lastPhase=data.phase;
 }
 $('rematch').disabled=data.host!==myId;$('rematch').textContent=data.host===myId?'PLAY AGAIN →':'WAITING FOR HOST';
 for(const e of data.events)processEvent(e);
}
function frame(ms){try{const now=ms/1000,rawMs=ms-clock,dt=Math.min(rawMs/1000,.2);clock=ms;display.frame(rawMs);frameMeter.record(rawMs,!document.hidden);
 // A background tab should not burn the school laptop's shared iGPU/RAM.
 // The authoritative server continues the room; visibilitychange resets
 // prediction and frame meters before we resume rendering.
 if(document.hidden){fpsFrames=0;fpsLast=ms;movementAccumulator=0;return;}
 fpsFrames++;
 controlBeacon54.update(state?.objective,now,joined&&state?.mode==='control');
 if(ms-fpsLast>600){
  fps=Math.round(fpsFrames*1000/(ms-fpsLast));fpsLast=ms;fpsFrames=0;
  const net=syncStats(netSync,ms);
  const queued=me?.inputQueue??0,behind=pendingMoves.length;
  const networkStalled=joined&&(net.stale||behind>40||queued>18);
  $('metrics').textContent=`${fps} FPS · ${Number.isFinite(net.rttMs)?Math.round(net.rttMs):'--'} MS · ±${Math.round(net.jitterMs)} JITTER · ${networkStalled?'SYNCING · ':''}${joined?behind+' PENDING · ':''}${display.label()}`;
  if(!$('perf-panel').hidden){
   $('perf-details').textContent=formatDiagnostics(frameMeter.summary(),net,
    captureRenderHealth46(renderer,scene,world,display));
  }
 }
 world.animate(now,local);
 ambience45.update(now,local,joined&&!!me&&me.hp>0&&locked()&&!document.hidden,yaw);
 if(joined&&me&&local){const input=controls();
  minimap.draw(local,yaw,now,{objective:state?.objective,players:state?.players,
   team:me?.team,mode:state?.mode,meId:myId});
  if(me.hp>0&&['lobby','playing'].includes(state.phase)){
   movementAccumulator+=dt;
   const stepDt=movementDt();
   let steps=0;while(movementAccumulator>=stepDt&&steps++<6){predictStep(controls());movementAccumulator-=stepDt;}if(steps>=6)movementAccumulator=Math.min(movementAccumulator,stepDt*2);
  }else movementAccumulator=0;
  viewError.multiplyScalar(Math.exp(-dt*9));
  tryTriggerFire(now);
  if(now-lastShot>.12&&shotRecovery>0){const recovery=Math.min(shotRecovery,dt*.12);pitch-=recovery;shotRecovery-=recovery;}
  ads+=(Number(aiming&&locked()&&me.reload<=0)-ads)*Math.min(1,dt*16);const crouched=local.crouch?1:0;
   const sliding=local.grounded&&local.slide_until>local.motion_time?1:0;
   eye+=((crouched?.9:1.55)-eye)*Math.min(1,dt*15);
  const localSpeed=Math.hypot(local.vx,local.vz),moving=localSpeed>.5;
   const bob=settings.motion&&moving&&local.grounded?Math.sin(now*12)*.018*(1-ads):0;
   const cue=movementCue53(local,input,now,slideHopUntil53);
   if(cue!==movementHint){movementHint=cue;$('movement-state').textContent=cue;
    $('movement-state').classList.toggle('flow-action',cue==='SLIDE HOP'||cue==='VAULTING'||cue==='WALL KICK');}
   landingPulse=Math.max(0,landingPulse-dt*.95);
  const flow53=cameraFeel53(local,yaw,{motion:settings.motion,aim:ads});
  visualLean63+=(Number(local.lean||0)-visualLean63)*Math.min(1,dt*17);
  const peek63=leanOffset63(yaw,visualLean63);
  camera.position.set(local.x+viewError.x+local.vx*movementAccumulator+peek63.x,
   local.y+viewError.y+(local.grounded?groundVelocity:local.vy)*movementAccumulator+eye+bob
   -(settings.motion?landingPulse*.24:0)+flow53.vaultDip,
   local.z+viewError.z+local.vz*movementAccumulator+peek63.z);
  camera.rotation.set(pitch+visualRecoil*(1-ads),yaw,flow53.roll-visualLean63*.15,'YXZ');
  const targetFov53=T.MathUtils.lerp(input.sprint?88:82,selected===3?26:54,ads)+flow53.fovBoost;
  camera.fov=T.MathUtils.lerp(camera.fov,targetFov53,Math.min(1,dt*13));
  camera.updateProjectionMatrix();
  for(const [id,g] of opponents){const shown=sampleRemote(netSync,id,ms);const p=shown?{...g.userData.target,...shown}:g.userData.target;if(!p)continue;
    // 20 Hz snapshots render on a delayed server-time timeline. No double lerp.
    g.position.set(p.x,p.y,p.z);g.userData.render55=p;animatePlayer(g,p,now);const distance=camera.position.distanceTo(g.position);
    g.userData.tag.visible=p.hp>0&&distance<55;
    // Sprites already use depth-testing, so walls occlude their labels.
    const size=Math.min(2.1,Math.max(1.45,distance*.035));
    g.userData.tag.scale.set(size,size*.187,1);}
  // Dead players may watch eligible active players during the respawn timer.
  // Team modes restrict the target list to their own team.
  if(me.hp<=0&&state.phase==='playing'&&spectatorTarget55){
   const subject=opponents.get(spectatorTarget55);
   const p=subject?.userData.render55||subject?.userData.target;
   if(subject&&p&&p.hp>0){
    const eye55=p.crouch?.88:1.55;
    const spectateLean63=leanOffset63(p.yaw||0,p.lean||0);
    camera.position.set(subject.position.x+spectateLean63.x,subject.position.y+eye55,subject.position.z+spectateLean63.z);
    camera.rotation.set(Number.isFinite(p.pitch)?p.pitch:0,
      Number.isFinite(p.yaw)?p.yaw:0,-(p.lean||0)*.15,'YXZ');
    camera.fov=T.MathUtils.lerp(camera.fov,82,Math.min(1,dt*14));
    camera.updateProjectionMatrix();
   }
  }
  for(let i=0;i<4;i++)weaponModels[i].visible=i===selected&&locked()&&me.hp>0&&state.phase!=='results'&&!(selected===3&&ads>.95);
  for(let i=0;i<armoryCosmetics.length;i++)armoryCosmetics[i].update(weaponModels[i].visible,rigTier68);
  // Camera-space movement drives the viewmodel's distinct walking, sideways
   // shifting, and slide sway. Mouse-turn lag is visually eased inside rig.
   const rightSpeed71=local.vx*Math.cos(yaw)-local.vz*Math.sin(yaw);
   const forwardSpeed71=-local.vx*Math.sin(yaw)-local.vz*Math.cos(yaw);
   const deltaYaw71=Math.atan2(Math.sin(yaw-weaponViewYaw71),Math.cos(yaw-weaponViewYaw71));
   const deltaPitch71=pitch-weaponViewPitch71;
   weaponViewYaw71=yaw;weaponViewPitch71=pitch;
   const gun=weaponModels[selected];
   animateWeapon(gun,{time:now,ads,
    reload:selected===me.weapon&&me.reload>0?me.reload/weapons[selected].reload:0,
    kick,moving:locked()&&moving,speed:localSpeed,
    sprint:input.sprint&&moving,slide:sliding,crouch:crouched,
    motion:settings.motion,switched:switchVisual,firing:now-lastShot<.23,
    strafe:T.MathUtils.clamp(rightSpeed71/7,-1,1),
    forwardSpeed:T.MathUtils.clamp(forwardSpeed71/7,-1,1),
    lookX:T.MathUtils.clamp(deltaYaw71/.025,-1,1),
    lookY:T.MathUtils.clamp(deltaPitch71/.025,-1,1),
    grounded:!!local.grounded,landing:settings.motion?landingPulse:0
   });
   gun.userData.flash.visible=now<flashUntil;gun.userData.flash.rotation.z=now*21;
  gun.userData.flash.scale.set(flashPower52,flashPower52,flashPower52*2);
  kick=Math.max(0,kick-dt*.7);visualRecoil*=Math.exp(-dt*18);switchVisual=Math.max(0,switchVisual-dt*5);
  $('scope').className=selected===3?'ads-sniper':selected===2?'ads-shotgun':'ads-reflex';
  $('scope').hidden=!(ads>.35&&locked()&&me.hp>0&&state.phase!=='results');
   $('scope').style.opacity=String(Math.min(1,Math.max(0,(ads-.35)/.4)));
  const spread52=crosshairSpread52({speed:localSpeed,grounded:local.grounded,
    crouch:local.crouch,aim:ads,recoil:kick,sprint:input.sprint,weapon:selected});
  crosshairSize52+=(spread52-crosshairSize52)*Math.min(1,dt*15);
  $('crosshair').style.opacity=me.hp<=0?'0':String(1-Math.min(1,Math.max(0,(ads-.28)/.47)));
  $('crosshair').style.width=$('crosshair').style.height=crosshairSize52.toFixed(1)+'px';
  // Display predicted, server-confirmed ammo beside the aim indicator.
  // Only the local HUD changes; the shooter and netcode stay untouched.
  const aimAmmo=$('aim-ammo70');
  aimAmmo.hidden=!(locked()&&me.hp>0&&state.phase!=='results');
  if(!aimAmmo.hidden){
   const remaining=Math.max(0,ammo()),capacity=weapons[selected].mag;
   const recharging=selected===me.weapon&&me.reload>0;
   const stateLabel=recharging?'RECHARGING':remaining===0?'EMPTY':displayWeaponShort68(selected);
   if($('aim-ammo-count70').textContent!==String(remaining))
    $('aim-ammo-count70').textContent=String(remaining);
   if($('aim-ammo-max70').textContent!==String(capacity))
    $('aim-ammo-max70').textContent=String(capacity);
   if($('aim-ammo-state70').textContent!==stateLabel)
    $('aim-ammo-state70').textContent=stateLabel;
   aimAmmo.classList.toggle('ammo-low70',!recharging&&remaining>0&&remaining<=Math.ceil(capacity*.25));
   aimAmmo.classList.toggle('ammo-empty70',!recharging&&remaining===0);
   aimAmmo.classList.toggle('ammo-reload70',recharging);
   $('aim-ammo-fill70').style.width=(recharging?
    100*reloadFraction(me.reload,weapons[selected].reload):
    100*remaining/Math.max(1,capacity)).toFixed(1)+'%';
  }
  if(moving&&local.grounded&&locked()&&now-lastStep>(input.sprint?.28:.4)){audio.step(input.sprint?.07:.045);lastStep=now;}
 }else{$('aim-ammo70').hidden=true;const anchor=map.center||{x:0,z:0};camera.position.set(anchor.x+7+Math.sin(now*.045)*2,map.octavusOriginal?16:9,anchor.z+30+Math.cos(now*.045)*2);camera.lookAt(anchor.x-5,map.octavusOriginal?2:3,anchor.z+14);camera.fov=65;camera.updateProjectionMatrix();for(const g of weaponModels)g.visible=false;}
 for(let i=effects.length-1;i>=0;i--)if(now>effects[i].until){const e=effects.splice(i,1)[0];e.obj.removeFromParent();if(e.own){e.obj.geometry.dispose();e.obj.material.dispose();}}
 $('damage').style.opacity=now<damageUntil?.65:0;$('damage-direction').style.opacity=now<damageUntil?1:0;const sample52=feedback52.sample(now);
 $('hitmarker').style.opacity=$('damage-number').style.opacity=sample52.alpha;
 $('hitmarker').style.transform='translate(-50%,-50%) scale('+sample52.scale.toFixed(3)+')';
 $('damage-number').style.transform='translateY('+(-6*sample52.strength).toFixed(2)+'px)';$('elimination').style.opacity=now<elimUntil?1:0;
 $('match-banner').style.opacity=now<matchBannerUntil?1:0;
  renderer.info.reset();renderer.clear();postfx.setSize(display.buffer.width,display.buffer.height);postfx.render(now);if(joined&&me&&locked()&&me.hp>0&&state.phase!=='results'){renderer.clearDepth();renderer.render(viewScene,viewCamera);}
 }catch(e){if(!frameError){frameError=true;toast('Rendering error: '+e.message);console.error(e);}}}
renderer.setAnimationLoop(frame);
async function capture(){audio.unlock();if(state?.phase==='results'){$('results').hidden=false;$('room-panel').hidden=true;return;}try{await renderer.domElement.requestPointerLock();}catch{toast('Open this game in its own browser tab to capture the mouse.');}}
$('resume').onclick=capture;renderer.domElement.addEventListener('click',()=>{if(joined&&!locked()&&$('room-panel').hidden&&state.phase!=='results')capture();});
document.addEventListener('pointerlockchange',()=>{if(!joined)return;resetInput();$('room-panel').hidden=locked()||state?.phase==='results';syncSquadVisibility69();});
document.addEventListener('mousemove',e=>{if(!locked())return;const sens=.002*settings.sens*T.MathUtils.lerp(1,me?.weapon===3?.32:.65,ads);yaw-=e.movementX*sens;pitch=clamp(pitch-e.movementY*sens,-1.5,1.5);});
document.addEventListener('mousedown',e=>{if(!locked())return;if(e.button===0){pressTrigger(combatTrigger);if(me&&ammo()<=0&&me.reload<=0)audio.dry();tryTriggerFire(performance.now()/1000);}if(e.button===2){aiming=true;sendInput();}});document.addEventListener('mouseup',e=>{if(e.button===0)releaseTrigger(combatTrigger);if(e.button===2){aiming=false;sendInput();}});document.addEventListener('contextmenu',e=>{if(joined)e.preventDefault();});
// One notch selects the next slot; wheel events do not scroll the page in-game.
renderer.domElement.addEventListener('wheel',e=>{
 if(!joined||!locked()||me?.hp<=0||!['lobby','playing'].includes(state?.phase))return;
 e.preventDefault();
 if(e.deltaY!==0)selectWeapon(wheelWeapon64(selected,e.deltaY,weapons.length));
},{passive:false});
function cycleCurrentSpectator55(direction){
 if(!state||!myId)return;
 spectatorTarget55=cycleSpectator55(spectatorTarget55,
   spectatorCandidates55(state,myId),direction);
 if(spectatorTarget55){
  const p=state.players.find(player=>player.id===spectatorTarget55);
  $('spectate-label55').textContent='FOLLOWING '+(p?.name||'PLAYER');
 }
}
document.addEventListener('keydown',e=>{if(!joined)return;
 if(me?.hp<=0&&state?.phase==='playing'&&
    (e.code==='ArrowLeft'||e.code==='ArrowRight')){
  e.preventDefault();if(!e.repeat)
   cycleCurrentSpectator55(e.code==='ArrowRight'?1:-1);
  return;
 }
 if(e.code==='F7'){e.preventDefault();if(!e.repeat)$('perf-panel').hidden=!$('perf-panel').hidden;return;}if(e.code==='F8'){e.preventDefault();if(!e.repeat)copyDebugReport51();return;}if(e.code==='Tab'&&locked()){e.preventDefault();$('scoreboard').hidden=false;return;}
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(['Tab','Space','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','KeyC','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
 if(!e.repeat&&locked()&&me?.hp>0&&(e.code==='ControlLeft'||e.code==='ControlRight')){
  movementControls63.toggleCrouch();
 }
 if(e.code==='Space'&&!e.repeat&&locked()&&me?.hp>0)jumpLatch62.press();
 keys[e.code]=true;if(e.code==='Tab')$('scoreboard').hidden=false;if(e.code==='KeyM')$('map-panel').classList.add('expanded');if(e.repeat)return;if(e.code==='KeyR'&&locked()){send({type:'reload'});if(ammo()<weapons[selected].mag&&(!me.reload||selected!==me.weapon))audio.reload();}if(/^Digit[1-4]$/.test(e.code))selectWeapon(Number(e.code.slice(-1))-1);});
document.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')$('scoreboard').hidden=true;if(e.code==='KeyM')$('map-panel').classList.remove('expanded');});window.addEventListener('blur',()=>{resetInput();$('scoreboard').hidden=true;});
function createDebugReport51(){
 const net=syncStats(netSync,performance.now());
 const data=captureRenderHealth46(renderer,scene,world,display);
 return ['CROSSFIRE V3.1 DAYBREAK / PLAYTEST REPORT',
   'Map: '+(map?.name||map?.id||'unknown'),
   'Connection: '+(joined?'joined':'not joined'),
   'Quality setting: '+settings.quality,
   'Movement simulation: '+Math.round(1/movementDt())+' Hz',
   'Unacknowledged movement inputs: '+pendingMoves.length,
   'Last movement acknowledged/reconciled: '+(me?.seq??'unknown')+' / '+lastReconciledSeq,
   'Server input queue: '+(me?.inputQueue??'unknown'),
   'Dropped stale inputs (server): '+(me?.inputOverruns??'unknown'),
   ...(world?.isOctavusMatch?[
    'Octavus source triangles: '+world.originalVisualTriangles,
    'Octavus rendered source triangles: '+world.renderedVisualTriangles,
    'Octavus source mesh render sections: '+world.staticBatches,
    'Octavus authentic mapmodel placements: '+world.nativeProps,
    'Octavus original prop draw objects (before instancing): '+world.nativePropDrawUnits,
    'Octavus instanced prop draw batches: '+world.nativePropDrawBatches,
    'Octavus visible model instances: '+world.nativePropRendered,
    'Octavus native model types loaded: '+world.nativePropTypes,
    'Octavus native model placements missing: '+world.nativePropMissing,
    'Octavus source texture profile: '+world.sourceTextureProfile,
    'Octavus original textures loaded: '+world.originalTextureImages,
    'Octavus source textures requested/skipped: '+world.sourceImagesRequested+'/'+world.sourceImagesSkipped,
    'Actual WebGL draw calls (last frame): '+renderer.info.render.calls,
    'Actual WebGL triangles (last frame): '+renderer.info.render.triangles,
    'Allocated WebGL texture objects: '+renderer.info.memory.textures
   ]:[]),
   ...(world?.isDustCorridor65?[
    'Dust visual triangles: '+world.originalVisualTriangles,
    'Dust render sections: '+world.staticBatches,
    'Dust original texture layers: '+world.originalMaterialLayers,
    'Dust packed source: '+world.packedScene66
   ]:[]),
   'Capture: '+new Date().toISOString(),
   '',
   formatDiagnostics(frameMeter.summary(),net,data)].join('\n');
}
async function copyDebugReport51(){
 const report=createDebugReport51();
 try{
  await navigator.clipboard.writeText(report);
  toast('Playtest report copied. Paste it into the bug report chat.');
 }catch{
  toast('Could not copy automatically. Use F7 to read the diagnostics.');
 }
}
$('copy-diagnostics').onclick=copyDebugReport51;
$('spectate-prev55').onclick=()=>cycleCurrentSpectator55(-1);
$('spectate-next55').onclick=()=>cycleCurrentSpectator55(1);
$('ready-toggle55').onclick=()=>send({type:'ready',ready:!me?.ready});
$('balance-teams55').onclick=()=>send({type:'balance'});
$('diagnostics-toggle').onclick=()=>{$('perf-panel').hidden=!$('perf-panel').hidden;};
$('manual-respawn65').onclick=()=>{
 if(!joined||!me||me.hp<=0||!['lobby','playing'].includes(state?.phase)){
  toast('Respawn is unavailable right now.');return;
 }
 if(!confirm('Respawn at a safe location? In a match this counts as one death.'))return;
 send({type:'respawn'});
};
$('create').onclick=()=>{audio.unlock();enter(true);};$('join').onclick=()=>{audio.unlock();enter(false);};
$('rejoin56').onclick=()=>{audio.unlock();enter(false);};
 $('code').onchange=()=>{$('status').textContent='Select a room and join your friends.';};
 $('name').value=safeRead56('cf-name','');
 refreshRooms65(new URLSearchParams(location.search).get('room'));
$('start').onclick=()=>{
 if(!state||state.host!==myId)return;
 const people=state.players.filter(p=>!p.bot);
 if(state.phase==='lobby'&&(!people.length||people.some(p=>!p.ready))){
  toast('Everyone must mark READY before the host starts.');return;
 }
 send({type:'start'});capture();
};$('rematch').onclick=()=>{send({type:'start'});audio.unlock();};$('result-room').onclick=()=>{$('results').hidden=true;$('room-panel').hidden=false;syncSquadVisibility69();};$('menu-button').onclick=()=>{document.exitPointerLock?.();$('room-panel').hidden=false;syncSquadVisibility69();};
$('copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${roomCode}`);toast('Invite copied. Send it to your friends.');}catch{toast('Room code '+roomCode+' — copy the address bar link.');}};
$('leave').onclick=()=>{const conn=ws;ws=null;conn?.close();history.replaceState(null,'','/');disconnect('You left the room.');};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>send({type:'mode',mode:b.dataset.mode}));
$('sensitivity').oninput=e=>{settings.sens=clamp(Number(e.target.value)||1,.4,2.5);
 safeWrite56('cf-sens',settings.sens);};
$('motion').onchange=e=>{settings.motion=e.target.checked;safeWrite56('cf-motion',settings.motion);};
$('volume').oninput=e=>{audio.volume=clamp(Number(e.target.value)||0,0,1);safeWrite56('cf-volume',audio.volume);};
$('quality').onchange=e=>{
 settings.quality=safeQuality56(e.target.value);
 safeWrite56('cf-quality-25',settings.quality);
 postfx.setMode(settings.quality);display.setMode(settings.quality);
};
window.addEventListener('resize',()=>display.resize());
document.addEventListener('visibilitychange',()=>{clock=performance.now();frameMeter.reset();movementAccumulator=0;display.quality.warmup=120;resetInput();syncSquadVisibility69();});
$('create').disabled=$('join').disabled=false;$('create').textContent='CREATE A ROOM →';$('status').textContent='Create a room and send your friends the invite.';
