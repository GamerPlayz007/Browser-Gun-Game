"""CROSSFIRE — small authoritative, in-memory multiplayer FPS server."""
import asyncio, contextlib, json, math, os, random, re, secrets, time
from pathlib import Path
from aiohttp import web, WSMsgType

ROOT = Path(__file__).parent
TICK = 1 / 30
LIMIT, ROUND_SECONDS = 15, 600
# center x,z, width,height,depth, visual style; shared with the browser.
BOXES = [
    [-24,0,1,7,49,'wall'],[24,0,1,7,49,'wall'],[0,-24,47,7,1,'wall'],[0,24,47,7,1,'wall'],
    [-10,-9,11,3.2,4,'orange'],[10,9,11,3.2,4,'green'],
    [10,-11,4,3.2,9,'green'],[-10,11,4,3.2,9,'orange'],
    [0,0,5,4.2,5,'concrete'],[-2,-12,3,1.1,3,'crate'],[2,12,3,1.1,3,'crate'],
    [-17,0,3,2.2,5,'crate'],[17,0,3,2.2,5,'crate'],
    [0,-20,7,1.1,2,'concrete'],[0,20,7,1.1,2,'concrete']
]
SPAWNS = [(-19,-19),(19,19),(19,-19),(-19,19),(-19,8),(19,-8)]
WEAPON = {'name':'AR-01 / CARBINE','damage':25,'magazine':30,'reload':1.6,'interval':0.14}

def ray_box(origin, direction, bounds):
    lo, hi = 0.0, 100.0
    for i in range(3):
        if abs(direction[i]) < 1e-9:
            if origin[i] < bounds[i] or origin[i] > bounds[i+3]: return None
        else:
            a=(bounds[i]-origin[i])/direction[i]; b=(bounds[i+3]-origin[i])/direction[i]
            lo=max(lo,min(a,b)); hi=min(hi,max(a,b))
            if hi<lo: return None
    return lo

def bounds(box):
    x,z,w,h,d,_=box
    return (x-w/2,0,z-d/2,x+w/2,h,z+d/2)

def overlaps(x,y,z,b):
    return abs(x-b[0]) < b[2]/2+.34 and abs(z-b[1]) < b[4]/2+.34 and y < b[3]-.01 and y+1.75 > .01

def move(p, dt, now):
    inp=p['input'] if now-p['last_input']<.4 else {}
    yaw=p['yaw']; f=float(bool(inp.get('w')))-float(bool(inp.get('s')))
    r=float(bool(inp.get('d')))-float(bool(inp.get('a')))
    length=max(1,math.hypot(f,r)); speed=8 if inp.get('sprint') else 5.5
    dx=(r*math.cos(yaw)-f*math.sin(yaw))/length*speed*dt
    dz=(-r*math.sin(yaw)-f*math.cos(yaw))/length*speed*dt
    if not any(overlaps(p['x']+dx,p['y'],p['z'],b) for b in BOXES): p['x']+=dx
    if not any(overlaps(p['x'],p['y'],p['z']+dz,b) for b in BOXES): p['z']+=dz
    if inp.get('jump') and p['grounded']: p['vy']=7.2; p['grounded']=False
    old=p['y']; p['vy']-=20*dt; ny=old+p['vy']*dt
    ground=0
    for b in BOXES:
        if abs(p['x']-b[0])<b[2]/2+.34 and abs(p['z']-b[1])<b[4]/2+.34 and old>=b[3]-.02:
            ground=max(ground,b[3])
    if ny<=ground: ny=ground; p['vy']=0; p['grounded']=True
    else: p['grounded']=False
    p['y']=ny

def spawn(p, players, now):
    # Prefer a point far from living opponents.
    enemies=[v for v in players.values() if v is not p and v['hp']>0]
    points=random.sample(SPAWNS,len(SPAWNS))
    x,z=max(points,key=lambda v:min((math.hypot(v[0]-e['x'],v[1]-e['z']) for e in enemies),default=99))
    p.update(x=x,y=0,z=z,vy=0,grounded=True,hp=100,ammo=30,reload_at=0,respawn_at=0,shield=now+1.5,input={},last_shot=0)

class Room:
    def __init__(self,code):
        self.code=code; self.players={}; self.sockets={}; self.joining=0; self.started=time.monotonic(); self.winner=None; self.reset_at=0; self.events=[]
        self.targets=[{'id':f't{i}','x':x,'z':z,'hp':100,'reset_at':0} for i,(x,z) in enumerate([(-5,-20),(5,20)])]
    def event(self,kind,**kw): self.events.append(dict(type=kind,**kw))
    def reset(self,now):
        self.started=now; self.winner=None; self.reset_at=0
        for p in self.players.values():
            p['kills']=p['deaths']=0; spawn(p,self.players,now)
        self.event('notice',text='New round. First to 15.')
    def finish(self,now):
        if self.winner is not None: return
        leader=max(self.players.values(),key=lambda p:(p['kills'],-p['deaths']),default=None)
        self.winner=leader['name'] if leader else 'No one'; self.reset_at=now+10
    def shoot(self,p,now):
        if p['hp']<=0 or p['reload_at'] or now-p['last_shot']<WEAPON['interval'] or p['ammo']<=0 or self.winner is not None: return
        p['last_shot']=now; p['ammo']-=1; p['shield']=0
        yaw,pitch=p['yaw'],p['pitch']; cp=math.cos(pitch)
        direction=(-math.sin(yaw)*cp,math.sin(pitch),-math.cos(yaw)*cp)
        origin=(p['x'],p['y']+1.55,p['z']); distance=90; victim=None; target=None
        for b in BOXES:
            hit=ray_box(origin,direction,bounds(b))
            if hit is not None and hit<distance: distance=hit
        for q in self.players.values():
            if q is p or q['hp']<=0: continue
            hit=ray_box(origin,direction,(q['x']-.34,q['y'],q['z']-.34,q['x']+.34,q['y']+1.8,q['z']+.34))
            if hit is not None and hit<distance: distance=hit; victim=q; target=None
        for t in self.targets:
            if t['hp']<=0: continue
            hit=ray_box(origin,direction,(t['x']-.45,0,t['z']-.25,t['x']+.45,1.9,t['z']+.25))
            if hit is not None and hit<distance: distance=hit; victim=None; target=t
        end=[origin[i]+direction[i]*distance for i in range(3)]
        self.event('shot',id=p['id'],origin=origin,end=end)
        if victim and now>=victim['shield']:
            victim['hp']-=WEAPON['damage']; self.event('hit',id=p['id'],victim=victim['id'])
            if victim['hp']<=0:
                victim['deaths']+=1; victim['respawn_at']=now+3; p['kills']+=1
                self.event('kill',killer=p['name'],victim=victim['name'])
                if p['kills']>=LIMIT: self.finish(now)
        elif target:
            target['hp']-=WEAPON['damage']; self.event('hit',id=p['id'],victim=target['id'])
            if target['hp']<=0: target['reset_at']=now+3
    def step(self,dt,now):
        if self.reset_at and now>=self.reset_at: self.reset(now)
        if now-self.started>=ROUND_SECONDS and self.winner is None: self.finish(now)
        for p in self.players.values():
            if p['hp']<=0:
                if now>=p['respawn_at'] and self.winner is None: spawn(p,self.players,now)
                continue
            if p['reload_at'] and now>=p['reload_at']: p['ammo']=30; p['reload_at']=0
            if self.winner is not None: continue
            move(p,dt,now)
            if now-p['last_input']<.4:
                if p['input'].get('reload') and p['ammo']<30 and not p['reload_at']: p['reload_at']=now+WEAPON['reload']
                if p['input'].get('fire'): self.shoot(p,now)
        for t in self.targets:
            if t['hp']<=0 and now>=t['reset_at']: t['hp']=100
    def snapshot(self,now):
        return {'type':'state','players':[{k:p[k] for k in ('id','name','x','y','z','yaw','pitch','hp','ammo','kills','deaths')} | {'reload':max(0,p['reload_at']-now),'respawn':max(0,p['respawn_at']-now),'shield':max(0,p['shield']-now)} for p in self.players.values()], 'targets':self.targets,'events':self.events,'remaining':max(0,ROUND_SECONDS-(now-self.started)),'winner':self.winner,'nextRound':max(0,self.reset_at-now)}

rooms={}
async def create_room(request):
    if len(rooms)>=50: return web.json_response({'error':'Server is full. Try again later.'},status=503)
    code=secrets.token_hex(3).upper()
    while code in rooms: code=secrets.token_hex(3).upper()
    rooms[code]=Room(code)
    return web.json_response({'room':code})

async def socket(request):
    code=request.match_info['code'].upper(); room=rooms.get(code)
    if not room: return web.json_response({'error':'Room not found. Create a new room.'},status=404)
    if len(room.players)+room.joining>=4: return web.json_response({'error':'Room is full (4 players).'},status=409)
    ws=web.WebSocketResponse(heartbeat=15,max_msg_size=2048)
    room.joining+=1
    try:
        await ws.prepare(request)
    finally:
        room.joining-=1
    pid=secrets.token_hex(5); now=time.monotonic()
    name=re.sub(r'[^\w .-]','',request.query.get('name','Player'))[:16].strip() or 'Player'
    p=dict(id=pid,name=name,yaw=0,pitch=0,kills=0,deaths=0,input={},last_input=now)
    spawn(p,room.players,now); room.players[pid]=p; room.sockets[pid]=ws
    await ws.send_json({'type':'welcome','id':pid,'room':code,'boxes':BOXES,'weapon':WEAPON})
    room.event('notice',text=f'{name} joined the arena.')
    try:
        async for msg in ws:
            if msg.type!=WSMsgType.TEXT: continue
            try:
                data=json.loads(msg.data)
                if not isinstance(data,dict): continue
                if data.get('type')=='ping': await ws.send_json({'type':'pong','t':data.get('t')}); continue
                if data.get('type')!='input': continue
                yaw=float(data.get('yaw',0)); pitch=float(data.get('pitch',0))
                if not math.isfinite(yaw) or not math.isfinite(pitch): continue
                p['yaw']=yaw%(math.pi*2); p['pitch']=max(-1.5,min(1.5,pitch))
                p['input']={k:data.get(k) is True for k in ('w','a','s','d','sprint','jump','reload','fire')}; p['last_input']=time.monotonic()
            except (ValueError,TypeError,OverflowError): continue
    finally:
        room.players.pop(pid,None); room.sockets.pop(pid,None); room.event('notice',text=f'{name} left.')
    return ws

async def broadcast(room,packet):
    # Bound slow-client delay; a stalled connection cannot freeze other rooms.
    async def send(ws):
        try: await asyncio.wait_for(ws.send_str(packet),.1)
        except (Exception,asyncio.CancelledError):
            if not ws.closed: asyncio.create_task(ws.close())
    await asyncio.gather(*(send(ws) for ws in list(room.sockets.values())))

async def loop(app):
    while True:
        start=time.monotonic(); pending=[]
        for code,room in list(rooms.items()):
            if not room.players:
                if start-room.started>180: rooms.pop(code,None)
                continue
            room.step(TICK,start)
            if room.sockets: pending.append(broadcast(room,json.dumps(room.snapshot(start))))
            room.events=[]
        if pending: await asyncio.gather(*pending)
        await asyncio.sleep(max(0,TICK-(time.monotonic()-start)))

async def lifecycle(app):
    task=asyncio.create_task(loop(app)); yield; task.cancel()
    with contextlib.suppress(asyncio.CancelledError): await task
    await asyncio.gather(*(ws.close() for r in rooms.values() for ws in r.sockets.values()))

async def index(request): return web.FileResponse(ROOT/'static'/'index.html')
async def health(request): return web.json_response({'ok':True,'rooms':len(rooms)})
async def room_info(request):
    r=rooms.get(request.match_info['code'].upper())
    return web.json_response({'players':len(r.players),'max':4} if r else {'error':'Room expired or not found.'},status=200 if r else 404)

def make_app():
    app=web.Application(client_max_size=4096)
    app.router.add_get('/',index); app.router.add_get('/health',health)
    app.router.add_post('/api/rooms',create_room); app.router.add_get('/api/rooms/{code}',room_info)
    app.router.add_get('/ws/{code}',socket); app.router.add_static('/static/',ROOT/'static')
    app.cleanup_ctx.append(lifecycle); return app
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--host',default='0.0.0.0')
    parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','3000')))
    parser.add_argument('--strictPort',action='store_true')
    args=parser.parse_args()
    web.run_app(make_app(),host=args.host,port=args.port)
