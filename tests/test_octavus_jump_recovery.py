"""Regression coverage for jump recovery and multiplayer input overload."""
import unittest

from map_registry import Arena
from movement_live import FIXED_DT, seed_movement, step_player
from server import Room, new_player


class JumpRecoveryTests(unittest.TestCase):
    def test_held_jump_works_after_leaving_low_ceiling(self):
        roof = {'kind': 'building', 'x': 0., 'y': 1.45, 'z': 0.,
                'w': 3., 'h': .3, 'd': 3.}
        arena = Arena({'id': 'ceiling-test', 'boxes': [roof], 'spawns': [[0, 0, 0]]})
        p = seed_movement({
            'x': 0., 'y': 0., 'z': 0., 'vx': 0., 'vy': 0., 'vz': 0.,
            'yaw': 0., 'grounded': True, 'crouch': False,
            'slide_until': 0., 'slide_ready': 0., 'slide_held': False,
            'jump_held': True, 'weapon': 0, 'input': {'jump': True},
            'last_input': 1., 'motion_time': 1.
        })
        # Emulate an attempted takeoff that hit the ceiling and left the
        # consumed flag set while the feet are already back on the ground.
        p['jump_consumed'] = True
        step_player(p, FIXED_DT, 1. + FIXED_DT, arena, [{'speed': 1}])
        self.assertTrue(p['grounded'])
        self.assertFalse(p['jump_consumed'], 'Ground contact must re-arm jumping')
        p['x'] = 4.  # Walk out from underneath the obstructing roof.
        p['motion_time'] += FIXED_DT
        p['last_input'] = p['motion_time']
        step_player(p, FIXED_DT, p['motion_time'], arena, [{'speed': 1}])
        self.assertGreater(p['vy'], 0, 'Held Space must jump in open headroom')
        self.assertFalse(p['grounded'])


class MultiplayerRecoveryTests(unittest.TestCase):
    def test_idle_credit_has_finite_network_stall_limit(self):
        room = Room('MAX')
        player = new_player(room, 'idle', 'Idle', 1., 0)
        for frame in range(40):
            room.step(FIXED_DT, 1. + frame * FIXED_DT)
        self.assertLessEqual(player['move_credit'], .25 + 1e-9)

    def test_delayed_inputs_are_simulated_in_order_not_acknowledged_without_movement(self):
        room = Room('MAX')
        player = new_player(room, 'lag', 'Lagged', 1., 0)
        for seq in range(1, 16):
            player['commands'].append({
                'seq': seq, 'spawn': player['spawn'],
                'yaw': 0., 'pitch': 0., 'input': {'w': True}
            })
        # A 200-ms stall leaves ten or more packets arriving together.
        room.step(.2, 1.2)
        self.assertEqual(player['seq'], 4,
                         'Only four costly collision steps per loop')
        self.assertEqual(len(player['commands']), 11)
        self.assertGreater(player['move_credit'], 2 * FIXED_DT)
        for frame in range(4):
            room.step(FIXED_DT, 1.2 + (frame + 1) * FIXED_DT)
        self.assertEqual(player['seq'], 15,
                         'All fifteen predicted commands must be simulated')
        self.assertEqual(len(player['commands']), 0)
        self.assertEqual(player.get('input_overruns', 0), 0)
        self.assertAlmostEqual(player['motion_time'], 15 * FIXED_DT,
                               msg='All queued movement ticks must be simulated')

    def test_normal_30hz_octavus_input_cadence_is_unchanged(self):
        from server import OCTAVUS_TICK
        room = Room('MAX', 'octavus')
        player = new_player(room, 'cadence', 'Cadence', 100., 0)
        for frame in range(30):
            if frame % 2 == 0:
                player['commands'].append({
                    'seq': frame // 2 + 1, 'spawn': player['spawn'],
                    'yaw': 0., 'pitch': 0., 'input': {'w': True}
                })
            room.step(FIXED_DT, 100. + frame * FIXED_DT)
        self.assertEqual(player['seq'], 15)
        self.assertEqual(len(player['commands']), 0)
        self.assertAlmostEqual(player['motion_time'], 15 * OCTAVUS_TICK)


if __name__ == '__main__':
    unittest.main()
