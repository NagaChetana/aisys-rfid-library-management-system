import asyncio
import json
from typing import Dict, Any, List
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.event_broadcaster import broadcaster

router = APIRouter(prefix="/events", tags=["Real-time Event Streaming (SSE)"])

@router.get("/stream")
async def sse_event_stream(request: Request):
    """
    Server-Sent Events (SSE) streaming endpoint (FR08, Module C).
    Emits real-time notifications for security gate alarms, circulation events,
    reader scans, and inventory progress.
    """
    queue = broadcaster.subscribe()

    async def event_generator():
        try:
            # Send initial connection handshake event
            yield f"event: connected\ndata: {json.dumps({'status': 'stream_connected', 'service': 'AISYS_SSE_V1'})}\n\n"

            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                try:
                    # Wait for next event with a 15-second timeout for keepalive
                    event_payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    event_name = event_payload.get("event", "message")
                    event_data = json.dumps(event_payload.get("data", {}))
                    yield f"event: {event_name}\ndata: {event_data}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP connection alive
                    yield ": ping keepalive\n\n"

        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/latest", response_model=List[Dict[str, Any]])
def get_latest_events():
    """Returns recent event buffer for fast UI synchronization upon reconnect."""
    return broadcaster.get_recent_events(limit=30)
