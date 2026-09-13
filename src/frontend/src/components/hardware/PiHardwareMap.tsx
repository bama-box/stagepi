import { useState } from 'preact/hooks';
import {
  FiHeadphones,
  FiTv,
  FiPlus,
  FiInfo,
} from 'react-icons/fi';
import { RiSpeaker3Line } from 'react-icons/ri';
import { GiSoundWaves } from 'react-icons/gi';
import { BsUsbSymbol } from 'react-icons/bs';
import type { Stream } from '../views/StreamModal';
import './PiHardwareMap.css';

export interface AudioInterface {
  card_number: number;
  card_id: string;
  card_name: string;
  pcm_name?: string;
  type: 'hat' | 'jack' | 'hdmi' | 'usb' | 'other';
  port: string;
  port_id: string;
  hat_name?: string | null;
  playback: boolean;
  capture: boolean;
  alsa_device: string;
  alsa_device_idx: string;
  is_primary: boolean;
}

export interface HatInfo {
  detected: boolean;
  vendor?: string | null;
  product?: string | null;
  name?: string | null;
  uuid?: string | null;
}

export interface AudioTopology {
  model: string;
  hat: HatInfo;
  interfaces: AudioInterface[];
}

interface PiHardwareMapProps {
  topology: AudioTopology | null;
  activeStreams: Stream[];
  onAddStreamForDevice?: (device: string, mode: 'input' | 'output') => void;
}

export function PiHardwareMap({
  topology,
  activeStreams,
  onAddStreamForDevice,
}: PiHardwareMapProps) {
  const [selectedPortId, setSelectedPortId] = useState<string>('gpio_hat');

  const interfaces = topology?.interfaces || [];
  const modelName = topology?.model || 'Raspberry Pi 4 Model B';
  const hatInfo = topology?.hat;

  // Map each interface to running streams
  const getRunningStreamsForDevice = (alsaDevice: string, cardId: string) => {
    return activeStreams.filter((s) => {
      if (!s.enabled) return false;
      const dev = s.hw_device || '';
      return (
        dev === cardId ||
        dev === alsaDevice ||
        dev === `hw:${cardId}` ||
        dev.includes(cardId)
      );
    });
  };

  // Currently selected interface
  const selectedInterface =
    interfaces.find((i) => i.port_id === selectedPortId) ||
    interfaces.find((i) => i.is_primary) ||
    interfaces[0];

  const selectedStreams = selectedInterface
    ? getRunningStreamsForDevice(selectedInterface.alsa_device, selectedInterface.card_id)
    : [];

  const isHatActive = interfaces.some((i) => {
    if (i.type !== 'hat') return false;
    return getRunningStreamsForDevice(i.alsa_device, i.card_id).length > 0;
  });

  const isJackActive = interfaces.some((i) => {
    if (i.type !== 'jack') return false;
    return getRunningStreamsForDevice(i.alsa_device, i.card_id).length > 0;
  });

  const isHdmi0Active = interfaces.some((i) => {
    if (i.port_id !== 'hdmi0') return false;
    return getRunningStreamsForDevice(i.alsa_device, i.card_id).length > 0;
  });

  const isHdmi1Active = interfaces.some((i) => {
    if (i.port_id !== 'hdmi1') return false;
    return getRunningStreamsForDevice(i.alsa_device, i.card_id).length > 0;
  });

  const isUsbActive = interfaces.some((i) => {
    if (i.type !== 'usb') return false;
    return getRunningStreamsForDevice(i.alsa_device, i.card_id).length > 0;
  });

  return (
    <div className="pi-hardware-map-container">
      {/* Topology Header */}
      <div className="hardware-map-header">
        <div className="hw-board-info">
          <div className="hw-board-badge">Hardware Map</div>
          <h3 className="hw-board-model">{modelName}</h3>
          <span className="hw-soc-label">Broadcom BCM2711 Quad-Core Cortex-A72 @ 1.8GHz</span>
        </div>

        <div className="hw-hat-status-badge">
          {hatInfo?.detected ? (
            <div className="hat-detected-pill">
              <span className="hat-pulse-dot" />
              <div className="hat-meta">
                <span className="hat-tag">Mounted Audio HAT</span>
                <span className="hat-title">{hatInfo.name || 'HiFiBerry DAC2 Pro'}</span>
              </div>
            </div>
          ) : (
            <div className="hat-detected-pill no-hat">
              <span className="hat-meta">No HAT EEPROM Detected</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Board Visual Canvas & Inspector Layout */}
      <div className="hardware-schematic-layout">
        {/* SVG Board Schematic */}
        <div className="board-schematic-wrapper">
          <svg
            className="pi-board-svg"
            viewBox="0 0 820 480"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Board Gradients */}
              <linearGradient id="pcbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0e2a1b" />
                <stop offset="50%" stopColor="#081a11" />
                <stop offset="100%" stopColor="#040e08" />
              </linearGradient>

              <linearGradient id="hatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1f1d2e" />
                <stop offset="100%" stopColor="#12111c" />
              </linearGradient>

              <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#555a66" />
                <stop offset="50%" stopColor="#363a42" />
                <stop offset="100%" stopColor="#22252a" />
              </linearGradient>

              <linearGradient id="usb3Grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>

              <linearGradient id="goldPinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>

              {/* Glow Filter */}
              <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Main PCB Board Outline */}
            <rect
              x="20"
              y="20"
              width="780"
              height="440"
              rx="24"
              ry="24"
              fill="url(#pcbGrad)"
              stroke="#1b4332"
              strokeWidth="2.5"
            />

            {/* Board Mounting Holes with Copper Rings */}
            <g fill="#202020" stroke="#b45309" strokeWidth="2.5">
              <circle cx="55" cy="55" r="14" />
              <circle cx="55" cy="425" r="14" />
              <circle cx="585" cy="55" r="14" />
              <circle cx="585" cy="425" r="14" />
            </g>

            {/* Subtle Circuit Traces Texture */}
            <path
              d="M 120,200 L 220,200 L 260,240 M 360,260 L 460,260 M 320,380 L 320,320 L 280,280"
              stroke="#15803d"
              strokeWidth="1.2"
              strokeOpacity="0.3"
              fill="none"
            />

            {/* 2. Broadcom BCM2711 SoC Processor */}
            <rect
              x="240"
              y="210"
              width="100"
              height="100"
              rx="8"
              fill="#27272a"
              stroke="#52525b"
              strokeWidth="1.5"
            />
            <rect
              x="250"
              y="220"
              width="80"
              height="80"
              rx="4"
              fill="#18181b"
              stroke="#3f3f46"
              strokeWidth="1"
            />
            <text x="290" y="255" textAnchor="middle" fill="#a1a1aa" fontSize="10" fontWeight="700">
              BROADCOM
            </text>
            <text x="290" y="270" textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace">
              BCM2711 SoC
            </text>

            {/* 3. LPDDR4 RAM */}
            <rect
              x="360"
              y="225"
              width="65"
              height="70"
              rx="4"
              fill="#222"
              stroke="#444"
              strokeWidth="1"
            />
            <text x="392" y="265" textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="600">
              LPDDR4
            </text>

            {/* 4. 40-Pin GPIO Header (Behind / Beneath HAT) */}
            <rect
              x="50"
              y="28"
              width="360"
              height="40"
              rx="4"
              fill="#111"
              stroke="#ca8a04"
              strokeWidth="1"
            />
            {/* 20 pairs of pins */}
            {Array.from({ length: 20 }).map((_, idx) => (
              <g key={idx}>
                <circle cx={62 + idx * 17.5} cy={38} r="3" fill="url(#goldPinGrad)" />
                <circle cx={62 + idx * 17.5} cy={56} r="3" fill="url(#goldPinGrad)" />
              </g>
            ))}

            {/* 5. MOUNTED AUDIO HAT VISUAL OVERLAY */}
            <g
              className={`clickable-schematic-port ${selectedPortId === 'gpio_hat' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('gpio_hat')}
              style={{ cursor: 'pointer' }}
            >
              {/* HAT Board Canvas */}
              <rect
                x="45"
                y="15"
                width="370"
                height="150"
                rx="14"
                ry="14"
                fill="url(#hatGrad)"
                stroke={isHatActive ? '#10b981' : selectedPortId === 'gpio_hat' ? '#f59e0b' : '#6366f1'}
                strokeWidth={isHatActive || selectedPortId === 'gpio_hat' ? 2.5 : 1.5}
                filter={isHatActive ? 'url(#neonGlow)' : undefined}
              />

              {/* HAT Gold Mounting Screws */}
              <circle cx="65" cy="35" r="7" fill="#111" stroke="#ca8a04" strokeWidth="2" />
              <circle cx="395" cy="35" r="7" fill="#111" stroke="#ca8a04" strokeWidth="2" />

              {/* Stereo RCA Left & Right Audio Jacks (Protruding from top edge) */}
              <g>
                {/* RCA White / Left */}
                <rect x="75" y="2" width="28" height="20" rx="3" fill="#e4e4e7" stroke="#333" strokeWidth="1.5" />
                <circle cx="89" cy="10" r="5" fill="#18181b" stroke="#ca8a04" strokeWidth="1" />

                {/* RCA Red / Right */}
                <rect x="115" y="2" width="28" height="20" rx="3" fill="#ef4444" stroke="#333" strokeWidth="1.5" />
                <circle cx="129" cy="10" r="5" fill="#18181b" stroke="#ca8a04" strokeWidth="1" />

                <text x="103" y="32" textAnchor="middle" fill="#e4e4e7" fontSize="8" fontWeight="700">
                  RCA STEREO OUT
                </text>
              </g>

              {/* Dedicated DAC Chip (Burr-Brown / PCM5122) */}
              <rect x="190" y="55" width="60" height="50" rx="4" fill="#09090b" stroke="#a1a1aa" strokeWidth="1" />
              <text x="220" y="80" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="700">
                PCM512x
              </text>
              <text x="220" y="94" textAnchor="middle" fill="#71717a" fontSize="7">
                384kHz / 32-bit
              </text>

              {/* Dual Low-Jitter Clock Oscillators */}
              <rect x="270" y="60" width="26" height="20" rx="2" fill="#d4d4d8" stroke="#ca8a04" strokeWidth="1" />
              <rect x="270" y="86" width="26" height="20" rx="2" fill="#d4d4d8" stroke="#ca8a04" strokeWidth="1" />
              <text x="310" y="84" fill="#a1a1aa" fontSize="7" fontWeight="600">
                DUAL CLOCKS
              </text>

              {/* HAT Branding Text */}
              <text x="220" y="135" textAnchor="middle" fill="#f4f4f5" fontSize="12" fontWeight="800" letterSpacing="0.05em">
                {hatInfo?.product ? `${hatInfo.vendor || ''} ${hatInfo.product}` : 'HiFiBerry DAC2 Pro'}
              </text>
              <text x="220" y="150" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="600">
                ● 40-PIN I2S BUS ACTIVE
              </text>
            </g>

            {/* 6. Gigabit Ethernet Port (Bottom Right) */}
            <g transform="translate(640, 310)">
              <rect x="0" y="0" width="160" height="110" rx="4" fill="url(#metalGrad)" stroke="#64748b" strokeWidth="1.5" />
              <rect x="20" y="25" width="120" height="65" rx="3" fill="#0f172a" />
              <text x="80" y="65" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="700">
                Gigabit eth0
              </text>
              <circle cx="35" cy="15" r="4" fill="#22c55e" />
              <circle cx="50" cy="15" r="4" fill="#eab308" />
            </g>

            {/* 7. Dual USB 3.0 Ports (Middle Right, Blue Inserts) */}
            <g
              className={`clickable-schematic-port ${selectedPortId === 'usb' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('usb')}
              transform="translate(640, 165)"
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="0"
                y="0"
                width="160"
                height="115"
                rx="4"
                fill="url(#metalGrad)"
                stroke={isUsbActive ? '#10b981' : selectedPortId === 'usb' ? '#f59e0b' : '#0284c7'}
                strokeWidth={isUsbActive || selectedPortId === 'usb' ? 2.5 : 1.5}
                filter={isUsbActive ? 'url(#neonGlow)' : undefined}
              />
              <rect x="15" y="15" width="130" height="38" rx="2" fill="url(#usb3Grad)" />
              <rect x="15" y="65" width="130" height="38" rx="2" fill="url(#usb3Grad)" />
              <text x="80" y="40" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
                USB 3.0
              </text>
              <text x="80" y="90" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
                USB 3.0
              </text>
            </g>

            {/* 8. Dual USB 2.0 Ports (Top Right, Black Inserts) */}
            <g transform="translate(640, 20)">
              <rect x="0" y="0" width="160" height="115" rx="4" fill="url(#metalGrad)" stroke="#475569" strokeWidth="1.5" />
              <rect x="15" y="15" width="130" height="38" rx="2" fill="#09090b" />
              <rect x="15" y="65" width="130" height="38" rx="2" fill="#09090b" />
              <text x="80" y="40" textAnchor="middle" fill="#a1a1aa" fontSize="11" fontWeight="600">
                USB 2.0
              </text>
              <text x="80" y="90" textAnchor="middle" fill="#a1a1aa" fontSize="11" fontWeight="600">
                USB 2.0
              </text>
            </g>

            {/* 9. USB-C Power (Bottom Edge Left) */}
            <g transform="translate(45, 435)">
              <rect x="0" y="0" width="55" height="26" rx="4" fill="url(#metalGrad)" stroke="#52525b" strokeWidth="1" />
              <text x="27" y="17" textAnchor="middle" fill="#a1a1aa" fontSize="8" fontWeight="600">
                5V PWR
              </text>
            </g>

            {/* 10. Micro-HDMI 0 Port (Bottom Edge) */}
            <g
              className={`clickable-schematic-port ${selectedPortId === 'hdmi0' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('hdmi0')}
              transform="translate(130, 430)"
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="0"
                y="0"
                width="60"
                height="30"
                rx="4"
                fill="url(#metalGrad)"
                stroke={isHdmi0Active ? '#10b981' : selectedPortId === 'hdmi0' ? '#f59e0b' : '#52525b'}
                strokeWidth={isHdmi0Active || selectedPortId === 'hdmi0' ? 2.5 : 1.5}
                filter={isHdmi0Active ? 'url(#neonGlow)' : undefined}
              />
              <text x="30" y="19" textAnchor="middle" fill={selectedPortId === 'hdmi0' ? '#f59e0b' : '#e4e4e7'} fontSize="9" fontWeight="700">
                HDMI 0
              </text>
            </g>

            {/* 11. Micro-HDMI 1 Port (Bottom Edge) */}
            <g
              className={`clickable-schematic-port ${selectedPortId === 'hdmi1' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('hdmi1')}
              transform="translate(210, 430)"
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="0"
                y="0"
                width="60"
                height="30"
                rx="4"
                fill="url(#metalGrad)"
                stroke={isHdmi1Active ? '#10b981' : selectedPortId === 'hdmi1' ? '#f59e0b' : '#52525b'}
                strokeWidth={isHdmi1Active || selectedPortId === 'hdmi1' ? 2.5 : 1.5}
                filter={isHdmi1Active ? 'url(#neonGlow)' : undefined}
              />
              <text x="30" y="19" textAnchor="middle" fill={selectedPortId === 'hdmi1' ? '#f59e0b' : '#e4e4e7'} fontSize="9" fontWeight="700">
                HDMI 1
              </text>
            </g>

            {/* 12. 3.5mm TRRS Audio / Video Jack (Bottom Edge) */}
            <g
              className={`clickable-schematic-port ${selectedPortId === 'jack' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('jack')}
              transform="translate(300, 420)"
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="0"
                y="0"
                width="65"
                height="40"
                rx="4"
                fill="#18181b"
                stroke={isJackActive ? '#10b981' : selectedPortId === 'jack' ? '#f59e0b' : '#71717a'}
                strokeWidth={isJackActive || selectedPortId === 'jack' ? 2.5 : 1.5}
                filter={isJackActive ? 'url(#neonGlow)' : undefined}
              />
              <circle cx="32" cy="20" r="9" fill="#09090b" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="32" cy="20" r="4.5" fill="#27272a" />
              <text x="32" y="36" textAnchor="middle" fill={selectedPortId === 'jack' ? '#f59e0b' : '#a1a1aa'} fontSize="7.5" fontWeight="700">
                3.5mm A/V
              </text>
            </g>
          </svg>
        </div>

        {/* Selected Interface Detail Inspector */}
        <div className="port-inspector-panel">
          {selectedInterface ? (
            <div className="inspector-card">
              <div className="inspector-header">
                <div className="inspector-icon-pill">
                  {selectedInterface.type === 'hat' && <RiSpeaker3Line size={20} color="#f59e0b" />}
                  {selectedInterface.type === 'jack' && <FiHeadphones size={20} color="#60a5fa" />}
                  {selectedInterface.type === 'hdmi' && <FiTv size={20} color="#a78bfa" />}
                  {selectedInterface.type === 'usb' && <BsUsbSymbol size={20} color="#38bdf8" />}
                  {selectedInterface.type === 'other' && <GiSoundWaves size={20} color="#34d399" />}
                </div>

                <div className="inspector-title-group">
                  <div className="inspector-type-badge">
                    {selectedInterface.type.toUpperCase()} • {selectedInterface.port}
                  </div>
                  <h4 className="inspector-name">{selectedInterface.card_name}</h4>
                </div>
              </div>

              <div className="inspector-details-table">
                <div className="inspector-row">
                  <span className="row-label">Physical Port</span>
                  <span className="row-val">{selectedInterface.port}</span>
                </div>
                <div className="inspector-row">
                  <span className="row-label">ALSA Device</span>
                  <span className="row-val mono">{selectedInterface.alsa_device}</span>
                </div>
                <div className="inspector-row">
                  <span className="row-label">Capabilities</span>
                  <span className="row-val">
                    {selectedInterface.playback && selectedInterface.capture
                      ? 'Full Duplex (In + Out)'
                      : selectedInterface.playback
                      ? 'Playback Only (Output)'
                      : 'Capture Only (Input)'}
                  </span>
                </div>
                <div className="inspector-row">
                  <span className="row-label">Active Streams</span>
                  <span className="row-val">
                    {selectedStreams.length > 0 ? (
                      <span className="active-streams-tag">
                        <span className="dot pulse" /> {selectedStreams.length} Running
                      </span>
                    ) : (
                      <span className="idle-streams-tag">Idle (0 streams)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              {onAddStreamForDevice && (
                <div className="inspector-actions">
                  <button
                    type="button"
                    className="inspector-action-btn"
                    onClick={() =>
                      onAddStreamForDevice(
                        selectedInterface.card_id,
                        selectedInterface.playback ? 'output' : 'input'
                      )
                    }
                  >
                    <FiPlus size={15} />
                    <span>Create Stream for this Port</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="inspector-card empty">
              <FiInfo size={24} />
              <p>Click any port on the board to inspect hardware details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Interface Badges Carousel / Grid */}
      <div className="interfaces-grid-list">
        {interfaces.map((iface) => {
          const isSelected = iface.port_id === selectedPortId;
          const running = getRunningStreamsForDevice(iface.alsa_device, iface.card_id);
          const isActive = running.length > 0;

          return (
            <div
              key={iface.card_id}
              className={`interface-chip-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedPortId(iface.port_id)}
            >
              <div className="chip-left">
                <div className="chip-icon">
                  {iface.type === 'hat' && <RiSpeaker3Line size={16} />}
                  {iface.type === 'jack' && <FiHeadphones size={16} />}
                  {iface.type === 'hdmi' && <FiTv size={16} />}
                  {iface.type === 'usb' && <BsUsbSymbol size={16} />}
                  {iface.type === 'other' && <GiSoundWaves size={16} />}
                </div>

                <div className="chip-text">
                  <div className="chip-name-row">
                    <span className="chip-name">{iface.card_name}</span>
                    {iface.is_primary && <span className="primary-pill">Primary</span>}
                  </div>
                  <span className="chip-port-desc">{iface.port} • {iface.alsa_device}</span>
                </div>
              </div>

              <div className="chip-right">
                <span className={`chip-status-dot ${isActive ? 'running' : 'idle'}`} title={isActive ? 'Stream running' : 'Ready'} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default PiHardwareMap;
