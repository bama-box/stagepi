# core/network_manager.py
import subprocess
import re
import logging

# --- Configure Logging ---
# This sets up basic logging to print INFO level messages and higher to the console.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


# --- Helper Functions ---

def _run_nmcli_command(command: list) -> str:
    """A helper to run nmcli commands, log them, and handle errors."""
    try:
        base_command = ["nmcli", "-t"]
        full_command = base_command + command
        
        # ADDED: Log the command before executing it
        logging.info(f"Executing command: {' '.join(full_command)}")
        
        result = subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            check=True,
            timeout=15
        )
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

def _get_ip_info(interface: str):
    """Gets detailed IP and connection info for a specific interface."""
    try:
        # Get all device properties
        dev_output = _run_nmcli_command(["-f", "all", "device", "show", interface])
        dev_data = {k: v for k, v in (line.split(':', 1) for line in dev_output.split('\n'))}

        # Check if the device is connected
        if dev_data.get('GENERAL.STATE') != '100 (connected)':
            return {"connected": False}

        # Extract IP details
        ip_data = dev_data.get('IP4.ADDRESS[1]', '').split('/')
        prefix = int(ip_data[1]) if len(ip_data) > 1 else 0
        subnet_mask = ".".join([str((0xffffffff << (32 - prefix) >> i) & 0xff) for i in [24, 16, 8, 0]])
        
        # Get the connection name and then its method (auto/manual)
        conn_name = dev_data.get('GENERAL.CONNECTION')
        if not conn_name:
            return {"connected": False} # No active connection profile
            
        method_output = _run_nmcli_command(["-f", "ipv4.method", "connection", "show", conn_name])
        method = method_output.split(':')[1] if ':' in method_output else 'unknown'

        return {
            "connected": True,
            "ssid": conn_name,
            "mode": method,
            "ipAddress": ip_data[0],
            "subnetMask": subnet_mask,
            "gateway": dev_data.get('IP4.GATEWAY', ''),
            "dnsServers": dev_data.get('IP4.DNS[1]', '').split(',')
        }
    except (RuntimeError, IndexError):
        return {"connected": False}

# --- Ethernet Functions ---

def get_ethernet_config():
    """Gets the current configuration of the 'eth0' interface."""
    info = _get_ip_info('eth0')
    if not info.get("connected"):
        return {"mode": "disconnected"}
    
    info.pop("connected", None)
    info.pop("ssid", None)
    return info

def set_ethernet_config(config):
    """Sets a static IP configuration for the 'eth0' interface."""
    info = _get_ip_info('eth0')
    if not info or not info.get('connected'):
        return {"error": "Ethernet is not connected. Cannot set static IP."}
    conn_name = info['ssid']

    # Convert subnet mask (e.g., 255.255.255.0) to CIDR prefix (e.g., 24)
    prefix = sum(bin(int(x)).count('1') for x in config.subnetMask.split('.'))
    
    # Construct the modification command
    mod_command = [
        "connection", "modify", conn_name,
        "ipv4.method", "manual",
        "ipv4.addresses", f"{config.ipAddress}/{prefix}",
        "ipv4.gateway", config.gateway,
        "ipv4.dns", ",".join(config.dnsServers)
    ]
    _run_nmcli_command(mod_command)

    # Re-apply the connection to make changes take effect
    _run_nmcli_command(["connection", "up", conn_name])
    
    return get_ethernet_config()

def reset_ethernet_config():
    """Resets the Ethernet configuration to DHCP (auto)."""
    info = _get_ip_info('eth0')
    if not info or not info.get('connected'):
        return {"error": "Ethernet is not connected. Cannot reset."}
    
    conn_name = info['ssid']
    _run_nmcli_command(["connection", "modify", conn_name, "ipv4.method", "auto"])
    _run_nmcli_command(["connection", "up", conn_name])
    return get_ethernet_config()

# --- Wi-Fi Functions ---

def get_wifi_config():
    """Gets the current configuration of the Wi-Fi interface."""
    info = _get_ip_info('wlan0')
    if not info.get("connected"):
        return {"deviceMode": "client", "clientConfig": {"connected": False, "ssid": None}, "apConfig": None}
    
    # We assume client mode if there's a standard connection. AP mode detection is more complex.
    return {"deviceMode": "client", "clientConfig": info, "apConfig": None}

def set_wifi_config(config):
    """Configures the Wi-Fi interface for client or AP mode."""
    try:
        _run_nmcli_command(["device", "disconnect", "wlan0"])
    except RuntimeError as e:
        logging.warning(f"Could not disconnect wlan0 (might be already down): {e}")

    if config.deviceMode == "client":
        client_config = config.clientConfig
        _run_nmcli_command(["device", "wifi", "connect", client_config.ssid, "password", client_config.password, "ifname", "wlan0"])
    elif config.deviceMode == "ap":
        ap_config = config.apConfig
        _run_nmcli_command(["device", "wifi", "hotspot", "ifname", "wlan0", "ssid", ap_config.ssid, "password", ap_config.password])
    else:
        raise ValueError("Invalid deviceMode specified.")
    
    return get_wifi_config()

def reset_wifi_config():
    """Disconnects and forgets any active Wi-Fi connection."""
    try:
        info = _get_ip_info('wlan0')
        if info.get("connected"):
            conn_name = info['ssid']
            logging.info(f"CORE: Deleting connection '{conn_name}'...")
            _run_nmcli_command(["connection", "delete", conn_name])
    except RuntimeError as e:
        logging.warning(f"Could not reset Wi-Fi (maybe no active connection): {e}")
    
    return get_wifi_config()

def scan_for_networks():
    """Scans for Wi-Fi networks using nmcli."""
    logging.info("CORE: Scanning for Wi-Fi networks using nmcli...")
    output = _run_nmcli_command(["-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list"])
    lines = output.strip().split('\n')
    networks = []
    
    # The output is colon-separated, e.g., "MyNetwork:80:WPA2"
    # The header line might exist or not, so we check each line.
    for line in lines:
        # CHANGED: Replaced regex with a simpler and more reliable split
        parts = line.split(':')
        
        # Ensure the line has the expected number of parts
        if len(parts) >= 3:
            ssid = parts[0]
            signal = parts[1]
            security = parts[2] if len(parts) > 2 else ''
            
            # Skip empty SSIDs which can sometimes appear
            if not ssid:
                continue

            networks.append({
                "ssid": ssid.strip(),
                "signalStrength": int(signal),
                "security": security.strip() if security.strip() and security.strip() != '--' else 'Open'
            })
    
    # Sorting is no longer needed here as nmcli often lists them by strength
    return networks
