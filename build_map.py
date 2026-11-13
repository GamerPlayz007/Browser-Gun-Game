"""Solstice 02.3. Author collision, navigation and the tactical guide together.

Coordinates are metres, Y is bottom-centred. Ramps use 12.5 cm collision
risers under a continuous wedge visual, preserving the existing physics.
"""
import json, math
from pathlib import Path
ROOT=Path(__file__).parent
boxes=[];ramps=[];arches=[];jumps=[];ledges=[]
PALETTE={'ivory':'#f4eee0','amber':'#dd7544','roof':'#b64f38','slate':'#304f61',
         'emerald':'#207a64','jade':'#61b997','blue':'#287dba','water':'#39ccda',
         'stone':'#bbbead','gold':'#e5b755','dark':'#293e48'}
def box(x,y,z,w,h,d,style='ivory',kind='wall',**extra):
    b=dict(x=x,y=y,z=z,w=w,h=h,d=d,style=style,kind=kind,**extra);boxes.append(b);return b

def ramp(name,x,z,length,rise,width=6,base=0,style='ivory'):
    # Runs north (-Z); adjoining landing starts at z-length.
    n=round(rise/.125);tread=length/n
    for i in range(n):box(x,base,z-(i+.5)*tread,width,(i+1)*rise/n,tread,style,'rampStep')
    ramps.append(dict(name=name,x=x,z=z,length=length,rise=rise,width=width,base=base,style=style))

def arch(x,z,width=8,axis='x',base=0,style='ivory'):
    # Opening has 5.2 m headroom across its entire clear width.
    for side in [-1,1]:box(x+(side*(width/2+.5) if axis=='x' else 0),base,z+(side*(width/2+.5) if axis=='z' else 0),1 if axis=='x' else 1.2,5.2,1.2 if axis=='x' else 1,style,'pier')
    box(x,base+5.2,z,width+2 if axis=='x' else 1.2,1.6,1.2 if axis=='x' else width+2,style,'lintel')
    arches.append(dict(x=x,z=z,width=width,axis=axis,base=base,style=style))

# An occupied town edge, not a giant empty yard. All roofs stay below 12 m walls.
for x in [-40,40]:box(x,0,0,1,12,81,'amber' if x<0 else 'slate','boundary')
for z in [-40,40]:box(0,0,z,79,12,1,'ivory','boundary')
# West arcade: continuous rear wall, structural columns and three roof sections.
box(-37,0,-7.5,4,5.5,47,'amber','facade')
for lo,hi in [(-31,-12),(-10,4),(6.5,15)]:
    if lo==-31:
        # Open stairwell through the upper slab: stairs never run into a ceiling.
        box(-23,5.2,-21.5,12,.3,19,'roof','roof')
        box(-32,5.2,-15,6,.3,6,'roof','roof')
        box(-26,5.2,-33.5,18,.3,5,'roof','roof')
    else:box(-26,5.2,(lo+hi)/2,18,.3,hi-lo,'roof','roof')
    for x in [-34,-18]:
        for z in [lo+.7,hi-.7]:box(x,0,z,.9,5.2,.9,'ivory','pier')
    # Colonnade cornice spans the posts, making the hollow structure legible.
    for x in [-34,-18]:box(x,4.6,(lo+hi)/2,1.15,.6,hi-lo,'amber','beam')
# True window openings in the outer facade's taller parapet.
for z in [-26,-18,-4,10]:box(-35.1,5.5,z,.6,1.1,3,'amber','parapet')
ramp('Ember south ramp',-26,37,22,5.5,6,style='amber')
# Second access at the north end means gaps are optional shortcuts, never a trap.
ramp('Tower stairs',-32,-19,12,5.5,5,style='ivory')
# Broad arcade cross wall stops a full north/south firing line; bypass on either side.
box(-26,0,-2,8,3.8,.8,'amber','facade')
# Split bell-tower silhouette rises out of the north terrace, with open centre.
for x in [-28,-20]:box(x,5.5,-34,2,6,3,'amber','tower')
box(-24,11.5,-34,10,.7,3.4,'roof','beam')
# Elevated connection across all three lanes, with walkable space below.
box(0,5.2,-28,35,.3,7,'ivory','bridge')
for z in [-31.5,-24.5]:
    for x in [-13,13]:box(x,0,z,1.2,5.2,1.2,'ivory','pier')
    for x in [-12,12]:box(x,5.5,z,8,.75,.45,'blue','parapet')
# Bridge entrance arch stays far above jump height at deck level.
arch(0,-28,5,'z',5.5)
# Lane separators are actual connected arcade walls, with 8 m cross passages.
for x,style in [(-12,'amber'),(12,'slate')]:
    for lo,hi in [(-34,-32),(-24,-11),(-3,12),(20,32)]:box(x,0,(lo+hi)/2,.8,4.2,hi-lo,style,'facade')
    for z in [-7,16]:arch(x,z,8,'z',style='ivory')
# Azure: sunken-by-comparison court enclosed by raised northern/southern edges.
box(0,0,-21,23,1,7,'ivory','terrace')
box(0,0,23,23,1,6,'ivory','terrace')
ramp('Court north approach',0,-13,4,1,8)
ramp('Court south approach',0,30,4,1,8)
# Arch entry and offset screen create an S-shaped central sightline.
arch(0,32,10)
box(-4,0,34,7,3.6,1,'blue','screen')
box(4,0,-35,7,3.6,1,'blue','screen')
# Fountain island carries the ring. Basin is shallow and walkable.
box(0,0,1,7,.5,6,'blue','fountain')
box(0,.5,1,2,2,2,'ivory','ringBase')
# Broken ring collision follows the visible faceted arc, leaving its hole open.
for i in range(24):
    a=.5+i*5.25/24;b=.5+(i+1)*5.25/24
    x1,y1=2.3*math.cos(a),4.8+2.3*math.sin(a)
    x2,y2=2.3*math.cos(b),4.8+2.3*math.sin(b)
    box((x1+x2)/2,min(y1,y2)-.16,1,abs(x2-x1)+.32,abs(y2-y1)+.32,.32,'gold','ringSegment')
# Side cover is architectural planting/retaining walls, not scattered crates.
for x,z in [(-7,-5),(7,8)]:box(x,0,z,3,1.15,5,'ivory','planter')
# Emerald: connected tiered garden building, continuous side gallery and pavilion.
for lo,hi in [(-31,-18),(-16.5,12)]:
    box(35,5.2,(lo+hi)/2,6,.3,hi-lo,'slate','roof')
    for z in [lo+.6,hi-.6]:box(37.5,0,z,.8,5.2,.8,'jade','pier')
box(39,0,-9.5,1,5.5,43,'slate','facade')
ramp('Garden south ramp',35,34,22,5.5,6,style='slate')
for lo,hi,h in [(-31,-16,5.5),(-16,-2,3.5),(-2,14,2),(14,26,1)]:
    box(24,0,(lo+hi)/2,16,h,hi-lo,'slate','terrace')
# Garden ramp chain occupies a separate 6 m strip along the western edge.
ramp('Garden lower stair',19,30,4,1,6,style='jade')
ramp('Garden middle stair',19,18,4,1,6,base=1,style='jade')
ramp('Garden upper stair',19,4,6,1.5,6,base=2,style='jade')
ramp('Pavilion stair',19,-8,8,2,6,base=3.5,style='jade')
# Remove the terrace below each inset ramp corridor, preserving solid landings.
# This carves a west strip from each tier, so the next tall tier never blocks ascent.
for b in boxes:
    if b['kind']=='terrace' and b['x']==24:b['x']=27;b['w']=10
# Fill western landings between ramps, at the lower tier height.
for lo,hi,h in [(18,26,1),(4,14,2),(-8,-2,3.5),(-31,-16,5.5)]:box(19,0,(lo+hi)/2,6,h,hi-lo,'slate','terrace')
# Pavilion roof carried by four piers, not a solid box. 5.2 m interior clearance.
for x in [18,30]:
    for z in [-30,-20]:box(x,5.5,z,1,5.2,1,'jade','pier')
box(24,10.7,-25,14,.35,12,'emerald','canopy')
# Waterfall spine blocks sightlines across part of the upper garden.
box(30,5.5,-24,2,3.2,5,'slate','waterfallBack')
# Garden planting and low walls define movement edges. Large clear lanes remain.
for x,y,z,w,d in [(28,1,22,3,5),(28,2,6,3,5),(29,3.5,-9,2,4)]:box(x,y,z,w,.85,d,'emerald','planter')
# Two ledges in a climb chain: jumpable with the existing ~1.15 m discrete apex.
box(23,1,23,4,.9,3,'jade','ledge')
box(23,1.9,20,4,.9,3,'jade','ledge')
ledges=[dict(name='Garden ledge one',start=[23,1,25.5],end=[23,1.9,23],yaw=0,rise=.9),
        dict(name='Garden ledge two',start=[23,1.9,23],end=[23,2.8,20],yaw=0,rise=.9)]
# Roof shortcut gaps: safe full-width landings, no decorative collision at edges.
jumps=[dict(name='Ember north gap',start=[-26,5.5,-9],end=[-26,5.5,-13],yaw=0,gap=2),
       dict(name='Ember south gap',start=[-26,5.5,7.5],end=[-26,5.5,3],yaw=0,gap=2.5)]
# 1.5 m garden gap is a side route on a wide platform, with a ground bypass.
jumps.append(dict(name='Garden gallery gap',start=[35,5.5,-15.5],end=[35,5.5,-19],yaw=0,gap=1.5))
# South return street: offset inhabited facade ends, leaving a broad looping road.
box(-7,0,37,12,5,4,'amber','facade');box(17,0,37,8,4.5,4,'slate','facade')
# Named navigation and test fixtures keep tests tied to authored features.
data=dict(name='SOLSTICE: SKYWAYS',subtitle='Ember Roofs / Azure Court / Emerald Gardens',size=80,revision='2.3',
          palette=PALETTE,boxes=boxes,ramps=ramps,arches=arches,jumps=jumps,ledges=ledges,
          zones=[dict(name='EMBER ROOFS',x=-26,z=0,w=28,d=80,color=PALETTE['amber']),
                 dict(name='AZURE COURT',x=0,z=0,w=24,d=80,color=PALETTE['blue']),
                 dict(name='EMERALD GARDENS',x=26,z=0,w=28,d=80,color=PALETTE['emerald'])],
          spawns=[[-30,0,32],[-19,0,32],[-26,0,-35],[-20,0,-20],[-20,0,10],
                  [-26,5.5,11],[-26,5.5,-18],[0,0,36],[7,0,-37],[-7,0,-30],
                  [24,0,32],[36,5.5,-16],[24,5.5,-30],[25,2,10],[25,3.5,-14],[6,0,16]],
          practiceTargets=[[-20,0,-34],[7,0,30]],
          combatTest=dict(a=[-20,0,10],b=[-20,0,2]),
          weapons=[{"id": 0, "name": "VANGUARD", "type": "ASSAULT RIFLE", "short": "AR", "damage": 25, "head": 1.6, "mag": 30, "reload": 1.65, "interval": 0.14, "pellets": 1, "spread": 0.012, "range": 65, "falloff": 30, "kick": 0.014, "speed": 1, "color": "#e7b258"}, {"id": 1, "name": "VIPER", "type": "SUBMACHINE GUN", "short": "SMG", "damage": 17, "head": 1.5, "mag": 32, "reload": 1.35, "interval": 0.085, "pellets": 1, "spread": 0.023, "range": 42, "falloff": 14, "kick": 0.009, "speed": 1.08, "color": "#60d4be"}, {"id": 2, "name": "BREACH", "type": "PUMP SHOTGUN", "short": "SG", "damage": 15, "head": 1.2, "mag": 6, "reload": 2.1, "interval": 0.82, "pellets": 8, "spread": 0.105, "range": 25, "falloff": 7, "kick": 0.055, "speed": 0.95, "color": "#ef8a79"}, {"id": 3, "name": "LONGSHOT", "type": "PRECISION RIFLE", "short": "SR", "damage": 75, "head": 1.6, "mag": 5, "reload": 2.25, "interval": 1.05, "pellets": 1, "spread": 0.065, "range": 100, "falloff": 70, "kick": 0.06, "speed": 0.9, "color": "#b1b4ee"}])

def write_guide():
    # Draw the authored collision plan: overhead roofs translucent; arrows show access.
    from html import escape
    scale=7.5;cx=350;cy=390
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="840" viewBox="0 0 1120 840">',
         '<rect width="1120" height="840" fill="#142b39"/>',
         '<text x="44" y="46" fill="#f4eee0" font-size="29" font-family="sans-serif" font-weight="bold">SOLSTICE / SKYWAYS</text>',
         '<text x="44" y="72" fill="#81cdbb" font-size="12" font-family="sans-serif">02.3 · 80 × 80 · THREE LANES / TWO LEVELS · NORTH ↑</text>']
    def rect(x,z,w,d,c,more=''):
        svg.append(f'<rect x="{cx+(x-w/2)*scale}" y="{cy+(z-d/2)*scale}" width="{w*scale}" height="{d*scale}" fill="{c}" {more}/>')
    for a in data['zones']:rect(a['x'],a['z'],a['w'],a['d'],a['color'],'opacity=".25"')
    for b in boxes:
        if b['kind'] in ['rampStep','lintel','canopy']:continue
        rect(b['x'],b['z'],b['w'],b['d'],PALETTE[b['style']],f'opacity="{.4 if b["kind"] in ["roof","bridge"] else .9}" stroke="#112a35" stroke-width=".5"')
    for r in ramps:
        rect(r['x'],r['z']-r['length']/2,r['width'],r['length'],PALETTE[r['style']],'opacity=".75"')
        svg.append(f'<path d="M{cx+r["x"]*scale},{cy+(r["z"]-1)*scale} v{-max(1,r["length"]-2)*scale} m-5,7 l5,-7 l5,7" fill="none" stroke="#fff4d4" stroke-width="2"/>')
    for j in jumps:
        x,_,z=j['start'];ex,_,ez=j['end'];svg.append(f'<path d="M{cx+x*scale},{cy+z*scale} L{cx+ex*scale},{cy+ez*scale}" stroke="#ffdb68" stroke-width="3" stroke-dasharray="4 3"/>')
    for x,y,z in data['spawns']:svg.append(f'<circle cx="{cx+x*scale}" cy="{cy+z*scale}" r="4" fill="#fff" stroke="#123441" stroke-width="1.5"/>')
    for text,x,z in [('BELL TOWER',-26,-35),('ARCH BRIDGE',0,-28),('PAVILION',24,-34),('EMBER',-26,-5),('AZURE COURT',0,9),('GARDENS',25,4),('SOUTH RETURN',0,31)]:
        svg.append(f'<text x="{cx+x*scale}" y="{cy+z*scale}" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="11" font-weight="bold" stroke="#142b39" stroke-width="3" paint-order="stroke">{text}</text>')
    lines=[('EMBER ROOFS','#dd7544','Hollow arcade / terracotta roof chain'),('AZURE COURT','#58d7e4','White arches / fountain / broken ring'),('EMERALD GARDENS','#61b997','Tiered stone / pavilion / waterfall'),('UPPER LOOP','#e5b755','Ember → north bridge → garden gallery'),('GROUND LOOP','#f4eee0','Offset arches / court / south return')]
    for i,(title,color,desc) in enumerate(lines):
        y=145+i*105;svg.append(f'<text x="710" y="{y}" fill="{color}" font-family="sans-serif" font-size="20" font-weight="bold">{escape(title)}</text><text x="710" y="{y+27}" fill="#cadbd8" font-family="sans-serif" font-size="13">{escape(desc)}</text>')
    svg.extend(['<text x="710" y="700" fill="#cadbd8" font-family="sans-serif" font-size="13">Arrows: ascent · Dashed gold: jump shortcuts</text>', '<text x="710" y="726" fill="#cadbd8" font-family="sans-serif" font-size="13">White dots: spawns · Pale roofs: passage below</text>', '<text x="44" y="800" fill="#81cdbb" font-family="sans-serif" font-size="12">Hold M for the in-game map. Schematic overview, not a gameplay screenshot.</text>','</svg>'])
    (ROOT/'MAP_GUIDE.svg').write_text(''.join(svg))

if __name__=='__main__':
    (ROOT/'static/map.json').write_text(json.dumps(data,separators=(',',':')))
    write_guide()
