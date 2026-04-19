import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Badge, Modal, Confirm } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useStages, useUsers } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import api, { BASE_URL } from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Check, Settings, Pencil, Trash2, Bell, Upload, Download, Eye, X, FileText } from 'lucide-react';

const emptyForm = (userId) => ({ title:'', customer_name:'', email:'', phone:'', stage_id:'', assigned_to: userId||'', custom_data:{} });
const emptyField = { field_name:'', field_label:'', field_type:'text', placeholder:'', options:[], required:false, width:'full', visibility_rule:null, sort_order:0 };
const colSpan = { full:'1/-1', half:'span 2', quarter:'span 1' };
const FIELD_TYPES = ['text','number','date','textarea','selection','boolean','checkbox','file'];
const WIDTH_OPTIONS = [
  { value:'full', label:'Full Row' },
  { value:'half', label:'Half Row' },
  { value:'quarter', label:'Quarter Row' },
];
const WIDTH_COLS = { full:'1/-1', half:'span 1', quarter:'span 1' };





// ── Activity Type Manager ─────────────────────────────────────
function ActivityTypeModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const perms = user?.is_superadmin ? {can_read:true, can_create:true, can_edit:true, can_delete:true} : (user?.module_permissions?.['crm'] || {});

  const [types, setTypes] = useState([]);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📝');
  const [newColor, setNewColor] = useState('#6366f1');

  useEffect(() => { api.get('/crm/activity-types').then(r => setTypes(r.data)); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    await api.post('/crm/activity-types', { name:newName.trim(), icon:newIcon, color:newColor, sort_order:types.length });
    const r = await api.get('/crm/activity-types');
    setTypes(r.data); setNewName(''); onSaved();
  };

  const remove = async (id) => {
    if (!id) return;
    await api.delete(`/crm/activity-types/${id}`);
    const r = await api.get('/crm/activity-types');
    setTypes(r.data); onSaved();
  };

  return (
    <Modal title="Manage Activity Types" onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        {types.map(t => (
          <div key={t.id||t.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:8 }}>
            <span style={{ fontSize:18 }}>{t.icon}</span>
            <span style={{ flex:1, fontWeight:600 }}>{t.name}</span>
            <span style={{ width:16, height:16, borderRadius:'50%', background:t.color, display:'inline-block' }}/>
            {t.id && <button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}><Trash2 size={12}/></button>}
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, alignItems:'end' }}>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Name</label>
          <input className="form-input" placeholder="e.g. meeting" value={newName} onChange={e => setNewName(e.target.value)}/>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Icon</label>
          <input className="form-input" value={newIcon} onChange={e => setNewIcon(e.target.value)} style={{ fontSize:18, textAlign:'center' }}/>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Color</label>
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
            style={{ width:'100%', height:38, border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', padding:2 }}/>
        </div>
        <button className="btn btn-primary" onClick={add} style={{ height:38 }}><Plus size={14}/></button>
      </div>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function formatChangeLog(log) {
  const changes = log.changes || {};
  if (log.action==='CREATE') return [`Created by ${log.user_name}`];
  if (log.action==='ACTIVITY') return [`${log.user_name} added ${changes.type||'activity'}: ${changes.description||''}`];
  const lines = [];
  for (const [key, val] of Object.entries(changes)) {
    const label = key.startsWith('custom:') ? key.replace('custom:','') : key;
    if (val && typeof val==='object' && 'from' in val)
      lines.push(`${log.user_name} changed ${label}: ${val.from??'—'} → ${val.to??'—'}`);
  }
  return lines.length ? lines : [`${log.user_name} updated record`];
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// ── Main Component ────────────────────────────────────────────
export default function LeadForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const perms = user?.is_superadmin ? {can_read:true, can_create:true, can_edit:true, can_delete:true} : (user?.module_permissions?.['crm'] || {});
  const isAdmin = user?.is_superadmin;

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [activities, setActivities] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [stageRules, setStageRules] = useState([]);
  const [editLayout, setEditLayout] = useState(false);
  const [activityTypes, setActivityTypes] = useState([]);
  const [actType, setActType] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actDue, setActDue] = useState('');
  const [fieldModal, setFieldModal] = useState(null);
  const [tabModal, setTabModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actTypeModal, setActTypeModal] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);

  const stages = useStages('crm');
  const users = useUsers();

  const loadTabs = useCallback(() => api.get('/studio/layout/crm/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/crm/stage-rules').then(r => setStageRules(r.data)), []);
  const loadActivityTypes = useCallback(() =>
    api.get('/crm/activity-types').then(r => {
      setActivityTypes(r.data);
      setActType(t => t || (r.data[0]?.name || ''));
    }), []);

  useEffect(() => { loadTabs(); loadStageRules(); loadActivityTypes(); }, []);

  useEffect(() => {
    if (isNew && user) {
      setForm({ title:'', customer_name:'', email:'', phone:'', stage_id:'', assigned_to:user.id, custom_data:{} });
      setLoading(false);
    } else if (!isNew) {
      api.get(`/crm/leads/${id}`).then(r => {
        setForm({ title:'', customer_name:'', email:'', phone:'', stage_id:'', assigned_to:'', custom_data:{}, ...r.data });
        setActivities(r.data.activities||[]);
        setChangeLogs(r.data.change_logs||[]);
        setLoading(false);
      });
    }
  }, [id, isNew, user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => {
    setForm(f => {
      const newCustom = { ...f.custom_data, [k]: v };
      const rule = stageRules.find(r => r.field_name === k);
      if (rule) {
        const hasValue = v !== '' && v !== false && v !== null &&
          !(Array.isArray(v) && v.length === 0);
        if (rule.condition_operator === 'equals') {
          const matches = Array.isArray(v)
            ? v.includes(rule.condition_value)
            : String(v ?? '') === String(rule.condition_value ?? '');
          if (matches) return { ...f, custom_data: newCustom, stage_id: rule.stage_id };
        } else {
          if (hasValue) return { ...f, custom_data: newCustom, stage_id: rule.stage_id };
        }
      }
      return { ...f, custom_data: newCustom };
    });
  };

  const save = async () => {
    // Validate title
    if (!form.title?.trim()) {
      setTitleError(true);
      toast.error('Lead title is required');
      return;
    }
    setTitleError(false);
    setSaving(true);
    try {
      const payload = { ...form, stage_id:form.stage_id||null, assigned_to:form.assigned_to||null, expected_revenue:0, notes:'' };
      if (isNew) {
        const r = await api.post('/crm/leads', payload);
        toast.success('✓ Lead created successfully!', { duration: 4000 }); 
        navigate(`/crm/${r.data.id}`);
      } else {
        const response = await api.put(`/crm/leads/${id}`, payload);
        console.log('Save response:', response.status);
        api.get(`/crm/leads/${id}`).then(r => setChangeLogs(r.data.change_logs||[]));
        toast.success('✓ Saved successfully!', { duration: 4000 });
        setRecentlySaved(true);
        setTimeout(() => setRecentlySaved(false), 3000);
      }
    } catch(e) { 
      console.error('Save error:', e);
      toast.error(e.response?.data?.detail || 'Failed to save', { duration: 4000 }); 
    }
    finally { setSaving(false); }
  };

  const updateStage = async (stageId) => {
    if (!isAdmin) return;
    try {
      await api.put(`/crm/leads/${id}/stage`, { stage_id: stageId });
      set('stage_id', stageId);
      api.get(`/crm/leads/${id}`).then(r => setChangeLogs(r.data.change_logs||[]));
      toast.success('Stage updated');
    } catch { toast.error('Failed'); }
  };

  const addActivity = async () => {
    if (!actDesc.trim()) { toast.error('Please enter a description'); return; }
    const r = await api.post('/crm/activities', {
      lead_id:parseInt(id), activity_type:actType, description:actDesc, due_date:actDue||null
    });
    setActivities(a => [r.data,...a]);
    setActDesc(''); setActDue('');
    api.get(`/crm/leads/${id}`).then(r => setChangeLogs(r.data.change_logs||[]));
    toast.success('Activity added');
  };

  const markDone = async (aid) => {
    await api.put(`/crm/activities/${aid}/done`);
    setActivities(a => a.map(x => x.id===aid?{...x,done:true}:x));
  };

  const saveTab = async (tab) => {
    if (tab.id) await api.put(`/studio/layout/tabs/${tab.id}`, tab);
    else await api.post('/studio/layout/crm/tabs', { ...tab, sort_order: tabs.length });
    toast.success('Tab saved'); setTabModal(null); loadTabs();
  };

  const deleteTab = async (tid) => {
    await api.delete(`/studio/layout/tabs/${tid}`);
    toast.success('Tab deleted');
    setDeleteConfirm(null);
    setActiveTab(0);
    loadTabs();
  };

  const saveField = async (f) => {
    const stageRule = f._stageRule;
    const stageRuleOp = f._stageRuleOp || 'has_value';
    const stageRuleVal = f._stageRuleVal || '';
    const payload = { ...f };
    delete payload._stageRule; delete payload._stageRuleOp; delete payload._stageRuleVal;
    if (!payload.tab_id) payload.tab_id = fieldModal?.tabId || null;
    if (f.id) await api.put(`/studio/layout/fields/${f.id}`, payload);
    else await api.post('/studio/layout/crm/fields', payload);
    if (stageRule) {
      await api.post('/studio/layout/crm/stage-rules', {
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
    toast.success('Field deleted'); setDeleteConfirm(null); loadTabs();
  };

  if (loading||!form) return <Layout title="Lead"><Loader/></Layout>;

  const currentTab = tabs[activeTab];
  const actTypeMap = Object.fromEntries(activityTypes.map(t => [t.name, t]));

  // Grid layout: full=4cols, half=2cols, quarter=1col out of 4
  const gridStyle = { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 };
  const colSpan = { full:'1/-1', half:'span 2', quarter:'span 1' };

  return (
    <Layout title={isNew?'New Lead':form.title||'Lead'}>
      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={() => navigate('/crm')}><ArrowLeft size={15}/> Back</button>
        {!isNew&&form.reference&&<span className="ref-text" style={{ fontSize:14 }}>{form.reference}</span>}
        <div className="toolbar-right" style={{ display:'flex', gap:8 }}>
          {isAdmin&&(
            <button className="btn btn-ghost btn-sm" onClick={() => setEditLayout(e=>!e)}
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

      {!isNew && stages.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 20, width: "100%", boxSizing: "border-box" }}>
          
          {stages.map((s) => {
            const isCurrent = form.stage_id === s.id;
            return (
              <div 
                key={s.id}
                onClick={() => isAdmin && updateStage(s.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "8px 12px", 
                  borderRadius: "100px",
                  cursor: isAdmin ? "pointer" : "default", transition: "all 0.2s",
                  background: isCurrent ? s.color : s.color + "15",
                  color: isCurrent ? "#fff" : s.color,
                  fontSize: "12px", 
                  fontFamily: "inherit", fontWeight: 800,
                  textTransform: "uppercase", letterSpacing: "1px",
                  boxShadow: isCurrent ? "0 8px 24px " + s.color + "60" : "none",
                  opacity: isCurrent ? 1 : 0.6,
                  border: "1px solid " + (isCurrent ? s.color : "transparent"),
                  minWidth: 0,
                  flex: 1,
                  textAlign: "center"
                }}
              >
                {s.name}
              </div>
            );
          })}
          {!isAdmin && <span style={{ fontSize: 10, color: "var(--text3)", flexShrink: 0, marginLeft: 10, opacity: 0.7 }}>[View Only]</span>}
        </div>
      )}

      <div className="detail-layout" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, width: "100%", maxWidth: "100%", boxSizing: "border-box", minWidth: 0 }}>
        {/* LEFT */}
        <div>
          {/* Core fields */}
          <div className="card mb-4">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">
                  Title <span style={{ color:'var(--red)' }}>*</span>
                </label>
                <input className="form-input" value={form.title}
                  style={titleError?{borderColor:'var(--red)',boxShadow:'0 0 0 2px rgba(239,68,68,0.15)'}:{}}
                  onChange={e => { set('title',e.target.value); if(e.target.value.trim()) setTitleError(false); }}
                  placeholder="Lead title (required)"/>
                {titleError&&<span style={{ fontSize:11, color:'var(--red)', marginTop:4, display:'block' }}>Title is required</span>}
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Customer Name</label>
                <input className="form-input" value={form.customer_name||''} onChange={e => set('customer_name',e.target.value)}/>
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Assigned To</label>
                <select className="form-select" value={form.assigned_to||''} onChange={e => set('assigned_to',parseInt(e.target.value)||null)}>
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email||''} onChange={e => set('email',e.target.value)}/>
              </div>
              <div className="form-group" style={{ gridColumn:'span 2' }}>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone||''} onChange={e => set('phone',e.target.value)}/>
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

          {/* Tab content */}
          {currentTab && (
            <div className="card" style={{ borderTopLeftRadius:0, borderTopRightRadius:0, borderTop:'none' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
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
                {(currentTab.fields||[]).length===0&&!editLayout&&(
                  <p className="text-muted text-sm" style={{ gridColumn:'1/-1' }}>No fields in this tab yet.</p>
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

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Activity adder */}
          {!isNew&&(
            <div className="card" style={{ maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Bell size={14}/> Activity</span>
                {isAdmin&&<button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => setActTypeModal(true)}><Settings size={11}/> Types</button>}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:8 }}>
                  <select className="form-select" style={{ width:130 }} value={actType} onChange={e => setActType(e.target.value)}>
                    {activityTypes.map(t => <option key={t.name} value={t.name}>{t.icon} {t.name}</option>)}
                  </select>
                  <input className="form-input" placeholder="Description..." value={actDesc}
                    onChange={e => setActDesc(e.target.value)} onKeyDown={e => e.key==='Enter'&&addActivity()} style={{ flex:1 }}/>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <label className="form-label" style={{ margin:0, whiteSpace:'nowrap', fontSize:12 }}>Due</label>
                  <input className="form-input" type="datetime-local" value={actDue} onChange={e => setActDue(e.target.value)} style={{ flex:1 }}/>
                  <button style={{ flexShrink: 0, minWidth: "max-content" }} className="btn btn-primary btn-sm" onClick={addActivity}><Plus size={13}/> Add</button>
                </div>
              </div>
              {activities.length>0&&(
                <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                  {activities.map(a => {
                    const at = actTypeMap[a.type]||{color:'var(--accent)',icon:'📝'};
                    return (
                      <div key={a.id} style={{ display:'flex', gap:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:8, opacity:a.done?0.45:1, alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                            <Badge color={at.color}>{at.icon} {a.type}</Badge>
                            {a.due_date&&!a.done&&<span style={{ fontSize:10, color:'var(--amber)' }}>due {new Date(a.due_date).toLocaleDateString()}</span>}
                          </div>
                          <div style={{ fontSize:12 }}>{a.description}</div>
                          <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{timeAgo(a.created_at)}</div>
                        </div>
                        {!a.done&&<button className="btn btn-ghost btn-sm" onClick={() => markDone(a.id)} title="Mark done"><Check size={12}/></button>}
                      </div>
                    );
                  })}
                </div>
              )}
              
          </div>
          )}

          {/* Change log */}
          {!isNew&&(
            <div className="card" style={{ maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
              <div className="card-header" style={{ marginBottom:8 }}>
                <span className="card-title" style={{ fontSize:13 }}>Change Log</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {changeLogs.length===0&&<p className="text-muted text-sm">No changes yet.</p>}
                {changeLogs.map(log => (
                  <div key={log.id} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                    {formatChangeLog(log).map((line,i) => (
                      <div key={i} style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5 }}>{line}</div>
                    ))}
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{timeAgo(log.created_at)}</div>
                  </div>
                ))}
              </div>
              
          </div>
          )}

          {/* Admin stage */}
          {isAdmin&&(
            <div className="card" style={{ maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
              <div className="detail-section-title">Stage (Admin)</div>
              <select className="form-select" value={form.stage_id||''}
                onChange={e => isNew?set('stage_id',parseInt(e.target.value)||null):updateStage(parseInt(e.target.value)||null)}>
                <option value="">— Select —</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              
          </div>
          )}
        </div>
      </div>

      {tabModal !== null && <TabModal initial={tabModal} onSave={saveTab} onClose={() => setTabModal(null)} />}
      {fieldModal !== null && <FieldModal initial={fieldModal.field} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={() => setFieldModal(null)} />}
      {actTypeModal&&<ActivityTypeModal onClose={() => setActTypeModal(false)} onSaved={loadActivityTypes}/>}
      {deleteConfirm&&(
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-body" style={{ textAlign:'center', padding:'32px 24px' }}>
              <p style={{ marginBottom:20 }}>Delete <b>{deleteConfirm.name}</b>?</p>
              <div className="flex gap-2" style={{ justifyContent:'center' }}>
                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => {
                  if(deleteConfirm.type==='tab') deleteTab(deleteConfirm.id);
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
