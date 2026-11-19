"""Regression checks for Octavus 30Hz landings and low ceilings.

Run with: python -m unittest discover -s tests -p test_octavus_motion.py
The lightweight fake world keeps tests independent from the 86,500-triangle
production map, while a second test calls the real indexed ground query.
"""
import unittest
from array import array

from dust_motion65 import dust_step65
from octavus_world import OctavusWorld


class _Collision:
    native_step_assist = True


class _FloorWorld:
    collision = _Collision()
    bounds = {'x0': -5, 'x1': 5, 'z0': -5, 'z1': 5}

    def __init__(self, floor=0.0, clearance=True):
        self.floor = floor
        self.clearance = clearance
        self.probes = []

    def candidates(self, *_):
        return ()

    def inside(self, x, z, margin=0.34):
        return True

    def ground_at(self, x, z, feet_y=0.0, drop=1.0):
        self.probes.append(drop)
        if self.floor is None:
            return None
        return self.floor if feet_y - drop < self.floor < feet_y + .48 else None

    def capsule_clear(self, *_):
        return self.clearance

    def raycast(self, *_):
        return None


def _player(**overrides):
    player = {
        'x': 0.0, 'y': 0.0, 'z': 0.0,
        'vx': 0.0, 'vy': 0.0, 'vz': 0.0,
        'yaw': 0.0, 'grounded': True, 'crouch': False,
        'slide_until': 0.0, 'jump_held': False, 'slide_held': False,
        'input': {}, 'last_input': 1.0,
    }
    player.update(overrides)
    return player


class OctavusMovementTests(unittest.TestCase):
    def test_fast_fall_lands_on_thin_platform(self):
        world = _FloorWorld(floor=.25)
        p = _player(y=1.4, vy=-35.0, grounded=False)
        dust_step65(p, 1 / 30, 1.0, {'speed': 1}, world)
        self.assertTrue(p['grounded'])
        self.assertAlmostEqual(p['y'], .25)
        self.assertEqual(p['vy'], 0)
        self.assertGreater(world.probes[-1], 1.0)

    def test_fast_fall_does_not_land_before_reaching_floor(self):
        world = _FloorWorld(floor=.10)
        p = _player(y=1.4, vy=-35.0, grounded=False)
        dust_step65(p, 1 / 30, 1.0, {'speed': 1}, world)
        self.assertFalse(p['grounded'])
        self.assertAlmostEqual(p['y'], 1.4 - 35 / 30)

    def test_low_ceiling_blocks_standing_jump(self):
        world = _FloorWorld(floor=0, clearance=False)
        p = _player(crouch=True, input={'jump': True})
        dust_step65(p, 1 / 30, 1.0, {'speed': 1}, world)
        self.assertTrue(p['crouch'])
        self.assertTrue(p['grounded'])
        self.assertAlmostEqual(p['y'], 0)
        self.assertFalse(p.get('jump_consumed', False))

    def test_clear_ceiling_allows_normal_jump(self):
        world = _FloorWorld(floor=0, clearance=True)
        p = _player(input={'jump': True})
        dust_step65(p, 1 / 30, 1.0, {'speed': 1}, world)
        self.assertFalse(p['grounded'])
        self.assertGreater(p['y'], 0)

    def test_original_dust_uses_legacy_three_argument_probe(self):
        class _LegacyFloor(_FloorWorld):
            class collision:
                native_step_assist = False

            def ground_at(self, x, z, feet_y=0.0):
                return self.floor if feet_y - 1.0 < self.floor < feet_y + .48 else None

        world = _LegacyFloor(floor=.9)
        p = _player(y=1.4, vy=-35.0, grounded=False)
        dust_step65(p, 1 / 60, 1.0, {'speed': 1}, world)
        self.assertTrue(p['grounded'])
        self.assertAlmostEqual(p['y'], .9)

    def test_real_octavus_index_uses_extended_downward_range(self):
        # Construct one authored-style horizontal triangle without loading
        # large source assets. Invoke OctavusWorld's real ground_at method.
        world = object.__new__(OctavusWorld)
        world.cell = 10.0
        world.cells = {(0, 0): (0,)}
        world.points = array('f', [
            -1, .25, -1,  1, .25, -1,  0, .25, 1,
        ])
        world.ground_xz_bounds = array('f', [-1, 1, -1, 1])
        world.wall_y_bounds = array('f', [.25, .25])
        world.wall_normals = array('f', [0, -4, 0])
        self.assertIsNone(world.ground_at(0, 0, 1.4))
        self.assertAlmostEqual(world.ground_at(0, 0, 1.4, 1.26), .25)


if __name__ == '__main__':
    unittest.main()
