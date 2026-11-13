"""02.3 architecture and real movement checks (server + static/physics.js)."""
import json,math,random,subprocess,unittest
from collections import deque
from pathlib import Path
import server as s

def player(pos,yaw=0,weapon=0):
    p=s.new_player(s.Room('MAP'),'p','Test',100,weapon)
    p.update(x=pos[0],y=pos[1],z=pos[2],yaw=yaw,vx=0,vy=0,vz=0,input={})
    return p

def run_case(case):
    p=player(case['start'],case.get('yaw',0),case.get('weapon',0));out=[]
    for i,inp in enumerate(case['inputs']):
        p['input']=inp;p['last_input']=100+i*s.TICK;s.move(p,s.TICK,100+i*s.TICK)
        out.append({k:p[k] for k in ['x','y','z','vx','vy','vz','grounded','crouch']})
    return out

def movement_cases():
    cases=[]
    for j in s.MAP['jumps']:
        # Sprint three ticks then take off .2 m before the edge. Test slowest gun.
        for weapon in range(4):
            cases.append(dict(name=j['name']+str(weapon),kind='jump',start=j['start'],weapon=weapon,
                              end=j['end'],inputs=[dict(w=True,sprint=True,jump=i==3) for i in range(25)]))
    for j in s.MAP['ledges']:
        # Begin just before the ledge, build speed then jump; clear .9 m rise.
        cases.append(dict(name=j['name'],kind='ledge',start=j['start'],end=j['end'],
                          inputs=[dict(w=True,sprint=True,jump=i==1) for i in range(22)]))
    for r in s.MAP['ramps']:
        ticks=math.ceil((r['length']+2)/5.6*30)
        cases.append(dict(name=r['name'],kind='ramp',start=[r['x'],r['base'],r['z']+.5],
                          height=r['base']+r['rise'],endz=r['z']-r['length'],
                          inputs=[dict(w=True) for _ in range(ticks)]))
    # Broad main arches: continuous jumping / slide while going through either side.
    for a in s.MAP['arches']:
        if a['base']>0:continue
        for mode in ['jump','slide']:
            start=[a['x'],0,a['z']+3] if a['axis']=='x' else [a['x']-3,0,a['z']]
            cases.append(dict(name=f"arch {a['x']} {a['z']} {mode}",kind='clearance',start=start,
                              yaw=0 if a['axis']=='x' else -math.pi/2,
                              inputs=[dict(w=True,sprint=True,**{mode:i==5}) for i in range(28)]))
    return cases

class MapTests(unittest.TestCase):
    def test_jump_gaps_ledges_ramps_and_slide_clearance_in_both_engines(self):
        cases=movement_cases()
        # Execute the shipped browser physics directly, not a port or mock.
        script="""import fs from 'node:fs';import {simulate} from './static/physics.js';
const map=JSON.parse(fs.readFileSync('static/map.json'));const cases=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(cases.map(c=>{const [x,y,z]=c.start;const p={x,y,z,yaw:c.yaw||0,vx:0,vy:0,vz:0,grounded:true,slide_ready:0,slide_until:0,jump_held:false,slide_held:false};return c.inputs.map((inp,i)=>{simulate(p,inp,1/30,100+i/30,map.boxes,map.weapons[c.weapon||0]);return {...p};});})));"""
        result=subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(cases),text=True,capture_output=True,cwd=Path(__file__).parent,check=True)
        browser=json.loads(result.stdout)
        for case,js in zip(cases,browser):
            with self.subTest(case=case['name']):
                states=run_case(case);p=states[-1]
                for a,b in zip(states,js):
                    for k in ['x','y','z','vx','vy','vz']:self.assertAlmostEqual(a[k],b[k],places=7)
                if case['kind'] in ['jump','ledge']:
                    target=case['end']
                    self.assertTrue(any(v['grounded'] and abs(v['y']-target[1])<.02 and v['z']<=target[2]+1 for v in states),f'Failed landing: {p}')
                    if case['kind']=='jump':self.assertGreater(max(v['y'] for v in states),case['start'][1]+1)
                elif case['kind']=='ramp':
                    self.assertGreaterEqual(p['y'],case['height']-.02);self.assertLess(p['z'],case['endz']+.1)
                else:
                    self.assertGreater(math.hypot(p['x']-case['start'][0],p['z']-case['start'][2]),6)
                    self.assertFalse(p['crouch'])
                    if case['name'].endswith('slide'):self.assertTrue(any(v['crouch'] for v in states))
                    else:self.assertGreater(max(v['y'] for v in states),1)
    def test_gaps_are_actual_gaps_and_ledges_require_jumping(self):
        for case in movement_cases():
            if case['kind'] not in ['jump','ledge']:continue
            walking={**case,'inputs':[{**v,'jump':False} for v in case['inputs']]}
            states=run_case(walking);target=case['end']
            self.assertFalse(any(v['grounded'] and abs(v['y']-target[1])<.02 and v['z']<=target[2]+1 for v in states),case['name'])

    def test_all_spawns_have_clearance_and_support(self):
        for x,y,z in s.SPAWNS:
            self.assertFalse(any(s.overlaps(x,y,z,b) for b in s.BOXES),(x,y,z))
            if y:self.assertTrue(any(abs(x-b['x'])<b['w']/2 and abs(z-b['z'])<b['d']/2 and abs(y-b['y']-b['h'])<.01 for b in s.BOXES),(x,y,z))
    def test_ground_flanks_and_lane_entrances_connect(self):
        clear={(x,z) for x in range(-38,39) for z in range(-38,39) if not any(s.overlaps(x,0,z,b) for b in s.nearby_boxes(x,z))}
        start=(-20,10);seen={start};queue=deque([start])
        while queue:
            x,z=queue.popleft()
            for dx,dz in [(1,0),(-1,0),(0,1),(0,-1)]:
                q=x+dx,z+dz
                if q in clear and q not in seen and not any(s.overlaps(x+dx/2,0,z+dz/2,b) for b in s.nearby_boxes(x,z,2)):
                    seen.add(q);queue.append(q)
        for x,y,z in s.SPAWNS:
            if y==0:self.assertLess(min(math.hypot(x-a,z-b) for a,b in seen),1.5,(x,z))
        for q in [(-12,-7),(-12,16),(12,-7),(12,16),(0,33),(24,32)]:self.assertIn(q,seen)
    def test_lane_sightlines_are_interrupted(self):
        for x in [-26,0,27]:
            origin=(x,1.55,38);direction=(0,0,-1)
            self.assertTrue(any((d:=s.ray_box(origin,direction,s.bounds(b))) is not None and d<70 for b in s.BOXES),x)
    def test_bridge_underpass_and_roof_have_clearance(self):
        for y in [0,5.5]:
            for x in (range(-15,16) if y==0 else range(-16,17)):self.assertFalse(any(s.overlaps(x,y,-28,b) for b in s.BOXES),(x,y))
    def test_boundaries_contain_players(self):
        for start,yaw in [([-38,0,20],math.pi/2),([38,0,35],-math.pi/2),([0,0,38],math.pi),([0,0,-38],0)]:
            p=run_case(dict(start=start,yaw=yaw,inputs=[dict(w=True,sprint=True)]*60))[-1]
            self.assertLessEqual(max(abs(p['x']),abs(p['z'])),39.18)
    def test_spatial_index_never_omits_colliders(self):
        rng=random.Random(3);counts=[]
        for _ in range(500):
            x,z=rng.uniform(-40,40),rng.uniform(-40,40);r=rng.uniform(.34,1)
            candidates=s.nearby_boxes(x,z,r);counts.append(len(candidates))
            for b in s.BOXES:
                if abs(x-b['x'])<=b['w']/2+r and abs(z-b['z'])<=b['d']/2+r:self.assertIn(b,candidates)
        self.assertLess(sum(counts)/len(counts),len(s.BOXES)/4)
    def test_guide_and_json_regenerate_identically(self):
        root=Path(__file__).parent;before=[(root/p).read_bytes() for p in ['static/map.json','MAP_GUIDE.svg']]
        subprocess.run(['python','build_map.py'],cwd=root,check=True)
        self.assertEqual(before,[(root/p).read_bytes() for p in ['static/map.json','MAP_GUIDE.svg']])

if __name__=='__main__':unittest.main()
