"""CROSSFIRE 05.4 — deterministic two-team matchmaking and Control Point rules.

Team scores, eligibility, and objective presence are always server-owned.
No new map collider, spawn, or client authority is introduced.
"""
import math

TEAM_MODES=frozenset(('teamdeathmatch','control'))
TEAM_IDS=('azure','ember')
TEAM_NAMES={'azure':'AZURE','ember':'EMBER'}
TEAM_KILL_GOAL=30
CONTROL_GOAL=60
CONTROL_RADIUS=6.
# Existing, accessible Neon Plaza ground near the central routes.
CONTROL_POINT={'id':'neon-beacon','name':'NEON BEACON','x':2.,'y':0.,'z':22.,'radius':CONTROL_RADIUS}

def is_team_mode(mode):
    return mode in TEAM_MODES

def team_counts(players):
    return {team:sum(p.get('team')==team for p in players.values()) for team in TEAM_IDS}

def next_team(players):
    counts=team_counts(players)
    return min(TEAM_IDS,key=lambda team:(counts[team],TEAM_IDS.index(team)))

def balance_teams(players):
    """Reset round teams deterministically; an even player count balances exactly."""
    for index,p in enumerate(players.values()):
        p['team']=TEAM_IDS[index%len(TEAM_IDS)]
    return team_counts(players)

def winner_team(scores):
    azure=int(scores.get('azure',0))
    ember=int(scores.get('ember',0))
    return 'azure' if azure>ember else 'ember' if ember>azure else None

def presence(players,point=CONTROL_POINT):
    """Count only alive players at the beacon on the appropriate vertical level."""
    counts={team:0 for team in TEAM_IDS}
    x,y,z,r=point['x'],point['y'],point['z'],point['radius']
    for p in players.values():
        team=p.get('team')
        if team not in counts or p.get('hp',0)<=0:continue
        if abs(p['y']-y)>2.5:continue
        if (p['x']-x)**2+(p['z']-z)**2<=r*r:counts[team]+=1
    return counts

def controller(players,point=CONTROL_POINT):
    counts=presence(players,point)
    if counts['azure'] and counts['ember']:return None,True,counts
    team=next((t for t in TEAM_IDS if counts[t]),None)
    return team,False,counts
