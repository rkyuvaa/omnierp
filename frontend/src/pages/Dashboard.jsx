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

// ─── Mini calendar ──────────────────────────────────────────────────────────
function LeaveCalendar({ leaveEvents, odEvents }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = isoDate(today);

  // Build quick lookup maps  date → array of events
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

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:0 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>
          {MONTHS[month]} {year}
        </span>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={prev} style={navBtn}><ChevronLeft size={14}/></button>
          <button onClick={next} style={navBtn}><ChevronRight size={14}/></button>
        </div>
      </div>

      {/* Day names */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {SHORT_DAYS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:9, fontWeight:700,
            color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5 }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, flex:1 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const leaves = leaveMap[dateStr] || [];
          const ods = odMap[dateStr] || [];
          const isToday = dateStr === todayStr;
          const hasLeave = leaves.length > 0;
          const hasOd = ods.length > 0;

          return (
            <div key={day} title={
              [...leaves.map(l => `Leave: ${l.employee_name}`),
               ...ods.map(o => `OD: ${o.employee_name}`)].join('\n') || undefined
            } style={{
              minHeight:38, borderRadius:6, padding:'3px 2px',
              background: isToday ? 'var(--accent)' : (hasLeave || hasOd) ? 'var(--bg3)' : 'transparent',
              border: isToday ? 'none' : '1px solid transparent',
              display:'flex', flexDirection:'column', alignItems:'center',
              cursor: (hasLeave || hasOd) ? 'pointer' : 'default',
              transition:'all 0.15s',
            }}>
              <span style={{
                fontSize:11, fontWeight: isToday ? 800 : 500,
                color: isToday ? 'white' : 'var(--text)',
                lineHeight:1.4,
              }}>{day}</span>

              {/* Dots row */}
              {(hasLeave || hasOd) && (
                <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center', marginTop:1 }}>
                  {leaves.slice(0,2).map((l,li) => {
                    const c = empColor(l._idx);
                    return <span key={`l${li}`} style={{ width:5, height:5, borderRadius:'50%', background: isToday ? 'white' : c.dot }} />;
                  })}
                  {leaves.length > 2 && <span style={{ fontSize:7, color: isToday ? 'white' : 'var(--text3)', lineHeight:1.2 }}>+{leaves.length-2}</span>}
                  {ods.slice(0,2).map((o,oi) => {
                    const c = empColor(o._odIdx + 20);
                    return <span key={`o${oi}`} style={{ width:5, height:5, borderRadius:'50%', background: isToday ? 'white' : c.dot, border: `1px solid ${isToday ? 'white' : '#fff'}` }} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, marginTop:8, borderTop:'1px solid var(--border)', paddingTop:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#3b82f6', display:'inline-block' }}/>
          <span style={{ fontSize:10, color:'var(--text3)' }}>Leave</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#f59e0b', border:'1px solid #fff', display:'inline-block' }}/>
          <span style={{ fontSize:10, color:'var(--text3)' }}>On-Duty</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', display:'inline-block' }}/>
          <span style={{ fontSize:10, color:'var(--text3)' }}>Today</span>
        </div>
      </div>
    </div>
  );
}

const navBtn = {
  background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:6,
  width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center',
  cursor:'pointer', color:'var(--text2)', padding:0
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

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const approvedLeaves = leaves.filter(l => l.status === 'approved');
  const pendingLeaves  = leaves.filter(l => l.status === 'pending');

  // Calendar events — approved + pending leaves
  const calendarLeaves = leaves.filter(l => ['approved','pending'].includes(l.status));
  const calendarOd     = onduty.filter(o => ['approved','pending'].includes(o.status));

  // On Leave Today
  const onLeaveToday = approvedLeaves.filter(l =>
    l.from_date <= today && l.to_date >= today
  );

  // On Duty Today (approved OD records for today)
  const onDutyToday = onduty.filter(o =>
    o.status === 'approved' && o.date === today
  );

  // Upcoming leaves in next 7 days
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const in7Str = isoDate(in7);
  const upcomingLeaves = approvedLeaves
    .filter(l => l.from_date > today && l.from_date <= in7Str)
    .sort((a, b) => a.from_date.localeCompare(b.from_date));

  // Upcoming OD in next 7 days
  const upcomingOd = onduty
    .filter(o => o.status === 'approved' && o.date > today && o.date <= in7Str)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Stats
  const stats = [
    { label: 'On Leave Today',   value: onLeaveToday.length, icon: <Calendar size={16}/>, color:'#3b82f6', dim:'#dbeafe', textColor:'#1d4ed8' },
    { label: 'On Duty Today',    value: onDutyToday.length,  icon: <Briefcase size={16}/>, color:'#f59e0b', dim:'#fef3c7', textColor:'#92400e' },
    { label: 'Pending Approvals',value: pendingLeaves.length + onduty.filter(o=>o.status==='pending').length,
      icon: <AlertCircle size={16}/>, color:'#ef4444', dim:'#fee2e2', textColor:'#991b1b' },
    { label: 'Upcoming (7d)',    value: upcomingLeaves.length + upcomingOd.length,
      icon: <Clock size={16}/>, color:'var(--accent)', dim:'var(--accent-dim)', textColor:'var(--accent)' },
  ];

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
          <Loader2 size={32} style={{ animation:'spin 1s linear infinite', color:'var(--accent)' }} />
          <span style={{ color:'var(--text3)', fontSize:13 }}>Loading workforce data…</span>
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

      {/* Single-screen wrapper — no external scroll */}
      <div style={{ display:'flex', flexDirection:'column', gap:12,
        height:'calc(100vh - 56px - 48px)', overflow:'hidden' }}>

        {/* ── Row 1: Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, flexShrink:0 }}>
          {stats.map(s => (
            <div key={s.label} className="dash-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:s.dim,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ color:s.color }}>{s.icon}</span>
              </div>
              <div>
                <div style={{ fontSize:24, fontWeight:800, color:s.textColor, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, fontWeight:500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 2: Main body (3 columns) ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.15fr 300px', gap:12, flex:1, overflow:'hidden' }}>

          {/* ── Col 1: Calendar ── */}
          <div className="dash-card" style={{ padding:'16px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div className="dash-sec-title">
              <Calendar size={13} style={{ color:'var(--accent)' }}/>
              Leave Calendar
            </div>
            <LeaveCalendar leaveEvents={calendarLeaves} odEvents={calendarOd} />
          </div>

          {/* ── Col 2: Upcoming + Pending lists ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, overflow:'hidden' }}>

            {/* Upcoming Leaves */}
            <div className="dash-card" style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div className="dash-sec-title">
                <Calendar size={13} style={{ color:'#3b82f6' }}/>
                Upcoming Leaves
                <span style={{ marginLeft:'auto', background:'#dbeafe', color:'#1d4ed8',
                  fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99 }}>
                  Next 7 days
                </span>
              </div>
              <div className="scroll-list">
                {upcomingLeaves.length === 0 && onLeaveToday.length === 0 ? (
                  <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12, padding:'20px 0' }}>No upcoming leaves</div>
                ) : (
                  <>
                    {onLeaveToday.map((l, i) => {
                      const c = empColor(i);
                      return (
                        <div key={l.id} className="emp-row">
                          <Avatar name={l.employee_name} color={c} size={28}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {l.employee_name}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text3)' }}>
                              {l.leave_type_name} · {l.total_days}d · Today
                            </div>
                          </div>
                          <div style={{ background:'#dcfce7', color:'#166534', fontSize:9, fontWeight:700,
                            padding:'2px 7px', borderRadius:99, flexShrink:0 }}>ON LEAVE</div>
                        </div>
                      );
                    })}
                    {upcomingLeaves.map((l, i) => {
                      const c = empColor(onLeaveToday.length + i);
                      return (
                        <div key={l.id} className="emp-row">
                          <Avatar name={l.employee_name} color={c} size={28}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {l.employee_name}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text3)' }}>
                              {l.leave_type_name} · {l.from_date} → {l.to_date}
                            </div>
                          </div>
                          <span style={{ fontSize:10, color:'#1d4ed8', fontWeight:600, flexShrink:0, background:'#dbeafe', padding:'2px 6px', borderRadius:6 }}>
                            {l.total_days}d
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Planned On-Duty */}
            <div className="dash-card" style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div className="dash-sec-title">
                <Briefcase size={13} style={{ color:'#f59e0b' }}/>
                Planned On-Duty Schedules
                <span style={{ marginLeft:'auto', background:'#fef3c7', color:'#92400e',
                  fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99 }}>
                  Next 7 days
                </span>
              </div>
              <div className="scroll-list">
                {upcomingOd.length === 0 && onDutyToday.length === 0 ? (
                  <div style={{ textAlign:'center', color:'var(--text3)', fontSize:12, padding:'20px 0' }}>No on-duty schedules</div>
                ) : (
                  <>
                    {onDutyToday.map((o, i) => {
                      const c = empColor(i + 15);
                      return (
                        <div key={o.id} className="emp-row">
                          <Avatar name={o.employee_name} color={c} size={28}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {o.employee_name}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}>
                              <Clock size={9}/>
                              {formatTime(o.from_time)} – {formatTime(o.to_time)}
                              {o.work_location && <><MapPin size={9}/>{o.work_location}</>}
                            </div>
                          </div>
                          <div style={{ background:'#fef3c7', color:'#92400e', fontSize:9, fontWeight:700,
                            padding:'2px 7px', borderRadius:99, flexShrink:0 }}>TODAY</div>
                        </div>
                      );
                    })}
                    {upcomingOd.map((o, i) => {
                      const c = empColor(i + 20 + onDutyToday.length);
                      return (
                        <div key={o.id} className="emp-row">
                          <Avatar name={o.employee_name} color={c} size={28}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {o.employee_name}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}>
                              <Clock size={9}/>
                              {o.date} · {formatTime(o.from_time)} – {formatTime(o.to_time)}
                            </div>
                            {o.work_location && (
                              <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'var(--text3)' }}>
                                <MapPin size={9}/>{o.work_location}
                              </div>
                            )}
                          </div>
                          <StatusBadge status={o.status}/>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Col 3: Right Panel (On-Duty Now + Pending Approvals) ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, overflow:'hidden' }}>

            {/* Currently On Duty */}
            <div className="dash-card" style={{ padding:'14px 16px', display:'flex', flexDirection:'column', overflow:'hidden', flex: onDutyToday.length > 0 ? '1.2' : '0.5' }}>
              <div className="dash-sec-title">
                <UserCheck size={13} style={{ color:'#10b981' }}/>
                Currently On Duty
                {onDutyToday.length > 0 && (
                  <span style={{ marginLeft:'auto', background:'#d1fae5', color:'#065f46',
                    fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99 }}>
                    {onDutyToday.length} Active
                  </span>
                )}
              </div>
              <div className="scroll-list">
                {onDutyToday.length === 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    padding:'20px 0', gap:8 }}>
                    <UserCheck size={28} style={{ color:'var(--border2)', opacity:0.5 }}/>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>No one on duty today</span>
                  </div>
                ) : (
                  onDutyToday.map((o, i) => {
                    const c = empColor(i + 5);
                    return (
                      <div key={o.id} className="emp-row" style={{ gap:8 }}>
                        <div style={{ position:'relative', flexShrink:0 }}>
                          <Avatar name={o.employee_name} color={c} size={32}/>
                          <span style={{ position:'absolute', bottom:0, right:0, width:8, height:8,
                            borderRadius:'50%', background:'#10b981', border:'1.5px solid var(--bg2)' }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {o.employee_name}
                          </div>
                          <div style={{ fontSize:10, color:'var(--text3)' }}>
                            {formatTime(o.from_time)} – {formatTime(o.to_time)}
                          </div>
                          {o.work_location && (
                            <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#10b981', fontWeight:600 }}>
                              <MapPin size={9}/>{o.work_location}
                            </div>
                          )}
                          {o.purpose && (
                            <div style={{ fontSize:10, color:'var(--text3)', fontStyle:'italic', overflow:'hidden',
                              textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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

            {/* Pending Approvals (combined leave + OD) */}
            <div className="dash-card" style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div className="dash-sec-title">
                <AlertCircle size={13} style={{ color:'#ef4444' }}/>
                Pending Approvals
                {(pendingLeaves.length + onduty.filter(o=>o.status==='pending').length) > 0 && (
                  <span style={{ marginLeft:'auto', background:'#fee2e2', color:'#991b1b',
                    fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99 }}>
                    {pendingLeaves.length + onduty.filter(o=>o.status==='pending').length}
                  </span>
                )}
              </div>
              <div className="scroll-list">
                {pendingLeaves.length === 0 && onduty.filter(o=>o.status==='pending').length === 0 ? (
                  <div style={{ textAlign:'center', color:'var(--text3)', fontSize:11, padding:'20px 0', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                    <CheckCircle size={24} style={{ color:'#10b981', opacity:0.6 }}/>
                    All caught up!
                  </div>
                ) : (
                  <>
                    {pendingLeaves.map((l, i) => {
                      const c = empColor(i + 30);
                      return (
                        <div key={`l${l.id}`} className="emp-row">
                          <Avatar name={l.employee_name} color={c} size={26}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {l.employee_name}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text3)' }}>
                              Leave · {l.from_date}
                              {l.from_date !== l.to_date ? ` → ${l.to_date}` : ''}
                            </div>
                          </div>
                          <span style={{ background:'#fef3c7', color:'#92400e', fontSize:9, fontWeight:700,
                            padding:'2px 6px', borderRadius:99, flexShrink:0 }}>LEAVE</span>
                        </div>
                      );
                    })}
                    {onduty.filter(o=>o.status==='pending').map((o, i) => {
                      const c = empColor(i + 35 + pendingLeaves.length);
                      return (
                        <div key={`o${o.id}`} className="emp-row">
                          <Avatar name={o.employee_name} color={c} size={26}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {o.employee_name}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text3)' }}>
                              On-Duty · {o.date}
                            </div>
                          </div>
                          <span style={{ background:'#e0f2fe', color:'#075985', fontSize:9, fontWeight:700,
                            padding:'2px 6px', borderRadius:99, flexShrink:0 }}>OD</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
