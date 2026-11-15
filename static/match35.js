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
 const teamMode=mode==='teamdeathmatch'||mode==='control';
 const botMode=mode==='botmatch';
 const aiScore=cleanInt(state.aiScore),botScore=cleanInt(state.botScore);
 const botGoal=Math.max(1,cleanInt(rules.botGoal,12));
 const team=me?.team==='azure'||me?.team==='ember'?me.team:null;
 const scores=state.teamScores||{};
 const azure=cleanInt(scores.azure),ember=cleanInt(scores.ember);
 const teamPoints=team==='azure'?azure:team==='ember'?ember:Math.max(azure,ember);
 const objectivePoint=state.objective||null;
 const pointStatus=objectivePoint?.contested?'BEACON CONTESTED':
  objectivePoint?.controller==='azure'?'AZURE CONTROLS':
  objectivePoint?.controller==='ember'?'EMBER CONTROLS':'BEACON UNCLAIMED';
 const ranks=Array.isArray(state.standings)?state.standings:[];
 const mine=ranks.find(p=>p.id===me.id);
 const leader=ranks[0]||null,leaderId=state.leaderId||null;
 const isGunGame=mode==='gungame';
 const tier=Math.min(tiers,Math.floor(kills/perTier)+1);
 const tierProgress=Math.min(perTier,kills%perTier);
 const progress=clamp(100*(botMode?aiScore:teamMode?teamPoints:kills)/goal,0,100);
 const objective=state.phase==='lobby'?'WAITING FOR HOST':
   botMode?`BOT ASSAULT · ${aiScore} / ${goal} ELIMINATIONS`:
   mode==='teamdeathmatch'?`TEAM DEATHMATCH · FIRST TO ${goal}`:
   mode==='control'?`CONTROL POINT · FIRST TO ${goal}`:
   isGunGame?`TIER ${tier} / ${tiers} · ${Math.min(kills,goal)} / ${goal}`:
   `FIRST TO ${goal}`;
 const leaderText=botMode?`OPERATORS ${aiScore} / ${goal}  ·  BOTS ${botScore} / ${botGoal}`:
  teamMode?`AZURE ${azure}  ·  EMBER ${ember}${mode==='control'?'  ·  '+pointStatus:''}`:!leader?'WAITING FOR PLAYERS':
   !leaderId?'TIED FOR THE LEAD':
   leaderId===me.id?`YOU LEAD · ${leader.kills} PTS`:
   `${leader.name} LEADS · ${leader.kills} PTS`;
 const rankText=botMode?`CO-OP · ${ranks.length} OPERATORS`:
  (team?team.toUpperCase()+' TEAM · ':'')+
  (mine?`#${mine.rank} / ${ranks.length}`:`0 / ${ranks.length}`);
 return {goal,round,progress,objective,rankText,leaderText,
  teamMode,team,azure,ember,pointStatus,botMode,aiScore,botScore,botGoal,
  isGunGame,tier,tierProgress,perTier,tiers,
  rank:mine?.rank||null,
  remaining:Math.max(0,Number(state.remaining)||0)};
}
export function finishPresentation(state={}){
 const winner=state.winner||'DRAW',id=state.winnerId||null;
 if(state.mode==='botmatch'){
  const playerWin=winner==='PLAYERS';
  return {headline:playerWin?'OPERATORS WIN!':'BOTS WIN THIS ROUND',
   detail:playerWin?'ASSAULT CLEARED':state.winReason==='time'?'TIME EXPIRED':'BOTS OVERRAN THE SQUAD',
   podium:'OPERATORS '+cleanInt(state.aiScore)+' / '+Math.max(1,cleanInt(state.rules?.goal,20))+
    ' · BOTS '+cleanInt(state.botScore)+' / '+Math.max(1,cleanInt(state.rules?.botGoal,12))};
 }

 const winningTeam=state.winnerTeam||null,teamMode=state.mode==='teamdeathmatch'||state.mode==='control';
 const reason=state.winReason||'time',isDraw=!id&&!winningTeam;
 const standing=Array.isArray(state.standings)?
  state.standings.find(p=>p.id===id):null;
 const headline=isDraw?'A DEAD HEAT.':`${winner} WINS`;
 const detail=isDraw?'TIED AT THE TOP':
  reason==='objective'?'BEACON SECURED':
  reason==='score'?(teamMode?'TEAM SCORE LIMIT REACHED':'SCORE LIMIT REACHED'):'TIME EXPIRED';
 const podium=teamMode?
  `AZURE ${cleanInt(state.teamScores?.azure)} · EMBER ${cleanInt(state.teamScores?.ember)}`:
  isDraw?'EVERY POINT MATTERED':
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
  case 'bot_score':return `OPERATORS ${cleanInt(event.players)} · BOTS ${cleanInt(event.bots)}`;
  case 'control_status':return event.contested?'BEACON CONTESTED':
   event.team?`${event.team.toUpperCase()} CONTROLS THE BEACON`:'BEACON UNCLAIMED';
  case 'round_end':if(event.mode==='botmatch')return event.winner==='PLAYERS'?'BOT ASSAULT CLEARED':'BOTS WIN THE ROUND';
   return event.winnerId===null&&!event.winnerTeam?
     'ROUND COMPLETE · DRAW':`${event.winner} TAKES THE ROUND`;
  default:return null;
 }
}
