"""
API routes for managing generic streams (AES67 and others).

Provides endpoints under /streams that are file-backed. By default the
provider is 'aes67' which maps to /usr/local/stagepi/etc/aes67.json. Other
providers can be added by extending the stream_manager module.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core import stream_manager

router = APIRouter()


class StreamModel(BaseModel):
    id: Optional[Any] = None
    kind: Optional[str] = None  # 'sender' or 'receiver'
    ip: Optional[str] = None  # Multicast IP address
    device: Optional[str] = None  # ALSA device
    iface: Optional[str] = None  # Network interface
    port: Optional[int] = None  # RTP port
    channels: Optional[int] = 2  # Number of audio channels
    loopback: Optional[bool] = False  # Loopback for testing
    buffer_time: Optional[int] = 100000  # ALSA buffer time in microseconds (default: 100ms)
    latency_time: Optional[int] = 5000000  # ALSA latency time in microseconds (default: 5000ms)
    sync: Optional[bool] = False  # AES67 recommends sync=false for senders
    enabled: Optional[bool] = True  # Enable/disable stream
    format: Optional[str] = "S24BE"  # Audio format (S16LE, S24LE, S24BE, S32LE, etc.)

    def to_dict(self) -> dict:
        """Convert to dict."""
        return self.dict(exclude_unset=True)


class StreamsUpdateRequest(BaseModel):
    streams: list[StreamModel]


@router.get("/streams")
async def list_streams(provider: str = Query("aes67")):
    """Get all streams for a provider."""
    streams = stream_manager.get_all_streams(provider)
    return {"streams": streams}


@router.post("/streams")
async def add_stream(stream: StreamModel, provider: str = Query("aes67")):
    """Add a new stream."""
    try:
        sdict = stream.to_dict()
        streams = stream_manager.add_stream(sdict, provider)
        return {"streams": streams}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to start stream: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/streams/{stream_id}")
async def update_stream(stream_id: str, stream_update: StreamModel, provider: str = Query("aes67")):
    """Update an existing stream by ID."""
    try:
        update_dict = stream_update.to_dict()
        streams = stream_manager.update_stream(stream_id, update_dict, provider)
        return {"streams": streams}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to start stream: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/streams/{stream_id}")
async def delete_stream(stream_id: str, provider: str = Query("aes67")):
    """Delete a stream by ID."""
    try:
        streams = stream_manager.delete_stream(stream_id, provider)
        return {"streams": streams}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/streams")
async def replace_streams(streams_update: StreamsUpdateRequest, provider: str = Query("aes67")):
    """Replace all streams with a new list."""
    streams = [s.to_dict() for s in streams_update.streams]
    streams = stream_manager.replace_all_streams(streams, provider)
    return {"streams": streams}


@router.get("/streams/status")
async def get_streams_status():
    """Get detailed status of all GStreamer pipelines."""
    manager = stream_manager.get_gstreamer_manager()
    streams_status = manager.get_all_streams_status()

    running_count = sum(1 for status in streams_status.values() if status.get("running", False))

    return {
        "running_count": running_count,
        "total_streams": len(streams_status),
        "streams": streams_status,
    }


@router.get("/streams/{stream_id}/status")
async def get_stream_status(stream_id: str):
    """Get detailed status of a specific GStreamer pipeline."""
    manager = stream_manager.get_gstreamer_manager()
    status = manager.get_stream_status(stream_id)

    if status is None:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found or not running")

    return status


@router.get("/streams/startup-failures")
async def get_startup_failures():
    """Get list of streams that failed to start during application startup."""
    failures = stream_manager.get_startup_failed_streams()
    return {"failed_count": len(failures), "failures": failures}
