import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { UserPlus, Search, Edit2, ToggleLeft, ToggleRight, X, ChevronDown, Upload, FileText, Download, Calendar, Wifi } from 'lucide-react';

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

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Employee Master">
      <div style={{ padding: '0 24px 24px' }}>
        {activeTab === 'detail' && selectedEmp ? (
          <EmployeeDetail emp={selectedEmp} onBack={() => setActiveTab('list')} onEdit={() => openEdit(selectedEmp)} shifts={shifts} />
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
                { key: 'basic_salary', label: 'Salary (CTC) (₹)', type: 'number' },
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

function EmployeeDetail({ emp, onBack, onEdit, shifts }) {
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [salaryTemplates, setSalaryTemplates] = useState([]);
  const [balances, setBalances] = useState(emp.leave_balances || []);
  const [salaryForm, setSalaryForm] = useState({ basic_salary: emp.basic_salary, salary_components: emp.salary_components || [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hr/leave/types').then(r => setLeaveTypes(r.data));
    api.get('/hr/salary-templates/').then(r => setSalaryTemplates(r.data));
  }, []);

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
      <button onClick={onBack} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: 'var(--text2)', marginBottom: 20, fontSize: 13 }}>
        ← Back to List
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 24, border: '1px solid var(--border)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 60, height: 60, background: 'var(--accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 22, fontWeight: 700 }}>{emp.name?.[0]}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{emp.name}</div>
                <div style={{ color: 'var(--text2)', fontSize: 14 }}>{emp.designation} · {emp.employee_id}</div>
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
                <span>{b.leave_type_name}</span>
                <span style={{ color: 'var(--text2)' }}>{b.used_days} / {b.allocated_days} used</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 999, height: 6 }}>
                <div style={{ width: `${(b.used_days/b.allocated_days)*100}%`, background: 'var(--accent)', borderRadius: 999, height: '100%' }} />
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
            <span style={{ color: 'var(--text2)' }}>Salary (CTC)</span>
            <span style={{ fontWeight: 700 }}>₹{Number(emp.basic_salary || 0).toLocaleString('en-IN')}</span>
          </div>
          {(emp.salary_components || []).map((comp, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{comp.name} {comp.is_percentage ? `(${comp.value}%)` : ''}</span>
              <span style={{ color: comp.type === 'earning' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {comp.type === 'deduction' ? '−' : '+'}
                ₹{comp.is_percentage ? ((emp.basic_salary * comp.value) / 100).toLocaleString('en-IN') : comp.value.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Balance Modal */}
      {showBalanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 440, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Manage Leave Balances</h3>
              <button onClick={() => setShowBalanceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leaveTypes.map(lt => {
                const b = balances.find(x => x.leave_type_id === lt.id) || { leave_type_id: lt.id, allocated_days: 0 };
                return (
                  <div key={lt.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{lt.name}</div>
                    <input type="number" step="0.5" value={b.allocated_days} 
                      onChange={e => {
                        const newB = [...balances];
                        const idx = newB.findIndex(x => x.leave_type_id === lt.id);
                        if (idx >= 0) newB[idx].allocated_days = parseFloat(e.target.value) || 0;
                        else newB.push({ leave_type_id: lt.id, allocated_days: parseFloat(e.target.value) || 0 });
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
            <div style={{ background: 'var(--accent-dim)', padding: 12, borderRadius: 8, marginBottom: 20 }}>
              <label style={labelStyle}>Apply from Template</label>
              <select onChange={e => {
                const t = salaryTemplates.find(x => x.id === parseInt(e.target.value));
                if (t) setSalaryForm({ ...salaryForm, salary_components: t.components });
              }} style={inputStyle}>
                <option value="">— Select Template —</option>
                {salaryTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Salary (CTC) (₹)</label>
              <input type="number" value={salaryForm.basic_salary} onChange={e => setSalaryForm({ ...salaryForm, basic_salary: parseFloat(e.target.value) || 0 })} style={inputStyle} placeholder="e.g. 50000" />
            </div>

            {salaryForm.salary_components.length > 0 && (
              <div style={{ background: 'var(--bg2)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <label style={{ ...labelStyle, marginBottom: 12 }}>Preview of Components</label>
                {salaryForm.salary_components.map((comp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)' }}>{comp.name} ({comp.value}{comp.is_percentage ? '%' : '₹'})</span>
                    <span style={{ fontWeight: 600 }}>
                      ₹{comp.is_percentage ? ((salaryForm.basic_salary * comp.value) / 100).toLocaleString('en-IN') : comp.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Total Calculated</span>
                  <span>₹{salaryForm.salary_components.reduce((acc, c) => acc + (c.is_percentage ? (salaryForm.basic_salary * c.value / 100) : c.value), 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

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
