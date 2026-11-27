"""Operator 03 multiplayer cosmetics; server is authoritative on team uniforms."""
import unittest
from operator03_skins import (
    OPERATOR_SKINS,normalize_operator_skin,effective_operator_skin
)
import server as s

class Operator03SkinTests(unittest.TestCase):
    def test_palette_and_validation(self):
        self.assertEqual(len(OPERATOR_SKINS),8)
        self.assertEqual(len(set(OPERATOR_SKINS)),8)
        self.assertEqual(normalize_operator_skin('desert'),'desert')
        for invalid in ('WHITE','black','<script>',None,99,''):
            self.assertEqual(normalize_operator_skin(invalid),'woodland')

    def test_ffa_manual_selection_and_lobby_update(self):
        room=s.Room('SKIN03')
        player=s.new_player(room,'a','Operator',100,operator_skin='navy_digital')
        self.assertEqual(player['operator_skin_choice'],'navy_digital')
        self.assertTrue(room.set_operator_skin('a','jungle'))
        state=room.snapshot(100)['players'][0]
        self.assertEqual(state['operator_skin_choice'],'jungle')
        self.assertEqual(state['operator_skin'],'jungle')
        self.assertFalse(room.set_operator_skin('a','invalid'))
        self.assertFalse(room.set_operator_skin('someone-else','shadow'))

    def test_team_modes_force_white_black_not_personal_skins(self):
        room=s.Room('TEAM03')
        s.new_player(room,'a','First',100,operator_skin='desert')
        s.new_player(room,'b','Second',100,operator_skin='jungle')
        self.assertTrue(room.set_mode('a','teamdeathmatch'))
        state=room.snapshot(100)
        byteam={p['team']:p for p in state['players']}
        self.assertEqual(byteam['azure']['operator_skin'],'arctic')
        self.assertEqual(byteam['ember']['operator_skin'],'shadow')
        self.assertEqual(byteam['azure']['operator_skin_choice'],'desert')
        self.assertEqual(byteam['ember']['operator_skin_choice'],'jungle')
        self.assertTrue(room.set_mode('a','control'))
        self.assertEqual({p['operator_skin'] for p in room.snapshot(100)['players']},
                         {'arctic','shadow'})
        self.assertTrue(room.set_mode('a','deathmatch'))
        self.assertEqual({p['operator_skin'] for p in room.snapshot(100)['players']},
                         {'desert','jungle'})

    def test_changes_blocked_after_match_starts(self):
        room=s.Room('LOCK03')
        player=s.new_player(room,'a','First',100)
        self.assertTrue(room.set_ready('a',True))
        self.assertTrue(room.start('a',101))
        self.assertFalse(room.set_operator_skin('a','arctic'))
        self.assertEqual(player['operator_skin_choice'],'woodland')

    def test_bots_always_shadow(self):
        self.assertEqual(effective_operator_skin({'bot':True},'botmatch'),'shadow')

if __name__=='__main__': unittest.main()
