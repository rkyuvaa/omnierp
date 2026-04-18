import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Badge, Loader } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminModules() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/modules/').then(r => setModules(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const toggle = async (m) => {
    await api.put(`/modules/${m.id}/toggle`);
    toast.success(`${m.name} ${m.is_active ? 'disabled' : 'enabled'}`);
    load();
  };

  if (loading) return <Layout title="Modules"><Loader /></Layout>;

  return (
    <Layout title="Module Management">
      <div className="card">
        <div className="card-header">
          <span className="card-title">System Modules</span>
          <span className="text-muted text-sm">Enable or disable modules globally</span>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {modules.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '16px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div className="fw-600" style={{ marginBottom: 4 }}>{m.name}</div>
                <div className="text-muted text-sm">Module key: <code style={{ color: 'var(--accent2)', fontFamily: 'monospace' }}>{m.key}</code></div>
              </div>
              <Badge color={m.is_active ? 'var(--green)' : 'var(--text3)'} style={{ marginRight: 16 }}>
                {m.is_active ? 'Active' : 'Disabled'}
              </Badge>
              <button className="btn btn-ghost" onClick={() => toggle(m)} style={{ gap: 8 }}>
                {m.is_active
                  ? <><ToggleRight size={20} style={{ color: 'var(--green)' }} /> Disable</>
                  : <><ToggleLeft size={20} style={{ color: 'var(--text3)' }} /> Enable</>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
