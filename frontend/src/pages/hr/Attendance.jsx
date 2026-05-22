import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Filter, 
  AlertCircle, 
  Search, 
  Calendar, 
  RefreshCw, 
  Check 
} from 'lucide-react';

const STATUS_CONFIG = {
  present:    { label: 'P',   bg: 'rgba(34, 197, 94, 0.08)',  border: 'rgba(34, 197, 94, 0.25)',  color: '#16a34a', full: 'Present' },
  late:       { label: 'L',   bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.25)', color: '#d97706', full: 'Late' },
  absent:     { label: 'A',   bg: 'rgba(239, 68, 68, 0.08)',  border: 'rgba(239, 68, 68, 0.25)',  color: '#dc2626', full: 'Absent' },
  half_day:   { label: 'H',   bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.25)', color: '#ea580c', full: 'Half Day' },
  leave:      { label: 'LV',  bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.25)', color: '#4f46e5', full: 'On Leave' },
  on_duty:    { label: 'OD',  bg: 'rgba(6, 182, 212, 0.08)',  border: 'rgba(6, 182, 212, 0.25)',  color: '#0891b2', full: 'On Duty' },
  holiday:    { label: 'HOL', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.25)', color: '#7c3aed', full: 'Holiday' },
  weekly_off: { label: 'WO',  bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.2)',  color: '#64748b', full: 'Weekly Off' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function getAvatarBg(name) {
  const hash = Array.from(name || '').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)', // Blue
    'linear-gradient(135deg, #10b981, #047857)', // Green
    'linear-gradient(135deg, #ec4899, #be185d)', // Pink
    'linear-gradient(135deg, #8b5cf6, #6d28d9)', // Purple
    'linear-gradient(135deg, #f59e0b, #b45309)', // Amber
    'linear-gradient(135deg, #06b6d4, #0891b2)', // Cyan
  ];
  return colors[hash % colors.length];
}

export default function Attendance() {
  const { user } = useAuth();
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
  const [searchTerm, setSearchTerm] = useState('');
  const [tooltip, setTooltip] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const [correctForm, setCorrectForm] = useState({});
  const [violations, setViolations] = useState({});
  const [configs, setConfigs] = useState({});
  const [scanning, setScanning] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [hoveredCol, setHoveredCol] = useState(null);

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
      let empsData = emps.data;
      if (!user?.is_superadmin && user?.employee_id) {
        empsData = empsData.filter(e => e.id === user.employee_id);
      }
      setEmployees(empsData);
      setRecords(recs.data);
      setHolidays(hols.data || []);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }

  async function recomputeRecords() {
    if (!window.confirm('Recompute all records for this month? This will update statuses based on current shift rules.')) return;
    setLoading(true);
    try {
      await api.post('/hr/attendance/recompute', { month, year });
      toast.success('Month recomputed successfully');
      fetchData();
    } catch { toast.error('Failed to recompute'); setLoading(false); }
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

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputStyle = { 
    width: '100%', 
    padding: '8px 12px', 
    borderRadius: 8, 
    border: '1px solid var(--border)', 
    background: 'var(--bg2)', 
    color: 'var(--text)', 
    fontSize: 13, 
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  return (
    <Layout title="Attendance">
      <div style={{ padding: '0 16px 24px' }}>
        {/* Controls / Filter Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 10, padding: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '6px', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><ChevronLeft size={16} /></button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Calendar size={14} style={{ color: 'var(--accent)' }} />
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '6px', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><ChevronRight size={16} /></button>
          </div>

          {/* Search Box */}
          {user?.is_superadmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 10, padding: '6px 12px', minWidth: 220, flex: '1 1 200px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <Search size={15} style={{ color: 'var(--text3)' }} />
              <input 
                type="text" 
                placeholder="Search employee..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--text)', width: '100%', fontFamily: 'inherit' }}
              />
            </div>
          )}

          {/* Branch Select */}
          {user?.is_superadmin && (
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150, background: 'var(--bg2)', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}

          {/* Dept Select */}
          {user?.is_superadmin && (
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 150, background: 'var(--bg2)', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {/* Action Buttons */}
          {user?.is_superadmin && (
            <>
              <button 
                onClick={runViolationScan} 
                disabled={scanning} 
                className="btn" 
                style={{ 
                  background: 'var(--bg2)', 
                  border: '1px solid rgba(226, 232, 240, 0.8)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontWeight: 700, 
                  fontSize: 13,
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg2)'; e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.8)'; }}
              >
                <AlertCircle size={14} color="#f59e0b" /> {scanning ? 'Scanning...' : 'Scan Violations'}
              </button>

              <button 
                onClick={recomputeRecords} 
                className="btn btn-primary" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontWeight: 700, 
                  fontSize: 13,
                  borderRadius: 10,
                  boxShadow: '0 4px 10px rgba(25, 84, 2, 0.15)',
                  transition: 'all 0.2s'
                }}
              >
                <RefreshCw size={14} /> Recompute Month
              </button>
            </>
          )}
        </div>

        {/* Status Legend capsules shelf */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '20px', 
          flexWrap: 'wrap', 
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(226, 232, 240, 0.8)', 
          borderRadius: '12px', 
          padding: '10px 16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)', display: 'flex', alignItems: 'center', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Legend:</span>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ 
                width: 22, 
                height: 22, 
                background: v.bg, 
                border: `1px solid ${v.border}`,
                borderRadius: 6, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: v.color, 
                fontWeight: 700, 
                fontSize: v.label.length > 2 ? '7px' : '9px' 
              }}>{v.label}</div>
              <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{v.full}</span>
            </div>
          ))}
        </div>

        {/* Attendance Grid Card */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div className="spinner" style={{ width: 28, height: 28 }}></div>
            <div>Loading attendance database...</div>
          </div>
        ) : (
          <div style={{ 
            background: 'var(--bg2)',
            borderRadius: '16px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(248, 250, 252, 0.8)', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
                    {/* Employee sticky header */}
                    <th style={{ 
                      padding: '12px 18px', 
                      textAlign: 'left', 
                      minWidth: 190, 
                      position: 'sticky', 
                      left: 0, 
                      background: '#f8fafc', 
                      borderRight: '1px solid rgba(226, 232, 240, 0.8)', 
                      fontWeight: 700, 
                      zIndex: 2,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Employee
                    </th>
                    {/* Days column headers */}
                    {days.map(d => (
                      <th 
                        key={d.num} 
                        onMouseEnter={() => setHoveredCol(d.num)}
                        onMouseLeave={() => setHoveredCol(null)}
                        style={{ 
                          padding: '8px 4px', 
                          minWidth: 36, 
                          textAlign: 'center', 
                          fontWeight: 600, 
                          color: d.dayOfWeek === 'Sun' ? '#ef4444' : 'var(--text2)', 
                          background: hoveredCol === d.num ? 'rgba(25, 84, 2, 0.04)' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.3px' }}>{d.dayOfWeek}</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px' }}>{d.num}</div>
                      </th>
                    ))}
                    {/* Summary columns sticky headers */}
                    <th style={{ padding: '12px 6px', textAlign: 'center', minWidth: 36, fontWeight: 700, fontSize: '10px', color: '#16a34a', borderLeft: '1px solid rgba(226, 232, 240, 0.8)' }}>P</th>
                    <th style={{ padding: '12px 6px', textAlign: 'center', minWidth: 36, fontWeight: 700, fontSize: '10px', color: '#dc2626' }}>A</th>
                    <th style={{ padding: '12px 6px', textAlign: 'center', minWidth: 36, fontWeight: 700, fontSize: '10px', color: '#4f46e5' }}>LV</th>
                    <th style={{ padding: '12px 6px', textAlign: 'center', minWidth: 36, fontWeight: 700, fontSize: '10px', color: '#7c3aed' }}>HOL</th>
                    <th style={{ padding: '12px 6px', textAlign: 'center', minWidth: 36, fontWeight: 700, fontSize: '10px', color: '#64748b' }}>WO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={days.length + 6} style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <Users size={32} style={{ opacity: 0.2 }} />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>No employees match your search query</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredEmployees.map(emp => {
                    const empRecs = records[String(emp.id)] || {};
                    let pCount = 0, aCount = 0, lvCount = 0, holCount = 0, woCount = 0;
                    days.forEach(d => {
                      const s = getEffStatus(d, empRecs, emp);
                      if (s === 'present' || s === 'late' || s === 'on_duty') pCount += 1;
                      else if (s === 'half_day') { pCount += 0.5; aCount += 0.5; }
                      else if (s === 'absent') aCount += 1;
                      else if (s === 'leave') lvCount += 1;
                      else if (s === 'holiday') holCount += 1;
                      else if (s === 'weekly_off') woCount += 1;
                    });
                    
                    return (
                      <tr 
                        key={emp.id} 
                        style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.8)', transition: 'background-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(248, 250, 252, 0.4)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Employee Details Sticky Info cell */}
                        <td style={{ 
                          padding: '10px 16px', 
                          position: 'sticky', 
                          left: 0, 
                          background: 'var(--bg2)', 
                          borderRight: '1px solid rgba(226, 232, 240, 0.8)', 
                          fontWeight: 600, 
                          zIndex: 1,
                          boxShadow: '4px 0 8px -4px rgba(0, 0, 0, 0.05)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Name & ID */}
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', color: 'var(--text)' }}>{emp.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'monospace' }}>{emp.employee_id}</div>
                            </div>
                          </div>
                        </td>

                        {/* Status Days cells */}
                        {days.map(d => {
                          const rec = empRecs[d.dayStr];
                          const status = getEffStatus(d, empRecs, emp);
                          const cfg = status ? STATUS_CONFIG[status] : null;
                          const v = (violations[emp.id] || []).find(x => x.dayStr === d.dayStr);

                          return (
                            <td 
                              key={d.num} 
                              onMouseEnter={() => setHoveredCol(d.num)}
                              onMouseLeave={() => setHoveredCol(null)}
                              style={{ 
                                padding: '3px', 
                                textAlign: 'center', 
                                borderRight: '1px solid rgba(226, 232, 240, 0.5)', 
                                background: v ? 'rgba(249, 115, 22, 0.05)' : (hoveredCol === d.num ? 'rgba(25, 84, 2, 0.03)' : 'transparent'),
                                transition: 'background-color 0.2s'
                              }}
                            >
                              <div
                                title={v ? v.label : (cfg ? `${cfg.full} (${d.num} ${MONTH_NAMES[month-1]})\nIn: ${rec?.check_in ? new Date(rec.check_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}\nOut: ${rec?.check_out ? new Date(rec.check_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}` : (user?.is_superadmin ? `Empty (${d.num} ${MONTH_NAMES[month-1]}) - Click to correct` : `Empty (${d.num} ${MONTH_NAMES[month-1]})`))}
                                onClick={() => user?.is_superadmin && openCorrect(emp, d)}
                                style={{
                                  width: 28, height: 28, margin: '0 auto', borderRadius: 8, cursor: user?.is_superadmin ? 'pointer' : 'default',
                                  background: cfg ? cfg.bg : 'rgba(241, 245, 249, 0.6)',
                                  color: cfg ? cfg.color : 'var(--text3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 700, fontSize: cfg?.label?.length > 2 ? '8px' : '10px', 
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  border: v ? '2px solid #f97316' : (cfg ? `1px solid ${cfg.border}` : '1px dashed rgba(203, 213, 224, 0.6)'),
                                  boxShadow: cfg ? '0 1px 2px rgba(0,0,0,0.02)' : 'none',
                                  boxSizing: 'border-box'
                                }}
                                onMouseEnter={e => {
                                  if (user?.is_superadmin) {
                                    e.currentTarget.style.transform = 'scale(1.08)';
                                    if (cfg) e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (user?.is_superadmin) {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = cfg ? '0 1px 2px rgba(0,0,0,0.02)' : 'none';
                                  }
                                }}
                              >
                                {cfg ? cfg.label : '·'}
                              </div>
                            </td>
                          );
                        })}

                        {/* Summary metrics counts pills */}
                        <td style={{ textAlign: 'center', borderLeft: '1px solid rgba(226, 232, 240, 0.8)', padding: '4px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, borderRadius: 99, background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontWeight: 700, fontSize: '11px' }}>{pCount}</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, borderRadius: 99, background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 700, fontSize: '11px' }}>{aCount}</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, borderRadius: 99, background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', fontWeight: 700, fontSize: '11px' }}>{lvCount}</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, borderRadius: 99, background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 700, fontSize: '11px' }}>{holCount}</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 20, borderRadius: 99, background: 'rgba(148, 163, 184, 0.1)', color: '#64748b', fontWeight: 700, fontSize: '11px' }}>{woCount}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Correction Modal */}
      {correcting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 28, width: 440, maxWidth: '95vw', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(25, 84, 2, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Correct Attendance</h3>
                <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>{correcting.emp.name} — {correcting.day.dayStr}</p>
              </div>
            </div>
            
            <div style={{ height: '1px', background: 'rgba(226, 232, 240, 0.8)', margin: '16px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                <select value={correctForm.status} onChange={e => setCorrectForm({ ...correctForm, status: e.target.value })} style={{ ...inputStyle, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Check In</label>
                <input type="datetime-local" value={correctForm.check_in} onChange={e => setCorrectForm({ ...correctForm, check_in: e.target.value })} style={{ ...inputStyle, background: 'var(--bg3)', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Check Out</label>
                <input type="datetime-local" value={correctForm.check_out} onChange={e => setCorrectForm({ ...correctForm, check_out: e.target.value })} style={{ ...inputStyle, background: 'var(--bg3)', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason for Correction *</label>
                <textarea value={correctForm.correction_reason} onChange={e => setCorrectForm({ ...correctForm, correction_reason: e.target.value })} style={{ ...inputStyle, minHeight: 70, resize: 'vertical', background: 'var(--bg3)', border: '1px solid var(--border)' }} placeholder="e.g. Card not swiped / Forgot to punch..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setCorrecting(null)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none', borderRadius: 8, fontWeight: 600 }}>Cancel</button>
              <button onClick={saveCorrection} className="btn btn-primary" style={{ flex: 1, borderRadius: 8, fontWeight: 600, boxShadow: '0 4px 10px rgba(25, 84, 2, 0.15)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
