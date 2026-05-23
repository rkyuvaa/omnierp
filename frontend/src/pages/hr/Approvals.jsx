import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Clock, User, Calendar } from 'lucide-react';

export default function Approvals() {
  const [approvers, setApprovers] = useState([]);
  const [selectedApprover, setSelectedApprover] = useState('');
  const [pendingLeave, setPendingLeave] = useState([]);
  const [pendingOD, setPendingOD] = useState([]);
  const [allLeave, setAllLeave] = useState([]);
  const [allOD, setAllOD] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('pending');
  const [sandwichLeaves, setSandwichLeaves] = useState([]);
  const [sandwichMonth, setSandwichMonth] = useState(new Date().getMonth() + 1);
  const [sandwichYear, setSandwichYear] = useState(new Date().getFullYear());
  const [sandwichReason, setSandwichReason] = useState({});
  const [bulkReason, setBulkReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showProcessedSandwich, setShowProcessedSandwich] = useState(false);
  const [remarkModal, setRemarkModal] = useState(null);
  const [remark, setRemark] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    api.get('/hr/employees/', { params: { is_active: true } }).then(r => {
      setApprovers(r.data);
      if (r.data[0]) setSelectedApprover(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedApprover && tab !== 'sandwich') return;
    fetchData();
  }, [selectedApprover, tab, sandwichMonth, sandwichYear]);

  async function fetchData() {
    setLoading(true);
    try {
      if (tab === 'pending') {
        const [lv, od] = await Promise.all([
          api.get('/hr/leave/pending', { params: { approver_id: selectedApprover } }),
          api.get('/hr/onduty/pending', { params: { approver_id: selectedApprover } }),
        ]);
        setPendingLeave(lv.data);
        setPendingOD(od.data);
      } else if (tab === 'history') {
        const [lv, od] = await Promise.all([
          api.get('/hr/leave/all'),
          api.get('/hr/onduty/all'),
        ]);
        setAllLeave(lv.data.filter(r => r.status !== 'pending'));
        setAllOD(od.data.filter(r => r.status !== 'pending'));
      } else if (tab === 'sandwich') {
        const res = await api.get('/hr/attendance/sandwich-leaves', {
          params: { month: sandwichMonth, year: sandwichYear }
        });
        setSandwichLeaves(res.data);
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  async function handleSandwichDecision(empId, dateStr, action) {
    try {
      const reason = sandwichReason[`${empId}-${dateStr}`] || '';
      await api.post('/hr/attendance/sandwich-decision', {
        employee_id: empId,
        date: dateStr,
        action,
        reason: reason || (action === 'deduct' ? 'Deducted as Sandwich LOP' : 'Ignored sandwich LOP')
      });
      toast.success(`Deduction successfully ${action === 'deduct' ? 'applied' : 'ignored'}`);
      fetchData();
    } catch {
      toast.error('Failed to apply decision');
    }
  }

  async function handleBulkSandwichDecision(action) {
    if (!confirm(`Are you sure you want to bulk ${action === 'deduct' ? 'deduct LOP for' : 'ignore'} all ${sandwichLeaves.length} sandwich Sundays?`)) {
      return;
    }
    setBulkLoading(true);
    try {
      await Promise.all(sandwichLeaves.map(item => {
        const reason = bulkReason || (action === 'deduct' ? 'Deducted as Sandwich LOP' : 'Ignored sandwich LOP');
        return api.post('/hr/attendance/sandwich-decision', {
          employee_id: item.employee_id,
          date: item.date,
          action,
          reason
        });
      }));
      toast.success(`Successfully bulk ${action === 'deduct' ? 'deducted' : 'ignored'} all items.`);
      setBulkReason('');
      fetchData();
    } catch {
      toast.error('Failed to complete some bulk decisions');
      fetchData();
    } finally {
      setBulkLoading(false);
    }
  }

  function openAction(req, act, type) {
    setRemarkModal({ req, type });
    setAction(act);
    setRemark('');
  }

  async function doAction() {
    const { req, type } = remarkModal;
    try {
      const endpoint = type === 'leave'
        ? `/hr/leave/${req.id}/${action}`
        : `/hr/onduty/${req.id}/${action}`;
      await api.post(endpoint, { remarks: remark });
      toast.success(`${action === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      setRemarkModal(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  }

  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)',
  });

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };

  function CountdownTimer({ seconds }) {
    const [secs, setSecs] = useState(seconds);
    useEffect(() => { const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return <span style={{ fontFamily: 'monospace', color: secs < 3600 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{`${h}h ${m}m ${s}s`}</span>;
  }

  function RequestCard({ req, type, showActions }) {
    const statusColors = { pending: '#f59e0b', approved: '#22c55e', auto_approved: '#3b82f6', rejected: '#ef4444', cancelled: '#94a3b8' };
    return (
      <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 18, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                {req.employee_name?.[0] || 'E'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{req.employee_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{req.reference}</div>
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: `${statusColors[req.status]}20`, color: statusColors[req.status] }}>
                {req.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {type === 'leave' ? (
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                <strong>{req.leave_type_name}</strong> · {req.from_date} → {req.to_date} · {req.total_days} day{req.total_days > 1 ? 's' : ''}
                {req.reason && <div style={{ marginTop: 4, color: 'var(--text3)' }}>Reason: {req.reason}</div>}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                On-Duty · {req.date} · {req.from_time}–{req.to_time}
                {req.work_location && <span> · {req.work_location}</span>}
                {req.purpose && <div style={{ marginTop: 4, color: 'var(--text3)' }}>Purpose: {req.purpose}</div>}
              </div>
            )}

            {req.approver_remarks && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444', fontStyle: 'italic' }}>Remarks: {req.approver_remarks}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {req.status === 'pending' && req.seconds_until_auto_approve > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <Clock size={12} style={{ color: '#f59e0b' }} />
                <CountdownTimer seconds={req.seconds_until_auto_approve} />
              </div>
            )}
            {showActions && req.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openAction(req, 'approve', type)}
                  style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={14} /> Approve
                </button>
                <button onClick={() => openAction(req, 'reject', type)}
                  style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <XCircle size={14} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = pendingLeave.length + pendingOD.length;

  return (
    <Layout title="Approvals">
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selectedApprover} onChange={e => setSelectedApprover(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 220 }}>
            {approvers.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>
              Pending {pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>{pendingCount}</span>}
            </button>
            <button style={tabStyle(tab === 'history')} onClick={() => setTab('history')}>History</button>
            <button style={tabStyle(tab === 'sandwich')} onClick={() => setTab('sandwich')}>Sandwich Sundays</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
        ) : tab === 'pending' ? (
          <div>
            {pendingLeave.length === 0 && pendingOD.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                <CheckCircle size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                No pending approvals
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingLeave.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Leave Requests ({pendingLeave.length})</div>}
                {pendingLeave.map(r => <RequestCard key={r.id} req={r} type="leave" showActions />)}
                {pendingOD.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>On-Duty Requests ({pendingOD.length})</div>}
                {pendingOD.map(r => <RequestCard key={r.id} req={r} type="od" showActions />)}
              </div>
            )}
          </div>
        ) : tab === 'history' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...allLeave.map(r => ({ ...r, _type: 'leave' })), ...allOD.map(r => ({ ...r, _type: 'od' }))]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(r => <RequestCard key={`${r._type}-${r.id}`} req={r} type={r._type} showActions={false} />)}
          </div>
        ) : (() => {
            const filteredSandwich = sandwichLeaves.filter(item => {
              if (showProcessedSandwich) return true;
              const isDeducted = item.current_status === 'sandwich_lop';
              const isIgnored = item.current_status === 'weekly_off' && item.reason && item.reason.includes('Ignored');
              return !isDeducted && !isIgnored;
            });

            return (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Select Month/Year:</span>
                  <select value={sandwichMonth} onChange={e => setSandwichMonth(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select value={sandwichYear} onChange={e => setSandwichYear(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
                    {[2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text2)', marginLeft: 'auto' }}>
                    <input 
                      type="checkbox" 
                      checked={showProcessedSandwich} 
                      onChange={e => setShowProcessedSandwich(e.target.checked)} 
                      style={{ cursor: 'pointer' }}
                    />
                    Show processed Sundays
                  </label>
                </div>

                {filteredSandwich.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                    <CheckCircle size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                    No pending sandwich leaves for this month
                  </div>
                ) : (
                  <div>
                    {/* Bulk Actions Panel */}
                    <div style={{
                      background: 'var(--bg2)',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 16,
                      border: '1px dashed var(--accent)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Bulk Decisions ({filteredSandwich.length} items)</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Apply deduction or exemption to all detected sandwich Sundays in one click.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="Bulk reason (optional)..."
                          value={bulkReason}
                          onChange={e => setBulkReason(e.target.value)}
                          style={{ ...inputStyle, width: 220 }}
                        />
                        <button
                          onClick={() => handleBulkSandwichDecision('deduct')}
                          disabled={bulkLoading}
                          style={{
                            background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8,
                            padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 12
                          }}
                        >
                          {bulkLoading ? 'Processing...' : 'Bulk Deduct LOP'}
                        </button>
                        <button
                          onClick={() => handleBulkSandwichDecision('ignore')}
                          disabled={bulkLoading}
                          style={{
                            background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 8,
                            padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 12
                          }}
                        >
                          {bulkLoading ? 'Processing...' : 'Bulk Ignore'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      {filteredSandwich.map(item => {
                        const key = `${item.employee_id}-${item.date}`;
                        const isDeducted = item.current_status === 'sandwich_lop';
                        const isIgnored = item.current_status === 'weekly_off' && item.reason && item.reason.includes('Ignored');
                        
                        return (
                          <div key={key} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 18, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                                    {item.employee_name?.[0] || 'E'}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.employee_name} ({item.employee_code})</div>
                                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                                      Sandwich Date: <strong>{item.date}</strong> (Sunday)
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                                    background: isDeducted ? '#fee2e2' : isIgnored ? '#dcfce7' : 'var(--bg3)',
                                    color: isDeducted ? '#dc2626' : isIgnored ? '#16a34a' : 'var(--text2)'
                                  }}>
                                    {isDeducted ? 'DEDUCTED (LOP)' : isIgnored ? 'PAID (EXEMPTED)' : 'PENDING DECISION'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                                  Saturday: <span style={{ color: '#ef4444', fontWeight: 600 }}>{item.sat_status.toUpperCase()}</span> · 
                                  Monday: <span style={{ color: '#ef4444', fontWeight: 600 }}> {item.mon_status.toUpperCase()}</span>
                                </div>
                                {item.reason && (
                                  <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
                                    Audit Log: {item.reason}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
                                <input
                                  type="text"
                                  placeholder="Reason for exemption (optional)..."
                                  value={sandwichReason[key] || ''}
                                  onChange={e => setSandwichReason(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={inputStyle}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={() => handleSandwichDecision(item.employee_id, item.date, 'deduct')}
                                    style={{
                                      flex: 1, background: isDeducted ? '#fca5a5' : '#fee2e2', color: '#dc2626',
                                      border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                                      fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                    }}
                                  >
                                    Deduct LOP
                                  </button>
                                  <button
                                    onClick={() => handleSandwichDecision(item.employee_id, item.date, 'ignore')}
                                    style={{
                                      flex: 1, background: isIgnored ? '#86efac' : '#dcfce7', color: '#16a34a',
                                      border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                                      fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                    }}
                                  >
                                    Ignore
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        }
      </div>

      {/* Remark Modal */}
      {remarkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 400, maxWidth: '95vw' }}>
            <h3 style={{ margin: '0 0 16px', fontWeight: 700 }}>{action === 'approve' ? '✓ Approve' : '✗ Reject'} Request</h3>
            <p style={{ margin: '0 0 12px', color: 'var(--text2)', fontSize: 13 }}>
              {remarkModal.req.employee_name} · {remarkModal.type === 'leave' ? `${remarkModal.req.leave_type_name} (${remarkModal.req.from_date}–${remarkModal.req.to_date})` : `On-Duty (${remarkModal.req.date})`}
            </p>
            <textarea value={remark} onChange={e => setRemark(e.target.value)}
              placeholder={action === 'approve' ? 'Add remarks (optional)...' : 'Reason for rejection...'}
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRemarkModal(null)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={doAction} className="btn btn-primary" style={{ flex: 1, background: action === 'approve' ? '#22c55e' : '#ef4444' }}>
                {action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
