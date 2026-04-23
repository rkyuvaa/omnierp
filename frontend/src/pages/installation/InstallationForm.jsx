import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Modal, Badge } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Pencil, Trash2, Settings, Save, Check, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react';
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

  const [nav, setNav] = useState({ prev: null, next: null });

  useEffect(() => {
    if (id && id !== 'new') {
      setLoading(true);
      setForm(null); // Reset form to prevent old highlights
      api.get(`/installation/${id}`).then(r => {
        setForm({ ...emptyForm, ...r.data });
        setActivities(r.data.activities || []);
        setLoading(false);
      }).catch(() => { setLoading(false); toast.error('Not found'); navigate('/installation'); });
      
      api.get(`/installation/${id}/navigation`).then(r => setNav(r.data)).catch(() => {});
    } else {
      setForm(emptyForm);
      setLoading(false);
    }
  }, [id]);

  // Auto-select tab based on stage
  useEffect(() => {
    if (form?.stage_id && tabs.length > 0 && activeTab === 0) {
      const targetIdx = tabs.findIndex(t => t.default_on_stage === form.stage_id);
      if (targetIdx !== -1) setActiveTab(targetIdx);
    }
  }, [form?.stage_id, tabs, activeTab]);

  useEffect(() => {
    if (form?.product_id) {
      api.get(`/warranty/products/${form.product_id}`).then(r => {
        const p = r.data;
        setSelectedProduct(p);
        setForm(f => ({
          ...f,
          customer_name: p.customer_name || p.custom_data?.customer_name || f.customer_name || '',
          vehicle_number: p.name || p.serial_number || f.vehicle_number || '',
          vehicle_make: p.vehicle_make || p.custom_data?.vehicle_make || f.vehicle_make || '',
          vehicle_model: p.vehicle_model || p.custom_data?.vehicle_model || f.vehicle_model || ''
        }));
      }).catch(() => setSelectedProduct(null));
    } else {
      setSelectedProduct(null);
    }
  }, [form?.product_id]);


  useEffect(() => {
    if (!form) return;
    const search = selectedProduct?.name || form.vehicle_number || form.customer_name;
    if (!search) { setRelatedLead(null); return; }

    const timer = setTimeout(() => {
      api.get(`/crm/leads?search=${encodeURIComponent(search)}`).then(r => {
        if (r.data.items && r.data.items.length > 0) setRelatedLead(r.data.items[0]);
        else setRelatedLead(null);
      }).catch(() => setRelatedLead(null));
    }, 500);

    return () => clearTimeout(timer);
  }, [form?.vehicle_number, form?.customer_name, selectedProduct?.name]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => {
    setForm(f => {
      const newCustom = { ...f.custom_data, [k]: v };
      const rule = stageRules.find(r => r.field_name === k);
      if (rule) {
        let isMatch = false;
        if (rule.condition_operator === 'equals') {
          const checkVal = Array.isArray(v) ? (v[0] || '') : (typeof v === 'object' && v !== null ? (v.elapsed || (v.startAt ? 'running' : '')) : v);
          isMatch = String(checkVal ?? '') === String(rule.condition_value ?? '');
        } else {
          isMatch = v !== undefined && v !== '' && v !== false && v !== null && !(Array.isArray(v) && v.length === 0);
        }
        if (isMatch) {
          const targetStage = stages.find(s => s.id === parseInt(rule.stage_id));
          const currentStage = stages.find(s => s.id === f.stage_id);
          // Only trigger rule if it moves the stage forward or if no stage is set
          if (!currentStage || (targetStage && targetStage.sort_order > currentStage.sort_order)) {
            console.log(`[StageRule] Field "${k}" matched! Fast-Forwarding to Stage: ${targetStage?.name}`);
            return { ...f, custom_data: newCustom, stage_id: parseInt(rule.stage_id) };
          }
        }
      }
      return { ...f, custom_data: newCustom };
    });
  };


  const save = async () => {
    if (!form.product_id) return toast.error('Please select a Vehicle Number');
    setSaving(true);
    try {
      let finalStageId = form.stage_id;
      if (form.schedule_date && (!finalStageId || stages.find(s => s.id === finalStageId)?.sort_order === 0)) {
        const sch = stages.find(s => s.name.toLowerCase() === 'scheduled');
        if (sch) finalStageId = sch.id;
      }
      const payload = { ...form, stage_id: finalStageId || null, technician_id: form.technician_id || null, product_id: parseInt(form.product_id) || null };
      if (isNew) {
        const r = await api.post('/installation/', payload);
        toast.success('✓ Success');
        navigate(`/installation/${r.data.id}`);
      } else {
        const r = await api.put(`/installation/${id}`, payload);
        toast.success('✓ Saved');
        setForm(f => ({ ...f, ...r.data }));
        setRecentlySaved(true);
        setTimeout(() => setRecentlySaved(false), 3000);
      }
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Failed to save'); 
    }
    finally { setSaving(false); }
  };

  const updateStage = async (stageId) => {
    if (!isAdmin || saving) return;
    setSaving(true);
    try {
      const r = await api.put(`/installation/${id}`, { ...form, stage_id: stageId });
      setForm(f => ({ ...f, ...r.data }));
      toast.success('Stage updated');
    } catch (e) {
      toast.error('Failed to update stage');
    } finally {
      setSaving(false);
    }
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
    
    // Save main field
    if (f.id) await api.put(`/studio/layout/installation/fields/${f.id}`, payload);
    else await api.post('/studio/layout/installation/fields', { ...payload, tab_id: fieldModal?.tabId });

    // Save stage rule if exists
    if (f._stageRule) {
      try {
        await api.post('/studio/layout/installation/stage-rules', {
          field_name: f.field_name,
          stage_id: parseInt(f._stageRule),
          condition_operator: f._stageRuleOp || 'has_value',
          condition_value: f._stageRuleVal || ''
        });
      } catch (err) {
        console.error("Failed to save stage rule", err);
      }
    } else if (f.id) {
      const existing = stageRules.find(r => r.field_name === f.field_name);
      if (existing) {
        try {
          await api.delete(`/studio/layout/installation/stage-rules/${existing.id}`);
        } catch (err) {
          console.error("Failed to delete stage rule", err);
        }
      }
    }

    toast.success('Field saved'); setFieldModal(null); loadTabs(); loadStageRules();
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
    const vdTab = crmTabs.find(t => t.name === 'Vehicle Documents');
    if (vdTab) {
      allTabs.push({ ...vdTab, isRelated: true, name: 'Vehicle Documents' });
    }
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
    <Layout title={isNew ? 'New Entry' : `Installation — ${form.reference || `#${id}`}`}>
      <div className="toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/installation')}><ArrowLeft size={16} /> Back</button>
          <div style={{ height: 20, width: 1, background: 'var(--border)' }}></div>
          <button className="btn btn-primary" onClick={save} disabled={saving || recentlySaved} style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 700 }}>
            {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : recentlySaved ? <><Check size={16}/> Saved</> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button className="btn btn-ghost" onClick={()=>setEditLayout(e=>!e)}
              style={editLayout?{background:'var(--accent-dim)',color:'var(--accent)',border:'1px solid var(--accent)', padding: '8px 16px', borderRadius: 8}:{ padding: '8px 16px', borderRadius: 8 }}>
              <Settings size={16} style={{ marginRight: 6 }}/> {editLayout?'Exit Layout':'Edit Layout'}
            </button>
          )}
          
           {!isNew && (
            <div style={{ display: 'flex', gap: 4, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
              <button 
                className="btn btn-ghost" 
                style={{ padding: '8px', borderRadius: 8, opacity: nav.prev ? 1 : 0.3 }} 
                onClick={() => { if (nav.prev) { setLoading(true); navigate(`/installation/${nav.prev}`); } }}
                disabled={!nav.prev}
                title="Previous Record"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ padding: '8px', borderRadius: 8, opacity: nav.next ? 1 : 0.3 }} 
                onClick={() => { if (nav.next) { setLoading(true); navigate(`/installation/${nav.next}`); } }}
                disabled={!nav.next}
                title="Next Record"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stage bar */}
      {!isNew && stages.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, width: '100%', marginTop: -4 }}>
          {stages.map(s => {
            const isCurrent = form && String(form.stage_id) === String(s.id);
            return (
              <div key={s.id} onClick={() => isAdmin && updateStage(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 6px', borderRadius: 18, cursor: isAdmin ? "pointer" : "default", 
                  flex: 1, height: 35, transition: 'all 0.2s',
                  border: `1.5px solid ${isCurrent ? s.color : (s.color + '40')}`,
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
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
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
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Schedule Date</label>
                <input type="date" className="form-input fw-600" value={form.schedule_date || ''} onChange={e => set('schedule_date', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 4' }}>
                <label className="form-label">Customer Name *</label>
                <input 
                  className="form-input fw-700" 
                  placeholder="Enter Customer Name" 
                  value={form.customer_name || ''} 
                  onChange={e => set('customer_name', e.target.value)} 
                />
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
              <div className="card" style={{ borderTopLeftRadius:0, borderTopRightRadius:0, borderTop:'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
                  <Badge color="var(--accent-dim)" style={{ color:'var(--accent)' }}>MIRRORED FROM CRM: {relatedLead.reference}</Badge>
                  <span className="size-12 fw-700">{relatedLead.title}</span>
                </div>
                
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:20 }}>
                  {(currentTab.fields || []).map(f => {
                    const val = relatedLead.custom_data?.[f.field_name];
                    const labelStyle = { fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:6, display:'block', textTransform:'uppercase' };
                    
                    if (!val) return (
                      <div key={f.id} style={{ gridColumn:colSpan[f.width]||'span 1' }}>
                        <label style={labelStyle}>{f.field_label}</label>
                        <div style={{ color:'var(--text3)', fontSize:13 }}>—</div>
                      </div>
                    );

                    if (f.field_type === 'file' && typeof val === 'object') {
                      let fileUrl = val.url;
                      if (fileUrl) {
                        try {
                          const { BASE_URL } = require('../../utils/api');
                          const baseUrl = BASE_URL.replace(/\/api$/, '');
                          fileUrl = fileUrl.startsWith('http') ? fileUrl : `${baseUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
                        } catch (e) {
                          fileUrl = fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
                        }
                      }
                      
                      return (
                        <div key={f.id} style={{ gridColumn:colSpan[f.width]||'span 1' }}>
                          <label style={labelStyle}>{f.field_label}</label>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:38, background:'var(--bg2)', borderRadius:6, border:'1px solid var(--border)' }}>
                            {fileUrl ? (
                              <div style={{ display:'flex', gap:10 }}>
                                <button className="btn btn-ghost btn-sm" style={{ padding:4 }} onClick={() => window.open(fileUrl, '_blank')} title="View Document"><Eye size={16}/></button>
                                <a href={fileUrl} download={val.original_name} className="btn btn-ghost btn-sm" style={{ padding:4 }} title="Download"><Download size={16}/></a>
                              </div>
                            ) : '—'}
                          </div>
                        </div>
                      );
                    }


                    return (
                      <div key={f.id} style={{ gridColumn:colSpan[f.width]||'span 1' }}>
                        <label style={labelStyle}>{f.field_label}</label>
                        <div style={{ fontSize:14, color:'var(--text1)', fontWeight:500 }}>{String(val)}</div>
                      </div>
                    );
                  })}
                </div>
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
