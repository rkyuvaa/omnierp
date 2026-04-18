import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Badge, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';

const MODULES = ['', 'crm', 'installation', 'service', 'users'];

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');

  const load = (mod = '') => {
    setLoading(true);
    api.get('/audit/', { params: { module: mod || undefined, limit: 200 } })
      .then(r => { setLogs(r.data.items); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const actionColor = a => a === 'CREATE' ? 'var(--green)' : a === 'UPDATE' ? 'var(--amber)' : 'var(--red)';

  return (
    <Layout title="Audit Log">
      <div className="toolbar mb-4">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {MODULES.map(m => (
            <button key={m || 'all'} className="btn btn-ghost btn-sm" onClick={() => { setModuleFilter(m); load(m); }}
              style={moduleFilter === m ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}>
              {m || 'All'}
            </button>
          ))}
        </div>
        <span className="text-muted text-sm ml-auto">{total} entries</span>
      </div>
      <div className="card">
        {loading ? <Loader /> : logs.length === 0 ? <Empty message="No audit logs found" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Record</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{l.created_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td className="fw-600">{l.user_name}</td>
                    <td><Badge color={actionColor(l.action)}>{l.action}</Badge></td>
                    <td><Badge color="var(--accent2)">{l.module}</Badge></td>
                    <td><span className="ref-text">{l.record_ref}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
