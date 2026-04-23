import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { User } from 'lucide-react';

export default function Layout({ children, title, headerTabs }) {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="topbar-title">{title}</span>
            {headerTabs && <div style={{ display: 'flex', gap: 4 }}>{headerTabs}</div>}
          </div>
          <div className="topbar-user">
            <User size={14} />
            <span>{user?.name}</span>
          </div>
        </div>
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}
