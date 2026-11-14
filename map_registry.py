"""Room-scoped map definitions. Add enabled map JSON to the registry to extend the lobby."""
import json, math
from pathlib import Path
ROOT=Path(__file__).parent
REGISTRY=json.loads((ROOT/'static/maps/index.json').read_text())
WEAPONS=json.loads((ROOT/'static/weapons.json').read_text())
CELL=8
class Arena:
    def __init__(self,data):
        self.data=data;self.id=data['id'];self.boxes=data['boxes'];self.spawns=data['spawns'];self.grid={}
        for i,b in enumerate(self.boxes):
            for gx in range(math.floor((b['x']-b['w']/2)/CELL),math.floor((b['x']+b['w']/2)/CELL)+1):
                for gz in range(math.floor((b['z']-b['d']/2)/CELL),math.floor((b['z']+b['d']/2)/CELL)+1):self.grid.setdefault((gx,gz),[]).append(i)
    def nearby(self,x,z,radius=1):
        ids=set()
        for gx in range(math.floor((x-radius)/CELL),math.floor((x+radius)/CELL)+1):
            for gz in range(math.floor((z-radius)/CELL),math.floor((z+radius)/CELL)+1):ids.update(self.grid.get((gx,gz),()))
        return [self.boxes[i] for i in sorted(ids)]
ARENAS={}
for entry in REGISTRY['maps']:
    if not entry['available']:continue
    path=(ROOT/entry['url'].lstrip('/')).resolve()
    if not path.is_relative_to((ROOT/'static/maps').resolve()):raise ValueError('Map path outside static/maps')
    arena=Arena(json.loads(path.read_text()))
    if arena.id!=entry['id']:raise ValueError('Map ID mismatch')
    ARENAS[arena.id]=arena
DEFAULT=ARENAS[REGISTRY['default']]

def top_at(b,x,z):
    if b.get('kind')!='ramp':return b['y']+b['h']
    axis=b['axis'];size=b['w'] if axis=='x' else b['d'];v=x if axis=='x' else z
    t=max(0,min(1,(v-b[axis])/size+.5))
    return b['low']+b['rise']*(t if b['direction']>0 else 1-t)
def bottom_at(b,x,z):return top_at(b,x,z)-b['thickness'] if b.get('kind')=='ramp' else b['y']

def ray_solid(origin,direction,b):
    """Clip against convex solid planes, including the two inclined ramp faces."""
    if b.get('kind')!='ramp':
        lo,hi=0.,100.
        for i,(low,high) in enumerate([(b['x']-b['w']/2,b['x']+b['w']/2),(b['y'],b['y']+b['h']),(b['z']-b['d']/2,b['z']+b['d']/2)]):
            if abs(direction[i])<1e-9:
                if origin[i]<low or origin[i]>high:return None
            else:
                a=(low-origin[i])/direction[i];c=(high-origin[i])/direction[i]
                lo=max(lo,min(a,c));hi=min(hi,max(a,c))
                if hi<lo:return None
        return lo
    planes=[((1,0,0),b['x']+b['w']/2),((-1,0,0),-b['x']+b['w']/2),((0,0,1),b['z']+b['d']/2),((0,0,-1),-b['z']+b['d']/2)]
    if b.get('kind')=='ramp':
        slope=b['rise']*b['direction']/(b['w'] if b['axis']=='x' else b['d'])
        intercept=b['low']+b['rise']/2-slope*b[b['axis']]
        n=(-slope,1,0) if b['axis']=='x' else (0,1,-slope)
        planes.extend([(n,intercept),(tuple(-v for v in n),-intercept+b['thickness'])])
    else:planes.extend([((0,1,0),b['y']+b['h']),((0,-1,0),-b['y'])])
    lo,hi=0.,100.
    for n,d in planes:
        o=sum(n[i]*origin[i] for i in range(3))-d;v=sum(n[i]*direction[i] for i in range(3))
        if abs(v)<1e-9:
            if o>0:return None
        elif v>0:hi=min(hi,-o/v)
        else:lo=max(lo,-o/v)
        if hi<lo:return None
    return lo
