"""Author the shared collision/visual map. Run only when changing the layout."""
import json
from pathlib import Path
boxes=[]
def box(x,y,z,w,h,d,style='sand',kind='solid'):
    boxes.append(dict(x=x,y=y,z=z,w=w,h=h,d=d,style=style,kind=kind))
# Bottom-centred boxes: y is the base; rendering and server use the same data.
for x in (-52,52):box(x,0,0,1,8,105,'sand','boundary')
for z in (-52,52):box(0,0,z,103,8,1,'sand','boundary')
for x,z,w,d,tint in [(-13,-10,8,10,'sand'),(13,-12,8,7,'rose'),(-13,12,8,7,'rose'),(13,10,8,10,'sand')]:
    box(x,0,z,w,4,d,tint,'building')
    # Parapets on outer edge. Interior edges are open for traversal.
    box(x+(-3.8 if x<0 else 3.8),4,z,.35,.65,d,tint,'parapet')
# Walkable bridge, with an open space underneath.
box(0,3.7,-10,18,.3,3,'teal','bridge')
for z in (-11.45,-8.55):box(0,4,z,16,.65,.12,'teal','rail')
# Staircases: 25 cm risers, 50 cm treads. Server supports step-up.
for i in range(1,17):
    box(-12,0,3-i*.5,3.5,i*.25,.5,'sand','step')
    box(13,0,-3+i*.5,3.5,i*.25,.5,'sand','step')
# Fountain plinth and cover blocks; the water is visual only.
box(0,0,1,5,.65,5,'tile','fountain')
box(0,.65,1,1.15,1.35,1.15,'sand','monument')
for x,z in [(-5,-2),(5,5),(-20,-3),(20,3)]:box(x,0,z,2.2,1.15,1.3,'crate','cover')
# Market stall counter, garden planters, and protected spawn corners.
box(-4,0,15,6,1.15,1.1,'teal','market')
for x,z in [(-20,17),(20,-17)]:box(x,0,z,3,1.3,1.2,'sand','planter')
for x,z in [(-19,-20),(19,20)]:box(x,0,z,1,2.8,5,'rose','screen')
# Four connected outer districts. The original courtyard is still the central hub.
def building(x,z,w,d,style='sand'):
    box(x,0,z,w,4,d,style,'building')
def stairs(x,z,dx,dz):
    # Bottom landing is (x,z), top landing eight metres in the supplied direction.
    for i in range(1,17):
        box(x+dx*i*.5,0,z+dz*i*.5,.5 if dx else 3.5,i*.25,.5 if dz else 3.5,'sand','step')

def bridge(x,z,w,d):
    box(x,3.7,z,w,.3,d,'teal','bridge')
    if w>d:
        for zz in [z-d/2+.1,z+d/2-.1]:box(x,4,zz,w,.6,.16,'teal','rail')
    else:
        for xx in [x-w/2+.1,x+w/2-.1]:box(xx,4,z,.16,.6,d,'teal','rail')

# North: two roof terraces linked over the observatory passage.
for x in [-13,13]:building(x,-34,12,10,'sand')
bridge(0,-34,14,4)
for x in [-13,13]:stairs(x,-21,0,-1)
# Central navigation landmark is solid all the way to the small dome.
box(13,4,-36,3,5,3,'rose','tower')
# South: garden-side roofs and a second crossing with two ways up.
for x in [-13,13]:building(x,34,12,10,'rose')
bridge(0,34,14,4)
for x in [-13,13]:stairs(x,21,0,1)
# West: a bazaar with offset passages; east: freight courtyards.
for x in [-37,37]:
    for z in [-16,16]:building(x,z,10,10,'rose' if x<0 else 'sand')
# Outer corners anchor the loop and interrupt corner-to-corner sightlines.
for x in [-38,38]:
    for z in [-37,37]:building(x,z,10,10,'sand' if x<0 else 'rose')
for x,z,w,d in [(31,-4,8,3),(42,5,8,3),(34,28,7,3)]:
    box(x,0,z,w,2.5,d,'teal','container')
for x,z,w,d in [(27,8,2.2,1.6),(45,-7,2.2,1.6),(-27,-26,2.2,1.6),
                    (26,-26,2.2,1.6),(-26,26,2.2,1.6),(-5,-43,3,1.6),
                    (5,44,3,1.6),(-45,25,2.2,1.6),(45,-27,2.2,1.6)]:
    box(x,0,z,w,1.2,d,'crate','cover')
for x,z in [(-35,-3),(-41,5),(-28,7)]:box(x,0,z,5,1.15,1.6,'teal','market')
# Low walls create cover without blocking the cross-map routes.
for x,z,w,d in [(-23,-36,1,9),(23,36,1,9),(-34,-25,6,1),(34,25,6,1),
                    (-6,26,5,1),(6,-26,5,1),(-6,-16,4,1),(6,18,4,1)]:
    box(x,0,z,w,1.2,d,'sand','screen')
for x,z,w,d in [(-4,41,4,2),(5,27,4,2),(-27,38,2,5),(26,-38,2,5)]:
    box(x,0,z,w,.9,d,'tile','planter')
# Palm trunks have collision, foliage stays high above head level.
palms=[[-22,7,.9],[22,-7,.9],[-46,-32,1.1],[46,32,1.1],[-5,46,1.1],
       [6,-46,1.1],[-46,12,1],[46,-15,1],[-25,43,.9],[26,43,.9]]
for x,z,scale in palms:box(x,0,z,.55*scale,6*scale,.55*scale,'trunk','palm')
# Roof spawns are clear of scenery and have exits to stairs/bridge/drop-downs.
data={'name':'SOLSTICE: DISTRICT','subtitle':'Five districts. Every angle matters.',
'size':104,'revision':'2.2','boxes':boxes,'palms':palms,
'zones':[{'name':'OBSERVATORY','x':0,'z':-35,'w':54,'d':33,'color':'#d6b573'},
         {'name':'GARDENS','x':0,'z':35,'w':54,'d':33,'color':'#799b7a'},
         {'name':'BAZAAR','x':-39,'z':0,'w':26,'d':104,'color':'#d08e76'},
         {'name':'FREIGHT YARD','x':39,'z':0,'w':26,'d':104,'color':'#5e989b'},
         {'name':'OLD QUARTER','x':0,'z':0,'w':52,'d':38,'color':'#cdbb96'}],
'spawns':[[-22,0,-21],[22,0,21],[21,0,-21],[-22,0,21],
          [-46,0,-44],[46,0,44],[-46,0,44],[46,0,-44],
          [-46,0,0],[46,0,0],[0,0,-46],[0,0,46],
          [-13,4,-34],[13,4,34],[-27,0,0],[27,0,0]],
'practiceTargets':[[-5,0,-22],[5,0,22]],
'weapons':[
{'id':0,'name':'VANGUARD','type':'ASSAULT RIFLE','short':'AR','damage':25,'head':1.6,'mag':30,'reload':1.65,'interval':.14,'pellets':1,'spread':.012,'range':65,'falloff':30,'kick':.014,'speed':1,'color':'#e7b258'},
{'id':1,'name':'VIPER','type':'SUBMACHINE GUN','short':'SMG','damage':17,'head':1.5,'mag':32,'reload':1.35,'interval':.085,'pellets':1,'spread':.023,'range':42,'falloff':14,'kick':.009,'speed':1.08,'color':'#60d4be'},
{'id':2,'name':'BREACH','type':'PUMP SHOTGUN','short':'SG','damage':15,'head':1.2,'mag':6,'reload':2.1,'interval':.82,'pellets':8,'spread':.105,'range':25,'falloff':7,'kick':.055,'speed':.95,'color':'#ef8a79'},
{'id':3,'name':'LONGSHOT','type':'PRECISION RIFLE','short':'SR','damage':75,'head':1.6,'mag':5,'reload':2.25,'interval':1.05,'pellets':1,'spread':.065,'range':100,'falloff':70,'kick':.06,'speed':.9,'color':'#b1b4ee'}]}
Path(__file__).with_name('static').joinpath('map.json').write_text(json.dumps(data,separators=(',',':')))
