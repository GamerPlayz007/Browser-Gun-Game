import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readyView55,spectatorCandidates55,cycleSpectator55,teamStandings55}
  from './static/competitive55.js';

const alpha={id:'alpha',name:'Alpha',team:'azure',hp:0,ready:false};
const allyA={id:'a',name:'Aaron',team:'azure',hp:75,ready:true};
const allyB={id:'b',name:'Britt',team:'azure',hp:100,ready:false};
const enemy={id:'e',name:'Enemy',team:'ember',hp:100,ready:true};
const downed={id:'d',name:'Downed',team:'azure',hp:0,ready:false};
const state={phase:'playing',mode:'teamdeathmatch',nextMode:'teamdeathmatch',
 host:'alpha',players:[alpha,allyB,enemy,downed,allyA],
 teamScores:{azure:3,ember:7}};
let choices=spectatorCandidates55(state,'alpha');
assert.deepEqual(choices.map(p=>p.id),['a','b'],
 'Spectators may follow only living teammates during team games');
assert.equal(cycleSpectator55(null,choices), 'a');
assert.equal(cycleSpectator55('a',choices,1),'b');
assert.equal(cycleSpectator55('b',choices,1),'a','Forward cycling wraps');
assert.equal(cycleSpectator55('a',choices,-1),'b','Backward cycling wraps');
assert.equal(cycleSpectator55('absent',choices),'a');
assert.equal(cycleSpectator55('a',[],1),null);
assert.deepEqual(spectatorCandidates55({...state,phase:'lobby'},'alpha'),[]);
assert.deepEqual(spectatorCandidates55({...state,
 players:[{...alpha,hp:100},allyA,enemy]},'alpha'),[]);
assert.deepEqual(spectatorCandidates55({...state,players:[alpha,enemy]},'alpha'),[],
 'Enemy cannot be spectated when no teammate is alive');
const free={...state,mode:'deathmatch'};
assert.deepEqual(spectatorCandidates55(free,'alpha').map(p=>p.id),['a','b','e'],
 'FFA may spectate other living players');
assert.equal(spectatorCandidates55(state,'other').length,0);
assert.equal(spectatorCandidates55({...state,mode:'control'},'alpha').length,2);

const between={...state,phase:'lobby',players:[alpha,allyA,allyB,enemy]};
const ready=readyView55(between,'alpha');
assert.deepEqual(ready,{ready:2,total:4,mine:false,canReady:true,canBalance:true});
assert.equal(readyView55(between,'a').canBalance,false);
assert.equal(readyView55({...between,phase:'playing'},'alpha').canReady,false);
assert.equal(readyView55({...between,nextMode:'deathmatch'},'alpha').canBalance,false);
assert.equal(readyView55({...between,phase:'results'},'a').canReady,true);
assert.equal(readyView55({...between,players:[]},'alpha').canReady,false);
assert.equal(readyView55({...between,players:[]},'alpha').ready,0);

const groups=teamStandings55({teamScores:{azure:17,ember:11},standings:[
 {...allyA,kills:10},{...enemy,kills:9},{...allyB,kills:7}
]});
assert.deepEqual(groups.map(g=>[g.team,g.score,g.players.length]),
 [['azure',17,2],['ember',11,1]]);
assert.deepEqual(groups[0].players.map(p=>p.id),['a','b']);
assert.equal(teamStandings55().length,2);

const html=fs.readFileSync('./static/index.html','utf8');
for(const id of ['ready-panel55','ready-summary55','ready-toggle55',
 'balance-teams55','spectate-panel55','spectate-label55',
 'spectate-prev55','spectate-next55']){
 assert.ok(html.includes('id="'+id+'"'),'Missing competitive 05.5 UI '+id);
}
const game=fs.readFileSync('./static/game.js','utf8');
for(const fragment of ['spectatorCandidates55(data,myId)','cycleSpectator55(',
 'spectatorTarget55','state.teamScores','readyView55(state,myId)',
 "send({type:'balance'})","send({type:'ready',ready:!me?.ready})",
 "e.code==='ArrowLeft'||e.code==='ArrowRight'"]){
 assert.ok(game.includes(fragment),'Missing game connection: '+fragment);
}
assert.ok(game.includes('p.hp>0'),'Dead players may not be spectated');
assert.ok(game.includes('teamStandings55'),'Grouped team standings must be rendered');
console.log('05.5: ready-up, host controls, team standings and safe spectator cycling passed.');
