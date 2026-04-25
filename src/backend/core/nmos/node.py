
import logging
import socket
import threading
import time
import requests
import uuid
from typing import Dict, Any, List, Optional

from .mdns import NMOSMDNSEngine
from .models import Node, Device, Receiver, Sender, Source, Flow
from .utils import generate_id, get_version_timestamp, get_tai_time

logger = logging.getLogger(__name__)

class NMOSNode:
    def __init__(self, host: str = "0.0.0.0", port: int = 8000):
        self.host = host
        self.port = port
        self.hostname = socket.gethostname()
        
        self.id = generate_id()
        self.running = False
        
        self.node_resource = self._create_node_resource()
        self.device_resource = self._create_device_resource()
        
        self.receivers: Dict[str, Receiver] = {}
        self.receiver_id_map: Dict[str, str] = {} # Map receiver_id -> stream_id
        self.senders: Dict[str, Sender] = {}
        self.flows: Dict[str, Flow] = {}
        self.sources: Dict[str, Source] = {}
        
        self.mdns = NMOSMDNSEngine(self.id, self.hostname, self.port, self._on_registry_change)
        self.registry_url = None
        self.heartbeat_thread = None

    def _create_node_resource(self) -> Node:
        return Node(
            id=self.id,
            version=get_version_timestamp(),
            label=f"StagePi-{self.hostname}",
            description="StagePi Node",
            href=f"http://{self.hostname}:{self.port}/",
            hostname=self.hostname,
            api={
                "versions": ["v1.3"],
                "endpoints": [
                    {"host": self.hostname, "port": self.port, "protocol": "http"}
                ]
            }
        )

    def _create_device_resource(self) -> Device:
         return Device(
            id=generate_id(),
            version=get_version_timestamp(),
            label="StagePi Audio Engine",
            node_id=self.id,
            type="urn:x-nmos:device:generic",
            controls=[
                 {"type": "urn:x-nmos:control:sr-ctrl/v1.0", "href": f"http://{self.hostname}:{self.port}/x-nmos/connection/v1.0/"}
            ]
        )

    def start(self):
        """Start the NMOS Node."""
        self.running = True
        logger.info(f"Starting NMOS Node {self.id}")
        self.mdns.start()
        
        # Start heartbeat thread
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

    def stop(self):
        """Stop the NMOS Node."""
        self.running = False
        self.mdns.stop()
        if self.heartbeat_thread:
            self.heartbeat_thread.join(timeout=1.0)
        logger.info("NMOS Node stopped")

    def _on_registry_change(self, action, info):
        """Callback when mDNS finds/loses a registry."""
        if action == "add":
            # Just take the first one for now
            address = info.parsed_addresses()[0]
            self.registry_url = f"http://{address}:{info.port}/x-nmos/registration/v1.3/"
            logger.info(f"Selected Registry: {self.registry_url}")
            self._register_all()
        elif action == "remove":
            # Simple logic: if we lost our current one, reset
            # Real implementation needs better management of multiple registries
            self.registry_url = None

    def _register_resource(self, resource_type: str, data: dict):
        if not self.registry_url:
            return
        
        try:
            url = f"{self.registry_url}resource"
            payload = {"type": resource_type, "data": data}
            response = requests.post(url, json=payload, timeout=2)
            if response.status_code in [200, 201]:
                logger.debug(f"Registered {resource_type} {data['id']}")
            else:
                logger.warning(f"Failed to register {resource_type}: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"Error registering {resource_type}: {e}")

    def _register_all(self):
        """Register all resources with the registry."""
        if not self.registry_url:
            return

        logger.info("Registering all resources...")
        self._register_resource("node", self.node_resource.dict())
        self._register_resource("device", self.device_resource.dict())
        
        for r in self.receivers.values():
            self._register_resource("receiver", r.dict())
        for s in self.senders.values():
            self._register_resource("sender", s.dict())
        # Also sources and flows if we had them

    def _heartbeat_loop(self):
        """Send periodic heartbeats to the registry."""
        while self.running:
            if self.registry_url:
                try:
                    url = f"{self.registry_url}health/nodes/{self.id}"
                    requests.post(url, timeout=2)
                except Exception as e:
                    logger.debug(f"Heartbeat failed: {e}")
            
            time.sleep(5)

    def add_receiver(self, stream_config: dict):
        """Add a receiver resource based on stream config.
        
        Args:
           stream_config: Dictionary with stream configuration (id, loopback, etc.)
        """
        # Generate a deterministic ID based on the stream ID to avoid duplicates on restart
        # In a real scenario we'd want to persist these IDs.
        # For now, we use a namespaced UUID based on the stream ID.
        receiver_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"stagepi-receiver-{stream_config.get('id')}"))
        
        receiver = Receiver(
            id=receiver_id,
            version=get_version_timestamp(),
            label=stream_config.get("id", "Unknown Stream"),
            description="AES67 Receiver",
            device_id=self.device_resource.id,
            transport="urn:x-nmos:transport:rtp.mcast",
            interface_bindings=["eth0"], # TODO: Get real interface
            caps={"media_types": ["audio/L24", "audio/L16"]}
        )
        self.receivers[receiver_id] = receiver
        self.receiver_id_map[receiver_id] = stream_config.get("id")
        if receiver_id not in self.device_resource.receivers:
            self.device_resource.receivers.append(receiver_id)
        
        # If we are already connected to a registry, register this new resource
        self._register_resource("receiver", receiver.dict())
        
        logger.info(f"Added Receiver {receiver_id} for stream {stream_config.get('id')}")

    def get_stream_id_for_receiver(self, receiver_id: str) -> Optional[str]:
        return self.receiver_id_map.get(receiver_id)

    def update_sender(self, id, data):
        # Placeholder for sender updates
        pass

# Global Singleton
_nmos_node: Optional[NMOSNode] = None

def get_nmos_node() -> NMOSNode:
    global _nmos_node
    if _nmos_node is None:
        _nmos_node = NMOSNode()
    return _nmos_node

