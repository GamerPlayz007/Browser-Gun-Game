/** CROSSFIRE 05.5 — presentation-only competitive helpers.
 * Server snapshots remain authoritative for room readiness, team assignments,
 * round results and player positions.
 */
export const TEAM_COLORS55=Object.freeze({azure:'#65ddff',ember:'#ffaf7f'});

export function readyView55(state={},myId=null){
 const players=(Array.isArray(state.players)?state.players:[]).filter(p=>!p.bot);
 const ready=players.filter(p=>p.ready===true).length;
 const me=players.find(p=>p.id===myId);
 const between=state.phase==='lobby'||state.phase==='results';
 const teamMode=state.nextMode==='teamdeathmatch'||state.nextMode==='control'||
   (!state.nextMode&&(state.mode==='teamdeathmatch'||state.mode==='control'));
 return {ready,total:players.length,mine:me?.ready===true,
   canReady:between&&!!me,canBalance:between&&teamMode&&state.host===myId};
}

export function spectatorCandidates55(state={},myId=null){
 if(state.phase!=='playing')return [];
 const players=(Array.isArray(state.players)?state.players:[]).filter(p=>!p.bot);
 const me=players.find(p=>p.id===myId);
 if(!me||me.hp>0)return [];
 const teamMode=state.mode==='teamdeathmatch'||state.mode==='control';
 return players.filter(p=>p.id!==myId&&p.hp>0&&
  (!teamMode||(me.team!=null&&p.team===me.team)))
  .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))||
      String(a.id||'').localeCompare(String(b.id||'')));
}

export function cycleSpectator55(current,candidates,delta=1){
 if(!Array.isArray(candidates)||!candidates.length)return null;
 const ids=candidates.map(p=>p.id);
 const i=ids.indexOf(current);
 if(i<0)return ids[0];
 return ids[(i+(delta>=0?1:-1)+ids.length)%ids.length];
}

export function teamStandings55(state={}){
 const entries=Array.isArray(state.standings)?state.standings:[];
 const scores=state.teamScores||{};
 return ['azure','ember'].map(team=>({
  team,score:Math.max(0,Math.floor(Number(scores[team])||0)),
  players:entries.filter(p=>p.team===team)
 }));
}
