import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Tag, Plus, Edit2, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text2)',
  marginBottom: 5,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  max_limit: '',
  requires_receipt: true,
};

export default function ExpenseCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [showInactive]);

  async function fetchCategories() {
    setLoading(true);
    try {
      const r = await api.get('/expenses/categories', { params: { include_inactive: showInactive } });
      setCategories(r.data);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('add');
  }

  function openEdit(cat) {
    setForm({
      name: cat.name,
      code: cat.code,
      description: cat.description || '',
      max_limit: cat.max_limit ?? '',
      requires_receipt: cat.requires_receipt,
    });
    setEditId(cat.id);
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name || !form.code) {
      toast.error('Name and Code are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, max_limit: form.max_limit ? parseFloat(form.max_limit) : null };
      if (modal === 'add') {
        await api.post('/expenses/categories', payload);
        toast.success('Category created');
      } else {
        await api.put(`/expenses/categories/${editId}`, payload);
        toast.success('Category updated');
      }
      setModal(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving category');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    if (!window.confirm('Deactivate this category?')) return;
    try {
      await api.delete(`/expenses/categories/${id}`);
      toast.success('Category deactivated');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    }
  }

  return (
    <Layout title="Expense Categories">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginBottom: 20 }}>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />{' '}
            Show inactive
          </label>
          <button
            onClick={openAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 18px',
              borderRadius: 9,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <Plus size={15} /> Add Category
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
        ) : (
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  {['Name', 'Code', 'Description', 'Max Limit', 'Receipt Required', 'Status', 'Actions'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '11px 16px',
                        textAlign: 'left',
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: 'var(--text3)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                      No categories found
                    </td>
                  </tr>
                ) : (
                  categories.map((cat, i) => (
                    <tr
                      key={cat.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        opacity: cat.is_active ? 1 : 0.5,
                        background: i % 2 ? 'var(--bg3)10' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? 'var(--bg3)10' : 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>{cat.name}</td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: 12,
                          color: 'var(--accent)',
                        }}
                      >
                        {cat.code}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: 'var(--text2)',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cat.description || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                        {cat.max_limit ? `₹${cat.max_limit.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {cat.requires_receipt ? (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: '#22c55e',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle size={13} /> Yes
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 12 }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: 20,
                            background: cat.is_active ? '#22c55e20' : '#6b728020',
                            color: cat.is_active ? '#22c55e' : '#6b7280',
                            textTransform: 'uppercase',
                          }}
                        >
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => openEdit(cat)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 7,
                              border: '1px solid var(--border)',
                              background: 'var(--bg3)',
                              color: 'var(--text2)',
                              cursor: 'pointer',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          {cat.is_active && (
                            <button
                              onClick={() => handleDeactivate(cat.id)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 7,
                                border: '1px solid #ef444460',
                                background: '#ef444412',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Trash2 size={12} /> Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add / Edit Modal */}
        {modal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 16,
                padding: 28,
                width: 480,
                maxWidth: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 22,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    fontSize: 17,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Tag size={17} style={{ color: 'var(--accent)' }} />{' '}
                  {modal === 'add' ? 'Add Category' : 'Edit Category'}
                </h3>
                <button
                  onClick={() => setModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>
                      Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Travel"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Code <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TRAVEL"
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      style={{ ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    placeholder="Describe what this category covers..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Max Limit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Leave empty for no limit"
                    value={form.max_limit}
                    onChange={e => setForm(f => ({ ...f, max_limit: e.target.value }))}
                    style={inputStyle}
                  />
                  {form.max_limit && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      Maximum allowed: ₹{parseFloat(form.max_limit || 0).toLocaleString()}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.requires_receipt}
                      onChange={e => setForm(f => ({ ...f, requires_receipt: e.target.checked }))}
                      style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Require Receipt</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                        Employees must attach a receipt to submit this category
                      </div>
                    </div>
                    {form.requires_receipt ? (
                      <CheckCircle size={16} style={{ color: '#22c55e', marginLeft: 'auto' }} />
                    ) : (
                      <AlertCircle size={16} style={{ color: 'var(--text3)', marginLeft: 'auto' }} />
                    )}
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setModal(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : modal === 'add' ? 'Create Category' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
