export const RBAC_CATALOG = [
  {
    key: 'hr',
    name: 'Attendance & HR',
    menus: [
      { path: '/hr/employees', label: 'Employee Master', actions: ['read', 'create', 'edit', 'delete', 'export'] },
      { path: '/hr/attendance', label: 'Attendance', actions: ['read', 'create', 'edit', 'delete', 'export'] },
      { path: '/hr/requests', label: 'Requests', actions: ['read', 'create', 'edit', 'delete'] },
      { path: '/hr/approvals', label: 'Approvals', actions: ['read', 'approve'] },
      { path: '/hr/leave-ledger', label: 'Leave Ledger', actions: ['read', 'export'] },
      { path: '/hr/payroll', label: 'Payroll', actions: ['read', 'create', 'edit', 'delete', 'approve', 'export'] },
      { path: '/hr/configurations', label: 'Configurations', actions: ['read', 'edit'] },
    ]
  },
  {
    key: 'crm',
    name: 'CRM & Sales',
    menus: [
      { path: '/crm', label: 'Leads & Pipeline', actions: ['read', 'create', 'edit', 'delete', 'export'] },
      { path: '/crm/customers', label: 'Customers', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    ]
  },
  {
    key: 'service',
    name: 'Service Management',
    menus: [
      { path: '/service', label: 'Service Calls', actions: ['read', 'create', 'edit', 'delete', 'export'] },
    ]
  },
  {
    key: 'installation',
    name: 'KIM Installation',
    menus: [
      { path: '/installation', label: 'Installations', actions: ['read', 'create', 'edit', 'delete'] },
    ]
  },
  {
    key: 'warranty',
    name: 'Product & Warranty',
    menus: [
      { path: '/warranty/products', label: 'Products', actions: ['read', 'create', 'edit', 'delete'] },
      { path: '/warranty/bom', label: 'BOM Master', actions: ['read', 'create', 'edit', 'delete'] },
    ]
  },
  {
    key: 'konwertcare',
    name: 'Konwert Care+',
    menus: [
      { path: '/konwertcare', label: 'Konwert Care+', actions: ['read', 'create', 'edit', 'delete'] },
    ]
  },
  {
    key: 'tasks',
    name: 'Task Management',
    menus: [
      { path: '/tasks', label: 'Tasks', actions: ['read', 'create', 'edit', 'delete'] },
    ]
  },
  {
    key: 'finance',
    name: 'Finance & Accounts',
    menus: [
      { path: '/finance/dashboard', label: 'Dashboard', actions: ['read'] },
      { path: '/finance/transactions', label: 'Transactions', actions: ['read', 'create', 'edit', 'delete', 'export'] },
      { path: '/finance/import', label: 'Import Statement', actions: ['read', 'create'] },
      { path: '/finance/budget', label: 'Budget Planning', actions: ['read', 'create', 'edit', 'export'] },
      { path: '/finance/weekly', label: 'Weekly Buckets', actions: ['read', 'edit'] },
      { path: '/finance/pivot', label: 'Pivot Report', actions: ['read', 'export'] },
      { path: '/finance/report', label: 'Mgmt Report', actions: ['read', 'export'] },
      { path: '/finance/config', label: 'Configuration', actions: ['read', 'edit'] },
    ]
  }
];

export const DATA_SCOPES = [
  { key: 'own', label: 'Own Records Only', desc: 'User can only access records created by or assigned to themselves' },
  { key: 'team', label: 'Team Records Only', desc: 'User can access records for themselves + direct reports' },
  { key: 'branch', label: 'Branch Records Only', desc: 'User can access records belonging to their assigned branch(es)' },
  { key: 'all', label: 'All Company Records', desc: 'Full organization-wide access' },
];
