import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Badge, Empty, Loader, Confirm } from '../../components/Shared';
import { useList, useStages } from '../../hooks/useData';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Download, Trash2, Eye } from 'lucide-react';

export default function CRMLeads() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [deleting, setDeleting] = useState(null);
  const stages = useStages('crm');
  const { items, total, loading, reload } = useList('/crm/leads', {});
  const navigate = useNavigate();
  const timer = useRef(null);

  const doSearch = v => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => reload({ search: v, stage_id: stageFilter || undefined }), 350);
  };

  const handleSearch = e => { setSearch(e.target.value); doSearch(e.target.value); };
  const handleStage = id => {
    const v = id === stageFilter ? '' : id;
    setStageFilter(v);
    reload({ search, stage_id: v || undefined });
  };

  const confirmDelete = async () => {
    await api.delete(`/crm/leads/${deleting}`);
    toast.success('Lead deleted'); setDeleting(null); reload({ search, stage_id: stageFilter || undefined });
  };

  const exportExcel = () => window.open(`${window.location.protocol}//${window.location.hostname}:8000/api/crm/leads/export/excel`, '_blank');

  return (
    <Layout title="CRM — Leads">
      <div className="toolbar">
        <div className="search-bar">
          <Search size={15} />
          <input placeholder="Search leads..." value={search} onChange={handleSearch} />
        </div>
        <div className="stage-filters">
          {stages.map(s => (
            <div key={s.id} className={`stage-pill ${stageFilter === s.id ? 'active' : ''}`}
              style={stageFilter === s.id ? { background: s.color, borderColor: s.color } : { borderColor: s.color, color: s.color }}
              onClick={() => handleStage(s.id)}>{s.name}</div>
          ))}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-ghost btn-sm" onClick={exportExcel}><Download size={14} /> Export</button>
          <button className="btn btn-primary" onClick={() => navigate('/crm/new')}><Plus size={15} /> New Lead</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Leads</span>
          <span className="text-muted text-sm">{total} total</span>
        </div>
        {loading ? <Loader /> : items.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reference</th><th>Title</th><th>Customer</th><th>Stage</th><th>Assignee</th><th>Revenue</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {items.map(l => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/${l.id}`)}>
                    <td><span className="ref-text">{l.reference}</span></td>
                    <td className="fw-600">{l.title}</td>
                    <td className="text-muted">{l.customer_name || '—'}</td>
                    <td>{l.stage_name && <Badge color={l.stage_color}>{l.stage_name}</Badge>}</td>
                    <td className="text-muted">{l.assignee_name || '—'}</td>
                    <td>{l.expected_revenue > 0 ? `₹${l.expected_revenue.toLocaleString()}` : '—'}</td>
                    <td className="text-muted text-sm">{l.created_at?.slice(0,10)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/crm/${l.id}`)}><Eye size={13} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleting(l.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {deleting && <Confirm message="Delete this lead?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
