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
}

export function Network() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [selectedMode, setSelectedMode] = useState<'auto' | 'manual'>('manual');
  const [editData, setEditData] = useState<NetworkEditData | null>(null);
  const [dnsInput, setDnsInput] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // A computed state to check if the form has been changed
  const isFormDirty = networkData ? (
    selectedMode !== (networkData.mode === 'auto' ? 'auto' : 'manual') ||
    (selectedMode === 'manual' && (
      (editData?.ipAddress ?? '') !== (networkData.ipAddress ?? '') ||
      (editData?.subnetMask ?? '') !== (networkData.subnetMask ?? '') ||
      (editData?.gateway ?? '') !== (networkData.gateway ?? '') ||
      dnsInput.trim() !== (networkData.dnsServers || []).join(', ')
    ))
  ) : false;

  // --- Data Fetching ---
  const fetchNetworkConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/network/config/ethernet`);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data: NetworkData = await response.json();
      setNetworkData(data);
      setSelectedMode(data.mode === 'auto' ? 'auto' : 'manual');
      setEditData({
        ipAddress: data.ipAddress || '',
        subnetMask: data.subnetMask || '',
        gateway: data.gateway || '',
      });
      setDnsInput((data.dnsServers || []).join(', '));
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkConfig();
  }, []);

  // --- Event Handlers ---
  const handleInputChange = (e: Event) => {
    const { name, value } = e.target as HTMLInputElement;
    if (name === 'dnsServers') {
      setDnsInput(value);
    } else if (editData) {
      setEditData({ ...editData, [name]: value });
    }
  };

  const handleReset = () => {
    if (networkData) {
      setSelectedMode(networkData.mode === 'auto' ? 'auto' : 'manual');
      setEditData({
        ipAddress: networkData.ipAddress || '',
        subnetMask: networkData.subnetMask || '',
        gateway: networkData.gateway || '',
      });
      setDnsInput((networkData.dnsServers || []).join(', '));
    }
  };

  const handleSave = async () => {
    if (!isFormDirty) return;

    if (selectedMode === 'auto') {
      const confirmDhcp = window.confirm(
        'Switch Ethernet to DHCP (Automatic)?\n\n' +
        'Warning: The device will release its current static IP and request an address from the network. ' +
        'If no DHCP server is available (e.g. direct cable to laptop), connectivity may be temporarily lost.'
      );
      if (!confirmDhcp) return;

      setIsSaving(true);
      try {
        const response = await fetch(`${API_BASE_URL}/network/config/ethernet`, {
          method: 'DELETE',
          headers: { 'accept': 'application/json' },
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `HTTP Error: ${response.status}`);
        }
        alert('Switched to DHCP mode. If the IP address changes, you may need to reconnect using the new IP address or stagepi.local.');
        await fetchNetworkConfig();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
        handleReset();
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Static mode
    if (!editData) return;
    if (!editData.ipAddress.trim()) {
      alert('IP Address cannot be empty for static configuration.');
      return;
    }
    if (!editData.subnetMask.trim()) {
      alert('Subnet Mask cannot be empty.');
      return;
    }

    const cleanDns = dnsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      ipAddress: editData.ipAddress.trim(),
      subnetMask: editData.subnetMask.trim(),
      gateway: (editData.gateway || '').trim(),
      dnsServers: cleanDns,
    };

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/network/config/ethernet`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP Error: ${response.status}`);
      }
      const updatedData: NetworkData = await response.json();
      setNetworkData(updatedData);
      setSelectedMode(updatedData.mode === 'auto' ? 'auto' : 'manual');
      setEditData({
        ipAddress: updatedData.ipAddress || '',
        subnetMask: updatedData.subnetMask || '',
        gateway: updatedData.gateway || '',
      });
      setDnsInput((updatedData.dnsServers || []).join(', '));
      alert('Ethernet configuration saved successfully.\n\nNote: If you changed the IP address, you will need to access the WebUI at the new IP.');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      handleReset();
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rendering ---
  if (loading) return <div className="card">Loading Network configuration...</div>;
  if (error) return (
    <div className="card error">
      <p>Error: {error.message}</p>
      <button onClick={fetchNetworkConfig} className="button-secondary" style={{ marginTop: '1rem' }}>Retry</button>
    </div>
  );
  if (!networkData || !editData) return <div className="card">No data available.</div>;

  const isDhcp = selectedMode === 'auto';

  return (
    <div className="network-view">
      <h1>Network</h1>
      <div className="card">
        <div className="config-form">
          <div className="form-row">
            <label htmlFor="networkMode">Mode</label>
            <select
              id="networkMode"
              name="networkMode"
              value={selectedMode}
              onChange={(e) => setSelectedMode((e.target as HTMLSelectElement).value as 'auto' | 'manual')}
              disabled={isSaving}
            >
              <option value="auto">DHCP (Automatic)</option>
              <option value="manual">Static IP (Manual)</option>
            </select>
            {isDhcp && <small>Fields below are assigned automatically by DHCP.</small>}
          </div>
          <div className="form-row">
            <label htmlFor="ipAddress">IP Address</label>
            <input
              type="text"
              id="ipAddress"
              name="ipAddress"
              value={editData.ipAddress}
              onInput={handleInputChange}
              disabled={isDhcp || isSaving}
              placeholder="e.g. 192.168.1.100"
            />
          </div>
          <div className="form-row">
            <label htmlFor="subnetMask">Subnet Mask</label>
            <input
              type="text"
              id="subnetMask"
              name="subnetMask"
              value={editData.subnetMask}
              onInput={handleInputChange}
              disabled={isDhcp || isSaving}
              placeholder="e.g. 255.255.255.0 or 24"
            />
            {!isDhcp && <small>Enter subnet mask (e.g. 255.255.255.0) or CIDR prefix (e.g. 24).</small>}
          </div>
          <div className="form-row">
            <label htmlFor="gateway">Gateway</label>
            <input
              type="text"
              id="gateway"
              name="gateway"
              value={editData.gateway}
              onInput={handleInputChange}
              disabled={isDhcp || isSaving}
              placeholder="e.g. 192.168.1.1 (optional)"
            />
            {!isDhcp && <small>Optional for point-to-point direct links.</small>}
          </div>
          <div className="form-row">
            <label htmlFor="dnsServers">DNS Servers</label>
            <input
              type="text"
              id="dnsServers"
              name="dnsServers"
              value={dnsInput}
              onInput={handleInputChange}
              disabled={isDhcp || isSaving}
              placeholder="e.g. 1.1.1.1, 8.8.8.8"
            />
            {!isDhcp && <small>Enter multiple servers separated by a comma (optional).</small>}
          </div>
          <div className="form-actions">
            <button
              onClick={handleReset}
              disabled={!isFormDirty || isSaving}
              className="button-secondary"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormDirty || isSaving}
              className="button-primary"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}