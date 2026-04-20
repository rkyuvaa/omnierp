import { useState, useRef, useEffect } from 'react';
import { Upload, Download, X, FileText, User, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

export function BranchSelect({ field, value, onChange }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const filterAuth = field.options?.[0] === 'true';

  useEffect(() => {
    api.get('/branches/').then(r => {
      let data = r.data || [];
      if (filterAuth && user && !user.is_superadmin) {
        const allowedIds = (user.allowed_branches || []).map(id => String(id));
        data = data.filter(b => allowedIds.includes(String(b.id)));
      }
      setBranches(data);
    }).finally(() => setLoading(false));
  }, [filterAuth, user]);

  return (
    <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)} disabled={loading}>
      <option value="">{loading ? 'Loading...' : '— Select Branch —'}</option>
      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

export function UserSelect({ field, value, onChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef();

  const isMulti = field.options?.includes('true');
  const actualDeptIds = (field.options || []).filter(x => x !== 'true' && x !== 'false');

  useEffect(() => {
    api.get('/users/').then(r => {
      let filtered = r.data || [];
      if (actualDeptIds.length > 0) {
        filtered = filtered.filter(u => actualDeptIds.some(id => String(u.department_id) === String(id)));
      }
      setUsers(filtered);
    }).finally(() => setLoading(false));

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [JSON.stringify(actualDeptIds)]);

  const selectedArr = Array.isArray(value) ? value : (value ? [String(value)] : []);
  
  const toggle = (id) => {
    const sId = String(id);
    if (isMulti) {
      if (selectedArr.includes(sId)) onChange(selectedArr.filter(x => x !== sId));
      else onChange([...selectedArr, sId]);
    } else {
      onChange(sId);
      setOpen(false);
    }
    setSearch('');
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) && 
    (!isMulti || !selectedArr.includes(String(u.id)))
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Search Input Area */}
      <div 
        className="form-input" 
        style={{ 
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 40, 
          cursor: 'text', padding: '4px 10px', background: '#fff' 
        }}
        onClick={() => setOpen(true)}
      >
        {selectedArr.map(id => {
          const u = users.find(x => String(x.id) === id);
          if (!u) return null;
          return (
            <div key={id} style={{ 
              display:'flex', alignItems:'center', gap:4, padding:'2px 8px', 
              background:'var(--bg2)', border:'1px solid var(--border)', 
              borderRadius:4, fontSize:11, fontWeight:700, color:'var(--text1)' 
            }}>
              <span>{u.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); toggle(id); }}
                style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:0, display:'flex' }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
        <input 
          style={{ flex: 1, border: 'none', outline: 'none', minWidth: 60, fontSize: 13, background: 'transparent' }}
          placeholder={selectedArr.length === 0 ? (loading ? 'Loading...' : 'Search user...') : ''}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {/* Dropdown Results */}
      {open && (
        <div style={{ 
          position: 'absolute', top: '105%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 8, 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: 250, overflowY: 'auto'
        }}>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(u => (
              <div 
                key={u.id}
                onClick={() => toggle(u.id)}
                style={{ 
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  borderBottom: '1px solid var(--bg3)', transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.target.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.target.style.background = 'transparent'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <User size={12} color="var(--accent)" />
                  </div>
                  <span>{u.name}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: 15, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
              {loading ? 'Fetching users...' : 'No users found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();
  const token = localStorage.getItem('token');
  const baseUrl = window.location.origin;
  
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${baseUrl}/api/studio/upload`, { 
        method:'POST', 
        headers:{Authorization:`Bearer ${token}`}, 
        body:fd 
      });
      const data = await r.json();
      console.log('Upload response:', data);
      const fileData = {
        filename: data.filename || data.file_name,
        original_name: data.original_name || data.name,
        url: data.url || data.path,
        content_type: data.content_type || data.type
      };
      if (fileData.filename) {
        onChange(fileData);
        toast.success('Uploaded');
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) { 
      console.error('Upload error:', err);
      toast.error('Upload failed'); 
    } finally { setUploading(false); }
  };

  const fileUrl = value?.url ? `${baseUrl}${value.url}` : null;
  const isImage = value?.content_type?.startsWith('image/');
  
  if (value?.filename) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'0 12px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--border)', height:42, width:'100%', boxSizing:'border-box' }}>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <button className="btn btn-ghost btn-sm" title="Preview" onClick={() => window.open(fileUrl, '_blank')} style={{ color:'#10b981' }}><Eye size={18}/></button>
        <a href={fileUrl} download={value.original_name} className="btn btn-ghost btn-sm" title="Download"><Download size={14}/></a>
        <button className="btn btn-ghost btn-sm" title="Change" onClick={() => inputRef.current?.click()}><Upload size={14}/></button>
        <button className="btn btn-danger btn-sm" title="Remove" onClick={() => onChange(null)}><X size={14}/></button>
      </div>
      <input ref={inputRef} type="file" style={{ display:'none' }} onChange={handleUpload}/>
    </div>
  );

  return (
    <div style={{ width:'100%' }}>
      <input type="file" style={{ display:'none' }} ref={inputRef} onChange={handleUpload}/>
      <button className="btn btn-ghost" 
        style={{ width:'100%', height:42, minHeight:42, justifyContent:'center', border:'2px dashed var(--border)', borderRadius:8, padding:0 }}
        onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <div className="spinner" style={{ width:14, height:14 }}/> : <><Upload size={14}/> Choose File</>}
      </button>
    </div>
  );
}

export function CheckboxField({ field, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) => selected.includes(opt) ? onChange(selected.filter(o=>o!==opt)) : onChange([...selected,opt]);
  if (!field.options?.length) return <span className="text-muted text-sm">No options</span>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {field.options.map(opt => (
        <label key={opt} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor:'var(--accent)', width:15, height:15 }}/>
          {opt}
        </label>
      ))}
    </div>
  );
}

export function TimerField({ value, onChange }) {
  const [now, setNow] = useState(Date.now());
  const timerData = value || { elapsed: 0, startAt: null };
  const isRunning = !!timerData.startAt;

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const getSeconds = () => {
    if (!isRunning) return timerData.elapsed || 0;
    const diff = Math.floor((now - new Date(timerData.startAt).getTime()) / 1000);
    return (timerData.elapsed || 0) + diff;
  };

  const format = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const start = () => onChange({ ...timerData, startAt: new Date().toISOString() });
  const stop = () => {
    const finalSeconds = getSeconds();
    onChange({ elapsed: finalSeconds, startAt: null });
  };
  const reset = () => {
    if (window.confirm('Reset timer?')) onChange({ elapsed: 0, startAt: null });
  };

  const seconds = getSeconds();

  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', 
      background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)',
      width: '100%', boxSizing: 'border-box'
    }}>
      <div style={{ 
        flex: 1, fontFamily: 'monospace', fontSize: 20, fontWeight: 700, 
        color: isRunning ? 'var(--green)' : 'var(--text1)', letterSpacing: 1 
      }}>
        {format(seconds)}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {isRunning ? (
          <button className="btn btn-danger btn-sm" style={{ padding: '6px 12px' }} onClick={stop} title="Stop Timer">
            <Square size={14} fill="currentColor" /> Stop
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" style={{ padding: '6px 12px' }} onClick={start} title="Start Timer">
            <Play size={14} fill="currentColor" /> Start
          </button>
        )}
        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={reset} title="Reset">
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}

export function FieldInput({ field, value, onChange }) {
  const v = value ?? (field.field_type==='boolean' ? false : field.field_type==='checkbox' ? [] : '');
  switch(field.field_type) {
    case 'textarea': return <textarea className="form-textarea" placeholder={field.placeholder} value={v} onChange={e=>onChange(e.target.value)}/>;
    case 'number': return <input className="form-input" type="number" placeholder={field.placeholder} value={v} onChange={e=>onChange(parseFloat(e.target.value)||0)}/>;
    case 'date': return <input className="form-input" type="date" value={v} onChange={e=>onChange(e.target.value)}/>;
    case 'boolean': return <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}><input type="checkbox" checked={!!v} onChange={e=>onChange(e.target.checked)} style={{ width:16, height:16, accentColor:'var(--accent)' }}/><span className="text-sm">{field.field_label}</span></label>;
    case 'checkbox': return <CheckboxField field={field} value={v} onChange={onChange}/>;
    case 'file': return <FileField field={field} value={v} onChange={onChange}/>;
    case 'timer': return <TimerField value={v} onChange={onChange}/>;
    case 'selection': return <select className="form-select" value={v} onChange={e=>onChange(e.target.value)}><option value="">— Select —</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>;
    case 'user': return <UserSelect field={field} value={v} onChange={onChange}/>;
    case 'branch': return <BranchSelect field={field} value={v} onChange={onChange}/>;
    default: return <input className="form-input" type="text" placeholder={field.placeholder} value={v} onChange={e=>onChange(e.target.value)}/>;
  }
}

export function isVisible(field, customData) {
  if (!field.visibility_rule) return true;
  const { field:rf, operator, value:rv } = field.visibility_rule;
  const val = customData[rf];
  if (operator==='equals') return Array.isArray(val) ? val.includes(rv) : String(val ?? '') === String(rv ?? '');
  return val!==undefined&&val!==''&&val!==false&&val!==null&&!(Array.isArray(val)&&val.length===0);
}
