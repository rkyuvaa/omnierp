import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  BookOpen,
  Wallet,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  User,
  DollarSign,
  Send,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const INR = v =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v ?? 0);

export default function ExpenseLedger() {
  const { user } = useAuth();
  const isAdmin = user?.is_superadmin || user?.role === 'admin' || user?.role === 'hr_admin' || user?.role === 'accountant';

  const [ledgerData, setLedgerData] = useState({
    opening_balance: 0,
    unsettled_amount: 0,
    reimbursement_pending: 0,
    balance: 0,
    net_balance: 0,
    transactions: [],
  });
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [allSummary, setAllSummary] = useState([]);
  const [activeView, setActiveView] = useState('statement'); // 'statement' | 'summary'
  const [loading, setLoading] = useState(true);

  // Accountant Payout Modal
  const [approvedAdvances, setApprovedAdvances] = useState([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAdv, setPayoutAdv] = useState(null);
  const [payoutRemarks, setPayoutRemarks] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
      fetchApprovedAdvances();
      if (activeView === 'summary') {
        fetchAllSummary();
      }
    }
    fetchLedger(selectedEmpId);
  }, [selectedEmpId, activeView]);

  async function fetchEmployees() {
    try {
      const r = await api.get('/hr/employees');
      setEmployees(r.data.filter(e => e.is_active));
    } catch {
      // Fail silently
    }
  }

  async function fetchApprovedAdvances() {
    try {
      const r = await api.get('/expenses/advances/reports?status=approved');
      setApprovedAdvances(r.data);
    } catch {
      // Fail silently
    }
  }

  async function fetchAllSummary() {
    try {
      const r = await api.get('/expenses/ledger/summary');
      setAllSummary(r.data);
    } catch {
      toast.error('Failed to load employee ledger summaries');
    }
  }

  async function fetchLedger(empId = '') {
    setLoading(true);
    try {
      const url = empId ? `/expenses/advances/ledger?employee_id=${empId}` : '/expenses/advances/ledger';
      const r = await api.get(url);
      setLedgerData(r.data);
    } catch {
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayoutSubmit() {
    if (!payoutAdv) return;
    setPayoutSaving(true);
    try {
      await api.post(`/expenses/advances/${payoutAdv.id}/payout`, { remarks: payoutRemarks || 'Disbursed by Accounts' });
      toast.success(`Advance ${payoutAdv.reference} disbursed and credited to employee ledger!`);
      setShowPayoutModal(false);
      setPayoutAdv(null);
      setPayoutRemarks('');
      fetchApprovedAdvances();
      fetchLedger(selectedEmpId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payout failed');
    } finally {
      setPayoutSaving(false);
    }
  }

  return (
    <Layout title="Employee Expense & Advance Ledger">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Top Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: 20, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={22} style={{ color: 'var(--accent)' }} />
              Employee Expense & Advance Ledger
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
              Stage 3 Accountant Settlement & Live Running Balance Statement
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setActiveView('statement')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeView === 'statement' ? 'var(--bg)' : 'transparent',
                    color: activeView === 'statement' ? 'var(--text)' : 'var(--text3)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  My / Employee Statement
                </button>
                <button
                  onClick={() => setActiveView('summary')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeView === 'summary' ? 'var(--bg)' : 'transparent',
                    color: activeView === 'summary' ? 'var(--text)' : 'var(--text3)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  All Employees Summary
                </button>
              </div>
            )}

            {isAdmin && activeView === 'statement' && (
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="">My Ledger Statement</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employee_code})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => fetchLedger(selectedEmpId)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text2)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* ── KPI METRIC CARDS ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Card 1: Opening Balance */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Opening Balance <Wallet size={16} style={{ color: '#6366f1' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
              {INR(ledgerData.opening_balance)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
              Initial balance baseline
            </div>
          </div>

          {/* Card 2: Unsettled Advance Amount */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Unsettled Amount <TrendingUp size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
              {INR(ledgerData.unsettled_amount)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
              Active advances given (unsettled)
            </div>
          </div>

          {/* Card 3: Reimbursement Pending */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Reimbursement Pending <Clock size={16} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>
              {INR(ledgerData.reimbursement_pending)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
              Approved claims awaiting payout
            </div>
          </div>

          {/* Card 4: Net Balance */}
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid #10b98140',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Net Balance <DollarSign size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
              {INR(ledgerData.net_balance)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
              Running balance statement
            </div>
          </div>
        </div>

        {/* ── STAGE 3: ACCOUNTANT DISBURSEMENT ACTION BANNER (ADMIN/ACCOUNTANT VIEW) ── */}
        {isAdmin && approvedAdvances.length > 0 && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #22c55e60',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} />
                Stage 3 Accountant Action Required ({approvedAdvances.length} Manager-Approved Advances Pending Disburse)
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedAdvances.map(adv => (
                <div
                  key={adv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{adv.employee_name}</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>Ref: {adv.reference}</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>Purpose: {adv.purpose}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#15803d' }}>₹ {adv.amount?.toLocaleString('en-IN')}</span>
                    <button
                      onClick={() => {
                        setPayoutAdv(adv);
                        setPayoutRemarks('');
                        setShowPayoutModal(true);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#15803d',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Send size={13} /> Disburse & Credit Ledger
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MAIN LEDGER TABLE VIEW ────────────────────────────────────────── */}
        {activeView === 'statement' ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                Transaction History Statement {ledgerData.employee_name && `— ${ledgerData.employee_name}`}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                Showing {ledgerData.transactions?.length || 0} entries
              </span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                Loading statement...
              </div>
            ) : ledgerData.transactions?.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                No ledger transactions found for this employee.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, color: 'var(--text3)', letterSpacing: '0.4px' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Debit (Given)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Credit (Settled)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.transactions.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text2)', fontWeight: 600 }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: tx.transaction_type === 'credit' ? '#dcfce7' : '#fee2e2',
                              color: tx.transaction_type === 'credit' ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                          {tx.description}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'debit' ? '#ef4444' : 'var(--text3)' }}>
                          {tx.transaction_type === 'debit' ? INR(tx.amount) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: tx.transaction_type === 'credit' ? '#10b981' : 'var(--text3)' }}>
                          {tx.transaction_type === 'credit' ? INR(tx.amount) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--text)' }}>
                          {INR(tx.running_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ── ALL EMPLOYEES SUMMARY VIEW (ADMIN/FINANCE) ──────────────────── */
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                All Employees Ledger & Outstanding Balance Summary
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {allSummary.length} Employees Active
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, color: 'var(--text3)', letterSpacing: '0.4px' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left' }}>Code / Dept</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Opening Bal</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Unsettled Adv</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Pending Reimb</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Net Balance</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allSummary.map(emp => (
                    <tr key={emp.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                        {emp.employee_name}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 12 }}>
                        {emp.employee_code || '-'} {emp.department ? `(${emp.department})` : ''}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text2)' }}>
                        {INR(emp.opening_balance)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                        {INR(emp.unsettled_amount)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>
                        {INR(emp.reimbursement_pending)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: emp.net_balance > 0 ? '#10b981' : 'var(--text)' }}>
                        {INR(emp.net_balance)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedEmpId(emp.employee_id.toString());
                            setActiveView('statement');
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg3)',
                            color: 'var(--text2)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View Statement
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ACCOUNTANT PAYOUT MODAL ────────────────────────────────────────── */}
        {showPayoutModal && payoutAdv && (
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
                width: 480,
                maxWidth: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
                Stage 3: Disburse Cash Advance & Log to Ledger
              </h3>

              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ marginBottom: 4 }}><strong>Employee:</strong> {payoutAdv.employee_name}</div>
                <div style={{ marginBottom: 4 }}><strong>Reference #:</strong> {payoutAdv.reference}</div>
                <div style={{ marginBottom: 4 }}><strong>Approved Amount:</strong> <span style={{ color: '#10b981', fontWeight: 800 }}>₹ {payoutAdv.amount?.toLocaleString('en-IN')}</span></div>
                <div><strong>Purpose:</strong> {payoutAdv.purpose}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
                  Payout Payment / Voucher Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank transfer / Cash voucher ref #..."
                  value={payoutRemarks}
                  onChange={e => setPayoutRemarks(e.target.value)}
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

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowPayoutModal(false)}
                  style={{
                    padding: '9px 16px',
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
                  onClick={handlePayoutSubmit}
                  disabled={payoutSaving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#15803d',
                    color: '#fff',
                    cursor: payoutSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: payoutSaving ? 0.7 : 1,
                  }}
                >
                  {payoutSaving ? 'Disbursing...' : 'Confirm Disburse'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
