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

# api/system_routes.py
from fastapi import APIRouter, HTTPException

from core import system_manager

# Create a new router object
router = APIRouter()


@router.get("/status")
async def get_system_status():
    """
    Retrieves the core status of the device.
    """
    status_data = system_manager.get_status()
    return status_data


@router.get("/resources")
async def get_system_resources():
    """
    Retrieves a snapshot of the device's core resource utilization.
    """
    resource_data = system_manager.get_resources()
    return resource_data


# --- LED Control Endpoints ---
@router.get("/led")
async def get_led_state():
    """
    Returns state and availability for all LEDs.
    """
    result = system_manager.get_led_state()
    if result is None:
        raise HTTPException(status_code=404, detail="LEDs not available")
    return result


@router.put("/led")
async def set_led_state(action: str, led: str = None):
    """
    Sets LED state: 'on', 'off', 'blink'.
    If led is provided (ACT or PWR), controls only that LED.
    If led is not provided, controls all available LEDs.
    """
    if led and led not in ["ACT", "PWR"]:
        raise HTTPException(
            status_code=400, detail="Invalid LED specified. Must be 'ACT' or 'PWR'"
        )
    if action not in ["on", "off", "blink"]:
        raise HTTPException(
            status_code=400, detail="Invalid action. Must be 'on', 'off', or 'blink'"
        )

    result = system_manager.set_led_state(action, led)
    if result is None:
        raise HTTPException(status_code=404, detail=f"LED {led or 'all'} not available")
    return result
