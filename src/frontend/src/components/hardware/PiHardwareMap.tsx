import { useState } from 'preact/hooks';
import {
  FiHeadphones,
  FiTv,
  FiPlus,
  FiInfo,
  FiClock,
} from 'react-icons/fi';
import { RiSpeaker3Line } from 'react-icons/ri';
import { GiSoundWaves } from 'react-icons/gi';
import { BsUsbSymbol, BsEthernet } from 'react-icons/bs';
import type { Stream } from '../views/StreamModal';
import type { PtpStatus } from '../../types';
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
  ptpStatus?: PtpStatus | null;
  onAddStreamForDevice?: (device: string, mode: 'input' | 'output') => void;
  onOpenPtp?: () => void;
}

export function PiHardwareMap({
  topology,
  activeStreams,
  ptpStatus,
  onAddStreamForDevice,
  onOpenPtp,
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
  const isEthernetSelected = selectedPortId === 'ethernet';
  const selectedInterface = isEthernetSelected
    ? null
    : (interfaces.find((i) => i.port_id === selectedPortId) ||
       interfaces.find((i) => i.is_primary) ||
       interfaces[0]);

  const selectedStreams = selectedInterface
    ? getRunningStreamsForDevice(selectedInterface.alsa_device, selectedInterface.card_id)
    : [];

  const isHatActive = interfaces.some((i) => {
    if (i.type !== 'hat') return false;
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
    <div className="pi-hardware-map-container stagebox-theme">
      {/* Topology Header */}
      <div className="hardware-map-header">
        <div className="hw-board-info">
          <div className="hw-badge-row">
            <span className="hw-board-badge">Hardware Appliance</span>
            <span className="hw-chassis-badge">Rugged Metal Stagebox</span>
          </div>
          <h3 className="hw-board-model">{modelName}</h3>
          <span className="hw-soc-label">
            Enclosure: Industrial Aluminum Audio Box • Architecture: BCM2711 Quad-Core
          </span>
        </div>

        <div className="hw-hat-status-badge">
          {hatInfo?.detected ? (
            <div className={`hat-detected-pill ${isHatActive ? 'stream-live' : ''}`}>
              <span className={`hat-pulse-dot ${isHatActive ? 'live' : ''}`} />
              <div className="hat-meta">
                <span className="hat-tag">Audio HAT Mounted</span>
                <span className="hat-title">{hatInfo.name || 'HiFiBerry DAC2 Pro'}</span>
              </div>
            </div>
          ) : (
            <div className="hat-detected-pill no-hat">
              <span className="hat-meta">No Audio HAT Detected</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D Physical Stagebox Chassis Visual Hero */}
      <div className="stagebox-hero-wrapper">
        <div className="stagebox-canvas-container">
          <svg
            className="stagebox-chassis-svg"
            viewBox="160 15 605 480"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Chassis Metallic Gradients */}
              <linearGradient id="chassisTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2c2d36" />
                <stop offset="50%" stopColor="#1e1f26" />
                <stop offset="100%" stopColor="#15161b" />
              </linearGradient>

              <linearGradient id="chassisFront" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e2029" />
                <stop offset="60%" stopColor="#13141b" />
                <stop offset="100%" stopColor="#0b0c10" />
              </linearGradient>

              <linearGradient id="chassisSide" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#171821" />
                <stop offset="100%" stopColor="#08090d" />
              </linearGradient>

              <linearGradient id="bevelLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4a4d5a" />
                <stop offset="100%" stopColor="#1a1b22" />
              </linearGradient>

              <linearGradient id="xlrMetalFlange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3f3f46" />
                <stop offset="50%" stopColor="#1f1f23" />
                <stop offset="100%" stopColor="#111114" />
              </linearGradient>

              <linearGradient id="goldPin" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>

              <linearGradient id="rj45Metal" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#71717a" />
                <stop offset="50%" stopColor="#3f3f46" />
                <stop offset="100%" stopColor="#18181b" />
              </linearGradient>

              <linearGradient id="usb3Blue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>

              {/* Shadow Filters */}
              <filter id="chassisShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="16" />
                <feOffset dx="0" dy="24" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.6" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="activeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Drop Shadow Under Enclosure */}
            <ellipse cx="465" cy="460" rx="290" ry="25" fill="rgba(0,0,0,0.6)" filter="url(#chassisShadow)" />

            {/* ======================================================== */}
            {/* 1. TOP PLATE (Isometric parallelogram)                     */}
            {/* ======================================================== */}
            <polygon
              points="450,140 180,60 480,25 750,95"
              fill="url(#chassisTop)"
              stroke="#3b3d4a"
              strokeWidth="1.5"
            />
            {/* Top Plate Bevel Edge */}
            <polygon
              points="450,140 450,146 180,66 180,60"
              fill="url(#bevelLight)"
              stroke="none"
            />
            <polygon
              points="450,140 750,95 750,101 450,146"
              fill="#1b1c24"
              stroke="none"
            />

            {/* ======================================================== */}
            {/* 2. FRONT FACE (Dual XLR Outputs & Lower I/O)              */}
            {/* Coordinates: Top (180,66) to (450,146), Bottom (180,380) to (450,470) */}
            {/* ======================================================== */}
            <g
              className={`clickable-chassis-part ${selectedPortId === 'gpio_hat' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('gpio_hat')}
              style={{ cursor: 'pointer' }}
            >
              {/* Front Plate Canvas */}
              <polygon
                points="180,66 450,146 450,470 180,380"
                fill="url(#chassisFront)"
                stroke={isHatActive ? '#10b981' : selectedPortId === 'gpio_hat' ? '#f59e0b' : '#333542'}
                strokeWidth={isHatActive || selectedPortId === 'gpio_hat' ? 2.5 : 1.2}
                filter={isHatActive ? 'url(#activeGlow)' : undefined}
              />

              {/* Upper Recessed XLR Panel Plate */}
              <polygon
                points="195,95 435,165 435,320 195,245"
                fill="#0f1016"
                stroke="#2a2c38"
                strokeWidth="1.5"
              />

              {/* 4 Corner Screws for XLR Mounting Plate */}
              <circle cx="206" cy="106" r="3.5" fill="#2d303e" stroke="#181920" />
              <circle cx="424" cy="172" r="3.5" fill="#2d303e" stroke="#181920" />
              <circle cx="206" cy="237" r="3.5" fill="#2d303e" stroke="#181920" />
              <circle cx="424" cy="309" r="3.5" fill="#2d303e" stroke="#181920" />

              {/* ------------------------------------------------------ */}
              {/* XLR PORT 1 (Left / Balanced Out 1)                    */}
              {/* ------------------------------------------------------ */}
              <g transform="translate(265, 175)">
                {/* Active Halo */}
                {isHatActive && (
                  <ellipse cx="0" cy="0" rx="42" ry="46" fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" strokeWidth="2" filter="url(#activeGlow)" />
                )}
                {/* Metal D-Flange Plate */}
                <ellipse cx="0" cy="0" rx="35" ry="39" fill="url(#xlrMetalFlange)" stroke="#52525b" strokeWidth="2" />
                {/* Inner Socket Well */}
                <ellipse cx="0" cy="0" rx="27" ry="30" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
                {/* 3 Gold XLR Contact Pins */}
                <circle cx="-9" cy="-7" r="3.5" fill="url(#goldPin)" stroke="#78350f" strokeWidth="0.8" />
                <circle cx="9" cy="-7" r="3.5" fill="url(#goldPin)" stroke="#78350f" strokeWidth="0.8" />
                <circle cx="0" cy="10" r="3.5" fill="url(#goldPin)" stroke="#78350f" strokeWidth="0.8" />
                {/* XLR Release Latch (Top) */}
                <rect x="-6" y="-32" width="12" height="5" rx="1" fill="#71717a" />
                {/* Engraved Port Label */}
                <text x="0" y="47" textAnchor="middle" fill={selectedPortId === 'gpio_hat' ? '#f59e0b' : '#e4e4e7'} fontSize="10" fontWeight="800" letterSpacing="0.05em">
                  BALANCED OUT 1
                </text>
                <text x="0" y="58" textAnchor="middle" fill="#9ca3af" fontSize="8" fontWeight="600">
                  (LEFT / CH 1)
                </text>
              </g>

              {/* ------------------------------------------------------ */}
              {/* XLR PORT 2 (Right / Balanced Out 2)                   */}
              {/* ------------------------------------------------------ */}
              <g transform="translate(365, 205)">
                {/* Active Halo */}
                {isHatActive && (
                  <ellipse cx="0" cy="0" rx="42" ry="46" fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" strokeWidth="2" filter="url(#activeGlow)" />
                )}
                {/* Metal D-Flange Plate */}
                <ellipse cx="0" cy="0" rx="35" ry="39" fill="url(#xlrMetalFlange)" stroke="#52525b" strokeWidth="2" />
                {/* Inner Socket Well */}
                <ellipse cx="0" cy="0" rx="27" ry="30" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
                {/* 3 Gold XLR Contact Pins */}
                <circle cx="-9" cy="-7" r="3.5" fill="url(#goldPin)" stroke="#78350f" strokeWidth="0.8" />
                <circle cx="9" cy="-7" r="3.5" fill="url(#goldPin)" stroke="#78350f" strokeWidth="0.8" />
                <circle cx="0" cy="10" r="3.5" fill="url(#goldPin)" stroke="#78350f" strokeWidth="0.8" />
                {/* XLR Release Latch (Top) */}
                <rect x="-6" y="-32" width="12" height="5" rx="1" fill="#71717a" />
                {/* Engraved Port Label */}
                <text x="0" y="47" textAnchor="middle" fill={selectedPortId === 'gpio_hat' ? '#f59e0b' : '#e4e4e7'} fontSize="10" fontWeight="800" letterSpacing="0.05em">
                  BALANCED OUT 2
                </text>
                <text x="0" y="58" textAnchor="middle" fill="#9ca3af" fontSize="8" fontWeight="600">
                  (RIGHT / CH 2)
                </text>
              </g>

              {/* Audio HAT Header Tag on Front Face */}
              <text x="310" y="118" textAnchor="middle" fill="#f59e0b" fontSize="12" fontWeight="900" letterSpacing="0.08em">
                {hatInfo?.name ? hatInfo.name.toUpperCase() : 'HIFIBERRY AUDIO HAT'}
              </text>
              <text x="310" y="132" textAnchor="middle" fill={isHatActive ? '#10b981' : '#71717a'} fontSize="9" fontWeight="700">
                {isHatActive ? '● AES67 STREAM ROUTING LIVE' : '○ 24-BIT / 192KHZ HARDWARE READY'}
              </text>

              {/* Lower Partition Seam Line */}
              <line x1="180" y1="360" x2="450" y2="442" stroke="#2a2c38" strokeWidth="1.5" />

              {/* ------------------------------------------------------ */}
              {/* Lower Tier Ports: USB-C Power & Micro-HDMI 0 / 1      */}
              {/* ------------------------------------------------------ */}
              {/* USB-C 5V DC Power */}
              <g transform="translate(225, 388)">
                <rect x="-14" y="-7" width="28" height="14" rx="4" fill="#09090b" stroke="#52525b" strokeWidth="1" />
                <text x="0" y="18" textAnchor="middle" fill="#71717a" fontSize="7.5" fontWeight="700">
                  USB-C 5V
                </text>
              </g>

              {/* Micro-HDMI 0 */}
              <g
                className={`clickable-subport ${selectedPortId === 'hdmi0' ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPortId('hdmi0');
                }}
                transform="translate(295, 410)"
              >
                <rect
                  x="-13"
                  y="-6"
                  width="26"
                  height="13"
                  rx="2"
                  fill="#09090b"
                  stroke={isHdmi0Active ? '#10b981' : selectedPortId === 'hdmi0' ? '#f59e0b' : '#52525b'}
                  strokeWidth={selectedPortId === 'hdmi0' ? 2 : 1}
                />
                <text x="0" y="18" textAnchor="middle" fill={selectedPortId === 'hdmi0' ? '#f59e0b' : '#9ca3af'} fontSize="8" fontWeight="700">
                  HDMI 0
                </text>
              </g>

              {/* Micro-HDMI 1 */}
              <g
                className={`clickable-subport ${selectedPortId === 'hdmi1' ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPortId('hdmi1');
                }}
                transform="translate(365, 432)"
              >
                <rect
                  x="-13"
                  y="-6"
                  width="26"
                  height="13"
                  rx="2"
                  fill="#09090b"
                  stroke={isHdmi1Active ? '#10b981' : selectedPortId === 'hdmi1' ? '#f59e0b' : '#52525b'}
                  strokeWidth={selectedPortId === 'hdmi1' ? 2 : 1}
                />
                <text x="0" y="18" textAnchor="middle" fill={selectedPortId === 'hdmi1' ? '#f59e0b' : '#9ca3af'} fontSize="8" fontWeight="700">
                  HDMI 1
                </text>
              </g>
            </g>

            {/* ======================================================== */}
            {/* 3. RIGHT SIDE FACE (RJ45 Gigabit Ethernet & USB Ports)    */}
            {/* Coordinates: Top (450,146) to (750,95), Bottom (450,470) to (750,395) */}
            {/* ======================================================== */}
            <polygon
              points="450,146 750,95 750,395 450,470"
              fill="url(#chassisSide)"
              stroke="#2c2e3b"
              strokeWidth="1.2"
            />

            {/* Cooling Ventilation Slots (Upper Side Panel) */}
            <g transform="translate(490, 160)">
              {/* Row 1 */}
              <polygon points="0,0 80,-14 80,-8 0,6" fill="#090a0d" />
              <polygon points="100,-17 180,-31 180,-25 100,-11" fill="#090a0d" />
              {/* Row 2 */}
              <polygon points="0,18 80,4 80,10 0,24" fill="#090a0d" />
              <polygon points="100,1 180,-13 180,-7 100,7" fill="#090a0d" />
            </g>

            {/* ------------------------------------------------------ */}
            {/* GIGABIT ETHERNET PORT (RJ45)                          */}
            {/* ------------------------------------------------------ */}
            <g
              className="clickable-chassis-part"
              onClick={() => setSelectedPortId('ethernet')}
              transform="translate(485, 290)"
              style={{ cursor: 'pointer' }}
            >
              {/* Outer Port Cutout */}
              <polygon points="0,0 60,-10 60,65 0,78" fill="url(#rj45Metal)" stroke="#64748b" strokeWidth="1.5" />
              {/* Inner Cavity */}
              <polygon points="8,8 52,-1 52,56 8,67" fill="#0f172a" />
              {/* Gold RJ45 Contact Springs */}
              <line x1="16" y1="18" x2="44" y2="13" stroke="#ca8a04" strokeWidth="2.5" strokeDasharray="3,2" />
              {/* Link LEDs */}
              <circle cx="16" cy="55" r="3" fill="#22c55e" filter="url(#activeGlow)" />
              <circle cx="26" cy="53" r="3" fill="#eab308" />
              {/* Label */}
              <text x="30" y="85" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="800">
                1GbE RJ45 (eth0)
              </text>
            </g>

            {/* ------------------------------------------------------ */}
            {/* STACKED DUAL USB 3.0 PORTS (Blue)                      */}
            {/* ------------------------------------------------------ */}
            <g
              className={`clickable-chassis-part ${selectedPortId === 'usb' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('usb')}
              transform="translate(565, 275)"
              style={{ cursor: 'pointer' }}
            >
              <polygon
                points="0,0 60,-10 60,70 0,82"
                fill="url(#rj45Metal)"
                stroke={isUsbActive ? '#10b981' : selectedPortId === 'usb' ? '#f59e0b' : '#0284c7'}
                strokeWidth={selectedPortId === 'usb' ? 2 : 1.2}
              />
              {/* Dual Blue USB 3.0 Insert Blocks */}
              <polygon points="8,8 52,-1 52,28 8,36" fill="url(#usb3Blue)" />
              <polygon points="8,42 52,33 52,62 8,70" fill="url(#usb3Blue)" />
              <text x="30" y="90" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="800">
                USB 3.0
              </text>
            </g>

            {/* ------------------------------------------------------ */}
            {/* STACKED DUAL USB 2.0 PORTS (Black)                     */}
            {/* ------------------------------------------------------ */}
            <g
              className={`clickable-chassis-part ${selectedPortId === 'usb' ? 'selected' : ''}`}
              onClick={() => setSelectedPortId('usb')}
              transform="translate(645, 260)"
              style={{ cursor: 'pointer' }}
            >
              <polygon
                points="0,0 60,-10 60,70 0,82"
                fill="url(#rj45Metal)"
                stroke={selectedPortId === 'usb' ? '#f59e0b' : '#475569'}
                strokeWidth={selectedPortId === 'usb' ? 2 : 1.2}
              />
              {/* Dual Black USB 2.0 Insert Blocks */}
              <polygon points="8,8 52,-1 52,28 8,36" fill="#09090b" />
              <polygon points="8,42 52,33 52,62 8,70" fill="#09090b" />
              <text x="30" y="90" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">
                USB 2.0
              </text>
            </g>
          </svg>
        </div>

        {/* Focused Connector Inspector Bar (Horizontal, taking NO side space) */}
        {isEthernetSelected ? (
          <div className="focused-connector-bar ethernet-bar">
            <div className="connector-bar-main">
              <div className="connector-bar-icon-pill" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                <BsEthernet size={24} color="#38bdf8" />
              </div>

              <div className="connector-bar-info">
                <div className="connector-bar-tags">
                  <span className="connector-type-badge" style={{ color: '#38bdf8' }}>NETWORK AoIP</span>
                  <span className="connector-port-badge">RJ45 Gigabit Ethernet • eth0</span>
                  <span className="connector-alsa-badge">10.42.10.2</span>
                </div>
                <h4 className="connector-bar-title">Gigabit Ethernet Network Trunk</h4>
              </div>
            </div>

            <div className="connector-bar-stats">
              <div className="connector-stat-item">
                <span className="stat-label">PTP Clock Status</span>
                <span className="stat-val">
                  {ptpStatus?.lock_status === 'locked' && (
                    <span className="active-streams-tag">
                      <span className="dot pulse" /> Locked ({ptpStatus.master_offset_us}µs)
                    </span>
                  )}
                  {ptpStatus?.lock_status === 'master' && (
                    <span style={{ color: '#d8b4fe', fontWeight: 700 }}>
                      Grandmaster (Domain {ptpStatus.domain})
                    </span>
                  )}
                  {ptpStatus?.lock_status === 'syncing' && (
                    <span style={{ color: '#fde047', fontWeight: 700 }}>
                      Acquiring Lock...
                    </span>
                  )}
                  {(!ptpStatus || ptpStatus.lock_status === 'free_running' || ptpStatus.lock_status === 'inactive') && (
                    <span className="idle-streams-tag">
                      {ptpStatus?.lock_status === 'free_running' ? 'Free-Running' : 'Daemon Stopped'}
                    </span>
                  )}
                </span>
              </div>

              <div className="connector-stat-item">
                <span className="stat-label">Active Profile</span>
                <span className="stat-val">{ptpStatus?.profile_name || 'RAVENNA / AES67'}</span>
              </div>
            </div>

            {onOpenPtp && (
              <div className="connector-bar-actions">
                <button
                  type="button"
                  className="connector-action-btn"
                  onClick={onOpenPtp}
                  title="Configure PTP profiles and inspect clock synchronization"
                >
                  <FiClock size={16} />
                  <span>Configure PTP Clock</span>
                </button>
              </div>
            )}
          </div>
        ) : selectedInterface ? (
          <div className="focused-connector-bar">
            <div className="connector-bar-main">
              <div className="connector-bar-icon-pill">
                {selectedInterface.type === 'hat' && <RiSpeaker3Line size={24} color="#f59e0b" />}
                {selectedInterface.type === 'jack' && <FiHeadphones size={24} color="#60a5fa" />}
                {selectedInterface.type === 'hdmi' && <FiTv size={24} color="#a78bfa" />}
                {selectedInterface.type === 'usb' && <BsUsbSymbol size={24} color="#38bdf8" />}
                {selectedInterface.type === 'other' && <GiSoundWaves size={24} color="#34d399" />}
              </div>

              <div className="connector-bar-info">
                <div className="connector-bar-tags">
                  <span className="connector-type-badge">{selectedInterface.type.toUpperCase()}</span>
                  <span className="connector-port-badge">
                    {selectedInterface.type === 'hat'
                      ? 'Dual Balanced XLR Outputs'
                      : selectedInterface.port}
                  </span>
                  <span className="connector-alsa-badge">{selectedInterface.alsa_device}</span>
                </div>
                <h4 className="connector-bar-title">{selectedInterface.card_name}</h4>
              </div>
            </div>

            <div className="connector-bar-stats">
              <div className="connector-stat-item">
                <span className="stat-label">Direction</span>
                <span className="stat-val">
                  {selectedInterface.playback && selectedInterface.capture
                    ? 'Full Duplex (In + Out)'
                    : selectedInterface.playback
                    ? 'Stereo Playback (Output)'
                    : 'Capture (Input)'}
                </span>
              </div>

              <div className="connector-stat-item">
                <span className="stat-label">Active Streams</span>
                <span className="stat-val">
                  {selectedStreams.length > 0 ? (
                    <span className="active-streams-tag">
                      <span className="dot pulse" /> {selectedStreams.length} Running
                    </span>
                  ) : (
                    <span className="idle-streams-tag">Idle</span>
                  )}
                </span>
              </div>
            </div>

            {onAddStreamForDevice && (
              <div className="connector-bar-actions">
                <button
                  type="button"
                  className="connector-action-btn"
                  onClick={() =>
                    onAddStreamForDevice(
                      selectedInterface.card_id,
                      selectedInterface.playback ? 'output' : 'input'
                    )
                  }
                >
                  <FiPlus size={16} />
                  <span>Create Stream on {selectedInterface.card_name}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="focused-connector-bar empty">
            <FiInfo size={20} />
            <span>Click any connector on the stagebox chassis to inspect port details.</span>
          </div>
        )}
      </div>

      {/* Rack Mount Connector Chips Bar */}
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
                  {iface.type === 'hat' && <RiSpeaker3Line size={18} />}
                  {iface.type === 'jack' && <FiHeadphones size={18} />}
                  {iface.type === 'hdmi' && <FiTv size={18} />}
                  {iface.type === 'usb' && <BsUsbSymbol size={18} />}
                  {iface.type === 'other' && <GiSoundWaves size={18} />}
                </div>

                <div className="chip-text">
                  <div className="chip-name-row">
                    <span className="chip-name">{iface.card_name}</span>
                    {iface.is_primary && <span className="primary-pill">Primary HAT</span>}
                  </div>
                  <span className="chip-port-desc">
                    {iface.type === 'hat' ? 'Dual XLR Out' : iface.port} • {iface.alsa_device}
                  </span>
                </div>
              </div>

              <div className="chip-right">
                <span
                  className={`chip-status-dot ${isActive ? 'running' : 'idle'}`}
                  title={isActive ? 'Active AoIP Stream Running' : 'Port Ready'}
                />
              </div>
            </div>
          );
        })}

        {/* Network Port Chip */}
        <div
          className={`interface-chip-card ${selectedPortId === 'ethernet' ? 'selected' : ''}`}
          onClick={() => setSelectedPortId('ethernet')}
        >
          <div className="chip-left">
            <div className="chip-icon">
              <BsEthernet size={18} />
            </div>
            <div className="chip-text">
              <div className="chip-name-row">
                <span className="chip-name">Gigabit Ethernet</span>
                <span className="network-pill">Network AoIP</span>
              </div>
              <span className="chip-port-desc">RJ45 Port • eth0 (10.42.10.2)</span>
            </div>
          </div>
          <div className="chip-right">
            <span className="chip-status-dot running" title="Ethernet Link Active" />
          </div>
        </div>
      </div>
    </div>
  );
}
export default PiHardwareMap;
