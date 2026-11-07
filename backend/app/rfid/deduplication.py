import time
from typing import Dict, Tuple

class SlidingWindowDeduplicator:
    """
    Hardware-neutral RFID event deduplication engine.
    Suppresses duplicate reads of the same RFID tag at the same reader
    within a sliding window (default 3000ms).
    """
    def __init__(self, default_window_ms: int = 3000):
        self.default_window_ms = default_window_ms
        # Cache key: (reader_id, tag_uid) -> timestamp_float
        self._cache: Dict[Tuple[str, str], float] = {}

    def is_duplicate(self, reader_id: str, tag_uid: str, window_ms: int = None) -> bool:
        effective_window_sec = (window_ms or self.default_window_ms) / 1000.0
        now = time.time()
        key = (reader_id.strip().upper(), tag_uid.strip().upper())

        last_seen = self._cache.get(key)
        if last_seen is not None and (now - last_seen) < effective_window_sec:
            # Duplicate read detected within sliding window
            return True

        # Update last seen timestamp
        self._cache[key] = now
        self._cleanup_expired(now, effective_window_sec * 5)
        return False

    def clear(self):
        """Clears the deduplication cache (useful for test resets)."""
        self._cache.clear()

    def _cleanup_expired(self, now: float, max_age: float):
        """Purges old entries exceeding maximum retention window."""
        if len(self._cache) > 2000:
            self._cache = {
                k: v for k, v in self._cache.items() if (now - v) < max_age
            }

# Global singleton deduplicator
deduplicator = SlidingWindowDeduplicator(default_window_ms=3000)
