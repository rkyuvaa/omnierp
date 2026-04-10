import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const emptyForm = { name: '', permissions: {} };

export default function AdminRoles() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);

  const load = () => api.get('/roles/').then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(load, []);

  const openNew = () => { setForm(emptyForm); setEditing(null); setModal(true); };
  const openEdit = r => { setForm({ name: r.name, permissions: r.permissions || {} }); setEditing(r.id); setModal(true); };

  const save = async () => {
    try {
      if (editing) await api.put(`/roles/${editing}`, form);
      else await api.post('/roles/', form);
      toast.success('Saved'); setModal(false); load();
    } catch { toast.error('Error'); }
  };

  const confirmDelete = async () => {
    await api.delete(`/roles/${deleting}`);
    toast.success('Deleted'); setDeleting(null); load();
  };

  if (loading) return <Layout title="Roles"><Loader /></Layout>;

  return (
    <Layout title="Role Management">
      <div className="toolbar">
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Role</button>
        </div>
      </div>
      <div className="card">
        {items.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Role Name</th><th>Permissions</th><th></th></tr></thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id}>
                    <td className="fw-600">{r.name}</td>
                    <td className="text-muted text-sm">{Object.keys(r.permissions || {}).join(', ') || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Pencil size={13} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleting(r.id)}><Trash2 size={13} /></button>
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
        <Modal title={editing ? 'Edit Role' : 'New Role'} onClose={() => setModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Role Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          </div>
        </Modal>
      )}
      {deleting && <Confirm message="Delete this role?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
