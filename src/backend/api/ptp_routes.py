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
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core import ptp_manager

router = APIRouter()


class ApplyProfileRequest(BaseModel):
    profile_id: str = Field(..., description="PTP Profile ID: 'aes67', 'smpte', 'default'")
    domain: Optional[int] = Field(None, ge=0, le=127, description="Optional custom PTP domain number (0-127)")


@router.get("/status")
def get_ptp_status():
    """Retrieve real-time PTP status including lock state, grandmaster identity, and offset."""
    try:
        return ptp_manager.get_ptp_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query PTP status: {str(e)}")


@router.get("/profiles")
def get_ptp_profiles():
    """List available PTP operational profiles (AES67, SMPTE, Default)."""
    try:
        return ptp_manager.get_available_profiles()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get PTP profiles: {str(e)}")


@router.put("/profile")
def set_ptp_profile(request: ApplyProfileRequest):
    """Switch the active PTP profile and restart ptp4l."""
    try:
        success = ptp_manager.apply_ptp_profile(request.profile_id, request.domain)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to apply PTP profile.")
        return {
            "status": "success",
            "message": f"Applied PTP profile '{request.profile_id}'",
            "current_status": ptp_manager.get_ptp_status(),
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error applying PTP profile: {str(e)}")


@router.post("/restart")
def restart_ptp():
    """Restart the ptp4l system service."""
    try:
        success = ptp_manager.restart_ptp_service()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to restart ptp4l service.")
        return {"status": "success", "message": "ptp4l service restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error restarting ptp4l: {str(e)}")
