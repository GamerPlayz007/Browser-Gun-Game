"""Prove all native plain-face merges preserve exact source geometry."""
import unittest
from scripts.octavus_native_merge83 import (
    rectangle_from_pair,coalesce,triangles_from_rectangle,native_xyz
)

class OriginalOctavusPlaneMerge(unittest.TestCase):
    def test_two_triangles_recognized_as_exact_quad(self):
        v=[(0,0,20),(8,0,20),(8,8,20),(0,8,20)]
        first=(0,1,2,1)
        second=(0,2,3,1)
        self.assertEqual(rectangle_from_pair(first,second,v),
                         (2,20,1,0,8,0,8))

    def test_sloped_quad_not_flattened(self):
        v=[(0,0,20),(8,0,20),(8,8,24),(0,8,20)]
        self.assertIsNone(rectangle_from_pair((0,1,2,1),(0,2,3,1),v))

    def test_quad_with_wrong_triangle_pair_not_merged(self):
        v=[(0,0,20),(8,0,20),(8,8,20),(0,8,20)]
        self.assertIsNone(rectangle_from_pair((0,1,2,1),(1,2,3,1),v))

    def test_complete_tile_area_can_collapse_into_single_rectangle(self):
        tiles=[(x,x+8,y,y+8) for x in (0,8,16,24) for y in (0,8,16)]
        rectangles,iters=coalesce(tiles)
        self.assertEqual(rectangles,[(0,32,0,24)])
        self.assertGreaterEqual(iters,2)

    def test_does_not_fill_gap_or_hole_in_original_source(self):
        original=[(0,8,0,8),(16,24,0,8),(0,8,8,16),(16,24,8,16)]
        rectangles,_=coalesce(original)
        self.assertEqual(len(rectangles),2)
        self.assertEqual(sum((r[1]-r[0])*(r[3]-r[2]) for r in rectangles),4*64)
        self.assertTrue(all(r[0]!=8 and r[1]!=16 for r in rectangles))

    def test_winding_is_preserved_for_both_normals(self):
        for sign in (-1,1):
            tri1,tri2=triangles_from_rectangle(2,20,sign,0,8,0,8)
            a,b,c=tri1
            cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
            self.assertEqual(1 if cross>0 else -1,sign)
            self.assertEqual(tri1[0],tri2[0])

    def test_reconstruct_other_axis_native_coordinate(self):
        self.assertEqual(native_xyz(0,12,20,30),(12,20,30))
        self.assertEqual(native_xyz(1,12,20,30),(20,12,30))

if __name__=='__main__':
    unittest.main()
