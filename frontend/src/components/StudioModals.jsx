import { useState, useEffect } from 'react';
import { Modal, Badge } from './Shared';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const FIELD_TYPES = ['text', 'number', 'date', 'textarea', 'selection', 'boolean', 'checkbox', 'file'];

export function FieldModal({ initial, tabs, stages, stageRules, onSave, onClose }) {
  const [f, setF] = useState({ field_name: '', field_label: '', field_type: 'text', placeholder: '', options: [], required: false, width: 'full', visibility_rule: null, sort_order: 0, ...initial });
  const [optInput, setOptInput] = useState('');
  
  const [stageRuleOp, setStageRuleOp] = useState('has_value');
  const [stageRuleStageId, setStageRuleStageId] = useState('');
  const [stageRuleVal, setStageRuleVal] = useState('');

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
  const allOtherFields = tabs.flatMap(t => t.fields || []).filter(x => x.field_name !== f.field_name);

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
              <option value="full">Full Row</option>
              <option value="half">Half Row</option>
              <option value="quarter">Quarter Row</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tab</label>
            <select className="form-select" value={f.tab_id || ''} onChange={e => set('tab_id', parseInt(e.target.value) || null)}>
              <option value="">— No Tab —</option>
              {tabs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Placeholder</label>
            <input className="form-input" value={f.placeholder || ''} onChange={e => set('placeholder', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={f.required} onChange={e => set('required', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <span className="form-label" style={{ margin: 0 }}>Required field</span>
          </label>
        </div>

        {needsOptions && (
          <div className="form-group">
            <label className="form-label">Options</label>
            <div className="flex gap-2 mb-2">
              <input className="form-input" placeholder="Add option..." value={optInput} onChange={e => setOptInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && optInput && (set('options', [...f.options, optInput.trim()]), setOptInput(''))} />
              <button className="btn btn-ghost" onClick={() => optInput && (set('options', [...f.options, optInput.trim()]), setOptInput(''))}>+</button>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {f.options.map((o, i) => (
                <Badge key={i} color="var(--bg3)" style={{ color: 'var(--text)', gap: 6 }}>
                  {o} <button onClick={() => set('options', f.options.filter((_, j) => i !== j))} style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer' }}>×</button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── Visibility Logic ── */}
        <div className="form-group">
          <label className="form-label">Visibility Logic (Show only when...)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select className="form-select" value={f.visibility_rule?.field || ''} onChange={e => set('visibility_rule', e.target.value ? { field: e.target.value, operator: 'has_value', value: '' } : null)}>
              <option value="">Always visible</option>
              {allOtherFields.map(o => <option key={o.field_name} value={o.field_name}>{o.field_label}</option>)}
            </select>
            {f.visibility_rule?.field && (
              <select className="form-select" value={f.visibility_rule.operator} onChange={e => set('visibility_rule', { ...f.visibility_rule, operator: e.target.value })}>
                <option value="has_value">has value</option>
                <option value="equals">equals value</option>
              </select>
            )}
          </div>
          {f.visibility_rule?.operator === 'equals' && (
            <input className="form-input mt-2" placeholder="Value to match..." value={f.visibility_rule.value} onChange={e => set('visibility_rule', { ...f.visibility_rule, value: e.target.value })} />
          )}
        </div>

        {/* ── Auto-Stage Logic ── */}
        <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label className="form-label" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
             Auto-move to Stage
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select className="form-select" value={stageRuleOp} onChange={e => setStageRuleOp(e.target.value)}>
              <option value="has_value">when field has value</option>
              <option value="equals">when field equals...</option>
            </select>
            <select className="form-select" value={stageRuleStageId} onChange={e => setStageRuleStageId(e.target.value)}>
              <option value="">No auto-move</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {stageRuleOp === 'equals' && stageRuleStageId && (
            <input className="form-input mt-2" placeholder="Trigger value..." value={stageRuleVal} onChange={e => setStageRuleVal(e.target.value)} />
          )}
        </div>
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
