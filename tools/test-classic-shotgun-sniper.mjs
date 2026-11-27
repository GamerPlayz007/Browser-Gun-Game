import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const game=read('static/game.js'),models=read('static/models.js'),art=read('static/aether_game_models.js'),home=read('static/index.html');
assert.doesNotMatch(game,/createStaticCosmetic|armoryCosmetics/,'no optional newer model overrides');
assert.match(models,/buildAetherGameVisuals\(model,magazine,id,finish\)/,'classic fallback still used for weapons 2 and 3');
assert.match(art,/function buildWardrum\(\)/,'keep original shotgun');
assert.match(art,/function buildLongwatch\(\)/,'keep original sniper');
assert.doesNotMatch(home,/aether-armory|gallery-finish6/,'remove duplicate model selection');
for(const weapon of ['aether-w12','aether-l7','aether-w12-rampart']){
 for(const finish of ['midnight','glacier','eclipse']){
  assert.equal(existsSync(new URL('../static/assets/'+weapon+'-'+finish+'.glb',import.meta.url)),false,'remove '+weapon+' '+finish+' cosmetic');
 }
}
console.log('Classic shotgun/sniper only; AR and SMG untouched.');
