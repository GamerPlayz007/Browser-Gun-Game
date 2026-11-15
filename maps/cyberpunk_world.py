"""Single CROSSFIRE production map generator.

Rebuilds the complete 120 m cyberpunk city from one deterministic source.
No old selectable Cyberpunk arena remains in the game registry.
"""
from maps.base_city import build as build_original
from maps.stage4_greybox import overlay as greybox
from maps.stage5_detail import overlay as detail
from maps.stage6_expansion import overlay as expansion

ARCADE = dict(
    id="PD-01", name="Station–Plaza Arcade",
    fromZone="transit", toZone="plaza", width=3.2, clearance=2.6,
    points=[(2, 1, -11), (2, 1, 6), (2, 0, 11), (2, 0, 22)],
    kind="public-arcade",
    note="Ground station frontage to plaza; the elevated platform is separate."
)

def build(weapons, quality="ultra"):
    original = build_original(weapons)
    result = expansion(detail(greybox(original), quality), quality)
    result["id"] = "cyberpunk"
    result["name"] = "Cyberpunk City"
    result["revision"] = "03.2"
    # Stage 2.5 discovered and simulated this arcade, but did not change its colliders.
    assert all(route["id"] != ARCADE["id"] for route in result["routes"])
    result["routes"].append(dict(ARCADE))
    result["stage6"]["no_deployment"] = False
    result["liveBuild"] = dict(
        singleArena=True, source="phase1-stage4-6/phase2-stage5",
        version="03.2", livePlaytestPending=True,
    )
    return result
