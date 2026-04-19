import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Settings, Database, Layout as LayoutIcon, Image as ImageIcon } from 'lucide-react';
import { Modal, Badge } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function DocumentManagement({ module, templates, onDataChange, onDelete, parentFields }) {
  const [modal, setModal] = useState(null);

  const save = async (data) => {
    try {
      if (data.id) await api.put(`/forms/studio/forms/${data.id}`, data);
      else await api.post(`/forms/studio/forms/${module}`, data);
      toast.success('Template saved');
      setModal(null);
      onDataChange();
    } catch {
      toast.error('Error saving template');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Document Templates — {module.toUpperCase()}</span>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ name: '', prefix_template: 'DOC-', suffix_template: '-{YYYY}', reset_cycle: 'monthly', fields_config: [], mapping_config: {}, pdf_config: {} })}>
          <Plus size={14}/> Create Template
        </button>
      </div>
      
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Template Name</th>
              <th>Serial Format</th>
              <th>Reset</th>
              <th>Fields</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td className="fw-600"><div className="flex items-center gap-2"><FileText size={16} className="text-muted"/> {t.name}</div></td>
                <td><code>{t.prefix_template}NNNN{t.suffix_template}</code></td>
                <td><Badge color="var(--bg3)" style={{color:'var(--text2)'}}>{t.reset_cycle}</Badge></td>
                <td><Badge color="var(--accent-dim)" style={{color:'var(--accent)'}}>{t.fields_config?.length || 0} fields</Badge></td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(t)}><Settings size={14}/></button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(t.id, t.name)}><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td colSpan="5" className="text-center p-8 text-muted">No document templates created yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && <TemplateModal initial={modal} parentFields={parentFields} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}

function TemplateModal({ initial, parentFields, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [activeTab, setActiveTab] = useState('general'); // general, fields, mapping, pdf
  
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal size="lg" title={form.id ? `Editing: ${form.name}` : 'New Document Template'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onSave(form)}>Save Template</button></>}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, minHeight: 400 }}>
        {/* Sidebar Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderRight: '1px solid var(--border)', paddingRight: 16 }}>
          <button className={`nav-item ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}><Settings size={14}/> General</button>
          <button className={`nav-item ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}><LayoutIcon size={14}/> Form Fields</button>
          <button className={`nav-item ${activeTab === 'mapping' ? 'active' : ''}`} onClick={() => setActiveTab('mapping')}><Database size={14}/> Data Mapping</button>
          <button className={`nav-item ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => setActiveTab('pdf')}><ImageIcon size={14}/> PDF Template</button>
        </div>

        {/* Content Area */}
        <div style={{ padding: '0 8px' }}>
          {activeTab === 'general' && (
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Template Name</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Service Sign-off" />
              </div>
              <div className="form-group">
                <label className="form-label">Prefix Template</label>
                <input className="form-input" value={form.prefix_template} onChange={e => set('prefix_template', e.target.value)} placeholder="e.g. SRV-{YYYY}-" />
                <span className="text-muted text-xs">Use {'{YYYY}'}, {'{MM}'}, {'{DD}'} for dates</span>
              </div>
              <div className="form-group">
                <label className="form-label">Suffix Template</label>
                <input className="form-input" value={form.suffix_template} onChange={e => set('suffix_template', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Reset Cycle</label>
                <select className="form-select" value={form.reset_cycle} onChange={e => set('reset_cycle', e.target.value)}>
                  <option value="none">Never Reset</option>
                  <option value="daily">Daily Reset</option>
                  <option value="weekly">Weekly Reset</option>
                  <option value="monthly">Monthly Reset</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Next Number</label>
                <input className="form-input" type="number" value={form.last_number + 1} disabled />
              </div>
            </div>
          )}

          {activeTab === 'fields' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="fw-600">Fields List</span>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const newFields = [...(form.fields_config || []), { label: 'New Field', key: 'field_' + Date.now(), type: 'text', width: 'full' }];
                  set('fields_config', newFields);
                }}><Plus size={14}/> Add Field</button>
              </div>
              <div className="flex flex-col gap-3">
                {(form.fields_config || []).map((f, i) => (
                  <div key={i} className="card p-3 flex gap-4 items-end bg-gray-50 border-gray-200">
                    <div className="form-group mb-0" style={{ flex: 2 }}>
                      <label className="form-label text-xs">Field Label</label>
                      <input className="form-input form-input-sm" value={f.label} onChange={e => {
                        const next = [...form.fields_config]; next[i].label = e.target.value; set('fields_config', next);
                      }} />
                    </div>
                    <div className="form-group mb-0" style={{ flex: 1 }}>
                      <label className="form-label text-xs">Type</label>
                      <select className="form-select form-select-sm" value={f.type} onChange={e => {
                        const next = [...form.fields_config]; next[i].type = e.target.value; set('fields_config', next);
                      }}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="textarea">Textarea</option>
                        <option value="selection">Selection</option>
                        <option value="signature">Signature Pad</option>
                        <option value="table">Item Table</option>
                        <option value="info">Read-only Info</option>
                      </select>
                    </div>
                    <button className="btn btn-danger btn-sm" style={{ padding: 8 }} onClick={() => {
                      const next = form.fields_config.filter((_, idx) => idx !== i); set('fields_config', next);
                    }}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'mapping' && (
            <div>
              <p className="text-muted text-sm mb-4">Map parent record fields to this form. This data will be auto-filled when a user starts a new document.</p>
              <div className="flex flex-col gap-4">
                {(form.fields_config || []).map((f, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{f.label}</div>
                    <ChevronRight size={14} className="text-muted" />
                    <select className="form-select" style={{ flex: 1.5 }} 
                      value={form.mapping_config[f.key] || ''} 
                      onChange={e => {
                        const next = { ...form.mapping_config, [f.key]: e.target.value };
                        set('mapping_config', next);
                      }}>
                      <option value="">— Don't Auto-fill —</option>
                      {parentFields.map(pf => <option key={pf.id} value={pf.field_name}>{pf.field_label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="form-grid">
               <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Header Template (HTML/Text)</label>
                <textarea className="form-input" rows="3" value={form.pdf_config.header || ''} onChange={e => set('pdf_config', {...form.pdf_config, header: e.target.value})} placeholder="Company Name, Address, etc." />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Footer / Legal Terms</label>
                <textarea className="form-input" rows="4" value={form.pdf_config.footer || ''} onChange={e => set('pdf_config', {...form.pdf_config, footer: e.target.value})} placeholder="Terms and conditions..." />
              </div>
              <div className="form-group">
                <label className="form-label">Logo URL</label>
                <input className="form-input" value={form.pdf_config.logo || ''} onChange={e => set('pdf_config', {...form.pdf_config, logo: e.target.value})} placeholder="https://..." />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ChevronRight(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
}
