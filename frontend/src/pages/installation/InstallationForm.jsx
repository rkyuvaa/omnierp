import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Modal, Badge } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Settings, Pencil, Trash2, Bell, Check } from 'lucide-react';

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

  const loadTabs = useCallback(() => api.get('/studio/layout/installation/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/installation/stage-rules').then(r => setStageRules(r.data)), []);

  useEffect(() => {
    api.get('/studio/stages/installation').then(r => setStages(r.data)).catch(() => {});
    api.get('/users/').then(r => setUsers(r.data)).catch(() => {});
    api.get('/warranty/products').then(r => setVehicles(Array.isArray(r.data) ? r.data : (r.data.items || []))).catch(() => {});
    loadTabs();
    loadStageRules();
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
    if (tab.id) await api.put(`/studio/layout/tabs/${tab.id}`, tab);
    else await api.post('/studio/layout/installation/tabs', { ...tab, sort_order: tabs.length });
    toast.success('Tab saved'); setTabModal(null); loadTabs();
  };

  const deleteTab = async (tid) => {
    await api.delete(`/studio/layout/tabs/${tid}`);
    toast.success('Tab deleted'); setDeleteConfirm(null); setActiveTab(0); loadTabs();
  };

  const saveField = async (f) => {
    const payload = { ...f };
    delete payload._new;
    if (f.id) await api.put(`/studio/layout/fields/${f.id}`, payload);
    else await api.post('/studio/layout/installation/fields', { ...payload, tab_id: fieldModal?.tabId });
    toast.success('Field saved'); setFieldModal(null); loadTabs();
  };

  const deleteField = async (fid) => {
    await api.delete(`/studio/layout/fields/${fid}`);
    toast.success('Field deleted'); setDeleteConfirm(null); loadTabs();
  };

  if (loading || !form) return <Layout title="Installation"><Loader /></Layout>;
  const currentTab = tabs[activeTab];

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
        <div className="hide-scrollbar" style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, marginBottom: 20, padding: '10px 0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {stages.map(s => {
            const isCurrent = form.stage_id === s.id;
            return (
              <div key={s.id} onClick={() => isAdmin && updateStage(s.id)}
                style={{
                  padding: isCurrent ? "12px 32px" : "8px 20px", 
                  borderRadius: 100,
                  cursor: isAdmin ? "pointer" : "default", transition: "all 0.2s",
                  background: isCurrent ? s.color : (s.color + "15"),
                  color: isCurrent ? "#fff" : s.color,
                  fontSize: isCurrent ? "16px" : "12px", 
                  fontWeight: 800,
                  textTransform: "uppercase", letterSpacing: "1px",
                  boxShadow: isCurrent ? `0 8px 24px ${s.color}60` : "none",
                  opacity: isCurrent ? 1 : 0.65,
                  border: `1px solid ${isCurrent ? s.color : "transparent"}`,
                  flexShrink: 0,
                }}>
                {s.name}
              </div>
            );
          })}
          {!isAdmin && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 10, opacity: 0.7, alignSelf: 'center' }}>[View Only]</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* LEFT */}
        <div>
          {/* Core fields */}
          <div className="card mb-4">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Vehicle Number *</label>
                <select 
                  className="form-select fw-600" 
                  value={form.product_id || ''} 
                  onChange={e => set('product_id', parseInt(e.target.value) || '')}
                  disabled={!isNew && !!form.product_id}
                  style={(!isNew && !!form.product_id) ? { background:'var(--bg3)', cursor:'not-allowed' } : {}}
                >
                  <option value="">— Select Vehicle —</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {!isNew && !!form.product_id && <span style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Link is permanent once saved.</span>}
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Assigned Technician</label>
                <select className="form-select" value={form.technician_id || ''} onChange={e => set('technician_id', parseInt(e.target.value) || null)}>
                  <option value="">— Unassigned —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." rows={3} />
              </div>
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
               <div style={{ display:'flex', gap:8 }}>
                  {editLayout && <button className="btn btn-ghost btn-sm" onClick={() => setTabModal({})}><Plus size={13}/> Add Tab</button>}
               </div>
            </div>
            {tabs.length > 0 && (
              <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid var(--border)', marginBottom: 20 }}>
                {tabs.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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

            {currentTab && (
              <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {(currentTab.fields || []).filter(f => isVisible(f, form.custom_data)).map(f => (
                    <div key={f.id} style={{ gridColumn:colSpan[f.width]||'1/-1', position: 'relative' }}>
                      {f.field_type !== 'boolean' && <label className="form-label">{f.field_label}{f.required && <span style={{color:'var(--red)'}}> *</span>}</label>}
                      <FieldInput field={f} value={form.custom_data[f.field_name]} onChange={v => setCustom(f.field_name, v)} />
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
                      <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal({ field: { field_name: '', field_label: '', field_type: 'text', placeholder: '', options: [], required: false, width: 'full', sort_order: (currentTab.fields || []).length, tab_id: currentTab.id }, tabId: currentTab.id })}>
                        <Plus size={13} /> Add Field to "{currentTab.name}"
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Activity */}
          {!isNew && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Bell size={14} />
                <span className="card-title">Activity</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input className="form-input" placeholder="Add a note or task..." value={actDesc} onChange={e => setActDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && addActivity()} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: 12, whiteSpace: 'nowrap' }}>Due</label>
                  <input className="form-input" type="datetime-local" value={actDue} onChange={e => setActDue(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-sm" onClick={addActivity} style={{ flexShrink: 0 }}><Plus size={13} /> Add</button>
                </div>
              </div>
              {activities.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activities.map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, opacity: a.done ? 0.45 : 1, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12 }}>{a.description}</div>
                        {a.due_date && !a.done && <div style={{ fontSize: 10, color: 'var(--amber)', marginTop: 2 }}>due {new Date(a.due_date).toLocaleDateString()}</div>}
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(a.created_at)}</div>
                      </div>
                      {!a.done && <button className="btn btn-ghost btn-sm" onClick={() => markDone(a.id)} title="Mark done"><Check size={12} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {tabModal !== null && <TabModal initial={tabModal} onSave={saveTab} onClose={() => setTabModal(null)} />}
      {fieldModal !== null && <FieldModal initial={fieldModal.field} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={() => setFieldModal(null)} />}

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
