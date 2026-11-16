"""Daybreak 6.4 game health and fast-switch integration regressions."""
import unittest
from unittest.mock import patch
import server
from combat64 import (MAX_HEALTH,KILL_SIPHON,REGEN_DELAY,REGEN_PER_SECOND,
                      reset_health,take_damage,siphon,regenerate)
from test_server import duel

class HealthMechanics64(unittest.TestCase):
    def test_damage_delay_fractional_regeneration_and_reset(self):
        p={'hp':MAX_HEALTH}
        reset_health(p,100.)
        self.assertEqual(p['hp'],200)
        self.assertEqual(take_damage(p,65,101.),65)
        self.assertEqual((p['hp'],p['regen_after']),(135,106.))
        self.assertEqual(regenerate(p,105.999),0)
        self.assertEqual(regenerate(p,106.05),0)
        self.assertEqual(regenerate(p,106.2),2)
        self.assertEqual(p['hp'],137)
        self.assertEqual(regenerate(p,107.7),15)
        self.assertEqual(p['hp'],152)
        self.assertEqual(take_damage(p,25,108.),25)
        self.assertEqual(regenerate(p,112.9),0)
        self.assertEqual(regenerate(p,113.5),5)
        self.assertEqual(p['hp'],132)

    def test_siphon_caps_at_200_and_ignores_dead_players(self):
        p={}
        reset_health(p,100.)
        take_damage(p,90,101.)
        self.assertEqual(siphon(p),50)
        self.assertEqual(p['hp'],160)
        self.assertEqual(siphon(p),40)
        self.assertEqual(siphon(p),0)
        take_damage(p,999,102.)
        self.assertEqual(p['hp'],0)
        self.assertEqual(siphon(p),0)
        self.assertEqual(regenerate(p,1000.),0)

    def test_real_match_kill_siphon_and_snapshot(self):
        r,a,b=duel()
        self.assertEqual((a['hp'],b['hp']),(200,200))
        self.assertEqual(r.snapshot(100)['maxHp'],200)
        take_damage(a,80,100.5)
        b.update(hp=1,shield=0)
        with patch.object(server.random,'uniform',return_value=0):
            self.assertTrue(r.shoot(a,101.,shot_id=1))
        self.assertEqual(a['hp'],170)
        self.assertEqual(b['hp'],0)
        self.assertEqual(a['kills'],1)
        kill=next(e for e in r.events if e['type']=='kill')
        self.assertEqual(kill['siphon'],50)
        data=r.snapshot(102.)
        self.assertEqual(next(p['hp'] for p in data['players'] if p['id']=='a'),170)
        self.assertEqual(next(p['regenDelay'] for p in data['players'] if p['id']=='a'),3.5)
        r.step(server.TICK,106.)
        self.assertEqual(a['hp'],175)
        self.assertEqual(b['hp'],200,'Respawn restores 200 HP')

    def test_switch_is_immediate_without_overriding_fire_rate(self):
        r,a,b=duel()
        a['ammo']=2
        r.select(a,1,101.)
        self.assertEqual(a['weapon'],1)
        self.assertEqual(a['switch_at'],101.)
        self.assertTrue(r.shoot(a,101.001,shot_id=1),'No post-switch lockout')
        self.assertFalse(r.shoot(a,101.02,shot_id=2),'Fire cadence still enforced')
        r.select(a,0,101.03)
        self.assertEqual(a['ammo'],2,'Earlier magazine is retained')
        self.assertFalse(r.shoot(a,101.04,shot_id=3),'Switch cannot bypass cadence')
        self.assertTrue(r.shoot(a,101.15,shot_id=4))
        self.assertEqual(a['ammo'],1)
        self.assertEqual(r.snapshot(101.15)['players'][0]['switch'],0.)

    def test_combat_does_not_heal_during_results(self):
        r,a,b=duel()
        take_damage(a,100,101.)
        r.finish(102.,reason='time')
        r.step(server.TICK,115.)
        self.assertEqual(a['hp'],100)

if __name__=='__main__':unittest.main()
