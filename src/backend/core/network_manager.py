# core/network_manager.py
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

import logging
import subprocess

# --- Configure Logging ---
# This sets up basic logging to print INFO level messages and higher to the console.
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


# --- Helper Functions ---


def _run_nmcli_command(command: list) -> str:
    """A helper to run nmcli commands, log them, and handle errors."""
    try:
        base_command = ["sudo", "nmcli", "-t"]
        full_command = base_command + command

        # ADDED: Log the command before executing it
        logging.info(f"Executing command: {' '.join(full_command)}")

        result = subprocess.run(full_command, capture_output=True, text=True, check=True, timeout=15)
        return result.stdout.strip()
    except FileNotFoundError:
        # CHANGED: Use logging for errors
        logging.error("'nmcli' command not found. Is NetworkManager installed?")
        raise RuntimeError("NetworkManager (nmcli) is not available on this system.")
    except subprocess.CalledProcessError as e:
        # CHANGED: Use logging for errors
        logging.error(f"nmcli command failed: {e.stderr.strip()}")
        raise RuntimeError(f"A NetworkManager command failed: {e.stderr.strip()}")
    except Exception as e:
        # CHANGED: Use logging for errors
        logging.error(f"An unexpected error occurred: {e}")
        raise RuntimeError("An unexpected error occurred while running a system command.")


def _get_connection_name_for_device(device: str) -> str:
    """Finds the connection name for a given device (e.g., 'eth0')."""
    try:
        # This is the most reliable way to get the connection associated with a device
        dev_output = _run_nmcli_command(["-f", "GENERAL.CONNECTION", "device", "show", device])
        conn_name = dev_output.split(":", 1)[1].strip()
        if conn_name and conn_name != "--":
            return conn_name
        else:
            # If no connection is associated, try finding one targeting the device
            conn_output = _run_nmcli_command(["-f", "NAME,DEVICE", "connection", "show"])
            for line in conn_output.splitlines():
                if line.endswith(f":{device}"):
                    return line.split(":", 1)[0].strip()
            raise RuntimeError(f"No connection profile found for {device}.")
    except (RuntimeError, IndexError):
        raise RuntimeError(f"Could not find a connection profile for {device}.")


def _get_wifi_region():
    """Gets the Wi-Fi regulatory domain (country code)."""
    try:
        result = subprocess.run(
            ["wpa_cli", "get", "country"],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        output = result.stdout
        logging.info(f"wpa_cli get country output: {output}")
        output_lines = result.stdout.strip().splitlines()

        if output_lines:
            return output_lines[-1]
        else:
            return None
    except (FileNotFoundError, subprocess.CalledProcessError, IndexError) as e:
        logging.warning(f"Could not determine Wi-Fi region: {e}")
        return None


def _set_wifi_region(region: str):
    """Sets the Wi-Fi regulatory domain (country code)."""
    if not region or len(region) != 2:
        logging.error(f"Invalid region code provided: {region}")
        raise ValueError("Invalid region code. Must be a 2-letter country code.")

    try:
        command = ["sudo", "raspi-config", "nonint", "do_wifi_country", region]
        logging.info(f"Executing command: {' '.join(command)}")

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            timeout=20,  # Increased timeout for raspi-config
        )

        logging.info(f"Successfully set Wi-Fi region to {region}. Output: {result.stdout.strip()}")

        # After setting the region, we might need to restart services.
        # For now, we'll just return success. A reboot is often recommended.

        return _get_wifi_region()  # Return the new region to confirm

    except FileNotFoundError:
        logging.error("'raspi-config' command not found. This script appears to be running on a non-Raspberry Pi OS.")
        raise RuntimeError("'raspi-config' is not available.")
    except subprocess.CalledProcessError as e:
        error_message = e.stderr.strip()
        logging.error(f"Failed to set Wi-Fi region. Error: {error_message}")
        # Check for a specific error from raspi-config if possible
        if "invalid country code" in error_message.lower():
            raise ValueError(f"Invalid country code '{region}' according to raspi-config.")
        raise RuntimeError(f"Failed to set Wi-Fi region: {error_message}")
    except subprocess.TimeoutExpired:
        logging.error("Timeout expired while trying to set the Wi-Fi region.")
        raise RuntimeError("Timeout occurred while setting Wi-Fi region.")
    except Exception as e:
        logging.error(f"An unexpected error occurred while setting Wi-Fi region: {e}")
        raise


def _get_ip_info(interface: str):
    """Gets detailed IP and connection info for a specific interface."""
    try:
        # Get all device properties
        dev_output = _run_nmcli_command(["-f", "all", "device", "show", interface])
        dev_data = {k: v for k, v in (line.split(":", 1) for line in dev_output.splitlines() if ":" in line)}

        # Check if the device is connected (state 100 is connected / connected externally)
        state = dev_data.get("GENERAL.STATE", "")
        if not state.startswith("100"):
            return {"connected": False}

        # Get the connection name first
        conn_name = dev_data.get("GENERAL.CONNECTION")
        if not conn_name or conn_name == "--":
            return {"connected": False}  # No active connection profile

        # Get connection properties to retrieve configured IP (not device IPs)
        conn_output = _run_nmcli_command(["-f", "all", "connection", "show", conn_name])
        conn_data = {k: v for k, v in (line.split(":", 1) for line in conn_output.splitlines() if ":" in line)}

        # Get the method (auto/manual)
        method = conn_data.get("ipv4.method", "unknown").strip()

        # Get IP configuration from connection profile
        ip_address = ""
        subnet_mask = ""

        # For manual (static) configuration, read from ipv4.addresses
        if method == "manual":
            raw_addresses = conn_data.get("ipv4.addresses", "").strip()
            if raw_addresses:
                # Can be multiple addresses, comma-separated: "169.254.x.x/16, 10.42.10.2/24"
                addr_list = [a.strip() for a in raw_addresses.split(",") if a.strip()]
                # Prioritize non-link-local addresses
                chosen_addr = ""
                for a in addr_list:
                    if not a.startswith("169.254."):
                        chosen_addr = a
                        break
                if not chosen_addr and addr_list:
                    chosen_addr = addr_list[0]

                if chosen_addr:
                    ip_data = chosen_addr.split("/")
                    ip_address = ip_data[0] if len(ip_data) > 0 else ""
                    prefix = int(ip_data[1]) if len(ip_data) > 1 and ip_data[1].isdigit() else 0
                    subnet_mask = ".".join([str((0xFFFFFFFF << (32 - prefix) >> i) & 0xFF) for i in [24, 16, 8, 0]])
            else:
                # Fallback to device-assigned IP if profile has no addresses
                for i in range(1, 10):
                    addr_val = dev_data.get(f"IP4.ADDRESS[{i}]", "")
                    if addr_val:
                        ip_data = addr_val.split("/")
                        ip = ip_data[0] if len(ip_data) > 0 else ""
                        if ip and not ip.startswith("169.254."):
                            ip_address = ip
                            prefix = int(ip_data[1]) if len(ip_data) > 1 and ip_data[1].isdigit() else 0
                            subnet_mask = ".".join([str((0xFFFFFFFF << (32 - prefix) >> i) & 0xFF) for i in [24, 16, 8, 0]])
                            break
        else:
            # For DHCP (auto), get the currently assigned IP from device
            # Filter out link-local addresses (169.254.x.x) by checking all IP4.ADDRESS entries
            first_ip = ""
            first_prefix = 0
            for i in range(1, 10):  # Check up to 10 IPs
                addr_key = f"IP4.ADDRESS[{i}]"
                addr_value = dev_data.get(addr_key, "")
                if addr_value:
                    ip_data = addr_value.split("/")
                    ip = ip_data[0] if len(ip_data) > 0 else ""
                    prefix = int(ip_data[1]) if len(ip_data) > 1 else 0
                    if not first_ip:
                        first_ip = ip
                        first_prefix = prefix
                    # Skip link-local addresses (169.254.x.x)
                    if ip and not ip.startswith("169.254."):
                        ip_address = ip
                        subnet_mask = ".".join([str((0xFFFFFFFF << (32 - prefix) >> i) & 0xFF) for i in [24, 16, 8, 0]])
                        break
            if not ip_address and first_ip:
                ip_address = first_ip
                subnet_mask = ".".join([str((0xFFFFFFFF << (32 - first_prefix) >> i) & 0xFF) for i in [24, 16, 8, 0]])

        # Get gateway and DNS from connection profile
        gateway = conn_data.get("ipv4.gateway", "").strip()
        if not gateway:
            gateway = dev_data.get("IP4.GATEWAY", "")

        dns_servers = conn_data.get("ipv4.dns", "").strip()
        if dns_servers:
            dns_list = [d.strip() for d in dns_servers.split(",") if d.strip()]
        else:
            raw_dns = dev_data.get("IP4.DNS[1]", "").strip()
            dns_list = [raw_dns] if raw_dns else []

        ssid = dev_data.get("AP[1].SSID")

        return {
            "connected": True,
            "device": interface,
            "ssid": ssid,
            "connection": conn_name,
            "mode": method,
            "ipAddress": ip_address,
            "subnetMask": subnet_mask,
            "gateway": gateway,
            "dnsServers": dns_list,
        }
    except (RuntimeError, IndexError):
        return {"connected": False}


# --- Ethernet Functions ---


def get_ethernet_config():
    """Gets the current configuration of the 'eth0' interface."""
    info = _get_ip_info("eth0")
    if not info.get("connected"):
        return {"mode": "disconnected"}

    info.pop("connected", None)
    info.pop("ssid", None)
    return info


def set_ethernet_config(config):
    """Sets a static IP configuration for the 'eth0' interface."""
    try:
        conn_name = _get_connection_name_for_device("eth0")
    except RuntimeError as e:
        return {"error": str(e)}

    # Convert subnet mask (e.g., 255.255.255.0) or CIDR (e.g., 24, /24) to CIDR prefix
    try:
        mask_str = config.subnetMask.strip()
        if "." in mask_str:
            parts = [int(x) for x in mask_str.split(".")]
            if len(parts) != 4 or not all(0 <= p <= 255 for p in parts):
                return {"error": f"Invalid subnet mask: {config.subnetMask}"}
            prefix = sum(bin(x).count("1") for x in parts)
        else:
            prefix = int(mask_str.lstrip("/"))
            if not (0 <= prefix <= 32):
                return {"error": f"Invalid CIDR prefix: {config.subnetMask}"}
    except Exception:
        return {"error": f"Invalid subnet mask: {config.subnetMask}"}

    # Filter and clean DNS servers
    dns_list = [d.strip() for d in (config.dnsServers or []) if d.strip()]

    # Construct the modification command
    mod_command = [
        "connection",
        "modify",
        conn_name,
        "ipv4.method",
        "manual",
        "ipv4.addresses",
        f"{config.ipAddress}/{prefix}",
        "ipv4.gateway",
        config.gateway or "",
        "ipv4.dns",
        ",".join(dns_list),
    ]
    try:
        _run_nmcli_command(mod_command)
    except RuntimeError as e:
        return {"error": str(e)}

    # Re-apply the connection to make changes take effect
    try:
        _run_nmcli_command(["connection", "up", conn_name])
    except RuntimeError as e:
        logging.warning(f"Could not bring up connection '{conn_name}', but configuration was saved. Error: {e}")

    return get_ethernet_config()


def reset_ethernet_config():
    """Resets the Ethernet configuration to DHCP (auto)."""
    try:
        conn_name = _get_connection_name_for_device("eth0")
    except RuntimeError as e:
        return {"error": str(e)}

    mod_command = [
        "connection",
        "modify",
        conn_name,
        "ipv4.method",
        "auto",
        "ipv4.addresses",
        "",
        "ipv4.gateway",
        "",
        "ipv4.dns",
        "",
    ]
    try:
        _run_nmcli_command(mod_command)
    except RuntimeError as e:
        return {"error": str(e)}

    try:
        _run_nmcli_command(["connection", "up", conn_name])
    except RuntimeError as e:
        logging.warning(f"Could not bring up connection '{conn_name}', but configuration was saved. Error: {e}")

    return get_ethernet_config()


# --- Wi-Fi Functions ---


def get_wifi_config():
    """Gets the current configuration of the Wi-Fi interface."""
    info = _get_ip_info("wlan0")
    if not info.get("connected"):
        return {
            "deviceMode": "client",
            "clientConfig": {"connected": False, "ssid": None},
            "apConfig": None,
        }

    if "Hotspot" in info.get("connection"):
        deviceMode = "ap"
    else:
        deviceMode = "client"

    info["region"] = _get_wifi_region()

    return {"deviceMode": deviceMode, "clientConfig": info, "apConfig": info}


def _delete_wlan0():
    try:
        _run_nmcli_command(["device", "disconnect", "wlan0"])
    except RuntimeError as e:
        logging.warning(f"Could not disconnect wlan0 (might be already down): {e}")
    try:
        _run_nmcli_command(["con", "delete", "wlan0"])
    except RuntimeError as e:
        logging.warning(f"Could not delete wlan0 (might be already gone): {e}")


def set_wifi_config(config):
    """Configures the Wi-Fi interface for client or AP mode."""
    # Before setting a new mode (client or AP), disconnect the wlan0 device
    # to ensure a clean state. This is especially important when switching
    # between modes. The underlying connection profile is not deleted here,
    # just deactivated. nmcli will handle creating/reusing profiles.
    try:
        _run_nmcli_command(["device", "disconnect", "wlan0"])
    except RuntimeError as e:
        logging.warning(f"Could not disconnect wlan0 (might be already down): {e}")

    if config.mode == "client":
        try:
            _run_nmcli_command(["connection", "down", "stagepi-ap"])
        except RuntimeError as e:
            logging.warning(f"Could not disconnect AP (might be already down): {e}")
        try:
            _delete_wlan0()
        except RuntimeError as e:
            logging.warning(f"Could not delete wlan0 (might be already deleted): {e}")
        # add the device
        try:
            _run_nmcli_command(
                [
                    "con",
                    "add",
                    "type",
                    "wifi",
                    "con-name",
                    "wlan0",
                    "ifname",
                    "wlan0",
                    "ssid",
                    config.ssid,
                    "wifi-sec.key-mgmt",
                    "wpa-psk",
                    "wifi-sec.psk",
                    config.password,
                ]
            )
            _run_nmcli_command(["connection", "modify", "wlan0", "connection.autoconnect", "yes"])
            _run_nmcli_command(["connection", "up", "wlan0"])
        except RuntimeError as e:
            logging.warning(f"Failed configuring wlan0: {e}")
            return {"error": str(e)}

    elif config.mode == "hotspot":
        try:
            _delete_wlan0()
            _run_nmcli_command(
                [
                    "device",
                    "wifi",
                    "hotspot",
                    "ifname",
                    "wlan0",
                    "ssid",
                    config.ssid,
                    "password",
                    config.password,
                ]
            )
        except RuntimeError as e:
            logging.warning(f"Could not setup Hotspot: {e}")
            return {"error": str(e)}
    try:
        _set_wifi_region(config.region)
    except (ValueError, RuntimeError) as e:
        logging.warning(f"Could not set region {config.region}: {e}")
        return {"error": str(e)}

    return get_wifi_config()


def scan_for_networks():
    """Scans for Wi-Fi networks using nmcli."""
    logging.info("CORE: Scanning for Wi-Fi networks using nmcli...")
    output = _run_nmcli_command(["-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list"])
    lines = output.strip().split("\n")
    networks = []

    # The output is colon-separated, e.g., "MyNetwork:80:WPA2"
    # The header line might exist or not, so we check each line.
    for line in lines:
        # CHANGED: Replaced regex with a simpler and more reliable split
        parts = line.split(":")

        # Ensure the line has the expected number of parts
        if len(parts) >= 3:
            ssid = parts[0]
            signal = parts[1]
            security = parts[2] if len(parts) > 2 else ""

            # Skip empty SSIDs which can sometimes appear
            if not ssid:
                continue

            networks.append(
                {
                    "ssid": ssid.strip(),
                    "signalStrength": int(signal),
                    "security": (security.strip() if security.strip() and security.strip() != "--" else "Open"),
                }
            )

    # Sorting is no longer needed here as nmcli often lists them by strength
    return networks
