import { GiSoundOn } from "react-icons/gi";
import { FaFingerprint } from "react-icons/fa";
import { FiBell, FiSettings } from 'react-icons/fi';
import { useNotification } from '../context/NotificationContext';
import './TopBar.css';

interface TopBarProps {
  deviceId: string;
  onOpenSettings: () => void;
}

export function TopBar({ deviceId, onOpenSettings }: TopBarProps) {
  const { toggleDrawer, unreadCount, unreadErrorCount } = useNotification();

  const hasErrors = unreadErrorCount > 0;
  const displayCount = hasErrors ? unreadErrorCount : unreadCount;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <div className="logo-container">
          <GiSoundOn size={28} className="logo-icon" />
          <div className="logo-text-group">
            <span className="logo-text">StagePi</span>
            <span className="logo-badge">Audio Node</span>
          </div>
        </div>
      </div>

      <div className="top-bar-right">
        {/* Device ID / Fingerprint */}
        <div className="device-info" title={`Hardware ID: ${deviceId}`}>
          <FaFingerprint size={14} />
          <span>{deviceId}</span>
        </div>

        {/* Settings Gear Button */}
        <button
          type="button"
          className="topbar-action-btn settings-btn"
          onClick={onOpenSettings}
          title="Appliance Settings (Network, Wi-Fi, Aux Services, Hardware)"
          aria-label="Appliance Settings"
        >
          <FiSettings size={17} />
          <span className="btn-label">Settings</span>
        </button>

        {/* Notification Bell */}
        <button
          type="button"
          className={`notif-bell-btn ${hasErrors ? 'has-errors' : unreadCount > 0 ? 'has-notifs' : ''}`}
          onClick={toggleDrawer}
          title={hasErrors ? `${unreadErrorCount} unread errors - Click to open Event Center` : 'Notifications & Events'}
          aria-label="System Notifications & Events"
        >
          <FiBell size={18} className="bell-icon" />
          {displayCount > 0 && (
            <span className={`notif-badge ${hasErrors ? 'badge-error' : 'badge-info'}`}>
              {displayCount > 99 ? '99+' : displayCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}


