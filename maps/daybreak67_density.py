"""DAYBREAK 6.7: authored-feeling street furniture, without blocking travel lanes.

Append small server-authoritative cover to previously empty peripheral pockets.
No original floor, staircase, ramp, route, boundary or spawn is edited.
The visual renderer replaces the collision proxy with instanced city props.
"""
from math import hypot
from collections import Counter

FURNITURE67=(
 ('planter',1.2,1.2,.86,'concrete'),
 ('bench',1.5,.8,.76,'wood'),
 ('kiosk',2.2,1.8,2.4,'pale'),
 ('car',3.4,1.7,1.32,'metal'),
 ('barrier',1.7,.8,.96,'concrete')
)
NO_BLOCK_KINDS={'floor','routeFloor','deck','tie','rail','railGirder','ramp'}
GRID_START=-53.5
GRID_STEP=4.7
ROUTE_BUFFER=.75

def segment_distance(x,z,a,b):
    dx=b[0]-a[0];dz=b[1]-a[1]
    t=max(0.,min(1.,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz or 1.)))
    return hypot(x-a[0]-t*dx,z-a[1]-t*dz)

def travel_lines(city):
    lines=[]
    for path in city['routes']+city['stairs']:
        lines.append((float(path['width']),[(p[0],p[2]) for p in path['points']]))
    for path in city['stage6']['new_navigation_paths']:
        lines.append((float(path['width']),path['points']))
    return lines

def protected(site,city,lines,buffer=ROUTE_BUFFER):
    """A footprint cannot consume travel clearance, occupy solids or a spawn."""
    x,z,w,d=site
    radius=hypot(w,d)/2+buffer
    if any(segment_distance(x,z,a,b)<width/2+radius
           for width,points in lines for a,b in zip(points,points[1:])):
        return False
    if any(b['kind'] not in NO_BLOCK_KINDS and b['y']<4.4
           and b['y']+b['h']>1.02
           and abs(x-b['x'])<(w+b['w'])/2+.38
           and abs(z-b['z'])<(d+b['d'])/2+.38
           for b in city['boxes']):return False
    if any(hypot(x-p[0],z-p[2])<6 for p in city['spawns']):return False
    return True

def district(x,z):
    return ('west' if x<0 else 'east') if abs(x)>abs(z) else ('north' if z<0 else 'south')

def place_outer_furniture67(city):
    lines=travel_lines(city)
    occupied=[];placed=[];counts=Counter()
    # Deterministic, sparse candidate lattice; every placement is checked.
    for ix in range(23):
        x=round(GRID_START+ix*GRID_STEP,2)
        for iz in range(23):
            z=round(GRID_START+iz*GRID_STEP,2)
            if not 36<=max(abs(x),abs(z))<=55:continue
            section=district(x,z)
            if counts[section]>=11:continue
            kind,w,d,h,finish=FURNITURE67[len(placed)%len(FURNITURE67)]
            if not protected((x,z,w,d),city,lines):continue
            if any(hypot(x-px,z-pz)<5.8 for px,pz in occupied):continue
            item={'id':f'D67-{len(placed)+1:03d}','type':kind,'district':section,
                  'x':x,'z':z,'y':1.0,'w':w,'d':d,'h':h,'tier':0}
            placed.append(item);occupied.append((x,z));counts[section]+=1
            city['boxes'].append({'x':x,'y':1.,'z':z,'w':w,'d':d,'h':h,
                'style':finish,'kind':'streetFurniture',
                'zone':'plaza','daybreak67Physical':True,'furnitureId':item['id']})
    return placed

def facade_fronts67(city):
    """Place printed wayfinding on existing outer building faces, never roads."""
    fronts=[]
    options=('CAFE & DELI','CITY STORES','OFFICES','PUBLIC SERVICES',
             'LOCAL MARKET','REPAIRS','SERVICE CENTRE','STATION LINK')
    for i,p in enumerate(city['stage6']['physical_parcels']):
        if p['status']!='constructed shell':continue
        x0,z0,x1,z1=p['footprint'];cx=(x0+x1)/2;cz=(z0+z1)/2
        if abs(cx)>abs(cz):
            face='east' if cx<0 else 'west'
            x=x1+.07 if cx<0 else x0-.07;z=cz
        else:
            face='south' if cz<0 else 'north'
            x=cx;z=z1+.07 if cz<0 else z0-.07
        fronts.append({'id':p['id'],'text':options[i%len(options)],
                       'x':round(x,3),'y':3.15,'z':round(z,3),'face':face,
                       'tier':1 if i%4 else 0,'family':p['family']})
    return fronts

def overlay(city):
    original_count=len(city['boxes'])
    furnishing=place_outer_furniture67(city)
    facades=facade_fronts67(city)
    assert len(furnishing)>=16,'Too few safe pockets for street density'
    assert all(v for v in Counter(p['district'] for p in furnishing).values())
    city['daybreak67']={
        'revision':'06.7','visualScheme':'instanced-urban-life',
        'priorColliderCount':original_count,'physicalCount':len(furnishing),
        'furnishings':furnishing,'facades':facades,
        'protectedRouteClearance':ROUTE_BUFFER,
        'qualityTiers':{'performance':0,'auto':1,'high':1,'ultra':2,'native':2},
        'noOriginalGeometryChanged':True}
    return city
