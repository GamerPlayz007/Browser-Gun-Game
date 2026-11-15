"""CROSSFIRE 05.5 — fairer spawns, balanced teams and round readiness.

All functions are server-side decisions. Clients cannot choose their spawns,
teammates, team scores, or readiness status for somebody else.
"""
import math
from modes54 import TEAM_IDS,team_counts

SPAWN_REUSE_WINDOW=9.
MIN_SPAWN_SEPARATION=4.5

def balanced_draft(players):
    """Snake-draft by previous-round performance; difference in size <= 1."""
    ranked=sorted(players.values(),key=lambda p:(
        -p.get('kills',0),p.get('deaths',0),-p.get('headshots',0),
        p.get('name','').casefold(),p.get('id','')))
    # [A, B, B, A] repeated distributes adjacent strong players between sides.
    order=(0,1,1,0)
    for i,p in enumerate(ranked):p['team']=TEAM_IDS[order[i%4]]
    return team_counts(players)

def spawn_score(point,player,players,history,now,visible_enemy=None):
    """Higher is safer. Punish close occupied spawns and recent reuse.

    visible_enemy is a per-candidate list of exposed, living opponents.
    The authoritative server computes sight lines against current map geometry.
    """
    x,y,z=point
    enemies=[p for p in players.values() if p is not player and
             p.get('hp',0)>0 and
             (player.get('team') is None or p.get('team')!=player.get('team'))]
    allies=[p for p in players.values() if p is not player and
            p.get('hp',0)>0 and p.get('team') is not None and
            p.get('team')==player.get('team')]
    nearby=[p for p in players.values() if p is not player and p.get('hp',0)>0]
    distance=lambda p:math.hypot(x-p['x'],z-p['z'])
    nearest=min((distance(e) for e in enemies),default=40.)
    occupied=min((distance(e) for e in nearby),default=40.)
    visible=len(visible_enemy or [])
    # The existing ranking favors moderately protected, reachable spawns.
    score=min(nearest,30.)-max(0.,nearest-38.)*.6-visible*25.-max(0.,14.-nearest)*3.
    if occupied<MIN_SPAWN_SEPARATION:
        score-=130.+(MIN_SPAWN_SEPARATION-occupied)*14.
    previous=history.get(tuple(point),-1e9)
    age=max(0.,now-previous)
    if age<SPAWN_REUSE_WINDOW:score-=4.*(SPAWN_REUSE_WINDOW-age)
    # Small team cohesion bonus, never enough to override an unsafe sightline.
    if allies:
        nearest_ally=min(distance(a) for a in allies)
        if 6.<=nearest_ally<=22.:score+=3.
    return score

def ready_summary(players):
    return dict(ready=sum(bool(p.get('ready')) for p in players.values()),
                total=len(players))
