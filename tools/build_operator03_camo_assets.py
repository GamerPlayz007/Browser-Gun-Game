from pathlib import Path
import json, math, hashlib
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1]/'static'/'operators'
OUT.mkdir(exist_ok=True)

BASE_ATLAS = OUT/'CROSSFire_Operator_03_BaseColor_Atlas.png'
NORMAL_ATLAS = OUT/'CROSSFire_Operator_03_Normal_Atlas.png'
MR_ATLAS = OUT/'CROSSFire_Operator_03_MetallicRoughness_Atlas.png'

colors={
 'uniform':(53,65,60,255), 'uniform_dark':(41,49,47,255),
 'cloth_highlight':(71,79,69,255), 'carrier':(76,80,65,255),
 'armor':(42,48,48,255), 'armor_edge':(85,89,77,255),
 'webbing':(111,104,76,255), 'pouches':(97,94,77,255),
 'pouch_edge':(63,66,55,255), 'helmet':(61,70,59,255),
 'helmet_trim':(39,43,42,255), 'visor':(25,38,44,255),
 'glove':(32,37,37,255), 'boots':(42,43,40,255),
 'metal':(79,85,81,255), 'highlight':(133,133,114,255),
 'patch':(69,95,105,255), 'patch_emblem':(172,180,162,255),
 'stitch':(129,126,101,255),
 'thread':(89,94,80,255), 'fold_light':(83,91,76,255), 'fold_dark':(40,47,44,255),
 'nylon':(48,55,50,255), 'nylon_edge':(90,91,75,255), 'rubber':(27,32,31,255),
 'rubber_lite':(58,63,59,255), 'cord':(118,111,86,255), 'buckle':(61,68,65,255),
 'zipper':(142,140,114,255), 'glass_dark':(19,33,40,255), 'glass_edge':(73,90,94,255),
 'ceramic':(68,73,68,255), 'warning':(141,129,86,255),
}
KEYS=list(colors)
TILE=192
COLS=6
ROWS=math.ceil(len(KEYS)/COLS)

variants = {
    'woodland': {'label':'Woodland','pattern':'organic','palette':[(36,52,34),(64,88,46),(92,76,44),(26,30,24),(115,110,76)]},
    'desert': {'label':'Desert','pattern':'organic','palette':[(194,177,139),(168,148,110),(125,112,84),(212,202,178),(103,95,78)]},
    'urban': {'label':'Urban','pattern':'organic','palette':[(44,47,51),(67,70,76),(92,96,101),(28,30,33),(120,123,128)]},
    'arctic': {'label':'Arctic','pattern':'organic','palette':[(232,234,236),(201,206,210),(158,166,174),(245,245,247),(125,131,138)]},
    'jungle': {'label':'Jungle','pattern':'organic','palette':[(24,54,31),(44,91,46),(73,69,34),(18,33,22),(102,110,54)]},
    'navy_digital': {'label':'Navy Digital','pattern':'digital','palette':[(33,47,70),(50,64,92),(69,81,111),(20,28,41),(100,112,140)]},
    'ranger': {'label':'Ranger','pattern':'organic','palette':[(74,90,55),(117,108,74),(87,71,48),(48,58,38),(145,135,98)]},
    'shadow': {'label':'Shadow','pattern':'digital','palette':[(26,28,31),(43,45,49),(62,64,70),(18,19,22),(95,98,104)]},
}
base = Image.open(BASE_ATLAS).convert('RGB')


def _smooth_noise(h, w, seed, scale):
    rng=np.random.default_rng(seed)
    gh=max(2,h//scale)
    gw=max(2,w//scale)
    grid=rng.random((gh,gw), dtype=np.float32)
    img=Image.fromarray((grid*255).astype(np.uint8), 'L').resize((w,h), Image.Resampling.BILINEAR)
    return np.asarray(img, dtype=np.float32)/255.0

def organic_camo(h,w,palette,seed):
    n1=_smooth_noise(h,w,seed,24); n2=_smooth_noise(h,w,seed+1,48); n3=_smooth_noise(h,w,seed+2,12)
    yy,xx=np.mgrid[0:h,0:w]
    m=0.55*n1 + 0.30*n2 + 0.15*n3 + 0.05*np.sin(xx/11.0+yy/27.0) + 0.04*np.cos(xx/23.0-yy/17.0)
    m=(m-m.min())/(m.max()-m.min()+1e-8)
    idx=np.digitize(m, np.quantile(m,[0.18,0.40,0.63,0.82]))
    out=np.zeros((h,w,3), dtype=np.uint8)
    for i,c in enumerate(palette): out[idx==i]=c
    return out

def digital_camo(h,w,palette,seed):
    rng=np.random.default_rng(seed)
    cell=6; gh=max(8,h//cell); gw=max(8,w//cell)
    coarse=rng.random((gh,gw))
    for _ in range(2): coarse=(coarse+np.roll(coarse,1,0)+np.roll(coarse,-1,0)+np.roll(coarse,1,1)+np.roll(coarse,-1,1))/5.0
    img=Image.fromarray((coarse*255).astype(np.uint8),'L').resize((w,h),Image.Resampling.NEAREST)
    m=np.asarray(img,dtype=np.float32)/255.0
    m=(m + 0.10*np.sin(np.arange(w)[None,:]/9.0) + 0.08*np.cos(np.arange(h)[:,None]/7.0))
    m=(m-m.min())/(m.max()-m.min()+1e-8)
    idx=np.digitize(m,[0.18,0.37,0.58,0.80])
    out=np.zeros((h,w,3),dtype=np.uint8)
    for i,c in enumerate(palette): out[idx==i]=c
    return out

def apply_wear(pattern, tile_rgb, strength=0.2):
    tile=tile_rgb.astype(np.float32); pat=pattern.astype(np.float32)
    lum=tile.mean(axis=2,keepdims=True); lum=(lum-lum.min())/(lum.max()-lum.min()+1e-8)
    shaded=pat*(0.80+lum*0.28)
    return np.clip((1.0-strength)*shaded + strength*tile,0,255).astype(np.uint8)

def tile_bounds(key):
    idx=KEYS.index(key); row,col=divmod(idx,COLS)
    return col*TILE,row*TILE,(col+1)*TILE,(row+1)*TILE

def build_variant_atlas(variant_key):
    cfg=variants[variant_key]; atlas=np.asarray(base).copy(); patt_fn=organic_camo if cfg['pattern']=='organic' else digital_camo
    for key in ['uniform','uniform_dark','cloth_highlight','fold_light','fold_dark','helmet','carrier','pouches']:
        x0,y0,x1,y1=tile_bounds(key)
        tile=atlas[y0:y1,x0:x1,:]
        pat=patt_fn(TILE,TILE,cfg['palette'], seed=int.from_bytes(hashlib.sha256((variant_key + '/' + key).encode()).digest()[:4], 'little'))
        atlas[y0:y1,x0:x1,:]=apply_wear(pat,tile, strength=0.25 if key in {'carrier','pouches'} else 0.15)
    for key,tint in [('webbing', cfg['palette'][4]), ('pouch_edge', cfg['palette'][3]), ('nylon', cfg['palette'][3]), ('nylon_edge', cfg['palette'][4])]:
        x0,y0,x1,y1=tile_bounds(key)
        tile=atlas[y0:y1,x0:x1,:].astype(np.float32); color=np.array(tint,dtype=np.float32)[None,None,:]
        atlas[y0:y1,x0:x1,:]=np.clip(tile*0.45+color*0.55,0,255).astype(np.uint8)
    return Image.fromarray(atlas.astype(np.uint8),'RGB')

# Generate only the 8 lightweight colour maps. The single base GLB provides
# shared geometry, normal and metallic-roughness maps across every uniform.
if not BASE_ATLAS.is_file():
    raise RuntimeError(f'Missing Operator 03 base atlas: {BASE_ATLAS}')
for key,cfg in variants.items():
    img=build_variant_atlas(key)
    path=OUT/f'CROSSFire_Operator_03_{key}_BaseColor_Atlas.png'
    img.save(path, optimize=True)
    print(f'Created {cfg["label"]}: {path.stat().st_size} bytes', flush=True)
print(f'Generated {len(variants)} camouflage maps in {OUT}')