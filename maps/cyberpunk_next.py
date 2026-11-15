"""Stage 3.1 opt-in expanded Cyberpunk City map compiler.

Generated from the *actual* current CROSSFIRE weapon and map schema.
Keeps all production mechanics unchanged until client/server parity tests pass.
"""
from maps.cyberpunk import build as build_original
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
    result["id"] = "cyberpunk-next"
    result["name"] = "Cyberpunk City / Rebuilt (Experimental)"
    result["revision"] = "03.1-integration-candidate"
    # Stage 2.5 discovered and simulated this arcade, but did not change its colliders.
    assert all(route["id"] != ARCADE["id"] for route in result["routes"])
    result["routes"].append(dict(ARCADE))
    result["stage31"] = dict(
        release="EXPERIMENTAL - NOT APPROVED FOR PRODUCTION",
        physical_map_width=120,
        context_map_width=160,
        legacy_map_unchanged=True,
        movement="CURRENT 30Hz SERVER-CLIENT PARITY; 60Hz PROTOTYPE NOT ACTIVATED",
        integration_gates=["native movement traversal", "multiplayer soak", "GPU benchmark"],
    )
    return result
