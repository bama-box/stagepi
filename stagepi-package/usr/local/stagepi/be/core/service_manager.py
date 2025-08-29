# core/service_manager.py

# This dictionary simulates the state of our services.
# In a real app, you would use systemd/systemctl to check and manage services.
_services = {
    "bluetooth": {"description": "Manages the Bluetooth radio.", "enabled": True},
    "a2dp": {"description": "Enables high-quality audio streaming (A2DP Sink).", "enabled": True},
    "airplay": {"description": "Enables the AirPlay audio streaming service.", "enabled": False},
    "aes": {"description": "Enables AES67 audio over IP streaming.", "enabled": True},
}

def get_all_services():
    print("CORE: Getting all services...")
    # Format the response to match the API spec
    return [
        {"name": name, **details} for name, details in _services.items()
    ]

def get_service_by_name(name: str):
    print(f"CORE: Getting service '{name}'...")
    if name in _services:
        return {"name": name, **_services[name]}
    return None

def update_service_status(name: str, enabled: bool):
    print(f"CORE: Setting service '{name}' to enabled={enabled}...")
    if name in _services:
        # TODO: Add systemctl enable/disable logic here
        _services[name]["enabled"] = enabled
        return {"name": name, **_services[name]}
    return None