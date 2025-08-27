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
# app.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn
import subprocess
import json
import platform
import psutil
import os
import shutil
import time
import libconf
from pydbus import SystemBus
from gi.repository import GLib

# Pydantic models for request body validation and structured responses
class AirPlayConfig(BaseModel):
    deviceName: str
    volumeControl: str
    audioOutput: str

class SystemStatus(BaseModel):
    cpuUsage: float
    ramUsage: float
    hostname: str
    cpuTemp: float

class AirPlayClients(BaseModel):
    success: bool
    clients: str | None = None
    message: str | None = None

class ServiceResult(BaseModel):
    success: bool
    message: str | None = None

class AirPlayMedia(BaseModel):
    title: str
    artist: str
    album: str
    artwork_url: str

app = FastAPI()

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount templates directory
templates = Jinja2Templates(directory="templates")

# Enable CORS for all routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Functions (same as in Flask version) ---

def get_cpu_usage():
    """Returns current CPU usage percentage."""
    return psutil.cpu_percent(interval=1)

def get_ram_usage():
    """Returns current RAM usage percentage."""
    return psutil.virtual_memory().percent

def get_cpu_temperature():
    """Reads CPU temperature on Raspberry Pi."""
    try:
        result = subprocess.run(['vcgencmd', 'measure_temp'], capture_output=True, text=True, check=True)
        temp_str = result.stdout.strip().replace('temp=', '').replace('\'C', '')
        return float(temp_str)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        return 0.0

def read_shairport_config():
    """Reads shairport-sync configuration from a file."""
    config = None
    try:
        with open('/etc/shairport-sync.conf', 'r') as f:
            config = libconf.load(f)
    except Exception as e:
        print(f"Error reading or parsing config file: {e}")
    return config

def write_shairport_config(new_config):
    """Writes shairport-sync configuration to a file."""
    # This function would be implemented here, likely requiring sudo privileges.
    # For now, it's a placeholder.
    return {"success": True, "message": "Configuration saved (simulated)."}

def restart_shairport_service():
    """Restarts the shairport-sync service."""
    try:
        subprocess.run(['sudo', 'systemctl', 'restart', 'shairport-sync'], check=True)
        return {"success": True, "message": "Shairport-sync service restarted."}
    except subprocess.CalledProcessError as e:
        return {"success": False, "message": f"Failed to restart service: {e}"}

def get_connected_airplay_clients():
    """Fetches a list of currently connected AirPlay clients."""
    try:
        result = subprocess.run(
            ['sudo', 'busctl', 'get-property', 'org.gnome.ShairportSync', '/org/gnome/ShairportSync', 'org.gnome.ShairportSync.RemoteControl', 'Client'],
            check=True,
            capture_output=True,
            text=True
        )
        output = result.stdout.strip().split(" ")[1]
        return {"success": True, "clients": output}
    except subprocess.CalledProcessError as e:
        return {"success": False, "message": f"Failed to find clients: {e}"}

def cleanup_cache_dir(cache_dir, max_age_seconds=86400):
    """Removes old files or symlinks from the cache directory."""
    now = time.time()
    for filename in os.listdir(cache_dir):
        file_path = os.path.join(cache_dir, filename)
        if os.path.exists(file_path):
            file_age = now - os.lstat(file_path).st_mtime
            if file_age > max_age_seconds:
                try:
                    os.unlink(file_path)
                except Exception as e:
                    print(f"Error removing cached file {file_path}: {e}")

def get_airplay_media_metadata():
    """Fetches media metadata and artwork from shairport-sync's dbus interface."""
    try:
        bus = SystemBus()
        shairport = bus.get('org.gnome.ShairportSync', '/org/gnome/ShairportSync')
        metadata = shairport.Metadata
        title = metadata.get('xesam:title', '')
        artist = metadata.get('xesam:artist', [''])[0] if 'xesam:artist' in metadata else ''
        album = metadata.get('xesam:album', '')
        artwork_url = metadata.get('mpris:artUrl', '')
        if artwork_url and artwork_url.startswith('file://'):
            filename_path = artwork_url.replace('file://', '')
            filename = os.path.basename(filename_path)
            cache_dir = os.path.join(os.path.dirname(__file__), 'static', 'cache')
            os.makedirs(cache_dir, exist_ok=True)
            cleanup_cache_dir(cache_dir)
            artcover_path = os.path.join(cache_dir, filename)
            if os.path.exists(artcover_path):
                os.remove(artcover_path)
            shutil.copy(filename_path, artcover_path)
            artwork_url = f"/static/cache/{filename}"
        return {'title': title, 'artist': artist, 'album': album, 'artwork_url': artwork_url}
    except Exception as e:
        print(f"Error fetching media metadata from dbus: {e}")
        return {'title': '', 'artist': '', 'album': '', 'artwork_url': ''}

# --- FastAPI Routes ---

@app.get("/")
def index(request: Request):
    """Serves the main HTML page."""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/status", response_model=SystemStatus)
def get_status():
    """Returns current system status (CPU, RAM, Hostname, Temp)."""
    return SystemStatus(
        cpuUsage=get_cpu_usage(),
        ramUsage=get_ram_usage(),
        hostname=platform.node(),
        cpuTemp=get_cpu_temperature()
    )

@app.get("/api/airplay/config")
def get_airplay_config():
    """Returns the current AirPlay configuration."""
    config = read_shairport_config() or {}
    device_name = config.get('general', {}).get('name', 'StagePi')
    volume_control = config.get('general', {}).get('volume_control_profile', 'software')
    audio_output = config.get('alsa', {}).get('output_device', 'auto')
    return {
        'deviceName': device_name,
        'volumeControl': volume_control,
        'audioOutput': audio_output
    }

@app.post("/api/airplay/config", response_model=ServiceResult)
def save_airplay_config(config: AirPlayConfig):
    """Receives and saves AirPlay configuration."""
    result = write_shairport_config(config.dict())
    return ServiceResult(**result)

@app.get("/api/airplay/media", response_model=AirPlayMedia)
def get_airplay_media():
    """Returns the current AirPlay media metadata and artwork."""
    media = get_airplay_media_metadata()
    return AirPlayMedia(**media)

@app.post("/api/airplay/restart", response_model=ServiceResult)
def restart_service():
    """Restarts the Shairport-Sync service."""
    result = restart_shairport_service()
    return ServiceResult(**result)

@app.get("/api/airplay/clients", response_model=AirPlayClients)
def refresh_clients():
    """Returns a list of connected AirPlay clients."""
    clients = get_connected_airplay_clients()
    return AirPlayClients(**clients)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5001, reload=True)