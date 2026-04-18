import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Badge, Modal } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { useAuth } from '../../hooks/useAuth';
import { useStages } from '../../hooks/useData';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Pencil, Trash2, Package, Settings, Upload, Download, Eye, X, FileText, Check } from 'lucide-react';

const UNITS = ['months','years'];
const WARRANTY_STATUS = {
  not_started: { label:'Not Started', color:'var(--text3)' },
  active:      { label:'Active',      color:'var(--green)' },
  expired:     { label:'Expired',     color:'var(--red)' },
};

export default function ProductDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_superadmin;
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [boms, setBoms] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [stageRules, setStageRules] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [editLayout, setEditLayout] = useState(false);
  const [fieldModal, setFieldModal] = useState(null);
  const [tabModal, setTabModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [recentlySaved, setRecentlySaved] = useState(false);

  const stages = useStages('warranty');

  const loadTabs = useCallback(() => api.get('/studio/layout/warranty/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/warranty/stage-rules').then(r => setStageRules(r.data)), []);

  useEffect(() => {
    api.get('/warranty/boms').then(r=>setBoms(r.data));
    loadTabs();
    loadStageRules();
    if (!isNew) {
      api.get(`/warranty/products/${id}`).then(r => {
        setForm({ ...emptyForm, ...r.data, custom_data: r.data.custom_data || {} });
        setLoading(false);
      });
    }
  }, [id, isNew, loadTabs, loadStageRules]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => {
    setForm(f => ({ ...f, custom_data: { ...f.custom_data, [k]: v } }));
    const rule = stageRules.find(r => r.field_name === k);
    if (rule) {
      let isMatch = false;
      if (rule.condition_operator === 'equals') isMatch = String(v) === String(rule.condition_value);
      else isMatch = v !== undefined && v !== '' && v !== false && v !== null && !(Array.isArray(v) && v.length === 0);
      if (isMatch) set('stage_id', parseInt(rule.stage_id));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, bom_id: form.bom_id || null };
      if (isNew) {
        const r = await api.post('/warranty/products', payload);
        toast.success('✓ Product created successfully!');
        navigate(`/warranty/products/${r.data.id}`);
      } else {
        await api.put(`/warranty/products/${id}`, payload);
        toast.success('✓ Saved successfully!');
        setRecentlySaved(true);
        setTimeout(() => setRecentlySaved(false), 3000);
      }
    } catch(e) {
      console.error('Save error:', e);
      toast.error(e.response?.data?.detail || 'Failed to save');
    }
    finally { setSaving(false); }
  };

  const saveTab = async (tab) => {
    if (tab.id) await api.put(`/studio/layout/tabs/${tab.id}`, tab);
    else await api.post('/studio/layout/warranty/tabs', { ...tab, sort_order: tabs.length });
    toast.success('Tab saved'); setTabModal(null); loadTabs();
  };

  const deleteTab = async (tid) => {
    await api.delete(`/studio/layout/tabs/${tid}`);
    toast.success('Deleted'); setDeleteConfirm(null); loadTabs();
  };

  const saveField = async (f) => {
    const stageRule = f._stageRule;
    const stageRuleOp = f._stageRuleOp || 'has_value';
    const stageRuleVal = f._stageRuleVal || '';
    const payload = { ...f }; delete payload._stageRule; delete payload._stageRuleOp; delete payload._stageRuleVal;
    
    if (!payload.tab_id) payload.tab_id = fieldModal?.tabId||null;
    if (f.id) await api.put(`/studio/layout/fields/${f.id}`, payload);
    else await api.post('/studio/layout/warranty/fields', payload);
    
    if (stageRule) {
      await api.post('/studio/layout/warranty/stage-rules', {
        field_name: payload.field_name,
        stage_id: parseInt(stageRule),
        condition_operator: stageRuleOp,
        condition_value: stageRuleOp === 'equals' ? stageRuleVal : null
      });
    } else {
      const existing = stageRules.find(r => r.field_name === payload.field_name);
      if (existing) await api.delete(`/studio/layout/stage-rules/${existing.id}`);
    }
    toast.success('Field saved'); setFieldModal(null); loadTabs(); loadStageRules();
  };

  const deleteField = async (fid) => {
    await api.delete(`/studio/layout/fields/${fid}`);
    toast.success('Deleted'); setDeleteConfirm(null); loadTabs(); loadStageRules();
  };

  if (loading) return <Layout title="Product"><Loader/></Layout>;

  const currentTab = tabs[activeTab];
  const currentBOM = boms.find(b=>b.id===form.bom_id);
  const colSpan = { full:'1/-1', half:'span 2', quarter:'span 1' };

  return (
    <Layout title={isNew?'New Product':form.title||form.name||'Product'}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={()=>navigate('/warranty/products')}><ArrowLeft size={15}/> Back</button>
        
        {!isNew && stages.length > 0 && (
          <div className="hide-scrollbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 0, padding: "10px 0", overflowX: "visible", whiteSpace: "nowrap", alignItems: "center", marginLeft: 16 }}>
            {stages.map((s) => {
              const isCurrent = form.stage_id === s.id;
              return (
                <div 
                  key={s.id}
                  onClick={() => isAdmin && set('stage_id', s.id)}
                  style={{
                    display: "flex", alignItems: "center", 
                    padding: isCurrent ? "12px 32px" : "8px 20px", 
                    borderRadius: "100px",
                    cursor: isAdmin ? "pointer" : "default", transition: "all 0.2s",
                    background: isCurrent ? s.color : s.color + "15",
                    color: isCurrent ? "#fff" : s.color,
                    fontSize: isCurrent ? "16px" : "12px", 
                    fontFamily: "inherit", fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "1px",
                    boxShadow: isCurrent ? `0 8px 24px ${s.color}60` : "none",
                    opacity: isCurrent ? 1 : 0.6,
                    border: "1px solid " + (isCurrent ? s.color : "transparent"),
                    whiteSpace: "nowrap",
                    flexShrink: 0
                  }}
                >
                  {s.name}
                </div>
              );
            })}
          </div>
        )}

        <div className="toolbar-right" style={{ display:'flex', gap:8 }}>
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditLayout(e=>!e)}
              style={editLayout?{background:'var(--accent-dim)',color:'var(--accent)',border:'1px solid var(--accent)'}:{}}>
              <Settings size={14}/> {editLayout?'Exit Layout':'Edit Layout'}
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
            {saving ? <div className="spinner" style={{ width:14,height:14 }}/> : recentlySaved ? <><Check size={14}/> Saved</> : <><Save size={14}/> Save</>}
          </button>
        </div>
      </div>

      <div className="detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="detail-section-title">Core Information</div>
            <div className="form-grid">
               <div className="form-group">
                 <label className="form-label">Product Name *</label>
                 <input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} />
               </div>
               <div className="form-grid form-grid-2">
                 <div className="form-group">
                   <label className="form-label">Serial Number *</label>
                   <input className="form-input" value={form.serial_number || ''} onChange={e => set('serial_number', e.target.value)} />
                 </div>
                 <div className="form-group">
                   <label className="form-label">BOM / Model</label>
                   <select className="form-select" value={form.bom_id || ''} onChange={e => set('bom_id', parseInt(e.target.value) || null)}>
                     <option value="">— Select BOM —</option>
                     {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                   </select>
                 </div>
               </div>
            </div>
          </div>

          <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
               <div style={{ display:'flex', gap:8 }}>
                  {editLayout && <button className="btn btn-ghost btn-sm" onClick={() => setTabModal({})}><Plus size={13}/> Add Tab</button>}
               </div>
            </div>
          {tabs.length > 0 && (
            <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid var(--border)', marginBottom: 20 }}>
              {tabs.map((t,i) => (
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
                    {f.field_type !== 'boolean' && <label className="form-label">{f.field_label}{f.required && <span style={{ color:'var(--red)' }}> *</span>}</label>}
                    <FieldInput field={f} value={form.custom_data[f.field_name]} onChange={v => setCustom(f.field_name, v)}/>
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
          <div className="detail-section-title">Warranty Status</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Period</label>
              <div style={{ display:'flex', gap:8 }}>
                <input className="form-input" type="number" style={{ width:80 }} value={form.warranty_period} onChange={e=>set('warranty_period',parseInt(e.target.value)||0)}/>
                <select className="form-select" value={form.warranty_unit} onChange={e=>set('warranty_unit',e.target.value)}>
                  {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
               <label className="form-label">Notes</label>
               <textarea className="form-textarea" value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Warranty specific notes..."/>
            </div>
          </div>
        </div>
      </div>
      
      {tabModal !== null && <TabModal initial={tabModal} onSave={saveTab} onClose={() => setTabModal(null)} />}
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
