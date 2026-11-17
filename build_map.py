"""Single-source CROSSFIRE compiler for Daybreak and optional native maps.

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
    # CROSSFIRE 6.5: compile the original Dust Corridor world-contract map.
    # Visual geometry and collision remain in the pinned upstream generator/
    # DUSTCOL3 mesh; JSON contains only lobby metadata and safe native spawns.
    from dust_world64 import get_dust_world64
    dust=get_dust_world64()
    validated=dust.validated_spawns()
    # Never silently register a world without both valid spawn sides.
    if not all(validated[side]['safeIndices'] for side in ('A','B')):
        raise RuntimeError('Dust Corridor has no validated spawn set')
    dust_spawns=[dust.spawns[side][i]
                 for side in ('A','B') for i in validated[side]['safeIndices']]
    dust_map={
        'id':'dust_corridor','name':'Dust Corridor',
        'revision':'06.5','size':160,'center':{'x':0,'z':0},
        'theme':'sandstone-market','engine':'crossfire-three-original-geometry',
        'dustOriginal':True,'collisionFormat':'DUSTCOL3',
        'collisionSha256':dust.sha256,
        'weapons':weapons,'spawns':dust_spawns,
        'boxes':[],'decor':[],'signs':[],'features':[],'practiceTargets':[],
        'routes':[],'stairs':[],'palette':{'building':'#8f7756'},
        'zones':[
            {'name':'SOUTH STREET','x':0,'z':-54,'w':86,'d':44,'color':'#c8a475'},
            {'name':'MARKET LANES','x':0,'z':-11,'w':86,'d':46,'color':'#b18e64'},
            {'name':'NORTH PLAZA','x':0,'z':48,'w':86,'d':52,'color':'#d7b787'}],
        'playBounds':dust.bounds,'spawnSets':dust.spawns,
        'validatedSpawns':validated
    }
    (out/'dust_corridor.json').write_text(
        json.dumps(dust_map,separators=(',',':'))+'\n',encoding='utf-8')
    registry['maps'].append({
        'id':'dust_corridor','name':'Dust Corridor',
        'available':True,'url':'/static/maps/dust_corridor.json',
        'theme':'sandstone-market','engine':'crossfire-three-original-geometry'})
    (out/'index.json').write_text(json.dumps(registry,indent=2)+'\n',encoding='utf-8')
    # Stale 80 m map guide and old optional candidate are deliberately removed.
    for legacy in (out/'cyberpunk-next.json',ROOT/'MAP_GUIDE.svg'):
        if legacy.exists():legacy.unlink()
    print(f"CROSSFIRE {arena['revision']}: one playable city, "
          f"{arena['size']} m, {len(arena['boxes'])} colliders, "
          f"{len(arena['routes'])} registered routes, "
          f"{len(arena['stairs'])} stair/ramp accesses")

if __name__=='__main__':main()
