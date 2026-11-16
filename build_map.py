"""Single-source CROSSFIRE map compiler. Always generates one playable city.

python build_map.py
No CROSSFIRE_STAGE31 flag, legacy map, or optional candidate.
"""
import json
from pathlib import Path
from maps.cyberpunk_world import build

ROOT=Path(__file__).parent

def main():
    weapons=json.loads((ROOT/'static/weapons.json').read_text(encoding='utf-8'))
    arena=build(weapons)
    out=ROOT/'static/maps';out.mkdir(exist_ok=True)
    payload=json.dumps(arena,separators=(',',':'))+'\n'
    (out/'cyberpunk.json').write_text(payload,encoding='utf-8')
    (ROOT/'static/map.json').write_text(payload,encoding='utf-8')
    registry={'default':'cyberpunk','maps':[
        {'id':'cyberpunk','name':'Daybreak City','available':True,
         'url':'/static/maps/cyberpunk.json','theme':'modern-daylight'},
    ]}
    (out/'index.json').write_text(json.dumps(registry,indent=2)+'\n',encoding='utf-8')
    # Stale 80 m map guide and old optional candidate are deliberately removed.
    for legacy in (out/'cyberpunk-next.json',ROOT/'MAP_GUIDE.svg'):
        if legacy.exists():legacy.unlink()
    print(f"CROSSFIRE {arena['revision']}: one playable city, "
          f"{arena['size']} m, {len(arena['boxes'])} colliders, "
          f"{len(arena['routes'])} registered routes, "
          f"{len(arena['stairs'])} stair/ramp accesses")

if __name__=='__main__':main()
