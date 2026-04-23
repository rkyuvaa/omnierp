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
import { ArrowLeft, Save, Plus, Pencil, Trash2, Settings, Upload, Download, Eye, X, FileText, Check, ChevronLeft, ChevronRight, Car, Search as SearchIcon, Bell } from 'lucide-react';
import SubFormSection from '../crm/SubFormSection';

const empty = { customer_name:'', email:'', phone:'', vehicle_number:'', vehicle_make:'', vehicle_model:'', vehicle_year: '', product_id:null, problem_description:'', notes:'', stage_id:'', staff_id:'', custom_data:{} };
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
  const [activities, setActivities] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [actType, setActType] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actDue, setActDue] = useState('');
  const [actTypeModal, setActTypeModal] = useState(false);
  const [fieldModal, setFieldModal] = useState(null);
  const [tabModal, setTabModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const loadTabs = useCallback(() => api.get('/studio/layout/service/tabs').then(r => setTabs(r.data)), []);
  const loadStageRules = useCallback(() => api.get('/studio/layout/service/stage-rules').then(r => setStageRules(r.data)), []);
  const loadActivityTypes = useCallback(() => api.get('/crm/activity-types').then(r => { setActivityTypes(r.data); setActType(t => t || (r.data[0]?.name || '')); }).catch(()=>{}), []);
  const [nav, setNav] = useState({ prev: null, next: null });
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleResults, setVehicleResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const [kitDetail, setKitDetail] = useState(null);

  useEffect(() => {
    loadTabs();
    loadStageRules();
    loadActivityTypes();
    if (!isNew) {
      setLoading(true);
      api.get(`/service/${id}`).then(async r => {
        const data = { ...empty, ...r.data, custom_data: r.data.custom_data || {} };
        
        // Fetch linked product if ID exists
        if (data.product_id) {
          try {
            const pRes = await api.get(`/warranty/products/${data.product_id}`);
            data.linked_product = pRes.data;
          } catch (e) { console.error("Could not load linked product details", e); }
        }
        
        setForm(data);
        setActivities(r.data.activities || []);
        setChangeLogs(r.data.change_logs || []);
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
  useEffect(() => {
    const handleClickOutside = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (vehicleSearch.length >= 4) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        api.get(`/warranty/products?q=${vehicleSearch}`).then(r => {
          setVehicleResults(r.data.items || r.data || []);
          setIsSearching(false);
          setShowResults(true);
        }).catch(() => setIsSearching(false));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setVehicleResults([]);
      setShowResults(false);
    }
  }, [vehicleSearch]);

  const selectVehicle = async (v) => {
    // Extract from product custom_data with fuzzy matching if needed
    const cd = v.custom_data || {};
    const find = (keys) => {
      for (let k of keys) {
        if (cd[k]) return cd[k];
        const found = Object.keys(cd).find(x => {
           const normalizedX = x.toLowerCase().replace(/[^a-z0-9]/g, '');
           const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
           return normalizedX === normalizedK || normalizedX.includes(normalizedK) || normalizedK.includes(normalizedX);
        });
        if (found) return cd[found];
      }
      return '';
    };

    const vNum = v.vehicle_number || v.name || '';
    const vModel = v.model || v.vehicle_model || v.title || '';
    const vYear = v.year || v.vehicle_year || find(['year', 'vehicle_year', 'model_year', 'mfg_year']) || '';
    const cName = v.customer_name || find(['customer_name', 'name', 'client']) || '';
    const cPhone = v.phone || find(['phone', 'mobile', 'contact']) || '';
    const vInv = v.invoice_number || find(['invoice', 'bill']) || '';

    setForm(f => ({ 
      ...f, 
      product_id: v.id, 
      product_serial: v.serial_number || '',
      vehicle_number: vNum, 
      vehicle_model: vModel,
      vehicle_year: vYear,
      customer_name: cName || f.customer_name,
      phone: cPhone || f.phone,
      invoice_number: vInv || f.invoice_number,
      linked_product: v
    }));
    setVehicleSearch('');
    setShowResults(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Strictly define allowed fields to prevent 500 error from extra frontend data
      const allowed = [
        'customer_id', 'customer_name', 'phone', 'contact_name', 'contact_number',
        'invoice_number', 'vehicle_year', 'delivery_date', 'vehicle_number', 
        'vehicle_make', 'vehicle_model', 'product_id', 
        'problem_description', 'stage_id', 'staff_id', 'notes', 'custom_data'
      ];
      
      const payload = {};
      allowed.forEach(k => { if (form[k] !== undefined) payload[k] = form[k]; });
      
      // Ensure IDs are null if empty
      payload.stage_id = payload.stage_id || null;
      payload.staff_id = payload.staff_id || null;
      payload.product_id = payload.product_id || null;

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

  const actTypeMap = useMemo(() => activityTypes.reduce((acc, t) => ({ ...acc, [t.name]: t }), {}), [activityTypes]);
  const addActivity = async () => {
    if (!actDesc.trim()) return;
    try {
      await api.post('/crm/activities', { module:'service', record_id:id, type:actType, description:actDesc, due_date:actDue||null });
      setActDesc(''); setActDue('');
      api.get(`/service/${id}`).then(r => { setActivities(r.data.activities||[]); setChangeLogs(r.data.change_logs||[]); });
    } catch(e) { toast.error("Failed to add activity"); }
  };
  const markDone = async (aid) => {
    await api.put(`/crm/activities/${aid}`, { done: true });
    setActivities(a => a.map(x => x.id===aid ? {...x, done:true} : x));
  };

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
          <button className="btn btn-ghost" style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 700, border: '1px solid var(--border)' }}>
            <FileText size={16} /> Job Card
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
      
      {!isNew && stages.length > 0 && (
        <div style={{ marginBottom: 20, width: '100%', marginTop: -4 }}>
          <div style={{ display: 'flex', gap: 10, width: '100%', padding: '4px 0' }}>
            {stages.map(s => {
              const isCurrent = form && String(form.stage_id) === String(s.id);
              const stageColor = s.color || '#6366f1';
              return (
                <div key={s.id} onClick={() => isAdmin && set('stage_id', s.id)}
                  style={{
                    flex: 1, padding: '10px 4px', borderRadius: 50, textAlign: 'center', fontSize: 9.5, fontWeight: 800,
                    cursor: isAdmin ? 'pointer' : 'default', textTransform: 'uppercase', letterSpacing: '0.5px',
                    background: isCurrent ? stageColor : 'rgba(0,0,0,0.03)',
                    color: isCurrent ? '#fff' : stageColor,
                    border: `1.5px solid ${isCurrent ? 'transparent' : (s.color ? s.color + '33' : 'var(--border)')}`,
                    opacity: isCurrent ? 1 : 0.7, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isCurrent ? `0 4px 15px ${stageColor}55` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 34
                  }}>
                  {s.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="detail-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="detail-section-title">Record Details</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
               <div className="form-group" ref={searchRef} style={{ position: 'relative' }}>
                 <label className="form-label" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Linked Vehicle (Last 4 Digits)</label>
                 <div style={{ display: 'flex', gap: 8 }}>
                   <div className="search-input-wrapper" style={{ flex: 1, position: 'relative' }}>
                     <Car size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                     <input 
                        className="form-input" 
                        style={{ paddingLeft: 36, background: 'var(--bg2)', color: '#000', fontWeight: 600, border: '1px solid var(--border)' }} 
                        placeholder={form.vehicle_number || "Search vehicle..."} 
                        value={vehicleSearch} 
                        onChange={e => { setVehicleSearch(e.target.value); setShowResults(true); }} 
                        onFocus={() => setShowResults(true)}
                     />
                     {form.product_id && (
                       <button 
                         onClick={() => setForm(f => ({ ...f, product_id: null, vehicle_number: '', vehicle_model: '', vehicle_year: '', customer_name: '', phone: '', invoice_number: '', warranty_info: '', product_stage_name: null }))}
                         style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.5 }}
                       >
                         <X size={14} />
                       </button>
                     )}
                   </div>
                 </div>

                 {showResults && (vehicleResults.length > 0 || isSearching) && (
                   <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 250, overflowY: 'auto' }}>
                     {isSearching && <div style={{ padding: 12, fontSize: 12, color: 'var(--text2)' }}>Searching...</div>}
                     {vehicleResults.map(v => {
                       const vNum = v.vehicle_number || v.name || 'Unknown';
                       const vModel = v.model || v.vehicle_model || v.title || 'No Model';
                       const cName = v.customer_name || 'No Customer';
                       return (
                         <div key={v.id} onClick={() => selectVehicle(v)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} className="search-result-item">
                           <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{vNum}</div>
                           <div style={{ fontSize: 11, color: 'var(--text2)' }}>{cName} • {vModel}</div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>

                <div className="form-group">
                  <label className="form-label text-xs uppercase fw-800">KIT Number</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        className="form-input" 
                        style={{ background: 'var(--bg2)', cursor: form.product_id ? 'pointer' : 'text', border: '1px solid var(--border)', paddingRight: form.product_id ? 80 : 12 }} 
                        value={form.product_serial || ''} 
                        onChange={e => set('product_serial', e.target.value)} 
                        readOnly={!!form.product_id}
                        onClick={() => {
                          if (form.product_id && form.linked_product) {
                            setKitDetail(form.linked_product);
                          }
                        }}
                      />
                      {form.product_id && (
                        <button 
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (form.linked_product) {
                              setKitDetail(form.linked_product);
                            } else if (form.product_id) {
                              try {
                                const res = await api.get(`/warranty/products/${form.product_id}`);
                                if (res.data) {
                                  setKitDetail(res.data);
                                  setForm(f => ({ ...f, linked_product: res.data }));
                                }
                              } catch (err) {
                                console.error("Could not load kit details", err);
                                toast.error("Failed to load component details");
                              }
                            } else {
                              toast.warning("No product linked to this record");
                            }
                          }}
                          style={{ 
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', 
                            fontSize: 10, color: '#fff', fontWeight: 800, background: 'var(--accent)',
                            border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          DETAILS <ChevronRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>

                <div className="form-group">
                  <label className="form-label text-xs uppercase fw-800">Installed KIT</label>
                    <input 
                      className="form-input" 
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} 
                      value={form.vehicle_model || ''} 
                      onChange={e => set('vehicle_model', e.target.value)} 
                      readOnly={!!form.product_id}
                    />
                </div>
              </div>

              {/* Second Row for Contact Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label text-xs uppercase fw-800">Contact Name</label>
                  <input 
                    className="form-input" 
                    placeholder="Enter contact name..."
                    value={form.contact_name || ''} 
                    onChange={e => set('contact_name', e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs uppercase fw-800">Contact Number</label>
                  <input 
                    className="form-input" 
                    placeholder="Enter contact number..."
                    value={form.contact_number || ''} 
                    onChange={e => set('contact_number', e.target.value)} 
                  />
                </div>
                <div className="form-group" /> {/* Empty group for alignment if needed, or leave blank */}
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

        {/* RIGHT SIDEBAR */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
              Customer & Warranty
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10 }}>Customer Name</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }}>
                  {form.customer_name || '—'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 10 }}>Phone</label>
                  <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600 }}>
                    {form.phone || '—'}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 10 }}>Invoice</label>
                  <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600 }}>
                    {form.invoice_number || '—'}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10 }}>Installed KIT</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 700 }}>
                  {form.vehicle_model || '—'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10 }}>Warranty</label>
                <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                  {form.warranty_info || '—'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10 }}>Warranty Stage</label>
                <div>
                  {form.product_stage_name ? <Badge color={form.product_stage_color}>{form.product_stage_name}</Badge> : <span className="text-muted">—</span>}
                </div>
              </div>
            </div>
          </div>

          {!isNew && (
            <div className="card" style={{ maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span className="card-title" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}><Bell size={14}/> Activity</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                   <input className="form-input" style={{ fontSize:11, flex:1 }} placeholder="Write a note..." value={actDesc} onChange={e => setActDesc(e.target.value)} onKeyDown={e => e.key==='Enter'&&addActivity()}/>
                   <button className="btn btn-primary btn-sm" onClick={addActivity}><Plus size={13}/></button>
                </div>
              </div>
              {activities.length > 0 && (
                <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                  {activities.map(a => (
                    <div key={a.id} style={{ display:'flex', gap:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:8, opacity:a.done?0.45:1, alignItems:'flex-start' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:500 }}>{a.description}</div>
                        {a.due_date && !a.done && <div style={{ fontSize:9, color:'var(--amber)', marginTop:2 }}>Due: {new Date(a.due_date).toLocaleDateString()}</div>}
                      </div>
                      {!a.done && <button className="btn btn-ghost btn-sm" style={{ padding:4 }} onClick={() => markDone(a.id)}><Check size={11}/></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isNew && (
            <div className="card" style={{ maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
              <div className="card-header" style={{ marginBottom:8 }}>
                <span className="card-title" style={{ fontSize:12 }}>Change Log</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {changeLogs.length === 0 && <p className="text-muted text-sm">No changes yet.</p>}
                {changeLogs.map(log => {
                   const userName = log.user || log.user_name || 'System';
                   const formatVal = (v) => { if (v === null || v === undefined) return '—'; if (typeof v === 'object') return JSON.stringify(v); return String(v); };
                   const renderChanges = () => {
                     if (log.action==='CREATE') return <div>Created by {userName}</div>;
                     const lines = [];
                     for (const [key, val] of Object.entries(log.changes || {})) {
                       if (val && typeof val==='object' && 'from' in val)
                         lines.push(<div key={key}>{userName} changed {key}: {formatVal(val.from)} → {formatVal(val.to)}</div>);
                     }
                     return lines.length ? lines : <div>{userName} updated record</div>;
                   };
                   return (
                    <div key={log.id} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--text2)' }}>
                       {renderChanges()}
                       <div style={{ fontSize:9, color:'var(--text3)', marginTop:2 }}>{log.created_at?.slice(0,16).replace('T',' ')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
      {kitDetail && (
        <Modal 
          title={`${kitDetail.title} — ${kitDetail.serial_number} — ${kitDetail.name}`} 
          onClose={() => setKitDetail(null)}
        >
          <div style={{ padding: 20 }}>
             <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>Installed Components</div>
             </div>
             
             {kitDetail.component_serials && kitDetail.component_serials.length > 0 ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {kitDetail.component_serials.map((c, idx) => (
                   <div key={idx} style={{ 
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                     padding: '12px 16px', background: 'var(--bg2)', borderRadius: 10,
                     border: '1px solid var(--border)'
                   }}>
                     <span style={{ fontWeight: 600 }}>{c.name}</span>
                     <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{c.serial_number || '— No Serial —'}</span>
                   </div>
                 ))}
               </div>
             ) : (
               <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                 No components registered for this KIT.
               </div>
             )}
          </div>
        </Modal>
      )}
    </Layout>
  );
}
