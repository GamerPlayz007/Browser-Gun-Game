"""CROSSFIRE Phase 1 / Stage 6 — authored city expansion candidate.

Preserves the Stage 4/5 *inner game* geometry (except four tall boundary walls),
then adds an 120m physical urban envelope and 160m noncolliding city context.
New routes are stage6 navigation metadata, NOT extra 'G'/'I'/'U' legacy routes.

This is intentionally experimental. Collision and renderer integration must be
verified in real Browser-Gun-Game after generating from the current repository.
"""
from __future__ import annotations
import copy, math
from collections import Counter
from maps.stage4_greybox import subtract

ACTIVE=60.0
CONTEXT=80.0
# World coordinates; floor y=1 for expansion, streets roughly 6-7m wide.
GATES=[
 dict(id='W-N',side='west',at=-20,width=7.2,sector='Market Works',purpose='retail service entrance'),
 dict(id='W-S',side='west',at=30,width=7.2,sector='Market Works',purpose='mixed-use residential street'),
 dict(id='N-W',side='north',at=-19,width=7.2,sector='North Rail Quarter',purpose='rail station service entrance'),
 dict(id='N-E',side='north',at=24,width=7.2,sector='North Rail Quarter',purpose='station drop-off access'),
 dict(id='E-N',side='east',at=-27,width=7.2,sector='Axiom Service District',purpose='industrial entrance'),
 dict(id='E-S',side='east',at=-3,width=7.2,sector='Axiom Service District',purpose='corporate operations exit'),
 dict(id='S-W',side='south',at=-21,width=7.2,sector='South Civic Frontage',purpose='market-side road'),
 dict(id='S-E',side='south',at=8,width=7.2,sector='South Civic Frontage',purpose='plaza public street'),
]

# Unconventional loops, but each is a logical urban circulation route, not a
# random tunneling corridor. Each begins and ends inside the original 80m core.
STREETS=[
 dict(id='SX-W',name='Market Backstreet',kind='service street',width=6.2,use='deliveries and service access',
      points=[(-33,-20),(-50,-20),(-50,30),(-35.2,30)],sector='Market Works'),
 dict(id='SX-N',name='Rail Quarter Circuit',kind='public/service street',width=6.2,use='station servicing and secondary public access',
      points=[(-19,-34.5),(-19,-47),(24,-47),(24,-33)],sector='North Rail Quarter'),
 dict(id='SX-E',name='Axiom Operations Lane',kind='corporate service street',width=6.2,use='service doors and utilities',
      points=[(33,-27),(49,-27),(49,-3),(33,-3)],sector='Axiom Service District',
      entrance_neck_width_m=3.2,entrance_neck_note='Existing Axiom shell narrows the final approach near x=33-36'),
 dict(id='SX-S',name='Civic Crescent',kind='pedestrian-priority street',width=6.2,use='public shopfront and civic access',
      points=[(-21,33),(-21,49),(8,49),(8,33)],sector='South Civic Frontage'),
]
# Purposeful secondary circuits, following physical corners rather than
# single ultra-long lines; diagonal changes are made on rectilinear streets.
CONNECTORS=[
 dict(id='SX-NW',name='Freight-to-Station Link',kind='service alley',width=3.8,
      points=[(-50,-20),(-50,-47),(-19,-47)],sector='Market Works',use='connects rail servicing with the old market'),
]

# Ground footprints of the playable-adjacent structures. Purpose and architectural
# family are authored, so outside buildings don't all become rectangular towers.
PARCELS=[
 ('W01','Market back-of-house',(-57,-45,-53,-30),12,'market','rear delivery and waste handling'),
 ('W02','Housing above repair stalls',(-57,-17,-54,4),16,'market','mixed residential/commercial'),
 ('W03','Market cold storage',(-57,10,-54,23),10,'industrial','delivery and local storage'),
 ('W04','West corner housing',(-57,37,-53,56),18,'market','apartment block and retail'),
 ('W05','Old tram office',(-44,-35,-40,-29),11,'industrial','transit administration'),
 ('W06','Market service hall',(-45,-12,-40,14),13,'market','repair workrooms'),
 ('W07','West cafe frontage',(-45,37,-40,54),9,'market','street-facing shops'),
 ('N01','Rail utility substation',(-53,-57,-25,-53),12,'industrial','power and railway signalling'),
 ('N02','Station west hotel',(-11,-57,14,-54),22,'transit','short-stay accommodation'),
 ('N03','Terminal office annex',(31,-57,56,-53),17,'transit','rail staff offices'),
 ('N04','Northwest utilities',(-36,-43,-27,-40),11,'industrial','distribution cabinet and service room'),
 ('N05','Northeast car park',(32,-43,57,-40),13,'transit','station parking deck'),
 ('E01','Axiom data service', (54,-51,57,-34),17,'corporate','cooling and data equipment'),
 ('E02','Axiom maintenance', (54,-20,57,-10),11,'industrial','maintenance storage'),
 ('E03','Operations loading', (54,5,57,27),14,'corporate','corporate deliveries'),
 ('E04','Corporate housing', (54,35,57,56),19,'corporate','staff accommodation'),
 ('E05','Ventilation plant', (40,-18,45,-10),12,'industrial','district mechanical plant'),
 ('E06','Axiom south annex', (40,3,45,28),14,'corporate','offices and technical services'),
 ('E07','Eastern commercial wing',(40,35,45,55),13,'corporate','retail and shared offices'),
 ('S01','Civic shops west',(-56,54,-31,57),12,'civic','pedestrian shopping street'),
 ('S02','Civic art offices',(-14,54,2,57),16,'civic','community offices and gallery'),
 ('S03','Axiom guest wing',(17,54,55,57),20,'corporate','visitor services'),
 ('S04','West streetfront retail',(-38,40,-29,45),9,'market','street-facing shops'),
 ('S05','Plaza pedestrian kiosk',(-8,40,0,45),8,'civic','information and cafe'),
 ('S06','Southern office frontage',(18,40,36,45),13,'corporate','offices over retail'),
]

# Context buildings beyond actual gameplay limits, 160x160 urban setting.
CONTEXT_PARCELS=[
 ('CW01N','Old Housing West, upper block',(-78,-47,-64,-30),21,'market'),
 ('CW01S','Old Housing West, southern wing',(-78,-15,-64,-8),15,'market'),
 ('CW02','Warehouse Conversions',(-78,-7,-65,22),15,'industrial'),
 ('CW03','Market Apartment Row',(-78,29,-64,57),24,'market'),
 ('CW04','West Corner Housing',(-78,65,-64,78),19,'market'),
 ('CN01','Rail Depot West',(-77,-78,-53,-64),14,'industrial'),
 ('CN02','Freight Station',(-45,-78,-18,-64),18,'transit'),
 ('CN03','Hotel and Residential',(-10,-78,13,-64),25,'transit'),
 ('CN04','Operations Offices',(22,-78,49,-64),21,'transit'),
 ('CN05','Station Garage',(56,-78,78,-64),15,'industrial'),
 ('CE01','Axiom Regional Tower',(65,-54,78,-26),34,'corporate'),
 ('CE02','Server Annex',(65,-19,78,8),22,'corporate'),
 ('CE03','Mixed-Use Corporate Block',(65,17,78,50),29,'corporate'),
 ('CE04','East Residential',(65,65,78,78),23,'civic'),
 ('CS01','Civic Market South',(-53,65,-29,78),17,'market'),
 ('CS02','City Hall Annex',(-21,65,3,78),21,'civic'),
 ('CS03','Commercial South',(11,65,37,78),26,'corporate'),
 ('CS04','Transit South',(46,65,61,78),18,'transit'),
]

FINISHES={'market':'facade','corporate':'glass','industrial':'concrete','transit':'metal','civic':'tile'}
COLORS={'market':'#b69d8c','industrial':'#a8afb2','corporate':'#a3b9c5','transit':'#c2b594','civic':'#abc2b2'}

def _box(bounds,style='facade',kind='building',**meta):
    x0,y0,z0,x1,y1,z1=map(float,bounds)
    if min(x1-x0,y1-y0,z1-z0)<=0.015:return None
    return {'x':round((x0+x1)/2,4),'y':round(y0,4),'z':round((z0+z1)/2,4),
            'w':round(x1-x0,4),'h':round(y1-y0,4),'d':round(z1-z0,4),
            'kind':kind,'style':style,**meta}

def _aabb(box):
    return (box['x']-box['w']/2,box['y'],box['z']-box['d']/2,
            box['x']+box['w']/2,box['y']+box['h'],box['z']+box['d']/2)

def _boundary_panels():
    # Replaces old 23-27m perimeter fortifications, respecting eight gateways.
    west=(-40,1,-37,-36,4.4,37);east=(37,1,-37,40,4.4,37)
    north=(-40,1,-40,40,4.4,-37);south=(-40,1,37,40,4.4,40)
    sources={'west':west,'east':east,'north':north,'south':south}
    pieces=[]
    for side,bounds in sources.items():
        parts=[bounds]
        for g in [v for v in GATES if v['side']==side]:
            q=g['at'];w=g['width']/2
            cut=((-41,.7,q-w,-35,6,q+w) if side=='west' else
                 ((36,.7,q-w,41,6,q+w) if side=='east' else
                  ((q-w,.7,-41,q+w,6,-36) if side=='north' else
                   (q-w,.7,36,q+w,6,41))))
            parts=[piece for p in parts for piece in subtract(p,cut)]
        for i,p in enumerate(parts):
            b=_box(p,'concrete','edgeWall',stage6Physical=True,edge=side,structure=f'heritage-edge-{side}',segment=i)
            if b:pieces.append(b)
    return pieces

def _ground():
    # Outer ring is supported, but Stage 4 recessed plaza floor remains untouched.
    strips=[(-58,-.32,-58,-40,1,58),(40,-.32,-58,58,1,58),(-40,-.32,-58,40,1,-40),(-40,-.32,40,40,1,58)]
    return [_box(x,'road','floor',stage6Physical=True,structure='outer-urban-ground') for x in strips]

def _threshold_floors():
    # The old 4m-thick perimeter wall covered the threshold floor. Removing
    # its collision volume creates a gap unless a physically supported apron
    # is added at precisely the same height as the surrounding street.
    floors=[]
    for g in GATES:
        q=g['at'];r=g['width']/2+.08
        if g['side']=='west':bounds=(-40.5,-.32,q-r,-35.6,1,q+r)
        elif g['side']=='east':bounds=(35.6,-.32,q-r,40.5,1,q+r)
        elif g['side']=='north':bounds=(q-r,-.32,-40.5,q+r,1,-35.6)
        else:bounds=(q-r,-.32,35.6,q+r,1,40.5)
        floors.append(_box(bounds,'road','floor',stage6Physical=True,
                           structure=f"threshold-{g['id']}"))
    return floors

def _external_cordon():
    # Concealed by occupied city parcels and gates; low, not a 25m dark arena box.
    sides=[(-58.3,1,-58,-57.8,4.9,58),
           (57.8,1,-58,58.3,4.9,58),
           (-58,1,-58.3,58,4.9,-57.8),
           (-58,1,57.8,58,4.9,58.3)]
    return [_box(q,'concrete','districtEdge',stage6Physical=True,structure='restricted-sector-boundary') for q in sides]

def _rail_continuation_structure():
    # Stage 4 physical track spans x -36..36. The next 22m each side must
    # remain real physical viaduct, not false non-colliding visual track.
    boxes=[]
    for x0,x1 in ((-58,-36),(36,58)):
        for rail_z in (-25.08,-20.52):
            boxes.append(_box((x0,8.91,rail_z-.11,x1,9.12,rail_z+.11),
                              'rust','rail',stage6Physical=True,structure='continuous-rail'))
    for x in (-55,55):
        # A north-side support column and transverse girder: away from the
        # street-line traces and far above pedestrian head-clearance.
        boxes.append(_box((x-.30,1,-28.5,x+.30,8.5,-27.9),
                           'concrete','railSupport',stage6Physical=True,structure='viaduct-span'))
        boxes.append(_box((x-.45,8.45,-28.4,x+.45,8.85,-20.3),
                           'metal','railGirder',stage6Physical=True,structure='viaduct-span'))
    return boxes

def _road_intersection(parcel,street,margin=0.55):
    x0,z0,x1,z1=parcel
    r=street['width']/2+margin
    for (ax,az),(bx,bz) in zip(street['points'],street['points'][1:]):
        bx0,bx1=min(ax,bx)-r,max(ax,bx)+r
        bz0,bz1=min(az,bz)-r,max(az,bz)+r
        if x0<bx1 and x1>bx0 and z0<bz1 and z1>bz0:
            return True
    return False

def _physical_buildings():
    boxes=[];register=[]
    for pid,name,(x0,z0,x1,z1),roof,family,purpose in PARCELS:
        plan={'id':pid,'name':name,'footprint':[x0,z0,x1,z1], 'use':purpose,
              'family':family,'roof_y':roof,'playable_interior':False,
              'ground_doors':'closed/not modeled','access':'non-playable shell'}
        # Entire sealed-building footprint is kept away from each street travel
        # corridor. No automatic subtractive carving creates fake rooms.
        conflicts=[p['id'] for p in STREETS+CONNECTORS if _road_intersection((x0,z0,x1,z1),p)]
        if conflicts:
            plan['status']='REJECTED: footprint would obstruct designed public path'
            plan['conflicts']=conflicts
        else:
            plan['status']='constructed shell'
            boxes.append(_box((x0,1,z0,x1,roof,z1),FINISHES[family],
                              'building',stage6Physical=True,buildingId=pid,sector=family))
            # At tall buildings, smaller roof setback creates non-cubic silhouette.
            if roof>=15 and x1-x0>=10 and z1-z0>=10:
                boxes.append(_box((x0+1.2,roof,z0+1,x1-1.2,roof+3.2,z1-1),
                                  FINISHES[family],'roofPlant',stage6Physical=True,buildingId=pid,sector=family))
        register.append(plan)
    return boxes,register

def _road_markings():
    # Minimal, flush and non-colliding visual indicators; new streets do not use
    # floating visual guardrails or phantom parkour platforms.
    dec=[]
    for street in STREETS+CONNECTORS:
        for i,((ax,az),(bx,bz)) in enumerate(zip(street['points'],street['points'][1:])):
            if abs(ax-bx)>.01 and abs(az-bz)>.01:continue
            if abs(ax-bx)>.01:
                mn,mx=sorted((ax,bx))
                # Small intermittent painted lane dashes, inset from endpoints.
                for x in range(math.ceil(mn)+3,math.floor(mx)-2,5):
                    b=_box((x,1.009,az-.045,x+2,1.018,az+.045),'tile','routeMark',
                           stage6VisualOnly=True,stage6Tier=0,route=street['id'])
                    if b:dec.append(b)
            else:
                mn,mx=sorted((az,bz))
                for z in range(math.ceil(mn)+3,math.floor(mx)-2,5):
                    b=_box((ax-.045,1.009,z,ax+.045,1.018,z+2),'tile','routeMark',
                           stage6VisualOnly=True,stage6Tier=0,route=street['id'])
                    if b:dec.append(b)
    return dec

def _context_visuals(quality):
    dec=[]; parcels=[]
    thresholds={'performance':0,'high':1,'ultra':2}
    tier=thresholds[quality]
    for pid,name,(x0,z0,x1,z1),height,family in CONTEXT_PARCELS:
        parcels.append({'id':pid,'name':name,'use':family,'footprint':[x0,z0,x1,z1],
                        'height_m':height,'playable':False})
        shape=_box((x0,1,z0,x1,height,z1),FINISHES[family],'urbanContext',
                   stage6VisualOnly=True,stage6Tier=0,buildingId=pid,urbanFamily=family)
        if shape:dec.append(shape)
        # Setback on tall profiles, gives legible skyline and varied massing.
        if tier>=1 and height>=20 and x1-x0>9 and z1-z0>9:
            dec.append(_box((x0+1.2,height,z0+1.1,x1-1.1,height+5,z1-1),
                            FINISHES[family],'urbanContextSetback',stage6VisualOnly=True,
                            stage6Tier=1,buildingId=pid,urbanFamily=family))
        # High/Ultra windows only on facades facing *inwards* or toward streets.
        if tier>=1:
            span=x1-x0
            if span>6:
                bays=min(12,max(1,int(span/2.8)))
                for k in range(bays):
                    xx=x0+(k+.5)*span/bays
                    for yy in range(4,int(height)-2,4 if tier==1 else 3):
                        dec.append(_box((xx-.7,yy,z1+.04,xx+.7,yy+1.15,z1+.10),
                                        'glass','urbanWindow',stage6VisualOnly=True,stage6Tier=1,
                                        buildingId=pid,urbanFamily=family))
            if tier>=2 and z1-z0>7:
                zz=(z0+z1)/2
                for yy in range(5,int(height)-2,4):
                    dec.append(_box((x1+.045,yy,zz-1.4,x1+.10,yy+1.1,zz+1.4),
                                     'glass','urbanWindow',stage6VisualOnly=True,stage6Tier=2,
                                     buildingId=pid,urbanFamily=family))
    # Railway is continuous, not a station platform that ends at the 80m edge.
    for x0,x1 in [(-80,-58),(58,80)]:
        for z in (-25.08,-20.52):
            dec.append(_box((x0,8.93,z-.08,x1,9.14,z+.08),'rust','railContinuation',
                         stage6VisualOnly=True,stage6Tier=0,contextTransport=True))
        # Viaduct support under the continuing track; far enough from play.
        for x in range(int(x0)+7,int(x1),10):
            if abs(x)<59:continue
            for z in (-26,-19.5):
                dec.append(_box((x-.30,1,z-.26,x+.3,8.9,z+.26),'concrete',
                                'railContinuationSupport',stage6VisualOnly=True,stage6Tier=0,contextTransport=True))
    # Street corridors outside the physical envelope remain visual context only.
    # They show continuity without advertising walkable geometry beyond the clamp.
    context_roads=[(-63,-.28,-80,-59,1,80),(59,-.28,-80,63,1,80),
                   (-80,-.28,-63,80,1,-59),(-80,-.28,59,80,1,63)]
    for bounds in context_roads:
        dec.append(_box(bounds,'road','contextStreet',stage6VisualOnly=True,
                        stage6Tier=0,contextTransport=True))
    return dec,parcels

def overlay(source,quality='high'):
    """Build a structural and visual Stage 6 test candidate from Stage 5."""
    if quality not in ('performance','high','ultra'):raise ValueError(quality)
    if len([b for b in source['boxes'] if b.get('kind')=='boundary'])!=4:
        raise ValueError('Expected exactly four Stage 4 original perimeter walls')
    out=copy.deepcopy(source)
    base_core=[b for b in out['boxes'] if b.get('kind')!='boundary']
    outline=_boundary_panels();ground=_ground()+_threshold_floors();edge=_external_cordon()
    buildings,register=_physical_buildings()
    new_struct=outline+ground+edge+buildings+_rail_continuation_structure()
    out['boxes']=base_core+new_struct
    dec,context=_context_visuals(quality)
    markings=_road_markings()
    out['decor'].extend(dec+markings)
    out['size']=120
    out['revision']='02.6-stage6-urban-expansion'
    out['stage6']={
        'status':'STRUCTURAL CANDIDATE — NOT IN-GAME VALIDATED',
        'urban_thesis':'The original four districts anchor a wider, functioning neighbourhood.',
        'original_core_width_m':80,'nominal_collision_width_m':120,
        'visual_context_width_m':160,'playable_core_centre':[0,0],
        'gameplay_density_policy':'existing 8 spawn locations retained; no context-only spawns',
        'eight_existing_gateways':GATES,
        'new_navigation_paths':STREETS+CONNECTORS,
        'road_uses':{r['id']:r['use'] for r in STREETS+CONNECTORS},
        'physical_parcels':register,
        'context_parcels':context,
        'source_box_count':len(source['boxes']),
        'source_original_boundary_count':4,
        'source_base_non_boundary':len(base_core),
        'replacement_edge_panel_count':len(outline),
        'new_physical_collider_count':len(new_struct),
        'new_visual_detail_count':len(dec)+len(markings),
        'architectural_types':dict(Counter(p['family'] for p in register)),
        'quality':quality,
        'no_deployment':True,
        'unresolved':['current repository import/renderer quality compatibility',
                      'actual server-browser collision/parity testing',
                      'full capsule sweep at each turn and entrance',
                      'game-mode/map-size UI and minimap scaling',
                      '2-8 player matchmaking flow, density and performance playtests',
                      'district-edge treatment and long-range skyline consistency'],
    }
    return out