# api/network_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from core import network_manager
import platform

router = APIRouter()

# --- Pydantic Models for Request Bodies ---

class EthernetStaticConfig(BaseModel):
    ipAddress: str
    subnetMask: str
    gateway: str
    dnsServers: Optional[List[str]] = None

class WifiConfig(BaseModel):
    region: str = Field(..., min_length=2, max_length=2, description="2-letter country code for the Wi-Fi region.")
    mode: str = Field(default="client")
    ssid: str
    password: str

# --- Ethernet Routes ---

@router.get("/config/ethernet")
async def get_ethernet_config():
    return network_manager.get_ethernet_config()

@router.put("/config/ethernet")
async def set_ethernet_config(config: EthernetStaticConfig):
    result = network_manager.set_ethernet_config(config)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return result

@router.delete("/config/ethernet")
async def delete_ethernet_config():
    result = network_manager.reset_ethernet_config()
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return result

# --- Wi-Fi Routes ---

@router.get("/config/wifi")
async def get_wifi_config():
    return network_manager.get_wifi_config()

@router.put("/config/wifi")
async def set_wifi_config(config: WifiConfig):
    if config.mode == "hotspot":
        config.ssid = f"StagePi-{platform.node()}"
        config.password = "stage314"
    result = network_manager.set_wifi_config(config)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])

@router.get("/wifi/available")
async def get_available_wifi_networks():
    return network_manager.scan_for_networks()