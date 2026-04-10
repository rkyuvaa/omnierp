import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Badge } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';

const MODULES = ['crm', 'installation', 'service'];
const FIELD_TYPES = ['text', 'number', 'date', 'selection', 'boolean'];
const emptyField = { module: 'crm', field_name: '', field_label: '', field_type: 'text', options: [], required: false, sort_order: 0 };
const emptyStage = { module: 'crm', name: '', color: '#6366f1', sort_order: 0, is_final_win: false, is_final_lost: false };
const emptySeq = { module: 'crm', prefix: '', suffix: '', padding: 4 };

function FieldModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [optInput, setOptInput] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addOpt = () => {
    if (!optInput.trim()) return;
    set('options', [...(form.options || []), optInput.trim()]);
    setOptInput('');
  };
  const removeOpt = o => set('options', form.options.filter(x => x !== o));

  return (
    <Modal title={form.id ? 'Edit Field' : 'New Custom Field'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(form)}>Save</button></>}>
      <div className="form-grid">
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Module</label>
            <select className="form-select" value={form.module} onChange={e => set('module', e.target.value)}>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Field Type</label>
            <select className="form-select" value={form.field_type} onChange={e => set('field_type', e.target.value)}>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Field Name (internal key)</label>
            <input className="form-input" value={form.field_name} onChange={e => set('field_name', e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="e.g. warranty_period" />
          </div>
          <div className="form-group">
            <label className="form-label">Field Label (display)</label>
            <input className="form-input" value={form.field_label} onChange={e => set('field_label', e.target.value)} placeholder="e.g. Warranty Period" />
          </div>
          <div className="form-group">
            <label className="form-label">Sort Order</label>
            <input className="form-input" type="number" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
          </div>
          <div className="form-group" style={{ justifyContent: 'center' }}>
            <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginTop: 24 }}>
              <input type="checkbox" checked={form.required} onChange={e => set('required', e.target.checked)} />
              <span className="form-label" style={{ marginBottom: 0 }}>Required</span>
            </label>
          </div>
        </div>
        {form.field_type === 'selection' && (
          <div className="form-group">
            <label className="form-label">Options</label>
            <div className="flex gap-2 mb-4">
              <input className="form-input" value={optInput} onChange={e => setOptInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOpt()} placeholder="Add option..." />
              <button className="btn btn-ghost" onClick={addOpt}><Plus size={14} /></button>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {(form.options || []).map(o => (
                <span key={o} className="badge" style={{ background: 'var(--bg3)', color: 'var(--text)', gap: 6 }}>
                  {o}
                  <button onClick={() => removeOpt(o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function StageModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={form.id ? 'Edit Stage' : 'New Stage'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(form)}>Save</button></>}>
      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label">Module</label>
          <select className="form-select" value={form.module} onChange={e => set('module', e.target.value)}>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Stage Name</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
            <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Sort Order</label>
          <input className="form-input" type="number" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_final_win} onChange={e => set('is_final_win', e.target.checked)} />
            <span className="form-label" style={{ marginBottom: 0 }}>Final Win Stage</span>
          </label>
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_final_lost} onChange={e => set('is_final_lost', e.target.checked)} />
            <span className="form-label" style={{ marginBottom: 0 }}>Final Lost Stage</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

export default function Studio() {
  const [tab, setTab] = useState('fields');
  const [fields, setFields] = useState([]);
  const [stages, setStages] = useState([]);
  const [seqForms, setSeqForms] = useState({ crm: { ...emptySeq, module: 'crm' }, installation: { ...emptySeq, module: 'installation' }, service: { ...emptySeq, module: 'service' } });
  const [fieldModal, setFieldModal] = useState(null);
  const [stageModal, setStageModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [moduleFilter, setModuleFilter] = useState('crm');

  const loadFields = () => Promise.all(MODULES.map(m => api.get(`/studio/fields/${m}`))).then(rs => setFields(rs.flatMap(r => r.data)));
  const loadStages = () => Promise.all(MODULES.map(m => api.get(`/studio/stages/${m}`))).then(rs => setStages(rs.flatMap(r => r.data)));
  const loadSeqs = () => MODULES.forEach(m => api.get(`/studio/sequence/${m}`).then(r => { if (r.data?.module) setSeqForms(s => ({ ...s, [m]: r.data })); }));

  useEffect(() => { loadFields(); loadStages(); loadSeqs(); }, []);

  const saveField = async (form) => {
    try {
      if (form.id) await api.put(`/studio/fields/${form.id}`, form);
      else await api.post('/studio/fields', form);
      toast.success('Field saved'); setFieldModal(null); loadFields();
    } catch { toast.error('Error'); }
  };

  const saveStage = async (form) => {
    try {
      if (form.id) await api.put(`/studio/stages/${form.id}`, form);
      else await api.post('/studio/stages', form);
      toast.success('Stage saved'); setStageModal(null); loadStages();
    } catch { toast.error('Error'); }
  };

  const confirmDelete = async () => {
    const { type, id } = deleting;
    if (type === 'field') await api.delete(`/studio/fields/${id}`);
    else await api.delete(`/studio/stages/${id}`);
    toast.success('Deleted'); setDeleting(null);
    if (type === 'field') loadFields(); else loadStages();
  };

  const saveSeq = async (module) => {
    try {
      await api.post('/studio/sequence', seqForms[module]);
      toast.success('Sequence saved');
    } catch { toast.error('Error'); }
  };

  const filteredFields = fields.filter(f => f.module === moduleFilter);
  const filteredStages = stages.filter(s => s.module === moduleFilter);

  return (
    <Layout title="Studio — Customization">
      <div className="tabs">
        {['fields', 'stages', 'sequences'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {/* Module filter */}
      <div className="flex gap-2 mb-4">
        {MODULES.map(m => (
          <button key={m} className="btn btn-ghost btn-sm" onClick={() => setModuleFilter(m)}
            style={moduleFilter === m ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'fields' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Custom Fields — {moduleFilter}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setFieldModal({ ...emptyField, module: moduleFilter })}><Plus size={14} /> Add Field</button>
          </div>
          {filteredFields.length === 0 ? (
            <p className="text-muted text-sm">No custom fields for {moduleFilter}. Add one to extend the module.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Label</th><th>Internal Name</th><th>Type</th><th>Required</th><th>Sort</th><th></th></tr></thead>
                <tbody>
                  {filteredFields.map(f => (
                    <tr key={f.id}>
                      <td className="fw-600">{f.field_label}</td>
                      <td><code style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--accent2)' }}>{f.field_name}</code></td>
                      <td><Badge color="var(--amber)">{f.field_type}</Badge></td>
                      <td>{f.required ? <Badge color="var(--green)">Yes</Badge> : <span className="text-muted">No</span>}</td>
                      <td className="text-muted">{f.sort_order}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal(f)}><Pencil size={13} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleting({ type: 'field', id: f.id })}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'stages' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Stages — {moduleFilter}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setStageModal({ ...emptyStage, module: moduleFilter })}><Plus size={14} /> Add Stage</button>
          </div>
          {filteredStages.length === 0 ? (
            <p className="text-muted text-sm">No stages for {moduleFilter}.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Stage Name</th><th>Color</th><th>Sort</th><th>Win</th><th>Lost</th><th></th></tr></thead>
                <tbody>
                  {filteredStages.map(s => (
                    <tr key={s.id}>
                      <td><Badge color={s.color}>{s.name}</Badge></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: s.color }} />
                          <code style={{ fontSize: 11, color: 'var(--text2)' }}>{s.color}</code>
                        </div>
                      </td>
                      <td className="text-muted">{s.sort_order}</td>
                      <td>{s.is_final_win ? <Badge color="var(--green)">Yes</Badge> : '—'}</td>
                      <td>{s.is_final_lost ? <Badge color="var(--red)">Yes</Badge> : '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => setStageModal(s)}><Pencil size={13} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleting({ type: 'stage', id: s.id })}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'sequences' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {MODULES.map(m => {
            const seq = seqForms[m];
            const setSeq = (k, v) => setSeqForms(s => ({ ...s, [m]: { ...s[m], [k]: v } }));
            return (
              <div key={m} className="card">
                <div className="card-header">
                  <span className="card-title">Sequence — {m.charAt(0).toUpperCase() + m.slice(1)}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => saveSeq(m)}>Save</button>
                </div>
                <div className="form-grid form-grid-2" style={{ maxWidth: 500 }}>
                  <div className="form-group">
                    <label className="form-label">Prefix</label>
                    <input className="form-input" value={seq.prefix || ''} onChange={e => setSeq('prefix', e.target.value)} placeholder="e.g. LEAD" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Suffix</label>
                    <input className="form-input" value={seq.suffix || ''} onChange={e => setSeq('suffix', e.target.value)} placeholder="Optional suffix" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Number Padding</label>
                    <input className="form-input" type="number" min="1" max="8" value={seq.padding || 4} onChange={e => setSeq('padding', parseInt(e.target.value) || 4)} />
                  </div>
                  <div className="form-group" style={{ justifyContent: 'flex-end', paddingBottom: 2 }}>
                    <div style={{ padding: '9px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent2)' }}>
                      Preview: {seq.prefix}/{new Date().getFullYear()}/{String(1).padStart(seq.padding || 4, '0')}{seq.suffix}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {fieldModal && <FieldModal initial={fieldModal} onSave={saveField} onClose={() => setFieldModal(null)} />}
      {stageModal && <StageModal initial={stageModal} onSave={saveStage} onClose={() => setStageModal(null)} />}
      {deleting && <Confirm message={`Delete this ${deleting.type}?`} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
