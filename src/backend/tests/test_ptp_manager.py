import pytest
from unittest.mock import patch, MagicMock
from core import ptp_manager


def test_find_binary():
    with patch("shutil.which", return_value="/usr/sbin/ptp4l"), \
         patch("os.path.isfile", return_value=True), \
         patch("os.access", return_value=True):
        assert ptp_manager._find_binary("ptp4l") == "/usr/sbin/ptp4l"


def test_parse_pmc_output():
    sample_output = """
sending: GET TIME_STATUS_NP
sending: GET PORT_DATA_SET
sending: GET DEFAULT_DATA_SET
        d83add.fffe.eacb36-0 seq 0 RESPONSE MANAGEMENT TIME_STATUS_NP 
                master_offset              12500
                ingress_time               0
                cumulativeScaledRateOffset +0.000000000
                gmPresent                  true
                gmIdentity                 001b19.fffe.123456
        d83add.fffe.eacb36-1 seq 1 RESPONSE MANAGEMENT PORT_DATA_SET 
                portIdentity            d83add.fffe.eacb36-1
                portState               SLAVE
                logMinDelayReqInterval  -3
                peerMeanPathDelay       2500
                logAnnounceInterval     0
                announceReceiptTimeout  3
                logSyncInterval         -3
                delayMechanism          1
                versionNumber           2
        d83add.fffe.eacb36-0 seq 2 RESPONSE MANAGEMENT DEFAULT_DATA_SET 
                twoStepFlag             1
                slaveOnly               0
                clockIdentity           d83add.fffe.eacb36
                domainNumber            0
"""
    parsed = ptp_manager._parse_pmc_output(sample_output)
    assert parsed["master_offset"] == 12500
    assert parsed["gmPresent"] is True
    assert parsed["gmIdentity"] == "001b19.fffe.123456"
    assert parsed["portState"] == "SLAVE"
    assert parsed["logSyncInterval"] == -3
    assert parsed["clockIdentity"] == "d83add.fffe.eacb36"
    assert parsed["domainNumber"] == 0


def test_get_ptp_status_locked():
    mock_pmc_data = {
        "portState": "SLAVE",
        "master_offset": 840,
        "offsetFromMaster": 840.0,
        "meanPathDelay": 1200.0,
        "stepsRemoved": 1,
        "clockIdentity": "d83add.fffe.eacb36",
        "gmIdentity": "001b19.fffe.123456",
        "gmPresent": True,
        "domainNumber": 0,
        "portIdentity": "d83add.fffe.eacb36-1",
    }
    with patch("core.ptp_manager.is_ptp_installed", return_value=True), \
         patch("core.ptp_manager.is_ptp_service_active", return_value=True), \
         patch("core.ptp_manager.is_ptp_service_enabled", return_value=True), \
         patch("core.ptp_manager.detect_active_profile", return_value="aes67"), \
         patch("core.ptp_manager.query_pmc", return_value=mock_pmc_data):
        status = ptp_manager.get_ptp_status()
        assert status["installed"] is True
        assert status["service_active"] is True
        assert status["lock_status"] == "locked"
        assert status["is_master"] is False
        assert status["master_offset_ns"] == 840.0
        assert status["master_offset_us"] == 0.84
        assert status["profile"] == "aes67"
        assert status["gm_identity"] == "001b19.fffe.123456"


def test_get_ptp_status_master():
    mock_pmc_data = {
        "portState": "MASTER",
        "master_offset": 0,
        "offsetFromMaster": 0.0,
        "meanPathDelay": 0.0,
        "stepsRemoved": 0,
        "clockIdentity": "d83add.fffe.eacb36",
        "gmIdentity": "d83add.fffe.eacb36",
        "gmPresent": False,
        "domainNumber": 0,
        "portIdentity": "d83add.fffe.eacb36-1",
    }
    with patch("core.ptp_manager.is_ptp_installed", return_value=True), \
         patch("core.ptp_manager.is_ptp_service_active", return_value=True), \
         patch("core.ptp_manager.is_ptp_service_enabled", return_value=True), \
         patch("core.ptp_manager.detect_active_profile", return_value="aes67"), \
         patch("core.ptp_manager.query_pmc", return_value=mock_pmc_data):
        status = ptp_manager.get_ptp_status()
        assert status["lock_status"] == "master"
        assert status["is_master"] is True


def test_available_profiles():
    profiles = ptp_manager.get_available_profiles()
    profile_ids = [p["id"] for p in profiles]
    assert "aes67" in profile_ids
    assert "smpte" in profile_ids
    assert "default" in profile_ids
    assert "ravenna" not in profile_ids
