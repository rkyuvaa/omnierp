import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import { Badge, Empty, Loader, Confirm } from './Shared';
import { useList, useStages } from '../hooks/useData';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Download, Trash2, Eye } from 'lucide-react';

export default function ModuleList({ title, endpoint, module, formPath, exportPath, columns }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [deleting, setDeleting] = useState(null);
  const stages = useStages(module);
  const { items, total, loading, reload } = useList(endpoint);
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
    await api.delete(`${endpoint}/${deleting}`);
    toast.success('Deleted'); setDeleting(null);
    reload({ search, stage_id: stageFilter || undefined });
  };

  return (
    <Layout title={title}>
      <div className="toolbar">
        <div className="search-bar">
          <Search size={15} />
          <input placeholder="Search..." value={search} onChange={handleSearch} />
        </div>
        <div className="stage-filters">
          {stages.map(s => (
            <div key={s.id} className={`stage-pill ${stageFilter === s.id ? 'active' : ''}`}
              style={stageFilter === s.id ? { background: s.color, borderColor: s.color } : { borderColor: s.color, color: s.color }}
              onClick={() => handleStage(s.id)}>{s.name}</div>
          ))}
        </div>
        <div className="toolbar-right">
          <button className="btn btn-ghost btn-sm" onClick={() => window.open(`${window.location.protocol}//${window.location.hostname}:8000/api${exportPath}`, '_blank')}>
            <Download size={14} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`${formPath}/new`)}><Plus size={15} /> New</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{title}</span>
          <span className="text-muted text-sm">{total} total</span>
        </div>
        {loading ? <Loader /> : items.length === 0 ? <Empty /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reference</th>{columns.map(c => <th key={c.key}>{c.label}</th>)}<th>Stage</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${formPath}/${row.id}`)}>
                    <td><span className="ref-text">{row.reference}</span></td>
                    {columns.map(c => <td key={c.key} className={c.muted ? 'text-muted' : c.bold ? 'fw-600' : ''}>{row[c.key] || '—'}</td>)}
                    <td>{row.stage_name && <Badge color={row.stage_color}>{row.stage_name}</Badge>}</td>
                    <td className="text-muted text-sm">{row.created_at?.slice(0,10)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`${formPath}/${row.id}`)}><Eye size={13} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleting(row.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {deleting && <Confirm message="Delete this record?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
