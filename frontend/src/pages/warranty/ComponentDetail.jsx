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
  const [categories, setCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load config dropdowns
    api.get('/warranty/config/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get('/warranty/config/taxes').then(r => setTaxes(r.data)).catch(() => {});

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return <Layout title="Component Detail"><Loader /></Layout>;

  return (
    <Layout title={isNew ? 'New Component' : `Component — ${form.name}`}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/warranty/bom')}><ArrowLeft size={15}/> Back</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={15}/> {saving ? 'Saving...' : 'Save Component'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
        {/* Image Card */}
        <div className="card">
          <div style={{ textAlign: 'center' }}>
            {form.image_url ? (
              <img src={form.image_url} alt={form.name} style={{ width: '100%', borderRadius: 12, marginBottom: 16, border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg2)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', border: '2px dashed var(--border)', marginBottom: 16 }}>
                <Upload size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>No Image</span>
              </div>
            )}
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Image URL</label>
              <input className="form-input" value={form.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        {/* Main Details */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lithium Battery 60V" />
            </div>

            <div className="form-group">
              <label className="form-label">Part Number *</label>
              <input className="form-input" value={form.part_number} onChange={e => set('part_number', e.target.value)} placeholder="e.g. BAT-60V-L1" />
            </div>

            {/* Product Category Dropdown */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Product Category
                {categories.length === 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>Add in Configuration tab</span>}
              </label>
              <select className="form-input" value={form.category || ''} onChange={e => set('category', e.target.value)}>
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Product Type</label>
              <select className="form-input" value={form.product_type || 'Storable'} onChange={e => set('product_type', e.target.value)}>
                <option value="Storable">Storable Product</option>
                <option value="Consumable">Consumable</option>
                <option value="Service">Service</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Sales Price (₹)</label>
              <input className="form-input" type="number" value={form.sales_price || 0} onChange={e => set('sales_price', parseFloat(e.target.value) || 0)} />
            </div>

            {/* Sales Taxes Dropdown */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Sales Taxes
                {taxes.length === 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>Add in Configuration tab</span>}
              </label>
              <select className="form-input" value={form.sales_taxes || 0} onChange={e => set('sales_taxes', parseFloat(e.target.value) || 0)}>
                <option value={0}>— No Tax —</option>
                {taxes.map(t => <option key={t.id} value={t.rate}>{t.name} ({t.rate}%)</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">On Hand Qty</label>
              <input className="form-input" type="number" value={form.on_hand_qty || 0} onChange={e => set('on_hand_qty', parseFloat(e.target.value) || 0)} />
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
