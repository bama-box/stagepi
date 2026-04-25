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

    @patch("core.stream_manager._run_privileged_command")
    @patch("xmlrpc.client.ServerProxy")
    @patch("core.stream_manager.pwd")
    def test_start_stream(self, mock_pwd, mock_server_proxy, mock_priv_cmd):
        # Mock pwd
        mock_pw_struct = MagicMock()
        mock_pw_struct.pw_dir = "/home/pi"
        mock_pw_struct.pw_uid = 1000
        mock_pwd.getpwnam.return_value = mock_pw_struct
        
        # Mock privileged command execution success
        mock_priv_cmd.return_value.returncode = 0
        mock_priv_cmd.return_value.stdout = "program_name RUNNING pid 1234, uptime 0:00:05"
        mock_priv_cmd.return_value.stderr = ""
        
        # Mock Supervisor via XMLRPC (if still used? No, we switched to supervisorctl CLI in previous refactor 
        # but the test still mocks ServerProxy. Let's keep it if logic depends on it, but 
        # stream_manager uses _supervisorctl CLI now mainly).
        # Actually, let's look at AES67Stream._get_supervisor_status -> calls _supervisorctl("status")
        # So we need mock_priv_cmd to return status output when called with "status"
        
        def priv_cmd_side_effect(cmd, check=True):
            res = MagicMock()
            res.returncode = 0
            res.stderr = ""
            if "status" in cmd:
                 res.stdout = "stagepi-stream-test_sup RUNNING pid 9999, uptime 0:01:00"
            else:
                 res.stdout = ""
            return res
            
        mock_priv_cmd.side_effect = priv_cmd_side_effect

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
        conf_path = os.path.join("/tmp/stagepi-supervisor-d", "stagepi-stream-test_sup.conf")
        
        # Verify mv command was called
        # We can't check file existence because _run_privileged_command is mocked (mv didn't happen)
        # But we can check that it was called with the right args
        found_mv = False
        for call in mock_priv_cmd.call_args_list:
            args = call[0][0]
            if args[0] == "mv" and args[2] == conf_path:
                found_mv = True
                break
        self.assertTrue(found_mv, "mv command not called to create config file")

        # Verify supervisor reload was called
        # self.assertTrue(mock_supervisor.reloadConfig.called)
        # Verify getProcessInfo called
        status = manager.get_stream_status("test_sup")
        self.assertEqual(status["state"], "RUNNING")
        
        # Verify startProcess not strictly called because we rely on autostart=true in conf + reload
        # But if we did explicit start, check it.
        # In current implementation: stream.start() -> calls reload_supervisor()
        

    @patch("core.stream_manager._run_privileged_command")
    @patch("xmlrpc.client.ServerProxy")
    @patch("core.stream_manager.pwd")
    def test_stop_stream(self, mock_pwd, mock_server_proxy, mock_priv_cmd):
        # Mock pwd
        mock_pw_struct = MagicMock()
        mock_pw_struct.pw_dir = "/home/pi"
        mock_pw_struct.pw_uid = 1000
        mock_pwd.getpwnam.return_value = mock_pw_struct

        # Mock privileged command execution success
        mock_priv_cmd.return_value.returncode = 0
        mock_priv_cmd.return_value.stdout = ""
        mock_priv_cmd.return_value.stderr = ""

        mock_supervisor = MagicMock()
        mock_server_proxy.return_value.supervisor = mock_supervisor
        mock_supervisor.reloadConfig.return_value = [[], [], []]

        manager = SupervisorStreamManager()
        config = StreamConfig(
            stream_id="test_sup", kind="receiver", ip="239.1.1.1", port=5004, device="default", iface="eth0"
        )

        manager.create_stream(config)
        conf_path = os.path.join("/tmp/stagepi-supervisor-d", "stream-test_sup.conf")
        
        # Stop
        with patch("os.path.exists", return_value=True): # Pretend file exists so it tries to delete it
            manager.stop_stream("test_sup")

        # Verify stopProcess called
        # updated: _supervisorctl("stop") -> _run_privileged_command(["supervisorctl", "stop", ...])
        stop_called = False
        rm_called = False
        remove_called = False
        
        for call in mock_priv_cmd.call_args_list:
             args = call[0][0]
             if args[0] == "supervisorctl" and args[1] == "stop":
                 stop_called = True
             if args[0] == "supervisorctl" and args[1] == "remove":
                 remove_called = True
             # Check for rm command (it might be ["rm", path])
             if args[0] == "rm" and args[1] == conf_path:
                 rm_called = True
        
        self.assertTrue(stop_called, "supervisorctl stop not called")
        self.assertTrue(remove_called, "supervisorctl remove not called")
        
        # Verify conf removed (rm called) - wait, config is NOT removed on stop(), only on delete_stream()
        # stop() just sets autostart=false and updates.
        # Check logic in stop():
        # self._create_supervisor_config(enabled=False) -> mv overwrites it.
        
        # Verify reload called again to cleanup process group
        # self.assertTrue(mock_supervisor.reloadConfig.call_count >= 2)

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
