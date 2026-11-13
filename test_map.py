"""District reachability, traversal and broad-phase regression checks."""
import math, random, unittest
from collections import deque
import server as s

class DistrictTests(unittest.TestCase):
    def player(self,x,z,y=0,yaw=0):
        r=s.Room('MAP');p=s.new_player(r,'p','Tester',100)
        p.update(x=x,y=y,z=z,yaw=yaw,grounded=True,vx=0,vy=0,vz=0,input={'w':True})
        return p
    def walk(self,p,ticks):
        for i in range(ticks):
            now=100+i*s.TICK;p['last_input']=now;s.move(p,s.TICK,now)
    def test_ground_routes_connect_all_districts_and_spawns(self):
        # A two-metre grid is deliberately stricter than the player's 0.64 m width.
        clear={(x,z) for x in range(-50,51,2) for z in range(-50,51,2)
               if not any(s.overlaps(x,0,z,b) for b in s.BOXES)}
        start=(0,-20);seen={start};queue=deque([start])
        while queue:
            x,z=queue.popleft()
            for dx,dz in [(2,0),(-2,0),(0,2),(0,-2)]:
                q=(x+dx,z+dz)
                # Also check midpoint, so a thin wall cannot be skipped.
                if q in clear and q not in seen and not any(s.overlaps(x+dx/2,0,z+dz/2,b) for b in s.BOXES):
                    seen.add(q);queue.append(q)
        for x,y,z in s.SPAWNS:
            if y==0:self.assertLess(min(math.hypot(x-a,z-b) for a,b in seen),2.5,(x,z))
        for point in [(0,-46),(0,46),(-46,0),(46,0),(-26,0),(26,0)]:self.assertIn(point,seen)
        self.assertGreater(len(seen)/len(clear),.98)
    def test_four_new_stairs_reach_roofs(self):
        for x in [-13,13]:
            for sign in [-1,1]:
                p=self.player(x,20*sign,yaw=0 if sign==-1 else math.pi)
                self.walk(p,70)
                self.assertAlmostEqual(p['y'],4,msg=str((x,sign,p['z'])))
                self.assertGreater(abs(p['z']),29)
    def test_new_bridges_have_underpass_and_roof_crossing(self):
        for z in [-34,34]:
            p=self.player(0,z+5);self.walk(p,55)
            self.assertLess(p['z'],z-4);self.assertEqual(p['y'],0)
            p=self.player(-6,z,y=4,yaw=-math.pi/2);self.walk(p,75)
            self.assertGreater(p['x'],7);self.assertAlmostEqual(p['y'],4)
    def test_boundary_cannot_be_walked_through(self):
        for x,z,yaw in [(50,0,-math.pi/2),(-50,0,math.pi/2),(0,50,math.pi),(0,-50,0)]:
            p=self.player(x,z,yaw=yaw);self.walk(p,60)
            self.assertLessEqual(max(abs(p['x']),abs(p['z'])),51.18)
    def test_spatial_index_never_omits_nearby_colliders(self):
        rng=random.Random(3);counts=[]
        for _ in range(1000):
            x,z=rng.uniform(-52,52),rng.uniform(-52,52);r=rng.uniform(.34,1)
            candidates=s.nearby_boxes(x,z,r);counts.append(len(candidates))
            for b in s.BOXES:
                if abs(x-b['x'])<=b['w']/2+r and abs(z-b['z'])<=b['d']/2+r:self.assertIn(b,candidates)
        self.assertLess(sum(counts)/len(counts),len(s.BOXES)/5)
    def test_all_spawn_points_have_floor_and_clearance(self):
        self.assertEqual(len(s.SPAWNS),16)
        for x,y,z in s.SPAWNS:
            self.assertFalse(any(s.overlaps(x,y,z,b) for b in s.BOXES))
            if y:self.assertTrue(any(abs(x-b['x'])<b['w']/2 and abs(z-b['z'])<b['d']/2 and y==b['y']+b['h'] for b in s.BOXES))
    def test_respawn_prefers_safe_nearby_fight_over_empty_corner(self):
        r=s.Room('S');enemy=s.new_player(r,'a','Enemy',100);enemy.update(x=0,y=0,z=0)
        p=s.new_player(r,'b','Respawn',100)
        self.assertGreater(math.hypot(p['x'],p['z']),14)
        self.assertLess(math.hypot(p['x'],p['z']),40)

if __name__=='__main__':unittest.main()
