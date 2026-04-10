import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

import CRMLeads from './pages/crm/Leads';
import LeadForm from './pages/crm/LeadForm';

import InstallationList from './pages/installation/InstallationList';
import InstallationForm from './pages/installation/InstallationForm';

import ServiceList from './pages/service/ServiceList';
import ServiceForm from './pages/service/ServiceForm';

import Studio from './pages/studio/Studio';

import AdminUsers from './pages/admin/Users';
import AdminBranches from './pages/admin/Branches';
import AdminRoles from './pages/admin/Roles';
import AdminModules from './pages/admin/Modules';
import AuditLog from './pages/admin/AuditLog';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!user.is_superadmin) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13 } }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

          <Route path="/crm" element={<PrivateRoute><CRMLeads /></PrivateRoute>} />
          <Route path="/crm/:id" element={<PrivateRoute><LeadForm /></PrivateRoute>} />

          <Route path="/installation" element={<PrivateRoute><InstallationList /></PrivateRoute>} />
          <Route path="/installation/:id" element={<PrivateRoute><InstallationForm /></PrivateRoute>} />

          <Route path="/service" element={<PrivateRoute><ServiceList /></PrivateRoute>} />
          <Route path="/service/:id" element={<PrivateRoute><ServiceForm /></PrivateRoute>} />

          <Route path="/studio" element={<AdminRoute><Studio /></AdminRoute>} />

          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/branches" element={<AdminRoute><AdminBranches /></AdminRoute>} />
          <Route path="/admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
          <Route path="/admin/modules" element={<AdminRoute><AdminModules /></AdminRoute>} />
          <Route path="/audit" element={<AdminRoute><AuditLog /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
