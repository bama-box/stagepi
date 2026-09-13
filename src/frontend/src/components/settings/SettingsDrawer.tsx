import { useState, useEffect } from 'preact/hooks';
import { FiX, FiWifi, FiCpu, FiInfo, FiSliders } from 'react-icons/fi';
import { BsEthernet } from 'react-icons/bs';
import { RiAirplayLine, RiBluetoothLine } from 'react-icons/ri';
import { Network } from '../views/Network';
import { Wifi } from '../views/Wifi';
import { Airplay } from '../views/Airplay';
import { Bluetooth } from '../views/Bluetooth';
import { Resources } from '../views/Resources';
import LedView from '../views/LedView';
import './SettingsDrawer.css';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  deviceId?: string;
}

export function SettingsDrawer({ isOpen, onClose, initialTab, deviceId }: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<string>('ethernet');
  const [auxSubTab, setAuxSubTab] = useState<'airplay' | 'bluetooth'>('airplay');
  const [sysSubTab, setSysSubTab] = useState<'resources' | 'leds'>('resources');

  useEffect(() => {
    if (initialTab) {
      if (initialTab === 'network') setActiveTab('ethernet');
      else setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-drawer-overlay" onClick={onClose}>
      <div className="settings-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-drawer-header">
          <div className="settings-drawer-title-group">
            <FiSliders className="settings-title-icon" size={20} />
            <h2 className="settings-drawer-title">Appliance Settings</h2>
          </div>
          <button 
            type="button" 
            className="settings-drawer-close-btn" 
            onClick={onClose}
            aria-label="Close settings"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs-nav">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'ethernet' ? 'active' : ''}`}
            onClick={() => setActiveTab('ethernet')}
          >
            <BsEthernet size={16} />
            <span>Ethernet</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'wifi' ? 'active' : ''}`}
            onClick={() => setActiveTab('wifi')}
          >
            <FiWifi size={16} />
            <span>Wi-Fi</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'aux' ? 'active' : ''}`}
            onClick={() => setActiveTab('aux')}
          >
            <RiAirplayLine size={16} />
            <span>Aux Services</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <FiCpu size={16} />
            <span>System & LEDs</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <FiInfo size={16} />
            <span>About</span>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="settings-drawer-content">
          {activeTab === 'ethernet' && (
            <div className="settings-tab-pane">
              <Network />
            </div>
          )}

          {activeTab === 'wifi' && (
            <div className="settings-tab-pane">
              <Wifi />
            </div>
          )}

          {activeTab === 'aux' && (
            <div className="settings-tab-pane">
              <div className="settings-subtabs">
                <button
                  type="button"
                  className={`settings-subtab-btn ${auxSubTab === 'airplay' ? 'active' : ''}`}
                  onClick={() => setAuxSubTab('airplay')}
                >
                  <RiAirplayLine size={14} /> AirPlay (Shairport-sync)
                </button>
                <button
                  type="button"
                  className={`settings-subtab-btn ${auxSubTab === 'bluetooth' ? 'active' : ''}`}
                  onClick={() => setAuxSubTab('bluetooth')}
                >
                  <RiBluetoothLine size={14} /> Bluetooth Audio
                </button>
              </div>
              <div className="settings-subtab-content">
                {auxSubTab === 'airplay' ? <Airplay /> : <Bluetooth />}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="settings-tab-pane">
              <div className="settings-subtabs">
                <button
                  type="button"
                  className={`settings-subtab-btn ${sysSubTab === 'resources' ? 'active' : ''}`}
                  onClick={() => setSysSubTab('resources')}
                >
                  <FiCpu size={14} /> Resources & Thermal
                </button>
                <button
                  type="button"
                  className={`settings-subtab-btn ${sysSubTab === 'leds' ? 'active' : ''}`}
                  onClick={() => setSysSubTab('leds')}
                >
                  LED Indicators
                </button>
              </div>
              <div className="settings-subtab-content">
                {sysSubTab === 'resources' ? <Resources /> : <LedView />}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-tab-pane settings-about-pane">
              <div className="about-card">
                <div className="about-header">
                  <div className="about-badge">StagePi Appliance</div>
                  <h3>StagePi Audio Node</h3>
                  <p className="about-desc">
                    Ultra-low latency AES67 / NMOS and multi-protocol network audio endpoint for Raspberry Pi.
                  </p>
                </div>

                <div className="about-details-list">
                  <div className="about-row">
                    <span className="about-label">Device Identifier</span>
                    <span className="about-val mono">{deviceId || 'Raspberry Pi'}</span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Appliance Software</span>
                    <span className="about-val">StagePi v1.0.0 (Lean Edition)</span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Supported Protocols</span>
                    <span className="about-val">AES67 RTP, SAP, NMOS, AirPlay, Bluetooth</span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Supported Sample Rates</span>
                    <span className="about-val">48,000 Hz, 44,100 Hz (16/24-bit PCM)</span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Supervisor Stack</span>
                    <span className="about-val">supervisord + alsa-utils + pipewire-ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
