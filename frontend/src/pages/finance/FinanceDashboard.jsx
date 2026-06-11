import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import {
  Landmark, TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  CreditCard, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle,
  XCircle, ShieldCheck, Edit3, Loader2, Building2, Calendar
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

function maskAccount(num) {
  if (!num) return '—';
  const s = String(num);
  const last4 = s.slice(-4);
  return `····${last4}`;
}

function relativeTime(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 1) return 'Just now';
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 18, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--bg3) 25%, var(--border) 50%, var(--bg3) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0
    }} />
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, bg, loading }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '20px 22px', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'transform 0.18s, box-shadow 0.18s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text3)', marginBottom: 8 }}>
          {label}
        </div>
        {loading ? (
          <Skeleton h={30} w={120} r={6} />
        ) : (
          <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.5px' }}>
            {value}
          </div>
        )}
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
  );
}

// ─── Status Counts Bar ───────────────────────────────────────────────────────

function StatusCountsRow({ counts, loading }) {
  const items = [
    { key: 'entered', label: 'Entered', color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: Edit3 },
    { key: 'verified', label: 'Verified', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', icon: ShieldCheck },
    { key: 'approved', label: 'Approved', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', icon: CheckCircle },
    { key: 'rejected', label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.1)', icon: XCircle },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28
    }}>
      {items.map(({ key, label, color, bg, icon: Icon }) => (
        <div key={key} style={{
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>{label}</div>
            {loading ? <Skeleton h={20} w={40} /> : (
              <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{counts[key] ?? 0}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Bank Card ───────────────────────────────────────────────────────────────

function BankCard({ bank, loading }) {
  if (loading) {
    return (
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 22, display: 'flex', flexDirection: 'column', gap: 12
      }}>
        <Skeleton h={18} w='60%' />
        <Skeleton h={14} w='40%' />
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <Skeleton h={28} w='80%' />
        <Skeleton h={14} w='50%' />
        <Skeleton h={14} w='55%' />
      </div>
    );
  }

  const balance = bank.last_statement_balance ?? bank.current_balance ?? 0;
  const lien = bank.lien_amount ?? 0;
  const actual = balance - lien;
  const isNegActual = actual < 0;

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
      padding: 22, display: 'flex', flexDirection: 'column', gap: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'transform 0.18s, box-shadow 0.18s',
      position: 'relative', overflow: 'hidden'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
    >
      {/* Green accent bar top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
        borderRadius: '14px 14px 0 0'
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, marginTop: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Building2 size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{bank.account_name}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                {maskAccount(bank.account_number)}
              </div>
            </div>
          </div>
        </div>
        {/* Week paid chip */}
        {bank.week_paid > 0 && (
          <div style={{
            background: 'rgba(59,130,246,0.1)', color: '#2563eb',
            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            border: '1px solid rgba(59,130,246,0.2)', whiteSpace: 'nowrap'
          }}>
            Week: {INR(bank.week_paid)}
          </div>
        )}
      </div>

      {/* Main balance */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 4 }}>
          Bank Balance
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px', lineHeight: 1 }}>
          {INR(balance)}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

      {/* Lien + Actual */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: '10px 12px', background: 'rgba(246,173,85,0.08)', borderRadius: 8, border: '1px solid rgba(246,173,85,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Lien</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#b45309' }}>{INR(lien)}</div>
        </div>
        <div style={{ padding: '10px 12px', background: isNegActual ? 'rgba(220,38,38,0.08)' : 'rgba(99,102,241,0.08)', borderRadius: 8, border: `1px solid ${isNegActual ? 'rgba(220,38,38,0.2)' : 'rgba(99,102,241,0.2)'}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: isNegActual ? '#991b1b' : '#4338ca', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Actual</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: isNegActual ? '#dc2626' : '#4f46e5' }}>{INR(actual)}</div>
        </div>
      </div>

      {/* Yesterday debits / credits */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 7 }}>
          <ArrowDownCircle size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Yest. Debits</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: bank.yesterday_debits > 0 ? '#dc2626' : 'var(--text3)' }}>
              {INR(bank.yesterday_debits ?? 0)}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 7 }}>
          <ArrowUpCircle size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Yest. Credits</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: bank.yesterday_credits > 0 ? '#16a34a' : 'var(--text3)' }}>
              {INR(bank.yesterday_credits ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Last updated */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text3)' }}>
        <Clock size={10} />
        Updated {relativeTime(bank.last_import_at)}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const [dashData, setDashData] = useState(null);
  const [txCounts, setTxCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const [dash, txList] = await Promise.all([
        api.get('/finance/dashboard'),
        api.get('/finance/transactions').catch(() => ({ data: [] })),
      ]);
      setDashData(dash.data);

      // Count by status
      const list = Array.isArray(txList.data) ? txList.data : (txList.data?.results ?? txList.data?.items ?? []);
      const counts = { entered: 0, verified: 0, approved: 0, rejected: 0 };
      list.forEach(tx => {
        const s = (tx.status || '').toLowerCase();
        if (counts[s] !== undefined) counts[s]++;
      });
      setTxCounts(counts);
    } catch (e) {
      console.error('Finance dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = dashData || {};
  const banks = d.bank_cards || [];

  return (
    <Layout title="Finance Dashboard">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fin-refresh-btn:hover { background: var(--accent) !important; color: white !important; }
      `}</style>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.4px' }}>
            Banking Overview
          </h1>
          {d.today && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
              <Calendar size={12} />
              Week {d.week_start} — {d.week_end} &nbsp;·&nbsp; Today: {d.today}
            </div>
          )}
        </div>
        <button
          className="fin-refresh-btn"
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg2)', color: 'var(--text2)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.18s'
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard
          label="Total Bank Balance"
          value={INR(d.total_balance)}
          icon={Landmark}
          color="var(--accent)"
          bg="var(--accent-dim)"
          loading={loading}
        />
        <KpiCard
          label="Total Lien"
          value={INR(d.total_lien)}
          icon={AlertTriangle}
          color="#b45309"
          bg="rgba(246,173,85,0.12)"
          loading={loading}
        />
        <KpiCard
          label="Total Actual Available"
          value={INR(d.total_actual)}
          icon={TrendingUp}
          color="#4f46e5"
          bg="rgba(99,102,241,0.1)"
          loading={loading}
        />
        <KpiCard
          label="Payments This Week"
          value={INR(d.payments_this_week)}
          icon={CreditCard}
          color="#0369a1"
          bg="rgba(3,105,161,0.1)"
          loading={loading}
        />
      </div>

      {/* Transaction Status Counts */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text3)', marginBottom: 10 }}>
        Transaction Status
      </div>
      <StatusCountsRow counts={txCounts} loading={loading} />

      {/* Bank Cards */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text3)' }}>
          Bank Accounts ({loading ? '—' : banks.length})
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => <BankCard key={i} loading={true} />)}
        </div>
      ) : banks.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14
        }}>
          <Building2 size={40} style={{ color: 'var(--border2)', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>No bank accounts configured</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Go to Finance Config to add bank accounts</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {banks.map(bank => <BankCard key={bank.id} bank={bank} loading={false} />)}
        </div>
      )}
    </Layout>
  );
}
