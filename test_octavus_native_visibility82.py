"""Octavus Phase 1.4 - source cube-adjacency and exact-coverage proof tests."""
from dataclasses import replace
import unittest

from scripts.octavus_native_geometry77 import (
    Cube, NativeWorld, implicit_polygon,
    OCT_SOLID, OCT_EMPTY, OCT_NORMAL
)
from scripts.octavus_native_visibility82 import (
    covers_entire_native_face, definitely_covered,
    area_covers_box, polygon_bbox, FULL_EDGE, FACE_EDGE_IDS
)

SOLID=bytes([FULL_EDGE])*12

def make_cube(index, kind=OCT_EMPTY, edges=SOLID, material=0):
    return Cube(tuple(((index>>k)&1)*4096 for k in range(3)),
                4096,kind,edges,(1,)*6,material,0,None,None)

def make_world(kind0=OCT_SOLID,kind1=OCT_SOLID, edges1=SOLID, material1=0):
    roots=[make_cube(i) for i in range(8)]
    roots[0]=make_cube(0,kind0)
    roots[1]=make_cube(1,kind1,edges1,material1)
    return NativeWorld(tuple(roots))

class TestNativeVisibility(unittest.TestCase):
    def test_exact_cube_face_edge_nibbles(self):
        normal=make_cube(1,OCT_NORMAL,SOLID)
        self.assertTrue(all(covers_entire_native_face(normal,o) for o in range(6)))
        edges=bytearray(SOLID)
        edges[FACE_EDGE_IDS[0][0]]=0x70
        deformed=make_cube(1,OCT_NORMAL,bytes(edges))
        self.assertFalse(covers_entire_native_face(deformed,0))
        self.assertTrue(covers_entire_native_face(deformed,2))
        self.assertFalse(covers_entire_native_face(make_cube(1,OCT_EMPTY),0))

    def test_materialized_native_neighbour_is_kept_conservatively(self):
        cube=make_cube(1,OCT_NORMAL,SOLID,material=64)
        self.assertFalse(covers_entire_native_face(cube,0))

    def test_native_solid_cross_world_center_is_occluded(self):
        world=make_world()
        c=world.roots[0]
        poly=implicit_polygon(c,1)
        self.assertTrue(definitely_covered(world,c,1,poly))

    def test_exact_normal_cube_full_boundary_also_occludes(self):
        # OCTSAV_NORMAL with a fully solid face is opaque to the engine.
        world=make_world(kind1=OCT_NORMAL)
        c=world.roots[0]
        poly=implicit_polygon(c,1)
        self.assertTrue(definitely_covered(world,c,1,poly))

    def test_deformed_with_open_boundary_does_not_occlude(self):
        edge=bytearray(SOLID)
        edge[FACE_EDGE_IDS[0][0]]=0x70
        world=make_world(kind1=OCT_NORMAL,edges1=bytes(edge))
        c=world.roots[0]
        poly=implicit_polygon(c,1)
        self.assertFalse(definitely_covered(world,c,1,poly))

    def test_partial_child_coverage_must_not_erase_visible_opening(self):
        world=make_world()
        near=world.roots[1]
        children=[]
        for i in range(8):
            co=tuple(near.origin[k]+((i>>k)&1)*2048 for k in range(3))
            kind=OCT_EMPTY if i==0 else OCT_SOLID
            children.append(Cube(co,2048,kind,SOLID,(1,)*6,0,0,None,None))
        world.roots=tuple(replace(near,kind=0,children=tuple(children)) if i==1 else x for i,x in enumerate(world.roots))
        poly=implicit_polygon(world.roots[0],1)
        self.assertFalse(definitely_covered(world,world.roots[0],1,poly),
                         "Open quadrant must prevent full-face occlusion")

    def test_external_native_world_boundary_not_rendered(self):
        world=make_world()
        c=world.roots[0]
        self.assertTrue(definitely_covered(world,c,0,implicit_polygon(c,0)))

    def test_recessed_partial_cube_face_is_preserved(self):
        world=make_world()
        c=world.roots[0]
        poly=list(implicit_polygon(c,1))
        poly[0]=(poly[0][0]-10,poly[0][1],poly[0][2])
        self.assertFalse(definitely_covered(world,c,1,poly),
                         "Do not erase native deformed face recessed in a cube")


if __name__=="__main__":
    unittest.main()
