import { useState, useEffect } from 'preact/hooks';
import { FiPlay, FiSquare, FiTrash2, FiSettings, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { GiSoundWaves } from 'react-icons/gi';
import { BsEthernet } from 'react-icons/bs';
import { HiOutlineMicrophone } from 'react-icons/hi2';
import { RiSpeaker3Line } from 'react-icons/ri';
import './Aes67.css';
import { StreamModal, type Stream } from './StreamModal';
import { useNotification } from '../../context/NotificationContext';
import { API_BASE_URL } from '../../config';

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

export function Aes67() {
  const { notify } = useNotification();
  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [netDevices, setNetDevices] = useState<string[]>([]);
  const [soundInputs, setSoundInputs] = useState<any[]>([]);
  const [soundOutputs, setSoundOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [togglingStreamId, setTogglingStreamId] = useState<string | null>(null);

  const fetchStreamsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, nRes, siRes, soRes] = await Promise.all([
        fetch(`${API_BASE_URL}/streams`),
        fetch(`${API_BASE_URL}/network/interfaces`),
        fetch(`${API_BASE_URL}/sound/input`),
        fetch(`${API_BASE_URL}/sound/output`),
      ]);
      if (!sRes.ok) throw new Error('Failed to fetch streams');
      if (!nRes.ok) throw new Error('Failed to fetch network interfaces');

      const sJson = await sRes.json();
      const nJson = await nRes.json();
      let siJson: any = [];
      let soJson: any = [];
      try { siJson = await siRes.json(); } catch { siJson = []; }
      try { soJson = await soRes.json(); } catch { soJson = []; }

      const parseDevices = (j: any) => {
        if (!j) return [];
        if (Array.isArray(j)) return j;
        if (Array.isArray(j.inputs)) return j.inputs;
        if (Array.isArray(j.outputs)) return j.outputs;
        if (Array.isArray(j.devices)) return j.devices;
        return [];
      };

      setStreams((sJson.streams || []).map(streamFromBackend));
      setNetDevices(Array.isArray(nJson) ? nJson : (nJson.interfaces || ['eth0']));
      setSoundInputs(parseDevices(siJson));
      setSoundOutputs(parseDevices(soJson));
    } catch (err: any) {
      setError(err);
      notify({
        type: 'error',
        title: 'AES67 Load Error',
        message: err.message || 'Failed to load streams configuration',
        source: 'AES67',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreamsData();
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
        message: `Stream '${streamData.id}' configured successfully.`,
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
    // Optimistic UI update
    setStreams(prev => prev ? prev.map(s => s.id === stream.id ? { ...s, enabled: targetEnabled } : s) : prev);

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
      const newStreams: Stream[] = (j.streams || []).map(streamFromBackend);
      setStreams(newStreams);

      notify({
        type: 'info',
        title: targetEnabled ? 'Stream Started' : 'Stream Stopped',
        message: `Stream '${stream.id}' is now ${targetEnabled ? 'running' : 'stopped'}.`,
        source: 'AES67',
        streamId: stream.id,
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: `Failed to ${targetEnabled ? 'Start' : 'Stop'} Stream`,
        message: err.message,
        details: `Stream ID: ${stream.id}\nMode: ${stream.mode === 'input' ? 'Transmitter' : 'Receiver'}\nMulticast: ${stream.addr}:${stream.port}\nALSA Device: ${stream.hw_device}\nInterface: ${stream.net_device}`,
        source: 'AES67',
        streamId: stream.id,
      });
      // Revert optimistic update
      setStreams(prev => prev ? prev.map(s => s.id === stream.id ? { ...s, enabled: !targetEnabled } : s) : prev);
    } finally {
      setTogglingStreamId(null);
    }
  };

  // Delete Stream
  const handleDeleteStream = async (stream: Stream) => {
    if (!window.confirm(`Are you sure you want to delete stream '${stream.id}'?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(stream.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete stream');
      const j = await res.json();
      const converted = (j.streams || []).map(streamFromBackend);
      setStreams(converted);

      notify({
        type: 'info',
        title: 'Stream Deleted',
        message: `Stream '${stream.id}' was deleted successfully.`,
        source: 'AES67',
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Delete Stream Failed',
        message: err.message,
        details: `Stream ID: ${stream.id}`,
        source: 'AES67',
        streamId: stream.id,
      });
    }
  };

  if (loading) return <div className="card">Loading AES67 streams...</div>;
  if (error) return <div className="card error">Error: {error.message}</div>;

  const currentStreams = streams || [];
  const transmitters = currentStreams.filter(s => s.mode === 'input');
  const receivers = currentStreams.filter(s => s.mode === 'output');
  const activeCount = currentStreams.filter(s => s.enabled).length;

  return (
    <div className="aes67-container">
      {/* Top Header Card */}
      <div className="aes67-header">
        <div className="aes67-header-left">
          <h2>
            <GiSoundWaves size={28} color="#f59e0b" />
            AES67 Audio Streams
          </h2>
          <p>Uncompressed real-time audio over IP network streams (IEEE 1588 / AES67 profile)</p>
          <div className="header-badges">
            <span className="stat-badge">
              <span>Total:</span> <strong>{currentStreams.length}</strong>
            </span>
            <span className={`stat-badge ${activeCount > 0 ? 'active-count' : ''}`}>
              <span className="stat-dot" />
              <span>Active:</span> <strong>{activeCount}</strong>
            </span>
          </div>
        </div>

        <div className="aes67-header-actions">
          <button
            className="btn-icon-action"
            onClick={fetchStreamsData}
            title="Refresh stream status"
          >
            <FiRefreshCw size={16} />
          </button>
          <button
            className="btn-primary-action"
            onClick={() => {
              setEditingStream(null);
              setIsModalOpen(true);
            }}
          >
            <FiPlus size={18} />
            <span>Create Stream</span>
          </button>
        </div>
      </div>

      {/* Transmitters Section (Capture / TX) */}
      <div className="streams-category-section">
        <div className="category-title">
          <div className="title-left">
            <HiOutlineMicrophone color="#c084fc" size={20} />
            <span>Transmitters (Capture / Send)</span>
          </div>
          <span className="category-count">{transmitters.length} configured</span>
        </div>

        <div className="stream-cards-grid">
          {transmitters.length > 0 ? transmitters.map(s => (
            <StreamCard
              key={s.id}
              stream={s}
              isToggling={togglingStreamId === s.id}
              onToggle={() => handleToggleStream(s)}
              onEdit={() => {
                setEditingStream(s);
                setIsModalOpen(true);
              }}
              onDelete={() => handleDeleteStream(s)}
            />
          )) : (
            <div className="empty-stream-state">
              <HiOutlineMicrophone size={32} />
              <p>No audio transmitters configured.</p>
              <button
                className="btn-primary-action"
                style={{ marginTop: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                onClick={() => {
                  setEditingStream(null);
                  setIsModalOpen(true);
                }}
              >
                + Add Transmitter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Receivers Section (Playback / RX) */}
      <div className="streams-category-section">
        <div className="category-title">
          <div className="title-left">
            <RiSpeaker3Line color="#60a5fa" size={20} />
            <span>Receivers (Playback / Output)</span>
          </div>
          <span className="category-count">{receivers.length} configured</span>
        </div>

        <div className="stream-cards-grid">
          {receivers.length > 0 ? receivers.map(s => (
            <StreamCard
              key={s.id}
              stream={s}
              isToggling={togglingStreamId === s.id}
              onToggle={() => handleToggleStream(s)}
              onEdit={() => {
                setEditingStream(s);
                setIsModalOpen(true);
              }}
              onDelete={() => handleDeleteStream(s)}
            />
          )) : (
            <div className="empty-stream-state">
              <RiSpeaker3Line size={32} />
              <p>No audio receivers configured.</p>
              <button
                className="btn-primary-action"
                style={{ marginTop: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                onClick={() => {
                  setEditingStream(null);
                  setIsModalOpen(true);
                }}
              >
                + Add Receiver
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stream Creation & Editing Modal */}
      <StreamModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStream(null);
        }}
        onSave={handleSaveStream}
        initialStream={editingStream}
        soundInputs={soundInputs}
        soundOutputs={soundOutputs}
        netDevices={netDevices}
        existingStreams={currentStreams}
      />
    </div>
  );
}

interface StreamCardProps {
  stream: Stream;
  isToggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function StreamCard({ stream, isToggling, onToggle, onEdit, onDelete }: StreamCardProps) {
  const isTx = stream.mode === 'input';

  return (
    <div className={`modern-stream-card ${stream.enabled ? 'is-active' : ''}`}>
      {/* Card Top Header */}
      <div className="card-top">
        <div className="card-title-group">
          <div className="stream-id-badge">{stream.id}</div>
          <div className={`stream-direction-pill ${isTx ? 'tx' : 'rx'}`}>
            {isTx ? <HiOutlineMicrophone size={12} /> : <RiSpeaker3Line size={12} />}
            <span>{isTx ? 'Transmitter' : 'Receiver'}</span>
          </div>
        </div>

        <div className={`status-pill ${stream.enabled ? 'running' : 'stopped'}`}>
          {stream.enabled && (
            <div className="mini-equalizer">
              <span className="wave-bar w1" />
              <span className="wave-bar w2" />
              <span className="wave-bar w3" />
            </div>
          )}
          <span>{stream.enabled ? 'LIVE' : 'STOPPED'}</span>
        </div>
      </div>

      {/* Card Details Chips */}
      <div className="card-details-chips">
        <div className="chip-row">
          <BsEthernet className="chip-icon" size={14} />
          <span className="chip-label">Network:</span>
          <span className="chip-value mono">{`${stream.addr}:${stream.port}`}</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({stream.net_device || 'eth0'})</span>
        </div>

        <div className="chip-row">
          <GiSoundWaves className="chip-icon" size={14} />
          <span className="chip-label">Device:</span>
          <span className="chip-value">{stream.hw_device || 'default'}</span>
        </div>

        <div className="chip-row">
          <span className="chip-icon" style={{ fontSize: '0.8rem' }}>🎚️</span>
          <span className="chip-label">Format:</span>
          <span className="chip-value" style={{ fontSize: '0.78rem' }}>
            {stream.format || 'S24BE'} • 48 kHz • {stream.channels || 2}ch
          </span>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="card-bottom-actions">
        <button
          className={`btn-stream-toggle ${stream.enabled ? 'stop' : 'start'}`}
          onClick={onToggle}
          disabled={isToggling}
          title={stream.enabled ? 'Stop Stream' : 'Start Stream'}
        >
          {stream.enabled ? <FiSquare size={14} /> : <FiPlay size={14} />}
          <span>{isToggling ? 'Processing...' : stream.enabled ? 'Stop' : 'Start'}</span>
        </button>

        <div className="card-manage-buttons">
          <button
            className="btn-card-manage"
            onClick={onEdit}
            title="Configure Stream Settings"
          >
            <FiSettings size={15} />
          </button>

          <button
            className="btn-card-manage delete"
            onClick={onDelete}
            title="Delete Stream"
          >
            <FiTrash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Aes67;
