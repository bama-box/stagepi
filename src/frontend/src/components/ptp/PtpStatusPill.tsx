import React from 'react';
import { FiClock } from 'react-icons/fi';
import type { PtpStatus } from '../../types';
import './PtpStatusPill.css';

interface PtpStatusPillProps {
  status: PtpStatus | null;
  loading?: boolean;
  onClick: () => void;
}

export const PtpStatusPill: React.FC<PtpStatusPillProps> = ({
  status,
  loading = false,
  onClick,
}) => {
  if (loading && !status) {
    return (
      <div className="ptp-status-pill loading" onClick={onClick} title="Loading PTP status...">
        <FiClock className="ptp-pill-icon spin" size={14} />
        <span className="ptp-pill-label">PTP...</span>
      </div>
    );
  }

  const lockStatus = status?.lock_status || 'inactive';
  let badgeClass = 'inactive';
  let label = 'PTP: Inactive';

  switch (lockStatus) {
    case 'locked':
      badgeClass = 'locked';
      label = `PTP: Locked (${status?.master_offset_us != null ? `${status.master_offset_us}µs` : 'Sync'})`;
      break;
    case 'master':
      badgeClass = 'master';
      label = `PTP: Master (GM)`;
      break;
    case 'syncing':
      badgeClass = 'syncing';
      label = 'PTP: Syncing...';
      break;
    case 'free_running':
      badgeClass = 'free-running';
      label = 'PTP: Free-Run';
      break;
    case 'faulty':
      badgeClass = 'faulty';
      label = 'PTP: Fault';
      break;
    default:
      badgeClass = 'inactive';
      label = 'PTP: Stopped';
      break;
  }

  return (
    <button
      type="button"
      className={`ptp-status-pill ${badgeClass}`}
      onClick={onClick}
      title={`PTP Clock Status: ${status?.state || 'Unknown'} (${status?.profile_name || 'PTPv2'})\nClick to inspect clock & configure profile.`}
    >
      <span className="ptp-pulse-indicator">
        <span className="ptp-dot" />
      </span>
      <FiClock className="ptp-pill-icon" size={14} />
      <span className="ptp-pill-text">{label}</span>
      {status?.profile && status.profile !== 'default' && (
        <span className="ptp-profile-tag">{status.profile.toUpperCase()}</span>
      )}
    </button>
  );
};
