import { GiSoundOn } from "react-icons/gi";
import { FaFingerprint } from "react-icons/fa";
import { FiMenu } from 'react-icons/fi';
import './TopBar.css';

interface TopBarProps {
  deviceId: string;
  onMenuClick: () => void;
}


export function TopBar({ deviceId, onMenuClick }: TopBarProps) {
  return (
    <header className="top-bar">
      <button className="hamburger-menu" onClick={onMenuClick}>
        <FiMenu size={24} />
      </button>

      <div className="logo-container">
        <GiSoundOn size={28} className="logo-icon" />
        <span className="logo-text">StagePi</span>
      </div>
      <div className="device-info">
        <FaFingerprint size={14} />
        <span>{deviceId}</span>
      </div>
    </header>
  );
}
