import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add src/backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.stream_manager import StreamConfig, SupervisorStreamManager


class TestSupervisorStreamManager(unittest.TestCase):
    def setUp(self):
        # Reset singleton
        global _stream_manager
        # We need to reach into the module to reset the global
        import core.stream_manager as sm

        sm._stream_manager = None

        # Patch Supervisor Conf Dir
        self.patcher_dir = patch("core.stream_manager.AES67Stream.SUPERVISOR_CONF_DIR", "/tmp/stagepi-supervisor-d")
        self.patcher_dir.start()

        if not os.path.exists("/tmp/stagepi-supervisor-d"):
            os.makedirs("/tmp/stagepi-supervisor-d")

    def tearDown(self):
        self.patcher_dir.stop()
        # Cleanup supervisor confs
        import shutil

        if os.path.exists("/tmp/stagepi-supervisor-d"):
            shutil.rmtree("/tmp/stagepi-supervisor-d")

    @patch("xmlrpc.client.ServerProxy")
    @patch("core.stream_manager.pwd")
    def test_start_stream(self, mock_pwd, mock_server_proxy):
        # Mock pwd
        mock_pw_struct = MagicMock()
        mock_pw_struct.pw_dir = "/home/pi"
        mock_pw_struct.pw_uid = 1000
        mock_pwd.getpwnam.return_value = mock_pw_struct
        
        # Mock Supervisor
        mock_supervisor = MagicMock()
        mock_server_proxy.return_value.supervisor = mock_supervisor

        # Mock connection return value for getProcessInfo
        mock_supervisor.getProcessInfo.return_value = {
            "state": 20,  # RUNNING
            "statename": "RUNNING",
            "pid": 9999,
            "exitstatus": 0,
        }
        mock_supervisor.reloadConfig.return_value = [[], [], []]  # added, changed, removed

        manager = SupervisorStreamManager()
        config = StreamConfig(
            stream_id="test_sup", kind="receiver", ip="239.1.1.1", port=5004, device="default", iface="eth0"
        )

        manager.create_stream(config)

        # Check if config file was written
        conf_path = os.path.join("/tmp/stagepi-supervisor-d", "stream-test_sup.conf")
        self.assertTrue(os.path.exists(conf_path))

        with open(conf_path) as f:
            content = f.read()
            self.assertIn("[program:stream-test_sup]", content)
            self.assertIn("/usr/bin/gst-launch-1.0", content)
            # Verify injected environment variables
            self.assertIn('HOME="/home/pi"', content)
            self.assertIn('USER="pi"', content)
            self.assertIn('XDG_RUNTIME_DIR="/run/user/1000"', content)

        # Verify supervisor reload was called
        # self.assertTrue(mock_supervisor.reloadConfig.called)
        # Verify getProcessInfo called
        status = manager.get_stream_status("test_sup")
        self.assertEqual(status["state"], "RUNNING")
        
        # Verify startProcess not strictly called because we rely on autostart=true in conf + reload
        # But if we did explicit start, check it.
        # In current implementation: stream.start() -> calls reload_supervisor()
        

    @patch("xmlrpc.client.ServerProxy")
    @patch("core.stream_manager.pwd")
    def test_stop_stream(self, mock_pwd, mock_server_proxy):
        # Mock pwd
        mock_pw_struct = MagicMock()
        mock_pw_struct.pw_dir = "/home/pi"
        mock_pw_struct.pw_uid = 1000
        mock_pwd.getpwnam.return_value = mock_pw_struct

        mock_supervisor = MagicMock()
        mock_server_proxy.return_value.supervisor = mock_supervisor
        mock_supervisor.reloadConfig.return_value = [[], [], []]

        manager = SupervisorStreamManager()
        config = StreamConfig(
            stream_id="test_sup", kind="receiver", ip="239.1.1.1", port=5004, device="default", iface="eth0"
        )

        manager.create_stream(config)
        conf_path = os.path.join("/tmp/stagepi-supervisor-d", "stream-test_sup.conf")
        self.assertTrue(os.path.exists(conf_path))

        # Stop
        manager.stop_stream("test_sup")

        # Verify stopProcess called
        mock_supervisor.stopProcess.assert_called_with("stream-test_sup")

        # Verify conf removed
        self.assertFalse(os.path.exists(conf_path))

        # Verify reload called again to cleanup process group
        self.assertTrue(mock_supervisor.reloadConfig.call_count >= 2)

    def test_device_string_formatting(self):
        """Test that ALSA device strings are correctly formatted."""
        from core.stream_manager import AES67Stream

        # Test 1: 'default' should stay 'default'
        config1 = StreamConfig(stream_id="t1", kind="sender", ip="239.1.1.1", port=5004, device="default", iface="eth0")
        stream1 = AES67Stream(config1)
        self.assertIn("device=default", stream1.pipeline_str)

        # Test 2: 'sndrpihifiberry' should become 'hw:sndrpihifiberry'
        config2 = StreamConfig(
            stream_id="t2", kind="sender", ip="239.1.1.1", port=5004, device="sndrpihifiberry", iface="eth0"
        )
        stream2 = AES67Stream(config2)
        self.assertIn("device=hw:sndrpihifiberry", stream2.pipeline_str)

        # Test 3: 'plughw:1,0' should stay 'plughw:1,0'
        config3 = StreamConfig(stream_id="t3", kind="sender", ip="239.1.1.1", port=5004, device="plughw:1,0", iface="eth0")
        stream3 = AES67Stream(config3)
        self.assertIn("device=plughw:1,0", stream3.pipeline_str)


if __name__ == "__main__":
    unittest.main()
