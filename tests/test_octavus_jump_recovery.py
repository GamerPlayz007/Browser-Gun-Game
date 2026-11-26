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
    def test_idle_player_cannot_bank_large_physics_burst(self):
        room = Room('MAX')
        player = new_player(room, 'idle', 'Idle', 1., 0)
        for frame in range(40):
            room.step(FIXED_DT, 1. + frame * FIXED_DT)
        self.assertLessEqual(player['move_credit'], 2 * FIXED_DT + 1e-9)

    def test_old_inputs_are_discarded_in_favor_of_recent_directions(self):
        room = Room('MAX')
        player = new_player(room, 'lag', 'Lagged', 1., 0)
        for seq in range(1, 16):
            player['commands'].append({
                'seq': seq, 'spawn': player['spawn'],
                'yaw': 0., 'pitch': 0., 'input': {'w': True}
            })
        room.step(FIXED_DT, 1. + FIXED_DT)
        self.assertGreaterEqual(player['input_overruns'], 11)
        self.assertLessEqual(len(player['commands']), 4)
        self.assertGreaterEqual(player['seq'], 12)


if __name__ == '__main__':
    unittest.main()
