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
"""

import logging
import os
import re
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

PTP4L_CONF_PATH = "/etc/linuxptp/ptp4l.conf"
PTP4L_SERVICE = "ptp4l.service"
PTP4L_SOCKET = "/var/run/ptp4l"

# Supported PTP Profiles for AoIP / Broadcast
PTP_PROFILES = {
    "ravenna": {
        "id": "ravenna",
        "name": "RAVENNA PTP Profile",
        "description": "Optimized for RAVENNA AoIP networks (Domain 0, 8 sync pkts/s, E2E)",
        "domain": 0,
        "logSyncInterval": -3,       # 8 packets/sec
        "logAnnounceInterval": 0,    # 1 packet/sec
        "announceReceiptTimeout": 3,
        "logMinDelayReqInterval": -3,# 8 packets/sec
        "delay_mechanism": "E2E",
        "network_transport": "UDPv4",
    },
    "aes67": {
        "id": "aes67",
        "name": "AES67 Media Profile (IEEE 1588-2008 Annex J)",
        "description": "Standard AES67 Audio-over-IP Profile (Domain 0, 8 sync pkts/s, 1 ann/2s)",
        "domain": 0,
        "logSyncInterval": -3,       # 8 packets/sec
        "logAnnounceInterval": 1,    # 1 packet/2 sec
        "announceReceiptTimeout": 3,
        "logMinDelayReqInterval": 0, # 1 packet/sec
        "delay_mechanism": "E2E",
        "network_transport": "UDPv4",
    },
    "smpte": {
        "id": "smpte",
        "name": "SMPTE ST 2059-2 (ST 2110 Broadcast)",
        "description": "SMPTE Broadcast Audio/Video Profile (Domain 127, 8 sync pkts/s)",
        "domain": 127,
        "logSyncInterval": -3,
        "logAnnounceInterval": -2,   # 4 packets/sec
        "announceReceiptTimeout": 3,
        "logMinDelayReqInterval": -3,
        "delay_mechanism": "E2E",
        "network_transport": "UDPv4",
    },
    "default": {
        "id": "default",
        "name": "Default PTPv2 (IEEE 1588-2008)",
        "description": "Generic IEEE 1588-2008 Default Parameters (Domain 0, 1 sync pkt/s)",
        "domain": 0,
        "logSyncInterval": 0,        # 1 packet/sec
        "logAnnounceInterval": 1,    # 1 packet/2 sec
        "announceReceiptTimeout": 3,
        "logMinDelayReqInterval": 0, # 1 packet/sec
        "delay_mechanism": "E2E",
        "network_transport": "UDPv4",
    },
}


def _find_binary(name: str) -> Optional[str]:
    """Find binary path looking in standard sbin and bin directories."""
    paths = [f"/usr/sbin/{name}", f"/usr/local/sbin/{name}", f"/sbin/{name}", f"/usr/bin/{name}"]
    for p in paths:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    which_res = shutil.which(name)
    if which_res:
        return which_res
    return None


def is_ptp_installed() -> bool:
    """Check if ptp4l and pmc binaries are available on the system."""
    return _find_binary("ptp4l") is not None and _find_binary("pmc") is not None


def _run_systemctl(action: str, service: str = PTP4L_SERVICE) -> subprocess.CompletedProcess:
    """Run a systemctl command via sudo."""
    return subprocess.run(
        ["sudo", "systemctl", action, service],
        capture_output=True,
        text=True,
        check=False,
    )


def is_ptp_service_active() -> bool:
    """Check if ptp4l service is running."""
    res = _run_systemctl("is-active")
    return res.returncode == 0 and res.stdout.strip() == "active"


def is_ptp_service_enabled() -> bool:
    """Check if ptp4l service is enabled."""
    res = _run_systemctl("is-enabled")
    return res.returncode == 0 and res.stdout.strip() == "enabled"


def restart_ptp_service() -> bool:
    """Restart ptp4l service."""
    res = _run_systemctl("restart")
    if res.returncode != 0:
        logger.error(f"Failed to restart ptp4l: {res.stderr}")
        return False
    return True


def query_pmc() -> Dict[str, Any]:
    """
    Query ptp4l management data using pmc over the UDS socket.
    Returns parsed dictionary of PTP properties.
    """
    pmc_bin = _find_binary("pmc")
    if not pmc_bin:
        return {}

    if not os.path.exists(PTP4L_SOCKET):
        logger.debug(f"PTP UDS socket {PTP4L_SOCKET} not found (ptp4l may be stopped)")
        return {}

    # Query TIME_STATUS_NP, PORT_DATA_SET, DEFAULT_DATA_SET, CURRENT_DATA_SET in one call
    cmd = [
        "sudo",
        pmc_bin,
        "-u",
        "-s",
        PTP4L_SOCKET,
        "-b",
        "0",
        "GET TIME_STATUS_NP",
        "GET PORT_DATA_SET",
        "GET DEFAULT_DATA_SET",
        "GET CURRENT_DATA_SET",
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=2.5, check=False)
        if proc.returncode != 0:
            logger.warning(f"pmc query returned error code {proc.returncode}: {proc.stderr}")
            return {}

        return _parse_pmc_output(proc.stdout)
    except Exception as e:
        logger.error(f"Failed to execute pmc query: {e}")
        return {}


def _parse_pmc_output(output: str) -> Dict[str, Any]:
    """Parse key-value properties from pmc management responses."""
    data: Dict[str, Any] = {}

    for line in output.splitlines():
        line = line.strip()
        if not line or line.startswith("sending:") or "RESPONSE MANAGEMENT" in line:
            continue

        parts = line.split(maxsplit=1)
        if len(parts) == 2:
            key, val = parts[0], parts[1].strip()

            # Conversions
            if val.lower() == "true":
                data[key] = True
            elif val.lower() == "false":
                data[key] = False
            elif re.match(r"^-?\d+$", val):
                data[key] = int(val)
            elif re.match(r"^-?\d+\.\d+$", val):
                data[key] = float(val)
            else:
                data[key] = val

    return data


def detect_active_profile() -> str:
    """Inspect /etc/linuxptp/ptp4l.conf to detect the active profile."""
    if not os.path.exists(PTP4L_CONF_PATH):
        return "default"

    try:
        with open(PTP4L_CONF_PATH, "r", encoding="utf-8") as f:
            content = f.read()

        # Check domainNumber and logSyncInterval
        domain_match = re.search(r"^\s*domainNumber\s+(\d+)", content, re.MULTILINE)
        sync_match = re.search(r"^\s*logSyncInterval\s+(-?\d+)", content, re.MULTILINE)
        ann_match = re.search(r"^\s*logAnnounceInterval\s+(-?\d+)", content, re.MULTILINE)

        domain = int(domain_match.group(1)) if domain_match else 0
        sync_int = int(sync_match.group(1)) if sync_match else 0
        ann_int = int(ann_match.group(1)) if ann_match else 1

        if domain == 127:
            return "smpte"
        if domain == 0 and sync_int == -3 and ann_int == 0:
            return "ravenna"
        if domain == 0 and sync_int == -3 and ann_int == 1:
            return "aes67"
        return "default"
    except Exception as e:
        logger.warning(f"Failed to read {PTP4L_CONF_PATH}: {e}")
        return "default"


def get_ptp_status() -> Dict[str, Any]:
    """
    Get comprehensive real-time PTP status for the UI.
    Includes lock status, master offset, grandmaster identity, and active profile.
    """
    installed = is_ptp_installed()
    service_active = is_ptp_service_active() if installed else False
    service_enabled = is_ptp_service_enabled() if installed else False

    profile = detect_active_profile()
    pmc_data = query_pmc() if (installed and service_active) else {}

    port_state = str(pmc_data.get("portState", "UNKNOWN")).upper()
    master_offset_ns = float(pmc_data.get("master_offset", pmc_data.get("offsetFromMaster", 0.0)))
    master_offset_us = round(master_offset_ns / 1000.0, 2)
    mean_path_delay_ns = float(pmc_data.get("meanPathDelay", pmc_data.get("peerMeanPathDelay", 0.0)))
    steps_removed = int(pmc_data.get("stepsRemoved", 0))

    clock_id = str(pmc_data.get("clockIdentity", ""))
    gm_id = str(pmc_data.get("gmIdentity", clock_id))
    gm_present = bool(pmc_data.get("gmPresent", False))
    domain = int(pmc_data.get("domainNumber", PTP_PROFILES.get(profile, {}).get("domain", 0)))
    port_id = str(pmc_data.get("portIdentity", ""))

    is_master = (port_state == "MASTER") or (clock_id and gm_id and clock_id.lower() == gm_id.lower() and port_state != "SLAVE")

    # Determine high-level lock status for dashboard pill
    if not installed or not service_active:
        lock_status = "inactive"
    elif is_master:
        lock_status = "master"
    elif port_state == "SLAVE":
        # In software timestamping mode, jitter is typically < 50µs; in hardware < 1µs
        if abs(master_offset_ns) <= 50000:
            lock_status = "locked"
        else:
            lock_status = "syncing"
    elif port_state in ["LISTENING", "UNCALIBRATED"]:
        lock_status = "syncing"
    elif port_state == "FAULTY":
        lock_status = "faulty"
    else:
        lock_status = "free_running"

    return {
        "installed": installed,
        "service_active": service_active,
        "service_enabled": service_enabled,
        "state": port_state if service_active else "INACTIVE",
        "lock_status": lock_status,
        "profile": profile,
        "profile_name": PTP_PROFILES.get(profile, {}).get("name", "Default"),
        "domain": domain,
        "clock_identity": clock_id,
        "gm_identity": gm_id,
        "gm_present": gm_present,
        "is_master": is_master,
        "master_offset_ns": master_offset_ns,
        "master_offset_us": master_offset_us,
        "mean_path_delay_ns": mean_path_delay_ns,
        "steps_removed": steps_removed,
        "port_identity": port_id,
        "interface": "eth0",
        "timestamping": "software",
    }


def get_available_profiles() -> List[Dict[str, Any]]:
    """Return list of supported PTP profiles with metadata."""
    active_id = detect_active_profile()
    profiles_list = []
    for pid, pdata in PTP_PROFILES.items():
        item = dict(pdata)
        item["is_active"] = (pid == active_id)
        profiles_list.append(item)
    return profiles_list


def apply_ptp_profile(profile_id: str, custom_domain: Optional[int] = None) -> bool:
    """
    Apply a PTP profile by updating /etc/linuxptp/ptp4l.conf and restarting ptp4l.
    """
    if profile_id not in PTP_PROFILES:
        raise ValueError(f"Unknown PTP profile: {profile_id}. Available: {list(PTP_PROFILES.keys())}")

    profile = PTP_PROFILES[profile_id]
    domain = custom_domain if custom_domain is not None else profile["domain"]

    # Generate ptp4l.conf
    conf_content = f"""# Stage Pi: Open source stagebox firmware
# Automatically managed by StagePi PTP Manager
# Profile: {profile['name']}

[global]
twoStepFlag             1
slaveOnly               0
socket_priority         0
priority1               128
priority2               128
domainNumber            {domain}
clockClass              248
clockAccuracy           0xFE
offsetScaledLogVariance 0xFFFF
free_running            0
freq_est_interval       1
dscp_event              0
dscp_general            0
dataset_comparison      ieee1588
maxStepsRemoved         255

# Port Data Set
logAnnounceInterval     {profile['logAnnounceInterval']}
logSyncInterval         {profile['logSyncInterval']}
operLogSyncInterval     {profile['logSyncInterval']}
logMinDelayReqInterval  {profile['logMinDelayReqInterval']}
announceReceiptTimeout  {profile['announceReceiptTimeout']}
syncReceiptTimeout      0
delayAsymmetry          0
fault_reset_interval    4
neighborPropDelayThresh 20000000
masterOnly              0
asCapable               auto
BMCA                    ptp

# Run time options
assume_two_step         0
logging_level           6
path_trace_enabled      0
follow_up_info          0
hybrid_e2e              0
inhibit_multicast_service 0
tx_timestamp_timeout    1
use_syslog              1
verbose                 1
summary_interval        0
kernel_leap             1

# Servo Options
pi_proportional_const   0.0
pi_integral_const       0.0
pi_proportional_scale   0.0
pi_proportional_exponent -0.3
pi_proportional_norm_max 0.7
pi_integral_scale       0.0
pi_integral_exponent    0.4
pi_integral_norm_max    0.3
step_threshold          0.0
first_step_threshold    0.00002
max_frequency           900000000
clock_servo             pi
sanity_freq_limit       200000000
uds_address             /var/run/ptp4l

# Interface and Transport options
clock_type              OC
network_transport       {profile['network_transport']}
delay_mechanism         {profile['delay_mechanism']}
time_stamping           software
tsproc_mode             filter
delay_filter            moving_median
delay_filter_length     10
"""

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, encoding="utf-8", suffix=".conf") as tf:
            temp_path = tf.name
            tf.write(conf_content)

        subprocess.run(["sudo", "mv", temp_path, PTP4L_CONF_PATH], check=True)
        subprocess.run(["sudo", "chown", "root:root", PTP4L_CONF_PATH], check=True)
        subprocess.run(["sudo", "chmod", "644", PTP4L_CONF_PATH], check=True)

        logger.info(f"Updated {PTP4L_CONF_PATH} with profile '{profile_id}' (domain {domain})")

        # Restart ptp4l service to apply new configuration
        restart_ptp_service()
        return True
    except Exception as e:
        logger.error(f"Failed to apply PTP profile {profile_id}: {e}")
        return False
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
