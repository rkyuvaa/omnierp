import { useState, useEffect, createContext, useContext, Suspense } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { Menu } from 'lucide-react';
import PunchButton from './PunchButton';
import NotificationDropdown from './NotificationDropdown';
import { Outlet } from 'react-router-dom';

export const LayoutContext = createContext(null);

export function LayoutShell() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [title, setTitle] = useState('');
  const [headerTabs, setHeaderTabs] = useState(null);

  return (
    <LayoutContext.Provider value={{ setTitle, setHeaderTabs }}>
      <div className="app-shell">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />
        <div className="main-content">
          <div className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
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
          <div className="page-body">
            <Suspense fallback={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Loading module...</span>
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}

export default function Layout({ children, title, headerTabs }) {
  const ctx = useContext(LayoutContext);
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (ctx) {
      if (title !== undefined) ctx.setTitle(title);
      if (headerTabs !== undefined) ctx.setHeaderTabs(headerTabs);
    }
  }, [title, headerTabs, ctx]);

  // If rendered inside LayoutShell persistent container, pass through children directly!
  if (ctx) {
    return <>{children}</>;
  }

  // Fallback standalone rendering if used outside shell
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
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
