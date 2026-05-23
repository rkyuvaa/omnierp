import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { ChevronLeft, ChevronRight, Download, Play, CheckCircle, Wallet, X, Clock, Plus, ArrowRight, Trash2, Mail } from 'lucide-react';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Payroll() {
  const { user } = useAuth();
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
  const [detail, setDetail] = useState(null);
  const [arrearModal, setArrearModal] = useState(null); // { employee_id, employee_name, pending_arrears }
  const [emailingId, setEmailingId] = useState(null);
  const [emailingBulk, setEmailingBulk] = useState(false);

  useEffect(() => {
    if (user?.is_superadmin) {
      api.get('/hr/employees/', { params: { is_active: true } }).then(r => setEmployees(r.data));
    }
  }, [user]);

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
      const res = await api.get('/hr/payroll/', { params: { month, year } });
      setRecords(res.data);
      setSelected([]);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  }

  async function generatePayroll() {
    const toGenerate = selected.length > 0 ? selected : employees.map(e => e.id);
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

  const totalNet = records.reduce((sum, r) => sum + (r.net_salary || 0), 0);
  const totalEarnings = records.reduce((sum, r) => sum + (r.total_earnings || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + (r.total_deductions || 0), 0);

  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13 };

  return (
    <Layout title="Payroll">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Tab Switcher */}
        {user?.is_superadmin && (
          <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {['payroll', 'arrears'].map(t => (
              <button 
                key={t}
                onClick={() => setTab(t)}
                style={{ 
                  padding: '12px 4px', 
                  background: 'none', 
                  border: 'none', 
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--text3)',
                  fontWeight: 700,
                  fontSize: 14,
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
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={16} /></button>
                <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}><ChevronRight size={16} /></button>
              </div>
              {user?.is_superadmin && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {selected.length > 0 && (
                    <>
                      <button onClick={() => bulkUpdateStatus('finalized')} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                        <CheckCircle size={13} /> Bulk Finalize ({selected.length})
                      </button>
                      <button onClick={() => bulkUpdateStatus('draft')} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                        <Clock size={13} /> Bulk Reset ({selected.length})
                      </button>
                      <button 
                        onClick={bulkEmailPayslips} 
                        disabled={emailingBulk}
                        className="btn" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6, 
                          fontSize: 13, 
                          background: '#e0e7ff', 
                          color: '#4338ca', 
                          border: '1px solid #c7d2fe',
                          cursor: emailingBulk ? 'not-allowed' : 'pointer',
                          opacity: emailingBulk ? 0.7 : 1
                        }}
                      >
                        <Mail size={13} /> {emailingBulk ? 'Sending...' : `Bulk Email (${selected.length})`}
                      </button>
                      <button onClick={bulkDelete} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        <Trash2 size={13} /> Bulk Delete ({selected.length})
                      </button>
                    </>
                  )}
                  <button onClick={generatePayroll} disabled={generating} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <Play size={13} /> {generating ? 'Generating...' : 'Generate Payroll'}
                  </button>
                  <button onClick={downloadExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <Download size={13} /> Export Excel
                  </button>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            {user?.is_superadmin && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                {[
                  { label: 'Total Earnings', value: `₹${totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#22c55e' },
                  { label: 'Total Deductions', value: `₹${totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#ef4444' },
                  { label: 'Net Payable', value: `₹${totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'var(--accent)' },
                ].map(c => (
                  <div key={c.label} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Payroll Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading payroll data...</div>
            ) : records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                <Play size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                {user?.is_superadmin ? 'No payroll generated for this month. Click "Generate Payroll" to start.' : 'No payroll record found for this month.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {user?.is_superadmin && (
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase' }}>
                          <input type="checkbox" onChange={e => setSelected(e.target.checked ? records.map(r => r.employee_id) : [])} checked={selected.length === records.length && records.length > 0} />
                        </th>
                      )}
                      {['Employee','Days','Present','Absent','Leave','LOP','OD','Earnings','Arrear Paid','Deductions','Net Salary','Status','Actions'].map(h => {
                        if (!user?.is_superadmin && h === 'Actions') return <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Download</th>;
                        return (
                          <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Actions' ? 'left' : 'center', fontWeight: 700, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        {user?.is_superadmin && (
                          <td style={{ padding: '10px 12px' }}>
                            <input type="checkbox" checked={selected.includes(r.employee_id)} onChange={e => setSelected(s => e.target.checked ? [...s, r.employee_id] : s.filter(id => id !== r.employee_id))} />
                          </td>
                        )}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700 }}>{r.employee_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.employee_code} · {r.designation}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{r.working_days}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{r.present_days}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{r.absent_days}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6366f1', fontWeight: 600 }}>{r.leave_days}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>{r.lop_days}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#06b6d4', fontWeight: 600 }}>{r.on_duty_days}</td>
                        <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600, textAlign: 'center' }}>₹{Number(r.total_earnings).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '10px 12px', color: '#6366f1', fontWeight: 600, textAlign: 'center' }}>₹{Number(r.arrears_paid || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 600, textAlign: 'center' }}>₹{Number(r.total_deductions).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: 15, textAlign: 'center' }}>₹{Number(r.net_salary).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 700, background: r.status === 'finalized' ? '#dcfce7' : '#fef3c7', color: r.status === 'finalized' ? '#16a34a' : '#d97706' }}>
                            {r.status === 'finalized' ? 'Finalized' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {user?.is_superadmin && (
                              <>
                                {r.status !== 'finalized' ? (
                                  <>
                                    <button onClick={() => finalizeRecord(r.id)} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <CheckCircle size={12} /> Finalize
                                    </button>
                                    <button onClick={() => deleteRecord(r.id)} title="Delete Draft" style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => deleteRecord(r.id)} title="Delete Finalized" style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Trash2 size={12} /> Delete
                                  </button>
                                )}
                                <button 
                                  onClick={() => setArrearModal({ employee_id: r.employee_id, employee_name: r.employee_name, pending_arrears: r.pending_arrears, arrears_paid: r.arrears_paid })}
                                  style={{ background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Wallet size={12} /> Arrears (₹{r.arrears_paid || 0} P | ₹{r.pending_arrears || 0} H)
                                </button>
                              </>
                            )}
                            {user?.is_superadmin && (
                              <button 
                                onClick={() => emailPayslip(r.id, r.employee_name)} 
                                title="Email Payslip PDF to Employee" 
                                disabled={emailingId === r.id}
                                style={{ 
                                  background: '#e0e7ff', 
                                  color: '#4338ca', 
                                  border: 'none', 
                                  borderRadius: 6, 
                                  padding: '5px 10px', 
                                  cursor: emailingId === r.id ? 'not-allowed' : 'pointer', 
                                  fontWeight: 700, 
                                  fontSize: 12, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 4,
                                  opacity: emailingId === r.id ? 0.7 : 1
                                }}
                              >
                                <Mail size={12} /> {emailingId === r.id ? 'Sending...' : 'Email'}
                              </button>
                            )}
                            <button onClick={() => downloadPayslip(r.id, r.employee_code, r.month, r.year)} title="Download Payslip PDF" style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Download size={12} /> Payslip
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
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['Employee','Pending Amount','Status','Action'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingList.map(p => (
                  <tr key={p.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.code}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 800, fontSize: 16 }}>₹{p.total_pending.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>Pending Hold</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button 
                        onClick={() => setArrearModal({ employee_id: p.employee_id, employee_name: p.name, pending_arrears: p.total_pending })}
                        style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                      >
                        Manage & Pay
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingList.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No employees have pending arrears.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
  const [holdAmount, setHoldAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedArrears, setSelectedArrears] = useState([]);
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

  async function handleHold() {
    if (!holdAmount || holdAmount <= 0) return toast.error('Enter valid amount');
    setSaving(true);
    try {
      await api.post('/hr/payroll/arrears/hold', {
        employee_id: data.employee_id,
        amount: parseFloat(holdAmount),
        month, year, remarks
      });
      toast.success('Salary held as arrear');
      setHoldAmount(''); setRemarks('');
      fetchPending();
      onRefresh();
    } catch (err) { 
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : (typeof detail === 'string' ? detail : 'Failed to hold salary');
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

  async function handleRevert(arrearId) {
    if (!confirm('Revert this payout? It will be moved back to held status and removed from this month\'s salary.')) return;
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
            <div style={{ fontWeight: 800, fontSize: 16 }}>Manage Arrears</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{data.employee_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Pay Pending Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} /> Arrears History & Payouts
            </div>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
            ) : pending.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 8, border: '1px dashed var(--border)' }}>No arrear records found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(a => (
                  <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: a.status === 'paid' ? '#f0f9ff' : 'var(--bg2)', borderRadius: 8, border: a.status === 'paid' ? '1px solid #bae6fd' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>₹{a.amount_held.toLocaleString()}</div>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: a.status === 'paid' ? '#dcfce7' : '#fef3c7', color: a.status === 'paid' ? '#16a34a' : '#d97706', textTransform: 'uppercase' }}>
                            {a.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Held in {MONTH_NAMES[a.held_month - 1]} {a.held_year}</div>
                        {a.remarks && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>Note: {a.remarks}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {a.status === 'held' ? (
                          payingArrearId !== a.id && (
                            <button 
                              onClick={() => { setPayingArrearId(a.id); setPayoutAmount(a.amount_held); }}
                              disabled={saving}
                              style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Pay Part/Full
                            </button>
                          )
                        ) : (
                          <button 
                            onClick={() => handleRevert(a.id)}
                            disabled={saving}
                            style={{ background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Revert
                          </button>
                        )}
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

          {/* Hold Salary Section */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Hold Salary (Create Arrear)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Amount to Hold (₹)</label>
                <input 
                  type="number" 
                  value={holdAmount} 
                  onChange={e => setHoldAmount(e.target.value)} 
                  placeholder="0.00" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14 }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Remarks (Optional)</label>
                <input 
                  type="text" 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                  placeholder="Reason for holding salary..." 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14 }} 
                />
              </div>
              <button 
                onClick={handleHold} 
                disabled={saving} 
                className="btn btn-primary" 
                style={{ width: '100%', background: '#6366f1', fontSize: 13, height: 38, border: 'none' }}
              >
                {saving ? 'Holding...' : 'Hold This Amount'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontStyle: 'italic' }}>
                Held amount will be deducted from {MONTH_NAMES[month-1]} payout.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
