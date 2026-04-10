import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, Wrench, Settings, LogOut, Layers, Shield, GitBranch, ClipboardList } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
];
const moduleItems = [
  { to: '/crm', icon: Users, label: 'CRM', key: 'crm' },
  { to: '/installation', icon: Wrench, label: 'Installation', key: 'installation' },
  { to: '/service', icon: ClipboardList, label: 'Service', key: 'service' },
];
const adminItems = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/branches', icon: GitBranch, label: 'Branches' },
  { to: '/admin/roles', icon: Shield, label: 'Roles' },
  { to: '/admin/modules', icon: Layers, label: 'Modules' },
  { to: '/studio', icon: Settings, label: 'Studio' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const allowedModules = user?.allowed_modules || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">O</div>
        <span className="logo-text">OmniERP</span>
      </div>

      <div className="sidebar-section">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon />{label}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Modules</div>
        {moduleItems.filter(m => user?.is_superadmin || allowedModules.includes(m.key)).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon />{label}
          </NavLink>
        ))}
      </div>

      {user?.is_superadmin && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">Admin</div>
          {adminItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon />{label}
            </NavLink>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', padding: '12px 8px' }}>
        <button className="nav-item w-full" onClick={handleLogout} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
}
