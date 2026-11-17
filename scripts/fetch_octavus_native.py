"""Archive the upstream Red Eclipse 2 Octavus binary with a pinned Git SHA.

This is source archival for the map conversion workflow. It does not run
the Red Eclipse engine, and does not alter CROSSFire gameplay.
"""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import Request, urlopen

BLOB_SHA = "c3d927bdb016927f1f96868b435dfdf174a01af9"
URL = "https://raw.githubusercontent.com/redeclipse/maps/master/octavus.mpz"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "sources" / "octavus.original.mpz"
MANIFEST = ROOT / "sources" / "octavus.original.json"


def main():
    req = Request(URL, headers={"User-Agent": "CROSSFire-map-source-archive/1.0"})
    with urlopen(req, timeout=45) as response:
        data = response.read(32 * 1024 * 1024 + 1)
    if not data or len(data) > 32 * 1024 * 1024:
        raise RuntimeError("Octavus source download is empty or too large")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(data)
    actual = subprocess.check_output(
        ["git", "hash-object", str(OUTPUT)], text=True
    ).strip()
    if actual != BLOB_SHA:
        OUTPUT.unlink(missing_ok=True)
        raise RuntimeError(
            f"Native Octavus source SHA mismatch: expected {BLOB_SHA}, got {actual}"
        )
    try:
        expanded = gzip.decompress(data)
        compressed = True
    except (OSError, EOFError):
        expanded = data
        compressed = False
    info = {
        "source": URL,
        "upstreamRepository": "https://github.com/redeclipse/maps",
        "sourceFile": "octavus.mpz",
        "sourceBlobSha": actual,
        "compressedBytes": len(data),
        "unpackedBytes": len(expanded),
        "gzip": compressed,
        "headerHex": expanded[:96].hex(),
        "rawSha256": hashlib.sha256(data).hexdigest(),
        "license": "CC BY-SA 3.0 (original Octavus map license)",
        "usage": "Reference-only; native map has not yet been decoded into the Three.js scene",
    }
    MANIFEST.write_text(json.dumps(info, indent=2) + "\n")
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
