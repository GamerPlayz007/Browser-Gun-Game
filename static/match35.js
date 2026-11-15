/** CROSSFIRE Stage 3.5: format the server-authoritative match protocol.
 * All scores, rankings, and winners originate from Python room snapshots.
 */
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const cleanInt=(v,otherwise=0)=>Number.isFinite(v)?Math.max(0,Math.trunc(v)):otherwise;
export function matchPresentation(state={},me={}){
 const rules=state.rules||{},mode=state.mode||'deathmatch';
 const goal=Math.max(1,cleanInt(rules.goal,mode==='gungame'?12:15));
 const tiers=Math.max(1,cleanInt(rules.tiers,4));
 const perTier=Math.max(1,cleanInt(rules.killsPerTier,3));
 const kills=cleanInt(me?.kills),round=cleanInt(state.round);
 const ranks=Array.isArray(state.standings)?state.standings:[];
 const mine=ranks.find(p=>p.id===me.id);
 const leader=ranks[0]||null,leaderId=state.leaderId||null;
 const isGunGame=mode==='gungame';
 const tier=Math.min(tiers,Math.floor(kills/perTier)+1);
 const tierProgress=Math.min(perTier,kills%perTier);
 const progress=clamp(100*kills/goal,0,100);
 const objective=state.phase==='lobby'?'WAITING FOR HOST':
   isGunGame?`TIER ${tier} / ${tiers} · ${Math.min(kills,goal)} / ${goal}`:
   `FIRST TO ${goal}`;
 const leaderText=!leader?'WAITING FOR PLAYERS':
   !leaderId?'TIED FOR THE LEAD':
   leaderId===me.id?`YOU LEAD · ${leader.kills} PTS`:
   `${leader.name} LEADS · ${leader.kills} PTS`;
 const rankText=mine?`#${mine.rank} / ${ranks.length}`:`0 / ${ranks.length}`;
 return {goal,round,progress,objective,rankText,leaderText,
  isGunGame,tier,tierProgress,perTier,tiers,
  rank:mine?.rank||null,
  remaining:Math.max(0,Number(state.remaining)||0)};
}
export function finishPresentation(state={}){
 const winner=state.winner||'DRAW',id=state.winnerId||null;
 const reason=state.winReason||'time',isDraw=!id;
 const standing=Array.isArray(state.standings)?
  state.standings.find(p=>p.id===id):null;
 const headline=isDraw?'A DEAD HEAT.':`${winner} WINS`;
 const detail=isDraw?'TIED AT THE TOP':
  reason==='score'?'SCORE LIMIT REACHED':'TIME EXPIRED';
 const podium=isDraw?'EVERY POINT MATTERED':
  `${cleanInt(standing?.kills)} POINTS · ${cleanInt(standing?.deaths)} DEATHS · ${cleanInt(standing?.bestStreak)} BEST STREAK`;
 return {headline,detail,podium};
}
export function matchNotice(event,myId,weapons=[]){
 if(!event||typeof event.type!=='string')return null;
 switch(event.type){
  case 'tier_up':
   return event.id===myId?
    `TIER ${event.tier} UNLOCKED · ${weapons[event.weapon]?.name||'NEXT WEAPON'}`:
    `${event.name} REACHED TIER ${event.tier}`;
  case 'streak':
   return event.id===myId?`${event.count} IN A ROW · KEEP THE MOMENTUM`:
    `${event.name} · ${event.count}-POINT STREAK`;
  case 'leader':
   return event.id===myId?'YOU TAKE THE LEAD':`${event.name} TAKES THE LEAD`;
  case 'round_start':return `ROUND ${event.round} · GO`;
  case 'round_end':return event.winnerId===null?
     'ROUND COMPLETE · DRAW':`${event.winner} TAKES THE ROUND`;
  default:return null;
 }
}
