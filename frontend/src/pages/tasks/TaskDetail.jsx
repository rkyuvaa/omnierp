import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Bold, Italic, List, Link2, Underline as UIcon, Plus, Check, Trash2, Paperclip, AlertTriangle, Clock, ChevronDown, Edit2, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const STATUS_LIST = [
  { key: 'todo', label: 'To Do' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'inreview', label: 'In Review' },
  { key: 'done', label: 'Done' },
  { key: 'closed', label: 'Closed' },
];
const PRIORITY_LIST = [
  { key: 'low', label: 'Low', color: '#16a34a' },
  { key: 'medium', label: 'Medium', color: '#ca8a04' },
  { key: 'high', label: 'High', color: '#ea580c' },
  { key: 'urgent', label: 'Urgent', color: '#dc2626' },
];
const STATUS_ORDER = ['todo', 'inprogress', 'inreview', 'done', 'closed'];

function getDueClass(due) {
  if (!due) return '';
  const d = new Date(due);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'due-overdue';
  if (diff < 86400000) return 'due-today-text';
  return '';
}

function formatDue(due) {
  if (!due) return null;
  const d = new Date(due);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RichEditor({ value, onChange, readOnly = false }) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Underline],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => { if (!readOnly) onChange(editor.getHTML()); },
    editorProps: { attributes: { class: 'tiptap-content' } },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== !readOnly) editor.setEditable(!readOnly);
  }, [readOnly, editor]);

  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHTML = editor.getHTML();
      if (currentHTML !== value) editor.commands.setContent(value || '');
    }
  }, [value]);

  if (!editor) return null;

  const setLink = () => { const url = window.prompt('Enter URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); };

  return (
    <div className="tiptap-wrapper">
      {!readOnly && (
        <div className="tiptap-toolbar">
          <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}><Bold size={11} /></button>
          <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}><Italic size={11} /></button>
          <button type="button" className={`tiptap-btn ${editor.isActive('underline') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}><UIcon size={11} /></button>
          <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}><List size={11} /></button>
          <button type="button" className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); setLink(); }}><Link2 size={11} /></button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

export default function TaskDetail({ taskId, onClose, onUpdated }) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState('');
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editCommentId, setEditCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showClosingConfirm, setShowClosingConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const commentRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      setTask(res.data);
      setTitleVal(res.data.title);
      setDescVal(res.data.description || '');
    } catch { toast.error('Failed to load task'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.get('/users/').then(r => setUsers(r.data || [])).catch(() => {});
    api.get('/tasks/labels').then(r => setLabels(r.data || [])).catch(() => {});
  }, [taskId]);

  const update = async (patch) => {
    try {
      const res = await api.put(`/tasks/${taskId}`, patch);
      setTask(res.data);
      setTitleVal(res.data.title);
      setDescVal(res.data.description || '');
      onUpdated?.(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Update failed');
    }
  };

  const changeStatus = async (newStatus) => {
    if (newStatus === 'closed') { setShowClosingConfirm(true); return; }
    setShowStatusPicker(false);
    await update({ status: newStatus });
  };

  const confirmClose = async () => {
    setShowClosingConfirm(false);
    setShowStatusPicker(false);
    await update({ status: 'closed' });
  };

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleVal.trim() && titleVal !== task.title) update({ title: titleVal });
    else setTitleVal(task.title);
  };

  const saveDesc = () => {
    setEditingDesc(false);
    if (descVal !== task.description) update({ description: descVal });
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    try {
      const res = await api.post(`/tasks/${taskId}/subtasks`, { title: newSubtask });
      setTask(t => ({ ...t, subtasks: [...(t.subtasks || []), res.data], subtask_total: (t.subtask_total || 0) + 1 }));
      setNewSubtask('');
    } catch { toast.error('Failed to add subtask'); }
  };

  const toggleSubtask = async (sub) => {
    try {
      const res = await api.put(`/tasks/${taskId}/subtasks/${sub.id}`, { is_done: !sub.is_done });
      setTask(t => {
        const updated = t.subtasks.map(s => s.id === sub.id ? res.data : s);
        const done = updated.filter(s => s.is_done).length;
        return { ...t, subtasks: updated, subtask_done: done };
      });
    } catch { toast.error('Failed'); }
  };

  const deleteSubtask = async (subId) => {
    try {
      await api.delete(`/tasks/${taskId}/subtasks/${subId}`);
      setTask(t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== subId), subtask_total: t.subtask_total - 1 }));
    } catch { toast.error('Failed'); }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPostingComment(true);
    try {
      const res = await api.post(`/tasks/${taskId}/comments`, { text: comment });
      setTask(t => ({ ...t, comments: [...(t.comments || []), res.data] }));
      setComment('');
    } catch { toast.error('Failed to post comment'); }
    finally { setPostingComment(false); }
  };

  const deleteComment = async (cid) => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    try {
      await api.delete(`/tasks/${taskId}/comments/${cid}`);
      setTask(t => ({ ...t, comments: t.comments.filter(c => c.id !== cid) }));
    } catch { toast.error('Failed'); }
  };

  const saveEditComment = async (cid) => {
    try {
      await api.put(`/tasks/${taskId}/comments/${cid}`, { text: editCommentText });
      setTask(t => ({ ...t, comments: t.comments.map(c => c.id === cid ? { ...c, text: editCommentText, is_edited: true } : c) }));
      setEditCommentId(null);
    } catch { toast.error('Failed'); }
  };

  const uploadFile = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file);
      try {
        const res = await api.post(`/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setTask(t => ({ ...t, attachments: [...(t.attachments || []), res.data] }));
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
  };

  const deleteAttachment = async (aid) => {
    try {
      await api.delete(`/tasks/${taskId}/attachments/${aid}`);
      setTask(t => ({ ...t, attachments: t.attachments.filter(a => a.id !== aid) }));
    } catch { toast.error('Failed'); }
  };

  if (loading) return (
    <>
      <div className="task-drawer-overlay" onClick={onClose} />
      <div className="task-detail-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    </>
  );
  if (!task) return null;

  const isClosed = task.status === 'closed';
  const statusObj = STATUS_LIST.find(s => s.key === task.status);
  const priorityObj = PRIORITY_LIST.find(p => p.key === task.priority);
  const subtaskDone = (task.subtasks || []).filter(s => s.is_done).length;
  const subtaskTotal = (task.subtasks || []).length;
  const subtaskPct = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;
  const dueClass = getDueClass(task.due_date);

  // Available status transitions (no skipping todo→done)
  const allowedStatuses = STATUS_LIST.filter(s => {
    if (task.status === 'todo' && s.key === 'done') return false;
    return true;
  });

  return (
    <>
      <div className="task-drawer-overlay" onClick={onClose} />
      {showClosingConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, maxWidth: 400, width: '90%', textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: '#dc2626', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Mark as Closed?</div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>This task becomes read-only. No further edits or comments allowed.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowClosingConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmClose}>Yes, Close Task</button>
            </div>
          </div>
        </div>
      )}
      <div className="task-detail-panel">
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>{task.reference}</span>
              {/* Status */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => !isClosed && setShowStatusPicker(v => !v)}
                  className={`badge status-${task.status}`}
                  style={{ cursor: isClosed ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, border: 'none', fontFamily: 'inherit', fontSize: 11 }}>
                  {statusObj?.label} {!isClosed && <ChevronDown size={11} />}
                </button>
                {showStatusPicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 20, minWidth: 150 }}>
                    {allowedStatuses.map(s => (
                      <div key={s.key} onClick={() => changeStatus(s.key)}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                          background: task.status === s.key ? 'var(--accent-dim)' : 'transparent', color: task.status === s.key ? 'var(--accent)' : 'var(--text)' }}
                        onMouseEnter={e => { if (task.status !== s.key) e.currentTarget.style.background = 'var(--bg3)'; }}
                        onMouseLeave={e => { if (task.status !== s.key) e.currentTarget.style.background = 'transparent'; }}>
                        {task.status === s.key && <Check size={12} />}{s.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Priority */}
              <span className={`badge priority-${task.priority}`} style={{ fontSize: 11 }}>
                {task.priority === 'urgent' && <span className="pulse-dot" />}{priorityObj?.label}
              </span>
              {/* Due date */}
              {task.due_date && (
                <span className={`badge ${dueClass}`} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  {dueClass === 'due-overdue' ? <AlertTriangle size={10} /> : <Clock size={10} />}
                  {formatDue(task.due_date)}
                </span>
              )}
            </div>

            {/* Title */}
            {editingTitle && !isClosed ? (
              <input value={titleVal} onChange={e => setTitleVal(e.target.value)}
                onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleVal(task.title); } }}
                autoFocus style={{ width: '100%', fontSize: 18, fontWeight: 700, background: 'none', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', color: 'var(--text)', padding: '2px 0', fontFamily: 'inherit' }} />
            ) : (
              <div onClick={() => !isClosed && setEditingTitle(true)}
                style={{ fontSize: 18, fontWeight: 700, cursor: isClosed ? 'default' : 'pointer', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6 }}>
                {task.title}
                {!isClosed && <Edit2 size={14} style={{ opacity: 0.4, flexShrink: 0 }} />}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 6, borderRadius: 6, flexShrink: 0 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Assignee row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Assignee</div>
              <div style={{ position: 'relative' }}>
                <button onClick={() => !isClosed && setShowAssigneePicker(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', cursor: isClosed ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%' }}>
                  {task.assignee_name ? (
                    <><div className="user-avatar" style={{ width: 24, height: 24, fontSize: 12 }}>{task.assignee_initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{task.assignee_name}</span></>
                  ) : <span style={{ fontSize: 13, color: 'var(--text3)' }}>Unassigned</span>}
                </button>
                {showAssigneePicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 20 }}>
                    {users.slice(0, 8).map(u => (
                      <div key={u.id} onClick={() => { update({ assigned_to: u.id }); setShowAssigneePicker(false); }}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div className="user-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{u.name?.[0]}</div>{u.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Priority</div>
              <div className="segment-selector">
                {PRIORITY_LIST.map(p => (
                  <button key={p.key} type="button" disabled={isClosed}
                    className={`seg-btn ${task.priority === p.key ? `active-${p.key}` : ''}`}
                    onClick={() => update({ priority: p.key })} style={{ fontSize: 11 }}>{p.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              Description
              {!isClosed && !editingDesc && <button onClick={() => setEditingDesc(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}><Edit2 size={12} /></button>}
            </div>
            {editingDesc && !isClosed ? (
              <div>
                <RichEditor value={descVal} onChange={setDescVal} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveDesc}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditingDesc(false); setDescVal(task.description || ''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={() => !isClosed && setEditingDesc(true)}
                style={{ cursor: isClosed ? 'default' : 'pointer', minHeight: 40, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {task.description ? (
                  <div className="tiptap-content" style={{ minHeight: 'unset', padding: 0 }} dangerouslySetInnerHTML={{ __html: task.description }} />
                ) : (
                  <span style={{ color: 'var(--text3)', fontSize: 13 }}>Click to add description...</span>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Subtasks</span>
              <span style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'none', letterSpacing: 0 }}>{subtaskDone}/{subtaskTotal} done</span>
            </div>
            {subtaskTotal > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${subtaskPct}%` }} /></div>
                {subtaskDone === subtaskTotal && subtaskTotal > 0 && task.status === 'inprogress' && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(25,84,2,0.08)', border: '1px solid rgba(25,84,2,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>
                    💡 All subtasks done! Consider moving to In Review?
                  </div>
                )}
              </div>
            )}
            <div style={{ background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {(task.subtasks || []).map(sub => {
                const subOverdue = sub.due_date && new Date(sub.due_date) < new Date() && !sub.is_done;
                return (
                  <div key={sub.id} className="subtask-row" style={{ padding: '9px 14px' }}>
                    <input type="checkbox" checked={sub.is_done} onChange={() => !isClosed && toggleSubtask(sub)}
                      style={{ width: 16, height: 16, cursor: isClosed ? 'default' : 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, textDecoration: sub.is_done ? 'line-through' : 'none', color: sub.is_done ? 'var(--text3)' : subOverdue ? '#dc2626' : 'var(--text)' }}>
                      {sub.title}
                    </span>
                    {sub.due_date && <span style={{ fontSize: 10, color: subOverdue ? '#dc2626' : 'var(--text3)' }}>{new Date(sub.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                    {!isClosed && <button onClick={() => deleteSubtask(sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}><Trash2 size={13} /></button>}
                  </div>
                );
              })}
              {!isClosed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: subtaskTotal > 0 ? '1px solid var(--border)' : 'none' }}>
                  <Plus size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                  <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubtask()}
                    placeholder="Add subtask..." style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }} />
                  {newSubtask && <button onClick={addSubtask} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', padding: 0 }}>Add</button>}
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              Attachments {(task.attachments || []).length > 0 && <span style={{ fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 8px', color: 'var(--text2)', textTransform: 'none', letterSpacing: 0 }}>{task.attachments.length}</span>}
              {!isClosed && (
                <button onClick={() => fileRef.current?.click()} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
                  {uploading ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <><Paperclip size={13} /> Attach</>}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => uploadFile(e.target.files)} />
            {(task.attachments || []).length > 0 ? (
              <div className="attachment-grid">
                {task.attachments.map(a => (
                  <div key={a.id} className="attachment-tile" title={a.filename}>
                    {a.mime_type?.startsWith('image/') ? (
                      <img src={a.file_url} alt={a.filename} onClick={() => window.open(a.file_url, '_blank')} />
                    ) : (
                      <div className="attachment-thumb" onClick={() => window.open(a.file_url, '_blank')}>
                        {a.mime_type?.includes('pdf') ? '📄' : a.mime_type?.includes('word') ? '📝' : a.mime_type?.includes('excel') || a.mime_type?.includes('sheet') ? '📊' : '📎'}
                      </div>
                    )}
                    <div style={{ padding: '4px 6px', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>{a.filename}</div>
                    {(a.uploaded_by === user?.id || user?.is_superadmin) && !isClosed && (
                      <button onClick={() => deleteAttachment(a.id)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 4px', color: 'white' }}><Trash2 size={10} /></button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !isClosed && <div onClick={() => fileRef.current?.click()} className="dropzone" style={{ padding: 16 }}><Paperclip size={16} style={{ color: 'var(--text3)' }} /><div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Click to attach files</div></div>
            )}
          </div>

          {/* Comments */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              Comments {(task.comments || []).length > 0 && `(${task.comments.length})`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(task.comments || []).map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                  <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 13, flexShrink: 0 }}>{c.author_initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {c.is_edited && <span style={{ fontSize: 10, color: 'var(--text3)' }}>(edited)</span>}
                    </div>
                    {editCommentId === c.id ? (
                      <div>
                        <textarea value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                          style={{ width: '100%', minHeight: 60, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEditComment(c.id)}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditCommentId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="comment-bubble" style={{ fontSize: 13, lineHeight: 1.6 }}>{c.text}</div>
                    )}
                    {c.created_by === user?.id && !isClosed && editCommentId !== c.id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={() => { setEditCommentId(c.id); setEditCommentText(c.text); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', padding: 0 }}>Edit</button>
                        <button onClick={() => deleteComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--red)', fontFamily: 'inherit', padding: 0 }}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isClosed && (
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 13, flexShrink: 0 }}>{user?.name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div className="comment-input-box">
                    <textarea ref={commentRef} value={comment} onChange={e => setComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); postComment(); } }}
                      placeholder="Add a comment... (Shift+Enter to submit)" rows={2}
                      style={{ width: '100%', background: 'none', border: 'none', outline: 'none', padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', resize: 'none' }} />
                    <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                      <button className="btn btn-primary btn-sm" onClick={postComment} disabled={!comment.trim() || postingComment}
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {postingComment ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Send size={12} />} Post
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Shift+Enter to submit quickly</div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log */}
          {(task.activity || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Activity Log</div>
              <div>
                {[...(task.activity || [])].reverse().map(a => (
                  <div key={a.id} className="activity-item">
                    <div className="activity-dot" />
                    <div style={{ flex: 1 }}>
                      <span>{a.description}</span>
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text3)' }}>
                        {new Date(a.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
