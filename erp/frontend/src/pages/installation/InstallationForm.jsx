import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Badge } from '../../components/Shared';
import CustomFields from '../../components/CustomFields';
import { useStages, useUsers, useCustomFields } from '../../hooks/useData';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

const empty = { customer_name: '', vehicle_number: '', vehicle_make: '', vehicle_model: '', stage_id: '', technician_id: '', notes: '', custom_data: {} };

export default function InstallationForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const stages = useStages('installation');
  const users = useUsers();
  const customFields = useCustomFields('installation');

  useEffect(() => {
    if (!isNew) {
      api.get(`/installation/${id}`).then(r => {
        setForm({ ...empty, ...r.data, custom_data: r.data.custom_data || {} });
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setForm(f => ({ ...f, custom_data: { ...f.custom_data, [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, technician_id: form.technician_id || null };
      if (isNew) { const r = await api.post('/installation/', payload); toast.success('Created'); navigate(`/installation/${r.data.id}`); }
      else { await api.put(`/installation/${id}`, payload); toast.success('Saved'); }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <Layout title="Installation"><Loader /></Layout>;

  return (
    <Layout title={isNew ? 'New Installation' : `Installation — ${form.reference || ''}`}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/installation')}><ArrowLeft size={15} /> Back</button>
        {!isNew && form.reference && <span className="ref-text" style={{ fontSize: 14 }}>{form.reference}</span>}
        {!isNew && stages.length > 0 && (
          <div className="flex gap-2">
            {stages.map(s => (
              <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => set('stage_id', s.id)}
                style={form.stage_id === s.id ? { background: s.color, borderColor: s.color, color: 'white' } : { borderColor: s.color, color: s.color }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      <div className="detail-layout">
        <div className="card">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input className="form-input" value={form.customer_name || ''} onChange={e => set('customer_name', e.target.value)} />
            </div>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Vehicle Number</label>
                <input className="form-input" value={form.vehicle_number || ''} onChange={e => set('vehicle_number', e.target.value)} placeholder="TN01AB1234" />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Make</label>
                <input className="form-input" value={form.vehicle_make || ''} onChange={e => set('vehicle_make', e.target.value)} placeholder="Toyota" />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Model</label>
                <input className="form-input" value={form.vehicle_model || ''} onChange={e => set('vehicle_model', e.target.value)} placeholder="Innova" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            </div>
            {customFields.length > 0 && <CustomFields fields={customFields} values={form.custom_data} onChange={setCustom} />}
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="detail-section-title">Assignment</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Stage</label>
              <select className="form-select" value={form.stage_id || ''} onChange={e => set('stage_id', parseInt(e.target.value) || null)}>
                <option value="">— Select —</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Technician</label>
              <select className="form-select" value={form.technician_id || ''} onChange={e => set('technician_id', parseInt(e.target.value) || null)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
