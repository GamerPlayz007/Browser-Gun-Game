/** CROSSFIRE Phase 2.5: pure spawn-selection experiment, NOT server integrated.
 * Coordinates: [x, feetY, z]. Does NOT evaluate line of sight or player intent.
 * Server must verify world support, collision, and session state before use.
 */
const xy=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
/**
 * @param {number[][]} spawns static candidate list
 * @param {number[][]} currentPlayers approximate current feet positions
 * @param {object} options {recentSpawnIds: 1-based IDs[], occupiedIds: 1-based IDs[]}
 * @returns ranked list of {id,position,score,nearestXZ} ordered safest-first by proxy
 */
export function rankSpawnCandidates(spawns,currentPlayers=[],options={}){
 const recent=new Set(options.recentSpawnIds||[]), occupied=new Set(options.occupiedIds||[]);
 return spawns.map((position,i)=>{
  const id=i+1,nearestXZ=currentPlayers.length?Math.min(...currentPlayers.map(p=>xy(position,p))):Infinity;
  const nearestClamped=Number.isFinite(nearestXZ)?Math.min(nearestXZ,60):30;
  const score=nearestClamped- (recent.has(id)?25:0) - (occupied.has(id)?10000:0);
  return {id,position,nearestXZ,score,eligible:!occupied.has(id)};
 }).sort((a,b)=>b.score-a.score||a.id-b.id);
}
export function chooseSpawn(spawns,currentPlayers=[],options={}){
 const r=rankSpawnCandidates(spawns,currentPlayers,options);
 return r.find(item=>item.eligible)||null;
}