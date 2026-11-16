"""Authored in metres on an 80 x 80 block; centred X/Z in exported data.
Solid architecture is carved into rooms and passages. Routes compile into both
navigation metadata and real floor/ramp colliders. No hidden collision risers.
"""
from html import escape
PALETTE={'concrete':'#b8b9af','dark':'#687980','road':'#656e70','metal':'#969fa0','pale':'#d8d4c8','glass':'#88aabc','cyan':'#4d8396','magenta':'#a67b80','amber':'#c5a57b','white':'#edf0eb','garden':'#679470','wood':'#ad896a','rust':'#aa907a','grate':'#878f8d','tile':'#c2bdb2','asphalt':'#707a7c','facade':'#adb8b4','leather':'#7e7169'}
def subtract(a,c):
    x0,y0,z0,x1,y1,z1=a;u0,v0,w0,u1,v1,w1=c
    u0,v0,w0=max(x0,u0),max(y0,v0),max(z0,w0);u1,v1,w1=min(x1,u1),min(y1,v1),min(z1,w1)
    if u0>=u1 or v0>=v1 or w0>=w1:return [a]
    return [p for p in [(x0,y0,z0,u0,y1,z1),(u1,y0,z0,x1,y1,z1),(u0,y0,z0,u1,v0,z1),(u0,v1,z0,u1,y1,z1),(u0,v0,z0,u1,v1,w0),(u0,v0,w1,u1,v1,z1)] if all(p[i+3]-p[i]>.001 for i in range(3))]

def build(weapons):
    boxes=[];decor=[];routes=[];stairs=[];features=[]
    def zone(x,z):return 'transit' if z<30 else 'market' if x<31 else 'atrium' if x>53 else 'plaza'
    def box(x0,y0,z0,x1,y1,z1,style='concrete',kind='building',target=None,**kw):
        if min(x1-x0,y1-y0,z1-z0)<.001:return
        b=dict(x=(x0+x1)/2-40,y=y0,z=(z0+z1)/2-40,w=x1-x0,h=y1-y0,d=z1-z0,style=style,kind=kind,zone=zone((x0+x1)/2,(z0+z1)/2),**kw)
        (boxes if target is None else target).append(b);return b
    def route(id,name,a,b,width,points):routes.append(dict(id=id,name=name,fromZone=a,toZone=b,width=width,clearance=4.2,points=points))
    route('G1','Delivery Alley','market','plaza',6,[(16,1,53),(16,1,70),(20,1,74),(40,1,74),(40,0,68)])
    route('G2','Corporate Forecourt','plaza','atrium',6,[(46,0,68),(46,1,74),(64,1,74),(64,1,66)])
    route('G3','Station Approach','market','transit',6,[(17,1,30),(38,1,30),(44,1,30),(44,1,26),(44,9,10),(38,9,10)])
    route('G4','Service Street','atrium','transit',6,[(65,1,37),(57,1,37),(57,1,30),(50,1,30),(44,1,30),(44,1,26),(44,9,10),(50,9,10)])
    route('I1','Electronics Shop','market','plaza',4,[(19,1,49),(25,1,49),(25,1,55),(29,1,55),(35,0,55)])
    route('I2','Security Lobby','plaza','atrium',4,[(46,0,60),(53,1,60),(53,1,64),(60,1,64)])
    route('I3','Maintenance Offices','market','transit',4,[(16,1,29),(16,1,18),(22,1,18),(22,1,29),(26,1,29),(26,1,26),(26,9,10),(34,9,10)])
    route('I4','Operations Wing','atrium','transit',4,[(70,1,38),(70,1,29),(65,1,29),(65,1,19),(60,1,19),(60,1,30),(56,1,30),(56,1,27),(56,9,11),(50,9,11)])
    route('U1','Signwalk','market','plaza',4,[(11,5,38),(20,5,38),(26,5,38),(26,5,49),(29,5,49),(29,5,55),(35,5,55)])
    route('U2','Executive Link','plaza','atrium',4,[(35,5,55),(35,5,73),(63,5,73),(63,5,65),(63,5,50),(68,5,50)])
    route('U3','Rooftop Connector','market','transit',4,[(15,5,30),(15,5,28),(31,9,28),(34,9,28),(34,9,20)])
    route('U4','Commuter Bridge','atrium','transit',4,[(60,5,47),(56,5,47),(56,5,44),(56,9,28),(50,9,28),(50,9,20)])
    for id,name,width,points in [('S1','Market canopy stair',4,[(11,1,54),(11,5,38)]),('S2','Plaza west stair',4,[(29,1,71),(29,5,55)]),('S3','Atrium escalator ramp',4,[(68,1,66),(68,5,50)]),('S4','Public station stair',6,[(44,1,26),(44,9,10)]),('S5','West staff stair',4,[(26,1,26),(26,9,10)]),('S6','Operations stair',4,[(56,1,27),(56,9,11)])]:stairs.append(dict(id=id,name=name,width=width,points=points))
    paths=routes+stairs;cuts=[]
    for r in paths:
        for a,b in zip(r['points'],r['points'][1:]):
            h=r['width']/2+.15
            cuts.append((min(a[0],b[0])-h,min(a[1],b[1]),min(a[2],b[2])-h,max(a[0],b[0])+h,max(a[1],b[1])+4.2,max(a[2],b[2])+h))
    def mass(bounds,style='concrete',kind='building',extra=()):
        parts=[bounds]
        for cut in [*cuts,*extra]:parts=[p for a in parts for p in subtract(a,cut)]
        for p in parts:box(*p,style,kind)
    for b in [(0,0,0,80,23,3),(0,0,77,80,22,80),(0,0,3,4,25,77),(77,0,3,80,27,77)]:box(*b,'dark','boundary')
    masses=[(7,1,7,31,22,23),(30,1,31,52,27,47),(22,1,52,31,22,71),(49,1,47,56,20,71),(60,1,24,75,24,34),(5,1,31,9,18,62),(6,1,63,12,20,74)]
    for b in masses:mass(b,'facade')
    mass((57,1,35,75,14,70),'facade','atriumShell',[(58,1,36,74,13,69)])
    floor=[(3,-.35,3,77,1,77)]
    for cut in [(32,0,50,49,4,72),*cuts]:floor=[p for a in floor for p in subtract(a,cut)]
    for p in floor:box(*p,'road','floor')
    box(3,-.35,3,77,0,77,'road','floor')
    deck_cuts=[]
    for r in paths:
        for a,b in zip(r['points'],r['points'][1:]):
            if a[1]!=b[1]:
                h=r['width']/2+.18
                deck_cuts.append((min(a[0],b[0])-h,min(a[1],b[1]),min(a[2],b[2])-h,max(a[0],b[0])+h,max(a[1],b[1])+.1,max(a[2],b[2])+h))
    for b in [(7,4.65,28,21,5,40),(32,4.65,51,38,5,58),(59,4.65,40,64,5,68),(64,4.65,48,73,5,53),(32,8.65,8,59,9,24),(29,8.65,24,38,9,32)]:
        parts=[b]
        for cut in deck_cuts:parts=[p for a in parts for p in subtract(a,cut)]
        for p in parts:box(*p,'grate','deck')
    used=set()
    for r in paths:
        for a,b in zip(r['points'],r['points'][1:]):
            key=(tuple(sorted([a,b])),r['width'])
            if key in used:continue
            used.add(key);dx,dz=b[0]-a[0],b[2]-a[2];h=r['width']/2
            if a[1]==b[1]:
                box(min(a[0],b[0])-h,a[1]-.32,min(a[2],b[2])-h,max(a[0],b[0])+h,a[1],max(a[2],b[2])+h,'asphalt' if a[1]<=1 else ('wood' if r['id'] in ('U1','U3') else 'grate'),'routeFloor')
            else:
                axis='x' if dx else 'z';low,high=(a,b) if a[1]<b[1] else (b,a)
                direction=1 if (high[0]-low[0] if axis=='x' else high[2]-low[2])>0 else -1
                x0,x1=min(a[0],b[0]),max(a[0],b[0]);z0,z1=min(a[2],b[2]),max(a[2],b[2])
                if axis=='x':z0-=h;z1+=h
                else:x0-=h;x1+=h
                box(x0,low[1]-.32,z0,x1,high[1],z1,'rust' if r['id'].startswith('U') else 'grate','ramp',axis=axis,direction=direction,low=low[1],rise=high[1]-low[1],thickness=.32,route=r['id'])
    # Open precise stair footprints through every intersecting floor slab.
    ramps=[b for b in boxes if b['kind']=='ramp']
    floors=[b for b in boxes if b['kind'] in ('floor','deck','routeFloor')]
    for slab in floors:
        parts=[(slab['x']+40-slab['w']/2,slab['y'],slab['z']+40-slab['d']/2,slab['x']+40+slab['w']/2,slab['y']+slab['h'],slab['z']+40+slab['d']/2)]
        for r in ramps:
            if not r['low']+.01<slab['y']+slab['h']<=r['low']+r['rise']+.01:continue
            cut=(r['x']+40-r['w']/2,-1,r['z']+40-r['d']/2,r['x']+40+r['w']/2,40,r['z']+40+r['d']/2)
            parts=[p for a in parts for p in subtract(a,cut)]
        boxes.remove(slab)
        for p in parts:box(*p,slab['style'],slab['kind'])
    box(37.6,9,24,38,10.15,32,'metal','railing')
    props=[(39,0,59,42,2.4,64,'dark','subway'),(43,0,51,46,1.2,54,'metal','cover'),(58.5,1,54,60,12,55.5,'concrete','pillar'),(71.5,1,58,73,12,59.5,'concrete','pillar'),(37,9,14,40,11.8,22,'pale','train'),(48,9,14,51,11.8,17,'pale','train'),(5,1,42,8,2.1,46,'metal','stall'),(18.5,1,56,21,2.2,60,'metal','stall'),(5,1,54,8,2.4,58,'dark','dumpster')]
    for b in props:mass(b[:6],b[6],b[7])
    for x,z in [(5,34),(5,43),(5,53),(19,57)]:
        box(x,4.8,z,x+2.5,5,z+3,'magenta','neon',decor)
        for k in range(3):box(x,2.7+k*.45,z,x+1.2,2.9+k*.45,z+.18,'amber','slat',decor)
    for x,z,w,d,color in [(32,50,17,.08,'cyan'),(32,71.9,17,.08,'cyan'),(32,50,.08,22,'cyan'),(76.8,36,.08,32,'cyan'),(9,40,.08,20,'magenta'),(32,8,27,.1,'amber')]:box(x,1.02,z,x+w,1.08,z+d,color,'neon',decor)
    for x0,y0,z0,x1,y1,z1 in masses:
        for y in range(13,int(y1)-1,4):
            box(x0-.015,y,z0+.1,x0+.04,y+.35,z1-.1,'cyan' if x0>29 else 'magenta','window',decor)
            box(x0+.1,y,z1-.04,x1-.1,y+.35,z1+.015,'amber','window',decor)
        box(x0-.04,y1-.25,z0-.04,x1+.04,y1-.1,z1+.04,'metal','cornice',decor)
    for z0,z1 in [(40,42),(46,48),(54,61)]:
        mass((59,5,z0,59.15,5.9,z1),'glass','railing')
    box(31,14,7,60,14.4,24,'dark','stationRoof')
    for x,z in [(31,7),(59,8),(31,18),(59,23)]:box(x,9,z,x+.45,14,z+.45,'metal','column')
    for x in [33,38,43,48,53,58]:box(x,14.42,8,x+.12,14.5,24,'amber','neon',decor)
    box(46.4,0,56,47.6,.35,57.2,'dark','signBase')
    signs=[dict(text=t,x=x-40,y=y,z=z-40,w=w,h=h,color=c,zone=area) for t,x,y,z,w,h,c,area in [
        ('CITY / 04',47,3.4,56.6,3,1,'cyan','plaza'),('MARKET STREET',13,7.2,41,8,1.1,'magenta','market'),
        ('AXIOM OFFICES',65,10.4,69.1,9,1.4,'cyan','atrium'),('CENTRAL STATION',45,12.7,23.5,10,1.1,'amber','transit')]]
    # Utility units and food signage belong to the market facade, above movement space.
    for z in [34,44,54]:
        box(9.02,9,z,9.7,9.9,z+1.8,'metal','airConditioner',decor)
        for n in range(3):box(9.71,9.15+n*.2,z+.12,9.74,9.22+n*.2,z+1.68,'dark','vent',decor)
    signs.extend([dict(text='BENTO CAFE',x=-30.94,y=4,z=4,w=3,h=.65,color='amber',zone='market',rotationY=1.5707963267948966),
                  dict(text='NOODLE HOUSE',x=-30.94,y=4,z=14,w=3,h=.65,color='magenta',zone='market',rotationY=1.5707963267948966)])
    for i in range(16):
        x=-12+i*7;z=-12 if i%2 else 89;h=25+(i*7)%22
        box(x,0,z,x+5,h,z+7,'dark','skyline',decor,detail=True)
        box(x+.3,h-3,z+7.02,x+4.7,h-2.7,z+7.08,'cyan' if i%3 else 'magenta','skyline',decor,detail=True)
    # The details below are **visual only**.  Large solid counters, stalls and
    # pillars are already represented by coarse boxes above.  No pebble, pipe,
    # chair leg, cable or grating bolt is added to physics, preventing snags.
    def feature(kind,x,y,z,**data):
        features.append(dict(kind=kind,x=round(x-40,3),y=y,z=round(z-40,3),zone=zone(x,z),**data))
    # Lane lettering, crosswalks, pothole patches and drains; all decal-height.
    for z in (30,37,43,49,62,70):
        for x in (35,39,43,47,51):
            if (x+z)%3:box(x,1.006,z,x+.18,1.014,z+1.35,'pale','lane',decor,detail=True)
    for cx,cz in ((42,64),(45,51),(18,70),(54,31)):
        for i in range(7):
            box(cx-3+i*.9,1.005,cz,cx-2.55+i*.9,1.012,cz+1.45,'pale','crosswalk',decor)
    for x,z in ((12,47),(37,55),(68,43),(50,31),(22,65),(47,70)):
        feature('manhole',x,1.015,z)
    for x,z,dx,dz in ((18,66,1.1,.7),(42,56,1.7,.9),(69,39,1.3,1.2),(54,43,1.5,.6),(34,74,1.4,1.0)):
        feature('puddle',x,1.015,z,w=dx,d=dz)
    # Physically modelled curb ribbons, bevel-like tactile ridges, drain covers.
    for x,z,w,d in ((31.5,48,1.0,24),(56,34,.8,34),(10,35,.75,26),(32,73,21,.8),(31,29,26,.7)):
        box(x,1.015,z,x+w,1.19,z+d,'tile','curb',decor)
        box(x+.08,1.195,z+.1,x+w-.08,1.204,z+d-.1,'amber','curbStripe',decor,detail=True)
    # Shop bays: alternating ramen / electronic repair stalls, opened shutters,
    # displays, luminaires and bustling piles of supplies.
    for i,(x,z) in enumerate(((12,37),(12,44),(12,54),(18,66),(23,61),(7,48),(26,43),(26,56))):
        feature('shop',x,1,z,variant=i%3,rotation=1.57 if i%2 else 0)
        feature('crates',x+2.4,1,z+2.5,variant=i%3)
        feature('lantern',x+1,4.15,z+.5,color='amber' if i%2 else 'magenta')
        feature('vending',x-1.9,1,z+2.65,variant=i%3)
        if i%2==0:feature('ventSteam',x+2.7,1,z+1.8)
    for x,z in ((12,48),(22,65),(28,46),(9,60)):
        feature('stools',x,1,z)
    for x,z in ((6,37),(8,60),(29,63),(38,68),(53,70),(72,53),(59,37),(51,27)):
        feature('streetlamp',x,1,z,color='cyan' if int(x)%2 else 'amber')
    for x,z in ((8,34),(19,56),(36,60),(51,72),(73,39),(60,65),(31,21)):
        feature('trash',x,1,z)
    for x,z in ((5,43),(29,52),(55,43),(70,36),(43,22)):
        feature('duct',x,3.3,z)
    box(58.1,1.017,36.1,74,1.047,69,'tile','lobbyFloor',decor)
    # I2 corporate glass atrium: lobby with coherent reception and seating.
    feature('reception',70,1,63)
    for x,z in ((65,61),(69,58),(72,50)):feature('sofa',x,1,z)
    for x,z in ((60,67),(72,66),(60,43)):feature('planter',x,1,z)
    feature('logo',70,5.1,68,text='AXIOM / CORE')
    for x,z in ((61,45),(67,57),(72,46),(60,61)):
        feature('floorLight',x,1.02,z)
    # I3/I4 interiors are maintenance workshops / operations corridors.
    for x,z in ((19,20),(23,27),(66,21),(69,28),(59,27)):
        feature('workbench',x,1,z)
    for x,z in ((23,19),(69,22),(59,31)):
        feature('serverRack',x,1,z)
    # Transit rail car: benches and safe overhead handrails, ticket machines.
    for x in (38,42,47,52,56):
        feature('trainSeat',x,9.1,17.8)
        feature('trainSeat',x,9.1,21.0)
        feature('handrail',x,9.1,19.5)
    for x,z in ((34,22),(54,23),(59,16)):
        feature('ticket',x,9,z)
    # Elevated route dressing: steel brackets and actual individual wood slats.
    # They visually follow route height; physics remains a continuous ramp.
    for r in routes:
        if not r['id'].startswith('U'):continue
        for a,b in zip(r['points'],r['points'][1:]):
            length=((b[0]-a[0])**2+(b[2]-a[2])**2)**.5
            if not length:continue
            for i in range(max(1,int(length/.85))):
                t=(i+.5)/max(1,int(length/.85))
                x=a[0]+(b[0]-a[0])*t;z=a[2]+(b[2]-a[2])*t
                y=a[1]+(b[1]-a[1])*t
                feature('plankBolt',x,y,z,axis='x' if abs(b[0]-a[0])>abs(b[2]-a[2]) else 'z',variant=i%3)
    # Cable spans are decorative and deliberately placed above headroom.
    for x1,z1,x2,z2,y in ((8,42,34,42,12),(13,58,34,58,11),(33,68,57,68,13),
                           (8,33,40,33,17),(55,42,75,42,15),(25,22,58,22,19),
                           (10,64,37,64,14),(38,29,67,29,18)):
        feature('cable',(x1+x2)/2,y,(z1+z2)/2,dx=x2-x1,dz=z2-z1)
    for x,z,y in ((23,32,11),(40,70,12),(72,41,9),(17,38,9),(50,25,14)):
        feature('billboard',x,y,z,color='cyan' if int(x)%2 else 'magenta')
    for x,z in ((11,40),(58,48),(68,38),(38,14),(34,62),(55,71)):
        feature('pipeduct',x,7,z)
    zones=[dict(id='market',name='MARKET STREET',x=-24,y=1,z=6,w=25,d=39,color=PALETTE['magenta']),dict(id='plaza',name='CENTRAL PLAZA',x=.5,y=0,z=22,w=23,d=27,color=PALETTE['cyan']),dict(id='atrium',name='BUSINESS DISTRICT',x=25,y=1,z=12,w=23,d=35,color=PALETTE['glass']),dict(id='transit',name='CENTRAL STATION',x=4,y=9,z=-23,w=33,d=29,color=PALETTE['amber'])]
    for r in paths:r['points']=[[x-40,y,z-40] for x,y,z in r['points']]
    spawns=[(15,1,58),(17,1,35),(40,0,68),(37,0,52),(64,1,61),(71,1,41),(34,9,12),(51,9,21)]
    return dict(id='cyberpunk',name='Daybreak City',revision='02.5',theme='modern-daylight',size=80,palette=PALETTE,boxes=boxes,decor=decor,features=features,signs=signs,zones=zones,routes=routes,stairs=stairs,spawns=[[x-40,y,z-40] for x,y,z in spawns],practiceTargets=[[-24,1,4],[25,1,0]],weapons=weapons,clearance=4.2)

def guide(m):
    items=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1040" viewBox="0 0 1280 1040"><rect width="1280" height="1040" fill="#101923"/>','<g font-family="Arial" fill="#e8f7ff"><text x="45" y="48" font-size="28" font-weight="bold">CROSSFIRE 02.5 / CYBERPUNK CITY</text><text x="45" y="76" font-size="15">80 × 80 m · North ↑ · Street 1 m / Plaza 0 m / Canopies 5 m / Transit 9 m</text></g><rect x="45" y="110" width="800" height="800" fill="#293444"/>']
    def px(x):return 45+(x+40)*10
    def pz(z):return 110+(z+40)*10
    for b in m['boxes']:
        if b['kind'] not in ('building','boundary','atriumShell','subway','train'):continue
        items.append(f'<rect x="{px(b["x"]-b["w"]/2):.1f}" y="{pz(b["z"]-b["d"]/2):.1f}" width="{b["w"]*10:.1f}" height="{b["d"]*10:.1f}" fill="#101923" stroke="#465569" stroke-width=".5"/>')
    for i,r in enumerate(m['routes']):
        pts=' '.join(f'{px(x):.1f},{pz(z):.1f}' for x,y,z in r['points']);col={'G':'#40dee7','I':'#ff60aa','U':'#ffc35c'}[r['id'][0]];dash={'G':'','I':' stroke-dasharray="7 4"','U':' stroke-dasharray="2 4"'}[r['id'][0]]
        items.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="4" stroke-linejoin="round"{dash}/>')
        x,y,z=r['points'][len(r['points'])//2]
        items.append(f'<circle cx="{px(x)}" cy="{pz(z)}" r="13" fill="#101923"/><text x="{px(x)}" y="{pz(z)+4}" text-anchor="middle" fill="{col}" font-family="Arial" font-size="11">{r["id"]}</text>')
        yy=145+i*51
        items.append(f'<g fill="{col}" font-family="Arial"><text x="875" y="{yy}" font-size="15" font-weight="bold">{r["id"]} / {escape(r["name"])}</text><text x="875" y="{yy+19}" font-size="12">{r["fromZone"].title()} ↔ {r["toZone"].title()} · {r["width"]} m wide</text></g>')
    for z in m['zones']:items.append(f'<text x="{px(z["x"])}" y="{pz(z["z"])}" text-anchor="middle" fill="white" stroke="#101923" stroke-width="4" paint-order="stroke" font-family="Arial" font-size="14" font-weight="bold">{z["name"]}</text>')
    for x,y,z in m['spawns']:items.append(f'<circle cx="{px(x)}" cy="{pz(z)}" r="5" fill="white"/>')
    items.append('<g fill="#c4d7e9" font-family="Arial" font-size="15"><text x="45" y="951">Solid cyan: streets · Dashed pink: interiors · Dotted amber: upper routes · White dots: spawns</text><text x="45" y="979">Tall buildings separate districts. Ramps are continuous collision surfaces; no jump is required to rotate.</text></g></svg>')
    return '\n'.join(items)+'\n'
