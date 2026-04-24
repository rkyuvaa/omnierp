import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import { Badge, Empty, Loader, Confirm } from './Shared';
import { useList, useStages } from '../hooks/useData';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Download, Trash2, Eye } from 'lucide-react';
import SmartSearch from './SmartSearch';

export default function ModuleList({ 
  title, endpoint, module, formPath, exportPath, columns, 
  extraFilters = {}, headerContent, topContent, stageLimit, 
  allowedStages, batchActions, showStages = true, toolbarActions, 
  headerTabs, filters = [], groupBys = [] 
}) {
  const [searchParams, setSearchParams] = useState({ search: '', filters: {}, group_by: null });
  const [selected, setSelected] = useState([]);
  const [stageFilter, setStageFilter] = useState('');
  const [deleting, setDeleting] = useState(null);
  const stages = useStages(module);
  const { items, total, loading, reload, stageCounts, page, setPage } = useList(endpoint, { ...extraFilters, filters: searchParams.filters, search: searchParams.search, group_by: searchParams.group_by });
  const { user } = useAuth();
  const perms = user?.is_superadmin ? {can_read:true, can_create:true, can_edit:true, can_delete:true} : (user?.module_permissions?.[module] || {});
  const navigate = useNavigate();
  const timer = useRef(null);

  const handleSmartSearch = (params) => {
    setSearchParams(params);
    reload({ ...extraFilters, filters: params.filters, search: params.search, group_by: params.group_by, stage_id: stageFilter || undefined });
  };

  const handleStage = id => {
    const v = id === stageFilter ? '' : id;
    setStageFilter(v);
    reload({ ...extraFilters, filters: searchParams.filters, search: searchParams.search, group_by: searchParams.group_by, stage_id: v || undefined });
  };
  const confirmDelete = async () => {
    await api.delete(`${endpoint}/${deleting}`);
    toast.success('Deleted'); setDeleting(null);
    reload({ ...extraFilters, filters: searchParams.filters, search: searchParams.search, group_by: searchParams.group_by, stage_id: stageFilter || undefined });
  };

  if (!perms.can_read && !user?.is_superadmin) return <Layout title={title}><Empty message="Access Denied: You do not have permission to view this module." /></Layout>;

  return (
    <Layout title={title} headerTabs={headerTabs}>
      {topContent && <div style={{ marginBottom: 16 }}>{topContent}</div>}
      
      <div className="toolbar" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative', zIndex: 1000 }}>
        <div style={{ flex: 1 }}>
          <SmartSearch 
            module={module}
            onSearch={handleSmartSearch} 
            filters={filters} 
            groupBys={groupBys} 
            columns={columns}
            placeholder={`Search ${title}...`} 
          />
        </div>
        <div className="toolbar-right" style={{ paddingTop: 2 }}>
          {selected.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {batchActions && batchActions(selected, () => { setSelected([]); reload(); })}
              <button className="btn btn-danger btn-sm" style={{ fontWeight: 600, letterSpacing: '0.5px' }} onClick={async () => {
                if(!window.confirm(`Permanently wipe ${selected.length} records off the Global Database?`)) return;
                try {
                  const results = await Promise.all(selected.map(id => api.delete(`${endpoint}/${id}`)));
                  toast.success('Batch Deletion Process Completed.');
                  setSelected([]); reload();
                } catch { toast.error('Partial Error: Access Restrictions Hit.'); }
              }}>
                DELETE {selected.length} SELECTED
              </button>
            </div>
          )}
          {toolbarActions && toolbarActions}
          {(user?.is_superadmin || user?.role === 'admin' || user?.role === 'manager') && exportPath && (
            <button className="btn btn-ghost btn-sm" onClick={() => window.open(`${window.location.protocol}//${window.location.hostname}:8000/api${exportPath}`, '_blank')}>
              <Download size={14} /> Export
            </button>
          )}
          {perms.can_create && <button className="btn btn-primary" onClick={() => navigate(`${formPath}/new`)}><Plus size={15} /> New</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
            <span className="text-muted text-sm" style={{ fontWeight: 600, opacity: 0.7 }}>{total} records</span>
          </div>

          {showStages && stages && stages.length > 0 && (
            <div className="stage-ribbon" style={{ display: 'flex', gap: 6, paddingBottom: 10, width: '100%', marginTop: 8, flexWrap: 'wrap' }}>
              {(allowedStages ? stages.filter(s => s.name && allowedStages.map(a => a.toUpperCase().trim()).includes(s.name.toUpperCase().trim())) : (stageLimit ? stages.slice(stageLimit) : stages)).map(s => { const sc = stageCounts ? (stageCounts[String(s.id)] || 0) : s.count; return (
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
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.1 }}>{s.name}</span>
                  <span style={{ 
                    fontSize: 14, fontWeight: 900,
                    background: '#ffffff', color: s.color,
                    minWidth: 26, height: 26, borderRadius: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', padding: '0 4px',
                    marginTop: 'auto'
                  }}>
                    {sc}
                  </span>
                </div>
              );})}
            </div>
          )}
          
          {headerContent && <div style={{ width: '100%' }}>{headerContent}</div>}
        </div>
        {loading ? <Loader /> : items.length === 0 ? <Empty /> : (<>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reference</th><th style={{ width: 40, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                {!searchParams.group_by && <input type="checkbox" style={{ transform:"scale(1.2)", cursor:"pointer" }} onChange={e => setSelected(e.target.checked ? items.map(i => i.id) : [])} checked={items.length > 0 && selected.length === items.length} />}
              </th>
{columns.map(c => <th key={c.key}>{c.label}</th>)}{showStages && <th>Stage</th>}<th>Created</th><th></th></tr></thead>
              <tbody>
                {searchParams.group_by ? (
                  items.map((group, gIdx) => (
                    <React.Fragment key={gIdx}>
                      <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
                        <td colSpan={columns.length + 5} style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--accent)', fontSize: 13 }}>
                          {group.group} ({group.items.length})
                        </td>
                      </tr>
                      {group.items.map(row => (
                        <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${formPath}/${row.id}`)}>
                          <td><span className="ref-text">{row.reference}</span></td>
                          <td></td>
                          {columns.map(c => <td key={c.key} className={c.muted ? 'text-muted' : c.bold ? 'fw-600' : ''}>{row[c.key] || '—'}</td>)}
                          {showStages && <td>{row.stage_name && <Badge color={row.stage_color}>{row.stage_name}</Badge>}</td>}
                          <td className="text-muted text-sm">{row.created_at?.slice(0,10)}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`${formPath}/${row.id}`)}><Eye size={13} /></button>
                              {perms.can_delete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(row.id)}><Trash2 size={13} /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  items.map(row => (
                    <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${formPath}/${row.id}`)}>
                      <td><span className="ref-text">{row.reference}</span></td>
                      <td style={{ width: 40, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          style={{ transform:"scale(1.2)", cursor:"pointer" }} 
                          checked={selected.includes(row.id)} 
                          onChange={e => { 
                            if (e.target.checked) setSelected([...selected, row.id]); 
                            else setSelected(selected.filter(id => id !== row.id)); 
                          }} 
                        />
                      </td>
                      {columns.map(c => <td key={c.key} className={c.muted ? 'text-muted' : c.bold ? 'fw-600' : ''}>{row[c.key] || '—'}</td>)}
                      {showStages && <td>{row.stage_name && <Badge color={row.stage_color}>{row.stage_name}</Badge>}</td>}
                      <td className="text-muted text-sm">{row.created_at?.slice(0,10)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`${formPath}/${row.id}`)}><Eye size={13} /></button>
                          {perms.can_delete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(row.id)}><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 20px', background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
          Showing up to 50 records per page <span style={{opacity:0.6, marginLeft: 8}}>(Database Total: {total})</span>
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '4px 16px', fontWeight: 700, opacity: page === 1 ? 0.3 : 1 }}>← PREVIOUS</button>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', border: '2px solid rgba(25,84,2,0.1)', padding: '2px 14px', borderRadius: 20 }}>Page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
          <button className="btn btn-ghost btn-sm" disabled={items.length < 50} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 16px', fontWeight: 700, opacity: items.length < 50 ? 0.3 : 1 }}>NEXT →</button>
        </div>
      </div>
        </>

        )}
      </div>
      {deleting && <Confirm message="Delete this record?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
