import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import {
  Landmark, TrendingUp, TrendingDown, Shield, Clock, CheckCircle2,
  XCircle, PlusCircle, RefreshCw, ChevronDown, X, Eye, Check,
  AlertTriangle, DollarSign, BarChart3, Filter, Calendar, ArrowUpRight,
  ArrowDownRight, CircleDot, BadgeCheck, FileClock
} from 'lucide-react';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_META = {
  entered:  { label: 'Entered',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: FileClock },
  verified: { label: 'Verified', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: BadgeCheck },
  approved: { label: 'Approved', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: XCircle },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)'
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at 70% 30%, ${color}22, transparent 70%)`,
        borderRadius: '0 16px 0 80px'
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#888', bg: '#8882' };
  const Icon = m.icon || CircleDot;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      <Icon size={11} />
      {m.label}
    </span>
  );
}

// ─── Simple Bar Chart ─────────────────────────────────────────────────────────
function DailyChart({ daily }) {
  const max = Math.max(...daily.map(d => d.entered + d.verified + d.approved + d.rejected), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0 4px' }}>
      {daily.map((d, i) => {
        const total = d.entered + d.verified + d.approved + d.rejected;
        const h = Math.round((total / max) * 80);
        return (
          <div key={i} title={`${fmtDate(d.date)}\nEntered: ${d.entered} | Verified: ${d.verified} | Approved: ${d.approved}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}>
            <div style={{ width: '100%', height: h || 3, borderRadius: '3px 3px 0 0', background: `linear-gradient(180deg, #6366f1, #8b5cf6)`, minHeight: 3, transition: 'height 0.4s', opacity: total === 0 ? 0.2 : 1 }} />
            <div style={{ fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).replace(' ', '\n')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 18, padding: '28px 28px 24px', width, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'modalIn 0.22s ease-out', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
  borderRadius: 8, background: 'var(--bg2)', color: 'var(--text)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BankDashboard() {
  const [tab, setTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [txnLoading, setTxnLoading] = useState(false);
  const [showNewTxn, setShowNewTxn] = useState(false);
  const [showNewAcc, setShowNewAcc] = useState(false);
  const [detailTxn, setDetailTxn] = useState(null);
  const [remarkInput, setRemarkInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // New transaction form
  const [txnForm, setTxnForm] = useState({ account_id: '', transaction_date: '', payee_name: '', description: '', amount: '' });
  // New account form
  const [accForm, setAccForm] = useState({ account_name: '', account_number: '', bank_name: '', branch_name: '', ifsc_code: '', current_balance: '', lien_amount: '', notes: '' });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedAccount ? `?account_id=${selectedAccount}` : '';
      const res = await api.get(`/bank/dashboard${params}`);
      setSummary(res.data);
    } catch (e) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get('/bank/accounts');
      setAccounts(res.data || []);
    } catch { }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxnLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccount) params.append('account_id', selectedAccount);
      if (filterStatus) params.append('status', filterStatus);
      const res = await api.get(`/bank/transactions?${params}`);
      setTransactions(res.data || []);
    } catch { }
    setTxnLoading(false);
  }, [selectedAccount, filterStatus]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, loadTransactions]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!txnForm.account_id || !txnForm.amount) return;
    setActionLoading(true);
    try {
      await api.post('/bank/transactions', {
        account_id: parseInt(txnForm.account_id),
        transaction_date: txnForm.transaction_date || undefined,
        payee_name: txnForm.payee_name,
        description: txnForm.description,
        amount: parseFloat(txnForm.amount)
      });
      setShowNewTxn(false);
      setTxnForm({ account_id: '', transaction_date: '', payee_name: '', description: '', amount: '' });
      loadTransactions();
      loadDashboard();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to add transaction');
    }
    setActionLoading(false);
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!accForm.account_name) return;
    setActionLoading(true);
    try {
      await api.post('/bank/accounts', {
        ...accForm,
        current_balance: parseFloat(accForm.current_balance) || 0,
        lien_amount: parseFloat(accForm.lien_amount) || 0
      });
      setShowNewAcc(false);
      setAccForm({ account_name: '', account_number: '', bank_name: '', branch_name: '', ifsc_code: '', current_balance: '', lien_amount: '', notes: '' });
      loadAccounts();
      loadDashboard();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to add account');
    }
    setActionLoading(false);
  };

  const handleVerify = async (txn) => {
    setActionLoading(true);
    try {
      await api.post(`/bank/transactions/${txn.id}/verify`, { remarks: remarkInput });
      setDetailTxn(null); setRemarkInput('');
      loadTransactions(); loadDashboard();
    } catch (err) { alert(err?.response?.data?.detail || 'Failed'); }
    setActionLoading(false);
  };

  const handleApprove = async (txn) => {
    setActionLoading(true);
    try {
      await api.post(`/bank/transactions/${txn.id}/approve`, { remarks: remarkInput });
      setDetailTxn(null); setRemarkInput('');
      loadTransactions(); loadDashboard();
    } catch (err) { alert(err?.response?.data?.detail || 'Failed'); }
    setActionLoading(false);
  };

  const handleReject = async (txn) => {
    if (!remarkInput.trim()) { alert('Please enter rejection remarks'); return; }
    setActionLoading(true);
    try {
      await api.post(`/bank/transactions/${txn.id}/reject`, { remarks: remarkInput });
      setDetailTxn(null); setRemarkInput('');
      loadTransactions(); loadDashboard();
    } catch (err) { alert(err?.response?.data?.detail || 'Failed'); }
    setActionLoading(false);
  };

  const tabStyle = (t) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--text2)',
    transition: 'all 0.2s'
  });

  return (
    <Layout title="Bank Dashboard">
      <div style={{ padding: '20px 24px', minHeight: '100vh', background: 'var(--bg2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          {/* Tabs on the left */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
            <button style={tabStyle('dashboard')} onClick={() => setTab('dashboard')}>📊 Overview</button>
            <button style={tabStyle('transactions')} onClick={() => setTab('transactions')}>📋 Transactions</button>
            <button style={tabStyle('accounts')} onClick={() => setTab('accounts')}>🏦 Accounts</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Account filter */}
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: 12 }}>
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </select>
            <button onClick={() => { loadDashboard(); loadTransactions(); }} style={{ ...inputStyle, width: 'auto', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, background: 'var(--bg)', border: '1.5px solid var(--border)' }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => setShowNewTxn(true)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlusCircle size={15} /> New Payment
            </button>
            <button onClick={() => setShowNewAcc(true)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Landmark size={15} /> Add Account
            </button>
          </div>
        </div>

        {/* ── Dashboard Tab ── */}
        {tab === 'dashboard' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
            ) : summary ? (
              <>
                {/* KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <StatCard label="Current Balance" value={fmt(summary.total_balance)} icon={DollarSign} color="#10b981" />
                  <StatCard label="Lien Amount" value={fmt(summary.total_lien)} sub="Blocked / Held" icon={Shield} color="#f59e0b" />
                  <StatCard label="Available (Net of Lien)" value={fmt(summary.balance_with_lien)} sub="Balance − Lien" icon={TrendingUp} color="#6366f1" />
                </div>

                {/* Status counts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {[
                    { key: 'entered',  icon: FileClock,    color: '#f59e0b', label: 'Payment Entered' },
                    { key: 'verified', icon: BadgeCheck,   color: '#3b82f6', label: 'Verified' },
                    { key: 'approved', icon: CheckCircle2, color: '#10b981', label: 'Approved' },
                    { key: 'rejected', icon: XCircle,      color: '#ef4444', label: 'Rejected' },
                  ].map(({ key, icon: Icon, color, label }) => (
                    <div key={key} style={{ background: 'var(--bg)', border: `1.5px solid ${color}30`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => { setFilterStatus(key); setTab('transactions'); }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{summary.counts?.[key] ?? 0}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Daily chart + accounts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  {/* Chart */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Daily Payment Activity <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>(last 14 days)</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>Total transactions per day</div>
                    {summary.daily && <DailyChart daily={summary.daily} />}
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                      {[
                        { color: '#f59e0b', label: 'Entered' },
                        { color: '#3b82f6', label: 'Verified' },
                        { color: '#10b981', label: 'Approved' },
                        { color: '#ef4444', label: 'Rejected' }
                      ].map(l => (
                        <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Approved amounts per day */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Approved Payments <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>(day-wise)</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>Amount disbursed per day</div>
                    <div style={{ overflowY: 'auto', maxHeight: 200 }}>
                      {(summary.daily || []).filter(d => d.approved > 0 || d.total_amount > 0).slice(-10).reverse().map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(d.date)}</span>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#10b981', background: '#10b98115', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{d.approved} approved</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmt(d.total_amount)}</span>
                          </div>
                        </div>
                      ))}
                      {(summary.daily || []).filter(d => d.approved > 0).length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: 20 }}>No approved payments yet</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Accounts list on dashboard (Removed as requested) */}
              </>
            ) : null}
          </div>
        )}

        {/* ── Transactions Tab ── */}
        {tab === 'transactions' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['', 'entered', 'verified', 'approved', 'rejected'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: filterStatus === s ? '#6366f1' : 'var(--border)',
                  background: filterStatus === s ? '#6366f118' : 'var(--bg)',
                  color: filterStatus === s ? '#6366f1' : 'var(--text2)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
                }}>
                  {s ? STATUS_META[s]?.label : 'All'}
                </button>
              ))}
            </div>

            {txnLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
            ) : (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['Ref', 'Date', 'Account', 'Payee', 'Description', 'Amount', 'Status', 'Workflow', ''].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No transactions found</td></tr>
                    )}
                    {transactions.map(t => {
                      const acc = accounts.find(a => a.id === t.account_id);
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: '#6366f1', fontFamily: 'monospace' }}>{t.reference}</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtDate(t.transaction_date)}</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc?.account_name || '—'}</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text)', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.payee_name || '—'}</td>
                          <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
                          <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(t.amount)}</td>
                          <td style={{ padding: '11px 14px' }}><StatusBadge status={t.status} /></td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {/* Stage dots */}
                              {[
                                { s: 'entered',  done: !!t.entered_at,  name: t.entered_by_name,  icon: FileClock,    color: '#f59e0b' },
                                { s: 'verified', done: !!t.verified_at, name: t.verified_by_name, icon: BadgeCheck,   color: '#3b82f6' },
                                { s: 'approved', done: !!t.approved_at, name: t.approved_by_name, icon: CheckCircle2, color: '#10b981' },
                              ].map((stage, i) => {
                                const Icon = stage.icon;
                                const done = stage.done;
                                const rejected = t.status === 'rejected';
                                return (
                                  <span key={i} title={stage.name ? `${stage.s}: ${stage.name}` : stage.s}
                                    style={{ width: 20, height: 20, borderRadius: '50%', background: done ? `${stage.color}22` : 'var(--bg2)', border: `1.5px solid ${done ? stage.color : 'var(--border)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={10} color={done ? stage.color : '#aaa'} />
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <button onClick={() => { setDetailTxn(t); setRemarkInput(''); }}
                              style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Eye size={12} /> View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Accounts Tab ── */}
        {tab === 'accounts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={20} color="#6366f1" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{a.account_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{a.bank_name || 'Bank'}{a.branch_name ? ` · ${a.branch_name}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>CURRENT BALANCE</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#10b981', marginTop: 2 }}>{fmt(a.current_balance)}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>NET OF LIEN</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#6366f1', marginTop: 2 }}>{fmt(a.balance_with_lien)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>A/C: {a.account_number ? `···${a.account_number.slice(-4)}` : '—'}</span>
                  {a.lien_amount > 0 && (
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                      <Shield size={11} /> Lien: {fmt(a.lien_amount)}
                    </span>
                  )}
                </div>
                {a.ifsc_code && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>IFSC: {a.ifsc_code}</div>}
              </div>
            ))}
            {accounts.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--text3)', fontSize: 13 }}>
                No accounts yet. Click "Add Account" to get started.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New Payment Modal ── */}
      {showNewTxn && (
        <Modal title="New Payment Entry" onClose={() => setShowNewTxn(false)}>
          <form onSubmit={handleAddTransaction}>
            <Field label="Bank Account *">
              <select value={txnForm.account_id} onChange={e => setTxnForm(f => ({ ...f, account_id: e.target.value }))} style={inputStyle} required>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Date">
                <input type="date" value={txnForm.transaction_date} onChange={e => setTxnForm(f => ({ ...f, transaction_date: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Amount (₹) *">
                <input type="number" step="0.01" min="0" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} placeholder="0.00" required />
              </Field>
            </div>
            <Field label="Payee Name">
              <input value={txnForm.payee_name} onChange={e => setTxnForm(f => ({ ...f, payee_name: e.target.value }))} style={inputStyle} placeholder="Name of payee / vendor" />
            </Field>
            <Field label="Description">
              <textarea value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} placeholder="Purpose of payment..." />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setShowNewTxn(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {actionLoading ? 'Saving…' : 'Submit Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── New Account Modal ── */}
      {showNewAcc && (
        <Modal title="Add Bank Account" onClose={() => setShowNewAcc(false)}>
          <form onSubmit={handleAddAccount}>
            <Field label="Account Name *">
              <input value={accForm.account_name} onChange={e => setAccForm(f => ({ ...f, account_name: e.target.value }))} style={inputStyle} placeholder="e.g. HDFC Current Account" required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Bank Name">
                <input value={accForm.bank_name} onChange={e => setAccForm(f => ({ ...f, bank_name: e.target.value }))} style={inputStyle} placeholder="HDFC Bank" />
              </Field>
              <Field label="Branch Name">
                <input value={accForm.branch_name} onChange={e => setAccForm(f => ({ ...f, branch_name: e.target.value }))} style={inputStyle} placeholder="Chennai Main" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Account Number">
                <input value={accForm.account_number} onChange={e => setAccForm(f => ({ ...f, account_number: e.target.value }))} style={inputStyle} placeholder="XXXXXXXXXXXX" />
              </Field>
              <Field label="IFSC Code">
                <input value={accForm.ifsc_code} onChange={e => setAccForm(f => ({ ...f, ifsc_code: e.target.value }))} style={inputStyle} placeholder="HDFC0001234" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Opening Balance (₹)">
                <input type="number" step="0.01" value={accForm.current_balance} onChange={e => setAccForm(f => ({ ...f, current_balance: e.target.value }))} style={inputStyle} placeholder="0.00" />
              </Field>
              <Field label="Lien Amount (₹)">
                <input type="number" step="0.01" value={accForm.lien_amount} onChange={e => setAccForm(f => ({ ...f, lien_amount: e.target.value }))} style={inputStyle} placeholder="0.00" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea value={accForm.notes} onChange={e => setAccForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} placeholder="Any notes about this account..." />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setShowNewAcc(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {actionLoading ? 'Saving…' : 'Add Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Transaction Detail / Action Modal ── */}
      {detailTxn && (
        <Modal title={`Payment ${detailTxn.reference}`} onClose={() => { setDetailTxn(null); setRemarkInput(''); }} width={580}>
          {/* Meta */}
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Status', val: <StatusBadge status={detailTxn.status} /> },
              { label: 'Amount', val: <span style={{ fontWeight: 800, fontSize: 15, color: '#6366f1' }}>{fmt(detailTxn.amount)}</span> },
              { label: 'Date', val: fmtDate(detailTxn.transaction_date) },
              { label: 'Payee', val: detailTxn.payee_name || '—' },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{val}</div>
              </div>
            ))}
          </div>
          {detailTxn.description && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px' }}>{detailTxn.description}</div>
            </div>
          )}

          {/* Workflow timeline */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Approval Workflow</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { step: 'Payment Entered', icon: FileClock,    color: '#f59e0b', by: detailTxn.entered_by_name,  at: detailTxn.entered_at,  done: !!detailTxn.entered_at,  remarks: null },
                { step: 'Manager Verified', icon: BadgeCheck,  color: '#3b82f6', by: detailTxn.verified_by_name, at: detailTxn.verified_at, done: !!detailTxn.verified_at, remarks: detailTxn.verification_remarks },
                { step: 'MD Approved',      icon: CheckCircle2, color: '#10b981', by: detailTxn.approved_by_name, at: detailTxn.approved_at, done: !!detailTxn.approved_at, remarks: detailTxn.approval_remarks },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: s.done ? `${s.color}18` : 'var(--bg2)', border: `2px solid ${s.done ? s.color : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} color={s.done ? s.color : '#aaa'} />
                      </div>
                      {i < 2 && <div style={{ width: 2, height: 24, background: s.done ? s.color + '44' : 'var(--border)', margin: '2px 0' }} />}
                    </div>
                    <div style={{ paddingTop: 4, paddingBottom: 20, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: s.done ? 'var(--text)' : 'var(--text3)' }}>{s.step}</div>
                      {s.done ? (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{s.by} · {fmtDateTime(s.at)}</div>
                          {s.remarks && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, fontStyle: 'italic' }}>{s.remarks}</div>}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>Pending</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {detailTxn.status === 'rejected' && detailTxn.rejection_remarks && (
            <div style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>REJECTION REMARKS</div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>{detailTxn.rejection_remarks}</div>
            </div>
          )}

          {/* Action area */}
          {(detailTxn.status === 'entered' || detailTxn.status === 'verified') && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <Field label="Remarks (optional for approval, required for rejection)">
                <textarea value={remarkInput} onChange={e => setRemarkInput(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} placeholder="Add your remarks..." />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={() => handleReject(detailTxn)} disabled={actionLoading}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={14} /> Reject
                </button>
                {detailTxn.status === 'entered' && (
                  <button onClick={() => handleVerify(detailTxn)} disabled={actionLoading}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BadgeCheck size={14} /> Verify
                  </button>
                )}
                {detailTxn.status === 'verified' && (
                  <button onClick={() => handleApprove(detailTxn)} disabled={actionLoading}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} /> Approve
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
}
