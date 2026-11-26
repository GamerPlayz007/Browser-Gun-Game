"""Create smaller, self-contained GLB copies for a generic static asset viewer.

Preserve geometry, material bindings and bufferView indices. Only embedded
PNG/JPEG images are resized. External or compressed geometry is rejected.
"""
import argparse
import copy
import io
import json
import struct
from pathlib import Path
from PIL import Image

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

def align(data, fill=b"\0"):
    return data + fill * (-len(data) % 4)

def read_glb(raw):
    if len(raw) < 20:
        raise ValueError("truncated GLB")
    magic, version, length = struct.unpack_from("<4sII", raw)
    if (magic, version, length) != (b"glTF", 2, len(raw)):
        raise ValueError("invalid GLB 2 header")
    pos, chunks = 12, {}
    while pos < length:
        n, kind = struct.unpack_from("<II", raw, pos)
        pos += 8
        if n % 4 or pos+n > length or kind in chunks:
            raise ValueError("invalid or duplicate GLB chunk")
        chunks[kind] = raw[pos:pos+n]
        pos += n
    if set(chunks) != {JSON_CHUNK, BIN_CHUNK}:
        raise ValueError("expected JSON and BIN chunks only")
    return json.loads(chunks[JSON_CHUNK]), chunks[BIN_CHUNK]

def write_glb(doc, binary):
    j = align(json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode(), b" ")
    b = align(binary)
    return (struct.pack("<4sII", b"glTF", 2, 28+len(j)+len(b))
            +struct.pack("<II", len(j), JSON_CHUNK)+j
            +struct.pack("<II", len(b), BIN_CHUNK)+b)

def image_data(data, limit):
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        before = im.size
        fmt = im.format
        if fmt not in ("PNG", "JPEG"):
            raise ValueError("unsupported image encoding: "+str(fmt))
        if max(before) <= limit:
            return data, before, before
        im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        opts = {"optimize": True} if fmt == "PNG" else {"quality": 88, "optimize": True}
        im.save(output, format=fmt, **opts)
        return output.getvalue(), before, im.size

def estimated_rgba_bytes(sizes):
    # Conservative full mip chain estimate, not a measurement of GPU residency.
    return round(sum(w*h*4 for w,h in sizes)*4/3)

def optimize(raw, limit):
    source, binary = read_glb(raw)
    doc = copy.deepcopy(source)
    buffers = doc.get("buffers", [])
    if len(buffers) != 1 or "uri" in buffers[0] or buffers[0]["byteLength"] > len(binary):
        raise ValueError("expected one embedded buffer")
    views = doc.get("bufferViews", [])
    # Retain original input view offsets for the byte-for-byte geometry check.
    # Resizing embedded textures shifts subsequent bufferView offsets. Looking
    # up the mutated 'views' below would then compare the wrong input bytes.
    source_views = source.get("bufferViews", [])
    if any(v.get("buffer", 0) != 0 or "extensions" in v for v in views):
        raise ValueError("unsupported bufferView extension or external buffer")
    forbidden = {"EXT_meshopt_compression", "KHR_draco_mesh_compression", "KHR_texture_basisu"}
    if forbidden.intersection(doc.get("extensionsUsed", [])):
        raise ValueError("compressed input is outside this utility's contract")
    images = doc.get("images", [])
    replacements, before_sizes, after_sizes = {}, [], []
    def slice_view(index):
        v = source_views[index]
        start, n = v.get("byteOffset", 0), v["byteLength"]
        if start < 0 or n < 0 or start+n > source["buffers"][0]["byteLength"]:
            raise ValueError("bufferView outside buffer")
        return binary[start:start+n]
    image_views = set()
    accessor_views = set()
    for a in doc.get("accessors", []):
        if "bufferView" in a:
            accessor_views.add(a["bufferView"])
        for field in ("indices", "values"):
            if field in a.get("sparse", {}):
                accessor_views.add(a["sparse"][field]["bufferView"])
    for im in images:
        if "uri" in im or "bufferView" not in im or im.get("mimeType") not in ("image/png", "image/jpeg"):
            raise ValueError("expected embedded PNG/JPEG")
        i = im["bufferView"]
        if i in accessor_views:
            raise ValueError("image bufferView also used by geometry")
        if i not in replacements:
            replacements[i] = image_data(slice_view(i), limit)
        _, old, new = replacements[i]
        before_sizes.append(old); after_sizes.append(new); image_views.add(i)
    if not images:
        raise ValueError("expected at least one embedded image")
    out = bytearray()
    for i, v in enumerate(views):
        out.extend(b"\0" * (-len(out)%4))
        data = replacements[i][0] if i in replacements else slice_view(i)
        v["byteOffset"] = len(out)
        v["byteLength"] = len(data)
        out.extend(data)
    buffers[0]["byteLength"] = len(out)
    result = write_glb(doc, bytes(out))
    check, check_bin = read_glb(result)
    # Ensure the scene, material and geometry metadata is unchanged.
    assert {k:v for k,v in source.items() if k not in ("buffers","bufferViews")} == {k:v for k,v in check.items() if k not in ("buffers","bufferViews")}
    for i, v in enumerate(check["bufferViews"]):
        start, n = v["byteOffset"], v["byteLength"]
        assert start%4 == 0 and start+n <= len(check_bin)
        if i not in image_views:
            assert check_bin[start:start+n] == slice_view(i)
    assert all(max(s) <= limit for s in after_sizes)
    report = {"input_bytes":len(raw), "output_bytes":len(result),
              "image_count":len(images), "max_texture_dimension":limit,
              "estimated_rgba_mipped_bytes_before":estimated_rgba_bytes(before_sizes),
              "estimated_rgba_mipped_bytes_after":estimated_rgba_bytes(after_sizes)}
    return result, report

def self_test():
    im = Image.new("RGBA", (128,64), (40,80,120,100))
    png = io.BytesIO(); im.save(png,format="PNG")
    geometry = struct.pack("<fff", 1,2,3)
    data = geometry + png.getvalue()
    doc = {"asset":{"version":"2.0"}, "buffers":[{"byteLength":len(data)}],
           "bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":12},
                          {"buffer":0,"byteOffset":12,"byteLength":len(png.getvalue())}],
           "accessors":[{"bufferView":0,"componentType":5126,"count":1,"type":"VEC3"}],
           "images":[{"bufferView":1,"mimeType":"image/png"}]}
    result, report = optimize(write_glb(doc,data),32)
    d,b = read_glb(result)
    v=d["bufferViews"][1]
    with Image.open(io.BytesIO(b[v["byteOffset"]:v["byteOffset"]+v["byteLength"]])) as decoded:
        assert decoded.size==(32,16) and decoded.mode=="RGBA"
    assert b[:12]==geometry and report["estimated_rgba_mipped_bytes_after"] < report["estimated_rgba_mipped_bytes_before"]
    print("GLB texture profile self-test passed")

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset-dir",type=Path)
    p.add_argument("--self-test",action="store_true")
    p.add_argument("assets",nargs="*",help="source GLB basenames")
    args=p.parse_args()
    if args.self_test:
        self_test()
    if not args.assets:
        return
    if not args.asset_dir:
        p.error("--asset-dir required with assets")
    report={}
    for name in args.assets:
        if Path(name).name!=name or not name.endswith(".glb"):
            raise ValueError("asset must be a .glb basename")
        src=args.asset_dir/name
        raw=src.read_bytes()
        report[name]={}
        for profile, limit in (("balanced",1024),("performance",512)):
            result, metrics=optimize(raw,limit)
            if len(result)>=len(raw):
                raise ValueError("profile did not reduce file size: "+name+" "+profile)
            target=src.with_name(src.stem+"-"+profile+".glb")
            target.write_bytes(result)
            report[name][profile]=metrics
    (args.asset_dir/"texture-profile-report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))

if __name__ == "__main__":
    main()
