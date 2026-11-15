"""CROSSFIRE 05.4: probe the ACTUAL deployed website and two-player transport.

Usage: python check_live51.py https://your-service.onrender.com
Requires: pip install -r requirements.txt

This makes an ephemeral room, connects two test clients, sends a ping,
and closes both clients. It never starts a real match or changes code.
"""
import asyncio
import json
import sys
import time
from urllib.parse import urlsplit
from aiohttp import ClientSession, ClientTimeout, WSMsgType

EXPECTED_RELEASE = "05.4"
ASSETS = (
    "/", "/static/game.js", "/static/world.js", "/static/living45.js",
    "/static/atmosphere44.js", "/static/polish46.js",
    "/static/maps/cyberpunk.json",
)

def endpoint(base):
    parsed = urlsplit(base)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Use a full http(s) Render URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("URL must not contain credentials, a query, or a fragment")
    return f"{parsed.scheme}://{parsed.netloc}"

async def probe(base):
    base = endpoint(base)
    print("Checking", base)
    # Cold Render instances can require extra startup time before /health responds.
    async with ClientSession(timeout=ClientTimeout(total=120, connect=90)) as session:
        async with session.get(base + "/health") as response:
            if response.status != 200:
                raise RuntimeError(f"/health returned HTTP {response.status}")
            health = await response.json()
        if not health.get("ok"):
            raise RuntimeError("/health did not report a healthy server")
        if health.get("release") != EXPECTED_RELEASE:
            raise RuntimeError(
                f"Unexpected deployment: expected {EXPECTED_RELEASE}, "
                f"received {health.get('release')!r}. Render may still deploy."
            )
        print("PASS /health", json.dumps({
            "release": health.get("release"),
            "commit": health.get("buildCommit"),
            "map": health.get("mapId"),
        }))
        for path in ASSETS:
            async with session.get(base + path) as response:
                if response.status != 200:
                    raise RuntimeError(f"{path}: HTTP {response.status}")
                if path == "/":
                    text = await response.text()
                    if f"<sup>{EXPECTED_RELEASE}</sup>" not in text:
                        raise RuntimeError("Homepage version does not match the server")
                else:
                    await response.read()
        print("PASS homepage and", len(ASSETS) - 1, "static assets")
        async with session.get(base + "/api/maps") as response:
            registry = await response.json()
            if registry.get("default") != "cyberpunk":
                raise RuntimeError("Default map is not Cyberpunk City")
        print("PASS map registry")
        async with session.post(base + "/api/rooms", json={"mapId": "cyberpunk"}) as response:
            if response.status != 200:
                raise RuntimeError(f"Room creation failed: HTTP {response.status}")
            room = await response.json()
            code = room["room"]
        scheme = "wss" if base.startswith("https:") else "ws"
        ws_uri = scheme + base.split("://", 1)[1] + "/ws/" + code
        async with session.ws_connect(ws_uri + "?name=ProbeA", heartbeat=15) as alice:
            welcome_a = await alice.receive_json(timeout=12)
            async with session.ws_connect(ws_uri + "?name=ProbeB", heartbeat=15) as bob:
                welcome_b = await bob.receive_json(timeout=12)
                if welcome_a.get("type") != "welcome" or welcome_b.get("type") != "welcome":
                    raise RuntimeError("Missing WebSocket join handshake")
                if welcome_a.get("id") == welcome_b.get("id"):
                    raise RuntimeError("Two players received the same ID")
                if welcome_a.get("room") != code or welcome_b.get("room") != code:
                    raise RuntimeError("Room mismatch in welcome message")
                await bob.send_json({"type": "ping", "t": 517})
                async with asyncio.timeout(12):
                    while True:
                        message = await bob.receive()
                        if message.type != WSMsgType.TEXT:
                            raise RuntimeError("WebSocket closed before pong")
                        data = json.loads(message.data)
                        if data.get("type") == "pong":
                            if data.get("t") != 517:
                                raise RuntimeError("Pong timestamp not echoed")
                            break
                print("PASS two-player WebSocket handshake and server ping")
        print("PASS CROSSFIRE", EXPECTED_RELEASE, "basic deployment smoke check")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python check_live51.py https://your-service.onrender.com")
    try:
        asyncio.run(probe(sys.argv[1]))
    except (Exception, KeyboardInterrupt) as error:
        sys.exit(f"FAIL deployment smoke check: {error}")
