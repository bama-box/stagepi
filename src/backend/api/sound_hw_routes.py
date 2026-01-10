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

# api/sound_hw_routes.py
from fastapi import APIRouter

from core import sound_hw_manager

# Create a new router object
router = APIRouter()


@router.get("/input", summary="Get available sound input devices", tags=["Sound"])
async def get_sound_inputs():
    """
    Retrieves a list of available sound input (capture) devices.
    """
    devices = sound_hw_manager.get_sound_inputs()
    return {"inputs": devices}


@router.get("/output", summary="Get available sound output devices", tags=["Sound"])
async def get_sound_outputs():
    """
    Retrieves a list of available sound output (playback) devices.
    """
    devices = sound_hw_manager.get_sound_outputs()
    return {"outputs": devices}


@router.get("", summary="Get all sound devices (inputs & outputs)", tags=["Sound"], include_in_schema=False)
@router.get("/", summary="Get all sound devices (inputs & outputs)", tags=["Sound"])
async def get_all_sound_devices():
    """
    Convenience endpoint returning both input and output devices.
    """
    inputs = sound_hw_manager.get_sound_inputs()
    outputs = sound_hw_manager.get_sound_outputs()
    return {"inputs": inputs, "outputs": outputs}
