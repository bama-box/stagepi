
import sys
import os
import logging

# Add src/backend to path
sys.path.append("/home/shai/devel/stagepi/src/backend")

logging.basicConfig(level=logging.INFO)

try:
    print("Importing main...")
    from main import app
    print("Main imported successfully.")
    
    print("Checking routes...")
    routes = [route.path for route in app.routes]
    expected_routes = [
        "/x-nmos/node/v1.3/self",
        "/x-nmos/node/v1.3/devices",
        "/x-nmos/node/v1.3/receivers",
        "/x-nmos/connection/single/receivers/{receiver_id}/staged"
    ]
    
    for expected in expected_routes:
        if expected in routes:
            print(f"Verified route: {expected}")
        else:
            print(f"WARNING: Route not found: {expected}")
            # Note: FastAPI routes might strictly match so trailing slashes matter or path params might look different in route.path
            # Let's verify by partial match
            found = any(expected in r for r in routes)
            if found:
                 print(f"Verified route (partial): {expected}")
            else:
                 print(f"ERROR: Route definitely missing: {expected}")

    print("Verification complete.")
    
except Exception as e:
    print(f"Verification FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
