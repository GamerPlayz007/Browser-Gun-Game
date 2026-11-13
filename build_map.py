"""Author the shared collision/visual map. Run only when changing the layout."""
import json
from pathlib import Path
boxes=[]
def box(x,y,z,w,h,d,style='sand',kind='solid'):
    boxes.append(dict(x=x,y=y,z=z,w=w,h=h,d=d,style=style,kind=kind))
# Bottom-centred boxes: y is the base; rendering and server use the same data.
for x in (-25,25):box(x,0,0,1,7,51,'sand','boundary')
for z in (-25,25):box(0,0,z,49,7,1,'sand','boundary')
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
data={'name':'SOLSTICE','subtitle':'The old quarter','size':50,'boxes':boxes,
'spawns':[[-22,0,-21],[22,0,21],[21,0,-21],[-22,0,21],[0,0,-21],[0,0,21]],
'practiceTargets':[[-5,0,-22],[5,0,22]],
'weapons':[
{'id':0,'name':'VANGUARD','type':'ASSAULT RIFLE','short':'AR','damage':25,'head':1.6,'mag':30,'reload':1.65,'interval':.14,'pellets':1,'spread':.012,'range':65,'falloff':30,'kick':.014,'speed':1,'color':'#e7b258'},
{'id':1,'name':'VIPER','type':'SUBMACHINE GUN','short':'SMG','damage':17,'head':1.5,'mag':32,'reload':1.35,'interval':.085,'pellets':1,'spread':.023,'range':42,'falloff':14,'kick':.009,'speed':1.08,'color':'#60d4be'},
{'id':2,'name':'BREACH','type':'PUMP SHOTGUN','short':'SG','damage':15,'head':1.2,'mag':6,'reload':2.1,'interval':.82,'pellets':8,'spread':.105,'range':25,'falloff':7,'kick':.055,'speed':.95,'color':'#ef8a79'},
{'id':3,'name':'LONGSHOT','type':'PRECISION RIFLE','short':'SR','damage':75,'head':1.6,'mag':5,'reload':2.25,'interval':1.05,'pellets':1,'spread':.065,'range':100,'falloff':70,'kick':.06,'speed':.9,'color':'#b1b4ee'}]}
Path(__file__).with_name('static').joinpath('map.json').write_text(json.dumps(data,separators=(',',':')))
