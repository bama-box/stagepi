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

# core/service_manager.py
import subprocess
import logging
import libconf
import tempfile
import os
import json

# This dictionary maps our friendly service names to their systemd service names and descriptions.
# NOTE: The 'service_name' values are assumptions. You may need to adjust them
# to match the actual service file names on your system.
_services_config = {
    "bluetooth": {
        "description": "Manages the Bluetooth radio.",
        "service_name": "bluetooth.service",
        "config_path": "/usr/local/stagepi/etc/bluetooth.env",
    },
    "a2dp": {
        "description": "Enables high-quality audio streaming (A2DP Sink).",
        "service_name": "btaudio.service",
        "config_path": "/usr/local/stagepi/etc/a2dp.env",
    },
    "airplay": {
        "description": "Enables the AirPlay audio streaming service.",
        "service_name": "shairport-sync.service",
        "config_path": "/etc/shairport-sync.conf",
    },
}

# A mock for systems without systemd, providing a fallback state.
_services_mock_state = {
    "bluetooth.service": {"enabled": True, "active": True},
    "btaudio.service": {"enabled": True, "active": True},
    "shairport-sync.service": {"enabled": False, "active": False},
}

logger = logging.getLogger(__name__)


def _run_systemctl(args):
    """Helper to run a systemctl command and handle errors."""
    try:
        command = ["sudo", "systemctl"] + args
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        if "does not exist" in proc.stderr:
            logger.warning(f"Service not found for command: {' '.join(command)}")
            return None
        return proc
    except FileNotFoundError:
        logger.warning("'systemctl' command not found. Using mock data.")
        return None


def _get_service_state(service_name: str):
    """Gets the enabled and active state of a systemd service."""
    proc_enabled = _run_systemctl(["is-enabled", service_name])
    proc_active = _run_systemctl(["is-active", service_name])

    if proc_enabled is None or proc_active is None:
        logger.warning(f"Falling back to mock state for {service_name}")
        return _services_mock_state.get(
            service_name, {"enabled": False, "active": False}
        )

    # `is-enabled` has an exit code of 0 if enabled.
    enabled = proc_enabled.returncode == 0
    # `is-active` has an exit code of 0 if active.
    active = proc_active.returncode == 0

    return {"enabled": enabled, "active": active}


def get_all_services():
    logger.info("CORE: Getting all services...")
    services_with_status = []
    for name, service_config in _services_config.items():
        state = _get_service_state(service_config["service_name"])
        config = _get_service_config(name)
        services_with_status.append(
            {
                "name": name,
                "description": service_config["description"],
                "config": config,
                **state,
            }
        )
    return services_with_status


def get_service_by_name(name: str):
    logger.info(f"CORE: Getting service '{name}'...")
    if name in _services_config:
        service_config = _services_config[name]
        state = _get_service_state(service_config["service_name"])
        config = _get_service_config(name)
        return {
            "name": name,
            "description": service_config["description"],
            "config": config,
            **state,
        }
    return None


def _read_shairport_config():
    """Reads shairport-sync configuration from a file."""
    config_path = _services_config["airplay"]["config_path"]
    config = None
    try:
        with open(config_path, "r") as f:
            config = libconf.load(f)
    except Exception as e:
        print(f"Error reading or parsing config file: {e}")
    return config


'''
def _write_shairport_config(config):
    """Writes shairport-sync configuration to a file."""
    config_path = _services_config["airplay"]["config_path"]
    try:
        with open(config_path, 'w') as f:
            libconf.dump(config, f)
    except Exception as e:
        print(f"Error writing config file: {e}")
'''


def _write_shairport_config(config):
    """
    Writes config to a temporary file as a normal user, then uses
    a subprocess with 'sudo mv' to move it to the final destination.
    """
    config_path = _services_config["airplay"]["config_path"]
    temp_path = None  # Initialize temp_path to ensure it's available in finally

    try:
        # 1. Create a temporary file in a location we have permission to write to.
        # 'delete=False' is crucial because we need to close it before moving.
        with tempfile.NamedTemporaryFile(
            mode="w", delete=False, encoding="utf-8", suffix=".conf"
        ) as temp_f:
            temp_path = temp_f.name
            libconf.dump(config, temp_f)

        print(f"Temporary configuration written to {temp_path}")

        # 2. Use a subprocess to call 'sudo mv'. This will prompt for a password
        #    in the terminal if one is required.
        print(f"Attempting to move file to {config_path} using sudo...")
        command = ["sudo", "mv", temp_path, config_path]

        # We use check=True to automatically raise an exception if the command fails.
        subprocess.run(command, check=True, capture_output=True, text=True)

        # 3. (Optional but good practice) Set correct ownership and permissions.
        subprocess.run(["sudo", "chown", "root:root", config_path], check=True)
        subprocess.run(["sudo", "chmod", "644", config_path], check=True)

        print(f"Successfully moved and secured the configuration at {config_path}")

    except FileNotFoundError:
        print("Error: 'sudo' command not found. Is it installed and in your PATH?")
    except subprocess.CalledProcessError as e:
        print(f"Error during the sudo operation. The command failed.")
        print(f"Return Code: {e.returncode}")
        # stderr often contains the specific error message (e.g., "Permission denied")
        print(f"Error Output (stderr):\n{e.stderr.strip()}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        # 4. Clean up the temporary file if it still exists.
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
            print(f"Cleaned up temporary file: {temp_path}")


def _filter_airplay_config(config):
    filtered_config = {
        "adv_name": config["general"]["name"],
        "hw_device": config["alsa"]["output_device"],
    }
    return filtered_config


def _update_default_audio(value):
    config = _read_shairport_config()
    # set default audio output
    config.setdefault("stagepi", {})
    hw_device = config.get("stagepi", {}).get("output_device", "")
    if hw_device == "Headphones":
        subprocess.run(["sudo", "raspi-config", "nonint", "do_audio", "1"], check=True)
    if "hdmi" in hw_device.lower():
        subprocess.run(["sudo", "raspi-config", "nonint", "do_audio", "2"], check=True)


def _update_shairport_config(update_data: dict):
    """Updates shairport-sync configuration."""
    config = _read_shairport_config()
    if not config:
        config = {}
    config["general"]["output_backend"] = "pa"

    for key, value in update_data.items():
        logging.info(f"key:{key},value:{value}")
        if key == "adv_name":
            config["general"]["name"] = value
        elif key == "hw_device":
            config.setdefault("stagepi", {})["output_device"] = value
        elif key == "enabled":
            _update_default_audio(value)
    _write_shairport_config(config)


def _get_service_config(name: str):
    if name == "airplay":
        return _filter_airplay_config(_read_shairport_config())
    if name == "bluetooth":
        return {}
    if name == "a2dp":
        return {}
    return {}


def __update_service_config(name: str, update_data: dict):
    if name == "airplay":
        _update_shairport_config(update_data)


def update_service(name: str, update_data: dict):
    logger.info(f"CORE: Updating service '{name}' with data: {update_data}")
    if name not in _services_config:
        return None

    service_name = _services_config[name]["service_name"]

    if "enabled" in update_data:
        enabled = update_data["enabled"]
        logger.info(
            f"CORE: Setting service '{name}' ({service_name}) to enabled={enabled}..."
        )
        action = "enable" if enabled else "disable"
        __update_service_config(name, update_data)

        # Use --now to also start/stop the service immediately
        command_args = [action, "--now", service_name]
        proc = _run_systemctl(command_args)

        if proc is None:
            logger.warning(f"Falling back to mock update for {service_name}")
            _services_mock_state[service_name]["enabled"] = enabled
            _services_mock_state[service_name]["active"] = enabled  # Mocking start/stop
        elif proc.returncode != 0:
            logger.error(
                f"Failed to run 'systemctl {' '.join(command_args)}': {proc.stderr.strip()}"
            )

    # After updating, return the new state of the service.
    return get_service_by_name(name)
