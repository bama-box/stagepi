
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class ResourceBase(BaseModel):
    id: str
    version: str
    label: str
    description: str = ""
    tags: Dict[str, List[str]] = Field(default_factory=dict)

class Node(ResourceBase):
    href: str
    hostname: str
    api: Dict[str, Any] = Field(default_factory=dict)
    caps: Dict[str, Any] = Field(default_factory=dict)
    services: List[Dict[str, Any]] = Field(default_factory=list)
    clocks: List[Dict[str, Any]] = Field(default_factory=list)
    interfaces: List[Dict[str, Any]] = Field(default_factory=list)

class Device(ResourceBase):
    type: str = "urn:x-nmos:device:generic"
    node_id: str
    senders: List[str] = Field(default_factory=list)
    receivers: List[str] = Field(default_factory=list)
    controls: List[Dict[str, Any]] = Field(default_factory=list)

class Source(ResourceBase):
    device_id: str
    parents: List[str] = Field(default_factory=list)
    clock_name: Optional[str] = None
    format: str # urn:x-nmos:format:audio
    channels: List[Dict[str, Any]] = Field(default_factory=list)
    caps: Dict[str, Any] = Field(default_factory=dict)

class Flow(ResourceBase):
    source_id: str
    device_id: str
    parents: List[str] = Field(default_factory=list)
    format: str # urn:x-nmos:format:audio
    sample_rate: Dict[str, int] = Field(default_factory=lambda: {"numerator": 48000, "denominator": 1})
    media_type: Optional[str] = "audio/L24" # checking if L24 or L16 is correct for AES67

class Sender(ResourceBase):
    device_id: str
    flow_id: Optional[str] = None
    transport: str = "urn:x-nmos:transport:rtp.mcast"
    interface_bindings: List[str] = Field(default_factory=list)
    subscription: Dict[str, Any] = Field(default_factory=lambda: {"receiver_id": None, "active": False})

class Receiver(ResourceBase):
    device_id: str
    transport: str = "urn:x-nmos:transport:rtp.mcast"
    interface_bindings: List[str] = Field(default_factory=list)
    subscription: Dict[str, Any] = Field(default_factory=lambda: {"sender_id": None, "active": False})
    caps: Dict[str, Any] = Field(default_factory=lambda: {"media_types": ["audio/L24"]})
