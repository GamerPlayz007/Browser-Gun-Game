// CROSSFIRE FPS client running INSIDE Neon Zenith's original renderer.
// The original city meshes, lights, TSL shaders, weather and post-processing
// remain unchanged. Only gameplay actors and UI are added to the native scene.
import * as THREE from 'three/webgpu';
import { simulate, FIXED_DT } from './crossfire_lib/physics.js';
import { makeWeapon, animateWeapon, makePlayer, animatePlayer,
         setPlayerSkin56, setModelQuality67, disposePlayer } from './crossfire_lib/models.js';

const tint=[0xe7b258,0x60d4be,0xef8a79,0xb1b4ee];
const $=id=>document.getElementById('cfmp-'+id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export async function installCrossfireMultiplayer(nz) {
  const {scene,camera,renderer,fly,kite}=nz;
  // Use original renderer, not CROSSFIRE's box-world renderer.
  fly.enabled=true;
  fly.update=()=>{};
  if(kite?.model)kite.model.visible=false;
  const ui=document.getElementById('ui');if(ui)ui.style.display='none';
  const style=document.createElement('style');
  style.textContent=`
#cfmp-shell{position:fixed;inset:0;z-index:100;pointer-events:none;font:12px system-ui,sans-serif;color:#eafcff;text-shadow:0 1px 3px #040712}
#cfmp-shell button,#cfmp-shell select,#cfmp-shell a{pointer-events:auto;font:inherit;color:#d9faff;background:#0b1b2be8;border:1px solid #55b5cc88;border-radius:6px;padding:10px;cursor:pointer;text-decoration:none}
#cfmp-shell button:hover,#cfmp-shell a:hover{border-color:#b4f5ff}
#cfmp-shell button:disabled{opacity:.35;cursor:default}
#cfmp-bar{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px 18px;background:linear-gradient(#030a18b0,transparent)}
#cfmp-bar strong{font-size:15px;letter-spacing:.16em}
#cfmp-bar small{font-size:10px;display:block;color:#8eaec1}
#cfmp-cross{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px}
#cfmp-cross:after,#cfmp-cross:before{content:"";position:absolute;background:#d5faff;box-shadow:0 0 5px #55e8ff}
#cfmp-cross:after{width:14px;height:2px;top:6px}#cfmp-cross:before{width:2px;height:14px;left:6px}
#cfmp-bottom{position:absolute;left:18px;bottom:16px;display:flex;gap:12px;align-items:end}
#cfmp-health,#cfmp-ammo{padding:12px 18px;background:#091522d9;border:1px solid #57839b7f;border-radius:7px}
#cfmp-health strong,#cfmp-ammo strong{font-size:22px}
#cfmp-prompt{position:absolute;top:67%;left:50%;transform:translateX(-50%);padding:11px 16px;background:#060b17cc;border:1px solid #6997ad9c;border-radius:8px;text-align:center;max-width:90vw;line-height:1.7}
#cfmp-menu{position:absolute;top:65px;right:15px;background:#071321f0;border:1px solid #57afc88c;border-radius:10px;padding:16px;width:min(310px,80vw);pointer-events:auto}
#cfmp-menu[hidden]{display:none}
#cfmp-menu h2{margin:0 0 12px;font-size:18px}
#cfmp-menu select,#cfmp-menu button,#cfmp-menu a{display:block;width:100%;box-sizing:border-box;margin:8px 0}
#cfmp-menu p{line-height:1.6;color:#adc4d8}
#cfmp-feed{position:absolute;right:15px;top:62px;text-align:right;color:#dff4fe;max-width:300px}
#cfmp-radar{position:absolute;right:18px;bottom:18px;width:150px;height:150px;background:#071522bf;border:1px solid #568cabbd;border-radius:8px}
@media(max-width:600px){#cfmp-bar strong{font-size:11px}#cfmp-radar{width:105px;height:105px;bottom:12px;right:6px}#cfmp-bottom{left:6px;bottom:6px;gap:4px}#cfmp-health,#cfmp-ammo{padding:8px}#cfmp-health strong,#cfmp-ammo strong{font-size:16px}}
`;
  document.head.append(style);
  const shell=document.createElement('div');
  shell.id='cfmp-shell';
  shell.innerHTML=`<header id="cfmp-bar">
    <div><strong>CROSSFIRE <span style="color:#54e8ef">/ NEON ZENITH</span></strong>
      <small>ORIGINAL CITY · NATIVE GRAPHICS</small></div>
    <div><strong id="cfmp-mode">CONNECTING</strong><small id="cfmp-round">SERVER AUTHORITY</small></div>
    <button id="cfmp-menu-toggle">ROOM / ESC</button>
  </header>
  <div id="cfmp-feed"></div><div id="cfmp-cross"></div>
  <div id="cfmp-bottom"><div id="cfmp-health"><small>HEALTH</small><br><strong id="cfmp-hp">200</strong></div>
    <div id="cfmp-ammo"><small>AMMO / WEAPON</small><br><strong id="cfmp-bullets">—</strong><div id="cfmp-weapon"></div></div></div>
  <canvas id="cfmp-radar" width="240" height="240"></canvas>
  <div id="cfmp-prompt">Connecting to CROSSFIRE…</div>
  <aside id="cfmp-menu"><h2>NEON ZENITH</h2>
    <p id="cfmp-players">Waiting for server…</p>
    <label for="cfmp-mode-select">MATCH MODE</label>
    <select id="cfmp-mode-select"><option value="deathmatch">Deathmatch</option>
       <option value="gungame">Gun Game</option><option value="teamdeathmatch">Team Deathmatch</option>
       <option value="botmatch">Bot Assault</option></select>
    <button id="cfmp-start">START MATCH</button><button id="cfmp-respawn">EMERGENCY RESPAWN</button>
    <button id="cfmp-resume">RESUME / LOCK MOUSE</button>
    <a href="/">LEAVE TO CROSSFIRE</a>
    <p>WASD move · SHIFT sprint · SPACE jump · C slide · CTRL crouch · Q/E lean · 1–4 weapons · R reload · LMB fire</p>
    <small>Native city assets © their respective creators; credits in upstream Neon Zenith.</small>
  </aside>`;
  document.body.append(shell);
  const canvas=renderer.domElement;
  const url=new URL(location.href);
  const room=(url.searchParams.get('room')||'').toUpperCase();
  const name=(url.searchParams.get('name')||'Player').slice(0,16);
  const skin=clamp(Number(url.searchParams.get('skin')||0),0,3);
  let selected=clamp(Number(url.searchParams.get('weapon')||0),0,3);
  const status=(s)=>{$('prompt').textContent=s;};
  let map;
  try{
    const result=await fetch('/static/maps/neon_zenith.json');
    if(!result.ok)throw Error('Neon Zenith gameplay collision data unavailable.');
    map=await result.json();
    if(map.id!=='neon_zenith'||map.engine!=='neon-zenith-native')throw Error('Wrong map data');
  }catch(err){status('Arena loading failed: '+err.message);return;}
  if(!room){status('Select Neon Zenith in the CROSSFIRE lobby to create a multiplayer room.');return;}
  const guns=map.weapons.map(w=>{
    const model=makeWeapon(w.id);
    setModelQuality67(model,'high');
    camera.add(model);model.visible=false;return model;
  });
  scene.add(camera); // native renderer otherwise has no first-person viewmodels
  const headLamp=new THREE.PointLight(0xb0deff,.5,2.5);
  headLamp.position.set(.3,-.2,-.5);camera.add(headLamp);
  camera.rotation.order='YXZ';camera.fov=82;camera.near=.06;camera.updateProjectionMatrix();
  const remotes=new Map();
  let ws=null,myId='',state=null,me=null,local=null,seq=0,clock=0;
  let yaw=0,pitch=0,accum=0,keys=new Set(),pending=[],lastSpawn=-1;
  let crouch=false,lastShot=0,fireHeld=false,aim=false,kick=0,menuOpen=true;
  let manualDisconnect=false, lastFrame=performance.now(),lastStatus='',wTimer=0;
  const send=payload=>{if(ws?.readyState===1)ws.send(JSON.stringify(payload));};
  function setMenu(open) {
    menuOpen=!!open;$('menu').hidden=!menuOpen;
    if(menuOpen&&document.pointerLockElement===canvas)document.exitPointerLock?.();
    if(!menuOpen&&state)canvas.requestPointerLock?.();
  }
  $('menu-toggle').onclick=()=>setMenu(!menuOpen);
  $('resume').onclick=()=>setMenu(false);
  $('start').onclick=()=>{send({type:'start'});setMenu(false);};
  $('mode-select').onchange=e=>send({type:'mode',mode:e.target.value});
  $('respawn').onclick=()=>{if(confirm('Respawn at a safe location? Counts as a death during a match.'))send({type:'respawn'});};
  const lock=()=>document.pointerLockElement===canvas;
  canvas.addEventListener('click',()=>{if(!menuOpen&&!lock())canvas.requestPointerLock?.();});
  addEventListener('pointerlockchange',()=>{
    if(!lock()) {keys.clear();fireHeld=false;menuOpen=true;$('menu').hidden=false;}
    else {menuOpen=false;$('menu').hidden=true;}
  });
  addEventListener('keydown',e=>{
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    if(e.repeat)return;
    keys.add(e.code);
    if(e.code==='Escape')setMenu(true);
    if(!state)return;
    if(e.code==='ControlLeft'||e.code==='ControlRight')crouch=!crouch;
    if(e.code==='KeyR'&&lock())send({type:'reload'});
    if(/^Digit[1-4]$/.test(e.code)&&lock())chooseWeapon(Number(e.code.slice(-1))-1);
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{keys.clear();fireHeld=false;});
  addEventListener('mousemove',e=>{
    if(!lock())return;
    yaw=(yaw-e.movementX*.0022)%(Math.PI*2);
    pitch=clamp(pitch-e.movementY*.0022,-1.47,1.47);
  });
  canvas.addEventListener('mousedown',e=>{if(e.button===0&&lock())fireHeld=true;if(e.button===2)aim=true;});
  addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2)aim=false;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{if(!lock())return;e.preventDefault();
    chooseWeapon((selected+(e.deltaY>0?1:3))%4);},{passive:false});
  function chooseWeapon(i){
    if(!map.weapons[i]||state?.mode==='gungame'&&state?.phase!=='lobby')return;
    selected=i;send({type:'weapon',weapon:i});
  }
  function controls(){
    const enabled=lock() && me?.hp>0 && ['lobby','playing'].includes(state?.phase);
    return {
      w:enabled&&keys.has('KeyW'),a:enabled&&keys.has('KeyA'),
      s:enabled&&keys.has('KeyS'),d:enabled&&keys.has('KeyD'),
      jump:enabled&&keys.has('Space'),sprint:enabled&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),
      slide:enabled&&keys.has('KeyC'),crouch:enabled&&crouch,
      leanLeft:enabled&&keys.has('KeyQ'),leanRight:enabled&&keys.has('KeyE'),
      ads:enabled&&aim,interact:enabled&&keys.has('KeyF'),
    };
  }
  function predict(command){
    if(!local||!me?.hp)return;
    local.yaw=command.yaw;
    local.pitch=command.pitch;
    local.motion_time+=FIXED_DT;
    simulate(local,command,FIXED_DT,local.motion_time,map.boxes,map.weapons[me.weapon]);
  }
  function moveTick() {
    if(!local||!me?.hp||!lock()||!['lobby','playing'].includes(state?.phase))return;
    const cmd={type:'input',seq:++seq,spawn:me.spawn,yaw,pitch,...controls()};
    predict(cmd);pending.push(cmd);
    if(pending.length>150)pending=pending.slice(-150);
    send(cmd);
  }
  function resetFromSnapshot(p){
    local={...p};pending.length=0;
    lastSpawn=p.spawn;seq=Math.max(seq,p.seq);
    yaw=p.yaw||0;pitch=p.pitch||0;
    crouch=!!p.crouch;
  }
  function reconcile(p){
    if(!local||p.spawn!==lastSpawn){resetFromSnapshot(p);return;}
    const previous={x:local.x,y:local.y,z:local.z};
    pending=pending.filter(cmd=>cmd.seq>p.seq);
    local={...p};
    for(const cmd of pending)predict(cmd);
    // Render from predicted state. Hard snaps only on impossible divergence.
    if(Math.hypot(local.x-previous.x,local.z-previous.z)>7)pending.length=0;
  }
  function renderOpponents(players,dt,t){
    const keep=new Set();
    for(const p of players){
      if(p.id===myId)continue;
      keep.add(p.id);
      let mesh=remotes.get(p.id);
      if(!mesh){mesh=makePlayer(p.name,tint[(p.skin||0)%4]);scene.add(mesh);remotes.set(p.id,mesh);mesh.position.set(p.x,p.y,p.z);}
      setPlayerSkin56(mesh,tint[(p.skin||0)%4]);
      const blend=Math.min(1,dt*11);
      mesh.position.lerp(new THREE.Vector3(p.x,p.y,p.z),blend);
      mesh.visible=p.hp>0;
      animatePlayer(mesh,p,t);
    }
    for(const [id,mesh] of remotes)if(!keep.has(id)){disposePlayer(mesh);remotes.delete(id);}
  }
  function renderRadar(players){
    const c=$('radar'),ctx=c.getContext('2d'),w=c.width,h=c.height;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#091624';ctx.fillRect(0,0,w,h);
    const scale=w/map.size;
    ctx.strokeStyle='#466274';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    ctx.strokeStyle='#4596a5';ctx.strokeRect(2,2,w-4,h-4);
    const mx=x=>(x-map.center.x)*scale+w/2,mz=z=>(z-map.center.z)*scale+h/2;
    for(const p of players){if(p.hp<=0)continue;ctx.fillStyle=p.id===myId?'#a5fff0':p.team===me?.team&&p.team?'#6ac7ff':'#ff7695';
      const x=mx(p.x),z=mz(p.z);ctx.beginPath();ctx.arc(x,z,p.id===myId?4.5:3.5,0,Math.PI*2);ctx.fill();}
    if(local){ctx.strokeStyle='#e4fffc';ctx.beginPath();ctx.moveTo(mx(local.x),mz(local.z));
      ctx.lineTo(mx(local.x)-Math.sin(yaw)*14,mz(local.z)-Math.cos(yaw)*14);ctx.stroke();}
  }
  function showState(p){
    $('mode').textContent=(state?.mode||'lobby').toUpperCase();
    $('round').textContent=`ROOM ${room} · ${state?.phase?.toUpperCase()||'LOBBY'} · ${Math.ceil(state?.remaining||0)}S`;
    $('hp').textContent=String(Math.max(0,p.hp));
    $('bullets').textContent=String(p.ammo);
    $('weapon').textContent=map.weapons[p.weapon]?.name||'—';
    $('start').disabled=state.host!==myId||!['lobby','results'].includes(state.phase);
    $('mode-select').disabled=state.host!==myId||!['lobby','results'].includes(state.phase);
    $('mode-select').value=state.nextMode||state.mode;
    $('players').textContent=`ROOM ${room} • ${state.players.filter(p=>!p.bot).length}/8 PLAYERS\n`+
      state.players.map(p=>`${p.name} — ${p.kills} K / ${p.deaths} D`).join(' | ');
    if(state.phase==='lobby')status('LOBBY PRACTICE • HOST STARTS MATCH');
    else if(state.phase==='countdown')status('MATCH STARTS IN '+Math.ceil(state.countdown));
    else if(p.hp<=0)status('RESPAWNING • '+Math.ceil(p.respawn)+'S');
    else if(state.phase==='results')status('ROUND COMPLETE • HOST CAN START REMATCH');
    else $('prompt').textContent=lock()?'':'Click RESUME to enter the arena';
    $('prompt').hidden=state.phase==='playing'&&p.hp>0&&lock();
    guns.forEach((g,i)=>g.visible=i===p.weapon&&p.hp>0);
  }
  function handle(msg){
    if(msg.type==='welcome'){myId=msg.id;status('Joined '+room+' — click RESUME to explore');return;}
    if(msg.type==='manual_respawn_result65'){status(msg.message);return;}
    if(msg.type!=='state')return;
    if(msg.mapId!=='neon_zenith'){status('Room map mismatch; return to lobby.');return;}
    state=msg;me=msg.players.find(p=>p.id===myId);
    if(!me)return;
    reconcile(me);
    if(me.weapon!==selected)selected=me.weapon;
    showState(me);
    renderRadar(msg.players);
    for(const event of msg.events||[]){
      if(event.type==='notice'){$('feed').textContent=event.text;}
    }
  }
  const address=`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/${encodeURIComponent(room)}?name=${encodeURIComponent(name)}&weapon=${selected}&skin=${skin}`;
  ws=new WebSocket(address);
  ws.onmessage=e=>{try{handle(JSON.parse(e.data));}catch(err){console.error('CROSSFIRE native packet',err);}};
  ws.onopen=()=>status('Connected to '+room+' • choose RESUME');
  ws.onerror=()=>status('CROSSFIRE server connection failed. Return to lobby.');
  ws.onclose=()=>status('Disconnected from CROSSFIRE. Return to lobby to rejoin.');
  window.addEventListener('pagehide',()=>{manualDisconnect=true;ws?.close();});
  let lastInfo=0;
  // Run native City's existing render loop. Do not interfere with its quality,
  // culling, reflection probes, weather, geometry or post-processing.
  fly.update=(dt)=>{
    if(!local)return;
    accum=Math.min(.2,accum+dt);
    for(let n=0;n<5&&accum>=FIXED_DT;n++,accum-=FIXED_DT)moveTick();
    if(fireHeld&&lock()&&me?.hp>0){
      const now=performance.now()/1000,w=map.weapons[me.weapon];
      if(w&&now-lastShot>=w.interval&&me.ammo>0&&me.reload<=0){
        lastShot=now;
        send({type:'shoot',shot:++wTimer,yaw,pitch,ads:aim});
        kick=.12;
      }
    }
    kick=Math.max(0,kick-dt*.35);
    for(const gun of guns)if(gun.visible)animateWeapon(gun,{
      time:performance.now()/1000,ads:aim?1:0,reload:clamp(me.reload||0,0,1),
      kick,moving:!!(local.vx||local.vz),slide:local.slide_until>local.motion_time?1:0,
      motion:true,switched:0});
    camera.position.set(local.x,local.y+(local.crouch?.99:1.55),local.z);
    camera.rotation.set(pitch,yaw,0,'YXZ');
    renderOpponents(state.players,dt,performance.now()/1000);
  };
  // Only removes the boot diagnostic AFTER the FPS overlay is ready.
  window.__crossfireNeonReady?.();
}
