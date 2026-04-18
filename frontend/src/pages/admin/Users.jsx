import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Badge, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, CheckSquare, Square } from 'lucide-react';

const emptyForm = { name: '', email: '', password: '', role_id: '', branch_id: '', allowed_branches: [], allowed_modules: [], is_superadmin: false, is_active: true };
const ALL_MODULES = ['crm', 'installation', 'service', 'studio'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([api.get('/users/'), api.get('/roles/'), api.get('/branches/')])
      .then(([u, r, b]) => { setUsers(u.data); setRoles(r.data); setBranches(b.data); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setEditing(null); setModal(true); };
  const openEdit = u => {
    setForm({ name: u.name, email: u.email, password: '', role_id: u.role_id || '', branch_id: u.branch_id || '', allowed_branches: u.allowed_branches || [], allowed_modules: u.allowed_modules || [], is_superadmin: u.is_superadmin, is_active: u.is_active });
    setEditing(u.id); setModal(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleModule = m => set('allowed_modules', (Array.isArray(form.allowed_modules) ? form.allowed_modules.includes(m) : false) ? form.allowed_modules.filter(x => x !== m) : [...form.allowed_modules, m]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, role_id: form.role_id || null, branch_id: form.branch_id || null };
      if (!payload.password) delete payload.password;
      if (editing) await api.put(`/users/${editing}`, payload);
      else await api.post('/users/', payload);
      toast.success(editing ? 'User updated' : 'User created');
      setModal(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    await api.delete(`/users/${deleting}`);
    toast.success('Deleted'); setDeleting(null); load();
  };

  if (loading) return <Layout title="Users"><Loader /></Layout>;

    const setModuleRole = (mod, roleId) => {
    setForm(f => {
      let current = f.allowed_modules;
      if (Array.isArray(current) || !current) current = {};
      const updated = { ...current };
      if (!roleId) delete updated[mod];
      else updated[mod] = parseInt(roleId);
      return { ...f, allowed_modules: updated };
    });
  };
return (
    <Layout title="User Management">
      <div className="toolbar">
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New User</button>
        </div>
      </div>
      <div className="card">
        {users.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Modules</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="fw-600">{u.name} {u.is_superadmin && <Badge color="var(--accent)">Admin</Badge>}</td>
                    <td className="text-muted">{u.email}</td>
                    <td>{u.role_name || '—'}</td>
                    <td>{u.branch_name || '—'}</td>
                    <td>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        {(Array.isArray(u.allowed_modules) ? u.allowed_modules : Object.keys(u.allowed_modules || {})).map(m => <Badge key={m} color="var(--accent2)">{m}</Badge>)}
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

      {modal && (
        <Modal title={editing ? 'Edit User' : 'New User'} onClose={() => setModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select className="form-select" value={form.branch_id} onChange={e => set('branch_id', e.target.value)}>
                <option value="">— None —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.is_active} onChange={e => set('is_active', e.target.value === 'true')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>Allowed Modules</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {ALL_MODULES.map(m => (
                <button key={m} type="button" className="btn btn-ghost btn-sm" onClick={() => toggleModule(m)}
                  style={(Array.isArray(form.allowed_modules) ? form.allowed_modules.includes(m) : false) ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ marginTop: 24, marginBottom: 10 }}>
            <label className="form-label" style={{ marginBottom: 12, display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)' }}>
              Per-Module Access & Roles
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {(typeof ALL_MODULES !== 'undefined' ? ALL_MODULES : ['crm', 'installation', 'service', 'warranty/products', 'konwertcare']).map(m => {
                const currentObj = (Array.isArray(form.allowed_modules) || !form.allowed_modules) ? {} : form.allowed_modules;
                const activeRoleId = currentObj[m];
                
                return (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: activeRoleId ? 'var(--accent-dim)' : 'var(--bg3)', border: `2px solid ${activeRoleId ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 13, fontWeight: activeRoleId ? 700 : 500, color: activeRoleId ? 'var(--accent)' : 'var(--text)', textTransform: 'capitalize' }}>
                      {m}
                    </div>
                    <select className="form-select" value={activeRoleId || ''} onChange={e => setModuleRole(m, e.target.value)} style={{ width: '160px', padding: '6px 10px', fontSize: 12, cursor: 'pointer', background: 'var(--bg)', border: 'none', borderRadius: 4 }}>
                      <option value="">— No Access —</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_superadmin} onChange={e => set('is_superadmin', e.target.checked)} />
              <span className="form-label" style={{ marginBottom: 0 }}>Super Admin</span>
            </label>
          </div>
        </Modal>
      )}
      {deleting && <Confirm message="Delete this user?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
