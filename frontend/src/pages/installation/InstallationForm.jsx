import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Modal, Badge } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Settings, Pencil, Trash2, Bell, Check, Eye, Download } from 'lucide-react';
import SubFormSection from "../crm/SubFormSection";

const emptyForm = { product_id: '', technician_id: '', notes: '', custom_data: {} };
const colSpan = { full:'1/-1', half:'span 2', quarter:'span 1' };

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function InstallationForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_superadmin;

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [usedProductIds, setUsedProductIds] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actDesc, setActDesc] = useState('');
  const [actDue, setActDue] = useState('');
  const [editLayout, setEditLayout] = useState(false);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [tabModal, setTabModal] = useState(null);
  const [fieldModal, setFieldModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [stageRules, setStageRules] = useState([]);
  const [relatedLead, setRelatedLead] = useState(null);
  const [crmTabs, setCrmTabs] = useState([]);

  const loadTabs = useCallback(() => api.get('/studio/layout/installation/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/installation/stage-rules').then(r => setStageRules(r.data)), []);

  useEffect(() => {
    api.get('/studio/stages/installation').then(r => setStages(r.data)).catch(() => {});
    api.get('/users/').then(r => setUsers(r.data)).catch(() => {});
    api.get('/warranty/products').then(r => setVehicles(Array.isArray(r.data) ? r.data : (r.data.items || []))).catch(() => {});
    api.get('/installation/').then(r => setUsedProductIds((r.data.items || []).map(i => i.product_id).filter(Boolean))).catch(() => {});
    loadTabs();
    loadStageRules();
    api.get('/studio/layout/crm/tabs').then(r => setCrmTabs(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) { setForm({ ...emptyForm }); setLoading(false); }
    else {
      api.get(`/installation/${id}`).then(r => {
        setForm({ ...emptyForm, ...r.data });
        setActivities(r.data.activities || []);
        setLoading(false);
      }).catch(() => { toast.error('Not found'); navigate('/installation'); });
    }
  }, [id, isNew]);

  useEffect(() => {
    if (form?.product_id) {
      api.get(`/warranty/products/${form.product_id}`).then(r => setSelectedProduct(r.data)).catch(() => setSelectedProduct(null));
    } else {
      setSelectedProduct(null);
    }
  }, [form?.product_id]);

  useEffect(() => {
    if (form && (form.vehicle_number || selectedProduct?.name || form.customer_name)) {
      const search = selectedProduct?.name || form.vehicle_number || form.customer_name;
      api.get(`/crm/leads?search=${encodeURIComponent(search)}`).then(r => {
        if (r.data.items && r.data.items.length > 0) {
          setRelatedLead(r.data.items[0]);
        } else {
          setRelatedLead(null);
        }
      }).catch(() => setRelatedLead(null));
    }
  }, [form?.vehicle_number, form?.customer_name, selectedProduct?.name]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setForm(f => ({ ...f, custom_data: { ...f.custom_data, [k]: v } }));

  const save = async () => {
    if (!form.product_id) return toast.error('Please select a Vehicle Number');
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, technician_id: form.technician_id || null, product_id: parseInt(form.product_id) || null };
      if (isNew) {
        const r = await api.post('/installation/', payload);
        toast.success('✓ Success');
        navigate(`/installation/${r.data.id}`);
      } else {
        await api.put(`/installation/${id}`, payload);
        toast.success('✓ Saved');
        setRecentlySaved(true);
        setTimeout(() => setRecentlySaved(false), 3000);
      }
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Failed to save'); 
    }
    finally { setSaving(false); }
  };

  const updateStage = async (stageId) => {
    if (!isAdmin) return;
    await api.put(`/installation/${id}`, { ...form, stage_id: stageId });
    set('stage_id', stageId);
    toast.success('Stage updated');
  };

  const addActivity = async () => {
    if (!actDesc.trim()) { toast.error('Enter a description'); return; }
    try {
      const r = await api.post('/installation/activities', {
        installation_id: parseInt(id), description: actDesc, due_date: actDue || null
      });
      setActivities(a => [r.data, ...a]);
      setActDesc(''); setActDue('');
      toast.success('Activity added');
    } catch { toast.error('Failed to add activity'); }
  };

  const markDone = async (aid) => {
    await api.put(`/installation/activities/${aid}/done`);
    setActivities(a => a.map(x => x.id === aid ? { ...x, done: true } : x));
  };

  const saveTab = async (tab) => {
    if (tab.id) await api.put(`/studio/layout/installation/tabs/${tab.id}`, tab);
    else await api.post('/studio/layout/installation/tabs', { ...tab, sort_order: tabs.length });
    toast.success('Tab saved'); setTabModal(null); loadTabs();
  };

  const deleteTab = async (tid) => {
    await api.delete(`/studio/layout/installation/tabs/${tid}`);
    toast.success('Tab deleted'); setDeleteConfirm(null); setActiveTab(0); loadTabs();
  };

  const saveField = async (f) => {
    const payload = { ...f };
    delete payload._new;
    if (f.id) await api.put(`/studio/layout/installation/fields/${f.id}`, payload);
    else await api.post('/studio/layout/installation/fields', { ...payload, tab_id: fieldModal?.tabId });
    toast.success('Field saved'); setFieldModal(null); loadTabs();
  };

  const deleteField = async (fid) => {
    await api.delete(`/studio/layout/installation/fields/${fid}`);
    toast.success('Field deleted'); setDeleteConfirm(null); loadTabs();
  };

  const visibleTabs = (tabs || []).filter(t => 
    !t.visibility_stages || 
    (Array.isArray(t.visibility_stages) && t.visibility_stages.length === 0) || 
    (Array.isArray(t.visibility_stages) && t.visibility_stages.includes(form?.stage_id))
  );

  const allTabs = [...visibleTabs];
  if (relatedLead) {
    allTabs.push({ id: 'crm-related', name: 'Vehicle Documents', isRelated: true });
  }

  useEffect(() => {
    if (loading || !form) return;
    if (activeTab >= allTabs.length && allTabs.length > 0) {
      setActiveTab(0);
    }
  }, [allTabs.length, activeTab, loading, form]);

  if (loading || !form) return <Layout title="Installation"><Loader /></Layout>;
  const currentTab = allTabs[activeTab];

  return (
    <Layout title={isNew ? 'New Entry' : (form.reference || 'Installation')}>
      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/installation')}><ArrowLeft size={15} /> Back</button>
        <div className="toolbar-right" style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditLayout(e => !e)}
              style={editLayout ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' } : {}}>
              <Settings size={14} /> {editLayout ? 'Exit Layout' : 'Edit Layout'}
            </button>
          )}
          <button className="btn" 
            onClick={save} 
            disabled={saving || recentlySaved}
            style={{ 
              background: recentlySaved ? 'var(--green)' : 'var(--accent)',
              color: 'white',
              borderColor: recentlySaved ? 'var(--green)' : 'var(--accent)'
            }}
          >
            {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : recentlySaved ? <><Check size={14}/> Saved</> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      {/* Stage bar */}
      {!isNew && stages.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, width: '100%', marginTop: -4 }}>
          {stages.map(s => {
            const isCurrent = form.stage_id === s.id;
            return (
              <div key={s.id} onClick={() => isAdmin && updateStage(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 6px', borderRadius: 18, cursor: isAdmin ? "pointer" : "default", 
                  flex: 1, height: 35, transition: 'all 0.2s',
                  border: `1.5px solid ${isCurrent ? s.color : (s.color + '30')}`,
                  background: isCurrent ? s.color : 'transparent',
                  color: isCurrent ? '#ffffff' : s.color,
                  boxShadow: isCurrent ? `0 3px 8px ${s.color}40` : 'none',
                  minWidth: 0, opacity: isCurrent ? 1 : 0.7,
                  textAlign: 'center'
                }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2px', lineHeight: 1 }}>{s.name}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
        {/* LEFT */}
        <div>
          {/* Core fields */}
          <div className="card mb-4" style={{ height: 'fit-content' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 4' }}>
                <label className="form-label">Vehicle Number *</label>
                <select 
                  className="form-select fw-600" 
                  value={form.product_id || ''} 
                  onChange={e => set('product_id', parseInt(e.target.value) || '')}
                >
                  <option value="">— Select Vehicle —</option>
                  {vehicles.filter(v => v.id === form.product_id || !usedProductIds.includes(v.id)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Custom Tabs */}
          <div style={{ width: '100%' }}>
            {allTabs.length > 0 && (
              <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid var(--border)', marginBottom: 20 }}>
                {allTabs.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button onClick={() => setActiveTab(i)} style={{
                      padding:'8px 18px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                      background:'transparent', marginBottom:-2, transition:'all 0.15s',
                      borderBottom:activeTab===i?'2px solid var(--accent)':'2px solid transparent',
                      color:activeTab===i?'var(--accent)':'var(--text2)'
                    }}>{t.isRelated ? '🔗 ' : ''}{t.name}</button>
                    {!t.isRelated && editLayout && <>
                      <button className="btn btn-ghost btn-sm" style={{ padding:'2px 4px' }} onClick={() => setTabModal(t)}><Pencil size={11}/></button>
                      <button className="btn btn-danger btn-sm" style={{ padding:'2px 4px' }} onClick={() => setDeleteConfirm({type:'tab',id:t.id,name:t.name})}><Trash2 size={11}/></button>
                    </>}
                  </div>
                ))}
                {editLayout && <button className="btn btn-ghost btn-sm" onClick={() => setTabModal({})}><Plus size={13}/> Tab</button>}
              </div>
            )}

            {currentTab?.isRelated ? (
              <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
                  <Badge color="var(--accent-dim)" style={{ color:'var(--accent)' }}>CRM SOURCE: {relatedLead.reference}</Badge>
                  <span className="size-12 fw-700">{relatedLead.title}</span>
                </div>
                
                {crmTabs.filter(ct => ct.name === 'Vehicle Documents').map(ct => (
                  <div key={ct.id} style={{ marginBottom:30 }}>
                    <div className="size-11 fw-800 uppercase text-muted mb-4" style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:12, height:2, background:'var(--border)' }} />
                      {ct.name}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
                      {(ct.fields || []).map(f => (
                        <div key={f.id} style={{ gridColumn:colSpan[f.width]||'1/-1' }}>
                          <label className="form-label">{f.field_label}</label>
                          <div className="p-3 bg-gray-50 border rounded-lg size-13 color-text2 font-medium">
                            {(() => {
                              const val = relatedLead.custom_data?.[f.field_name];
                              if (!val) return '—';
                              if (f.field_type === 'file' && typeof val === 'object') {
                                const baseUrl = window.location.origin;
                                const fileUrl = val.url ? (val.url.startsWith('http') ? val.url : `${baseUrl}${val.url}`) : null;
                                return (
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>{val.original_name || val.filename}</span>
                                    {fileUrl && (
                                      <div style={{ display:'flex', gap:8 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => window.open(fileUrl, '_blank')} title="View Document"><Eye size={14}/></button>
                                        <a href={fileUrl} download={val.original_name} className="btn btn-ghost btn-sm" title="Download"><Download size={14}/></a>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              if (typeof val === 'object' && !Array.isArray(val)) {
                                return val.filename || val.original_name || JSON.stringify(val);
                              }
                              return String(val);
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : currentTab && (
              <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {(currentTab.fields || []).filter(f => isVisible(f, form.custom_data)).map(f => (
                    <div key={f.id} style={{ gridColumn:colSpan[f.width]||'1/-1', position: 'relative' }}>
                      {f.field_type !== 'boolean' && <label className="form-label">{f.field_label}{f.required && <span style={{color:'var(--red)'}}> *</span>}</label>}
                      {f.field_type === 'form' ? (
                        <SubFormSection 
                          module="installation" 
                          parentId={form.id} 
                          parentData={form} 
                          templateId={f.form_template_id} 
                          embedded={true} 
                        />
                      ) : (
                        <FieldInput field={f} value={form.custom_data[f.field_name]} onChange={v => setCustom(f.field_name, v)} />
                      )}
                      {editLayout && (
                        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setFieldModal({ field: f, tabId: currentTab.id })}><Pencil size={11} /></button>
                          <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={() => setDeleteConfirm({ type: 'field', id: f.id, name: f.field_label })}><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {editLayout && (
                    <div style={{ gridColumn: '1/-1', marginTop: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal({ field: { field_name: '', field_label: '', field_type: 'text', placeholder: '', options: [], required: false, width: 'full', sort_order: (currentTab.fields || []).length, tab_id: currentTab.id, module: 'installation' }, tabId: currentTab.id })}>
                        <Plus size={13} /> Add Field to "{currentTab.name}"
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: High-Density Summary Sidebar (Vertical Stack) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selectedProduct ? (
            <div className="card" style={{ padding: 0 }}>
              {/* Header */}
              <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 8 }}>
                  <div style={{ width:4, height:20, background:'var(--green)', borderRadius:2 }} />
                  <span className="fw-800 size-15 uppercase" style={{ color:'var(--green)', letterSpacing: '0.5px' }}>
                    {selectedProduct.bom_name || selectedProduct.title || selectedProduct.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div className="fw-700 size-12 uppercase text-muted">S/N: <span className="text-normal color-text1">{selectedProduct.serial_number || '—'}</span></div>
                  <div className="fw-700 size-12 uppercase text-muted">WTY: <span className="text-normal color-text1">{selectedProduct.warranty_period} {selectedProduct.warranty_unit?.toUpperCase()}</span></div>
                </div>
              </div>

              {/* Component Section */}
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:8, borderBottom:'1px dashed var(--border)', marginBottom:10 }}>
                  <span className="size-10 fw-800 text-muted uppercase">Item Name</span>
                  <div style={{ display:'flex', gap:30 }}>
                    <span className="size-10 fw-800 text-muted uppercase">Serial</span>
                    <span className="size-10 fw-800 text-muted uppercase">Wty</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedProduct.component_serials && selectedProduct.component_serials.length > 0 ? (
                    selectedProduct.component_serials.map((c, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="size-12 fw-700 color-text1 truncate" style={{ maxWidth: 160 }}>{c.bom_component?.name || 'Component'}</span>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                          <span className="size-12 fw-800 mono">{c.serial_number || '—'}</span>
                          <span className="size-11 text-muted fw-600">{c.warranty_period}{c.warranty_unit?.substring(0, 1)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="size-12 text-muted italic">No components found.</div>
                  )}
                </div>
              </div>

              {/* Other Details Section */}
              <div style={{ padding: 20 }}>
                <div className="size-11 fw-900 text-success uppercase mb-3" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 5 }}>Other Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 10px' }}>
                  {[
                    { l: 'PHONE NUMBER', k: 'phone_number' },
                    { l: 'VEHICLE YEAR', k: 'vehicle_year' },
                    { l: 'CUSTOMER NAME', k: 'customer_name' },
                    { l: 'INVOICE NUMBER', k: 'invoice_number' },
                    { l: 'INVOICE DETAILS', k: 'invoice_details' },
                    { l: 'CUSTOMER ADDRESS', k: 'customer_address' }
                  ].map((d, i) => (
                    <div key={i} style={{ gridColumn: (d.k === 'customer_address' || d.k === 'invoice_details') ? 'span 2' : 'span 1' }}>
                      <div className="size-9 text-muted fw-700 mb-1 uppercase letter-spacing-1">{d.l}</div>
                      <div className="size-12 fw-800 color-text1" style={{ wordBreak: 'break-word' }}>{selectedProduct.custom_data?.[d.k] || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center p-8 text-muted size-14">
              Select a vehicle to view installation details
            </div>
          )}
      </div>
    </div>

      {tabModal !== null && <TabModal initial={tabModal} stages={stages} onSave={saveTab} onClose={() => setTabModal(null)} />}
      {fieldModal !== null && <FieldModal initial={{...fieldModal.field, module: 'installation'}} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={() => setFieldModal(null)} />}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ marginBottom: 20 }}>Delete <b>{deleteConfirm.name}</b>?</p>
              <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => {
                  if (deleteConfirm.type === 'tab') deleteTab(deleteConfirm.id);
                  else deleteField(deleteConfirm.id);
                }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
