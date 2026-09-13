import { useState, useEffect } from 'preact/hooks';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { InfoRow } from './Wifi';
import './Bluetooth.css';
import { API_BASE_URL } from '../../config';
import { useNotification } from '../../context/NotificationContext';

interface BluetoothData {
  name: string;
  description: string;
  config: object;
  enabled: boolean;
  active: boolean;
}

export function Bluetooth() {
  const { notify } = useNotification();
  const [btData, setBtData] = useState<BluetoothData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // New state for tracking the PATCH request
  const [error, setError] = useState<Error | null>(null);

  const fetchBluetoothStatus = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/services/bluetooth`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then(data => setBtData(data))
      .catch(err => {
        setError(err);
        notify({
          type: 'error',
          title: 'Bluetooth Status Error',
          message: err.message || 'Failed to load Bluetooth service',
          source: 'Bluetooth',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBluetoothStatus();
  }, []);

  const handleToggle = async (newEnabledState: boolean) => {
    if (!btData || isSaving) return;

    const originalData = { ...btData };
    setBtData({ ...btData, enabled: newEnabledState });
    setIsSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/services/bluetooth`, {
        method: 'PATCH', // Use the correct PATCH method
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: newEnabledState,
        }),
      });

      if (!response.ok) {
        // If the server responds with an error, try to parse it
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update service.' }));
        throw new Error(errorData.detail || `HTTP Error ${response.status}`);
      }

      // If successful, update state with the confirmed data from the server
      const updatedData = await response.json();
      setBtData(updatedData);

      notify({
        type: 'info',
        title: 'Bluetooth Service',
        message: `Bluetooth is now ${newEnabledState ? 'enabled' : 'disabled'}.`,
        source: 'Bluetooth',
      });
    } catch (err: any) {
      // If the request fails, revert the UI to its original state
      setBtData(originalData);
      notify({
        type: 'error',
        title: 'Bluetooth Toggle Failed',
        message: err.message,
        source: 'Bluetooth',
      });
    } finally {
      // Always stop the saving indicator
      setIsSaving(false);
    }
  };

  const renderContent = () => {
    if (loading) return <div className="card">Loading Bluetooth status...</div>;
    if (error) return <div className="card error">Error: {error.message}</div>;
    if (!btData) return <div className="card">No data available.</div>;

    return (
      <div className="card">
        <p className="service-description">{btData.description}</p>
        <div className="settings-list">
          <div className={`setting-item ${isSaving ? 'saving' : ''}`}>
            <ToggleSwitch
              label="Enable service"
              checked={btData.enabled}
              onChange={handleToggle}
              disabled={isSaving} // Disable the toggle while saving
            />
          </div>
          <InfoRow
            label="Service Status"
            value={btData.active ? 'Active' : 'Inactive'}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bluetooth-view">
      <h1>Bluetooth</h1>
      {renderContent()}
    </div>
  );
}