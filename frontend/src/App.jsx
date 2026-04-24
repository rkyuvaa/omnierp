import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/crm/Leads';
import LeadForm from './pages/crm/LeadForm';
import ServiceList from './pages/service/ServiceList';
import ServiceForm from './pages/service/ServiceForm';
import KonwertCareList from './pages/konwertcare/KonwertCareList';
import KonwertCareForm from './pages/konwertcare/KonwertCareForm';
import InstallationList from './pages/installation/InstallationList';
import InstallationForm from './pages/installation/InstallationForm';
import ProductList from './pages/warranty/ProductList';
import ProductDetail from './pages/warranty/ProductDetail';
import BOMList from './pages/warranty/BOMList';
import BOMDetail from './pages/warranty/BOMDetail';
import ComponentDetail from './pages/warranty/ComponentDetail';
import Studio from './pages/studio/Studio';
import Users from './pages/admin/Users';
import Roles from './pages/admin/Roles';
import Branches from './pages/admin/Branches';
import Modules from './pages/admin/Modules';
import AuditLog from './pages/admin/AuditLog';
import BackupManagement from './pages/admin/BackupManagement';

// Integrated PrivateRoute
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{padding:20}}>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/crm" element={<PrivateRoute><Leads /></PrivateRoute>} />
          <Route path="/crm/:id" element={<PrivateRoute><LeadForm /></PrivateRoute>} />
          <Route path="/service" element={<PrivateRoute><ServiceList /></PrivateRoute>} />
          <Route path="/service/:id" element={<PrivateRoute><ServiceForm /></PrivateRoute>} />
          <Route path="/konwertcare" element={<PrivateRoute><KonwertCareList /></PrivateRoute>} />
          <Route path="/konwertcare/:id" element={<PrivateRoute><KonwertCareForm /></PrivateRoute>} />
          <Route path="/installation" element={<PrivateRoute><InstallationList /></PrivateRoute>} />
          <Route path="/installation/:id" element={<PrivateRoute><InstallationForm /></PrivateRoute>} />
          <Route path="/warranty/products" element={<PrivateRoute><ProductList /></PrivateRoute>} />
          <Route path="/warranty/products/:id" element={<PrivateRoute><ProductDetail /></PrivateRoute>} />
          <Route path="/warranty/bom" element={<PrivateRoute><BOMList /></PrivateRoute>} />
          <Route path="/warranty/bom/:id" element={<PrivateRoute><BOMDetail /></PrivateRoute>} />
          <Route path="/warranty/components/:id" element={<PrivateRoute><ComponentDetail /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><Users /></PrivateRoute>} />
          <Route path="/admin/branches" element={<PrivateRoute><Branches /></PrivateRoute>} />
          <Route path="/admin/roles" element={<PrivateRoute><Roles /></PrivateRoute>} />
          <Route path="/admin/modules" element={<PrivateRoute><Modules /></PrivateRoute>} />
          <Route path="/admin/backups" element={<PrivateRoute><BackupManagement /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute><AuditLog /></PrivateRoute>} />
          <Route path="/studio" element={<PrivateRoute><Studio /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
