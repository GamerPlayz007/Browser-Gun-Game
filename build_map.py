"""Deterministic arena compiler: python build_map.py."""
import json
from pathlib import Path
from maps.cyberpunk import build, guide
ROOT=Path(__file__).parent

def main():
    arena=build(json.loads((ROOT/'static/weapons.json').read_text()))
    out=ROOT/'static/maps';out.mkdir(exist_ok=True)
    payload=json.dumps(arena,separators=(',',':'))+'\n'
    (out/'cyberpunk.json').write_text(payload)
    (ROOT/'static/map.json').write_text(payload)
    registry={'default':'cyberpunk','maps':[
        {'id':'cyberpunk','name':'Cyberpunk City','available':True,'url':'/static/maps/cyberpunk.json','theme':'cyberpunk'},
        {'id':'rainforest','name':'Lush Rainforest','available':False,'theme':'rainforest'},
        {'id':'solstice','name':'Solstice (Sandstone)','available':False,'theme':'sandstone'}]}
    (out/'index.json').write_text(json.dumps(registry,indent=2)+'\n')
    (ROOT/'MAP_GUIDE.svg').write_text(guide(arena))
    print(f"02.4: {len(arena['boxes'])} colliders; 12 connections; {len(arena['stairs'])} access ramps")
if __name__=='__main__':main()
