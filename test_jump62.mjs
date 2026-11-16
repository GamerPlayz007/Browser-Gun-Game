import assert from 'node:assert/strict';
import {createJumpLatch62} from './static/input62.js';
import {simulate,seedMovement} from './static/physics.js';
const input=createJumpLatch62();
// A short tap may be pressed and released entirely between rAF callbacks.
input.press();
assert.equal(input.read(false),true);
input.consume();
assert.equal(input.read(false),false);
input.press();
assert.equal(input.read(true),true);
input.consume();
assert.equal(input.read(true),true,'Holding Space must remain effective');
input.clear();assert.equal(input.read(false),false);
// A switchback landing is a small step ahead, not a ceiling above the player.
// Previously this forced crouch and silently prevented a Space jump.
const landing={kind:'stairLanding',x:-5.075,y:2.8,z:-16.4,w:5.6,h:.2,d:.8};
const p=seedMovement({x:-5.075,y:2.6667,z:-15.85,yaw:0,vx:0,vy:0,vz:0,
 grounded:true,crouch:false,motion_time:100,slide_until:0,slide_ready:0,
 jump_held:false,slide_held:false});
simulate(p,{jump:true},1/60,100,[landing],{speed:1});
assert.ok(p.vy>0,'Jump must not be rejected by a nearby raised landing');
assert.equal(p.crouch,false,'Raised landing must not force crouch');
// Only valid stair-adjacent surfaces get a slightly larger step threshold.
assert.equal(p.jump_consumed,true);
console.log('Stage 6.2: frame-independent Space tap and stair-adjacent jump passed.');
