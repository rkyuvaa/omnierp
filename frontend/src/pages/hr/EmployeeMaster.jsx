import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { UserPlus, Search, Edit2, ToggleLeft, ToggleRight, X, ChevronDown, Upload, FileText, Download, Calendar, Wifi, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_BADGE = { true: { bg: '#dcfce7', color: '#16a34a', label: 'Active' }, false: { bg: '#fee2e2', color: '#dc2626', label: 'Inactive' } };

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg2)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box'
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' };

export default function EmployeeMaster() {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // list | detail
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [importFile, setImportFile] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [emps, sh, depts, brs] = await Promise.all([
        api.get('/hr/employees/'),
        api.get('/hr/shifts/'),
        api.get('/departments/'),
        api.get('/branches/'),
      ]);
      setEmployees(emps.data);
      setShifts(sh.data);
      setDepartments(depts.data);
      setBranches(brs.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }

  async function openCreate() {
    try {
      const res = await api.get('/hr/employees/next-id');
      setForm({ employee_id: res.data.next_id, is_active: true, salary_components: [] });
    } catch {
      setForm({ employee_id: 'EMP001', is_active: true, salary_components: [] });
    }
    setEditEmp(null);
    setShowModal(true);
  }

  function openEdit(emp) {
    setForm({ ...emp });
    setEditEmp(emp);
    setShowModal(true);
  }

  async function saveEmployee() {
    setSaving(true);
    try {
      if (editEmp) {
        await api.put(`/hr/employees/${editEmp.id}`, form);
        toast.success('Employee updated');
      } else {
        await api.post('/hr/employees/', form);
        toast.success('Employee created');
      }
      setShowModal(false);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function toggleActive(emp) {
    try {
      await api.put(`/hr/employees/${emp.id}`, { is_active: !emp.is_active });
      toast.success(`Employee ${emp.is_active ? 'deactivated' : 'activated'}`);
      fetchAll();
    } catch { toast.error('Failed'); }
  }

  async function handleImport() {
    if (!importFile) return toast.error('Please select a file');
    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const res = await api.post('/hr/employees/import/excel', formData);
      toast.success(`Imported ${res.data.imported} employees. Skipped ${res.data.skipped}.`);
      if (res.data.errors?.length > 0) {
        console.error('Import errors:', res.data.errors);
        toast.error(`There were ${res.data.errors.length} errors. Check console.`);
      }
      setShowImportModal(false);
      setImportFile(null);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
    finally { setImporting(false); }
  }

  async function downloadTemplate() {
    try {
      const res = await api.get('/hr/employees/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_import_template.xlsx';
      a.click();
    } catch { toast.error('Failed to download template'); }
  }

  async function openDetail(emp) {
    try {
      const res = await api.get(`/hr/employees/${emp.id}`);
      setSelectedEmp(res.data);
      setActiveTab('detail');
    } catch { toast.error('Failed to load employee'); }
  }

  function handleNextEmployee() {
    if (!selectedEmp || employees.length === 0) return;
    const list = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const currIndex = list.findIndex(e => e.id === selectedEmp.id);
    if (currIndex === -1) return;
    const nextIndex = (currIndex + 1) % list.length;
    openDetail(list[nextIndex]);
  }

  function handlePrevEmployee() {
    if (!selectedEmp || employees.length === 0) return;
    const list = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const currIndex = list.findIndex(e => e.id === selectedEmp.id);
    if (currIndex === -1) return;
    const prevIndex = (currIndex - 1 + list.length) % list.length;
    openDetail(list[prevIndex]);
  }

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Employee Master">
      <div style={{ padding: '0 24px 24px' }}>
        {activeTab === 'detail' && selectedEmp ? (
          <EmployeeDetail 
            emp={selectedEmp} 
            onBack={() => setActiveTab('list')} 
            onEdit={() => openEdit(selectedEmp)} 
            shifts={shifts}
            onNext={handleNextEmployee}
            onPrev={handlePrevEmployee}
          />
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input placeholder="Search by name, ID or email..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 32 }} />
              </div>
              <button className="btn" onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <Upload size={15} /> Import
              </button>
              <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <UserPlus size={15} /> Add Employee
              </button>
            </div>

            {/* Table */}
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                      {['Emp ID','Name','Designation','Department','Branch','Shift','Status','Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No employees found</td></tr>
                    ) : filtered.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => openDetail(emp)}>{emp.employee_id}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }} onClick={() => openDetail(emp)}>{emp.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{emp.designation || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{emp.department_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{emp.branch_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{emp.shift_name || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: STATUS_BADGE[emp.is_active].bg, color: STATUS_BADGE[emp.is_active].color }}>
                            {STATUS_BADGE[emp.is_active].label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => openEdit(emp)} style={{ background: 'var(--bg3)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text2)' }}>
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => toggleActive(emp)} style={{ background: 'var(--bg3)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: emp.is_active ? '#22c55e' : '#94a3b8' }}>
                              {emp.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editEmp ? 'Edit Employee' : 'Add Employee'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { key: 'employee_id', label: 'Employee ID', type: 'text' },
                { key: 'name', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'designation', label: 'Designation', type: 'text' },
                { key: 'date_of_joining', label: 'Date of Joining', type: 'date' },
                { key: 'biometric_id', label: 'Biometric ID (eSSL)', type: 'text' },
                { key: 'basic_salary', label: 'Gross Salary (₹)', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inputStyle} />
                </div>
              ))}

              <div>
                <label style={labelStyle}>Department</label>
                <select value={form.department_id || ''} onChange={e => setForm({ ...form, department_id: e.target.value })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Branch</label>
                <select value={form.branch_id || ''} onChange={e => setForm({ ...form, branch_id: e.target.value })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Shift</label>
                <select value={form.shift_id || ''} onChange={e => setForm({ ...form, shift_id: e.target.value })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.is_active ? 'true' : 'false'} onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })} style={inputStyle}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
               <div>
                <label style={labelStyle}>Reporting Manager</label>
                <select value={form.manager_id || ''} onChange={e => setForm({ ...form, manager_id: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle}>
                  <option value="">— Select Manager —</option>
                  {employees.filter(emp => emp.id !== form.id).map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Salary Category</label>
                <select value={form.salary_category || 'regular'} onChange={e => setForm({ ...form, salary_category: e.target.value })} style={inputStyle}>
                  <option value="regular">Regular Employee (Attendance-based)</option>
                  <option value="fixed">Fixed Salary (No Attendance Deductions)</option>
                </select>
              </div>
            </div>

            {/* Salary Components */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Salary Components</label>
                <button onClick={() => setForm({ ...form, salary_components: [...(form.salary_components || []), { name: '', type: 'earning', is_percentage: true, value: 0 }] })}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                  + Add
                </button>
              </div>
              {(form.salary_components || []).map((comp, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input placeholder="Component Name" value={comp.name} onChange={e => { const sc = [...form.salary_components]; sc[idx] = { ...sc[idx], name: e.target.value }; setForm({ ...form, salary_components: sc }); }} style={{ ...inputStyle }} />
                  <select value={comp.type} onChange={e => { const sc = [...form.salary_components]; sc[idx] = { ...sc[idx], type: e.target.value }; setForm({ ...form, salary_components: sc }); }} style={inputStyle}>
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                  <select value={comp.is_percentage ? 'true' : 'false'} onChange={e => { const sc = [...form.salary_components]; sc[idx] = { ...sc[idx], is_percentage: e.target.value === 'true' }; setForm({ ...form, salary_components: sc }); }} style={inputStyle}>
                    <option value="true">% of Gross</option>
                    <option value="false">Fixed ₹</option>
                  </select>
                  <input type="number" placeholder="Value" value={comp.value} onChange={e => { const sc = [...form.salary_components]; sc[idx] = { ...sc[idx], value: parseFloat(e.target.value) || 0 }; setForm({ ...form, salary_components: sc }); }} style={inputStyle} />
                  <button onClick={() => { const sc = form.salary_components.filter((_, i) => i !== idx); setForm({ ...form, salary_components: sc }); }}
                    style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#dc2626' }}><X size={13} /></button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} className="btn" style={{ background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={saveEmployee} disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : editEmp ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 440, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Import Employees</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ background: 'var(--bg2)', border: '2px dashed var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', marginBottom: 20 }}>
              <input type="file" accept=".xlsx" onChange={e => setImportFile(e.target.files[0])} id="import-file" style={{ display: 'none' }} />
              <label htmlFor="import-file" style={{ cursor: 'pointer' }}>
                <Upload size={30} style={{ color: 'var(--text3)', marginBottom: 10 }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>{importFile ? importFile.name : 'Click to select Excel file'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Only .xlsx files supported</div>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <button onClick={downloadTemplate} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Download Sample Template
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowImportModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={handleImport} disabled={importing} className="btn btn-primary" style={{ flex: 1 }}>{importing ? 'Importing...' : 'Start Import'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function EmployeeDetail({ emp, onBack, onEdit, shifts, onNext, onPrev }) {
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [salaryTemplates, setSalaryTemplates] = useState([]);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [balances, setBalances] = useState(emp.leave_balances || []);
  const [salaryForm, setSalaryForm] = useState({ 
    basic_salary: emp.basic_salary, 
    salary_template_id: emp.salary_template_id || '',
    salary_components: emp.salary_components || []
  });
  const [saving, setSaving] = useState(false);
  const [netPayInput, setNetPayInput] = useState('');

  useEffect(() => {
    api.get('/hr/leave/types').then(r => setLeaveTypes(r.data));
    api.get('/hr/salary-templates/').then(r => setSalaryTemplates(r.data));
    api.get('/hr/salary-components/').then(r => setSalaryComponents(r.data));
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev]);

  // Hydrate components: enrich stored JSON with master data for correct types
  function hydrateComponents(components) {
    if (!components?.length) return [];
    return components.map(c => {
      const master = salaryComponents.find(m => m.id === c.component_id || String(m.id) === String(c.component_id));
      if (master) {
        return {
          ...c,
          // Fallback to master value if override 'value' (from template/emp) is missing
          value: (c.value !== undefined && c.value !== null) ? c.value : master.calc_value,
          type: master.component_type,
          component_type: master.component_type,
          calc_type: master.calc_type,
          code: master.code,
          cap_amount: master.cap_amount,
          slabs: master.slabs,
          apply_if_gross_below: master.apply_if_gross_below,
          apply_if_gross_above: master.apply_if_gross_above,
          sort_order: master.sort_order,
        };
      }
      return c;
    });
  }

  function calculateSalaryDetails(grossValue, compList) {
    const results = [];
    const ctc = parseFloat(grossValue) || 0;
    const components = hydrateComponents(compList || []);
    const sorted = [...components].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    sorted.forEach(comp => {
      let amount = 0;
      const val = parseFloat(comp.value) || 0;
      let calcType = comp.calc_type || (comp.is_percentage ? 'percentage_of_ctc' : 'fixed');
      const compType = comp.component_type || comp.type || 'earning';
      
      // Failsafe: If Basic Salary is mistakenly set to % of Gross (which is 0 initially), treat it as % of CTC (Gross)
      if (calcType === 'percentage_of_gross' && results.length === 0) {
        calcType = 'percentage_of_ctc';
      }
      
      if (calcType === 'percentage_of_ctc') amount = (ctc * val) / 100;
      else if (calcType === 'percentage_of_basic') {
        const basic = results.find(r => r.code === 'BASIC' || r.name?.toLowerCase().includes('basic'))?.amount || 0;
        const base = comp.cap_amount ? Math.min(basic, comp.cap_amount) : basic;
        amount = (base * val) / 100;
      } else if (calcType === 'percentage_of_gross') {
        const gross = results.filter(r => r._compType === 'earning').reduce((acc, r) => acc + r.amount, 0);
        const base = comp.cap_amount ? Math.min(gross, comp.cap_amount) : gross;
        amount = (base * val) / 100;
      } else if (calcType === 'slab') {
        const gross = results.filter(r => r._compType === 'earning').reduce((acc, r) => acc + r.amount, 0);
        if (comp.slabs) {
          for (const s of comp.slabs) {
            if (gross >= (s.min || 0) && gross <= (s.max || Infinity)) { amount = s.value || 0; break; }
          }
        }
      } else amount = val;

      // Thresholds: check against the inputted Gross Salary (ctc)
      if (comp.apply_if_gross_below > 0 && ctc > comp.apply_if_gross_below) amount = 0;
      if (comp.apply_if_gross_above > 0 && ctc < comp.apply_if_gross_above) amount = 0;

      results.push({ ...comp, amount, _calcType: calcType, _compType: compType });
    });

    const totalEarnings = results.filter(r => r._compType === 'earning').reduce((acc, r) => acc + r.amount, 0);
    const totalDeductions = results.filter(r => r._compType === 'deduction').reduce((acc, r) => acc + r.amount, 0);
    const totalContributions = results.filter(r => r._compType === 'employer_contribution').reduce((acc, r) => acc + r.amount, 0);
    const netPay = totalEarnings - totalDeductions;
    const totalCTC = totalEarnings + totalContributions;

    return { results, totalEarnings, totalDeductions, totalContributions, netPay, totalCTC, gross: ctc };
  }

  function findGrossForNet(targetNet, compList) {
    if (!targetNet || targetNet <= 0) return 0;
    let low = targetNet;
    let high = targetNet * 2 + 100000;
    let bestGross = targetNet;
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      const details = calculateSalaryDetails(mid, compList);
      if (Math.abs(details.netPay - targetNet) < 0.00001) {
        bestGross = mid;
        break;
      }
      if (details.netPay < targetNet) low = mid;
      else high = mid;
    }
    return Math.round(bestGross * 100) / 100;
  }

  useEffect(() => {
    if (salaryComponents.length > 0 && emp.basic_salary > 0 && !netPayInput) {
       const details = calculateSalaryDetails(emp.basic_salary, emp.salary_components);
       setNetPayInput(Math.round(details.netPay));
    }
  }, [salaryComponents, emp]);

  async function saveBalances() {
    setSaving(true);
    try {
      await api.post(`/hr/leave/balances/${emp.id}`, balances);
      toast.success('Balances updated');
      setShowBalanceModal(false);
      window.location.reload();
    } catch { toast.error('Failed to update balances'); }
    finally { setSaving(false); }
  }

  async function saveSalary() {
    setSaving(true);
    try {
      await api.put(`/hr/employees/${emp.id}`, salaryForm);
      toast.success('Salary structure updated');
      setShowSalaryModal(false);
      window.location.reload();
    } catch { toast.error('Failed to update salary'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>
          ← Back to List
        </button>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onPrev} title="Previous Employee (Left Arrow)" style={{ 
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={onNext} title="Next Employee (Right Arrow)" style={{ 
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 24, border: '1px solid var(--border)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 60, height: 60, background: 'var(--accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 22, fontWeight: 700 }}>{emp.name?.[0]}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{emp.name}</div>
                <div style={{ color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{emp.designation} · {emp.employee_id}</span>
                  <span style={{ 
                    fontSize: 11, 
                    padding: '2px 8px', 
                    borderRadius: 999, 
                    fontWeight: 700, 
                    background: emp.salary_category === 'fixed' ? '#fee2e2' : '#e0e7ff', 
                    color: emp.salary_category === 'fixed' ? '#dc2626' : '#4f46e5' 
                  }}>
                    {emp.salary_category === 'fixed' ? 'FIXED SALARY' : 'REGULAR'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onEdit} className="btn btn-primary" style={{ fontSize: 13 }}>Edit Profile</button>
          </div>
        </div>

        {/* Leave Balances */}
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>Leave Balances — 2026</div>
            <button onClick={() => setShowBalanceModal(true)} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Manage</button>
          </div>
          {balances.map(b => (
            <div key={b.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span>
                  {b.leave_type_name}
                  {b.monthly_limit > 0 ? ` (Max ${b.monthly_limit}/mo)` : ''}
                </span>
                <span style={{ color: 'var(--text2)' }}>{b.used_days} / {b.allocated_days} used</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 999, height: 6 }}>
                <div style={{ width: `${b.allocated_days > 0 ? (b.used_days/b.allocated_days)*100 : 0}%`, background: 'var(--accent)', borderRadius: 999, height: '100%' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Salary Info */}
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>Salary Structure</div>
            <button onClick={() => setShowSalaryModal(true)} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Manage</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text2)' }}>Gross Salary</span>
            <span style={{ fontWeight: 700 }}>₹{Number(emp.basic_salary || 0).toLocaleString('en-IN')}</span>
          </div>
          {(() => {
            const rawComponents = emp.salary_components || [];
            if (rawComponents.length === 0) return <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No salary structure defined</div>;
            if (salaryComponents.length === 0) return <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Loading components...</div>;

            const details = calculateSalaryDetails(emp.basic_salary, rawComponents);

            return details.results.map((comp, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>
                  {comp.name} 
                  {comp._calcType !== 'fixed' && comp._calcType !== 'slab' ? ` (${comp.value}%)` : 
                   comp._calcType === 'slab' ? ' (Slab)' : ''}
                </span>
                <span style={{ 
                  color: comp._compType === 'earning' ? '#22c55e' : 
                         comp._compType === 'employer_contribution' ? '#8b5cf6' : '#ef4444', 
                  fontWeight: 600 
                }}>
                  {comp._compType === 'deduction' ? '−' : '+'}
                  ₹{comp.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Balance Modal */}
      {showBalanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 500, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Manage Leave Balances</h3>
              <button onClick={() => setShowBalanceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            
            {/* Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>Leave Type</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>Total Days</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>Monthly Limit</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
              {leaveTypes.map(lt => {
                const b = balances.find(x => x.leave_type_id === lt.id) || { leave_type_id: lt.id, allocated_days: 0, monthly_limit: 0 };
                return (
                  <div key={lt.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{lt.name}</div>
                    <input type="number" step="0.5" value={b.allocated_days} 
                      onChange={e => {
                        const newB = [...balances];
                        const idx = newB.findIndex(x => x.leave_type_id === lt.id);
                        if (idx >= 0) newB[idx].allocated_days = parseFloat(e.target.value) || 0;
                        else newB.push({ leave_type_id: lt.id, allocated_days: parseFloat(e.target.value) || 0, monthly_limit: 0 });
                        setBalances(newB);
                      }} style={inputStyle} />
                    <input type="number" step="0.5" placeholder="unlimited" value={b.monthly_limit || ''} 
                      onChange={e => {
                        const newB = [...balances];
                        const idx = newB.findIndex(x => x.leave_type_id === lt.id);
                        if (idx >= 0) newB[idx].monthly_limit = parseFloat(e.target.value) || 0;
                        else newB.push({ leave_type_id: lt.id, allocated_days: 0, monthly_limit: parseFloat(e.target.value) || 0 });
                        setBalances(newB);
                      }} style={inputStyle} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowBalanceModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={saveBalances} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save Balances'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Salary Modal */}
      {showSalaryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 500, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Manage Salary Structure</h3>
              <button onClick={() => setShowSalaryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ background: 'var(--accent-dim)', padding: 16, borderRadius: 10, marginBottom: 20 }}>
              <label style={labelStyle}>Salary Template</label>
              <select value={salaryForm.salary_template_id || ''} 
                onChange={e => {
                  const tid = e.target.value ? parseInt(e.target.value) : null;
                  const template = salaryTemplates.find(t => t.id === tid);
                  const newComps = template ? template.components : [];
                  const newGross = findGrossForNet(parseFloat(netPayInput) || 0, newComps);
                  setSalaryForm({ 
                    ...salaryForm, 
                    salary_template_id: tid,
                    salary_components: newComps,
                    basic_salary: newGross
                  });
                }} 
                style={inputStyle}>
                <option value="">— Select Template —</option>
                {salaryTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Target Net Pay (In-Hand) (₹)</label>
              <input type="number" value={netPayInput} onChange={e => {
                const net = parseFloat(e.target.value) || 0;
                setNetPayInput(net || '');
                const gross = findGrossForNet(net, salaryForm.salary_components);
                setSalaryForm({ ...salaryForm, basic_salary: gross });
              }} style={inputStyle} placeholder="e.g. 35000" />
            </div>

            {(() => {
              if (!salaryForm.salary_components?.length) return null;
              if (salaryComponents.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>Loading master components...</div>;
              
              const details = calculateSalaryDetails(salaryForm.basic_salary, salaryForm.salary_components);

              return (
                <div style={{ background: 'var(--bg2)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <label style={{ ...labelStyle, marginBottom: 12 }}>Preview of Components</label>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Calculated Gross Salary</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>₹{details.gross.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>

                  {details.results.map((comp, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--text2)' }}>
                        {comp.name} 
                        {comp._calcType !== 'fixed' && comp._calcType !== 'slab' ? ` (${comp.value}%)` : 
                         comp._calcType === 'slab' ? ' (Slab)' : ''}
                      </span>
                      <span style={{ 
                        color: comp._compType === 'earning' ? '#22c55e' : 
                               comp._compType === 'employer_contribution' ? '#8b5cf6' : '#ef4444', 
                        fontWeight: 600 
                      }}>
                        {comp._compType === 'deduction' ? '−' : '+'}₹{comp.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>Total Gross Salary</span>
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>₹{details.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>Total Deductions</span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>₹{details.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Employer Contributions</span>
                      <span style={{ color: '#8b5cf6', fontWeight: 600 }}>₹{details.totalContributions.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <span>Net Pay (In-Hand)</span>
                      <span>₹{details.netPay.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginTop: 4 }}>
                      <span>Total CTC</span>
                      <span>₹{details.totalCTC.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowSalaryModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={saveSalary} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save Salary Structure'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
