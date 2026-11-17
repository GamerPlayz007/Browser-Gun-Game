"""Stage 3.1: original Octavus geometry movement and visibility regressions."""
from array import array
import math
import unittest
from unittest.mock import patch

from map_registry import Arena
from dust_world64 import DustWorld64
from dust_motion65 import DT, dust_step65
from bot57 import visible


def square(a, b, c, d):
    return ((a,b,c),(a,c,d))


class SyntheticCollision:
    native_step_assist = True
    cell_size = 4
    def __init__(self,triangles):
        data=array('f')
        for tri in triangles:
            for p in tri:
                data.extend(p)
        self.vertices=data.tobytes()
        self.count=len(triangles)
        self.metadata={
            'rawSha256':'synthetic-test-scene',
            'spawns':{},
            'playBounds':{'x0':-5,'x1':5,'z0':-5,'z1':5}
        }
    def surface(self,_index):return 0


def fixture(step_height,ceiling=False):
    tris=[]
    def add(*triangles):tris.extend(triangles)
    add(*square((-5,0,-5),(-5,0,5),(5,0,5),(5,0,-5)))
    add(*square((0,step_height,-3),(3,step_height,-3),
                (3,step_height,3),(0,step_height,3)))
    add(*square((0,0,-3),(0,step_height,-3),
                (0,step_height,3),(0,0,3)))
    if ceiling:
        add(*square((-2,1.24,-2),(2,1.24,-2),(2,1.24,2),(-2,1.24,2)))
    return DustWorld64(SyntheticCollision(tris))


def make_player(x=-.6, crouch=False):
    return dict(x=x,y=0.,z=0.,vx=0.,vy=0.,vz=0.,yaw=0.,
                crouch=crouch,grounded=True,slide_until=0.,slide_ready=0.,
                jump_held=False,slide_held=False,last_input=100.,
                input={'d':True},jump_consumed=False,jump_cut=False)


class OctavusStage31Tests(unittest.TestCase):
    def test_native_stairs_are_walkable_but_tall_walls_are_not(self):
        for height,expected in [(.24,True),(2.2,False)]:
            with self.subTest(height=height):
                world=fixture(height)
                p=make_player()
                for i in range(55):
                    now=100+i*DT
                    p['last_input']=now
                    dust_step65(p,DT,now,{'speed':1},world)
                if expected:
                    self.assertGreater(p['x'],.5,p)
                    self.assertAlmostEqual(p['y'],height,delta=.06)
                else:
                    self.assertLess(p['x'],-.28,p)
                    self.assertLess(abs(p['y']),.05)

    def test_uncontrolled_standing_is_blocked_by_original_roof(self):
        world=fixture(0.24,ceiling=True)
        p=make_player(-2.5,crouch=True)
        p.update(x=-2,y=0,z=0,input={'crouch':False})
        self.assertTrue(world.capsule_clear((p['x'],p['y'],p['z']),1.12))
        self.assertFalse(world.capsule_clear((p['x'],p['y'],p['z']),1.8))
        dust_step65(p,DT,100,{'speed':1},world)
        self.assertTrue(p['crouch'])

    def test_original_triangles_block_bot_visibility(self):
        world=fixture(2.2)
        arena=Arena({'id':'octavus','boxes':[], 'spawns':[]})
        with patch('octavus_world.get_octavus_world',return_value=world):
            self.assertFalse(visible(arena,(-1,1.3,0),(1,1.3,0)))
            self.assertTrue(visible(arena,(-1,3.3,0),(1,3.3,0)))


if __name__=='__main__':
    unittest.main()
