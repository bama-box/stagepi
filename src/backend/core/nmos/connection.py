
import logging
import re
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Body, Request
from pydantic import BaseModel

from .node import get_nmos_node, NMOSNode
from ..stream_manager import get_stream_manager, StreamConfig

logger = logging.getLogger(__name__)

router = APIRouter()

def get_node():
    return get_nmos_node()

# --- IS-05 Models ---

class Activation(BaseModel):
    mode: str = "activate_immediate"
    requested_time: Optional[str] = None

class TransportFile(BaseModel):
    data: str
    type: str

class SenderId(BaseModel):
    sender_id: Optional[str] = None

class StagedPatch(BaseModel):
    master_enable: Optional[bool] = None
    activation: Optional[Activation] = None
    transport_file: Optional[TransportFile] = None
    sender_id: Optional[str] = None

# --- Helpers ---

def parse_sdp(sdp_data: str) -> Dict[str, Any]:
    """Simple SDP parser to extract multicast IP and Port."""
    info = {"ip": None, "port": None}
    
    # Simple regex for c=IN IP4 <ip>
    # c=IN IP4 239.1.2.3
    ip_match = re.search(r"^c=IN IP4 ([\d\.]+)", sdp_data, re.MULTILINE)
    if ip_match:
        info["ip"] = ip_match.group(1)
        
    # m=audio <port> RTP/AVP ...
    # m=audio 5004 RTP/AVP 96
    port_match = re.search(r"^m=audio (\d+) ", sdp_data, re.MULTILINE)
    if port_match:
        info["port"] = int(port_match.group(1))
        
    return info

# --- Routes ---

@router.get("/")
async def get_root():
    return ["single/", "bulk/"]

@router.get("/single/")
async def get_single_root():
    return ["receivers/", "senders/"]

@router.get("/single/receivers/{receiver_id}/staged")
async def get_receiver_staged(receiver_id: str, node: NMOSNode = Depends(get_node)):
    if receiver_id not in node.receivers:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    # Return current staged params (essentially we just mirror active for now as we don't support delayed activation)
    rx = node.receivers[receiver_id]
    return {
        "master_enable": rx.subscription.get("active", False),
        "sender_id": rx.subscription.get("sender_id"),
        "transport_file": {"data": "", "type": "application/sdp"}, # TODO: Generate SDP from current config
        "transport_params": [] 
    }

@router.patch("/single/receivers/{receiver_id}/staged")
async def patch_receiver_staged(
    receiver_id: str, 
    patch: Dict[str, Any] = Body(...), 
    node: NMOSNode = Depends(get_node)
):
    if receiver_id not in node.receivers:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    stream_id = node.get_stream_id_for_receiver(receiver_id)
    if not stream_id:
        raise HTTPException(status_code=500, detail="Internal stream mapping error")

    logger.info(f"IS-05 PATCH for Receiver {receiver_id} (Stream {stream_id}): {patch}")
    
    # 1. Update Parameters (Staging)
    updates = {}
    
    if "deployment" in patch: # Legacy/Simplified check? Spec uses top level keys.
        pass
        
    # Check transport file (SDP)
    if "transport_file" in patch and patch["transport_file"].get("data"):
         sdp_info = parse_sdp(patch["transport_file"]["data"])
         if sdp_info["ip"] and sdp_info["port"]:
             updates["ip"] = sdp_info["ip"]
             updates["port"] = int(sdp_info["port"])
             updates["kind"] = "receiver" # Ensure it stays receiver
             
    if "sender_id" in patch:
        node.receivers[receiver_id].subscription["sender_id"] = patch["sender_id"]

    if "master_enable" in patch:
        updates["enabled"] = patch["master_enable"]
        node.receivers[receiver_id].subscription["active"] = patch["master_enable"]

    # 2. handle Activation
    activation = patch.get("activation", {})
    if activation.get("mode") == "activate_immediate" and updates:
        
        sm = get_stream_manager()
        
        # Get current config to merge
        current_status = sm.get_stream_status(stream_id)
        current_config = {}
        if current_status and "config" in current_status:
           current_config = current_status["config"]
        
        # Merge updates
        new_config_dict = current_config.copy()
        new_config_dict.update(updates)
        new_config_dict["id"] = stream_id # Ensure ID is preserved
        
        logger.info(f"Applying IS-05 activation for {stream_id}: {updates}")
        
        try:
            # We need to construct a StreamConfig object manually because the dict might be partial
            # or we rely on _dict_to_stream_config from stream_manager.
            # But _dict_to_stream_config is internal. 
            # Ideally stream_manager should expose a way to update stream.
            
            # Re-creating the stream via public API of SupervisorStreamManager
            from ..stream_manager import StreamConfig
            
            # Fill defaults if missing from current_config (e.g. if stream was never started)
            if "channels" not in new_config_dict: new_config_dict["channels"] = 2
            if "device" not in new_config_dict: new_config_dict["device"] = "default"
            if "iface" not in new_config_dict: new_config_dict["iface"] = "eth0"
            if "kind" not in new_config_dict: new_config_dict["kind"] = "receiver"

            # Create StreamConfig
            conf = StreamConfig(
                stream_id=str(new_config_dict.get("id")),
                kind=str(new_config_dict.get("kind")),
                ip=str(new_config_dict.get("ip")),
                port=int(new_config_dict.get("port")),
                device=str(new_config_dict.get("device")),
                iface=str(new_config_dict.get("iface")),
                channels=int(new_config_dict.get("channels")),
                loopback=bool(new_config_dict.get("loopback", False)),
                sync=bool(new_config_dict.get("sync", False)),
                format=str(new_config_dict.get("format", "S24BE"))
            )
            
            # Apply
            # If enabled is False, we just create config but don't start?
            # stream_manager.create_stream() auto-starts it.
            # stream_manager needs a way to separate create vs start or we handle it here.
            
            if new_config_dict.get("enabled", True):
                 sm.create_stream(conf)
            else:
                 sm.stop_stream(stream_id)
                 # Re-create config but don't start? 
                 # Existing stream_manager.create_stream() calls start() immediately.
                 # We might need to modify stream_manager if we want to support "configured but stopped"
                 # properly, but for now stop_stream() is effectively master_enable=False.
            
        except Exception as e:
            logger.error(f"Failed to activate stream {stream_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to activate stream: {str(e)}")
            
    return {
        "master_enable": node.receivers[receiver_id].subscription.get("active"),
        "sender_id": node.receivers[receiver_id].subscription.get("sender_id"),
        "activation": {}, # Cleared after immediate activation
    }
    
@router.get("/single/receivers/{receiver_id}/active")
async def get_receiver_active(receiver_id: str, node: NMOSNode = Depends(get_node)):
    # Same as staged for now
    return await get_receiver_staged(receiver_id, node)
