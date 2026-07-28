import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import {
  Printer, AlertTriangle, CheckCircle2, Building2,
  TrendingUp, TrendingDown, Clock, AlertCircle, Loader2,
  FileBarChart, Calendar, Banknote, Download
} from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SectionHeader({ letter, title, color = 'var(--accent)' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: 16, paddingBottom: 10,
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 4, height: 28, background: color, borderRadius: 99,
      }} />
      <div>
        <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.1em', display: 'block' }}>
          Section {letter}
        </span>
        <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
      </div>
    </div>
  );
}

function SectionCard({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 14, padding: '24px 28px',
      marginBottom: 20, pageBreakInside: 'avoid',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function MetricPill({ label, value, sub, valueColor }) {
  return (
    <div style={{
      flex: 1, minWidth: 130, background: '#f9fafb',
      border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const TABLE_TH = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
  color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb',
};
const TABLE_TD = {
  padding: '11px 14px', borderBottom: '1px solid #f3f4f6',
  color: '#111827', fontSize: 13, verticalAlign: 'middle',
};

export default function ManagementReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Inject print styles
    const style = document.createElement('style');
    style.id = 'mgmt-print-style';
    style.innerHTML = `
      @media print {
        .layout-sidebar,
        .layout-topbar,
        .layout-nav,
        .no-print { display: none !important; }
        body { background: white !important; margin: 0 !important; }
        .report-container { padding: 0 !important; }
        .print-page-break { page-break-before: always; }
        * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
      }
    `;
    if (!document.getElementById('mgmt-print-style')) {
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById('mgmt-print-style');
      if (el) el.remove();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/finance/report/management')
      .then(r => setData(r.data))
      .catch(err => setError(err?.response?.data?.message || 'Failed to load management report.'))
      .finally(() => setLoading(false));
  }, []);

  const s = {
    wrapper: { background: '#f3f4f6', minHeight: '100vh', padding: '24px' },
    container: {
      maxWidth: 900, margin: '0 auto',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    },
    reportHeader: {
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 14, padding: '28px 32px', marginBottom: 20,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    },
    printBtns: { display: 'flex', gap: 10, alignItems: 'center' },
    printBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
      background: '#fff', color: '#374151', fontWeight: 600,
      fontSize: 13, cursor: 'pointer',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  };

  if (loading) {
    return (
      <Layout title="Management Report">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: 'var(--text3)' }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 15 }}>Generating report...</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Management Report">
        <div style={{ padding: 32 }}>
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '16px 20px', color: '#ef4444', display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertCircle size={18} /> {error}
          </div>
        </div>
      </Layout>
    );
  }

  if (!data) return null;

  const sA = data.section_a || {};
  const sB = data.section_b || {};
  const sC = data.section_c || {};
  const sD = data.section_d || {};

  const balanceRemainingNeg = (sB.balance_remaining ?? 0) < 0;

  return (
    <Layout title="Management Report">
      <div style={s.wrapper} className="report-container">
        <div style={s.container}>

          {/* Report Header */}
          <div style={s.reportHeader}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <FileBarChart size={22} color="var(--accent)" />
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>Management Summary Report</h1>
              </div>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '6px 0 0' }}>
                <Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                Generated: {fmtDateTime(data.generated_at)}
                &nbsp;&nbsp;|&nbsp;&nbsp;FY {data.financial_year}
                &nbsp;&nbsp;|&nbsp;&nbsp;{data.month_name}
              </p>
            </div>
            <div style={s.printBtns} className="no-print">
              <button style={s.printBtn} onClick={() => window.print()}>
                <Printer size={13} /> Print
              </button>
              <button style={{ ...s.printBtn, background: '#111827', color: '#fff', border: 'none' }} onClick={() => window.print()}>
                <Download size={13} /> Export PDF
              </button>
            </div>
          </div>

          {/* SECTION A — Bank Position */}
          <SectionCard>
            <SectionHeader letter="A" title="Bank Position" color="var(--accent)" />
            <table style={s.table}>
              <thead>
                <tr>
                  {['Bank Name', 'Account No', 'Bank Balance', 'Lien', 'Actual Balance', 'Last Import'].map(h => (
                    <th key={h} style={TABLE_TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sA.bank_position || []).map((b, i) => (
                  <tr key={i}>
                    <td style={{ ...TABLE_TD, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Building2 size={14} color="#9ca3af" />
                        {b.bank_name}
                      </div>
                    </td>
                    <td style={{ ...TABLE_TD, fontFamily: 'monospace', letterSpacing: '.06em', fontSize: 12 }}>
                      {b.account_number}
                    </td>
                    <td style={TABLE_TD}>{fmt(b.balance)}</td>
                    <td style={{ ...TABLE_TD, color: '#d97706' }}>
                      {b.lien > 0 ? fmt(b.lien) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ ...TABLE_TD, fontWeight: 700, color: '#15803d', fontSize: 14 }}>
                      {fmt(b.actual)}
                    </td>
                    <td style={{ ...TABLE_TD, fontSize: 12, color: '#9ca3af' }}>
                      {b.last_import_at ? fmtDateTime(b.last_import_at) : '—'}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                  <td style={{ ...TABLE_TD, fontWeight: 800 }} colSpan={2}>TOTAL</td>
                  <td style={{ ...TABLE_TD, fontWeight: 800 }}>{fmt(sA.total_balance)}</td>
                  <td style={{ ...TABLE_TD, fontWeight: 800, color: '#d97706' }}>{fmt(sA.total_lien)}</td>
                  <td style={{ ...TABLE_TD, fontWeight: 800, color: '#15803d', fontSize: 15 }}>{fmt(sA.total_actual)}</td>
                  <td style={TABLE_TD} />
                </tr>
              </tbody>
            </table>
          </SectionCard>

          {/* SECTION B — Month Budget vs Actual */}
          <SectionCard>
            <SectionHeader letter="B" title={`Month Budget vs Actual — ${data.month_name}`} color="#7c3aed" />
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <MetricPill label="Total Budget" value={fmt(sB.total_budget)} />
              <MetricPill label="Total Spent" value={fmt(sB.total_spent)} valueColor="#15803d" />
              <MetricPill
                label="Balance Remaining"
                value={fmt(Math.abs(sB.balance_remaining))}
                sub={balanceRemainingNeg ? '⚠ Over budget' : undefined}
                valueColor={balanceRemainingNeg ? '#ef4444' : '#111827'}
              />
            </div>

            {balanceRemainingNeg && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontSize: 13, marginBottom: 16 }}>
                <AlertTriangle size={15} /> Budget exceeded for this month!
              </div>
            )}

            {(sB.over_budget_heads && sB.over_budget_heads.length > 0) && (
              <>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Over-Budget Heads</p>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Head Name', 'Budget', 'Actual', 'Over By'].map(h => (
                        <th key={h} style={TABLE_TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sB.over_budget_heads.map((h, i) => (
                      <tr key={i}>
                        <td style={{ ...TABLE_TD, fontWeight: 600 }}>{h.head_name}</td>
                        <td style={TABLE_TD}>{fmt(h.budget)}</td>
                        <td style={{ ...TABLE_TD, color: '#ef4444', fontWeight: 600 }}>{fmt(h.actual)}</td>
                        <td style={{ ...TABLE_TD, color: '#ef4444', fontWeight: 700 }}>+{fmt(h.over_by || h.actual - h.budget)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {(!sB.over_budget_heads || sB.over_budget_heads.length === 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: 13 }}>
                <CheckCircle2 size={15} /> All heads are within budget.
              </div>
            )}
          </SectionCard>

          {/* SECTION C — This Week */}
          <SectionCard>
            <SectionHeader letter="C" title={`This Week — ${sC.week_range || data.week_range}`} color="#0891b2" />
            <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
              <MetricPill label="Planned" value={fmt(sC.planned)} />
              <MetricPill label="Paid So Far" value={fmt(sC.paid_so_far)} valueColor="#15803d" />
              <MetricPill
                label="Pending Amount"
                value={fmt(sC.pending_amount)}
                valueColor={sC.pending_amount > 0 ? '#d97706' : '#111827'}
              />
              <div style={{ flex: 1, minWidth: 130, background: sC.pending_count > 0 ? '#fffbeb' : '#f9fafb', border: `1px solid ${sC.pending_count > 0 ? '#fcd34d' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                  Pending Transactions
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: sC.pending_count > 0 ? '#d97706' : '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sC.pending_count}
                  {sC.pending_count > 0 && <AlertTriangle size={16} color="#d97706" />}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION D — Pending Approvals Alert */}
          <SectionCard>
            <SectionHeader letter="D" title="Pending Approvals" color="#d97706" />

            {(!sD.pending_alerts || sD.pending_alerts.length === 0) ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '14px 18px', color: '#15803d', fontWeight: 600, fontSize: 14,
              }}>
                <CheckCircle2 size={18} color="#16a34a" />
                All caught up! No pending approvals.
              </div>
            ) : (
              <>
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', fontSize: 13, marginBottom: 16 }}>
                  <AlertTriangle size={15} />
                  <strong>{sD.total_alerts ?? sD.pending_alerts.length}</strong> transaction{sD.pending_alerts.length > 1 ? 's' : ''} require attention.
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Date', 'Description', 'Amount', 'Bank', 'Status'].map(h => (
                        <th key={h} style={TABLE_TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sD.pending_alerts.map((al, i) => {
                      const daysOld = al.created_at
                        ? Math.floor((Date.now() - new Date(al.created_at)) / 86400000)
                        : 0;
                      return (
                        <tr key={i} style={{ background: daysOld > 2 ? '#fffbeb' : 'transparent' }}>
                          <td style={TABLE_TD}>{al.date || al.transaction_date || '—'}</td>
                          <td style={{ ...TABLE_TD, maxWidth: 220, fontWeight: 500 }}>{al.description}</td>
                          <td style={{ ...TABLE_TD, fontWeight: 700, color: '#374151' }}>{fmt(al.amount)}</td>
                          <td style={TABLE_TD}>{al.bank || al.bank_name || '—'}</td>
                          <td style={TABLE_TD}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                              background: daysOld > 2 ? '#fef3c7' : '#f3f4f6',
                              color: daysOld > 2 ? '#92400e' : '#6b7280',
                            }}>
                              {daysOld > 2 && <Clock size={10} />}
                              {al.status}
                              {daysOld > 0 && ` (${daysOld}d)`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </SectionCard>

          {/* Footer */}
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingTop: 12, paddingBottom: 40 }}>
            This report is auto-generated &mdash; {fmtDateTime(data.generated_at)} &mdash; For internal use only.
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
