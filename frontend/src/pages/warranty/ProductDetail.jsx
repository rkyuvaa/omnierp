import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Loader, Badge, Modal, Confirm } from '../../components/Shared';
import { FieldModal, TabModal } from '../../components/StudioModals';
import { FieldInput, isVisible } from '../../components/StudioComponents';
import { useAuth } from '../../hooks/useAuth';
import { useStages } from '../../hooks/useData';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Pencil, Trash2, Package, Settings, Check, User as UserIcon } from 'lucide-react';

const emptyForm = { name:'', serial_number:'', bom_id:'', warranty_period:12, warranty_unit:'months', notes:'', stage_id:'', custom_data:{}, component_serials:[] };
const emptyField = { field_name:'', field_label:'', field_type:'text', placeholder:'', options:[], required:false, width:'full', visibility_rule:null, sort_order:0 };
const colSpan = { full:'1/-1', half:'span 2', quarter:'span 1' };

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
        setForm({ ...emptyForm, ...r.data, custom_data: r.data.custom_data || {}, component_serials: r.data.component_serials || [] });
        setLoading(false);
      });
    }
  }, [id, isNew, loadTabs, loadStageRules]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setForm(f => ({ ...f, custom_data: { ...f.custom_data, [k]: v } }));

  const handleBOMChange = (bomId) => {
    const selectedBOM = boms.find(b => b.id === parseInt(bomId));
    if (!selectedBOM) return setForm(f => ({ ...f, bom_id: '', component_serials: [] }));
    
    setForm(f => ({ 
      ...f, 
      bom_id: parseInt(bomId), 
      title: selectedBOM.name,
      warranty_period: selectedBOM.warranty_period || f.warranty_period,
      warranty_unit: selectedBOM.warranty_unit || f.warranty_unit,
      component_serials: (selectedBOM.components || []).map(c => ({
        bom_component_id: c.id,
        name: c.name,
        serial_number: '',
        warranty_period: c.warranty_period,
        warranty_unit: c.warranty_unit
      }))
    }));
  };

  const updateCompSerial = (idx, sn) => {
    const next = [...form.component_serials];
    next[idx].serial_number = sn;
    set('component_serials', next);
  };

  const save = async () => {
    if (!form.name) return toast.error('Vehicle Number is required');
    if (!form.bom_id) return toast.error('Model choice is required');
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null };
      if (isNew) {
        const r = await api.post('/warranty/products', payload);
        toast.success('Created'); navigate(`/warranty/products/${r.data.id}`);
      } else {
        await api.put(`/warranty/products/${id}`, payload);
        toast.success('Updated'); setRecentlySaved(true); setTimeout(() => setRecentlySaved(false), 3000);
      }
    } catch(e) { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const saveTab = async (t) => {
    if (t.id) await api.put(`/studio/layout/warranty/tabs/${t.id}`, t);
    else await api.post('/studio/layout/warranty/tabs', { ...t, sort_order: tabs.length });
    loadTabs(); setTabModal(null);
  };
  const deleteTab = async (id) => {
    await api.delete(`/studio/layout/warranty/tabs/${id}`);
    loadTabs(); setDeleteConfirm(null); setActiveTab(0);
  };
  const saveField = async (f) => {
    if (f.id) await api.put(`/studio/layout/warranty/fields/${f.id}`, f);
    else await api.post('/studio/layout/warranty/fields', { ...f, tab_id: fieldModal.tabId });
    loadTabs(); setFieldModal(null);
  };
  const deleteField = async (id) => {
    await api.delete(`/studio/layout/warranty/fields/${id}`);
    loadTabs(); setDeleteConfirm(null);
  };

  if (loading) return <Layout title="Loading..."><Loader/></Layout>;
  const currentTab = tabs[activeTab];

  return (
    <Layout title={isNew ? 'New Registration' : `Vehicle: ${form.name}`}>
      {/* TOOLBAR */}
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/warranty/products')}><ArrowLeft size={16}/> Back</button>
        <div style={{ flex: 1, display: 'flex', gap: 6, margin: '0 20px' }}>
          {stages.map(s => (
            <div key={s.id} onClick={() => isAdmin && set('stage_id', s.id)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 100, fontSize: 10, fontWeight: 800, textAlign: 'center', cursor: isAdmin ? 'pointer' : 'default',
              background: form.stage_id === s.id ? s.color : s.color + '15', color: form.stage_id === s.id ? '#fff' : s.color, transition: 'all 0.2s',
              border: `1px solid ${form.stage_id === s.id ? s.color : 'transparent'}`
            }}>{s.name}</div>
          ))}
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 8 }}>
          {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setEditLayout(!editLayout)}><Settings size={14}/> {editLayout ? 'Done' : 'Layout'}</button>}
          <button className="btn btn-primary" onClick={save} disabled={saving || recentlySaved}>
            {recentlySaved ? <Check size={14}/> : <Save size={14}/>} {recentlySaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
        {/* LEFT COLUMN: PRIMARY FORMS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* VEHICLE CORE CARD */}
          <div className="card" style={{ padding: 20 }}>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Vehicle Number *</label>
                  <input className="form-input fw-800" value={form.name} onChange={e => set('name', e.target.value.toUpperCase())} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">KIT Number</label>
                  <input className="form-input" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Model / BOM *</label>
                  <select className="form-select fw-600" value={form.bom_id} onChange={e => handleBOMChange(e.target.value)}>
                    <option value="">— Select Model —</option>
                    {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Warranty</label>
                  <input className="form-input" type="number" value={form.warranty_period} onChange={e => set('warranty_period', parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                   <label className="form-label">Unit</label>
                   <select className="form-select" value={form.warranty_unit} onChange={e => set('warranty_unit', e.target.value)}>
                     <option value="months">Months</option>
                     <option value="years">Years</option>
                   </select>
                </div>
             </div>
          </div>

          {/* STUDIO TABS & FIELDS */}
          <div style={{ width: '100%' }}>
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
              {editLayout && <button className="btn btn-ghost btn-sm" onClick={() => setTabModal({})}><Plus size={13}/> Tab</button>}
            </div>

            {currentTab && (
              <div className="card shadow-none" style={{ borderTop: 'none', background: 'transparent', padding: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {(currentTab.fields || []).filter(f => isVisible(f, form.custom_data)).map(f => (
                    <div key={f.id} style={{ gridColumn: colSpan[f.width]||'1/-1', position:'relative' }}>
                      <label className="form-label">{f.field_label}</label>
                      <FieldInput field={f} value={form.custom_data[f.field_name]} onChange={v => setCustom(f.field_name, v)} />
                      {editLayout && (
                        <div style={{ position:'absolute', top:0, right:0, display:'flex', gap:4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>setFieldModal({field:f, tabId: currentTab.id})}><Pencil size={11}/></button>
                          <button className="btn btn-danger btn-sm" onClick={()=>setDeleteConfirm({type:'field',id:f.id,name:f.field_label})}><Trash2 size={11}/></button>
                        </div>
                      )}
                    </div>
                  ))}
                  {editLayout && (
                    <div style={{ gridColumn: '1/-1', marginTop: 10 }}>
                       <button className="btn btn-ghost btn-sm" onClick={() => setFieldModal({ field: { ...emptyField, sort_order: (currentTab.fields||[]).length }, tabId: currentTab.id })}>
                         <Plus size={14}/> Add Field
                       </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: HIGH-DENSITY REGISTRY (VERTICAL STACK) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
           <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 8 }}>
                  <div style={{ width:4, height:20, background:'var(--green)', borderRadius:2 }} />
                  <span className="fw-900 size-14 uppercase letter-spacing-1 color-text1">
                    {form.title || 'Warranty Product Record'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div className="fw-700 size-11 uppercase text-muted">S/N: <span className="text-normal color-text1">{form.serial_number || '—'}</span></div>
                  <div className="fw-700 size-11 uppercase text-muted">WTY: <span className="text-normal color-text1">{form.warranty_period} {form.warranty_unit?.toUpperCase()}</span></div>
                </div>
              </div>

              {/* Component List */}
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:8, borderBottom:'1px dashed var(--border)', marginBottom:10 }}>
                  <span className="size-9 fw-900 text-muted uppercase letter-spacing-1">Sub-Component</span>
                  <div style={{ display:'flex', gap:24 }}>
                    <span className="size-9 fw-900 text-muted uppercase letter-spacing-1">Serial</span>
                    <span className="size-9 fw-900 text-muted uppercase letter-spacing-1">Wty</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {form.component_serials.length > 0 ? (
                    form.component_serials.map((c, idx) => (
                      <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--bg3)', paddingBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div className="size-11 fw-700 color-text2 mb-1">{c.name}</div>
                          <input className="form-input" style={{ padding: '4px 8px', fontSize: 11, height: 28 }} placeholder="Assign Serial..." value={c.serial_number} onChange={e => updateCompSerial(idx, e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
                          <span className="size-11 text-muted fw-700">{c.warranty_period}{c.warranty_unit?.substring(0, 1)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="size-11 text-muted italic">No linked components yet.</div>
                  )}
                </div>
              </div>

              {/* Other Details - Registry Style */}
              <div style={{ padding: 20 }}>
                <div className="size-10 fw-900 text-success uppercase mb-3 letter-spacing-1" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 5 }}>Registry Metadata</div>
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
                      <div className="size-9 text-muted fw-900 mb-1 uppercase letter-spacing-1">{d.l}</div>
                      <div className="size-12 fw-800 color-text1" style={{ wordBreak: 'break-word' }}>{form.custom_data?.[d.k] || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
           </div>
        </div>
      </div>

      {tabModal && <TabModal initial={tabModal} onSave={saveTab} onClose={()=>setTabModal(null)} />}
      {fieldModal && <FieldModal initial={fieldModal.field} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={()=>setFieldModal(null)} />}
      {deleteConfirm && <Confirm message={`Delete ${deleteConfirm.name}?`} onConfirm={() => {
        if (deleteConfirm.type === 'tab') deleteTab(deleteConfirm.id);
        else deleteField(deleteConfirm.id);
      }} onCancel={()=>setDeleteConfirm(null)} />}
    </Layout>
  );
}
