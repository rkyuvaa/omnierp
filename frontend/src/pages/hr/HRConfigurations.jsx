import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Settings, Clock, Calendar, Gift, Wifi, X, Plus, Trash2, RefreshCw, Upload, FileText, Download, GitBranch, Zap } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function HRConfigurations() {
  const [tab, setTab] = useState('shifts');
  const [shifts, setShifts] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [machines, setMachines] = useState([]);
  const [salaryTemplates, setSalaryTemplates] = useState([]);
  const [salaryComponents, setSalaryComponents] = useState([]);
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
  const [configs, setConfigs] = useState({});
  const [lopRules, setLopRules] = useState([]);
  const [compOffSettings, setCompOffSettings] = useState({ enabled: false, threshold_hours: 9.0, hours_per_day: 8.0, leave_type_id: null, expiry_months: null, activation_date: new Date().toISOString().split('T')[0] });
  const [savingCompOff, setSavingCompOff] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);

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
      else if (tab === 'salary_templates') {
        const [rt, rc] = await Promise.all([api.get('/hr/salary-templates/'), api.get('/hr/salary-components/')]);
        setSalaryTemplates(rt.data); setSalaryComponents(rc.data);
      }
      else if (tab === 'salary_components') { const r = await api.get('/hr/salary-components/'); setSalaryComponents(r.data); }
      else if (tab === 'salary_rules') { const r = await api.get('/hr/config/'); setConfigs(r.data); }
      else if (tab === 'lop_rules') {
        const [lr, lt] = await Promise.all([api.get('/hr/lop-rules/'), api.get('/hr/leave/types')]);
        setLopRules(lr.data); setLeaveTypes(lt.data.filter(t => t.is_active));
      }
      else if (tab === 'comp_off') {
        const [cs, lt] = await Promise.all([api.get('/hr/config/comp-off-setup'), api.get('/hr/leave/types')]);
        const d = cs.data;
        setCompOffSettings({
          enabled: d.comp_off_enabled || false,
          threshold_hours: d.comp_off_threshold_hours ?? 9.0,
          hours_per_day: d.comp_off_hours_per_day ?? 8.0,
          leave_type_id: d.comp_off_leave_type_id || null,
          expiry_months: d.comp_off_expiry_months || null,
          activation_date: d.comp_off_activation_date || new Date().toISOString().split('T')[0],
        });
        setLeaveTypes(lt.data.filter(t => t.is_active));
      }
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
      else if (type === 'salary_template') setForm({ components: [] });
      else if (type === 'salary_component') setForm({ component_type: 'earning', calc_type: 'percentage_of_ctc', calc_value: 0, show_on_payslip: true, sort_order: 0 });
      else if (type === 'lop_rule') setForm({ priority: (lopRules.length + 1), respect_monthly_limit: true, is_active: true });
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
      } else if (modal === 'salary_component') {
        if (form.id) await api.put(`/hr/salary-components/${form.id}`, form);
        else await api.post('/hr/salary-components/', form);
      } else if (modal === 'lop_rule') {
        await api.post('/hr/lop-rules/', {
          leave_type_id: parseInt(form.leave_type_id),
          priority: parseInt(form.priority),
          respect_monthly_limit: !!form.respect_monthly_limit,
          is_active: true,
        });
      }
      toast.success('Saved successfully');
      setModal(null);
      fetchTab();
    } catch (e) { 
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 
                  Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') :
                  'Save failed';
      toast.error(msg); 
    }
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
      else if (type === 'salary_component') await api.delete(`/hr/salary-components/${id}`);
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

  async function updateConfig(key, value) {
    setConfigs(prev => ({ ...prev, [key]: value }));
    try {
      await api.post('/hr/config/', { key, value });
      toast.success('Rule updated');
    } catch { toast.error('Failed to update rule'); }
  }

  const toggleWorkingDay = (d) => {
    const current = configs.working_days || ['Mon','Tue','Wed','Thu','Fri','Sat'];
    const updated = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    updateConfig('working_days', updated);
  };

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
    } catch (e) { 
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 
                  Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') :
                  'Import failed';
      toast.error(msg);
    }
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
          <button style={tabStyle(tab === 'salary_components')} onClick={() => setTab('salary_components')}><Settings size={14} /> Salary Components</button>
          <button style={tabStyle(tab === 'salary_rules')} onClick={() => setTab('salary_rules')}><Settings size={14} /> Salary Rules</button>
          <button style={tabStyle(tab === 'lop_rules')} onClick={() => setTab('lop_rules')}><GitBranch size={14} /> LOP Waterfall</button>
          <button style={tabStyle(tab === 'comp_off')} onClick={() => setTab('comp_off')}><Zap size={14} /> Comp-Off</button>
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

        {/* SALARY COMPONENTS MASTER */}
        {tab === 'salary_components' && (
          <Section title="Salary Component Master" onAdd={() => openModal('salary_component')}>
            {salaryComponents.filter(c => c.is_active).map(c => {
              const calcLabel = c.calc_type === 'percentage_of_ctc' ? `${c.calc_value}% of Salary (CTC)` :
                c.calc_type === 'percentage_of_basic' ? `${c.calc_value}% of Basic` :
                c.calc_type === 'percentage_of_gross' ? `${c.calc_value}% of Gross` :
                `Fixed ₹${c.calc_value}`;
              return (
                <Card key={c.id}
                  title={`${c.name}`}
                  badge={c.code}
                  badgeColor={c.component_type === 'earning' ? '#22c55e' : c.component_type === 'employer_contribution' ? '#8b5cf6' : '#ef4444'}
                  subtitle={`${c.component_type === 'earning' ? 'Earning' : c.component_type === 'employer_contribution' ? 'Employer Contribution' : 'Deduction'} · ${calcLabel}`}
                  extra={c.show_on_payslip ? '✓ Shows on payslip' : '✗ Hidden from payslip'}
                  onEdit={() => openModal('salary_component', c)}
                  onDelete={() => deleteItem('salary_component', c.id)}
                />
              );
            })}
          </Section>
        )}

        {/* SALARY RULES */}
        {tab === 'salary_rules' && (
          <div style={{ maxWidth: 700 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Attendance & Payroll Rules</h3>
            <div style={{ display: 'grid', gap: 20 }}>

              {/* ── Leave Auto-Approval ────────────────────────────── */}
              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Leave / On-Duty Auto-Approval Time</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    If a manager doesn't act on a pending request within this many hours, it will be <strong>automatically approved</strong> by the system.
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    ⏱ Current: <strong>{configs.leave_auto_approve_hours ?? 6} hour{(configs.leave_auto_approve_hours ?? 6) !== 1 ? 's' : ''}</strong> — applies to both Leave and On-Duty requests
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    step="1"
                    value={configs.leave_auto_approve_hours ?? 6}
                    onChange={e => setConfigs(prev => ({ ...prev, leave_auto_approve_hours: parseInt(e.target.value) || 6 }))}
                    onBlur={e => updateConfig('leave_auto_approve_hours', parseInt(e.target.value) || 6)}
                    style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontWeight: 700, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>hrs</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Global Working Days</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Define which days are considered standard working days for the organization.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.map(d => (
                    <button key={d} onClick={() => toggleWorkingDay(d)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: (configs.working_days || ['Mon','Tue','Wed','Thu','Fri','Sat']).includes(d) ? 'var(--accent)' : 'var(--bg3)', color: (configs.working_days || ['Mon','Tue','Wed','Thu','Fri','Sat']).includes(d) ? '#fff' : 'var(--text2)' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Sandwich Policy Highlighting</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Flag Sundays/Holidays as potential LOP if preceded and followed by absences.</div>
                </div>
                <input type="checkbox" checked={configs.enable_sandwich_highlight !== false} onChange={e => updateConfig('enable_sandwich_highlight', e.target.checked)} style={{ width: 20, height: 20 }} />
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Auto-Deduct Sandwich Sundays</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Automatically deduct sandwich Sundays as LOP days without waiting for manual confirmation.</div>
                </div>
                <input type="checkbox" checked={configs.auto_deduct_sandwich === true} onChange={e => updateConfig('auto_deduct_sandwich', e.target.checked)} style={{ width: 20, height: 20 }} />
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Treat Excess Leaves as LOP</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Automatically split leave requests into LOP if they exceed the employee's available paid leave balance.</div>
                </div>
                <input type="checkbox" checked={configs.lop_overflow !== false} onChange={e => updateConfig('lop_overflow', e.target.checked)} style={{ width: 20, height: 20 }} />
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Regular Employee Check</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Highlight employees who take non-allocated leaves as "Irregular" for holiday pay decisions.</div>
                </div>
                <input type="checkbox" checked={configs.regular_employee_check !== false} onChange={e => updateConfig('regular_employee_check', e.target.checked)} style={{ width: 20, height: 20 }} />
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Salary Calculation Method</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Pro-rata (pro-rate all components) or Deduction (explicit LOP deduction line).</div>
                </div>
                <select value={configs.salary_calculation_method || 'pro_rata'} onChange={e => updateConfig('salary_calculation_method', e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontWeight: 600 }}>
                  <option value="pro_rata">Pro-rata (Recommended)</option>
                  <option value="deduction">Explicit LOP Deduction</option>
                </select>
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>LOP Calculation Base</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Choose if LOP is deducted based on Gross earnings, Total CTC, or Net Pay (In-Hand).</div>
                </div>
                <select value={configs.lop_calculation_base || 'gross'} onChange={e => updateConfig('lop_calculation_base', e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontWeight: 600 }}>
                  <option value="gross">Gross Salary</option>
                  <option value="ctc">Total CTC</option>
                  <option value="net_pay">Net Pay (In-Hand)</option>
                </select>
              </div>

              <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>LOP Denominator Basis</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>Set the monthly divisor to include the whole calendar month (e.g. 30 days) or exclude week-offs (e.g. 26 days).</div>
                </div>
                <select value={configs.lop_denominator_basis || 'working_days'} onChange={e => updateConfig('lop_denominator_basis', e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontWeight: 600 }}>
                  <option value="working_days">Exclude Week Offs (e.g. 26 Days)</option>
                  <option value="calendar_days">Whole Month's Days (e.g. 30 Days)</option>
                </select>
              </div>
            </div>
          </div>
        )}

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
                 modal === 'lop_rule' ? 'Add LOP Waterfall Rule' :
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
                  <div><label style={labelStyle}>Half Day Late In (mins)</label><input type="number" value={form.half_day_late_minutes || 120} onChange={e => setForm({ ...form, half_day_late_minutes: parseInt(e.target.value) })} style={inputStyle} placeholder="Minutes late = 0.5 day" /></div>
                  <div><label style={labelStyle}>Half Day Early Out (mins)</label><input type="number" value={form.half_day_early_minutes || 120} onChange={e => setForm({ ...form, half_day_early_minutes: parseInt(e.target.value) })} style={inputStyle} placeholder="Minutes early = 0.5 day" /></div>
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

            {/* Salary Component Form */}
            {modal === 'salary_component' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Component Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Basic Salary" /></div>
                  <div><label style={labelStyle}>Code</label><input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={inputStyle} placeholder="BASIC" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Type</label>
                    <select value={form.component_type || 'earning'} onChange={e => setForm({ ...form, component_type: e.target.value })} style={inputStyle}>
                      <option value="earning">Earning</option>
                      <option value="deduction">Deduction</option>
                      <option value="employer_contribution">Employer Contribution</option>
                    </select></div>
                  <div><label style={labelStyle}>Calculation Type</label>
                    <select value={form.calc_type || 'percentage_of_ctc'} onChange={e => setForm({ ...form, calc_type: e.target.value, slabs: e.target.value === 'slab' ? (form.slabs?.length ? form.slabs : [{ min: 0, max: 10000, value: 0 }]) : form.slabs })} style={inputStyle}>
                      <option value="percentage_of_ctc">% of Gross Salary</option>
                      <option value="percentage_of_basic">% of Basic</option>
                      <option value="percentage_of_gross">% of All Earnings So Far</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                      <option value="slab">Slab-based (PT / TDS)</option>
                    </select></div>
                </div>
                {form.calc_type !== 'slab' && (
                  <div><label style={labelStyle}>{form.calc_type === 'fixed' ? 'Fixed Amount (₹)' : 'Percentage (%)'}</label>
                    <input type="number" step="0.01" value={form.calc_value || 0} onChange={e => setForm({ ...form, calc_value: parseFloat(e.target.value) || 0 })} style={inputStyle} /></div>
                )}

                {/* SLAB EDITOR */}
                {form.calc_type === 'slab' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--bg2)', padding: '8px 14px', fontWeight: 700, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Salary Slabs</span>
                      <button type="button" onClick={() => setForm({ ...form, slabs: [...(form.slabs || []), { min: 0, max: null, value: 0 }] })}
                        style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add Slab</button>
                    </div>
                    <div style={{ padding: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>Min Salary (₹)</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>Max Salary (₹)</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>Fixed Amount (₹)</div>
                        <div></div>
                      </div>
                      {(form.slabs || []).map((slab, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                          <input type="number" placeholder="0" value={slab.min ?? ''}
                            onChange={e => { const s = [...form.slabs]; s[idx] = { ...s[idx], min: parseFloat(e.target.value) || 0 }; setForm({ ...form, slabs: s }); }}
                            style={{ ...inputStyle, fontSize: 13 }} />
                          <input type="number" placeholder="No limit (∞)" value={slab.max ?? ''}
                            onChange={e => { const s = [...form.slabs]; s[idx] = { ...s[idx], max: e.target.value !== '' ? parseFloat(e.target.value) : null }; setForm({ ...form, slabs: s }); }}
                            style={{ ...inputStyle, fontSize: 13 }} />
                          <input type="number" placeholder="₹ amount" value={slab.value ?? ''}
                            onChange={e => { const s = [...form.slabs]; s[idx] = { ...s[idx], value: parseFloat(e.target.value) || 0 }; setForm({ ...form, slabs: s }); }}
                            style={{ ...inputStyle, fontSize: 13 }} />
                          <button type="button" onClick={() => { const s = form.slabs.filter((_, i) => i !== idx); setForm({ ...form, slabs: s }); }}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#dc2626' }}>
                            <X size={12} /></button>
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                        💡 Leave Max blank for the last slab (means "and above"). Example for PT: 0–10000 = ₹0, 10001–15000 = ₹150, 15001+ = ₹200
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <label style={labelStyle}>
                    Cap / Max Limit (₹) — <span style={{ color: 'var(--text3)', fontWeight: 400 }}>Optional. For PF: enter 15000</span>
                  </label>
                  <input type="number" step="1" placeholder="Leave blank for no cap" 
                    value={form.cap_amount ?? ''} 
                    onChange={e => setForm({ ...form, cap_amount: e.target.value !== '' ? parseFloat(e.target.value) : null })} 
                    style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    💡 If set, the calculation base will be capped at this amount.
                    Example: Basic = ₹25,000 → PF calculated on ₹15,000 only.
                  </div>
                </div>

                {/* Gross Threshold - India Compliance (ESI / TDS) */}
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🇮🇳 Gross Salary Threshold — <span style={{ fontWeight: 400, color: 'var(--text3)' }}>India Compliance Rules</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Apply only if Gross ≤ (₹)</label>
                      <input type="number" step="1" placeholder="e.g. 21000 for ESI"
                        value={form.apply_if_gross_below ?? ''}
                        onChange={e => setForm({ ...form, apply_if_gross_below: e.target.value !== '' ? parseFloat(e.target.value) : null })}
                        style={inputStyle} />
                      <div style={{ fontSize: 10, color: '#6366f1', marginTop: 4 }}>
                        ESI: Enter 21000 — component skipped if gross {'>'} ₹21,000
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Apply only if Gross ≥ (₹)</label>
                      <input type="number" step="1" placeholder="e.g. 100000 for TDS"
                        value={form.apply_if_gross_above ?? ''}
                        onChange={e => setForm({ ...form, apply_if_gross_above: e.target.value !== '' ? parseFloat(e.target.value) : null })}
                        style={inputStyle} />
                      <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                        TDS: Enter 100000 — component skipped if gross {'<'} ₹1,00,000
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Display Order</label><input type="number" value={form.sort_order || 0} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                    <input type="checkbox" id="payslip_show" checked={form.show_on_payslip !== false} onChange={e => setForm({ ...form, show_on_payslip: e.target.checked })} />
                    <label htmlFor="payslip_show" style={{ fontSize: 13, fontWeight: 600 }}>Show on Payslip</label>
                  </div>
                </div>
              </div>
            )}

            {/* Salary Template Form */}
            {modal === 'salary_template' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={labelStyle}>Template Name</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Manager Slab" /></div>
                <div><label style={labelStyle}>Description</label><input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} style={inputStyle} /></div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Components</label>
                    <button onClick={() => setForm({ ...form, components: [...(form.components || []), { component_id: '', override_value: null }] })}
                      style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add</button>
                  </div>
                  {(form.components || []).map((comp, idx) => {
                    const master = salaryComponents.find(c => String(c.id) === String(comp.component_id));
                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <select value={String(comp.component_id || '')} onChange={e => { 
                          const sc = [...form.components]; 
                          const master = salaryComponents.find(c => c.id === parseInt(e.target.value));
                          sc[idx] = { 
                            ...sc[idx], 
                            component_id: parseInt(e.target.value),
                            name: master?.name || '',
                            code: master?.code || '',
                            type: master?.component_type || 'earning',
                            calc_type: master?.calc_type || 'percentage_of_ctc',
                            is_percentage: master?.calc_type !== 'fixed',
                            value: master?.calc_value || 0,
                            cap_amount: master?.cap_amount,
                            slabs: master?.slabs,
                            apply_if_gross_below: master?.apply_if_gross_below,
                            apply_if_gross_above: master?.apply_if_gross_above
                          }; 
                          setForm({ ...form, components: sc }); 
                        }} style={inputStyle}>
                          <option value="">— Select Component —</option>
                          {salaryComponents.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        </select>
                        <input type="number" placeholder={master ? `Default: ${master.calc_value}` : 'Value'} value={comp.value ?? ''}
                          onChange={e => { const sc = [...form.components]; sc[idx].value = e.target.value !== '' ? parseFloat(e.target.value) : 0; setForm({ ...form, components: sc }); }}
                          style={inputStyle} />
                        <button onClick={() => { const sc = form.components.filter((_, i) => i !== idx); setForm({ ...form, components: sc }); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Leave Override blank to use the default value from Component Master</div>
                </div>
              </div>
            )}

            {/* LOP Rule Form */}
            {modal === 'lop_rule' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Leave Type</label>
                  <select value={form.leave_type_id || ''} onChange={e => setForm({ ...form, leave_type_id: e.target.value })} style={inputStyle}>
                    <option value="">— Select Leave Type —</option>
                    {leaveTypes.filter(t => t.is_paid && t.code !== 'LOP').map(t => (
                      <option key={t.id} value={t.id} disabled={lopRules.some(r => r.leave_type_id === t.id)}>
                        {t.name} ({t.code}){lopRules.some(r => r.leave_type_id === t.id) ? ' — already added' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <input type="number" min="1" value={form.priority || ''} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) })} style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>1 = tried first. Existing rules will shift down automatically.</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.respect_monthly_limit} onChange={e => setForm({ ...form, respect_monthly_limit: e.target.checked })} />
                  Respect monthly limit for this leave type
                </label>
                <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border)' }}>
                  If checked: skip this leave type once its monthly limit is hit and try the next rule.
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

        {/* LOP WATERFALL RULES */}
        {tab === 'lop_rules' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>LOP Waterfall Rules</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text2)' }}>
                  Define which leave types to auto-consume (in order) before marking a day as Loss of Pay.
                </p>
              </div>
              <button onClick={() => setModal('lop_rule')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <Plus size={14} /> Add Rule
              </button>
            </div>

            {lopRules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 12, border: '2px dashed var(--border)' }}>
                <GitBranch size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No waterfall rules configured</div>
                <div style={{ fontSize: 12 }}>Without rules, leaves fall back to alphabetical order before LOP</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lopRules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={async e => {
                      e.preventDefault();
                      setDragOverIdx(null);
                      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                      if (fromIdx === idx) return;
                      const reordered = [...lopRules];
                      const [moved] = reordered.splice(fromIdx, 1);
                      reordered.splice(idx, 0, moved);
                      const updated = reordered.map((r, i) => ({ ...r, priority: i + 1 }));
                      setLopRules(updated);
                      try {
                        await api.put('/hr/lop-rules/reorder', { rules: updated.map(r => ({ id: r.id, priority: r.priority })) });
                        toast.success('Priority order saved');
                      } catch { toast.error('Failed to save order'); }
                    }}
                    style={{
                      background: 'var(--bg2)', border: `2px solid ${dragOverIdx === idx ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
                      cursor: 'grab', transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 20, color: 'var(--text3)', userSelect: 'none' }}>⠿</div>
                    <div style={{ background: 'var(--accent)', color: '#fff', borderRadius: 999, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                      {rule.priority}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{rule.leave_type_name} <span style={{ fontSize: 11, color: 'var(--text2)' }}>({rule.leave_type_code})</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                        {rule.respect_monthly_limit ? '✅ Respects monthly limit' : '⬜ Ignores monthly limit'}
                        {!rule.is_active && ' · ⚠ Inactive'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={async () => {
                          const updated = { ...rule, respect_monthly_limit: !rule.respect_monthly_limit };
                          await api.put(`/hr/lop-rules/${rule.id}`, updated);
                          setLopRules(lopRules.map(r => r.id === rule.id ? updated : r));
                          toast.success('Rule updated');
                        }}
                        style={{ background: 'var(--bg3)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                      >
                        {rule.respect_monthly_limit ? 'Monthly: ON' : 'Monthly: OFF'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete rule for ${rule.leave_type_name}?`)) return;
                          await api.delete(`/hr/lop-rules/${rule.id}`);
                          toast.success('Rule deleted');
                          fetchTab();
                        }}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginTop: 4 }}>↕ Drag rows to reorder priorities</div>
              </div>
            )}
          </div>
        )}

        {/* COMP-OFF SETTINGS */}
        {tab === 'comp_off' && (
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Compensatory Off (Comp-Off) Settings</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text2)' }}>
              When an employee works more than the threshold hours in a day, excess hours automatically accumulate as Comp-Off leave.
            </p>
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Enable toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: compOffSettings.enabled ? '#22c55e20' : 'var(--bg3)', borderRadius: 8, border: `1px solid ${compOffSettings.enabled ? '#22c55e40' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Enable Comp-Off Accrual</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Automatically add overtime hours to Comp-Off balance</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!compOffSettings.enabled} onChange={e => setCompOffSettings({ ...compOffSettings, enabled: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', inset: 0, borderRadius: 12, background: compOffSettings.enabled ? 'var(--accent)' : '#d1d5db', transition: '0.2s' }}>
                    <span style={{ position: 'absolute', left: compOffSettings.enabled ? 22 : 2, top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: '0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                  </span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Daily Threshold (hours)</label>
                  <input type="number" step="0.5" min="1" value={compOffSettings.threshold_hours} onChange={e => setCompOffSettings({ ...compOffSettings, threshold_hours: parseFloat(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>Overtime starts after this many hours</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Hours per 1 Comp-Off Day</label>
                  <input type="number" step="0.5" min="1" value={compOffSettings.hours_per_day} onChange={e => setCompOffSettings({ ...compOffSettings, hours_per_day: parseFloat(e.target.value) })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>Excess hours ÷ this = CO days earned</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Comp-Off Leave Type</label>
                  <select value={compOffSettings.leave_type_id || ''} onChange={e => setCompOffSettings({ ...compOffSettings, leave_type_id: e.target.value ? parseInt(e.target.value) : null })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">Auto-create Comp-Off (CO)</option>
                    {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>Leave empty to auto-create CO type</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Activation Date</label>
                  <input type="date" value={compOffSettings.activation_date || ''} onChange={e => setCompOffSettings({ ...compOffSettings, activation_date: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>Only accrue CO from this date onward</div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Comp-Off Expiry</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCompOffSettings({ ...compOffSettings, expiry_months: null })} style={{ padding: '6px 14px', borderRadius: 7, border: `2px solid ${compOffSettings.expiry_months === null ? 'var(--accent)' : 'var(--border)'}`, background: compOffSettings.expiry_months === null ? 'var(--accent)15' : 'var(--bg)', color: compOffSettings.expiry_months === null ? 'var(--accent)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12, transition: 'all 0.15s' }}>No Expiry</button>
                  <button onClick={() => setCompOffSettings({ ...compOffSettings, expiry_months: compOffSettings.expiry_months || 3 })} style={{ padding: '6px 14px', borderRadius: 7, border: `2px solid ${compOffSettings.expiry_months !== null ? 'var(--accent)' : 'var(--border)'}`, background: compOffSettings.expiry_months !== null ? 'var(--accent)15' : 'var(--bg)', color: compOffSettings.expiry_months !== null ? 'var(--accent)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12, transition: 'all 0.15s' }}>Expires After</button>
                  {compOffSettings.expiry_months !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="1" max="36" value={compOffSettings.expiry_months || 3} onChange={e => setCompOffSettings({ ...compOffSettings, expiry_months: parseInt(e.target.value) })} style={{ width: 70, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>months</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Formula preview */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>
                <strong style={{ color: 'var(--text)' }}>Formula Preview:</strong> If employee works <strong>{compOffSettings.threshold_hours}h+</strong>, every <strong>{compOffSettings.hours_per_day}h</strong> of excess = <strong>1 Comp-Off day</strong>.<br />
                Example: works <strong>{compOffSettings.threshold_hours + compOffSettings.hours_per_day}h</strong> → earns <strong>1 CO day</strong> · works <strong>{compOffSettings.threshold_hours + compOffSettings.hours_per_day * 0.5}h</strong> → earns <strong>0.5 CO day</strong>
              </div>

              <button
                disabled={savingCompOff}
                onClick={async () => {
                  setSavingCompOff(true);
                  try {
                    await api.post('/hr/config/comp-off-setup', {
                      enabled: compOffSettings.enabled,
                      threshold_hours: compOffSettings.threshold_hours,
                      hours_per_day: compOffSettings.hours_per_day,
                      leave_type_id: compOffSettings.leave_type_id || null,
                      expiry_months: compOffSettings.expiry_months || null,
                      activation_date: compOffSettings.activation_date || null,
                    });
                    toast.success('Comp-Off settings saved!');
                    fetchTab();
                  } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
                  finally { setSavingCompOff(false); }
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontWeight: 700 }}
              >
                {savingCompOff ? 'Saving...' : 'Save Comp-Off Settings'}
              </button>
            </div>
          </div>
      </div>
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
