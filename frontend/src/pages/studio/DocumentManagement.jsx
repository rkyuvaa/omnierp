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
    <Modal size="full" title={form.id ? `Editing: ${form.name}` : 'New Document Template'} onClose={onClose}
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
            <div style={{ background: '#f0f2f5', padding: 40, borderRadius: 8, minHeight: '842px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* A4 Sheet Preview */}
              <div className="a4-sheet" style={{ 
                width: '595px', minHeight: '842px', background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.1)',
                padding: '40px', position: 'relative', display: 'flex', flexDirection: 'column'
              }}>
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 15, marginBottom: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{form.pdf_config.logo ? <img src={form.pdf_config.logo} style={{ height: 40 }} /> : 'COMPANY LOGO'}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>{form.name.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: '#666' }}>{form.prefix_template}NNNN{form.suffix_template}</div>
                  </div>
                </div>

                {/* Sub-form Fields Designer */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px 10px', flex: 1 }}>
                  {(form.fields_config || []).map((f, i) => (
                    <div key={i} className="field-block" style={{ 
                      gridColumn: f.width === 'half' ? 'span 2' : f.width === 'quarter' ? 'span 1' : '1/-1',
                      border: '1px dashed #ddd', padding: 8, borderRadius: 4, position: 'relative', background: '#fafafa'
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <input 
                           value={f.label} 
                           onChange={e => {
                             const next = [...form.fields_config]; next[i].label = e.target.value; set('fields_config', next);
                           }} 
                           style={{ border: 'none', background: 'transparent', fontWeight: 800, color: '#333', outline: 'none', flex: 1, textTransform: 'uppercase', width: '100%' }} 
                           placeholder="FIELD NAME"
                         />
                         <div className="flex gap-1" style={{ flexShrink: 0 }}>
                           <select value={f.type} onChange={e => {
                             const next = [...form.fields_config]; next[i].type = e.target.value; set('fields_config', next);
                           }} style={{ fontSize: 9, padding: '2px 4px', background: '#eee', border: 'none', borderRadius: 3 }}>
                             <optgroup label="Data Fields">
                               <option value="text">Text Input</option>
                               <option value="number">Number</option>
                               <option value="date">Date</option>
                               <option value="textarea">Text Area</option>
                               <option value="selection">Dropdown</option>
                               <option value="table">Data Table</option>
                               <option value="signature">Signature</option>
                             </optgroup>
                             <optgroup label="Layout & Design">
                               <option value="heading">Heading</option>
                               <option value="static_text">Text Box</option>
                               <option value="static_image">Image Box</option>
                               <option value="separator">Line Separator</option>
                             </optgroup>
                             {module === 'payroll' && (
                               <optgroup label="Payroll Blocks">
                                 <option value="pr_emp_info">Employee Info</option>
                                 <option value="pr_attendance">Attendance Strip</option>
                                 <option value="pr_earnings">Earnings Table</option>
                                 <option value="pr_deductions">Deductions Table</option>
                                 <option value="pr_net_salary">Net Salary Box</option>
                               </optgroup>
                             )}
                           </select>
                           <button onClick={() => {
                             const next = [...form.fields_config];
                             next[i].width = next[i].width === 'full' ? 'half' : next[i].width === 'half' ? 'quarter' : 'full';
                             set('fields_config', next);
                           }} style={{ fontSize: 9, padding: '2px 4px', background: '#eee', border: 'none', borderRadius: 3 }}>{f.width || 'full'}</button>
                           <button onClick={() => {
                             const next = form.fields_config.filter((_, idx) => idx !== i); set('fields_config', next);
                           }} style={{ color: 'var(--red)', fontSize: 12, border: 'none', background: 'none', padding: '0 4px' }}>×</button>
                         </div>
                      </div>
                      
                      <div style={{ marginTop: 8 }}>
                        {f.type === 'static_text' ? (
                          <textarea 
                            value={f.content || ''} 
                            onChange={e => {
                              const next = [...form.fields_config]; next[i].content = e.target.value; set('fields_config', next);
                            }}
                            placeholder="Type paragraph text here..."
                            style={{ width: '100%', fontSize: 11, padding: 6, border: '1px solid #ddd', borderRadius: 4, minHeight: 60, resize: 'vertical' }}
                          />
                        ) : f.type === 'static_image' ? (
                          <input 
                            value={f.url || ''} 
                            onChange={e => {
                              const next = [...form.fields_config]; next[i].url = e.target.value; set('fields_config', next);
                            }}
                            placeholder="Image URL (https://...)"
                            style={{ width: '100%', fontSize: 11, padding: 6, border: '1px solid #ddd', borderRadius: 4 }}
                          />
                        ) : f.type === 'separator' ? (
                          <hr style={{ border: 'none', borderTop: '2px solid #ccc', margin: '12px 0' }} />
                        ) : f.type === 'heading' ? (
                          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>{f.label} Preview</div>
                        ) : f.type.startsWith('pr_') ? (
                          <div style={{ 
                            fontSize: 12, fontWeight: 'bold', color: '#0369a1', background: '#e0f2fe', 
                            border: '1px dashed #7dd3fc', padding: '16px', borderRadius: 6, textAlign: 'center' 
                          }}>
                            Dynamic {f.type.replace('pr_', '').replace('_', ' ').toUpperCase()} Block
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#aaa', background: '#fff', border: '1px solid #eee', padding: 8, borderRadius: 4 }}>
                            {f.type.replace('_', ' ').toUpperCase()} input space...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <button className="btn btn-ghost btn-sm" style={{ gridColumn: '1/-1', border: '2px dashed #eee', height: 40 }}
                    onClick={() => {
                      const next = [...(form.fields_config || []), { label: 'New Field', key: 'f' + Date.now(), type: 'text', width: 'full' }];
                      set('fields_config', next);
                    }}>
                    <Plus size={14}/> Add Field to Document
                  </button>
                </div>

                {/* Footer Section */}
                <div style={{ marginTop: 40, borderTop: '1px solid #eee', paddingTop: 10, fontSize: 10, color: '#999' }}>
                  {form.pdf_config.footer || 'Footer / Terms and Conditions'}
                </div>
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
