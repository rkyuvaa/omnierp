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
import { ArrowLeft, Save, Plus, Pencil, Trash2, Package, Settings, Check } from 'lucide-react';

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
  
  const handleBOMChange = (bomId) => {
    const selectedBOM = boms.find(b => b.id === parseInt(bomId));
    if (!selectedBOM) {
      setForm(f => ({ ...f, bom_id: '', component_serials: [] }));
      return;
    }
    
    // Auto-load components from BOM
    const newComponents = (selectedBOM.components || []).map(c => ({
      bom_component_id: c.id,
      name: c.name,
      serial_number: '',
      warranty_period: c.warranty_period,
      warranty_unit: c.warranty_unit
    }));
    
    setForm(f => ({ 
      ...f, 
      bom_id: parseInt(bomId), 
      title: selectedBOM.name,
      warranty_period: selectedBOM.warranty_period || f.warranty_period,
      warranty_unit: selectedBOM.warranty_unit || f.warranty_unit,
      component_serials: newComponents 
    }));
  };

  const updateCompSerial = (idx, sn) => {
    const next = [...form.component_serials];
    next[idx].serial_number = sn;
    set('component_serials', next);
  };

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
    if (!form.name) return toast.error('Vehicle Number is required');
    if (!form.bom_id) return toast.error('Please select a BOM / Model');
    
    setSaving(true);
    try {
      const payload = { ...form, stage_id: form.stage_id || null, bom_id: form.bom_id || null };
      if (isNew) {
        const r = await api.post('/warranty/products', payload);
        toast.success('✓ Success');
        navigate(`/warranty/products/${r.data.id}`);
      } else {
        await api.put(`/warranty/products/${id}`, payload);
        toast.success('✓ Saved');
        setRecentlySaved(true);
        setTimeout(() => setRecentlySaved(false), 3000);
      }
    } catch(e) {
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
        field_name: payload.field_name, stage_id: parseInt(stageRule),
        condition_operator: stageRuleOp, condition_value: stageRuleOp === 'equals' ? stageRuleVal : null
      });
    }
    toast.success('Field saved'); setFieldModal(null); loadTabs(); loadStageRules();
  };

  const deleteField = async (fid) => {
    await api.delete(`/studio/layout/fields/${fid}`);
    toast.success('Deleted'); setDeleteConfirm(null); loadTabs();
  };

  if (loading) return <Layout title="Product"><Loader/></Layout>;
  const currentTab = tabs[activeTab];

  return (
    <Layout title={isNew ? 'New Entry' : `Vehicle: ${form.name}`}>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={()=>navigate('/warranty/products')}><ArrowLeft size={15}/> Back</button>
        {!isNew && stages.length > 0 && (
          <div style={{ display: "flex", gap: 6, width: "100%", marginLeft: 16 }}>
            {stages.map((s) => (
              <div key={s.id} onClick={() => isAdmin && set('stage_id', s.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "8px 12px", borderRadius: "100px", flex: 1, textAlign: "center",
                  cursor: isAdmin ? "pointer" : "default", transition: "all 0.2s",
                  background: form.stage_id === s.id ? s.color : s.color + "15",
                  color: form.stage_id === s.id ? "#fff" : s.color,
                  fontSize: "11px", fontWeight: 800, textTransform: "uppercase",
                  boxShadow: form.stage_id === s.id ? "0 4px 12px " + s.color + "60" : "none",
                  border: "1px solid " + (form.stage_id === s.id ? s.color : "transparent"),
                  minWidth: 0
                }}
              >
                {s.name}
              </div>
            ))}
          </div>
        )}
        <div className="toolbar-right" style={{ display:'flex', gap:8, marginLeft: 'auto' }}>
          {isAdmin && ( <button className="btn btn-ghost btn-sm" onClick={()=>setEditLayout(e=>!e)}><Settings size={14}/> {editLayout?'Exit Layout':'Edit Layout'}</button> )}
          <button className="btn btn-primary" onClick={save} disabled={saving || recentlySaved} style={{ background: recentlySaved ? 'var(--green)' : 'var(--accent)' }}>
            {recentlySaved ? <Check size={14}/> : <Save size={14}/>} {recentlySaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 450px', gap:20 }}>
        
        {/* Left Column: All Main Content matched to same width */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          
          {/* Condensed Vehicle Info Card */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header"><span className="card-title">VEHICLE INFORMATION</span></div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 12px' }}>
              <div className="form-group">
                <label className="form-label">VEHICLE NUMBER *</label>
                <input className="form-input fw-700" value={form.name} onChange={e=>set('name', e.target.value.toUpperCase())} placeholder="KA01.." />
              </div>
              <div className="form-group">
                <label className="form-label">KIT Number</label>
                <input className="form-input" value={form.serial_number} onChange={e=>set('serial_number', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">MODEL (BOM) *</label>
                <select className="form-input fw-600" value={form.bom_id} onChange={e=>handleBOMChange(e.target.value)}>
                  <option value="">-- BOM --</option>
                  {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">WARRANTY (PRD/UNIT)</label>
                <div style={{ display:'flex', gap:4 }}>
                  <input className="form-input" type="number" value={form.warranty_period} onChange={e=>set('warranty_period', parseInt(e.target.value)||0)} />
                  <select className="form-input" value={form.warranty_unit} onChange={e=>set('warranty_unit', e.target.value)}>
                    <option value="months">Mo</option>
                    <option value="years">Yr</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Shrinked Custom Tabs (Now inside the left column) */}
          <div>
            <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid var(--border)', marginBottom: 0 }}>
              {tabs.map((t,i) => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:2 }}>
                  <button onClick={()=>setActiveTab(i)} style={{
                    padding:'8px 18px', border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                    background:'transparent', marginBottom:-2, transition:'all 0.15s',
                    borderBottom:activeTab===i?'2px solid var(--accent)':'2px solid transparent',
                    color:activeTab===i?'var(--accent)':'var(--text2)'
                  }}>{t.name}</button>
                  {editLayout && <>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setTabModal(t)}><Pencil size={11}/></button>
                    <button className="btn btn-danger btn-sm" onClick={()=>setDeleteConfirm({type:'tab',id:t.id,name:t.name})}><Trash2 size={11}/></button>
                  </>}
                </div>
              ))}
              {editLayout && <button className="btn btn-ghost btn-sm" onClick={()=>setTabModal({})}><Plus size={13}/> Tab</button>}
            </div>
            {currentTab && (
              <div className="card" style={{ borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {(currentTab.fields || []).filter(f => isVisible(f, form.custom_data)).map(f => (
                    <div key={f.id} style={{ gridColumn: colSpan[f.width] || '1/-1', position:'relative' }}>
                      {f.field_type !== 'boolean' && <label className="form-label">{f.field_label}</label>}
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
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 8, border: '1px dashed var(--border)', borderRadius: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setFieldModal({field: {...emptyField, sort_order: (currentTab.fields||[]).length}, tabId: currentTab.id})}><Plus size={14}/> Field</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tracking Card remains on the right */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header"><span className="card-title">TRACKING</span></div>
          <div style={{ padding: '0 10px 10px' }}>
            {form.component_serials.length > 0 ? (
              form.component_serials.map((c, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'120px 1fr 80px', alignItems:'center', gap:10, padding:'10px 0', borderBottom: idx < form.component_serials.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="fw-600 size-12 truncate" title={c.name}>{c.name}</div>
                  <input className="form-input" style={{ height:30, fontSize:12, background:'var(--bg1)' }} 
                    value={c.serial_number} 
                    onChange={e => updateCompSerial(idx, e.target.value)} 
                    placeholder="S/N" />
                  <div className="text-muted size-11 text-right">{c.warranty_period} {c.warranty_unit.substring(0,2)}</div>
                </div>
              ))
            ) : (
              <p className="size-12 text-muted text-center py-4">Select model to track parts</p>
            )}
          </div>
        </div>

      </div>

      {tabModal && <TabModal initial={tabModal} onSave={saveTab} onClose={()=>setTabModal(null)} />}
      {fieldModal && <FieldModal initial={fieldModal.field} tabs={tabs} stages={stages} stageRules={stageRules} onSave={saveField} onClose={()=>setFieldModal(null)} />}
      {deleteConfirm && <Confirm message={`Delete ${deleteConfirm.name}?`} onConfirm={deleteConfirm.type==='tab'?()=>deleteTab(deleteConfirm.id):()=>deleteField(deleteConfirm.id)} onCancel={()=>setDeleteConfirm(null)} />}
    </Layout>
  );
}
