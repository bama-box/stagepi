# api/system_routes.py
from fastapi import APIRouter
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