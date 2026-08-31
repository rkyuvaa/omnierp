import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { 
  Calculator, Calendar, DollarSign, TrendingUp, TrendingDown, 
  RefreshCw, Save, CheckCircle2, AlertTriangle, Search, Filter, Layers, PieChart
} from 'lucide-react';

const MONTH_NAMES = [
  { val: 0, label: 'All Months (Full Year)' },
  { val: 4, label: 'April' }, { val: 5, label: 'May' }, { val: 6, label: 'June' },
  { val: 7, label: 'July' }, { val: 8, label: 'August' }, { val: 9, label: 'September' },
  { val: 10, label: 'October' }, { val: 11, label: 'November' }, { val: 12, label: 'December' },
  { val: 1, label: 'January' }, { val: 2, label: 'February' }, { val: 3, label: 'March' }
];

export default function FinanceBudget() {
  const [fy, setFy] = useState('2026-27');
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = All Months
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [summaryData, setSummaryData] = useState([]);
  const [editedPlans, setEditedPlans] = useState({});

  useEffect(() => {
    fetchBudgetSummary();
  }, [fy, selectedMonth]);

  const fetchBudgetSummary = async () => {
    setLoading(true);
    try {
      const params = { fy, month: selectedMonth > 0 ? selectedMonth : undefined };
      const res = await api.get('/finance/budgets/summary', { params });
      setSummaryData(res.data || []);
      setEditedPlans({});
    } catch (err) {
      toast.error('Failed to load budget summary');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (headId, val) => {
    setEditedPlans(prev => ({ ...prev, [headId]: val }));
  };

  const saveBudgets = async () => {
    if (selectedMonth === 0) {
      toast.error('Please select a specific month to set monthly planned budget.');
      return;
    }
    const updates = Object.keys(editedPlans);
    if (updates.length === 0) {
      toast('No budget changes to save.');
      return;
    }

    setSaving(true);
    try {
      for (const headId of updates) {
        const plannedAmount = parseFloat(editedPlans[headId]) || 0;
        await api.post('/finance/budgets', {
          financial_year: fy,
          month: selectedMonth,
          account_head_id: parseInt(headId),
          planned_amount: plannedAmount
        });
      }
      toast.success('Budgets saved successfully!');
      fetchBudgetSummary();
    } catch (err) {
      toast.error('Failed to save budgets');
    } finally {
      setSaving(false);
    }
  };

  // Aggregations
  const totalPlanned = summaryData.reduce((acc, row) => {
    const planned = editedPlans[row.account_head_id] !== undefined 
      ? (parseFloat(editedPlans[row.account_head_id]) || 0) 
      : row.planned_amount;
    return acc + planned;
  }, 0);

  const totalActual = summaryData.reduce((acc, row) => acc + row.actual_amount, 0);
  const totalVariance = totalPlanned - totalActual;
  const overallUtilization = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : 0;

  // Categories list
  const categories = Array.from(new Set(summaryData.map(r => r.category).filter(Boolean)));

  // Filtered rows
  const filteredRows = summaryData.filter(r => {
    const matchesSearch = r.head_name.toLowerCase().includes(search.toLowerCase()) || 
                          r.head_code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <Layout title="Finance Budget Planning">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calculator size={22} style={{ color: 'var(--accent)' }} /> Budget Planning & Variance
            </h1>
            <p style={{ color: 'var(--text2)', margin: '4px 0 0 0', fontSize: 13 }}>
              Set planned financial targets per account head and compare against real-time actual expenditures.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={fetchBudgetSummary}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6,
                background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
            {selectedMonth > 0 && (
              <button
                onClick={saveBudgets}
                disabled={saving || Object.keys(editedPlans).length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6,
                  background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  opacity: (saving || Object.keys(editedPlans).length === 0) ? 0.6 : 1
                }}
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Total Planned Budget</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 0 0', color: 'var(--text)' }}>
              {formatCurrency(totalPlanned)}
            </div>
          </div>
          <div style={{ padding: 16, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Total Actual Expenditure</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 0 0', color: 'var(--text)' }}>
              {formatCurrency(totalActual)}
            </div>
          </div>
          <div style={{ padding: 16, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Net Variance</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 0 0', color: totalVariance >= 0 ? '#15803d' : '#b91c1c' }}>
              {formatCurrency(totalVariance)}
            </div>
          </div>
          <div style={{ padding: 16, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Overall Utilization</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 0 0', color: overallUtilization > 100 ? '#b91c1c' : '#357ebd' }}>
              {overallUtilization}%
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, background: 'var(--bg2)',
          borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20, alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <Calendar size={16} /> Period:
          </div>

          <select
            value={fy}
            onChange={e => setFy(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          >
            {['2024-25', '2025-26', '2026-27', '2027-28'].map(y => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          >
            {MONTH_NAMES.map(m => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text2)' }} />
              <input
                type="text"
                placeholder="Search account head..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* Budget Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: 8 }} />
            <p>Loading budget data...</p>
          </div>
        ) : (
          <div style={{ background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px' }}>Code</th>
                  <th style={{ padding: '12px 16px' }}>Account Head Name</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Planned Budget (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actual Spent (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Variance (₹)</th>
                  <th style={{ padding: '12px 16px' }}>Utilization %</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
                      No account heads found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => {
                    const currentPlanned = editedPlans[row.account_head_id] !== undefined
                      ? editedPlans[row.account_head_id]
                      : row.planned_amount;

                    const plannedNum = parseFloat(currentPlanned) || 0;
                    const variance = plannedNum - row.actual_amount;
                    const pct = plannedNum > 0 ? ((row.actual_amount / plannedNum) * 100).toFixed(1) : (row.actual_amount > 0 ? 100 : 0);

                    let statusBadge = { bg: '#dcfce7', color: '#15803d', label: 'On Track' };
                    if (pct > 100) {
                      statusBadge = { bg: '#fee2e2', color: '#b91c1c', label: 'Over Budget' };
                    } else if (pct >= 85) {
                      statusBadge = { bg: '#fef9c3', color: '#a16207', label: 'Near Limit' };
                    }

                    return (
                      <tr key={row.account_head_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text2)' }}>{row.head_code}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>{row.head_name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{row.category}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {selectedMonth > 0 ? (
                            <input
                              type="number"
                              value={currentPlanned}
                              onChange={e => handlePlanChange(row.account_head_id, e.target.value)}
                              style={{
                                width: 110, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                                background: 'var(--bg)', textAlign: 'right', fontWeight: 600, fontSize: 13
                              }}
                            />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{formatCurrency(row.planned_amount)}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(row.actual_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: variance >= 0 ? '#15803d' : '#b91c1c' }}>
                          {formatCurrency(variance)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${Math.min(pct, 100)}%`,
                                background: pct > 100 ? '#b91c1c' : pct >= 85 ? '#d97706' : '#16a34a'
                              }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, width: 45 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: statusBadge.bg, color: statusBadge.color
                          }}>
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
