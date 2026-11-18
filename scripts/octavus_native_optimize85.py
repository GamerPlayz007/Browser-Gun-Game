"""Octavus phase1.5: combine proven partial-source visibility with exact
area-preserving planar rectangle merges.

No game/server changes. The standalone OCN2 archive is a staging
diagnostic until native full renderer parity is established.
Original Red Eclipse 2 map CC BY-SA 3.0.
"""
from scripts.octavus_native_merge83 import compact,ROOT

SOURCE=ROOT/"static/maps/octavus.native-partial.bin.gz"
MANIFEST=ROOT/"static/maps/octavus.native-partial.json"
OUT=ROOT/"static/maps/octavus.native-optimized.bin.gz"
REPORT=ROOT/"static/maps/octavus.native-optimized.json"

if __name__=="__main__":
    compact(source=SOURCE,source_manifest=MANIFEST,
            output=OUT,report_path=REPORT)
