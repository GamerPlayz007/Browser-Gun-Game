"""CROSSFIRE Stage 3.5 — authoritative round and leaderboard rules.

The single Python server owns all scores, progression, ranks and victories.
The browser may only format fields from the room's state snapshots.
"""
DEATHMATCH_GOAL = 15
KILLS_PER_TIER = 3
MATCH_DURATION = 360
COUNTDOWN_DURATION = 3
RESPAWN_DURATION = 3
from modes54 import TEAM_KILL_GOAL,CONTROL_GOAL,is_team_mode

def goal(mode,weapon_count):
    return (weapon_count * KILLS_PER_TIER if mode == 'gungame' else
            TEAM_KILL_GOAL if mode == 'teamdeathmatch' else
            CONTROL_GOAL if mode == 'control' else DEATHMATCH_GOAL)

def tier_for_kills(kills,weapon_count):
    return min(max(0,int(kills)) // KILLS_PER_TIER, max(0,weapon_count-1))

def standings(players,mode=None):
    """Stable rankings: team modes group Azure/Ember and rank within each team."""
    grouped=is_team_mode(mode)
    def key(p):
        performance=(-p['kills'],p['deaths'],-p['headshots'],
                     p['name'].casefold(),p['id'])
        return ((0 if p.get('team')=='azure' else 1),*performance) if grouped else performance
    ordered=sorted(players.values(),key=key)
    out=[];prior=None;within=0
    for index,p in enumerate(ordered):
        team=p.get('team') if grouped else None
        if grouped and (not out or out[-1].get('team')!=team):
            within=0;prior=None
        within+=1
        rank_key=(team,-p['kills'],p['deaths'])
        rank=out[-1]['rank'] if rank_key==prior else (within if grouped else index+1)
        out.append(dict(id=p['id'],name=p['name'],team=team,
            ready=p.get('ready',False),rank=rank,
            kills=p['kills'],deaths=p['deaths'],headshots=p['headshots'],
            streak=p.get('streak',0),bestStreak=p.get('best_streak',0),
            weapon=p['weapon']))
        prior=rank_key
    return out

def leading_player(players):
    ranks=standings(players)
    if not ranks:return None
    return ranks[0]['id'] if len(ranks)==1 or ranks[1]['rank']!=1 else None

def timed_winner(players):
    ranks=standings(players)
    if not ranks or (len(ranks)>1 and ranks[0]['rank']==ranks[1]['rank']):
        return None
    return players[ranks[0]['id']]

def rules(mode,weapon_count):
    return dict(goal=goal(mode,weapon_count),duration=MATCH_DURATION,
        countdown=COUNTDOWN_DURATION,respawn=RESPAWN_DURATION,
        teamBased=is_team_mode(mode),controlPoint=mode=='control',
        killsPerTier=KILLS_PER_TIER,tiers=weapon_count if mode=='gungame' else 0)
