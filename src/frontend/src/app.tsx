import { useState, useEffect } from 'preact/hooks';
import './app.css';
import { TopBar } from './components/TopBar';
import { SideBar } from './components/SideBar';
import { MainContent } from './components/MainContent';
import { BottomBar } from './components/BottomBar';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/notifications/ToastContainer';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import type { AppView } from './types';
import { API_BASE_URL } from './config';


const VIEW_MAP: Record<string, AppView> = {
  resources: 'Resources',
  network: 'Network',
  wifi: 'Wifi',
  airplay: 'Airplay',
  bluetooth: 'Bluetooth',
  aes67: 'AES67',
  led: 'LED',
};

function getInitialView(): AppView {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash && VIEW_MAP[hash]) {
    return VIEW_MAP[hash];
  }
  const saved = localStorage.getItem('stagepi_active_view');
  if (saved && Object.values(VIEW_MAP).includes(saved as AppView)) {
    return saved as AppView;
  }
  return 'Resources';
}

export function App() {
  const [activeView, setActiveViewState] = useState<AppView>(getInitialView);
  const [deviceId, setDeviceId] = useState<string>('Loading...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const setActiveView = (view: AppView) => {
    setActiveViewState(view);
    localStorage.setItem('stagepi_active_view', view);
    const targetHash = `#/${view.toLowerCase()}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (hash && VIEW_MAP[hash]) {
        setActiveViewState(VIEW_MAP[hash]);
        localStorage.setItem('stagepi_active_view', VIEW_MAP[hash]);
      }
    };

    if (!window.location.hash) {
      window.location.hash = `#/${activeView.toLowerCase()}`;
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeView]);

  // Fetch the deviceId once for the TopBar
  useEffect(() => {
    fetch(`${API_BASE_URL}/system/status`)
      .then(res => res.json())
      .then(data => setDeviceId(data.deviceId))
      .catch(() => setDeviceId('Error'));
  }, []);

  return (
    <NotificationProvider>
      <div id="app-container">
        {/* We will pass the state and functions down as props */}
        <TopBar deviceId={deviceId} onMenuClick={() => setIsSidebarOpen(true)} />
        <SideBar 
          activeView={activeView} 
          setActiveView={setActiveView}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)} 
        />
        
        {/* This overlay will appear behind the sidebar to allow closing it */}
        {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

        <MainContent activeView={activeView} />
        <BottomBar />

        {/* Global Notifications UI */}
        <ToastContainer />
        <NotificationDrawer />
      </div>
    </NotificationProvider>
  );
}

