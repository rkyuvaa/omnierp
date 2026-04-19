import { useState, useRef, useEffect } from 'react';
import { Upload, Download, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export function UserSelect({ field, value, onChange }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const deptIds = Array.isArray(field.options) ? field.options : [];

  useEffect(() => {
    api.get('/users/').then(r => {
      let filtered = r.data || [];
      if (deptIds.length > 0) {
        filtered = filtered.filter(u => deptIds.some(id => String(u.department_id) === String(id)));
      }
      setUsers(filtered);
    }).finally(() => setLoading(false));
  }, [JSON.stringify(deptIds)]);

  return (
    <select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)} disabled={loading}>
      <option value="">{loading ? 'Loading...' : '— Select User —'}</option>
      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

export function FileField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();
  const token = localStorage.getItem('token');
  const baseUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
  
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${baseUrl}/api/upload`, { 
        method:'POST', 
        headers:{Authorization:`Bearer ${token}`}, 
        body:fd 
      });
      const data = await r.json();
      onChange({ filename:data.filename, original_name:data.original_name, url:data.url, content_type:data.content_type });
      toast.success('Uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const fileUrl = value?.url ? `${baseUrl}${value.url}` : null;
  
  if (value?.filename) return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--border)' }}>
      <FileText size={16} style={{ color:'var(--accent)', flexShrink:0 }}/>
      <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value.original_name}</span>
      <a href={fileUrl} download={value.original_name} className="btn btn-ghost btn-sm"><Download size={13}/></a>
      <button className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}><Upload size={13}/></button>
      <button className="btn btn-danger btn-sm" onClick={() => onChange(null)}><X size={13}/></button>
      <input ref={inputRef} type="file" style={{ display:'none' }} onChange={handleUpload}/>
    </div>
  );

  return (
    <div>
      <input type="file" style={{ display:'none' }} ref={inputRef} onChange={handleUpload}/>
      <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', border:'2px dashed var(--border)', borderRadius:8, padding:'10px' }}
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

export function FieldInput({ field, value, onChange }) {
  const v = value ?? (field.field_type==='boolean' ? false : field.field_type==='checkbox' ? [] : '');
  switch(field.field_type) {
    case 'textarea': return <textarea className="form-textarea" placeholder={field.placeholder} value={v} onChange={e=>onChange(e.target.value)}/>;
    case 'number': return <input className="form-input" type="number" placeholder={field.placeholder} value={v} onChange={e=>onChange(parseFloat(e.target.value)||0)}/>;
    case 'date': return <input className="form-input" type="date" value={v} onChange={e=>onChange(e.target.value)}/>;
    case 'boolean': return <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}><input type="checkbox" checked={!!v} onChange={e=>onChange(e.target.checked)} style={{ width:16, height:16, accentColor:'var(--accent)' }}/><span className="text-sm">{field.field_label}</span></label>;
    case 'checkbox': return <CheckboxField field={field} value={v} onChange={onChange}/>;
    case 'file': return <FileField field={field} value={v} onChange={onChange}/>;
    case 'selection': return <select className="form-select" value={v} onChange={e=>onChange(e.target.value)}><option value="">— Select —</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>;
    case 'user': return <UserSelect field={field} value={v} onChange={onChange}/>;
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
