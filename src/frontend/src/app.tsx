import { useState, useEffect } from 'preact/hooks';
import './app.css';
import { TopBar } from './components/TopBar';
import { ApplianceDashboard } from './components/dashboard/ApplianceDashboard';
import { SettingsDrawer } from './components/settings/SettingsDrawer';
import { PtpModal } from './components/ptp/PtpModal';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/notifications/ToastContainer';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { API_BASE_URL } from './config';
import type { PtpStatus } from './types';

const SETTINGS_HASHES: Record<string, string> = {
  ethernet: 'ethernet',
  network: 'ethernet',
  wifi: 'wifi',
  aux: 'aux',
  airplay: 'aux',
  bluetooth: 'aux',
  system: 'system',
  resources: 'system',
  led: 'system',
  about: 'about',
  settings: 'ethernet',
};

export function App() {
  const [deviceId, setDeviceId] = useState<string>('Loading...');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('ethernet');

  // PTP Clock state & modal
  const [ptpStatus, setPtpStatus] = useState<PtpStatus | null>(null);
  const [isPtpModalOpen, setIsPtpModalOpen] = useState(false);

  const handleOpenSettings = (tab?: string) => {
    const targetTab = tab || settingsTab || 'ethernet';
    setSettingsTab(targetTab);
    setIsSettingsOpen(true);
    window.location.hash = `#/${targetTab}`;
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (window.location.hash && window.location.hash !== '#/dashboard') {
      history.replaceState(null, '', ' ');
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (rawHash && SETTINGS_HASHES[rawHash]) {
        setSettingsTab(SETTINGS_HASHES[rawHash]);
        setIsSettingsOpen(true);
      } else if (rawHash === '' || rawHash === 'dashboard') {
        setIsSettingsOpen(false);
      }
    };

    // Check hash on initial load
    const initialHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (initialHash && SETTINGS_HASHES[initialHash]) {
      setSettingsTab(SETTINGS_HASHES[initialHash]);
      setIsSettingsOpen(true);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch deviceId once for TopBar and Settings
  useEffect(() => {
    fetch(`${API_BASE_URL}/system/status`)
      .then((res) => res.json())
      .then((data) => setDeviceId(data.deviceId || 'StagePi'))
      .catch(() => setDeviceId('StagePi'));
  }, []);

  // Poll PTP clock status
  useEffect(() => {
    const fetchPtp = () => {
      fetch(`${API_BASE_URL}/ptp/status`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PtpStatus | null) => {
          if (data) setPtpStatus(data);
        })
        .catch(() => {});
    };

    fetchPtp();
    const interval = setInterval(fetchPtp, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationProvider>
      <div id="app-container">
        {/* Top Header */}
        <TopBar
          deviceId={deviceId}
          onOpenSettings={() => handleOpenSettings()}
        />

        {/* Main Appliance Dashboard */}
        <main id="main-content">
          <ApplianceDashboard
            onOpenSettings={handleOpenSettings}
            ptpStatus={ptpStatus}
            onOpenPtp={() => setIsPtpModalOpen(true)}
          />
        </main>

        {/* Settings Slide-Over Drawer */}
        <SettingsDrawer
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          initialTab={settingsTab}
          deviceId={deviceId}
        />

        {/* PTP Clock Inspector & Profile Selector Modal */}
        <PtpModal
          isOpen={isPtpModalOpen}
          onClose={() => setIsPtpModalOpen(false)}
          initialStatus={ptpStatus}
          onStatusUpdated={setPtpStatus}
        />

        {/* Global Notifications UI */}
        <ToastContainer />
        <NotificationDrawer />
      </div>
    </NotificationProvider>
  );
}
export default App;
