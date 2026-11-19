"""Octavus Stage 2.1: screenshot-derived native island boundary, pilot only.

This is the exact perimeter data consumed by BOTH Python and JavaScript.
It surrounds the built portion of Red Eclipse 2 Octavus (the user's
top-down screenshot), excluding the broad empty outer world.

The physical wall has 60m total span from y=-22 to +38. Movement
containment is independent of height and rejects crossing the boundary
even if the visual wall ever fails to render. In this stage it is ONLY
a source-native staging prototype, not the active CROSSFire map.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT=Path(__file__).parent
MANIFEST=ROOT/"static/maps/octavus.native-boundary92.json"
SOURCE_ENTITIES=ROOT/"static/maps/octavus.native-entities.json"
REPORT=ROOT/"static/maps/octavus.native-boundary-audit92.json"


def point_segment_distance(x,z,a,b):
    vx,vz=b[0]-a[0],b[1]-a[1]
    length2=vx*vx+vz*vz
    if length2<=1e-12:
        return math.hypot(x-a[0],z-a[1])
    t=max(0.,min(1.,((x-a[0])*vx+(z-a[1])*vz)/length2))
    return math.hypot(x-(a[0]+vx*t),z-(a[1]+vz*t))


def signed_area(vertices):
    return sum(a[0]*b[1]-a[1]*b[0] for a,b in
               zip(vertices,vertices[1:]+vertices[:1]))/2


class NativeArenaBoundary92:
    def __init__(self,manifest=MANIFEST):
        self.manifest=json.loads(Path(manifest).read_text())
        m=self.manifest
        if (m["format"]!="OCTAVUS-NATIVE-BOUNDARY92" or
                m["sourceRevision"]!=829 or m["liveMapModified"] is not False or
                m["status"]!="staging-only-not-live"):
            raise ValueError("Native arena perimeter is not an isolated original-map staging source")
        self.vertices=[tuple(map(float,p)) for p in m["polygonWorldXZ"]]
        self.radius=float(m["wall"]["playerRadius"])+float(m["wall"]["safetyMargin"])
        self.base_y=float(m["wall"]["baseY"])
        self.top_y=float(m["wall"]["topY"])
        if len(self.vertices)<16 or len(self.vertices)>256:
            raise ValueError("Incomplete screenshot-perimeter wall")
        if self.top_y<35 or self.base_y>-20 or self.top_y-self.base_y<50:
            raise ValueError("Boundary must overtop all known native source architecture")
        if len(set(self.vertices))!=len(self.vertices):
            raise ValueError("Duplicate perimeter vertices create walls with gaps")
        self.segments=list(zip(self.vertices,self.vertices[1:]+self.vertices[:1]))
        self.area=signed_area(self.vertices)
        if not 7000<abs(self.area)<12000:
            raise ValueError("Perimeter does not match requested compact visible arena")
        self.bounds=(min(p[0] for p in self.vertices),
                     max(p[0] for p in self.vertices),
                     min(p[1] for p in self.vertices),
                     max(p[1] for p in self.vertices))
        self.perimeter=sum(math.dist(a,b) for a,b in self.segments)
        if not 270<self.perimeter<420:
            raise ValueError("Suspicious source screenshot perimeter size")
        # Robust non-zero edge and self-intersection checks.
        for i,(a,b) in enumerate(self.segments):
            if math.dist(a,b)<.08:raise ValueError("Zero-length/gap-prone wall edge")
            for j,(c,d) in enumerate(self.segments):
                if i>=j or j in ((i+1)%len(self.segments),(i-1)%len(self.segments)):
                    continue
                if intersect_parameters(a,b,c,d):
                    raise ValueError("Screenshot-derived polygon self intersects")

    def contains_point(self,x,z):
        inside=False
        for a,b in self.segments:
            if ((a[1]>z)!=(b[1]>z)):
                edge_x=(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]
                if x<edge_x:inside=not inside
        return inside

    def distance_to_wall(self,x,z):
        return min(point_segment_distance(x,z,a,b) for a,b in self.segments)

    def allowed(self,x,z,radius=None):
        r=self.radius if radius is None else float(radius)
        return self.contains_point(x,z) and self.distance_to_wall(x,z)>r-1e-7

    def _first_contact(self,x,z,tx,tz,radius):
        """Analytic moving-point/capsule-to-line first intersection.

        Continuous collision is independent of vertical velocity and of
        the distance moved in a single frame, so a dash/teleport cannot
        jump between samples on opposite sides of a concave boundary.
        """
        dx,dz=tx-x,tz-z
        v2=dx*dx+dz*dz
        if v2<1e-12:return None
        earliest=None
        for a,b in self.segments:
            ax,az=a;bx,bz=b
            ex,ez=bx-ax,bz-az
            length=math.hypot(ex,ez)
            ux,uz=ex/length,ez/length
            nx,nz=-uz,ux
            proj0=(x-ax)*ux+(z-az)*uz
            projv=dx*ux+dz*uz
            dist0=(x-ax)*nx+(z-az)*nz
            distv=dx*nx+dz*nz
            if abs(distv)>1e-12:
                for side in (-radius,radius):
                    t=(side-dist0)/distv
                    if 0<=t<=1 and -1e-8<=proj0+projv*t<=length+1e-8:
                        earliest=t if earliest is None else min(earliest,t)
            for px,pz in (a,b):
                ox,oz=x-px,z-pz
                qb=2*(ox*dx+oz*dz)
                qc=ox*ox+oz*oz-radius*radius
                disc=qb*qb-4*v2*qc
                if disc<0:continue
                root=(-qb-math.sqrt(disc))/(2*v2)
                if 0<=root<=1:
                    earliest=root if earliest is None else min(earliest,root)
        return earliest

    def clip_horizontal(self,start,end,radius=None):
        """Return safe X/Z endpoint and blocked flag for movement adapter.

        The starting point must already be legal (validated spawn/previous
        simulation frame); an invalid start is rejected, never moved by
        guessing a teleport to the map center.
        """
        x,z=map(float,start);tx,tz=map(float,end)
        r=self.radius if radius is None else float(radius)
        if not self.allowed(x,z,r):
            return (x,z,True)
        hit=self._first_contact(x,z,tx,tz,r)
        if hit is None and self.allowed(tx,tz,r):
            return (tx,tz,False)
        dx,dz=tx-x,tz-z
        if hit is None:
            lo,hi=0.,1.
        else:
            lo,hi=0.,hit
        # Small numerical back-off prevents repeated edge penetration.
        for _ in range(30):
            mid=(lo+hi)/2
            if self.allowed(x+dx*mid,z+dz*mid,r):
                lo=mid
            else:hi=mid
        t=max(0.,lo-0.00005/max(math.hypot(dx,dz),1.0))
        return (x+dx*t,z+dz*t,True)


def intersect_parameters(a,b,c,d):
    """Proper segment intersections; adjacent ring vertices ignored."""
    rx,rz=b[0]-a[0],b[1]-a[1]
    sx,sz=d[0]-c[0],d[1]-c[1]
    cross=rx*sz-rz*sx
    if abs(cross)<1e-9:return False
    qx,qz=c[0]-a[0],c[1]-a[1]
    t=(qx*sz-qz*sx)/cross
    u=(qx*rz-qz*rx)/cross
    return 1e-6<t<1-1e-6 and 1e-6<u<1-1e-6


def audit():
    boundary=NativeArenaBoundary92()
    source=json.loads(SOURCE_ENTITIES.read_text())
    starts=source["playerStarts"]
    if len(starts)!=33:raise ValueError("Original native start count changed")
    records=[]
    for entry in starts:
        original=entry["sourcePosition"]
        x=(original[0]-4096)*.05
        z=(original[1]-4096)*.05
        records.append({
            "entityID":entry["id"],
            "worldXZ":[round(x,5),round(z,5)],
            "inside":boundary.contains_point(x,z),
            "wallDistance":round(boundary.distance_to_wall(x,z),4),
            "capsuleInside":boundary.allowed(x,z),
        })
    if not all(item["capsuleInside"] for item in records):
        raise ValueError("New visible footprint clips original source player starts")
    # Deterministic movement fixtures form a cross-language regression gate.
    # A long horizontal movement must hit the wall even if its Y coordinate
    # would be high above the visible wall (height-independent fallback).
    motions=[]
    for row in records[::4]:
        start=row["worldXZ"]
        for direction in range(12):
            angle=direction*math.tau/12
            target=(start[0]+math.cos(angle)*85,
                    start[1]+math.sin(angle)*85)
            px,pz,blocked=boundary.clip_horizontal(start,target)
            motions.append({
                "start":start,
                "end":[round(target[0],6),round(target[1],6)],
                "clippedEnd":[round(px,6),round(pz,6)],
                "blocked":blocked,
                "endAllowed":boundary.allowed(*target),
            })
    for row in records[::4]:
        start=row["worldXZ"]
        tx=start[0]+.04
        tz=start[1]+.02
        px,pz,blocked=boundary.clip_horizontal(start,(tx,tz))
        motions.append({
            "start":start,"end":[round(tx,6),round(tz,6)],
            "clippedEnd":[round(px,6),round(pz,6)],
            "blocked":blocked,
            "endAllowed":boundary.allowed(tx,tz),
        })
    if not all(boundary.allowed(*m["clippedEnd"]) for m in motions):
        raise ValueError("Analytic motion clipping returned an outside point")
    return {
        "format":"OCTAVUS-NATIVE-BOUNDARY-AUDIT92",
        "sourceRevision":829,
        "sourceImageSize":[548,469],
        "sourcePixelOutlineVertices":len(boundary.manifest["tracing"]["sourceOutlinePixels"]),
        "outwardSilhouettePaddingPixels":boundary.manifest["tracing"]["outwardMarginPixels"],
        "wallSegments":len(boundary.segments),
        "wallBaseY":boundary.base_y,
        "wallTopY":boundary.top_y,
        "wallHeight":boundary.top_y-boundary.base_y,
        "perimeterLengthMeters":round(boundary.perimeter,2),
        "playableAreaSquareMeters":round(abs(boundary.area),2),
        "gameWorldBoundsXZ":[round(v,4) for v in boundary.bounds],
        "originalStartsInside":sum(r["capsuleInside"] for r in records),
        "originalStartsTotal":len(records),
        "minOriginalSpawnWallClearance":min(r["wallDistance"] for r in records),
        "spawns":records,
        "motionFixtures":motions,
        "blockedMotionFixtures":sum(m["blocked"] for m in motions),
        "islandOutsideDisabled":True,
        "wallCollisionIsHeightIndependent":True,
        "clientMovementHookedIntoLiveGame":False,
        "serverMovementHookedIntoLiveGame":False,
        "liveMapModified":False,
        "limitations":[
            "Screenshot silhouette alignment is approximate and has a deliberate 7px outward safety margin.",
            "The original source-native collision remains staging-only and does not yet cover all original slot-1 floors.",
            "Arena polygon containment is independent of the unfinished world triangle collider.",
            "Visual wall and physical containment require live-game integration only after synchronized movement tests.",
        ],
    }

if __name__=="__main__":
    result=audit()
    REPORT.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k not in ("spawns","limitations")},indent=2))
