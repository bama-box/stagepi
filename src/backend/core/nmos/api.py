
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any

from .node import get_nmos_node, NMOSNode

router = APIRouter()

def get_node():
    return get_nmos_node()

@router.get("/")
async def get_root():
    return ["v1.3"]

@router.get("/v1.3/")
async def get_version_root():
    return [
        "self/",
        "devices/",
        "senders/",
        "receivers/",
        "flows/",
        "sources/"
    ]

@router.get("/v1.3/self")
async def get_self(node: NMOSNode = Depends(get_node)):
    return node.node_resource.dict()

@router.get("/v1.3/devices")
async def get_devices(node: NMOSNode = Depends(get_node)):
    return [node.device_resource.dict()]

@router.get("/v1.3/devices/{device_id}")
async def get_device(device_id: str, node: NMOSNode = Depends(get_node)):
    if device_id == node.device_resource.id:
        return node.device_resource.dict()
    raise HTTPException(status_code=404, detail="Device not found")

@router.get("/v1.3/receivers")
async def get_receivers(node: NMOSNode = Depends(get_node)):
    return [r.dict() for r in node.receivers.values()]

@router.get("/v1.3/receivers/{receiver_id}")
async def get_receiver(receiver_id: str, node: NMOSNode = Depends(get_node)):
    if receiver_id in node.receivers:
        return node.receivers[receiver_id].dict()
    raise HTTPException(status_code=404, detail="Receiver not found")

@router.get("/v1.3/senders")
async def get_senders(node: NMOSNode = Depends(get_node)):
    return [s.dict() for s in node.senders.values()]

@router.get("/v1.3/flows")
async def get_flows(node: NMOSNode = Depends(get_node)):
    return [f.dict() for f in node.flows.values()]

@router.get("/v1.3/sources")
async def get_sources(node: NMOSNode = Depends(get_node)):
    return [s.dict() for s in node.sources.values()]
