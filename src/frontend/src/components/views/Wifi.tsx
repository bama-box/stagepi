import { useState, useEffect } from 'preact/hooks';
import { FiRefreshCw } from 'react-icons/fi';
import './Wifi.css';
import { API_BASE_URL } from '../../config';

// --- TypeScript Interfaces ---
interface ClientConfig {
  connected: boolean;
  region: string;
  ssid: string;
  device: string;
  mode: string;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsServers: string[];
}

interface WifiData {
  deviceMode: 'client' | 'ap';
  clientConfig: ClientConfig | null;
}

// A reusable component for displaying a row of data
export function InfoRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || 'N/A'}</span>
    </div>
  );
}

export function Wifi() {
  const [wifiData, setWifiData] = useState<WifiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // --- New State for Form ---
  const [selectedMode, setSelectedMode] = useState<'client' | 'hotspot'>('client');
  const [editSsid, setEditSsid] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRegion, setEditRegion] = useState('');

  const fetchWifiConfig = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/network/config/wifi`)
      .then(res => res.json())
      .then(data => {
        setWifiData(data);
        // Set the initial selected mode based on the device's current mode
        setSelectedMode(data.deviceMode === 'ap' ? 'hotspot' : 'client');
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWifiConfig();
  }, []);

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setIsSaving(true);
    let body = {};
    const requestOptions: RequestInit =  {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
    };

    if (selectedMode === 'client') {
      if (!editSsid) {
        alert('SSID cannot be empty.');
        setIsSaving(false);
        return;
      }
    }
    body = { mode: selectedMode, ssid: editSsid, password: editPassword, region: editRegion };
    requestOptions.body = JSON.stringify(body);
  
    try {
      const response = await fetch(`${API_BASE_URL}/network/config/wifi`, requestOptions);
  
      if (!response.ok) throw new Error(`Failed to set ${selectedMode} mode.`);

      alert(`Successfully switched to ${selectedMode} mode. The device may restart or take a moment to apply changes.`);
      setEditRegion('');
      setEditSsid('');
      setEditPassword('');
      fetchWifiConfig();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderCurrentConfig = () => {
    if (!wifiData) return null;

    // Store clientConfig in a variable for easier access and checking
    const clientConfig = wifiData.clientConfig;

    return (
      <div className="card">
        <div className="card-header">
            Current Mode: <span className="device-mode">{wifiData.deviceMode.toUpperCase()}</span>
        </div>

        {/* --- Client Mode --- */}
        {/* First, check if the mode is 'client', then check if clientConfig is not null */}
        {wifiData.deviceMode === 'client' && clientConfig ? (
          <>
            <InfoRow label="Status" value={clientConfig.connected ? 'Connected' : 'Disconnected'} />
            <InfoRow label="Region" value={clientConfig.region} />
            <InfoRow label="SSID" value={clientConfig.ssid} />
            <InfoRow label="Device" value={clientConfig.device} />            
            <InfoRow label="IP Address" value={clientConfig.ipAddress} />
            <InfoRow label="Subnet Mask" value={clientConfig.subnetMask} />
            <InfoRow label="Gateway" value={clientConfig.gateway} />
            <InfoRow label="DNS Servers" value={clientConfig.dnsServers?.join(', ')} />
          </>
        ) : null}

        {/* --- Hotspot (AP) Mode --- */}
        {wifiData.deviceMode === 'ap' && clientConfig ? (
          <>
            <InfoRow label="Hotspot Name" value={clientConfig.ssid} />
            <InfoRow label="Password" value="stage314" />
            <InfoRow label="Device" value={clientConfig.device} />            
            <InfoRow label="Region" value={clientConfig.region} />
            <p>The device is currently acting as a hotspot</p>
          </>
        ) : null}
      </div>
    );
  };
  
  if (loading) return <div className="card">Loading Wi-Fi configuration...</div>;
  if (error) return <div className="card error">Error: {error.message}</div>;

  return (
    <div className="wifi-view">
      <div className="view-header">
        <h1>Wi-Fi</h1>
        <button onClick={fetchWifiConfig} disabled={loading || isSaving} className="refresh-button">
          <FiRefreshCw className={loading || isSaving ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {renderCurrentConfig()}

      <div className="card">
        <h3>Change Mode</h3>
        <form onSubmit={handleSave}>
          <div className="mode-selector">
            <label className={selectedMode === 'client' ? 'active' : ''}>
              <input type="radio" name="mode" value="client" checked={selectedMode === 'client'} onChange={() => setSelectedMode('client')} />
              Connect as Client
            </label>
            <label className={selectedMode === 'hotspot' ? 'active' : ''}>
              <input type="radio" name="mode" value="hotspot" checked={selectedMode === 'hotspot'} onChange={() => setSelectedMode('hotspot')} />
              Create Hotspot
            </label>
          </div>

          {selectedMode === 'client' && (
            <div className="client-fields">
              <div className="form-row">
                <label htmlFor="ssid">Network Name (SSID)</label>
                <input type="text" id="ssid" value={editSsid} onInput={(e) => setEditSsid((e.target as HTMLInputElement).value)} placeholder="Enter Wi-Fi name" />
              </div>
              <div className="form-row">
                <label htmlFor="password">Password</label>
                <input type="password" id="password" value={editPassword} onInput={(e) => setEditPassword((e.target as HTMLInputElement).value)} placeholder="Enter Wi-Fi password" />
              </div>
              <div className="form-row">
                <label htmlFor="region">Region (Two letter code)</label>
                <input type="text" id="region" value={editRegion} onInput={(e) => setEditRegion((e.target as HTMLInputElement).value)} placeholder="Enter Wi-Fi Region" />
              </div>

            </div>
          )}
          {selectedMode === 'hotspot' && (
            <div className="client-fields">
              <div className="form-row">
                <label htmlFor="region">Region (Two letter code)</label>
                <input type="text" id="region" value={editRegion} onInput={(e) => setEditRegion((e.target as HTMLInputElement).value)} placeholder="Enter Wi-Fi Region" />
              </div>

            </div>
          )}


          <div className="form-actions">
            <button type="submit" disabled={isSaving} className="button-primary">
              {isSaving ? 'Applying...' : `Apply ${selectedMode === 'client' ? 'Client' : 'Hotspot'} Mode`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}