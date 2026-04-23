import { useState, useEffect } from 'react';
import ModuleList from '../../components/ModuleList';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';

// ─── Inline Config Manager ──────────────────────────────────────────────────
function ConfigSection({ title, items, onAdd, onUpdate, onDelete, fields }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const empty = fields.reduce((a, f) => ({ ...a, [f.key]: '' }), {});

  const startAdd = () => { setForm(empty); setAdding(true); setEditId(null); };
  const startEdit = (item) => { setForm({ ...item }); setEditId(item.id); setAdding(false); };
  const cancel = () => { setAdding(false); setEditId(null); setForm({}); };

  const handleSave = async () => {
    if (!form[fields[0].key]?.trim()) return toast.error(`${fields[0].label} is required`);
    if (editId) await onUpdate(editId, form);
    else await onAdd(form);
    cancel();
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
        <button className="btn btn-ghost btn-sm" onClick={startAdd}><Plus size={13}/> Add</button>
      </div>

      {(adding || editId) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', alignItems: 'flex-end' }}>
          {fields.map(f => (
            <div key={f.key} className="form-group" style={{ flex: f.flex || 1, marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>{f.label}</label>
              <input className="form-input" style={{ padding: '6px 10px' }} type={f.type || 'text'} placeholder={f.placeholder || ''} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
          <button className="btn btn-primary btn-sm" style={{ padding: '6px 14px' }} onClick={handleSave}><Check size={13}/></button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '6px 14px' }} onClick={cancel}><X size={13}/></button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr>
            {fields.map(f => <th key={f.key}>{f.label}</th>)}
            <th style={{ width: 80 }}></th>
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={fields.length + 1} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>No {title} yet. Click Add to create one.</td></tr>}
            {items.map(item => (
              <tr key={item.id}>
                {fields.map(f => <td key={f.key} className={f.bold ? 'fw-600' : 'text-muted text-sm'}>{item[f.key]}</td>)}
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}><Pencil size={12}/></button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(item.id)}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Configuration Tab ───────────────────────────────────────────────────────
function ConfigurationTab() {
  const [subTab, setSubTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);

  const loadAll = () => {
    api.get('/warranty/config/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get('/warranty/config/taxes').then(r => setTaxes(r.data)).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);

  const catAdd    = async (d) => { await api.post('/warranty/config/categories', d); toast.success('Category created'); loadAll(); };
  const catUpdate = async (id, d) => { await api.put(`/warranty/config/categories/${id}`, d); toast.success('Updated'); loadAll(); };
  const catDelete = async (id) => { if (!window.confirm('Delete this category?')) return; await api.delete(`/warranty/config/categories/${id}`); toast.success('Deleted'); loadAll(); };

  const taxAdd    = async (d) => { await api.post('/warranty/config/taxes', d); toast.success('Tax created'); loadAll(); };
  const taxUpdate = async (id, d) => { await api.put(`/warranty/config/taxes/${id}`, d); toast.success('Updated'); loadAll(); };
  const taxDelete = async (id) => { if (!window.confirm('Delete this tax?')) return; await api.delete(`/warranty/config/taxes/${id}`); toast.success('Deleted'); loadAll(); };

  const subTabStyle = (active) => ({
    padding: '8px 20px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    borderRadius: '8px 8px 0 0',
    border: '1px solid var(--border)',
    borderBottom: active ? '1px solid var(--bg)' : '1px solid var(--border)',
    background: active ? 'var(--bg)' : 'var(--bg2)',
    color: active ? 'var(--accent)' : 'var(--text3)',
    marginBottom: -1,
    transition: 'all 0.15s',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  });

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Sub-tab header */}
      <div style={{ display: 'flex', gap: 4, padding: '16px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={subTabStyle(subTab === 'categories')} onClick={() => setSubTab('categories')}>Product Categories</div>
        <div style={subTabStyle(subTab === 'taxes')} onClick={() => setSubTab('taxes')}>Tax Configurations</div>
      </div>

      {/* Sub-tab content */}
      <div style={{ padding: 24 }}>
        {subTab === 'categories' && (
          <ConfigSection
            title="Product Categories"
            items={categories}
            onAdd={catAdd} onUpdate={catUpdate} onDelete={catDelete}
            fields={[
              { key: 'name', label: 'Category Name', bold: true, placeholder: 'e.g. Electronics' },
              { key: 'description', label: 'Description', placeholder: 'Optional description' }
            ]}
          />
        )}
        {subTab === 'taxes' && (
          <ConfigSection
            title="Tax Configurations"
            items={taxes}
            onAdd={taxAdd} onUpdate={taxUpdate} onDelete={taxDelete}
            fields={[
              { key: 'name', label: 'Tax Name', bold: true, placeholder: 'e.g. GST 18%' },
              { key: 'rate', label: 'Rate (%)', type: 'number', flex: 0.5, placeholder: '18' },
              { key: 'description', label: 'Description', placeholder: 'Optional' }
            ]}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function BOMList() {
  const [activeTab, setActiveTab] = useState('components');

  const tabStyle = (active) => ({
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
    color: active ? 'var(--accent)' : 'var(--text3)',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap'
  });

  const tabs = (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
      <div style={tabStyle(activeTab === 'components')} onClick={() => setActiveTab('components')}>Components</div>
      <div style={tabStyle(activeTab === 'sales')} onClick={() => setActiveTab('sales')}>Sales Products</div>
      <div style={tabStyle(activeTab === 'config')} onClick={() => setActiveTab('config')}>⚙ Configuration</div>
    </div>
  );

  if (activeTab === 'config') {
    return (
      <Layout title="BOM / Models">
        <div style={{ padding: '0 0 20px 0' }}>{tabs}</div>
        <ConfigurationTab />
      </Layout>
    );
  }

  return (
    <ModuleList
      title="BOM / Models"
      module="warranty"
      showStages={false}
      endpoint={activeTab === 'sales' ? '/warranty/boms' : '/warranty/components'}
      formPath={activeTab === 'sales' ? '/warranty/bom' : '/warranty/components'}
      exportPath={activeTab === 'sales' ? '/warranty/boms/export/excel' : '/warranty/components/export/excel'}
      topContent={tabs}
      columns={activeTab === 'sales' ? [
        { key: 'name', label: 'BOM Name', bold: true },
        { key: 'description', label: 'Description' }
      ] : [
        { key: 'name', label: 'Product Name', bold: true },
        { key: 'category', label: 'Category' },
        { key: 'part_number', label: 'Part Number' },
        { key: 'product_type', label: 'Type' },
        { key: 'sales_price', label: 'Sales Price' },
        { key: 'sales_taxes', label: 'Sales Taxes' },
        { key: 'on_hand_qty', label: 'On Hand Qty' }
      ]}
    />
  );
}
