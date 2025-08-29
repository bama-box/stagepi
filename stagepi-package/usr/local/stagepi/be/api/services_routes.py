# api/services_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core import service_manager

router = APIRouter()

class ServiceUpdateRequest(BaseModel):
    enabled: bool

@router.get("/")
async def get_all_services():
    return service_manager.get_all_services()

@router.get("/{service_name}")
async def get_service(service_name: str):
    service = service_manager.get_service_by_name(service_name)
    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found.")
    return service

@router.patch("/{service_name}")
async def update_service(service_name: str, update_request: ServiceUpdateRequest):
    updated_service = service_manager.update_service_status(service_name, update_request.enabled)
    if not updated_service:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found.")
    return updated_service