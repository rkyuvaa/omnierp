import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { 
  BookOpen, Calendar, Clock, FileText, Filter, RefreshCw, 
  Search, Award, CheckCircle, AlertCircle, User, Building, MapPin, Download
} from 'lucide-react';

export default function LeaveLedger() {
  const [activeTab, setActiveTab] = useState('taken'); // 'taken' | 'compoff' | 'balance'
  const [loading, setLoading] = useState(false);

  // Filter options
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Selected filters
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Data states
  const [takenSummary, setTakenSummary] = useState([]);
  const [compOffSummary, setCompOffSummary] = useState([]);
  const [balanceLedger, setBalanceLedger] = useState([]);

  useEffect(() => {
    // Fetch master filter data
    api.get('/hr/employees/', { params: { is_active: true } }).then(r => setEmployees(r.data)).catch(() => {});
    api.get('/branches/').then(r => setBranches(r.data)).catch(() => {});
    api.get('/departments/').then(r => setDepartments(r.data)).catch(() => {});
    api.get('/hr/leave/types').then(r => setLeaveTypes(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadTabContent();
  }, [activeTab, filterEmployee, filterBranch, filterDepartment, filterLeaveType, fromDate, toDate, selectedYear]);

  const loadTabContent = async () => {
    setLoading(true);
    try {
      if (activeTab === 'taken') {
        const params = {
          employee_id: filterEmployee || undefined,
          branch_id: filterBranch || undefined,
          department_id: filterDepartment || undefined,
          leave_type_id: filterLeaveType || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        };
        const r = await api.get('/hr/ledger/taken-summary', { params });
        setTakenSummary(r.data || []);
      } else if (activeTab === 'compoff') {
        const params = {
          employee_id: filterEmployee || undefined,
          branch_id: filterBranch || undefined,
          department_id: filterDepartment || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        };
        const r = await api.get('/hr/ledger/compoff-summary', { params });
        setCompOffSummary(r.data || []);
      } else if (activeTab === 'balance') {
        const params = {
          employee_id: filterEmployee || undefined,
          branch_id: filterBranch || undefined,
          department_id: filterDepartment || undefined,
          year: selectedYear,
        };
        const r = await api.get('/hr/ledger/balance-ledger', { params });
        setBalanceLedger(r.data || []);
      }
    } catch (err) {
      console.error('Failed to load leave ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      approved: { bg: '#dcfce7', color: '#15803d', label: 'Approved' },
      auto_approved: { bg: '#e0e7ff', color: '#3730a3', label: 'Auto Approved' },
      pending: { bg: '#fef9c3', color: '#a16207', label: 'Pending' },
      rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Rejected' },
      cancelled: { bg: '#f3f4f6', color: '#4b5563', label: 'Cancelled' },
      absent: { bg: '#fee2e2', color: '#991b1b', label: 'Unapproved Absent' },
    };
    const style = statusStyles[status] || { bg: '#e0e7ff', color: '#3730a3', label: status };
    return (
      <span style={{
        padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
        background: style.bg, color: style.color
      }}>
        {style.label}
      </span>
    );
  };

  return (
    <Layout title="Leave Ledger">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Top Header / Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen style={{ color: 'var(--accent, #3b82f6)' }} size={22} /> Leave Ledger
            </h1>
            <p style={{ color: 'var(--text2)', margin: '4px 0 0 0', fontSize: 13 }}>
              Detailed breakdown of leaves taken, earned compensatory off summary, and leave balances ledger.
            </p>
          </div>
          <button
            onClick={loadTabContent}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6,
              background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab('taken')}
            style={{
              padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'taken' ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
              color: activeTab === 'taken' ? 'var(--accent, #3b82f6)' : 'var(--text2)'
            }}
          >
            Leave Taken Summary
          </button>
          <button
            onClick={() => setActiveTab('compoff')}
            style={{
              padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'compoff' ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
              color: activeTab === 'compoff' ? 'var(--accent, #3b82f6)' : 'var(--text2)'
            }}
          >
            Comp-Off Earned Summary
          </button>
          <button
            onClick={() => setActiveTab('balance')}
            style={{
              padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'balance' ? '2px solid var(--accent, #3b82f6)' : '2px solid transparent',
              color: activeTab === 'balance' ? 'var(--accent, #3b82f6)' : 'var(--text2)'
            }}
          >
            Leave Balance Ledger
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, background: 'var(--bg2)',
          borderRadius: 8, border: '1px solid var(--border)', marginBottom: 24, alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <Filter size={16} /> Filters:
          </div>

          <select
            value={filterEmployee}
            onChange={e => setFilterEmployee(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          >
            <option value="">All Employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>
            ))}
          </select>

          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {activeTab === 'taken' && (
            <select
              value={filterLeaveType}
              onChange={e => setFilterLeaveType(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
            >
              <option value="">All Leave Types</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
              ))}
            </select>
          )}

          {(activeTab === 'taken' || activeTab === 'compoff') && (
            <>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
              />
            </>
          )}

          {activeTab === 'balance' && (
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          )}
        </div>

        {/* Main Tab Content */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: 8 }} />
            <p>Loading ledger data...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: Leave Taken Summary */}
            {activeTab === 'taken' && (
              <div style={{ background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px' }}>Ref #</th>
                      <th style={{ padding: '12px 16px' }}>Employee</th>
                      <th style={{ padding: '12px 16px' }}>Department / Branch</th>
                      <th style={{ padding: '12px 16px' }}>Leave Type</th>
                      <th style={{ padding: '12px 16px' }}>Date Range</th>
                      <th style={{ padding: '12px 16px' }}>Days</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {takenSummary.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
                          No leave records found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      takenSummary.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.reference}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{row.employee_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{row.employee_code}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>{row.department_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{row.branch_name}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--bg3)', fontWeight: 600 }}>
                              {row.leave_type_code}
                            </span> {row.leave_type_name}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {row.from_date} to {row.to_date}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            {row.total_days} {row.is_half_day ? `(Half-day: ${row.half_day_session})` : ''}
                          </td>
                          <td style={{ padding: '12px 16px' }}>{getStatusBadge(row.status)}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text2)', maxWidth: 200 }}>{row.reason || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Comp-Off Earned Summary */}
            {activeTab === 'compoff' && (
              <div style={{ background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px' }}>Earned Date</th>
                      <th style={{ padding: '12px 16px' }}>Employee</th>
                      <th style={{ padding: '12px 16px' }}>Department / Branch</th>
                      <th style={{ padding: '12px 16px' }}>Punches</th>
                      <th style={{ padding: '12px 16px' }}>Hours Worked</th>
                      <th style={{ padding: '12px 16px' }}>OT / Comp-Off Hours</th>
                      <th style={{ padding: '12px 16px' }}>Comp-Off Credited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compOffSummary.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
                          No compensatory off earned records found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      compOffSummary.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.date}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{row.employee_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{row.employee_code}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>{row.department_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{row.branch_name}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12 }}>
                            <div>IN: {row.check_in ? row.check_in.split('T')[1]?.substring(0, 5) : '-'}</div>
                            <div>OUT: {row.check_out ? row.check_out.split('T')[1]?.substring(0, 5) : '-'}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>{row.hours_worked} hrs</td>
                          <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>
                            +{row.comp_off_hours} hrs
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: 12, background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                              {row.comp_off_days_earned} Day(s)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: Leave Balance Ledger */}
            {activeTab === 'balance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {balanceLedger.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', background: 'var(--bg2)', borderRadius: 8 }}>
                    No balance ledger records found for {selectedYear}.
                  </div>
                ) : (
                  balanceLedger.map(empLedger => (
                    <div key={empLedger.employee_id} style={{
                      background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden'
                    }}>
                      <div style={{
                        padding: '12px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{empLedger.employee_name}</span>
                          <span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 8 }}>({empLedger.employee_code})</span>
                          <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 16 }}>
                            {empLedger.department_name} | {empLedger.branch_name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                          <div>Total Allocated: <strong>{empLedger.total_allocated}</strong></div>
                          <div>Total Used: <strong style={{ color: '#b91c1c' }}>{empLedger.total_used}</strong></div>
                          <div>Available Balance: <strong style={{ color: '#15803d' }}>{empLedger.total_available}</strong></div>
                        </div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>
                            <th style={{ padding: '8px 16px' }}>Leave Type</th>
                            <th style={{ padding: '8px 16px' }}>Allocated Days</th>
                            <th style={{ padding: '8px 16px' }}>Carry Forwarded</th>
                            <th style={{ padding: '8px 16px' }}>Used Days</th>
                            <th style={{ padding: '8px 16px' }}>Net Available Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empLedger.leave_breakdown.map(item => (
                            <tr key={item.leave_type_id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                                {item.leave_type_name} ({item.leave_type_code})
                              </td>
                              <td style={{ padding: '10px 16px' }}>{item.allocated_days}</td>
                              <td style={{ padding: '10px 16px' }}>{item.carry_forwarded}</td>
                              <td style={{ padding: '10px 16px', color: '#b91c1c' }}>{item.used_days}</td>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: '#15803d' }}>
                                {item.available_balance}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
