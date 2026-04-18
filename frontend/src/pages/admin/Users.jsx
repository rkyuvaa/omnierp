import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Badge, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Shield, Building, Boxes, Users as UsersIcon, X, CheckSquare, Square } from 'lucide-react';

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
  const [view, setView] = useState('users'); // 'users' or 'departments'
  
  // User Modal
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Department Modal
  const [deptModal, setDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', is_active: true });
  const [deptEditing, setDeptEditing] = useState(null);
  const [deletingDept, setDeletingDept] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const pUsers = api.get('/users').then(r => r.data).catch(() => []);
    const pRoles = api.get('/roles').then(r => r.data).catch(() => []);
    const pBranches = api.get('/branches').then(r => r.data).catch(() => []);
    const pDepts = api.get('/departments').then(r => r.data).catch(() => []);

    Promise.all([pUsers, pRoles, pBranches, pDepts])
      .then(([u, r, b, d]) => { 
        setUsers(u); 
        setRoles(r); 
        setBranches(b); 
        setDepartments(d);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm(emptyForm); setEditing(null); setModal(true); };
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
    setModal(true);
  };

  const saveUser = async () => {
    if (!form.name || !form.email) return toast.error('Name and Email are required');
    setSaving(true);
    try {
      const payload = { 
        ...form, 
        role_id: parseInt(form.role_id) || null,
        branch_id: parseInt(form.branch_id) || null,
        department_id: parseInt(form.department_id) || null,
        allowed_branches: form.allowed_branches.map(id => parseInt(id))
      };
      if (!payload.password) delete payload.password;
      
      if (editing) await api.put(`/users/${editing}`, payload);
      else await api.post('/users/', payload);
      
      toast.success(editing ? 'User updated' : 'User created');
      setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error saving user'); }
    finally { setSaving(false); }
  };

  const saveDept = async () => {
    if (!deptForm.name) return toast.error('Name is required');
    try {
      if (deptEditing) await api.put(`/api/departments/${deptEditing}`, deptForm);
      else await api.post('/api/departments/', deptForm);
      toast.success('Department saved');
      setDeptModal(false); load();
    } catch (e) { toast.error('Error saving department'); }
  };

  const deleteUser = async () => {
    await api.delete(`/users/${deleting}`);
    toast.success('Deleted'); setDeleting(null); load();
  };

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

  return (
    <Layout title="User Management">
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="flex gap-2">
          <button className={`btn ${view === 'users' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('users')}>
            <UsersIcon size={16} /> Users
          </button>
          <button className={`btn ${view === 'departments' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('departments')}>
            <Boxes size={16} /> Departments
          </button>
        </div>
        <div className="toolbar-right">
          {view === 'users' ? (
            <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New User</button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setDeptForm({ name: '', is_active: true }); setDeptEditing(null); setDeptModal(true); }}>
              <Plus size={15} /> New Department
            </button>
          )}
        </div>
      </div>

      {view === 'users' ? (
        <div className="card">
          {users.length === 0 ? <Empty /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User Details</th>
                    <th>Dept & Role</th>
                    <th>Branches</th>
                    <th>Module Access</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="fw-700 color-text1">{u.name} {u.is_superadmin && <Badge color="var(--accent)">Admin</Badge>}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{u.department_name || 'No Dept'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{u.role_name || 'No Global Role'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                          <Badge color="var(--bg3)" style={{ color: 'var(--text1)' }}>{u.branch_name || 'None'}</Badge>
                          {(u.allowed_branches || []).length > 0 && (
                            <Badge color="var(--bg2)" style={{ color: 'var(--accent)' }}>+{u.allowed_branches.length} more</Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ flexWrap: 'wrap', maxWidth: 220 }}>
                          {Object.keys(u.allowed_modules || {}).map(mKey => {
                            const mod = ALL_MODULES.find(x => x.key === mKey);
                            const label = mod ? mod.name : (isNaN(mKey) ? mKey : '');
                            if (!label) return null;
                            return <Badge key={mKey} color="var(--accent2)" style={{ fontSize: 9, padding: '2px 6px' }}>{label}</Badge>
                          })}
                        </div>
                      </td>
                      <td><Badge color={u.is_active ? 'var(--green)' : 'var(--red)'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}><Pencil size={13} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleting(u.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 600 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Department Name</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.id}>
                      <td className="fw-600">{d.name}</td>
                      <td><Badge color={d.is_active ? 'var(--green)' : 'var(--red)'}>{d.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-ghost btn-sm" onClick={() => { setDeptForm({ name: d.name, is_active: d.is_active }); setDeptEditing(d.id); setDeptModal(true); }}><Pencil size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 && <tr><td colSpan={3} className="text-center p-4">No departments found.</td></tr>}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* BIG USER MODAL */}
      {modal && (
        <Modal 
          title={editing ? 'Edit User Profile' : 'Create New User'} 
          onClose={() => setModal(false)}
          width="900px"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Discard</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Processing...' : 'Save User Settings'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            {/* Left Column: Basic Info & Branches */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>General Information</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. John Doe" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-select" value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                      <option value="">— Select —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Global Role</label>
                    <select className="form-select" value={form.role_id} onChange={e => set('role_id', e.target.value)}>
                      <option value="">— Default —</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">{editing ? 'New Password (Optional)' : 'Password *'}</label>
                    <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
                  </div>
                  <div className="form-group">
                     <label className="form-label">Account Status</label>
                      <select className="form-select" value={form.is_active} onChange={e => set('is_active', e.target.value === 'true')}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                  </div>
                  <div className="form-group flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-accent-dim rounded-lg" style={{ border: '1px solid var(--accent)' }}>
                      <input type="checkbox" checked={form.is_superadmin} onChange={e => set('is_superadmin', e.target.checked)} />
                      <span className="form-label mb-0" style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 11 }}>SUPER ADMIN ACCESS</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>Branch Authorization</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxHeight: 180, overflowY: 'auto', padding: 12, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  {branches.map(b => {
                    const isSelected = form.branch_id == b.id || (form.allowed_branches || []).includes(b.id);
                    return (
                      <div key={b.id} onClick={() => toggleBranch(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSelected ? 'var(--bg)' : 'var(--bg3)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {isSelected ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} color="var(--text3)" />}
                        <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--accent)' : 'var(--text2)' }}>{b.name}</span>
                        {form.branch_id == b.id && <Badge color="var(--accent)" style={{ fontSize: 8 }}>PRIMARY</Badge>}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 10, fontStyle: 'italic' }}>* Users can view records starting from their Primary branch and any additional authorized branches.</p>
              </div>
            </div>

            {/* Right Column: Module Access & Specialized Roles */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>Module Permissions & Roles</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ALL_MODULES.map(m => {
                  const roleId = (form.allowed_modules || {})[m.key];
                  return (
                    <div key={m.key} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px 18px', 
                      background: roleId ? 'var(--bg)' : 'var(--bg2)', 
                      border: `1.5px solid ${roleId ? 'var(--accent)' : 'var(--border)'}`, 
                      borderRadius: 14, 
                      boxShadow: roleId ? '0 4px 12px rgba(99, 102, 241, 0.08)' : 'none',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div style={{ 
                          width: 44, 
                          height: 44, 
                          minWidth: 44,
                          background: roleId ? 'var(--accent)' : 'var(--bg3)', 
                          borderRadius: 12, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: roleId ? 'white' : 'var(--text3)' 
                        }}>
                          <Shield size={22} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: roleId ? 'var(--text1)' : 'var(--text2)', marginBottom: 2 }}>{m.name}</span>
                          <span style={{ fontSize: 9, color: roleId ? 'var(--accent)' : 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{roleId ? 'Access Enabled' : 'Access Restricted'}</span>
                        </div>
                      </div>
                      <select 
                        className="form-select" 
                        value={roleId || ''} 
                        onChange={e => setModuleRole(m.key, e.target.value)} 
                        style={{ 
                          width: '140px', 
                          borderRadius: 10, 
                          padding: '8px 12px',
                          fontSize: 12, 
                          background: roleId ? 'var(--bg)' : 'var(--bg3)',
                          border: roleId ? '2px solid var(--accent)' : '1px solid var(--border)', 
                          fontWeight: roleId ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">— No Access —</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* DEPARTMENT MODAL */}
      {deptModal && (
        <Modal 
          title={deptEditing ? 'Edit Department' : 'New Department'} 
          onClose={() => setDeptModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setDeptModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveDept}>Save</button></>}
        >
          <div className="form-group">
            <label className="form-label">Department Name</label>
            <input className="form-input" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} placeholder="e.g. Sales, Installation Team" />
          </div>
          <div className="form-group mt-4">
             <label className="form-label">Status</label>
              <select className="form-select" value={deptForm.is_active} onChange={e => setDeptForm({...deptForm, is_active: e.target.value === 'true'})}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
          </div>
        </Modal>
      )}

      {deleting && <Confirm title="Delete User" message="Are you sure? This action cannot be undone." onConfirm={deleteUser} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
