import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Badge, Loader } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, RotateCw, Settings, Layers, FileText, ChevronRight } from 'lucide-react';
import DocumentManagement from './DocumentManagement';

const MODULES = ['crm', 'installation', 'service', 'warranty', 'konwertcare'];
const FIELD_TYPES = ['text', 'number', 'date', 'textarea', 'selection', 'multiple-selection', 'boolean', 'checkbox', 'file', 'form'];

const emptyTab = { name: '', sort_order: 0 };
const emptyField = { field_name: '', field_label: '', field_type: 'text', placeholder: '', options: [], required: false, width: 'full', visibility_rule: null, sort_order: 0 };
const emptyStage = { module: 'crm', name: '', color: '#6366f1', sort_order: 0, is_final_win: false, is_final_lost: false };
const emptySeq = { module: 'crm', prefix: '', suffix: '', padding: 4 };

// ── Modals ───────────────────────────────────────────────────

function StageModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={form.id ? 'Edit Stage' : 'New Stage'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(form)}>Save</button></>}>
      <div className="form-grid form-grid-2">
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
          <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginTop: 24 }}>
            <input type="checkbox" checked={form.is_final_win} onChange={e => set('is_final_win', e.target.checked)} />
            <span className="form-label" style={{ marginBottom: 0 }}>Final Win Stage</span>
          </label>
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginTop: 24 }}>
            <input type="checkbox" checked={form.is_final_lost} onChange={e => set('is_final_lost', e.target.checked)} />
            <span className="form-label" style={{ marginBottom: 0 }}>Final Lost Stage</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function Studio() {
  const [tab, setTab] = useState('layout');
  const [module, setModule] = useState('crm');
  const [tabs, setTabs] = useState([]);
  const [stages, setStages] = useState([]);
  const [stageRules, setStageRules] = useState([]);
  const [sequence, setSequence] = useState(null);
  const [documentTemplates, setDocumentTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [tabModal, setTabModal] = useState(null);
  const [fieldModal, setFieldModal] = useState(null);
  const [stageModal, setStageModal] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tabsRes, stagesRes, rulesRes, seqRes, docsRes] = await Promise.all([
        api.get(`/studio/layout/${module}/tabs`),
        api.get(`/studio/stages/${module}`),
        api.get(`/studio/layout/${module}/stage-rules`),
        api.get(`/studio/sequence/${module}`),
        api.get(`/forms/studio/forms/${module}`)
      ]);
      setTabs(tabsRes.data);
      setStages(stagesRes.data);
      setStageRules(rulesRes.data);
      setSequence(seqRes.data);
      setDocumentTemplates(docsRes.data);
      if (activeTabIdx >= tabsRes.data.length && tabsRes.data.length > 0) setActiveTabIdx(0);
    } catch (e) {
      toast.error('Failed to sync Studio');
    } finally {
      setLoading(false);
    }
  }, [module, activeTabIdx]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveTab = async (form) => {
    try {
      const payload = { ...form, module };
      if (form.id) await api.put(`/studio/layout/${module}/tabs/${form.id}`, payload);
      else await api.post(`/studio/layout/${module}/tabs`, payload);
      toast.success('Tab updated'); setTabModal(null); loadData();
    } catch { toast.error('Check server logs'); }
  };

  const saveField = async (f) => {
    const sr = f._stageRule; const sro = f._stageRuleOp; const srv = f._stageRuleVal;
    const payload = { ...f, module }; delete payload._stageRule; delete payload._stageRuleOp; delete payload._stageRuleVal;
    try {
      let savedF;
      if (f.id) savedF = (await api.put(`/studio/layout/${module}/fields/${f.id}`, payload)).data;
      else savedF = (await api.post(`/studio/layout/${module}/fields`, payload)).data;

      if (sr) {
        try {
          await api.post(`/studio/layout/${module}/stage-rules`, {
            field_name: savedF.field_name, stage_id: parseInt(sr),
            condition_operator: sro, condition_value: sro === 'equals' ? srv : null
          });
        } catch (ruleErr) {
          console.error("Rule save failed", ruleErr);
          toast.error("Field saved, but automation rule failed");
        }
      } else {
        const existing = stageRules.find(r => r.field_name === savedF.field_name);
        if (existing && module) await api.delete(`/studio/layout/${module}/stage-rules/${existing.id}`);
      }
      toast.success('Field saved'); 
      setFieldModal(null); 
      loadData();
    } catch (e) { 
      const msg = e.response?.data?.detail || 'Error saving field';
      toast.error(msg); 
      console.error(e);
    }
  };

  const saveStage = async (form) => {
    try {
      if (form.id) await api.put(`/studio/stages/${form.id}`, form);
      else await api.post('/studio/stages', { ...form, module });
      toast.success('Stage updated'); setStageModal(null); loadData();
    } catch { toast.error('Error'); }
  };

  const saveSequence = async () => {
    try {
      await api.post(`/studio/sequence/${module}`, sequence);
      toast.success('Sequence saved');
    } catch { toast.error('Error'); }
  };

  const confirmDelete = async () => {
    const { type, id } = deleting;
    try {
      if (type === 'tab') await api.delete(`/studio/layout/${module}/tabs/${id}`);
      else if (type === 'field') await api.delete(`/studio/layout/${module}/fields/${id}`);
      else if (type === 'stage') await api.delete(`/studio/stages/${id}`);
      else if (type === 'document') await api.delete(`/forms/studio/forms/${id}`);
      toast.success('Deleted'); setDeleting(null); loadData();
    } catch { toast.error('Cannot delete: record in use'); setDeleting(null); }
  };

  const currentTab = tabs[activeTabIdx];

  return (
    <Layout title="Studio — Layout & Workflow">
      <div className="flex gap-2 mb-6 items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', padding: 4, borderRadius: 10 }}>
          {MODULES.map(m => (
            <button key={m} className={`btn btn-sm ${module === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModule(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {['layout', 'stages', 'sequences', 'documents'].map(t => (
            <button key={t} className={`btn btn-ghost btn-sm ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}
              style={tab === t ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' } : {}}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={loadData}><RotateCw size={14} /></button>
        </div>
      </div>

      {loading ? <div className="card p-12 text-center"><Loader /></div> : (
        <>
          {tab === 'layout' && (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
              {/* Tabs sidebar */}
              <div>
                <div className="detail-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Tabs <button className="btn btn-ghost btn-sm" onClick={() => setTabModal({})}><Plus size={12} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(tabs || []).map((t, i) => (
                    <div key={t.id} className={`nav-item ${activeTabIdx === i ? 'active' : ''}`}
                      style={{
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: activeTabIdx === i ? 'var(--accent-dim)' : 'transparent',
                        color: activeTabIdx === i ? 'var(--accent)' : 'var(--text2)'
                      }} onClick={() => setActiveTabIdx(i)}>
                      <span className="flex items-center gap-2"><Layers size={14} /> {t.name}</span>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={e => { e.stopPropagation(); setTabModal(t); }}><Pencil size={11} /></button>
                        <button className="btn btn-danger btn-sm" style={{ padding: 2 }} onClick={e => { e.stopPropagation(); setDeleting({ type: 'tab', id: t.id, name: t.name }); }}><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                  {tabs.length === 0 && <p className="text-muted text-sm italic">No tabs added</p>}
                </div>
              </div>

              {/* Fields area */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">{currentTab ? `Fields in "${currentTab.name}"` : 'Select a tab'}</span>
                  {currentTab && <button className="btn btn-primary btn-sm" onClick={() => setFieldModal({ tab_id: currentTab.id })}><Plus size={14} /> Add Field</button>}
                </div>
                {!currentTab ? <div className="p-8 text-center text-muted">Create or select a tab to manage fields.</div> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Width</th><th>Rule</th><th></th></tr></thead>
                      <tbody>
                        {currentTab.fields.map(f => (
                          <tr key={f.id}>
                            <td className="fw-600">{f.field_label} {f.required && <span style={{ color: 'var(--red)' }}>*</span>}</td>
                            <td><code>{f.field_name}</code></td>
                            <td><Badge color="var(--accent-dim)" style={{ color: 'var(--accent)' }}>{f.field_type}</Badge></td>
                            <td><span style={{ fontSize: 11 }}>{f.width}</span></td>
                            <td>{f.visibility_rule ? <Badge color="var(--amber-dim)" style={{ color: 'var(--amber)' }}>Visible If</Badge> : '—'}</td>
                            <td>
                              <div className="flex gap-2">
                                <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal(f)}><Pencil size={12} /></button>
                                <button className="btn btn-danger btn-sm" onClick={() => setDeleting({ type: 'field', id: f.id, name: f.field_label })}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {currentTab.fields.length === 0 && <tr><td colSpan="6" className="text-center p-8 text-muted">No fields in this tab.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'stages' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Workflow Stages — {module.toUpperCase()}</span>
                <button className="btn btn-primary btn-sm" onClick={() => setStageModal({ module })}><Plus size={14} /> Add Stage</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Order</th><th>Stage Name</th><th>Color</th><th>Final Stage</th><th></th></tr></thead>
                  <tbody>
                    {stages.map(s => (
                      <tr key={s.id}>
                        <td>{s.sort_order}</td>
                        <td><Badge color={s.color}>{s.name}</Badge></td>
                        <td><code>{s.color}</code></td>
                        <td>
                          {s.is_final_win && <Badge color="var(--green)">Won</Badge>}
                          {s.is_final_lost && <Badge color="var(--red)">Lost</Badge>}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => setStageModal(s)}><Pencil size={12} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleting({ type: 'stage', id: s.id, name: s.name })}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'sequences' && (
            <div className="card" style={{ maxWidth: 500 }}>
              <div className="card-header">
                <span className="card-title">Numbering Sequence — {module.toUpperCase()}</span>
              </div>
              <div className="form-grid p-4">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Prefix</label>
                    <input className="form-input" value={sequence?.prefix || ''} onChange={e => setSequence({ ...sequence, prefix: e.target.value })} placeholder="e.g. KIM-" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Suffix</label>
                    <input className="form-input" value={sequence?.suffix || ''} onChange={e => setSequence({ ...sequence, suffix: e.target.value })} placeholder="e.g. -2026" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Leading Zeros</label>
                    <input className="form-input" type="number" value={sequence?.padding || 4} onChange={e => setSequence({ ...sequence, padding: parseInt(e.target.value) || 4 })} />
                  </div>
                </div>
                <div className="mt-4">
                  <button className="btn btn-primary" onClick={saveSequence}>Save Sequence</button>
                  <p className="text-muted text-sm mt-4">
                    Preview: <span className="ref-text">{sequence?.prefix || ''}{'1'.padStart(sequence?.padding || 4, '0')}{sequence?.suffix || ''}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <DocumentManagement
              module={module}
              templates={documentTemplates}
              onDataChange={loadData}
              onDelete={(id, name) => setDeleting({ type: 'document', id, name })}
              parentFields={tabs.flatMap(t => t.fields)}
            />
          )}
        </>
      )}

      {tabModal && <TabModal initial={tabModal} stages={stages} onSave={saveTab} onClose={() => setTabModal(null)} />}
      {fieldModal && <FieldModal initial={fieldModal} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={() => setFieldModal(null)} />}
      {stageModal && <StageModal initial={stageModal} onSave={saveStage} onClose={() => setStageModal(null)} />}
      {deleting && <Confirm message={`Delete ${deleting.name}?`} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </Layout>
  );
}
