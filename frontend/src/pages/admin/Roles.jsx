import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, CheckSquare, Square, Shield } from 'lucide-react';

const emptyForm = { name: '', permissions: { can_read: true, can_create: false, can_edit: false, can_delete: false } };

export default function AdminRoles() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);

  const load = () => api.get('/roles/').then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setEditing(null); setModal(true); };
  const openEdit = (i) => { setForm({ name: i.name, permissions: i.permissions || emptyForm.permissions }); setEditing(i.id); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/roles/${editing}`, form);
        toast.success('Role updated');
      } else {
        await api.post('/roles/', form);
        toast.success('Role created');
      }
      setModal(false);
      load();
    } catch { toast.error('Failed to save role'); }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/roles/${deleting.id}`);
      toast.success('Role deleted');
      setDeleting(null);
      load();
    } catch { toast.error('Failed to delete role'); }
  };

  const togglePerm = (key) => setForm(f => ({
    ...f,
    permissions: { ...(f.permissions || {}), [key]: !f.permissions?.[key] }
  }));

  const PERMS = [
    { key: 'can_read', label: 'Read Data (View records / Operator Level)' },
    { key: 'can_create', label: 'Create Data (Add new records / User Level)' },
    { key: 'can_edit', label: 'Edit Data (Modify existing records / Manager Level)' },
    { key: 'can_delete', label: 'Delete Data (Remove records completely / Admin Level)' },
  ];

  return (
    <Layout title="Role Management">
      <div className="toolbar">
        <h1 className="h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={20} className="text-accent"/> Roles & Permissions</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> New Role</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40 }}><Loader /></div> : items.length === 0 ? <Empty message="No roles defined" /> : (
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Role Rank / Name</th>
                <th>Global Permissions</th>
                <th width="100" style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 700, paddingLeft: 20, color: 'var(--text)' }}>{i.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PERMS.filter(p => i.permissions?.[p.key]).map(p => (
                        <span key={p.key} style={{ fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.5px' }}>
                          {p.key.replace('can_', '').toUpperCase()}
                        </span>
                      ))}
                      {!Object.keys(i.permissions || {}).some(k => i.permissions[k]) && <span className="text-muted text-sm" style={{ padding: '4px 10px' }}>No Access</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(i)} style={{ padding: '4px 8px' }}><Pencil size={14}/></button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleting(i)} style={{ padding: '4px 8px' }}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Role' : 'New Role'} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Role Identifier</label>
              <input autoFocus className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Manager, Operator..." style={{ fontSize: 15, fontWeight: 600, padding: '12px 16px' }} />
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent)' }}>Global Permission Settings</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PERMS.map(p => {
                  const active = form.permissions?.[p.key];
                  return (
                    <div key={p.key} onClick={() => togglePerm(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: active ? 'var(--accent-dim)' : 'var(--bg3)', border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ color: active ? 'var(--accent)' : 'var(--text3)' }}>
                        {active ? <CheckSquare size={20} /> : <Square size={20} />}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text2)' }}>
                        {p.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2" style={{ marginTop: 30 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ padding: '0 24px' }}>Save Definitions</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && <Confirm title="Delete Role" message={`Delete role ${deleting.name}?`} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
