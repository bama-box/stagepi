import { useState, useEffect } from 'preact/hooks';
import { ToggleSwitch } from '../ui/ToggleSwitch';
// Assuming InfoRow is exported from a shared location or Wifi.tsx
import { InfoRow } from './Wifi';
import './Aes67.css';
import { API_BASE_URL } from '../../config';

// --- TypeScript Interfaces ---
interface Aes67Config {
  addr: string;
  port: string;
  hw_device: string;
  net_device: string;
}

interface Aes67Data {
  name: string;
  description: string;
  config: Aes67Config;
  enabled: boolean;
  active: boolean;
}

interface SoundHardware {
  card_number: number;
  card_name: string;
  card_id: string;
}

export function Aes67() {
  const [aes67Data, setAes67Data] = useState<Aes67Data | null>(null);
  const [editConfig, setEditConfig] = useState<Aes67Config | null>(null);
  const [soundDevices, setSoundDevices] = useState<SoundHardware[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFormDirty = JSON.stringify(aes67Data?.config) !== JSON.stringify(editConfig);

  // --- Data Fetching ---
  const fetchAes67Status = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/services/aes67`)
      .then(res => res.json())
      .then(data => {
        setAes67Data(data);
        setEditConfig(data.config);
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAes67Status();

    fetch(`${API_BASE_URL}/sound-hw/`)
      .then(res => res.json())
      .then(data => setSoundDevices(data.sound_hardware))
      .catch(err => console.error("Failed to fetch sound hardware:", err));
  }, []);

  // --- Event Handlers ---
  const handleToggle = async (newEnabledState: boolean) => {
    // This logic remains correct as it only sends the 'enabled' field
    if (!aes67Data || isSaving) return;
    
    setIsSaving(true);
    const originalData = { ...aes67Data };
    setAes67Data({ ...aes67Data, enabled: newEnabledState });

    try {
      const response = await fetch(`${API_BASE_URL}/services/aes67`, {
        method: 'PATCH',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabledState }),
      });
      if (!response.ok) throw new Error('Failed to update service.');
      const updatedData = await response.json();
      setAes67Data(updatedData);
      setEditConfig(updatedData.config);
    } catch (err: any) {
      setAes67Data(originalData);
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleConfigChange = (e: Event) => {
    const { name, value } = e.target as HTMLInputElement;
    if (editConfig) {
      setEditConfig({ ...editConfig, [name]: value });
    }
  };

  const handleReset = () => {
    if (aes67Data) {
      setEditConfig(aes67Data.config);
    }
  };

  const handleSave = async () => {
    if (!isFormDirty || !editConfig || !aes67Data) return;

    setIsSaving(true);
    try {
      // Create a payload that includes the required 'enabled' field
      const payload = {
        ...editConfig,
        enabled: aes67Data.enabled,
      };

      const response = await fetch(`${API_BASE_URL}/services/aes67`, {
        method: 'PATCH',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload), // Send the complete payload
      });

      if (!response.ok) throw new Error('Failed to save configuration.');
      
      const updatedData = await response.json();
      setAes67Data(updatedData);
      setEditConfig(updatedData.config);

    } catch (err: any) {
      alert(`Error: ${err.message}`);
      handleReset();
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rendering ---
  const renderContent = () => {
    if (loading) return <div className="card">Loading AES67 status...</div>;
    if (error) return <div className="card error">Error: {error.message}</div>;
    if (!aes67Data || !editConfig) return <div className="card">No data available.</div>;

    return (
      <div className="aes67-layout">
        <div className="card">
          <p className="service-description">{aes67Data.description}</p>
          <div className="settings-list">
            <div className={`setting-item ${isSaving ? 'saving' : ''}`}>
              <ToggleSwitch
                label="Enable service"
                checked={aes67Data.enabled}
                onChange={handleToggle}
                disabled={isSaving}
              />
            </div>
            <InfoRow
              label="Service Status"
              value={aes67Data.active ? 'Active' : 'Inactive'}
            />
          </div>
        </div>

        <div className="card">
          <h3>Configuration</h3>
          <div className="config-form">
            <div className="form-row">
              <label htmlFor="addr">Multicast Address</label>
              <input type="text" id="addr" name="addr" value={editConfig.addr} onInput={handleConfigChange} />
            </div>
            <div className="form-row">
              <label htmlFor="port">Port</label>
              <input type="number" id="port" name="port" value={editConfig.port} onInput={handleConfigChange} />
            </div>
            <div className="form-row">
              <label htmlFor="net_device">Network Interface</label>
              <select id="net_device" name="net_device" value={editConfig.net_device} onChange={handleConfigChange}>
                <option value="eth0">eth0</option>
                <option value="wlan0">wlan0</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="hw_device">Hardware Device</label>
              <select id="hw_device" name="hw_device" value={editConfig.hw_device} onChange={handleConfigChange} disabled={soundDevices.length === 0}>
                {soundDevices.length > 0 ? (
                  soundDevices.map(dev => (
                    <option key={dev.card_id} value={`hw:${dev.card_name}`}>
                      {dev.card_name} (Card {dev.card_number})
                    </option>
                  ))
                ) : (
                  <option>Loading devices...</option>
                )}
              </select>
            </div>
            <div className="form-actions">
              <button onClick={handleReset} disabled={!isFormDirty || isSaving} className="button-secondary">Reset</button>
              <button onClick={handleSave} disabled={!isFormDirty || isSaving} className="button-primary">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="aes67-view">
      <h1>AES67</h1>
      {renderContent()}
    </div>
  );
}