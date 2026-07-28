import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { SlidersHorizontal, Tag, ShieldCheck, Save, Plus, Edit2, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react';

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

const EMPTY_CAT_FORM = {
  name: '',
  code: '',
  description: '',
  max_limit: '',
  requires_receipt: true,
};

export default function ExpenseConfigurations() {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'policies'

  // Category State
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catModal, setCatModal] = useState(null); // null | 'add' | 'edit'
  const [catForm, setCatForm] = useState(EMPTY_CAT_FORM);
  const [catSaving, setCatSaving] = useState(false);
  const [editCatId, setEditCatId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  // Policy Config State
  const [policyConfig, setPolicyConfig] = useState({
    l2_threshold_amount: 5000,
    auto_approve_hours: 24,
    max_advance_amount: 50000,
    allow_multiple_active_advances: false,
    policy_notes: 'Receipts are required for all claims above ₹500.',
  });
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policySaving, setPolicySaving] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchPolicies();
  }, [showInactive]);

  async function fetchCategories() {
    setCatLoading(true);
    try {
      const r = await api.get('/expenses/categories', { params: { include_inactive: showInactive } });
      setCategories(r.data);
    } catch {
      toast.error('Failed to load expense categories');
    } finally {
      setCatLoading(false);
    }
  }

  async function fetchPolicies() {
    setPolicyLoading(true);
    try {
      const r = await api.get('/expenses/config');
      setPolicyConfig(r.data);
    } catch {
      toast.error('Failed to load expense policies');
    } finally {
      setPolicyLoading(false);
    }
  }

  async function handleSaveCategory() {
    if (!catForm.name || !catForm.code) {
      toast.error('Name and Code are required');
      return;
    }
    setCatSaving(true);
    try {
      const payload = { ...catForm, max_limit: catForm.max_limit ? parseFloat(catForm.max_limit) : null };
      if (catModal === 'add') {
        await api.post('/expenses/categories', payload);
        toast.success('Category created');
      } else {
        await api.put(`/expenses/categories/${editCatId}`, payload);
        toast.success('Category updated');
      }
      setCatModal(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving category');
    } finally {
      setCatSaving(false);
    }
  }

  async function handleToggleCategoryStatus(cat) {
    try {
      await api.put(`/expenses/categories/${cat.id}`, { is_active: !cat.is_active });
      toast.success(`Category ${cat.is_active ? 'deactivated' : 'activated'}`);
      fetchCategories();
    } catch {
      toast.error('Failed to toggle status');
    }
  }

  async function handleSavePolicies() {
    setPolicySaving(true);
    try {
      await api.post('/expenses/config', policyConfig);
      toast.success('Expense policies updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update policies');
    } finally {
      setPolicySaving(false);
    }
  }

  return (
    <Layout title="Expense Configurations">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <button
            onClick={() => setActiveTab('categories')}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'categories' ? 'var(--accent)' : 'var(--bg3)',
              color: activeTab === 'categories' ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Tag size={16} /> Expense Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'policies' ? 'var(--accent)' : 'var(--bg3)',
              color: activeTab === 'policies' ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldCheck size={16} /> Approval & Policy Rules
          </button>
        </div>

        {/* TAB 1: CATEGORIES */}
        {activeTab === 'categories' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Expense Categories</h2>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>Configure claim types, maximum thresholds, and receipt requirements</p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={e => setShowInactive(e.target.checked)}
                  />
                  Show Inactive
                </label>
                <button
                  onClick={() => { setCatForm(EMPTY_CAT_FORM); setEditCatId(null); setCatModal('add'); }}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Plus size={16} /> Add Category
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {catLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading categories...</div>
              ) : categories.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No categories configured yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, color: 'var(--text3)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Category Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Code</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Max Limit</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Receipt Req.</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', opacity: c.is_active ? 1 : 0.6 }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          <div>{c.name}</div>
                          {c.description && <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{c.description}</div>}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent2)' }}>{c.code}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {c.max_limit ? `₹${c.max_limit.toLocaleString('en-IN')}` : <span style={{ color: 'var(--text3)' }}>No Limit</span>}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {c.requires_receipt ? (
                            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>Required</span>
                          ) : (
                            <span style={{ color: 'var(--text3)', fontSize: 12 }}>Optional</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: c.is_active ? '#dcfce7' : '#fee2e2',
                            color: c.is_active ? '#15803d' : '#b91c1c'
                          }}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setCatForm({
                                name: c.name,
                                code: c.code,
                                description: c.description || '',
                                max_limit: c.max_limit ?? '',
                                requires_receipt: c.requires_receipt,
                              });
                              setEditCatId(c.id);
                              setCatModal('edit');
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4, marginRight: 8 }}
                            title="Edit Category"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleCategoryStatus(c)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.is_active ? '#ef4444' : '#16a34a', padding: 4 }}
                            title={c.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {c.is_active ? <Trash2 size={16} /> : <CheckCircle size={16} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: POLICIES */}
        {activeTab === 'policies' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Expense & Cash Advance Policies</h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0' }}>Configure approval thresholds, advance limits, and policy notices</p>
            </div>

            {policyLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading policy rules...</div>
            ) : (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={labelStyle}>L2 Escalation Threshold (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={policyConfig.l2_threshold_amount ?? ''}
                    onChange={e => setPolicyConfig(p => ({ ...p, l2_threshold_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g. 5000"
                  />
                  <span style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'block' }}>
                    Claims equal to or exceeding this amount will automatically require L2 Manager approval.
                  </span>
                </div>

                <div>
                  <label style={labelStyle}>Max Cash Advance Limit Per Request (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={policyConfig.max_advance_amount ?? ''}
                    onChange={e => setPolicyConfig(p => ({ ...p, max_advance_amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g. 50000"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Auto-Approve SLA Timer (Hours)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={policyConfig.auto_approve_hours ?? ''}
                    onChange={e => setPolicyConfig(p => ({ ...p, auto_approve_hours: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 24"
                  />
                  <span style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'block' }}>
                    Hours before pending manager approvals auto-escalate or auto-approve based on system settings.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyConfig.allow_multiple_active_advances ?? false}
                      onChange={e => setPolicyConfig(p => ({ ...p, allow_multiple_active_advances: e.target.checked }))}
                    />
                    Allow employees to request multiple active cash advances before settling previous ones
                  </label>
                </div>

                <div>
                  <label style={labelStyle}>Employee Policy & Compliance Notes</label>
                  <textarea
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    value={policyConfig.policy_notes || ''}
                    onChange={e => setPolicyConfig(p => ({ ...p, policy_notes: e.target.value }))}
                    placeholder="Notice displayed on the expense submission modal..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    onClick={handleSavePolicies}
                    disabled={policySaving}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Save size={16} /> {policySaving ? 'Saving...' : 'Save Configurations'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: ADD / EDIT CATEGORY */}
        {catModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, width: 480, maxWidth: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{catModal === 'add' ? 'Add Expense Category' : 'Edit Expense Category'}</h3>
                <button onClick={() => setCatModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Category Name *</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="e.g. Travel & Lodging"
                    value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Category Code *</label>
                  <input
                    type="text"
                    style={{ ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    placeholder="e.g. TRAVEL"
                    value={catForm.code}
                    onChange={e => setCatForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Max Claim Limit (₹) (Optional)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    placeholder="Leave blank for no limit"
                    value={catForm.max_limit}
                    onChange={e => setCatForm(f => ({ ...f, max_limit: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="Short summary of allowed expenses"
                    value={catForm.description}
                    onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div style={{ marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={catForm.requires_receipt}
                      onChange={e => setCatForm(f => ({ ...f, requires_receipt: e.target.checked }))}
                    />
                    Require receipt / bill attachment for claims under this category
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button onClick={() => setCatModal(null)} className="btn btn-ghost">Cancel</button>
                  <button onClick={handleSaveCategory} disabled={catSaving} className="btn btn-primary">
                    {catSaving ? 'Saving...' : 'Save Category'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
