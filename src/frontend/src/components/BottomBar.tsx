import { useState, useEffect } from 'preact/hooks';
import { FiZap, FiServer, FiClock, FiPackage } from 'react-icons/fi';
import './BottomBar.css';
import { API_BASE_URL } from '../config';

// Interface and helper function remain the same
interface SystemStatus {
  status: string;
  ipAddress: string;
  uptime: number;
  firmwareVersion: string;
}

function formatUptime(seconds: number): string {
    // ... same formatUptime function as before
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    let result = '';
    if (d > 0) result += `${d}d `;
    if (h > 0) result += `${h}h `;
    if (m > 0) result += `${m}m `;
    result += `${s}s`;
    return result.trim();
}

export function BottomBar() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const fetchStatus = () => {
      const apiUrl = `${API_BASE_URL}/system/status`;
      fetch(apiUrl)
        .then(res => res.json())
        .then((data: SystemStatus) => setStatus(data))
        .catch(console.error);
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <footer className="bottom-bar">
      {status ? (
        <>
          {/* 2. Add icons to each status item */}
          <div className="status-item">
            <FiZap size={14} />
            <strong>Status:</strong>
            <span>{status.status}</span>
          </div>
          <div className="status-item">
            <FiServer size={14} />
            <strong>IP:</strong>
            <span>{status.ipAddress}</span>
          </div>
          <div className="status-item">
            <FiClock size={14} />
            <strong>Uptime:</strong>
            <span>{formatUptime(status.uptime)}</span>
          </div>
          <div className="status-item">
            <FiPackage size={14} />
            <strong>Firmware:</strong>
            <span>{status.firmwareVersion}</span>
          </div>
        </>
      ) : (
        <span>Loading status...</span>
      )}
    </footer>
  );
}