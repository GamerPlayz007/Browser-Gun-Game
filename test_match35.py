"""Stage 3.5 — server-authoritative match progression and results tests."""
import unittest
import server as s
from match35 import goal,tier_for_kills,standings,leading_player,timed_winner,rules
from test_server import duel

class MatchRulesTests(unittest.TestCase):
    def test_scoring_targets_are_shared_with_browser_snapshots(self):
        self.assertEqual(goal('deathmatch',4),15)
        self.assertEqual(goal('gungame',4),12)
        self.assertEqual([tier_for_kills(k,4) for k in (0,2,3,5,6,8,9,11,12)],
                         [0,0,1,1,2,2,3,3,3])
        self.assertEqual(rules('gungame',4),{
            'goal':12,'duration':360,'countdown':3,'respawn':3,
            'teamBased':False,'controlPoint':False,'bots':0,'botGoal':0,
            'killsPerTier':3,'tiers':4})
        self.assertEqual(rules('botmatch',4)['goal'],20)
        self.assertEqual(rules('botmatch',4)['bots'],4)
        self.assertEqual(rules('botmatch',4)['botGoal'],12)

    def test_leaderboard_sorting_shared_ranks_and_unique_ids(self):
        r,a,b=duel()
        self.assertIsNone(leading_player(r.players))
        a.update(kills=7,deaths=4,headshots=1,streak=2,best_streak=5)
        b.update(kills=6,deaths=0,headshots=3)
        x=standings(r.players)
        self.assertEqual([p['id'] for p in x],['a','b'])
        self.assertEqual([p['rank'] for p in x],[1,2])
        self.assertEqual(x[0]['bestStreak'],5)
        b['kills']=7;b['deaths']=4;b['headshots']=0
        x=standings(r.players)
        self.assertEqual([p['rank'] for p in x],[1,1])
        self.assertIsNone(leading_player(r.players))
        self.assertIsNone(timed_winner(r.players))
        b['deaths']=5
        self.assertEqual(timed_winner(r.players)['id'],'a')
        self.assertEqual(leading_player(r.players),'a')

    def test_round_start_blocks_non_host_and_resets_state(self):
        r,a,b=duel('gungame')
        r.phase='results';r.winner='Alpha';r.winner_id='a';r.next_mode='gungame'
        a.update(kills=10,deaths=5,headshots=3,streak=4,best_streak=8,
                 weapon=3,ammo=1,shield=0)
        b.update(kills=2,streak=2,best_streak=2)
        r.targets[0]['hp']=0;r.targets[0]['reset_at']=300
        r.record_poses(200)
        self.assertFalse(r.start('b',201))
        self.assertTrue(r.start('a',201))
        self.assertEqual(r.phase,'countdown')
        self.assertEqual(r.round_number,1)
        self.assertEqual(r.countdown_at,204)
        self.assertIsNone(r.winner_id)
        self.assertIsNone(r.win_reason)
        self.assertFalse(r.pose_history)
        for p in (a,b):
            self.assertEqual((p['kills'],p['deaths'],p['headshots'],
                              p['streak'],p['best_streak']), (0,0,0,0,0))
            self.assertEqual(p['weapon'],0)
            self.assertEqual(p['ammo'],s.WEAPONS[0]['mag'])
        self.assertTrue(all(t['hp']==100 and not t['reset_at'] for t in r.targets))
        self.assertFalse(r.start('a',201.2))
        self.assertFalse(r.shoot(a,201.3))
        r.step(s.TICK,204.1)
        self.assertEqual(r.phase,'playing')
        self.assertEqual(r.started,204.1)
        self.assertTrue(any(e['type']=='round_start' for e in r.events))
        self.assertTrue(a['shield']>204.1)
        snapshot=r.snapshot(204.1)
        self.assertEqual(snapshot['round'],1)
        self.assertEqual(snapshot['rules']['goal'],12)
        self.assertEqual(len(snapshot['standings']),2)

    def test_next_match_mode_can_change_only_between_rounds(self):
        r,a,b=duel()
        r.phase='lobby'
        self.assertFalse(r.set_mode('b','gungame'))
        self.assertTrue(r.set_mode('a','gungame'))
        self.assertEqual((r.mode,r.next_mode),('gungame','gungame'))
        self.assertTrue(r.start('a',101))
        self.assertFalse(r.set_mode('a','deathmatch'))
        self.assertEqual(r.mode,'gungame')
        r.step(s.TICK,104.1)
        self.assertEqual(r.phase,'playing')
        self.assertFalse(r.set_mode('a','deathmatch'))
        self.assertTrue(r.finish(500,a,reason='score'))
        self.assertTrue(r.set_mode('a','deathmatch'))
        self.assertEqual(r.mode,'gungame','Completed match mode must stay unchanged')
        self.assertEqual(r.next_mode,'deathmatch')
        state=r.snapshot(501)
        self.assertEqual((state['mode'],state['nextMode']),('gungame','deathmatch'))
        self.assertEqual(state['winReason'],'score')
        self.assertTrue(r.start('a',502))
        self.assertEqual(r.mode,'deathmatch')
        self.assertEqual(r.snapshot(502)['rules']['goal'],15)

    def test_deathmatch_goal_freezes_winner_and_reports_result(self):
        r,a,b=duel()
        r.round_number=1
        a['kills']=14
        b.update(hp=1,shield=0)
        self.assertTrue(r.shoot(a,101,shot_id=1))
        self.assertEqual(r.phase,'results')
        self.assertEqual(r.winner_id,'a')
        self.assertEqual(r.winner,'Alpha')
        self.assertEqual(r.win_reason,'score')
        self.assertEqual(a['kills'],15)
        self.assertTrue(any(e['type']=='round_end' and e['winnerId']=='a'
                            for e in r.events))
        before=len(r.events)
        self.assertFalse(r.shoot(a,103,shot_id=2))
        self.assertFalse(r.finish(104,reason='time'))
        self.assertEqual(len(r.events),before)
        snap=r.snapshot(105)
        self.assertEqual((snap['winnerId'],snap['winReason']),('a','score'))
        self.assertEqual(snap['standings'][0]['kills'],15)

    def test_gungame_tier_milestones_streak_and_final(self):
        r,a,b=duel('gungame')
        r.round_number=1
        for stage,(kills,tier) in enumerate(((2,1),(5,2),(8,3),(11,3))):
            now=101+3*stage
            a.update(kills=kills,weapon=stage,ammo=s.WEAPONS[stage]['mag'],
                     last_shot=-999,switch_at=0,reload_at=0)
            b.update(hp=1,shield=0,respawn_at=0)
            self.assertTrue(r.shoot(a,now,shot_id=stage+1))
            self.assertEqual(a['kills'],kills+1)
            self.assertEqual(a['weapon'],tier)
            if stage<3:
                self.assertTrue(any(e['type']=='tier_up' and e['tier']==stage+2
                                    and e['id']=='a' for e in r.events))
            r.select(a,3,now+1)
            self.assertEqual(a['weapon'],tier)
        self.assertEqual(r.phase,'results')
        self.assertEqual((r.winner_id,r.win_reason),('a','score'))
        self.assertTrue(any(e['type']=='streak' and e['count']==3 for e in r.events))
        self.assertEqual(a['best_streak'],4)

    def test_timer_tiebreaker_and_draw(self):
        for deaths_a,deaths_b,expected in ((1,2,'Alpha'),(1,1,'DRAW')):
            r,a,b=duel()
            r.round_number=1
            a.update(kills=7,deaths=deaths_a)
            b.update(kills=7,deaths=deaths_b)
            r.started=100
            r.step(s.TICK,460.01)
            self.assertEqual(r.phase,'results')
            self.assertEqual(r.winner,expected)
            self.assertEqual(r.win_reason,'time')
            self.assertEqual(r.winner_id,'a' if expected=='Alpha' else None)
            self.assertEqual(r.snapshot(460.02)['remaining'],0)

    def test_rematch_increments_round_and_discards_old_result(self):
        r,a,b=duel()
        r.round_number=1
        r.finish(110,a,reason='score')
        self.assertTrue(r.start('a',115))
        self.assertEqual(r.round_number,2)
        self.assertEqual(r.phase,'countdown')
        self.assertIsNone(r.winner)
        self.assertFalse(any(e['type']=='round_end' for e in r.events))
        self.assertEqual([e['type'] for e in r.events],['countdown'])

if __name__=='__main__':unittest.main()
