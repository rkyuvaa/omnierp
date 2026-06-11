import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import {
  Calendar, TrendingUp, TrendingDown, AlertCircle,
  Building2, ChevronRight, Settings, Loader2, RefreshCw
} from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getCurrentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

function statusColor(status) {
  switch (status) {
    case 'Over budget': return { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', badge: '#ef4444', badgeBg: 'rgba(239,68,68,0.1)', bar: '#ef4444' };
    case 'Under budget': return { bg: 'rgba(25,84,2,0.06)', border: 'var(--accent)', badge: 'var(--accent)', badgeBg: 'rgba(25,84,2,0.1)', bar: 'var(--accent)' };
    case 'In progress': return { bg: 'rgba(59,130,246,0.05)', border: '#3b82f6', badge: '#3b82f6', badgeBg: 'rgba(59,130,246,0.1)', bar: '#3b82f6' };
    default: return { bg: 'var(--bg2)', border: 'var(--border)', badge: 'var(--text3)', badgeBg: 'var(--bg3)', bar: 'var(--border)' };
  }
}

function isCurrentWeek(start, end) {
  const now = new Date();
  const s = new Date(start);
  const e = new Date(end);
  return now >= s && now <= e;
}

function ProgressBar({ pct, color, height = 8 }) {
  const clamped = Math.min(pct || 0, 100);
  const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'var(--accent)';
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 99, height, overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%', width: `${clamped}%`,
        background: color || barColor,
        borderRadius: 99, transition: 'width .6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  );
}

export default function FinanceWeeklyBuckets() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [fy, setFy] = useState(getCurrentFY());
  const [bankId, setBankId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/finance/accounts').then(r => setAccounts(r.data || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ year, month, fy });
      if (bankId) params.set('bank_id', bankId);
      const res = await api.get(`/api/finance/weekly-buckets?${params}`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load weekly buckets.');
    } finally {
      setLoading(false);
    }
  }, [year, month, bankId, fy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const noBudget = data && !data.total_monthly_budget;

  const s = {
    toolbar: {
      display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      padding: '20px 28px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
    },
    field: { display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' },
    input: {
      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none',
      minWidth: 80,
    },
    select: {
      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none',
      minWidth: 120, cursor: 'pointer',
    },
    body: { padding: '24px 28px' },
    summaryCard: {
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '24px 28px', marginBottom: 28,
      boxShadow: 'var(--shadow)',
    },
    monthHeading: { fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 18 },
    metricRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
    metric: (color) => ({
      flex: 1, minWidth: 130, background: 'var(--bg3)', borderRadius: 10, padding: '14px 18px',
      border: `1px solid ${color ? 'rgba(25,84,2,0.15)' : 'var(--border)'}`,
    }),
    metricLabel: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 },
    metricVal: (color) => ({ fontSize: 22, fontWeight: 800, color: color || 'var(--text)', margin: 0 }),
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16,
    },
    weekCard: (colors, isCurrent) => ({
      background: colors.bg,
      border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? colors.border : 'var(--border)'}`,
      borderRadius: 14, padding: '20px', cursor: 'default',
      boxShadow: isCurrent ? `0 0 0 2px ${colors.border}22` : 'none',
      position: 'relative', transition: 'transform .15s',
    }),
  };

  return (
    <Layout title="Weekly Payment Buckets">
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.field}>
          <span style={s.label}>Year</span>
          <input
            type="number"
            style={{ ...s.input, width: 80 }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            min={2000} max={2100}
          />
        </div>
        <div style={s.field}>
          <span style={s.label}>Month</span>
          <select style={s.select} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <span style={s.label}>Financial Year</span>
          <input
            type="text"
            style={{ ...s.input, width: 90 }}
            value={fy}
            onChange={e => setFy(e.target.value)}
            placeholder="2025-26"
          />
        </div>
        <div style={s.field}>
          <span style={s.label}>Bank</span>
          <select style={{ ...s.select, minWidth: 160 }} value={bankId} onChange={e => setBankId(e.target.value)}>
            <option value="">All Banks</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
          </select>
        </div>
        <button
          onClick={fetchData}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={s.body}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px', justifyContent: 'center', color: 'var(--text3)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Loading weekly buckets...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', color: '#ef4444', display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* No budget banner */}
            {noBudget && (
              <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, color: '#3b82f6', fontSize: 13 }}>
                <AlertCircle size={16} />
                <span>No budget configured for this month. <a href="/finance/config" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'underline' }}>Go to Config →</a></span>
              </div>
            )}

            {/* Month Summary */}
            <div style={s.summaryCard}>
              <h3 style={s.monthHeading}>
                <Calendar size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent)' }} />
                {data.month_name}
              </h3>
              <div style={s.metricRow}>
                <div style={s.metric()}>
                  <div style={s.metricLabel}>Total Monthly Budget</div>
                  <div style={s.metricVal()}>{fmt(data.total_monthly_budget)}</div>
                </div>
                <div style={s.metric('green')}>
                  <div style={s.metricLabel}>Total Actual</div>
                  <div style={s.metricVal('var(--accent)')}>{fmt(data.total_actual)}</div>
                </div>
                <div style={s.metric()}>
                  <div style={s.metricLabel}>Remaining</div>
                  <div style={s.metricVal(data.remaining < 0 ? '#ef4444' : 'var(--text)')}>
                    {fmt(data.remaining)}
                  </div>
                </div>
                <div style={s.metric()}>
                  <div style={s.metricLabel}>Weekly Budget</div>
                  <div style={s.metricVal()}>{fmt(data.weekly_budget)}</div>
                </div>
              </div>
              {/* Overall progress bar */}
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                  <span>Month Progress</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {data.total_monthly_budget ? Math.min(100, Math.round((data.total_actual / data.total_monthly_budget) * 100)) : 0}%
                  </span>
                </div>
                <ProgressBar
                  pct={data.total_monthly_budget ? (data.total_actual / data.total_monthly_budget) * 100 : 0}
                  height={10}
                />
              </div>
            </div>

            {/* Week Cards */}
            <div style={s.grid}>
              {(data.week_cards || []).map((wk) => {
                const colors = statusColor(wk.status);
                const isCurrent = isCurrentWeek(wk.start, wk.end);
                const pct = wk.pct || (wk.planned > 0 ? Math.round((wk.actual / wk.planned) * 100) : 0);
                return (
                  <div key={wk.week_number} style={s.weekCard(colors, isCurrent)}>
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', top: 12, right: 14,
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        textTransform: 'uppercase', letterSpacing: '.06em',
                      }}>
                        Current
                      </div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                      {wk.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
                      {wk.start} — {wk.end}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Planned</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt(wk.planned)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Actual</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: colors.badge }}>{fmt(wk.actual)}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <ProgressBar pct={pct} height={7} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: colors.badgeBg, color: colors.badge,
                      }}>
                        {wk.status === 'Over budget' && <TrendingUp size={11} />}
                        {wk.status === 'Under budget' && <TrendingDown size={11} />}
                        {wk.status}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.badge }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {(!data.week_cards || data.week_cards.length === 0) && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text3)' }}>
                <Calendar size={40} style={{ marginBottom: 12, opacity: .4 }} />
                <p>No weekly data found for the selected period.</p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
