import { useState, useEffect } from 'preact/hooks';
import { ToggleSwitch } from '../ui/ToggleSwitch';
// Assuming InfoRow is exported from a shared location or Wifi.tsx
import { InfoRow } from './Wifi';
import './Airplay.css';
import { API_BASE_URL } from '../../config';

// --- TypeScript Interfaces ---
interface AirplayConfig {
  adv_name: string;
  hw_device: string;
}

interface AirplayData {
  name: string;
  description: string;
  config: AirplayConfig;
  enabled: boolean;
  active: boolean;
}

interface SoundHardware {
  card_number: number;
  card_name: string;
  card_id: string;
}

export function Airplay() {
  const [AirplayData, setAirplayData] = useState<AirplayData | null>(null);
  const [editConfig, setEditConfig] = useState<AirplayConfig | null>(null);
  const [soundDevices, setSoundDevices] = useState<SoundHardware[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFormDirty = JSON.stringify(AirplayData?.config) !== JSON.stringify(editConfig);

  // --- Data Fetching ---
  const fetchAirplayStatus = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/services/airplay`)
      .then(res => res.json())
      .then(data => {
        setAirplayData(data);
        setEditConfig(data.config);
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAirplayStatus();

    fetch(`${API_BASE_URL}/sound-hw/`)
      .then(res => res.json())
      .then(data => setSoundDevices(data.sound_hardware))
      .catch(err => console.error("Failed to fetch sound hardware:", err));
  }, []);

  // --- Event Handlers ---
  const handleToggle = async (newEnabledState: boolean) => {
    // This logic remains correct as it only sends the 'enabled' field
    if (!AirplayData || isSaving) return;
    
    setIsSaving(true);
    const originalData = { ...AirplayData };
    setAirplayData({ ...AirplayData, enabled: newEnabledState });

    try {
      const response = await fetch(`${API_BASE_URL}/services/airplay`, {
        method: 'PATCH',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabledState }),
      });
      if (!response.ok) throw new Error('Failed to update service.');
      const updatedData = await response.json();
      setAirplayData(updatedData);
      setEditConfig(updatedData.config);
    } catch (err: any) {
      setAirplayData(originalData);
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
    if (AirplayData) {
      setEditConfig(AirplayData.config);
    }
  };

  const handleSave = async () => {
    if (!isFormDirty || !editConfig || !AirplayData) return;

    setIsSaving(true);
    try {
      // Create a payload that includes the required 'enabled' field
      const payload = {
        ...editConfig,
        enabled: AirplayData.enabled,
      };

      const response = await fetch(`${API_BASE_URL}/services/airplay`, {
        method: 'PATCH',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload), // Send the complete payload
      });

      if (!response.ok) throw new Error('Failed to save configuration.');
      
      const updatedData = await response.json();
      setAirplayData(updatedData);
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
    if (loading) return <div className="card">Loading Airplay status...</div>;
    if (error) return <div className="card error">Error: {error.message}</div>;
    if (!AirplayData || !editConfig) return <div className="card">No data available.</div>;

    return (
      <div className="Airplay-layout">
        <div className="card">
          <p className="service-description">{AirplayData.description}</p>
          <div className="settings-list">
            <div className={`setting-item ${isSaving ? 'saving' : ''}`}>
              <ToggleSwitch
                label="Enable service"
                checked={AirplayData.enabled}
                onChange={handleToggle}
                disabled={isSaving}
              />
            </div>
            <InfoRow
              label="Service Status"
              value={AirplayData.active ? 'Active' : 'Inactive'}
            />
          </div>
        </div>

        <div className="card">
          <h3>Configuration</h3>
          <div className="config-form">
            <div className="form-row">
              <label htmlFor="adv_name">Advertised Name</label>          
              <input type="text" id="adv_name" name="adv_name" value={editConfig.adv_name} onInput={handleConfigChange} />
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
    <div className="Airplay-view">
      <h1>Airplay</h1>
      {renderContent()}
    </div>
  );
}