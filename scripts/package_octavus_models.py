"""Archive original Octavus source environment model meshes as web GLB.

Only models explicitly referenced by Octavus's native map entity records
are considered. Each original Wavefront OBJ is sourced from the matching
Red Eclipse data module; missing meshes are NOT replaced with invented
shapes. Uses documented Cube 2 model.cfg scale metadata where available.
"""
from __future__ import annotations
from collections import Counter
from hashlib import sha1, sha256
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "static/maps/octavus.original.cfg"
ENTS = ROOT / "static/maps/octavus.native-entities.json"
OUT = ROOT / "static/maps/octavus_props"
INDEX = ROOT / "static/maps/octavus.props.json"
LIMIT = 8 * 1024 * 1024


def get(url, maxsize=LIMIT):
    with urlopen(Request(url, headers={
            "User-Agent": "CROSSFire-Octavus-model-source-converter/1.0",
            "Accept": "application/json"}),timeout=35) as response:
        contents=response.read(maxsize+1)
    if len(contents)>maxsize:
        raise ValueError("Source exceeds maximum permitted model size")
    return contents


def tree(module):
    url=f"https://api.github.com/repos/redeclipse/{module}/git/trees/master?recursive=1"
    payload=json.loads(get(url,14*1024*1024))
    if payload.get("truncated"):
        raise ValueError(f"Source model tree truncated: {module}")
    return {x["path"] for x in payload.get("tree",[]) if x["type"]=="blob"}


def fetch_file(module,path):
    url=f"https://raw.githubusercontent.com/redeclipse/{module}/master/"+quote(path,safe="/")
    return get(url),url


def choose_obj(alias,paths):
    leaf=alias.split("/")[-1]
    parent=alias.rsplit("/",1)[0] if "/" in alias else ""
    candidates=[]
    for p in paths:
        if not p.lower().endswith(".obj"):continue
        if p.endswith(".lod.obj") or "/lod" in p.lower():continue
        basename=p.rsplit("/",1)[-1][:-4].lower()
        exact=p.lower()==alias.lower()+".obj"
        inside=p.lower().startswith(alias.lower()+"/")
        same_parent=p.rsplit("/",1)[0].lower()==parent.lower()
        same_name=basename==leaf.lower()
        if not (exact or inside or same_name):continue
        score=(120 if exact else 0)+(80 if inside else 0)+(
            65 if same_name else 0)+(35 if same_parent else 0)
        # Prefer the original full-quality mesh over LOD variants.
        score-=len(p)/200
        candidates.append((score,p))
    return max(candidates)[1] if candidates else None


def model_settings(module,alias,objpath,paths):
    options=[]
    # A model's obj.cfg may be inside its own directory or the mesh's.
    for candidate in [
        alias+"/obj.cfg",objpath.rsplit("/",1)[0]+"/obj.cfg",
        alias.rsplit("/",1)[0]+"/obj.cfg" if "/" in alias else "obj.cfg"
    ]:
        if candidate in paths and candidate not in options:
            options.append(candidate)
    for cfg in options:
        try:payload,url=fetch_file(module,cfg)
        except (HTTPError,URLError,ValueError):continue
        body=payload.decode("utf8","replace")
        cmd=re.search(r"^\s*mdlscale\s+([\d.]+)",body,re.M)
        yaw=re.search(r"^\s*mdlyaw\s+([-\d.]+)",body,re.M)
        pitch=re.search(r"^\s*mdlpitch\s+([-\d.]+)",body,re.M)
        roll=re.search(r"^\s*mdlroll\s+([-\d.]+)",body,re.M)
        skin=re.search(r"^\s*objskin\s+\S+\s+(\S+)",body,re.M)
        return {
            "cfg":cfg,
            "sourceScale":float(cmd.group(1)) if cmd else 100,
            "yaw":float(yaw.group(1)) if yaw else 0,
            "pitch":float(pitch.group(1)) if pitch else 0,
            "roll":float(roll.group(1)) if roll else 0,
            "sourceSkin":skin.group(1).strip('"') if skin else None
        }
    return {"cfg":None,"sourceScale":100,"yaw":0,"pitch":0,"roll":0,"sourceSkin":None}


def main():
    aliases=re.findall(r'^mapmodel\s+"([^"]+)"',CFG.read_text(),flags=re.M)
    natives=json.loads(ENTS.read_text())["visualEntities"]
    entities=[e for e in natives if e.get("type")=="mapmodel"]
    counts=Counter(aliases[e["attrs"][0]] for e in entities
                   if e.get("attrs") and 0<=e["attrs"][0]<len(aliases))
    modules={a.split("/")[0] for a in counts}
    paths={}
    for module in sorted(modules):
        try:paths[module]=tree(module)
        except Exception as err:
            print("SOURCE TREE ERROR",module,str(err),flush=True)
            paths[module]=set()
    OUT.mkdir(parents=True,exist_ok=True)
    output={}
    sourceBytes=0
    for alias,n in sorted(counts.items(),key=lambda item:-item[1]):
        module,subpath=alias.split("/",1)
        objfile=choose_obj(subpath,paths[module])
        if not objfile:
            output[alias]={"missing":True,"count":n,"reason":"No original OBJ source"}
            continue
        try:
            original,url=fetch_file(module,objfile)
            mesh=trimesh.load(BytesIO(original),file_type="obj",
                              process=False,maintain_order=True,
                              skip_materials=True,force="mesh")
            if not isinstance(mesh,trimesh.Trimesh) or len(mesh.faces)<1:
                raise ValueError("No loadable triangle geometry")
            # Native model vertices are Z-up; Three.js is Y-up.
            transform=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],
                                dtype=np.float64)
            mesh.apply_transform(transform)
            binary=trimesh.Scene(mesh).export(file_type="glb")
            if len(binary)>LIMIT:
                raise ValueError("Converted GLB exceeds size budget")
            config=model_settings(module,subpath,objfile,paths[module])
            filename=sha1(alias.encode()).hexdigest()[:14]+".glb"
            (OUT / filename).write_bytes(binary)
            bounds=mesh.bounds
            output[alias]={
                "url":f"/static/maps/octavus_props/{filename}",
                "source":url,
                "sha256":sha256(original).hexdigest(),
                "count":n,
                "triangles":int(len(mesh.faces)),
                "originalBounds":bounds.tolist(),
                "originalUV":bool(hasattr(mesh.visual,"uv") and mesh.visual.uv is not None),
                **config
            }
            sourceBytes+=len(binary)
            print(f"Converted source {alias}: {len(mesh.faces)} faces / {len(binary)} bytes",
                  flush=True)
        except Exception as error:
            output[alias]={"missing":True,"count":n,
                            "reason":type(error).__name__+": "+str(error)[:120]}
    manifest={
        "format":"OCTAVUS-PROPS2",
        "source":"Red Eclipse original map model aliases and original OBJ meshes",
        "mapModelEntities":len(entities),"originalTypes":len(counts),
        "convertedTypes":sum(not x.get("missing") for x in output.values()),
        "convertedInstances":sum(x["count"] for x in output.values()
                                if not x.get("missing")),
        "convertedBytes":sourceBytes,
        "models":output,
        "license":"Individual content licenses apply; retain attribution to original Red Eclipse media modules"
    }
    INDEX.write_text(json.dumps(manifest,indent=2)+"\n")
    (OUT/"ATTRIBUTION.md").write_text(
        "# Octavus original environmental models\n\n"
        "Derived from Red Eclipse source module OBJ meshes, with original\n"
        "model aliases, source URLs and hashes retained in octavus.props.json.\n"
        "Model authors own the original content; individual licensing terms apply.\n"
        "No missing source models are replaced with invented geometry.\n"
        "https://github.com/redeclipse/base\n\n"
        + "\n".join(f"- https://github.com/redeclipse/{m}"
                    for m in sorted(modules))+"\n")
    print(json.dumps({k:v for k,v in manifest.items()
                      if k not in ("models",)},indent=2),flush=True)


if __name__=="__main__":
    main()
