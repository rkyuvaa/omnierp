import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, X, RefreshCw, Upload, Download } from 'lucide-react';

const EMPTY = {
  system: '', issue: '', issue_code: '', subsystem: '',
  priority: '', safety_risk: '', operable_vehicle: '',
  diagnostic_method: '', action_type: '', corrective_action: '',
  part_id: '', qty: '', sop: '', labour_time_minutes: '',
  serviceable_location: '', warranty: '', warranty_policy: '',
  loaner_vehicle_required: false, part_cost: '', rework_cost: '',
  labour_cost: '', root_cause_category: '',
};

const PRIORITY_OPTS = ['Low', 'Medium', 'High', 'Critical'];
const YES_NO_OPTS = ['Yes', 'No', 'Conditional'];
const OPERABLE_OPTS = ['Yes', 'No', 'Limited'];
const WARRANTY_OPTS = ['Yes', 'No'];

const COLS = [
  { key: 'system', label: 'System' },
  { key: 'issue', label: 'Issue' },
  { key: 'issue_code', label: 'Issue Code' },
  { key: 'subsystem', label: 'Subsystem' },
  { key: 'priority', label: 'Priority' },
  { key: 'safety_risk', label: 'Safety Risk' },
  { key: 'operable_vehicle', label: 'Operable Vehicle' },
  { key: 'diagnostic_method', label: 'Diagnostic Method' },
  { key: 'action_type', label: 'Action Type' },
  { key: 'corrective_action', label: 'Corrective Action' },
  { key: 'part_id', label: 'Part ID' },
  { key: 'qty', label: 'Qty' },
  { key: 'sop', label: 'SOP' },
  { key: 'labour_time_minutes', label: 'Labour Time (min)' },
  { key: 'serviceable_location', label: 'Serviceable Location' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'warranty_policy', label: 'Warranty Policy' },
  { key: 'loaner_vehicle_required', label: 'Loaner Vehicle' },
  { key: 'part_cost', label: 'Part Cost' },
  { key: 'rework_cost', label: 'Rework Cost' },
  { key: 'labour_cost', label: 'Labour Cost' },
  { key: 'root_cause_category', label: 'Root Cause Category' },
];

// ── Row Edit Modal ──────────────────────────────────────────
function MatrixModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const Field = ({ label, k, type = 'text', opts }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {opts ? (
        <select className="form-select" value={form[k] || ''} onChange={e => set(k, e.target.value)}>
          <option value="">— Select —</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'checkbox' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!form[k]} onChange={e => set(k, e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 13 }}>Yes</span>
        </label>
      ) : type === 'textarea' ? (
        <textarea className="form-textarea" rows={2} value={form[k] || ''} onChange={e => set(k, e.target.value)} />
      ) : (
        <input className="form-input" type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial?.id ? 'Edit Row' : 'New Row'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="System" k="system" />
            <Field label="Subsystem" k="subsystem" />
            <Field label="Issue" k="issue" />
            <Field label="Issue Code" k="issue_code" />
            <Field label="Priority" k="priority" opts={PRIORITY_OPTS} />
            <Field label="Safety Risk" k="safety_risk" opts={YES_NO_OPTS} />
            <Field label="Operable Vehicle" k="operable_vehicle" opts={OPERABLE_OPTS} />
            <Field label="Root Cause Category" k="root_cause_category" />
            <Field label="Diagnostic Method" k="diagnostic_method" />
            <Field label="Action Type" k="action_type" />
            <div style={{ gridColumn: '1/-1' }}><Field label="Corrective Action" k="corrective_action" type="textarea" /></div>
            <Field label="Part ID" k="part_id" />
            <Field label="Qty" k="qty" type="number" />
            <Field label="SOP" k="sop" />
            <Field label="Labour Time (min)" k="labour_time_minutes" type="number" />
            <Field label="Serviceable Location" k="serviceable_location" />
            <Field label="Warranty" k="warranty" opts={WARRANTY_OPTS} />
            <div style={{ gridColumn: '1/-1' }}><Field label="Warranty Policy" k="warranty_policy" /></div>
            <Field label="Loaner Vehicle Required" k="loaner_vehicle_required" type="checkbox" />
            <span />
            <Field label="Part Cost" k="part_cost" type="number" />
            <Field label="Rework Cost" k="rework_cost" type="number" />
            <Field label="Labour Cost" k="labour_cost" type="number" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Row</button>
        </div>
      </div>
    </div>
  );
}

// ── Priority Badge ──────────────────────────────────────────
function PriorityBadge({ v }) {
  const map = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#22c55e' };
  const color = map[v] || 'var(--accent)';
  if (!v) return <span className="text-muted">—</span>;
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: color + '22', color }}>{v}</span>;
}

// ── Main Component ──────────────────────────────────────────
export default function IssueWorkMatrix() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);   // null | {} | row object
  const [deleting, setDeleting] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async (s = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/issue-matrix/?search=${encodeURIComponent(s)}&limit=200`);
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load matrix'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = e => {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(v), 600);
  };

  const handleSave = async (form) => {
    try {
      const payload = { ...form, qty: form.qty ? parseFloat(form.qty) : null, labour_time_minutes: form.labour_time_minutes ? parseFloat(form.labour_time_minutes) : null, part_cost: form.part_cost ? parseFloat(form.part_cost) : null, rework_cost: form.rework_cost ? parseFloat(form.rework_cost) : null, labour_cost: form.labour_cost ? parseFloat(form.labour_cost) : null };
      if (form.id) { await api.put(`/issue-matrix/${form.id}`, payload); }
      else { await api.post('/issue-matrix/', payload); }
      toast.success('Saved'); setModal(null); load(search);
    } catch { toast.error('Save failed'); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/issue-matrix/${id}`); toast.success('Deleted'); setDeleting(null); load(search); }
    catch { toast.error('Delete failed'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const loadingToast = toast.loading('Importing data...');
    try {
      const res = await api.post('/issue-matrix/import', formData);
      toast.success(`Imported ${res.data.imported} rows`, { id: loadingToast });
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed', { id: loadingToast });
    }
    e.target.value = ''; // Reset input
  };

  const handleExport = () => {
    window.open(`${window.location.protocol}//${window.location.hostname}:8000/api/issue-matrix/export`, '_blank');
  };

  const cell = (v) => v === null || v === undefined || v === '' ? <span style={{ color: 'var(--text3)' }}>—</span> : String(v);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={14} />
          <input placeholder="Search system, issue, code..." value={search} onChange={handleSearch} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => load(search)}><RefreshCw size={13} /></button>
        
        <input type="file" id="matrix-import" hidden accept=".xlsx,.xls" onChange={handleImport} />
        <label htmlFor="matrix-import" className="btn btn-ghost" style={{ cursor: 'pointer', gap: 8 }}>
          <Upload size={14} /> Import
        </label>

        <button className="btn btn-ghost" onClick={handleExport} style={{ gap: 8 }}>
          <Download size={14} /> Export
        </button>

        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={14} /> Add Row
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{total} records</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 2000 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text2)', width: 70 }}>#</th>
              {COLS.map(c => (
                <th key={c.key} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                  {c.label}
                </th>
              ))}
              <th style={{ padding: '10px 12px', width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLS.length + 2} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 2} style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ color: 'var(--text3)', fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    No records yet. Click <b>Add Row</b> to get started.
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '8px 12px', color: 'var(--text3)', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.system || '—'}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200 }}>{row.issue || '—'}</td>
                  <td style={{ padding: '8px 12px' }}><code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{row.issue_code || '—'}</code></td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.subsystem)}</td>
                  <td style={{ padding: '8px 12px' }}><PriorityBadge v={row.priority} /></td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.safety_risk)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.operable_vehicle)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.diagnostic_method)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.action_type)}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell(row.corrective_action)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.part_id)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.qty)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.sop)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.labour_time_minutes)}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.serviceable_location)}</td>
                  <td style={{ padding: '8px 12px' }}>{row.warranty ? <span style={{ color: row.warranty === 'Yes' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{row.warranty}</span> : '—'}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 150 }}>{cell(row.warranty_policy)}</td>
                  <td style={{ padding: '8px 12px' }}>{row.loaner_vehicle_required ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>Yes</span> : <span style={{ color: 'var(--text3)' }}>No</span>}</td>
                  <td style={{ padding: '8px 12px' }}>{row.part_cost != null ? `₹${Number(row.part_cost).toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{row.rework_cost != null ? `₹${Number(row.rework_cost).toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{row.labour_cost != null ? `₹${Number(row.labour_cost).toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{cell(row.root_cause_category)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px' }} onClick={() => setModal(row)}><Pencil size={12} /></button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '3px 6px' }} onClick={() => setDeleting(row.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {modal !== null && <MatrixModal initial={modal} onSave={handleSave} onClose={() => setModal(null)} />}

      {/* Delete Confirm */}
      {deleting && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 360 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ marginBottom: 20 }}>Delete this row permanently?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleting)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
