import { GiSoundOn } from "react-icons/gi";
import { FaFingerprint } from "react-icons/fa";
import { FiMenu, FiBell } from 'react-icons/fi';
import { useNotification } from '../context/NotificationContext';
import './TopBar.css';

interface TopBarProps {
  deviceId: string;
  onMenuClick: () => void;
}

export function TopBar({ deviceId, onMenuClick }: TopBarProps) {
  const { toggleDrawer, unreadCount, unreadErrorCount } = useNotification();

  const hasErrors = unreadErrorCount > 0;
  const displayCount = hasErrors ? unreadErrorCount : unreadCount;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button className="hamburger-menu" onClick={onMenuClick} aria-label="Toggle navigation menu">
          <FiMenu size={24} />
        </button>

        <div className="logo-container">
          <GiSoundOn size={28} className="logo-icon" />
          <span className="logo-text">StagePi</span>
        </div>
      </div>

      <div className="top-bar-right">
        <button
          type="button"
          className={`notif-bell-btn ${hasErrors ? 'has-errors' : unreadCount > 0 ? 'has-notifs' : ''}`}
          onClick={toggleDrawer}
          title={hasErrors ? `${unreadErrorCount} unread errors - Click to open Event Center` : 'Notifications & Events'}
          aria-label="System Notifications & Events"
        >
          <FiBell size={20} className="bell-icon" />
          {displayCount > 0 && (
            <span className={`notif-badge ${hasErrors ? 'badge-error' : 'badge-info'}`}>
              {displayCount > 99 ? '99+' : displayCount}
            </span>
          )}
        </button>

        <div className="device-info">
          <FaFingerprint size={14} />
          <span>{deviceId}</span>
        </div>
      </div>
    </header>
  );
}

