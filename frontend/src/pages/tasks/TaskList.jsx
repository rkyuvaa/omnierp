import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, SlidersHorizontal, LayoutGrid, List, Calendar, X, AlertTriangle, Clock, CheckCircle2, Trash2, RotateCcw, Eye, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import TaskDrawer from './TaskDrawer';
import TaskDetail from './TaskDetail';
import KanbanBoard from './KanbanBoard';
import CalendarView from './CalendarView';

const STATUS_LABELS = { todo: 'To Do', inprogress: 'In Progress', inreview: 'In Review', done: 'Done', closed: 'Closed' };
const STATUS_CLASSES = { todo: 'status-todo', inprogress: 'status-inprogress', inreview: 'status-inreview', done: 'status-done', closed: 'status-closed' };
const PRIORITY_CLASSES = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high', urgent: 'priority-urgent' };
const PRIORITY_COLORS = { urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a' };

function getDueLabel(due, status) {
  if (!due || ['done', 'closed'].includes(status)) return null;
  const d = new Date(due);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return { text: new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), cls: 'due-overdue', icon: 'alert' };
  if (diff < 86400000) return { text: 'Due today', cls: 'due-today-text', icon: 'clock' };
  return { text: new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), cls: '', icon: null };
}

export default function TaskList() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | kanban | calendar
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: [], priority: [], assigned_to: '', due_preset: '' });
  const [sortBy, setSortBy] = useState(localStorage.getItem('task_sort') || 'priority_due');
  const [page, setPage] = useState(1);
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerStatus, setDrawerStatus] = useState(null);
  const [drawerDate, setDrawerDate] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calData, setCalData] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    api.get('/users/').then(r => setUsers(r.data || [])).catch(() => {});
    api.get('/tasks/labels').then(r => setLabels(r.data || [])).catch(() => {});
  }, []);

  const fetchDashboard = () => api.get('/tasks/dashboard').then(r => setDashboard(r.data)).catch(() => {});
  useEffect(() => { fetchDashboard(); }, []);

  const buildParams = useCallback(() => {
    const p = { page, limit: 50, sort_by: sortBy, include_deleted: showTrash };
    if (search) p.search = search;
    if (filters.status.length) p.status = filters.status.join(',');
    if (filters.priority.length) p.priority = filters.priority.join(',');
    if (filters.assigned_to) p.assigned_to = filters.assigned_to;
    if (filters.due_preset) {
      const now = new Date();
      if (filters.due_preset === 'today') { p.due_from = now.toISOString().split('T')[0]; p.due_to = now.toISOString().split('T')[0]; }
      else if (filters.due_preset === 'week') { const end = new Date(now); end.setDate(now.getDate() + 7); p.due_from = now.toISOString().split('T')[0]; p.due_to = end.toISOString().split('T')[0]; }
      else if (filters.due_preset === 'overdue') { p.due_to = new Date(now.getTime() - 1000).toISOString(); }
      else if (filters.due_preset === 'month') { const end = new Date(now); end.setDate(now.getDate() + 30); p.due_from = now.toISOString().split('T')[0]; p.due_to = end.toISOString().split('T')[0]; }
    }
    if (showTrash) p.include_closed = true;
    return p;
  }, [page, sortBy, search, filters, showTrash]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/', { params: buildParams() });
      setTasks(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const fetchCalendar = useCallback(async () => {
    if (view !== 'calendar') return;
    try {
      const res = await api.get('/tasks/calendar', { params: { year: calYear, month: calMonth } });
      setCalData(res.data);
    } catch {}
  }, [view, calYear, calMonth]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); }, 350);
  };

  const toggleFilter = (key, val) => {
    setFilters(f => ({
      ...f,
      [key]: Array.isArray(f[key])
        ? f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val]
        : val
    }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({ status: [], priority: [], assigned_to: '', due_preset: '' }); setPage(1); };

  const activeFilterCount = filters.status.length + filters.priority.length + (filters.assigned_to ? 1 : 0) + (filters.due_preset ? 1 : 0);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await api.put(`/tasks/${taskId}`, { status: newStatus });
      setTasks(ts => ts.map(t => t.id === taskId ? res.data : t));
      fetchDashboard();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to update status'); }
  };

  const handleTaskUpdated = (updated) => {
    setTasks(ts => ts.map(t => t.id === updated.id ? updated : t));
    fetchDashboard();
  };

  const handleSaved = (newTask) => {
    setTasks(ts => [newTask, ...ts]);
    setShowDrawer(false);
    fetchDashboard();
    toast.success('Task created!');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this task to trash?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(ts => ts.filter(t => t.id !== id));
      setTotal(n => n - 1);
      fetchDashboard();
      toast.success('Task moved to trash');
    } catch { toast.error('Failed to delete'); }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/tasks/${id}/restore`);
      setTasks(ts => ts.filter(t => t.id !== id));
      toast.success('Task restored');
      fetchDashboard();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to restore'); }
  };

  const handleBulkUpdate = async (patch) => {
    if (!selected.length) return;
    try {
      await api.post('/tasks/bulk', { task_ids: selected, ...patch });
      await fetchTasks();
      setSelected([]);
      toast.success('Updated');
    } catch { toast.error('Bulk update failed'); }
  };

  const handleCalNavigate = (dir) => {
    if (dir === 0) { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth() + 1); return; }
    let m = calMonth + dir, y = calYear;
    if (m > 12) { m = 1; y++; } else if (m < 1) { m = 12; y--; }
    setCalMonth(m); setCalYear(y);
  };

  const openAddTaskForColumn = (status) => { setDrawerStatus(status); setShowDrawer(true); };
  const openAddTaskForDate = (date) => { setDrawerDate(date); setShowDrawer(true); };

  // If calendar task clicked, find the minimal task data
  const handleCalTaskClick = (t) => { setSelectedTaskId(t.id); };

  const changeSort = (v) => { setSortBy(v); localStorage.setItem('task_sort', v); setPage(1); };

  return (
    <Layout title="Task Management">
      {/* ── Dashboard Stats Strip ── */}
      {dashboard && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'My Tasks', value: dashboard.my_total, color: 'var(--accent)', bg: 'var(--accent-dim)', icon: '📋' },
            { label: 'Overdue', value: dashboard.my_overdue, color: '#dc2626', bg: 'rgba(239,68,68,0.08)', icon: '🚨' },
            { label: 'Due Today', value: dashboard.my_due_today, color: '#ca8a04', bg: 'rgba(234,179,8,0.08)', icon: '⏰' },
            { label: 'Due Tomorrow', value: dashboard.my_due_tomorrow, color: '#2563eb', bg: 'rgba(59,130,246,0.08)', icon: '📅' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 10, flex: 1, minWidth: 140 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="toolbar" style={{ marginBottom: 14 }}>
        {/* Search */}
        <div className="search-bar" style={{ width: 260 }}>
          <Search size={15} />
          <input placeholder="Search tasks..." value={search} onChange={e => handleSearch(e.target.value)} />
          {search && <button onClick={() => handleSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text3)' }}><X size={13} /></button>}
        </div>

        {/* Filter button */}
        <button className={`btn btn-ghost btn-sm ${showFilter ? 'btn-primary' : ''}`}
          onClick={() => setShowFilter(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: showFilter ? 'var(--accent)' : undefined, color: showFilter ? 'white' : undefined }}>
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && <span style={{ background: showFilter ? 'rgba(255,255,255,0.3)' : 'var(--accent)', color: 'white', borderRadius: 99, padding: '0 6px', fontSize: 10, fontWeight: 800 }}>{activeFilterCount}</span>}
        </button>

        {/* Trash toggle */}
        {user?.is_superadmin && (
          <button className={`btn btn-ghost btn-sm`} onClick={() => { setShowTrash(v => !v); setPage(1); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: showTrash ? '#dc2626' : undefined }}>
            <Trash2 size={14} />{showTrash ? 'Trash' : 'Trash'}
          </button>
        )}

        {/* Sort */}
        <select className="form-select" value={sortBy} onChange={e => changeSort(e.target.value)}
          style={{ padding: '5px 10px', fontSize: 12, width: 'auto', minWidth: 140 }}>
          <option value="priority_due">Priority + Due date</option>
          <option value="due_date">Due date</option>
          <option value="created_at">Newest first</option>
          <option value="status">Status</option>
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* View switcher */}
          <div className="view-switcher">
            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><List size={14} /> List</button>
            <button className={`view-btn ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}><LayoutGrid size={14} /> Kanban</button>
            <button className={`view-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}><Calendar size={14} /> Calendar</button>
          </div>

          <button className="btn btn-primary" onClick={() => { setDrawerStatus(null); setDrawerDate(null); setShowDrawer(true); }}>
            <Plus size={15} /> New Task
          </button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {showFilter && (
        <div className="filter-panel">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Status */}
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['todo', 'inprogress', 'inreview', 'done', 'closed'].map(s => (
                  <button key={s} type="button" onClick={() => toggleFilter('status', s)}
                    className={`badge status-${s}`}
                    style={{ cursor: 'pointer', border: filters.status.includes(s) ? '2px solid currentColor' : '2px solid transparent', fontFamily: 'inherit', fontSize: 11 }}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            {/* Priority */}
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Priority</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <button key={p} type="button" onClick={() => toggleFilter('priority', p)}
                    className={`badge priority-${p}`}
                    style={{ cursor: 'pointer', border: filters.priority.includes(p) ? '2px solid currentColor' : '2px solid transparent', fontFamily: 'inherit', fontSize: 11 }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {/* Assignee */}
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Assignee</div>
              <select className="form-select" value={filters.assigned_to} onChange={e => { setFilters(f => ({ ...f, assigned_to: e.target.value })); setPage(1); }} style={{ fontSize: 13 }}>
                <option value="">All users</option>
                <option value={user?.id}>My tasks</option>
                {users.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {/* Due date */}
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Due Date</div>
              <select className="form-select" value={filters.due_preset} onChange={e => { setFilters(f => ({ ...f, due_preset: e.target.value })); setPage(1); }} style={{ fontSize: 13 }}>
                <option value="">Any time</option>
                <option value="today">Due today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Active filters:</span>
              {filters.status.map(s => <span key={s} className="filter-chip">{STATUS_LABELS[s]} <button onClick={() => toggleFilter('status', s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}>×</button></span>)}
              {filters.priority.map(p => <span key={p} className="filter-chip">{p} <button onClick={() => toggleFilter('priority', p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}>×</button></span>)}
              {filters.assigned_to && <span className="filter-chip">Assignee <button onClick={() => setFilters(f => ({ ...f, assigned_to: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>×</button></span>}
              {filters.due_preset && <span className="filter-chip">{filters.due_preset} <button onClick={() => setFilters(f => ({ ...f, due_preset: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>×</button></span>}
              <button onClick={clearFilters} style={{ marginLeft: 4, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">{showTrash ? '🗑 Trash' : 'Tasks'}</span>
            <span className="text-muted text-sm">{total} total</span>
          </div>
          {loading ? (
            <div className="page-loader"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 600 }}>{showTrash ? 'Trash is empty' : 'No tasks found'}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{showTrash ? '' : 'Create your first task to get started'}</div>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" style={{ transform: 'scale(1.2)', cursor: 'pointer', accentColor: 'var(--accent)' }}
                          checked={selected.length === tasks.length && tasks.length > 0}
                          onChange={e => setSelected(e.target.checked ? tasks.map(t => t.id) : [])} />
                      </th>
                      <th>Reference</th>
                      <th>Title</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>Due Date</th>
                      <th>Labels</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => {
                      const dueInfo = getDueLabel(t.due_date, t.status);
                      return (
                        <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTaskId(t.id)}>
                          <td onClick={e => e.stopPropagation()}>
                            <input type="checkbox" style={{ transform: 'scale(1.2)', cursor: 'pointer', accentColor: 'var(--accent)' }}
                              checked={selected.includes(t.id)}
                              onChange={e => setSelected(sel => e.target.checked ? [...sel, t.id] : sel.filter(id => id !== t.id))} />
                          </td>
                          <td><span className="ref-text">{t.reference}</span></td>
                          <td className="fw-600" style={{ maxWidth: 280 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {t.priority === 'urgent' && <span className="pulse-dot" />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                              {t.subtask_total > 0 && <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>{t.subtask_done}/{t.subtask_total}</span>}
                            </div>
                          </td>
                          <td><span className={`badge ${PRIORITY_CLASSES[t.priority]}`} style={{ fontSize: 11 }}>{t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</span></td>
                          <td><span className={`badge ${STATUS_CLASSES[t.status]}`} style={{ fontSize: 11 }}>{STATUS_LABELS[t.status]}</span></td>
                          <td>
                            {t.assignee_name ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div className="user-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{t.assignee_initials}</div>
                                <span style={{ fontSize: 13 }}>{t.assignee_name}</span>
                              </div>
                            ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                          </td>
                          <td>
                            {dueInfo ? (
                              <span className={`${dueInfo.cls}`} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {dueInfo.icon === 'alert' ? <AlertTriangle size={11} /> : dueInfo.icon === 'clock' ? <Clock size={11} /> : null}
                                {dueInfo.text}
                              </span>
                            ) : t.due_date ? (
                              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>No due date</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(t.labels || []).slice(0, 2).map(l => (
                                <span key={l.id} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: l.color + '22', color: l.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{l.name}</span>
                              ))}
                              {t.labels?.length > 2 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{t.labels.length - 2}</span>}
                            </div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTaskId(t.id)} title="View"><Eye size={13} /></button>
                              {showTrash ? (
                                user?.is_superadmin && <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(t.id)} title="Restore" style={{ color: 'var(--accent)' }}><RotateCcw size={13} /></button>
                              ) : (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)} title="Delete"><Trash2 size={13} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                  Showing {tasks.length} of {total}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
                  <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 12px', border: '1px solid var(--border)', borderRadius: 20 }}>Page {page}</span>
                  <button className="btn btn-ghost btn-sm" disabled={tasks.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {view === 'kanban' && (
        loading ? <div className="page-loader"><div className="spinner" style={{ width: 28, height: 28 }} /></div> : (
          <KanbanBoard
            tasks={tasks}
            onTaskClick={t => setSelectedTaskId(t.id)}
            onStatusChange={handleStatusChange}
            onAddTask={openAddTaskForColumn}
          />
        )
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && (
        <div className="card">
          <CalendarView
            calendarData={calData}
            year={calYear}
            month={calMonth}
            onNavigate={handleCalNavigate}
            onTaskClick={handleCalTaskClick}
            onDateClick={openAddTaskForDate}
          />
        </div>
      )}

      {/* ── Bulk Action Bar ── */}
      {selected.length > 0 && (
        <div className="bulk-bar">
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.length} selected</span>
          <select onChange={e => { if (e.target.value) handleBulkUpdate({ priority: e.target.value }); e.target.value = ''; }}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            <option value="">Set Priority...</option>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
          <select onChange={e => { if (e.target.value) handleBulkUpdate({ status: e.target.value }); e.target.value = ''; }}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
            <option value="">Set Status...</option>
            <option value="todo">To Do</option><option value="inprogress">In Progress</option><option value="inreview">In Review</option><option value="done">Done</option>
          </select>
          <button onClick={() => setSelected([])} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}

      {/* ── Task Drawer (New Task) ── */}
      {showDrawer && (
        <TaskDrawer
          onClose={() => { setShowDrawer(false); setDrawerDate(null); setDrawerStatus(null); }}
          onSaved={handleSaved}
          prefillDate={drawerDate}
        />
      )}

      {/* ── Task Detail Panel ── */}
      {selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={handleTaskUpdated}
        />
      )}
    </Layout>
  );
}
