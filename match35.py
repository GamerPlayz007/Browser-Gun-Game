"""CROSSFIRE Stage 3.5 — authoritative round and leaderboard rules.

The single Python server owns all scores, progression, ranks and victories.
The browser may only format fields from the room's state snapshots.
"""
DEATHMATCH_GOAL = 15
KILLS_PER_TIER = 3
MATCH_DURATION = 360
COUNTDOWN_DURATION = 3
RESPAWN_DURATION = 3

def goal(mode,weapon_count):
    return weapon_count * KILLS_PER_TIER if mode == 'gungame' else DEATHMATCH_GOAL

def tier_for_kills(kills,weapon_count):
    return min(max(0,int(kills)) // KILLS_PER_TIER, max(0,weapon_count-1))

def standings(players):
    """Deterministic standings; rank ties share a rank, IDs disambiguate names."""
    ordered = sorted(players.values(),
        key=lambda p:(-p['kills'],p['deaths'],-p['headshots'],p['name'].casefold(),p['id']))
    out=[]
    prior=None
    for index,p in enumerate(ordered):
        key=(-p['kills'],p['deaths'])
        rank=out[-1]['rank'] if key==prior else index+1
        out.append(dict(id=p['id'],name=p['name'],rank=rank,
            kills=p['kills'],deaths=p['deaths'],headshots=p['headshots'],
            streak=p.get('streak',0),bestStreak=p.get('best_streak',0),
            weapon=p['weapon']))
        prior=key
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
        killsPerTier=KILLS_PER_TIER,tiers=weapon_count if mode=='gungame' else 0)
