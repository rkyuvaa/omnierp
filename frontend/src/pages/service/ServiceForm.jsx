import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Modal, Badge } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useStages, useUsers } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Pencil, Trash2, Settings, Upload, Download, Eye, X, FileText, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import SubFormSection from '../crm/SubFormSection';

const empty = { customer_name:'', email:'', phone:'', vehicle_number:'', vehicle_make:'', vehicle_model:'', problem_description:'', notes:'', stage_id:'', staff_id:'', custom_data:{} };
const emptyField = { field_name:'', field_label:'', field_type:'text', placeholder:'', options:[], required:false, width:'full', visibility_rule:null, sort_order:0 };
const colSpan = { full:'1/-1', half:'span 2', quarter:'span 1' };

export default function ServiceForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_superadmin;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const stages = useStages('service');
  const users = useUsers();
  const [tabs, setTabs] = useState([]);
  const [stageRules, setStageRules] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [editLayout, setEditLayout] = useState(false);
  const [fieldModal, setFieldModal] = useState(null);
  const [tabModal, setTabModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const loadTabs = useCallback(() => api.get('/studio/layout/service/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/service/stage-rules').then(r => setStageRules(r.data)), []);
  const [nav, setNav] = useState({ prev: null, next: null });

  useEffect(() => {
    loadTabs();
    loadStageRules();
    if (!isNew) {
      setLoading(true); // Force reload on ID change
      api.get(`/service/${id}`).then(r => {
        setForm({ ...empty, ...r.data, custom_data: r.data.custom_data || {} });
        setLoading(false);
      }).catch(() => setLoading(false));

      api.get(`/service/${id}/navigation`).then(r => setNav(r.data)).catch(() => {});
    } else {
      setForm({ ...empty });
      setLoading(false);
    }
  }, [id, isNew, loadTabs, loadStageRules]);
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
        if (isMatch) return { ...f, custom_data: newCustom, stage_id: parseInt(rule.stage_id) };
      }
      return { ...f, custom_data: newCustom };
    });
  };
  const saveTab = async (tab) => {
    if (tab.id) await api.put(`/studio/layout/service/tabs/${tab.id}`, tab);
    else await api.post('/studio/layout/service/tabs', { ...tab, sort_order: tabs.length });
    toast.success('Tab saved'); setTabModal(null); loadTabs();
  };
  const deleteTab = async (tid) => {
    await api.delete(`/studio/layout/service/tabs/${tid}`);
    toast.success('Deleted'); setDeleteConfirm(null); loadTabs();
  };
  const saveField = async (f) => {
    const stageRule = f._stageRule;
    const stageRuleOp = f._stageRuleOp || 'has_value';
    const stageRuleVal = f._stageRuleVal || '';
    const payload = { ...f }; delete payload._stageRule; delete payload._stageRuleOp; delete payload._stageRuleVal;
    
    if (!payload.tab_id) payload.tab_id = fieldModal?.tabId||null;
    if (f.id) await api.put(`/studio/layout/service/fields/${f.id}`, payload);
    else await api.post('/studio/layout/service/fields', payload);
    
    if (stageRule) {
      try {
        await api.post('/studio/layout/service/stage-rules', { field_name: payload.field_name, stage_id: parseInt(stageRule), condition_operator: stageRuleOp, condition_value: stageRuleOp === 'equals' ? stageRuleVal : null });
      } catch(err) {
        console.error("Failed to save stage rule", err);
      }
    } else {
      const existing = stageRules.find(r => r.field_name === payload.field_name);
      if (existing) {
        try {
          await api.delete(`/studio/layout/service/stage-rules/${existing.id}`);
        } catch (err) {
          console.error("Failed to delete existing stage rule", err);
        }
      }
    }
    toast.success('Field saved'); setFieldModal(null); loadTabs(); loadStageRules();
  };
  const deleteField = async (fid) => {
    await api.delete(`/studio/layout/service/fields/${fid}`);
    toast.success('Deleted'); setDeleteConfirm(null); loadTabs(); loadStageRules();
  };
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, staff_id: form.staff_id || null };
      if (isNew) { const r = await api.post('/service/', payload); toast.success('✓ Created successfully!', { duration: 4000 }); navigate(`/service/${r.data.id}`); }
      else { const response = await api.put(`/service/${id}`, payload); console.log('Save response:', response.status); toast.success('✓ Saved successfully!', { duration: 4000 }); }
    } catch(e) { console.error('Save error:', e); toast.error(e.response?.data?.detail || 'Failed to save', { duration: 4000 }); }
    finally { setSaving(false); }
  };
  const visibleTabs = useMemo(() => (tabs || []).filter(t => {
    if (!t.visibility_stages || t.visibility_stages.length === 0) return true;
    const sId = Number(form?.stage_id);
    if (!sId) return false;
    return t.visibility_stages.map(Number).includes(sId);
  }), [tabs, form?.stage_id]);

  if (loading) return <Layout title="Service"><Loader /></Layout>;
  const currentTab = visibleTabs[activeTab];
  const colSpan = { full: '1/-1', half: 'span 2', quarter: 'span 1' };
  return (
    <Layout title={isNew ? 'New Service Request' : `Service Request — ${form.reference || `#${id}`}`}>
      <div className="toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/service')}><ArrowLeft size={16} /> Back</button>
          <div style={{ height: 20, width: 1, background: 'var(--border)' }}></div>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 700 }}>
            {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><Save size={16} /> Save Changes</>}
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
                onClick={() => { if (nav.prev) { setLoading(true); navigate(`/service/${nav.prev}`); } }}
                disabled={!nav.prev}
                title="Previous Record"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ padding: '8px', borderRadius: 8, opacity: nav.next ? 1 : 0.3 }} 
                onClick={() => { if (nav.next) { setLoading(true); navigate(`/service/${nav.next}`); } }}
                disabled={!nav.next}
                title="Next Record"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="detail-section-title">Record Details</div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 24px' }}>
              {!isNew && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 600 }}>Record Number</label>
                  <input className="form-input" value={form.reference || ''} readOnly style={{ background: 'var(--bg)', fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent-dim)' }} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input className="form-input" value={form.customer_name || ''} onChange={e => set('customer_name', e.target.value)} />
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Vehicle Number</label>
                  <input className="form-input" value={form.vehicle_number || ''} onChange={e => set('vehicle_number', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Make</label>
                  <input className="form-input" value={form.vehicle_make || ''} onChange={e => set('vehicle_make', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Model</label>
                  <input className="form-input" value={form.vehicle_model || ''} onChange={e => set('vehicle_model', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Problem Description</label>
                <textarea className="form-textarea" value={form.problem_description || ''} onChange={e => set('problem_description', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
               <div style={{ display:'flex', gap:8 }}>
                  {editLayout && <button className="btn btn-ghost btn-sm" onClick={() => setTabModal({})}><Plus size={13}/> Add Tab</button>}
               </div>
            </div>
          {visibleTabs.length > 0 && (
            <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid var(--border)', marginBottom: 20 }}>
              {visibleTabs.map((t,i) => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:2 }}>
                  <button onClick={() => setActiveTab(i)} style={{
                    padding:'8px 18px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                    background:'transparent', marginBottom:-2, transition:'all 0.15s',
                    borderBottom:activeTab===i?'2px solid var(--accent)':'2px solid transparent',
                    color:activeTab===i?'var(--accent)':'var(--text2)'
                  }}>{t.name}</button>
                  {editLayout && <>
                    <button className="btn btn-ghost btn-sm" style={{ padding:'2px 4px' }} onClick={() => setTabModal(t)}><Pencil size={11}/></button>
                    <button className="btn btn-danger btn-sm" style={{ padding:'2px 4px' }} onClick={() => setDeleteConfirm({type:'tab',id:t.id,name:t.name})}><Trash2 size={11}/></button>
                  </>}
                </div>
              ))}
            </div>
          )}
          </div>

          {currentTab && (
            <div className="card" style={{ borderTopLeftRadius:0, borderTopRightRadius:0, borderTop:'none' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {(currentTab.fields || []).filter(f => isVisible(f, form.custom_data)).map(f => (
                  <div key={f.id} style={{ gridColumn:colSpan[f.width]||'1/-1', position:'relative' }}>
                    {f.field_type === 'form' ? (
                      <SubFormSection 
                        module="service" 
                        parentId={form.id} 
                        parentData={form} 
                        templateId={f.form_template_id} 
                        embedded={true} 
                      />
                    ) : (
                      <FieldInput field={f} value={form.custom_data[f.field_name]} onChange={v => setCustom(f.field_name, v)}/>
                    )}
                    {editLayout && (
                      <div style={{ position:'absolute', top:0, right:0, display:'flex', gap:4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding:'2px 6px' }} onClick={() => setFieldModal({field:{...f},tabId:currentTab.id})}><Pencil size={11}/></button>
                        <button className="btn btn-danger btn-sm" style={{ padding:'2px 6px' }} onClick={() => setDeleteConfirm({type:'field',id:f.id,name:f.field_label})}><Trash2 size={11}/></button>
                      </div>
                    )}
                  </div>
                ))}
                {editLayout && (
                  <div style={{ gridColumn:'1/-1', marginTop:8 }}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setFieldModal({field:{...emptyField,tab_id:currentTab.id,sort_order:(currentTab.fields||[]).length},tabId:currentTab.id})}>
                      <Plus size={13}/> Add Field to "{currentTab.name}"
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tabs.length===0&&(
            <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color:'var(--text2)', fontSize:13 }}>
              {editLayout ? (
                <div>
                  <p style={{ marginBottom: 16 }}>No tabs configured. Add a tab to start organizing your custom fields.</p>
                  <button className="btn btn-primary" onClick={() => setTabModal({})}><Plus size={16}/> Create First Tab</button>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal({field:{...emptyField,tab_id:null},tabId:null})}><Plus size={13}/> Add Field (No Tab)</button>
                  </div>
                </div>
              ) : 'No additional fields configured.'}
            </div>
          )}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="detail-section-title">Assignment</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Stage</label>
              <select className="form-select" value={form.stage_id || ''} onChange={e => set('stage_id', parseInt(e.target.value) || null)}>
                <option value="">— Select —</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Staff</label>
              <select className="form-select" value={form.staff_id || ''} onChange={e => set('staff_id', parseInt(e.target.value) || null)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
      {tabModal !== null && <TabModal initial={tabModal} stages={stages} onSave={saveTab} onClose={() => setTabModal(null)} />}
      {fieldModal !== null && <FieldModal initial={fieldModal.field} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={() => setFieldModal(null)} />}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ marginBottom: 20 }}>Delete <b>{deleteConfirm.name}</b>?</p>
              <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => { if (deleteConfirm.type === 'tab') deleteTab(deleteConfirm.id); else deleteField(deleteConfirm.id); }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
