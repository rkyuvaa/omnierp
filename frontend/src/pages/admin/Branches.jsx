import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Badge, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const emptyForm = { name: '', address: '', is_active: true };

export default function AdminBranches() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);

  const load = () => api.get('/branches/').then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const openNew = () => { setForm(emptyForm); setEditing(null); setModal(true); };
  const openEdit = b => { setForm({ name: b.name, address: b.address || '', is_active: b.is_active }); setEditing(b.id); setModal(true); };

  const save = async () => {
    try {
      if (editing) await api.put(`/branches/${editing}`, form);
      else await api.post('/branches/', form);
      toast.success('Saved'); setModal(false); load();
    } catch { toast.error('Error'); }
  };

  const confirmDelete = async () => {
    await api.delete(`/branches/${deleting}`);
    toast.success('Deleted'); setDeleting(null); load();
  };

  if (loading) return <Layout title="Branches"><Loader /></Layout>;

  return (
    <Layout title="Branch Management">
      <div className="toolbar">
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Branch</button>
        </div>
      </div>
      <div className="card">
        {items.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Address</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {items.map(b => (
                  <tr key={b.id}>
                    <td className="fw-600">{b.name}</td>
                    <td className="text-muted">{b.address || '—'}</td>
                    <td><Badge color={b.is_active ? 'var(--green)' : 'var(--red)'}>{b.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}><Pencil size={13} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleting(b.id)}><Trash2 size={13} /></button>
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
        <Modal title={editing ? 'Edit Branch' : 'New Branch'} onClose={() => setModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={form.address} onChange={e => set('address', e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.is_active} onChange={e => set('is_active', e.target.value === 'true')}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
      {deleting && <Confirm message="Delete this branch?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
