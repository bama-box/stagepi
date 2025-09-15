import { useState, useEffect } from 'preact/hooks';
import './app.css';
import { TopBar } from './components/TopBar';
import { SideBar } from './components/SideBar';
import { MainContent } from './components/MainContent';
import { BottomBar } from './components/BottomBar';
import type { AppView } from './types';
import { API_BASE_URL } from './config';

export function App() {
  const [activeView, setActiveView] = useState<AppView>('Resources');
  const [deviceId, setDeviceId] = useState<string>('Loading...');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Fetch the deviceId once for the TopBar
  useEffect(() => {
    fetch(`${API_BASE_URL}/system/status`)
      .then(res => res.json())
      .then(data => setDeviceId(data.deviceId))
      .catch(() => setDeviceId('Error'));
  }, []);

  return (
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
    </div>
  );
}
