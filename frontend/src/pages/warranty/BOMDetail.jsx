import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';

export default function BOMDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', components: [] });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      api.get(`/warranty/boms/${id}`)
        .then(r => setForm(r.data))
        .catch(() => toast.error('Failed to load BOM'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const addComp = () => {
    setForm({
      ...form,
      components: [
        ...form.components,
        { name: '', part_number: '', quantity: 1, warranty_period: 0, warranty_unit: 'months', sort_order: form.components.length }
      ]
    });
  };

  const removeComp = (idx) => {
    const next = [...form.components];
    next.splice(idx, 1);
    setForm({ ...form, components: next });
  };

  const updateComp = (idx, key, val) => {
    const next = [...form.components];
    next[idx][key] = val;
    setForm({ ...form, components: next });
  };

  const save = async () => {
    if (!form.name) return toast.error('BOM Name is required');
    setSaving(true);
    try {
      if (isNew) {
        const r = await api.post('/warranty/boms', form);
        toast.success('BOM created');
        navigate(`/warranty/bom/${r.data.id}`);
      } else {
        await api.put(`/warranty/boms/${id}`, form);
        toast.success('BOM updated');
      }
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <Layout title="BOM Detail"><Loader /></Layout>;

  return (
    <Layout title={isNew ? 'New BOM' : `BOM — ${form.name}`}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/warranty/bom')}><ArrowLeft size={15}/> Back</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={15}/> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div>
          <div className="card">
            <div className="form-group">
              <label className="form-label">BOM / Model Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Standard EV Kit" />
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the model..." rows={4} />
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="card-title">Components / Parts</span>
              <button className="btn btn-ghost btn-sm" onClick={addComp}><Plus size={14}/> Add Part</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Part Name</th>
                    <th>Part Number</th>
                    <th style={{ width: 80 }}>Qty</th>
                    <th style={{ width: 140 }}>Warranty</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.components.map((c, idx) => (
                    <tr key={idx}>
                      <td>
                        <input className="form-input" style={{ padding: '4px 8px', fontSize: 13 }} value={c.name} onChange={e => updateComp(idx, 'name', e.target.value)} placeholder="e.g. Battery" />
                      </td>
                      <td>
                        <input className="form-input" style={{ padding: '4px 8px', fontSize: 13 }} value={c.part_number || ''} onChange={e => updateComp(idx, 'part_number', e.target.value)} placeholder="PN" />
                      </td>
                      <td>
                        <input className="form-input" type="number" style={{ padding: '4px 8px', fontSize: 13 }} value={c.quantity} onChange={e => updateComp(idx, 'quantity', parseInt(e.target.value)||0)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input className="form-input" type="number" style={{ padding: '4px 8px', fontSize: 13, width: 50 }} value={c.warranty_period} onChange={e => updateComp(idx, 'warranty_period', parseInt(e.target.value)||0)} />
                          <select className="form-input" style={{ padding: '4px 8px', fontSize: 12, border: 'none' }} value={c.warranty_unit} onChange={e => updateComp(idx, 'warranty_unit', e.target.value)}>
                            <option value="months">Mo</option>
                            <option value="years">Yr</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => removeComp(idx)}><Trash2 size={13}/></button>
                      </td>
                    </tr>
                  ))}
                  {form.components.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>No components added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
