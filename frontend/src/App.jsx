import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// Safe Lazy Loader to automatically recover from dynamic import chunk loading failures after new deployments
function safeLazy(importFn) {
  return lazy(() =>
    importFn().catch((err) => {
      console.warn("Chunk loading failed, reloading app for latest build...", err);
      const isReloaded = sessionStorage.getItem("chunk_reload");
      if (!isReloaded) {
        sessionStorage.setItem("chunk_reload", "true");
        window.location.reload();
      }
      throw err;
    })
  );
}

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    if (error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Loading chunk") ||
        error?.name === "TypeError") {
      const isReloaded = sessionStorage.getItem("chunk_reload");
      if (!isReloaded) {
        sessionStorage.setItem("chunk_reload", "true");
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f4fbf0' }}>
          <h2 style={{ fontSize: 20, color: '#1a2e18', marginBottom: 8 }}>Application Updated</h2>
          <p style={{ color: '#6b825e', marginBottom: 20, maxWidth: 400 }}>A new version of OmniERP was deployed. Click below to load the latest update.</p>
          <button
            onClick={() => {
              sessionStorage.removeItem("chunk_reload");
              window.location.reload();
            }}
            style={{ padding: '10px 24px', borderRadius: 8, background: '#195402', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            Refresh Now
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy Pages wrapped in safeLazy
const Login = safeLazy(() => import('./pages/Login'));
const TwoFactorChallenge = safeLazy(() => import('./pages/TwoFactorChallenge'));
const Dashboard = safeLazy(() => import('./pages/Dashboard'));
const Leads = safeLazy(() => import('./pages/crm/Leads'));
const LeadForm = safeLazy(() => import('./pages/crm/LeadForm'));
const ServiceList = safeLazy(() => import('./pages/service/ServiceList'));
const ServiceForm = safeLazy(() => import('./pages/service/ServiceForm'));
const KonwertCareList = safeLazy(() => import('./pages/konwertcare/KonwertCareList'));
const KonwertCareForm = safeLazy(() => import('./pages/konwertcare/KonwertCareForm'));
const InstallationList = safeLazy(() => import('./pages/installation/InstallationList'));
const InstallationForm = safeLazy(() => import('./pages/installation/InstallationForm'));
const ProductList = safeLazy(() => import('./pages/warranty/ProductList'));
const ProductDetail = safeLazy(() => import('./pages/warranty/ProductDetail'));
const BOMList = safeLazy(() => import('./pages/warranty/BOMList'));
const BOMDetail = safeLazy(() => import('./pages/warranty/BOMDetail'));
const ComponentDetail = safeLazy(() => import('./pages/warranty/ComponentDetail'));
const Studio = safeLazy(() => import('./pages/studio/Studio'));
const Users = safeLazy(() => import('./pages/admin/Users'));
const Roles = safeLazy(() => import('./pages/admin/Roles'));
const Branches = safeLazy(() => import('./pages/admin/Branches'));
const Modules = safeLazy(() => import('./pages/admin/Modules'));
const AuditLog = safeLazy(() => import('./pages/admin/AuditLog'));
const BackupManagement = safeLazy(() => import('./pages/admin/BackupManagement'));
const MailingSettings = safeLazy(() => import('./pages/admin/MailingSettings'));
const EmployeeMaster = safeLazy(() => import('./pages/hr/EmployeeMaster'));
const Attendance = safeLazy(() => import('./pages/hr/Attendance'));
const Requests = safeLazy(() => import('./pages/hr/Requests'));
const Approvals = safeLazy(() => import('./pages/hr/Approvals'));
const Payroll = safeLazy(() => import('./pages/hr/Payroll'));
const HRConfigurations = safeLazy(() => import('./pages/hr/HRConfigurations'));
const BankDashboard = safeLazy(() => import('./pages/hr/BankDashboard'));
const TaskList = safeLazy(() => import('./pages/tasks/TaskList'));
const FinanceDashboard = safeLazy(() => import('./pages/finance/FinanceDashboard'));
const FinanceTransactions = safeLazy(() => import('./pages/finance/FinanceTransactions'));
const FinanceImport = safeLazy(() => import('./pages/finance/FinanceImport'));
const FinanceWeeklyBuckets = safeLazy(() => import('./pages/finance/FinanceWeeklyBuckets'));
const FinancePivotReport = safeLazy(() => import('./pages/finance/FinancePivotReport'));
const ManagementReport = safeLazy(() => import('./pages/finance/ManagementReport'));
const FinanceConfig = safeLazy(() => import('./pages/finance/FinanceConfig'));
const ExpenseDashboard = safeLazy(() => import('./pages/expenses/ExpenseDashboard'));
const MyExpenses = safeLazy(() => import('./pages/expenses/MyExpenses'));
const ExpenseApprovals = safeLazy(() => import('./pages/expenses/ExpenseApprovals'));
const ExpenseCategories = safeLazy(() => import('./pages/expenses/ExpenseCategories'));
const ExpenseSettlement = safeLazy(() => import('./pages/expenses/ExpenseSettlement'));

// Integrated PrivateRoute
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{padding:20}}>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <Suspense fallback={<div style={{ padding: 20, color: 'var(--text)', fontFamily: 'sans-serif' }}>Loading...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/login/2fa" element={<TwoFactorChallenge />} />
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
              <Route path="/admin/settings" element={<PrivateRoute><MailingSettings /></PrivateRoute>} />
              <Route path="/audit" element={<PrivateRoute><AuditLog /></PrivateRoute>} />
              <Route path="/studio" element={<PrivateRoute><Studio /></PrivateRoute>} />
              <Route path="/hr/employees" element={<PrivateRoute><EmployeeMaster /></PrivateRoute>} />
              <Route path="/hr/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
              <Route path="/hr/requests" element={<PrivateRoute><Requests /></PrivateRoute>} />
              <Route path="/hr/approvals" element={<PrivateRoute><Approvals /></PrivateRoute>} />
              <Route path="/hr/payroll" element={<PrivateRoute><Payroll /></PrivateRoute>} />
              <Route path="/hr/configurations" element={<PrivateRoute><HRConfigurations /></PrivateRoute>} />
              <Route path="/bank/dashboard" element={<PrivateRoute><FinanceDashboard /></PrivateRoute>} />
              <Route path="/tasks" element={<PrivateRoute><TaskList /></PrivateRoute>} />
              {/* Finance Module */}
              <Route path="/finance/dashboard" element={<PrivateRoute><FinanceDashboard /></PrivateRoute>} />
              <Route path="/finance/transactions" element={<PrivateRoute><FinanceTransactions /></PrivateRoute>} />
              <Route path="/finance/import" element={<PrivateRoute><FinanceImport /></PrivateRoute>} />
              <Route path="/finance/weekly" element={<PrivateRoute><FinanceWeeklyBuckets /></PrivateRoute>} />
              <Route path="/finance/pivot" element={<PrivateRoute><FinancePivotReport /></PrivateRoute>} />
              <Route path="/finance/report" element={<PrivateRoute><ManagementReport /></PrivateRoute>} />
              <Route path="/finance/config" element={<PrivateRoute><FinanceConfig /></PrivateRoute>} />
              {/* Expenses Module */}
              <Route path="/expenses/dashboard" element={<PrivateRoute><ExpenseDashboard /></PrivateRoute>} />
              <Route path="/expenses/my" element={<PrivateRoute><MyExpenses /></PrivateRoute>} />
              <Route path="/expenses/approvals" element={<PrivateRoute><ExpenseApprovals /></PrivateRoute>} />
              <Route path="/expenses/categories" element={<PrivateRoute><ExpenseCategories /></PrivateRoute>} />
              <Route path="/expenses/advance/:id/settlement" element={<PrivateRoute><ExpenseSettlement /></PrivateRoute>} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
