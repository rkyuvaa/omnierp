import { useState, useEffect } from 'react';
import { Modal, Badge } from './Shared';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const FIELD_TYPES = ['text', 'number', 'date', 'textarea', 'selection', 'user', 'boolean', 'checkbox', 'file'];
const WIDTH_OPTIONS = [{value:'full',label:'Full Row'},{value:'half',label:'Half Row'},{value:'quarter',label:'Quarter Row'}];

export function FieldModal({ initial, tabs, stages, stageRules, onSave, onClose }) {
  const [f, setF] = useState({ field_name:'', field_label:'', field_type:'text', placeholder:'', options:[], required:false, width:'full', visibility_rule:null, sort_order:0, ...initial });
  const [optInput, setOptInput] = useState('');
  const [departments, setDepartments] = useState([]);
  
  const [stageRuleOp, setStageRuleOp] = useState('has_value');
  const [stageRuleStageId, setStageRuleStageId] = useState('');
  const [stageRuleVal, setStageRuleVal] = useState('');

  useEffect(() => {
    api.get('/departments/').then(r => setDepartments(r.data)).catch(()=>{});
  }, []);

  useEffect(() => {
    if (f.field_name && stageRules) {
      const rule = stageRules.find(r => r.field_name === f.field_name);
      if (rule) {
        setStageRuleStageId(rule.stage_id);
        setStageRuleOp(rule.condition_operator);
        setStageRuleVal(rule.condition_value || '');
      }
    }
  }, [f.field_name, stageRules]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const needsOptions = ['selection', 'checkbox'].includes(f.field_type);
  const allFields = tabs.flatMap(t => t.fields || []).filter(x => x.field_name !== f.field_name);

  const handleSave = () => {
    if (!f.field_label || !f.field_name) return toast.error('Label and Name are required');
    onSave({ 
      ...f, 
      _stageRule: stageRuleStageId, 
      _stageRuleOp: stageRuleOp, 
      _stageRuleVal: stageRuleVal 
    });
  };

  return (
    <Modal title={f.id ? 'Edit Field' : 'New Field'} onClose={onClose} large
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save Field</button></>}>
      <div className="form-grid">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Field Label *</label>
            <input className="form-input" value={f.field_label} onChange={e => {
              set('field_label', e.target.value);
              if (!f.id) set('field_name', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
            }} />
          </div>
          <div className="form-group">
            <label className="form-label">Field Key (Permanent)</label>
            <input className="form-input" value={f.field_name} onChange={e => set('field_name', e.target.value)} disabled={!!f.id} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={f.field_type} onChange={e => set('field_type', e.target.value)}>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Width</label>
            <select className="form-select" value={f.width} onChange={e => set('width', e.target.value)}>
              {WIDTH_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tab</label>
            <select className="form-select" value={f.tab_id || ''} onChange={e => set('tab_id', parseInt(e.target.value) || null)}>
              <option value="">— No Tab —</option>
              {tabs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {!['boolean','checkbox','file'].includes(f.field_type) && (
            <div className="form-group">
              <label className="form-label">Placeholder</label>
              <input className="form-input" value={f.placeholder || ''} onChange={e => set('placeholder', e.target.value)} />
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={f.required} onChange={e => set('required', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <span className="form-label" style={{ margin: 0 }}>Required field</span>
          </label>
        </div>

        {f.field_type === 'user' && (
          <div className="form-group">
            <label className="form-label">Restrict to Department(s)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select 
                className="form-select" 
                value="" 
                onChange={e => e.target.value && !f.options.includes(e.target.value) && set('options', [...f.options, e.target.value])}
              >
                <option value="">— Add Department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {f.options.map(id => {
                const d = departments.find(x => String(x.id) === String(id));
                return (
                  <span key={id} style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 10px',background:'var(--bg3)',borderRadius:20,fontSize:12,fontWeight:600 }}>
                    {d?.name || 'Unknown'} 
                    <button onClick={() => set('options', f.options.filter(x => x !== id))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </span>
                )
              })}
            </div>
            <div className="text-muted size-10 mt-1">Leave empty to show all organizational users. Click to add multiple.</div>
          </div>
        )}

        {f.field_type === 'user' && (
          <div className="form-group">
            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={f.options?.[1] === 'true'} 
                onChange={e => {
                  const opts = [...(f.options || [])];
                  opts[1] = e.target.checked ? 'true' : 'false';
                  set('options', opts);
                }} 
                style={{ accentColor: 'var(--accent)' }} 
              />
              <span className="form-label" style={{ margin: 0 }}>Allow Multiple User Selection</span>
            </label>
          </div>
        )}

        {needsOptions && (
          <div className="form-group">
            <label className="form-label">Options</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="form-input" placeholder="Add option..." value={optInput} onChange={e => setOptInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && optInput.trim() && (set('options', [...(f.options||[]), optInput.trim()]), setOptInput(''))} />
              <button className="btn btn-ghost" onClick={() => optInput.trim() && (set('options', [...(f.options||[]), optInput.trim()]), setOptInput(''))}><Plus size={14}/></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(f.options||[]).map((o, i) => (
                <span key={i} style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 10px',background:'var(--bg3)',borderRadius:20,fontSize:13 }}>
                  {o} <button onClick={() => set('options', f.options.filter((_, j) => i !== j))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Visibility Logic — show only when</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select className="form-select" value={f.visibility_rule?.field || ''} onChange={e => set('visibility_rule', e.target.value ? { field: e.target.value, operator: 'has_value', value: '' } : null)}>
              <option value="">Always visible</option>
              {allFields.map(o => <option key={o.field_name} value={o.field_name}>{o.field_label}</option>)}
            </select>
            {f.visibility_rule?.field && (
              <select className="form-select" value={f.visibility_rule.operator} onChange={e => set('visibility_rule', { ...f.visibility_rule, operator: e.target.value })}>
                <option value="has_value">has value</option>
                <option value="equals">equals specific value</option>
              </select>
            )}
          </div>
          {f.visibility_rule?.operator === 'equals' && (
            <input className="form-input mt-2" placeholder="Value to match..." value={f.visibility_rule.value} onChange={e => set('visibility_rule', { ...f.visibility_rule, value: e.target.value })} />
          )}
        </div>

        {!['file', 'checkbox'].includes(f.field_type) && (
          <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <label className="form-label" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
               <Plus size={14}/> Auto-move to Stage
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select className="form-select" value={stageRuleOp} onChange={e => setStageRuleOp(e.target.value)}>
                <option value="has_value">when field has any value</option>
                <option value="equals">when field equals specific value</option>
              </select>
              <select className="form-select" value={stageRuleStageId} onChange={e => setStageRuleStageId(e.target.value)}>
                <option value="">No auto-move</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {stageRuleOp === 'equals' && stageRuleStageId && (
              <div style={{ marginTop: 8 }}>
                {f.field_type === 'selection' ? (
                  <select className="form-select" value={stageRuleVal} onChange={e => setStageRuleVal(e.target.value)}>
                    <option value="">— Select trigger value —</option>
                    {(f.options||[]).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" placeholder="Value to trigger..." value={stageRuleVal} onChange={e => setStageRuleVal(e.target.value)} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function TabModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const handleSave = () => {
    if (!name.trim()) return toast.error('Name is required');
    onSave({ ...initial, name });
  };
  return (
    <Modal title={initial?.id ? 'Edit Tab' : 'New Tab'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save Tab</button></>}>
      <div className="form-group">
        <label className="form-label">Tab Name *</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Technical Specs" autoFocus />
      </div>
    </Modal>
  );
}
