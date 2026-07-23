import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
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
  Wallet,
  History,
  Calendar,
  Edit,
  ExternalLink,
  FileText,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  Download,
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

const ADV_STATUS_CONFIG = {
  draft:                 { label: 'Draft', color: '#8b5cf6', bg: '#8b5cf620', icon: FileText },
  submitted:             { label: 'Pending L1', color: '#f59e0b', bg: '#f59e0b20', icon: Clock },
  under_review:          { label: 'Pending L2', color: '#f59e0b', bg: '#f59e0b20', icon: Clock },
  approved:              { label: 'Approved', color: '#22c55e', bg: '#22c55e20', icon: CheckCircle },
  rejected:              { label: 'Rejected', color: '#ef4444', bg: '#ef444420', icon: XCircle },
  clarification_pending: { label: 'Clarify Pending', color: '#ec4899', bg: '#ec489920', icon: AlertCircle },
  settlement_pending:    { label: 'Settle Pending', color: '#3b82f6', bg: '#3b82f620', icon: Wallet },
  settlement_submitted:  { label: 'Settle Submitted', color: '#a855f7', bg: '#a855f720', icon: Clock },
  settlement_approved:   { label: 'Settle Approved', color: '#10b981', bg: '#10b98120', icon: CheckCircle },
  closed:                { label: 'Closed', color: '#6b7280', bg: '#6b728020', icon: CheckCircle },
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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('advances');
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

  // Advances State
  const [advances, setAdvances] = useState([]);
  const [advancesLoading, setAdvancesLoading] = useState(true);
  const [ledger, setLedger] = useState({ balance: 0, transactions: [] });
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    purpose: '',
    project_code: '',
    required_date: '',
    attachment_filename: '',
    is_submit: true,
  });
  const [advanceLines, setAdvanceLines] = useState([]);
  const [advanceAttachmentName, setAdvanceAttachmentName] = useState('');
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [advanceUploading, setAdvanceUploading] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const advanceFileRef = useRef();

  const [uploadingRowIdx, setUploadingRowIdx] = useState(null);
  const lineFileRef = useRef();

  function triggerLineUpload(idx) {
    setUploadingRowIdx(idx);
    lineFileRef.current?.click();
  }

  async function handleLineFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || uploadingRowIdx === null) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await api.post('/expenses/upload-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fname = r.data.filename;
      setAdvanceLines(prev =>
        prev.map((row, i) => {
          if (i === uploadingRowIdx) {
            const current = row.bill_attachments || [];
            return { ...row, bill_attachments: [...current, fname] };
          }
          return row;
        })
      );
      toast.success('Bill attached successfully!');
    } catch {
      toast.error('Failed to upload bill');
    } finally {
      setUploadingRowIdx(null);
      if (lineFileRef.current) lineFileRef.current.value = '';
    }
  }

  function removeLineAttachment(rowIdx, fileIdx) {
    setAdvanceLines(prev =>
      prev.map((row, i) => {
        if (i === rowIdx) {
          const updated = (row.bill_attachments || []).filter((_, fI) => fI !== fileIdx);
          return { ...row, bill_attachments: updated };
        }
        return row;
      })
    );
  }

  function createBlankAdvanceLine() {
    return {
      date: new Date().toISOString().split('T')[0],
      expense_type: '',
      cost_code: '',
      cost_to: '',
      from_location: '',
      to_location: '',
      description: '',
      paid_to: '',
      has_gst_bill: false,
      gst_number: '',
      gst_rate: 0,
      amount: 0,
      bill_attachments: [],
      account_verification: '',
    };
  }

  function addAdvanceLine() {
    setAdvanceLines(prev => [...prev, createBlankAdvanceLine()]);
  }

  function deleteAdvanceLine(idx) {
    setAdvanceLines(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const totalSum = updated.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      setAdvanceForm(f => ({ ...f, amount: totalSum > 0 ? totalSum.toString() : f.amount }));
      return updated;
    });
  }

  function updateAdvanceLineField(idx, field, value) {
    setAdvanceLines(prev => {
      const updated = prev.map((row, i) => i === idx ? { ...row, [field]: value } : row);
      const totalSum = updated.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      setAdvanceForm(f => ({ ...f, amount: totalSum > 0 ? totalSum.toString() : f.amount }));
      return updated;
    });
  }

  useEffect(() => {
    if (activeTab === 'reimbursements') {
      fetchClaims();
      api.get('/expenses/categories').then(r => setCategories(r.data)).catch(() => {});
    } else {
      fetchAdvances();
      fetchLedger();
    }
  }, [activeTab, filterStatus]);

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

  async function fetchAdvances() {
    setAdvancesLoading(true);
    try {
      const r = await api.get('/expenses/advances/my');
      setAdvances(r.data);
    } catch {
      toast.error('Failed to load advances');
    } finally {
      setAdvancesLoading(false);
    }
  }

  async function fetchLedger() {
    try {
      const r = await api.get('/expenses/advances/ledger');
      setLedger(r.data);
    } catch {
      // ignore
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

  async function handleAdvanceAttachmentUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAdvanceUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/expenses/upload-receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAdvanceForm(f => ({ ...f, attachment_filename: r.data.filename }));
      setAdvanceAttachmentName(r.data.original_name);
      toast.success('Document uploaded');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setAdvanceUploading(false);
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

  function openNewAdvanceModal() {
    setEditingAdvance(null);
    setAdvanceForm({
      amount: '',
      purpose: '',
      project_code: '',
      required_date: new Date().toISOString().split('T')[0],
      attachment_filename: '',
      is_submit: true,
    });
    setAdvanceLines([createBlankAdvanceLine()]);
    setAdvanceAttachmentName('');
    setShowAdvanceModal(true);
  }

  function openEditAdvanceModal(adv) {
    setEditingAdvance(adv);
    setAdvanceForm({
      amount: adv.amount.toString(),
      purpose: adv.purpose || '',
      project_code: adv.project_code || '',
      required_date: adv.required_date || '',
      attachment_filename: adv.attachment_filename || '',
      is_submit: true,
    });
    setAdvanceLines(adv.lines && adv.lines.length > 0 ? adv.lines : [createBlankAdvanceLine()]);
    setAdvanceAttachmentName(adv.attachment_filename ? adv.attachment_filename.split('/').pop() : '');
    setShowAdvanceModal(true);
  }

  function closeAdvanceModal() {
    setShowAdvanceModal(false);
    setEditingAdvance(null);
    setAdvanceForm({
      amount: '',
      purpose: '',
      project_code: '',
      required_date: '',
      attachment_filename: '',
      is_submit: true,
    });
    setAdvanceLines([]);
    setAdvanceAttachmentName('');
  }

  async function handleAdvanceSubmit(submitFlag) {
    const defaultPurpose = advanceForm.purpose || advanceLines.find(l => l.description)?.description || 'Itemized Cash Advance Request';
    const finalAmount = parseFloat(advanceForm.amount) || advanceLines.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    if (!finalAmount || finalAmount <= 0) {
      toast.error('Please enter line item amounts for your advance request');
      return;
    }
    setAdvanceSaving(true);
    try {
      const validLines = advanceLines.filter(l => l.expense_type || l.amount > 0 || l.description);
      const payload = {
        amount: finalAmount,
        purpose: defaultPurpose,
        project_code: advanceForm.project_code || null,
        required_date: advanceForm.required_date || null,
        attachment_filename: advanceForm.attachment_filename || null,
        is_submit: submitFlag,
        lines: validLines,
      };

      if (editingAdvance) {
        await api.put(`/expenses/advances/${editingAdvance.id}`, payload);
        toast.success(submitFlag ? 'Advance request resubmitted!' : 'Draft updated!');
      } else {
        await api.post('/expenses/advances', payload);
        toast.success(submitFlag ? 'Advance request submitted!' : 'Draft saved!');
      }
      closeAdvanceModal();
      fetchAdvances();
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    } finally {
      setAdvanceSaving(false);
    }
  }

  const selCat = categories.find(c => c.id === parseInt(form.category_id));

  return (
    <Layout title={activeTab === 'reimbursements' ? 'My Expenses & Claims' : 'My Cash Advances'}>
      <div style={{ padding: '0 24px 24px' }}>
        {/* Main Tabs */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <button
            onClick={() => {
              setActiveTab('advances');
              setFilterStatus('');
            }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'advances' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'advances' ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Cash Advances
          </button>
          <button
            onClick={() => {
              setActiveTab('reimbursements');
              setFilterStatus('');
            }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'reimbursements' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'reimbursements' ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Reimbursement Claims
          </button>
        </div>

        {/* ── REIMBURSEMENTS TAB ────────────────────────────────────────────── */}
        {activeTab === 'reimbursements' && (
          <>
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
          </>
        )}

        {/* ── ADVANCES TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'advances' && (
          <>
            {/* Advance Ledger Balance Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)',
                borderRadius: 14,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
                color: '#fff',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.85, marginBottom: 4 }}>
                  Advance Ledger Balance
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
                  {INR(ledger.balance)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowLedgerModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    backdropFilter: 'blur(4px)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <History size={14} /> Ledger History
                </button>
                <button
                  onClick={openNewAdvanceModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#fff',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Plus size={14} /> New Advance Request
                </button>
              </div>
            </div>

            {/* Advances List */}
            {advancesLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading advances...</div>
            ) : advances.length === 0 ? (
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
                <Wallet size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>No advance requests found</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Click "New Advance Request" to submit one</div>
              </div>
            ) : (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg3)' }}>
                        {['Record No', 'Amount', 'Purpose', 'Project Code', 'Required Date', 'Status', 'Actions'].map(h => (
                          <th
                            key={h}
                            style={{
                              padding: '12px 18px',
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
                      {advances.map((a, i) => {
                        const cfg = ADV_STATUS_CONFIG[a.status] || { label: a.status, color: 'var(--text)', bg: 'var(--bg3)' };
                        return (
                          <tr
                            key={a.id}
                            style={{
                              borderTop: '1px solid var(--border)',
                              background: i % 2 === 0 ? 'transparent' : 'var(--bg3)10',
                            }}
                          >
                            {/* Record Number / Ref */}
                            <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                              {a.reference || `(Draft #${a.id})`}
                            </td>
                            {/* Amount */}
                            <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text)' }}>
                              {INR(a.amount)}
                            </td>
                            {/* Purpose */}
                            <td style={{ padding: '14px 18px', color: 'var(--text2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.purpose}
                            </td>
                            {/* Project Code */}
                            <td style={{ padding: '14px 18px', color: 'var(--text)', fontFamily: 'monospace', fontSize: 12 }}>
                              {a.project_code || '—'}
                            </td>
                            {/* Required Date */}
                            <td style={{ padding: '14px 18px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                              {a.required_date || '—'}
                            </td>
                            {/* Status */}
                            <td style={{ padding: '14px 18px' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '3px 10px',
                                  borderRadius: 20,
                                  background: cfg.bg,
                                  color: cfg.color,
                                  textTransform: 'uppercase',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {cfg.icon && <cfg.icon size={11} />}
                                {cfg.label}
                              </span>
                              {a.status === 'clarification_pending' && a.clarification_remarks && (
                                <div style={{ fontSize: 11, color: '#ec4899', marginTop: 4, fontStyle: 'italic' }}>
                                  Q: {a.clarification_remarks}
                                </div>
                              )}
                            </td>
                            {/* Actions */}
                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Edit action for Draft or Clarification Pending */}
                                {(a.status === 'draft' || a.status === 'clarification_pending') && (
                                  <button
                                    onClick={() => openEditAdvanceModal(a)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: 6,
                                      border: '1px solid var(--border)',
                                      background: 'var(--bg3)',
                                      color: 'var(--text2)',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Edit size={12} /> Edit
                                  </button>
                                )}

                                {/* Settle Action for Approved / Settle Pending / Settle Submitted / Settle Approved / Closed */}
                                {['approved', 'settlement_pending', 'settlement_submitted', 'settlement_approved', 'closed'].includes(a.status) && (
                                  <button
                                    onClick={() => navigate(`/expenses/advance/${a.id}/settlement`)}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      border: 'none',
                                      background: a.status === 'approved' || a.status === 'settlement_pending' ? 'var(--accent)' : 'var(--bg3)',
                                      color: a.status === 'approved' || a.status === 'settlement_pending' ? '#fff' : 'var(--text2)',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Wallet size={12} />
                                    {['approved', 'settlement_pending'].includes(a.status) ? 'Settle Expenses' : 'View Settlement'}
                                  </button>
                                )}

                                {/* Attachment View */}
                                {a.attachment_filename && (
                                  <a
                                    href={`/api/uploads/expenses/${a.attachment_filename}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      padding: '5px',
                                      borderRadius: 6,
                                      border: '1px solid var(--border)',
                                      background: 'var(--bg3)',
                                      color: 'var(--text3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      textDecoration: 'none',
                                    }}
                                    title="View attachment"
                                  >
                                    <Paperclip size={12} />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SUBMIT EXPENSE CLAIM MODAL ────────────────────────────────────── */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 17, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
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

        {/* Hidden Line File Upload Input */}
        <input
          ref={lineFileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleLineFileUpload}
        />

        {/* ── SUBMIT CASH ADVANCE REQUEST MODAL ──────────────────────────────── */}
        {showAdvanceModal && (
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
                padding: 24,
                width: '95vw',
                maxWidth: 1240,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 17, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wallet size={18} style={{ color: 'var(--accent)' }} />
                  {editingAdvance ? 'Edit Advance Request' : 'New Advance Request'}
                </h3>
                <button
                  onClick={closeAdvanceModal}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Minimal Top Header Bar (Date & Live Auto-Sum Total) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  background: 'var(--bg3)',
                  padding: '12px 18px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                      Required Date
                    </label>
                    <input
                      type="date"
                      value={advanceForm.required_date}
                      onChange={e => setAdvanceForm(f => ({ ...f, required_date: e.target.value }))}
                      style={{ ...inputStyle, width: 160, padding: '6px 10px' }}
                    />
                  </div>
                </div>

                {/* Total Calculated Amount */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 2 }}>
                    Total Request Amount
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
                    ₹ {advanceLines.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* ── ITEMIZED EXPENSE BREAKDOWN SHEET TABLE ────────────────────── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={15} style={{ color: 'var(--accent)' }} /> Itemized Expense / Request Breakdown Sheet
                  </div>
                  <button
                    type="button"
                    onClick={addAdvanceLine}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--accent)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 10.5, color: 'var(--text3)', letterSpacing: '0.4px' }}>
                          <th style={{ padding: '10px 8px', textAlign: 'center', width: 35 }}>S#</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 125 }}>Date *</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 130 }}>Type *</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 100 }}>Cost Code</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 100 }}>Cost to</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 95 }}>From</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 95 }}>To</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 150 }}>Description</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 110 }}>Paid to</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 130 }}>GST Bill</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right', width: 110 }}>Amt (Rs. Ps) *</th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', width: 160 }}>Bills Attached</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {advanceLines.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: 'var(--text3)', fontSize: 11 }}>
                              {idx + 1}
                            </td>

                            {/* Date */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="date"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.date}
                                onChange={e => updateAdvanceLineField(idx, 'date', e.target.value)}
                              />
                            </td>

                            {/* Type / Expense Category */}
                            <td style={{ padding: '8px' }}>
                              <select
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.expense_type}
                                onChange={e => updateAdvanceLineField(idx, 'expense_type', e.target.value)}
                              >
                                <option value="">Select Type</option>
                                {categories.map(c => (
                                  <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Cost Code */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="text"
                                placeholder="Cost Code"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.cost_code || ''}
                                onChange={e => updateAdvanceLineField(idx, 'cost_code', e.target.value)}
                              />
                            </td>

                            {/* Cost to */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="text"
                                placeholder="Cost Center"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.cost_to || ''}
                                onChange={e => updateAdvanceLineField(idx, 'cost_to', e.target.value)}
                              />
                            </td>

                            {/* From */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="text"
                                placeholder="From"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.from_location || ''}
                                onChange={e => updateAdvanceLineField(idx, 'from_location', e.target.value)}
                              />
                            </td>

                            {/* To */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="text"
                                placeholder="To"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.to_location || ''}
                                onChange={e => updateAdvanceLineField(idx, 'to_location', e.target.value)}
                              />
                            </td>

                            {/* Description */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="text"
                                placeholder="Description/Remarks"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.description || ''}
                                onChange={e => updateAdvanceLineField(idx, 'description', e.target.value)}
                              />
                            </td>

                            {/* Paid to */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="text"
                                placeholder="Vendor/Merchant"
                                style={{ ...inputStyle, padding: '6px 8px' }}
                                value={row.paid_to || ''}
                                onChange={e => updateAdvanceLineField(idx, 'paid_to', e.target.value)}
                              />
                            </td>

                            {/* GST Bill (Yes/No Toggle + GSTIN) */}
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <select
                                  value={row.has_gst_bill ? 'Yes' : 'No'}
                                  onChange={e => {
                                    const isYes = e.target.value === 'Yes';
                                    updateAdvanceLineField(idx, 'has_gst_bill', isYes);
                                    if (!isYes) updateAdvanceLineField(idx, 'gst_number', '');
                                  }}
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: row.has_gst_bill ? '#dcfce7' : 'var(--bg3)',
                                    color: row.has_gst_bill ? '#15803d' : 'var(--text2)',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="No">No GST Bill</option>
                                  <option value="Yes">Yes (GST Bill)</option>
                                </select>

                                {row.has_gst_bill && (
                                  <input
                                    type="text"
                                    placeholder="GSTIN Number"
                                    value={row.gst_number || ''}
                                    onChange={e => updateAdvanceLineField(idx, 'gst_number', e.target.value)}
                                    style={{
                                      padding: '4px 6px',
                                      borderRadius: 4,
                                      border: '1px solid var(--border)',
                                      background: 'var(--bg)',
                                      fontFamily: 'monospace',
                                      textTransform: 'uppercase',
                                      fontSize: 10.5,
                                    }}
                                  />
                                )}
                              </div>
                            </td>

                            {/* Amt (Rs. Ps) */}
                            <td style={{ padding: '8px' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                style={{ ...inputStyle, padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}
                                value={row.amount}
                                onChange={e => updateAdvanceLineField(idx, 'amount', e.target.value)}
                              />
                            </td>

                            {/* Bills Attached (Attach / View / Download) */}
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {row.bill_attachments && row.bill_attachments.map((file, fIdx) => (
                                  <div
                                    key={fIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: 'var(--bg3)',
                                      borderRadius: 4,
                                      padding: '3px 6px',
                                      fontSize: 11,
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 10.5 }}>
                                      Bill #{fIdx + 1}
                                    </span>
                                    {/* View */}
                                    <a
                                      href={`/api/uploads/expenses/${file}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="View Bill"
                                      style={{ color: 'var(--accent)', padding: 2, display: 'flex', alignItems: 'center' }}
                                    >
                                      <Eye size={12} />
                                    </a>
                                    {/* Download */}
                                    <a
                                      href={`/api/uploads/expenses/${file}`}
                                      download={`Bill_${file}`}
                                      title="Download Bill"
                                      style={{ color: 'var(--text2)', padding: 2, display: 'flex', alignItems: 'center' }}
                                    >
                                      <Download size={12} />
                                    </a>
                                    {/* Remove */}
                                    <button
                                      type="button"
                                      onClick={() => removeLineAttachment(idx, fIdx)}
                                      title="Remove"
                                      style={{ background: 'none', border: 'none', color: '#ef4444', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => triggerLineUpload(idx)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    border: '1px dashed var(--accent)',
                                    background: 'transparent',
                                    color: 'var(--accent)',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  <Paperclip size={11} />
                                  {uploadingRowIdx === idx ? 'Uploading...' : 'Attach Bill'}
                                </button>
                              </div>
                            </td>

                            {/* Delete Line */}
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => deleteAdvanceLine(idx)}
                                title="Remove Line"
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                              >
                                <X size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  onClick={closeAdvanceModal}
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
                  onClick={() => handleAdvanceSubmit(false)}
                  disabled={advanceSaving}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text2)',
                    cursor: advanceSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                    opacity: advanceSaving ? 0.7 : 1,
                  }}
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleAdvanceSubmit(true)}
                  disabled={advanceSaving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    cursor: advanceSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: advanceSaving ? 0.7 : 1,
                  }}
                >
                  {advanceSaving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LEDGER TRANSACTION HISTORY HISTORY MODAL ───────────────────────── */}
        {showLedgerModal && (
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
                width: 600,
                maxWidth: '100%',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 17, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={18} style={{ color: 'var(--accent)' }} /> Advance Ledger History
                </h3>
                <button
                  onClick={() => setShowLedgerModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {ledger.transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                  No ledger transactions recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ledger.transactions.map(t => {
                    const isCredit = t.transaction_type === 'credit';
                    const isDebit = t.transaction_type === 'debit';
                    const isReturn = t.transaction_type === 'return';

                    return (
                      <div
                        key={t.id}
                        style={{
                          background: 'var(--bg2)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Transaction Type Indicator */}
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: isCredit ? '#22c55e15' : isDebit ? '#ef444415' : '#f59e0b15',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isCredit ? '#22c55e' : isDebit ? '#ef4444' : '#f59e0b',
                            }}
                          >
                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                              {t.description || (isCredit ? 'Cash Advance Credited' : isDebit ? 'Expense Settlement' : 'Excess Advance Returned')}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                              {t.created_at.split(' ')[0]} · Ref: {t.advance_ref || '—'}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: isCredit ? '#22c55e' : isDebit ? '#ef4444' : '#f59e0b',
                            }}
                          >
                            {isCredit ? '+' : '-'}{INR(t.amount)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                            Balance: {INR(t.running_balance)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', marginTop: 24, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowLedgerModal(false)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
