"""Octavus Phase 1.2 native geometry unit and source reproducibility tests."""
import struct
import unittest

from scripts.octavus_native_geometry77 import (
    Builder, Cube, Face, NativeWorld, CORNERS, FACES,
    cube_corner, implicit_polygon, visible_polygon,
    build_geometry, triangle_area_sq, pack_mesh,
    read_tree, source_tree
)
from scripts.decode_octavus_octree76 import Cursor, OCT_EMPTY, OCT_SOLID, OCT_NORMAL


def makecube(i,kind=OCT_EMPTY,edges=None,merged=0,faces=None):
    return Cube(((i&1)*4096, ((i>>1)&1)*4096,((i>>2)&1)*4096),
                4096,kind,
                edges if edges is not None else bytes([0x80])*12,
                (1,)*6,0,merged,faces,None)


class OctavusNativeGeometryTests(unittest.TestCase):
    def test_native_cube_edges_exactly_match_reference(self):
        c=makecube(0,OCT_SOLID)
        for i,bits in enumerate(CORNERS):
            self.assertEqual(cube_corner(c,i),
                tuple(8 if component else 0 for component in bits))
        # Deform a single end of a cube X edge.
        edge=bytearray(c.edges)
        edge[0] = 0x70
        c=makecube(0,OCT_NORMAL,bytes(edge))
        self.assertEqual(cube_corner(c,6)[0],0)
        self.assertEqual(cube_corner(c,7)[0],7)

    def test_native_geometry_face_winding_and_scale(self):
        cube=makecube(0,OCT_SOLID)
        expected={
            0:(0,0,0), 1:(32768,32768,32768),
        }
        for face in range(6):
            poly=implicit_polygon(cube,face)
            self.assertEqual(len(poly),4)
            self.assertTrue(all(0<=p[k]<=32768 for p in poly for k in range(3)))
            for point in poly:
                self.assertEqual(point[face//2],32768 if face&1 else 0)
            self.assertGreater(triangle_area_sq(*poly[:3]),0)

    def test_exactly_eight_empty_root_leaves_produce_no_mesh(self):
        roots=tuple(makecube(i,OCT_EMPTY) for i in range(8))
        geometry=build_geometry(NativeWorld(roots))
        self.assertEqual(len(geometry.vertices),0)
        self.assertEqual(len(geometry.indices),0)

    def test_single_solid_cube_produces_12_triangles(self):
        roots=tuple(makecube(i,OCT_SOLID if i==0 else OCT_EMPTY) for i in range(8))
        geometry=build_geometry(NativeWorld(roots))
        self.assertEqual(len(geometry.indices),12)
        self.assertEqual(len(geometry.vertices),8)
        raw=pack_mesh(geometry)
        self.assertEqual(raw[:4],b"OCN2")
        self.assertEqual(struct.unpack_from("<II",raw,4),(8,12))

    def test_shared_solid_surface_is_removed(self):
        roots=tuple(makecube(i,OCT_SOLID if i in (0,1) else OCT_EMPTY) for i in range(8))
        geometry=build_geometry(NativeWorld(roots))
        self.assertEqual(len(geometry.indices),20)
        self.assertEqual(geometry.faces["occludedBySolidNeighbor"],2)

    def test_explicit_merged_surface_survives(self):
        original=makecube(0,OCT_SOLID)
        source_face=Face(info=4,flag=4,
                         verts=implicit_polygon(original,5))
        roots=tuple(makecube(i,OCT_SOLID if i==0 else OCT_EMPTY,
                             merged=(1<<5) if i==0 else 0,
                             faces={5:source_face} if i==0 else None)
                    for i in range(8))
        geometry=build_geometry(NativeWorld(roots))
        self.assertEqual(len(geometry.indices),12)
        self.assertEqual(geometry.faces["explicitMerged"],1)

    def test_source_octree_round_trip_structural_consistency(self):
        world, metrics=source_tree()
        self.assertEqual(len(world.roots),8)
        self.assertEqual(metrics["leaves"],704159)
        self.assertEqual(metrics["explicitPolygons"],49794)


if __name__=="__main__":
    unittest.main()
