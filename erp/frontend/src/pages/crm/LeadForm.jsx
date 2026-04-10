import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Badge } from '../../components/Shared';
import CustomFields from '../../components/CustomFields';
import { useStages, useUsers, useCustomFields } from '../../hooks/useData';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Check } from 'lucide-react';

const empty = { title: '', customer_name: '', email: '', phone: '', stage_id: '', assigned_to: '', expected_revenue: 0, notes: '', custom_data: {} };

export default function LeadForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [actType, setActType] = useState('note');
  const [actDesc, setActDesc] = useState('');
  const [activities, setActivities] = useState([]);
  const stages = useStages('crm');
  const users = useUsers();
  const customFields = useCustomFields('crm');

  useEffect(() => {
    if (!isNew) {
      api.get(`/crm/leads/${id}`).then(r => {
        setForm({ ...empty, ...r.data, custom_data: r.data.custom_data || {} });
        setActivities(r.data.activities || []);
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setForm(f => ({ ...f, custom_data: { ...f.custom_data, [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, assigned_to: form.assigned_to || null };
      if (isNew) { const r = await api.post('/crm/leads', payload); toast.success('Lead created'); navigate(`/crm/${r.data.id}`); }
      else { await api.put(`/crm/leads/${id}`, payload); toast.success('Saved'); }
    } catch (e) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const addActivity = async () => {
    if (!actDesc.trim()) return;
    const r = await api.post('/crm/activities', { lead_id: parseInt(id), activity_type: actType, description: actDesc });
    setActivities(a => [r.data, ...a]); setActDesc(''); toast.success('Activity added');
  };

  const markDone = async (aid) => {
    await api.put(`/crm/activities/${aid}/done`);
    setActivities(a => a.map(x => x.id === aid ? { ...x, done: true } : x));
  };

  if (loading) return <Layout title="Lead"><Loader /></Layout>;

  return (
    <Layout title={isNew ? 'New Lead' : form.title || 'Lead'}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/crm')}><ArrowLeft size={15} /> Back</button>
        {!isNew && form.reference && <span className="ref-text" style={{ fontSize: 14 }}>{form.reference}</span>}
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      {!isNew && stages.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {stages.map(s => (
            <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => set('stage_id', s.id)}
              style={form.stage_id === s.id ? { background: s.color, borderColor: s.color, color: 'white' } : { borderColor: s.color, color: s.color }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="detail-layout">
        <div>
          <div className="card mb-4">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Lead title" />
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" value={form.customer_name || ''} onChange={e => set('customer_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Revenue</label>
                  <input className="form-input" type="number" value={form.expected_revenue} onChange={e => set('expected_revenue', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
              {customFields.length > 0 && <CustomFields fields={customFields} values={form.custom_data} onChange={setCustom} />}
            </div>
          </div>

          {!isNew && (
            <div className="card">
              <div className="card-header"><span className="card-title">Activities</span></div>
              <div className="flex gap-2 mb-4">
                <select className="form-select" style={{ width: 120 }} value={actType} onChange={e => setActType(e.target.value)}>
                  <option value="note">Note</option>
                  <option value="call">Call</option>
                  <option value="follow-up">Follow-up</option>
                </select>
                <input className="form-input" placeholder="Description..." value={actDesc} onChange={e => setActDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addActivity()} />
                <button className="btn btn-primary" onClick={addActivity}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activities.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, opacity: a.done ? 0.5 : 1 }}>
                    <Badge color={a.type === 'call' ? 'var(--green)' : a.type === 'follow-up' ? 'var(--amber)' : 'var(--accent)'}>{a.type}</Badge>
                    <span style={{ flex: 1 }}>{a.description}</span>
                    {!a.done && <button className="btn btn-ghost btn-sm" onClick={() => markDone(a.id)}><Check size={12} /></button>}
                  </div>
                ))}
                {activities.length === 0 && <p className="text-muted text-sm">No activities yet</p>}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
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
                <label className="form-label">Assigned To</label>
                <select className="form-select" value={form.assigned_to || ''} onChange={e => set('assigned_to', parseInt(e.target.value) || null)}>
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
