import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { ChevronLeft, ChevronRight, Download, Play, CheckCircle, Wallet, X, Clock, Plus, ArrowRight, Trash2, Mail, AlertTriangle, MoreVertical } from 'lucide-react';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Payroll() {
  const { user } = useAuth();
  const isHRAdmin = user?.is_superadmin || !!user?.module_permissions?.hr?.can_edit || !!user?.module_permissions?.hr?.can_delete;
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [tab, setTab] = useState('payroll'); // 'payroll' or 'arrears'
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [detail, setDetail] = useState(null);
  const [arrearModal, setArrearModal] = useState(null); // { employee_id, employee_name, pending_arrears }
  const [emailingId, setEmailingId] = useState(null);
  const [emailingBulk, setEmailingBulk] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // { id, top, left, record }
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    }

    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        const triggerBtn = document.querySelector(`[data-action-trigger="${openMenu.id}"]`);
        if (triggerBtn && triggerBtn.contains(e.target)) {
          return;
        }
        setOpenMenu(null);
      }
    }

    function handleScrollOrResize() {
      setOpenMenu(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenu]);

  function handleOpenMenu(e, record) {
    e.stopPropagation();
    if (openMenu?.id === record.id) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 190;
    let top = rect.bottom + 4;
    let left = rect.right - menuWidth;

    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    const approxHeight = isHRAdmin ? (record.status !== 'finalized' ? 210 : 175) : 55;
    if (top + approxHeight > window.innerHeight - 10 && rect.top > approxHeight + 10) {
      top = rect.top - approxHeight - 4;
    }

    setOpenMenu({
      id: record.id,
      top,
      left,
      record
    });
  }

  useEffect(() => {
    if (isHRAdmin) {
      api.get('/hr/employees/').then(r => setEmployees(r.data));
      api.get('/departments/').then(r => setDepartments(r.data)).catch(() => {});
      api.get('/branches/').then(r => setBranches(r.data)).catch(() => {});
    }
  }, [user, isHRAdmin]);

  async function fetchPendingList() {
    setLoading(true);
    try {
      const res = await api.get('/hr/payroll/arrears/pending-list');
      setPendingList(res.data);
    } catch { toast.error('Failed to load pending list'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === 'arrears') fetchPendingList();
    else fetchPayroll();
  }, [tab, month, year]);

  async function fetchPayroll() {
    setLoading(true);
    try {
      const [payrollRes, pendingRes] = await Promise.all([
        api.get('/hr/payroll/', { params: { month, year } }),
        api.get('/hr/payroll/arrears/pending-list')
      ]);
      setRecords(payrollRes.data);
      setPendingList(pendingRes.data);
      setSelected([]);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  }

  async function generatePayroll() {
    const pendingArrearEmpIds = pendingList.map(p => p.employee_id);
    const targetEmployees = employees.filter(e => e.is_active || pendingArrearEmpIds.includes(e.id));
    const toGenerate = selected.length > 0 ? selected : targetEmployees.map(e => e.id);
    if (toGenerate.length === 0) return toast.error('No employees to generate for');
    setGenerating(true);
    try {
      const res = await api.post('/hr/payroll/generate', { employee_ids: toGenerate, month, year });
      toast.success(`Payroll generated for ${res.data.filter(r => r.status === 'computed').length} employees`);
      fetchPayroll();
    } catch { toast.error('Failed to generate'); }
    finally { setGenerating(false); }
  }

  async function finalizeRecord(id) {
    if (!confirm('Finalize this payroll? This cannot be undone.')) return;
    try {
      await api.post(`/hr/payroll/${id}/finalize`);
      toast.success('Payroll finalized');
      fetchPayroll();
    } catch { toast.error('Failed'); }
  }

  async function deleteRecord(id) {
    if (!confirm('Delete this payroll record? This action cannot be undone.')) return;
    try {
      await api.delete(`/hr/payroll/${id}`);
      toast.success('Record deleted');
      fetchPayroll();
    } catch { toast.error('Failed to delete'); }
  }

  async function bulkDelete() {
    if (selected.length === 0) return;
    const count = selected.length;
    if (!confirm(`Are you sure you want to delete ${count} selected payroll records?`)) return;
    
    const recordIds = records.filter(r => selected.includes(r.employee_id)).map(r => r.id);
    setLoading(true);
    try {
      await api.post('/hr/payroll/bulk-delete', { record_ids: recordIds });
      toast.success(`${count} records deleted`);
      setSelected([]);
      fetchPayroll();
    } catch { toast.error('Bulk delete failed'); }
    finally { setLoading(false); }
  }

  async function bulkUpdateStatus(status) {
    if (selected.length === 0) return;
    const count = selected.length;
    if (!confirm(`Are you sure you want to ${status === 'finalized' ? 'finalize' : 'reset to draft'} ${count} selected payroll records?`)) return;
    
    const recordIds = records.filter(r => selected.includes(r.employee_id)).map(r => r.id);
    setLoading(true);
    try {
      await api.post('/hr/payroll/bulk-update-status', { record_ids: recordIds, status });
      toast.success(`${count} records updated`);
      setSelected([]);
      fetchPayroll();
    } catch { toast.error('Bulk update failed'); }
    finally { setLoading(false); }
  }

  async function downloadExcel() {
    try {
      const res = await api.get('/hr/reports/payroll-export/excel', {
        params: { month, year }, responseType: 'blob'
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `payroll_${year}_${String(month).padStart(2,'0')}.xlsx`;
      a.click();
    } catch { toast.error('Download failed'); }
  }

  async function downloadPayslip(recordId, empCode, monthNum, yearNum) {
    try {
      const res = await api.get(`/hr/payroll/${recordId}/payslip`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `Payslip_${empCode}_${MONTH_NAMES[monthNum - 1]}_${yearNum}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download payslip'); }
  }

  async function emailPayslip(recordId, empName) {
    setEmailingId(recordId);
    const toastId = toast.loading(`Sending payslip to ${empName}...`);
    try {
      const res = await api.post(`/hr/payroll/${recordId}/send-payslip`);
      toast.success(res.data.message || `Payslip successfully emailed to ${empName}`, { id: toastId });
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to send email';
      toast.error(errMsg, { id: toastId });
    } finally {
      setEmailingId(null);
    }
  }

  async function bulkEmailPayslips() {
    if (selected.length === 0) return;
    const count = selected.length;
    if (!confirm(`Are you sure you want to email payslips to the ${count} selected employees?`)) return;
    
    const recordIds = records.filter(r => selected.includes(r.employee_id)).map(r => r.id);
    setEmailingBulk(true);
    const toastId = toast.loading(`Bulk sending ${count} payslips...`);
    try {
      const res = await api.post('/hr/payroll/bulk-send-payslips', { record_ids: recordIds });
      const { sent, failed, errors } = res.data;
      
      if (failed === 0) {
        toast.success(`Successfully sent ${sent} payslip emails!`, { id: toastId });
      } else {
        toast.success(`Sent: ${sent}, Failed: ${failed}`, { id: toastId });
        if (errors && errors.length > 0) {
          console.error('Bulk email errors:', errors);
          toast.error(`Errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`, { duration: 6000 });
        }
      }
      setSelected([]);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to bulk send emails';
      toast.error(errMsg, { id: toastId });
    } finally {
      setEmailingBulk(false);
    }
  }

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const filteredEmployeesOptions = employees.filter(e => {
    if (filterDepartment && String(e.department_id) !== String(filterDepartment)) return false;
    if (filterBranch && String(e.branch_id) !== String(filterBranch)) return false;
    return true;
  });

  const filteredRecords = records.filter(r => {
    if (filterEmployee && String(r.employee_id) !== String(filterEmployee)) return false;
    if (filterDepartment && String(r.department_id) !== String(filterDepartment)) return false;
    if (filterBranch && String(r.branch_id) !== String(filterBranch)) return false;
    return true;
  });

  const filteredPendingList = pendingList.filter(p => {
    if (filterEmployee && String(p.employee_id) !== String(filterEmployee)) return false;
    if (filterDepartment && String(p.department_id) !== String(filterDepartment)) return false;
    if (filterBranch && String(p.branch_id) !== String(filterBranch)) return false;
    return true;
  });

  const totalNet = filteredRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);
  const totalEarnings = filteredRecords.reduce((sum, r) => sum + (r.total_earnings || 0), 0);
  const totalDeductions = filteredRecords.reduce((sum, r) => sum + (r.total_deductions || 0), 0);

  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13 };

  return (
    <Layout title="Payroll">
      <div style={{ padding: 0 }}>
        {/* Tab Switcher */}
        {isHRAdmin && (
          <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
            {['payroll', 'arrears'].map(t => (
              <button 
                key={t}
                onClick={() => setTab(t)}
                style={{ 
                  padding: '8px 4px', 
                  background: 'none', 
                  border: 'none', 
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--text3)',
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {t === 'payroll' ? 'Monthly Payroll' : 'Pending Arrears Tracker'}
              </button>
            ))}
          </div>
        )}

        {tab === 'payroll' ? (
          <>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px' }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 700, fontSize: 14, minWidth: 125, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}><ChevronRight size={16} /></button>
              </div>
              {isHRAdmin && (
                <>
                  <select
                    value={filterDepartment}
                    onChange={e => setFilterDepartment(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5, minWidth: 135, cursor: 'pointer' }}
                  >
                    <option value=''>All Departments</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterBranch}
                    onChange={e => setFilterBranch(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5, minWidth: 135, cursor: 'pointer' }}
                  >
                    <option value=''>All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </>
              )}
              {isHRAdmin && employees.length > 0 && (
                <select
                  value={filterEmployee}
                  onChange={e => setFilterEmployee(e.target.value)}
                  style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5, minWidth: 165, cursor: 'pointer' }}
                >
                  <option value=''>All Employees</option>
                  {filteredEmployeesOptions.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.is_active ? '' : '[Inactive] '}{e.name} ({e.employee_id})
                    </option>
                  ))}
                </select>
              )}
              {isHRAdmin && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.length > 0 && (
                    <>
                      <button onClick={() => bulkUpdateStatus('finalized')} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                        <CheckCircle size={13} /> Bulk Finalize ({selected.length})
                      </button>
                      <button onClick={() => bulkUpdateStatus('draft')} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                        <Clock size={13} /> Bulk Reset ({selected.length})
                      </button>
                      <button 
                        onClick={bulkEmailPayslips} 
                        disabled={emailingBulk}
                        className="btn" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 5, 
                          fontSize: 12.5, 
                          background: '#e0e7ff', 
                          color: '#4338ca', 
                          border: '1px solid #c7d2fe',
                          cursor: emailingBulk ? 'not-allowed' : 'pointer',
                          opacity: emailingBulk ? 0.7 : 1
                        }}
                      >
                        <Mail size={13} /> {emailingBulk ? 'Sending...' : `Bulk Email (${selected.length})`}
                      </button>
                      <button onClick={bulkDelete} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        <Trash2 size={13} /> Bulk Delete ({selected.length})
                      </button>
                    </>
                  )}
                  <button onClick={generatePayroll} disabled={generating} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                    <Play size={13} /> {generating ? 'Generating...' : 'Generate Payroll'}
                  </button>
                  <button onClick={downloadExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <Download size={13} /> Export Excel
                  </button>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            {isHRAdmin && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                {[
                  { label: 'Total Earnings', value: `₹${totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#22c55e' },
                  { label: 'Total Deductions', value: `₹${totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#ef4444' },
                  { label: 'Net Payable', value: `₹${totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--accent)' },
                ].map(c => (
                  <div key={c.label} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c.color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Payroll Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading payroll data...</div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                <Play size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                {isHRAdmin ? 'No payroll generated for this month. Click "Generate Payroll" to start.' : 'No payroll record found for this month.'}
              </div>
            ) : (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflowX: 'auto', background: 'var(--bg2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {isHRAdmin && (
                        <th style={{ padding: '7px 6px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase' }}>
                          <input type="checkbox" onChange={e => setSelected(e.target.checked ? filteredRecords.map(r => r.employee_id) : [])} checked={selected.length === filteredRecords.length && filteredRecords.length > 0} />
                        </th>
                      )}
                      {['Employee','Days','Present','Absent','Leave','LOP','OD','Earnings','Arrear Paid','Deductions','Arrear Hold','Net Salary','Status','Actions'].map(h => {
                        const isEmp = h === 'Employee';
                        const isActions = h === 'Actions';
                        return (
                          <th key={h} style={{ padding: '7px 5px', textAlign: isActions ? 'center' : isEmp ? 'left' : 'center', fontWeight: 600, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', width: isEmp ? '160px' : isActions ? '56px' : undefined, maxWidth: isEmp ? '165px' : undefined }}>{h}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        {isHRAdmin && (
                          <td style={{ padding: '6px 6px' }}>
                            <input type="checkbox" checked={selected.includes(r.employee_id)} onChange={e => setSelected(s => e.target.checked ? [...s, r.employee_id] : s.filter(id => id !== r.employee_id))} />
                          </td>
                        )}
                        <td style={{ padding: '6px 5px', width: '160px', maxWidth: '165px', overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.employee_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'var(--font-mono)' }}>{r.employee_code}</span> · {r.designation}</div>
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>{r.working_days}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{r.present_days}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{r.absent_days}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#6366f1', fontWeight: 600 }}>{r.leave_days}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: r.lop_days > 0 ? '#f59e0b' : 'var(--text3)', fontWeight: r.lop_days > 0 ? 600 : 400 }}>{r.lop_days}</span>
                            {r.lop_alert && (
                              <span
                                title={r.lop_alert}
                                style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}
                              >
                                <AlertTriangle size={13} color="#f59e0b" strokeWidth={2.5} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#06b6d4', fontWeight: 600 }}>{r.on_duty_days}</td>
                        <td style={{ padding: '6px 4px', color: '#22c55e', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>₹{Number(r.total_earnings).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '6px 4px', color: '#6366f1', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>₹{Number(r.arrears_paid || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '6px 4px', color: '#ef4444', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>₹{Number(r.total_deductions).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td 
                          style={{ padding: '6px 4px', color: '#ef4444', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}
                          title={`Total Arrear Hold (All Categories): ₹${Number(r.arrears_held ?? r.pending_arrears ?? 0).toLocaleString('en-IN')}`}
                        >
                          ₹{Number(r.arrears_held ?? r.pending_arrears ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '6px 4px', fontWeight: 700, fontSize: 13.5, textAlign: 'center', whiteSpace: 'nowrap' }}>₹{Number(r.net_salary).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 999, fontWeight: 600, background: r.status === 'finalized' ? '#dcfce7' : '#fef3c7', color: r.status === 'finalized' ? '#16a34a' : '#d97706' }}>
                            {r.status === 'finalized' ? 'Finalized' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 5px', textAlign: 'center', width: '56px' }}>
                          <button
                            type="button"
                            data-action-trigger={r.id}
                            onClick={(e) => handleOpenMenu(e, r)}
                            aria-label={`Actions for ${r.employee_name}`}
                            title="Actions"
                            style={{
                              background: openMenu?.id === r.id ? 'var(--bg3, #f1f5f9)' : 'transparent',
                              border: openMenu?.id === r.id ? '1px solid var(--border, #cbd5e1)' : '1px solid transparent',
                              color: openMenu?.id === r.id ? 'var(--text)' : 'var(--text2, #64748b)',
                              borderRadius: 6,
                              width: 28,
                              height: 28,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'var(--bg3, #f1f5f9)';
                              e.currentTarget.style.borderColor = 'var(--border, #cbd5e1)';
                            }}
                            onMouseLeave={e => {
                              if (openMenu?.id !== r.id) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['Employee','Pending Amount','Status','Action'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPendingList.map(p => (
                  <tr key={p.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{p.code}</div>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#ef4444', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>₹{p.total_pending.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: '#fee2e2', color: '#b91c1c' }}>Pending Hold</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button 
                        onClick={() => setArrearModal({ employee_id: p.employee_id, employee_name: p.name, pending_arrears: p.total_pending })}
                        style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                      >
                        Manage & Pay
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPendingList.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>No employees have pending arrears.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Three-dot Overflow Action Dropdown Menu */}
      {openMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${openMenu.top}px`,
            left: `${openMenu.left}px`,
            width: '190px',
            background: 'var(--bg, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            padding: '5px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            userSelect: 'none'
          }}
        >
          {isHRAdmin && openMenu.record.status !== 'finalized' && (
            <button
              type="button"
              onClick={() => {
                const recId = openMenu.record.id;
                setOpenMenu(null);
                finalizeRecord(recId);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 9px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text, #1e293b)',
                textAlign: 'left',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#16a34a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text, #1e293b)'; }}
            >
              <CheckCircle size={14} color="#16a34a" />
              <span>Finalize Payroll</span>
            </button>
          )}

          {isHRAdmin && (
            <button
              type="button"
              onClick={() => {
                const r = openMenu.record;
                setOpenMenu(null);
                setArrearModal({
                  employee_id: r.employee_id,
                  employee_name: r.employee_name,
                  pending_arrears: r.pending_arrears,
                  arrears_paid: r.arrears_paid
                });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 9px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text, #1e293b)',
                textAlign: 'left',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#d97706'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text, #1e293b)'; }}
            >
              <Wallet size={14} color="#d97706" />
              <span>Manage Arrears</span>
              {(Number(openMenu.record.arrears_paid) > 0 || Number(openMenu.record.pending_arrears) > 0) && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '1px 5px', borderRadius: 4, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  ₹{openMenu.record.arrears_paid || 0} P
                </span>
              )}
            </button>
          )}

          {isHRAdmin && (
            <button
              type="button"
              disabled={emailingId === openMenu.record.id}
              onClick={() => {
                const r = openMenu.record;
                setOpenMenu(null);
                emailPayslip(r.id, r.employee_name);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 9px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: emailingId === openMenu.record.id ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text, #1e293b)',
                textAlign: 'left',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
                opacity: emailingId === openMenu.record.id ? 0.6 : 1
              }}
              onMouseEnter={e => {
                if (emailingId !== openMenu.record.id) {
                  e.currentTarget.style.background = '#eef2ff';
                  e.currentTarget.style.color = '#4338ca';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text, #1e293b)';
              }}
            >
              <Mail size={14} color="#4f46e5" />
              <span>{emailingId === openMenu.record.id ? 'Sending Email...' : 'Send Email'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const r = openMenu.record;
              setOpenMenu(null);
              downloadPayslip(r.id, r.employee_code, r.month, r.year);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 9px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text, #1e293b)',
              textAlign: 'left',
              transition: 'all 0.12s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#0284c7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text, #1e293b)'; }}
          >
            <Download size={14} color="#0284c7" />
            <span>Download Payslip</span>
          </button>

          {isHRAdmin && (
            <>
              <div style={{ height: 1, background: 'var(--border, #e2e8f0)', margin: '3px 0' }} />
              <button
                type="button"
                onClick={() => {
                  const recId = openMenu.record.id;
                  setOpenMenu(null);
                  deleteRecord(recId);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 9px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#dc2626',
                  textAlign: 'left',
                  transition: 'all 0.12s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#dc2626'; }}
              >
                <Trash2 size={14} color="#dc2626" />
                <span>Delete Payroll</span>
              </button>
            </>
          )}
        </div>
      )}

      {arrearModal && (
        <ArrearsModal 
          data={arrearModal} 
          month={month}
          year={year}
          onClose={() => setArrearModal(null)} 
          onRefresh={fetchPayroll} 
        />
      )}
    </Layout>
  );
}

function ArrearsModal({ data, month, year, onClose, onRefresh }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState('deduct'); // 'add' (payout) or 'deduct' (hold)
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [targetMonth, setTargetMonth] = useState(month);
  const [targetYear, setTargetYear] = useState(year);
  const [origMonth, setOrigMonth] = useState(month);
  const [origYear, setOrigYear] = useState(year);
  const [saving, setSaving] = useState(false);
  const [payingArrearId, setPayingArrearId] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    try {
      const res = await api.get(`/hr/payroll/arrears/${data.employee_id}`);
      setPending(res.data);
    } catch { toast.error('Failed to load arrears history'); }
    finally { setLoading(false); }
  }

  async function handleManualSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Enter valid amount');
    setSaving(true);
    try {
      await api.post('/hr/payroll/arrears/manual', {
        employee_id: data.employee_id,
        amount: amt,
        type: entryType,
        target_month: (entryType === 'already_paid' || entryType === 'previously_held') ? month : parseInt(targetMonth),
        target_year: (entryType === 'already_paid' || entryType === 'previously_held') ? year : parseInt(targetYear),
        original_month: (entryType === 'add' || entryType === 'already_paid' || entryType === 'previously_held') ? parseInt(origMonth) : null,
        original_year: (entryType === 'add' || entryType === 'already_paid' || entryType === 'previously_held') ? parseInt(origYear) : null,
        remarks: remarks
      });
      toast.success(
        entryType === 'add' ? 'Arrear payout added' : 
        entryType === 'already_paid' ? 'Already Paid record logged' : 
        entryType === 'one_time' ? 'One-time deduction added' :
        entryType === 'previously_held' ? 'Previously held arrear logged' :
        'Salary held (deduction added)'
      );
      setAmount(''); setRemarks('');
      fetchPending();
      onRefresh();
    } catch (err) { 
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : (typeof detail === 'string' ? detail : 'Failed to save entry');
      toast.error(msg); 
    }
    finally { setSaving(false); }
  }

  async function handlePay(arrearId, maxAmount) {
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0) return toast.error('Enter valid amount');
    if (amt > maxAmount) return toast.error('Amount exceeds held balance');

    setSaving(true);
    try {
      await api.post('/hr/payroll/arrears/pay', {
        arrear_id: arrearId,
        amount: amt,
        pay_month: month,
        pay_year: year
      });
      toast.success('Arrears payout processed');
      setPayingArrearId(null);
      setPayoutAmount('');
      fetchPending();
      onRefresh();
    } catch (err) { 
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : (typeof detail === 'string' ? detail : 'Failed to process payout');
      toast.error(msg); 
    }
    finally { setSaving(false); }
  }

  async function handleMarkAlreadyPaid(arrearId) {
    if (!confirm('Mark this arrear as already paid outside standard payroll? This will move it out of pending holds.')) return;
    setSaving(true);
    try {
      await api.post(`/hr/payroll/arrears/already-paid/${arrearId}`);
      toast.success('Marked as already paid');
      fetchPending();
      onRefresh();
    } catch { toast.error('Failed to update status'); }
    finally { setSaving(false); }
  }

  async function handleRevert(arrearId) {
    if (!confirm('Revert this payout? It will be moved back to held status and removed from this month\'s payroll.')) return;
    setSaving(true);
    try {
      await api.post(`/hr/payroll/arrears/revert/${arrearId}`);
      toast.success('Payout reverted');
      fetchPending();
      onRefresh();
    } catch { toast.error('Failed to revert payout'); }
    finally { setSaving(false); }
  }

  async function handleDelete(arrearId) {
    if (!confirm('Permanently DELETE this arrear record? This cannot be undone.')) return;
    setSaving(true);
    try {
      await api.delete(`/hr/payroll/arrears/${arrearId}`);
      toast.success('Arrear record deleted');
      fetchPending();
      onRefresh();
    } catch { toast.error('Failed to delete'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 16, width: '100%', maxWidth: 500, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Manage Arrears</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{data.employee_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Pay Pending Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} /> Arrears History & Payouts
            </div>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
            ) : pending.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 8, border: '1px dashed var(--border)' }}>No arrear records found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(a => (
                  <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: a.status === 'paid' ? '#f0f9ff' : a.status === 'already_paid' ? '#f8fafc' : a.status === 'one_time' ? '#faf5ff' : a.status === 'deducted' ? '#f0fdf4' : 'var(--bg2)', borderRadius: 8, border: a.status === 'paid' ? '1px solid #bae6fd' : a.status === 'already_paid' ? '1px solid #cbd5e1' : a.status === 'one_time' ? '1px solid #e9d5ff' : a.status === 'deducted' ? '1px solid #bbf7d0' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>₹{a.amount_held.toLocaleString()}</div>
                          <span style={{ 
                            fontSize: 10, 
                            padding: '2px 6px', 
                            borderRadius: 4, 
                            fontWeight: 600, 
                            background: a.status === 'paid' ? '#dcfce7' : a.status === 'already_paid' ? '#e2e8f0' : a.status === 'one_time' ? '#f3e8ff' : a.status === 'deducted' ? '#dcfce7' : '#fef3c7', 
                            color: a.status === 'paid' ? '#16a34a' : a.status === 'already_paid' ? '#475569' : a.status === 'one_time' ? '#7e22ce' : a.status === 'deducted' ? '#16a34a' : '#d97706', 
                            textTransform: 'uppercase' 
                          }}>
                            {a.status === 'already_paid' ? 'already paid' : a.status === 'one_time' ? 'one-time' : a.status === 'deducted' ? 'deducted' : a.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {a.status === 'paid' ? (
                            <>Paid in {MONTH_NAMES[a.paid_in_month - 1]} {a.paid_in_year} (from {MONTH_NAMES[a.held_month - 1]} {a.held_year})</>
                          ) : a.status === 'already_paid' ? (
                            <>Paid Outside Payroll (from {MONTH_NAMES[a.held_month - 1]} {a.held_year})</>
                          ) : a.status === 'one_time' ? (
                            <>One-time Deduction (Target: {MONTH_NAMES[a.held_month - 1]} {a.held_year})</>
                          ) : a.status === 'deducted' ? (
                            <>Deducted in {MONTH_NAMES[a.paid_in_month - 1]} {a.paid_in_year} (Target: {MONTH_NAMES[a.held_month - 1]} {a.held_year})</>
                          ) : (
                            <>Held in {MONTH_NAMES[a.held_month - 1]} {a.held_year}</>
                          )}
                        </div>
                        {a.remarks && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>Note: {a.remarks}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {a.status === 'held' ? (
                          payingArrearId !== a.id && (
                            <>
                              <button 
                                onClick={() => { setPayingArrearId(a.id); setPayoutAmount(a.amount_held); }}
                                disabled={saving}
                                style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Pay Part/Full
                              </button>
                              <button 
                                onClick={() => handleMarkAlreadyPaid(a.id)}
                                disabled={saving}
                                style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Already Paid
                              </button>
                            </>
                          )
                        ) : a.status === 'paid' ? (
                          <button 
                            onClick={() => handleRevert(a.id)}
                            disabled={saving}
                            style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Revert
                          </button>
                        ) : null}
                        <button 
                          onClick={() => handleDelete(a.id)}
                          disabled={saving}
                          title="Delete Record"
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '6px', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {payingArrearId === a.id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <input 
                            type="number" 
                            value={payoutAmount} 
                            onChange={e => setPayoutAmount(e.target.value)}
                            placeholder="Amount"
                            autoFocus
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12 }}
                          />
                        </div>
                        <button 
                          onClick={() => handlePay(a.id, a.amount_held)}
                          disabled={saving}
                          style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => { setPayingArrearId(null); setPayoutAmount(''); }}
                          style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '24px 0' }} />

          {/* Manual Adjustment Section */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Manual Arrear Entry (Add / Deduct)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Adjustment Type</label>
                <select 
                  value={entryType} 
                  onChange={e => setEntryType(e.target.value)} 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}
                >
                  <option value="deduct">Deduct from Payroll (Hold Salary)</option>
                  <option value="add">Add to Payroll (Arrear Payout)</option>
                  <option value="already_paid">Already Paid (Record Only)</option>
                  <option value="one_time">Deduct (One-time, No carry forward)</option>
                  <option value="previously_held">Previously Held (Record Only)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Amount (₹)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14 }} 
                />
              </div>

              {entryType !== 'already_paid' && entryType !== 'previously_held' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Target Month</label>
                    <select 
                      value={targetMonth} 
                      onChange={e => setTargetMonth(parseInt(e.target.value))} 
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Target Year</label>
                    <select 
                      value={targetYear} 
                      onChange={e => setTargetYear(parseInt(e.target.value))} 
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                    >
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(entryType === 'add' || entryType === 'already_paid' || entryType === 'previously_held') && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Original Period (Arrear month being paid / held)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <select 
                        value={origMonth} 
                        onChange={e => setOrigMonth(parseInt(e.target.value))} 
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={name} value={i + 1}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <select 
                        value={origYear} 
                        onChange={e => setOrigYear(parseInt(e.target.value))} 
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}
                      >
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Remarks (Optional)</label>
                <input 
                  type="text" 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                  placeholder={
                    entryType === 'add' ? "e.g. Arrear adjustment for performance bonus" : 
                    entryType === 'already_paid' ? "e.g. Paid in cash on April 5" : 
                    entryType === 'previously_held' ? "e.g. Outstanding held balance from previous system" :
                    "e.g. Salary held for clearance"
                  } 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14 }} 
                />
              </div>

              <button 
                onClick={handleManualSave} 
                disabled={saving} 
                className="btn btn-primary" 
                style={{ width: '100%', background: '#6366f1', fontSize: 13, height: 38, border: 'none', marginTop: 4 }}
              >
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontStyle: 'italic' }}>
                {entryType === 'add' 
                  ? `Amount will be paid (added to earnings) in the ${MONTH_NAMES[targetMonth - 1]} ${targetYear} payroll.`
                  : entryType === 'already_paid'
                  ? `Amount will be recorded as already paid outside standard payroll (will NOT affect future payroll runs).`
                  : entryType === 'one_time'
                  ? `Amount will be recorded as a one-time deduction from the ${MONTH_NAMES[targetMonth - 1]} ${targetYear} payroll (will NOT carry forward).`
                  : entryType === 'previously_held'
                  ? `Amount will be recorded as a pending held balance from the past month (will NOT affect current/future payroll runs).`
                  : `Amount will be held (deducted from earnings) in the ${MONTH_NAMES[targetMonth - 1]} ${targetYear} payroll.`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
