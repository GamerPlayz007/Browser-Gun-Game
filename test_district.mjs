import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {simulate} from './static/physics.js';
import {createMinimap} from './static/minimap.js';
const map=JSON.parse(fs.readFileSync('static/map.json'));
let redraws=0;
const context={setTransform(){},fillRect(){},fillText(){},clearRect(){},drawImage(){redraws++;},save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){}};
globalThis.document={createElement:()=>({getContext:()=>context})};
const canvas={getContext:()=>context},label={textContent:''};
const mini=createMinimap(canvas,label,map);
mini.draw({x:0,y:0,z:22},0,1);assert.equal(label.textContent,'NEON PLAZA');assert.equal(redraws,1);
mini.draw({x:0,y:0,z:22},1,1.02);assert.equal(redraws,1);
mini.draw({x:4,y:9,z:-23},0,2);assert.equal(label.textContent,'TRANSIT DECK / UPPER LEVEL');
mini.draw({x:-24,y:1,z:6},0,3);assert.equal(label.textContent,'NIGHT MARKET');
mini.draw({x:25,y:1,z:12},0,4);assert.equal(label.textContent,'TECH ATRIUM');
console.log('Four-zone labels and throttled minimap navigation passed.');

canvas.clientWidth=520;globalThis.devicePixelRatio=2;mini.draw({x:0,y:0,z:22},0,4.01);assert.equal(canvas.width,1040);assert.equal(redraws,5);console.log('Expanded minimap follows display pixel density.');
