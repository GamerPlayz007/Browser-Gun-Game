"""Octavus bots follow collision-verified walking routes, never image paths.

The graph comes from scripts/build_octavus_navigation.py, which samples the
original Red Eclipse mesh. No client-reported route, geometry, or position
is trusted. Other CROSSFire arenas retain their existing AI behavior.
"""
from functools import lru_cache
from pathlib import Path
import heapq
import json
import math

ROOT=Path(__file__).parent
FILE=ROOT/'static/maps/octavus.navigation.json'


@lru_cache(maxsize=1)
def get_nav():
    if not FILE.is_file():return None
    try:
        data=json.loads(FILE.read_text(encoding='utf-8'))
        nodes=data.get('nodes',[])
        if (data.get('format')!='OCTAVUS-NAV3' or
                data.get('stats',{}).get('originalTriangles')!=86500 or
                len(nodes)<12):
            return None
        for i,n in enumerate(nodes):
            if n['id']!=i or not all(0<=e<len(nodes) for e in n['links']):
                return None
        return nodes
    except (ValueError,TypeError,OSError,KeyError):
        return None


def nearest(nodes,actor):
    x,z=actor['x'],actor['z'];y=actor['y']
    best=-1;score=1e10
    for i,node in enumerate(nodes):
        nx,ny,nz=node['p']
        delta_y=abs(ny-y)
        if delta_y>3.2:continue
        value=(nx-x)**2+(nz-z)**2+(delta_y*4)**2
        if value<score:best=i;score=value
    return best if score<21**2 else None


def route(nodes,start,goal):
    if start==goal:return [start]
    if nodes[start]['component']!=nodes[goal]['component']:
        return []
    dest=nodes[goal]['p']
    cost={start:0.}
    previous={}
    queue=[(0.,start)]
    complete=False
    visited=0
    while queue and visited<1500:
        _,idx=heapq.heappop(queue);visited+=1
        if idx==goal:complete=True;break
        x,y,z=nodes[idx]['p']
        for nidx in nodes[idx]['links']:
            px,py,pz=nodes[nidx]['p']
            possible=cost[idx]+math.hypot(px-x,pz-z)+abs(py-y)*1.6
            if possible>=cost.get(nidx,1e100):continue
            cost[nidx]=possible
            previous[nidx]=idx
            heuristic=math.hypot(px-dest[0],pz-dest[2])
            heapq.heappush(queue,(possible+heuristic,nidx))
    if not complete:return []
    path=[goal]
    while path[-1]!=start:
        path.append(previous[path[-1]])
    path.reverse()
    return path


def next_octavus_waypoint(bot,target,now):
    nodes=get_nav()
    if not nodes:return None
    # Replan every 1.7 seconds or whenever the target changes; never
    # do an 800-node graph traversal in every 60Hz server frame.
    path=bot.get('oct_nav_path',[])
    if (now>=bot.get('oct_nav_until',0) or
            bot.get('oct_nav_target')!=target['id'] or not path):
        a=nearest(nodes,bot);b=nearest(nodes,target)
        path=route(nodes,a,b) if a is not None and b is not None else []
        bot['oct_nav_path']=path
        bot['oct_nav_until']=now+1.7
        bot['oct_nav_target']=target['id']
    while len(path)>1:
        point=nodes[path[0]]['p']
        if math.hypot(point[0]-bot['x'],point[2]-bot['z'])>=4.7:break
        path.pop(0)
    if not path:return None
    # If a nearby target is directly visible, bot57 keeps its current
    # native sightline behavior instead of following stale graph points.
    waypoint=nodes[path[0]]['p']
    if abs(waypoint[1]-bot['y'])>2.0:return None
    return (waypoint[0],waypoint[1],waypoint[2])
