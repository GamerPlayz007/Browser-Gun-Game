import * as T from 'three';
import {buildWorld} from './world.js';
import {makeWeapon,animateWeapon,makePlayer,animatePlayer,markPlayerEvent,disposePlayer} from './models.js';
import {simulate,FIXED_DT} from './physics.js';
import {createMinimap} from './minimap.js';
import {createDisplay} from './display.js';
import {createPostProcessing} from './postfx.js';
import {AudioEngine} from './audio.js';
import {createNetSync,observePong,ingestSnapshot,sampleRemote,cameraCorrection,syncStats} from './netcode33.js';
import {fireMode, makeTrigger, pressTrigger, releaseTrigger, takeTriggerPulse,
 predictedAmmo, reloadFraction, ammoState, damageBearing, confirmedHit} from './combat32.js';
const $=id=>document.getElementById(id),clamp=T.MathUtils.clamp;
const audio=new AudioEngine();
const settings={sens:Number(localStorage.getItem('cf-sens')||1),motion:localStorage.getItem('cf-motion')!=='false',quality:localStorage.getItem('cf-quality-25')||'high'};
$('sensitivity').value=settings.sens;$('motion').checked=settings.motion;$('quality').value=settings.quality;
let map,registry,renderer,world,scene,camera,viewScene,viewCamera,display,minimap,postfx;
try{
 const catalog=await fetch('/api/maps');if(!catalog.ok)throw Error('Map list could not load.');registry=await catalog.json();
 const entry=registry.maps.find(m=>m.id===registry.default&&m.available);
 const response=await fetch(entry.url);if(!response.ok)throw Error('Arena data could not load.');map=await response.json();
 scene=new T.Scene();camera=new T.PerspectiveCamera(82,innerWidth/innerHeight,.06,600);camera.rotation.order='YXZ';
 renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.autoClear=false;$('viewport').appendChild(renderer.domElement);
 world=buildWorld(scene,map,{renderer,quality:settings.quality});postfx=createPostProcessing(renderer,scene,camera,settings.quality);viewScene=new T.Scene();viewCamera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.03,10);viewScene.add(new T.HemisphereLight(0xf0f8f5,0x697f7a,2.8));const light=new T.DirectionalLight(0xffe5bb,3);light.position.set(-2,4,3);viewScene.add(light);
}catch(e){$('status').textContent=e.message.includes('WebGL')?'3D graphics unavailable. Enable hardware acceleration and use Chrome or Edge.':e.message;throw e;}
display=createDisplay(renderer,[camera,viewCamera],enabled=>world.setDetail(enabled),settings.quality);
minimap=createMinimap($('minimap'),$('district-label'),map);
for(const entry of registry.maps){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name+(entry.available?'':' — coming later');option.disabled=!entry.available;$('map-select').append(option);}
$('map-select').value=map.id;
async function loadArena(id){
 if(id===map.id)return;
 const entry=registry.maps.find(m=>m.id===id&&m.available);if(!entry)throw Error('This map is not available on this server.');
 const response=await fetch(entry.url);if(!response.ok)throw Error('Could not load the room map.');
 const next=await response.json();if(next.id!==id)throw Error('Map data mismatch. Refresh and try again.');
 const nextScene=new T.Scene(),nextWorld=buildWorld(nextScene,next,{renderer,quality:settings.quality});
 world.dispose();postfx.dispose();scene=nextScene;world=nextWorld;postfx=createPostProcessing(renderer,scene,camera,settings.quality);map=next;
 minimap=createMinimap($('minimap'),$('district-label'),map);$('map-select').value=id;
 display.quality.reset();display.resize(true);
}
const weapons=map.weapons,weaponModels=weapons.map(w=>makeWeapon(w.id));for(const g of weaponModels){g.visible=false;viewScene.add(g);}
let selected=0,ws=null,myId=null,roomCode='',state=null,me=null,local=null,joined=false,keys={},aiming=false,yaw=0,pitch=0,seq=0,shotId=0,pendingShots=[];let pendingMoves=[],movementAccumulator=0,viewError=new T.Vector3(),rosterSignature='',scoreSignature='';
let groundVelocity=0,landingPulse=0,lastLocalGrounded=true,movementHint='';
let ads=0,kick=0,eye=1.55,visualRecoil=0,lastShot=-10,flashUntil=0,hitUntil=0,damageUntil=0,elimUntil=0,noticeTimer,toastTimer,lastPhase='',lastSpawn=-1,switchVisual=0,rtt=50;
let clock=performance.now(),fpsFrames=0,fpsLast=performance.now(),fps=60,lastStep=0,shotRecovery=0,frameError=false;
const combatTrigger=makeTrigger();
let netSync=createNetSync();
const opponents=new Map(),effects=[],hitGeometry=new T.IcosahedronGeometry(.035,0),hitMaterial=new T.MeshBasicMaterial({color:0xffc98a});
const silhouette=id=>`<svg viewBox="0 0 220 60" aria-hidden="true"><path d="M20 19h${[100,80,130,135][id]}v24H70l-8 16H47l4-17H20z"/><path d="M5 16h22v30H5zM100 26h${[92,65,98,105][id]}v6h-${[92,65,98,105][id]}z"/>${id===3?'<rect x="89" y="5" width="45" height="13" rx="5"/><rect x="100" y="16" width="7" height="7"/>':'<rect x="65" y="12" width="48" height="7"/>'}${id===1?'<rect x="75" y="38" width="10" height="20"/>':''}</svg>`;
function makeCards(container){for(const w of weapons){const b=document.createElement('button');b.className='weapon-card'+(w.id===selected?' active':'');b.dataset.weapon=w.id;b.innerHTML=`<span class="number">0${w.id+1}</span>${silhouette(w.id)}<strong>${w.name}</strong><small>${w.type}</small>`;b.onclick=()=>selectWeapon(w.id);container.append(b);}}
makeCards($('home-weapons'));makeCards($('room-weapons'));for(const w of weapons){const s=document.createElement('span');s.className='slot';s.textContent=`${w.id+1} ${w.short}`;$('weapon-slots').append(s);}
function send(data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
function selectWeapon(id){if(joined){if(state?.mode==='gungame'&&state.phase!=='lobby'){toast('Gun Game: earn kills to advance.');return;}send({type:'weapon',weapon:id});}else{selected=id;updateSelection(id);}}
function updateSelection(id){document.querySelectorAll('.weapon-card').forEach(b=>b.classList.toggle('active',Number(b.dataset.weapon)===id));[...$('weapon-slots').children].forEach((s,i)=>s.classList.toggle('active',i===id));}
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,3000);}
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',3000);}
function locked(){return document.pointerLockElement===renderer.domElement;}
function controls(){const enabled=joined&&locked()&&me?.hp>0&&['lobby','playing'].includes(state?.phase);return {w:enabled&&!!keys.KeyW,a:enabled&&!!keys.KeyA,s:enabled&&!!keys.KeyS,d:enabled&&!!keys.KeyD,jump:enabled&&!!keys.Space,sprint:enabled&&(!!keys.ShiftLeft||!!keys.ShiftRight),slide:enabled&&!!keys.KeyC,interact:enabled&&!!keys.KeyE,ads:enabled&&aiming};}
function sendInput(){} // Input is sampled and sent by the fixed-step predictor below.
function predictStep(input){
 const command={type:'input',seq:++seq,spawn:me.spawn,yaw,pitch,...input};
 local.yaw=yaw;local.motion_time+=FIXED_DT;
 const beforeY=local.y;
 simulate(local,input,FIXED_DT,local.motion_time,map.boxes,weapons[me.weapon]);
 if(!lastLocalGrounded&&local.grounded&&local.vy===0)landingPulse=Math.max(landingPulse,.16);
 lastLocalGrounded=!!local.grounded;
 groundVelocity=local.grounded?clamp((local.y-beforeY)/FIXED_DT,-6,6):0;
 pendingMoves.push(command);send(command);
 if(pendingMoves.length>150){pendingMoves=[];local={...me};viewError.set(0,0,0);}
}
function resetInput(){$('map-panel').classList.remove('expanded');keys={};aiming=false;releaseTrigger(combatTrigger);sendInput();}
setInterval(()=>send({type:'ping',t:performance.now()}),2000);
function ammo(){return me?predictedAmmo(me.ammo,pendingShots,me.weapon):0;}
function tryTriggerFire(now){if(me&&takeTriggerPulse(combatTrigger,weapons[me.weapon]))fireWeapon(now);}
function fireWeapon(now){if(!me||!locked()||me.hp<=0||!['lobby','playing'].includes(state.phase)||me.reload>0||me.switch>0)return;const w=weapons[me.weapon];if(now-lastShot<w.interval||ammo()<=0)return;
 lastShot=now;shotId++;pendingShots.push({id:shotId,weapon:w.id});
  // The server validates and clamps this view timestamp to its own pose history.
  const viewServerTime=netSync.clockOffsetMs===null?undefined:
    (performance.now()-netSync.clockOffsetMs-netSync.delayMs)/1000;
  send({type:'shoot',shot:shotId,yaw,pitch,ads:aiming,viewServerTime});
 // Local recoil/audio/flash are immediate. Only server events show hits and kills.
 audio.shot(w.id);kick=Math.min(.2,kick+w.kick*2);flashUntil=now+.055;pitch=clamp(pitch+w.kick*(aiming?.55:1),-1.5,1.5);shotRecovery+=w.kick*(aiming?.55:1);visualRecoil=Math.min(.06,visualRecoil+w.kick*.3);
 $('ammo').textContent=ammo();
}
async function enter(create){$('create').disabled=$('join').disabled=true;$('status').textContent='Connecting to arena…';try{let code=$('code').value.trim().toUpperCase();const response=await fetch(create?'/api/rooms':'/api/rooms/'+code,create?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapId:$('map-select').value})}:{});const data=await response.json();if(!response.ok)throw Error(data.error||'Connection failed.');if(create)code=data.room;else if(data.players>=data.max)throw Error('This room is full.');await loadArena(data.mapId);const name=$('name').value.trim()||'Player';localStorage.setItem('cf-name',name);const conn=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/${code}?name=${encodeURIComponent(name)}&weapon=${selected}`);ws=conn;const timeout=setTimeout(()=>{if(conn.readyState!==1)conn.close();},12000);conn.onopen=()=>clearTimeout(timeout);conn.onmessage=e=>{if(ws===conn)handle(JSON.parse(e.data));};conn.onclose=()=>{clearTimeout(timeout);if(ws===conn)disconnect('Connection closed. Join again or create a new room.');};conn.onerror=()=>{$('status').textContent='Could not connect. Check the server is awake.';};}catch(e){$('status').textContent=e.message;$('create').disabled=$('join').disabled=false;}}
function disconnect(message){netSync=createNetSync();joined=false;state=me=local=null;myId=null;lastPhase='';lastSpawn=-1;pendingShots=[];pendingMoves=[];movementAccumulator=0;landingPulse=0;lastLocalGrounded=true;movementHint='';viewError.set(0,0,0);rosterSignature=scoreSignature='';resetInput();document.exitPointerLock?.();for(const g of opponents.values())disposePlayer(g);opponents.clear();for(const id of ['hud','room-panel','death','results','scoreboard'])$(id).hidden=true;$('home').hidden=false;$('shade').style.opacity=1;$('status').textContent=message;$('create').disabled=$('join').disabled=false;}
function scoreboard(players,body){body.replaceChildren();for(const p of [...players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)){const tr=document.createElement('tr');if(p.id===myId)tr.className='me';for(const value of [p.name+(p.id===myId?' / YOU':''),p.kills,p.deaths,p.headshots]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}}
function renderRoster(){const el=$('roster');el.replaceChildren();for(const p of state.players){const r=document.createElement('div');r.className='roster-row';const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=p.name.slice(0,1).toUpperCase();const name=document.createElement('span');name.textContent=p.name;const badge=document.createElement('small');badge.textContent=p.id===state.host?'HOST':p.id===myId?'YOU':'CONNECTED';r.append(avatar,name,badge);el.append(r);}for(let i=state.players.length;i<8;i++){const r=document.createElement('div');r.className='roster-empty';r.textContent='Open slot — invite a friend';el.append(r);}}
function uiRoom(){const host=state.host===myId,canStart=['lobby','results'].includes(state.phase);$('start').hidden=!canStart;$('start').disabled=!host;$('start').textContent=host?(state.phase==='results'?'START REMATCH →':'START MATCH →'):'WAITING FOR HOST';$('resume').textContent=state.phase==='lobby'?'ENTER PRACTICE':state.phase==='results'?'VIEW RESULTS':'RESUME MATCH';$('room-title').textContent=state.phase==='lobby'?'Your squad.':'Stay in the fight.';$('room-hint').textContent=state.phase==='lobby'?'Practice while your friends join. The host starts the match.':'The match continues while this menu is open.';document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.disabled=!host||state.phase!=='lobby';});document.querySelectorAll('#room-weapons button').forEach(b=>b.disabled=state.mode==='gungame'&&state.phase!=='lobby');}
function addTracer(origin,end){const geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(...origin),new T.Vector3(...end)]),line=new T.Line(geometry,new T.LineBasicMaterial({color:0xffe0a0,transparent:true,opacity:.5}));scene.add(line);effects.push({obj:line,until:performance.now()/1000+.055,own:true});const dot=new T.Mesh(hitGeometry,hitMaterial);dot.position.set(...end);scene.add(dot);effects.push({obj:dot,until:performance.now()/1000+.18});}
function processEvent(e){const now=performance.now()/1000;if(e.type==='notice')notice(e.text);
 if(e.type==='shot'){if(e.id!==myId)markPlayerEvent(opponents.get(e.id),'shot',now);for(const end of e.ends)addTracer(e.origin,end);if(e.id!==myId&&local){const dx=e.origin[0]-local.x,dz=e.origin[2]-local.z,dist=Math.hypot(dx,dz);audio.shot(e.weapon,Math.max(0,1-dist/45)*.35,clamp((dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,dist),-1,1));}}
 if(e.type==='hit'){
   if(e.victim!==myId)markPlayerEvent(opponents.get(e.victim),'hit',now);
   const hit=confirmedHit(e,myId);
   if(hit){
    hitUntil=now+.23;
    $('hitmarker').classList.toggle('critical',hit.head);
    $('damage-number').classList.toggle('critical',hit.head);
    $('damage-number').textContent=(hit.head?'HEADSHOT / ':'')+hit.damage;
    audio.hit(hit.head);
   }
   if(e.victim===myId){
    damageUntil=now+.32;
    const bearing=damageBearing(e.origin,local||me,yaw);
    if(bearing!==null)$('damage-direction').style.setProperty('--bearing',bearing+'deg');
    audio.burst(.12,.16,500);
   }
  }
 if(e.type==='kill'){const div=document.createElement('div');div.className='feed-row';div.append(document.createTextNode(e.killer));const mid=document.createElement('span');mid.textContent=weapons[e.weapon].short+(e.head?' ◇':' →');div.append(mid,document.createTextNode(e.victim));$('feed').prepend(div);while($('feed').children.length>5)$('feed').lastChild.remove();setTimeout(()=>div.remove(),5000);if(e.killerId===myId){$('elimination').textContent=(e.head?'HEADSHOT / ':'ELIMINATED / ')+e.victim;elimUntil=now+1.8;audio.kill();}if(e.victimId===myId)$('killed-by').textContent=`${e.killer} · ${weapons[e.weapon].name}`;}
}
function handle(data){if(data.type==='welcome'){netSync=createNetSync();seq=0;shotId=0;if(data.mapId!==map.id){ws?.close();disconnect('Map mismatch. Reload the page.');return;}$('room-map').textContent=map.name;$('score-map').textContent=map.name;myId=data.id;roomCode=data.room;joined=true;history.replaceState(null,'',`?room=${roomCode}`);$('room-code').textContent=roomCode;$('home').hidden=true;$('hud').hidden=false;$('room-panel').hidden=false;$('shade').style.opacity=0;return;}if(data.type==='pong'){if(observePong(netSync,data.t,performance.now(),data.serverTime))rtt=netSync.rttMs;return;}if(data.type!=='state'||data.mapId!==map.id)return;
 if(!ingestSnapshot(netSync,data,performance.now()))return;
 const previous=me;state=data;me=data.players.find(p=>p.id===myId);if(!me)return;const now=performance.now()/1000;
 pendingShots=pendingShots.filter(s=>s.id>me.ack_shot);
 if(!local||me.spawn!==lastSpawn){
  local={...me};lastSpawn=me.spawn;pendingMoves=[];movementAccumulator=0;landingPulse=0;lastLocalGrounded=!!me.grounded;movementHint='';viewError.set(0,0,0);pendingShots=[];lastShot=-10;shotRecovery=0;releaseTrigger(combatTrigger);
  yaw=me.yaw;pitch=0;
 }else{
  const old=new T.Vector3(local.x+viewError.x,local.y+viewError.y,local.z+viewError.z);
  pendingMoves=pendingMoves.filter(cmd=>cmd.seq>me.seq&&cmd.spawn===me.spawn);
  local={...me};
  for(const cmd of pendingMoves){local.yaw=cmd.yaw;local.motion_time+=FIXED_DT;simulate(local,cmd,FIXED_DT,local.motion_time,map.boxes,weapons[me.weapon]);}
  const correction=cameraCorrection(old,local,2.5);
   viewError.set(correction.x,correction.y,correction.z);
  // Large corrections are snapped above; small corrections decay visually.
 }
 if(!previous||previous.weapon!==me.weapon){selected=me.weapon;updateSelection(selected);switchVisual=1;pendingShots=[];lastShot=-10;}
 $('health').textContent=me.hp;$('healthbar').style.width=me.hp+'%';$('protection').textContent=me.shield>0?' / PROTECTED':'';$('ammo').textContent=ammo();$('mag').textContent=' / '+weapons[me.weapon].mag;$('weapon-name').textContent=weapons[me.weapon].name;$('reload-label').textContent=me.reload>0?`RELOADING ${me.reload.toFixed(1)}s`:ammo()===0?'EMPTY — R TO RELOAD':'R / RELOAD';
  $('fire-mode-label').textContent=fireMode(weapons[me.weapon])==='auto'?'AUTO':'SINGLE CLICK';
  $('ammo-panel').classList.toggle('low-ammo',ammoState(ammo(),weapons[me.weapon].mag)==='low');
  $('ammo-panel').classList.toggle('empty-ammo',ammoState(ammo(),weapons[me.weapon].mag)==='empty');
  $('ammo-panel').classList.toggle('reloading',me.reload>0);
  $('reload-progress').style.width=(100*reloadFraction(me.reload,weapons[me.weapon].reload))+'%';
 $('death').hidden=me.hp>0||data.phase!=='playing';$('respawn-time').textContent=Math.ceil(me.respawn);$('timer').textContent=data.phase==='lobby'?'PRACTICE':`${Math.floor(data.remaining/60)}:${String(Math.floor(data.remaining%60)).padStart(2,'0')}`;$('mode-label').textContent=data.mode==='gungame'?'GUN GAME':'DEATHMATCH';$('objective').textContent=data.phase==='lobby'?'WAITING FOR HOST':data.mode==='gungame'?`TIER ${Math.min(4,Math.floor(me.kills/3)+1)} / 4 · ${me.kills%3} / 3 KILLS`:'FIRST TO 15';$('progress').style.width=(me.kills/(data.mode==='gungame'?12:15)*100)+'%';$('countdown').hidden=data.phase!=='countdown';$('countdown').textContent=Math.ceil(data.countdown);$('slide-label').textContent=me.slideCooldown>0?`SLIDE / ${me.slideCooldown.toFixed(1)}s`:'C / SLIDE READY';
 const present=new Set();for(const p of data.players){if(p.id===myId)continue;present.add(p.id);let g=opponents.get(p.id);if(!g){g=makePlayer(p.name);scene.add(g);g.position.set(p.x,p.y,p.z);opponents.set(p.id,g);}if(g.userData.target?.spawn!==p.spawn){g.position.set(p.x,p.y,p.z);g.userData.animation.spawn=undefined;}g.userData.target=p;g.visible=p.hp>0;if(g.userData.gun.userData.id!==p.weapon){const old=g.userData.gun;old.removeFromParent();old.traverse(o=>o.geometry?.dispose());const gun=makeWeapon(p.weapon,false);gun.scale.setScalar(.8);gun.position.set(.26,1.1,-.34);g.userData.body.add(gun);g.userData.gun=gun;}}
 for(const [id,g] of opponents)if(!present.has(id)){disposePlayer(g);opponents.delete(id);}for(const t of data.targets)world.targets.get(t.id).visible=t.hp>0;
 const rosterKey=JSON.stringify([data.host,data.players.map(p=>[p.id,p.name])]);
 if(rosterKey!==rosterSignature){renderRoster();rosterSignature=rosterKey;}
 const scoreKey=JSON.stringify(data.players.map(p=>[p.id,p.kills,p.deaths,p.headshots]));
 if(scoreKey!==scoreSignature){scoreboard(data.players,$('scores'));scoreSignature=scoreKey;}
 uiRoom();
 if(data.phase!==lastPhase){
  if(data.phase==='countdown'){resetInput();$('room-panel').hidden=true;$('results').hidden=true;audio.tone(600,.1,.1);if(!locked())notice('Click the arena to capture your mouse.');}
  if(data.phase==='playing'){notice('GO — make it count.');audio.tone(1100,.16,.13);}
  if(data.phase==='results'){resetInput();document.exitPointerLock?.();$('room-panel').hidden=true;$('results').hidden=false;$('winner').textContent=data.winner==='DRAW'?'A DEAD HEAT.':`${data.winner} WINS`;$('result-subtitle').textContent=`${map.name} / ${data.mode.toUpperCase()}`;const table=$('scoreboard').querySelector('table').cloneNode(true);table.querySelector('tbody').removeAttribute('id');$('final-scores').replaceChildren(table);}
  lastPhase=data.phase;
 }
 $('rematch').disabled=data.host!==myId;$('rematch').textContent=data.host===myId?'PLAY AGAIN →':'WAITING FOR HOST';
 for(const e of data.events)processEvent(e);
}
function frame(ms){try{const now=ms/1000,rawMs=ms-clock,dt=Math.min(rawMs/1000,.2);clock=ms;display.frame(rawMs);fpsFrames++;if(ms-fpsLast>600){fps=Math.round(fpsFrames*1000/(ms-fpsLast));fpsLast=ms;fpsFrames=0;const net=syncStats(netSync,ms);$('metrics').textContent=`${fps} FPS · ${Number.isFinite(net.rttMs)?Math.round(net.rttMs):'--'} MS · ±${Math.round(net.jitterMs)} JITTER · ${net.stale&&joined?'SYNCING · ':''}${display.label()}`;}
 world.animate(now);
 if(joined&&me&&local){const input=controls();minimap.draw(local,yaw,now);
  if(me.hp>0&&['lobby','playing'].includes(state.phase)){
   movementAccumulator+=dt;
   let steps=0;while(movementAccumulator>=FIXED_DT&&steps++<6){predictStep(input);movementAccumulator-=FIXED_DT;}if(steps>=6)movementAccumulator=Math.min(movementAccumulator,FIXED_DT*2);
  }else movementAccumulator=0;
  viewError.multiplyScalar(Math.exp(-dt*14));
  tryTriggerFire(now);
  if(now-lastShot>.12&&shotRecovery>0){const recovery=Math.min(shotRecovery,dt*.12);pitch-=recovery;shotRecovery-=recovery;}
  ads+=(Number(aiming&&locked()&&me.reload<=0)-ads)*Math.min(1,dt*16);const sliding=local.crouch?1:0;eye+=((sliding?.9:1.55)-eye)*Math.min(1,dt*15);
  const localSpeed=Math.hypot(local.vx,local.vz),moving=localSpeed>.5;
   const bob=settings.motion&&moving&&local.grounded?Math.sin(now*12)*.018*(1-ads):0;
   const cue=local.mantle?'VAULTING':local.slide_until>local.motion_time?'SLIDING':!local.grounded?'AIRBORNE':
    local.crouch?'CROUCHING':input.sprint&&localSpeed>5?'SPRINTING':moving?'MOVING':'READY';
   if(cue!==movementHint){movementHint=cue;$('movement-state').textContent=cue;}
   landingPulse=Math.max(0,landingPulse-dt*.95);
  camera.position.set(local.x+viewError.x+local.vx*movementAccumulator,local.y+viewError.y+(local.grounded?groundVelocity:local.vy)*movementAccumulator+eye+bob-(settings.motion?landingPulse*.24:0),local.z+viewError.z+local.vz*movementAccumulator);camera.rotation.set(pitch+visualRecoil,yaw,settings.motion?((local.crouch?-.025:0)-clamp((local.vx*Math.cos(yaw)-local.vz*Math.sin(yaw))/8,-1,1)*.011):0,'YXZ');camera.fov=T.MathUtils.lerp(input.sprint?88:82,me.weapon===3?26:57,ads);camera.updateProjectionMatrix();
  for(const [id,g] of opponents){const shown=sampleRemote(netSync,id,ms);const p=shown?{...g.userData.target,...shown}:g.userData.target;if(!p)continue;
    // 20 Hz snapshots render on a delayed server-time timeline. No double lerp.
    g.position.set(p.x,p.y,p.z);animatePlayer(g,p,now);g.userData.tag.visible=camera.position.distanceTo(g.position)<18;}
  for(let i=0;i<4;i++)weaponModels[i].visible=i===me.weapon&&locked()&&me.hp>0&&state.phase!=='results'&&!(me.weapon===3&&ads>.95);
  const gun=weaponModels[me.weapon];animateWeapon(gun,{time:now,ads,reload:me.reload>0?me.reload/weapons[me.weapon].reload:0,kick,moving:locked()&&moving,slide:sliding,motion:settings.motion,switched:switchVisual});gun.userData.flash.visible=now<flashUntil;gun.userData.flash.rotation.z=now*21;
  kick=Math.max(0,kick-dt*.7);visualRecoil*=Math.exp(-dt*18);switchVisual=Math.max(0,switchVisual-dt*5);
  $('scope').hidden=!(me.weapon===3&&ads>.95&&locked()&&me.hp>0);$('crosshair').style.opacity=ads>.75?'0':'1';$('crosshair').style.width=$('crosshair').style.height=(24+kick*80)+'px';
  if(moving&&local.grounded&&locked()&&now-lastStep>(input.sprint?.28:.4)){audio.step(input.sprint?.07:.045);lastStep=now;}
 }else{camera.position.set(7+Math.sin(now*.045)*2,9,30+Math.cos(now*.045)*2);camera.lookAt(-5,3,14);camera.fov=65;camera.updateProjectionMatrix();for(const g of weaponModels)g.visible=false;}
 for(let i=effects.length-1;i>=0;i--)if(now>effects[i].until){const e=effects.splice(i,1)[0];e.obj.removeFromParent();if(e.own){e.obj.geometry.dispose();e.obj.material.dispose();}}
 $('damage').style.opacity=now<damageUntil?.65:0;$('damage-direction').style.opacity=now<damageUntil?1:0;$('hitmarker').style.opacity=$('damage-number').style.opacity=now<hitUntil?1:0;$('elimination').style.opacity=now<elimUntil?1:0;
 renderer.clear();postfx.setSize(display.buffer.width,display.buffer.height);postfx.render();if(joined&&me&&locked()&&me.hp>0&&state.phase!=='results'){renderer.clearDepth();renderer.render(viewScene,viewCamera);}
 }catch(e){if(!frameError){frameError=true;toast('Rendering error: '+e.message);console.error(e);}}}
renderer.setAnimationLoop(frame);
async function capture(){audio.unlock();if(state?.phase==='results'){$('results').hidden=false;$('room-panel').hidden=true;return;}try{await renderer.domElement.requestPointerLock();}catch{toast('Open this game in its own browser tab to capture the mouse.');}}
$('resume').onclick=capture;renderer.domElement.addEventListener('click',()=>{if(joined&&!locked()&&$('room-panel').hidden&&state.phase!=='results')capture();});
document.addEventListener('pointerlockchange',()=>{if(!joined)return;resetInput();$('room-panel').hidden=locked()||state?.phase==='results';});
document.addEventListener('mousemove',e=>{if(!locked())return;const sens=.002*settings.sens*T.MathUtils.lerp(1,me?.weapon===3?.32:.65,ads);yaw-=e.movementX*sens;pitch=clamp(pitch-e.movementY*sens,-1.5,1.5);});
document.addEventListener('mousedown',e=>{if(!locked())return;if(e.button===0){pressTrigger(combatTrigger);if(me&&ammo()<=0&&me.reload<=0&&me.switch<=0)audio.dry();tryTriggerFire(performance.now()/1000);}if(e.button===2){aiming=true;sendInput();}});document.addEventListener('mouseup',e=>{if(e.button===0)releaseTrigger(combatTrigger);if(e.button===2){aiming=false;sendInput();}});document.addEventListener('contextmenu',e=>{if(joined)e.preventDefault();});
document.addEventListener('keydown',e=>{if(!joined||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(['Tab','Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Tab')$('scoreboard').hidden=false;if(e.code==='KeyM')$('map-panel').classList.add('expanded');if(e.repeat)return;if(e.code==='KeyR'&&locked()){send({type:'reload'});if(me.ammo<weapons[me.weapon].mag&&!me.reload)audio.reload();}if(/^Digit[1-4]$/.test(e.code))selectWeapon(Number(e.code.slice(-1))-1);});
document.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')$('scoreboard').hidden=true;if(e.code==='KeyM')$('map-panel').classList.remove('expanded');});window.addEventListener('blur',()=>{resetInput();$('scoreboard').hidden=true;});
$('create').onclick=()=>{audio.unlock();enter(true);};$('join').onclick=()=>{audio.unlock();enter(false);};$('code').onkeydown=e=>{if(e.key==='Enter')enter(false);};$('name').value=localStorage.getItem('cf-name')||'';$('code').value=new URLSearchParams(location.search).get('room')||'';
$('start').onclick=()=>{send({type:'start'});capture();};$('rematch').onclick=()=>{send({type:'start'});audio.unlock();};$('result-room').onclick=()=>{$('results').hidden=true;$('room-panel').hidden=false;};$('menu-button').onclick=()=>{document.exitPointerLock?.();$('room-panel').hidden=false;};
$('copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${roomCode}`);toast('Invite copied. Send it to your friends.');}catch{toast('Room code '+roomCode+' — copy the address bar link.');}};
$('leave').onclick=()=>{const conn=ws;ws=null;conn?.close();history.replaceState(null,'','/');disconnect('You left the room.');};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>send({type:'mode',mode:b.dataset.mode}));
$('sensitivity').oninput=e=>{settings.sens=Number(e.target.value);localStorage.setItem('cf-sens',settings.sens);};$('motion').onchange=e=>{settings.motion=e.target.checked;localStorage.setItem('cf-motion',settings.motion);};$('volume').oninput=e=>audio.volume=Number(e.target.value);$('quality').onchange=e=>{settings.quality=e.target.value;localStorage.setItem('cf-quality-25',settings.quality);display.setMode(settings.quality);world.setQuality(settings.quality);postfx.setMode(settings.quality);};
window.addEventListener('resize',()=>display.resize());
document.addEventListener('visibilitychange',()=>{clock=performance.now();movementAccumulator=0;display.quality.warmup=120;resetInput();});
$('create').disabled=$('join').disabled=false;$('create').textContent='CREATE A ROOM →';$('status').textContent='Create a room and send your friends the invite.';
