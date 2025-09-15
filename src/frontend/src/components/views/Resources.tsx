import { useState, useEffect } from 'preact/hooks';
import { ProgressBar } from '../ui/ProgressBar';
import { FiCpu, FiDatabase, FiDisc, FiThermometer } from 'react-icons/fi';
import './Resources.css';
import { API_BASE_URL } from '../../config';

// TypeScript interfaces for our API data
interface Cpu {
  usage: number;
  temperature: { value: number; unit: string; };
}
interface Memory {
  total: number;
  used: number;
  unit: string;
}
interface Disk {
  total: number;
  used: number;
  usage: number;
  unit: string;
}
interface ResourcesData {
  cpu: Cpu;
  memory: Memory;
  disk: Disk;
  uptime: number;
}
export function Resources() {
  const [resources, setResources] = useState<ResourcesData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchResources = () => {
      fetch(`${API_BASE_URL}/system/resources`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          return res.json();
        })
        .then(data => setResources(data))
        .catch(err => setError(err));
    };

    fetchResources();
    const intervalId = setInterval(fetchResources, 2000);
    return () => clearInterval(intervalId);
  }, []);

  if (error) {
    return <div className="card error">Error loading resources: {error.message}</div>;
  }

  if (!resources) {
    return <div className="card">Loading resources...</div>;
  }

  const memUsagePercent = (resources.memory.used / resources.memory.total) * 100;

  return (
    <div className="resources-grid">
      <div className="card">
        {/* 2. Add CPU icon */}
        <h3><FiCpu /> CPU</h3>
        <ProgressBar value={resources.cpu.usage} label={`${resources.cpu.usage.toFixed(1)}%`} />
        <div className="metric">
          {/* 2. Add the icon and a wrapper span for alignment */}
           <span class="metric-label">
            <FiThermometer size={14} />
            <span>Temperature</span>
          </span>
          <span>{resources.cpu.temperature.value.toFixed(1)} °{resources.cpu.temperature.unit.charAt(0).toUpperCase()}</span>
        </div>
      </div>
      <div className="card">
        {/* 3. Add Memory icon */}
        <h3><FiDatabase /> Memory</h3>
        <ProgressBar value={memUsagePercent} label={`${memUsagePercent.toFixed(1)}%`} />
        <div className="metric">
          <span>Used / Total</span>
          <span>{resources.memory.used} / {resources.memory.total} {resources.memory.unit}</span>
        </div>
      </div>
      <div className="card full-width">
        {/* 4. Add Disk icon */}
        <h3><FiDisc /> Disk</h3>
        <ProgressBar value={resources.disk.usage} label={`${resources.disk.usage.toFixed(1)}%`} />
        <div className="metric">
          <span>Used / Total</span>
          <span>{resources.disk.used.toFixed(2)} / {resources.disk.total.toFixed(2)} {resources.disk.unit}</span>
        </div>
      </div>
    </div>
  );
}