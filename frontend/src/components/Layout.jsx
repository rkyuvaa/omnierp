import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { User } from 'lucide-react';

export default function Layout({ children, title }) {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{title}</span>
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
