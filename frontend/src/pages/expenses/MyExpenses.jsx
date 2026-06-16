import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Plus,
  Receipt,
  Upload,
  X,
  Paperclip,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  BanknoteIcon,
} from 'lucide-react';

const INR = v =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

const STATUS_CONFIG = {
  pending:    { label: 'Pending',     color: '#f59e0b', bg: '#f59e0b20', icon: Clock },
  approved:   { label: 'Approved',    color: '#22c55e', bg: '#22c55e20', icon: CheckCircle },
  rejected:   { label: 'Rejected',    color: '#ef4444', bg: '#ef444420', icon: XCircle },
  cancelled:  { label: 'Cancelled',   color: '#6b7280', bg: '#6b728020', icon: XCircle },
  reimbursed: { label: 'Reimbursed',  color: '#6366f1', bg: '#6366f120', icon: BanknoteIcon },
};

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
  category_id: '',
  expense_date: '',
  amount: '',
  description: '',
  purpose: '',
  receipt_filename: '',
};

export default function MyExpenses() {
  const [claims, setClaims] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [receiptName, setReceiptName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    fetchClaims();
    api.get('/expenses/categories').then(r => setCategories(r.data)).catch(() => {});
  }, [filterStatus]);

  async function fetchClaims() {
    setLoading(true);
    try {
      const r = await api.get('/expenses/my', { params: filterStatus ? { status: filterStatus } : {} });
      setClaims(r.data);
    } catch {
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/expenses/upload-receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, receipt_filename: r.data.filename }));
      setReceiptName(r.data.original_name);
      toast.success('Receipt uploaded');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.expense_date || !form.amount) {
      toast.error('Please fill required fields');
      return;
    }
    setSaving(true);
    try {
      await api.post('/expenses/', {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        amount: parseFloat(form.amount),
      });
      toast.success('Expense claim submitted!');
      closeModal();
      fetchClaims();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this expense claim?')) return;
    try {
      await api.post(`/expenses/${id}/cancel`);
      toast.success('Claim cancelled');
      fetchClaims();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    }
  }

  function closeModal() {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setReceiptName('');
  }

  const selCat = categories.find(c => c.id === parseInt(form.category_id));

  return (
    <Layout title="My Expenses">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Filter tabs & Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {[{ v: '', l: 'All' }, ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ v, l: c.label }))].map(
            ({ v, l }) => (
              <button
                key={v}
                onClick={() => setFilterStatus(v)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: filterStatus === v ? 'var(--accent)' : 'var(--bg2)',
                  color: filterStatus === v ? '#fff' : 'var(--text2)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {l}
              </button>
            )
          )}
          <button
            onClick={() => setShowModal(true)}
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
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              marginLeft: 'auto',
            }}
          >
            <Plus size={16} /> New Claim
          </button>
        </div>

        {/* Claims list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
        ) : claims.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 60,
              color: 'var(--text3)',
              background: 'var(--bg2)',
              borderRadius: 14,
              border: '1px solid var(--border)',
            }}
          >
            <Receipt size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>No expense claims found</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Claim" to submit your first expense</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {claims.map(c => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {/* Left accent bar */}
                  <div style={{ width: 4, height: 48, borderRadius: 4, background: cfg.color, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: 'var(--accent)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {c.reference}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 9px',
                          borderRadius: 20,
                          background: cfg.bg,
                          color: cfg.color,
                          textTransform: 'uppercase',
                        }}
                      >
                        {c.status}
                      </span>
                      {c.l1_approver_id && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                            color:
                              c.l1_status === 'approved'
                                ? '#22c55e'
                                : c.l1_status === 'rejected'
                                ? '#ef4444'
                                : '#f59e0b',
                          }}
                        >
                          L1: {(c.l1_status || 'PENDING').toUpperCase()}
                        </span>
                      )}
                      {c.l2_approver_id && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                            color:
                              c.l2_status === 'approved'
                                ? '#22c55e'
                                : c.l2_status === 'rejected'
                                ? '#ef4444'
                                : '#f59e0b',
                          }}
                        >
                          L2: {(c.l2_status || 'PENDING').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>
                      {c.category_name || 'Uncategorized'} — {c.description || 'No description'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      Expense date: {c.expense_date} · Submitted: {c.claim_date}
                    </div>
                    {c.approver_remarks && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontStyle: 'italic' }}>
                        Remark: {c.approver_remarks}
                      </div>
                    )}
                    {c.reimbursement_ref && (
                      <div style={{ fontSize: 12, color: '#6366f1', marginTop: 4 }}>Ref: {c.reimbursement_ref}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{INR(c.amount)}</div>
                    {c.receipt_filename && (
                      <a
                        href={`/api/uploads/expenses/${c.receipt_filename}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '6px 10px',
                          borderRadius: 7,
                          border: '1px solid var(--border)',
                          background: 'var(--bg3)',
                          color: 'var(--text2)',
                          cursor: 'pointer',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          textDecoration: 'none',
                        }}
                      >
                        <Paperclip size={13} /> Receipt
                      </a>
                    )}
                    {c.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(c.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 7,
                          border: '1px solid #ef4444',
                          background: '#ef444415',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Modal */}
        {showModal && (
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
                width: 520,
                maxWidth: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
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
                  <Receipt size={18} style={{ color: 'var(--accent)' }} /> New Expense Claim
                </h3>
                <button
                  onClick={closeModal}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      value={form.category_id}
                      onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">Select category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.max_limit ? ` (max ₹${c.max_limit.toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                    {selCat?.description && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{selCat.description}</div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Expense Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={form.expense_date}
                      onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    style={inputStyle}
                  />
                  {selCat?.max_limit && parseFloat(form.amount) > selCat.max_limit && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#ef4444',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AlertCircle size={11} /> Exceeds category limit of ₹{selCat.max_limit.toLocaleString()}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of expense"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Purpose / Business Justification</label>
                  <textarea
                    placeholder="Why was this expense incurred?"
                    value={form.purpose}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Receipt Upload */}
                <div>
                  <label style={labelStyle}>
                    Receipt {selCat?.requires_receipt && <span style={{ color: '#ef4444' }}>* Required</span>}
                  </label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${form.receipt_filename ? '#22c55e' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: '18px 20px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: form.receipt_filename ? '#22c55e08' : 'var(--bg3)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e =>
                      (e.currentTarget.style.borderColor = form.receipt_filename ? '#22c55e' : 'var(--border)')
                    }
                  >
                    {uploading ? (
                      <div style={{ color: 'var(--text3)', fontSize: 13 }}>Uploading...</div>
                    ) : form.receipt_filename ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          color: '#22c55e',
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle size={16} /> {receiptName}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text3)', fontSize: 13 }}>
                        <Upload size={20} style={{ display: 'block', margin: '0 auto 6px' }} />
                        Click to upload receipt (JPEG, PNG, PDF)
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={handleReceiptUpload}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  onClick={closeModal}
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
                  onClick={handleSubmit}
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
                  {saving ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
