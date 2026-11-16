"""Daybreak 6.4: authoritative game health, timed regeneration and elimination siphon.
No client-provided health values are accepted.
"""
import math

MAX_HEALTH=200
KILL_SIPHON=50
REGEN_DELAY=5.0
REGEN_PER_SECOND=10.0

def reset_health(p,now):
    p['hp']=MAX_HEALTH
    p['regen_after']=now+REGEN_DELAY
    p['regen_clock']=now
    p['regen_credit']=0.0

def take_damage(p,amount,now):
    damage=max(0,int(amount))
    before=max(0,int(p['hp']))
    p['hp']=max(0,before-damage)
    if before>p['hp']:
        p['regen_after']=now+REGEN_DELAY
        p['regen_clock']=now
        p['regen_credit']=0.0
    return before-p['hp']

def siphon(p):
    if p['hp']<=0:return 0
    amount=min(KILL_SIPHON,MAX_HEALTH-p['hp'])
    p['hp']+=amount
    if p['hp']>=MAX_HEALTH:p['regen_credit']=0.0
    return amount

def regenerate(p,now):
    if p['hp']<=0 or p['hp']>=MAX_HEALTH:
        p['regen_clock']=now
        p['regen_credit']=0.0
        return 0
    from_time=max(p.get('regen_clock',now),p.get('regen_after',now))
    elapsed=max(0.0,now-from_time)
    p['regen_clock']=now
    total=p.get('regen_credit',0.0)+elapsed*REGEN_PER_SECOND
    points=min(MAX_HEALTH-p['hp'],int(total+1e-8))
    p['hp']+=points
    p['regen_credit']=max(0.0,total-points) if p['hp']<MAX_HEALTH else 0.0
    return points
