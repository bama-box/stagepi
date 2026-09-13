from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch
from api.ptp_routes import router

app = FastAPI()
app.include_router(router, prefix="/api/ptp")
client = TestClient(app)


def test_get_ptp_status_route():
    mock_status = {
        "installed": True,
        "service_active": True,
        "lock_status": "locked",
        "profile": "ravenna",
        "domain": 0,
        "master_offset_us": 0.42,
    }
    with patch("core.ptp_manager.get_ptp_status", return_value=mock_status):
        response = client.get("/api/ptp/status")
        assert response.status_code == 200
        data = response.json()
        assert data["lock_status"] == "locked"
        assert data["profile"] == "ravenna"


def test_get_ptp_profiles_route():
    mock_profiles = [{"id": "ravenna", "name": "RAVENNA PTP Profile", "domain": 0}]
    with patch("core.ptp_manager.get_available_profiles", return_value=mock_profiles):
        response = client.get("/api/ptp/profiles")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "ravenna"


def test_apply_ptp_profile_route():
    with patch("core.ptp_manager.apply_ptp_profile", return_value=True), \
         patch("core.ptp_manager.get_ptp_status", return_value={"profile": "ravenna"}):
        response = client.put("/api/ptp/profile", json={"profile_id": "ravenna", "domain": 0})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
