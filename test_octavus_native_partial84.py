"""Octavus phase 1.5 source-native partial face clipping invariants."""
import unittest
from scripts.octavus_native_geometry77 import (
    Cube,NativeWorld,implicit_polygon,OCT_EMPTY,OCT_SOLID,OCT_NORMAL,
)
from scripts.octavus_native_partial84 import (
    clip_rect,polygon_area_twice,convex_polygon_contains,
    opaque_neighbor_cover,triangle_covered_by_octree,
)

EDGE=bytes([0x80])*12
def node(index, kind=OCT_EMPTY, material=0):
    return Cube(tuple(((index>>k)&1)*4096 for k in range(3)),
                4096,kind,EDGE,(1,)*6,material,0,None,None)
def children_of(root,empties=()):
    side=root.size//2
    return tuple(Cube(tuple(root.origin[k]+((i>>k)&1)*side for k in range(3)),
                side,OCT_EMPTY if i in empties else OCT_SOLID,
                EDGE,(1,)*6,0,0,None,None)
                for i in range(8))

def demo_world(neighbor=OCT_SOLID):
    roots=[node(i) for i in range(8)]
    roots[0]=node(0,OCT_SOLID)
    roots[1]=node(1,neighbor)
    return NativeWorld(tuple(roots))

class NativePartialFaceTests(unittest.TestCase):
    def test_exact_rectangle_clip_leaves_only_existing_area(self):
        poly=[(0,0),(20,0),(0,20)]
        cut=clip_rect(poly,0,10,0,10)
        self.assertEqual(abs(polygon_area_twice(cut)),200) # 10x10 square, area=100
        self.assertTrue(all(0<=p[0]<=10 and 0<=p[1]<=10 for p in cut))

    def test_touching_boundary_only_is_not_occlusion_area(self):
        self.assertEqual(clip_rect([(0,0),(10,0),(0,10)],10,20,0,10),[])

    def test_convex_source_face_contains_a_triangle(self):
        quad=[(0,0),(20,0),(20,20),(0,20)]
        self.assertTrue(convex_polygon_contains(quad,[(1,1),(4,1),(2,3)]))
        self.assertFalse(convex_polygon_contains(quad,[(1,1),(40,1),(2,3)]))
        self.assertFalse(convex_polygon_contains(
            [(0,0),(10,0),(3,3),(10,10),(0,10)],
            [(2,2),(3,2),(2,3)])) # concave is ambiguous

    def test_entire_tri_occluded_by_solid_native_neighbor(self):
        world=demo_world()
        cube=world.roots[0]
        poly=implicit_polygon(cube,1)
        self.assertTrue(triangle_covered_by_octree(world,cube,1,poly[:3]))
        self.assertTrue(triangle_covered_by_octree(world,cube,1,(poly[0],poly[2],poly[3])))

    def test_entire_tri_occluded_by_flat_normal_native_neighbor(self):
        world=demo_world(OCT_NORMAL)
        cube=world.roots[0]
        self.assertTrue(triangle_covered_by_octree(world,cube,1,implicit_polygon(cube,1)[:3]))

    def test_open_subdivided_neighbor_keeps_partial_triangle(self):
        world=demo_world()
        root=world.roots[1]
        newroot=Cube(root.origin,root.size,0,b"",(),0,0,None,children_of(root,empties=(0,)))
        world.roots=tuple(newroot if i==1 else c for i,c in enumerate(world.roots))
        cube=world.roots[0]
        poly=implicit_polygon(cube,1)
        # Both triangles of square touch the open lower-left subrectangle
        # or lower-right section; no culling without full area coverage.
        results=[triangle_covered_by_octree(world,cube,1,t)
                 for t in ((poly[0],poly[1],poly[2]),(poly[0],poly[2],poly[3]))]
        self.assertIn(False,results)

    def test_all_subdivided_solid_neighbor_hides_full_triangle(self):
        world=demo_world()
        root=world.roots[1]
        newroot=Cube(root.origin,root.size,0,b"",(),0,0,None,children_of(root))
        world.roots=tuple(newroot if i==1 else c for i,c in enumerate(world.roots))
        cube=world.roots[0]
        poly=implicit_polygon(cube,1)
        self.assertTrue(triangle_covered_by_octree(world,cube,1,poly[:3]))

    def test_translucent_neighbor_cannot_cull_until_material_reproduced(self):
        world=demo_world()
        root=world.roots[1]
        world.roots=tuple(node(1,OCT_SOLID,64) if i==1 else c
                          for i,c in enumerate(world.roots))
        cube=world.roots[0]
        self.assertFalse(triangle_covered_by_octree(world,cube,1,
                         implicit_polygon(cube,1)[:3]))

    def test_recessed_source_face_never_culled_by_exterior(self):
        world=demo_world()
        cube=world.roots[0]
        tri=list(implicit_polygon(cube,1)[:3])
        x,y,z=tri[0];tri[0]=(x-8,y,z)
        self.assertFalse(triangle_covered_by_octree(world,cube,1,tri))

if __name__=="__main__":
    unittest.main()
