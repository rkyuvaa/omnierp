import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import {
  Calendar, Clock, UserCheck, Users, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle, XCircle, Loader2, MapPin, Briefcase, Shield
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Modal } from '../components/Shared';
import TwoFactorSetup from '../components/TwoFactorSetup';

// ─── Helpers ───────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateFriendly(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function datesBetween(from, to) {
  const dates = [];
  let cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur <= end) {
    dates.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hh = parseInt(h);
  return `${hh % 12 || 12}:${m} ${hh >= 12 ? 'PM' : 'AM'}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Consistent, muted green style for employee event bars and avatars
const EMP_STYLE = {
  bg: '#f0fdf4',
  text: '#166534',
  border: '#bbf7d0',
  accent: '#16a34a',
  light: '#f0fdf4',
};

function empColor() {
  return EMP_STYLE;
}

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    approved: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', icon: <CheckCircle size={10} />, label: 'Approved' },
    pending:  { bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: <AlertCircle size={10} />, label: 'Pending' },
    rejected: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', icon: <XCircle size={10} />,     label: 'Rejected' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px',
      borderRadius:99, background:s.bg, color:s.color, border:`1px solid ${s.border}`, fontSize:10, fontWeight:600 }}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 28 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background: EMP_STYLE.bg,
      color: EMP_STYLE.text, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size < 30 ? 9.5 : 11, fontWeight:700, flexShrink:0, border:`1px solid ${EMP_STYLE.border}` }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Leave & Holiday Calendar with Names inside Tiles ────────────────────────
function LeaveCalendar({ leaveEvents, odEvents, holidayEvents }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = isoDate(today);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Build quick lookup maps: date → array of events
  const leaveMap = {};
  (leaveEvents || []).forEach((ev, idx) => {
    datesBetween(ev.from_date, ev.to_date).forEach(d => {
      if (!leaveMap[d]) leaveMap[d] = [];
      leaveMap[d].push({ ...ev, _idx: idx });
    });
  });

  const odMap = {};
  (odEvents || []).forEach((ev, idx) => {
    const d = ev.date;
    if (!odMap[d]) odMap[d] = [];
    odMap[d].push({ ...ev, _odIdx: idx });
  });

  const holidayMap = {};
  (holidayEvents || []).forEach((ev, idx) => {
    const d = isoDate(ev.date);
    if (!d) return;
    if (!holidayMap[d]) holidayMap[d] = [];
    holidayMap[d].push({ ...ev, _holIdx: idx });
  });

  const prev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const next = () => {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  // Build 42 grid cells to always have exactly 6 weeks
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) {
    cells.push(null);
  }

  const selectedLeaves = leaveMap[selectedDate] || [];
  const selectedOds = odMap[selectedDate] || [];
  const selectedHolidays = holidayMap[selectedDate] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.2px' }}>
          {MONTHS[month]} {year}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={prev} style={navBtn}><ChevronLeft size={14} /></button>
          <button onClick={next} style={navBtn}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 2, flexShrink: 0 }}>
        {SHORT_DAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600,
            color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="day-cells-grid">
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`empty-${i}`} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6
              }} />
            );
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const leaves = leaveMap[dateStr] || [];
          const ods = odMap[dateStr] || [];
          const hols = holidayMap[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasHoliday = hols.length > 0;
          const hasOd = ods.length > 0;

          return (
            <div
              key={day}
              onClick={() => setSelectedDate(dateStr)}
              style={{
                borderRadius: 6,
                padding: '4px 6px',
                background: hasHoliday
                  ? '#fffbeb'
                  : isSelected
                    ? '#f8fafc'
                    : '#ffffff',
                border: isToday
                  ? '1px solid #86efac'
                  : hasHoliday
                    ? '1px solid #fde68a'
                    : isSelected
                      ? '1px solid #94a3b8'
                      : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
              }}
              className="calendar-day-cell"
            >
              {/* Day number & Header line */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 2,
                flexShrink: 0,
                position: 'relative'
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 600,
                  color: isToday ? '#166534' : hasHoliday ? '#92400e' : 'var(--text2)',
                  background: isToday ? '#dcfce7' : 'transparent',
                  minWidth: 18,
                  height: 18,
                  padding: isToday ? '0 4px' : 0,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }}>{day}</span>

                {hasHoliday && (
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    color: '#b45309',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    padding: '0px 5px',
                    borderRadius: 4,
                    lineHeight: 1.4,
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    Holiday
                  </span>
                )}

                {hasOd && (
                  <span title={`${ods.length} On Duty`} style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#0d9488',
                    marginLeft: hasHoliday ? 4 : 'auto',
                    zIndex: 2
                  }} />
                )}
              </div>

              {/* Event list inside cell (Desktop) */}
              <div className="cell-event-list scroll-list" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Holidays - Clean readable label */}
                {hols.map((h, hi) => (
                  <div
                    key={`h-${hi}`}
                    title={`Holiday: ${h.name} (${h.holiday_type === 'national' ? 'National' : (h.branch_name || 'Company')})`}
                    style={{
                      color: '#92400e',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      padding: '2px 4px',
                      borderRadius: 4,
                      background: 'rgba(254, 243, 199, 0.55)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3
                    }}
                  >
                    {h.name}
                  </div>
                ))}

                {/* Leaves - consistent muted green bar with subtle status indicator */}
                {leaves.map((l, li) => {
                  const isPending = l.status === 'pending';
                  return (
                    <div
                      key={`l-${li}`}
                      title={`${l.employee_name}${isPending ? ' (Pending)' : ''}`}
                      style={{
                        background: '#f0fdf4',
                        color: '#166534',
                        fontSize: '10px',
                        fontWeight: 500,
                        padding: '1.5px 5px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        border: '1px solid #dcfce7',
                        borderLeft: isPending ? '2.5px solid #d97706' : '2.5px solid #16a34a',
                        marginTop: 1
                      }}
                    >
                      {l.employee_name}
                    </div>
                  );
                })}
              </div>

              {/* Mobile dots indicators (Mobile) */}
              <div className="cell-dot-container">
                {hols.map((h, idx) => (
                  <span
                    key={`h-${idx}`}
                    title={`Holiday: ${h.name}`}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#d97706',
                      display: 'inline-block'
                    }}
                  />
                ))}
                {leaves.map((l, idx) => {
                  const isPending = l.status === 'pending';
                  return (
                    <span 
                      key={`l-${idx}`} 
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: isPending ? '#d97706' : '#16a34a',
                        display: 'inline-block'
                      }} 
                    />
                  );
                })}
                {ods.map((o, idx) => (
                  <span 
                    key={`o-${idx}`} 
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#0d9488',
                      display: 'inline-block'
                    }} 
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexShrink: 0, borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 2, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fffbeb', border: '1px solid #fde68a', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>Holiday</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '2.5px solid #16a34a', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>Approved Leave</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '2.5px solid #d97706', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>Pending Leave</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>On-Duty</span>
        </div>
      </div>

      {/* Selected Day Details Panel for Mobile */}
      <div className="selected-day-details">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Schedule: {formatDateFriendly(selectedDate)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>
            {selectedHolidays.length + selectedLeaves.length + selectedOds.length} Events
          </span>
        </div>

        {/* Selected Holidays */}
        {selectedHolidays.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Holidays ({selectedHolidays.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedHolidays.map((h, hi) => (
                <div key={hi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                      {h.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize' }}>
                    {h.holiday_type || 'Holiday'} ({h.branch_name || 'All Branches'})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Leaves */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Leaves ({selectedLeaves.length})
          </div>
          {selectedLeaves.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', paddingLeft: 4 }}>No leaves scheduled</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedLeaves.map((l, li) => (
                <div key={li} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={l.employee_name} size={24} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {l.employee_name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>
                      {l.leave_type_name}
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected On-Duty */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            On-Duty ({selectedOds.length})
          </div>
          {selectedOds.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', paddingLeft: 4 }}>No on-duty scheduled</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedOds.map((o, oi) => (
                <div key={oi} style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={o.employee_name} size={24} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        {o.employee_name}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>
                      {formatTime(o.from_time)} – {formatTime(o.to_time)}
                    </span>
                  </div>
                  {o.work_location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#0f766e', fontWeight: 600, paddingLeft: 32 }}>
                      <MapPin size={10} />{o.work_location}
                    </div>
                  )}
                  {o.purpose && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', paddingLeft: 32 }}>
                      "{o.purpose}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtn = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--text2)',
  padding: 0
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [showMfaSuggestion, setShowMfaSuggestion] = useState(false);
  const [showMfaSetupForm, setShowMfaSetupForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState([]);
  const [onduty, setOnduty] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const today = isoDate(new Date());

  useEffect(() => {
    if (user && !user.totp_enabled && sessionStorage.getItem('mfaSuggestionDismissed') !== 'true') {
      const timer = setTimeout(() => {
        setShowMfaSuggestion(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    if (user?.totp_enabled && showMfaSuggestion) {
      setShowMfaSuggestion(false);
    }
  }, [user?.totp_enabled, showMfaSuggestion]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lv, od, hol] = await Promise.all([
        api.get('/hr/leave/all').catch(() => ({ data: [] })),
        api.get('/hr/onduty/all').catch(() => ({ data: [] })),
        api.get('/hr/holidays/').catch(() => ({ data: [] })),
      ]);
      setLeaves(lv.data || []);
      setOnduty(od.data || []);
      setHolidays(hol.data || []);
    } catch (e) {
      console.error('Dashboard load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Calendar events: approved + pending + auto_approved leaves & OD
  const calendarLeaves = leaves.filter(l => 
    ['approved', 'pending', 'auto_approved'].includes(l.status)
  );
  const calendarOd = onduty.filter(o => 
    ['approved', 'pending', 'auto_approved'].includes(o.status)
  );

  // On Duty Today (approved, auto_approved, & pending OD records for today)
  const onDutyToday = onduty.filter(o =>
    ['approved', 'auto_approved', 'pending'].includes(o.status) && o.date === today
  );

  // Planned On-Duty (approved, auto_approved, & pending upcoming OD records)
  const plannedOnDuty = onduty
    .filter(o => ['approved', 'auto_approved', 'pending'].includes(o.status) && o.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>Loading workforce data…</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulseShield {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45, 90, 39, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(45, 90, 39, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45, 90, 39, 0); }
        }
        .dash-card { background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; }
        .dash-sec-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.6px; color:var(--text3); margin-bottom:6px; display:flex; align-items:center; gap:6px; }
        .emp-row { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f1f5f9; }
        .emp-row:last-child { border-bottom:none; }
        .scroll-list { overflow-y:auto; flex:1; padding-right:2px; }
        .scroll-list::-webkit-scrollbar { width:3px; }
        .scroll-list::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }

        /* Responsive Grid & Columns */
        .dash-grid {
          display: grid;
          grid-template-columns: 1fr 270px;
          gap: 10px;
          height: calc(100vh - 44px - 16px);
          overflow: hidden;
        }
        .calendar-card {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .right-column-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow: hidden;
        }
        .onduty-card {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex: 1;
        }
        .day-cells-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-template-rows: repeat(6, 1fr);
          gap: 4px;
          flex: 1;
          overflow: hidden;
        }
        .cell-event-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          overflow-y: auto;
        }
        .cell-dot-container {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 3px;
          margin-top: auto;
          flex-wrap: wrap;
          padding-top: 2px;
        }
        .selected-day-details {
          display: none;
          margin-top: 12px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        /* Hover and pointer effects */
        .calendar-day-cell {
          cursor: pointer;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .calendar-day-cell:hover {
          border-color: #cbd5e1 !important;
        }

        @media (max-width: 1024px) {
          .dash-grid {
            grid-template-columns: 1fr;
            height: auto;
            overflow: visible;
          }
          .calendar-card {
            overflow: visible;
            height: auto;
          }
          .right-column-container {
            overflow: visible;
            height: auto;
          }
          .onduty-card {
            height: 320px;
            flex: none;
          }
          .day-cells-grid {
            grid-template-rows: auto;
            aspect-ratio: 1.3;
          }
          .cell-event-list {
            display: none !important;
          }
          .cell-dot-container {
            display: flex;
          }
          .selected-day-details {
            display: block;
          }
        }
      `}</style>

      {/* Grid container with exactly two columns, occupying full height without body overflow */}
      <div className="dash-grid">

        {/* ── Left Column: Calendar ── */}
        <div className="dash-card calendar-card">
          <div className="dash-sec-title" style={{ flexShrink: 0 }}>
            <Calendar size={13} style={{ color: '#166534' }} />
            Workforce & Holiday Calendar
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LeaveCalendar leaveEvents={calendarLeaves} odEvents={calendarOd} holidayEvents={holidays} />
          </div>
        </div>

        {/* ── Right Column: Stacked On-Duty Panels ── */}
        <div className="right-column-container">

          {/* Currently On Duty */}
          <div className="dash-card onduty-card">
            <div className="dash-sec-title" style={{ flexShrink: 0 }}>
              <UserCheck size={13} style={{ color: '#166534' }} />
              Currently On Duty
              {onDutyToday.length > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99
                }}>
                  {onDutyToday.length} Active
                </span>
              )}
            </div>
            <div className="scroll-list" style={{ display: 'flex', flexDirection: 'column' }}>
              {onDutyToday.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px 0',
                  gap: 8,
                  flex: 1,
                  margin: 'auto'
                }}>
                  <UserCheck size={26} style={{ color: '#cbd5e1' }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>No one on duty today</span>
                </div>
              ) : (
                onDutyToday.map((o) => {
                  return (
                    <div key={o.id} className="emp-row" style={{ gap: 8 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={o.employee_name} size={30} />
                        <span style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: o.status === 'pending' ? '#d97706' : '#16a34a',
                          border: '1.5px solid #ffffff'
                        }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.employee_name}
                          </span>
                          {o.status === 'pending' && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 600,
                              background: '#fffbeb',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              padding: '0px 5px',
                              borderRadius: 4,
                              textTransform: 'uppercase'
                            }}>
                              Pending
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                          {formatTime(o.from_time)} – {formatTime(o.to_time)}
                        </div>
                        {o.work_location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#0f766e', fontWeight: 500 }}>
                            <MapPin size={9} />{o.work_location}
                          </div>
                        )}
                        {o.purpose && (
                          <div style={{
                            fontSize: 10,
                            color: 'var(--text3)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {o.purpose}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Planned On-Duty */}
          <div className="dash-card onduty-card">
            <div className="dash-sec-title" style={{ flexShrink: 0 }}>
              <Briefcase size={13} style={{ color: '#64748b' }} />
              Planned On-Duty
              {plannedOnDuty.length > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0',
                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99
                }}>
                  {plannedOnDuty.length} Upcoming
                </span>
              )}
            </div>
            <div className="scroll-list" style={{ display: 'flex', flexDirection: 'column' }}>
              {plannedOnDuty.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px 0',
                  gap: 8,
                  flex: 1,
                  margin: 'auto'
                }}>
                  <Briefcase size={26} style={{ color: '#cbd5e1' }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>No upcoming on-duty schedules</span>
                </div>
              ) : (
                plannedOnDuty.map((o) => {
                  return (
                    <div key={o.id} className="emp-row" style={{ gap: 8 }}>
                      <Avatar name={o.employee_name} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.employee_name}
                          </span>
                          {o.status === 'pending' && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 600,
                              background: '#fffbeb',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              padding: '0px 5px',
                              borderRadius: 4,
                              textTransform: 'uppercase'
                            }}>
                              Pending
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                          <Clock size={9} />
                          {o.date} · {formatTime(o.from_time)} – {formatTime(o.to_time)}
                        </div>
                        {o.work_location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text3)' }}>
                            <MapPin size={9} />{o.work_location}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
      {showMfaSuggestion && (
        <Modal 
          title="Security Suggestion" 
          onClose={() => {
            sessionStorage.setItem('mfaSuggestionDismissed', 'true');
            setShowMfaSuggestion(false);
          }}
        >
          {!showMfaSetupForm ? (
            <div style={{ textAlign: 'center', padding: '10px 12px' }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                animation: 'pulseShield 2s infinite'
              }}>
                <Shield size={32} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Enable Two-Factor Authentication
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 24 }}>
                Protect your account from unauthorized access by adding an extra layer of security. Verify logins using an authenticator app (like Google Authenticator or Microsoft Authenticator).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '10px 16px', fontWeight: 700 }}
                  onClick={() => setShowMfaSetupForm(true)}
                >
                  Configure Authenticator Now
                </button>
                <button 
                  className="btn btn-ghost" 
                  style={{ width: '100%', color: 'var(--text3)', fontWeight: 600 }}
                  onClick={() => {
                    sessionStorage.setItem('mfaSuggestionDismissed', 'true');
                    setShowMfaSuggestion(false);
                  }}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button 
                className="btn btn-ghost" 
                style={{ fontSize: 12, padding: '4px 8px', marginBottom: 12, color: 'var(--text2)' }}
                onClick={() => setShowMfaSetupForm(false)}
              >
                ← Back to suggestion
              </button>
              <TwoFactorSetup />
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
}
