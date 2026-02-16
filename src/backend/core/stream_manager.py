"""
Stage Pi: Open source stagebox software

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

import configparser
import logging

import os
import pwd
import re
import subprocess
import tempfile
import uuid
from dataclasses import dataclass
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)

# ==========================================
# GStreamer AES67 Stream Classes
# ==========================================


@dataclass
class StreamConfig:
    stream_id: str
    kind: Literal["sender", "receiver"]
    ip: str  # Multicast Group IP (e.g. 239.69.0.1)
    port: int  # RTP Port (e.g. 5004)
    device: str  # ALSA Device (e.g. 'hw:0,0' or 'default')
    iface: str  # Network Interface (e.g. 'eth0')
    channels: int = 2
    loopback: bool = False  # Set True if testing on same machine
    buffer_time: int = 100000  # in microseconds
    latency_time: int = 5000000  # in microseconds
    sync: bool = False  # AES67 recommends sync=false for senders
    format: str = "S24BE"  # Audio format (S16LE, S24LE, S24BE, S32LE, etc.)


# ==========================================
# Helper Functions for Supervisor Config Management
# ==========================================


def _parse_supervisor_env_vars(env_string: str) -> dict[str, str]:
    """
    Parse supervisor environment variable string into dictionary.

    Extracts STAGEPI_* variables from supervisor's environment format:
    STAGEPI_KIND="sender",STAGEPI_IP="239.69.0.1",...

    Args:
        env_string: Environment variable string from supervisor config

    Returns:
        Dictionary mapping field names (lowercase) to string values
    """
    parsed = {}
    pattern = r'STAGEPI_(\w+)="([^"]*)"'
    for match in re.finditer(pattern, env_string):
        field_name, value = match.groups()
        parsed[field_name.lower()] = value
    return parsed


def _build_supervisor_env_string(config: dict[str, Any]) -> str:
    """
    Build supervisor environment variable string from stream config.

    Args:
        config: Stream configuration dictionary

    Returns:
        Comma-separated environment variable string
    """
    env_pairs = []

    # Define field order for consistency
    fields = [
        "stream_id",
        "kind",
        "ip",
        "port",
        "device",
        "iface",
        "channels",
        "buffer_time",
        "latency_time",
        "sync",
        "format",
        "loopback",
    ]

    for field in fields:
        if field in config:
            value = config[field]
            # Convert booleans to lowercase string
            if isinstance(value, bool):
                value = "true" if value else "false"
            env_pairs.append(f'STAGEPI_{field.upper()}="{value}"')

    # Always include GST_DEBUG at the end
    env_pairs.append('GST_DEBUG="2"')

    return ",".join(env_pairs)


def _read_supervisor_config(stream_id: str) -> Optional[dict[str, Any]]:
    """
    Read a single supervisor config file and extract stream configuration.

    Args:
        stream_id: The stream ID

    Returns:
        Stream configuration dictionary or None if file doesn't exist or is malformed
    """
    conf_path = os.path.join(AES67Stream.SUPERVISOR_CONF_DIR, f"stagepi-stream-{stream_id}.conf")

    if not os.path.exists(conf_path):
        return None

    try:
        config = configparser.ConfigParser()
        config.read(conf_path)

        section = f"program:stagepi-stream-{stream_id}"
        if section not in config.sections():
            logger.warning(f"Config file {conf_path} missing expected section [{section}]")
            return None

        # Extract metadata from environment variables
        env_string = config.get(section, "environment", fallback="")
        parsed_fields = _parse_supervisor_env_vars(env_string)

        # Validate required fields
        required = ["stream_id", "kind", "ip", "port", "device", "iface"]
        missing = [f for f in required if f not in parsed_fields]
        if missing:
            logger.warning(f"Config {conf_path} missing required fields: {missing}")
            return None

        # Get enabled status from autostart
        enabled = config.getboolean(section, "autostart", fallback=True)

        # Build stream config dict with type conversions
        stream_config = {
            "id": parsed_fields["stream_id"],
            "kind": parsed_fields["kind"],
            "ip": parsed_fields["ip"],
            "port": int(parsed_fields["port"]),
            "device": parsed_fields["device"],
            "iface": parsed_fields["iface"],
            "channels": int(parsed_fields.get("channels", "2")),
            "buffer_time": int(parsed_fields.get("buffer_time", "100000")),
            "latency_time": int(parsed_fields.get("latency_time", "5000000")),
            "sync": parsed_fields.get("sync", "false").lower() == "true",
            "format": parsed_fields.get("format", "S24BE"),
            "loopback": parsed_fields.get("loopback", "false").lower() == "true",
            "enabled": enabled,
        }

        return stream_config

    except Exception as e:
        logger.error(f"Error reading supervisor config {conf_path}: {e}")
        return None


def _list_all_supervisor_configs() -> list[str]:
    """
    List all stream IDs from supervisor config files.

    Returns:
        List of stream IDs
    """
    stream_ids = []

    if not os.path.exists(AES67Stream.SUPERVISOR_CONF_DIR):
        return stream_ids

    try:
        for filename in os.listdir(AES67Stream.SUPERVISOR_CONF_DIR):
            if filename.startswith("stagepi-stream-") and filename.endswith(".conf"):
                # Extract stream ID from filename: stagepi-stream-{id}.conf
                stream_id = filename[15:-5]  # Remove prefix and suffix
                stream_ids.append(stream_id)
    except Exception as e:
        logger.error(f"Error listing supervisor configs: {e}")

    return stream_ids


class AES67Stream:
    """
    Manages an AES67 stream using supervisor-managed gst-launch process.
    Each stream is a separate supervisor program for better isolation and debugging.
    """

    SUPERVISOR_CONF_DIR = "/etc/supervisor/conf.d"

    def __init__(self, config: StreamConfig):
        self.config = config
        self.pipeline_str = self._build_pipeline_string()
        self.supervisor_program_name = f"stagepi-stream-{config.stream_id}"

    def _get_alsa_device_string(self, device_name: str) -> str:
        """
        Format ALSA device string.
        If device is 'default', return as is.
        If device has no prefix (no colon), prepend 'hw:'.
        Otherwise return as is (assumes user provided 'hw:x,y' or 'plughw:x,y').
        """
        if device_name == "default":
            return device_name

        if ":" in device_name:
            return device_name

        return f"hw:{device_name}"

    def _build_pipeline_string(self) -> str:
        """Build the gst-launch-1.0 pipeline string for this stream."""
        c = self.config
        device_str = self._get_alsa_device_string(c.device)

        if c.kind == "sender":
            # - Configurable audio format (S16LE, S24LE, S24BE, S32LE, etc.)
            # - audioresample included
            # - sync=false (as requested)
            # - buffer-time=100 / latency-time=5000
            return (
                f"alsasrc device={device_str} buffer-time={c.buffer_time} latency-time={c.latency_time} ! "
                "audioconvert ! "
                "audioresample ! "
                f"audio/x-raw,format={c.format},rate=48000,channels={c.channels} ! "
                "rtpL24pay mtu=1400 max-ptime=5000000 ! "
                f"udpsink host={c.ip} port={c.port} "
                f"auto-multicast=true multicast-iface={c.iface} "
                f"qos-dscp=46 sync={str(c.sync).lower()}"
            )

        elif c.kind == "receiver":
            # Updated receiver to handle S24BE input if needed,
            # though usually depayloader handles this automatically.
            return (
                f"udpsrc address={c.ip} port={c.port} "
                f"auto-multicast=true multicast-iface={c.iface} ! "
                f"application/x-rtp,media=audio,clock-rate=48000,encoding-name=L24,channels={c.channels} ! "
                "rtpjitterbuffer mode=slave name=jbuf latency=20 ! "
                "rtpL24depay ! "
                "audioconvert ! "
                f"alsasink device={device_str}"
            )

        else:
            raise ValueError(f"Unknown stream kind: {c.kind}")

    def _create_supervisor_config(self, enabled: bool = True) -> str:
        """
        Create a supervisor configuration file for this stream.
        Returns the path to the created config file.

        Args:
            enabled: Whether to set autostart=true in the config
        """
        # Ensure supervisor streams directory exists
        subprocess.run(["sudo", "mkdir", "-p", self.SUPERVISOR_CONF_DIR], check=True)

        conf_path = os.path.join(self.SUPERVISOR_CONF_DIR, f"{self.supervisor_program_name}.conf")

        # Build configuration dict for environment variables
        config_dict = {
            "stream_id": self.config.stream_id,
            "kind": self.config.kind,
            "ip": self.config.ip,
            "port": self.config.port,
            "device": self.config.device,
            "iface": self.config.iface,
            "channels": self.config.channels,
            "buffer_time": self.config.buffer_time,
            "latency_time": self.config.latency_time,
            "sync": self.config.sync,
            "format": self.config.format,
            "loopback": self.config.loopback,
        }

        env_string = _build_supervisor_env_string(config_dict)

        
        # Inject necessary environment variables for GStreamer/ALSA
        # gst-launch needs XDG_RUNTIME_DIR for PulseAudio/PipeWire interactions
        # and HOME for some plugin configs.
        try:
            # We assume the user is 'pi' as per the config line "user=pi" below
            # But we can make it more robust by looking up the user
            target_user = "pi"
            pw_record = pwd.getpwnam(target_user)
            user_env = {
                "HOME": pw_record.pw_dir,
                "USER": target_user,
                "XDG_RUNTIME_DIR": f"/run/user/{pw_record.pw_uid}",
            }
            
            # Append these to the existing env_string
            extra_env = ",".join([f'{k}="{v}"' for k, v in user_env.items()])
            if env_string:
                env_string = f"{env_string},{extra_env}"
            else:
                env_string = extra_env
                
        except KeyError:
            logger.warning(f"User 'pi' not found. Supervisor environment might be incomplete.")
        except Exception as e:
            logger.warning(f"Failed to setup environment for supervisor stream: {e}")

        autostart = "true" if enabled else "false"

        # Create supervisor configuration with all metadata in environment
        config_content = f"""# Stream configuration managed by StagePi
[program:{self.supervisor_program_name}]
command=/usr/bin/gst-launch-1.0 {self.pipeline_str}
autostart={autostart}
autorestart=true
startsecs=2
startretries=3
stdout_logfile=/var/log/supervisor/stream-{self.config.stream_id}.log
stderr_logfile=/var/log/supervisor/stream-{self.config.stream_id}-error.log
environment={env_string}
user=pi
"""
        # Write to temp file and move with sudo to handle permissions
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as tmp:
            tmp.write(config_content)
            tmp_path = tmp.name

        subprocess.run(["sudo", "mv", tmp_path, conf_path], check=True)

        logger.info(f"Created supervisor config: {conf_path} (autostart={autostart})")
        return conf_path

    def _supervisorctl(self, *args) -> subprocess.CompletedProcess:
        """Execute a supervisorctl command."""
        cmd = ["sudo", "supervisorctl"] + list(args)
        logger.debug(f"Executing: {' '.join(cmd)}")
        return subprocess.run(cmd, capture_output=True, text=True, check=False)

    def start(self, enabled: bool = True):
        """
        Start the stream by creating a supervisor config and starting the program.

        Args:
            enabled: Whether to set autostart=true and actually start the stream
        """
        try:
            logger.info(f"Launching Stream {self.config.stream_id} ({self.config.kind})...")
            logger.info(f"Pipeline string: {self.pipeline_str}")

            # Create supervisor configuration file with enabled flag
            self._create_supervisor_config(enabled=enabled)

            # Reload supervisor to pick up new config and start the new program if enabled
            result = self._supervisorctl("update")
            if result.returncode != 0:
                # supervisorctl can exit non-zero if other processes fail, so we log and continue,
                # then check the status of our specific stream below.
                logger.warning(
                    f"supervisorctl update finished with exit code {result.returncode}. "
                    f"Stderr: {result.stderr.strip()}. Stdout: {result.stdout.strip()}"
                )

            # Verify it's running
            import time

            time.sleep(0.5)  # Give it a moment to start

            status = self._get_supervisor_status()
            if status and status["state"] != "RUNNING":
                error_msg = self._get_process_error()
                if error_msg:
                    raise RuntimeError(error_msg)
                raise RuntimeError(f"Stream failed to start: {status.get('statename', 'unknown state')}")

            logger.info(f"Stream {self.config.stream_id} is RUNNING.")

        except Exception as e:
            logger.error(f"Failed to start {self.config.stream_id}: {e}")
            self.stop()
            raise

    def _get_process_error(self) -> Optional[str]:
        """
        Read the stderr log file to get error messages from the gst-launch process.
        Parse common GStreamer errors into user-friendly messages.
        """
        log_path = f"/var/log/supervisor/stream-{self.config.stream_id}-error.log"
        try:
            if os.path.exists(log_path):
                with open(log_path) as f:
                    # Read last 20 lines to get recent errors
                    lines = f.readlines()
                    error_text = "".join(lines[-20:])

                    # Common error mappings to user-friendly messages
                    if "device is being used by another application" in error_text.lower():
                        return f"Audio device '{self.config.device}' is currently in use by another application"
                    elif "could not open audio device" in error_text.lower():
                        return (
                            f"Could not open audio device '{self.config.device}'. "
                            "Check if device exists and permissions are correct"
                        )
                    elif "no such device" in error_text.lower() or "no such file" in error_text.lower():
                        return (
                            f"Audio device '{self.config.device}' not found. "
                            "Use 'arecord -l' or 'aplay -l' to list available devices"
                        )
                    elif "not-negotiated" in error_text.lower():
                        return (
                            f"Audio format negotiation failed on device '{self.config.device}'. "
                            f"Device may not support the requested format "
                            f"({self.config.format}, 48kHz, {self.config.channels} channels)"
                        )
                    elif "error" in error_text.lower() or "warning" in error_text.lower():
                        # Return last few lines if they contain errors
                        return error_text.strip()[-500:]

        except Exception as e:
            logger.warning(f"Failed to read error log: {e}")

        return None

    def _get_supervisor_status(self) -> Optional[dict[str, Any]]:
        """
        Get the status of this stream's supervisor program.
        Returns a dict with state information or None if not found.
        """
        result = self._supervisorctl("status", self.supervisor_program_name)
        output = result.stdout.strip()

        # Check for execution errors (e.g. permission denied, connection refused)
        if result.returncode != 0:
            # If it's just "no such process", return None (not created yet)
            if "no such process" in output.lower() or "no such process" in result.stderr.lower():
                return None

            # Otherwise return error state
            return {
                "state": "ERROR",
                "statename": "ERROR",
                "running": False,
                "output": f"supervisorctl failed (code {result.returncode}): {output} {result.stderr.strip()}",
            }

        if output:
            # Parse supervisor status output
            # Format: "program_name STATE pid uptime"
            # Example: "stagepi-stream-abc123 RUNNING pid 1234, uptime 0:00:05"

            if "no such process" in output.lower():
                return None

            parts = output.split()
            if len(parts) >= 2:
                statename = parts[1]
                return {
                    "state": statename,
                    "statename": statename,
                    "running": statename == "RUNNING",
                    "output": output,
                }

        return None

    def stop(self):
        """Stop the supervisor-managed stream process but keep config file."""
        logger.info(f"Stopping Stream {self.config.stream_id}...")
        try:
            # Stop the supervisor program
            result = self._supervisorctl("stop", self.supervisor_program_name)
            if result.returncode != 0 and "not running" not in result.stdout.lower():
                logger.warning(f"Error stopping stream: {result.stderr or result.stdout}")

            # Remove from supervisor (unloads from memory but keeps file)
            result = self._supervisorctl("remove", self.supervisor_program_name)
            if result.returncode != 0 and "no such process" not in result.stdout.lower():
                logger.warning(f"Error removing stream from supervisor: {result.stderr or result.stdout}")

            # Update config to set autostart=false (don't delete it!)
            # Use _create_supervisor_config to handle sudo permissions correctly
            self._create_supervisor_config(enabled=False)

            logger.info(f"Stream {self.config.stream_id} STOPPED.")

        except Exception as e:
            logger.error(f"Error during stream stop: {e}")

    def get_state(self) -> dict[str, Any]:
        """Get the current state of the supervisor-managed stream."""
        status = self._get_supervisor_status()

        if not status:
            return {
                "state": "STOPPED",
                "statename": "STOPPED",
                "running": False,
                "pipeline_string": self.pipeline_str,
                "config": {
                    "stream_id": self.config.stream_id,
                    "kind": self.config.kind,
                    "ip": self.config.ip,
                    "port": self.config.port,
                    "device": self.config.device,
                    "iface": self.config.iface,
                    "channels": self.config.channels,
                    "buffer_time": self.config.buffer_time,
                    "latency_time": self.config.latency_time,
                    "sync": self.config.sync,
                    "format": self.config.format,
                },
            }

        return {
            "state": status["state"],
            "statename": status["statename"],
            "running": status["running"],
            "pipeline_string": self.pipeline_str,
            "supervisor_output": status.get("output", ""),
            "config": {
                "stream_id": self.config.stream_id,
                "kind": self.config.kind,
                "ip": self.config.ip,
                "port": self.config.port,
                "device": self.config.device,
                "iface": self.config.iface,
                "channels": self.config.channels,
                "buffer_time": self.config.buffer_time,
                "latency_time": self.config.latency_time,
                "sync": self.config.sync,
                "format": self.config.format,
            },
        }


class SupervisorStreamManager:
    """
    Manages the lifecycle of supervisor-managed AES67 streams.
    Each stream runs as an independent supervisor program using gst-launch-1.0.
    """

    def __init__(self):
        self.streams: dict[str, AES67Stream] = {}
        logger.info("SupervisorStreamManager initialized.")

    def create_stream(self, config: StreamConfig):
        """Creates and starts a new AES67 stream."""
        if config.stream_id in self.streams:
            logger.warning(f"Stream {config.stream_id} already exists. Stopping old one.")
            self.stop_stream(config.stream_id)

        stream = AES67Stream(config)
        self.streams[config.stream_id] = stream
        stream.start()

    def stop_stream(self, stream_id: str):
        """Stops and removes a stream."""
        if stream_id in self.streams:
            self.streams[stream_id].stop()
            del self.streams[stream_id]
        else:
            logger.warning(f"Cannot stop stream {stream_id}: ID not found.")

    def get_stream_status(self, stream_id: str) -> Optional[dict[str, Any]]:
        """Get detailed status of a specific stream."""
        if stream_id in self.streams:
            return self.streams[stream_id].get_state()
        return None

    def get_all_streams_status(self) -> dict[str, dict[str, Any]]:
        """Get detailed status of all streams."""
        status = {}
        for stream_id, stream in self.streams.items():
            status[stream_id] = stream.get_state()
        return status

    def stop_all(self):
        """Shutdown hook."""
        logger.info("Stopping all streams...")
        ids = list(self.streams.keys())
        for sid in ids:
            self.stop_stream(sid)


# Global Supervisor Stream Manager instance
_supervisor_manager: Optional[SupervisorStreamManager] = None
_startup_failed_streams: list[dict[str, Any]] = []


def get_stream_manager() -> SupervisorStreamManager:
    """Get or create the global supervisor stream manager instance."""
    global _supervisor_manager
    if _supervisor_manager is None:
        _supervisor_manager = SupervisorStreamManager()
    return _supervisor_manager


def shutdown_stream_manager():
    """Shutdown the global supervisor stream manager."""
    global _supervisor_manager
    if _supervisor_manager is not None:
        _supervisor_manager.stop_all()
        _supervisor_manager = None


# Legacy function names for backward compatibility
def get_gstreamer_manager() -> SupervisorStreamManager:
    """Legacy function name - use get_stream_manager() instead."""
    return get_stream_manager()


def shutdown_gstreamer_manager():
    """Legacy function name - use shutdown_stream_manager() instead."""
    shutdown_stream_manager()


def get_startup_failed_streams() -> list[dict[str, Any]]:
    """Get the list of streams that failed to start during application startup."""
    global _startup_failed_streams
    return _startup_failed_streams.copy()


# ==========================================
# Stream Configuration Management
# ==========================================


def _dict_to_stream_config(stream_data: dict[str, Any]) -> Optional[StreamConfig]:
    """
    Convert dictionary stream configuration to StreamConfig dataclass.

    Args:
        stream_data: Dictionary containing stream configuration

    Returns:
        StreamConfig instance or None if required fields are missing
    """
    try:
        return StreamConfig(
            stream_id=str(stream_data.get("id", "")),
            kind=stream_data.get("kind", "receiver"),
            ip=stream_data.get("ip", "239.69.0.1"),
            port=int(stream_data.get("port", 5004)),
            device=stream_data.get("device", "default"),
            iface=stream_data.get("iface", "eth0"),
            channels=int(stream_data.get("channels", 2)),
            loopback=bool(stream_data.get("loopback", False)),
            buffer_time=int(stream_data.get("buffer_time", 100000)),
            latency_time=int(stream_data.get("latency_time", 5000000)),
            sync=bool(stream_data.get("sync", False)),
            format=str(stream_data.get("format", "S24BE")),
        )
    except (KeyError, ValueError, TypeError) as e:
        logger.error(f"Failed to convert stream data to StreamConfig: {e}")
        return None


def _sync_stream_to_gstreamer(stream_data: dict[str, Any]):
    """
    Synchronize a stream configuration to the GStreamer manager.
    If enabled, starts the stream. If disabled, creates config but doesn't start.

    Args:
        stream_data: Dictionary containing stream configuration

    Raises:
        RuntimeError: If the stream fails to start (only if enabled=True)
    """
    stream_id = str(stream_data.get("id", ""))
    enabled = stream_data.get("enabled", True)

    manager = get_gstreamer_manager()

    config = _dict_to_stream_config(stream_data)
    if not config:
        logger.warning(f"Cannot sync stream {stream_id}: Invalid configuration")
        config_summary = {k: stream_data.get(k) for k in ["kind", "device", "ip", "port"]}
        raise ValueError(
            f"Invalid stream configuration for '{stream_id}'. "
            f"Required fields: kind, ip, port, device, iface. Got: {config_summary}"
        )

    if enabled:
        # Start the stream (creates config with autostart=true and starts it)
        logger.info(f"Starting GStreamer stream: {stream_id}")
        try:
            # Stop existing stream if running
            if stream_id in manager.streams:
                manager.stop_stream(stream_id)

            # Create and start stream with enabled=True
            stream = AES67Stream(config)
            manager.streams[stream_id] = stream
            stream.start(enabled=True)
        except Exception as e:
            logger.error(f"Failed to start stream {stream_id}: {e}")
            # Re-raise with detailed error message
            raise RuntimeError(
                f"Failed to start {config.kind} stream '{stream_id}' on device '{config.device}': {str(e)}"
            ) from e
    else:
        # Create config with autostart=false but don't start the stream
        logger.info(f"Creating disabled stream config: {stream_id}")
        try:
            # Stop stream if it's running
            if stream_id in manager.streams:
                manager.stop_stream(stream_id)

            # Just create the config file, don't start
            stream = AES67Stream(config)
            stream._create_supervisor_config(enabled=False)

            # Reload supervisor to pick up the new or updated config
            stream._supervisorctl("update")
        except Exception as e:
            logger.warning(f"Failed to create disabled stream config {stream_id}: {e}")


def _sync_all_streams_to_gstreamer(provider: str = "aes67", save_failures: bool = False):
    """
    Synchronize all streams from JSON config to GStreamer manager.
    Starts enabled streams, stops disabled ones.

    This function handles errors gracefully - if a stream fails to start,
    it logs the error but continues processing other streams.

    Args:
        provider: The stream provider name
        save_failures: If True, save failed streams to global state for API access
    """
    global _startup_failed_streams

    streams = get_all_streams(provider)
    manager = get_gstreamer_manager()

    # Get currently running stream IDs
    running_ids = set(manager.streams.keys())
    config_ids = {str(s.get("id", "")) for s in streams}

    # Stop streams that are no longer in config
    for stream_id in running_ids - config_ids:
        logger.info(f"Stopping removed stream: {stream_id}")
        try:
            manager.stop_stream(stream_id)
        except Exception as e:
            logger.error(f"Error stopping stream {stream_id}: {e}")

    # Sync each stream in config - handle errors gracefully
    failed_streams = []
    for stream_data in streams:
        stream_id = str(stream_data.get("id", "unknown"))
        try:
            _sync_stream_to_gstreamer(stream_data)
        except Exception as e:
            # Log the error but continue processing other streams
            logger.error(f"Failed to sync stream {stream_id}: {e}")
            failed_streams.append(
                {
                    "id": stream_id,
                    "error": str(e),
                    "config": {k: stream_data.get(k) for k in ["kind", "device", "ip", "port", "enabled"]},
                }
            )

    # Save failures to global state if requested (during startup)
    if save_failures:
        _startup_failed_streams = failed_streams

    # Log summary of failed streams
    if failed_streams:
        logger.warning(f"Failed to start {len(failed_streams)} stream(s) during initialization:")
        for failed in failed_streams:
            logger.warning(f"  - Stream {failed['id']}: {failed['error']}")
        logger.info(f"Successfully started {len(streams) - len(failed_streams)} out of {len(streams)} streams")


def read_streams(provider: str = "aes67") -> dict[str, list[dict[str, Any]]]:
    """
    Read stream configurations from supervisor config files.

    Args:
        provider: The stream provider name (default: 'aes67')

    Returns:
        Dictionary with 'streams' key containing list of stream configurations
    """
    logger.info(f"CORE: Reading streams from supervisor configs for provider '{provider}'...")

    streams = []
    stream_ids = _list_all_supervisor_configs()

    for stream_id in stream_ids:
        stream_config = _read_supervisor_config(stream_id)
        if stream_config:
            streams.append(stream_config)
        else:
            logger.warning(f"Skipping malformed config for stream {stream_id}")

    logger.info(f"CORE: Loaded {len(streams)} streams from supervisor configs")
    return {"streams": streams}


def get_all_streams(provider: str = "aes67") -> list[dict[str, Any]]:
    """
    Get all streams for a provider.

    Args:
        provider: The stream provider name (default: 'aes67')

    Returns:
        List of stream configurations
    """
    cfg = read_streams(provider)
    return cfg.get("streams", [])


def get_stream_by_id(stream_id: str, provider: str = "aes67") -> Optional[dict[str, Any]]:
    """
    Get a specific stream by ID from supervisor config.

    Args:
        stream_id: The stream ID to find
        provider: The stream provider name (default: 'aes67')

    Returns:
        Stream configuration dict or None if not found
    """
    logger.info(f"CORE: Getting stream '{stream_id}' for provider '{provider}'...")
    return _read_supervisor_config(stream_id)


def add_stream(stream_data: dict[str, Any], provider: str = "aes67") -> list[dict[str, Any]]:
    """
    Add a new stream to the configuration and start it if enabled.

    Args:
        stream_data: Stream configuration to add
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of all streams
    """
    logger.info(f"CORE: Adding new stream for provider '{provider}'...")

    # Set defaults
    if "enabled" not in stream_data:
        stream_data["enabled"] = True
    if not stream_data.get("id"):
        stream_data["id"] = f"s-{uuid.uuid4().hex[:8]}"

    # Supervisor config will be created by _sync_stream_to_gstreamer
    # which calls AES67Stream.start() -> _create_supervisor_config()
    _sync_stream_to_gstreamer(stream_data)

    # Return updated list of all streams
    return get_all_streams(provider)


def update_stream(stream_id: str, stream_update: dict[str, Any], provider: str = "aes67") -> list[dict[str, Any]]:
    """
    Update an existing stream by ID and restart it with new configuration.

    Args:
        stream_id: The stream ID to update
        stream_update: Partial or complete stream configuration to merge
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of all streams

    Raises:
        ValueError: If stream_id is not found
    """
    logger.info(f"CORE: Updating stream '{stream_id}' for provider '{provider}'...")

    # Read existing config
    existing = get_stream_by_id(stream_id, provider)
    if not existing:
        raise ValueError(f"Stream {stream_id} not found")

    # Merge with updates
    merged = {**existing, **stream_update}
    if "enabled" not in merged:
        merged["enabled"] = True

    # Ensure ID is preserved
    merged["id"] = stream_id

    # Sync to GStreamer (will recreate supervisor config with new settings)
    _sync_stream_to_gstreamer(merged)

    return get_all_streams(provider)


def delete_stream(stream_id: str, provider: str = "aes67") -> list[dict[str, Any]]:
    """
    Delete a stream by ID, stop its GStreamer pipeline, and remove config file.

    Args:
        stream_id: The stream ID to delete
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of remaining streams

    Raises:
        ValueError: If stream_id is not found
    """
    logger.info(f"CORE: Deleting stream '{stream_id}' for provider '{provider}'...")

    # Verify stream exists
    existing = get_stream_by_id(stream_id, provider)
    if not existing:
        raise ValueError(f"Stream {stream_id} not found")

    # Stop the GStreamer stream (this will set autostart=false but keep file)
    manager = get_gstreamer_manager()
    manager.stop_stream(stream_id)

    # Now actually delete the config file
    conf_path = os.path.join(AES67Stream.SUPERVISOR_CONF_DIR, f"stagepi-stream-{stream_id}.conf")
    if os.path.exists(conf_path):
        subprocess.run(["sudo", "rm", conf_path], check=True)
        logger.info(f"Deleted supervisor config: {conf_path}")

    return get_all_streams(provider)


def replace_all_streams(streams: list[dict[str, Any]], provider: str = "aes67") -> list[dict[str, Any]]:
    """
    Replace all streams with a new list and synchronize supervisor configs.

    Args:
        streams: New list of stream configurations
        provider: The stream provider name (default: 'aes67')

    Returns:
        The new list of streams (after normalization)
    """
    logger.info(f"CORE: Replacing all streams for provider '{provider}' with {len(streams)} new streams...")

    # Ensure enabled and generate id for each stream
    for s in streams:
        if "enabled" not in s:
            s["enabled"] = True
        if not s.get("id"):
            s["id"] = f"s-{uuid.uuid4().hex[:8]}"

    # Get current stream IDs from supervisor configs
    current_ids = set(_list_all_supervisor_configs())
    new_ids = {str(s.get("id")) for s in streams}

    # Delete configs for streams not in new list
    for stream_id in current_ids - new_ids:
        logger.info(f"Removing stream not in new list: {stream_id}")
        try:
            delete_stream(stream_id, provider)
        except Exception as e:
            logger.error(f"Error removing stream {stream_id}: {e}")

    # Synchronize all streams to GStreamer (creates/updates configs)
    _sync_all_streams_to_gstreamer(provider)

    return streams


def initialize_streams(provider: str = "aes67"):
    """
    Initialize and start all enabled streams from supervisor configs.
    Call this on application startup.

    Args:
        provider: The stream provider name (default: 'aes67')
    """
    logger.info(f"Initializing streams for provider '{provider}'...")

    _sync_all_streams_to_gstreamer(provider, save_failures=True)
    logger.info("Stream initialization complete.")
