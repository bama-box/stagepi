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

@router.get("/", summary="Get available sound hardware", tags=["Sound HW"])
async def get_sound_hardware():
    """
    Retrieves a list of available sound hardware (playback devices).
    """
    devices = sound_hw_manager.get_sound_hw()
    return {"sound_hardware": devices}
