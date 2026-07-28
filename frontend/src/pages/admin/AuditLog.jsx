import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Badge, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';

const MODULES = ['', 'crm', 'installation', 'service', 'users'];

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const load = (mod = moduleFilter, search = searchTerm) => {
    setLoading(true);
    api.get('/audit/', { params: { module: mod || undefined, search: search || undefined, limit: 200 } })
      .then(r => { setLogs(r.data.items); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const actionColor = a => a === 'CREATE' ? 'var(--green)' : a === 'UPDATE' ? 'var(--amber)' : 'var(--red)';

  return (
    <Layout title="Audit Log">
      <div className="toolbar mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center' }}>
          <input 
            className="form-input" 
            placeholder="Search by record ref or user..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            style={{ maxWidth: 300 }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => load()}>Search</button>
          <span className="text-muted text-sm ml-auto">{total} entries</span>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {MODULES.map(m => (
            <button key={m || 'all'} className="btn btn-ghost btn-sm" onClick={() => { setModuleFilter(m); load(m); }}
              style={moduleFilter === m ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}>
              {m || 'All'}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        {loading ? <Loader /> : logs.length === 0 ? <Empty message="No audit logs found" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>Changes</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{l.created_at?.slice(0, 19).replace('T', ' ')}</td>
                    <td className="fw-600">{l.user_name}</td>
                    <td><Badge color={actionColor(l.action)}>{l.action}</Badge></td>
                    <td><Badge color="var(--accent2)">{l.module}</Badge></td>
                    <td><span className="ref-text">{l.record_ref}</span></td>
                    <td style={{ fontSize: 10, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {Object.entries(l.changes || {}).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 2 }}>
                          <b>{k}:</b> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </div>
                      ))}
                    </td>
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
