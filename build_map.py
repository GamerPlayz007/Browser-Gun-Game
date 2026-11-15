"""Deterministic arena compiler.

Run python build_map.py for the unchanged production map.
Set CROSSFIRE_STAGE31=1 to also generate a selectable EXPERIMENTAL city.
This opt-in is intentionally disabled on production/main.
"""
import json
import os
from pathlib import Path
from maps.cyberpunk import build, guide

ROOT = Path(__file__).parent

def main():
    weapons = json.loads((ROOT / 'static/weapons.json').read_text())
    arena = build(weapons)
    out = ROOT / 'static/maps'
    out.mkdir(exist_ok=True)
    payload = json.dumps(arena, separators=(',', ':')) + '\n'
    (out / 'cyberpunk.json').write_text(payload)
    (ROOT / 'static/map.json').write_text(payload)
    registry = {'default': 'cyberpunk', 'maps': [
        {'id': 'cyberpunk', 'name': 'Cyberpunk City', 'available': True,
         'url': '/static/maps/cyberpunk.json', 'theme': 'cyberpunk'},
        {'id': 'rainforest', 'name': 'Lush Rainforest', 'available': False, 'theme': 'rainforest'},
        {'id': 'solstice', 'name': 'Solstice (Sandstone)', 'available': False, 'theme': 'sandstone'},
    ]}
    if os.environ.get('CROSSFIRE_STAGE31') == '1':
        from maps.cyberpunk_next import build as build_next
        candidate = build_next(weapons)
        (out / 'cyberpunk-next.json').write_text(json.dumps(candidate, separators=(',', ':')) + '\n')
        registry['maps'].insert(1, {
            'id': 'cyberpunk-next',
            'name': candidate['name'],
            'available': True,
            'url': '/static/maps/cyberpunk-next.json',
            'theme': 'cyberpunk',
        })
        print(f"Stage 3.1 candidate: {len(candidate['boxes'])} colliders, "
              f"{len(candidate['routes'])} registered routes, "
              f"{candidate['size']} m.")
    (out / 'index.json').write_text(json.dumps(registry, indent=2) + '\n')
    (ROOT / 'MAP_GUIDE.svg').write_text(guide(arena))
    print(f"02.5 default: {len(arena['boxes'])} colliders; "
          f"{len(arena['routes'])} connections; {len(arena['stairs'])} access ramps")

if __name__ == '__main__':
    main()
