import { useState, useEffect } from 'preact/hooks';
import { FiX, FiCheck, FiAlertTriangle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { GiSoundWaves } from 'react-icons/gi';
import { BsEthernet } from 'react-icons/bs';
import { HiOutlineMicrophone } from 'react-icons/hi2';
import { RiSpeaker3Line } from 'react-icons/ri';
import './StreamModal.css';

export interface Stream {
  id: string;
  mode: 'input' | 'output';
  addr: string;
  port: number | string;
  hw_device?: string;
  net_device?: string;
  channels?: number;
  format?: string;
  enabled?: boolean;
}

interface StreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stream: Partial<Stream>) => Promise<void>;
  initialStream?: Stream | null;
  soundInputs: any[];
  soundOutputs: any[];
  netDevices: string[];
  existingStreams: Stream[];
}

export function StreamModal({
  isOpen,
  onClose,
  onSave,
  initialStream,
  soundInputs,
  soundOutputs,
  netDevices,
  existingStreams,
}: StreamModalProps) {
  if (!isOpen) return null;

  const isEditing = !!initialStream;

  // Form states
  const [mode, setMode] = useState<'input' | 'output'>(initialStream?.mode || 'output');
  const [addr, setAddr] = useState<string>(initialStream?.addr || '239.69.22.10');
  const [port, setPort] = useState<number | string>(initialStream?.port ?? 5004);
  const [hwDevice, setHwDevice] = useState<string>(initialStream?.hw_device || '');
  const [netDevice, setNetDevice] = useState<string>(initialStream?.net_device || (netDevices[0] || 'eth0'));
  const [channels, setChannels] = useState<number>(initialStream?.channels ?? 2);
  const [format, setFormat] = useState<string>(initialStream?.format || 'S24BE');
  const [startImmediately, setStartImmediately] = useState<boolean>(initialStream?.enabled ?? false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize defaults on open or mode switch
  useEffect(() => {
    if (initialStream) {
      setMode(initialStream.mode);
      setAddr(initialStream.addr);
      setPort(initialStream.port);
      setHwDevice(initialStream.hw_device || '');
      setNetDevice(initialStream.net_device || (netDevices[0] || 'eth0'));
      setChannels(initialStream.channels ?? 2);
      setFormat(initialStream.format || 'S24BE');
      setStartImmediately(initialStream.enabled ?? false);
    } else {
      // Creation mode: pick first available sound device for the selected direction
      const devList = mode === 'input' ? soundInputs : soundOutputs;
      const defaultCard = devList[0]?.card_name || devList[0]?.card_id || 'default';
      setHwDevice(defaultCard);
      setNetDevice(netDevices[0] || 'eth0');

      // Auto-assign next free even port starting from 5004
      const usedPorts = existingStreams.map(s => Number(s.port)).filter(p => !isNaN(p));
      let nextPort = 5004;
      while (usedPorts.includes(nextPort)) {
        nextPort += 2;
      }
      setPort(nextPort);
    }
  }, [isOpen, initialStream]);

  // When mode toggles, adjust default hardware device
  const handleModeChange = (newMode: 'input' | 'output') => {
    setMode(newMode);
    if (!initialStream) {
      const devList = newMode === 'input' ? soundInputs : soundOutputs;
      const defaultCard = devList[0]?.card_name || devList[0]?.card_id || 'default';
      setHwDevice(defaultCard);
    }
  };

  // Check if selected hardware device is already in use by another stream
  const conflictingStream = existingStreams.find(s => {
    if (initialStream && s.id === initialStream.id) return false;
    return s.hw_device && s.hw_device === hwDevice;
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    const portNum = Number(port);
    if (!addr.trim()) {
      setError('Please enter a valid IP address.');
      return;
    }
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setError('Port must be a valid number between 1024 and 65535.');
      return;
    }

    setIsSubmitting(true);
    try {
      const streamPayload: Partial<Stream> = {
        id: initialStream?.id || `s-${Math.random().toString(16).slice(2, 10)}`,
        mode,
        addr: addr.trim(),
        port: portNum,
        hw_device: hwDevice || 'default',
        net_device: netDevice || (netDevices[0] || 'eth0'),
        channels,
        format,
        enabled: startImmediately,
      };

      await onSave(streamPayload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save stream configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableAudioDevices = mode === 'input' ? soundInputs : soundOutputs;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>
            <GiSoundWaves className="icon-title" size={24} />
            {isEditing ? `Configure Stream (${initialStream.id})` : 'Create AES67 Audio Stream'}
          </h3>
          <button className="modal-close-button" onClick={onClose} aria-label="Close modal">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="device-warning-alert" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
                <FiAlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {/* Stream Direction Cards */}
            <div className="form-group">
              <label>Stream Direction</label>
              <div className="direction-cards-grid">
                <div
                  className={`direction-card ${mode === 'input' ? 'selected tx' : ''}`}
                  onClick={() => handleModeChange('input')}
                >
                  <div className="card-icon"><HiOutlineMicrophone color="#c084fc" /></div>
                  <div className="card-title">Transmitter (Capture)</div>
                  <div className="card-desc">Capture local audio and stream uncompressed AES67 AoIP to the network</div>
                </div>

                <div
                  className={`direction-card ${mode === 'output' ? 'selected rx' : ''}`}
                  onClick={() => handleModeChange('output')}
                >
                  <div className="card-icon"><RiSpeaker3Line color="#60a5fa" /></div>
                  <div className="card-title">Receiver (Playback)</div>
                  <div className="card-desc">Receive network AES67 audio and route to local audio outputs or HAT</div>
                </div>
              </div>
            </div>

            {/* Audio Hardware Selector */}
            <div className="form-group">
              <label>
                <GiSoundWaves size={16} />
                Audio Interface ({mode === 'input' ? 'Capture Source' : 'Playback Destination'})
              </label>
              <select
                className="form-control"
                value={hwDevice}
                onChange={(e) => setHwDevice((e.target as HTMLSelectElement).value)}
              >
                <option value="default">Default System Audio Device</option>
                {availableAudioDevices.map((d: any) => {
                  const val = d.card_name || d.card_id;
                  const isUsed = existingStreams.some(s => (!initialStream || s.id !== initialStream.id) && s.hw_device === val);
                  return (
                    <option key={val} value={val}>
                      {d.card_name || d.card_id} {isUsed ? '(⚠️ already assigned)' : ''}
                    </option>
                  );
                })}
              </select>
              {conflictingStream && (
                <div className="device-warning-alert">
                  <FiAlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    <strong>Hardware Notice:</strong> This device is also mapped to <code>{conflictingStream.id}</code>. Direct ALSA hardware access is exclusive, so running both simultaneously may cause a device busy conflict.
                  </span>
                </div>
              )}
            </div>

            {/* Network Interface & Destination */}
            <div className="form-group">
              <label><BsEthernet size={16} /> Network Interface</label>
              <select
                className="form-control"
                value={netDevice}
                onChange={(e) => setNetDevice((e.target as HTMLSelectElement).value)}
              >
                {netDevices.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Multicast IP & Port */}
            <div className="form-row-2">
              <div className="form-group">
                <label>Multicast Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={addr}
                  onInput={(e) => setAddr((e.target as HTMLInputElement).value)}
                  placeholder="239.69.22.10"
                />
                <span className="form-hint">AES67 recommended range: 239.69.0.0/16</span>
              </div>

              <div className="form-group">
                <label>RTP Port</label>
                <input
                  type="number"
                  className="form-control"
                  value={port}
                  onInput={(e) => setPort((e.target as HTMLInputElement).value)}
                  placeholder="5004"
                />
                <span className="form-hint">Even ports (5004, 5006...)</span>
              </div>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="form-group">
              <button
                type="button"
                className="accordion-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>Advanced Stream Settings (Format, Channels)</span>
                {showAdvanced ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
              </button>

              {showAdvanced && (
                <div className="accordion-body">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Audio Format</label>
                      <select
                        className="form-control"
                        value={format}
                        onChange={(e) => setFormat((e.target as HTMLSelectElement).value)}
                      >
                        <option value="S24BE">S24BE (AES67 Standard 24-bit PCM)</option>
                        <option value="S16LE">S16LE (16-bit PCM)</option>
                        <option value="S24LE">S24LE (24-bit Little Endian)</option>
                        <option value="S32LE">S32LE (32-bit PCM)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Channels</label>
                      <select
                        className="form-control"
                        value={channels}
                        onChange={(e) => setChannels(Number((e.target as HTMLSelectElement).value))}
                      >
                        <option value={1}>1 (Mono)</option>
                        <option value={2}>2 (Stereo)</option>
                        <option value={4}>4 Channels</option>
                        <option value={8}>8 Channels</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Start on create toggle */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.65rem' }}>
              <input
                type="checkbox"
                id="startImmediately"
                checked={startImmediately}
                onChange={(e) => setStartImmediately((e.target as HTMLInputElement).checked)}
                style={{ width: '1.1rem', height: '1.1rem', accentColor: '#f59e0b', cursor: 'pointer' }}
              />
              <label htmlFor="startImmediately" style={{ cursor: 'pointer', userSelect: 'none', margin: 0 }}>
                Start stream immediately after saving
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-modal-submit"
              disabled={isSubmitting}
            >
              <FiCheck size={16} />
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StreamModal;
