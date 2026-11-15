import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchPresentation,finishPresentation,matchNotice} from './static/match35.js';
import {readyView55,spectatorCandidates55} from './static/competitive55.js';

const human={id:'h',name:'Operator',bot:false,team:null,ready:true,hp:100,
 kills:4,deaths:1,headshots:2,weapon:0};
const bot={id:'bot-1',name:'SPECTER 01',bot:true,team:'bots',ready:false,hp:100,
 kills:2,deaths:1,headshots:0,weapon:0};
const state={mode:'botmatch',phase:'playing',round:2,
 rules:{goal:20,botGoal:12,duration:360,respawn:3,bots:4},
 aiScore:9,botScore:3,players:[human,bot],standings:[{...human,rank:1}],
 remaining:200,teamScores:{azure:0,ember:0}};
const view=matchPresentation(state,human);
assert.equal(view.botMode,true);
assert.equal(view.goal,20);
assert.equal(view.botGoal,12);
assert.equal(view.aiScore,9);
assert.equal(view.botScore,3);
assert.equal(view.progress,45);
assert.ok(view.objective.includes('BOT ASSAULT'));
assert.ok(view.leaderText.includes('BOTS 3 / 12'));
assert.ok(view.rankText.includes('CO-OP'));
assert.equal(view.teamMode,false);
const win=finishPresentation({...state,phase:'results',winner:'PLAYERS',winReason:'score',aiScore:20});
assert.equal(win.headline,'OPERATORS WIN!');
assert.ok(win.detail.includes('CLEARED'));
const lose=finishPresentation({...state,phase:'results',winner:'BOTS',winReason:'time'});
assert.equal(lose.headline,'BOTS WIN THIS ROUND');
assert.ok(lose.detail.includes('TIME EXPIRED'));
assert.ok(matchNotice({type:'round_end',mode:'botmatch',winner:'PLAYERS'},'h').includes('CLEARED'));
assert.ok(matchNotice({type:'round_end',mode:'botmatch',winner:'BOTS'},'h').includes('BOTS'));
assert.ok(matchNotice({type:'bot_score',players:9,bots:3},'h').includes('OPERATORS 9'));

// Synthetic opponents may not count as lobby connections or spectator targets.
const ready=readyView55({...state,phase:'lobby',host:'h',nextMode:'botmatch'},'h');
assert.deepEqual(ready,{ready:1,total:1,mine:true,canReady:true,canBalance:false});
const downed={...human,hp:0};
const ally={...human,id:'ally',name:'Friendly',hp:100};
const deadState={...state,players:[downed,bot,ally]};
assert.deepEqual(spectatorCandidates55(deadState,'h').map(p=>p.id),['ally']);
assert.deepEqual(spectatorCandidates55({...deadState,players:[downed,bot]},'h'),[]);

const html=fs.readFileSync('./static/index.html','utf8');
const game=fs.readFileSync('./static/game.js','utf8');
const options=html.match(/data-mode="/g)||[];
assert.equal(options.length,5,'There must be five playable game modes');
assert.ok(html.includes('data-mode="botmatch"'));
assert.ok(html.includes('Solo or co-op'));
for(const fragment of [
 "botmatch:'BOT ASSAULT'","state.players.filter(p=>!p.bot)",
 "visualSkin=p.bot?0xef6a86","'OPERATORS '+match.aiScore",
 "data.players","match.botMode"
]){
 assert.ok(game.includes(fragment),'Missing client integration: '+fragment);
}
console.log('Bot Assault: PvE HUD/results, AI roster exclusion, spectator scope and lobby selection passed.');
