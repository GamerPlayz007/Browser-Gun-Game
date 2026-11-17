"""Build collision-verified Octavus navigation and spawn candidates.

Reads the ORIGINAL 86,500 triangles, original Red Eclipse playerstart
entities, and existing CROSSFire spawn points. Derives a conservative
grid of capsule-clear walking positions/connected sightlines. Never
creates new world geometry or guesses walkable surfaces from map images.

Run offline: python scripts/build_octavus_navigation.py
A resulting arena spawn update must be reviewed before publishing.
"""
from collections import Counter,defaultdict,deque
import json
import math
from pathlib import Path

from octavus_world import get_octavus_world

ROOT=Path(__file__).resolve().parents[1]
MAPS=ROOT/'static'/'maps'
GRID_STEP=8
GRID_EXTENT=152
HEIGHT_HINTS=(0.,4.,-4.,8.,-8.,12.,-12.,16.,-16.,24.)
HEIGHT_TOLERANCE=1.45


def near_floor(world,x,z,hint):
    for y in (hint,hint+1.,hint-1.):
        ground=world.ground_at(x,z,y)
        if ground is None:continue
        if abs(ground-hint) > 1.5:continue
        if world.capsule_clear((x,ground,z)):
            return round(ground,4)
    return None


def foot(world,x,z):
    for target in HEIGHT_HINTS:
        ground=near_floor(world,x,z,target)
        if ground is not None:return ground
    return None


def line_open(world,a,b):
    x,y,z=a;X,Y,Z=b
    if abs(y-Y)>HEIGHT_TOLERANCE:return False
    dist=math.hypot(X-x,Z-z)
    if dist>GRID_STEP*1.5:return False
    samples=max(2,math.ceil(dist/2.7))
    # Verify real floor support all the way along each proposed connection.
    for j in range(1,samples):
        t=j/samples
        px=x+(X-x)*t;pz=z+(Z-z)*t;py=y+(Y-y)*t
        height=near_floor(world,px,pz,py)
        if height is None or abs(height-py)>1.05:return False
    start=(x,y+1.16,z);end=(X,Y+1.16,Z)
    obstacle=world.raycast(start,end)
    return not obstacle or obstacle['distance']>=math.dist(start,end)-.13


def main():
    original=json.loads((MAPS/'octavus.native-entities.json').read_text())
    metadata=json.loads((MAPS/'octavus.json').read_text())
    mesh=get_octavus_world()

    native_starts=[]
    for entry in original.get('playerStarts',[]):
        u,v,w=entry['sourcePosition']
        x=(u-4096)*.05;z=(v-4096)*.05;y=(w-2816)*.05
        if not mesh.inside(x,z):continue
        floor=near_floor(mesh,x,z,y)
        if floor is None:continue
        native_starts.append({
            'sourceEntity':entry['id'],
            'originalTeamTag':entry['attrs'][0] if entry['attrs'] else 0,
            'position':[round(x,4),floor,round(z,4)],
            'origin':'native Red Eclipse Octavus playerstart'
        })

    # Grid is a navigation aid, not walkable floor geometry. A location
    # must have a real authored floor and room for the player's capsule.
    points={}
    for gx in range(-GRID_EXTENT//GRID_STEP,GRID_EXTENT//GRID_STEP+1):
        for gz in range(-GRID_EXTENT//GRID_STEP,GRID_EXTENT//GRID_STEP+1):
            x=gx*GRID_STEP;z=gz*GRID_STEP
            ground=foot(mesh,x,z)
            if ground is not None:points[(gx,gz)]=[x,ground,z]

    links={key:[] for key in points}
    for (gx,gz),pos in points.items():
        for dx,dz in ((1,0),(0,1),(-1,0),(0,-1)):
            other=(gx+dx,gz+dz)
            if other in points and line_open(mesh,pos,points[other]):
                links[(gx,gz)].append(other)

    # Retain every connected walking component; route planning can reject
    # disconnected target sectors instead of routing bots through walls.
    components={}
    groups=[]
    pending=set(points)
    while pending:
        start=min(pending);queue=deque([start]);pending.remove(start)
        group=[]
        while queue:
            at=queue.popleft();group.append(at)
            for nxt in links[at]:
                if nxt in pending:
                    pending.remove(nxt);queue.append(nxt)
        idx=len(groups)
        groups.append(group)
        for key in group:components[key]=idx
    index={key:i for i,key in enumerate(sorted(points))}
    nodes=[{
        'id':index[key], 'p':points[key],
        'links':[index[v] for v in links[key]],
        'component':components[key]
    } for key in sorted(points)]

    valid_old=[]
    for point in metadata['spawns']:
        x,y,z=point
        g=near_floor(mesh,x,z,y)
        if g is not None and abs(g-y)<.18:
            valid_old.append(point)

    # Upstream player starts can enrich existing geometry-safe spawns,
    # but cannot silently overwrite their team's current locations.
    extras=[]
    existing=[point for point in valid_old]
    for entry in native_starts:
        candidate=entry['position']
        if any(math.dist((candidate[0],candidate[2]),(p[0],p[2]))<7.5 for p in existing):
            continue
        if len(extras)>=30:break
        extras.append(entry)
        existing.append(candidate)

    # Additional distant sectors qualify only when they're on a sizable,
    # connected piece of REAL map, not isolated sand/geometry fragments.
    large={i for i,c in enumerate(groups) if len(c)>=18}
    expanded=[]
    for node in sorted(nodes,key=lambda n:(
            -(abs(n['p'][0])+abs(n['p'][2])),
            abs(n['p'][0])+abs(n['p'][2]))):
        x,y,z=node['p']
        if node['component'] not in large:continue
        if max(abs(x),abs(z))<104 or max(abs(x),abs(z))>152:continue
        if any(math.hypot(x-p[0],z-p[2])<24 for p in existing):continue
        if not any(math.hypot(x-s['position'][0],z-s['position'][2])<72
                   for s in native_starts):continue
        expanded.append([x,y,z]);existing.append([x,y,z])
        if len(expanded)>=16:break

    summary={
        'format':'OCTAVUS-NAV3',
        'source':'Exact original Octavus mesh + native MPZ playerstarts',
        'readOnly':True,
        'step':GRID_STEP,'gridExtent':GRID_EXTENT,
        'nodes':nodes,
        'stats':{
            'originalTriangles':mesh.count,
            'sourcePlayerstarts':len(original.get('playerStarts',[])),
            'nativeSafeStarts':len(native_starts),
            'existingSafeSpawns':len(valid_old),
            'nodeCount':len(nodes),
            'connectedComponents':len(groups),
            'largestComponent':max((len(c) for c in groups),default=0),
            'componentSizes':sorted((len(c) for c in groups),reverse=True)[:12],
            'xRange':[min((n['p'][0] for n in nodes),default=0),
                      max((n['p'][0] for n in nodes),default=0)],
            'zRange':[min((n['p'][2] for n in nodes),default=0),
                      max((n['p'][2] for n in nodes),default=0)],
            'newSpawnCandidates':len(extras),
            'outerSectorCandidates':len(expanded),
        },
        'nativePlayerstarts':native_starts,
        'recommendedSpawnCandidates':extras,
        'optionalOuterSectorCandidates':expanded,
        'warning':'Generated routes must be playtested. Original assets do not establish a new designed FPS combat district.'
    }
    (MAPS/'octavus.navigation.json').write_text(json.dumps(summary,separators=(',',':'))+'\n')
    print(json.dumps(summary['stats'],indent=2))


if __name__=='__main__':main()
