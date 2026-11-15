"""CROSSFIRE Phase 1 Stage 4 — additive architectural *replacement* greybox.

Builds only data in the existing game's map JSON schema. The original Cyberpunk
City footprint, identity, landmark naming and G/I/U/S IDs are retained.
No weapon mechanics or networking are touched.

World X,Z are authored X,Z minus 40. All Y coordinates are unchanged.
This module deliberately produces no expensive decorations, materials or lights.
"""
from __future__ import annotations
import copy
import json
import math
from pathlib import Path

PLAN_DIR = Path(__file__).parent


def _load(filename):
    return json.loads((PLAN_DIR / filename).read_text(encoding='utf-8'))


def subtract(a,c):
    """Subtract an axis-aligned volume from a 3D solid into disjoint boxes."""
    x0,y0,z0,x1,y1,z1=a; u0,v0,w0,u1,v1,w1=c
    u0,v0,w0=max(x0,u0),max(y0,v0),max(z0,w0)
    u1,v1,w1=min(x1,u1),min(y1,v1),min(z1,w1)
    if u0>=u1 or v0>=v1 or w0>=w1:return [a]
    return [p for p in ((x0,y0,z0,u0,y1,z1),(u1,y0,z0,x1,y1,z1),
       (u0,y0,z0,u1,v0,z1),(u0,v1,z0,u1,y1,z1),
       (u0,v0,z0,u1,v1,w0),(u0,v0,w1,u1,v1,z1))
       if all(p[i+3]-p[i]>.025 for i in range(3))]


def zone(x,z):
    return 'transit' if z<30 else 'market' if x<31 else 'atrium' if x>53 else 'plaza'


class Builder:
    def __init__(self):
        self.solids=[]; self.decor=[]; self.walkways=[]; self.cuts=[]
        self.stair_paths={}; self.structures=[]; self.portal_cuts=[]

    def box(self,b,style='concrete',kind='building',decor=False,**meta):
        x0,y0,z0,x1,y1,z1=map(float,b)
        if min(x1-x0,y1-y0,z1-z0)<.02:return
        item=dict(x=round((x0+x1)/2-40,4),y=round(y0,4),z=round((z0+z1)/2-40,4),
                  w=round(x1-x0,4),h=round(y1-y0,4),d=round(z1-z0,4),
                  style=style,kind=kind,zone=zone((x0+x1)/2,(z0+z1)/2),**meta)
        (self.decor if decor else self.solids).append(item)
        return item

    def corridor(self,p,q,width,level,route_id,via=None):
        """Manhattan corridor: rectilinear leg(s), including physical floor/support."""
        points=[(float(p[0]),float(p[2]))]
        if via is not None:points.extend(via)
        elif abs(p[0]-q[0])>.01 and abs(p[2]-q[2])>.01:
            # Keep the axis switch legible, and avoid single oversized box voids.
            points.append((float(p[0]),float(q[2])))
        points.append((float(q[0]),float(q[2])))
        for (x0,z0),(x1,z1) in zip(points,points[1:]):
            if abs(x0-x1)<.05 and abs(z0-z1)<.05:continue
            h=width/2
            bounds=(min(x0,x1)-h,level-.24,min(z0,z1)-h,
                    max(x0,x1)+h,level,max(z0,z1)+h)
            self.walkways.append((bounds,level,route_id))
            # Offset cut by a few cm to avoid a residual paper-thin collider.
            self.cuts.append((bounds[0]-.05,(level-.28 if level>=5 else level+.02),bounds[2]-.05,
                              bounds[3]+.05,level+3.05,bounds[5]+.05))
        return points

    def cut_passage(self,b,reason='portal'):
        self.cuts.append(tuple(map(float,b)))
        self.portal_cuts.append({'bounds':list(map(float,b)),'reason':reason})

    def shell(self,b,style='facade',kind='building',name=None):
        parts=[tuple(map(float,b))]
        for cut in self.cuts:
            # Only subdivide if bounding volumes intersect.
            if all(cut[i]<b[i+3] and cut[i+3]>b[i] for i in range(3)):
                parts=[out for part in parts for out in subtract(part,cut)]
        for p in parts:self.box(p,style,kind,structure=name or '')
        self.structures.append({'id':name,'bounds':list(map(float,b)),'parts':len(parts)})

    def flat(self,b,style='grate',kind='routeFloor',**meta):
        self.box(b,style,kind,**meta)


def _upper_paths(b,nav):
    nodes=nav['nodes']
    # Only y=5 public/secret links, y=9 station platform links.
    for e in nav['edges']:
        a=nodes[e['from_node']];c=nodes[e['to_node']]
        if a['y']==c['y'] and a['y'] in (5,9):
            if e['id']=='UP-08':
                # Approach the WEST staff stair from its rear, never create a
                # ceiling over the upper portion of the preceding flight.
                b.corridor((26,5,38),(29.15,5,38),3,5,'UP-08')
                b.corridor((29.15,5,38),(29.15,5,29.6),2.4,5,'UP-08')
                b.corridor((29.15,5,29.6),(26,5,29.6),2.4,5,'UP-08')
                continue
            if e['id']=='UP-09':
                b.corridor((60,5,47),(60,5,34.4),3,5,'UP-09')
                b.corridor((60,5,34.4),(69.25,5,34.4),3.2,5,'UP-09')
                continue
            width=3.15 if e['kind']!='public' else 3.35
            b.corridor((a['x'],a['y'],a['z']),(c['x'],c['y'],c['z']),width,a['y'],e['id'])


def _ground_paths(b,nav):
    nodes=nav['nodes']
    for e in nav['edges']:
        a=nodes[e['from_node']];c=nodes[e['to_node']]
        if a['y']==c['y'] and a['y'] == 1:
            b.corridor((a['x'],1,a['z']),(c['x'],1,c['z']),
                       max(3.1,float(e['target_clear_width_m'])),1,e['id'])
    # Critical public arcade. The centred north/south entrances must align.
    b.cut_passage((39.65,1,30.7,44.35,4.65,47.6),'C01 station-to-plaza arcade')
    # Through electronics arcade, not a closed retail mass.
    b.cut_passage((21.5,1,53.25,32.1,4.6,57.15),'M03 retail throughway')
    b.cut_passage((29.35,1,53.1,32.35,4.65,63.35),'M03 east aisle to plaza')
    b.cut_passage((23.2,1,57.0,29.8,4.3,62.7),'M03 repair workspace')
    # East west service portal through corporate boundary.
    b.cut_passage((56.4,1,34.5,75.3,4.55,39.2),'A01 open north service portal')
    b.cut_passage((65.2,1,28.6,71.0,4.55,39.3),'Axiom-to-operations service corridor')
    b.cut_passage((56.6,1,58.8,66,4.55,66),'Axiom public lobby access')
    b.cut_passage((61.5,1,29.8,70.2,4.55,34.5),'Operations staff entrance')
    b.cut_passage((60,8.72,21.3,72.0,12.25,34.5),'Operations upper service-to-platform connection')
    # Atrium double height, leaving an upper perimeter mezzanine.
    b.cut_passage((59.1,1,40,72.9,8.4,67.8),'A01 double-height void')
    # Raised galleries require real head-clear volume, not merely a graph link.
    b.cut_passage((50.0,4.72,58.0,56.5,8.55,66.2),'P02 +5 indoor gallery')
    b.cut_passage((59.0,4.72,25.0,64.3,8.55,31.0),'T04 +5 staff gallery')
    # East arcade and threshold; station stairs remain separate.
    b.cut_passage((48.8,1,58.1,56.5,4.65,65.6),'P02 retail gallery')
    # Building-wide explicit stair shafts, enlarged after Stage 3 fit check.
    for name,x0,z0,x1,z1 in [('T05',33.5,21.5,43.5,30.1),('T06',48.5,21.5,58.5,30.1),
                            ('S5',20.8,21.5,30.5,30.0),('S6',61.0,21.5,73.5,33.0)]:
        b.cut_passage((x0,1,z0,x1,9.5,z1),'clear multi-flight stair '+name)
    # Rail reserve: uninterrupted line through the north of the map.
    b.cut_passage((3,8.8,14,77,13,20.7),'east-west track envelope')


def _curbs_and_buildings(b,plan):
    # Existing arena dimension maintained; no expansion or hidden teleport nodes.
    for bounds in [(0,0,0,80,23,3),(0,0,77,80,22,80),
                   (0,0,3,4,25,77),(77,0,3,80,27,77)]:
        b.box(bounds,'dark','boundary')
    # Ground support: fixed level +1 everywhere except the recessed plaza.
    parts=[(3,-.34,3,77,1,77)]
    for cut in [(31.8,-1,49.2,49.2,2,72.2),
                (39.9,-1,46.1,44.1,2,50.3),
                (39.9,-1,71.5,44.1,2,75.7),
                (29.1,-1,60.1,33.3,2,64.3),
                (48.6,-1,57.9,52.8,2,62.1)]:
        parts=[piece for p in parts for piece in subtract(p,cut)]
    for p in parts:b.box(p,'road','floor')
    b.flat((31.8,-.4,49.2,49.2,0,72.2),'tile','floor',structure='P01')
    # 10 genuinely solid buildings; transit decks and stair shafts are different constructions.
    skip={'P01','T01','T05','T06'}
    for building in plan['buildings']:
        if building['id'] in skip:continue
        x0,z0,x1,z1=building['footprint']; top=building['visual_roof_y']
        if top is None:continue
        b.shell((x0,1,z0,x1,top,z1),'facade' if building['sector']!='Transit' else 'concrete',
                'atriumShell' if building['id']=='A01' else 'building',building['id'])
    # Structural bridge over the Central Exchange's arcade, outside the head-clear zone.
    b.flat((30,4.74,31,52,5.0,47),'metal','deck',structure='C01-upper-spanning-slab')
    # Small supported market roof at +5, aligned to U1.
    b.flat((21,4.76,34,30,5.0,46),'wood','deck',structure='M04-roof')
    # Physically continuous elevated station platform on SOUTH side of track.
    station_pieces=[(30,8.68,21.15,60,9.0,24.7)]
    for cx in (36.5,51.0):
        # Open a REAL stairwell in the station slab; no ceiling above flight 3.
        hole=(cx-2.7,8.3,23.54,cx+2.7,9.3,25.2)
        station_pieces=[piece for p in station_pieces for piece in subtract(p,hole)]
    for part in station_pieces:b.flat(part,'metal','deck',structure='T01-S-platform')
    # Rail bed is above road, and continues beyond the station (no walkable slabs across track).
    for z0,z1 in ((14.8,15.1),(19.35,19.65)):
        b.box((4,8.8,z0,76,9.04,z1),'rust','rail')
    for x in range(6,76,4):
        b.box((x,8.58,14.8,x+.6,8.83,19.7),'metal','tie')
    for x in (9,19,30,44,58,69):
        for z in (14.2,20.5):
            b.box((x-.2,1,z-.2,x+.2,8.6,z+.2),'concrete','column',structure='rail-support')
    # Ground floor plaza is one metre below the surrounding road.
    for name,(x0,z0,x1,z1),axis,direction in [
        ('P-N',(40,46.2,44,50.2),'z',-1),
        ('P-S',(40,71.6,44,75.6),'z',1),
        ('P-W',(29.2,60.2,33.2,64.2),'x',-1),
        ('P-E',(48.7,58.0,52.7,62.0),'x',1),
    ]:
        # Replace level+1 segment with continuous 1m grade transition, physically matching the renderer.
        xmid=(x0+x1)/2;zmid=(z0+z1)/2
        b.box((x0,-.2,z0,x1,1.0,z1),'tile','ramp',
            axis=axis,direction=direction,low=0,rise=1,thickness=.2,route=name)


def _make_straight_stair(b,id,p,q,width=3.2,step_h=1/6):
    """Construct real low risers rather than an invisible collision ramp."""
    x0,y0,z0=p;x1,y1,z1=q
    n=round((y1-y0)/step_h)
    assert n>0
    points=[list(p)]
    axis='x' if abs(x1-x0)>abs(z1-z0) else 'z'
    for i in range(n):
        t0=i/n;t1=(i+1)/n
        low=y0+(i)*((y1-y0)/n);high=y0+(i+1)*((y1-y0)/n)
        xa=x0+(x1-x0)*t0;xb=x0+(x1-x0)*t1
        za=z0+(z1-z0)*t0;zb=z0+(z1-z0)*t1
        if axis=='z':
            b.flat((x0-width/2,high-.16,min(za,zb),x0+width/2,high,max(za,zb)),
                   'grate','stairTread',route=id,step=i)
        else:
            b.flat((min(xa,xb),high-.16,z0-width/2,max(xa,xb),high,z0+width/2),
                   'grate','stairTread',route=id,step=i)
        points.append([round(xb,3),round(high,3),round(zb,3)])
    b.stair_paths[id]=points
    b.cut_passage((min(x0,x1)-width/2-.2,y0,min(z0,z1)-width/2-.2,
                   max(x0,x1)+width/2+.2,y1+3.0,max(z0,z1)+width/2+.2),
                   'headroom for stepped '+id)
    return points


def _make_switchback(b,id,cx,z_south,low=1,high=9,lane_sep=3.15,width=2.45):
    """Four switchback flights, two metres per flight, plus separate bridge lane.

    This is an FPS-scale architectural stair, not an accessible public stair design.
    Public lift space is reserved in the building register but not operational.
    """
    assert (high-low)==8
    zN=z_south-4.2;zS=z_south
    left=cx-lane_sep/2;right=cx+lane_sep/2
    bridge_x=cx+3.75
    points=[[left,low,zS]]
    for flight in range(4):
        x=left if flight%2==0 else right
        startz=zS if flight%2==0 else zN
        endz=zN if flight%2==0 else zS
        if points[-1]!=[x,low+flight*2,startz]:points.append([x,low+flight*2,startz])
        for step in range(12):
            t0=step/12;t1=(step+1)/12
            za=startz+(endz-startz)*t0;zb=startz+(endz-startz)*t1
            y=low+flight*2+(step+1)/6
            b.flat((x-width/2,y-.16,min(za,zb),x+width/2,y,max(za,zb)),
                   'metal','stairTread',route=id,step=flight*12+step)
            points.append([x,round(y,4),round(zb,3)])
        # At alternating north and south ends transfer to other flight's lane.
        if flight<3:
            cross_z=zN if flight%2==0 else zS
            y=low+(flight+1)*2
            # Landing begins *after* the last tread, so it cannot become a low ceiling.
            z0,z1=(cross_z-.80,cross_z) if flight%2==0 else (cross_z,cross_z+.80)
            b.flat((left-width/2,y-.20,z0,right+width/2,y,z1),
                   'grate','stairLanding',route=id,landing=flight+1)
            points.append([right if flight%2==0 else left,y,cross_z])
    # At +9, the last stair finishes on the south side; a dedicated lateral
    # deck lane leads north to the south-side train platform. It does not cross tracks.
    b.flat((right-width/2,high-.20,zS,bridge_x+.9,high,zS+.72),
           'grate','stairLanding',route=id,landing=4)
    b.flat((bridge_x-.92,high-.20,zN-.8,bridge_x+.92,high,zS+.72),
           'grate','deck',route=id,structure='stair-exit-bridge')
    b.flat((cx-2.1,high-.20,zN-1.1,bridge_x+.92,high,zN-.47),
           'grate','deck',route=id,structure='station-landing')
    points.extend([[bridge_x,high,zS],[bridge_x,high,zN-.25],[cx,high,zN-.88]])
    b.stair_paths[id]=points
    b.cut_passage((cx-3.5,low,zN-1.2,cx+5.0,high+3.1,zS+1.0),
                  'stairwell/headroom '+id)
    return points


def _stairs(b):
    # Legacy public/staff stair identity kept. S4 has TWO public cores in stage4.
    _make_straight_stair(b,'S1',(11,1,54),(11,5,38),3.0)
    _make_straight_stair(b,'S2',(26.5,1,71),(26.5,5,55),2.6)
    _make_straight_stair(b,'S3',(68,1,66),(68,5,50),3.0)
    _make_switchback(b,'S4',36.5,28.2)
    _make_switchback(b,'S4-E',51.0,28.2)
    _make_switchback(b,'S5',23.5,28.2)
    _make_switchback(b,'S6',65.5,31.2)


def _staff_transfers(b):
    # Secondary +5 to +9 stair landings are genuine alternate routes.
    for p,q,level,who in [
        ((15,5,30),(26,5,30),5,'U3'),
        ((26,5,30),(26,5,29.6),5,'U3'),
        ((26,9,23),(38,9,23),9,'U3'),
        ((69.25,9,31.2),(69.25,9,23),9,'U4'),
        ((69.25,9,23),(53,9,23),9,'U4'),
    ]: b.corridor(p,q,3.0 if level==5 else 3.1,level,who)
    # Landings only extend OUT of the staircase, not above the incoming flight.
    b.flat((24.5,4.8,28.2,29.3,5,30.1),'metal','stairLanding',route='U3',landing='service')
    b.flat((65.9,4.8,31.2,70.0,5,34.5),'metal','stairLanding',route='U4',landing='service')

def _floors_and_supports(b):
    for bounds,level,label in b.walkways:
        if level<=1.01:continue  # Base ground slab already exists.
        pieces=[bounds]
        if level==9:
            # Station and staff staircase voids must cut through EVERY upper
            # slab, not just the primary platform slab.
            for cx,zS in ((36.5,28.2),(51.,28.2),(23.5,28.2),(65.5,31.2)):
                void=(cx-2.7,8.4,zS-4.66,cx+2.7,9.3,zS-3.0)
                pieces=[part for p in pieces for part in subtract(p,void)]
        if level==5:
            for x,z in ((11,38),(26.5,55)):
                # Remove the portion of the upper slab that would otherwise
                # appear as a ceiling on the last two stair treads.
                void=(x-1.70,4.5,z+.65,x+1.70,5.2,z+2.4)
                pieces=[part for p in pieces for part in subtract(p,void)]
            # Service stairs cannot have a +5 bridge overhead while still on
            # the lower return flight at y3–5.
            for cx,zS in ((23.5,28.2),(65.5,31.2)):
                void=(cx-2.7,4.5,zS-4.7,cx+2.7,5.2,zS-.35)
                pieces=[part for p in pieces for part in subtract(p,void)]
        for part in pieces:b.flat(part,'grate' if level>5 else 'wood','routeFloor',structure=label)
        x0,y0,z0,x1,_,z1=bounds
        # Supports beyond the traffic corridor at endpoints, if at upper levels.
        if level==5 and max(x1-x0,z1-z0)>5:
            if x1-x0>z1-z0:
                for x in [x0+.5,x1-.5]:
                    b.box((x-.14,1,z1+.36,x+.14,level-.28,z1+.64),'metal','column',decor=True,structure=label)
            else:
                for z in [z0+.5,z1-.5]:
                    b.box((x1+.36,1,z-.14,x1+.64,level-.28,z+.14),'metal','column',decor=True,structure=label)


def _legacy_routes(base, b):
    # Keep the original 12 identities, replace obvious inconsistent station
    # heights with consistent +9 south-platform endpoints. Stage3 planning
    # edges are retained in a separate metadata graph for future AI navigation.
    routes=copy.deepcopy(base.get('routes',[]))
    stairs=copy.deepcopy(base.get('stairs',[]))
    by_id={r['id']:r for r in routes}
    updates={
        'G1':[(16,1,53),(16,1,70),(20,1,74),(42,1,75.6),(42,0,71.6),(42,0,62)],
        'G2':[(47,0,60),(48.7,0,60),(52.7,1,60),(57,1,64),(65,1,60)],
        'I1':[(16,1,53),(22,1,55),(25,1,55),(31,1,55),(29.2,1,62),(33.2,0,62),(42,0,62)],
        'I2':[(47,0,60),(48.7,0,60),(52.7,1,60),(53,1,64),(57,1,64),(65,1,60)],
        'U1':[(11,5,38),(20,5,38),(26,5,38),(26,5,49),(26,5,55),(29,5,55),(35,5,55)],
        'U2':[(35,5,55),(35,5,62),(53,5,62),(53,5,65),(63,5,65),(63,5,55),(65,5,55)],
        'G3':[(17,1,30),(38,1,30),(36.5,1,28.2),*b.stair_paths['S4'],(36.5,9,23),(44,9,23)],
        'G4':[(65,1,37),(57,1,37),(57,1,30),(51,1,30),*b.stair_paths['S4-E'],(53,9,23),(44,9,23)],
        'I3':[(16,1,29),(23.5,1,29),*b.stair_paths['S5'],(30,9,23),(38,9,23)],
        'I4':[(70,1,38),(70,1,34),(63.925,1,34),(63.925,1,31.2),*b.stair_paths['S6'],(69.25,9,26.12),(69.25,9,23),(53,9,23)],
        'U3':[(15,5,30),(26,5,28),(26,5,26),(30,5,26),(30,9,23),(38,9,23)],
        'U4':[(60,5,47),(60,5,28),(60,9,23),(53,9,23)]}
    # Use the built workshop/operations stair upper flights for U3/U4.
    staff_upper={rid:path[next(i for i,p in enumerate(path) if abs(p[1]-5)<.001 and i>3):] for rid,path in [(i,b.stair_paths[i]) for i in ('S5','S6')]}
    updates['U3']=[(15,5,30),(26,5,30),(26,5,29.6),(25.075,5,28.2),*staff_upper['S5'],(30,9,23),(38,9,23)]
    updates['U4']=[(60,5,47),(60,5,34.4),(69.25,5,34.4),(67.075,5,31.2),*staff_upper['S6'],(69.25,9,26.12),(69.25,9,23),(53,9,23)]
    for rid,pts in updates.items():
        if rid in by_id:
            by_id[rid]['points']=[[x-40,y,z-40] for x,y,z in pts]
            by_id[rid]['stage4_status']='physical-candidate'
    for s in stairs:
        if s['id'] in b.stair_paths:
            s['points']=[[x-40,y,z-40] for x,y,z in b.stair_paths[s['id']]]
    return routes,stairs


def overlay(base):
    """Return a new experimental greybox candidate without mutating base."""
    nav=_load('stage4_navigation.json')
    plan=_load('stage4_buildings.json')
    # Correct Stage3 error: the central +9 node must be on a platform, not on track.
    nav['nodes']['T9_C']['z']=23
    nav['nodes']['T9_C']['world_z']=-17
    nav['nodes']['T5_W'].update(x=25.075,z=28.2,world_x=-14.925,world_z=-11.8)
    nav['nodes']['T5_E'].update(x=67.075,z=31.2,world_x=27.075,world_z=-8.8)
    # Stage 3 thresholds were drawn exactly on the rim of a 1m drop. Move
    # their wayfinding points into the square; keep grade transitions outside.
    for key,changes in {'P_W':(34,62),'P_E':(47,60),'P_N':(42,51.2),'P_S':(42,70.5)}.items():
        nav['nodes'][key]['x'],nav['nodes'][key]['z']=changes
        nav['nodes'][key]['world_x'],nav['nodes'][key]['world_z']=changes[0]-40,changes[1]-40
    b=Builder()
    _ground_paths(b,nav)
    _upper_paths(b,nav)
    _stairs(b)
    _staff_transfers(b)
    _curbs_and_buildings(b,plan)
    _floors_and_supports(b)
    # The original feature lights and textures are intentionally excluded here;
    # retain only the recognisable landmark signs and zone metadata.
    output=copy.deepcopy(base)
    output.update(revision='02.6-stage4-greybox',boxes=b.solids,decor=b.decor,
                  features=[],size=80,clearance=3.0,stage4=dict(
                  status='EXPERIMENTAL / IN-ENGINE TESTS NOT RUN',
                  zones_preserved=True,identity='Cyberpunk City',
                  physical_staircases=['S1','S2','S3','S4','S4-E','S5','S6'],
                  graph=nav['edges'],nodes=nav['nodes'],
                  structure_count=len(b.structures),structures=b.structures,
                  portal_cuts=b.portal_cuts,
                  unresolved=['full server/client traversal', 'complete portal-by-portal sweeps',
                              'public lift reserved but not functional']))
    output['routes'],output['stairs']=_legacy_routes(base,b)
    # Original spawn placement is not trusted after major colliders change.
    # Candidate locations are tested in validation before any activation.
    output['spawns']=[[-24,1,13],[-24,1,-7],[2,0,22],[-5,0,22],
                      [25,1,20],[27,1,-3],[-2,9,-17],[13,9,-17]]
    return output