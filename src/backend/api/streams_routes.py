"""
API routes for managing AES67 streams.

Provides endpoints under /streams that are file-backed and map to
/usr/local/stagepi/etc/aes67.json.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
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


@router.get("", include_in_schema=False)
@router.get("/")
async def list_streams():
    """Get all AES67 streams."""
    streams = stream_manager.get_all_streams("aes67")
    return {"streams": streams}


@router.post("", include_in_schema=False)
@router.post("/")
async def add_stream(stream: StreamModel):
    """Add a new AES67 stream."""
    try:
        sdict = stream.to_dict()
        streams = stream_manager.add_stream(sdict, "aes67")
        return {"streams": streams}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to start stream: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{stream_id}", include_in_schema=False)
@router.get("/{stream_id}/")
async def get_stream(stream_id: str):
    """Get a specific AES67 stream by ID."""
    stream = stream_manager.get_stream_by_id(stream_id, "aes67")
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return stream


@router.patch("/{stream_id}", include_in_schema=False)
@router.patch("/{stream_id}/")
async def update_stream(stream_id: str, stream_update: StreamModel):
    """Update an existing AES67 stream by ID."""
    try:
        update_dict = stream_update.to_dict()
        streams = stream_manager.update_stream(stream_id, update_dict, "aes67")
        return {"streams": streams}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to start stream: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{stream_id}", include_in_schema=False)
@router.delete("/{stream_id}/")
async def delete_stream(stream_id: str):
    """Delete an AES67 stream by ID."""
    try:
        streams = stream_manager.delete_stream(stream_id, "aes67")
        return {"streams": streams}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("", include_in_schema=False)
@router.put("/")
async def replace_streams(streams_update: StreamsUpdateRequest):
    """Replace all AES67 streams with a new list."""
    streams = [s.to_dict() for s in streams_update.streams]
    streams = stream_manager.replace_all_streams(streams, "aes67")
    return {"streams": streams}


@router.get("/status")
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


@router.get("/{stream_id}/status", include_in_schema=False)
@router.get("/{stream_id}/status/")
async def get_stream_status(stream_id: str):
    """Get detailed status of a specific GStreamer pipeline."""
    manager = stream_manager.get_gstreamer_manager()
    status = manager.get_stream_status(stream_id)

    if status is None:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found or not running")

    return status


@router.get("/startup-failures")
async def get_startup_failures():
    """Get list of streams that failed to start during application startup."""
    failures = stream_manager.get_startup_failed_streams()
    return {"failed_count": len(failures), "failures": failures}
