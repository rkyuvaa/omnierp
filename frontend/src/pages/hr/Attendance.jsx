import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Download, Filter, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  present:    { label: 'P',   bg: '#22c55e', color: '#fff', full: 'Present' },
  late:       { label: 'L',   bg: '#f59e0b', color: '#fff', full: 'Late' },
  absent:     { label: 'A',   bg: '#ef4444', color: '#fff', full: 'Absent' },
  half_day:   { label: 'H',   bg: '#f97316', color: '#fff', full: 'Half Day' },
  leave:      { label: 'LV',  bg: '#6366f1', color: '#fff', full: 'On Leave' },
  on_duty:    { label: 'OD',  bg: '#06b6d4', color: '#fff', full: 'On Duty' },
  holiday:    { label: 'HOL', bg: '#8b5cf6', color: '#fff', full: 'Holiday' },
  weekly_off: { label: 'WO',  bg: '#94a3b8', color: '#fff', full: 'Weekly Off' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Attendance() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [tooltip, setTooltip] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const [correctForm, setCorrectForm] = useState({});
  const [violations, setViolations] = useState({});
  const [configs, setConfigs] = useState({});
  const [scanning, setScanning] = useState(false);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => { fetchData(); }, [month, year, filterBranch, filterDept]);
  useEffect(() => {
    api.get('/branches/').then(r => setBranches(r.data));
    api.get('/departments/').then(r => setDepartments(r.data));
    api.get('/hr/config/').then(r => setConfigs(r.data));
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const params = { month, year };
      if (filterBranch) params.branch_id = filterBranch;
      if (filterDept) params.department_id = filterDept;
      const [emps, recs, hols] = await Promise.all([
        api.get('/hr/employees/', { params: { branch_id: filterBranch || undefined, department_id: filterDept || undefined, is_active: true } }),
        api.get('/hr/attendance/records', { params }),
        api.get('/hr/holidays/', { params: { month, year } }),
      ]);
      setEmployees(emps.data);
      setRecords(recs.data);
      setHolidays(hols.data || []);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }

  const workDays = configs.working_days || ['Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayDate = new Date().setHours(0,0,0,0);

  const getEffStatus = (d, recs, emp = null) => {
    const r = recs[d.dayStr];
    if (r?.status) return r.status;
    
    // Check if it's a holiday
    const isHol = holidays.find(h => h.date === d.dayStr && (!h.branch_id || h.branch_id === emp?.branch_id));
    if (isHol) return 'holiday';

    if (!workDays.includes(d.dayOfWeek)) return 'weekly_off';
    if (new Date(d.dayStr) < todayDate) return 'absent';
    return null;
  };

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return { num: i + 1, dayStr: d.toLocaleDateString('en-CA'), dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }) };
  });

  async function openCorrect(emp, day) {
    const existing = records[String(emp.id)]?.[day.dayStr];
    setCorrecting({ emp, day });
    setCorrectForm({
      status: existing?.status || 'present',
      check_in: existing?.check_in ? existing.check_in.slice(0, 16) : '',
      check_out: existing?.check_out ? existing.check_out.slice(0, 16) : '',
      correction_reason: '',
    });
  }

  async function saveCorrection() {
    if (!correctForm.correction_reason) { toast.error('Please enter a reason'); return; }
    try {
      await api.post('/hr/attendance/correct', {
        employee_id: correcting.emp.id,
        date: correcting.day.dayStr,
        status: correctForm.status,
        check_in: correctForm.check_in || null,
        check_out: correctForm.check_out || null,
        correction_reason: correctForm.correction_reason,
      });
      toast.success('Attendance corrected');
      setCorrecting(null);
      fetchData();
    } catch { toast.error('Failed to save correction'); }
  }

  function runViolationScan() {
    if (configs.enable_sandwich_highlight === false) return;
    setScanning(true);
    const v = {};

    employees.forEach(emp => {
      const empRecs = records[String(emp.id)] || {};
      const empVs = [];
      let isIrregular = false;
      
      // Regularity Check: Has any LOP (Absent or Unpaid Leave)?
      if (configs.regular_employee_check !== false) {
        // Check both actual records and effective absences
        days.forEach(d => {
          if (new Date(d.dayStr) >= todayDate) return;
          const status = getEffStatus(d, empRecs, emp);
          const r = empRecs[d.dayStr];
          if (status === 'absent' || (status === 'leave' && r?.is_paid === false)) {
            isIrregular = true;
          }
        });
      }

      // Sandwich Scan
      for (let i = 1; i < days.length - 1; i++) {
        const d = days[i];
        const status = getEffStatus(d, empRecs, emp);
        
        if (status === 'weekly_off' || status === 'holiday') {
          // If irregular, flag all holidays as potential LOP
          if (isIrregular && status === 'holiday') {
             empVs.push({ dayStr: d.dayStr, type: 'irregular', label: 'Non-regular employee: Review holiday pay' });
          }

          // Check before: last working day
          let before = null;
          for (let j = i - 1; j >= 0; j--) {
            const s = getEffStatus(days[j], empRecs, emp);
            if (s !== 'weekly_off' && s !== 'holiday') { before = s; break; }
          }
          // Check after: next working day
          let after = null;
          for (let j = i + 1; j < days.length; j++) {
            const s = getEffStatus(days[j], empRecs, emp);
            if (s !== 'weekly_off' && s !== 'holiday') { after = s; break; }
          }
          
          if (before === 'absent' && after === 'absent') {
            empVs.push({ dayStr: d.dayStr, type: 'sandwich', label: 'Potential Sandwich LOP' });
          }
        }
      }
      if (empVs.length > 0) v[emp.id] = empVs;
    });
    setViolations(v);
    setScanning(false);
    toast.success('Violation scan complete');
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };

  return (
    <Layout title="Attendance">
      <div style={{ padding: '0 16px 24px' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
          </div>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150 }}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150 }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={runViolationScan} disabled={scanning} className="btn" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
            <AlertCircle size={14} color="#f59e0b" /> {scanning ? 'Scanning...' : 'Scan for Violations'}
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 20, height: 20, background: v.bg, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 9 }}>{v.label}</div>
              <span style={{ color: 'var(--text2)' }}>{v.full}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading attendance data...</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: 180, position: 'sticky', left: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', fontWeight: 700, zIndex: 2 }}>Employee</th>
                  {days.map(d => (
                    <th key={d.num} style={{ padding: '6px 4px', minWidth: 34, textAlign: 'center', fontWeight: 600, color: d.dayOfWeek === 'Sun' ? '#ef4444' : 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11 }}>{d.dayOfWeek}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{d.num}</div>
                    </th>
                  ))}
                  <th style={{ padding: '10px 8px', textAlign: 'center', minWidth: 50, fontWeight: 700, fontSize: 10, color: 'var(--text2)' }}>P</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', minWidth: 50, fontWeight: 700, fontSize: 10, color: 'var(--text2)' }}>A</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', minWidth: 50, fontWeight: 700, fontSize: 10, color: 'var(--text2)' }}>L</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={days.length + 4} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No employees found</td></tr>
                ) : employees.map(emp => {
                  const empRecs = records[String(emp.id)] || {};
                  let pCount = 0, aCount = 0, lvCount = 0;
                  days.forEach(d => {
                    const s = empRecs[d.dayStr]?.status;
                    if (s === 'present' || s === 'late' || s === 'on_duty') pCount++;
                    else if (s === 'absent') aCount++;
                    else if (s === 'leave') lvCount++;
                  });
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px', position: 'sticky', left: 0, background: 'var(--bg)', borderRight: '1px solid var(--border)', fontWeight: 600, zIndex: 1 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.employee_id}</div>
                      </td>
                      {days.map(d => {
                        const rec = empRecs[d.dayStr];
                        const status = getEffStatus(d, empRecs, emp);
                        const cfg = status ? STATUS_CONFIG[status] : null;
                        const v = (violations[emp.id] || []).find(x => x.dayStr === d.dayStr);

                        return (
                          <td key={d.num} style={{ padding: '3px', textAlign: 'center', borderRight: '1px solid var(--border)', background: v ? '#fff7ed' : 'transparent' }}>
                            <div
                              title={v ? v.label : (cfg ? `${cfg.full}\nIn: ${rec?.check_in || '—'}\nOut: ${rec?.check_out || '—'}` : 'Click to correct')}
                              onClick={() => openCorrect(emp, d)}
                              style={{
                                width: 28, height: 28, margin: '0 auto', borderRadius: 6, cursor: 'pointer',
                                background: cfg ? cfg.bg : 'var(--bg3)',
                                color: cfg ? cfg.color : 'var(--text3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: 9, transition: 'opacity 0.1s',
                                border: v ? '2px solid #f97316' : 'none',
                                boxSizing: 'border-box'
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                              {cfg ? cfg.label : '·'}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#22c55e' }}>{pCount}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#ef4444' }}>{aCount}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#6366f1' }}>{lvCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Correction Modal */}
      {correcting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 400, maxWidth: '95vw' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Correct Attendance</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--text2)', fontSize: 13 }}>{correcting.emp.name} — {correcting.day.dayStr}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' }}>Status</label>
                <select value={correctForm.status} onChange={e => setCorrectForm({ ...correctForm, status: e.target.value })} style={inputStyle}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' }}>Check In</label>
                <input type="datetime-local" value={correctForm.check_in} onChange={e => setCorrectForm({ ...correctForm, check_in: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' }}>Check Out</label>
                <input type="datetime-local" value={correctForm.check_out} onChange={e => setCorrectForm({ ...correctForm, check_out: e.target.value })} style={inputStyle} /></div>
              <div><label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' }}>Reason for Correction *</label>
                <textarea value={correctForm.correction_reason} onChange={e => setCorrectForm({ ...correctForm, correction_reason: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Enter reason..." /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setCorrecting(null)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={saveCorrection} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
