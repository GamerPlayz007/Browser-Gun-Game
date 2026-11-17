"""CROSSFIRE v3.1 Daybreak. Server-authoritative multiplayer arena with release diagnostics."""
import asyncio, contextlib, json, math, os, random, re, secrets, time
from collections import deque
from pathlib import Path
from aiohttp import web, WSMsgType
ROOT=Path(__file__).parent
from map_registry import ARENAS, DEFAULT, REGISTRY, WEAPONS, Arena, top_at, bottom_at, ray_solid
from movement_live import step_player, seed_movement, allowed_lean
from combat64 import MAX_HEALTH, KILL_SIPHON, REGEN_DELAY, reset_health, take_damage, siphon, regenerate
from perf36 import ServerMetrics
from dust_world64 import get_dust_world64
from octavus_world import get_octavus_world
from dust_motion65 import dust_step65
from modes54 import (TEAM_MODES,TEAM_IDS,TEAM_NAMES,CONTROL_POINT,
    is_team_mode,next_team,balance_teams,winner_team,controller,presence)
from competitive55 import spawn_score,balanced_draft,ready_summary
from cosmetics56 import normalize_skin56
from bot57 import (MODE as BOT_MODE,BOT_COUNT,BOT_GOAL,BOT_WIN_GOAL,BOT_NAMES,
                   BOT_FIRE_SECONDS,decide as bot_decide,can_attack as bot_can_attack,
                   miss_offset,is_bot_mode)
from match35 import (DEATHMATCH_GOAL,KILLS_PER_TIER,MATCH_DURATION,COUNTDOWN_DURATION,
                     RESPAWN_DURATION,goal,tier_for_kills,standings,leading_player,
                     timed_winner,rules)
MAP=DEFAULT.data;BOXES=DEFAULT.boxes;SPAWNS=DEFAULT.spawns
RELEASE='3.1.0'; PHASE='06.8'; API_VERSION=5
TICK=1/60; LIMIT=DEATHMATCH_GOAL; ROUND_SECONDS=MATCH_DURATION; MAX_PLAYERS=8; MAX_REWIND=.30
# Fixed memorable lobby names, never player-entered or randomly generated codes.
ROOM_CODES65=('MAX','ACE','FOX','RED','SKY','NEO','ZEN','PRO','WOLF','NOVA','ECHO','LIME')
MANUAL_RESPAWN_COOLDOWN65=20.

def nearby_boxes(x,z,radius=1,arena=DEFAULT):return arena.nearby(x,z,radius)

def ray_box(origin,direction,bounds):
    lo,hi=0.,100.
    for i in range(3):
        if abs(direction[i])<1e-9:
            if origin[i]<bounds[i] or origin[i]>bounds[i+3]:return None
        else:
            a=(bounds[i]-origin[i])/direction[i];b=(bounds[i+3]-origin[i])/direction[i]
            lo=max(lo,min(a,b));hi=min(hi,max(a,b))
            if hi<lo:return None
    return lo

def bounds(b):return (b['x']-b['w']/2,b['y'],b['z']-b['d']/2,b['x']+b['w']/2,b['y']+b['h'],b['z']+b['d']/2)
def overlaps(x,y,z,b,height=1.8):
    return abs(x-b['x'])<b['w']/2+.32 and abs(z-b['z'])<b['d']/2+.32 and y<top_at(b,x,z)-.015 and y+height>bottom_at(b,x,z)+.015

def move(p,dt,now,arena=DEFAULT):
    """60 Hz authority: source triangles for Dust Corridor and Octavus."""
    if arena.id=='dust_corridor':
        return dust_step65(p,dt,now,WEAPONS[p['weapon']])
    if arena.id=='octavus':
        return dust_step65(p,dt,now,WEAPONS[p['weapon']],get_octavus_world())
    return step_player(p,dt,now,arena,WEAPONS)

def spawn(p,players,now,arena=DEFAULT,history=None):
    """Choose a protected point using server-only line of sight and recent uses."""
    if history is None:history={}
    enemies=[q for q in players.values() if q is not p and q['hp']>0 and
             (p.get('team') is None or q.get('team')!=p.get('team'))]
    def rank(pos):
        x,y,z=pos;visible=[]
        for q in enemies:
            origin=(q['x'],q['y']+1.55,q['z'])
            vec=(x-origin[0],y+1.55-origin[1],z-origin[2])
            dist=math.sqrt(sum(v*v for v in vec))
            direction=tuple(v/max(dist,.01) for v in vec)
            if not ((get_dust_world64() if arena.id=='dust_corridor' else
                     get_octavus_world()).raycast(origin,(x,y+1.55,z))
                    if arena.id in ('dust_corridor','octavus') else any(
                     (h:=ray_solid(origin,direction,b)) is not None and h<dist
                     for b in arena.boxes)):
                visible.append(q)
        return spawn_score(pos,p,players,history,now,visible)
    pool=arena.spawns
    if arena.id=='octavus' and p.get('team') in ('azure','ember'):
        side=arena.octavus_spawn_groups.get(p['team'])
        if side:pool=side
    points=random.sample(pool,len(pool))
    x,y,z=max(points,key=rank)
    history[(x,y,z)]=now
    p.update(x=x,y=y,z=z,yaw=math.atan2(x,z),vx=0.,vy=0.,vz=0.,
             grounded=True,hp=MAX_HEALTH,ammo=WEAPONS[p['weapon']]['mag'],
             reload_at=0.,respawn_at=0.,shield=now+1.5,
             mags=[w['mag'] for w in WEAPONS],input={},last_shot=-999.,
             slide_until=0.,slide_ready=0.,jump_held=False,slide_held=False,
             crouch=False,motion_time=0.,move_credit=0.,commands=deque(),
             spawn=p.get('spawn',0)+1)
    reset_health(p,now)
    seed_movement(p)

def new_player(room,pid,name,now,weapon=0,skin=0):
    team=next_team(room.players) if is_team_mode(room.mode) else None
    p=dict(id=pid,name=name,team=team,bot=False,ready=False,skin=normalize_skin56(skin),kills=0,deaths=0,headshots=0,streak=0,best_streak=0,weapon=weapon,yaw=0.,pitch=0.,last_input=now,switch_at=0.,seq=0,shot_seq=0,ack_shot=0,last_manual_respawn=-1e9)
    spawn(p,{**room.players,**room.bots},now,room.arena,room.spawn_history);room.players[pid]=p
    if room.host is None:room.host=pid
    room.last_active=now
    return p

class Room:
    def __init__(self,code,map_id=None):
        self.arena=ARENAS[map_id or DEFAULT.id]
        self.control_point=self.arena.data.get('controlPoint',CONTROL_POINT)
        if self.arena.id=='octavus' and not getattr(self.arena,'octavus_checked',False):
            mesh=get_octavus_world()
            safe=[]
            for point in self.arena.spawns:
                x,y,z=point
                ground=mesh.ground_at(x,z,y)
                if (mesh.inside(x,z) and ground is not None and
                        abs(ground-y)<.18 and mesh.capsule_clear(point)):
                    safe.append(point)
            if len(safe)<6:
                raise RuntimeError('Octavus requires at least six collision-safe spawns')
            accepted={tuple(p) for p in safe}
            self.arena.octavus_spawn_groups={
                'azure':[p for p in self.arena.data['spawnSets']['A'] if tuple(p) in accepted],
                'ember':[p for p in self.arena.data['spawnSets']['B'] if tuple(p) in accepted]
            }
            self.arena.spawns=safe
            self.arena.octavus_checked=True
        self.code=code;self.players={};self.sockets={};self.joining=0;self.host=None;self.mode='deathmatch';self.next_mode='deathmatch'
        self.phase='lobby';self.started=0.;self.ended_at=0.;self.countdown_at=0.;self.winner=None;self.winner_id=None;self.win_reason=None;self.round_number=0;self.leader_id=None;self.events=[];self.last_active=time.monotonic();self.snapshot_sequence=0
        self.targets=[dict(id='t'+str(i),x=x,y=y,z=z,hp=100,reset_at=0) for i,(x,y,z) in enumerate(self.arena.data['practiceTargets'])]
        self.pose_history=deque(maxlen=64)
        self.team_scores={team:0 for team in TEAM_IDS}
        self.control_credit={team:0. for team in TEAM_IDS}
        self.control_owner=None;self.control_contested=False;self.control_presence={team:0 for team in TEAM_IDS}
        self.winner_team=None
        self.spawn_history={}
        self.bots={};self.ai_score=0;self.bot_score=0
    def populate_bots(self,now):
        """Create synthetic arena opponents. Bots never own sockets or slots."""
        self.bots.clear()
        for i in range(BOT_COUNT):
            pid=f'bot-{i+1}'
            bot=dict(id=pid,name=BOT_NAMES[i],bot=True,team='bots',
                ready=False,skin=3,kills=0,deaths=0,headshots=0,
                streak=0,best_streak=0,weapon=0,yaw=0.,pitch=0.,
                last_input=0.,switch_at=0.,seq=0,shot_seq=0,ack_shot=0)
            spawn(bot,{**self.players,**self.bots},now,self.arena,self.spawn_history)
            bot.update(think_at=now+.1*i,attack_at=now+2.2+i*.3,
                       target_id=None,can_see=False,check_at=now+1.,
                       last_check=(bot['x'],bot['z']),detour_until=0.)
            self.bots[pid]=bot
    def step_bots(self,now):
        """Authoritative bot movement/attacks, no client-supplied coordinates."""
        if self.mode!=BOT_MODE or self.phase!='playing':return
        everyone={**self.players,**self.bots}
        for bot in self.bots.values():
            if self.phase!='playing':break
            if bot['hp']<=0:
                if now>=bot['respawn_at']:
                    spawn(bot,everyone,now,self.arena,self.spawn_history)
                    bot.update(think_at=now,attack_at=now+1.2,
                               last_check=(bot['x'],bot['z']),check_at=now+1.)
                continue
            if now>=bot.get('think_at',0):
                bot_decide(bot,self.players,self.arena,now)
            bot['motion_time']+=TICK
            bot['last_input']=bot['motion_time']
            move(bot,TICK,bot['motion_time'],self.arena)
            regenerate(bot,now)
            if bot['ammo']<=0:bot['ammo']=WEAPONS[bot['weapon']]['mag']
            target=bot_can_attack(bot,self.players,self.arena,now)
            if target is None:continue
            dx=target['x']-bot['x'];dz=target['z']-bot['z']
            horizontal=max(.1,math.hypot(dx,dz))
            miss_yaw,miss_pitch=miss_offset()
            old_yaw,old_pitch=bot['yaw'],bot['pitch']
            bot['yaw']=math.atan2(-dx,-dz)+miss_yaw
            bot['pitch']=math.atan2(target['y']+1.12-bot['y']-1.55,horizontal)+miss_pitch
            bot['shot_seq']+=1
            self.shoot(bot,now,bot['shot_seq'])
            bot['yaw'],bot['pitch']=old_yaw,old_pitch
            bot['attack_at']=now+BOT_FIRE_SECONDS+.08*(int(bot['id'][-1])%3)
    def event(self,kind,**kw):self.events.append(dict(type=kind,**kw))
    def record_poses(self,now):
        # Only the server's movement loop creates historical poses.
        self.pose_history.append((now,{
            pid:(p['x'],p['y'],p['z'],p['crouch'],p['spawn'],p.get('lean',0.),p['yaw'])
            for pid,p in {**self.players,**self.bots}.items()
        }))
    def historical_pose(self,player,when):
        if not self.pose_history:return None
        previous=None
        for at,poses in self.pose_history:
            candidate=poses.get(player['id'])
            if candidate is None or candidate[4]!=player['spawn']:
                previous=None;continue
            if at>=when:
                if previous is None:return candidate if at-when<=TICK*2 else None
                start,earlier=previous
                fraction=max(0.,min(1.,(when-start)/max(1e-6,at-start)))
                return (
                    *(earlier[k]+(candidate[k]-earlier[k])*fraction for k in range(3)),
                    candidate[3] if fraction>=.5 else earlier[3],player['spawn'],
                    candidate[5] if fraction>=.5 else earlier[5],
                    candidate[6] if fraction>=.5 else earlier[6]
                )
            previous=(at,candidate)
        return previous[1] if previous is not None and when-previous[0]<=TICK*2 else None
    def set_mode(self,pid,mode):
        if (pid!=self.host or self.phase not in ('lobby','results')
                or mode not in ('deathmatch','gungame','teamdeathmatch','control',BOT_MODE)):return False
        # Changing the chosen mode invalidates earlier ready acknowledgements.
        if mode!=self.next_mode:
            for player in self.players.values():player['ready']=False
        self.next_mode=mode
        if self.phase=='lobby':
            self.mode=mode
            if is_team_mode(mode):balance_teams(self.players)
            else:
                for p in self.players.values():p['team']=None
        return True
    def set_ready(self,pid,ready):
        """Ready-up is optional and can only change the caller's own flag."""
        if pid not in self.players or self.phase not in ('lobby','results'):return False
        self.players[pid]['ready']=bool(ready)
        return True
    def balance(self,pid):
        """Host can rebalance between rounds, never during active gameplay."""
        if pid!=self.host or self.phase not in ('lobby','results'):return False
        if not is_team_mode(self.next_mode):return False
        balanced_draft(self.players)
        for player in self.players.values():player['ready']=False
        self.event('teams_balanced')
        return True
    def set_skin56(self,pid,skin):
        if pid not in self.players or type(skin) is not int or not 0<=skin<4:
            return False
        self.players[pid]['skin']=normalize_skin56(skin)
        return True
    def start(self,pid,now):
        if pid!=self.host or self.phase not in ('lobby','results'):return False
        self.mode=self.next_mode
        self.bots.clear();self.ai_score=0;self.bot_score=0
        self.phase='countdown';self.round_number+=1
        self.countdown_at=now+COUNTDOWN_DURATION;self.started=0.;self.ended_at=0.
        self.winner=None;self.winner_id=None;self.winner_team=None
        self.win_reason=None;self.leader_id=None
        self.team_scores={team:0 for team in TEAM_IDS}
        self.control_credit={team:0. for team in TEAM_IDS}
        self.control_owner=None;self.control_contested=False
        self.control_presence={team:0 for team in TEAM_IDS}
        if is_team_mode(self.mode):balanced_draft(self.players)
        else:
            for p in self.players.values():p['team']=None
        for p in self.players.values():p['ready']=False
        self.spawn_history.clear()
        self.events.clear()
        self.pose_history.clear()
        for p in self.players.values():
            p['kills']=p['deaths']=p['headshots']=0
            p['streak']=p['best_streak']=0
            if self.mode=='gungame':p['weapon']=0
            spawn(p,self.players,now,self.arena,self.spawn_history)
            p['switch_at']=0.
        if self.mode==BOT_MODE:self.populate_bots(now)
        for target in self.targets:target['hp']=100;target['reset_at']=0
        self.event('countdown',round=self.round_number,mode=self.mode)
        return True
    def finish(self,now,winner=None,reason='time',team=None):
        if self.phase=='results':return False
        if self.mode==BOT_MODE:
            self.winner_team=None;self.winner_id=None
            self.winner='PLAYERS' if self.ai_score>=BOT_GOAL else 'BOTS'
        elif is_team_mode(self.mode):
            team=team if team in TEAM_IDS else winner_team(self.team_scores)
            self.winner_team=team
            self.winner_id=None
            self.winner=TEAM_NAMES[team]+' TEAM' if team else 'DRAW'
        else:
            winner=winner if winner is not None else timed_winner(self.players)
            self.winner_team=None
            self.winner_id=winner['id'] if winner else None
            self.winner=winner['name'] if winner else 'DRAW'
        self.win_reason=reason
        self.ended_at=now
        self.phase='results'
        self.event('round_end',round=self.round_number,winner=self.winner,mode=self.mode,
                   winnerId=self.winner_id,winnerTeam=self.winner_team,reason=reason)
        return True
    def select(self,p,weapon,now):
        if not isinstance(weapon,int) or isinstance(weapon,bool) or not 0<=weapon<len(WEAPONS):return
        if self.mode=='gungame' and self.phase!='lobby':return
        if p['weapon']==weapon:return
        # Switching is immediate, but the global last_shot cadence is retained.
        p['mags'][p['weapon']]=p['ammo'];p['weapon']=weapon
        p['ammo']=p['mags'][weapon];p['reload_at']=0;p['switch_at']=now
    def manual_respawn65(self,pid,now):
        """User-requested recovery. Same authoritative spawn and protection.
        A death is recorded in active matches to avoid escaping a loss.
        """
        p=self.players.get(pid)
        if p is None or p['hp']<=0 or self.phase not in ('lobby','playing'):
            return False,'Respawn unavailable right now.'
        delay=MANUAL_RESPAWN_COOLDOWN65-(now-p.get('last_manual_respawn',-1e9))
        if delay>0:return False,f'Respawn available in {math.ceil(delay)}s.'
        p['last_manual_respawn']=now
        if self.phase=='playing':
            p['deaths']+=1
            p['streak']=0
        spawn(p,{**self.players,**self.bots},now,self.arena,self.spawn_history)
        self.event('manual_respawn65',id=pid)
        return True,'Respawned safely.'

    def reload(self,p,now):
        if p['hp']>0 and self.phase in ('lobby','playing') and p['ammo']<WEAPONS[p['weapon']]['mag'] and not p['reload_at']:
            p['reload_at']=now+WEAPONS[p['weapon']]['reload']
    def shoot(self,p,now,shot_id=0,view_time=None):
        w=WEAPONS[p['weapon']]
        if p['hp']<=0 or p['reload_at'] or now-p['last_shot']<w['interval']*.95 or p['ammo']<=0 or self.phase not in ('lobby','playing'):return False
        p['last_shot']=now;p['ammo']-=1;p['shield']=0;p['shot_seq']=shot_id
        # Recompute peek on every shot with the current aim; clients cannot
        # provide an arbitrary gun origin or peek through an opaque wall.
        p['lean']=0. if self.arena.id in ('dust_corridor','octavus') else allowed_lean(p,p.get('input',{}),self.arena)
        shift=.52*p['lean']
        origin=(p['x']+math.cos(p['yaw'])*shift,
                p['y']+(.9 if p['crouch'] else 1.55),
                p['z']-math.sin(p['yaw'])*shift)
        ends=[];hits={}
        # Clients cannot select arbitrary historical frames: accept at most
        # 300ms of server-recorded player history; cover is always current.
        allowed_view=(float(view_time) if isinstance(view_time,(int,float)) and
                      not isinstance(view_time,bool) and math.isfinite(view_time) and
                      0<=now-view_time<=MAX_REWIND else None)
        ads=p['input'].get('ads',False);spread=w['spread']*(.15 if ads and w['id']==3 else .4 if ads and w['id']!=2 else 1)
        for _ in range(w['pellets']):
            yaw=p['yaw']+random.uniform(-spread,spread);pitch=p['pitch']+random.uniform(-spread,spread);cp=math.cos(pitch)
            direction=(-math.sin(yaw)*cp,math.sin(pitch),-math.cos(yaw)*cp)
            distance=w['range'];victim=None;head=False
            if self.arena.id in ('dust_corridor','octavus'):
                endpoint=tuple(origin[i]+direction[i]*distance for i in range(3))
                mesh=get_dust_world64() if self.arena.id=='dust_corridor' else get_octavus_world()
                hit=mesh.raycast(origin,endpoint)
                if hit is not None:distance=min(distance,hit['distance'])
            else:
                for b in self.arena.boxes:
                    h=ray_solid(origin,direction,b)
                    if h is not None and h<distance:distance=h
            candidates=list(self.targets) if self.mode!=BOT_MODE or self.phase=='lobby' else []
            if self.phase=='playing':
                if self.mode==BOT_MODE:
                    candidates.extend(self.players.values() if p.get('bot') else self.bots.values())
                else:
                    candidates.extend(q for q in self.players.values()
                        if not is_team_mode(self.mode) or q.get('team')!=p.get('team'))
            for q in candidates:
                if q is p or q['hp']<=0:continue
                historic=(self.historical_pose(q,allowed_view) if allowed_view is not None
                          and 'spawn' in q else None)
                qx,qy,qz,crouch=(historic[:4] if historic else
                                (q['x'],q['y'],q['z'],q.get('crouch',False)))
                height=1.05 if crouch else 1.8
                h=ray_box(origin,direction,(qx-.32,qy,qz-.32,qx+.32,qy+height,qz+.32))
                if h is not None and h<distance:
                    distance=h;victim=q;head=origin[1]+direction[1]*h>qy+height-.35
                # The exposed head remains hittable when the torso is behind
                # solid cover. Rewound shots use the corresponding old lean.
                qlean=historic[5] if historic else q.get('lean',0.)
                if abs(qlean)>.01:
                    qyaw=historic[6] if historic else q.get('yaw',0.)
                    hx=qx+math.cos(qyaw)*.52*qlean
                    hz=qz-math.sin(qyaw)*.52*qlean
                    upper=qy+height+.04
                    peek=ray_box(origin,direction,(hx-.22,upper-.44,hz-.22,
                                                   hx+.22,upper,hz+.22))
                    if peek is not None and peek<distance:
                        distance=peek;victim=q;head=True
            ends.append([round(origin[i]+direction[i]*distance,3) for i in range(3)])
            if victim and now>=victim.get('shield',0):
                falloff=max(.4,1-max(0,distance-w['falloff'])/(w['range']-w['falloff'])*.6)
                damage=round(w['damage']*(w['head'] if head else 1)*falloff)
                old=hits.get(victim['id'],(victim,0,False));hits[victim['id']]=(victim,old[1]+damage,old[2] or head)
        self.event('shot',id=p['id'],weapon=p['weapon'],shot=shot_id,origin=origin,ends=ends)
        for victim,damage,head in hits.values():
            if 'deaths' in victim:
                take_damage(victim,damage,now)
            else:
                # Practice targets keep their original 100 HP and do not regen.
                victim['hp']=max(0,victim['hp']-damage)
            self.event('hit',id=p['id'],victim=victim['id'],damage=damage,head=head,killed=victim['hp']==0,origin=origin)
            if victim['hp']==0:
                if 'deaths' in victim:
                    victim['deaths']+=1;victim['streak']=0
                    victim['respawn_at']=now+RESPAWN_DURATION
                    p['kills']+=1;p['headshots']+=int(head)
                    p['streak']+=1;p['best_streak']=max(p['best_streak'],p['streak'])
                    restored=siphon(p)
                    self.event('kill',killer=p['name'],killerId=p['id'],victim=victim['name'],
                               victimId=victim['id'],head=head,weapon=p['weapon'],
                               streak=p['streak'],siphon=restored)
                    if p['streak'] in (3,5,8):
                        self.event('streak',id=p['id'],name=p['name'],count=p['streak'])
                    if not is_team_mode(self.mode) and self.mode!=BOT_MODE:
                        leader=leading_player(self.players)
                        if leader is not None and leader!=self.leader_id:
                            self.leader_id=leader
                            self.event('leader',id=leader,name=self.players[leader]['name'],
                                       score=self.players[leader]['kills'])
                    if self.mode==BOT_MODE:
                        if victim.get('bot'):
                            self.ai_score+=1
                            self.event('bot_score',players=self.ai_score,bots=self.bot_score)
                            if self.ai_score>=BOT_GOAL:
                                self.finish(now,reason='score')
                        elif p.get('bot'):
                            self.bot_score+=1
                            self.event('bot_score',players=self.ai_score,bots=self.bot_score)
                            if self.bot_score>=BOT_WIN_GOAL:
                                self.finish(now,reason='score')
                    elif self.mode=='gungame':
                        if p['kills']>=goal(self.mode,len(WEAPONS)):
                            self.finish(now,p,reason='score')
                        else:
                            new=tier_for_kills(p['kills'],len(WEAPONS))
                            if new!=p['weapon']:
                                p['weapon']=new;p['ammo']=WEAPONS[new]['mag']
                                p['reload_at']=0;p['switch_at']=now
                                self.event('tier_up',id=p['id'],name=p['name'],
                                           tier=new+1,weapon=new)
                    elif self.mode=='teamdeathmatch':
                        team=p.get('team')
                        if team in self.team_scores:
                            self.team_scores[team]+=1
                            self.event('team_score',team=team,scores=self.team_scores.copy())
                            if self.team_scores[team]>=goal(self.mode,len(WEAPONS)):
                                self.finish(now,reason='score',team=team)
                    elif self.mode=='deathmatch' and p['kills']>=goal(self.mode,len(WEAPONS)):
                        self.finish(now,p,reason='score')
                    if self.phase=='results':break
                else:victim['reset_at']=now+3
        return True
    def step(self,dt,now):
        if self.phase=='countdown' and now>=self.countdown_at:
            self.phase='playing';self.started=now
            for p in self.players.values():p['shield']=now+1.5
            self.event('round_start',round=self.round_number,mode=self.mode,
                       goal=goal(self.mode,len(WEAPONS)))
        if self.phase=='playing' and now-self.started>=ROUND_SECONDS:
            self.finish(now,reason='time')
        for p in self.players.values():
            if p['hp']<=0:
                if now>=p['respawn_at'] and self.phase=='playing':spawn(p,{**self.players,**self.bots},now,self.arena,self.spawn_history)
                continue
            if self.phase in ('lobby','playing'):
                regenerate(p,now)
            if p['reload_at'] and now>=p['reload_at']:p['ammo']=WEAPONS[p['weapon']]['mag'];p['reload_at']=0
            if self.phase in ('lobby','playing'):
                p['move_credit']=min(.2,p['move_credit']+dt)
                while p['commands'] and p['move_credit']>=TICK-1e-8:
                    cmd=p['commands'].popleft()
                    if cmd['spawn']!=p['spawn']:continue
                    p['input']=cmd['input'];p['yaw']=cmd['yaw'];p['pitch']=cmd['pitch']
                    p['motion_time']+=TICK;p['last_input']=p['motion_time']
                    move(p,TICK,p['motion_time'],self.arena);p['seq']=cmd['seq'];p['move_credit']-=TICK
            else:
                p['commands'].clear();p['move_credit']=0.
        self.step_bots(now)
        # Server-only scoring: one point per uncontested second inside the
        # Neon Plaza beacon. Opposing players inside the ring pause scoring.
        if self.phase=='playing' and self.mode=='control':
            active,contested,counts=controller(self.players,self.control_point)
            changed=(active!=self.control_owner or contested!=self.control_contested)
            self.control_owner=active;self.control_contested=contested
            self.control_presence=counts
            if changed:self.event('control_status',team=active,contested=contested)
            if active is not None and not contested:
                self.control_credit[active]+=max(0.,min(dt,.2))
                earned=int(self.control_credit[active]+1e-9)
                if earned:
                    self.control_credit[active]-=earned
                    self.team_scores[active]+=earned
                    self.event('team_score',team=active,scores=self.team_scores.copy())
                    if self.team_scores[active]>=goal(self.mode,len(WEAPONS)):
                        self.finish(now,reason='objective',team=active)
        for t in self.targets:
            if t['hp']<=0 and now>=t['reset_at']:t['hp']=100
        self.record_poses(now)
    def snapshot(self,now):
        self.snapshot_sequence+=1
        fields=('id','name','team','bot','ready','skin','x','y','z','vx','vy','vz','grounded','yaw','pitch','hp','ammo','kills','deaths','headshots','streak','best_streak','weapon','crouch','lean','spawn','seq','shot_seq','ack_shot','jump_held','slide_held','motion_time','slide_until','slide_ready','jump_buffer_until','coyote_until','jump_consumed','jump_cut','wall_kick_used','interact_held','mantle')
        return dict(type='state',snapshotSeq=self.snapshot_sequence,serverTime=round(now,6),tickRate=60,snapshotHz=20,maxHp=MAX_HEALTH,mapId=self.arena.id,phase=self.phase,mode=self.mode,host=self.host,round=self.round_number,nextMode=self.next_mode,rules=rules(self.mode,len(WEAPONS)),standings=standings(self.players,self.mode),leaderId=(None if is_team_mode(self.mode) or self.mode==BOT_MODE else leading_player(self.players)),winnerId=self.winner_id,winnerTeam=self.winner_team,
            teamScores=self.team_scores.copy(),readyStatus=ready_summary(self.players),
            aiScore=self.ai_score,botScore=self.bot_score,botsAlive=sum(b['hp']>0 for b in self.bots.values()),
            objective=({**self.control_point,'controller':self.control_owner,
                        'contested':self.control_contested,'presence':self.control_presence.copy()}
                       if self.mode=='control' else None),
            winReason=self.win_reason,players=[{k:p[k] for k in fields}|dict(reload=max(0,p['reload_at']-now),respawn=max(0,p['respawn_at']-now),shield=max(0,p['shield']-now),slide=max(0,p['slide_until']-p['motion_time']),slideCooldown=max(0,p['slide_ready']-p['motion_time']),switch=0.,regenDelay=max(0.,p['regen_after']-now) if 0<p['hp']<MAX_HEALTH else 0.) for p in list(self.players.values())+list(self.bots.values())],targets=self.targets,events=self.events,remaining=max(0,ROUND_SECONDS-((self.ended_at if self.phase=='results' else now)-self.started)) if self.phase in ('playing','results') else ROUND_SECONDS,countdown=max(0,self.countdown_at-now),winner=self.winner)

rooms={}
async def create_room(request):
    if len(rooms)>=len(ROOM_CODES65):return web.json_response({'error':'All named rooms are occupied. Join a friend or try later.'},status=503)
    try:
        data=await request.json() if request.can_read_body else {}
        if not isinstance(data,dict):raise ValueError()
        map_id=data.get('mapId',DEFAULT.id)
        if not isinstance(map_id,str) or map_id not in ARENAS:raise ValueError()
    except (ValueError,TypeError):return web.json_response({'error':'Choose an available map.'},status=400)
    code=next((name for name in ROOM_CODES65 if name not in rooms),None)
    if code is None:return web.json_response({'error':'All named rooms are occupied.'},status=503)
    rooms[code]=Room(code,map_id);return web.json_response({'room':code,'mapId':map_id})

def aim(p,data):
    yaw=float(data.get('yaw',p['yaw']));pitch=float(data.get('pitch',p['pitch']))
    if not math.isfinite(yaw) or not math.isfinite(pitch):raise ValueError('Invalid aim')
    p['yaw']=yaw%(2*math.pi);p['pitch']=max(-1.5,min(1.5,pitch))

async def socket(request):
    code=request.match_info['code'].upper();room=rooms.get(code)
    if not room:return web.json_response({'error':'Room expired. Create a new room.'},status=404)
    if len(room.players)+room.joining>=MAX_PLAYERS:return web.json_response({'error':f'Room full ({MAX_PLAYERS} players).'},status=409)
    ws=web.WebSocketResponse(heartbeat=15,max_msg_size=2048);room.joining+=1
    try:await ws.prepare(request)
    finally:room.joining-=1
    pid=secrets.token_hex(5);name=re.sub(r'[^\w .-]','',request.query.get('name','Player'))[:16].strip() or 'Player'
    try:weapon=max(0,min(3,int(request.query.get('weapon','0'))))
    except ValueError:weapon=0
    if room.mode=='gungame' and room.phase!='lobby':weapon=0
    try:skin=int(request.query.get('skin','0'))
    except (ValueError,TypeError,OverflowError):skin=0
    p=new_player(room,pid,name,time.monotonic(),weapon,skin);room.sockets[pid]=ws
    await ws.send_json(dict(type='welcome',id=pid,room=code,mapId=room.arena.id));room.event('notice',text=f'{name} joined')
    bucket=0;bucket_time=time.monotonic()
    try:
        async for msg in ws:
            if msg.type!=WSMsgType.TEXT:continue
            now=time.monotonic()
            if now-bucket_time>=1:bucket=0;bucket_time=now
            bucket+=1
            if bucket>120:await ws.close(code=1008,message=b'Too many messages');break
            try:
                data=json.loads(msg.data)
                if not isinstance(data,dict):continue
                action=data.get('type')
                if action=='ping':await ws.send_json({'type':'pong','t':data.get('t'),'serverTime':time.monotonic()});continue
                if action=='input':
                    aim(p,data)
                    seq=max(0,min(2**31,int(data.get('seq',0))))
                    generation=int(data.get('spawn',p['spawn']))
                    latest=p['commands'][-1]['seq'] if p['commands'] else p['seq']
                    if generation==p['spawn'] and seq>latest and len(p['commands'])<30:
                        p['commands'].append(dict(seq=seq,spawn=generation,yaw=p['yaw'],pitch=p['pitch'],input={k:data.get(k) is True for k in ('w','a','s','d','jump','sprint','slide','crouch','leanLeft','leanRight','ads','interact')}))
                elif action=='shoot':
                    # A duplicate/replayed client shot sequence must never spend ammo
                    # or create another server-confirmed hit event.
                    shot=int(data.get('shot',0))
                    if shot<=p['ack_shot'] or shot>2**31:continue
                    aim(p,data)
                    p['input']['ads']=data.get('ads') is True
                    # Acknowledge received input even when gameplay cooldown rejects it.
                    p['ack_shot']=shot
                    room.shoot(p,now,shot,data.get('viewServerTime'))
                elif action=='respawn':
                    ok,reason=room.manual_respawn65(pid,now)
                    await ws.send_json({'type':'manual_respawn_result65','ok':ok,'message':reason})
                elif action=='reload':room.reload(p,now)
                elif action=='weapon':room.select(p,data.get('weapon'),now)
                elif action=='start':room.start(pid,now)
                elif action=='mode':room.set_mode(pid,data.get('mode'))
                elif action=='ready':room.set_ready(pid,data.get('ready') is True)
                elif action=='balance':room.balance(pid)
                elif action=='skin':room.set_skin56(pid,data.get('skin'))
            except (ValueError,TypeError,OverflowError):continue
    finally:
        room.players.pop(pid,None);room.sockets.pop(pid,None);room.last_active=time.monotonic()
        if room.host==pid:room.host=next(iter(room.players),None)
        room.event('notice',text=f'{name} left')
    return ws

async def broadcast(room,packet):
    async def send(ws):
        try:await asyncio.wait_for(ws.send_str(packet),.08)
        except Exception:
            if not ws.closed:asyncio.create_task(ws.close())
    await asyncio.gather(*(send(ws) for ws in list(room.sockets.values())))
async def loop(app):
    last=time.monotonic();snapshot_budget=0.
    while True:
        work_start=time.perf_counter()
        now=time.monotonic();dt=min(.2,now-last);last=now;pending=[];snapshot_budget+=dt
        publish=snapshot_budget>=.05
        if publish:snapshot_budget%=.05
        for code,room in list(rooms.items()):
            if not room.players:
                if now-room.last_active>180:rooms.pop(code,None)
                continue
            room.step(dt,now)
            if publish:
                payload=json.dumps(room.snapshot(now),separators=(',',':'))
                app['perf36'].observe_snapshot(len(payload.encode('utf-8')),len(room.sockets))
                pending.append(broadcast(room,payload))
                room.events=[]
        if pending:await asyncio.gather(*pending)
        app['perf36'].observe_loop((time.perf_counter()-work_start)*1000.)
        await asyncio.sleep(max(0,TICK-(time.monotonic()-now)))
async def lifecycle(app):
    task=asyncio.create_task(loop(app));yield;task.cancel()
    with contextlib.suppress(asyncio.CancelledError):await task
    await asyncio.gather(*(ws.close() for r in rooms.values() for ws in r.sockets.values()))
@web.middleware
async def cache_policy(request,handler):
    response=await handler(request)
    if not isinstance(response,web.WebSocketResponse):
        response.headers['Cache-Control']='no-cache'
    return response
async def index(request):return web.FileResponse(ROOT/'static/index.html')
async def health(request):
    summary=request.app['perf36'].summary(sum(len(r.players) for r in rooms.values()),len(rooms))
    return web.json_response({'ok':True,'version':API_VERSION,'release':RELEASE,
        'buildCommit':os.environ.get('RENDER_GIT_COMMIT','')[:12] or None,
        'revision':MAP['revision'], 'phase':PHASE,
        'network':'03.3','match':'05.7','mapId':DEFAULT.id,
        'rooms':len(rooms),'metrics':summary})
async def room_info(request):
    r=rooms.get(request.match_info['code'].upper())
    return web.json_response({'players':len(r.players),'max':MAX_PLAYERS,'phase':r.phase,'mapId':r.arena.id,'mapName':r.arena.data['name']} if r else {'error':'Room expired or not found.'},status=200 if r else 404)
async def list_rooms65(request):
    return web.json_response({'rooms':[
        {'code':code,'players':len(rooms[code].players) if code in rooms else 0,
         'max':MAX_PLAYERS,'phase':rooms[code].phase if code in rooms else 'empty',
         'active':code in rooms}
        for code in ROOM_CODES65]})
async def list_maps(request):return web.json_response(REGISTRY)

async def dust_preview_status64(request):
    """Read-only native map/collision contract. Not in multiplayer registry.

    Lazily indexes exact original geometry; used by the Dust Corridor
    inspection/minimap and Stage 6.4 authoritative spawn preflight.
    """
    return web.json_response(get_dust_world64().metadata())


def make_app():
    app=web.Application(client_max_size=4096,middlewares=[cache_policy]);app['perf36']=ServerMetrics();app.router.add_get('/',index);app.router.add_get('/health',health)
    app.router.add_get('/api/maps',list_maps);app.router.add_get('/api/dust-corridor/preview64',dust_preview_status64);app.router.add_post('/api/rooms',create_room);app.router.add_get('/api/rooms',list_rooms65);app.router.add_get('/api/rooms/{code}',room_info);app.router.add_get('/ws/{code}',socket);app.router.add_static('/static/',ROOT/'static');app.cleanup_ctx.append(lifecycle);return app
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--host',default='0.0.0.0');parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','3000')));parser.add_argument('--strictPort',action='store_true');args=parser.parse_args();web.run_app(make_app(),host=args.host,port=args.port)
