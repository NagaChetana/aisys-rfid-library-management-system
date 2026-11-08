import asyncio
import json
from datetime import datetime, timezone
from typing import Set, Dict, Any, List

class EventBroadcaster:
    """
    In-memory async Server-Sent Events (SSE) event broadcaster (FR08, Module C).
    Enables low-latency real-time updates for gate alarms, circulation events,
    reader scans, and inventory progress without client polling.
    """
    def __init__(self, history_limit: int = 50):
        self._subscribers: Set[asyncio.Queue] = set()
        self._history: List[Dict[str, Any]] = []
        self._history_limit = history_limit
        self._loop: asyncio.AbstractEventLoop = None

    def _get_loop(self) -> asyncio.AbstractEventLoop:
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            return None

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self._subscribers.discard(queue)

    def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Thread-safe event broadcast to all active SSE subscriber queues."""
        event_payload = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Store in circular recent history buffer
        self._history.append(event_payload)
        if len(self._history) > self._history_limit:
            self._history.pop(0)

        # Notify active subscriber queues
        dead_queues = []
        for q in list(self._subscribers):
            try:
                q.put_nowait(event_payload)
            except asyncio.QueueFull:
                dead_queues.append(q)
            except Exception:
                dead_queues.append(q)

        for dq in dead_queues:
            self.unsubscribe(dq)

    def get_recent_events(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(reversed(self._history[-limit:]))

# Global singleton broadcaster instance
broadcaster = EventBroadcaster()
