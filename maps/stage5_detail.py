"""CROSSFIRE Stage 5: purpose-driven architectural visual geometry.

This is a NON-COLLIDING aesthetic overlay for the *actual* Stage 4 greybox.
No combat, movement, matchmaking or networking changes are made.

Authored X/Z in 0..80; engine world X/Z = authored minus 40.
Stage 4 `boxes`, routes, stairs, spawns and navigation metadata are immutable.
The public gateway panels avoid the Stage 4 physical corridor openings.
"""
from __future__ import annotations
import copy
import json
import math
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent
QUALITY_TIERS = {'performance':0, 'high':1, 'ultra':2}
# Only renderer-known styles used in `decor`; material intent lives in `finish`.
KNOWN_STYLES = {'concrete','dark','road','metal','facade','glass','cyan','magenta','amber',
                'rust','wood','grate','tile','asphalt'}

FINISH = {
  'masonry':'#626c78', 'masonry_dark':'#414b57', 'oxidized':'#8b5756',
  'iron':'#536574','frame':'#213041','glass_unlit':'#1d3a52',
  'glass_office':'#35758d','glass_warm':'#c39862', 'glass_teal':'#4eb5ac',
  'glass_pink':'#ad6296','concrete':'#89929d','light_metal':'#9ba9b6',
  'plaza':'#758694','platform':'#536875','tactile':'#e2ae56','awning':'#755465',
  'awning_gold':'#ba7755','pipe':'#4c676d','light':'#a9d4d6','lamp':'#f5c17e',
  'shadow':'#182632', 'tile':'#667f8a', 'rust':'#8a5653',
}
# IMPORTANT: building identities and authored footprints are read from Stage 4.
FAMILY = {
 'M01':'market', 'M02':'market', 'M03':'market', 'M04':'market',
 'C01':'exchange', 'P02':'gallery', 'A01':'axiom',
 'T02':'transit', 'T03':'transit', 'T04':'transit'
}

class Detailer:
    def __init__(self, base):
        self.map=base
        self.parts=[]
        self.signs=[]
        self.totals=Counter()
        self.occupancy=[b for b in base['boxes'] if b['kind'] in ('building','atriumShell')]
        self.cuts=base['stage4']['portal_cuts']
        self.notices=[]

    def add(self, bounds, kind, building, *, finish='iron', style='metal', tier=0,
            note=None, exact_id=None):
        x0,y0,z0,x1,y1,z1=[float(v) for v in bounds]
        if not (0<=x0<x1<=80 and 0<=z0<z1<=80 and -0.5<=y0<y1<=34):
            raise ValueError((building,kind,bounds))
        if style not in KNOWN_STYLES:raise ValueError('Unsupported material style: '+style)
        idx=len(self.parts)+1
        v=dict(x=round((x0+x1)/2-40,4),y=round(y0,4),z=round((z0+z1)/2-40,4),
            w=round(x1-x0,4),h=round(y1-y0,4),d=round(z1-z0,4),
            style=style,kind='architectureDetail',detailKind=kind,
            detailId=exact_id or f'D5-{idx:05d}',buildingId=building,
            finish=finish,qualityTier=tier,stage5VisualOnly=True)
        if note:v['annotation']=note
        self.parts.append(v)
        self.totals[kind]+=1
        return v

    def shell(self,building,x,y,z):
        # Only issue facade panels where the solid shell genuinely exists.
        return any(
           b.get('structure')==building and
           abs((x-40)-b['x'])<b['w']/2+.04 and abs((z-40)-b['z'])<b['d']/2+.04 and
           b['y']<y<b['y']+b['h'] for b in self.occupancy
        )

    def passage(self,x,y,z):
        for v in self.cuts:
            a,b,c,d,e,f=v['bounds']
            if a-.03<=x<=d+.03 and b-.02<=y<=e+.02 and c-.03<=z<=f+.03:
                return True
        return False

    def surface(self, bid,face,coordinate,y,width,thickness=.05):
        x0,z0,x1,z1=self.plan[bid]['footprint']
        if face=='W':return (x0-thickness,y,coordinate-width/2,x0,y+1,coordinate+width/2)
        if face=='E':return (x1,y,coordinate-width/2,x1+thickness,y+1,coordinate+width/2)
        if face=='N':return (coordinate-width/2,y,z0-thickness,coordinate+width/2,y+1,z0)
        return (coordinate-width/2,y,z1,coordinate+width/2,y+1,z1+thickness)

    def facade_panel(self,bid,face,at,low,high,wide,kind,finish,style='glass',tier=0,
                     thickness=.09):
        x0,z0,x1,z1=self.plan[bid]['footprint']
        if face in ('W','E'):
            x=x0 if face=='W' else x1
            z=at
            center=(x, (low+high)/2, z)
            bounds=(x0-thickness if face=='W' else x1,low,z-wide/2,
                    x0 if face=='W' else x1+thickness,high,z+wide/2)
        else:
            z=z0 if face=='N' else z1
            x=at
            center=(x,(low+high)/2,z)
            bounds=(x-wide/2,low,z0-thickness if face=='N' else z1,
                    x+wide/2,high,z0 if face=='N' else z1+thickness)
        if not self.shell(bid,*center):return False
        # Visual portals need to remain genuinely visually open.
        if self.passage(*center):return False
        self.add(bounds,kind,bid,finish=finish,style=style,tier=tier)
        return True

    def facade(self,b):
        bid=b['id'];family=FAMILY.get(bid)
        if not family:return
        x0,z0,x1,z1=b['footprint'];roof=b['visual_roof_y']
        if roof is None or roof<8:return
        for face,start,end in (('N',x0,x1),('S',x0,x1),('W',z0,z1),('E',z0,z1)):
            length=end-start
            if length<2.0:continue
            # 3m bays are realistic storefront/office glazing modules.
            bays=max(1,int(length/3.15));step=length/bays
            for i in range(bays):
                at=start+(i+.5)*step
                # The base panel is visible at +1, but a *real* opening must
                # not be covered by fictional glazing.
                roof_floor=int((roof-2.15-1.0)//4.0)
                for floor in range(max(0,roof_floor+1)):
                    panel_low=1.84+floor*4.0
                    if panel_low+1.65>roof-.45:continue
                    if family=='market':
                        # Older housing: small irregular windows, warmer glass.
                        wide=min(1.45,step*.55)
                        finish='glass_warm' if (i+floor)%5 in (0,3) else 'glass_unlit'
                        style='amber' if finish=='glass_warm' else 'glass'
                    elif family=='axiom':
                        wide=min(2.65,step*.86)
                        finish='glass_office' if (i+floor)%4 else 'glass_teal'
                        style='glass'
                    elif family=='exchange':
                        wide=min(1.8,step*.65)
                        finish='glass_unlit' if (i+floor)%3 else 'glass_warm'
                        style='glass'
                    elif family=='gallery':
                        wide=min(1.9,step*.72)
                        finish='glass_teal' if (i+floor)%4 else 'glass_pink'
                        style='glass'
                    else:
                        wide=min(1.55,step*.6)
                        finish='glass_unlit' if (i+floor)%4 else 'glass_office'
                        style='glass'
                    low=panel_low;high=panel_low+(2.25 if family=='axiom' else 1.55)
                    if high>roof-.5:continue
                    # Architectural mask: opaque surround is part of the same
                    # decorative layer, never a collider/door.
                    if not self.facade_panel(bid,face,at,low,high,wide,
                                             'window-glazing',finish,style,(0 if (i+floor)%3==0 else 1)):continue
                    self.facade_panel(bid,face,at,low-.10,low+.03,wide+.17,
                                      'window-sill','frame','dark',2,.12)
                    self.facade_panel(bid,face,at,high-.02,high+.12,wide+.18,
                                      'window-head','iron','metal',(1 if i%2==0 else 2),.12)
                    # Narrow vertical divisions add depth on ultra.
                    if family in ('axiom','gallery'):
                        self.facade_panel(bid,face,at,low,high,.10,
                                          'window-mullion','light_metal','metal',2,.14)
            # Vertical fins/pilasters break up rectangular silhouettes.
            pilasters=range(1,bays)
            for i in pilasters:
                at=start+i*step
                if family=='market' and i%2:continue
                self.facade_panel(bid,face,at,5.0,roof-.3,.14,
                                  'facade-pilaster','oxidized' if family=='market' else 'frame',
                                  'rust' if family=='market' else 'metal',1,.13)
            # The spandrel creates credible reading of storeys, even when
            # a floor is not accessible to the player.
            for j,level in enumerate(range(5,int(roof),4)):
                low=level-.13
                self.facade_panel(bid,face,(start+end)/2,low,low+.20,length-.22,
                                  'floor-spandrel','oxidized' if family=='market' else 'light_metal',
                                  'rust' if family=='market' else 'metal',0,.11)

    def roof(self,b):
        bid=b['id'];roof=b['visual_roof_y']
        if roof is None or roof<=9 or bid in ('T05','T06'):return
        x0,z0,x1,z1=b['footprint']
        # No ghost parapets on walkable +5m / +9m decks. These roof assets
        # are only placed on intentionally inaccessible upper mass roofs.
        y=roof+.08
        if x1-x0>4 and z1-z0>4:
            for r in ((x0+.35,y,z0+.35,x1-.35,y+.38,z0+.53),
                      (x0+.35,y,z1-.53,x1-.35,y+.38,z1-.35),
                      (x0+.35,y,z0+.53,x0+.53,y+.38,z1-.53),
                      (x1-.53,y,z0+.53,x1-.35,y+.38,z1-.53)):
                self.add(r,'roof-parapet',bid,finish='masonry_dark',style='concrete',tier=0)
        if (x1-x0)>=7 and (z1-z0)>=6:
            # Small rooftop units, connected to vents and on real roofs.
            for i in range(2 if bid in ('C01','A01') else 1):
                cx=x0+2.5+i*3.0; cz=z0+2.5
                if cx+1.8>=x1-1:continue
                self.add((cx,y,cz,cx+1.7,y+1.1,cz+1.5),'rooftop-hvac',bid,
                         finish='iron',style='metal',tier=1)
                self.add((cx+.12,y+1.10,cz+.18,cx+1.58,y+1.14,cz+1.32),'hvac-fan-cover',bid,
                         finish='shadow',style='dark',tier=2)
                self.add((cx+.45,y+1.14,cz+.45,cx+1.25,y+1.18,cz+1.05),'hvac-grille',bid,
                         finish='light_metal',style='grate',tier=2)

    def service_risers(self,b):
        bid=b['id'];roof=b['visual_roof_y']
        if roof is None or roof<10 or bid not in FAMILY:return
        x0,z0,x1,z1=b['footprint']
        if x1-x0<=5:return
        # Vertical pipes are flush against a solid side wall, not hovering.
        x=x1-.85;z=z1+.11
        if self.shell(bid,x,7,z1):
            self.add((x-.055,4.7,z-.09,x+.055,roof-.45,z+.03),'service-riser',bid,
                     finish='pipe',style='metal',tier=1)
            for yy in range(7,int(roof),4):
                self.add((x-.18,yy-.12,z-.12,x+.18,yy+.08,z+.06),'riser-bracket',bid,
                         finish='iron',style='rust',tier=2)

    def gateway(self, key,bid, axis,outer,lo,hi,bottom=1,top=4.65):
        # Gateway outer side frames sit beyond the walkable opening; the
        # lintel is above the 2.6m required clearance.
        if axis=='x':
            z=outer; rail=(.18 if bid=='M03' else .22)
            for x in (lo-.28,hi+.09):
                self.add((x,bottom,z-.19,x+rail,top+.08,z+.19),'portal-pier',bid,
                         finish='light_metal',style='metal',tier=0)
            self.add((lo-.32,top,z-.19,hi+.32,top+.25,z+.19),
                     'portal-lintel',bid,finish='iron',style='metal',tier=0)
        else:
            x=outer; rail=.22
            for z in (lo-.28,hi+.09):
                self.add((x-.18,bottom,z,x+.18,top+.08,z+rail),'portal-pier',bid,
                         finish='light_metal',style='metal',tier=0)
            self.add((x-.18,top,lo-.32,x+.18,top+.25,hi+.32),
                     'portal-lintel',bid,finish='iron',style='metal',tier=0)
        self.totals['formal-entrances']+=1

    def landmark_portals(self):
        # All dimensions are derived from Stage 4's explicit cut register.
        # Entrance signage doesn't form an invisible solid wall across doors.
        self.gateway('exchange-north','C01','x',30.7,39.65,44.35)
        self.gateway('exchange-south','C01','x',47.6,39.65,44.35)
        self.gateway('market-repair','M03','z',21.90,53.25,57.15,top=4.60)
        self.gateway('axiom-service','A01','x',35.0,56.40,75.30,top=4.55)
        # Text geometry is optional for the live renderer. Our inspector builds
        # actual CanvasTexture labels from this structured anchor data.
        self.signs.extend([
          dict(id='SIG-EX-N',text='CENTRAL EXCHANGE',x=2.0,y=4.35,z=-9.45,face='north',district='exchange'),
          dict(id='SIG-EX-S',text='EXCHANGE / PLAZA',x=2.0,y=4.35,z=7.76,face='south',district='exchange'),
          dict(id='SIG-M03',text='REPAIR ARCADE',x=-18.25,y=4.32,z=15.1,face='west',district='market'),
          dict(id='SIG-AX',text='AXIOM TECH',x=26.0,y=4.35,z=-5.18,face='north',district='axiom'),
          dict(id='SIG-T01',text='TRANSIT DECK',x=2.5,y=12.7,z=-15.35,face='south',district='transit'),
          dict(id='SIG-PLAZA',text='NEON PLAZA',x=2.0,y=4.9,z=10.3,face='south',district='plaza'),
        ])

    def market_awning(self):
        # Canopies below +5m and above +1m, outside main shop-through portals.
        for k,(x0,x1,z) in enumerate([(5.20,8.80,38),(5.20,8.80,48),
                                      (6.2,11.8,68),(22.3,27.3,67)]):
            y=4.24
            self.add((x0,y,z-.80,x1,y+.11,z+.8),'shop-awning', 'M01' if k<2 else ('M02' if k==2 else 'M03'),
                     finish='awning_gold' if k%2 else 'awning',style='rust' if k%2 else 'magenta',tier=1)
            self.add((x0,y-.13,z-.83,x1,y,z-.76),'awning-edge', 'M01' if k<2 else 'M03',
                     finish='light_metal',style='metal',tier=2)

    def transit_details(self):
        # Passenger platform y=9; these beams start above >=3m headroom.
        for x in (32,37,42,47,52,57):
            self.add((x-.10,12.40,21.13,x+.10,13.08,24.68),
                     'station-canopy-rib','T01',finish='iron',style='metal',tier=0)
        for z in (21.33,24.40):
            self.add((31.2,12.95,z-.09,58.8,13.16,z+.09),'station-roof-edge',
                     'T01',finish='light_metal',style='metal',tier=0)
        # Edge warning is a flat visual strip, not a blocking prop.
        self.add((30.8,9.006,21.17,59.5,9.025,21.41),'platform-tactile-line','T01',
                 finish='tactile',style='amber',tier=0)
        for x in (34,42,50,58):
            self.add((x,12.75,23.9,x+1.8,12.83,24.45),'station-wayfinding','T01',
                     finish='glass_teal',style='cyan',tier=1)
        # Structural joint caps for the existing actual rail supports.
        for x in (9,19,30,44,58,69):
            for z in (14.2,20.5):
                self.add((x-.27,8.43,z-.27,x+.27,8.70,z+.27),
                         'support-cap','T01',finish='concrete',style='concrete',tier=1)

    def plaza_details(self):
        # Recessed plaza: markings are flat decals, never ghost walls.
        for x in [34,38,42,46]:
            self.add((x-.09,.004,56,x+.09,.018,68),'plaza-paving-joint','P01',
                     finish='plaza',style='tile',tier=2)
        for z in [53,58,63,68]:
            self.add((34,.004,z-.07,47,.018,z+.07),'plaza-paving-joint','P01',
                     finish='plaza',style='tile',tier=2)
        # Legible wayfinding panel outside the central arcade opening.
        self.add((35,1.02,48.18,39,1.045,48.39),'arcade-direction-strip',
                 'P01',finish='tactile',style='amber',tier=0)

    def wall_grilles(self):
        # Coherent service hardware on industrial elevations, not everywhere.
        for bid in ('T02','T03','T04','M03'):
            b=self.plan[bid];x0,z0,x1,z1=b['footprint']
            x=x0+min(2.25,(x1-x0)/2)
            y=min(6.3,(b['visual_roof_y'] or 9)-1.3)
            self.facade_panel(bid,'N',x,y-.3,y+.35,min(1.0,(x1-x0)/3),
                              'vent-louvre','iron','grate',1,.16)
            self.facade_panel(bid,'N',x,y-.17,y-.11,.8,'vent-slat','light_metal','metal',2,.18)
            self.facade_panel(bid,'N',x,y-.02,y+.04,.8,'vent-slat','light_metal','metal',2,.18)
            self.facade_panel(bid,'N',x,y+.13,y+.19,.8,'vent-slat','light_metal','metal',2,.18)

    def streets(self):
        # Paint flush to the EXISTING +1 road slab. No street furniture that
        # a player could walk through before authoritative collisions exist.
        for z in (29.6,74.85):
            for x in range(14,72,5):
                # Only apply markings where space is open at 1.5m.
                if any(b['kind'] in ('building','atriumShell') and
                       abs(x-40-b['x'])<b['w']/2 and
                       abs(z-40-b['z'])<b['d']/2 and
                       b['y']<=1.4<=b['y']+b['h'] for b in self.occupancy):continue
                self.add((x,1.004,z-.045,x+2.2,1.019,z+.045),
                         'road-center-mark','PUBLIC',finish='light_metal',style='tile',tier=2)


    def interior_architecture(self):
        # The Central Exchange passage is an actual Stage 4 cutout. These
        # architectural cues sit ALONG its sides or above clearance, never
        # across the walkable arcade.
        for x in (39.76,44.18):
            self.add((x-.08,4.16,31.15,x+.08,4.33,47.15),
                     'arcade-ceiling-conduit','C01',finish='pipe',style='metal',tier=1)
            for z in (33.5,37.5,41.5,45.5):
                self.add((x-.12,3.81,z-.32,x+.12,3.96,z+.32),
                         'arcade-wall-sconce','C01',finish='lamp',style='amber',tier=1)
        for z in (33,38,43):
            self.add((40.85,4.38,z-.09,43.15,4.48,z+.09),
                     'arcade-ceiling-light','C01',finish='light',style='cyan',tier=0)
        # Repair arcade: suspended fixtures and a service raceway, not
        # decorative crates that the player could ghost through.
        for x in (23.5,26,29):
            self.add((x-.07,4.14,54.3,x+.07,4.23,56.4),
                     'market-arcade-luminaire','M03',finish='lamp',style='amber',tier=0)
        # Axiom lobby is double height; upper luminaires read as genuine
        # infrastructure, not floating neon accents.
        for z in (44,51,58,65):
            self.add((60.3,10.4,z-.07,71.7,10.57,z+.07),
                     'atrium-structural-light','A01',finish='glass_teal',style='cyan',tier=1)
        # Lintels and signage above player clearance at the two station stairs.
        for x in (36.5,51.0):
            self.add((x-2.4,10.85,28.5,x+2.4,11.13,28.72),
                     'station-stair-sign-band','T01',finish='iron',style='metal',tier=1)

    def fixed_signboards(self):
        # Legible area identity without erecting collisionless free-standing
        # props. These boards are mounted above 3m height.
        board_specs=[
          ('C01',(40.05,4.12,30.49,43.95,4.53,30.63),'glass_teal','cyan'),
          ('C01',(40.05,4.12,47.68,43.95,4.53,47.83),'glass_teal','cyan'),
          ('M03',(21.67,4.09,53.55,21.80,4.54,56.85),'glass_pink','magenta'),
          ('A01',(62,4.15,34.72,70,4.53,34.87),'glass_teal','cyan'),
          ('T01',(37.5,12.42,24.55,47.5,12.85,24.69),'glass_teal','cyan'),
        ]
        for bid,b,finish,style in board_specs:
            self.add(b,'mounted-sign-box',bid,finish=finish,style=style,tier=0)

    def build(self):
        self.plan={b['id']:b for b in json.loads((ROOT/'stage4_buildings.json').read_text())['buildings']}
        for bid,b in self.plan.items():
            self.facade(b);self.roof(b);self.service_risers(b)
        self.landmark_portals();self.market_awning();self.transit_details()
        self.plaza_details();self.wall_grilles();self.streets()
        self.interior_architecture();self.fixed_signboards()
        return self


def overlay(base,quality='high'):
    """Apply decoration only, never Stage 4 physical changes."""
    if quality not in QUALITY_TIERS:raise ValueError('quality must be performance/high/ultra')
    if 'stage4' not in base:raise ValueError('Stage 5 requires the Stage 4 greybox first')
    d=Detailer(base).build()
    selected=[copy.deepcopy(b) for b in d.parts if b['qualityTier']<=QUALITY_TIERS[quality]]
    out=copy.deepcopy(base)
    olddecor=copy.deepcopy(out.get('decor',[]))
    out.update(revision='02.6-stage5-architectural-detail-'+quality,
               decor=olddecor+selected)
    out['stage5']={
       'status':'EXPERIMENTAL / NOT IN-ENGINE CERTIFIED',
       'principle':'purpose-driven architectural detail; Stage 4 collisions unchanged',
       'quality':quality, 'physical_boxes_unchanged':True,
       'layer_collidable':False,
       'base_stage4_decor_count':len(olddecor),
       'new_decor_count':len(selected),
       'detail_category_counts':dict(Counter(v['detailKind'] for v in selected)),
       'buildings_detailed':sorted({v['buildingId'] for v in selected}),
       'signage':d.signs,
       'material_finishes':FINISH,
       'remaining_work':[
           'in-engine world.js material/render compatibility audit',
           'map navigation and character physics regression suite',
           'portal-width and full collision-capsule sweep',
           'optional text-sign renderer integration',
           'ghost prop policy before making any street prop collision-bearing',
           'performance profiling on target Windows devices'],
    }
    return out