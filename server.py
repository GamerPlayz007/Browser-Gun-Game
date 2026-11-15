"""CROSSFIRE 05.3. Server-authoritative multiplayer arena with release diagnostics."""
import asyncio, contextlib, json, math, os, random, re, secrets, time
from collections import deque
from pathlib import Path
from aiohttp import web, WSMsgType
ROOT=Path(__file__).parent
from map_registry import ARENAS, DEFAULT, REGISTRY, WEAPONS, Arena, top_at, bottom_at, ray_solid
from movement_live import step_player, seed_movement
from perf36 import ServerMetrics
from modes54 import (TEAM_MODES,TEAM_IDS,TEAM_NAMES,CONTROL_POINT,
    is_team_mode,next_team,balance_teams,winner_team,controller,presence)
from match35 import (DEATHMATCH_GOAL,KILLS_PER_TIER,MATCH_DURATION,COUNTDOWN_DURATION,
                     RESPAWN_DURATION,goal,tier_for_kills,standings,leading_player,
                     timed_winner,rules)
MAP=DEFAULT.data;BOXES=DEFAULT.boxes;SPAWNS=DEFAULT.spawns
RELEASE='05.3'; API_VERSION=5
TICK=1/60; LIMIT=DEATHMATCH_GOAL; ROUND_SECONDS=MATCH_DURATION; MAX_PLAYERS=8; MAX_REWIND=.30

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
    """60 Hz server authority; static/physics.js implements matching prediction."""
    return step_player(p,dt,now,arena,WEAPONS)

def spawn(p,players,now,arena=DEFAULT):
    enemies=[q for q in players.values() if q is not p and q['hp']>0 and
             (p.get('team') is None or q.get('team')!=p.get('team'))]
    def rank(pos):
        x,y,z=pos;nearest=min((math.hypot(x-q['x'],z-q['z']) for q in enemies),default=40)
        exposed=0
        for q in enemies:
            origin=(q['x'],q['y']+1.55,q['z']);vec=(x-origin[0],y+1.55-origin[1],z-origin[2]);dist=math.sqrt(sum(v*v for v in vec))
            direction=tuple(v/max(dist,.01) for v in vec)
            if not any((h:=ray_solid(origin,direction,b)) is not None and h<dist for b in arena.boxes):exposed+=1
        # Prefer protected spawns one short rotation from the fight, not the
        # opposite corner of the district. Too-close spawns are heavily penalized.
        return min(nearest,30)-max(0,nearest-38)*.6-exposed*25-max(0,14-nearest)*3
    points=random.sample(arena.spawns,len(arena.spawns));x,y,z=max(points,key=rank)
    p.update(x=x,y=y,z=z,yaw=math.atan2(x,z),vx=0.,vy=0.,vz=0.,grounded=True,hp=100,ammo=WEAPONS[p['weapon']]['mag'],reload_at=0.,respawn_at=0.,shield=now+1.5,mags=[w['mag'] for w in WEAPONS],input={},last_shot=-999.,slide_until=0.,slide_ready=0.,jump_held=False,slide_held=False,crouch=False,motion_time=0.,move_credit=0.,commands=deque(),spawn=p.get('spawn',0)+1)
    seed_movement(p)

def new_player(room,pid,name,now,weapon=0):
    team=next_team(room.players) if is_team_mode(room.mode) else None
    p=dict(id=pid,name=name,team=team,kills=0,deaths=0,headshots=0,streak=0,best_streak=0,weapon=weapon,yaw=0.,pitch=0.,last_input=now,switch_at=0.,seq=0,shot_seq=0,ack_shot=0)
    spawn(p,room.players,now,room.arena);room.players[pid]=p
    if room.host is None:room.host=pid
    room.last_active=now
    return p

class Room:
    def __init__(self,code,map_id=None):
        self.arena=ARENAS[map_id or DEFAULT.id]
        self.code=code;self.players={};self.sockets={};self.joining=0;self.host=None;self.mode='deathmatch';self.next_mode='deathmatch'
        self.phase='lobby';self.started=0.;self.ended_at=0.;self.countdown_at=0.;self.winner=None;self.winner_id=None;self.win_reason=None;self.round_number=0;self.leader_id=None;self.events=[];self.last_active=time.monotonic();self.snapshot_sequence=0
        self.targets=[dict(id='t'+str(i),x=x,y=y,z=z,hp=100,reset_at=0) for i,(x,y,z) in enumerate(self.arena.data['practiceTargets'])]
        self.pose_history=deque(maxlen=64)
        self.team_scores={team:0 for team in TEAM_IDS}
        self.control_credit={team:0. for team in TEAM_IDS}
        self.control_owner=None;self.control_contested=False;self.control_presence={team:0 for team in TEAM_IDS}
        self.winner_team=None
    def event(self,kind,**kw):self.events.append(dict(type=kind,**kw))
    def record_poses(self,now):
        # Only the server's movement loop creates historical poses.
        self.pose_history.append((now,{
            pid:(p['x'],p['y'],p['z'],p['crouch'],p['spawn'])
            for pid,p in self.players.items()
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
                    candidate[3] if fraction>=.5 else earlier[3],player['spawn']
                )
            previous=(at,candidate)
        return previous[1] if previous is not None and when-previous[0]<=TICK*2 else None
    def set_mode(self,pid,mode):
        if (pid!=self.host or self.phase not in ('lobby','results')
                or mode not in ('deathmatch','gungame','teamdeathmatch','control')):return False
        self.next_mode=mode
        if self.phase=='lobby':
            self.mode=mode
            if is_team_mode(mode):balance_teams(self.players)
            else:
                for p in self.players.values():p['team']=None
        return True
    def start(self,pid,now):
        if pid!=self.host or self.phase not in ('lobby','results'):return False
        self.mode=self.next_mode
        self.phase='countdown';self.round_number+=1
        self.countdown_at=now+COUNTDOWN_DURATION;self.started=0.;self.ended_at=0.
        self.winner=None;self.winner_id=None;self.winner_team=None
        self.win_reason=None;self.leader_id=None
        self.team_scores={team:0 for team in TEAM_IDS}
        self.control_credit={team:0. for team in TEAM_IDS}
        self.control_owner=None;self.control_contested=False
        self.control_presence={team:0 for team in TEAM_IDS}
        if is_team_mode(self.mode):balance_teams(self.players)
        else:
            for p in self.players.values():p['team']=None
        self.events.clear()
        self.pose_history.clear()
        for p in self.players.values():
            p['kills']=p['deaths']=p['headshots']=0
            p['streak']=p['best_streak']=0
            if self.mode=='gungame':p['weapon']=0
            spawn(p,self.players,now,self.arena)
            p['switch_at']=0.
        for target in self.targets:target['hp']=100;target['reset_at']=0
        self.event('countdown',round=self.round_number,mode=self.mode)
        return True
    def finish(self,now,winner=None,reason='time',team=None):
        if self.phase=='results':return False
        if is_team_mode(self.mode):
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
        self.event('round_end',round=self.round_number,winner=self.winner,
                   winnerId=self.winner_id,winnerTeam=self.winner_team,reason=reason)
        return True
    def select(self,p,weapon,now):
        if not isinstance(weapon,int) or isinstance(weapon,bool) or not 0<=weapon<len(WEAPONS):return
        if self.mode=='gungame' and self.phase!='lobby':return
        if now<p['switch_at'] or p['weapon']==weapon:return
        p['mags'][p['weapon']]=p['ammo'];p['weapon']=weapon;p['ammo']=p['mags'][weapon];p['reload_at']=0;p['switch_at']=now+.5
    def reload(self,p,now):
        if p['hp']>0 and self.phase in ('lobby','playing') and p['ammo']<WEAPONS[p['weapon']]['mag'] and not p['reload_at']:
            p['reload_at']=now+WEAPONS[p['weapon']]['reload']
    def shoot(self,p,now,shot_id=0,view_time=None):
        w=WEAPONS[p['weapon']]
        if p['hp']<=0 or p['reload_at'] or now<p['switch_at'] or now-p['last_shot']<w['interval']*.95 or p['ammo']<=0 or self.phase not in ('lobby','playing'):return False
        p['last_shot']=now;p['ammo']-=1;p['shield']=0;p['shot_seq']=shot_id
        origin=(p['x'],p['y']+(.9 if p['crouch'] else 1.55),p['z']);ends=[];hits={}
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
            for b in self.arena.boxes:
                h=ray_solid(origin,direction,b)
                if h is not None and h<distance:distance=h
            candidates=list(self.targets)
            if self.phase=='playing':
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
                    distance=h;victim=q;head=origin[1]+direction[1]*h>q['y']+height-.35
            ends.append([round(origin[i]+direction[i]*distance,3) for i in range(3)])
            if victim and now>=victim.get('shield',0):
                falloff=max(.4,1-max(0,distance-w['falloff'])/(w['range']-w['falloff'])*.6)
                damage=round(w['damage']*(w['head'] if head else 1)*falloff)
                old=hits.get(victim['id'],(victim,0,False));hits[victim['id']]=(victim,old[1]+damage,old[2] or head)
        self.event('shot',id=p['id'],weapon=p['weapon'],shot=shot_id,origin=origin,ends=ends)
        for victim,damage,head in hits.values():
            victim['hp']=max(0,victim['hp']-damage)
            self.event('hit',id=p['id'],victim=victim['id'],damage=damage,head=head,killed=victim['hp']==0,origin=origin)
            if victim['hp']==0:
                if 'deaths' in victim:
                    victim['deaths']+=1;victim['streak']=0
                    victim['respawn_at']=now+RESPAWN_DURATION
                    p['kills']+=1;p['headshots']+=int(head)
                    p['streak']+=1;p['best_streak']=max(p['best_streak'],p['streak'])
                    self.event('kill',killer=p['name'],killerId=p['id'],victim=victim['name'],
                               victimId=victim['id'],head=head,weapon=p['weapon'],streak=p['streak'])
                    if p['streak'] in (3,5,8):
                        self.event('streak',id=p['id'],name=p['name'],count=p['streak'])
                    leader=leading_player(self.players)
                    if leader is not None and leader!=self.leader_id:
                        self.leader_id=leader
                        self.event('leader',id=leader,name=self.players[leader]['name'],
                                   score=self.players[leader]['kills'])
                    if self.mode=='gungame':
                        if p['kills']>=goal(self.mode,len(WEAPONS)):
                            self.finish(now,p,reason='score')
                        else:
                            new=tier_for_kills(p['kills'],len(WEAPONS))
                            if new!=p['weapon']:
                                p['weapon']=new;p['ammo']=WEAPONS[new]['mag']
                                p['reload_at']=0;p['switch_at']=now+.45
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
                if now>=p['respawn_at'] and self.phase=='playing':spawn(p,self.players,now,self.arena)
                continue
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
        # Server-only scoring: one point per uncontested second inside the
        # Neon Plaza beacon. Opposing players inside the ring pause scoring.
        if self.phase=='playing' and self.mode=='control':
            active,contested,counts=controller(self.players)
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
        fields=('id','name','team','x','y','z','vx','vy','vz','grounded','yaw','pitch','hp','ammo','kills','deaths','headshots','streak','best_streak','weapon','crouch','spawn','seq','shot_seq','ack_shot','jump_held','slide_held','motion_time','slide_until','slide_ready','jump_buffer_until','coyote_until','jump_consumed','jump_cut','wall_kick_used','interact_held','mantle')
        return dict(type='state',snapshotSeq=self.snapshot_sequence,serverTime=round(now,6),tickRate=60,snapshotHz=20,mapId=self.arena.id,phase=self.phase,mode=self.mode,host=self.host,round=self.round_number,nextMode=self.next_mode,rules=rules(self.mode,len(WEAPONS)),standings=standings(self.players),leaderId=leading_player(self.players),winnerId=self.winner_id,winnerTeam=self.winner_team,
            teamScores=self.team_scores.copy(),
            objective=({**CONTROL_POINT,'controller':self.control_owner,
                        'contested':self.control_contested,'presence':self.control_presence.copy()}
                       if self.mode=='control' else None),
            winReason=self.win_reason,players=[{k:p[k] for k in fields}|dict(reload=max(0,p['reload_at']-now),respawn=max(0,p['respawn_at']-now),shield=max(0,p['shield']-now),slide=max(0,p['slide_until']-p['motion_time']),slideCooldown=max(0,p['slide_ready']-p['motion_time']),switch=max(0,p['switch_at']-now)) for p in self.players.values()],targets=self.targets,events=self.events,remaining=max(0,ROUND_SECONDS-((self.ended_at if self.phase=='results' else now)-self.started)) if self.phase in ('playing','results') else ROUND_SECONDS,countdown=max(0,self.countdown_at-now),winner=self.winner)

rooms={}
async def create_room(request):
    if len(rooms)>=40:return web.json_response({'error':'Server full. Try later.'},status=503)
    try:
        data=await request.json() if request.can_read_body else {}
        if not isinstance(data,dict):raise ValueError()
        map_id=data.get('mapId',DEFAULT.id)
        if not isinstance(map_id,str) or map_id not in ARENAS:raise ValueError()
    except (ValueError,TypeError):return web.json_response({'error':'Choose an available map.'},status=400)
    code=secrets.token_hex(3).upper()
    while code in rooms:code=secrets.token_hex(3).upper()
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
    p=new_player(room,pid,name,time.monotonic(),weapon);room.sockets[pid]=ws
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
                        p['commands'].append(dict(seq=seq,spawn=generation,yaw=p['yaw'],pitch=p['pitch'],input={k:data.get(k) is True for k in ('w','a','s','d','jump','sprint','slide','ads','interact')}))
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
                elif action=='reload':room.reload(p,now)
                elif action=='weapon':room.select(p,data.get('weapon'),now)
                elif action=='start':room.start(pid,now)
                elif action=='mode':room.set_mode(pid,data.get('mode'))
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
    if not isinstance(response,web.WebSocketResponse):response.headers['Cache-Control']='no-cache'
    return response
async def index(request):return web.FileResponse(ROOT/'static/index.html')
async def health(request):
    summary=request.app['perf36'].summary(sum(len(r.players) for r in rooms.values()),len(rooms))
    return web.json_response({'ok':True,'version':API_VERSION,'release':RELEASE,
        'buildCommit':os.environ.get('RENDER_GIT_COMMIT','')[:12] or None,
        'revision':MAP['revision'], 'phase':RELEASE,
        'network':'03.3','match':'03.5','mapId':DEFAULT.id,
        'rooms':len(rooms),'metrics':summary})
async def room_info(request):
    r=rooms.get(request.match_info['code'].upper())
    return web.json_response({'players':len(r.players),'max':MAX_PLAYERS,'phase':r.phase,'mapId':r.arena.id,'mapName':r.arena.data['name']} if r else {'error':'Room expired or not found.'},status=200 if r else 404)
async def list_maps(request):return web.json_response(REGISTRY)
def make_app():
    app=web.Application(client_max_size=4096,middlewares=[cache_policy]);app['perf36']=ServerMetrics();app.router.add_get('/',index);app.router.add_get('/health',health)
    app.router.add_get('/api/maps',list_maps);app.router.add_post('/api/rooms',create_room);app.router.add_get('/api/rooms/{code}',room_info);app.router.add_get('/ws/{code}',socket);app.router.add_static('/static/',ROOT/'static');app.cleanup_ctx.append(lifecycle);return app
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--host',default='0.0.0.0');parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','3000')));parser.add_argument('--strictPort',action='store_true');args=parser.parse_args();web.run_app(make_app(),host=args.host,port=args.port)
