import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Bold, Italic, List, Link2, Underline as UnderlineIcon, Paperclip, Trash2, Search } from 'lucide-react';

const PRIORITIES = [
  { key: 'low', label: 'Low', color: '#16a34a' },
  { key: 'medium', label: 'Medium', color: '#ca8a04' },
  { key: 'high', label: 'High', color: '#ea580c' },
  { key: 'urgent', label: '🔴 Urgent', color: '#dc2626' },
];

function RichEditor({ value, onChange, placeholder = 'Add description...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Underline,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'tiptap-content', 'data-placeholder': placeholder },
    },
  });

  useEffect(() => {
    if (editor && value === '' && editor.getHTML() !== '<p></p>') {
      editor.commands.clearContent();
    }
  }, [value]);

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="tiptap-wrapper">
      <div className="tiptap-toolbar">
        <button type="button" className={`tiptap-btn ${editor.isActive('bold') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}><Bold size={12} /></button>
        <button type="button" className={`tiptap-btn ${editor.isActive('italic') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}><Italic size={12} /></button>
        <button type="button" className={`tiptap-btn ${editor.isActive('underline') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}><UnderlineIcon size={12} /></button>
        <button type="button" className={`tiptap-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}><List size={12} /></button>
        <button type="button" className={`tiptap-btn ${editor.isActive('link') ? 'is-active' : ''}`} onMouseDown={e => { e.preventDefault(); setLink(); }}><Link2 size={12} /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export default function TaskDrawer({ onClose, onSaved, prefillDate = null }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: null,
    due_date: prefillDate ? prefillDate.toISOString().slice(0, 16) : '',
    label_ids: [],
  });
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    api.get('/tasks/labels').then(r => setLabels(r.data)).catch(() => {});
    api.get('/users/').then(r => setUsers(r.data || [])).catch(() => {});
    setTimeout(() => titleRef.current?.focus(), 100);
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setIsDirty(true); };

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm('Discard this task?')) onClose();
    } else {
      onClose();
    }
  };

  const handleFiles = (files) => {
    const newFiles = Array.from(files).map(f => ({ file: f, name: f.name, size: f.size, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }));
    setAttachments(a => [...a, ...newFiles]);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); titleRef.current?.focus(); return; }
    setSaving(true);
    try {
      const payload = { ...form, due_date: form.due_date || null };
      const res = await api.post('/tasks/', payload);
      const taskId = res.data.id;
      // Upload attachments
      for (const att of attachments) {
        const fd = new FormData();
        fd.append('file', att.file);
        await api.post(`/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});
      }
      toast.success('Task created!');
      onSaved(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(userSearch.toLowerCase())).slice(0, 8);
  const assignee = users.find(u => u.id === form.assigned_to);
  const selectedLabels = labels.filter(l => form.label_ids.includes(l.id));

  return (
    <>
      <div className="task-drawer-overlay" onClick={handleClose} />
      <div className="task-drawer">
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>New Task</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Fill in the details below</div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4, borderRadius: 6 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Title <span style={{ color: 'var(--red)' }}>*</span></label>
            <input ref={titleRef} className="form-input" placeholder="What needs to be done?" value={form.title}
              onChange={e => set('title', e.target.value)} style={{ fontSize: 15, fontWeight: 600 }} />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description</label>
            <RichEditor value={form.description} onChange={v => set('description', v)} />
          </div>

          {/* Priority */}
          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="segment-selector">
              {PRIORITIES.map(p => (
                <button key={p.key} type="button" className={`seg-btn ${form.priority === p.key ? `active-${p.key}` : ''}`}
                  onClick={() => set('priority', p.key)}>{p.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Assignee */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Assign To</label>
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => setShowUserPicker(v => !v)}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left' }}>
                  {assignee ? (
                    <>
                      <div className="user-avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{assignee.name[0]}</div>
                      <span>{assignee.name}</span>
                    </>
                  ) : <span style={{ color: 'var(--text3)' }}>Select user...</span>}
                </button>
                {showUserPicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100 }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Search size={13} color="var(--text3)" />
                      <input autoFocus value={userSearch} onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search..." style={{ border: 'none', outline: 'none', background: 'none', fontSize: 13, color: 'var(--text)', width: '100%', fontFamily: 'inherit' }} />
                    </div>
                    {form.assigned_to && <div onClick={() => { set('assigned_to', null); setShowUserPicker(false); }}
                      style={{ padding: '8px 12px', fontSize: 12, color: 'var(--red)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>✕ Remove assignee</div>}
                    {filteredUsers.map(u => (
                      <div key={u.id} onClick={() => { set('assigned_to', u.id); setShowUserPicker(false); setUserSearch(''); }}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: form.assigned_to === u.id ? 'var(--accent-dim)' : 'transparent', fontSize: 13 }}
                        onMouseEnter={e => { if (form.assigned_to !== u.id) e.currentTarget.style.background = 'var(--bg3)'; }}
                        onMouseLeave={e => { if (form.assigned_to !== u.id) e.currentTarget.style.background = 'transparent'; }}>
                        <div className="user-avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{u.name?.[0]}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No users found</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Due date */}
            <div className="form-group">
              <label className="form-label">Due Date & Time</label>
              <input type="datetime-local" className="form-input" value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                style={{ fontSize: 13 }} />
            </div>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="form-group">
              <label className="form-label">Labels</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {labels.map(l => {
                  const sel = form.label_ids.includes(l.id);
                  return (
                    <button key={l.id} type="button" onClick={() => set('label_ids', sel ? form.label_ids.filter(id => id !== l.id) : [...form.label_ids, l.id])}
                      style={{ padding: '4px 12px', borderRadius: 99, border: `1.5px solid ${l.color}`, background: sel ? l.color : 'transparent',
                        color: sel ? 'white' : l.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="form-group">
            <label className="form-label">Attachments</label>
            <div className={`dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              <Paperclip size={20} style={{ color: 'var(--text3)', marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Drop files here or click to browse</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Images, PDFs, documents</div>
            </div>
            {attachments.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {attachments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
                    {a.preview ? <img src={a.preview} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📄</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{(a.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button type="button" onClick={() => setAttachments(att => att.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2 }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0, background: 'var(--bg3)' }}>
          <button className="btn btn-ghost" onClick={handleClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
            {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : '✓ Create Task'}
          </button>
        </div>
      </div>
    </>
  );
}
