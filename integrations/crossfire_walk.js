// CROSSFIRE first-person WALKTHROUGH for the original Neon Zenith scene.
// This is intentionally NOT a multiplayer FPS adapter yet. No original
// materials, lighting, geometry, postprocessing, or environment art are replaced.
import * as THREE from 'three/webgpu';
import { CITY, groundAt, queryBoxes } from './city/layout.js';

export function installCrossfireWalk(nz) {
  const { camera, city, fly, kite } = nz;
  // Preserve every original native render pass. Only replace car/fly navigation.
  fly.enabled = true;
  fly.update = () => {};
  if (kite?.model) kite.model.visible = false;
  const originalUI = document.getElementById('ui');
  if (originalUI) originalUI.style.display = 'none';

  const style = document.createElement('style');
  style.textContent = `
    #cf-neon-shell { position:fixed; inset:0; z-index:200; pointer-events:none;
      font-family:Inter,system-ui,sans-serif; color:#eef5ff; }
    #cf-neon-shell .cf-top {position:absolute;top:16px;left:18px;right:18px;
      display:flex;gap:12px;align-items:center;justify-content:space-between}
    #cf-neon-shell .cf-mark {padding:12px 16px;background:#060b14cf;
      border:1px solid #73dbe857;backdrop-filter:blur(14px);border-radius:7px}
    #cf-neon-shell .cf-mark strong {letter-spacing:.18em;font-size:16px}
    #cf-neon-shell .cf-mark small{display:block;color:#8cb8c9;margin-top:4px;font-size:10px;letter-spacing:.12em}
    #cf-neon-shell a {pointer-events:auto;text-decoration:none;color:#d6f5ff;
      background:#060b14e6;border:1px solid #6eb9cf88;padding:10px 14px;border-radius:7px}
    #cf-neon-shell a:hover{border-color:#c5f6ff}
    #cf-neon-shell .cf-center{position:absolute;top:50%;left:50%;height:10px;width:10px;
      margin:-5px 0 0 -5px;opacity:.7}
    #cf-neon-shell .cf-center:before,#cf-neon-shell .cf-center:after {content:"";position:absolute;
      background:#ddfcff;box-shadow:0 0 5px #0de6ff;border-radius:2px}
    #cf-neon-shell .cf-center:before{width:10px;height:1px;top:5px;left:0}
    #cf-neon-shell .cf-center:after{height:10px;width:1px;left:5px;top:0}
    #cf-neon-shell .cf-info{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);
      text-align:center;min-width:250px;padding:12px 20px;background:#060b14d9;
      border:1px solid #579db059;border-radius:8px;font-size:12px}
    #cf-neon-shell .cf-info span{display:block;color:#a5c9d6;margin-top:5px;font-size:11px}
    #cf-neon-shell .cf-warning {color:#ffdb9a;font-size:11px}
    @media(max-width:650px){#cf-neon-shell .cf-top{top:6px;left:6px;right:6px}
      #cf-neon-shell .cf-mark{padding:8px}#cf-neon-shell .cf-mark strong{font-size:11px}}
  `;
  document.head.append(style);

  const shell = document.createElement('div');
  shell.id = 'cf-neon-shell';
  shell.innerHTML = `<div class="cf-top"><div class="cf-mark"><strong>CROSSFIRE <span style="color:#6aebef">/ NEON ZENITH</span></strong>
    <small>ORIGINAL CITY · NATIVE SHADERS & ASSETS</small></div>
    <a href="/">EXIT WALKTHROUGH</a></div><div class="cf-center"></div>
    <div class="cf-info" id="cf-neon-info">Click the city to look around
       <span>WASD move · SHIFT sprint · SPACE jump · ESC unlock</span>
       <span class="cf-warning">Original map preview; multiplayer integration not enabled yet.</span>
    </div>`;
  document.body.append(shell);
  const info = document.getElementById('cf-neon-info');

  // Spawn at a genuine intersection from the ORIGINAL city layout.
  const nearest = (lines, target) => lines.reduce(
    (best, line) => Math.abs(line.p - target) < Math.abs(best.p - target) ? line : best, lines[0]);
  let x = nearest(city.xs, -720).p, z = nearest(city.zs, -150).p;
  let feet = groundAt(city, x, z, 3), vy = 0, grounded = true;
  let yaw = 0, pitch = 0;
  const keys = new Set(), nearby = [];
  const radius = 0.33, height = 1.75;
  camera.rotation.order = 'YXZ';
  camera.fov = 82;
  camera.near = 0.06;
  camera.far = Math.max(camera.far, CITY.outer * 2);
  camera.updateProjectionMatrix();

  const locked = () => document.pointerLockElement === nz.renderer.domElement;
  const canvas = nz.renderer.domElement;
  canvas.addEventListener('click', () => canvas.requestPointerLock?.());
  addEventListener('pointerlockchange', () => {
    info.firstChild.textContent = locked() ? 'Exploring original Neon Zenith' : 'Click the city to look around';
  });
  addEventListener('keydown', e => {
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('mousemove', e => {
    if (!locked()) return;
    yaw -= e.movementX * 0.0023;
    pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0023, -1.5, 1.5);
  });

  function obstructed(nx, nz, footY) {
    queryBoxes(city, nx-radius, nz-radius, nx+radius, nz+radius, nearby);
    return nearby.some(b => b.x0 < nx+radius && b.x1 > nx-radius &&
      b.z0 < nz+radius && b.z1 > nz-radius &&
      b.y0 < footY+height-0.05 && b.y1 > footY+0.22);
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now-last)/1000, 0.05);
    last = now;
    if (locked()) {
      const forward = Number(keys.has('KeyW')||keys.has('ArrowUp')) -
        Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const strafe = Number(keys.has('KeyD')||keys.has('ArrowRight')) -
        Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      const speed = (keys.has('ShiftLeft')||keys.has('ShiftRight')) ? 8.2 : 5.35;
      const norm = Math.max(1, Math.hypot(forward, strafe));
      const dx = (-Math.sin(yaw)*forward + Math.cos(yaw)*strafe) * dt*speed/norm;
      const dz = (-Math.cos(yaw)*forward - Math.sin(yaw)*strafe) * dt*speed/norm;
      if (!obstructed(x+dx,z,feet)) x += dx;
      if (!obstructed(x,z+dz,feet)) z += dz;
      if (grounded && keys.has('Space')) { vy = 7.5; grounded = false; }
      vy -= 22*dt;
      feet += vy*dt;
      const ground = groundAt(city,x,z,feet+0.15);
      if (feet <= ground) { feet=ground; vy=0; grounded=true; }
    }
    camera.position.set(x, feet+1.58, z);
    camera.rotation.set(pitch,yaw,0,'YXZ');
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
