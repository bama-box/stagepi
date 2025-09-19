import { FiWifi, FiBluetooth, FiShare2, FiHardDrive, FiGrid, FiBarChart2, FiZap } from 'react-icons/fi';
import type { AppView } from '../types';
import './SideBar.css';

interface SideBarProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  isOpen: boolean;
  onClose: () => void;
}

// (removed duplicate import)
// ...existing code...
const navItems = [
  { name: 'Resources', icon: <FiHardDrive /> },
  { name: 'Network', icon: <FiGrid /> },
  { name: 'Wifi', icon: <FiWifi /> },
  { name: 'Airplay', icon: <FiShare2 /> },
  { name: 'Bluetooth', icon: <FiBluetooth /> },
  { name: 'AES67', icon: <FiBarChart2 /> },
  { name: 'LED', icon: <FiZap /> },
];

export function SideBar({ activeView, setActiveView, isOpen, onClose }: SideBarProps) {
  const handleItemClick = (view: AppView) => {
    setActiveView(view);
    onClose(); // Close sidebar after clicking an item on mobile
  };

  return (
    <nav className={`side-bar ${isOpen ? 'is-open' : ''}`}>
      <ul>
        {navItems.map(item => (
          <li
            key={item.name}
            className={activeView === item.name ? 'active' : ''}
            onClick={() => handleItemClick(item.name as AppView)}
          >
            {item.icon}
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
}