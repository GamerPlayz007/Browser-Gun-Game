"""Stage 6.4: authoritative *world data* for the original Dust Corridor.

The Python server reads the exact 96,588 authored triangles exported from the
pinned original Three.js MapGenerator. This module provides spatially indexed
mesh raycasts, ground probes, bounds checks, and spawn clearance preflight.

No map is registered as playable here. Stage 6.5 must add Python/JS fixed-step
capsule-motion parity before multiplayer can use this geometry.
"""
from __future__ import annotations

from collections import defaultdict
from functools import lru_cache
import math
import sys

from dust_collision63 import load_dust_collision63

CELL = 4.0
RADIUS = .34
CAPSULE_HEIGHT = 1.8


def closest_on_triangle(point, a, b, c):
    """Exact closest point from RTCD (same regions as the upstream JS BVH)."""
    sub=lambda p,q:(p[0]-q[0],p[1]-q[1],p[2]-q[2])
    dot=lambda p,q:sum(x*y for x,y in zip(p,q))
    add=lambda p,q,t:(p[0]+q[0]*t,p[1]+q[1]*t,p[2]+q[2]*t)
    ab=sub(b,a); ac=sub(c,a); ap=sub(point,a)
    d1=dot(ab,ap);d2=dot(ac,ap)
    if d1<=0 and d2<=0:return a
    bp=sub(point,b);d3=dot(ab,bp);d4=dot(ac,bp)
    if d3>=0 and d4<=d3:return b
    vc=d1*d4-d3*d2
    if vc<=0 and d1>=0 and d3<=0:
        return add(a,ab,d1/(d1-d3))
    cp=sub(point,c);d5=dot(ab,cp);d6=dot(ac,cp)
    if d6>=0 and d5<=d6:return c
    vb=d5*d2-d1*d6
    if vb<=0 and d2>=0 and d6<=0:
        return add(a,ac,d2/(d2-d6))
    va=d3*d6-d5*d4
    if va<=0 and d4-d3>=0 and d5-d6>=0:
        t=(d4-d3)/((d4-d3)+(d5-d6))
        bc=sub(c,b)
        return add(b,bc,t)
    denom=va+vb+vc
    if abs(denom)<1e-12:return a
    v=vb/denom;w=vc/denom
    return (a[0]+ab[0]*v+ac[0]*w,
            a[1]+ab[1]*v+ac[1]*w,
            a[2]+ab[2]*v+ac[2]*w)


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],
            a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def dot(a,b):
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]


def ray_triangle(origin, direction, a,b,c):
    """Moller-Trumbore, two-sided, segment parameter t in (0,1)."""
    e1=tuple(b[k]-a[k] for k in range(3))
    e2=tuple(c[k]-a[k] for k in range(3))
    p=cross(direction,e2)
    det=dot(e1,p)
    if abs(det)<1e-9:return None
    inv=1.0/det
    tvec=tuple(origin[k]-a[k] for k in range(3))
    u=dot(tvec,p)*inv
    if u<0 or u>1:return None
    q=cross(tvec,e1)
    v=dot(direction,q)*inv
    if v<0 or u+v>1:return None
    t=dot(e2,q)*inv
    return t if 1e-6<t<1.0 else None


class DustWorld64:
    """Read-only server geometry; fixed source SHA, stable grid, no live rooms."""

    def __init__(self, collision=None):
        self.collision=collision if collision is not None else load_dust_collision63()
        if sys.byteorder!='little':
            raise RuntimeError('Dust binary vertex decoding requires little-endian CPU')
        self.points=memoryview(self.collision.vertices).cast('f')
        self.count=self.collision.count
        self.bounds=dict(self.collision.metadata['playBounds'])
        self.spawns=self.collision.metadata['spawns']
        self.sha256=self.collision.metadata['rawSha256']
        # The original Dust source uses 4m cells. Large imported Octavus
        # geometry uses a coarser index to avoid duplicating huge terrain
        # triangles across thousands of grid cells on a 512MB server.
        self.cell=float(getattr(self.collision,'cell_size',CELL))
        if not 2.0<=self.cell<=32.0:raise ValueError('Invalid native map cell size')
        cells=defaultdict(list)
        p=self.points
        for tri in range(self.count):
            k=9*tri
            ax,bx,cx=p[k],p[k+3],p[k+6]
            az,bz,cz=p[k+2],p[k+5],p[k+8]
            for gx in range(math.floor(min(ax,bx,cx)/self.cell),math.floor(max(ax,bx,cx)/self.cell)+1):
                for gz in range(math.floor(min(az,bz,cz)/self.cell),math.floor(max(az,bz,cz)/self.cell)+1):
                    cells[gx,gz].append(tri)
        self.cells=dict(cells)

    def triangle(self,index):
        i=index*9;p=self.points
        return ((p[i],p[i+1],p[i+2]),
                (p[i+3],p[i+4],p[i+5]),
                (p[i+6],p[i+7],p[i+8]))

    def candidates(self,x0,z0,x1,z1):
        """Shared broadphase for ground, spawn and line-of-sight queries."""
        seen=set()
        for gx in range(math.floor(x0/self.cell),math.floor(x1/self.cell)+1):
            for gz in range(math.floor(z0/self.cell),math.floor(z1/self.cell)+1):
                seen.update(self.cells.get((gx,gz),()))
        return sorted(seen)

    def inside(self,x,z,margin=RADIUS):
        b=self.bounds
        return (b['x0']+margin<=x<=b['x1']-margin and
                b['z0']+margin<=z<=b['z1']-margin)

    def raycast(self,start,end):
        """Nearest exact intersection with original *triangle* surface."""
        start=tuple(start);end=tuple(end)
        direction=tuple(end[k]-start[k] for k in range(3))
        minx,maxx=sorted((start[0],end[0]))
        minz,maxz=sorted((start[2],end[2]))
        best=1.0;index=None
        y0,y1=sorted((start[1],end[1]))
        for tri in self.candidates(minx-.01,minz-.01,maxx+.01,maxz+.01):
            a,b,c=self.triangle(tri)
            if max(a[1],b[1],c[1])<y0-1e-4 or min(a[1],b[1],c[1])>y1+1e-4:
                continue
            t=ray_triangle(start,direction,a,b,c)
            if t is not None and t<best:best=t;index=tri
        if index is None:return None
        point=tuple(start[k]+direction[k]*best for k in range(3))
        return {'triangle':index,'point':point,'fraction':best,
                'distance':math.dist(start,point),
                'surface':self.collision.surface(index)}

    def ground_at(self,x,z,feet_y=0.0):
        """Find walkable ground at feet height using original mesh triangles."""
        hit=self.raycast((x,feet_y+0.48,z),(x,feet_y-1.0,z))
        if not hit:return None
        a,b,c=self.triangle(hit['triangle'])
        n=cross(tuple(b[k]-a[k] for k in range(3)),
                tuple(c[k]-a[k] for k in range(3)))
        length=math.sqrt(dot(n,n))
        if length<1e-8 or abs(n[1])/length<.67:return None
        return hit['point'][1]

    def capsule_clear(self,position,height=CAPSULE_HEIGHT,radius=RADIUS):
        """Conservative spawn preflight (not a full motion solver).

        Closest point on each nearby source triangle to multiple center-axis
        samples. The actual gameplay controller still uses swept-capsule
        collision once its Python/JS parity is ready.
        """
        x,y,z=position
        if not self.inside(x,z,radius):return False
        count=max(3,math.ceil((height-2*radius)/(radius*.55))+1)
        centers=[(x,y+radius+(height-2*radius)*i/(count-1),z) for i in range(count)]
        for tri in self.candidates(x-radius,z-radius,x+radius,z+radius):
            a,b,c=self.triangle(tri)
            # This exact mesh includes every wall, roof and stall, not AABBs.
            ylo=min(a[1],b[1],c[1]);yhi=max(a[1],b[1],c[1])
            if ylo>y+height+radius or yhi<y-radius:continue
            for p in centers:
                q=closest_on_triangle(p,a,b,c)
                if sum((p[k]-q[k])**2 for k in range(3)) < (radius-.012)**2:
                    return False
        return True

    def validated_spawns(self):
        """Source-spawn indices and reasons, preserving authored positions."""
        result={}
        for side,points in self.spawns.items():
            safe=[];rejected=[]
            for index,p in enumerate(points):
                x,y,z=p
                if not self.inside(x,z):
                    rejected.append({'index':index,'reason':'outside play bounds'})
                elif (ground:=self.ground_at(x,z,y)) is None or abs(y-ground)>.35:
                    rejected.append({'index':index,'reason':'terrain mismatch'})
                elif not self.capsule_clear(p):
                    rejected.append({'index':index,'reason':'source mesh obstruction'})
                else:safe.append(index)
            result[side]={'safeIndices':safe,'rejected':rejected}
        return result

    def metadata(self):
        return {'id':'dust_corridor','name':'Dust Corridor',
                'available':False,'multiplayer':False,
                'collisionFormat':'DUSTCOL3',
                'triangleCount':self.count,'sha256':self.sha256,
                'playBounds':self.bounds,'spawns':self.spawns,
                'validatedSpawns':self.validated_spawns()}


@lru_cache(maxsize=1)
def get_dust_world64():
    """Loaded on preview/API access, not on regular live room startup."""
    return DustWorld64()
