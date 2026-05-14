import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Settings, Clock, Calendar, Gift, Wifi, X, Plus, Trash2, RefreshCw, Upload, FileText, Download } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function HRConfigurations() {
  const [tab, setTab] = useState('shifts');
  const [shifts, setShifts] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [machines, setMachines] = useState([]);
  const [salaryTemplates, setSalaryTemplates] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [importFile, setImportFile] = useState(null);

  useEffect(() => {
    api.get('/branches/').then(r => setBranches(r.data));
    fetchTab();
  }, [tab, year]);

  async function fetchTab() {
    setLoading(true);
    try {
      if (tab === 'shifts') { const r = await api.get('/hr/shifts/'); setShifts(r.data); }
      else if (tab === 'leave') { const r = await api.get('/hr/leave/types'); setLeaveTypes(r.data); }
      else if (tab === 'holidays') { const r = await api.get('/hr/holidays/', { params: { year } }); setHolidays(r.data); }
      else if (tab === 'biometric') { const r = await api.get('/hr/biometric/machines'); setMachines(r.data); }
      else if (tab === 'salary_templates') { const r = await api.get('/hr/salary-templates/'); setSalaryTemplates(r.data); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  function openModal(type, item = null) {
    setModal(type);
    if (item) setForm({ ...item });
    else {
      if (type === 'shift') setForm({ working_days: ['Mon','Tue','Wed','Thu','Fri','Sat'], grace_minutes: 15, half_day_hours: 4 });
      else if (type === 'leave') setForm({ is_paid: true, carry_forward: false, max_days_per_year: 12 });
      else if (type === 'holiday') setForm({ holiday_type: 'national', year });
      else if (type === 'salary_template') setForm({ components: [{ name: 'Basic', type: 'earning', is_percentage: true, value: 50 }] });
      else setForm({ port: 4370 });
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (modal === 'shift') {
        if (form.id) await api.put(`/hr/shifts/${form.id}`, form);
        else await api.post('/hr/shifts/', form);
      } else if (modal === 'leave') {
        if (form.id) await api.put(`/hr/leave/types/${form.id}`, form);
        else await api.post('/hr/leave/types', form);
      } else if (modal === 'holiday') {
        if (form.id) await api.put(`/hr/holidays/${form.id}`, form);
        else await api.post('/hr/holidays/', form);
      } else if (modal === 'biometric') {
        if (form.id) await api.put(`/hr/biometric/machines/${form.id}`, form);
        else await api.post('/hr/biometric/machines', form);
      } else if (modal === 'salary_template') {
        if (form.id) await api.put(`/hr/salary-templates/${form.id}`, form);
        else await api.post('/hr/salary-templates/', form);
      }
      toast.success('Saved successfully');
      setModal(null);
      fetchTab();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteItem(type, id) {
    if (!confirm('Are you sure you want to delete this?')) return;
    try {
      if (type === 'shift') await api.delete(`/hr/shifts/${id}`);
      else if (type === 'leave') await api.delete(`/hr/leave/types/${id}`);
      else if (type === 'holiday') await api.delete(`/hr/holidays/${id}`);
      else if (type === 'biometric') await api.delete(`/hr/biometric/machines/${id}`);
      else if (type === 'salary_template') await api.delete(`/hr/salary-templates/${id}`);
      toast.success('Deleted');
      fetchTab();
    } catch { toast.error('Delete failed'); }
  }

  async function syncMachine(id) {
    try {
      await api.post(`/hr/biometric/sync/${id}`);
      toast.success('Sync started in background');
      setTimeout(fetchTab, 3000);
    } catch { toast.error('Sync failed'); }
  }

  async function testConnection() {
    if (!form.ip_address) return toast.error('Enter IP address first');
    setTesting(true);
    try {
      const res = await api.post('/hr/biometric/test-connection', form);
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
      }
    } catch { toast.error('Connection test failed'); }
    finally { setTesting(false); }
  }

  async function handleImportHolidays() {
    if (!importFile) return toast.error('Please select a file');
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const res = await api.post('/hr/holidays/import/excel', formData);
      toast.success(`Imported ${res.data.imported} holidays.`);
      if (res.data.errors?.length > 0) {
        console.error('Import errors:', res.data.errors);
        toast.error(`There were ${res.data.errors.length} errors. Check console.`);
      }
      setShowImportModal(false);
      setImportFile(null);
      fetchTab();
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
    finally { setImporting(false); }
  }

  async function downloadHolidayTemplate() {
    try {
      const res = await api.get('/hr/holidays/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'holiday_import_template.xlsx';
      a.click();
    } catch { toast.error('Failed to download template'); }
  }

  const tabStyle = (active) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)',
    display: 'flex', alignItems: 'center', gap: 6,
  });

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' };

  return (
    <Layout title="HR Configurations">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button style={tabStyle(tab === 'shifts')} onClick={() => setTab('shifts')}><Clock size={14} /> Shifts</button>
          <button style={tabStyle(tab === 'leave')} onClick={() => setTab('leave')}><Gift size={14} /> Leave Types</button>
          <button style={tabStyle(tab === 'holidays')} onClick={() => setTab('holidays')}><Calendar size={14} /> Holidays</button>
          <button style={tabStyle(tab === 'biometric')} onClick={() => setTab('biometric')}><Wifi size={14} /> Biometric Machines</button>
          <button style={tabStyle(tab === 'salary_templates')} onClick={() => setTab('salary_templates')}><FileText size={14} /> Salary Templates</button>
        </div>

        {/* SHIFTS */}
        {tab === 'shifts' && (
          <Section title="Shifts" onAdd={() => openModal('shift')}>
            {shifts.map(s => (
              <Card key={s.id}
                title={s.name}
                badge={s.is_active ? 'Active' : 'Inactive'}
                badgeColor={s.is_active ? '#22c55e' : '#94a3b8'}
                subtitle={`${s.start_time} – ${s.end_time} · Grace: ${s.grace_minutes} min · ${(s.working_days || []).join(', ')}`}
                extra={s.branch_name || 'All Branches'}
                onEdit={() => openModal('shift', s)}
                onDelete={() => deleteItem('shift', s.id)}
              />
            ))}
          </Section>
        )}

        {/* LEAVE TYPES */}
        {tab === 'leave' && (
          <Section title="Leave Types" onAdd={() => openModal('leave')}>
            {leaveTypes.map(t => (
              <Card key={t.id}
                title={`${t.name} (${t.code})`}
                badge={t.is_paid ? 'Paid' : 'Unpaid'}
                badgeColor={t.is_paid ? '#22c55e' : '#94a3b8'}
                subtitle={`${t.max_days_per_year} days/year · ${t.carry_forward ? `Carry forward up to ${t.carry_forward_max} days` : 'No carry forward'}`}
                onEdit={() => openModal('leave', t)}
                onDelete={() => deleteItem('leave', t.id)}
              />
            ))}
          </Section>
        )}

        {/* HOLIDAYS */}
        {tab === 'holidays' && (
          <Section title="Holiday Calendar" onAdd={() => openModal('holiday')}
            extra={
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowImportModal(true)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <Upload size={14} /> Import
                </button>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ ...inputStyle, width: 'auto', minWidth: 100 }}>
                  {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            }>
            {holidays.map(h => (
              <Card key={h.id}
                title={h.name}
                badge={h.holiday_type === 'national' ? 'National' : 'Company'}
                badgeColor={h.holiday_type === 'national' ? '#6366f1' : '#f59e0b'}
                subtitle={h.date}
                extra={h.branch_name || 'All Branches'}
                onEdit={() => openModal('holiday', h)}
                onDelete={() => deleteItem('holiday', h.id)}
              />
            ))}
          </Section>
        )}

        {/* BIOMETRIC MACHINES */}
        {tab === 'biometric' && (
          <Section title="Biometric Machines (eSSL)" onAdd={() => openModal('biometric')}>
            {machines.map(m => (
              <div key={m.id} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>IP: <strong>{m.ip_address}:{m.port}</strong> · {m.branch_name || 'All Branches'}</div>
                  {m.last_sync_at && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      Last sync: {new Date(m.last_sync_at).toLocaleString()} ·
                      <span style={{ color: m.last_sync_status === 'success' ? '#22c55e' : '#ef4444', fontWeight: 600 }}> {m.last_sync_status}</span>
                      {m.last_sync_count > 0 && ` · ${m.last_sync_count} records`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => syncMachine(m.id)} style={{ background: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <RefreshCw size={13} /> Sync Now
                  </button>
                  <button onClick={() => openModal('biometric', m)} style={{ background: 'var(--bg3)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                  <button onClick={() => deleteItem('biometric', m.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* SALARY TEMPLATES */}
        {tab === 'salary_templates' && (
          <Section title="Salary Templates" onAdd={() => openModal('salary_template')}>
            {salaryTemplates.map(t => (
              <Card key={t.id}
                title={t.name}
                badge={`${(t.components || []).length} components`}
                badgeColor="var(--accent)"
                subtitle={t.description || 'No description'}
                extra={(t.components || []).map(c => `${c.name}: ${c.value}${c.is_percentage ? '%' : '₹'}`).join(', ')}
                onEdit={() => openModal('salary_template', t)}
                onDelete={() => deleteItem('salary_template', t.id)}
              />
            ))}
          </Section>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, width: '100%', maxWidth: modal === 'salary_template' ? 600 : 480, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>
                {modal === 'shift' ? 'Shift Configuration' : 
                 modal === 'leave' ? 'Leave Type' : 
                 modal === 'holiday' ? 'Holiday' : 
                 modal === 'biometric' ? 'Biometric Machine' : 
                 'Salary Template'}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>

            {/* Shift Form */}
            {modal === 'shift' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Shift Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Branch</label>
                  <select value={form.branch_id || ''} onChange={e => setForm({ ...form, branch_id: e.target.value || null })} style={inputStyle}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Start Time</label><input type="time" value={form.start_time || ''} onChange={e => setForm({ ...form, start_time: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>End Time</label><input type="time" value={form.end_time || ''} onChange={e => setForm({ ...form, end_time: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Grace (minutes)</label><input type="number" value={form.grace_minutes || 15} onChange={e => setForm({ ...form, grace_minutes: parseInt(e.target.value) })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Half Day (hours)</label><input type="number" step="0.5" value={form.half_day_hours || 4} onChange={e => setForm({ ...form, half_day_hours: parseFloat(e.target.value) })} style={inputStyle} /></div>
                </div>
                <div>
                  <label style={labelStyle}>Working Days</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DAYS.map(d => (
                      <button key={d} onClick={() => {
                        const wd = form.working_days || [];
                        setForm({ ...form, working_days: wd.includes(d) ? wd.filter(x => x !== d) : [...wd, d] });
                      }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: (form.working_days || []).includes(d) ? 'var(--accent)' : 'var(--bg2)', color: (form.working_days || []).includes(d) ? '#fff' : 'var(--text2)' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Leave Type Form */}
            {modal === 'leave' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Leave Type Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Code</label><input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={inputStyle} placeholder="e.g. CL" /></div>
                </div>
                <div><label style={labelStyle}>Max Days Per Year</label><input type="number" step="0.5" value={form.max_days_per_year || 12} onChange={e => setForm({ ...form, max_days_per_year: parseFloat(e.target.value) })} style={inputStyle} /></div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={form.is_paid || false} onChange={e => setForm({ ...form, is_paid: e.target.checked })} /> Paid Leave
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={form.carry_forward || false} onChange={e => setForm({ ...form, carry_forward: e.target.checked })} /> Allow Carry Forward
                  </label>
                </div>
                {form.carry_forward && (
                  <div><label style={labelStyle}>Max Carry Forward Days</label><input type="number" value={form.carry_forward_max || 0} onChange={e => setForm({ ...form, carry_forward_max: parseFloat(e.target.value) })} style={inputStyle} /></div>
                )}
              </div>
            )}

            {/* Holiday Form */}
            {modal === 'holiday' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Holiday Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Date</label><input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Type</label>
                  <select value={form.holiday_type || 'national'} onChange={e => setForm({ ...form, holiday_type: e.target.value })} style={inputStyle}>
                    <option value="national">National Holiday</option>
                    <option value="company">Company Holiday</option>
                  </select></div>
                <div><label style={labelStyle}>Branch (leave blank for all)</label>
                  <select value={form.branch_id || ''} onChange={e => setForm({ ...form, branch_id: e.target.value || null })} style={inputStyle}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select></div>
              </div>
            )}

            {/* Biometric Form */}
            {modal === 'biometric' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Machine Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>IP Address</label><input value={form.ip_address || ''} onChange={e => setForm({ ...form, ip_address: e.target.value })} style={inputStyle} placeholder="192.168.1.100" /></div>
                  <div><label style={labelStyle}>Port</label><input type="number" value={form.port || 4370} onChange={e => setForm({ ...form, port: parseInt(e.target.value) })} style={inputStyle} /></div>
                </div>
                <div style={{ marginTop: 10, marginBottom: 10 }}>
                  <button onClick={testConnection} disabled={testing} type="button" className="btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
                    {testing ? <RefreshCw size={14} className="spin" /> : <Wifi size={14} />} {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                <div><label style={labelStyle}>Branch</label>
                  <select value={form.branch_id || ''} onChange={e => setForm({ ...form, branch_id: e.target.value || null })} style={inputStyle}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select></div>
              </div>
            )}

            {/* Salary Template Form */}
            {modal === 'salary_template' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Template Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Manager Slab" /></div>
                <div><label style={labelStyle}>Description</label><input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} /></div>
                
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Components</label>
                    <button onClick={() => setForm({ ...form, components: [...(form.components || []), { name: '', type: 'earning', is_percentage: true, value: 0 }] })}
                      style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {(form.components || []).map((comp, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                      <input placeholder="Name" value={comp.name} onChange={e => { const sc = [...form.components]; sc[idx].name = e.target.value; setForm({ ...form, components: sc }); }} style={inputStyle} />
                      <select value={comp.is_percentage ? 'true' : 'false'} onChange={e => { const sc = [...form.components]; sc[idx].is_percentage = e.target.value === 'true'; setForm({ ...form, components: sc }); }} style={inputStyle}>
                        <option value="true">% of Salary (CTC)</option>
                        <option value="false">Fixed ₹</option>
                      </select>
                      <input type="number" value={comp.value} onChange={e => { const sc = [...form.components]; sc[idx].value = parseFloat(e.target.value) || 0; setForm({ ...form, components: sc }); }} style={inputStyle} />
                      <button onClick={() => { const sc = form.components.filter((_, i) => i !== idx); setForm({ ...form, components: sc }); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(null)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 440, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Import Holidays</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ background: 'var(--bg2)', border: '2px dashed var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', marginBottom: 20 }}>
              <input type="file" accept=".xlsx" onChange={e => setImportFile(e.target.files[0])} id="holiday-import-file" style={{ display: 'none' }} />
              <label htmlFor="holiday-import-file" style={{ cursor: 'pointer' }}>
                <Upload size={30} style={{ color: 'var(--text3)', marginBottom: 10 }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>{importFile ? importFile.name : 'Click to select Excel file'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Only .xlsx files supported</div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <button onClick={downloadHolidayTemplate} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Download Sample Template
              </button>
            </div>
            
            <div style={{ background: 'var(--accent-dim)', padding: 12, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
                <FileText size={14} /> Expected Columns (Row 1):
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                name, date (YYYY-MM-DD), branch_id, holiday_type
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowImportModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={handleImportHolidays} disabled={importing} className="btn btn-primary" style={{ flex: 1 }}>{importing ? 'Importing...' : 'Start Import'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Section({ title, children, onAdd, extra }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {extra}
          <button onClick={onAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <Plus size={14} /> Add New
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children?.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No items yet. Click "Add New" to start.</div> : children}
      </div>
    </div>
  );
}

function Card({ title, badge, badgeColor, subtitle, extra, onEdit, onDelete }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, fontWeight: 700, background: `${badgeColor}20`, color: badgeColor }}>{badge}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{subtitle}</div>
        {extra && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{extra}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onEdit} style={{ background: 'var(--bg3)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit</button>
        <button onClick={onDelete} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}
