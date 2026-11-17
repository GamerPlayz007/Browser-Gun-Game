"""CROSSFire 6.5 — server-authoritative Dust Corridor player movement.

Uses the original exported triangle mesh from DustWorld64 for wall, ground and
head collisions. Fixed 60Hz with the same state transitions/formulas in
static/dust_motion65.js. No client-provided coordinates are trusted.

The native map deliberately has a source-mesh-specific controller: old
box/ramp movement remains unchanged for Daybreak and Neon Zenith.
"""
from __future__ import annotations
import math
from dust_world64 import get_dust_world64, closest_on_triangle, cross, dot

DT=1/60
RADIUS=.34
HEIGHT=1.8
LOW_HEIGHT=1.12
GRAVITY=22.0
STEP=.36
EPS=.003


def approach(v,target,max_delta):
    return min(target,v+max_delta) if v<target else max(target,v-max_delta)


def resolve_walls(world,x,y,z,h,old_x,old_z,vx,vz):
    """Source triangles, not building rectangles; doorways stay open."""
    r=RADIUS
    for _ in range(2):
        moved=False
        candidates=world.candidates(x-r-.02,z-r-.02,x+r+.02,z+r+.02)
        samples=(y+r,y+h/2,y+h-r)
        for tri in candidates:
            a,b,c=world.triangle(tri)
            lo=min(a[1],b[1],c[1]);hi=max(a[1],b[1],c[1])
            if lo>y+h or hi<y:continue
            n=cross(tuple(b[i]-a[i] for i in range(3)),tuple(c[i]-a[i] for i in range(3)))
            nlen=math.sqrt(dot(n,n))
            if nlen<1e-8 or abs(n[1])/nlen>.65:continue
            for sy in samples:
                if sy+r<lo or sy-r>hi:continue
                closest=closest_on_triangle((x,sy,z),a,b,c)
                dy=sy-closest[1]
                allowed_sq=r*r-dy*dy
                if allowed_sq<=0:continue
                dx=x-closest[0];dz=z-closest[2]
                dsq=dx*dx+dz*dz
                if dsq>=allowed_sq:continue
                d=math.sqrt(dsq)
                if d>1e-8:
                    nx,nz=dx/d,dz/d
                else:
                    horizontal=math.hypot(n[0],n[2])
                    if horizontal<1e-9:continue
                    nx,nz=n[0]/horizontal,n[2]/horizontal
                    if (old_x-closest[0])*nx+(old_z-closest[2])*nz<0:
                        nx,nz=-nx,-nz
                push=math.sqrt(allowed_sq)-d+EPS
                x+=nx*push;z+=nz*push;moved=True
                vn=vx*nx+vz*nz
                if vn<0:
                    vx-=vn*nx;vz-=vn*nz
                break
        if not moved:break
    return x,z,vx,vz


def dust_step65(p,dt,now,weapon,world=None):
    if abs(dt-DT)>1e-8:raise ValueError('Dust movement is fixed at 60 Hz')
    if world is None:world=get_dust_world64()
    inp=p.get('input',{}) if now-p.get('last_input',now)<.4 else {}
    f=int(bool(inp.get('w')))-int(bool(inp.get('s')))
    r=int(bool(inp.get('d')))-int(bool(inp.get('a')))
    length=max(1.,math.hypot(f,r));f/=length;r/=length
    yaw=p.get('yaw',0.)
    ix=r*math.cos(yaw)-f*math.sin(yaw)
    iz=-r*math.sin(yaw)-f*math.cos(yaw)
    jump=bool(inp.get('jump'));slide=bool(inp.get('slide'))
    jump_edge=jump and not p.get('jump_held',False)
    slide_edge=slide and not p.get('slide_held',False)
    grounded=bool(p['grounded'])
    velocity=math.hypot(p['vx'],p['vz'])
    if slide_edge and grounded and velocity>=5:
        p['slide_until']=now+.7;p['slide_ready']=now
        boost=min(10.,velocity*1.13)/max(.1,velocity)
        p['vx']*=boost;p['vz']*=boost
    sliding=now<p['slide_until']
    requested_crouch=sliding or bool(inp.get('crouch'))
    native_octavus=bool(getattr(world.collision,'native_step_assist',False))
    # Do not stand into a low roof after leaving a crawlway.
    if native_octavus and p.get('crouch') and not requested_crouch:
        if not world.capsule_clear((p['x'],p['y'],p['z']),HEIGHT):
            requested_crouch=True
    p['crouch']=requested_crouch
    h=LOW_HEIGHT if p['crouch'] else HEIGHT
    if sliding:
        drag=math.exp(-2.7*dt)
        p['vx']=p['vx']*drag+ix*3.6*dt
        p['vz']=p['vz']*drag+iz*3.6*dt
        mag=math.hypot(p['vx'],p['vz'])
        if mag>10:
            p['vx']*=10/mag;p['vz']*=10/mag
    else:
        speed=(3.15 if p['crouch'] else 8.2 if inp.get('sprint') and not inp.get('ads') else 5.35)*weapon.get('speed',1)
        if inp.get('ads'):speed*=.62
        tx=ix*speed;tz=iz*speed
        moving=bool(f or r)
        accel=(60 if moving else 42) if grounded else (9.5 if moving else 1.7)
        ex=tx-p['vx'];ez=tz-p['vz'];dist=math.hypot(ex,ez);change=accel*dt
        if dist>change:
            p['vx']+=ex*change/dist;p['vz']+=ez*change/dist
        else:p['vx'],p['vz']=tx,tz
    if jump_edge and grounded:
        p['vy']=7.95 if sliding else 7.5
        p['grounded']=False;grounded=False
        p['slide_until']=0;p['crouch']=False;h=HEIGHT
        p['jump_consumed']=True;p['jump_cut']=False
    if not jump and p.get('jump_held',False) and p['vy']>0 and not p.get('jump_cut',False):
        p['vy']*=.52;p['jump_cut']=True
    p['jump_held']=jump;p['slide_held']=slide
    p['interact_held']=bool(inp.get('interact'))
    p['mantle']=None;p['lean']=0.;p['wall_kick_used']=False
    old_x,old_z,old_y=p['x'],p['z'],p['y']
    # Substeps avoid tunnelling through narrow original market props.
    total=math.hypot(p['vx']*dt,p['vz']*dt)
    parts=max(1,min(4,math.ceil(total/.14)))
    x,z=old_x,old_z
    vx,vz=p['vx'],p['vz']
    step_feet=old_y
    for _ in range(parts):
        proposed_x=x+vx*dt/parts;proposed_z=z+vz*dt/parts
        nxt_x,nxt_z,vx,vz=resolve_walls(world,proposed_x,step_feet,proposed_z,h,x,z,vx,vz)
        if (native_octavus and grounded and
                math.hypot(proposed_x-nxt_x,proposed_z-nxt_z)>.018 and
                world.inside(proposed_x,proposed_z,RADIUS)):
            # A stair riser may block a 1.8m capsule at foot height. Try a
            # short, genuinely supported step; never climb a wall or roof.
            rise=world.ground_at(proposed_x,proposed_z,step_feet+STEP)
            if (rise is not None and
                    step_feet+.025<=rise<=step_feet+STEP+.012 and
                    rise<=old_y+STEP+.012 and
                    world.capsule_clear((proposed_x,rise,proposed_z),h)):
                nxt_x,nxt_z=proposed_x,proposed_z
                step_feet=rise
                vx,vz=p['vx'],p['vz']
        if not world.inside(nxt_x,nxt_z,RADIUS):
            bounds=world.bounds
            nxt_x=max(bounds['x0']+RADIUS,min(bounds['x1']-RADIUS,nxt_x))
            nxt_z=max(bounds['z0']+RADIUS,min(bounds['z1']-RADIUS,nxt_z))
            vx=vz=0.
        x,z=nxt_x,nxt_z
    # Don't climb props higher than the authored step threshold.
    ground=world.ground_at(x,z,step_feet)
    if grounded and ground is not None and ground>old_y+STEP+.02:
        x,z=old_x,old_z;vx=vz=0.
        ground=world.ground_at(x,z,old_y)
    p['x'],p['z'],p['vx'],p['vz']=x,z,vx,vz
    p['vy']=max(-35.,p['vy']-GRAVITY*dt)
    proposed_y=old_y+p['vy']*dt
    # With the feet near the floor, snap the exact triangle ground.
    if ground is not None and p['vy']<=0 and (
        proposed_y<=ground+.03 or
        (grounded and abs(proposed_y-ground)<=STEP+.04)):
        p['y']=ground;p['vy']=0.;p['grounded']=True
    else:
        p['y']=proposed_y;p['grounded']=False
    # A low doorway/ceiling prevents vertical penetration.
    if p['vy']>0:
        hit=world.raycast((x,old_y+h-.04,z),(x,p['y']+h+.02,z))
        if hit is not None:
            p['y']=max(old_y,hit['point'][1]-h-.03)
            p['vy']=0.
    if p['grounded']:
        p['jump_consumed']=False;p['jump_cut']=False
    return p
