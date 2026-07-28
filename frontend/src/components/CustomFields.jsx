export default function CustomFields({ fields, values, onChange }) {
  if (!fields?.length) return null;
  return (
    <div>
      <div className="detail-section-title" style={{ marginBottom: 12 }}>Custom Fields</div>
      <div className="form-grid form-grid-2">
        {fields.map(f => (
          <div key={f.id} className="form-group">
            <label className="form-label">{f.field_label}{f.required && ' *'}</label>
            {f.field_type === 'text' && (
              <input className="form-input" value={values[f.field_name] || ''} onChange={e => onChange(f.field_name, e.target.value)} />
            )}
            {f.field_type === 'number' && (
              <input className="form-input" type="number" value={values[f.field_name] || ''} onChange={e => onChange(f.field_name, e.target.value)} />
            )}
            {f.field_type === 'date' && (
              <input className="form-input" type="date" value={values[f.field_name] || ''} onChange={e => onChange(f.field_name, e.target.value)} />
            )}
            {f.field_type === 'boolean' && (
              <select className="form-select" value={values[f.field_name] || ''} onChange={e => onChange(f.field_name, e.target.value)}>
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            )}
            {f.field_type === 'selection' && (
              <select className="form-select" value={values[f.field_name] || ''} onChange={e => onChange(f.field_name, e.target.value)}>
                <option value="">—</option>
                {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
