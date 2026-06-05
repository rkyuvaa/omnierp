import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import {
  Calendar, Clock, UserCheck, Users, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle, XCircle, Loader2, MapPin, Briefcase
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoDate(d) {
  if (!d) return '';
  return typeof d === 'string' ? d.slice(0,10) : d.toISOString().slice(0,10);
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

// Pastel colour palette for employees on calendar
const EMP_COLORS = [
  { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
  { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  { bg: '#fce7f3', text: '#9d174d', dot: '#ec4899' },
  { bg: '#ede9fe', text: '#5b21b6', dot: '#7c3aed' },
  { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  { bg: '#e0f2fe', text: '#075985', dot: '#0ea5e9' },
  { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
];

function empColor(idx) {
  return EMP_COLORS[idx % EMP_COLORS.length];
}

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    approved: { bg: '#dcfce7', color: '#166534', icon: <CheckCircle size={10} />, label: 'Approved' },
    pending:  { bg: '#fef3c7', color: '#92400e', icon: <AlertCircle size={10} />, label: 'Pending' },
    rejected: { bg: '#fee2e2', color: '#991b1b', icon: <XCircle size={10} />,     label: 'Rejected' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px',
      borderRadius:99, background:s.bg, color:s.color, fontSize:10, fontWeight:700 }}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 28 }) {
  const c = color || EMP_COLORS[0];
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:c.bg,
      color:c.text, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size < 30 ? 9 : 11, fontWeight:800, flexShrink:0, border:`1.5px solid ${c.dot}20` }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Leave Calendar with Names inside Tiles ────────────────────────────────
function LeaveCalendar({ leaveEvents, odEvents }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = isoDate(today);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
          {MONTHS[month]} {year}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={prev} style={navBtn}><ChevronLeft size={15} /></button>
          <button onClick={next} style={navBtn}><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4, flexShrink: 0 }}>
        {SHORT_DAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 700,
            color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: 4,
        flex: 1,
        overflow: 'hidden'
      }}>
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`empty-${i}`} style={{
                background: 'var(--bg3)',
                opacity: 0.25,
                border: '1px solid var(--border)',
                borderRadius: 6
              }} />
            );
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const leaves = leaveMap[dateStr] || [];
          const ods = odMap[dateStr] || [];
          const isToday = dateStr === todayStr;
          const hasLeave = leaves.length > 0;
          const hasOd = ods.length > 0;

          return (
            <div key={day} style={{
              borderRadius: 6,
              padding: 4,
              background: isToday ? 'var(--bg3)' : 'var(--bg2)',
              border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.15s'
            }}>
              {/* Day number & OD dot */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 2,
                flexShrink: 0
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: isToday ? 850 : 600,
                  color: isToday ? 'var(--accent)' : 'var(--text)',
                  background: isToday ? 'var(--accent-dim)' : 'transparent',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>{day}</span>

                {hasOd && (
                  <span title={`${ods.length} On Duty`} style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    border: '1px solid var(--bg2)'
                  }} />
                )}
              </div>

              {/* Leaves text list inside cell */}
              <div className="scroll-list" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                flex: 1,
                overflowY: 'auto'
              }}>
                {leaves.map((l, li) => {
                  const c = empColor(l._idx);
                  const isPending = l.status === 'pending';
                  return (
                    <div
                      key={li}
                      title={`${l.employee_name} (${l.leave_type_name}${isPending ? ' - Pending' : ''})`}
                      style={{
                        background: c.bg,
                        color: c.text,
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '1px 3px',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        borderLeft: `2px solid ${c.dot}`,
                        opacity: isPending ? 0.7 : 1,
                        borderStyle: isPending ? 'dashed' : 'solid',
                        borderWidth: isPending ? '1px 1px 1px 2px' : '0 0 0 2px',
                        borderColor: isPending ? `${c.dot}70` : 'transparent'
                      }}
                    >
                      {l.employee_name}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#dbeafe', borderLeft: '2.5px solid #3b82f6', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>Approved Leave</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#fee2e2', borderLeft: '2.5px solid #ef4444', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>Pending Leave</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>On-Duty</span>
        </div>
      </div>
    </div>
  );
}

const navBtn = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--text2)',
  padding: 0
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState([]);
  const [onduty, setOnduty] = useState([]);
  const today = isoDate(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lv, od] = await Promise.all([
        api.get('/hr/leave/all').catch(() => ({ data: [] })),
        api.get('/hr/onduty/all').catch(() => ({ data: [] })),
      ]);
      setLeaves(lv.data || []);
      setOnduty(od.data || []);
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
  const calendarLeaves = leaves.filter(l => ['approved', 'pending', 'auto_approved'].includes(l.status));
  const calendarOd = onduty.filter(o => ['approved', 'pending', 'auto_approved'].includes(o.status));

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
        .dash-card { background:var(--bg2); border:1px solid var(--border); border-radius:10px; }
        .dash-sec-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--text3); margin-bottom:10px; display:flex; align-items:center; gap:6px; }
        .emp-row { display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:1px solid var(--border); }
        .emp-row:last-child { border-bottom:none; }
        .scroll-list { overflow-y:auto; flex:1; padding-right:2px; }
        .scroll-list::-webkit-scrollbar { width:3px; }
        .scroll-list::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
      `}</style>

      {/* Grid container with exactly two columns, occupying full height without body overflow */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 12,
        height: 'calc(100vh - 56px - 48px)',
        overflow: 'hidden'
      }}>

        {/* ── Left Column: Calendar ── */}
        <div className="dash-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="dash-sec-title" style={{ flexShrink: 0 }}>
            <Calendar size={13} style={{ color: 'var(--accent)' }} />
            Workforce Leave Calendar
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LeaveCalendar leaveEvents={calendarLeaves} odEvents={calendarOd} />
          </div>
        </div>

        {/* ── Right Column: Stacked On-Duty Panels ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

          {/* Currently On Duty */}
          <div className="dash-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            <div className="dash-sec-title" style={{ flexShrink: 0 }}>
              <UserCheck size={13} style={{ color: '#10b981' }} />
              Currently On Duty
              {onDutyToday.length > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#d1fae5', color: '#065f46',
                  fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99
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
                  <UserCheck size={28} style={{ color: 'var(--border2)', opacity: 0.5 }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>No one on duty today</span>
                </div>
              ) : (
                onDutyToday.map((o, i) => {
                  const c = empColor(i + 5);
                  return (
                    <div key={o.id} className="emp-row" style={{ gap: 8 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={o.employee_name} color={c} size={32} />
                        <span style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: o.status === 'pending' ? '#f59e0b' : '#10b981',
                          border: '1.5px solid var(--bg2)'
                        }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.employee_name}
                          </span>
                          {o.status === 'pending' && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '1px 5px',
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#10b981', fontWeight: 600 }}>
                            <MapPin size={9} />{o.work_location}
                          </div>
                        )}
                        {o.purpose && (
                          <div style={{
                            fontSize: 10,
                            color: 'var(--text3)',
                            fontStyle: 'italic',
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
          <div className="dash-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            <div className="dash-sec-title" style={{ flexShrink: 0 }}>
              <Briefcase size={13} style={{ color: '#f59e0b' }} />
              Planned On-Duty
              {plannedOnDuty.length > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#fef3c7', color: '#92400e',
                  fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99
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
                  <Briefcase size={28} style={{ color: 'var(--border2)', opacity: 0.5 }} />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>No upcoming on-duty schedules</span>
                </div>
              ) : (
                plannedOnDuty.map((o, i) => {
                  const c = empColor(i + 12);
                  return (
                    <div key={o.id} className="emp-row" style={{ gap: 8 }}>
                      <Avatar name={o.employee_name} color={c} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.employee_name}
                          </span>
                          {o.status === 'pending' && (
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '1px 5px',
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
    </Layout>
  );
}
