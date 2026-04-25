
import logging
import socket
import threading
from typing import Callable, Optional
from zeroconf import ServiceInfo, Zeroconf, ServiceBrowser, ServiceStateChange

logger = logging.getLogger(__name__)

class NMOSMDNSEngine:
    def __init__(self, node_id: str, hostname: str, port: int, callback: Optional[Callable] = None):
        self.node_id = node_id
        self.hostname = hostname
        self.port = port
        self.callback = callback  # Callback when registry is found/lost
        self.zeroconf = Zeroconf()
        self.browser = None
        self._registry_services = {}

    def start(self):
        """Start mDNS advertisement and discovery."""
        self._register_service()
        self._start_browsing()

    def stop(self):
        """Stop mDNS advertisement and discovery."""
        if self.browser:
            self.browser.cancel()
            self.browser = None
        self.zeroconf.unregister_all_services()
        self.zeroconf.close()

    def _register_service(self):
        """Advertise this Node via mDNS."""
        desc = {
            "api_proto": "http",
            "api_ver": "v1.3",
            "api_auth": "false",
            "pri": "100"
        }
        
        # Service type for NMOS Node
        type_ = "_nmos-node._tcp.local."
        name = f"{self.hostname}._nmos-node._tcp.local."
        
        # Get local IP
        try:
            local_ip = socket.gethostbyname(self.hostname)
        except Exception:
             local_ip = "127.0.0.1"

        info = ServiceInfo(
            type_,
            name,
            addresses=[socket.inet_aton(local_ip)],
            port=self.port,
            properties=desc,
            server=f"{self.hostname}.local.",
        )
        
        try:
            self.zeroconf.register_service(info)
            logger.info(f"Registered mDNS service: {name}")
        except Exception as e:
            logger.error(f"Failed to register mDNS service: {e}")

    def _start_browsing(self):
        """Browse for NMOS Registration API."""
        type_ = "_nmos-registration._tcp.local."
        self.browser = ServiceBrowser(self.zeroconf, type_, handlers=[self._on_service_state_change])

    def _on_service_state_change(self, zeroconf, service_type, name, state_change):
        if state_change is ServiceStateChange.Added:
            info = zeroconf.get_service_info(service_type, name)
            if info:
                self._registry_services[name] = info
                logger.info(f"Found NMOS Registry: {name} at {info.parsed_addresses()[0]}:{info.port}")
                if self.callback:
                    self.callback("add", info)
        
        elif state_change is ServiceStateChange.Removed:
            if name in self._registry_services:
                del self._registry_services[name]
                logger.info(f"Lost NMOS Registry: {name}")
                if self.callback:
                    self.callback("remove", name)
