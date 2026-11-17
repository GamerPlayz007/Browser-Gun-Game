/**
 * Deterministic raycast comparison cases against Dust Corridor's ORIGINAL
 * JS triangle BVH, for testing Python server geometry independently.
 * Output is ephemeral test data; not a new map or game.
 */
import fs from 'node:fs';
import * as THREE from 'three';
import {MapGenerator} from '../static/dust_corridor/src/world/MapGenerator.js';
import {BVH} from '../static/dust_corridor/src/physics/BVH.js';

const map=new MapGenerator().generate();
const tree=new BVH(map.soup);
const tests=[];
function ray(start,end,label){
 const s=new THREE.Vector3(...start),e=new THREE.Vector3(...end);
 const dir=e.sub(s),length=dir.length();
 const hit=tree.raycast(s,dir.normalize(),length);
 tests.push({label,start,end,hit:hit.hit?{
  fraction:Number((hit.t/length).toFixed(8)),
  surface:hit.surface
 }:null});
}
for(const x of [-26.3,-8,0,8,26.3]){
 for(const z of [-68,-43,-12,7,47,65])
  ray([x,5,z],[x,-1,z],String(x)+'/'+String(z)+' ground');
}
for(const z of [-57,-37,1,23,48,66]){
 ray([0,1.6,z],[46,1.6,z],'east wall '+z);
 ray([0,1.6,z],[-46,1.6,z],'west wall '+z);
}
for(const z of [-70,-35,0,39]){
 ray([0,1.6,z],[0,1.6,z+26],'street '+z);
}
fs.writeFileSync('stage64_probe_fixture.json',JSON.stringify({
 sourceTriangles:map.soup.count,probes:tests
},null,2)+'\n');
console.log('Dust 6.4: created',tests.length,'original JS BVH raycast parity fixtures');
