import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Badge, Empty, Loader, Confirm } from '../../components/Shared';
import { useList, useStages } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Download, Trash2, Eye, ChevronDown, ChevronUp, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';


// ── Import/Export Modal ───────────────────────────────────────
function ImportExportModal({ onClose, onImported }) {
  const [tab, setTab] = useState('export');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef(null);
  const token = localStorage.getItem('token');
  const baseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;

  const downloadFile = (url, filename) => {
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Download failed');
        return r.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      })
      .catch(() => toast.error('Download failed'));
  };

  const downloadExport = () => downloadFile(`${baseUrl}/api/crm/leads/export`, 'leads_export.xlsx');
  const downloadTemplate = () => downloadFile(`${baseUrl}/api/crm/leads/import-template`, 'leads_import_template.xlsx');

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setResult(null); setPreview(null);
    setPreviewing(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch(`${baseUrl}/api/crm/leads/import/preview`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      const data = await r.json();
      setPreview(data);
    } catch { setPreview(null); }
    finally { setPreviewing(false); }
  };

  const doImport = async () => {
    if (!file) return;
    setImporting(true); setResult(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${baseUrl}/api/crm/leads/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
      });
      const data = await r.json();
      setResult(data);
      if (data.created + data.updated > 0) onImported();
    } catch (e) { setResult({ created:0, updated:0, errors:[String(e)] }); }
    finally { setImporting(false); }
  };

  const tabStyle = (t) => ({
    padding: '8px 24px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: 'transparent', borderBottom: tab===t ? '2px solid var(--accent)' : '2px solid transparent',
    color: tab===t ? 'var(--accent)' : 'var(--text2)', marginBottom: -2, transition: 'all 0.15s'
  });

  return (
    <Modal title="Import / Export Leads" onClose={onClose} large
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>

      {/* Tab switcher */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:20 }}>
        <button style={tabStyle('export')} onClick={() => setTab('export')}>📤 Export</button>
        <button style={tabStyle('import')} onClick={() => setTab('import')}>📥 Import</button>
      </div>

      {/* ── EXPORT TAB ── */}
      {tab === 'export' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ padding:16, background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, marginBottom:6, fontSize:14 }}>📊 Export All Leads</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, lineHeight:1.6 }}>
              Downloads all leads with all columns including custom fields as a formatted Excel file.
              File fields are excluded. The export also includes an Import Template sheet for reference.
            </div>
            <button className="btn btn-primary" onClick={downloadExport} style={{ gap:8 }}>
              <Download size={15}/> Download Leads Export (.xlsx)
            </button>
          </div>

          <div style={{ padding:16, background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, marginBottom:6, fontSize:14 }}>📋 Download Import Template</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, lineHeight:1.6 }}>
              Downloads a blank template with all column headers and field hints.
              Fill in your data and upload using the Import tab.
            </div>
            <button className="btn btn-ghost" onClick={downloadTemplate} style={{ gap:8 }}>
              <FileText size={15}/> Download Template (.xlsx)
            </button>
          </div>

          <div style={{ padding:12, background:'var(--bg2)', borderRadius:8, fontSize:11, color:'var(--text3)', lineHeight:1.8 }}>
            <b>Export includes:</b> Reference, Title, Customer Name, Email, Phone, Stage, Assigned To, Created At
            + all active custom fields (text, number, date, selection, checkbox, boolean).<br/>
            <b>File upload fields are excluded</b> from export.
          </div>
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Instructions */}
          <div style={{ padding:12, background:'var(--bg3)', borderRadius:8, fontSize:12, color:'var(--text2)', lineHeight:1.8, border:'1px solid var(--border)' }}>
            <b>How to import:</b><br/>
            1. Download the template below or use a previously exported file.<br/>
            2. Fill in your data starting from row 3 (row 2 contains field hints).<br/>
            3. <b>Title</b> is required. <b>Reference</b> is optional — leave blank to auto-generate.<br/>
            4. If Reference matches an existing lead, it will be <b>updated</b>. Otherwise a new lead is created.<br/>
            5. Stage and Assigned To must match exact existing names.
          </div>

          <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ alignSelf:'flex-start', gap:6 }}>
            <FileText size={13}/> Download Template first
          </button>

          {/* File picker */}
          <div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleFileChange}/>
            <div onClick={() => fileRef.current?.click()}
              style={{ border:'2px dashed var(--border)', borderRadius:10, padding:'28px 20px', textAlign:'center',
                cursor:'pointer', background:'var(--bg3)', transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
              <Upload size={28} style={{ color:'var(--accent)', marginBottom:8 }}/>
              <div style={{ fontWeight:600, marginBottom:4 }}>
                {file ? file.name : 'Click to choose .xlsx file'}
              </div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>
                {file ? `${(file.size/1024).toFixed(1)} KB` : 'Supports .xlsx format'}
              </div>
            </div>
          </div>

          {/* Preview */}
          {previewing && <div style={{ textAlign:'center', color:'var(--text2)', fontSize:13 }}>Analysing file...</div>}
          {preview && !previewing && (
            <div style={{ padding:14, background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:700, marginBottom:10, fontSize:13 }}>📋 Preview</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, fontSize:12 }}>
                <div style={{ padding:'8px 12px', background:'var(--bg2)', borderRadius:8 }}>
                  <div style={{ color:'var(--text3)', fontSize:11 }}>ROWS TO IMPORT</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'var(--accent)' }}>{preview.total_rows}</div>
                </div>
                <div style={{ padding:'8px 12px', background:'var(--bg2)', borderRadius:8 }}>
                  <div style={{ color:'var(--text3)', fontSize:11 }}>MATCHED COLUMNS</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'var(--green)' }}>{preview.recognised_columns?.length}</div>
                </div>
              </div>

              {preview.unrecognised_columns?.length > 0 && (
                <div style={{ padding:'8px 12px', background:'rgba(245,158,11,0.1)', borderRadius:8, marginBottom:8, fontSize:12 }}>
                  <b style={{ color:'var(--amber)' }}>⚠️ Unrecognised columns (will be ignored):</b>{' '}
                  {preview.unrecognised_columns.join(', ')}
                </div>
              )}

              {preview.sample?.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>SAMPLE ROWS</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
                      <thead>
                        <tr>{Object.keys(preview.sample[0]).slice(0,6).map(h => (
                          <th key={h} style={{ padding:'6px 10px', background:'var(--bg2)', textAlign:'left', fontWeight:600, color:'var(--text2)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((row, i) => (
                          <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                            {Object.values(row).slice(0,6).map((v,j) => (
                              <td key={j} style={{ padding:'6px 10px', color:'var(--text)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ padding:14, borderRadius:10, border:`1px solid ${result.errors?.length ? 'var(--amber)' : 'var(--green)'}`,
              background: result.errors?.length ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' }}>
              <div style={{ display:'flex', gap:16, marginBottom: result.errors?.length ? 10 : 0 }}>
                <div style={{ textAlign:'center' }}>
                  <CheckCircle size={16} style={{ color:'var(--green)' }}/>
                  <div style={{ fontSize:20, fontWeight:800, color:'var(--green)' }}>{result.created}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>Created</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <CheckCircle size={16} style={{ color:'var(--accent)' }}/>
                  <div style={{ fontSize:20, fontWeight:800, color:'var(--accent)' }}>{result.updated}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>Updated</div>
                </div>
                {result.errors?.length > 0 && (
                  <div style={{ textAlign:'center' }}>
                    <AlertCircle size={16} style={{ color:'var(--amber)' }}/>
                    <div style={{ fontSize:20, fontWeight:800, color:'var(--amber)' }}>{result.errors.length}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>Errors</div>
                  </div>
                )}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ maxHeight:120, overflowY:'auto', fontSize:11, color:'var(--amber)' }}>
                  {result.errors.map((e,i) => <div key={i} style={{ padding:'2px 0', borderTop:'1px solid var(--border)' }}>{e}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          {file && preview && !result && (
            <button className="btn btn-primary" onClick={doImport} disabled={importing} style={{ gap:8 }}>
              {importing ? <div className="spinner" style={{ width:14, height:14 }}/> : <Upload size={15}/>}
              {importing ? 'Importing...' : `Import ${preview.total_rows} Rows`}
            </button>
          )}
          {result && (result.created + result.updated > 0) && (
            <button className="btn btn-ghost" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>
              Import another file
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function CRMLeads() {
  const [search, setSearch] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);
  const fileRef = useRef(null);
  const [stageFilter, setStageFilter] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [actDateFrom, setActDateFrom] = useState('');
  const [actDateTo, setActDateTo] = useState('');
  const [activityFilter, setActivityFilter] = useState(null);
  const stages = useStages('crm');
  const { items, total, loading, reload, page, setPage } = useList('/crm/leads', {});
  const [selected, setSelected] = useState([]);
  const [filteredItems, setFilteredItems] = useState(null);
  const { user } = useAuth();
  const perms = user?.is_superadmin ? {can_read:true, can_create:true, can_edit:true, can_delete:true} : (user?.module_permissions?.['crm'] || {});
  const navigate = useNavigate();
  const timer = useRef(null);

  useEffect(() => {
    api.get('/crm/dashboard').then(r => setDashboard(r.data)).catch(() => {});
  }, []);

  const loadDashboardWithRange = () => {
    const params = new URLSearchParams();
    if (actDateFrom) params.append('date_from', actDateFrom);
    if (actDateTo) params.append('date_to', actDateTo);
    api.get(`/crm/dashboard?${params.toString()}`).then(r => setDashboard(r.data)).catch(() => {});
  };

  useEffect(() => { loadDashboardWithRange(); }, [actDateFrom, actDateTo]);

  useEffect(() => {
    if (!activityFilter) { setFilteredItems(null); return; }
    api.get('/crm/leads', { params: { activity_type: activityFilter.type, activity_day: activityFilter.day, limit: 100 } })
      .then(r => setFilteredItems(r.data.items || []))
      .catch(() => setFilteredItems([]));
  }, [activityFilter]);

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
    toast.success('Lead deleted'); setDeleting(null);
    reload({ search, stage_id: stageFilter || undefined });
  };

  const exportExcel = () => window.open(
    `${window.location.protocol}//${window.location.hostname}:8000/api/crm/leads/export/excel`, '_blank'
  );

  const actTypes = dashboard?.activity_types || [];
  const grid = dashboard?.activity_grid || {};
  const dayLabels = dashboard?.day_labels || ['today', 'tomorrow'];

  return (
    <Layout title="CRM — Leads">

      {/* ── Stage cards with lead count ── */}
      {dashboard && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, width: '100%' }}>
          {dashboard.stage_counts.map(s => (
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

      {/* ── Activity grid: today & tomorrow ── */}
      {dashboard && actTypes.length > 0 && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span className="card-title" style={{ fontSize: 13 }}>Upcoming Activities</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>From</label>
              <input type="date" value={actDateFrom} onChange={e => setActDateFrom(e.target.value)}
                style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--bg3)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}/>
              <label style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>To</label>
              <input type="date" value={actDateTo} onChange={e => setActDateTo(e.target.value)}
                style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--bg3)', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}/>
              {(actDateFrom || actDateTo) && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => { setActDateFrom(''); setActDateTo(''); }}>Clear</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAllActivity(v => !v)}
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                {showAllActivity ? <><ChevronUp size={12} /> My view</> : <><ChevronDown size={12} /> All users</>}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text3)', fontWeight: 600, width: 90 }}>Day</th>
                  {actTypes.map(t => (
                    <th key={t} style={{ textAlign: 'center', padding: '6px 10px', color: 'var(--text2)', fontWeight: 600 }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayLabels.map(day => (
                  <tr key={day} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 700, color: day === 'today' ? 'var(--accent)' : 'var(--text2)', textTransform: 'capitalize' }}>
                      {day}
                    </td>
                    {actTypes.map(t => {
                      const cell = grid[day]?.[t] || { mine: 0, all: 0 };
                      const count = showAllActivity ? cell.all : cell.mine;
                      return (
                        <td key={t} style={{ textAlign: 'center', padding: '6px 10px' }}>
			<span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 28, height: 28, borderRadius: 8, fontWeight: 700, fontSize: 13,
                            background: count > 0 ? 'var(--accent-dim)' : 'var(--bg3)',
                            color: count > 0 ? 'var(--accent)' : 'var(--text3)',
                            cursor: count > 0 ? 'pointer' : 'default',
                            transition: 'all 0.15s',
                          }}
                          onClick={() => count > 0 && setActivityFilter({ day, type: t })}
                          title={count > 0 ? `Show ${count} ${t} for ${day}` : ''}
                        >{count}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="search-bar">
          <Search size={15} />
          <input placeholder="Search leads..." value={search} onChange={handleSearch} />
        </div>
        <div className="toolbar-right">
          {selected.length > 0 && (
            <button className="btn btn-danger btn-sm" style={{ fontWeight: 600, letterSpacing: '0.5px' }} onClick={async () => {
              if(!window.confirm(`Permanently wipe ${selected.length} records off the Database?`)) return;
              try {
                const results = await Promise.all(selected.map(id => api.delete(`/crm/leads/${id}`)));
                toast.success('Batch Deletion Process Completed.');
                setSelected([]); reload();
              } catch { toast.error('Partial Error: Access Restrictions Hit.'); }
            }}>
              DELETE {selected.length} SELECTED
            </button>
          )}
          {user?.is_superadmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImportExport(true)} style={{ gap:6 }}>
              <Download size={14} /> Import / Export
            </button>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/crm/new')}><Plus size={15} /> New Lead</button>
        </div>
      </div>

      {/* ── Leads table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Leads</span>
          <span className="text-muted text-sm">{total} total</span>
        </div>
        {loading ? <Loader /> : (filteredItems || items).length === 0 ? <Empty message={activityFilter ? `No leads with ${activityFilter.type} activity ${activityFilter.day}` : "No records found"} /> : (<>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" style={{ transform:"scale(1.2)", cursor:"pointer" }} onChange={e => setSelected(e.target.checked ? (filteredItems || items).map(i => i.id) : [])} checked={(filteredItems || items).length > 0 && selected.length === (filteredItems || items).length} /></th><th>Reference</th><th>Title</th><th>Customer</th>
                  <th>Stage</th><th>Assignee</th><th>Created</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(filteredItems || items).map(l => (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/${l.id}`)}>
                    <td style={{ width: 40, textAlign: "center" }} onClick={e => e.stopPropagation()}>
<input type="checkbox" style={{ transform:"scale(1.2)", cursor:"pointer" }} checked={selected.includes(l.id)} onChange={e => { if (e.target.checked) setSelected([...selected, l.id]); else setSelected(selected.filter(id => id !== l.id)); }} />
</td>
                    <td><span className="ref-text">{l.reference}</span></td>
                    <td className="fw-600">{l.title}</td>
                    <td className="text-muted">{l.customer_name || '—'}</td>
                    <td>{l.stage_name && <Badge color={l.stage_color}>{l.stage_name}</Badge>}</td>
                    <td className="text-muted">{l.assignee_name || '—'}</td>
                    <td className="text-muted text-sm">{l.created_at?.slice(0,10)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/crm/${l.id}`)}><Eye size={13} /></button>
                        <>{perms?.can_delete && <button className="btn btn-danger btn-sm" onClick={() => setDeleting(l.id)}><Trash2 size={13} /></button>}</>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 20px', background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
          Showing up to 50 records per page <span style={{opacity:0.6, marginLeft: 8}}>(Total: {filteredItems ? filteredItems.length : total})</span>
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '4px 16px', fontWeight: 700, opacity: page === 1 ? 0.3 : 1 }}>← PREVIOUS</button>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', border: '2px solid rgba(25,84,2,0.1)', padding: '2px 14px', borderRadius: 20 }}>Page {page} of {Math.max(1, Math.ceil((filteredItems ? filteredItems.length : total) / 50))}</span>
          <button className="btn btn-ghost btn-sm" disabled={(filteredItems || items).length < 50} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 16px', fontWeight: 700, opacity: (filteredItems || items).length < 50 ? 0.3 : 1 }}>NEXT →</button>
        </div>
      </div>
      </>

        )}
      </div>

      {deleting && <Confirm message="Delete this lead?" onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
      {showImportExport && <ImportExportModal onClose={() => setShowImportExport(false)} onImported={() => { reload({}); setShowImportExport(false); }} />}
    </Layout>
  );
}
