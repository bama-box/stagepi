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

import json
import logging

# core/stream_manager.py
import os
import threading
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

# GStreamer Imports
import gi

gi.require_version("Gst", "1.0")
gi.require_version("GLib", "2.0")
from gi.repository import GLib, Gst  # noqa: E402

# Initialize GStreamer immediately
Gst.init(None)

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


class AES67Stream:
    def __init__(self, config: StreamConfig):
        self.config = config
        self.pipeline: Optional[Gst.Pipeline] = None
        self.bus_id = None
        self.pipeline_str = self._build_pipeline_string()

    def _build_pipeline_string(self) -> str:
        c = self.config

        if c.kind == "sender":
            # - Configurable audio format (S16LE, S24LE, S24BE, S32LE, etc.)
            # - audioresample included
            # - sync=false (as requested)
            # - buffer-time=100 / latency-time=5000
            return (
                f"alsasrc device={c.device} buffer-time={c.buffer_time} latency-time={c.latency_time} ! "
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
                f"alsasink device={c.device}"
            )

        else:
            raise ValueError(f"Unknown stream kind: {c.kind}")

    def start(self):
        try:
            logger.info(
                f"Launching Stream {self.config.stream_id} ({self.config.kind})..."
            )
            logger.info(f"Pipeline string: {self.pipeline_str}")
            self.pipeline = Gst.parse_launch(self.pipeline_str)

            # --- CRITICAL: AES67 CLOCKING STRATEGY ---
            system_clock = Gst.SystemClock.obtain()
            self.pipeline.use_clock(system_clock)
            self.pipeline.set_start_time(Gst.CLOCK_TIME_NONE)
            # ------------------------------------------

            # Bus Watch for Errors
            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            self.bus_id = bus.connect("message", self._on_bus_message)

            # Start Playing
            ret = self.pipeline.set_state(Gst.State.PLAYING)
            if ret == Gst.StateChangeReturn.FAILURE:
                # Try to get error message from bus
                error_msg = self._get_bus_error()
                if error_msg:
                    raise RuntimeError(f"{error_msg}")
                else:
                    raise RuntimeError(
                        f"Failed to start pipeline on device: {self.config.device}"
                    )

            # Wait for state change to complete and check for errors
            # This is critical to catch async errors like "device busy"
            import time

            timeout = 2.0  # seconds
            start_time = time.time()

            while time.time() - start_time < timeout:
                # Check for errors on the bus
                error_msg = self._get_bus_error()
                if error_msg:
                    raise RuntimeError(f"{error_msg}")

                # Check if we've reached PLAYING state
                ret, state, pending = self.pipeline.get_state(
                    timeout=100000000
                )  # 100ms in nanoseconds
                if state == Gst.State.PLAYING:
                    logger.info(f"Stream {self.config.stream_id} is RUNNING.")
                    return

                # Small sleep to avoid busy waiting
                time.sleep(0.05)

            # If we get here, timeout occurred
            error_msg = self._get_bus_error()
            if error_msg:
                raise RuntimeError(f"{error_msg}")
            else:
                raise RuntimeError(
                    f"Timeout waiting for stream to start (current state: {state})"
                )

        except Exception as e:
            logger.error(f"Failed to start {self.config.stream_id}: {e}")
            self.stop()
            # Re-raise the exception so the caller knows it failed
            raise

    def _get_bus_error(self) -> Optional[str]:
        """Check the bus for error messages and return the error string."""
        if not self.pipeline:
            return None

        bus = self.pipeline.get_bus()
        msg = bus.pop_filtered(Gst.MessageType.ERROR)
        if msg:
            err, debug = msg.parse_error()

            # Extract the meaningful part of the error message
            error_text = err.message

            # Common error mappings to user-friendly messages
            if "device is being used by another application" in error_text.lower():
                return (
                    f"Audio device '{self.config.device}' is currently in use "
                    "by another application"
                )
            elif "could not open audio device" in error_text.lower():
                return (
                    f"Could not open audio device '{self.config.device}'. "
                    "Check if device exists and permissions are correct"
                )
            elif (
                "no such device" in error_text.lower()
                or "no such file" in error_text.lower()
            ):
                return (
                    f"Audio device '{self.config.device}' not found. "
                    "Use 'arecord -l' or 'aplay -l' to list available devices"
                )
            elif "not-negotiated" in str(debug).lower():
                return (
                    f"Audio format negotiation failed on device '{self.config.device}'. "
                    f"Device may not support the requested format "
                    f"({self.config.format}, 48kHz, {self.config.channels} channels)"
                )

            # Return original error with debug info if available
            if debug and len(debug) < 200:
                return f"{error_text}: {debug}"
            else:
                return error_text

        return None

    def stop(self):
        if self.pipeline:
            logger.info(f"Stopping Stream {self.config.stream_id}...")
            try:
                self.pipeline.set_state(Gst.State.NULL)

                # Clean up bus signal to prevent memory leaks
                bus = self.pipeline.get_bus()
                if self.bus_id:
                    bus.disconnect(self.bus_id)
                bus.remove_signal_watch()
            except Exception as e:
                logger.error(f"Error during stream cleanup: {e}")
            finally:
                self.pipeline = None
                logger.info(f"Stream {self.config.stream_id} STOPPED.")

    def get_state(self) -> Dict[str, Any]:
        """Get the current state of the GStreamer pipeline."""
        if not self.pipeline:
            return {"state": "NULL", "pending": "NULL", "running": False}

        # Get current and pending state
        ret, state, pending = self.pipeline.get_state(timeout=0)

        state_names = {
            Gst.State.VOID_PENDING: "VOID_PENDING",
            Gst.State.NULL: "NULL",
            Gst.State.READY: "READY",
            Gst.State.PAUSED: "PAUSED",
            Gst.State.PLAYING: "PLAYING",
        }

        return {
            "state": state_names.get(state, "UNKNOWN"),
            "pending": state_names.get(pending, "UNKNOWN"),
            "running": state == Gst.State.PLAYING,
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

    def _on_bus_message(self, bus, message):
        """Handle internal GStreamer events (Errors, EOS, Stats)"""
        t = message.type
        if t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            logger.error(f"STREAM ERROR [{self.config.stream_id}]: {err} | {debug}")
            self.stop()
        elif t == Gst.MessageType.WARNING:
            err, debug = message.parse_warning()
            logger.warning(f"Stream Warning [{self.config.stream_id}]: {err}")


class GStreamerStreamManager:
    """
    Manages the lifecycle of active GStreamer-based AES67 streams.
    """

    def __init__(self):
        self.streams: Dict[str, AES67Stream] = {}
        self._running = True

        # GStreamer requires a GLib MainLoop to process bus messages properly.
        self.loop = GLib.MainLoop()
        self.loop_thread = threading.Thread(
            target=self._run_loop, daemon=True, name="GMainLoop"
        )
        self.loop_thread.start()
        logger.info("GStreamerStreamManager initialized. MainLoop running.")

    def _run_loop(self):
        """The GLib Main Loop runner."""
        try:
            self.loop.run()
        except Exception as e:
            logger.error(f"GLib MainLoop crashed: {e}")

    def create_stream(self, config: StreamConfig):
        """Creates and starts a new AES67 stream."""
        if config.stream_id in self.streams:
            logger.warning(
                f"Stream {config.stream_id} already exists. Stopping old one."
            )
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

    def get_stream_status(self, stream_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed status of a specific stream."""
        if stream_id in self.streams:
            return self.streams[stream_id].get_state()
        return None

    def get_all_streams_status(self) -> Dict[str, Dict[str, Any]]:
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
        self.loop.quit()


# Global GStreamer Stream Manager instance
_gstreamer_manager: Optional[GStreamerStreamManager] = None
_startup_failed_streams: List[Dict[str, Any]] = []


def get_gstreamer_manager() -> GStreamerStreamManager:
    """Get or create the global GStreamer stream manager instance."""
    global _gstreamer_manager
    if _gstreamer_manager is None:
        _gstreamer_manager = GStreamerStreamManager()
    return _gstreamer_manager


def shutdown_gstreamer_manager():
    """Shutdown the global GStreamer stream manager."""
    global _gstreamer_manager
    if _gstreamer_manager is not None:
        _gstreamer_manager.stop_all()
        _gstreamer_manager = None


def get_startup_failed_streams() -> List[Dict[str, Any]]:
    """Get the list of streams that failed to start during application startup."""
    global _startup_failed_streams
    return _startup_failed_streams.copy()


# ==========================================
# Stream Configuration Management
# ==========================================


# Map provider name -> JSON config path.
_provider_config_map = {
    "aes67": "/usr/local/stagepi/etc/aes67.json",
}


def _provider_json_path(provider: str) -> str:
    """Return the configured JSON path for the provider."""
    return _provider_config_map.get(provider, f"/usr/local/stagepi/etc/{provider}.json")


def _json_to_stream_config(stream_data: Dict[str, Any]) -> Optional[StreamConfig]:
    """
    Convert JSON stream configuration to StreamConfig dataclass.

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


def _sync_stream_to_gstreamer(stream_data: Dict[str, Any]):
    """
    Synchronize a stream configuration to the GStreamer manager.
    If enabled, starts the stream. If disabled, stops it.

    Args:
        stream_data: Dictionary containing stream configuration

    Raises:
        RuntimeError: If the stream fails to start (only if enabled=True)
    """
    stream_id = str(stream_data.get("id", ""))
    enabled = stream_data.get("enabled", True)

    manager = get_gstreamer_manager()

    if enabled:
        config = _json_to_stream_config(stream_data)
        if config:
            logger.info(f"Starting GStreamer stream: {stream_id}")
            try:
                manager.create_stream(config)
            except Exception as e:
                logger.error(f"Failed to start stream {stream_id}: {e}")
                # Re-raise with detailed error message
                raise RuntimeError(
                    f"Failed to start {config.kind} stream '{stream_id}' "
                    f"on device '{config.device}': {str(e)}"
                ) from e
        else:
            logger.warning(f"Cannot start stream {stream_id}: Invalid configuration")
            config_summary = {
                k: stream_data.get(k) for k in ["kind", "device", "ip", "port"]
            }
            raise ValueError(
                f"Invalid stream configuration for '{stream_id}'. "
                f"Required fields: kind, ip, port, device, iface. Got: {config_summary}"
            )
    else:
        logger.info(f"Stopping GStreamer stream: {stream_id}")
        manager.stop_stream(stream_id)


def _sync_all_streams_to_gstreamer(
    provider: str = "aes67", save_failures: bool = False
):
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
                    "config": {
                        k: stream_data.get(k)
                        for k in ["kind", "device", "ip", "port", "enabled"]
                    },
                }
            )

    # Save failures to global state if requested (during startup)
    if save_failures:
        _startup_failed_streams = failed_streams

    # Log summary of failed streams
    if failed_streams:
        logger.warning(
            f"Failed to start {len(failed_streams)} stream(s) during initialization:"
        )
        for failed in failed_streams:
            logger.warning(f"  - Stream {failed['id']}: {failed['error']}")
        logger.info(
            f"Successfully started {len(streams) - len(failed_streams)} out of {len(streams)} streams"
        )


def read_streams(provider: str = "aes67") -> Dict[str, List[Dict[str, Any]]]:
    """
    Read stream configuration from the provider's JSON file.

    Args:
        provider: The stream provider name (default: 'aes67')

    Returns:
        Dictionary with 'streams' key containing list of stream configurations
    """
    logger.info(f"CORE: Reading streams for provider '{provider}'...")
    path = _provider_json_path(provider)
    if os.path.exists(path):
        try:
            with open(path, "r") as jf:
                data = json.load(jf)
                data.setdefault("streams", [])
                # Ensure each stream has an 'enabled' field (default True)
                for s in data["streams"]:
                    if "enabled" not in s:
                        s["enabled"] = True
                return data
        except Exception as e:
            logger.error(f"Error reading stream config from {path}: {e}")
            # On error, return empty streams to avoid crashing the API.
            return {"streams": []}
    return {"streams": []}


def write_streams(streams: List[Dict[str, Any]], provider: str = "aes67") -> None:
    """
    Write stream configuration to the provider's JSON file.

    Args:
        streams: List of stream configurations to write
        provider: The stream provider name (default: 'aes67')
    """
    logger.info(f"CORE: Writing {len(streams)} streams for provider '{provider}'...")
    path = _provider_json_path(provider)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Normalize streams to include 'enabled' default True and generate id
    for i, s in enumerate(streams):
        if "enabled" not in s:
            s["enabled"] = True
        # ensure id
        if not s.get("id"):
            s["id"] = f"s-{uuid.uuid4().hex[:8]}"

    to_write = {"streams": streams}
    with open(path, "w") as jf:
        json.dump(to_write, jf, indent=2)
    logger.info(f"CORE: Successfully wrote streams to {path}")


def get_all_streams(provider: str = "aes67") -> List[Dict[str, Any]]:
    """
    Get all streams for a provider.

    Args:
        provider: The stream provider name (default: 'aes67')

    Returns:
        List of stream configurations
    """
    cfg = read_streams(provider)
    return cfg.get("streams", [])


def get_stream_by_id(
    stream_id: str, provider: str = "aes67"
) -> Optional[Dict[str, Any]]:
    """
    Get a specific stream by ID.

    Args:
        stream_id: The stream ID to find
        provider: The stream provider name (default: 'aes67')

    Returns:
        Stream configuration dict or None if not found
    """
    logger.info(f"CORE: Getting stream '{stream_id}' for provider '{provider}'...")
    streams = get_all_streams(provider)
    for i, s in enumerate(streams):
        if str(s.get("id", i)) == str(stream_id) or str(i) == str(stream_id):
            return s
    return None


def add_stream(
    stream_data: Dict[str, Any], provider: str = "aes67"
) -> List[Dict[str, Any]]:
    """
    Add a new stream to the configuration and start it if enabled.

    Args:
        stream_data: Stream configuration to add
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of all streams
    """
    logger.info(f"CORE: Adding new stream for provider '{provider}'...")
    streams = get_all_streams(provider)

    # Set defaults
    if "enabled" not in stream_data:
        stream_data["enabled"] = True
    if not stream_data.get("id"):
        stream_data["id"] = f"s-{uuid.uuid4().hex[:8]}"

    streams.append(stream_data)
    write_streams(streams, provider)

    # Start the GStreamer stream if enabled
    _sync_stream_to_gstreamer(stream_data)

    return streams


def update_stream(
    stream_id: str, stream_update: Dict[str, Any], provider: str = "aes67"
) -> List[Dict[str, Any]]:
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
    streams = get_all_streams(provider)
    found = False
    updated_stream = None

    for i, s in enumerate(streams):
        if str(s.get("id", i)) == str(stream_id) or str(i) == str(stream_id):
            merged = {**s, **stream_update}
            if "enabled" not in merged:
                merged["enabled"] = True
            # ensure id remains present
            if not merged.get("id"):
                merged["id"] = s.get("id") or f"s-{uuid.uuid4().hex[:8]}"
            streams[i] = merged
            updated_stream = merged
            found = True
            break

    if not found:
        raise ValueError(f"Stream {stream_id} not found")

    write_streams(streams, provider)

    # Restart the GStreamer stream with new configuration
    if updated_stream:
        _sync_stream_to_gstreamer(updated_stream)

    return streams


def delete_stream(stream_id: str, provider: str = "aes67") -> List[Dict[str, Any]]:
    """
    Delete a stream by ID and stop its GStreamer pipeline.

    Args:
        stream_id: The stream ID to delete
        provider: The stream provider name (default: 'aes67')

    Returns:
        Updated list of remaining streams

    Raises:
        ValueError: If stream_id is not found
    """
    logger.info(f"CORE: Deleting stream '{stream_id}' for provider '{provider}'...")
    streams = get_all_streams(provider)
    new_streams = []
    found = False
    deleted_id = None

    for i, s in enumerate(streams):
        if str(s.get("id", i)) == str(stream_id) or str(i) == str(stream_id):
            found = True
            deleted_id = str(s.get("id", stream_id))
            continue
        new_streams.append(s)

    if not found:
        raise ValueError(f"Stream {stream_id} not found")

    write_streams(new_streams, provider)

    # Stop the GStreamer stream
    if deleted_id:
        manager = get_gstreamer_manager()
        manager.stop_stream(deleted_id)

    return new_streams


def replace_all_streams(
    streams: List[Dict[str, Any]], provider: str = "aes67"
) -> List[Dict[str, Any]]:
    """
    Replace all streams with a new list and synchronize GStreamer pipelines.

    Args:
        streams: New list of stream configurations
        provider: The stream provider name (default: 'aes67')

    Returns:
        The new list of streams (after normalization)
    """
    logger.info(
        f"CORE: Replacing all streams for provider '{provider}' with {len(streams)} new streams..."
    )
    # Ensure enabled and generate id for each stream
    for s in streams:
        if "enabled" not in s:
            s["enabled"] = True
        if not s.get("id"):
            s["id"] = f"s-{uuid.uuid4().hex[:8]}"

    write_streams(streams, provider)

    # Synchronize all streams to GStreamer
    _sync_all_streams_to_gstreamer(provider)

    return streams


def initialize_streams(provider: str = "aes67"):
    """
    Initialize and start all enabled streams from configuration.
    Call this on application startup.

    Args:
        provider: The stream provider name (default: 'aes67')
    """
    logger.info(f"Initializing streams for provider '{provider}'...")
    _sync_all_streams_to_gstreamer(provider, save_failures=True)
    logger.info("Stream initialization complete.")
