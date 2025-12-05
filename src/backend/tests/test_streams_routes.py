"""
Unit tests for streams API routes.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path to import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from core import stream_manager


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_gstreamer():
    """Mock GStreamer components to avoid actual stream creation during tests."""
    with patch('core.stream_manager.get_gstreamer_manager') as mock_manager:
        mock_instance = MagicMock()
        mock_instance.streams = {}
        mock_instance.get_stream_status.return_value = None
        mock_instance.get_all_streams_status.return_value = {}
        mock_manager.return_value = mock_instance
        yield mock_instance


@pytest.fixture(autouse=True)
def mock_stream_file(tmp_path):
    """Mock the stream configuration file."""
    test_config_path = tmp_path / "aes67.json"

    with patch('core.stream_manager._provider_json_path') as mock_path:
        mock_path.return_value = str(test_config_path)
        yield test_config_path


class TestStreamsAPI:
    """Test cases for streams API endpoints."""

    def test_list_streams_empty(self, client, mock_stream_file):
        """Test listing streams when no streams exist."""
        # Initialize empty file
        mock_stream_file.write_text('{"streams": []}')

        response = client.get("/streams")
        assert response.status_code == 200
        data = response.json()
        assert 'streams' in data
        assert data['streams'] == []

    def test_add_stream(self, client, mock_stream_file):
        """Test adding a new stream."""
        # Initialize empty file
        mock_stream_file.write_text('{"streams": []}')

        new_stream = {
            "kind": "sender",
            "ip": "239.69.0.1",
            "port": 5004,
            "device": "hw:0,0",
            "iface": "eth0",
            "channels": 2,
            "format": "S24BE",
            "enabled": True
        }

        response = client.post("/streams", json=new_stream)
        assert response.status_code == 200
        data = response.json()
        assert 'streams' in data
        assert len(data['streams']) == 1
        assert data['streams'][0]['kind'] == 'sender'
        assert data['streams'][0]['format'] == 'S24BE'
        assert 'id' in data['streams'][0]

    def test_add_stream_with_custom_format(self, client, mock_stream_file):
        """Test adding a stream with custom audio format."""
        mock_stream_file.write_text('{"streams": []}')

        new_stream = {
            "kind": "sender",
            "ip": "239.69.0.2",
            "port": 5006,
            "device": "hw:1,0",
            "iface": "eth0",
            "channels": 2,
            "format": "S16LE",
            "enabled": True
        }

        response = client.post("/streams", json=new_stream)
        assert response.status_code == 200
        data = response.json()
        assert len(data['streams']) == 1
        assert data['streams'][0]['format'] == 'S16LE'

    def test_update_stream(self, client, mock_stream_file):
        """Test updating an existing stream."""
        # Create initial stream
        initial_streams = {
            "streams": [{
                "id": "test-stream-1",
                "kind": "sender",
                "ip": "239.69.0.1",
                "port": 5004,
                "device": "hw:0,0",
                "iface": "eth0",
                "channels": 2,
                "format": "S24BE",
                "enabled": True
            }]
        }
        import json
        mock_stream_file.write_text(json.dumps(initial_streams))

        # Update the stream
        update_data = {
            "format": "S32LE",
            "channels": 8
        }

        response = client.patch("/streams/test-stream-1", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data['streams'][0]['format'] == 'S32LE'
        assert data['streams'][0]['channels'] == 8
        assert data['streams'][0]['ip'] == "239.69.0.1"  # Unchanged fields remain

    def test_update_nonexistent_stream(self, client, mock_stream_file):
        """Test updating a stream that doesn't exist."""
        mock_stream_file.write_text('{"streams": []}')

        update_data = {"format": "S16LE"}
        response = client.patch("/streams/nonexistent-id", json=update_data)
        assert response.status_code == 404

    def test_delete_stream(self, client, mock_stream_file):
        """Test deleting a stream."""
        import json
        initial_streams = {
            "streams": [{
                "id": "test-stream-1",
                "kind": "sender",
                "ip": "239.69.0.1",
                "port": 5004,
                "device": "hw:0,0",
                "iface": "eth0",
                "format": "S24BE"
            }]
        }
        mock_stream_file.write_text(json.dumps(initial_streams))

        response = client.delete("/streams/test-stream-1")
        assert response.status_code == 200
        data = response.json()
        assert len(data['streams']) == 0

    def test_delete_nonexistent_stream(self, client, mock_stream_file):
        """Test deleting a stream that doesn't exist."""
        mock_stream_file.write_text('{"streams": []}')

        response = client.delete("/streams/nonexistent-id")
        assert response.status_code == 404

    def test_replace_all_streams(self, client, mock_stream_file):
        """Test replacing all streams."""
        mock_stream_file.write_text('{"streams": []}')

        new_streams = {
            "streams": [
                {
                    "kind": "sender",
                    "ip": "239.69.0.1",
                    "port": 5004,
                    "device": "hw:0,0",
                    "iface": "eth0",
                    "format": "S24BE"
                },
                {
                    "kind": "receiver",
                    "ip": "239.69.0.2",
                    "port": 5006,
                    "device": "hw:1,0",
                    "iface": "eth0",
                    "format": "S16LE"
                }
            ]
        }

        response = client.put("/streams", json=new_streams)
        assert response.status_code == 200
        data = response.json()
        assert len(data['streams']) == 2
        assert data['streams'][0]['format'] == 'S24BE'
        assert data['streams'][1]['format'] == 'S16LE'

    def test_get_streams_status(self, client, mock_gstreamer):
        """Test getting status of all streams."""
        mock_gstreamer.get_all_streams_status.return_value = {
            'stream-1': {
                'state': 'PLAYING',
                'running': True
            }
        }

        response = client.get("/streams/status")
        assert response.status_code == 200
        data = response.json()
        assert 'running_count' in data
        assert 'total_streams' in data
        assert 'streams' in data

    def test_get_stream_status(self, client, mock_gstreamer):
        """Test getting status of a specific stream."""
        mock_gstreamer.get_stream_status.return_value = {
            'state': 'PLAYING',
            'running': True,
            'config': {
                'format': 'S24BE'
            }
        }

        response = client.get("/streams/stream-1/status")
        assert response.status_code == 200
        data = response.json()
        assert data['state'] == 'PLAYING'
        assert data['running'] is True
        assert data['config']['format'] == 'S24BE'

    def test_get_stream_status_not_found(self, client, mock_gstreamer):
        """Test getting status of a stream that doesn't exist."""
        mock_gstreamer.get_stream_status.return_value = None

        response = client.get("/streams/nonexistent/status")
        assert response.status_code == 404

    def test_get_startup_failures(self, client):
        """Test getting startup failures."""
        response = client.get("/streams/startup-failures")
        assert response.status_code == 200
        data = response.json()
        assert 'failed_count' in data
        assert 'failures' in data
        assert isinstance(data['failures'], list)


class TestStreamModel:
    """Test StreamModel validation."""

    def test_stream_model_defaults(self):
        """Test that StreamModel has correct defaults."""
        from api.streams_routes import StreamModel

        model = StreamModel()
        assert model.channels == 2
        assert model.loopback is False
        assert model.buffer_time == 100000
        assert model.latency_time == 5000000
        assert model.sync is False
        assert model.enabled is True
        assert model.format == 'S24BE'

    def test_stream_model_custom_format(self):
        """Test StreamModel with custom format."""
        from api.streams_routes import StreamModel

        model = StreamModel(
            kind="sender",
            ip="239.69.0.1",
            format="S16LE"
        )
        assert model.format == 'S16LE'
        assert model.kind == 'sender'
