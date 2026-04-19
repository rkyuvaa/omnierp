import { useState, useEffect } from 'react';
import { Plus, FileText, Download, Pencil, Trash2, CheckCircle, Clock } from 'lucide-react';
import { Modal, Badge, Loader } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function SubFormSection({ module, parentId, parentData }) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeForm, setActiveForm] = useState(null);

  const load = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        api.get(`/forms/studio/forms/${module}`),
        api.get(`/forms/submissions/${module}/${parentId}`)
      ]);
      setTemplates(tRes.data);
      setSubmissions(sRes.data);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [module, parentId]);

  const startNew = (template) => {
    // Map initial data
    const initialData = {};
    (template.fields_config || []).forEach(f => {
      const parentField = template.mapping_config[f.key];
      if (parentField && parentData[parentField]) {
        initialData[f.key] = parentData[parentField];
      }
    });

    setActiveForm({
      form_definition_id: template.id,
      parent_id: parentId,
      data: initialData,
      status: 'draft',
      definition: template
    });
  };

  const editSubmission = async (sub) => {
    try {
      const res = await api.get(`/forms/submissions/${sub.id}`);
      setActiveForm(res.data);
    } catch { toast.error('Error fetching details'); }
  };

  const save = async (status) => {
    try {
      const payload = { ...activeForm, status };
      if (activeForm.id) await api.put(`/forms/submissions/${activeForm.id}`, payload);
      else await api.post('/forms/submissions', payload);
      
      toast.success(status === 'final' ? 'Document finalized' : 'Draft saved');
      setActiveForm(null);
      load();
    } catch { toast.error('Error saving'); }
  };

  if (loading) return <Loader />;

  return (
    <div className="mt-8">
      <div className="section-title flex justify-between items-center mb-4">
        <span>Documents & Reports</span>
        <div className="flex gap-2">
          {templates.map(t => (
            <button key={t.id} className="btn btn-ghost btn-sm" onClick={() => startNew(t)}>
              <Plus size={14}/> {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {submissions.map(sub => (
          <div key={sub.id} className="card p-3 flex justify-between items-center hover-shadow transition-all border-l-4" style={{ borderLeftColor: sub.status === 'final' ? 'var(--green)' : 'var(--amber)' }}>
            <div className="flex items-center gap-3">
              <FileText className="text-muted" size={20} />
              <div>
                <div className="fw-600 text-sm">{sub.reference_number}</div>
                <div className="text-xs text-muted">{sub.form_name} • {new Date(sub.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={sub.status === 'final' ? 'var(--green-dim)' : 'var(--amber-dim)'} style={{ color: sub.status === 'final' ? 'var(--green)' : 'var(--amber)' }}>
                {sub.status === 'final' ? <CheckCircle size={10}/> : <Clock size={10}/>} {sub.status.toUpperCase()}
              </Badge>
              <button className="btn btn-ghost btn-sm" onClick={() => editSubmission(sub)}><Pencil size={14}/></button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.open(`${api.defaults.baseURL}/forms/submissions/${sub.id}/pdf`, '_blank')}><Download size={14}/></button>
            </div>
          </div>
        ))}
        {submissions.length === 0 && <div className="p-8 text-center text-muted border-2 border-dashed rounded-xl" style={{ gridColumn: '1/-1' }}>No documents created yet for this record.</div>}
      </div>

      {activeForm && (
        <SubmissionModal 
          form={activeForm} 
          setForm={setActiveForm} 
          onSave={save} 
          onClose={() => setActiveForm(null)} 
        />
      )}
    </div>
  );
}

function SubmissionModal({ form, setForm, onSave, onClose }) {
  const fields = form.fields_config || form.definition?.fields_config || [];
  const isFinal = form.status === 'final';

  const updateField = (key, val) => {
    setForm(f => ({ ...f, data: { ...f.data, [key]: val } }));
  };

  const addTableRow = (key) => {
    const current = form.data[key] || [];
    updateField(key, [...current, {}]);
  };

  const updateTableRow = (key, idx, field, val) => {
    const current = [...(form.data[key] || [])];
    current[idx] = { ...current[idx], [field]: val };
    updateField(key, current);
  };

  return (
    <Modal size="lg" title={form.reference_number || `New ${form.definition?.name}`} onClose={onClose}
      footer={!isFinal && <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-ghost" onClick={() => onSave('draft')}>Save Draft</button>
        <button className="btn btn-primary" onClick={() => onSave('final')}>Finalize & Submit</button>
      </>}>
      
      <div className="form-grid">
        {fields.map(f => (
          <div key={f.key} className="form-group" style={{ gridColumn: f.width === 'full' ? '1/-1' : 'span 1' }}>
            <label className="form-label">{f.label}</label>
            
            {f.type === 'textarea' ? (
              <textarea className="form-input" disabled={isFinal} value={form.data[f.key] || ''} onChange={e => updateField(f.key, e.target.value)} />
            ) : f.type === 'info' ? (
              <div className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100 text-sm">{f.label}</div>
            ) : f.type === 'signature' ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50 text-muted italic">
                Signature Pad (Digital Signatures will be collected here)
              </div>
            ) : f.type === 'table' ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 border-b">Description</th><th className="p-2 border-b w-24">Qty</th><th className="p-2 border-b">Value</th><th className="p-2 border-b w-10"></th></tr></thead>
                  <tbody>
                    {(form.data[f.key] || []).map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-1"><input className="form-input form-input-sm" disabled={isFinal} value={row.desc || ''} onChange={e => updateTableRow(f.key, idx, 'desc', e.target.value)} /></td>
                        <td className="p-1"><input className="form-input form-input-sm" disabled={isFinal} type="number" value={row.qty || ''} onChange={e => updateTableRow(f.key, idx, 'qty', e.target.value)} /></td>
                        <td className="p-1"><input className="form-input form-input-sm" disabled={isFinal} value={row.val || ''} onChange={e => updateTableRow(f.key, idx, 'val', e.target.value)} /></td>
                        <td className="p-1">
                          {!isFinal && <button className="btn btn-danger btn-sm p-1" onClick={() => {
                            const next = form.data[f.key].filter((_, i) => i !== idx); updateField(f.key, next);
                          }}><Trash2 size={12}/></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isFinal && <button className="btn btn-ghost btn-sm w-full rounded-none border-t" onClick={() => addTableRow(f.key)}><Plus size={12}/> Add Row</button>}
              </div>
            ) : (
              <input className="form-input" type={f.type} disabled={isFinal} value={form.data[f.key] || ''} onChange={e => updateField(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      {isFinal && <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm fw-600 flex items-center gap-2"><CheckCircle size={16}/> This document is finalized and secured.</div>}
    </Modal>
  );
}
