import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Modal, Badge } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useStages, useUsers } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Pencil, Trash2, Settings, Upload, Download, Eye, X, FileText, Check } from 'lucide-react';
const empty = {
  customer_name: '', phone: '', email: '',
  vehicle_number: '', vehicle_make: '', vehicle_model: '',
  product_serial: '', issue_type: '', issue_description: '',
  stage_id: '', assigned_to: '', notes: '', custom_data: {}
};
const ISSUE_TYPES = [
  'Performance Issue', 'Breakdown', 'Warranty Claim',
  'Maintenance Request', 'Installation Issue', 'General Query', 'Other'
];

const FIELD_TYPES = ['text','number','date','textarea','selection','boolean','checkbox','file'];
const WIDTH_OPTIONS = [{value:'full',label:'Full Row'},{value:'half',label:'Half Row'},{value:'quarter',label:'Quarter Row'}];
const emptyField = { field_name:'', field_label:'', field_type:'text', placeholder:'', options:[], required:false, width:'full', visibility_rule:null, sort_order:0 };
function FileField({ field, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();
  const token = localStorage.getItem('token');
  const baseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${baseUrl}/api/upload`, { method:'POST', headers:{Authorization:`Bearer ${token}`}, body:fd });
      const data = await r.json();
      onChange({ filename:data.filename, original_name:data.original_name, url:data.url, content_type:data.content_type });
      toast.success('Uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };
  const fileUrl = value?.url ? `${baseUrl}${value.url}` : null;
  if (value?.filename) return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--border)' }}>
      <FileText size={16} style={{ color:'var(--accent)', flexShrink:0 }}/>
      <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value.original_name}</span>
      <a href={fileUrl} download={value.original_name} className="btn btn-ghost btn-sm"><Download size={13}/></a>
      <button className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}><Upload size={13}/></button>
      <button className="btn btn-danger btn-sm" onClick={() => onChange(null)}><X size={13}/></button>
      <input ref={inputRef} type="file" style={{ display:'none' }} onChange={handleUpload}/>
    </div>
  );
  return (
    <div>
      <input type="file" style={{ display:'none' }} ref={inputRef} onChange={handleUpload}/>
      <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', border:'2px dashed var(--border)', borderRadius:8, padding:'10px' }}
        onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <div className="spinner" style={{ width:14, height:14 }}/> : <><Upload size={14}/> Choose File</>}
      </button>
    </div>
  );
}
function CheckboxField({ field, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) => selected.includes(opt) ? onChange(selected.filter(o=>o!==opt)) : onChange([...selected,opt]);
  if (!field.options?.length) return <span className="text-muted text-sm">No options</span>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {field.options.map(opt => (
        <label key={opt} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor:'var(--accent)', width:15, height:15 }}/>
          {opt}
        </label>
      ))}
    </div>
  );
}
function FieldInput({ field, value, onChange }) {
  const v = value ?? (field.field_type==='boolean' ? false : field.field_type==='checkbox' ? [] : '');
  switch(field.field_type) {
    case 'textarea': return <textarea className="form-textarea" placeholder={field.placeholder} value={v} onChange={e=>onChange(e.target.value)}/>;
    case 'number': return <input className="form-input" type="number" placeholder={field.placeholder} value={v} onChange={e=>onChange(parseFloat(e.target.value)||0)}/>;
    case 'date': return <input className="form-input" type="date" value={v} onChange={e=>onChange(e.target.value)}/>;
    case 'boolean': return <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}><input type="checkbox" checked={!!v} onChange={e=>onChange(e.target.checked)} style={{ width:16, height:16, accentColor:'var(--accent)' }}/><span className="text-sm">{field.field_label}</span></label>;
    case 'checkbox': return <CheckboxField field={field} value={v} onChange={onChange}/>;
    case 'file': return <FileField field={field} value={v} onChange={onChange}/>;
    case 'selection': return <select className="form-select" value={v} onChange={e=>onChange(e.target.value)}><option value="">— Select —</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>;
    default: return <input className="form-input" type="text" placeholder={field.placeholder} value={v} onChange={e=>onChange(e.target.value)}/>;
  }
}
function isVisible(field, customData) {
  if (!field.visibility_rule) return true;
  const { field:rf, operator, value:rv } = field.visibility_rule;
  const val = customData[rf];
  if (operator==='equals') return Array.isArray(val) ? val.includes(rv) : String(val ?? '') === String(rv ?? '');
  return val!==undefined&&val!==''&&val!==false&&val!==null&&!(Array.isArray(val)&&val.length===0);
}
function FieldEditor({ field, tabs, stages, stageRules, onSave, onClose }) {
  const [f, setF] = useState({ ...emptyField, ...field });
  const [optInput, setOptInput] = useState('');
  const [stageRuleOp, setStageRuleOp] = useState('has_value');
  const [stageRuleStageId, setStageRuleStageId] = useState('');
  const [stageRuleVal, setStageRuleVal] = useState('');
  useEffect(() => {
    if (field.field_name && stageRules) {
      const rule = stageRules.find(r => r.field_name === field.field_name);
      if (rule) {
        setStageRuleStageId(rule.stage_id);
        setStageRuleOp(rule.condition_operator);
        setStageRuleVal(rule.condition_value || '');
      }
    }
  }, [field.field_name, stageRules]);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const needsOptions = ['selection','checkbox'].includes(f.field_type);
  const allFields = tabs.flatMap(t=>t.fields||[]).filter(fld=>fld.field_name!==f.field_name);
  return (
    <Modal title={field.id?'Edit Field':'New Field'} onClose={onClose} large
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={()=>onSave({ ...f, _stageRule: stageRuleStageId, _stageRuleOp: stageRuleOp, _stageRuleVal: stageRuleVal })}>Save Field</button></>}>
      <div className="form-grid">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label className="form-label">Field Label *</label>
            <input className="form-input" value={f.field_label} onChange={e=>{ set('field_label',e.target.value); if(!field.id) set('field_name',e.target.value.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')); }}/>
          </div>
          <div className="form-group">
            <label className="form-label">Field Key</label>
            <input className="form-input" value={f.field_name} onChange={e=>set('field_name',e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={f.field_type} onChange={e=>set('field_type',e.target.value)}>
              {FIELD_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Width</label>
            <select className="form-select" value={f.width} onChange={e=>set('width',e.target.value)}>
              {WIDTH_OPTIONS.map(w=><option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          {!['boolean','checkbox','file'].includes(f.field_type) && (
            <div className="form-group">
              <label className="form-label">Placeholder</label>
              <input className="form-input" value={f.placeholder} onChange={e=>set('placeholder',e.target.value)}/>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Tab</label>
            <select className="form-select" value={f.tab_id||''} onChange={e=>set('tab_id',parseInt(e.target.value)||null)}>
              <option value="">— No Tab —</option>
              {tabs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} className="form-label">
              <input type="checkbox" checked={f.required} onChange={e=>set('required',e.target.checked)} style={{ accentColor:'var(--accent)' }}/> Required field
            </label>
          </div>
        </div>
        {needsOptions && (
          <div className="form-group">
            <label className="form-label">Options</label>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input className="form-input" placeholder="Add option..." value={optInput} onChange={e=>setOptInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&optInput.trim()){set('options',[...(f.options||[]),optInput.trim()]);setOptInput('');} }}/>
              <button className="btn btn-ghost" onClick={()=>{ if(optInput.trim()){set('options',[...(f.options||[]),optInput.trim()]);setOptInput('');} }}><Plus size={14}/></button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {(f.options||[]).map((o,i)=>(
                <span key={i} style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 10px',background:'var(--bg3)',borderRadius:20,fontSize:13 }}>
                  {o}<button onClick={()=>set('options',f.options.filter((_,j)=>j!==i))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',lineHeight:1 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Visibility — show only when</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <select className="form-select" value={f.visibility_rule?.field||''}
              onChange={e=>set('visibility_rule',e.target.value?{field:e.target.value,operator:'has_value',value:''}:null)}>
              <option value="">Always visible</option>
              {allFields.map(fld=><option key={fld.field_name} value={fld.field_name}>{fld.field_label}</option>)}
            </select>
            {f.visibility_rule?.field && (
              <select className="form-select" value={f.visibility_rule?.operator||'has_value'}
                onChange={e=>set('visibility_rule',{...f.visibility_rule,operator:e.target.value,value:''})}>
                <option value="has_value">has any value</option>
                <option value="equals">equals specific value</option>
              </select>
            )}
          </div>
          {f.visibility_rule?.field && f.visibility_rule?.operator==='equals' && (
            <input className="form-input" style={{ marginTop:8 }} placeholder="Enter expected value..."
              value={f.visibility_rule?.value||''} onChange={e=>set('visibility_rule',{...f.visibility_rule,value:e.target.value})}/>
          )}
        </div>
        {!['file', 'checkbox'].includes(f.field_type) && (
          <div className="form-group" style={{ gridColumn:'1/-1', marginTop:16, borderTop:'1px solid var(--border)', paddingTop:16 }}>
            <label className="form-label" style={{ display:'flex', alignItems:'center', gap:8 }}><Plus size={14} color="var(--accent)"/> Auto-move to Stage</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select className="form-select" value={stageRuleOp} onChange={e => setStageRuleOp(e.target.value)}>
                <option value="has_value">when field has any value</option>
                <option value="equals">when field equals specific value</option>
              </select>
              <select className="form-select" value={stageRuleStageId} onChange={e => setStageRuleStageId(e.target.value)}>
                <option value="">No auto-stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {stageRuleOp === 'equals' && stageRuleStageId && (
              <div style={{ marginTop: 8 }}>
                {['selection'].includes(f.field_type) ? (
                  <select className="form-select" value={stageRuleVal} onChange={e => setStageRuleVal(e.target.value)}>
                    <option value="">— Select trigger value —</option>
                    {(f.options||[]).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.field_type === 'boolean' ? (
                  <select className="form-select" value={stageRuleVal} onChange={e => setStageRuleVal(e.target.value)}>
                    <option value="true">True (checked)</option>
                    <option value="false">False (unchecked)</option>
                  </select>
                ) : (
                  <input className="form-input" placeholder="Enter trigger value..." value={stageRuleVal} onChange={e => setStageRuleVal(e.target.value)}/>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
function TabEditor({ tab, onSave, onClose }) {
  const [name, setName] = useState(tab?.name||'');
  return (
    <Modal title={tab?.id?'Edit Tab':'New Tab'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={()=>onSave(name)}>Save Tab</button></>}>
      <div className="form-group">
        <label className="form-label">Tab Name *</label>
        <input className="form-input" value={name} onChange={e=>setName(e.target.value)} autoFocus placeholder="e.g. Technical Details"/>
      </div>
    </Modal>
  );
}

export default function KonwertCareForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_superadmin;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const stages = useStages('konwertcare');
  const users = useUsers();
  const [tabs, setTabs] = useState([]);
  const [stageRules, setStageRules] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [editLayout, setEditLayout] = useState(false);
  const [fieldModal, setFieldModal] = useState(null);
  const [tabModal, setTabModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const loadTabs = useCallback(() => api.get('/studio/layout/konwertcare/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/konwertcare/stage-rules').then(r => setStageRules(r.data)), []);
  useEffect(() => {
    loadTabs();
    loadStageRules();
    if (!isNew) {
      api.get(`/konwertcare/${id}`).then(r => {
        setForm({ ...empty, ...r.data, custom_data: r.data.custom_data || {} });
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
  const saveTab = async (tab) => {
    if (tab.id) await api.put(`/studio/layout/tabs/${tab.id}`, tab);
    else await api.post('/studio/layout/konwertcare/tabs', { ...tab, sort_order: tabs.length });
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
    else await api.post('/studio/layout/konwertcare/fields', payload);
    
    if (stageRule) {
      await api.post('/studio/layout/konwertcare/stage-rules', { field_name: payload.field_name, stage_id: parseInt(stageRule), condition_operator: stageRuleOp, condition_value: stageRuleOp === 'equals' ? stageRuleVal : null });
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
  const save = async () => {
    if (!form.customer_name?.trim()) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, assigned_to: form.assigned_to || null };
      if (isNew) {
        const r = await api.post('/konwertcare/', payload);
        toast.success('✓ Care request created successfully!', { duration: 4000 }); 
        navigate(`/konwertcare/${r.data.id}`);
      } else {
        const response = await api.put(`/konwertcare/${id}`, payload); 
        console.log('Save response:', response.status); 
        toast.success('✓ Saved successfully!', { duration: 4000 });
      }
    } catch(e) { 
      console.error('Save error:', e); 
      toast.error(e.response?.data?.detail || 'Failed to save', { duration: 4000 }); 
    }
    finally { setSaving(false); }
  };
  if (loading) return <Layout title="Konwert Care+"><Loader /></Layout>;
  const currentTab = tabs[activeTab];
  const colSpan = { full: '1/-1', half: 'span 2', quarter: 'span 1' };
  return (
    <Layout title={isNew ? 'New Care Request' : `Care — ${form.reference || ''}`}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/konwertcare')}>
          <ArrowLeft size={15} /> Back
        </button>
        {!isNew && form.reference && <span className="ref-text" style={{ fontSize: 14 }}>{form.reference}</span>}
        {stages.length > 0 && (
          <div className="flex gap-2" style={{ marginLeft: 16 }}>
            {stages.map(s => (
              <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => set('stage_id', s.id)}
                style={form.stage_id === s.id
                  ? { background: s.color, borderColor: s.color, color: 'white' }
                  : { borderColor: s.color, color: s.color }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="toolbar-right" style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditLayout(e=>!e)}
              style={editLayout?{background:'var(--accent-dim)',color:'var(--accent)',border:'1px solid var(--accent)'}:{}}>
              <Settings size={14}/> {editLayout?'Exit Layout':'Edit Layout'}
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />} Save
          </button>
        </div>
      </div>
      <div className="detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="detail-section-title">Customer Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Customer Name *</label>
                <input className="form-input" value={form.customer_name || ''} onChange={e => set('customer_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="detail-section-title">Vehicle & Product</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Vehicle Number</label>
                <input className="form-input" value={form.vehicle_number || ''} onChange={e => set('vehicle_number', e.target.value)} placeholder="TN01AB1234" />
              </div>
              <div className="form-group">
                <label className="form-label">Product Serial No.</label>
                <input className="form-input" value={form.product_serial || ''} onChange={e => set('product_serial', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Make</label>
                <input className="form-input" value={form.vehicle_make || ''} onChange={e => set('vehicle_make', e.target.value)} placeholder="Toyota" />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Model</label>
                <input className="form-input" value={form.vehicle_model || ''} onChange={e => set('vehicle_model', e.target.value)} placeholder="Innova" />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="detail-section-title">Issue Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Issue Type</label>
                <select className="form-select" value={form.issue_type || ''} onChange={e => set('issue_type', e.target.value)}>
                  <option value="">— Select —</option>
                  {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Issue Description</label>
                <textarea className="form-textarea" value={form.issue_description || ''} onChange={e => set('issue_description', e.target.value)} placeholder="Describe the issue in detail..." />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Internal Notes</label>
                <textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
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
          </div>
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
              <label className="form-label">Assigned To</label>
              <select className="form-select" value={form.assigned_to || ''} onChange={e => set('assigned_to', parseInt(e.target.value) || null)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
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
