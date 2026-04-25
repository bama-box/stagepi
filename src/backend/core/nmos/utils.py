
import time
import uuid
from typing import Tuple

def generate_id() -> str:
    """Generate a new UUID for an NMOS resource."""
    return str(uuid.uuid4())

def get_tai_time() -> Tuple[int, int]:
    """
    Get current TAI time as (seconds, nanoseconds).
    Using system time and applying offset (approx 37 seconds for TAI-UTC).
    """
    # Current TAI-UTC offset is 37 seconds (as of Jan 2017)
    TAI_OFFSET = 37
    
    now = time.time()
    seconds = int(now) + TAI_OFFSET
    nanoseconds = int((now - int(now)) * 1e9)
    
    return (seconds, nanoseconds)

def get_version_timestamp() -> str:
    """
    Get current timestamp in format 'seconds:nanoseconds' for resource versioning.
    """
    s, ns = get_tai_time()
    return f"{s}:{ns}"
