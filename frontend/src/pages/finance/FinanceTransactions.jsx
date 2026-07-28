import { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../../components/Layout';
import api, { getErrorMessage } from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Search, Filter, Plus, ChevronDown, Eye, CheckCircle, XCircle,
  ShieldCheck, X, ArrowDownCircle, ArrowUpCircle, Clock, User,
  FileText, Building2, Tag, Calendar, ChevronRight, Loader2,
  AlertTriangle, MoreHorizontal, Pencil, DollarSign
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v ?? 0);

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_MAP = {
  entered:  { label: 'Entered',  color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  verified: { label: 'Verified', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)' },
  approved: { label: 'Approved', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.25)' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.25)' },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status?.toLowerCase()] || STATUS_MAP.entered;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`
    }}>
      {s.label}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const isDebit = type === 'DEBIT';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: isDebit ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
      color: isDebit ? '#dc2626' : '#16a34a',
      border: `1px solid ${isDebit ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}`
    }}>
      {isDebit ? <ArrowDownCircle size={10} /> : <ArrowUpCircle size={10} />}
      {isDebit ? 'Debit' : 'Credit'}
    </span>
  );
}

// ─── Pill Filter ─────────────────────────────────────────────────────────────

function PillFilter({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
            transition: 'all 0.15s',
            background: value === opt.value ? opt.activeColor || 'var(--accent)' : 'var(--bg3)',
            color: value === opt.value ? (opt.activeTextColor || 'white') : 'var(--text2)',
            borderColor: value === opt.value ? (opt.activeColor || 'var(--accent)') : 'var(--border)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Workflow Timeline ────────────────────────────────────────────────────────

function WorkflowTimeline({ tx }) {
  const steps = [
    { label: 'Entered', user: tx.entered_by_name, at: tx.entered_at, done: true, color: '#64748b' },
    { label: 'Verified', user: tx.verified_by_name, at: tx.verified_at, done: !!tx.verified_at, color: '#7c3aed' },
    { label: 'Approved', user: tx.approved_by_name, at: tx.approved_at, done: !!tx.approved_at, color: '#16a34a' },
  ];
  const isRejected = tx.status === 'rejected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', gap: 12, position: 'relative' }}>
          {/* Line */}
          {i < steps.length - 1 && (
            <div style={{
              position: 'absolute', left: 11, top: 24, bottom: 0, width: 2,
              background: step.done ? step.color + '40' : 'var(--border)'
            }} />
          )}
          {/* Dot */}
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0, zIndex: 1,
            background: step.done ? step.color : 'var(--bg3)',
            border: `2px solid ${step.done ? step.color : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {step.done && <CheckCircle size={11} style={{ color: 'white' }} />}
          </div>
          <div style={{ paddingBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: step.done ? 'var(--text)' : 'var(--text3)' }}>
              {step.label}
              {isRejected && step.label === 'Verified' && !step.done && (
                <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', background: 'rgba(220,38,38,0.1)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>REJECTED</span>
              )}
            </div>
            {step.done ? (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {step.user && <span>{step.user} · </span>}
                {fmtDateTime(step.at)}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Pending</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── New Payment Modal ────────────────────────────────────────────────────────

function NewPaymentModal({ accounts, heads, onClose, onSave }) {
  const [form, setForm] = useState({
    account_id: '', transaction_date: new Date().toISOString().slice(0, 10),
    payee_name: '', description: '', amount: '', account_head_id: ''
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_id || !form.amount || !form.transaction_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      await api.post('/finance/transactions', {
        ...form,
        amount: parseFloat(form.amount),
        account_id: parseInt(form.account_id),
        account_head_id: form.account_head_id ? parseInt(form.account_head_id) : null,
        transaction_type: 'DEBIT'
      });
      toast.success('Payment created successfully');
      onSave();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create payment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 540,
        boxShadow: '0 24px 48px rgba(0,0,0,0.18)'
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} style={{ color: 'var(--accent)' }} /> New Payment
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Bank Account *</label>
                <select className="form-select" value={form.account_id} onChange={e => set('account_id', e.target.value)} required>
                  <option value="">Select bank…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Payee Name</label>
              <input className="form-input" type="text" placeholder="Vendor / payee name" value={form.payee_name} onChange={e => set('payee_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" type="text" placeholder="Payment description" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Account Head</label>
                <select className="form-select" value={form.account_head_id} onChange={e => set('account_head_id', e.target.value)}>
                  <option value="">Select head…</option>
                  {heads.map(h => <option key={h.id} value={h.id}>{h.head_name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              {saving ? 'Creating…' : 'Create Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Transaction Detail Slide-over ────────────────────────────────────────────

function TxDetailPanel({ tx, accounts, heads, currentUserId, onClose, onAction, onUpdateHead }) {
  const [actionLoading, setActionLoading] = useState('');
  const [selectedHead, setSelectedHead] = useState(tx.account_head_id || '');
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const canVerify = tx.status === 'entered';
  const canApprove = tx.status === 'verified';
  const sameUserVerified = tx.verified_by === currentUserId;
  const approveDisabled = canApprove && sameUserVerified;

  const doAction = async (action) => {
    setActionLoading(action);
    try {
      await api.post(`/finance/transactions/${tx.id}/${action}`, rejectNote ? { note: rejectNote } : {});
      toast.success(`Transaction ${action}d successfully`);
      onAction();
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${action}`));
    } finally {
      setActionLoading('');
    }
  };

  const saveHead = async () => {
    if (!selectedHead) return;
    try {
      await api.patch(`/finance/transactions/${tx.id}`, { account_head_id: parseInt(selectedHead) });
      toast.success('Account head updated');
      onUpdateHead(tx.id, parseInt(selectedHead));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update head'));
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900, backdropFilter: 'blur(2px)' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 480, maxWidth: '100vw',
        background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
        zIndex: 901, display: 'flex', flexDirection: 'column',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.14)',
        animation: 'drawerIn 0.24s cubic-bezier(0.4,0,0.2,1)'
      }}>
        <style>{`
          @keyframes drawerIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--accent2)' }}>
              {tx.reference}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <TypeBadge type={tx.transaction_type} />
              <StatusBadge status={tx.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Amount */}
          <div style={{ textAlign: 'center', padding: '20px 0', marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 6 }}>Amount</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: tx.transaction_type === 'DEBIT' ? '#dc2626' : '#16a34a', letterSpacing: '-1px' }}>
              {tx.transaction_type === 'DEBIT' ? '−' : '+'}{INR(tx.amount)}
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>
            {[
              { label: 'Date', value: fmtDate(tx.transaction_date), icon: Calendar },
              { label: 'Bank', value: tx.account_name || '—', icon: Building2 },
              { label: 'Payee', value: tx.payee_name || '—', icon: User },
              { label: 'Description', value: tx.description || '—', icon: FileText },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon size={10} /> {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Account Head update */}
          {(tx.status === 'entered' || tx.status === 'verified') && tx.transaction_type === 'DEBIT' && (
            <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 8 }}>
                Account Head
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="form-select"
                  style={{ flex: 1, fontSize: 13 }}
                  value={selectedHead}
                  onChange={e => setSelectedHead(e.target.value)}
                >
                  <option value="">Select head…</option>
                  {heads.map(h => <option key={h.id} value={h.id}>{h.head_name}</option>)}
                </select>
                <button onClick={saveHead} className="btn btn-primary btn-sm">
                  Save
                </button>
              </div>
              {tx.account_head_name && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                  Current: <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{tx.account_head_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Workflow Timeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 14 }}>
              Workflow History
            </div>
            <WorkflowTimeline tx={tx} />
          </div>

          {/* Reject note input */}
          {showRejectInput && (
            <div style={{ marginBottom: 16 }}>
              <textarea
                className="form-textarea"
                placeholder="Reason for rejection (optional)…"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                style={{ fontSize: 13, minHeight: 70 }}
              />
            </div>
          )}
        </div>

        {/* Action footer */}
        {(canVerify || canApprove) && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            {/* Reject button */}
            <button
              onClick={() => {
                if (!showRejectInput) { setShowRejectInput(true); return; }
                doAction('reject');
              }}
              className="btn btn-danger btn-sm"
              disabled={!!actionLoading}
            >
              {actionLoading === 'reject' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
              Reject
            </button>
            {showRejectInput && (
              <button onClick={() => setShowRejectInput(false)} className="btn btn-ghost btn-sm">Cancel</button>
            )}
            <div style={{ flex: 1 }} />
            {canVerify && (
              <button onClick={() => doAction('verify')} className="btn btn-primary btn-sm" disabled={!!actionLoading}>
                {actionLoading === 'verify' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={13} />}
                Verify
              </button>
            )}
            {canApprove && (
              <div title={approveDisabled ? 'You verified this — another user must approve' : ''}>
                <button
                  onClick={() => !approveDisabled && doAction('approve')}
                  className="btn btn-primary btn-sm"
                  disabled={approveDisabled || !!actionLoading}
                  style={{ opacity: approveDisabled ? 0.45 : 1, cursor: approveDisabled ? 'not-allowed' : 'pointer' }}
                >
                  {actionLoading === 'approve' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={13} />}
                  Approve
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceTransactions() {
  const user = currentUser();

  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [txType, setTxType] = useState('');
  const [headId, setHeadId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  // UI state
  const [selected, setSelected] = useState(new Set());
  const [detailTx, setDetailTx] = useState(null);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [bulkLoading, setBulkLoading] = useState('');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (accountId) params.account_id = accountId;
      if (status) params.status = status;
      if (txType) params.transaction_type = txType;
      if (headId) params.account_head_id = headId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/finance/transactions', { params });
      const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? res.data?.items ?? []);
      setTransactions(list);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load transactions'));
    } finally {
      setLoading(false);
    }
  }, [accountId, status, txType, headId, dateFrom, dateTo]);

  useEffect(() => {
    Promise.all([
      api.get('/finance/accounts').catch(() => ({ data: [] })),
      api.get('/finance/heads').catch(() => ({ data: [] })),
    ]).then(([acc, hd]) => {
      setAccounts(Array.isArray(acc.data) ? acc.data : (acc.data?.results ?? []));
      setHeads(Array.isArray(hd.data) ? hd.data : (hd.data?.results ?? []));
    });
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Client-side search filter
  const filtered = transactions.filter(tx => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (tx.description || '').toLowerCase().includes(q) ||
      (tx.payee_name || '').toLowerCase().includes(q) ||
      (tx.reference || '').toLowerCase().includes(q)
    );
  });

  const allChecked = filtered.length > 0 && filtered.every(tx => selected.has(tx.id));
  const someChecked = selected.size > 0;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map(tx => tx.id)));
  };

  const toggleRow = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const bulkAction = async (action) => {
    setBulkLoading(action);
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => api.post(`/finance/transactions/${id}/${action}`)));
      toast.success(`${ids.length} transaction(s) ${action}d`);
      setSelected(new Set());
      loadTransactions();
    } catch (err) {
      toast.error(getErrorMessage(err, `Bulk ${action} failed`));
    } finally {
      setBulkLoading('');
    }
  };

  const handleAction = () => {
    setDetailTx(null);
    loadTransactions();
  };

  const handleUpdateHead = (txId, headId) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, account_head_id: headId } : t));
  };

  const statusOptions = [
    { value: '', label: 'All' },
    { value: 'entered', label: 'Entered', activeColor: '#64748b' },
    { value: 'verified', label: 'Verified', activeColor: '#7c3aed' },
    { value: 'approved', label: 'Approved', activeColor: '#16a34a' },
    { value: 'rejected', label: 'Rejected', activeColor: '#dc2626' },
  ];

  const typeOptions = [
    { value: '', label: 'All' },
    { value: 'DEBIT', label: 'Debit', activeColor: '#dc2626' },
    { value: 'CREDIT', label: 'Credit', activeColor: '#16a34a' },
  ];

  return (
    <Layout title="Transactions">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUpBar { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        .tx-row:hover { background: var(--bg3) !important; }
        .action-btn { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 4px; transition: all 0.14s; }
        .action-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
          {/* Search */}
          <div className="search-bar" style={{ width: 240 }}>
            <Search size={14} />
            <input
              placeholder="Search description, payee, ref…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Bank filter */}
          <select
            className="form-select"
            style={{ width: 160, height: 38, fontSize: 13 }}
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
          >
            <option value="">All Banks</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
          </select>

          {/* Head filter */}
          <select
            className="form-select"
            style={{ width: 160, height: 38, fontSize: 13 }}
            value={headId}
            onChange={e => setHeadId(e.target.value)}
          >
            <option value="">All Heads</option>
            {heads.map(h => <option key={h.id} value={h.id}>{h.head_name}</option>)}
          </select>

          {/* Date range */}
          <input type="date" className="form-input" style={{ width: 140, height: 38 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
          <input type="date" className="form-input" style={{ width: 140, height: 38 }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        </div>

        <button
          onClick={() => setShowNewPayment(true)}
          className="btn btn-primary"
        >
          <Plus size={15} /> New Payment
        </button>
      </div>

      {/* Status + Type filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>Status</span>
          <PillFilter options={statusOptions} value={status} onChange={setStatus} />
        </div>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>Type</span>
          <PillFilter options={typeOptions} value={txType} onChange={setTxType} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '10px 14px' }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <th>Ref</th>
                <th>Date</th>
                <th>Bank</th>
                <th>Type</th>
                <th>Payee / Description</th>
                <th>Acct Head</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)', display: 'inline-block' }} />
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text3)' }}>Loading transactions…</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '60px 0' }}>
                    <FileText size={36} style={{ color: 'var(--border2)', margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>No transactions found</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Try adjusting the filters above</div>
                  </td>
                </tr>
              ) : filtered.map(tx => (
                <tr
                  key={tx.id}
                  className="tx-row"
                  style={{ background: selected.has(tx.id) ? 'var(--accent-dim)' : 'transparent', transition: 'background 0.12s' }}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleRow(tx.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>
                      {tx.reference || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDate(tx.transaction_date)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{tx.account_name || '—'}</td>
                  <td><TypeBadge type={tx.transaction_type} /></td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tx.payee_name || tx.description || '—'}</div>
                    {tx.payee_name && tx.description && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{tx.description}</div>
                    )}
                  </td>
                  <td>
                    {tx.account_head_name ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'var(--bg3)', color: 'var(--text2)', fontWeight: 600, border: '1px solid var(--border)' }}>
                        {tx.account_head_name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', color: tx.transaction_type === 'DEBIT' ? '#dc2626' : '#16a34a' }}>
                    {tx.transaction_type === 'DEBIT' ? '−' : '+'}{INR(tx.amount)}
                  </td>
                  <td><StatusBadge status={tx.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <button className="action-btn" onClick={() => setDetailTx(tx)} title="View details">
                        <Eye size={11} />
                      </button>
                      {tx.status === 'entered' && (
                        <button className="action-btn" onClick={() => setDetailTx(tx)} title="Verify">
                          <ShieldCheck size={11} /> Verify
                        </button>
                      )}
                      {tx.status === 'verified' && (
                        <button
                          className="action-btn"
                          onClick={() => setDetailTx(tx)}
                          title={tx.verified_by === user.id ? 'You verified this — another user must approve' : 'Approve'}
                          style={tx.verified_by === user.id ? { opacity: 0.4 } : {}}
                        >
                          <CheckCircle size={11} /> Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              {selected.size > 0 && ` · ${selected.size} selected`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
              Net: <span style={{ color: 'var(--text)' }}>
                {INR(filtered.reduce((s, tx) => s + (tx.transaction_type === 'DEBIT' ? -(tx.amount || 0) : (tx.amount || 0)), 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {someChecked && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', color: 'white', borderRadius: 12,
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16,
          zIndex: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          animation: 'slideUpBar 0.2s'
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <button
            onClick={() => bulkAction('verify')}
            disabled={!!bulkLoading}
            style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(124,58,237,0.9)', color: 'white', border: 'none', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
          >
            {bulkLoading === 'verify' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={12} />}
            Bulk Verify
          </button>
          <button
            onClick={() => bulkAction('approve')}
            disabled={!!bulkLoading}
            style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(22,163,74,0.9)', color: 'white', border: 'none', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
          >
            {bulkLoading === 'approve' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={12} />}
            Bulk Approve
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Detail Panel */}
      {detailTx && (
        <TxDetailPanel
          tx={detailTx}
          accounts={accounts}
          heads={heads}
          currentUserId={user.id}
          onClose={() => setDetailTx(null)}
          onAction={handleAction}
          onUpdateHead={handleUpdateHead}
        />
      )}

      {/* New Payment Modal */}
      {showNewPayment && (
        <NewPaymentModal
          accounts={accounts}
          heads={heads}
          onClose={() => setShowNewPayment(false)}
          onSave={() => { setShowNewPayment(false); loadTransactions(); }}
        />
      )}
    </Layout>
  );
}
