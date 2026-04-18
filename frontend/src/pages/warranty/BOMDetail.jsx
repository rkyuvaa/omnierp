import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';

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

  const save = async () => {
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

      <div className="card">
        <div className="form-group">
          <label className="form-label">BOM Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Standard EV Kit" />
        </div>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the components included..." />
        </div>
      </div>
    </Layout>
  );
}
