# api/network_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from core import network_manager

router = APIRouter()

# --- Pydantic Models for Request Bodies ---

class EthernetStaticConfig(BaseModel):
    ipAddress: str
    subnetMask: str
    gateway: str
    dnsServers: Optional[List[str]] = None

class WifiClientConfig(BaseModel):
    ssid: str
    password: str

class WifiAPConfig(BaseModel):
    ssid: str
    password: str = Field(..., min_length=8)
    channel: int = 11

class WifiPutRequest(BaseModel):
    deviceMode: str # "client" or "ap"
    clientConfig: Optional[WifiClientConfig] = None
    apConfig: Optional[WifiAPConfig] = None

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
async def set_wifi_config(config: WifiPutRequest):
    if config.deviceMode == "client" and not config.clientConfig:
        raise HTTPException(status_code=400, detail="clientConfig is required for client mode.")
    if config.deviceMode == "ap" and not config.apConfig:
        raise HTTPException(status_code=400, detail="apConfig is required for ap mode.")
    
    return network_manager.set_wifi_config(config)

@router.delete("/config/wifi")
async def delete_wifi_config():
    return network_manager.reset_wifi_config()

@router.get("/wifi/available")
async def get_available_wifi_networks():
    return network_manager.scan_for_networks()