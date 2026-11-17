"""CROSSFIRE 05.7 — server-owned arcade bots for the solo/co-op Bot Assault mode.

Bots are synthetic game actors, not WebSocket clients or extra room slots.
They make coarse-grained movement decisions and play under the same
authoritative map collision and visibility rules as players.
"""
import math
import random
from map_registry import ray_solid

MODE='botmatch'
BOT_COUNT=4
BOT_GOAL=20
BOT_WIN_GOAL=12
BOT_RESPAWN_SECONDS=3.
BOT_THINK_SECONDS=.28
BOT_FIRE_SECONDS=1.1
BOT_FIRE_RANGE=29.
BOT_NAMES=('SPECTER 01','SPECTER 02','SPECTER 03','SPECTER 04')

def is_bot_mode(mode):
    return mode==MODE

def visible(arena,start,end):
    """Sight line is blocked by current authoritative solid map geometry."""
    delta=tuple(end[i]-start[i] for i in range(3))
    length=math.sqrt(sum(v*v for v in delta))
    if length<=1e-5:return True
    # Octavus and Dust use original triangle surfaces, never the legacy
    # (empty) box lists. Bots otherwise have unfair vision through walls.
    if arena.id in ('octavus','dust_corridor'):
        if arena.id=='octavus':
            from octavus_world import get_octavus_world
            mesh=get_octavus_world()
        else:
            from dust_world64 import get_dust_world64
            mesh=get_dust_world64()
        hit=mesh.raycast(start,end)
        return hit is None or hit['distance']>=length-.12
    direction=tuple(v/length for v in delta)
    for solid in arena.boxes:
        hit=ray_solid(start,direction,solid)
        if hit is not None and hit<length-.12:return False
    return True

def target_for(bot,humans,arena):
    """Nearest visible living operator, or nearest living operator for movement."""
    alive=[p for p in humans.values() if p['hp']>0]
    if not alive:return None,False
    nearby=sorted(alive,key=lambda p:(bot['x']-p['x'])**2+(bot['z']-p['z'])**2)
    eye=(bot['x'],bot['y']+1.42,bot['z'])
    for human in nearby:
        if math.hypot(human['x']-bot['x'],human['z']-bot['z'])>BOT_FIRE_RANGE:continue
        if visible(arena,eye,(human['x'],human['y']+1.12,human['z'])):
            return human,True
    return nearby[0],False

def normalize_angle(angle):
    return (angle+math.pi)%(2*math.pi)-math.pi

def decide(bot,humans,arena,now):
    """Coarse bot navigation: pursuit, gentle strafe, and collision recovery.

    Actual movement is advanced by movement_live.step_player at 60 Hz.
    """
    target,can_see=target_for(bot,humans,arena)
    bot['target_id']=target['id'] if target else None
    bot['can_see']=can_see
    if target is None:
        bot['input']={}
        bot['think_at']=now+BOT_THINK_SECONDS
        return
    waypoint=None
    if arena.id=='octavus' and not can_see:
        from octavus_nav73 import next_octavus_waypoint
        waypoint=next_octavus_waypoint(bot,target,now)
    goal_x,goal_z=(waypoint[0],waypoint[2]) if waypoint else (target['x'],target['z'])
    dx=goal_x-bot['x'];dz=goal_z-bot['z']
    dist=math.hypot(dx,dz)
    angle=math.atan2(-dx,-dz)
    bot['yaw']=(bot['yaw']+max(-.52,min(.52,normalize_angle(angle-bot['yaw']))))%(2*math.pi)
    bot['pitch']=max(-.7,min(.7,math.atan2(target['y']+1.12-bot['y']-1.42,max(.1,dist))))
    # Navigation recovery picks a lateral route after repeated collision stalls.
    prev=bot.get('last_check',(bot['x'],bot['z']))
    if now>=bot.get('check_at',0):
        progress=math.hypot(bot['x']-prev[0],bot['z']-prev[1])
        if progress<.22 and dist>8:
            bot['detour_until']=now+1.35
        bot['last_check']=(bot['x'],bot['z'])
        bot['check_at']=now+1.
    detour=now<bot.get('detour_until',0)
    side=(int(bot['id'].split('-')[-1])%2)==0
    bot['input']={
        'w':(dist>2.5 if waypoint else dist>12) and not detour,
        's':not waypoint and can_see and dist<7,
        'a':(side and can_see and dist<24) or (detour and side),
        'd':((not side) and can_see and dist<24) or (detour and not side),
        'sprint':dist>(10 if waypoint else 22) and not can_see,
        'jump':detour and int(now*2)%2==0,
        'ads':False,
    }
    bot['think_at']=now+BOT_THINK_SECONDS

def can_attack(bot,humans,arena,now):
    if bot['hp']<=0 or now<bot.get('attack_at',0):
        return None
    target=humans.get(bot.get('target_id'))
    if not target or target['hp']<=0:
        return None
    dist=math.hypot(target['x']-bot['x'],target['z']-bot['z'])
    if dist>BOT_FIRE_RANGE:
        return None
    if not visible(arena,(bot['x'],bot['y']+1.42,bot['z']),
                   (target['x'],target['y']+1.12,target['z'])):
        return None
    return target

def miss_offset():
    """Tiny game-only aiming variance to avoid artificial perfect accuracy."""
    return random.uniform(-.095,.095),random.uniform(-.05,.05)
