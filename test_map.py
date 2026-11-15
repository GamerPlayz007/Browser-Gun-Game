"""03.2: sole live city, client/server movement and map generation tests."""
import json, math, random, subprocess, unittest
from pathlib import Path
import server as s
ROOT=Path(__file__).parent

def traverse(route,reverse=False,mode='sprint',weapon=0):
    points=list(reversed(route['points'])) if reverse else route['points']
    p=s.new_player(s.Room('TEST'),'test','Navigator',100,weapon)
    p.update(x=points[0][0],y=points[0][1],z=points[0][2],vx=0,vy=0,vz=0,grounded=True)
    initial=p.copy();commands=[];states=[];tick=0
    for target in points[1:]:
        budget=math.ceil(math.dist((p['x'],p['y'],p['z']),target)/4*60)+360
        for _ in range(budget):
            dx,dz=target[0]-p['x'],target[2]-p['z'];dist=math.hypot(dx,dz)
            if dist<.22 and abs(p['y']-target[1])<.32:break
            yaw=math.atan2(-dx,-dz)
            inp=dict(w=True,sprint=True,jump=mode=='jump' and tick%50==12 and dist>2 and abs(p['y']-target[1])<.25,
                     slide=mode=='slide' and _==6 and dist>4 and abs(p['y']-target[1])<.25 and (p['vx']*dx+p['vz']*dz)/max(.01,math.hypot(p['vx'],p['vz'])*dist)>.95)
            p.update(yaw=yaw,input=inp,last_input=100+tick*s.TICK)
            s.move(p,s.TICK,100+tick*s.TICK)
            commands.append(dict(yaw=yaw,**inp));states.append({k:p[k] for k in ['x','y','z','vx','vy','vz','grounded','crouch']});tick+=1
        else:raise AssertionError(f"{route['id']} reverse={reverse} {mode} stuck at {(p['x'],p['y'],p['z'])}; target {target}")
    return dict(name=f"{route['id']}:{reverse}:{mode}",initial={k:initial[k] for k in ['x','y','z','yaw','vx','vy','vz','grounded','slide_until','slide_ready','jump_held','slide_held','jump_buffer_until','coyote_until','jump_consumed','jump_cut','wall_kick_used','interact_held','mantle']},weapon=weapon,commands=commands),states

class MapTests(unittest.TestCase):
    def test_all_registered_routes_and_six_accesses_in_both_engines(self):
        cases=[];expected=[]
        for route in s.MAP['routes']+s.MAP['stairs']:
            for reverse in [False,True]:
                for mode in ['sprint','jump','slide']:
                    case,states=traverse(route,reverse,mode,weapon=3);cases.append(case);expected.append(states)
        script="""import fs from 'node:fs';import {simulate} from './static/physics.js';
const map=JSON.parse(fs.readFileSync('static/map.json')),cases=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(cases.map(c=>{const p={...c.initial};return c.commands.map((cmd,i)=>{p.yaw=cmd.yaw;simulate(p,cmd,1/60,100+i/60,map.boxes,map.weapons[c.weapon]);return [p.x,p.y,p.z,p.vx,p.vy,p.vz,p.grounded,p.crouch];});})));"""
        js=json.loads(subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(cases),cwd=ROOT,text=True,capture_output=True,check=True).stdout)
        for case,py,client in zip(cases,expected,js):
            with self.subTest(case=case['name']):
                self.assertEqual(len(py),len(client))
                for a,b in zip(py,client):
                    for k,value in zip(['x','y','z','vx','vy','vz'],b):self.assertAlmostEqual(a[k],value,places=7)
                    self.assertEqual(a['grounded'],b[6]);self.assertEqual(a['crouch'],b[7])
                # Short stair segments may finish before a timed jump/slide edge.
                # Dedicated movement tests verify those actions; this test checks
                # complete route traversal and exact cross-language parity.
    def test_width_headroom_and_support(self):
        for route in s.MAP['routes']+s.MAP['stairs']:
            self.assertGreaterEqual(route['width'],6 if route['id'][0]=='G' else 3)
            for a,b in zip(route['points'],route['points'][1:]):
                dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz)
                if length<1e-9:continue  # Vertical-only route segment has no horizontal sample tangent.
                for i in range(math.ceil(length*2)+1):
                    t=min(1,i/max(1,math.ceil(length*2)))
                    # Ground roads: audit full width. Upper routes/interiors:
                    # check physical centreline; authored metadata can exceed
                    # local platform width at stairs and tight interiors.
                    sides=[0] if not(route['id'].startswith('G') and max(a[1],b[1])<5 and min(t,1-t)*length>=route['width']/2) else [0,-1,1]
                    for side in sides:
                        offset=side*(route['width']/2-.4)
                        x=a[0]+t*dx-dz/length*offset;z=a[2]+t*dz+dx/length*offset;y=a[1]+t*(b[1]-a[1])
                        near=s.nearby_boxes(x,z)
                        # At a ramp/landing junction, a lateral sample can lie on
                        # the sloped surface rather than the centreline elevation.
                        supports=[s.top_at(o,x,z) for o in near if y-1.5<=s.top_at(o,x,z)<=y+.3 and abs(x-o['x'])<=o['w']/2+.01 and abs(z-o['z'])<=o['d']/2+.01]
                        self.assertTrue(supports,(route['id'],'unsupported',[x,y,z]))
                        floor=max(supports)
                        blockers=[o for o in near if s.overlaps(x,floor+.29,z,o,2.7) and not (side!=0 and o.get('kind') in ('stairTread','stairLanding') and o.get('route')!=route['id'])]
                        self.assertFalse(blockers,(route['id'],[x,floor,z],[(o['kind'],o['x'],o['z']) for o in blockers]))
    def test_spawns_and_street_connectivity(self):
        for pos in s.SPAWNS:
            self.assertFalse(any(s.overlaps(*pos,b) for b in s.BOXES),pos)
            x,y,z=pos
            self.assertTrue(any(abs(s.top_at(b,x,z)-y)<.01 and abs(x-b['x'])<=b['w']/2 and abs(z-b['z'])<=b['d']/2 for b in s.nearby_boxes(x,z)),pos)
        self.assertEqual({r['id'] for r in s.MAP['routes']},{f'{kind}{i}' for kind in 'GIU' for i in range(1,5)}|{'PD-01'})
        for kind in 'GIU':
            edges={frozenset([r['fromZone'],r['toZone']]) for r in s.MAP['routes'] if r['id'].startswith(kind)}
            self.assertEqual(edges,{frozenset(p) for p in [('market','plaza'),('plaza','atrium'),('market','transit'),('atrium','transit')]})
    def test_buildings_block_cross_district_views(self):
        for a,b in [((-24,2.55,4),(25,2.55,4)),((0,1.55,27),(0,10.55,-23)),((-24,6.55,0),(22,6.55,0))]:
            dist=math.dist(a,b);direction=tuple((b[i]-a[i])/dist for i in range(3))
            self.assertTrue(any((h:=s.ray_solid(a,direction,box)) is not None and h<dist for box in s.BOXES))
    def test_spatial_index_never_omits_colliders(self):
        rng=random.Random(3);counts=[]
        for _ in range(300):
            x,z=rng.uniform(-60,60),rng.uniform(-60,60);r=rng.uniform(.34,1);near=s.nearby_boxes(x,z,r);counts.append(len(near))
            for b in s.BOXES:
                if abs(x-b['x'])<=b['w']/2+r and abs(z-b['z'])<=b['d']/2+r:self.assertIn(b,near)
        self.assertLess(sum(counts)/len(counts),len(s.BOXES)/3)
    def test_visual_features_are_decoupled_from_collision(self):
        self.assertEqual(s.MAP['revision'],'03.2')
        decor=s.MAP['decor']
        self.assertGreater(len(decor),1500)
        self.assertTrue(any(b.get('stage5VisualOnly') for b in decor))
        self.assertTrue(any(b.get('stage6VisualOnly') for b in decor))
        self.assertEqual(len(s.MAP['routes']),13)
        for d in decor:self.assertNotIn(d,s.BOXES)
    def test_generation_is_reproducible(self):
        paths=['static/map.json','static/maps/cyberpunk.json','static/maps/index.json']
        before=[(ROOT/p).read_bytes() for p in paths]
        subprocess.run(['python','build_map.py'],cwd=ROOT,check=True,capture_output=True)
        self.assertEqual(before,[(ROOT/p).read_bytes() for p in paths])
if __name__=='__main__':unittest.main()
