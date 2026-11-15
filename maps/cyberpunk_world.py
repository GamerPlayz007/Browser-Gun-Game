"""Single CROSSFIRE production map generator.

Rebuilds the complete 120 m cyberpunk city from one deterministic source.
No old selectable Cyberpunk arena remains in the game registry.
"""
from maps.base_city import build as build_original
from maps.stage4_greybox import overlay as greybox
from maps.stage5_detail import overlay as detail
from maps.stage6_expansion import overlay as expansion
from maps.stage4_greybox import subtract

ARCADE = dict(
    id="PD-01", name="Station–Plaza Arcade",
    fromZone="transit", toZone="plaza", width=3.2, clearance=2.6,
    points=[(2, 1, -11), (2, 1, 6), (2, 0, 11), (2, 0, 22)],
    kind="public-arcade",
    note="Ground station frontage to plaza; the elevated platform is separate."
)


def open_edge_walls_around_authored_routes(city):
    """Preserve visible walls but carve real openings wherever a route crosses.

    The Stage 6 perimeter slabs were originally authored before the current
    Stage 4 route headroom test. Subtract route corridors from those slabs
    rather than disabling all edge-wall collisions.
    """
    new_boxes=[]
    for wall in city["boxes"]:
        if wall.get("kind")!="edgeWall":
            new_boxes.append(wall)
            continue
        pieces=[(
            wall["x"]-wall["w"]/2,wall["y"],wall["z"]-wall["d"]/2,
            wall["x"]+wall["w"]/2,wall["y"]+wall["h"],wall["z"]+wall["d"]/2
        )]
        for route in city["routes"]+city["stairs"]:
            half=route["width"]/2+0.3
            for a,b in zip(route["points"],route["points"][1:]):
                cut=(min(a[0],b[0])-half,min(a[1],b[1])-.1,
                     min(a[2],b[2])-half,max(a[0],b[0])+half,
                     max(a[1],b[1])+3.2,max(a[2],b[2])+half)
                if cut[0]>=wall["x"]+wall["w"]/2 or cut[3]<=wall["x"]-wall["w"]/2:
                    continue
                if cut[2]>=wall["z"]+wall["d"]/2 or cut[5]<=wall["z"]-wall["d"]/2:
                    continue
                pieces=[p for piece in pieces for p in subtract(piece,cut)]
        for x0,y0,z0,x1,y1,z1 in pieces:
            part=dict(wall)
            part.update(x=round((x0+x1)/2,5),y=round(y0,5),
                        z=round((z0+z1)/2,5),w=round(x1-x0,5),
                        h=round(y1-y0,5),d=round(z1-z0,5))
            new_boxes.append(part)
    # The G1 south-service corridor straddles the removed legacy perimeter:
    # provide a real walkable slab under the full six-metre route width.
    # This is physical geometry, not an invisible collision-only bridge.
    new_boxes.append(dict(
        x=-9.0,y=0.74,z=35.6,w=28.0,h=0.26,d=7.8,
        kind="routeFloor",style="road",zone="plaza",
        route="G1",stage6Physical=True,structure="south-service-apron"
    ))
    city["boxes"]=new_boxes
    city["stage6"]["final_collider_count"]=len(new_boxes)
    return city

def build(weapons, quality="ultra"):
    original = build_original(weapons)
    result = expansion(detail(greybox(original), quality), quality)
    result["id"] = "cyberpunk"
    result["name"] = "Cyberpunk City"
    result["revision"] = "03.2"
    # Stage 2.5 discovered and simulated this arcade, but did not change its colliders.
    assert all(route["id"] != ARCADE["id"] for route in result["routes"])
    result["routes"].append(dict(ARCADE))
    result = open_edge_walls_around_authored_routes(result)
    result["stage6"]["no_deployment"] = False
    result["liveBuild"] = dict(
        singleArena=True, source="phase1-stage4-6/phase2-stage5",
        version="03.2", livePlaytestPending=True,
    )
    return result
