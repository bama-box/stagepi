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

# api/network_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from core import network_manager
import platform
import os

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

    # --- New Endpoint for Network Interfaces ---

@router.get("/interfaces")
async def list_network_interfaces():
    """Return a list of non-loopback network interface names available on the system."""
    try:
        # Prefer reading /sys/class/net which is available on Linux systems
        if os.path.isdir('/sys/class/net'):
            ifaces = [n for n in os.listdir('/sys/class/net') if n != 'lo']
            return { 'interfaces': sorted(ifaces) }
    except Exception:
        pass
    # Fallback: return a minimal set
    return { 'interfaces': ['eth0', 'wlan0'] }
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