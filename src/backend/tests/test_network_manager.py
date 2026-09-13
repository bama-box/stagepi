from types import SimpleNamespace
from unittest.mock import patch

from core import network_manager


def test_set_ethernet_config_dotted_mask():
    config = SimpleNamespace(
        ipAddress="10.42.10.2", subnetMask="255.255.255.0", gateway="10.42.10.1", dnsServers=["1.1.1.1", ""]
    )
    with (
        patch("core.network_manager._get_connection_name_for_device", return_value="eth0"),
        patch("core.network_manager._run_nmcli_command") as mock_nmcli,
        patch("core.network_manager.get_ethernet_config", return_value={"mode": "manual", "ipAddress": "10.42.10.2"}),
    ):
        res = network_manager.set_ethernet_config(config)
        assert res.get("ipAddress") == "10.42.10.2"
        # Check mod_command args
        mod_call_args = mock_nmcli.call_args_list[0][0][0]
        assert "10.42.10.2/24" in mod_call_args
        assert "10.42.10.1" in mod_call_args
        # Ensure trailing empty string was filtered from DNS
        assert "1.1.1.1" in mod_call_args
        assert "1.1.1.1," not in mod_call_args


def test_set_ethernet_config_cidr_mask():
    config = SimpleNamespace(ipAddress="10.42.10.2", subnetMask="24", gateway="", dnsServers=None)
    with (
        patch("core.network_manager._get_connection_name_for_device", return_value="eth0"),
        patch("core.network_manager._run_nmcli_command") as mock_nmcli,
        patch("core.network_manager.get_ethernet_config", return_value={"mode": "manual", "ipAddress": "10.42.10.2"}),
    ):
        res = network_manager.set_ethernet_config(config)
        assert res.get("ipAddress") == "10.42.10.2"
        mod_call_args = mock_nmcli.call_args_list[0][0][0]
        assert "10.42.10.2/24" in mod_call_args


def test_set_ethernet_config_invalid_mask():
    config = SimpleNamespace(ipAddress="10.42.10.2", subnetMask="invalid_mask", gateway="", dnsServers=[])
    with patch("core.network_manager._get_connection_name_for_device", return_value="eth0"):
        res = network_manager.set_ethernet_config(config)
        assert "error" in res


def test_reset_ethernet_config():
    with (
        patch("core.network_manager._get_connection_name_for_device", return_value="eth0"),
        patch("core.network_manager._run_nmcli_command") as mock_nmcli,
        patch("core.network_manager.get_ethernet_config", return_value={"mode": "auto"}),
    ):
        res = network_manager.reset_ethernet_config()
        assert res.get("mode") == "auto"
        mod_call_args = mock_nmcli.call_args_list[0][0][0]
        assert "auto" in mod_call_args
        assert "ipv4.gateway" in mod_call_args
