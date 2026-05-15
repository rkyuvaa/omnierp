import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Download, Play, CheckCircle } from 'lucide-react';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Payroll() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get('/hr/employees/', { params: { is_active: true } }).then(r => setEmployees(r.data));
  }, []);

  useEffect(() => { fetchPayroll(); }, [month, year]);

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

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const totalNet = records.reduce((sum, r) => sum + (r.net_salary || 0), 0);
  const totalEarnings = records.reduce((sum, r) => sum + (r.total_earnings || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + (r.total_deductions || 0), 0);

  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13 };

  return (
    <Layout title="Payroll">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={generatePayroll} disabled={generating} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Play size={13} /> {generating ? 'Generating...' : 'Generate Payroll'}
            </button>
            <button onClick={downloadExcel} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>

        {/* Summary Cards */}
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

        {/* Payroll Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading payroll data...</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <Play size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            No payroll generated for this month. Click "Generate Payroll" to start.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase' }}>
                    <input type="checkbox" onChange={e => setSelected(e.target.checked ? records.map(r => r.employee_id) : [])} checked={selected.length === records.length && records.length > 0} />
                  </th>
                  {['Employee','Days','Present','Absent','Leave','LOP','OD','Earnings','Deductions','Net Salary','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input type="checkbox" checked={selected.includes(r.employee_id)} onChange={e => setSelected(s => e.target.checked ? [...s, r.employee_id] : s.filter(id => id !== r.employee_id))} />
                    </td>
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
                    <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>₹{Number(r.total_earnings).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 600 }}>₹{Number(r.total_deductions).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: 15 }}>₹{Number(r.net_salary).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 700, background: r.status === 'finalized' ? '#dcfce7' : '#fef3c7', color: r.status === 'finalized' ? '#16a34a' : '#d97706' }}>
                        {r.status === 'finalized' ? 'Finalized' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {r.status !== 'finalized' && (
                          <button onClick={() => finalizeRecord(r.id)} style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Finalize
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
      </div>
    </Layout>
  );
}
