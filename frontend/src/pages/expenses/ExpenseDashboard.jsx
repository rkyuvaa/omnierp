import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { Receipt, Clock, CheckCircle, Wallet, TrendingUp, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const INR = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

const STATUS_COLORS = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  cancelled: '#6b7280',
  reimbursed: '#6366f1',
};

function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'transform 0.18s, box-shadow 0.18s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} style={{ color }} />
      </div>
    </div>
  );
}

export default function ExpenseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({});
  const [recentClaims, setRecentClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/expenses/summary'),
      api.get('/expenses/', { params: {} }),
      api.get('/expenses/advances/ledger').catch(() => ({ data: { balance: 0 } })),
    ])
      .then(([s, c, l]) => {
        setSummary({ ...s.data, ledger_balance: l.data?.balance ?? 0 });
        setRecentClaims(c.data.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="Expenses & Reimbursement">
      <div style={{ padding: 0 }}>
        {/* Header Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => navigate('/expenses/my')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            My Claims
          </button>
          {user?.is_superadmin && (
            <button
              onClick={() => navigate('/expenses/approvals')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Approvals
            </button>
          )}
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 12 }}>
          <KpiCard
            label="Pending Claims"
            value={loading ? '—' : summary.pending_count ?? 0}
            icon={Clock}
            color="#f59e0b"
            bg="#f59e0b20"
            sub="Awaiting approval"
          />
          <KpiCard
            label="Approved Amount"
            value={loading ? '—' : INR(summary.approved_amount)}
            icon={CheckCircle}
            color="#22c55e"
            bg="#22c55e20"
            sub="Total approved"
          />
          <KpiCard
            label="Reimbursed"
            value={loading ? '—' : INR(summary.reimbursed_amount)}
            icon={Wallet}
            color="#6366f1"
            bg="#6366f120"
            sub="Paid out"
          />
          <KpiCard
            label="Advance Balance"
            value={loading ? '—' : INR(summary.ledger_balance)}
            icon={Wallet}
            color="#10b981"
            bg="#10b98120"
            sub="Active cash advance"
          />
          <KpiCard
            label="This Month"
            value={loading ? '—' : INR(summary.total_this_month)}
            icon={TrendingUp}
            color="var(--accent)"
            bg="var(--accent)20"
            sub="Claims submitted"
          />
        </div>

        {/* Pending Approval alert */}
        {summary.pending_my_approval > 0 && (
          <div
            onClick={() => navigate('/expenses/approvals')}
            style={{
              background: '#f59e0b15',
              border: '1px solid #f59e0b40',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f59e0b25')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f59e0b15')}
          >
            <AlertCircle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
              {summary.pending_my_approval} claim{summary.pending_my_approval > 1 ? 's' : ''} pending your approval
            </span>
            <ChevronRight size={16} style={{ color: 'var(--text3)', marginLeft: 'auto' }} />
          </div>
        )}

        {/* Recent Claims Table */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Recent Claims</h3>
            <button
              onClick={() => navigate('/expenses/my')}
              style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              View All →
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
          ) : recentClaims.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              No claims yet.{' '}
              <button
                onClick={() => navigate('/expenses/my')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
              >
                Submit your first claim →
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)' }}>
                    {['Reference', 'Employee', 'Category', 'Date', 'Amount', 'Status'].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
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
                  {recentClaims.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg3)10',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg3)10')}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{c.reference}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text)' }}>{c.employee_name || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{c.category_name || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{c.expense_date}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{INR(c.amount)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: `${STATUS_COLORS[c.status] || '#888'}20`,
                            color: STATUS_COLORS[c.status] || '#888',
                            textTransform: 'uppercase',
                          }}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
