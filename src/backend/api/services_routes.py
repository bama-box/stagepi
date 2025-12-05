"""
Stage Pi: Open source stagebox firmware

Copyright (C) 2025 Bama Box ltd.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
"""

import json
import os
from typing import Any, List, Optional

# api/services_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core import service_manager

router = APIRouter()


class ServiceUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    host: Optional[str] = None
    port: Optional[int] = None
    net_device: Optional[str] = None
    adv_name: Optional[str] = None
    hw_device: Optional[str] = None


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


@router.get("/")
async def get_all_services():
    return service_manager.get_all_services()


@router.get("/{service_name}")
async def get_service(service_name: str):
    service = service_manager.get_service_by_name(service_name)
    if not service:
        raise HTTPException(
            status_code=404, detail=f"Service '{service_name}' not found."
        )
    return service


# AES67 stream management moved to the /streams API module.
# For backwards compatibility the service endpoints do not expose AES67 streams anymore.


@router.patch("/{service_name}")
async def update_service(service_name: str, update_request: ServiceUpdateRequest):
    update_data = update_request.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=400, detail="At least one field to update must be provided."
        )

    updated_service = service_manager.update_service(service_name, update_data)
    if not updated_service:
        raise HTTPException(
            status_code=404, detail=f"Service '{service_name}' not found."
        )
    return updated_service
