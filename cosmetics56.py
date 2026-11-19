"""CROSSFIRE cosmetics: authoritative, unique random player colors per room."""
import random

PALETTE56=(0xff963c,0x31d7e3,0xf3d94e,0xb179f6,0x86e84e,0xee78c2,0x5a88f4,0xed4e5c)

def normalize_skin56(value):
    """Validate cosmetic IDs for backwards-compatible snapshots."""
    if type(value) is int and 0<=value<len(PALETTE56):
        return value
    return 0

def random_skin56(used=()):
    """Randomly pick an unused outfit color; recycle only if all are occupied."""
    taken=set(used)
    available=[id for id in range(len(PALETTE56)) if id not in taken]
    return random.choice(available if available else range(len(PALETTE56)))
