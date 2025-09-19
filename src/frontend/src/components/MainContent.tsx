import type { AppView } from '../types';
import { Resources } from './views/Resources';
import { Wifi } from './views/Wifi'; 
import { Bluetooth } from './views/Bluetooth';
import { Aes67 } from './views/Aes67';
import { Airplay } from './views/Airplay';
import { Network } from './views/Network';
import LedView from './views/LedView';
import './MainContent.css';

interface MainContentProps {
  activeView: AppView;
}

// A simple placeholder for other views for now
function PlaceholderView({ viewName }: { viewName: string }) {
  return (
    <>
      <h1>{viewName}</h1>
      <div class="card">
        <p>This is the content area for the <strong>{viewName}</strong> settings.</p>
      </div>
    </>
  );
}

export function MainContent({ activeView }: MainContentProps) {
  const renderView = () => {
    switch (activeView) {
      case 'Resources':
        return <Resources />;
      case 'Wifi':
        return <Wifi />;
      case 'Network':
        return <Network />;        
      case 'Bluetooth':
        return <Bluetooth />;
      case 'AES67':
        return <Aes67 />;
      case 'Airplay':
        return <Airplay />;
      case 'LED':
        return <LedView />;
      // Add other cases as you build them
      default:
        return <PlaceholderView viewName={activeView} />;
    }
  };

  return (
    <main className="main-content">
      {renderView()}
    </main>
  );
}