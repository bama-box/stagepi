import { useState, useEffect } from 'preact/hooks';
import './app.css';
import { TopBar } from './components/TopBar';
import { ApplianceDashboard } from './components/dashboard/ApplianceDashboard';
import { SettingsDrawer } from './components/settings/SettingsDrawer';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/notifications/ToastContainer';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { API_BASE_URL } from './config';

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
          <ApplianceDashboard onOpenSettings={handleOpenSettings} />
        </main>

        {/* Settings Slide-Over Drawer */}
        <SettingsDrawer
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          initialTab={settingsTab}
          deviceId={deviceId}
        />

        {/* Global Notifications UI */}
        <ToastContainer />
        <NotificationDrawer />
      </div>
    </NotificationProvider>
  );
}
export default App;
