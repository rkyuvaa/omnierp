import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  CheckCircle,
  XCircle,
  Receipt,
  Paperclip,
  Search,
  Wallet,
  User,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Lock,
} from 'lucide-react';

const INR = v =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

const STATUS_COLORS = {
  pending:    '#f59e0b',
  approved:   '#22c55e',
  rejected:   '#ef4444',
  cancelled:  '#6b7280',
  reimbursed: '#6366f1',
};

const ADV_STATUS_COLORS = {
  draft:                 '#8b5cf6',
  submitted:             '#f59e0b',
  under_review:          '#f59e0b',
  approved:              '#22c55e',
  rejected:              '#ef4444',
  clarification_pending: '#ec4899',
  settlement_pending:    '#3b82f6',
  settlement_submitted:  '#a855f7',
  settlement_approved:   '#10b981',
  closed:                '#6b7280',
};

export default function ExpenseApprovals() {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState('advances'); // reimbursements | advances
  const [subTab, setSubTab] = useState('pending'); // pending | all
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Reimbursement claims state
  const [claims, setClaims] = useState([]);
  
  // Advances & settlements state
  const [advances, setAdvances] = useState([]);
  const [expandedSettlement, setExpandedSettlement] = useState(null); // ID of active open settlement sheet

  // Modal actions state
  const [actionModal, setActionModal] = useState(null); // { record, type: 'approve_claim'|'reject_claim'|'reimburse_claim'|'approve_adv'|'reject_adv'|'clarify_adv'|'approve_settle'|'reject_settle'|'close_adv' }
  const [remarks, setRemarks] = useState('');
  const [reimbMode, setReimbMode] = useState('direct');
  const [reimbRef, setReimbRef] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [mainTab, subTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (mainTab === 'reimbursements') {
        const url = subTab === 'pending' ? '/expenses/pending-approvals' : '/expenses/';
        const r = await api.get(url);
        setClaims(r.data);
      } else {
        // Cash advances & settlements
        let r;
        if (subTab === 'pending') {
          r = await api.get('/expenses/advances/pending-approvals');
        } else {
          // If superadmin, fetch all reports. Otherwise show their own pending
          if (user?.is_superadmin) {
            r = await api.get('/expenses/advances/reports');
          } else {
            r = await api.get('/expenses/advances/pending-approvals');
          }
        }
        setAdvances(r.data);
      }
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction() {
    if (!actionModal) return;
    setSaving(true);
    try {
      const { record, type } = actionModal;
      if (type === 'approve_claim') {
        const r = await api.post(`/expenses/${record.id}/approve`, { remarks });
        toast.success(r.data.message);
      } else if (type === 'reject_claim') {
        await api.post(`/expenses/${record.id}/reject`, { remarks });
        toast.success('Claim rejected');
      } else if (type === 'reimburse_claim') {
        await api.post(`/expenses/${record.id}/reimburse`, {
          reimbursement_mode: reimbMode,
          reimbursement_ref: reimbRef,
        });
        toast.success('Marked as reimbursed');
      } else if (type === 'approve_adv') {
        const r = await api.post(`/expenses/advances/${record.id}/approve`, { remarks });
        toast.success(r.data.message);
      } else if (type === 'reject_adv') {
        await api.post(`/expenses/advances/${record.id}/reject`, { remarks });
        toast.success('Advance request rejected');
      } else if (type === 'clarify_adv') {
        await api.post(`/expenses/advances/${record.id}/clarify`, { remarks });
        toast.success('Sent back for clarification');
      } else if (type === 'approve_settle') {
        await api.post(`/expenses/advances/${record.id}/settle/approve`, { remarks });
        toast.success('Settlement approved');
      } else if (type === 'reject_settle') {
        await api.post(`/expenses/advances/${record.id}/settle/reject`, { remarks });
        toast.success('Settlement rejected');
      } else if (type === 'close_adv') {
        await api.post(`/expenses/advances/${record.id}/close`);
        toast.success('Advance request closed and ledger zeroed out');
      }

      setActionModal(null);
      setRemarks('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  // Filters
  const filteredClaims = claims.filter(
    c =>
      !search ||
      c.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.reference?.toLowerCase().includes(search.toLowerCase()) ||
      c.category_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAdvances = advances.filter(
    a =>
      !search ||
      a.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.reference?.toLowerCase().includes(search.toLowerCase()) ||
      a.purpose?.toLowerCase().includes(search.toLowerCase())
  );

  const totalClaimsVal = filteredClaims.reduce((s, c) => s + (c.amount || 0), 0);
  const totalAdvancesVal = filteredAdvances.reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <Layout title="Expense Approvals Dashboard">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <button
            onClick={() => {
              setMainTab('advances');
              setSubTab('pending');
              setSearch('');
            }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: mainTab === 'advances' ? '2px solid var(--accent)' : '2px solid transparent',
              color: mainTab === 'advances' ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Cash Advances & Settlements
          </button>
          <button
            onClick={() => {
              setMainTab('reimbursements');
              setSubTab('pending');
              setSearch('');
            }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: mainTab === 'reimbursements' ? '2px solid var(--accent)' : '2px solid transparent',
              color: mainTab === 'reimbursements' ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Reimbursement Claims
          </button>
        </div>

        {/* Sub-tabs & Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSubTab('pending')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: subTab === 'pending' ? 'none' : '1px solid var(--border)',
              background: subTab === 'pending' ? 'var(--accent)' : 'var(--bg2)',
              color: subTab === 'pending' ? '#fff' : 'var(--text2)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Pending Review {subTab === 'pending' && (mainTab === 'reimbursements' ? filteredClaims.length : filteredAdvances.length) > 0 ? `(${mainTab === 'reimbursements' ? filteredClaims.length : filteredAdvances.length})` : ''}
          </button>
          
          {/* All tab enabled for claims, or for advances if superadmin */}
          {(mainTab === 'reimbursements' || user?.is_superadmin) && (
            <button
              onClick={() => setSubTab('all')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: subTab === 'all' ? 'none' : '1px solid var(--border)',
                background: subTab === 'all' ? 'var(--accent)' : 'var(--bg2)',
                color: subTab === 'all' ? '#fff' : 'var(--text2)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {mainTab === 'reimbursements' ? 'All Claims History' : 'All Advances History'}
            </button>
          )}

          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginRight: 10 }}>
            {mainTab === 'reimbursements' ? (
              <>
                {filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''} ·{' '}
                <span style={{ color: 'var(--text)' }}>{INR(totalClaimsVal)}</span>
              </>
            ) : (
              <>
                {filteredAdvances.length} request{filteredAdvances.length !== 1 ? 's' : ''} ·{' '}
                <span style={{ color: 'var(--text)' }}>{INR(totalAdvancesVal)}</span>
              </>
            )}
          </div>
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

        {/* ── REIMBURSEMENTS CONTENT ────────────────────────────────────────── */}
        {mainTab === 'reimbursements' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading claims...</div>
            ) : filteredClaims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <Receipt size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {subTab === 'pending' ? 'No pending reimbursement claims' : 'No claims found'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredClaims.map(c => (
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
                    <div style={{ width: 4, height: 52, borderRadius: 4, background: STATUS_COLORS[c.status] || '#888', flexShrink: 0 }} />
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace' }}>{c.reference}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${STATUS_COLORS[c.status]}20`, color: STATUS_COLORS[c.status], textTransform: 'uppercase' }}>{c.status}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={13} style={{ color: 'var(--text3)' }} /> {c.employee_name}
                        <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>·</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>{c.category_name || 'Uncategorized'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                        {c.description || 'No description'} · Expense date: {c.expense_date}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--text)', marginRight: 4 }}>{INR(c.amount)}</div>
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
                          }}
                        >
                          <Paperclip size={12} /> Receipt
                        </a>
                      )}
                      {c.status === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              setActionModal({ record: c, type: 'approve_claim' });
                              setRemarks('');
                            }}
                            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setActionModal({ record: c, type: 'reject_claim' });
                              setRemarks('');
                            }}
                            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ef4444', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {c.status === 'approved' && user?.is_superadmin && (
                        <button
                          onClick={() => {
                            setActionModal({ record: c, type: 'reimburse_claim' });
                            setReimbMode('direct');
                            setReimbRef('');
                          }}
                          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                        >
                          Reimburse
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ADVANCES & SETTLEMENTS CONTENT ────────────────────────────────── */}
        {mainTab === 'advances' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading advances...</div>
            ) : filteredAdvances.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <Wallet size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {subTab === 'pending' ? 'No pending advance requests or settlements' : 'No records found'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredAdvances.map(a => {
                  const color = ADV_STATUS_COLORS[a.status] || '#888';
                  const isSettlement = a.status === 'settlement_submitted';
                  const isClaimedSettle = ['settlement_approved', 'closed'].includes(a.status);
                  
                  return (
                    <div
                      key={a.id}
                      style={{
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 4, height: 48, borderRadius: 4, background: color, flexShrink: 0 }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace' }}>
                              {a.reference || `(Draft Request #${a.id})`}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}15`, color, textTransform: 'uppercase' }}>
                              {isSettlement ? 'SETTLEMENT LOG SUBMITTED' : a.status}
                            </span>
                            {a.project_code && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text2)' }}>
                                PROJECT: {a.project_code}
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={13} style={{ color: 'var(--text3)' }} /> {a.employee_name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                            Purpose: {a.purpose} · Required: {a.required_date || '—'}
                          </div>
                        </div>

                        {/* Amount & action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right', marginRight: 4 }}>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                              {isSettlement || isClaimedSettle ? 'Advance Amount' : 'Requested Amt'}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
                              {INR(a.amount)}
                            </div>
                          </div>

                          {/* If a settlement exists, show claimed sum */}
                          {(isSettlement || isClaimedSettle) && (
                            <div style={{ textAlign: 'right', marginRight: 12 }}>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Claimed expenses</div>
                              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent)' }}>
                                {INR(a.lines.reduce((s, row) => s + (row.amount || 0), 0))}
                              </div>
                            </div>
                          )}

                          {/* File Attachment */}
                          {a.attachment_filename && (
                            <a
                              href={`/api/uploads/expenses/${a.attachment_filename}`}
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
                              }}
                            >
                              <Paperclip size={12} /> Document
                            </a>
                          )}

                          {/* Actions for basic request approval (submitted/under_review) */}
                          {['submitted', 'under_review'].includes(a.status) && (
                            <>
                              <button
                                onClick={() => setActionModal({ record: a, type: 'approve_adv' })}
                                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionModal({ record: a, type: 'reject_adv' })}
                                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ef4444', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => setActionModal({ record: a, type: 'clarify_adv' })}
                                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ec4899', background: '#ec489915', color: '#ec4899', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                              >
                                Clarify
                              </button>
                            </>
                          )}

                          {/* Actions for settlements sheets */}
                          {a.status === 'settlement_submitted' && (
                            <>
                              <button
                                onClick={() => setExpandedSettlement(expandedSettlement === a.id ? null : a.id)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg3)',
                                  color: 'var(--text2)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: 12,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {expandedSettlement === a.id ? (
                                  <>Hide Sheets <ChevronUp size={12} /></>
                                ) : (
                                  <>Review Sheet <ChevronDown size={12} /></>
                                )}
                              </button>
                              <button
                                onClick={() => setActionModal({ record: a, type: 'approve_settle' })}
                                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setActionModal({ record: a, type: 'reject_settle' })}
                                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ef4444', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* Actions for Closure (Admin only, when status is settlement_approved) */}
                          {a.status === 'settlement_approved' && user?.is_superadmin && (
                            <button
                              onClick={() => setActionModal({ record: a, type: 'close_adv' })}
                              style={{
                                padding: '7px 14px',
                                borderRadius: 6,
                                border: 'none',
                                background: 'var(--accent)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Lock size={12} /> Close Advance & Ledger
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable itemized settlement spreadsheet lines */}
                      {expandedSettlement === a.id && a.lines && a.lines.length > 0 && (
                        <div
                          style={{
                            borderTop: '1px solid var(--border)',
                            paddingTop: 12,
                            marginTop: 4,
                            overflowX: 'auto',
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.5px', marginBottom: 8 }}>
                            Itemized Expense Settlement Grid
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Category</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Cost Code</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Cost To</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>From / To</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Description</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Vendor</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>GST %</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Amount</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Bills</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.lines.map((row, rIdx) => (
                                <tr key={row.id || rIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{row.date}</td>
                                  <td style={{ padding: '8px', fontWeight: 600 }}>{row.expense_type}</td>
                                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.cost_code || '—'}</td>
                                  <td style={{ padding: '8px' }}>{row.cost_to || '—'}</td>
                                  <td style={{ padding: '8px' }}>
                                    {row.from_location && row.to_location ? `${row.from_location} ➔ ${row.to_location}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px' }}>{row.description || '—'}</td>
                                  <td style={{ padding: '8px' }}>{row.paid_to || '—'}</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{row.gst_rate}%</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{INR(row.amount)}</td>
                                  <td style={{ padding: '8px' }}>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {row.bill_attachments && row.bill_attachments.map((file, fIdx) => (
                                        <a
                                          key={fIdx}
                                          href={`/api/uploads/expenses/${file}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            background: 'var(--bg3)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 4,
                                            padding: '2px 6px',
                                            fontSize: 10,
                                            color: 'var(--accent)',
                                            textDecoration: 'none',
                                          }}
                                        >
                                          <Paperclip size={10} /> Bill {fIdx + 1}
                                        </a>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Action Remarks Modal */}
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
                {actionModal.type === 'approve_claim' && '✓ Approve Claim'}
                {actionModal.type === 'reject_claim' && '✗ Reject Claim'}
                {actionModal.type === 'reimburse_claim' && '💰 Mark as Reimbursed'}
                {actionModal.type === 'approve_adv' && '✓ Approve Advance Request'}
                {actionModal.type === 'reject_adv' && '✗ Reject Advance Request'}
                {actionModal.type === 'clarify_adv' && '💬 Send Back for Clarification'}
                {actionModal.type === 'approve_settle' && '✓ Approve Expense Settlement'}
                {actionModal.type === 'reject_settle' && '✗ Reject Expense Settlement'}
                {actionModal.type === 'close_adv' && '🔒 Close Advance Account'}
              </h3>

              {/* Summary panel */}
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
                  Ref: {actionModal.record.reference || `Request #${actionModal.record.id}`} — {INR(actionModal.record.amount)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                  Requester: {actionModal.record.employee_name}
                </div>
              </div>

              {actionModal.type === 'reimburse_claim' ? (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 5, display: 'block', textTransform: 'uppercase' }}>
                      Reimbursement Mode
                    </label>
                    <select
                      value={reimbMode}
                      onChange={e => setReimbMode(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                    >
                      <option value="direct">Direct Payment</option>
                      <option value="payroll">Via Payroll</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 5, display: 'block', textTransform: 'uppercase' }}>
                      Reference Number (Optional)
                    </label>
                    <input
                      value={reimbRef}
                      onChange={e => setReimbRef(e.target.value)}
                      placeholder="Transaction/payment reference"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              ) : actionModal.type === 'close_adv' ? (
                <div style={{ marginBottom: 18, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                  <AlertCircle size={14} style={{ color: '#f59e0b', display: 'inline', marginRight: 4 }} />
                  Are you sure you want to close this advance request? 
                  <br />
                  This will log returns (if requester spent less than advance) or reimbursement credits (if requester spent more than advance) in the employee's ledger and set the status to <strong>closed</strong>.
                </div>
              ) : (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 5, display: 'block', textTransform: 'uppercase' }}>
                    Remarks {['reject_claim', 'reject_adv', 'clarify_adv', 'reject_settle'].includes(actionModal.type) ? '(Required)' : '(Optional)'}
                  </label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={3}
                    placeholder={
                      ['reject_claim', 'reject_adv', 'reject_settle'].includes(actionModal.type)
                        ? 'Please provide a reason for rejection...'
                        : actionModal.type === 'clarify_adv'
                        ? 'Please specify what clarification is needed...'
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
                  onClick={() => {
                    setActionModal(null);
                    setRemarks('');
                  }}
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
                  disabled={
                    saving || 
                    ((['reject_claim', 'reject_adv', 'clarify_adv', 'reject_settle'].includes(actionModal.type)) && !remarks.trim())
                  }
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background:
                      ['approve_claim', 'approve_adv', 'approve_settle'].includes(actionModal.type)
                        ? '#22c55e'
                        : ['reject_claim', 'reject_adv', 'reject_settle'].includes(actionModal.type)
                        ? '#ef4444'
                        : actionModal.type === 'clarify_adv'
                        ? '#ec4899'
                        : '#6366f1',
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: saving || (['reject_claim', 'reject_adv', 'clarify_adv', 'reject_settle'].includes(actionModal.type) && !remarks.trim()) ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? 'Processing...'
                    : actionModal.type === 'close_adv'
                    ? 'Confirm Close'
                    : ['approve_claim', 'approve_adv', 'approve_settle'].includes(actionModal.type)
                    ? 'Approve'
                    : ['reject_claim', 'reject_adv', 'reject_settle'].includes(actionModal.type)
                    ? 'Reject'
                    : actionModal.type === 'clarify_adv'
                    ? 'Request Clarification'
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
