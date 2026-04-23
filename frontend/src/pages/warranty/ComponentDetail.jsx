import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Upload } from 'lucide-react';

export default function ComponentDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', category: '', part_number: '', product_type: 'Storable',
    sales_price: 0, sales_taxes: 0, on_hand_qty: 0, image_url: ''
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      api.get(`/warranty/components/${id}`)
        .then(r => setForm(r.data))
        .catch(() => toast.error('Failed to load component'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const save = async () => {
    if (!form.name || !form.part_number) return toast.error('Name and Part Number are required');
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/warranty/components', form);
        toast.success('Component created');
        navigate('/warranty/bom');
      } else {
        await api.put(`/warranty/components/${id}`, form);
        toast.success('Component updated');
      }
    } catch (err) {
      toast.error('Save failed: ' + (err.response?.data?.detail || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout title="Component Detail"><Loader /></Layout>;

  return (
    <Layout title={isNew ? 'New Component' : `Component — ${form.name}`}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/warranty/bom')}><ArrowLeft size={15}/> Back</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={15}/> {saving ? 'Saving...' : 'Save Component'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {form.image_url ? (
              <img src={form.image_url} alt={form.name} style={{ width: '100%', borderRadius: 12, marginBottom: 16, border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg2)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', border: '2px dashed var(--border)', marginBottom: 16 }}>
                <Upload size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>No Image Uploaded</span>
              </div>
            )}
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Image URL</label>
              <input className="form-input" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="https://..." />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Lithium Ion Battery 60V" />
            </div>
            <div className="form-group">
              <label className="form-label">Part Number</label>
              <input className="form-input" value={form.part_number} onChange={e => setForm({...form, part_number: e.target.value})} placeholder="e.g. BAT-60V-L1" />
            </div>
            <div className="form-group">
              <label className="form-label">Product Category</label>
              <input className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Electronics, Battery, Chassis" />
            </div>
            <div className="form-group">
              <label className="form-label">Product Type</label>
              <select className="form-input" value={form.product_type} onChange={e => setForm({...form, product_type: e.target.value})}>
                <option value="Storable">Storable Product</option>
                <option value="Consumable">Consumable</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sales Price (₹)</label>
              <input className="form-input" type="number" value={form.sales_price} onChange={e => setForm({...form, sales_price: parseFloat(e.target.value)||0})} />
            </div>
            <div className="form-group">
              <label className="form-label">Sales Taxes (%)</label>
              <input className="form-input" type="number" value={form.sales_taxes} onChange={e => setForm({...form, sales_taxes: parseFloat(e.target.value)||0})} />
            </div>
            <div className="form-group">
              <label className="form-label">On Hand Qty</label>
              <input className="form-input" type="number" value={form.on_hand_qty} onChange={e => setForm({...form, on_hand_qty: parseFloat(e.target.value)||0})} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
