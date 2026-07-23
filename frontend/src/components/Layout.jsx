import { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { Menu } from 'lucide-react';
import PunchButton from './PunchButton';
import NotificationDropdown from './NotificationDropdown';

export default function Layout({ children, title, headerTabs }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className={`menu-toggle ${!sidebarOpen ? 'visible-desktop' : ''}`}
              onClick={() => setSidebarOpen(prev => !prev)}
              title="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
            <span className="topbar-title">{title}</span>
            {headerTabs && <div style={{ display: 'flex', gap: 4 }}>{headerTabs}</div>}
          </div>
          {/* Right side: notification bell + punch button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationDropdown />
            <PunchButton />
          </div>
        </div>
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}
