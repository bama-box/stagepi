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

import os
import re
import socket
import subprocess

# core/system_manager.py
import time

import psutil

LED_PATHS = {
    "ACT": {
        "trigger": "/sys/class/leds/ACT/trigger",
        "brightness": "/sys/class/leds/ACT/brightness",
    },
    "PWR": {
        "trigger": "/sys/class/leds/PWR/trigger",
        "brightness": "/sys/class/leds/PWR/brightness",
    },
}


def get_led_state():
    """
    Returns availability and state for ACT and PWR LEDs.
    Masks trigger input, detects state (on/off/blink) using trigger and brightness,
    outputs with square brackets.
    """
    states = {}
    for led, paths in LED_PATHS.items():
        if not os.path.exists(paths["trigger"]):
            states[led] = {"available": False}
            continue
        try:
            with open(paths["trigger"]) as f:
                trigger_raw = f.read()
            match = re.search(r"\[([\w-]+)\]", trigger_raw)
            if match:
                triggers = match.group(1)
            else:
                triggers = None
            # Detect state
            if "heartbeat" in triggers:
                state = "blink"
            elif "none" in triggers:
                # Check brightness
                brightness = None
                if os.path.exists(paths["brightness"]):
                    try:
                        with open(paths["brightness"]) as bf:
                            brightness_val = bf.read().strip()
                            brightness = int(brightness_val) if brightness_val.isdigit() else None
                    except Exception:
                        brightness = None
                if brightness > 0:
                    state = "on"
                elif brightness == 0:
                    state = "off"
                else:
                    state = "unknown"
            else:
                state = "unknown"
            # Output with square brackets
            states[led] = {"available": True, "state": f"{{{state}}}"}
        except Exception as e:
            states[led] = {"available": False, "error": str(e)}
    return states


def set_led_state(action: str, led_name: str = None) -> dict:
    """
    Sets LED state for one or all LEDs: 'on', 'off', 'blink'.
    If led_name is provided, only that LED is controlled.
    Returns the updated state of affected LEDs.
    """
    leds_to_control = [led_name] if led_name else LED_PATHS.keys()
    result = {}

    for led in leds_to_control:
        if led not in LED_PATHS:
            continue

        paths = LED_PATHS[led]
        if not os.path.exists(paths["trigger"]):
            result[led] = {"available": False}
            continue

        try:
            if action == "blink":
                subprocess.run(["sudo", "tee", paths["trigger"]], input=b"heartbeat\n", check=True)
            elif action in ("on", "off"):
                subprocess.run(["sudo", "tee", paths["trigger"]], input=b"none\n", check=True)
                if os.path.exists(paths["brightness"]):
                    value = b"1\n" if action == "on" else b"0\n"
                    subprocess.run(["sudo", "tee", paths["brightness"]], input=value, check=True)

            # Get the new state after setting it
            with open(paths["trigger"]) as f:
                trigger_raw = f.read()

            match = re.search(r"\[([\w-]+)\]", trigger_raw)
            triggers = match.group(1) if match else None

            # Detect final state
            if "heartbeat" in triggers:
                state = "blink"
            elif "none" in triggers:
                try:
                    with open(paths["brightness"]) as bf:
                        brightness = int(bf.read().strip())
                        state = "on" if brightness > 0 else "off"
                except (OSError, ValueError):
                    state = "unknown"
            else:
                state = "unknown"

            result[led] = {"available": True, "state": f"{{{state}}}"}

        except Exception as e:
            result[led] = {"available": False, "error": str(e)}

    return result


VERSION_FILE_PATH = "/usr/local/stagepi/version"


def get_status():
    """
    Gets the high-level status of the device using real system information.
    """
    hostname = socket.gethostname()
    mac_address = "00:00:00:00:00:00"  # Default fallback
    ip_address = "Not found"  # Default fallback

    # --- Find MAC and IP Address ---
    try:
        addrs = psutil.net_if_addrs()

        # Use eth0 MAC address as the unique deviceId
        if "eth0" in addrs:
            for addr in addrs["eth0"]:
                if addr.family == psutil.AF_LINK:
                    mac_address = addr.address
                    break

        # Find IP address, preferring eth0 then wlan0
        preferred_interfaces = ["eth0", "wlan0"]
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
        with open(VERSION_FILE_PATH) as f:
            firmware_version = f.read().strip()
    except FileNotFoundError:
        print(f"Version file not found at: {VERSION_FILE_PATH}")
    except Exception as e:
        print(f"Error reading version file: {e}")
    return {
        "deviceId": mac_address.replace(":", ""),
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
    disk_usage = psutil.disk_usage("/")
    bytes_to_gb = 1024**3

    return {
        "cpu": {
            "usage": psutil.cpu_percent(interval=1),
            "temperature": {
                "value": 45.2,  # Placeholder for Pi-specific temp sensor
                "unit": "celsius",
            },
        },
        "memory": {
            "total": int(psutil.virtual_memory().total / (1024 * 1024)),
            "used": int(psutil.virtual_memory().used / (1024 * 1024)),
            "unit": "MB",
        },
        "disk": {
            "total": round(disk_usage.total / bytes_to_gb, 2),
            "used": round(disk_usage.used / bytes_to_gb, 2),
            "usage": disk_usage.percent,
            "unit": "GB",
        },
        "uptime": int(time.time() - psutil.boot_time()),
    }
