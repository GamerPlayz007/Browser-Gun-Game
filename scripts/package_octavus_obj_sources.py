"""Archive source-authentic Octavus decorative OBJs without dependencies.

The native MPZ source entity roster and original mapmodel list select
which Red Eclipse OBJ files belong in Octavus. This script does not
use any third-party Python packages or create replacement geometry.
Client Three.js parses gzipped original OBJ data directly.
"""
from collections import Counter
import gzip
from hashlib import sha256,sha1
import json
from pathlib import Path
import posixpath
import re
from urllib.request import Request,urlopen
from urllib.parse import quote

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/"static/maps"
OUT=MAP/"octavus_props"
SOURCE=MAP/"octavus.original.cfg"
ENTITIES=MAP/"octavus.native-entities.json"
INDEX=MAP/"octavus.props.json"

def read(url,limit=16*1024*1024):
    with urlopen(Request(url,headers={"User-Agent":"CROSSFire-native-Octavus-OBJ-source/1.0",
                                      "Accept":"application/json"}),timeout=40) as r:
        b=r.read(limit+1)
    if len(b)>limit:raise ValueError("Asset exceeds source size cap")
    return b

def tree(module):
    url=f"https://api.github.com/repos/redeclipse/{module}/git/trees/master?recursive=1"
    d=json.loads(read(url))
    if d.get("truncated"):raise ValueError("GitHub original asset tree truncated")
    return {x["path"] for x in d.get("tree",[]) if x["type"]=="blob"}

def best_obj(alias,files):
    last=alias.split("/")[-1]
    parent=alias.rpartition("/")[0]
    result=[]
    for file in files:
        if not file.lower().endswith(".obj") or "/lod" in file.lower():continue
        stem=file.split("/")[-1][:-4].lower()
        inside=file.lower().startswith(alias.lower()+"/")
        same=stem==last.lower()
        nearby=file.rpartition("/")[0].lower()==parent.lower()
        if not(inside or same):continue
        score=(100 if inside else 0)+(80 if same else 0)+(15 if nearby else 0)-len(file)/1000
        result.append((score,file))
    if result:return max(result)[1]
    # Skin variants such as Alpha/Omega can share a parent OBJ. Use it
    # only when the original repository contains a unique matching mesh.
    if parent:
        shared=[p for p in files if p.startswith(parent+'/') and
                p.lower().endswith('.obj') and '/lod' not in p.lower()]
        if len(shared)==1:return shared[0]
    return None

def settings(module,alias,obj,files):
    paths=[alias+"/obj.cfg",obj.rpartition("/")[0]+"/obj.cfg"]
    parent=alias.rpartition("/")[0]
    if parent:paths.append(parent+"/obj.cfg")
    for path in paths:
        if path not in files:continue
        try:
            url=f"https://raw.githubusercontent.com/redeclipse/{module}/master/{quote(path,safe='/')}"
            cfg=read(url,250000).decode("utf8","replace")
        except Exception:continue
        values={}
        for label in ("mdlscale","mdlyaw","mdlpitch","mdlroll"):
            m=re.search(r"^\s*"+label+r"\s+([-\d.]+)",cfg,flags=re.M)
            values[label]=float(m.group(1)) if m else (100 if label=="mdlscale" else 0)
        values["cfgPath"]=path
        found=re.search(r'^\s*objskin\s+\S+\s+([^\s]+)',cfg,flags=re.M)
        values['skin']=found.group(1).strip('"') if found else None
        return values
    return {"mdlscale":100,"mdlyaw":0,"mdlpitch":0,"mdlroll":0,"cfgPath":None,"skin":None}

def archive_skin(module,model,options,alias):
    cfg=options.get('cfgPath')
    skin=options.get('skin')
    if not cfg or not skin or skin.startswith('<'):
        return {}
    path=posixpath.normpath('data/'+module+'/'+posixpath.dirname(cfg)+'/'+skin)
    if not path.startswith('data/'):return {}
    rel=path.removeprefix('data/')
    if '/' not in rel:return {}
    asset_module,rest=rel.split('/',1)
    attempts=[rest] if rest.lower().endswith(('.jpg','.jpeg','.png')) else [rest+'.png',rest+'.jpg',rest+'.jpeg']
    for filename in attempts:
        url=f"https://raw.githubusercontent.com/redeclipse/{asset_module}/master/{quote(filename,safe='/')}"
        try:original=read(url,5*1024*1024)
        except Exception:continue
        extension='png' if original.startswith(bytes((137,80,78,71,13,10,26,10))) else ('jpg' if original.startswith(bytes((255,216))) else None)
        if extension is None:continue
        name=sha1((alias+':source-skin').encode()).hexdigest()[:14]+'.'+extension
        (OUT/name).write_bytes(original)
        return {'skinUrl':'/static/maps/octavus_props/'+name,'skinSource':url,'skinSHA256':sha256(original).hexdigest()}
    return {}


def main():
    aliases=re.findall(r'^mapmodel\s+"([^"]+)"',SOURCE.read_text(),flags=re.M)
    native=json.loads(ENTITIES.read_text())
    allentities=[e for e in native["visualEntities"] if e["type"]=="mapmodel"]
    counts=Counter(aliases[e["attrs"][0]] for e in allentities
                   if e["attrs"] and 0<=e["attrs"][0]<len(aliases))
    modules={alias.split("/")[0] for alias in counts}
    files={}
    for module in sorted(modules):
        try:files[module]=tree(module)
        except Exception as exc:
            print("Source repo unavailable",module,type(exc).__name__,str(exc)[:150],flush=True)
            files[module]=set()
    OUT.mkdir(parents=True,exist_ok=True)
    result={}
    for alias,count in sorted(counts.items(),key=lambda x:-x[1]):
        module,sub=alias.split("/",1)
        path=best_obj(sub,files[module])
        if path is None:
            result[alias]={"missing":True,"count":count,"reason":"Original source OBJ not found"}
            continue
        url=f"https://raw.githubusercontent.com/redeclipse/{module}/master/{quote(path,safe='/')}"
        try:
            raw=read(url)
            faces=sum(1 for line in raw.splitlines() if line.startswith(b"f "))
            vertices=sum(1 for line in raw.splitlines() if line.startswith(b"v "))
            if not faces or not vertices:raise ValueError("OBJ has no faces or vertices")
            settingsdata=settings(module,sub,path,files[module])
            sha=sha1(alias.encode()).hexdigest()[:14]
            name=sha+".obj.gz"
            compressed=gzip.compress(raw,compresslevel=8,mtime=0)
            skin=archive_skin(module,path,settingsdata,alias)
            (OUT/name).write_bytes(compressed)
            result[alias]={
                "url":f"/static/maps/octavus_props/{name}",
                "source":url,"sha256":sha256(raw).hexdigest(),
                "codec":"gzip-obj",
                "count":count,"triangles":faces,"vertices":vertices,
                "compressedBytes":len(compressed),
                "sourceScale":settingsdata["mdlscale"],
                "yaw":settingsdata["mdlyaw"],
                "pitch":settingsdata["mdlpitch"],
                "roll":settingsdata["mdlroll"],
                "cfgPath":settingsdata["cfgPath"],
                **skin
            }
            print(alias,vertices,"source vertices",faces,"source faces",flush=True)
        except Exception as e:
            result[alias]={"missing":True,"count":count,
                           "reason":type(e).__name__+": "+str(e)[:120]}
    summary={
        "format":"OCTAVUS-PROPS3","source":"Red Eclipse original map-model Wavefront sources",
        "mapModelEntities":len(allentities),"originalTypes":len(counts),
        "convertedTypes":sum(not m.get("missing") for m in result.values()),
        "convertedInstances":sum(m["count"] for m in result.values() if not m.get("missing")),
        "models":result,
        "license":"Original environment meshes retain Red Eclipse individual module licenses; see ATTRIBUTION.md",
    }
    INDEX.write_text(json.dumps(summary,indent=2)+"\n")
    (OUT/"ATTRIBUTION.md").write_text(
        "# Original Octavus map model source archive\n\n"
        "Exact original Wavefront OBJ meshes, gzip-compressed without\n"
        "geometric approximation. Individual authors and licenses are\n"
        "retained via original source URLs and per-source SHA-256 in\n"
        "static/maps/octavus.props.json. Missing assets are not\n"
        "silently substituted.\n\n"
        +"\n".join(f"- https://github.com/redeclipse/{m}" for m in sorted(modules))+"\n")
    print(json.dumps({k:v for k,v in summary.items() if k!="models"}),flush=True)


if __name__=="__main__":main()
)):
        return {}
    # All source paths resolve from Red Eclipse's data/ root. This also
    # permits named shared image modules such as 'unnamed'.
    path=posixpath.normpath('data/'+module+'/'+posixpath.dirname(cfg)+'/'+skin)
    if not path.startswith('data/'):return {}
    rel=path.removeprefix('data/')
    if '/' not in rel:return {}
    asset_module,rest=rel.split('/',1)
    attempts=[rest] if rest.lower().endswith(('.jpg','.jpeg','.png')) else [
        rest+'.png',rest+'.jpg',rest+'.jpeg']
    for filename in attempts:
        url=f"https://raw.githubusercontent.com/redeclipse/{asset_module}/master/{quote(filename,safe='/')}"
        try:
            original=read(url,5*1024*1024)
        except Exception:continue
        extension='png' if original.startswith(b'\\x89PNG\\r\\n\\x1a\\n') else (
            'jpg' if original.startswith(b'\\xff\\xd8') else None)
        if extension is None:continue
        name=sha1((alias+':source-skin').encode()).hexdigest()[:14]+'.'+extension
        (OUT/name).write_bytes(original)
        return {
            'skinUrl':f'/static/maps/octavus_props/{name}',
            'skinSource':url,
            'skinSHA256':sha256(original).hexdigest(),
        }
    return {}


def main():
    aliases=re.findall(r'^mapmodel\s+"([^"]+)"',SOURCE.read_text(),flags=re.M)
    native=json.loads(ENTITIES.read_text())
    allentities=[e for e in native["visualEntities"] if e["type"]=="mapmodel"]
    counts=Counter(aliases[e["attrs"][0]] for e in allentities
                   if e["attrs"] and 0<=e["attrs"][0]<len(aliases))
    modules={alias.split("/")[0] for alias in counts}
    files={}
    for module in sorted(modules):
        try:files[module]=tree(module)
        except Exception as exc:
            print("Source repo unavailable",module,type(exc).__name__,str(exc)[:150],flush=True)
            files[module]=set()
    OUT.mkdir(parents=True,exist_ok=True)
    result={}
    for alias,count in sorted(counts.items(),key=lambda x:-x[1]):
        module,sub=alias.split("/",1)
        path=best_obj(sub,files[module])
        if path is None:
            result[alias]={"missing":True,"count":count,"reason":"Original source OBJ not found"}
            continue
        url=f"https://raw.githubusercontent.com/redeclipse/{module}/master/{quote(path,safe='/')}"
        try:
            raw=read(url)
            if not raw.startswith((b"v ",b"# ",b"#\n",b"g ",b"o ")):
                raise ValueError("Original source is not Wavefront OBJ")
            faces=sum(1 for line in raw.splitlines() if line.startswith(b"f "))
            vertices=sum(1 for line in raw.splitlines() if line.startswith(b"v "))
            if not faces or not vertices:raise ValueError("OBJ has no faces or vertices")
            settingsdata=settings(module,sub,path,files[module])
            sha=sha1(alias.encode()).hexdigest()[:14]
            name=sha+".obj.gz"
            compressed=gzip.compress(raw,compresslevel=8)
            (OUT/name).write_bytes(compressed)
            result[alias]={
                "url":f"/static/maps/octavus_props/{name}",
                "source":url,"sha256":sha256(raw).hexdigest(),
                "codec":"gzip-obj",
                "count":count,"triangles":faces,"vertices":vertices,
                "compressedBytes":len(compressed),
                "sourceScale":settingsdata["mdlscale"],
                "yaw":settingsdata["mdlyaw"],
                "pitch":settingsdata["mdlpitch"],
                "roll":settingsdata["mdlroll"],
                "cfgPath":settingsdata["cfgPath"]
            }
            print(alias,vertices,"source vertices",faces,"source faces",flush=True)
        except Exception as e:
            result[alias]={"missing":True,"count":count,
                           "reason":type(e).__name__+": "+str(e)[:120]}
    summary={
        "format":"OCTAVUS-PROPS3","source":"Red Eclipse original map-model Wavefront sources",
        "mapModelEntities":len(allentities),"originalTypes":len(counts),
        "convertedTypes":sum(not m.get("missing") for m in result.values()),
        "convertedInstances":sum(m["count"] for m in result.values() if not m.get("missing")),
        "models":result,
        "license":"Original environment meshes retain Red Eclipse individual module licenses; see ATTRIBUTION.md",
    }
    INDEX.write_text(json.dumps(summary,indent=2)+"\n")
    (OUT/"ATTRIBUTION.md").write_text(
        "# Original Octavus map model source archive\n\n"
        "Exact original Wavefront OBJ meshes, gzip-compressed without\n"
        "geometric approximation. Individual authors and licenses are\n"
        "retained via original source URLs and per-source SHA-256 in\n"
        "static/maps/octavus.props.json. Missing assets are not\n"
        "silently substituted.\n\n"
        +"\n".join(f"- https://github.com/redeclipse/{m}" for m in sorted(modules))+"\n")
    print(json.dumps({k:v for k,v in summary.items() if k!="models"}),flush=True)


if __name__=="__main__":main()
