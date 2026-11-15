"""CROSSFIRE 03.6: lightweight aggregate server diagnostics.

Measures real in-process loop work and serialized snapshot sizes. Does not
claim GPU FPS, Internet RTT, or include identifiable player information.
"""
import math
import time
from collections import deque


def percentile(values, fraction):
    data = sorted(x for x in values if math.isfinite(x) and x >= 0)
    if not data:
        return 0.0
    index = max(0, min(len(data)-1, math.ceil(len(data)*fraction)-1))
    return round(data[index], 3)


class ServerMetrics:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.start = clock()
        self.loop_ms = deque(maxlen=600)
        self.snapshot_bytes = deque(maxlen=600)
        self.loop_count = 0
        self.snapshot_count = 0
        self.published_bytes = 0
        self.publish_recipients = 0

    def observe_loop(self, duration_ms):
        if not isinstance(duration_ms,(int,float)) or not math.isfinite(duration_ms) or duration_ms < 0:
            return
        self.loop_ms.append(duration_ms)
        self.loop_count += 1

    def observe_snapshot(self, payload_bytes, recipients):
        if not isinstance(payload_bytes,int) or payload_bytes < 0:
            return
        if not isinstance(recipients,int) or recipients < 0:
            return
        self.snapshot_bytes.append(payload_bytes)
        self.snapshot_count += 1
        self.published_bytes += payload_bytes * recipients
        self.publish_recipients += recipients

    def summary(self, clients=0, rooms=0):
        # Existing health endpoint is public: only aggregate counters/latencies.
        return {
            "uptimeSec": round(max(0.,self.clock()-self.start),1),
            "clients": max(0,int(clients)),
            "rooms": max(0,int(rooms)),
            "serverWorkMsP50": percentile(self.loop_ms,.50),
            "serverWorkMsP95": percentile(self.loop_ms,.95),
            "serverWorkMsP99": percentile(self.loop_ms,.99),
            "snapshotBytesP95": percentile(self.snapshot_bytes,.95),
            "loops": self.loop_count,
            "snapshotPackets": self.snapshot_count,
            "bytesToRecipients": self.published_bytes,
            "snapshotRecipients": self.publish_recipients
        }
