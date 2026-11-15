"""Phase 5.1: release/deployment and live multiplayer transport contracts."""
import asyncio
import json
import os
import re
import time
import unittest
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer
import server

ROOT = Path(__file__).parent
RELEASE = "05.5"

class ReleaseAssets(unittest.TestCase):
    def test_client_module_imports_exist(self):
        # Everything in the game's first-party ES-module graph must resolve
        # before we publish a Render build. Vendor imports use the import map.
        for path in (ROOT / "static").glob("*.js"):
            source = path.read_text(encoding="utf-8")
            for rel in re.findall(r"""\bfrom\s+['"]([.][^'"]+)['"]""", source):
                dest = (path.parent / rel).resolve()
                self.assertTrue(dest.is_relative_to(ROOT / "static"),
                                f"{path.name}: module escaped static: {rel}")
                self.assertTrue(dest.is_file(),
                                f"{path.name}: missing local import: {rel}")

    def test_only_one_active_city_in_registry_and_same_map_bytes(self):
        first = (ROOT / "static/map.json").read_bytes()
        active = (ROOT / "static/maps/cyberpunk.json").read_bytes()
        self.assertEqual(first, active, "Editor/test map differs from live map")
        registry = json.loads((ROOT / "static/maps/index.json").read_text())
        active_maps = [m for m in registry["maps"] if m["available"]]
        self.assertEqual(len(active_maps), 1)
        self.assertEqual(active_maps[0]["url"], "/static/maps/cyberpunk.json")
        self.assertEqual(registry["default"], "cyberpunk")

    def test_release_version_is_consistent(self):
        pkg = json.loads((ROOT / "package.json").read_text())
        lock = json.loads((ROOT / "package-lock.json").read_text())
        html = (ROOT / "static/index.html").read_text()
        self.assertEqual(pkg["version"], "5.5.0")
        self.assertEqual(lock["version"], pkg["version"])
        self.assertEqual(lock["packages"][""]["version"], pkg["version"])
        self.assertIn("<sup>05.5</sup>", html)
        self.assertIn("CROSSFIRE", html)
        self.assertEqual(server.RELEASE, RELEASE)

class ReleaseMultiplayer(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        server.rooms.clear()
        self.client = TestClient(TestServer(server.make_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        server.rooms.clear()

    async def state(self, ws):
        while True:
            frame = await ws.receive_json(timeout=3)
            if frame.get("type") == "state":
                return frame

    async def test_http_build_metadata_and_required_assets(self):
        res = await self.client.get("/health")
        self.assertEqual(res.status, 200)
        health = await res.json()
        self.assertTrue(health["ok"])
        self.assertEqual(health["release"], RELEASE)
        self.assertEqual(health["phase"], RELEASE)
        self.assertEqual(health["mapId"], "cyberpunk")
        self.assertIn("buildCommit", health)
        self.assertIsInstance(health["metrics"], dict)
        for uri in (
            "/", "/static/game.js", "/static/world.js",
            "/static/lighting42.js", "/static/environment43.js",
            "/static/atmosphere44.js", "/static/living45.js",
            "/static/control54.js", "/static/minimap.js", "/static/match35.js",
            "/static/competitive55.js",
            "/static/polish46.js", "/static/maps/cyberpunk.json",
        ):
            asset = await self.client.get(uri)
            self.assertEqual(asset.status, 200, uri)
            self.assertEqual(asset.headers.get("Cache-Control"), "no-cache", uri)

    async def test_two_clients_join_share_snapshots_and_transfer_host(self):
        create = await self.client.post("/api/rooms", json={"mapId": "cyberpunk"})
        self.assertEqual(create.status, 200)
        room_info = await create.json()
        code = room_info["room"]
        alice = await self.client.ws_connect(f"/ws/{code}?name=Alpha")
        first = await alice.receive_json(timeout=2)
        bob = await self.client.ws_connect(f"/ws/{code}?name=Bravo")
        second = await bob.receive_json(timeout=2)
        self.assertEqual(first["type"], "welcome")
        self.assertEqual(second["type"], "welcome")
        self.assertNotEqual(first["id"], second["id"])
        room = server.rooms[code]
        self.assertEqual(room.host, first["id"])
        snapshot = await self.state(alice)
        self.assertEqual(snapshot["type"], "state")
        self.assertEqual(snapshot["mapId"], "cyberpunk")
        self.assertIn(snapshot["phase"], ("lobby", "countdown"))
        self.assertIn("snapshotSeq", snapshot)
        self.assertEqual(len(room.players), 2)
        await bob.send_json({"type": "start"})
        await asyncio.sleep(.07)
        self.assertEqual(room.phase, "lobby", "Only host may start a match")
        await alice.send_json({"type": "start"})
        await asyncio.sleep(.07)
        self.assertEqual(room.phase, "countdown")
        await bob.send_json({"type": "ping", "t": 517})
        while True:
            event = await bob.receive_json(timeout=3)
            if event.get("type") == "pong":
                self.assertEqual(event["t"], 517)
                self.assertTrue(abs(event["serverTime"]-time.monotonic()) < 3)
                break
        await alice.close()
        await asyncio.sleep(.07)
        self.assertEqual(room.host, second["id"],
                         "Remaining player must inherit host rights")
        await bob.close()

if __name__ == "__main__":
    unittest.main()
