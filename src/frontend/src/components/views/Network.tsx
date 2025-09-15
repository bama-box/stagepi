import { useState, useEffect } from 'preact/hooks';
import './Network.css';
import { API_BASE_URL } from '../../config';

// --- TypeScript Interfaces ---
// For the data we receive (GET)
interface NetworkData {
  mode: string;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsServers: string[];
}

// For the data we send (PUT)
interface NetworkEditData {
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsServers: string[];
}

export function Network() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [editData, setEditData] = useState<NetworkEditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // A computed state to check if the form has been changed
  const isFormDirty = networkData ? JSON.stringify({
    ipAddress: networkData.ipAddress,
    subnetMask: networkData.subnetMask,
    gateway: networkData.gateway,
    dnsServers: networkData.dnsServers,
  }) !== JSON.stringify(editData) : false;

  // --- Data Fetching ---
  useEffect(() => {
    const fetchNetworkConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/network/config/ethernet`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data: NetworkData = await response.json();
        setNetworkData(data);
        // Initialize the form state with the fetched data
        setEditData({
          ipAddress: data.ipAddress,
          subnetMask: data.subnetMask,
          gateway: data.gateway,
          dnsServers: data.dnsServers,
        });
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNetworkConfig();
  }, []);

  // --- Event Handlers ---
  const handleInputChange = (e: Event) => {
    const { name, value } = e.target as HTMLInputElement;
    if (editData) {
      // Handle DNS servers array from a comma-separated string
      if (name === 'dnsServers') {
        setEditData({ ...editData, [name]: value.split(',').map(s => s.trim()) });
      } else {
        setEditData({ ...editData, [name]: value });
      }
    }
  };

  const handleReset = () => {
    if (networkData) {
      setEditData({
        ipAddress: networkData.ipAddress,
        subnetMask: networkData.subnetMask,
        gateway: networkData.gateway,
        dnsServers: networkData.dnsServers,
      });
    }
  };

  const handleSave = async () => {
    if (!isFormDirty || !editData) return;
    setIsSaving(true);
    try {
      const response = await fetch('/network/config/ethernet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify(editData),
      });
      if (!response.ok) throw new Error('Failed to save configuration.');
      const updatedData = await response.json();
      setNetworkData(updatedData);
      setEditData({
        ipAddress: updatedData.ipAddress,
        subnetMask: updatedData.subnetMask,
        gateway: updatedData.gateway,
        dnsServers: updatedData.dnsServers,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      handleReset();
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rendering ---
  if (loading) return <div className="card">Loading Network configuration...</div>;
  if (error) return <div className="card error">Error: {error.message}</div>;
  if (!networkData || !editData) return <div className="card">No data available.</div>;

  return (
    <div className="network-view">
      <h1>Network</h1>
      <div className="card">
        <div className="config-form">
          <div className="form-row">
            <label>Mode</label>
            <input type="text" value={networkData.mode} disabled />
          </div>
          <div className="form-row">
            <label htmlFor="ipAddress">IP Address</label>
            <input type="text" id="ipAddress" name="ipAddress" value={editData.ipAddress} onInput={handleInputChange} />
          </div>
          <div className="form-row">
            <label htmlFor="subnetMask">Subnet Mask</label>
            <input type="text" id="subnetMask" name="subnetMask" value={editData.subnetMask} onInput={handleInputChange} />
          </div>
          <div className="form-row">
            <label htmlFor="gateway">Gateway</label>
            <input type="text" id="gateway" name="gateway" value={editData.gateway} onInput={handleInputChange} />
          </div>
          <div className="form-row">
            <label htmlFor="dnsServers">DNS Servers</label>
            <input type="text" id="dnsServers" name="dnsServers" value={editData.dnsServers.join(', ')} onInput={handleInputChange} />
            <small>Enter multiple servers separated by a comma.</small>
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
}