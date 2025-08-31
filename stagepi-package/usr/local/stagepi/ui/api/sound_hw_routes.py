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
