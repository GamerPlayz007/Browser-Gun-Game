"""CROSSFIRE 02.5. Server-authoritative small-room FPS. Single Python process."""
import asyncio, contextlib, json, math, os, random, re, secrets, time
from collections import deque
from pathlib import Path
from aiohttp import web, WSMsgType
ROOT=Path(__file__).parent
from map_registry import ARENAS, DEFAULT, REGISTRY, WEAPONS, Arena, top_at, bottom_at, ray_solid
MAP=DEFAULT.data;BOXES=DEFAULT.boxes;SPAWNS=DEFAULT.spawns
TICK=1/30; LIMIT=15; ROUND_SECONDS=360; MAX_PLAYERS=8

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
    inp=p['input'] if now-p['last_input']<.4 else {}
    f=float(bool(inp.get('w')))-float(bool(inp.get('s')));r=float(bool(inp.get('d')))-float(bool(inp.get('a')))
    length=max(1,math.hypot(f,r));yaw=p['yaw'];f/=length;r/=length
    if inp.get('slide') and not p['slide_held'] and p['grounded'] and now>=p['slide_ready'] and math.hypot(p['vx'],p['vz'])>4:
        p['slide_until']=now+.65;p['slide_ready']=now+1.7
        length=max(.1,math.hypot(p['vx'],p['vz']));p['vx']=p['vx']/length*11;p['vz']=p['vz']/length*11
    p['slide_held']=bool(inp.get('slide'));sliding=now<p['slide_until']
    p['crouch']=sliding
    if not sliding:
        speed=(8.0 if inp.get('sprint') and not inp.get('ads') else 5.6)*WEAPONS[p['weapon']]['speed']
        if inp.get('ads'):speed*=.62
        blend=min(1,dt*(18 if p['grounded'] else 5))
        p['vx']+=((r*math.cos(yaw)-f*math.sin(yaw))*speed-p['vx'])*blend
        p['vz']+=((-r*math.sin(yaw)-f*math.cos(yaw))*speed-p['vz'])*blend
    else:p['vx']*=math.exp(-1.1*dt);p['vz']*=math.exp(-1.1*dt)
    candidates=nearby_boxes(p['x'],p['z'],max(abs(p['vx']),abs(p['vz']))*dt+.34,arena)
    height=1.05 if sliding else 1.8
    # Never stand into an overhead solid after a slide.
    if not sliding and any(overlaps(p['x'],p['y'],p['z'],b) for b in candidates):p['crouch']=True;height=1.05
    for axis,vel in [('x','vx'),('z','vz')]:
        v=p[axis]+p[vel]*dt;tx=v if axis=='x' else p['x'];tz=v if axis=='z' else p['z']
        obstacles=[b for b in candidates if overlaps(tx,p['y'],tz,b,height)]
        if obstacles and p['grounded']:
            top=max(top_at(b,tx,tz) for b in obstacles)
            if top-p['y']<=.29 and not any(overlaps(tx,top,tz,b,height) for b in candidates):p['y']=top;obstacles=[]
        if not obstacles:p[axis]=v
        else:p[vel]=0
    if inp.get('jump') and not p['jump_held'] and p['grounded']:
        p['vy']=7.5;p['grounded']=False;p['slide_until']=0
    p['jump_held']=bool(inp.get('jump'));old=p['y'];p['vy']-=22*dt;ny=old+p['vy']*dt
    ground=0
    for b in candidates:
        if abs(p['x']-b['x'])<b['w']/2+.32 and abs(p['z']-b['z'])<b['d']/2+.32:
            top=top_at(b,p['x'],p['z']);bottom=bottom_at(b,p['x'],p['z'])
            if p['vy']<=0 and old>=top-.02:ground=max(ground,top)
            if p['vy']>0 and old+height<=bottom+.02 and ny+height>=bottom:
                ny=bottom-height;p['vy']=0
    if ny<=ground or (p['grounded'] and p['vy']<=0 and old-ground<=.29):ny=ground;p['vy']=0;p['grounded']=True
    else:p['grounded']=False
    p['y']=ny

def spawn(p,players,now,arena=DEFAULT):
    enemies=[q for q in players.values() if q is not p and q['hp']>0]
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

def new_player(room,pid,name,now,weapon=0):
    p=dict(id=pid,name=name,kills=0,deaths=0,headshots=0,weapon=weapon,yaw=0.,pitch=0.,last_input=now,switch_at=0.,seq=0,shot_seq=0,ack_shot=0)
    spawn(p,room.players,now,room.arena);room.players[pid]=p
    if room.host is None:room.host=pid
    room.last_active=now
    return p

class Room:
    def __init__(self,code,map_id=None):
        self.arena=ARENAS[map_id or DEFAULT.id]
        self.code=code;self.players={};self.sockets={};self.joining=0;self.host=None;self.mode='deathmatch'
        self.phase='lobby';self.started=0.;self.countdown_at=0.;self.winner=None;self.events=[];self.last_active=time.monotonic()
        self.targets=[dict(id='t'+str(i),x=x,y=y,z=z,hp=100,reset_at=0) for i,(x,y,z) in enumerate(self.arena.data['practiceTargets'])]
    def event(self,kind,**kw):self.events.append(dict(type=kind,**kw))
    def start(self,pid,now):
        if pid!=self.host or self.phase not in ('lobby','results'):return False
        self.phase='countdown';self.countdown_at=now+3;self.winner=None
        for p in self.players.values():
            p['kills']=p['deaths']=p['headshots']=0
            if self.mode=='gungame':p['weapon']=0
            spawn(p,self.players,now,self.arena)
        return True
    def finish(self,now,winner=None):
        if self.phase=='results':return
        if winner:self.winner=winner['name']
        else:
            ranking=sorted(self.players.values(),key=lambda p:(-p['kills'],p['deaths']))
            self.winner=ranking[0]['name'] if ranking and (len(ranking)==1 or (ranking[0]['kills'],ranking[0]['deaths'])!=(ranking[1]['kills'],ranking[1]['deaths'])) else 'DRAW'
        self.phase='results';self.event('notice',text='Round complete')
    def select(self,p,weapon,now):
        if not isinstance(weapon,int) or isinstance(weapon,bool) or not 0<=weapon<4:return
        if self.mode=='gungame' and self.phase!='lobby':return
        if now<p['switch_at'] or p['weapon']==weapon:return
        p['mags'][p['weapon']]=p['ammo'];p['weapon']=weapon;p['ammo']=p['mags'][weapon];p['reload_at']=0;p['switch_at']=now+.5
    def reload(self,p,now):
        if p['hp']>0 and self.phase in ('lobby','playing') and p['ammo']<WEAPONS[p['weapon']]['mag'] and not p['reload_at']:
            p['reload_at']=now+WEAPONS[p['weapon']]['reload']
    def shoot(self,p,now,shot_id=0):
        w=WEAPONS[p['weapon']]
        if p['hp']<=0 or p['reload_at'] or now<p['switch_at'] or now-p['last_shot']<w['interval']*.95 or p['ammo']<=0 or self.phase not in ('lobby','playing'):return False
        p['last_shot']=now;p['ammo']-=1;p['shield']=0;p['shot_seq']=shot_id
        origin=(p['x'],p['y']+(.9 if p['crouch'] else 1.55),p['z']);ends=[];hits={}
        ads=p['input'].get('ads',False);spread=w['spread']*(.15 if ads and w['id']==3 else .4 if ads and w['id']!=2 else 1)
        for _ in range(w['pellets']):
            yaw=p['yaw']+random.uniform(-spread,spread);pitch=p['pitch']+random.uniform(-spread,spread);cp=math.cos(pitch)
            direction=(-math.sin(yaw)*cp,math.sin(pitch),-math.cos(yaw)*cp)
            distance=w['range'];victim=None;head=False
            for b in self.arena.boxes:
                h=ray_solid(origin,direction,b)
                if h is not None and h<distance:distance=h
            candidates=list(self.targets)
            if self.phase=='playing':candidates+=list(self.players.values())
            for q in candidates:
                if q is p or q['hp']<=0:continue
                height=1.05 if q.get('crouch') else 1.8
                h=ray_box(origin,direction,(q['x']-.32,q['y'],q['z']-.32,q['x']+.32,q['y']+height,q['z']+.32))
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
                    victim['deaths']+=1;victim['respawn_at']=now+3;p['kills']+=1;p['headshots']+=int(head)
                    self.event('kill',killer=p['name'],killerId=p['id'],victim=victim['name'],victimId=victim['id'],head=head,weapon=p['weapon'])
                    if self.mode=='gungame':
                        if p['kills']>=12:self.finish(now,p)
                        else:
                            new=min(3,p['kills']//3)
                            if new!=p['weapon']:p['weapon']=new;p['ammo']=WEAPONS[new]['mag'];p['reload_at']=0;p['switch_at']=now+.45
                    elif p['kills']>=LIMIT:self.finish(now,p)
                else:victim['reset_at']=now+3
        return True
    def step(self,dt,now):
        if self.phase=='countdown' and now>=self.countdown_at:
            self.phase='playing';self.started=now
            for p in self.players.values():p['shield']=now+1.5
        if self.phase=='playing' and now-self.started>=ROUND_SECONDS:self.finish(now)
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
        for t in self.targets:
            if t['hp']<=0 and now>=t['reset_at']:t['hp']=100
    def snapshot(self,now):
        fields=('id','name','x','y','z','vx','vy','vz','grounded','yaw','pitch','hp','ammo','kills','deaths','headshots','weapon','crouch','spawn','seq','shot_seq','ack_shot','jump_held','slide_held','motion_time','slide_until','slide_ready')
        return dict(type='state',mapId=self.arena.id,phase=self.phase,mode=self.mode,host=self.host,players=[{k:p[k] for k in fields}|dict(reload=max(0,p['reload_at']-now),respawn=max(0,p['respawn_at']-now),shield=max(0,p['shield']-now),slide=max(0,p['slide_until']-p['motion_time']),slideCooldown=max(0,p['slide_ready']-p['motion_time']),switch=max(0,p['switch_at']-now)) for p in self.players.values()],targets=self.targets,events=self.events,remaining=max(0,ROUND_SECONDS-(now-self.started)) if self.phase=='playing' else ROUND_SECONDS,countdown=max(0,self.countdown_at-now),winner=self.winner)

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
                if action=='ping':await ws.send_json({'type':'pong','t':data.get('t')});continue
                if action=='input':
                    aim(p,data)
                    seq=max(0,min(2**31,int(data.get('seq',0))))
                    generation=int(data.get('spawn',p['spawn']))
                    latest=p['commands'][-1]['seq'] if p['commands'] else p['seq']
                    if generation==p['spawn'] and seq>latest and len(p['commands'])<30:
                        p['commands'].append(dict(seq=seq,spawn=generation,yaw=p['yaw'],pitch=p['pitch'],input={k:data.get(k) is True for k in ('w','a','s','d','jump','sprint','slide','ads')}))
                elif action=='shoot':
                    # A duplicate/replayed client shot sequence must never spend ammo
                    # or create another server-confirmed hit event.
                    shot=int(data.get('shot',0))
                    if shot<=p['ack_shot'] or shot>2**31:continue
                    aim(p,data)
                    p['input']['ads']=data.get('ads') is True
                    # Acknowledge received input even when gameplay cooldown rejects it.
                    p['ack_shot']=shot
                    room.shoot(p,now,shot)
                elif action=='reload':room.reload(p,now)
                elif action=='weapon':room.select(p,data.get('weapon'),now)
                elif action=='start':room.start(pid,now)
                elif action=='mode' and pid==room.host and room.phase=='lobby' and data.get('mode') in ('deathmatch','gungame'):room.mode=data['mode']
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
        now=time.monotonic();dt=min(.2,now-last);last=now;pending=[];snapshot_budget+=dt
        publish=snapshot_budget>=.05
        if publish:snapshot_budget%=.05
        for code,room in list(rooms.items()):
            if not room.players:
                if now-room.last_active>180:rooms.pop(code,None)
                continue
            room.step(dt,now)
            if publish:
                pending.append(broadcast(room,json.dumps(room.snapshot(now),separators=(',',':'))));room.events=[]
        if pending:await asyncio.gather(*pending)
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
async def health(request):return web.json_response({'ok':True,'version':2,'revision':MAP['revision'],'mapId':DEFAULT.id,'rooms':len(rooms)})
async def room_info(request):
    r=rooms.get(request.match_info['code'].upper())
    return web.json_response({'players':len(r.players),'max':MAX_PLAYERS,'phase':r.phase,'mapId':r.arena.id,'mapName':r.arena.data['name']} if r else {'error':'Room expired or not found.'},status=200 if r else 404)
async def list_maps(request):return web.json_response(REGISTRY)
def make_app():
    app=web.Application(client_max_size=4096,middlewares=[cache_policy]);app.router.add_get('/',index);app.router.add_get('/health',health)
    app.router.add_get('/api/maps',list_maps);app.router.add_post('/api/rooms',create_room);app.router.add_get('/api/rooms/{code}',room_info);app.router.add_get('/ws/{code}',socket);app.router.add_static('/static/',ROOT/'static');app.cleanup_ctx.append(lifecycle);return app
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--host',default='0.0.0.0');parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','3000')));parser.add_argument('--strictPort',action='store_true');args=parser.parse_args();web.run_app(make_app(),host=args.host,port=args.port)
