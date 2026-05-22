import { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { User, Menu } from 'lucide-react';
import PunchButton from './PunchButton';
import NotificationDropdown from './NotificationDropdown';

export default function Layout({ children, title, headerTabs }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <span className="topbar-title">{title}</span>
            {headerTabs && <div style={{ display: 'flex', gap: 4 }}>{headerTabs}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationDropdown />
            <div className="topbar-user">
              <User size={14} />
              <span>{user?.name}</span>
            </div>
          </div>
        </div>
        <div className="page-body">{children}</div>
      </div>
      {/* Global punch button — only visible for employees with enable_mobile_punch */}
      <PunchButton />
    </div>
  );
}
