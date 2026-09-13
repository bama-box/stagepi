import { useState, useEffect } from 'preact/hooks';
import {
  FiPlay,
  FiSquare,
  FiTrash2,
  FiSettings,
  FiPlus,
  FiRefreshCw,
  FiFileText,
  FiWifi,
  FiCpu,
  FiClock,
} from 'react-icons/fi';
import { RiSpeaker3Line, RiAirplayLine, RiBluetoothLine } from 'react-icons/ri';
import { HiOutlineMicrophone } from 'react-icons/hi2';
import { BsEthernet } from 'react-icons/bs';
import { StreamModal, type Stream } from '../views/StreamModal';
import { PiHardwareMap, type AudioTopology } from '../hardware/PiHardwareMap';
import { useNotification } from '../../context/NotificationContext';
import { API_BASE_URL } from '../../config';
import type { PtpStatus } from '../../types';
import './ApplianceDashboard.css';

function streamToBackend(stream: Partial<Stream>): any {
  const backend: any = {};
  if (stream.id !== undefined) backend.id = stream.id;
  if (stream.mode !== undefined) backend.kind = stream.mode === 'input' ? 'sender' : 'receiver';
  if (stream.addr !== undefined) backend.ip = stream.addr;
  if (stream.port !== undefined) backend.port = stream.port;
  if (stream.hw_device !== undefined) backend.device = stream.hw_device;
  if (stream.net_device !== undefined) backend.iface = stream.net_device;
  if (stream.channels !== undefined) backend.channels = stream.channels;
  if (stream.format !== undefined) backend.format = stream.format;
  if (stream.enabled !== undefined) backend.enabled = stream.enabled;
  return backend;
}

function streamFromBackend(backend: any): Stream {
  return {
    id: backend.id || `s-${Math.random().toString(16).slice(2, 10)}`,
    mode: backend.kind === 'sender' ? 'input' : 'output',
    addr: backend.ip || '239.69.22.10',
    port: backend.port ?? 5004,
    hw_device: backend.device || 'default',
    net_device: backend.iface || 'eth0',
    channels: backend.channels ?? 2,
    format: backend.format || 'S24BE',
    enabled: typeof backend.enabled === 'boolean' ? backend.enabled : false,
  };
}

interface ServiceStatus {
  enabled: boolean;
  active: boolean;
  loading: boolean;
}

interface ApplianceDashboardProps {
  onOpenSettings: (tab?: string) => void;
  ptpStatus?: PtpStatus | null;
  onOpenPtp?: () => void;
}

export function ApplianceDashboard({ onOpenSettings, ptpStatus, onOpenPtp }: ApplianceDashboardProps) {
  const { notify, openStreamLogs } = useNotification();

  // Streams state
  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [netDevices, setNetDevices] = useState<string[]>([]);
  const [soundInputs, setSoundInputs] = useState<any[]>([]);
  const [soundOutputs, setSoundOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingStreamId, setTogglingStreamId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);

  // Auxiliary services state
  const [airplay, setAirplay] = useState<ServiceStatus>({ enabled: false, active: false, loading: false });
  const [bluetooth, setBluetooth] = useState<ServiceStatus>({ enabled: false, active: false, loading: false });
  const [wifiMode, setWifiMode] = useState<string>('client');

  // Hardware topology state
  const [topology, setTopology] = useState<AudioTopology | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [sRes, nRes, siRes, soRes, apRes, btRes, wfRes, topoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/streams`).catch(() => null),
        fetch(`${API_BASE_URL}/network/interfaces`).catch(() => null),
        fetch(`${API_BASE_URL}/sound/input`).catch(() => null),
        fetch(`${API_BASE_URL}/sound/output`).catch(() => null),
        fetch(`${API_BASE_URL}/services/airplay`).catch(() => null),
        fetch(`${API_BASE_URL}/services/bluetooth`).catch(() => null),
        fetch(`${API_BASE_URL}/network/config/wifi`).catch(() => null),
        fetch(`${API_BASE_URL}/sound/topology`).catch(() => null),
      ]);

      if (sRes && sRes.ok) {
        const sJson = await sRes.json();
        setStreams((sJson.streams || []).map(streamFromBackend));
      }

      if (nRes && nRes.ok) {
        const nJson = await nRes.json();
        setNetDevices(Array.isArray(nJson) ? nJson : nJson.interfaces || ['eth0']);
      }

      const parseDevices = (j: any) => {
        if (!j) return [];
        if (Array.isArray(j)) return j;
        if (Array.isArray(j.inputs)) return j.inputs;
        if (Array.isArray(j.outputs)) return j.outputs;
        if (Array.isArray(j.devices)) return j.devices;
        return [];
      };

      if (siRes && siRes.ok) {
        const siJson = await siRes.json().catch(() => []);
        setSoundInputs(parseDevices(siJson));
      }

      if (soRes && soRes.ok) {
        const soJson = await soRes.json().catch(() => []);
        setSoundOutputs(parseDevices(soJson));
      }

      if (topoRes && topoRes.ok) {
        const topoJson = await topoRes.json().catch(() => null);
        if (topoJson) setTopology(topoJson);
      }

      if (apRes && apRes.ok) {
        const apJson = await apRes.json().catch(() => null);
        if (apJson) setAirplay({ enabled: !!apJson.enabled, active: !!apJson.active, loading: false });
      }

      if (btRes && btRes.ok) {
        const btJson = await btRes.json().catch(() => null);
        if (btJson) setBluetooth({ enabled: !!btJson.enabled, active: !!btJson.active, loading: false });
      }

      if (wfRes && wfRes.ok) {
        const wfJson = await wfRes.json().catch(() => null);
        if (wfJson && wfJson.deviceMode) setWifiMode(wfJson.deviceMode);
      }
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Dashboard Load Error',
        message: err.message || 'Failed to refresh stagebox data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Save Stream (Create or Edit)
  const handleSaveStream = async (streamData: Partial<Stream>) => {
    const backendData = streamToBackend(streamData);
    const isEdit = editingStream !== null;

    try {
      let res: Response;
      if (isEdit) {
        res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(streamData.id!)}/`, {
          method: 'PATCH',
          headers: { accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/streams/`, {
          method: 'POST',
          headers: { accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to ${isEdit ? 'update' : 'create'} stream (HTTP ${res.status})`);
      }

      const j = await res.json();
      const updatedStreams: Stream[] = (j.streams || []).map(streamFromBackend);
      setStreams(updatedStreams);

      notify({
        type: 'success',
        title: isEdit ? 'Stream Updated' : 'Stream Created',
        message: `Stream '${streamData.id}' is configured.`,
        source: 'AES67',
        streamId: streamData.id,
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: isEdit ? 'Update Stream Failed' : 'Create Stream Failed',
        message: err.message,
        details: `Stream ID: ${streamData.id}\nMode: ${streamData.mode}\nDevice: ${streamData.hw_device}\nMulticast: ${streamData.addr}:${streamData.port}`,
        source: 'AES67',
        streamId: streamData.id,
      });
      throw err;
    }
  };

  // Toggle Play / Stop
  const handleToggleStream = async (stream: Stream) => {
    if (togglingStreamId) return;
    setTogglingStreamId(stream.id);

    const targetEnabled = !stream.enabled;
    setStreams(prev => (prev ? prev.map(s => (s.id === stream.id ? { ...s, enabled: targetEnabled } : s)) : prev));

    try {
      const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(stream.id)}`, {
        method: 'PATCH',
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetEnabled }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to ${targetEnabled ? 'start' : 'stop'} stream`);
      }

      const j = await res.json();
      setStreams((j.streams || []).map(streamFromBackend));

      notify({
        type: 'info',
        title: targetEnabled ? 'Stream Started' : 'Stream Stopped',
        message: `Stream '${stream.id}' is now ${targetEnabled ? 'streaming' : 'stopped'}.`,
        source: 'AES67',
        streamId: stream.id,
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: `Failed to ${targetEnabled ? 'Start' : 'Stop'} Stream`,
        message: err.message,
        details: `Stream ID: ${stream.id}\nDevice: ${stream.hw_device}\nMulticast: ${stream.addr}:${stream.port}`,
        source: 'AES67',
        streamId: stream.id,
      });
      // Revert optimistic state
      setStreams(prev => (prev ? prev.map(s => (s.id === stream.id ? { ...s, enabled: !targetEnabled } : s)) : prev));
    } finally {
      setTogglingStreamId(null);
    }
  };

  // Delete Stream
  const handleDeleteStream = async (stream: Stream) => {
    if (!window.confirm(`Are you sure you want to delete stream '${stream.id}'?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(stream.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete stream');
      const j = await res.json();
      setStreams((j.streams || []).map(streamFromBackend));
      notify({
        type: 'info',
        title: 'Stream Deleted',
        message: `Stream '${stream.id}' removed.`,
        source: 'AES67',
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Delete Failed',
        message: err.message,
        source: 'AES67',
        streamId: stream.id,
      });
    }
  };

  // Toggle AirPlay
  const handleToggleAirplay = async () => {
    if (airplay.loading) return;
    const targetState = !airplay.enabled;
    setAirplay(prev => ({ ...prev, enabled: targetState, loading: true }));

    try {
      const res = await fetch(`${API_BASE_URL}/services/airplay`, {
        method: 'PATCH',
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState }),
      });
      if (!res.ok) throw new Error('Failed to update AirPlay');
      const data = await res.json();
      setAirplay({ enabled: !!data.enabled, active: !!data.active, loading: false });
      notify({
        type: 'info',
        title: 'AirPlay Service',
        message: `AirPlay is now ${targetState ? 'enabled' : 'disabled'}.`,
        source: 'AirPlay',
      });
    } catch (err: any) {
      setAirplay(prev => ({ ...prev, enabled: !targetState, loading: false }));
      notify({
        type: 'error',
        title: 'AirPlay Error',
        message: err.message,
        source: 'AirPlay',
      });
    }
  };

  // Toggle Bluetooth
  const handleToggleBluetooth = async () => {
    if (bluetooth.loading) return;
    const targetState = !bluetooth.enabled;
    setBluetooth(prev => ({ ...prev, enabled: targetState, loading: true }));

    try {
      const res = await fetch(`${API_BASE_URL}/services/bluetooth`, {
        method: 'PATCH',
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState }),
      });
      if (!res.ok) throw new Error('Failed to update Bluetooth');
      const data = await res.json();
      setBluetooth({ enabled: !!data.enabled, active: !!data.active, loading: false });
      notify({
        type: 'info',
        title: 'Bluetooth Service',
        message: `Bluetooth is now ${targetState ? 'enabled' : 'disabled'}.`,
        source: 'Bluetooth',
      });
    } catch (err: any) {
      setBluetooth(prev => ({ ...prev, enabled: !targetState, loading: false }));
      notify({
        type: 'error',
        title: 'Bluetooth Error',
        message: err.message,
        source: 'Bluetooth',
      });
    }
  };

  const currentStreams = streams || [];
  const activeStreamsCount = currentStreams.filter(s => s.enabled).length;

  // Detect primary sound card for badge
  const detectedOutputs = soundOutputs.map(o => o.card_name || o.name || 'Output').filter(Boolean);
  const detectedInputs = soundInputs.map(i => i.card_name || i.name || 'Input').filter(Boolean);
  const primaryInterface = topology?.interfaces.find(i => i.is_primary);
  const primaryHwName =
    topology?.hat.name ||
    primaryInterface?.card_name ||
    detectedOutputs[0] ||
    detectedInputs[0] ||
    'ALSA Sound Hardware';

  return (
    <div className="appliance-dashboard">
      {/* 1. Appliance Status Banner */}
      <section className="appliance-banner">
        <div className="banner-hw-info">
          <div className="hw-icon-pill">
            <RiSpeaker3Line size={18} />
          </div>
          <div className="hw-meta">
            <span className="hw-label">Primary Audio Interface</span>
            <span className="hw-name">{primaryHwName}</span>
          </div>

          <button
            type="button"
            className={`banner-map-toggle-btn ${isMapOpen ? 'active' : ''}`}
            onClick={() => setIsMapOpen(!isMapOpen)}
            title="Toggle Visual Raspberry Pi & Audio Interface Map"
          >
            <FiCpu size={14} />
            <span>{isMapOpen ? 'Hide Hardware Map' : 'Hardware Map'}</span>
            {topology?.interfaces && (
              <span className="hw-count-badge">{topology.interfaces.length}</span>
            )}
          </button>
        </div>

        <div className="banner-stats">
          <div className={`status-pill ${activeStreamsCount > 0 ? 'pill-active' : 'pill-idle'}`}>
            <span className="pill-dot" />
            <span>{activeStreamsCount > 0 ? `${activeStreamsCount} Active Stream${activeStreamsCount > 1 ? 's' : ''}` : 'All Streams Stopped'}</span>
          </div>

          <button
            type="button"
            className="banner-refresh-btn"
            onClick={fetchDashboardData}
            title="Refresh device state"
            disabled={loading}
          >
            <FiRefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </section>

      {/* 2. Visual Hardware Map Section */}
      {isMapOpen && (
        <section className="dashboard-section hardware-map-section">
          <PiHardwareMap
            topology={topology}
            activeStreams={currentStreams}
            ptpStatus={ptpStatus}
            onAddStreamForDevice={(dev, mode) => {
              setEditingStream({
                id: `s-${Math.random().toString(16).slice(2, 10)}`,
                mode: mode,
                addr: '239.69.22.10',
                port: 5004,
                hw_device: dev,
                net_device: netDevices[0] || 'eth0',
                channels: 2,
                format: 'S24BE',
                enabled: false,
              });
              setIsModalOpen(true);
            }}
          />
        </section>
      )}

      {/* 3. Primary Audio Streams Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">AES67 Audio Streams</h2>
            <p className="section-subtitle">Real-time network audio routing to physical hardware channels</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              type="button"
              className="action-btn-primary"
              onClick={() => {
                setEditingStream(null);
                setIsModalOpen(true);
              }}
            >
              <FiPlus size={16} />
              <span>Add Stream</span>
            </button>
          </div>
        </div>

        {currentStreams.length === 0 ? (
          <div className="empty-streams-card">
            <RiSpeaker3Line size={48} className="empty-icon" />
            <h3>No Streams Configured</h3>
            <p>Create an AES67 receiver or transmitter stream to begin routing audio.</p>
            <button
              type="button"
              className="action-btn-primary"
              onClick={() => {
                setEditingStream(null);
                setIsModalOpen(true);
              }}
            >
              <FiPlus size={16} /> Create Stream
            </button>
          </div>
        ) : (
          <div className="stream-tiles-grid">
            {currentStreams.map(stream => {
              const isReceiver = stream.mode === 'output';
              const isToggling = togglingStreamId === stream.id;

              return (
                <div key={stream.id} className={`stream-tile ${stream.enabled ? 'tile-running' : 'tile-stopped'}`}>
                  {/* Tile Top Bar */}
                  <div className="tile-header">
                    <div className="tile-id-group">
                      <div className={`stream-status-light ${stream.enabled ? 'light-on' : 'light-off'}`} />
                      <div className="tile-title-block">
                        <span className="tile-mode-tag">
                          {isReceiver ? (
                            <>
                              <RiSpeaker3Line size={13} /> Receiver (Net → Output)
                            </>
                          ) : (
                            <>
                              <HiOutlineMicrophone size={13} /> Transmitter (Input → Net)
                            </>
                          )}
                        </span>
                        <h3 className="tile-stream-id">{stream.id}</h3>
                      </div>
                    </div>

                    <div className="tile-quick-actions">
                      <button
                        type="button"
                        className="tile-icon-btn"
                        onClick={() => openStreamLogs(stream.id)}
                        title="View Process & Error Logs"
                      >
                        <FiFileText size={15} />
                      </button>
                      <button
                        type="button"
                        className="tile-icon-btn"
                        onClick={() => {
                          setEditingStream(stream);
                          setIsModalOpen(true);
                        }}
                        title="Edit Stream Settings"
                      >
                        <FiSettings size={15} />
                      </button>
                      <button
                        type="button"
                        className="tile-icon-btn btn-danger"
                        onClick={() => handleDeleteStream(stream)}
                        title="Delete Stream"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Tile Technical Parameters */}
                  <div className="tile-params-grid">
                    <div className="param-item">
                      <span className="param-label">Multicast Endpoint</span>
                      <span className="param-value mono">{stream.addr}:{stream.port}</span>
                    </div>

                    <div className="param-item">
                      <span className="param-label">ALSA Device</span>
                      <span className="param-value">{stream.hw_device}</span>
                    </div>

                    <div className="param-item">
                      <span className="param-label">Audio Format</span>
                      <span className="param-value mono">{stream.format} • {stream.channels}ch @ 48kHz</span>
                    </div>

                    <div className="param-item">
                      <span className="param-label">Interface</span>
                      <span className="param-value mono">
                        <BsEthernet size={12} style={{ marginRight: '4px' }} />
                        {stream.net_device}
                      </span>
                    </div>
                  </div>

                  {/* Tile Footer with Giant Tactile Play/Stop Button */}
                  <div className="tile-footer">
                    <button
                      type="button"
                      className={`giant-toggle-btn ${stream.enabled ? 'btn-stop' : 'btn-start'}`}
                      onClick={() => handleToggleStream(stream)}
                      disabled={isToggling}
                    >
                      {isToggling ? (
                        <>
                          <FiRefreshCw size={18} className="spin" />
                          <span>Updating...</span>
                        </>
                      ) : stream.enabled ? (
                        <>
                          <FiSquare size={18} />
                          <span>STOP STREAM</span>
                        </>
                      ) : (
                        <>
                          <FiPlay size={18} />
                          <span>START STREAM</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. System Services & Clocking Bar */}
      <section className="dashboard-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">System Services & Clocking</h2>
            <p className="section-subtitle">Real-time PTP clock synchronization, wireless audio receivers, and network connectivity</p>
          </div>
        </div>

        <div className="aux-services-grid">
          {/* PTP Clock Tile */}
          <div
            className="aux-service-card ptp-card"
            onClick={onOpenPtp}
            style={{ cursor: onOpenPtp ? 'pointer' : 'default' }}
            title="Click to configure PTP clock & operational profiles"
          >
            <div className="aux-card-left">
              <div className={`aux-icon-wrapper ptp ${ptpStatus?.lock_status || 'inactive'}`}>
                <FiClock size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h4 className="aux-name">PTP Clock</h4>
                  <span className="aux-profile-tag">
                    {ptpStatus?.profile ? ptpStatus.profile.toUpperCase() : 'AES67'}
                  </span>
                </div>
                <span className="aux-status-text">
                  {!ptpStatus?.service_active
                    ? 'Daemon Inactive'
                    : ptpStatus.lock_status === 'locked'
                    ? `Locked • ${ptpStatus.master_offset_us} µs (Dom ${ptpStatus.domain})`
                    : ptpStatus.lock_status === 'master'
                    ? `Grandmaster (Dom ${ptpStatus.domain})`
                    : ptpStatus.lock_status === 'syncing'
                    ? `Acquiring Lock (Dom ${ptpStatus.domain})`
                    : ptpStatus.lock_status === 'free_running'
                    ? `Free-running (Dom ${ptpStatus.domain})`
                    : `Active (Dom ${ptpStatus.domain})`}
                </span>
              </div>
            </div>

            <div className="aux-card-right" onClick={(e) => e.stopPropagation()}>
              <span className={`aux-ptp-status-pill ${ptpStatus?.lock_status || 'inactive'}`}>
                {ptpStatus?.lock_status === 'locked' && 'LOCKED'}
                {ptpStatus?.lock_status === 'master' && 'GM'}
                {ptpStatus?.lock_status === 'syncing' && 'SYNCING'}
                {ptpStatus?.lock_status === 'free_running' && 'FREE'}
                {ptpStatus?.lock_status === 'faulty' && 'FAULT'}
                {(!ptpStatus || ptpStatus.lock_status === 'inactive') && 'STOPPED'}
              </span>
              {onOpenPtp && (
                <button
                  type="button"
                  className="aux-config-btn"
                  onClick={onOpenPtp}
                  title="Configure PTP Clock"
                >
                  <FiSettings size={14} />
                </button>
              )}
            </div>
          </div>

          {/* AirPlay Tile */}
          <div className="aux-service-card">
            <div className="aux-card-left">
              <div className="aux-icon-wrapper airplay">
                <RiAirplayLine size={20} />
              </div>
              <div>
                <h4 className="aux-name">AirPlay Receiver</h4>
                <span className="aux-status-text">
                  {airplay.enabled ? (airplay.active ? 'Active & Ready' : 'Enabled') : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="aux-card-right">
              <button
                type="button"
                className={`aux-switch-btn ${airplay.enabled ? 'active' : ''}`}
                onClick={handleToggleAirplay}
                disabled={airplay.loading}
              >
                {airplay.enabled ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className="aux-config-btn"
                onClick={() => onOpenSettings('aux')}
                title="Configure AirPlay"
              >
                <FiSettings size={14} />
              </button>
            </div>
          </div>

          {/* Bluetooth Tile */}
          <div className="aux-service-card">
            <div className="aux-card-left">
              <div className="aux-icon-wrapper bluetooth">
                <RiBluetoothLine size={20} />
              </div>
              <div>
                <h4 className="aux-name">Bluetooth Audio</h4>
                <span className="aux-status-text">
                  {bluetooth.enabled ? (bluetooth.active ? 'Discoverable' : 'Enabled') : 'Disabled'}
                </span>
              </div>
            </div>

            <div className="aux-card-right">
              <button
                type="button"
                className={`aux-switch-btn ${bluetooth.enabled ? 'active' : ''}`}
                onClick={handleToggleBluetooth}
                disabled={bluetooth.loading}
              >
                {bluetooth.enabled ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className="aux-config-btn"
                onClick={() => onOpenSettings('aux')}
                title="Configure Bluetooth"
              >
                <FiSettings size={14} />
              </button>
            </div>
          </div>

          {/* Wi-Fi Quick Tile */}
          <div className="aux-service-card">
            <div className="aux-card-left">
              <div className="aux-icon-wrapper wifi">
                <FiWifi size={20} />
              </div>
              <div>
                <h4 className="aux-name">Wi-Fi Mode</h4>
                <span className="aux-status-text">
                  {wifiMode === 'ap' ? 'Hotspot Mode' : 'Client Mode'}
                </span>
              </div>
            </div>

            <div className="aux-card-right">
              <button
                type="button"
                className="aux-link-btn"
                onClick={() => onOpenSettings('wifi')}
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stream Modal for Add / Edit */}
      {isModalOpen && (
        <StreamModal
          isOpen={isModalOpen}
          initialStream={editingStream}
          onSave={handleSaveStream}
          onClose={() => {
            setIsModalOpen(false);
            setEditingStream(null);
          }}
          soundInputs={soundInputs}
          soundOutputs={soundOutputs}
          netDevices={netDevices}
          existingStreams={currentStreams}
        />
      )}
    </div>
  );
}
