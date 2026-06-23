import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

// Lazy Pages
const Login = lazy(() => import('./pages/Login'));
const TwoFactorChallenge = lazy(() => import('./pages/TwoFactorChallenge'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/crm/Leads'));
const LeadForm = lazy(() => import('./pages/crm/LeadForm'));
const ServiceList = lazy(() => import('./pages/service/ServiceList'));
const ServiceForm = lazy(() => import('./pages/service/ServiceForm'));
const KonwertCareList = lazy(() => import('./pages/konwertcare/KonwertCareList'));
const KonwertCareForm = lazy(() => import('./pages/konwertcare/KonwertCareForm'));
const InstallationList = lazy(() => import('./pages/installation/InstallationList'));
const InstallationForm = lazy(() => import('./pages/installation/InstallationForm'));
const ProductList = lazy(() => import('./pages/warranty/ProductList'));
const ProductDetail = lazy(() => import('./pages/warranty/ProductDetail'));
const BOMList = lazy(() => import('./pages/warranty/BOMList'));
const BOMDetail = lazy(() => import('./pages/warranty/BOMDetail'));
const ComponentDetail = lazy(() => import('./pages/warranty/ComponentDetail'));
const Studio = lazy(() => import('./pages/studio/Studio'));
const Users = lazy(() => import('./pages/admin/Users'));
const Roles = lazy(() => import('./pages/admin/Roles'));
const Branches = lazy(() => import('./pages/admin/Branches'));
const Modules = lazy(() => import('./pages/admin/Modules'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const BackupManagement = lazy(() => import('./pages/admin/BackupManagement'));
const MailingSettings = lazy(() => import('./pages/admin/MailingSettings'));
const EmployeeMaster = lazy(() => import('./pages/hr/EmployeeMaster'));
const Attendance = lazy(() => import('./pages/hr/Attendance'));
const Requests = lazy(() => import('./pages/hr/Requests'));
const Approvals = lazy(() => import('./pages/hr/Approvals'));
const Payroll = lazy(() => import('./pages/hr/Payroll'));
const HRConfigurations = lazy(() => import('./pages/hr/HRConfigurations'));
const BankDashboard = lazy(() => import('./pages/hr/BankDashboard'));
const TaskList = lazy(() => import('./pages/tasks/TaskList'));
const FinanceDashboard = lazy(() => import('./pages/finance/FinanceDashboard'));
const FinanceTransactions = lazy(() => import('./pages/finance/FinanceTransactions'));
const FinanceImport = lazy(() => import('./pages/finance/FinanceImport'));
const FinanceWeeklyBuckets = lazy(() => import('./pages/finance/FinanceWeeklyBuckets'));
const FinancePivotReport = lazy(() => import('./pages/finance/FinancePivotReport'));
const ManagementReport = lazy(() => import('./pages/finance/ManagementReport'));
const FinanceConfig = lazy(() => import('./pages/finance/FinanceConfig'));
const ExpenseDashboard = lazy(() => import('./pages/expenses/ExpenseDashboard'));
const MyExpenses = lazy(() => import('./pages/expenses/MyExpenses'));
const ExpenseApprovals = lazy(() => import('./pages/expenses/ExpenseApprovals'));
const ExpenseCategories = lazy(() => import('./pages/expenses/ExpenseCategories'));
const ExpenseSettlement = lazy(() => import('./pages/expenses/ExpenseSettlement'));

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
  );
}
