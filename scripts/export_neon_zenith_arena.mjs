// Generates server-authoritative gameplay collision from Neon Zenith's ORIGINAL
// deterministic city layout. Visuals continue to be rendered by the unmodified
// native Neon Zenith renderer: this JSON contains NO reconstructed city art.
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , bundledLayout, destination, weaponsPath] = process.argv;
if (!bundledLayout || !destination || !weaponsPath)
  throw new Error('Usage: node export_neon_zenith_arena.mjs <bundle.mjs> <map.json> <weapons.json>');
const { generateCity } = await import(pathToFileURL(resolve(bundledLayout)).href);
const city = generateCity(20261002);
const near = (lines, target) => lines.reduce((a, b) =>
  Math.abs(b.p - target) < Math.abs(a.p - target) ? b : a, lines[0]);
const cx = near(city.xs, -720).p;
const cz = near(city.zs, -150).p;
const half = 105;
const minX = cx-half, maxX = cx+half, minZ = cz-half, maxZ = cz+half;
const r = n => +n.toFixed(4);
const boxes = [];
const push=(x,y,z,w,h,d,kind,style='concrete')=>{
  if (![x,y,z,w,h,d].every(Number.isFinite) || w<=0 || h<=0 || d<=0)
    throw new Error('Invalid collider from original Neon Zenith layout');
  boxes.push({x:r(x),y:r(y),z:r(z),w:r(w),h:r(h),d:r(d),kind,style,zone:'market'});
};
// The authentic city ground is rendered by Neon Zenith; this is a separate
// invisible simulation support surface, matching the original street level.
push(cx,-0.5,cz,half*2,0.5,half*2,'floor','asphalt');
const sourceKinds=new Set(['bldg','shop','sign','awning','pole','roof']);
let imported=0;
for (const b of city.boxes) {
  if (!sourceKinds.has(b.kind)) continue;
  if (b.x1 < minX || b.x0 > maxX || b.z1 < minZ || b.z0 > maxZ) continue;
  const x0=Math.max(minX,b.x0),x1=Math.min(maxX,b.x1);
  const z0=Math.max(minZ,b.z0),z1=Math.min(maxZ,b.z1);
  if (x1-x0<.01 || z1-z0<.01) continue;
  const kind=b.kind==='bldg'?'building':b.kind==='roof'?'deck':'pillar';
  push((x0+x1)/2,b.y0,(z0+z1)/2,x1-x0,b.y1-b.y0,z1-z0,kind,'concrete');
  imported++;
}
// Playable FPS district bounded invisibly without stripping or replacing the
// original city's distant skyline, street props, or other render geometry.
const wallH=120;
push(minX-.45,0,cz,.9,wallH,half*2+2,'boundary');
push(maxX+.45,0,cz,.9,wallH,half*2+2,'boundary');
push(cx,0,minZ-.45,half*2+2,wallH,.9,'boundary');
push(cx,0,maxZ+.45,half*2+2,wallH,.9,'boundary');

function clear(x,z) {
  return !boxes.some(b => b.kind!=='floor' && b.kind!=='boundary' &&
    Math.abs(x-b.x)<b.w/2+.7 && Math.abs(z-b.z)<b.d/2+.7 &&
    b.y < 1.75 && b.y+b.h > 0.05);
}
const spawns=[];
const streetsX=city.xs.filter(l=>l.p>minX+12&&l.p<maxX-12);
const streetsZ=city.zs.filter(l=>l.p>minZ+12&&l.p<maxZ-12);
function addSpawn(x,z) {
  if(x<minX+8||x>maxX-8||z<minZ+8||z>maxZ-8)return;
  if(!clear(x,z) || spawns.some(([sx,,sz])=>Math.hypot(x-sx,z-sz)<16))return;
  spawns.push([r(x),0,r(z)]);
}
// Distributed street-level spawn points along the actual original roads,
// not just intersections (a 210m district may have only four junctions).
for (const x of streetsX) for(let z=minZ+12;z<maxZ-12;z+=24)
  addSpawn(x.p,z);
for (const z of streetsZ) for(let x=minX+12;x<maxX-12;x+=24)
  addSpawn(x,z.p);
for (const x of streetsX) for(const z of streetsZ)
  addSpawn(x.p,z.p);
if (spawns.length<6)
  throw new Error(`Neon arena generated only ${spawns.length} safe spawns; inspect upstream layout`);

const output={
  id:'neon_zenith',name:'Neon Zenith',revision:'03.2-native',
  theme:'cyberpunk-native',engine:'neon-zenith-native',
  originalScene:'/neon/?crossfire-mp',
  upstream:'billpwchan/neon-zenith',seed:20261002,
  size:half*2,center:{x:cx,z:cz},
  bounds:{minX,maxX,minZ,maxZ},
  palette:{concrete:'#64717c',asphalt:'#2e3544',cyan:'#4ae7ff',
    magenta:'#f23bda',amber:'#f2a54d',white:'#e2f6ff'},
  boxes,spawns,weapons:JSON.parse(fs.readFileSync(weaponsPath,'utf8')),
  zones:[{id:'market',name:'Temple District',x:cx,z:cz,w:half*2,d:half*2,color:'#458eb0'}],
  routes:[],stairs:[],features:[],decor:[],practiceTargets:[],
};
fs.writeFileSync(destination,JSON.stringify(output)+'\n');
console.log(`Neon Zenith native arena: ${imported} upstream colliders; ${spawns.length} spawns; center=(${cx},${cz}); ${Math.round(fs.statSync(destination).size/1024)} KB`);
