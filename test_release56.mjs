import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 SKINS56,skinId56,skinColor56,safeRead56,safeWrite56,
 safeName56,safeQuality56
} from './static/preferences56.js';

assert.equal(SKINS56.length,4);
assert.deepEqual(SKINS56.map(s=>s.id),[0,1,2,3]);
for(const item of SKINS56){
 assert.equal(skinId56(String(item.id)),item.id);
 assert.equal(skinColor56(item.id),item.hex);
}
for(const bad of [-1,4,8,'',undefined,null,'x','Infinity',Infinity,NaN]){
 assert.equal(skinId56(bad),0,'Invalid skin ID must fall back safely');
}
assert.equal(safeName56('  Pilot  '),'Pilot');
assert.equal(safeName56('  '),'Player');
assert.equal(safeName56('A'.repeat(32)).length,16);
assert.equal(safeQuality56('ultra'),'ultra');
assert.equal(safeQuality56('auto'),'auto');
assert.equal(safeQuality56('surprise'),'high');

const stored=new Map();
globalThis.localStorage={
 getItem(key){return stored.has(key)?stored.get(key):null;},
 setItem(key,value){stored.set(key,value);}
};
assert.equal(safeRead56('name','guest'),'guest');
assert.equal(safeWrite56('name','Alpha'),true);
assert.equal(safeRead56('name','guest'),'Alpha');
globalThis.localStorage={
 getItem(){throw new Error('SecurityError: blocked storage');},
 setItem(){throw new Error('SecurityError: blocked storage');}
};
assert.equal(safeRead56('name','Player'),'Player',
 'Restricted browser storage must not block the game lobby');
assert.equal(safeWrite56('name','Alpha'),false,
 'Restricted browser storage must be handled without crashing');

const html=fs.readFileSync('./static/index.html','utf8');
assert.ok(html.includes('<sup>V3.0 RC2</sup>'),'V3 candidate build badge');
for(const id of ['skin56-home','skin56-room','rejoin56']){
 assert.ok(html.includes('id="'+id+'"'),'Missing release UI element '+id);
}
const game=fs.readFileSync('./static/game.js','utf8');
const models=fs.readFileSync('./static/models.js','utf8');
for(const snippet of [
 "safeRead56('cf-name','')","safeWrite56('cf-name',name)",
 "safeWrite56('cf-volume',audio.volume)","safeWrite56('cf-skin56',preferredSkin56)",
 "send({type:'skin',skin:preferredSkin56})",
 'setPlayerSkin56(g,skinColor56(p.skin))',
 "disconnect('Connection closed.","$('rejoin56').onclick"
]){
 assert.ok(game.includes(snippet),'Missing V3 UI connection: '+snippet);
}
assert.ok(!game.includes('localStorage.'),'No unsafe direct storage calls');
assert.ok(models.includes('export function setPlayerSkin56('),
 'Avatar recolor helper must be present');
assert.ok(models.includes('skinMeshes56'),'Shared color materials must be tracked');
console.log('V3 RC: cosmetics, blocked storage, saved preferences and room rejoin wiring passed.');
