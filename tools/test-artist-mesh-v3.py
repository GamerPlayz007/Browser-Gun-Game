"""Validate the CROSSFire artist-authored sample and isolated asset-lab wiring."""
import base64, hashlib, json, re, struct
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
js=(BASE/'static/artist-mesh-v3-data.js').read_text('utf-8')
html=(BASE/'static/artist-mesh-v3.html').read_text('utf-8')
code=(BASE/'static/artist-mesh-v3.js').read_text('utf-8')
expected={'HERO':'CROSSFIRE_Fox_Artist_HERO.glb','PERFORMANCE':'CROSSFIRE_Fox_Artist_PERFORMANCE.glb'}

def parse_glb(raw):
    assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
    assert struct.unpack_from('<I',raw,8)[0]==len(raw)
    json_len,marker=struct.unpack_from('<I4s',raw,12)
    assert marker==b'JSON'
    return json.loads(raw[20:20+json_len].decode('utf-8'))

for label,filename in expected.items():
    var=label+'_GLB_BASE64'
    match=re.search(r'export const '+var+r' = "([A-Za-z0-9+/=]+)";',js)
    assert match,var
    embedded=base64.b64decode(match.group(1),validate=True)
    source=(BASE/'sample'/filename).read_bytes()
    assert embedded==source,'Embedded asset changed: '+label
    doc=parse_glb(embedded)
    assert len(doc['skins'])==1
    assert sorted(x['name'] for x in doc['animations'])==['Run','Survey','Walk']
    assert len(doc['meshes'])==1
    prim=doc['meshes'][0]['primitives'][0]
    idx=prim.get('indices',prim['attributes']['POSITION'])
    assert doc['accessors'][idx]['count']//3==576
    print(label,len(embedded),'bytes',hashlib.sha256(embedded).hexdigest()[:16], 'skins',len(doc['skins']))
hero=parse_glb((BASE/'sample'/expected['HERO']).read_bytes())
perf=parse_glb((BASE/'sample'/expected['PERFORMANCE']).read_bytes())
for key in ('meshes','nodes','skins','animations','accessors'):
    assert hero[key]==perf[key],f'Loss of artist data: {key}'
for id in ['stage','quality','clip','renderScale','wire','rotate','shadows','reset','restore','downloadReport','file','fps','draws','renderTris','meshCount','triCount','clipCount','texCount','notice']:
    assert f'id="{id}"' in html,id
assert '/static/vendor/three.module.js' in html
assert '/static/vendor/addons/' in html
assert 'artist-mesh-v3.js' in html
assert "./artist-mesh-v3-data.js" in code
assert "new GLTFLoader()" in code
assert "mixer.update(dt)" in code
assert "const gltf=await loader.parseAsync(bytes.buffer,'')" in code
assert "if(file.size>30_000_000)" in code
assert 'CROSS<span>FIRE' in html
print('PASS: actual artist mesh bytes preserved; 3 animation clips, skin, scene; full lab wiring.')