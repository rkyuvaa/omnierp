import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import {
  BarChart2, Download, Printer, AlertCircle, TrendingUp,
  TrendingDown, Building2, Loader2, RefreshCw
} from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getCurrentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

function MiniBar({ pct, over }) {
  const clamped = Math.min(pct || 0, 100);
  return (
    <div style={{ background: over ? 'rgba(239,68,68,0.12)' : 'rgba(25,84,2,0.08)', borderRadius: 99, height: 6, width: 100, display: 'inline-block', verticalAlign: 'middle' }}>
      <div style={{
        height: '100%', width: `${clamped}%`,
        background: over ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'var(--accent)',
        borderRadius: 99, transition: 'width .5s',
      }} />
    </div>
  );
}

export default function FinancePivotReport() {
  const now = new Date();
  const [fy, setFy] = useState(getCurrentFY());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bankId, setBankId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/finance/accounts').then(r => setAccounts(r.data || [])).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ fy, month });
      if (bankId) params.set('bank_id', bankId);
      const res = await api.get(`/api/finance/pivot?${params}`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load pivot report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // initial load

  const handleExportExcel = () => {
    const params = new URLSearchParams({ fy, month });
    if (bankId) params.set('bank_id', bankId);
    window.open(`/api/finance/export/pivot.xlsx?${params}`, '_blank');
  };

  const s = {
    toolbar: {
      display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
      padding: '18px 28px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
    },
    field: { display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' },
    input: {
      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none',
    },
    select: {
      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
      background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
    },
    btn: (variant = 'primary') => ({
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '8px 16px', borderRadius: 8, border: variant === 'outline' ? '1px solid var(--border)' : 'none',
      background: variant === 'primary' ? 'var(--accent)' : variant === 'outline' ? 'var(--bg3)' : '#2563eb',
      color: variant === 'primary' || variant === 'pdf' ? '#fff' : 'var(--text)',
      fontWeight: 600, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-end',
    }),
    body: { padding: '24px 28px' },
    tableWrap: {
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)',
    },
    th: {
      padding: '12px 16px', textAlign: 'left', fontWeight: 700,
      color: 'var(--text2)', background: 'var(--bg3)',
      borderBottom: '2px solid var(--border)', fontSize: 12,
      textTransform: 'uppercase', letterSpacing: '.05em',
    },
    thR: {
      padding: '12px 16px', textAlign: 'right', fontWeight: 700,
      color: 'var(--text2)', background: 'var(--bg3)',
      borderBottom: '2px solid var(--border)', fontSize: 12,
      textTransform: 'uppercase', letterSpacing: '.05em',
    },
    td: (over) => ({
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      color: 'var(--text)', background: over ? 'rgba(239,68,68,0.04)' : 'transparent',
      verticalAlign: 'middle',
    }),
    tdR: (over) => ({
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      color: 'var(--text)', background: over ? 'rgba(239,68,68,0.04)' : 'transparent',
      verticalAlign: 'middle', textAlign: 'right',
    }),
    totalRow: {
      fontWeight: 800, background: 'var(--bg3)', color: 'var(--text)',
    },
  };

  const overallPct = data && data.total_planned > 0
    ? Math.round((data.total_actual / data.total_planned) * 100)
    : 0;

  return (
    <Layout title="Expense Pivot Report">
      <div style={s.toolbar}>
        <div style={s.field}>
          <span style={s.label}>Financial Year</span>
          <input style={{ ...s.input, width: 90 }} value={fy} onChange={e => setFy(e.target.value)} placeholder="2025-26" />
        </div>
        <div style={s.field}>
          <span style={s.label}>Month</span>
          <select style={{ ...s.select, minWidth: 130 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            <option value={0}>All Months</option>
            {MONTHS.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <span style={s.label}>Bank</span>
          <select style={{ ...s.select, minWidth: 160 }} value={bankId} onChange={e => setBankId(e.target.value)}>
            <option value="">All Banks</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
          </select>
        </div>
        <button style={s.btn()} onClick={fetchData}>
          <RefreshCw size={13} /> Apply
        </button>
        <div style={{ flex: 1 }} />
        <button style={s.btn('outline')} onClick={handleExportExcel} className="no-print">
          <Download size={13} /> Export Excel
        </button>
        <button style={s.btn('outline')} onClick={() => window.print()} className="no-print">
          <Printer size={13} /> Print
        </button>
      </div>

      <div style={s.body}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, justifyContent: 'center', color: 'var(--text3)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading pivot report...
          </div>
        )}

        {error && !loading && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 18px', color: '#ef4444', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Report heading */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart2 size={22} color="var(--accent)" />
                {data.month_name ? `${data.month_name} — Expense Report` : `FY ${data.financial_year} — Expense Report`}
              </h2>
              <p style={{ color: 'var(--text3)', fontSize: 13 }}>
                Financial Year: <strong>{data.financial_year}</strong>
                {data.month && data.month > 0 && <> &mdash; Month: <strong>{MONTHS[data.month]}</strong></>}
                {bankId && accounts.find(a => String(a.id) === String(bankId)) && (
                  <> &mdash; Bank: <strong>{accounts.find(a => String(a.id) === String(bankId))?.bank_name}</strong></>
                )}
              </p>
            </div>

            {/* Summary metrics */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Budget', value: fmt(data.total_planned), color: 'var(--text)' },
                { label: 'Total Actual', value: fmt(data.total_actual), color: 'var(--accent)' },
                { label: 'Total Variance', value: fmt(data.total_variance), color: data.total_variance >= 0 ? 'var(--accent)' : '#ef4444' },
                { label: '% Utilized', value: `${overallPct}%`, color: overallPct > 100 ? '#ef4444' : overallPct > 80 ? '#f59e0b' : 'var(--accent)' },
              ].map(m => (
                <div key={m.label} style={{ flex: 1, minWidth: 140, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* No data */}
            {(!data.rows || data.rows.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <BarChart2 size={40} style={{ marginBottom: 12, opacity: .3 }} />
                <p style={{ fontWeight: 600, fontSize: 15 }}>No budget data available for the selected period.</p>
                <p style={{ fontSize: 13 }}>Configure budgets to see the pivot report.</p>
              </div>
            ) : (
              <div style={s.tableWrap}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={s.th}>Account Head</th>
                      <th style={s.th}>Category</th>
                      <th style={s.thR}>Budget (₹)</th>
                      <th style={s.thR}>Actual (₹)</th>
                      <th style={s.thR}>Variance (₹)</th>
                      <th style={{ ...s.thR, minWidth: 130 }}>% Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => {
                      const over = row.over_budget;
                      const pct = row.planned > 0 ? Math.round((row.actual / row.planned) * 100) : 0;
                      return (
                        <tr key={i}>
                          <td style={s.td(over)}>
                            <div style={{ fontWeight: 600 }}>{row.head_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.head_code}</div>
                          </td>
                          <td style={s.td(over)}>
                            <span style={{
                              display: 'inline-flex', padding: '2px 8px', borderRadius: 20,
                              background: 'var(--bg3)', fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                            }}>{row.category || '—'}</span>
                          </td>
                          <td style={s.tdR(over)}>{fmt(row.planned)}</td>
                          <td style={{ ...s.tdR(over), color: 'var(--text)', fontWeight: 600 }}>{fmt(row.actual)}</td>
                          <td style={{ ...s.tdR(over), fontWeight: 700, color: over ? '#ef4444' : 'var(--accent)' }}>
                            {over ? <TrendingUp size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> : <TrendingDown size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                            {over ? '-' : ''}{fmt(Math.abs(row.variance))}
                          </td>
                          <td style={s.tdR(over)}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                              <MiniBar pct={pct} over={over} />
                              <span style={{ fontWeight: 700, color: over ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'var(--accent)', minWidth: 38, textAlign: 'right' }}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr style={s.totalRow}>
                      <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text)' }} colSpan={2}>TOTAL</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800 }}>{fmt(data.total_planned)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800 }}>{fmt(data.total_actual)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: data.total_variance >= 0 ? 'var(--accent)' : '#ef4444' }}>
                        {data.total_variance < 0 ? '-' : ''}{fmt(Math.abs(data.total_variance))}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <MiniBar pct={overallPct} over={overallPct > 100} />
                          <span style={{ color: overallPct > 100 ? '#ef4444' : overallPct > 80 ? '#f59e0b' : 'var(--accent)', minWidth: 38, textAlign: 'right' }}>
                            {overallPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </Layout>
  );
}
