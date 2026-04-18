import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Badge, Empty, Loader, Confirm } from '../../components/Shared';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Trash2, Eye } from 'lucide-react';

export default function InstallationList() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [stages, setStages] = useState([]);
  const [stageCounts, setStageCounts] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const perms = user?.is_superadmin ? { can_create: true, can_delete: true } : (user?.module_permissions?.['installation'] || {});
  const navigate = useNavigate();
  const timer = useRef(null);

  const load = (params = {}) => {
    setLoading(true);
    const q = { search, stage_id: stageFilter || undefined, page, ...params };
    api.get('/installation/', { params: q })
      .then(r => {
        const data = r.data;
        setItems(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/studio/stages/installation').then(r => setStages(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    // Count per stage
    if (stages.length > 0) {
      Promise.all(stages.map(s =>
        api.get('/installation/', { params: { stage_id: s.id, page: 1 } })
          .then(r => ({ id: s.id, count: r.data.total || 0, ...s }))
          .catch(() => ({ id: s.id, count: 0, ...s }))
      )).then(counts => setStageCounts(counts));
    }
  }, [stages]);

  useEffect(() => { load(); }, [page]);

  const doSearch = (v) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load({ search: v, page: 1 }), 350);
  };

  const handleSearch = e => { setSearch(e.target.value); doSearch(e.target.value); };

  const handleStage = (id) => {
    const v = id === stageFilter ? '' : id;
    setStageFilter(v);
    setPage(1);
    load({ stage_id: v || undefined, page: 1 });
  };

  const confirmDelete = async () => {
    await api.delete(`/installation/${deleting}`);
    toast.success('Deleted');
    setDeleting(null);
    load();
  };

  return (
    <Layout title="Installation">
      {/* Stage filter badges */}
      {stageCounts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {stageCounts.map(s => (
            <div key={s.id} onClick={() => handleStage(s.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 20, cursor: 'pointer', flex: 1, minWidth: '95px',
                height: 72, textAlign: 'center', transition: 'all 0.2s',
                border: `1.5px solid ${stageFilter === s.id ? s.color : (s.color + '40')}`,
                background: stageFilter === s.id ? s.color : (s.color + '15'),
                color: stageFilter === s.id ? '#ffffff' : s.color,
                boxShadow: stageFilter === s.id ? `0 4px 12px ${s.color}60` : 'none',
              }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.1 }}>{s.name}</span>
              <span style={{ 
                fontSize: 14, fontWeight: 900,
                background: '#ffffff', color: s.color,
                minWidth: 26, height: 26, borderRadius: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '0 4px',
                marginTop: 'auto'
              }}>
                {s.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-bar">
          <Search size={15} />
          <input placeholder="Search installations..." value={search} onChange={handleSearch} />
        </div>
        <div className="toolbar-right">
          {perms.can_create && (
            <button className="btn btn-primary" onClick={() => navigate('/installation/new')}>
              <Plus size={15} /> New Installation
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Installations</span>
          <span className="text-muted text-sm">{total} total</span>
        </div>
        {loading ? <Loader /> : items.length === 0 ? <Empty message="No installations found" /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Vehicle No.</th>
                    <th>Make / Model</th>
                    <th>Stage</th>
                    <th>Technician</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/installation/${i.id}`)}>
                      <td><span className="ref-text">{i.reference}</span></td>
                      <td className="fw-600">{i.customer_name || '—'}</td>
                      <td className="text-muted">{i.vehicle_number || '—'}</td>
                      <td className="text-muted">{[i.vehicle_make, i.vehicle_model].filter(Boolean).join(' / ') || '—'}</td>
                      <td>{i.stage_name && <Badge color={i.stage_color}>{i.stage_name}</Badge>}</td>
                      <td className="text-muted">{i.technician_name || '—'}</td>
                      <td className="text-muted text-sm">{i.created_at?.slice(0, 10)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/installation/${i.id}`)}><Eye size={13} /></button>
                          {perms.can_delete && (
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleting(i.id)}><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 20px', background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                Showing up to 50 per page <span style={{ opacity: 0.6, marginLeft: 8 }}>(Total: {total})</span>
              </span>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ opacity: page === 1 ? 0.3 : 1 }}>← PREVIOUS</button>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', border: '2px solid rgba(25,84,2,0.1)', padding: '2px 14px', borderRadius: 20 }}>Page {page}</span>
                <button className="btn btn-ghost btn-sm" disabled={items.length < 50} onClick={() => setPage(p => p + 1)} style={{ opacity: items.length < 50 ? 0.3 : 1 }}>NEXT →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {deleting && <Confirm message="Delete this installation?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
