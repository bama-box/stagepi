# core/system_manager.py
import time
import socket
import psutil

VERSION_FILE_PATH = "/usr/local/stagepi/version"

def get_status():
    """
    Gets the high-level status of the device using real system information.
    """
    hostname = socket.gethostname()
    mac_address = "00:00:00:00:00:00"  # Default fallback
    ip_address = "Not found"          # Default fallback

    # --- Find MAC and IP Address ---
    try:
        addrs = psutil.net_if_addrs()
        
        # Use eth0 MAC address as the unique deviceId
        if 'eth0' in addrs:
            for addr in addrs['eth0']:
                if addr.family == psutil.AF_LINK:
                    mac_address = addr.address
                    break

        # Find IP address, preferring eth0 then wlan0
        preferred_interfaces = ['eth0', 'wlan0']
        for interface in preferred_interfaces:
            if interface in addrs:
                for addr in addrs[interface]:
                    if addr.family == socket.AF_INET:
                        ip_address = addr.address
                        break  # Stop after finding the first IPv4 address
            if ip_address != "Not found":
                break  # Stop if we've found an IP on a preferred interface
                
    except Exception as e:
        print(f"Could not get network information: {e}")

    # --- Read Firmware Version ---
    firmware_version = "unknown"
    try:
        with open(VERSION_FILE_PATH, 'r') as f:
            firmware_version = f.read().strip()
    except FileNotFoundError:
        print(f"Version file not found at: {VERSION_FILE_PATH}")
    except Exception as e:
        print(f"Error reading version file: {e}")

    return {
        "deviceId": mac_address,
        "hostname": hostname,
        "status": "configured",
        "ipAddress": ip_address,
        "uptime": int(time.time() - psutil.boot_time()),
        "firmwareVersion": firmware_version,
    }

def get_resources():
    """
    Gathers core system resource metrics with real disk usage.
    """
    disk_usage = psutil.disk_usage('/')
    bytes_to_gb = 1024 ** 3

    return {
        "cpu": {
            "usage": psutil.cpu_percent(interval=1),
            "temperature": {
                "value": 45.2,  # Placeholder for Pi-specific temp sensor
                "unit": "celsius"
            }
        },
        "memory": {
            "total": int(psutil.virtual_memory().total / (1024 * 1024)),
            "used": int(psutil.virtual_memory().used / (1024 * 1024)),
            "unit": "MB"
        },
        "disk": {
            "total": round(disk_usage.total / bytes_to_gb, 2),
            "used": round(disk_usage.used / bytes_to_gb, 2),
            "usage": disk_usage.percent,
            "unit": "GB"
        },
        "uptime": int(time.time() - psutil.boot_time())
    }