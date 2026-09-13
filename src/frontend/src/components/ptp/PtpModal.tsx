import React, { useState, useEffect, useRef } from 'react';
import {
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiRefreshCw,
  FiLayers,
} from 'react-icons/fi';
import { API_BASE_URL } from '../../config';
import type { PtpProfile, PtpStatus } from '../../types';
import './PtpModal.css';

interface PtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus: PtpStatus | null;
  onStatusUpdated?: (status: PtpStatus) => void;
}

export const PtpModal: React.FC<PtpModalProps> = ({
  isOpen,
  onClose,
  initialStatus,
  onStatusUpdated,
}) => {
  const [status, setStatus] = useState<PtpStatus | null>(initialStatus);
  const [profiles, setProfiles] = useState<PtpProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('aes67');
  const [customDomain, setCustomDomain] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const hasUserInteracted = useRef<boolean>(false);

  // Initialize form selection ONLY when modal opens (not on background polls)
  useEffect(() => {
    if (isOpen) {
      hasUserInteracted.current = false;
      const activeProf = initialStatus?.profile || 'aes67';
      const activeDom = initialStatus?.domain ?? 0;
      setStatus(initialStatus);
      setSelectedProfileId(activeProf);
      setCustomDomain(activeDom);
      setMessage(null);

      fetchInitialData(!initialStatus);
      const interval = setInterval(fetchPtpStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Background status poll: updates telemetry ONLY, never overwrites user's draft form selection
  const fetchPtpStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/ptp/status`);
      if (res.ok) {
        const data: PtpStatus = await res.json();
        setStatus(data);
        if (onStatusUpdated) onStatusUpdated(data);
      }
    } catch (err) {
      console.error('Failed to fetch PTP status:', err);
    }
  };

  const fetchInitialData = async (shouldInitForm: boolean = false) => {
    setLoading(true);
    try {
      const [statusRes, profilesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/ptp/status`),
        fetch(`${API_BASE_URL}/ptp/profiles`),
      ]);

      if (statusRes.ok) {
        const statusData: PtpStatus = await statusRes.json();
        setStatus(statusData);
        if (shouldInitForm && !hasUserInteracted.current) {
          setSelectedProfileId(statusData.profile || 'aes67');
          setCustomDomain(statusData.domain ?? 0);
        }
        if (onStatusUpdated) onStatusUpdated(statusData);
      }

      if (profilesRes.ok) {
        const profilesData: PtpProfile[] = await profilesRes.json();
        setProfiles(profilesData);
      }
    } catch (err) {
      console.error('Failed to load PTP configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ptp/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          domain: customDomain,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || 'Failed to update PTP profile');
      }

      setMessage({ text: `Switched PTP profile to '${selectedProfileId.toUpperCase()}' successfully.`, type: 'success' });
      if (resData.current_status) {
        setStatus(resData.current_status);
        if (onStatusUpdated) onStatusUpdated(resData.current_status);
      }

      // Re-fetch profiles so the 'ACTIVE' pill reflects the newly active profile
      fetch(`${API_BASE_URL}/ptp/profiles`)
        .then((r) => (r.ok ? r.json() : null))
        .then((profs) => {
          if (profs) setProfiles(profs);
        })
        .catch(() => {});
    } catch (err: any) {
      setMessage({ text: err.message || 'Error updating PTP profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestartService = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ptp/restart`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to restart ptp4l service');
      setMessage({ text: 'PTP daemon (ptp4l) restarted successfully.', type: 'success' });
      setTimeout(fetchPtpStatus, 1000);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const lockStatus = status?.lock_status || 'inactive';

  return (
    <div className="ptp-modal-backdrop" onClick={onClose}>
      <div className="ptp-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ptp-modal-header">
          <div className="ptp-header-left">
            <div className="ptp-header-icon-pill">
              <FiClock size={22} color="#c084fc" />
            </div>
            <div>
              <h3 className="ptp-modal-title">PTP Clock Synchronization</h3>
              <p className="ptp-modal-subtitle">
                IEEE 1588-2008 / ptp4l Audio-over-IP Clock Synchronization
              </p>
            </div>
          </div>
          <button className="ptp-modal-close-btn" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        {/* Real-time Status Card */}
        <div className={`ptp-status-card ${lockStatus}`}>
          <div className="ptp-card-top-row">
            <div className="ptp-state-badge-group">
              <span className={`ptp-state-dot ${lockStatus}`} />
              <span className="ptp-state-label">
                {lockStatus === 'locked' && 'LOCKED TO GRANDMASTER'}
                {lockStatus === 'master' && 'GRANDMASTER ACTIVE (LOCAL MASTER)'}
                {lockStatus === 'syncing' && 'ACQUIRING PTP LOCK...'}
                {lockStatus === 'free_running' && 'FREE-RUNNING (NO MASTER DETECTED)'}
                {lockStatus === 'faulty' && 'FAULT STATE'}
                {lockStatus === 'inactive' && 'DAEMON INACTIVE / STOPPED'}
              </span>
            </div>

            <button
              className="ptp-refresh-btn"
              onClick={fetchPtpStatus}
              title="Refresh status"
            >
              <FiRefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="ptp-metrics-grid">
            <div className="ptp-metric-item">
              <span className="metric-label">Master Offset</span>
              <span className="metric-val highlight">
                {status?.is_master ? '0.00 µs (GM)' : `${status?.master_offset_us ?? 0.0} µs`}
              </span>
            </div>

            <div className="ptp-metric-item">
              <span className="metric-label">Grandmaster Identity</span>
              <span className="metric-val mono" title={status?.gm_identity}>
                {status?.gm_identity || 'None'}
              </span>
            </div>

            <div className="ptp-metric-item">
              <span className="metric-label">PTP Domain</span>
              <span className="metric-val">Domain {status?.domain ?? 0}</span>
            </div>

            <div className="ptp-metric-item">
              <span className="metric-label">Mean Path Delay</span>
              <span className="metric-val">
                {status?.mean_path_delay_ns != null
                  ? `${(status.mean_path_delay_ns / 1000).toFixed(2)} µs`
                  : '0.00 µs'}
              </span>
            </div>

            <div className="ptp-metric-item">
              <span className="metric-label">Port State</span>
              <span className="metric-val badge-style">{status?.state || 'STOPPED'}</span>
            </div>

            <div className="ptp-metric-item">
              <span className="metric-label">Network Interface</span>
              <span className="metric-val">
                {status?.interface || 'eth0'} ({status?.timestamping || 'software'})
              </span>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`ptp-message-banner ${message.type}`}>
            {message.type === 'success' ? <FiCheckCircle size={16} /> : <FiAlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Profile Configuration Section */}
        <div className="ptp-section">
          <div className="ptp-section-header">
            <FiLayers size={18} color="#94a3b8" />
            <h4 className="ptp-section-title">Operational PTP Profile</h4>
          </div>

          <div className="ptp-profiles-grid">
            {profiles.map((p) => {
              const isSelected = selectedProfileId === p.id;
              const radioId = `ptp-profile-${p.id}`;
              const selectThisProfile = () => {
                hasUserInteracted.current = true;
                setSelectedProfileId(p.id);
                setCustomDomain(p.domain);
              };

              return (
                <div
                  key={p.id}
                  className={`ptp-profile-card ${isSelected ? 'selected' : ''}`}
                  onClick={selectThisProfile}
                >
                  <div className="profile-radio-row">
                    <input
                      type="radio"
                      id={radioId}
                      name="ptp-profile"
                      value={p.id}
                      checked={isSelected}
                      onChange={selectThisProfile}
                    />
                    <label htmlFor={radioId} className="profile-card-name" onClick={(e) => e.stopPropagation()}>
                      {p.name}
                    </label>
                    {p.is_active && <span className="profile-active-pill">ACTIVE</span>}
                  </div>
                  <p className="profile-card-desc">{p.description}</p>
                  <div className="profile-specs">
                    <span>Domain {p.domain}</span>
                    <span>•</span>
                    <span>Sync: {Math.round(2 ** -p.logSyncInterval)} pkt/s</span>
                    <span>•</span>
                    <span>{p.delay_mechanism}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Domain Customization */}
          <div className="ptp-domain-row">
            <label htmlFor="ptp-domain-input" className="domain-label">
              Override Domain Number (0–127):
            </label>
            <input
              id="ptp-domain-input"
              type="number"
              min={0}
              max={127}
              value={customDomain}
              onChange={(e) => {
                hasUserInteracted.current = true;
                setCustomDomain(parseInt((e.target as HTMLInputElement).value, 10) || 0);
              }}
              className="domain-input"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="ptp-modal-footer">
          <button
            type="button"
            className="ptp-secondary-btn"
            onClick={handleRestartService}
            disabled={saving}
          >
            <FiRefreshCw size={15} className={saving ? 'spin' : ''} />
            <span>Restart Daemon</span>
          </button>

          <div className="footer-right-actions">
            <button type="button" className="ptp-cancel-btn" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="ptp-primary-btn"
              onClick={handleApplyProfile}
              disabled={saving}
            >
              {saving ? 'Applying...' : 'Apply Profile & Restart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
