import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const game=read('static/game.js'),models=read('static/models.js'),art=read('static/aether_game_models.js'),home=read('static/index.html');
assert.doesNotMatch(game,/createStaticCosmetic|armoryCosmetics/,'old optional overlays remain removed');
assert.match(models,/id===2\?makeS12V04Scaffold\(model,magazine\)/,'approved S-12 shotgun active');
assert.match(models,/makeAWP01V03Scaffold\(model,magazine\)/,'approved AWP v0.3 sniper active');
assert.doesNotMatch(models,/:buildAetherGameVisuals\(model,magazine,id,finish\)/,'legacy sniper must not be active');
assert.match(models,/attachAWP01V03\(root\)/,'approved AWP art is attached');
const awp=read('static/awp01_v03_model.js');
assert.match(awp,/CROSSFIRE_AWP_ReferenceInspired_v03\.glb/);
assert.doesNotMatch(home,/aether-armory|gallery-finish6/,'duplicate model gallery removed');
for(const name of ['aether-w12','aether-l7','aether-w12-rampart'])for(const finish of ['midnight','glacier','eclipse'])
 assert.equal(existsSync(new URL('../static/assets/'+name+'-'+finish+'.glb',import.meta.url)),false,'obsolete cosmetic '+name);
console.log('Approved S-12 and AWP-01 v0.3 art only; prior L7 not instantiated.');
