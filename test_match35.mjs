import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchPresentation,finishPresentation,matchNotice} from './static/match35.js';

const alice={id:'a',name:'Alpha',kills:7,deaths:2,headshots:3,streak:2,bestStreak:4,rank:1};
const bob={id:'b',name:'Bravo',kills:5,deaths:3,headshots:1,streak:0,bestStreak:2,rank:2};
const deathmatch={
 mode:'deathmatch',phase:'playing',round:2,rules:{goal:15,duration:360,respawn:3,
  countdown:3,killsPerTier:3,tiers:0},standings:[alice,bob],leaderId:'a',
 remaining:193.8
};
const p=matchPresentation(deathmatch,alice);
assert.equal(p.goal,15);
assert.equal(p.round,2);
assert.equal(p.rankText,'#1 / 2');
assert.equal(p.leaderText,'YOU LEAD · 7 PTS');
assert.equal(p.objective,'FIRST TO 15');
assert.ok(Math.abs(p.progress-100*7/15)<.001);
assert.equal(matchPresentation(deathmatch,bob).leaderText,'Alpha LEADS · 7 PTS');
assert.equal(matchPresentation({...deathmatch,phase:'lobby'},alice).objective,'WAITING FOR HOST');
assert.equal(matchPresentation({...deathmatch,leaderId:null},bob).leaderText,'TIED FOR THE LEAD');

const guns={...deathmatch,mode:'gungame',rules:{...deathmatch.rules,goal:12,tiers:4}};
const tiers=[0,2,3,5,6,8,9,11,12].map(kills=>{
 const data=matchPresentation(guns,{...alice,kills});
 return [data.tier,data.tierProgress,Math.round(data.progress)];
});
assert.deepEqual(tiers,[[1,0,0],[1,2,17],[2,0,25],[2,2,42],
 [3,0,50],[3,2,67],[4,0,75],[4,2,92],[4,0,100]]);
assert.equal(matchPresentation(guns,{...alice,kills:7}).objective,'TIER 3 / 4 · 7 / 12');

const winner=finishPresentation({...deathmatch,winner:'Alpha',winnerId:'a',winReason:'score'});
assert.equal(winner.headline,'Alpha WINS');
assert.equal(winner.detail,'SCORE LIMIT REACHED');
assert.equal(winner.podium,'7 POINTS · 2 DEATHS · 4 BEST STREAK');
const timeout=finishPresentation({...deathmatch,winner:'Bravo',winnerId:'b',winReason:'time'});
assert.equal(timeout.detail,'TIME EXPIRED');
assert.equal(finishPresentation({...deathmatch,winner:'DRAW',winnerId:null}).headline,'A DEAD HEAT.');

const weapons=[{name:'VANGUARD'},{name:'VIPER'}];
assert.equal(matchNotice({type:'tier_up',id:'a',name:'Alpha',tier:2,weapon:1},'a',weapons),
 'TIER 2 UNLOCKED · VIPER');
assert.equal(matchNotice({type:'tier_up',id:'b',name:'Bravo',tier:2,weapon:1},'a',weapons),
 'Bravo REACHED TIER 2');
assert.equal(matchNotice({type:'streak',id:'a',name:'Alpha',count:5},'a'),'5 IN A ROW · KEEP THE MOMENTUM');
assert.equal(matchNotice({type:'leader',id:'a',name:'Alpha'},'a'),'YOU TAKE THE LEAD');
assert.equal(matchNotice({type:'round_start',round:2},'a'),'ROUND 2 · GO');
assert.equal(matchNotice({type:'round_end',winnerId:null},'a'),'ROUND COMPLETE · DRAW');
assert.equal(matchNotice({type:'notice',text:'Connected'},'a'),null);

const html=fs.readFileSync('./static/index.html','utf8');
for(const id of ['round-label','lead-status','match-banner','match-award']){
 assert.ok(html.includes(`id="${id}"`),`Missing live UI element ${id}`);
}
assert.ok(html.includes('<th>STREAK</th>'));
assert.ok(html.includes('<sup>03.'),'Phase 3+ version badge must be visible');
const game=fs.readFileSync('./static/game.js','utf8');
assert.ok(game.includes('matchPresentation(data,me)'));
assert.ok(game.includes('data.standings'));
assert.ok(game.includes('finishPresentation(data)'));
assert.ok(game.includes('matchNotice(e,myId,weapons)'));
console.log('Stage 3.5: authoritative score UI, ranking, Gun Game tiers, results, events and HUD contracts passed.');
