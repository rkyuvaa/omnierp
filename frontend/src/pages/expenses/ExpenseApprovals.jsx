import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Receipt, Paperclip, Search, Wallet, User } from 'lucide-react';

const INR = v =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

const STATUS_COLORS = {
  pending:    '#f59e0b',
  approved:   '#22c55e',
  rejected:   '#ef4444',
  cancelled:  '#6b7280',
  reimbursed: '#6366f1',
};

export default function ExpenseApprovals() {
  const [tab, setTab] = useState('pending');
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState(null); // { claim, type: 'approve'|'reject'|'reimburse' }
  const [remarks, setRemarks] = useState('');
  const [reimbMode, setReimbMode] = useState('direct');
  const [reimbRef, setReimbRef] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClaims();
  }, [tab]);

  async function fetchClaims() {
    setLoading(true);
    try {
      const url = tab === 'pending' ? '/expenses/pending-approvals' : '/expenses/';
      const r = await api.get(url);
      setClaims(r.data);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction() {
    if (!actionModal) return;
    setSaving(true);
    try {
      const { claim, type } = actionModal;
      if (type === 'approve') {
        const r = await api.post(`/expenses/${claim.id}/approve`, { remarks });
        toast.success(r.data.message);
      } else if (type === 'reject') {
        await api.post(`/expenses/${claim.id}/reject`, { remarks });
        toast.success('Claim rejected');
      } else if (type === 'reimburse') {
        await api.post(`/expenses/${claim.id}/reimburse`, {
          reimbursement_mode: reimbMode,
          reimbursement_ref: reimbRef,
        });
        toast.success('Marked as reimbursed');
      }
      setActionModal(null);
      setRemarks('');
      fetchClaims();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setSaving(false);
    }
  }

  const filtered = claims.filter(
    c =>
      !search ||
      c.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.reference?.toLowerCase().includes(search.toLowerCase()) ||
      c.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltered = filtered.reduce((s, c) => s + (c.amount || 0), 0);

  const pendingCount = tab === 'pending' ? claims.length : 0;

  return (
    <Layout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <CheckCircle size={22} style={{ color: 'var(--accent)' }} /> Expense Approvals
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
              Review and process employee expense claims
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
            {filtered.length} claim{filtered.length !== 1 ? 's' : ''} ·{' '}
            <span style={{ color: 'var(--text)' }}>{INR(totalFiltered)}</span>
          </div>
        </div>

        {/* Tabs + Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { v: 'pending', l: 'Pending Approval' },
            { v: 'all', l: 'All Claims' },
          ].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: tab === v ? 'none' : '1px solid var(--border)',
                background: tab === v ? 'var(--accent)' : 'var(--bg2)',
                color: tab === v ? '#fff' : 'var(--text2)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {l} {v === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
            />
            <input
              placeholder="Search employee, ref..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 32,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
                width: 220,
              }}
            />
          </div>
        </div>

        {/* Claims */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
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
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {tab === 'pending' ? 'No pending approvals' : 'No claims found'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => (
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
                <div
                  style={{
                    width: 4,
                    height: 52,
                    borderRadius: 4,
                    background: STATUS_COLORS[c.status] || '#888',
                    flexShrink: 0,
                  }}
                />

                {/* Claim info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
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
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: `${STATUS_COLORS[c.status]}20`,
                        color: STATUS_COLORS[c.status],
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
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <User size={13} style={{ color: 'var(--text3)' }} /> {c.employee_name}
                    <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>
                      {c.category_name || 'Uncategorized'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                    {c.description || 'No description'} · Expense date: {c.expense_date}
                  </div>
                  {c.approver_remarks && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 3, fontStyle: 'italic' }}>
                      {c.approver_remarks}
                    </div>
                  )}
                </div>

                {/* Amount + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--text)', marginRight: 4 }}>
                    {INR(c.amount)}
                  </div>
                  {c.receipt_filename && (
                    <a
                      href={`/api/uploads/expenses/${c.receipt_filename}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '6px 9px',
                        borderRadius: 7,
                        border: '1px solid var(--border)',
                        background: 'var(--bg3)',
                        color: 'var(--text2)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Paperclip size={12} /> Receipt
                    </a>
                  )}
                  {c.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setActionModal({ claim: c, type: 'approve' });
                          setRemarks('');
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#22c55e',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button
                        onClick={() => {
                          setActionModal({ claim: c, type: 'reject' });
                          setRemarks('');
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: '1px solid #ef4444',
                          background: '#ef444415',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </>
                  )}
                  {c.status === 'approved' && (
                    <button
                      onClick={() => {
                        setActionModal({ claim: c, type: 'reimburse' });
                        setReimbMode('direct');
                        setReimbRef('');
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#6366f1',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Wallet size={13} /> Reimburse
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Modal */}
        {actionModal && (
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
                width: 440,
                maxWidth: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <h3 style={{ margin: '0 0 18px', fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
                {actionModal.type === 'approve'
                  ? '✓ Approve Claim'
                  : actionModal.type === 'reject'
                  ? '✗ Reject Claim'
                  : '💰 Mark as Reimbursed'}
              </h3>

              {/* Claim summary */}
              <div
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 18,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {actionModal.claim.reference} — {INR(actionModal.claim.amount)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                  {actionModal.claim.employee_name} · {actionModal.claim.category_name || 'Uncategorized'}
                </div>
              </div>

              {actionModal.type === 'reimburse' ? (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text2)',
                        marginBottom: 5,
                        display: 'block',
                        textTransform: 'uppercase',
                      }}
                    >
                      Reimbursement Mode
                    </label>
                    <select
                      value={reimbMode}
                      onChange={e => setReimbMode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg3)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    >
                      <option value="direct">Direct Payment</option>
                      <option value="payroll">Via Payroll</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--text2)',
                        marginBottom: 5,
                        display: 'block',
                        textTransform: 'uppercase',
                      }}
                    >
                      Reference Number (Optional)
                    </label>
                    <input
                      value={reimbRef}
                      onChange={e => setReimbRef(e.target.value)}
                      placeholder="Transaction/payment reference"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg3)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text2)',
                      marginBottom: 5,
                      display: 'block',
                      textTransform: 'uppercase',
                    }}
                  >
                    Remarks {actionModal.type === 'reject' ? '(Required)' : '(Optional)'}
                  </label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={3}
                    placeholder={
                      actionModal.type === 'reject'
                        ? 'Please provide a reason for rejection...'
                        : 'Add any notes...'
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                      color: 'var(--text)',
                      fontSize: 13,
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setActionModal(null)}
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
                  onClick={handleAction}
                  disabled={saving || (actionModal.type === 'reject' && !remarks.trim())}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background:
                      actionModal.type === 'approve'
                        ? '#22c55e'
                        : actionModal.type === 'reject'
                        ? '#ef4444'
                        : '#6366f1',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: saving || (actionModal.type === 'reject' && !remarks.trim()) ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? 'Processing...'
                    : actionModal.type === 'approve'
                    ? 'Approve'
                    : actionModal.type === 'reject'
                    ? 'Reject'
                    : 'Confirm Reimbursement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
