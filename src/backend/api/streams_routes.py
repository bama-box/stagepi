"""
API routes for managing generic streams (AES67 and others).

Provides endpoints under /streams that are file-backed. By default the
provider is 'aes67' which maps to /usr/local/stagepi/etc/aes67.json. Other
providers can be added by extending _provider_config_map.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Any
import os
import json
import uuid

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


# Map provider name -> JSON config path.
_provider_config_map = {
    'aes67': '/usr/local/stagepi/etc/aes67.json',
}


def _provider_json_path(provider: str) -> str:
    # Return the configured JSON path for the provider, or fall back to
    # /usr/local/stagepi/etc/<provider>.json.
    return _provider_config_map.get(provider, f"/usr/local/stagepi/etc/{provider}.json")


def _read_provider_config(provider: str) -> dict:
    path = _provider_json_path(provider)
    if os.path.exists(path):
        try:
            with open(path, 'r') as jf:
                data = json.load(jf)
                data.setdefault('streams', [])
                # Ensure each stream has an 'enabled' field (default True)
                for s in data['streams']:
                    if 'enabled' not in s:
                        s['enabled'] = True
                return data
        except Exception:
            # On error, return empty streams to avoid crashing the API.
            return {'streams': []}
    return {'streams': []}


def _write_provider_config(provider: str, data: dict):
    path = _provider_json_path(provider)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Normalize streams to include 'enabled' default True and generate id
    streams = data.get('streams', []) or []
    for i, s in enumerate(streams):
        if 'enabled' not in s:
            s['enabled'] = True
        # ensure id
        if not s.get('id'):
            s['id'] = f"s-{uuid.uuid4().hex[:8]}"
    to_write = {'streams': streams}
    with open(path, 'w') as jf:
        json.dump(to_write, jf, indent=2)


@router.get("/streams")
async def list_streams(provider: str = Query('aes67')):
    cfg = _read_provider_config(provider)
    return {'streams': cfg.get('streams', [])}


@router.post("/streams")
async def add_stream(stream: StreamModel, provider: str = Query('aes67')):
    cfg = _read_provider_config(provider)
    streams = list(cfg.get('streams', []))
    sdict = stream.dict()
    if 'enabled' not in sdict:
        sdict['enabled'] = True
    # generate id default
    if not sdict.get('id'):
        sdict['id'] = f"s-{uuid.uuid4().hex[:8]}"
    streams.append(sdict)
    _write_provider_config(provider, {'streams': streams})
    return {'streams': streams}


@router.patch("/streams/{stream_id}")
async def update_stream(stream_id: str, stream_update: StreamModel, provider: str = Query('aes67')):
    cfg = _read_provider_config(provider)
    streams = list(cfg.get('streams', []))
    found = False
    for i, s in enumerate(streams):
        if str(s.get('id', i)) == str(stream_id) or str(i) == str(stream_id):
            merged = { **s, **stream_update.dict(exclude_unset=True) }
            if 'enabled' not in merged:
                merged['enabled'] = True
            # ensure id remains present
            if not merged.get('id'):
                merged['id'] = s.get('id') or f"s-{uuid.uuid4().hex[:8]}"
            streams[i] = merged
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found")
    _write_provider_config(provider, {'streams': streams})
    return {'streams': streams}


@router.delete("/streams/{stream_id}")
async def delete_stream(stream_id: str, provider: str = Query('aes67')):
    cfg = _read_provider_config(provider)
    streams = list(cfg.get('streams', []))
    new_streams = []
    found = False
    for i, s in enumerate(streams):
        if str(s.get('id', i)) == str(stream_id) or str(i) == str(stream_id):
            found = True
            continue
        new_streams.append(s)
    if not found:
        raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found")
    _write_provider_config(provider, {'streams': new_streams})
    return {'streams': new_streams}


@router.put("/streams")
async def replace_streams(streams_update: StreamsUpdateRequest, provider: str = Query('aes67')):
    streams = [s.dict() for s in streams_update.streams]
    # Ensure enabled and generate id for each stream
    for s in streams:
        if 'enabled' not in s:
            s['enabled'] = True
        if not s.get('id'):
            s['id'] = f"s-{uuid.uuid4().hex[:8]}"
    _write_provider_config(provider, {'streams': streams})
    return {'streams': streams}
