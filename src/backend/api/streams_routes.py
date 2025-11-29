"""
API routes for managing generic streams (AES67 and others).

Provides endpoints under /streams that are file-backed. By default the
provider is 'aes67' which maps to /usr/local/stagepi/etc/aes67.json. Other
providers can be added by extending the stream_manager module.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Any
from core import stream_manager

router = APIRouter()


class StreamModel(BaseModel):
    id: Optional[Any] = None
    mode: str
    addr: str
    port: int
    hw_device: Optional[str] = None
    net_device: Optional[str] = None
    enabled: Optional[bool] = True


class StreamsUpdateRequest(BaseModel):
    streams: List[StreamModel]


@router.get("/streams")
async def list_streams(provider: str = Query('aes67')):
    """Get all streams for a provider."""
    streams = stream_manager.get_all_streams(provider)
    return {'streams': streams}


@router.post("/streams")
async def add_stream(stream: StreamModel, provider: str = Query('aes67')):
    """Add a new stream."""
    sdict = stream.dict()
    streams = stream_manager.add_stream(sdict, provider)
    return {'streams': streams}


@router.patch("/streams/{stream_id}")
async def update_stream(stream_id: str, stream_update: StreamModel, provider: str = Query('aes67')):
    """Update an existing stream by ID."""
    try:
        update_dict = stream_update.dict(exclude_unset=True)
        streams = stream_manager.update_stream(stream_id, update_dict, provider)
        return {'streams': streams}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/streams/{stream_id}")
async def delete_stream(stream_id: str, provider: str = Query('aes67')):
    """Delete a stream by ID."""
    try:
        streams = stream_manager.delete_stream(stream_id, provider)
        return {'streams': streams}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/streams")
async def replace_streams(streams_update: StreamsUpdateRequest, provider: str = Query('aes67')):
    """Replace all streams with a new list."""
    streams = [s.dict() for s in streams_update.streams]
    streams = stream_manager.replace_all_streams(streams, provider)
    return {'streams': streams}
