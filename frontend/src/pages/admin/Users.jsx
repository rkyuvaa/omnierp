import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Badge, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Shield, Building, Boxes, Users as UsersIcon, X, CheckSquare, Square, Clock, History } from 'lucide-react';

const emptyForm = { 
  name: '', email: '', password: '', role_id: '', 
  branch_id: '', allowed_branches: [], allowed_modules: {}, 
  department_id: '', is_superadmin: false, is_active: true 
};

// Available modules in the system
const ALL_MODULES = [
  { key: 'crm', name: 'CRM' },
  { key: 'installation', name: 'KIM Installation' },
  { key: 'service', name: 'Service' },
  { key: 'studio', name: 'Studio' },
  { key: 'warranty', name: 'Product & Warranty' },
  { key: 'konwertcare', name: 'Konwert Care+' }
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('users'); // 'users', 'departments', 'branches', 'roles'
  const [mode, setMode] = useState('list'); // 'list' or 'form'
  
  // User Form
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  // Generic Modals (Dept, Branch, Role)
  const [modal, setModal] = useState(false);
  const [modalMode, setModalMode] = useState(''); // 'dept', 'branch', 'role'
  const [modalForm, setModalForm] = useState({});
  const [modalEditing, setModalEditing] = useState(null);
  const [confirming, setConfirming] = useState(null); // { type, id, name }

  const loadHistory = async (uid) => {
    try {
      const res = await api.get(`audit/?module=users&record_id=${uid}`);
      setHistory(res.data.items || []);
    } catch (e) { console.error("Error loading activity", e); }
  };

  const load = useCallback(() => {
    setLoading(true);
    const pUsers = api.get('users/').then(r => r.data);
    const pRoles = api.get('roles/').then(r => r.data);
    const pBranches = api.get('branches/').then(r => r.data);
    const pDepts = api.get('departments/').then(r => r.data);

    Promise.all([pUsers, pRoles, pBranches, pDepts]).then(([u, r, b, d]) => {
      setUsers(u); setRoles(r); setBranches(b); setDepartments(d);
    }).catch(e => {
        toast.error("Resource fetch failed");
        console.error(e);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { 
    setForm(emptyForm); 
    setEditing(null); 
    setHistory([]);
    setMode('form'); 
  };
  const openEdit = u => {
    setForm({ 
      name: u.name, 
      email: u.email, 
      password: '', 
      role_id: u.role_id || '', 
      branch_id: u.branch_id || '', 
      allowed_branches: u.allowed_branches || [], 
      allowed_modules: u.allowed_modules || {}, 
      department_id: u.department_id || '',
      is_superadmin: u.is_superadmin, 
      is_active: u.is_active 
    });
    setEditing(u.id); 
    loadHistory(u.id);
    setMode('form');
  };

  const saveUser = async (e) => {
    if (e) e.preventDefault();
    if (!form.name || !form.email) return toast.error('Name and Email are required');
    setSaving(true);
    try {
      const payload = { 
        ...form, 
        role_id: parseInt(form.role_id) || null,
        branch_id: parseInt(form.branch_id) || null,
        department_id: parseInt(form.department_id) || null,
        allowed_branches: (form.allowed_branches || []).map(id => parseInt(id))
      };
      if (!payload.password) delete payload.password;
      
      if (editing) await api.put(`users/${editing}/`, payload);
      else await api.post('users/', payload);
      
      toast.success(editing ? 'User updated' : 'User created');
      setMode('list'); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error saving user'); }
    finally { setSaving(false); }
  };

  const saveModal = async () => {
    if (!modalForm.name) return toast.error('Name is required');
    try {
      let url = '';
      if (modalMode === 'dept') url = 'departments/';
      if (modalMode === 'branch') url = 'branches/';
      if (modalMode === 'role') url = 'roles/';

      if (modalEditing) await api.put(`${url}${modalEditing}/`, modalForm);
      else await api.post(`${url}`, modalForm);

      toast.success('Record saved'); setModal(false); load();
    } catch (e) { toast.error('Error saving data'); }
  };

  const executeDelete = async () => {
    try {
      let url = '';
      if (confirming.type === 'user') url = 'users/';
      if (confirming.type === 'dept') url = 'departments/';
      if (confirming.type === 'branch') url = 'branches/';
      if (confirming.type === 'role') url = 'roles/';

      await api.delete(`${url}${confirming.id}/`);
      toast.success('Deleted successfully');
      setConfirming(null); load();
    } catch (e) { toast.error('Error deleting record'); }
  };

  const toggleRolePerm = (key) => {
    setModalForm(f => ({
      ...f,
      permissions: { ...(f.permissions || {}), [key]: !f.permissions?.[key] }
    }));
  };

  const PERMS = [
    { key: 'can_read', label: 'READ' },
    { key: 'can_create', label: 'CREATE' },
    { key: 'can_edit', label: 'EDIT' },
    { key: 'can_delete', label: 'DELETE' },
  ];

  const toggleBranch = (bid) => {
    const current = form.allowed_branches || [];
    if (current.includes(bid)) set('allowed_branches', current.filter(id => id !== bid));
    else set('allowed_branches', [...current, bid]);
  };

  const setModuleRole = (modKey, roleId) => {
    setForm(f => {
      const updated = { ...f.allowed_modules };
      if (!roleId) delete updated[modKey];
      else updated[modKey] = parseInt(roleId);
      return { ...f, allowed_modules: updated };
    });
  };

  if (loading) return <Layout title="User Management"><Loader /></Layout>;

  if (mode === 'form') {
    return (
      <Layout title={editing ? 'Edit User Profile' : 'Create New User'}>
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <button className="btn btn-ghost" onClick={() => setMode('list')}>
             <X size={16} /> Cancel & Back
          </button>
          <div className="toolbar-right">
             <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Processing...' : 'Save User Settings'}
              </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 140px)' }}>
          {/* MAIN EDITOR AREA */}
          <div className="card" style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            
            {/* ROW 1: General Information */}
            <section>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>1. Identity & Core Settings</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 9, marginBottom: 4 }}>Full Name</label>
                  <input className="form-input" style={{ padding: '6px 10px', fontSize: 12 }} value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 9, marginBottom: 4 }}>Email Address</label>
                  <input className="form-input" style={{ padding: '6px 10px', fontSize: 12 }} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 9, marginBottom: 4 }}>Department</label>
                  <select className="form-select" style={{ padding: '5px 8px', fontSize: 12 }} value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 9, marginBottom: 4 }}>Global Role</label>
                  <select className="form-select" style={{ padding: '5px 8px', fontSize: 12 }} value={form.role_id} onChange={e => set('role_id', e.target.value)}>
                    <option value="">— Default —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 9, marginBottom: 4 }}>{editing ? 'New Password' : 'Password'}</label>
                  <input className="form-input" style={{ padding: '6px 10px', fontSize: 12 }} type="password" value={form.password} onChange={e => set('password', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 9, marginBottom: 4 }}>Status</label>
                    <select className="form-select" style={{ padding: '5px 8px', fontSize: 12 }} value={form.is_active} onChange={e => set('is_active', e.target.value === 'true')}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end' }}>
                  <label className="flex items-center gap-2 cursor-pointer p-2 bg-accent-dim rounded-lg w-full" style={{ border: '1px solid var(--accent)', height: '32px' }}>
                    <input type="checkbox" checked={form.is_superadmin} onChange={e => set('is_superadmin', e.target.checked)} />
                    <span className="form-label mb-0" style={{ fontWeight: 900, color: 'var(--accent)', fontSize: 10 }}>GRANT SUPER ADMIN PRIVILEGES</span>
                  </label>
                </div>
              </div>
            </section>

            {/* ROW 2: Branch Authorization (Micro Tiles) */}
            <section>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>2. Branch Portfolio</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                {branches.map(b => {
                  const isPrimary = form.branch_id == b.id;
                  const isAllowed = (form.allowed_branches || []).includes(b.id);
                  const isSelected = isPrimary || isAllowed;
                  
                  return (
                    <div key={b.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      padding: '6px 10px', 
                      background: isSelected ? 'var(--bg)' : 'var(--bg3)', 
                      border: `1.5px solid ${isPrimary ? 'var(--accent)' : (isSelected ? 'var(--accent-dim)' : 'var(--border)')}`, 
                      borderRadius: 10, 
                      transition: 'all 0.2s',
                      position: 'relative',
                      boxShadow: isPrimary ? '0 4px 10px rgba(99, 102, 241, 0.15)' : 'none'
                    }}>
                      <div 
                        onClick={() => toggleBranch(b.id)}
                        style={{ width: 24, height: 24, borderRadius: 6, background: isSelected ? 'var(--accent-dim)' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Building size={14} color={isSelected ? 'var(--accent)' : 'var(--text3)'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? 'var(--text1)' : 'var(--text3)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
                        {isSelected && !isPrimary ? (
                          <span 
                            onClick={() => set('branch_id', b.id)} 
                            style={{ fontSize: 7, color: 'var(--accent)', cursor: 'pointer', fontWeight: 900, textTransform: 'uppercase', textDecoration: 'underline' }}
                          >
                            Set as Primary
                          </span>
                        ) : (
                           <span style={{ fontSize: 7, color: 'var(--text3)', textTransform: 'uppercase' }}>{isPrimary ? 'Primary' : (isSelected ? 'Authorized' : 'Locked')}</span>
                        )}
                      </div>
                      <div onClick={() => toggleBranch(b.id)} style={{ cursor: 'pointer' }}>
                        {isSelected ? <CheckSquare size={14} color={isPrimary ? "var(--accent)" : "var(--accent-dim)"} /> : <Square size={14} color="var(--text3)" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ROW 3: Module Permissions (Nano Grid - 6 Columns) */}
            <section style={{ flex: 1 }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>3. Module Permissions</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                {ALL_MODULES.map(m => {
                  const roleId = (form.allowed_modules || {})[m.key];
                  return (
                    <div key={m.key} style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 6,
                      padding: '8px', 
                      background: roleId ? 'var(--bg)' : 'var(--bg2)', 
                      border: `1.5px solid ${roleId ? 'var(--accent)' : 'var(--border)'}`, 
                      borderRadius: 12, 
                      boxShadow: roleId ? '0 4px 10px rgba(99, 102, 241, 0.05)' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: 28, 
                          height: 28, 
                          background: roleId ? 'var(--accent)' : 'var(--bg3)', 
                          borderRadius: 8, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: roleId ? 'white' : 'var(--text3)' 
                        }}>
                          <Shield size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span style={{ fontSize: 10, fontWeight: 900, color: roleId ? 'var(--text1)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                        </div>
                      </div>
                      <select 
                        className="form-select" 
                        value={roleId || ''} 
                        onChange={e => setModuleRole(m.key, e.target.value)} 
                        style={{ 
                          width: '100%', 
                          borderRadius: 6, 
                          padding: '4px 6px',
                          fontSize: 10, 
                          background: roleId ? 'var(--bg)' : 'var(--bg3)',
                          border: roleId ? '1px solid var(--accent)' : '1px solid var(--border)', 
                          fontWeight: roleId ? 800 : 500
                        }}
                      >
                        <option value="">— None —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* RIGHT SIDEBAR: History & Stats */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
             {/* Stats Card */}
             <div className="card" style={{ padding: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                 <Clock size={16} color="var(--accent)" />
                 <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '1px' }}>Account Lifecycle</span>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div>
                   <label style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Member Since</label>
                   <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>{editing ? (users.find(u => u.id === editing)?.created_at?.split(' ')[0] || 'N/A') : 'Now'}</span>
                 </div>
                 <div>
                   <label style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Last Active Session</label>
                   <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{editing ? (users.find(u => u.id === editing)?.last_login || 'No recent activity') : 'Pending'}</span>
                 </div>
               </div>
             </div>

             {/* Activity Log Card */}
             <div className="card" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                 <History size={16} color="var(--accent)" />
                 <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: '1px' }}>Rights Audit Log</span>
               </div>
               
               <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                  {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                      <p style={{ fontSize: 11 }}>No rights changes recorded.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {history.map(log => (
                        <div key={log.id} style={{ borderLeft: '2px solid var(--accent-dim)', paddingLeft: 12, position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, left: -4, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                             <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--text1)' }}>{log.action}</span>
                             <span style={{ fontSize: 9, color: 'var(--text3)' }}>{log.created_at.split(' ')[1].substring(0,5)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>Modified by {log.user_name}</div>
                          {log.changes && (
                            <div style={{ marginTop: 6, padding: 6, background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)' }}>
                               {Object.entries(log.changes || {}).map(([key, val]) => (
                                 <div key={key} style={{ fontSize: 9, marginBottom: 2 }}>
                                   <b style={{ color: 'var(--accent)' }}>{key}:</b> {String(val.new)}
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
               </div>
             </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="User Management">
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="flex gap-2">
          <button className={`btn ${view === 'users' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('users')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
            <UsersIcon size={14} /> Users
          </button>
          <button className={`btn ${view === 'departments' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('departments')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
            <Boxes size={14} /> Departments
          </button>
          <button className={`btn ${view === 'branches' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('branches')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
            <Building size={14} /> Branches
          </button>
          <button className={`btn ${view === 'roles' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('roles')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
            <Shield size={14} /> Roles
          </button>
        </div>
        <div className="toolbar-right">
          {view === 'users' && <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={14} /> New User</button>}
          {view === 'departments' && <button className="btn btn-primary btn-sm" onClick={() => { setModalForm({ name: '', is_active: true }); setModalEditing(null); setModalMode('dept'); setModal(true); }}><Plus size={14} /> New Dept</button>}
          {view === 'branches' && <button className="btn btn-primary btn-sm" onClick={() => { setModalForm({ name: '', address: '', is_active: true }); setModalEditing(null); setModalMode('branch'); setModal(true); }}><Plus size={14} /> New Branch</button>}
          {view === 'roles' && <button className="btn btn-primary btn-sm" onClick={() => { setModalForm({ name: '', permissions: { can_read: true, can_create: false, can_edit: false, can_delete: false } }); setModalEditing(null); setModalMode('role'); setModal(true); }}><Plus size={14} /> New Role</button>}
        </div>
      </div>

      {view === 'users' ? (
        <div className="card">
          {users.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Username</th>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>User ID</th>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Department</th>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Role</th>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Branches</th>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Module Rights</th>
                    <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Status</th>
                    <th style={{ padding: '12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontSize: 12, fontWeight: 800, color: 'var(--text1)' }}>{u.name}</td>
                      <td style={{ padding: '12px', fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{u.email}</td>
                      <td style={{ padding: '12px', fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>{u.department_name || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', padding: '3px 8px', background: 'var(--accent-dim)', borderRadius: 6 }}>
                          {u.role_name || 'User'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text1)' }}>{u.branch_name || '—'}</span>
                          {(u.allowed_branches || []).length > 0 && (
                             <Badge color="var(--bg3)" style={{ fontSize: 8, fontWeight: 900, border: '1px solid var(--border)', color: 'var(--text1)' }}>
                               +{u.allowed_branches.length}
                             </Badge>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                          {Object.keys(u.allowed_modules || {}).map(mKey => {
                            const mod = ALL_MODULES.find(x => x.key === mKey);
                            const label = mod ? mod.name : (isNaN(mKey) ? mKey : `MOD ${mKey}`);
                            return (
                              <Badge key={mKey} color="#475569" style={{ 
                                fontSize: 8, padding: '2px 6px', fontWeight: 900, 
                                color: '#1e293b', border: '1px solid #cbd5e1',
                                background: '#f1f5f9',
                                textTransform: 'uppercase', letterSpacing: '0.2px'
                              }}>
                                {label}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active ? 'var(--green)' : 'var(--red)' }} />
                          <span style={{ fontSize: 10, fontWeight: 900, color: u.is_active ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>{u.is_active ? 'Active' : 'Offline'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" style={{ padding: 5 }} onClick={() => openEdit(u)} title="Settings"><Pencil size={13} /></button>
                          <button className="btn btn-danger btn-sm" style={{ padding: 5, opacity: 0.7 }} onClick={() => setConfirming({ type: 'user', id: u.id, name: u.name })} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : view === 'departments' ? (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Department Name</th>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Status</th>
                  <th style={{ padding: '12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {departments.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{d.name}</td>
                    <td style={{ padding: '12px' }}>
                      <Badge color={d.is_active ? 'var(--green)' : 'var(--red)'} style={{ fontSize: 10, fontWeight: 800 }}>{d.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => { setModalForm({ name: d.name, is_active: d.is_active }); setModalEditing(d.id); setModalMode('dept'); setModal(true); }}><Pencil size={13} /></button>
                        <button className="btn btn-danger btn-sm" style={{ padding: 6, opacity: 0.7 }} onClick={() => setConfirming({ type: 'dept', id: d.id, name: d.name })}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'branches' ? (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Branch Name</th>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Location / Address</th>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Status</th>
                  <th style={{ padding: '12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{b.name}</td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{b.address || 'Standard Location'}</td>
                    <td style={{ padding: '12px' }}>
                      <Badge color={b.is_active ? 'var(--green)' : 'var(--red)'} style={{ fontSize: 10, fontWeight: 800 }}>{b.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => { setModalForm({ name: b.name, address: b.address || '', is_active: b.is_active }); setModalEditing(b.id); setModalMode('branch'); setModal(true); }}><Pencil size={13} /></button>
                        <button className="btn btn-danger btn-sm" style={{ padding: 6, opacity: 0.7 }} onClick={() => setConfirming({ type: 'branch', id: b.id, name: b.name })}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Role Name</th>
                  <th style={{ padding: '12px', fontSize: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)' }}>Global Permissions</th>
                  <th style={{ padding: '12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{r.name}</td>
                    <td style={{ padding: '12px' }}>
                      <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                        {PERMS.filter(p => r.permissions?.[p.key]).map(p => (
                          <Badge key={p.key} color="var(--accent-dim)" style={{ color: 'var(--accent)', fontSize: 8, fontWeight: 900 }}>{p.label}</Badge>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => { setModalForm({ name: r.name, permissions: r.permissions || {} }); setModalEditing(r.id); setModalMode('role'); setModal(true); }}><Pencil size={13} /></button>
                        <button className="btn btn-danger btn-sm" style={{ padding: 6, opacity: 0.7 }} onClick={() => setConfirming({ type: 'role', id: r.id, name: r.name })}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal 
          title={modalEditing ? `Edit ${modalMode}` : `New ${modalMode}`} 
          onClose={() => setModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveModal}>Save Changes</button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 10, fontWeight: 800 }}>Name / Identifier</label>
              <input className="form-input" value={modalForm.name || ''} onChange={e => setModalForm({...modalForm, name: e.target.value})} placeholder="e.g. Sales, Bangalore Branch, Operator" />
            </div>

            {modalMode === 'branch' && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10, fontWeight: 800 }}>Location Address</label>
                <textarea className="form-input" value={modalForm.address || ''} onChange={e => setModalForm({...modalForm, address: e.target.value})} placeholder="Full address details..." />
              </div>
            )}

            {modalMode === 'role' && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10, fontWeight: 800, marginBottom: 10 }}>Global Permission Assets</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PERMS.map(p => {
                    const active = modalForm.permissions?.[p.key];
                    return (
                      <div key={p.key} onClick={() => toggleRolePerm(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: active ? 'var(--accent-dim)' : 'var(--bg2)', borderRadius: 8, cursor: 'pointer', border: `1px solid ${active ? 'var(--accent)' : 'transparent'}` }}>
                        {active ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} color="var(--text3)" />}
                        <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text2)' }}>{p.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-group">
               <label className="form-label" style={{ fontSize: 10, fontWeight: 800 }}>Operational Status</label>
                <select className="form-select" value={String(modalForm.is_active !== false)} onChange={e => setModalForm({...modalForm, is_active: e.target.value === 'true'})}>
                  <option value="true">Active (Live)</option>
                  <option value="false">Inactive (Disabled)</option>
                </select>
            </div>
          </div>
        </Modal>
      )}

      {confirming && (
        <Confirm 
          title={`Delete ${confirming.type.toUpperCase()}`} 
          message={`Are you sure you want to remove "${confirming.name}"? This action cannot be undone.`} 
          onConfirm={executeDelete} 
          onCancel={() => setConfirming(null)} 
        />
      )}
    </Layout>
  );
}
