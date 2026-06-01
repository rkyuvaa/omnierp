import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PRIORITY_COLORS = { urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView({ calendarData, year, month, onNavigate, onTaskClick, onDateClick }) {
  const [expandedDay, setExpandedDay] = useState(null);

  const today = new Date();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  // Build 6-week grid
  const cells = [];
  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, currentMonth: false, tasks: [] });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const tasksForDay = (calendarData?.days?.[d] || []);
    cells.push({ day: d, currentMonth: true, tasks: tasksForDay });
  }
  // Next month padding
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay++, currentMonth: false, tasks: [] });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div>
      {/* Calendar header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{MONTHS[month - 1]} {year}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(-1)}><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(0)}>Today</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate(1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 1 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 0', background: 'var(--bg3)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="calendar-grid">
        {weeks.flat().map((cell, idx) => {
          const isToday = cell.currentMonth && cell.day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
          const isPast = cell.currentMonth && new Date(year, month - 1, cell.day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const MAX_VISIBLE = 3;
          const visible = cell.tasks.slice(0, MAX_VISIBLE);
          const overflow = cell.tasks.length - MAX_VISIBLE;
          const isExpanded = expandedDay === `${cell.day}-${cell.currentMonth}`;

          return (
            <div key={idx}
              className={`calendar-cell ${!cell.currentMonth ? 'other-month' : ''} ${isToday ? 'today-cell' : ''}`}
              onClick={() => { if (cell.currentMonth) onDateClick(new Date(year, month - 1, cell.day)); }}>

              <div className="cal-day-num" style={{ color: isPast && cell.currentMonth && !isToday ? 'var(--text3)' : undefined }}>
                {cell.day}
              </div>

              {visible.map(t => (
                <div key={t.id}
                  className="cal-chip"
                  style={{ background: PRIORITY_COLORS[t.priority] + '20', color: PRIORITY_COLORS[t.priority], textDecoration: t.is_overdue ? 'line-through' : 'none', opacity: t.is_overdue ? 0.7 : 1 }}
                  onClick={e => { e.stopPropagation(); onTaskClick(t); }}
                  title={t.title}>
                  {t.title}
                </div>
              ))}

              {overflow > 0 && (
                <div
                  className="cal-chip"
                  style={{ background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setExpandedDay(isExpanded ? null : `${cell.day}-${cell.currentMonth}`); }}>
                  {isExpanded ? '▲ less' : `+${overflow} more`}
                </div>
              )}

              {isExpanded && overflow > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, width: 200, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 50, padding: 8 }}
                  onClick={e => e.stopPropagation()}>
                  {cell.tasks.slice(MAX_VISIBLE).map(t => (
                    <div key={t.id}
                      className="cal-chip"
                      style={{ background: PRIORITY_COLORS[t.priority] + '20', color: PRIORITY_COLORS[t.priority], marginBottom: 4 }}
                      onClick={() => { setExpandedDay(null); onTaskClick(t); }}>
                      {t.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        {Object.entries(PRIORITY_COLORS).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            {key.charAt(0).toUpperCase() + key.slice(1)} priority
          </div>
        ))}
      </div>
    </div>
  );
}
