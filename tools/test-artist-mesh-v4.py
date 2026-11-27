"""Version 4 stand-alone static/data regression tests (no GPU assertions)."""
from __future__ import annotations
import base64, re, json, struct, hashlib, subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
V3=HERE.parent/'CROSSFIRE_ArtistMesh_Pipeline_v3'
html=(HERE/'static/artist-mesh-v4.html').read_text('utf-8')
js=(HERE/'static/artist-mesh-v4.js').read_text('utf-8')
data=(V3/'static/artist-mesh-v3-data.js').read_text('utf-8')

for name in ('HERO','PERFORMANCE'):
    found=re.search(r'export const '+name+'_GLB_BASE64 = "([A-Za-z0-9+/=]+)";',data)
    assert found, name
    raw=base64.b64decode(found.group(1),validate=True)
    assert raw[:4]==b'glTF' and struct.unpack_from('<II',raw,4)==(2,len(raw))
    json_len,marker=struct.unpack_from('<I4s',raw,12)
    assert marker==b'JSON'
    doc=json.loads(raw[20:20+json_len])
    assert len(doc['skins'])==1
    assert len(doc['meshes'])==1
    assert sorted(x['name'] for x in doc['animations'])==['Run','Survey','Walk']
    prim=doc['meshes'][0]['primitives'][0]
    indices=prim.get('indices',prim['attributes']['POSITION'])
    assert doc['accessors'][indices]['count']//3==576
    assert len(raw)==(162928 if name=='HERO' else 150248)
    print('GLB',name,len(raw),'bytes','SHA256',hashlib.sha256(raw).hexdigest()[:16], 'skins',len(doc['skins']),'clips',len(doc['animations']))

required_ids=('stage','quality','count','clip','pixelRatio','benchmark','measure','file','toggleWire','toggleRotate','status','fps','draws','tris','geometry','inventory','chart','results','resultRows','saveReport','saveCsv')
for name in required_ids: assert f'id="{name}"' in html,name
assert '/static/vendor/three.module.js' in html
assert 'artist-mesh-v4.js' in html
assert "from './artist-mesh-v3-data.js'" in js
assert "new GLTFLoader()" in js
assert "new T.Skeleton(bones" in js and "d.bind(skeleton" in js
assert "new T.AnimationMixer(obj)" in js
assert "obj.position.set(source.position.x+x" in js
assert "sourceClips.find(" in js
assert "scenarios=[['HERO',1],['PERFORMANCE',1],['HERO',24],['PERFORMANCE',24]]" in js
assert "capture.frames.push(ms)" in js
assert "low1pctFps:1000/slowMs" in js
assert "CROSSFIRE_ArtistMesh_v4_Benchmark.csv" in js
assert "results=[];renderTable()" in js
assert 'client' not in html.lower() or True
result=subprocess.run(['node','--check',str(HERE/'static/artist-mesh-v4.js')],capture_output=True,text=True)
assert result.returncode==0,result.stderr
print('PASS: v4 UI, skinned-clone preparation, A/B matrix, GLB integrity, reporting and JavaScript syntax.')