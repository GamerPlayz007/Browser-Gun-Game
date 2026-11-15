"""CROSSFIRE V3 release candidate — cosmetic presets only (no gameplay effects)."""
PALETTE56=(0xd38165,0x54b2ba,0xc5a65f,0x9f8cd4)
def normalize_skin56(value):
    """Treat arbitrary client values as untrusted; accept IDs 0–3 only."""
    if type(value) is int and 0<=value<len(PALETTE56):
        return value
    return 0
