"""CROSSFIRE 03.2 Python authoritative 60 Hz arena movement.

Algorithm intentionally mirrors static/physics.js for client prediction replay.
Never accept client-supplied positions or mantle destinations.
"""
import math
from map_registry import top_at, bottom_at

FIXED_DT=1/60
M=dict(walk=5.35,sprint=8.2,crouch=3.15,groundAccel=60,groundBrake=42,
       airAccel=9.5,airBrake=1.7,slideMin=5,slideBoost=1.13,slideMax=10,
       slideTime=.70,slideCD=1.05,slideDrag=2.7,slideSteer=3.6,
       buffer=.125,coyote=.1,jumpSpeed=7.5,shortHop=.52,gravity=22,
       stepHeight=.29,height=1.8,lowHeight=1.12,wallKickRange=.52,
       wallKickLift=5.3,wallKickPush=5.1)
SUPPORTS={'building','atriumShell','railing','deck','stairLanding','routeFloor'}

def seed_movement(p):
    p.update(jump_buffer_until=0.,coyote_until=0.,jump_consumed=False,
             jump_cut=False,wall_kick_used=False,interact_held=False,mantle=None)
    return p

def overlap(x,y,z,b,height):
    return abs(x-b['x'])<b['w']/2+.32 and abs(z-b['z'])<b['d']/2+.32 and y<top_at(b,x,z)-.015 and y+height>bottom_at(b,x,z)+.015

def clamp(x,a,b):return max(a,min(b,x))

def wall_normal(boxes,p,dx,dz):
    best=None
    for b in boxes:
        if b.get('kind') not in SUPPORTS or p['y']>=top_at(b,p['x'],p['z'])-.2 or p['y']+1.8<=bottom_at(b,p['x'],p['z']):continue
        faces=((1,0,abs(p['x']-(b['x']+b['w']/2)),abs(p['z']-b['z'])<=b['d']/2+.32),
               (-1,0,abs(p['x']-(b['x']-b['w']/2)),abs(p['z']-b['z'])<=b['d']/2+.32),
               (0,1,abs(p['z']-(b['z']+b['d']/2)),abs(p['x']-b['x'])<=b['w']/2+.32),
               (0,-1,abs(p['z']-(b['z']-b['d']/2)),abs(p['x']-b['x'])<=b['w']/2+.32))
        for nx,nz,gap,lateral in faces:
            if not lateral or gap>.32+M['wallKickRange']:continue
            if -(nx*dx+nz*dz)<.35:continue
            if best is None or gap<best['gap']:best=dict(nx=nx,nz=nz,gap=gap)
    return best

def try_mantle(p,boxes,now):
    if p['mantle']:return False
    dx=-math.sin(p['yaw']);dz=-math.cos(p['yaw']);best=None
    for b in boxes:
        if b.get('kind') not in SUPPORTS:continue
        x=p['x']+dx*.9;z=p['z']+dz*.9;top=top_at(b,x,z);rise=top-p['y']
        if rise<.3 or rise>1.45:continue
        if abs(x-b['x'])>b['w']/2-.32 or abs(z-b['z'])>b['d']/2-.32:continue
        invalid=any(overlap(x,top,z,o,M['height']) for o in boxes) or any(overlap(p['x'],top+.06,p['z'],o,M['height']) for o in boxes)
        if invalid:continue
        if best is None or rise<best['rise']:best=dict(x=x,z=z,top=top,rise=rise)
    if best is None:return False
    p['mantle']=dict(sx=p['x'],sy=p['y'],sz=p['z'],tx=best['x'],ty=best['top'],tz=best['z'],elapsed=0,duration=.32 if best['rise']<=.95 else .42)
    p['vx']=p['vy']=p['vz']=0;p['grounded']=False;p['slide_until']=0
    return True

def step_player(p,dt,now,arena,weapons):
    if abs(dt-FIXED_DT)>1e-8:raise ValueError('CROSSFIRE movement requires 60 Hz ticks')
    inp=p['input'] if now-p['last_input']<.4 else {}
    start_grounded=bool(p['grounded'])
    jump=bool(inp.get('jump'));slide=bool(inp.get('slide'));interact=bool(inp.get('interact'))
    jump_edge=jump and not p['jump_held'];slide_edge=slide and not p['slide_held'];interact_edge=interact and not p.get('interact_held',False)
    p['interact_held']=interact
    p.setdefault('jump_buffer_until',0.);p.setdefault('coyote_until',0.)
    p.setdefault('jump_consumed',False);p.setdefault('jump_cut',False)
    p.setdefault('wall_kick_used',False);p.setdefault('mantle',None)
    if p['mantle']:
        m=p['mantle'];t=clamp((m['elapsed']+dt)/m['duration'],0,1)
        x=m['sx']+(m['tx']-m['sx'])*t;z=m['sz']+(m['tz']-m['sz'])*t
        y=m['sy']+(m['ty']-m['sy'])*t+.24*math.sin(math.pi*t)
        local=arena.nearby(x,z,2)
        if any(overlap(x,y,z,b,M['height']) for b in local):
            p['mantle']=None;p['vy']=0;p['grounded']=False
        else:
            p['x']=x;p['y']=y;p['z']=z;p['vx']=p['vy']=p['vz']=0
            p['mantle']={**m,'elapsed':m['elapsed']+dt};p['crouch']=False
            if t>=1:
                p['mantle']=None;p['y']=m['ty'];p['grounded']=True
                p['jump_consumed']=False;p['wall_kick_used']=False
            p['jump_held']=jump;p['slide_held']=slide
            return
    f=float(bool(inp.get('w')))-float(bool(inp.get('s')))
    r=float(bool(inp.get('d')))-float(bool(inp.get('a')))
    length=max(1,math.hypot(f,r));f/=length;r/=length
    ix=r*math.cos(p['yaw'])-f*math.sin(p['yaw']);iz=-r*math.sin(p['yaw'])-f*math.cos(p['yaw'])
    moving=(f*f+r*r)>0
    speed_before=math.hypot(p['vx'],p['vz'])
    if slide_edge and p['grounded'] and now>=p['slide_ready'] and speed_before>=M['slideMin']:
        p['slide_until']=now+M['slideTime'];p['slide_ready']=now+M['slideCD']
        boost=min(M['slideMax'],speed_before*M['slideBoost'])/max(.1,speed_before)
        p['vx']*=boost;p['vz']*=boost
    sliding=now<p['slide_until'];p['crouch']=sliding or slide
    height=M['lowHeight'] if p['crouch'] else M['height']
    boxes=arena.nearby(p['x'],p['z'],max(abs(p['vx']),abs(p['vz']))*dt+1.25)
    if not p['crouch'] and any(overlap(p['x'],p['y'],p['z'],b,M['height']) for b in boxes):
        p['crouch']=True;height=M['lowHeight']
    if sliding:
        drag=math.exp(-M['slideDrag']*dt)
        p['vx']=p['vx']*drag+ix*M['slideSteer']*dt
        p['vz']=p['vz']*drag+iz*M['slideSteer']*dt
        v=math.hypot(p['vx'],p['vz'])
        if v>M['slideMax']:p['vx']*=M['slideMax']/v;p['vz']*=M['slideMax']/v
    else:
        speed=(M['crouch'] if p['crouch'] else M['sprint'] if inp.get('sprint') and not inp.get('ads') else M['walk'])*weapons[p['weapon']]['speed']
        if inp.get('ads'):speed*=.62
        tx=ix*speed;tz=iz*speed
        accel=(M['groundAccel'] if moving else M['groundBrake']) if p['grounded'] else (M['airAccel'] if moving else M['airBrake'])
        ex=tx-p['vx'];ez=tz-p['vz'];d=math.hypot(ex,ez);change=accel*dt
        if d>change:p['vx']+=ex*change/d;p['vz']+=ez*change/d
        else:p['vx']=tx;p['vz']=tz
    boxes=arena.nearby(p['x'],p['z'],max(abs(p['vx']),abs(p['vz']))*dt+1.25)
    if interact_edge and try_mantle(p,boxes,now):
        p['interact_held']=interact;p['jump_held']=jump;p['slide_held']=slide
        return
    def standing_overlap(x,y,z,b):return overlap(x,y,z,b,height)
    for axis,velocity in (('x','vx'),('z','vz')):
        value=p[axis]+p[velocity]*dt;x=value if axis=='x' else p['x'];z=value if axis=='z' else p['z']
        obstacles=[b for b in boxes if standing_overlap(x,p['y'],z,b)]
        if obstacles and p['grounded']:
            top=max(top_at(b,x,z) for b in obstacles)
            if top-p['y']<=M['stepHeight'] and not any(standing_overlap(x,top,z,b) for b in boxes):
                p['y']=top;obstacles=[]
        if not obstacles:p[axis]=value
        else:p[velocity]=0
    if jump_edge:p['jump_buffer_until']=now+M['buffer']
    if start_grounded:p['coyote_until']=now+M['coyote']
    can_stand=not p['crouch'] or not any(overlap(p['x'],p['y'],p['z'],b,M['height']) for b in boxes)
    jumped=False
    if now<=p['jump_buffer_until'] and now<=p['coyote_until'] and not p['jump_consumed'] and can_stand:
        p['vy']=M['jumpSpeed'];p['grounded']=False;p['slide_until']=0
        p['jump_consumed']=True;p['jump_cut']=False
        p['jump_buffer_until']=0;p['coyote_until']=0;p['crouch']=False;height=M['height'];jumped=True
    if jump_edge and not jumped and not start_grounded and not p['wall_kick_used']:
        wall=wall_normal(boxes,p,-math.sin(p['yaw']),-math.cos(p['yaw']))
        if wall:
            p['vx']+=wall['nx']*M['wallKickPush'];p['vz']+=wall['nz']*M['wallKickPush']
            p['vy']=M['wallKickLift'];p['wall_kick_used']=True;p['jump_cut']=False
    if not jump and p['jump_held'] and p['vy']>0 and not p['jump_cut']:
        p['vy']*=M['shortHop'];p['jump_cut']=True
    p['jump_held']=jump;p['slide_held']=slide
    old=p['y'];p['vy']-=M['gravity']*dt;ny=old+p['vy']*dt;ground=0
    for b in boxes:
        if abs(p['x']-b['x'])<b['w']/2+.32 and abs(p['z']-b['z'])<b['d']/2+.32:
            top=top_at(b,p['x'],p['z']);bottom=bottom_at(b,p['x'],p['z'])
            if p['vy']<=0 and old>=top-.02:ground=max(ground,top)
            if p['vy']>0 and old+height<=bottom+.02 and ny+height>=bottom:
                ny=bottom-height;p['vy']=0
    if ny<=ground or (p['grounded'] and p['vy']<=0 and old-ground<=.29):
        ny=ground;p['vy']=0;p['grounded']=True
    else:p['grounded']=False
    p['y']=ny
    if p['grounded'] and not start_grounded:
        p['jump_consumed']=False;p['jump_cut']=False;p['wall_kick_used']=False