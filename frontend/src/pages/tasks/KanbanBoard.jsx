import { useState } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, AlertTriangle, Clock } from 'lucide-react';

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: '#64748b' },
  { key: 'inprogress', label: 'In Progress', color: '#2563eb' },
  { key: 'inreview', label: 'In Review', color: '#9333ea' },
  { key: 'done', label: 'Done', color: '#16a34a' },
  { key: 'closed', label: 'Closed', color: '#94a3b8' },
];

function getDueInfo(due, status) {
  if (!due || ['done', 'closed'].includes(status)) return null;
  const d = new Date(due);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return { label: new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), cls: 'due-overdue', icon: 'alert', cardCls: 'overdue' };
  if (diff < 86400000) return { label: 'Due today', cls: 'due-today-text', icon: 'clock', cardCls: 'due-today' };
  return { label: new Date(due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), cls: '', icon: null, cardCls: '' };
}

function KanbanCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const dueInfo = getDueInfo(task.due_date, task.status);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`kanban-card ${dueInfo?.cardCls || ''}`} onClick={() => onClick(task)}>

      {/* Priority badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className={`badge priority-${task.priority}`} style={{ fontSize: 10 }}>
          {task.priority === 'urgent' && <span className="pulse-dot" />}
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{task.reference}</span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 10, color: 'var(--text)' }}>{task.title}</div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Assignee avatar */}
          {task.assignee_name && (
            <div className="user-avatar" style={{ width: 22, height: 22, fontSize: 10 }} title={task.assignee_name}>
              {task.assignee_initials}
            </div>
          )}
          {/* Subtask progress */}
          {task.subtask_total > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: 99, border: '1px solid var(--border)' }}>
              {task.subtask_done}/{task.subtask_total}
            </span>
          )}
        </div>

        {/* Due date */}
        {dueInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600 }} className={dueInfo.cls}>
            {dueInfo.icon === 'alert' ? <AlertTriangle size={10} /> : dueInfo.icon === 'clock' ? <Clock size={10} /> : null}
            {dueInfo.label}
          </div>
        )}
      </div>

      {/* Labels */}
      {task.labels?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          {task.labels.map(l => (
            <span key={l.id} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: l.color + '22', color: l.color, fontWeight: 600 }}>{l.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({ tasks, onTaskClick, onStatusChange, onAddTask }) {
  const [activeTask, setActiveTask] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const tasksByStatus = {};
  COLUMNS.forEach(c => { tasksByStatus[c.key] = []; });
  (tasks || []).forEach(t => { if (tasksByStatus[t.status]) tasksByStatus[t.status].push(t); });

  const handleDragStart = ({ active }) => {
    setActiveTask(tasks.find(t => t.id === active.id));
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const draggedTask = tasks.find(t => t.id === active.id);
    if (!draggedTask) return;

    // Find the target column (over could be a task ID or column ID)
    let targetStatus = null;
    COLUMNS.forEach(col => {
      const colTasks = tasksByStatus[col.key];
      if (col.key === over.id || colTasks.some(t => t.id === over.id)) {
        targetStatus = col.key;
      }
    });

    if (targetStatus && targetStatus !== draggedTask.status) {
      // Enforce no todo → done skip
      if (draggedTask.status === 'todo' && targetStatus === 'done') {
        import('react-hot-toast').then(({ default: toast }) => toast.error("Can't skip In Progress step"));
        return;
      }
      onStatusChange(draggedTask.id, targetStatus);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {COLUMNS.map(col => {
          const colTasks = tasksByStatus[col.key] || [];
          return (
            <div key={col.key} className="kanban-col">
              <div className="kanban-col-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{col.label}</span>
                  <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>{colTasks.length}</span>
                </div>
                <button onClick={() => onAddTask(col.key)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <Plus size={14} />
                </button>
              </div>

              <div className="kanban-col-body" id={col.key}>
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {colTasks.map(task => (
                    <KanbanCard key={task.id} task={task} onClick={onTaskClick} />
                  ))}
                </SortableContext>

                {colTasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text3)', fontSize: 12 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📭</div>
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="kanban-card" style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.2)', cursor: 'grabbing', transform: 'rotate(2deg)' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{activeTask.title}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
