"""Octavus Stage 2.2 interior collision surface and route preflight.

Audits preserved source floors, walls, platforms and deformed faces
inside the user-defined island. The output is evidence, not a claim
that live player movement is ready.
"""
from __future__ import annotations
from collections import Counter
import json
import math
from pathlib import Path

from octavus_native_boundary92 import NativeArenaBoundary92
from octavus_native_collision91 import (
    NativeCollisionPilot91, SOURCE as OLD_SOURCE, META as OLD_META,
    RADIUS,HEIGHT,
)

ROOT=Path(__file__).resolve().parent
MAPS=ROOT/"static/maps"
SOURCE=MAPS/"octavus.native-interior93.bin.gz"
META=MAPS/"octavus.native-interior93.json"
ENTITIES=MAPS/"octavus.native-entities.json"
OUT=MAPS/"octavus.native-interior-preflight94.json"


def preflight():
    report=json.loads(META.read_text())
    if (report.get("format")!="OCN2" or
        report.get("collisionScope")!="island-interior-candidate" or
        not report.get("explicitNativeSlotOneIncluded") or
        report.get("liveMapModified") is not False):
        raise ValueError("Source island collision manifest missing or not safe")
    arena=NativeArenaBoundary92()
    old=NativeCollisionPilot91(source=OLD_SOURCE,meta=OLD_META)
    new=NativeCollisionPilot91(source=SOURCE,meta=META)
    if new.count!=report["triangles"] or new.surface_counter[1]!=report["retainedNativeSlotOneTriangles"]:
        raise ValueError("Source island collision candidate source slot consistency failed")
    entities=json.loads(ENTITIES.read_text())["playerStarts"]
    if len(entities)!=33:raise ValueError("Lost original native starts")
    allsource=[]
    summary=Counter()
    spots=[]
    blocked_interior=[]
    for entry in entities:
        ex,ey,ez=entry["sourcePosition"]
        x=(ex-4096)*.05
        y=(ez-2816)*.05
        z=(ey-4096)*.05
        if not arena.allowed(x,z):
            raise ValueError("Source-native player start escaped screenshot island")
        oldfloor,_=old.floor_at(x,y,z)
        floor,checks=new.floor_at(x,y,z)
        clear,capchecks,blocking=new.capsule_clear(x,y,z)
        nearby=bool(floor is not None and -0.17<=floor["groundDelta"]<=0.2)
        safe=nearby and clear
        if floor:summary["hasFloor"]+=1
        if floor and floor["material"]==1:summary["sourceSlot1SupportingSpawn"]+=1
        if nearby:summary["supportedAtSourceHeight"]+=1
        if clear:summary["capsuleClear"]+=1
        if safe:summary["preliminaryClear"]+=1
        if floor and oldfloor and floor["material"]!=oldfloor["material"]:
            summary["supportingMaterialChanged"]+=1
        row={
            "entityID":entry["id"],
            "worldPosition":[round(x,4),round(y,4),round(z,4)],
            "sourceBoundaryClearance":round(arena.distance_to_wall(x,z),3),
            "oldGroundDelta":round(oldfloor["groundDelta"],4) if oldfloor else None,
            "newGroundDelta":round(floor["groundDelta"],4) if floor else None,
            "newGroundSlot":floor["material"] if floor else None,
            "newFloorTriangle":floor["triangle"] if floor else None,
            "capsuleClear":clear,
            "blockingTriangle":blocking,
            "preliminaryClear":safe,
            "floorTrianglesChecked":checks,
            "capsuleTrianglesChecked":capchecks,
        }
        allsource.append(row)
        if not safe:blocked_interior.append(row["entityID"])
        # Four directions at three different radii from each authored
        # spawn. Original geometry is surveyed without teleporting
        # a player or treating separate elevations as walkable routes.
        for distance in (1.,2.5,5.):
            for k in range(8):
                theta=k*math.tau/8
                xx=x+math.cos(theta)*distance
                zz=z+math.sin(theta)*distance
                if not arena.allowed(xx,zz):
                    continue
                newfloor,count=new.floor_at(xx,y,zz,down=3.0,up=1.5)
                oldwalk,_=old.floor_at(xx,y,zz,down=3.0,up=1.5)
                if newfloor:summary["neighborSamplesWithFloor"]+=1
                if newfloor and newfloor["material"]==1:summary["neighborSamplesOnSlot1"]+=1
                if newfloor and -0.65<=newfloor["groundDelta"]<=0.8:
                    summary["neighborSamplesWithNearbyFloor"]+=1
                if not oldwalk and newfloor:summary["newlyFoundFloorOverCore"]+=1
                if oldwalk and not newfloor:summary["lostFloorComparedWithCore"]+=1
                spots.append({
                    "sourceSpawnID":entry["id"],
                    "worldXZ":[round(xx,4),round(zz,4)],
                    "referenceSourceY":round(y,4),
                    "islandInterior":True,
                    "oldFloorFound":oldwalk is not None,
                    "newFloorFound":newfloor is not None,
                    "newFloorHeightDelta":round(newfloor["groundDelta"],4) if newfloor else None,
                    "newFloorSlot":newfloor["material"] if newfloor else None,
                    "sourceSurfaceIndex":newfloor["triangle"] if newfloor else None,
                })
    summary["totalNeighborSamplesInside"]=len(spots)
    # No arbitrary invented geometry or spawn fixes allowed.
    result={
      "format":"OCTAVUS-NATIVE-INTERIOR-PREFLIGHT94",
      "status":"staging-only-not-live",
      "sourceRevision":829,
      "sourceCollisionSHA256":report["sha256"],
      "sourceCollisionTriangles":new.count,
      "sourceVisualTriangles":report["sourceTriangles"],
      "previousArchitectureTriangles":old.count,
      "nativePlainFloorWallCandidates":new.surface_counter[1],
      "perimeterSegments":len(arena.segments),
      "originalStartsExamined":len(allsource),
      "originalSpawnPreflight":allsource,
      "spawnsRequiringReview":blocked_interior,
      "nearSpawnSurvey":spots,
      "surveyCounts":dict(sorted(summary.items())),
      "sourceEmptyOrBuriedFaceParityProven":False,
      "physicallyCompleteInsideFootprint":False,
      "serverAndClientGameplayControllerSynchronized":False,
      "liveMapModified":False,
      "limitations":[
        "Material slot 1 collision candidates are extracted using original source octree occupancy samples; this is not engine-exact solid collision.",
        "Survey floor hits may be hidden interior faces; compare against original Red Eclipse game for correctness before declaring support.",
        "The native visual candidate's triangles can cross the user wall. Height-independent perimeter containment remains separately enforced.",
        "Nearest floor and stationary capsule preflight do not prove stair ascent, continuous movement, jumping or route connectivity.",
        "Current player and server still use old OCT1 game collision. This isolated source candidate is not live."
      ]
    }
    OUT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items()
         if k not in ("originalSpawnPreflight","nearSpawnSurvey","limitations")},indent=2))
    print("Original starts requiring review:",blocked_interior)
    return result

if __name__=="__main__":
    preflight()
