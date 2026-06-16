import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// Pages
import Login from './pages/Login';
import TwoFactorChallenge from './pages/TwoFactorChallenge';
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
import MailingSettings from './pages/admin/MailingSettings';
import EmployeeMaster from './pages/hr/EmployeeMaster';
import Attendance from './pages/hr/Attendance';
import Requests from './pages/hr/Requests';
import Approvals from './pages/hr/Approvals';
import Payroll from './pages/hr/Payroll';
import HRConfigurations from './pages/hr/HRConfigurations';
import BankDashboard from './pages/hr/BankDashboard';
import TaskList from './pages/tasks/TaskList';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import FinanceTransactions from './pages/finance/FinanceTransactions';
import FinanceImport from './pages/finance/FinanceImport';
import FinanceWeeklyBuckets from './pages/finance/FinanceWeeklyBuckets';
import FinancePivotReport from './pages/finance/FinancePivotReport';
import ManagementReport from './pages/finance/ManagementReport';
import FinanceConfig from './pages/finance/FinanceConfig';
import ExpenseDashboard from './pages/expenses/ExpenseDashboard';
import MyExpenses from './pages/expenses/MyExpenses';
import ExpenseApprovals from './pages/expenses/ExpenseApprovals';
import ExpenseCategories from './pages/expenses/ExpenseCategories';

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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
