"""Octavus 3.5: server input cadence and authoritative backlog regression."""
import unittest

from server import Room, new_player, TICK, OCTAVUS_TICK


class OctavusInputCadenceTests(unittest.TestCase):
    def test_30hz_commands_do_not_build_a_queue(self):
        self.assertAlmostEqual(OCTAVUS_TICK, 1/30)
        room = Room('MAX', 'octavus')
        player = new_player(room, 'cadence-test', 'Test', 100., 0)
        for frame in range(120):
            if frame % 2 == 0:
                sequence = frame // 2 + 1
                player['commands'].append({
                    'seq': sequence,
                    'spawn': player['spawn'],
                    'yaw': 0.,
                    'pitch': 0.,
                    'input': {'w': True}
                })
            room.step(TICK, 100. + frame * TICK)
            self.assertLessEqual(len(player['commands']), 1)
        self.assertEqual(player['seq'], 60)
        self.assertEqual(len(player['commands']), 0)
        self.assertEqual(player.get('input_overruns', 0), 0)
        self.assertAlmostEqual(player['motion_time'], 2., delta=.0001)
        self.assertEqual(room.snapshot(102.)['tickRate'], 30)


if __name__ == '__main__':
    unittest.main()
