import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { PlusCircle, Clock, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const STATUS_BADGE = {
  pending:       { bg: '#fef3c7', color: '#d97706', label: 'Pending' },
  approved:      { bg: '#dcfce7', color: '#16a34a', label: 'Approved' },
  auto_approved: { bg: '#dbeafe', color: '#2563eb', label: 'Auto-Approved' },
  rejected:      { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
  cancelled:     { bg: '#f1f5f9', color: '#64748b', label: 'Cancelled' },
};

function calculateToTime(fromTimeStr, durationHoursStr) {
  if (!fromTimeStr || !durationHoursStr) return '';
  const duration = parseFloat(durationHoursStr);
  if (isNaN(duration) || duration <= 0) return '';
  
  const [hhStr, mmStr] = fromTimeStr.split(':');
  const fromH = parseInt(hhStr, 10);
  const fromM = parseInt(mmStr, 10);
  
  const totalMinutes = fromH * 60 + fromM + Math.round(duration * 60);
  const finalH = Math.floor(totalMinutes / 60) % 24;
  const finalM = totalMinutes % 60;
  
  const toHStr = String(finalH).padStart(2, '0');
  const toMStr = String(finalM).padStart(2, '0');
  
  return `${toHStr}:${toMStr}`;
}

export default function Requests() {
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [myLeave, setMyLeave] = useState([]);
  const [myOD, setMyOD] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leave');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showODModal, setShowODModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ is_half_day: false });
  const [odForm, setODForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    api.get('/hr/employees/', { params: { is_active: true } })
      .then(r => {
        setEmployees(r.data || []);
        if (user?.is_superadmin && r.data && r.data[0]) {
          setSelectedEmp(r.data[0].id);
        }
      })
      .catch(e => console.error(e));

    if (!user?.is_superadmin) {
      setSelectedEmp(user?.employee_id || '');
    }
    api.get('/hr/leave/types').then(r => setLeaveTypes(r.data.filter(t => t.is_active)));
  }, [user]);

  useEffect(() => {
    if (!selectedEmp) {
      setLoading(false);
      return;
    }
    fetchRequests();
  }, [selectedEmp]);

  useEffect(() => {
    const refId = searchParams.get('id');
    const refType = searchParams.get('type'); // 'leave' or 'onduty'
    if (refId && refType) {
      setTab(refType);
      setStatusFilter('all');
      
      setTimeout(() => {
        const element = document.getElementById(`${refType}-${refId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.style.outline = '2.5px solid var(--accent)';
          element.style.outlineOffset = '2px';
          element.style.transition = 'outline 0.3s ease';
          
          setTimeout(() => {
            element.style.outline = 'none';
          }, 3000);
        }
      }, 600);
    }
  }, [myLeave, myOD, searchParams]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const [lv, od] = await Promise.all([
        api.get('/hr/leave/my-requests', { params: { employee_id: selectedEmp } }),
        api.get('/hr/onduty/my-requests', { params: { employee_id: selectedEmp } }),
      ]);
      setMyLeave(lv.data);
      setMyOD(od.data);
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }

  async function fetchLeaveBalances(empId) {
    if (!empId) return;
    setBalancesLoading(true);
    try {
      const year = new Date().getFullYear();
      const r = await api.get('/hr/leave/balances', { params: { employee_id: empId, year } });
      setLeaveBalances(r.data || []);
    } catch { setLeaveBalances([]); }
    finally { setBalancesLoading(false); }
  }

  async function applyLeave() {
    const finalForm = { ...leaveForm };
    if (!user?.is_superadmin && user?.employee_id) {
      finalForm.employee_id = user.employee_id;
    }
    if (!finalForm.employee_id) {
      return toast.error(
        user?.is_superadmin
          ? "Please select an employee."
          : "Your user account is not linked to an Employee record. Please contact your administrator."
      );
    }
    if (!finalForm.leave_type_id || !finalForm.from_date || !finalForm.to_date)
      return toast.error('Please fill all required fields');
    setSaving(true);
    try {
      await api.post('/hr/leave/apply', finalForm);
      toast.success('Leave request submitted');
      setShowLeaveModal(false);
      setLeaveForm({ is_half_day: false });
      setLeaveBalances([]);
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to apply'); }
    finally { setSaving(false); }
  }

  async function applyOD() {
    const finalForm = { ...odForm };
    if (!user?.is_superadmin && user?.employee_id) {
      finalForm.employee_id = user.employee_id;
    }
    if (!finalForm.employee_id) {
      return toast.error(
        user?.is_superadmin
          ? "Please select an employee."
          : "Your user account is not linked to an Employee record. Please contact your administrator."
      );
    }
    if (!finalForm.date || !finalForm.from_time || !finalForm.to_time)
      return toast.error('Please fill all required fields');
    setSaving(true);
    try {
      await api.post('/hr/onduty/apply', finalForm);
      toast.success('On-Duty request submitted');
      setShowODModal(false);
      setODForm({});
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to apply'); }
    finally { setSaving(false); }
  }

  async function cancelLeave(id) {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await api.post(`/hr/leave/${id}/cancel`);
      toast.success('Cancelled');
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  }

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' };
  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: active ? 'var(--accent)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text2)',
  });
  const subTabStyle = (active) => ({
    padding: '6px 14px', borderRadius: 20, border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'), cursor: 'pointer', fontWeight: 600, fontSize: 12,
    background: active ? 'rgba(25, 84, 2, 0.08)' : 'var(--bg2)', color: active ? 'var(--accent)' : 'var(--text2)', transition: 'all 0.2s ease',
  });

  function CountdownTimer({ seconds }) {
    const [secs, setSecs] = useState(seconds);
    useEffect(() => {
      const interval = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
      return () => clearInterval(interval);
    }, []);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b' }}>{`${h}h ${m}m ${s}s`}</span>;
  }

  return (
    <Layout title="My Requests">
      <div style={{ padding: '0 24px 24px' }}>
        {/* Employee selector (for HR view) */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {user?.is_superadmin && (
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 200 }}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabStyle(tab === 'leave')} onClick={() => setTab('leave')}>Leave Requests</button>
            <button style={tabStyle(tab === 'od')} onClick={() => setTab('od')}>On-Duty Requests</button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { 
              const eid = selectedEmp || user?.employee_id; 
              const currentEmp = employees.find(e => e.id === parseInt(eid)) || employees.find(e => e.id === eid);
              setLeaveForm({ is_half_day: false, employee_id: eid, cc_employee_ids: currentEmp?.cc_manager_ids || [] }); 
              setShowLeaveModal(true); 
              fetchLeaveBalances(eid); 
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <PlusCircle size={14} /> Apply Leave
            </button>
            <button className="btn" onClick={() => { 
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              setODForm({ 
                employee_id: selectedEmp,
                date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
                from_time: `${hh}:${mm}`
              }); 
              setShowODModal(true); 
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <PlusCircle size={14} /> Apply On-Duty
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button style={subTabStyle(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>All</button>
          <button style={subTabStyle(statusFilter === 'pending')} onClick={() => setStatusFilter('pending')}>Pending</button>
          <button style={subTabStyle(statusFilter === 'approved')} onClick={() => setStatusFilter('approved')}>Approved</button>
          <button style={subTabStyle(statusFilter === 'rejected')} onClick={() => setStatusFilter('rejected')}>Rejected</button>
        </div>

        {/* Request List */}
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'leave' && (() => {
              const filtered = myLeave.filter(req => {
                if (statusFilter === 'all') return true;
                if (statusFilter === 'pending') return req.status === 'pending';
                if (statusFilter === 'approved') return req.status === 'approved' || req.status === 'auto_approved';
                if (statusFilter === 'rejected') return req.status === 'rejected';
                return true;
              });
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>No leave requests found</div>;
              }
              return filtered.map(req => (
                <div key={req.id} id={`leave-${req.id}`} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{req.leave_type_name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: STATUS_BADGE[req.status]?.bg, color: STATUS_BADGE[req.status]?.color }}>
                          {STATUS_BADGE[req.status]?.label}
                        </span>
                        {req.l1_approver_id && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: req.l1_status === 'approved' ? '#22c55e' : (req.l1_status === 'rejected' ? '#ef4444' : '#f59e0b'), marginLeft: 4, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                            L1: {req.l1_status ? req.l1_status.toUpperCase() : 'PENDING'}
                          </span>
                        )}
                        {req.l2_approver_id && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: req.l2_status === 'approved' ? '#22c55e' : (req.l2_status === 'rejected' ? '#ef4444' : '#f59e0b'), marginLeft: 4, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                            L2: {req.l2_status ? req.l2_status.toUpperCase() : 'PENDING'}
                          </span>
                        )}
                        {req.is_auto_approved && <span style={{ fontSize: 11, color: '#2563eb' }}>⏰ Auto-approved</span>}
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: 13 }}>{req.from_date} → {req.to_date} · <strong>{req.total_days} day{req.total_days > 1 ? 's' : ''}</strong></div>
                      {req.reason && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>Reason: {req.reason}</div>}
                      {req.approver_remarks && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Remarks: {req.approver_remarks}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{req.reference}</span>
                      {req.status === 'pending' && req.seconds_until_auto_approve > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <Clock size={12} style={{ color: '#f59e0b' }} />
                          Auto-approve in: <CountdownTimer seconds={req.seconds_until_auto_approve} />
                        </div>
                      )}
                      {req.status === 'pending' && (
                        <button onClick={() => cancelLeave(req.id)} style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                      )}
                    </div>
                  </div>
                </div>
              ));
            })()}

            {tab === 'od' && (() => {
              const filtered = myOD.filter(req => {
                if (statusFilter === 'all') return true;
                if (statusFilter === 'pending') return req.status === 'pending';
                if (statusFilter === 'approved') return req.status === 'approved' || req.status === 'auto_approved';
                if (statusFilter === 'rejected') return req.status === 'rejected';
                return true;
              });
              if (filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>No on-duty requests found</div>;
              }
              return filtered.map(req => (
                <div key={req.id} id={`od-${req.id}`} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>On-Duty — {req.date}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: STATUS_BADGE[req.status]?.bg, color: STATUS_BADGE[req.status]?.color }}>
                          {STATUS_BADGE[req.status]?.label}
                        </span>
                        {req.l1_approver_id && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: req.l1_status === 'approved' ? '#22c55e' : (req.l1_status === 'rejected' ? '#ef4444' : '#f59e0b'), marginLeft: 4, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                            L1: {req.l1_status ? req.l1_status.toUpperCase() : 'PENDING'}
                          </span>
                        )}
                        {req.l2_approver_id && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: req.l2_status === 'approved' ? '#22c55e' : (req.l2_status === 'rejected' ? '#ef4444' : '#f59e0b'), marginLeft: 4, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                            L2: {req.l2_status ? req.l2_status.toUpperCase() : 'PENDING'}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: 13 }}>{req.from_time} – {req.to_time} · {req.work_location}</div>
                      {req.purpose && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>Purpose: {req.purpose}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{req.reference}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Leave Apply Modal */}
      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Apply Leave</h3>
              <button onClick={() => { setShowLeaveModal(false); setLeaveBalances([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {user?.is_superadmin && (
                <div>
                  <label style={labelStyle}>Employee</label>
                  <select value={leaveForm.employee_id || ''} onChange={e => { const eid = parseInt(e.target.value); setLeaveForm({ ...leaveForm, employee_id: eid }); fetchLeaveBalances(eid); }} style={inputStyle}>
                    <option value="">— Select —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Leave Type</label>
                <select value={leaveForm.leave_type_id || ''} onChange={e => setLeaveForm({ ...leaveForm, leave_type_id: parseInt(e.target.value) })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                </select>
              </div>

              {/* Leave Balance Panel */}
              {leaveBalances.length > 0 && (
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Your Leave Balances ({new Date().getFullYear()})
                  </div>
                  {balancesLoading ? (
                    <div style={{ color: 'var(--text2)', fontSize: 13 }}>Loading balances...</div>
                  ) : (
                    leaveBalances.map(b => {
                      const total = (b.allocated_days || 0) + (b.carry_forwarded || 0);
                      const used = b.used_days || 0;
                      const remaining = Math.max(0, total - used);
                      const pct = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;
                      const isSelected = leaveForm.leave_type_id === b.leave_type_id;
                      const color = isSelected ? 'var(--accent)' : (remaining <= 0 ? '#ef4444' : '#22c55e');
                      return (
                        <div key={b.id} style={{
                          marginBottom: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: isSelected ? 'var(--accent)10' : 'transparent',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                          transition: 'all 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                              {b.leave_type_name} ({b.leave_type_code})
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: remaining <= 0 ? '#ef4444' : 'var(--text2)' }}>
                              {remaining} / {total} days
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s ease' }} />
                          </div>
                          {isSelected && remaining <= 0 && (
                            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                              ⚠ No balance remaining — leave may go to LOP
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>From Date</label><input type="date" value={leaveForm.from_date || ''} onChange={e => setLeaveForm({ ...leaveForm, from_date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>To Date</label><input type="date" value={leaveForm.to_date || ''} onChange={e => setLeaveForm({ ...leaveForm, to_date: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="halfday" checked={leaveForm.is_half_day || false} onChange={e => setLeaveForm({ ...leaveForm, is_half_day: e.target.checked })} />
                <label htmlFor="halfday" style={{ fontSize: 13, fontWeight: 600 }}>Half Day</label>
                {leaveForm.is_half_day && (
                  <select value={leaveForm.half_day_session || 'morning'} onChange={e => setLeaveForm({ ...leaveForm, half_day_session: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                  </select>
                )}
              </div>
              <div><label style={labelStyle}>Reason</label><textarea value={leaveForm.reason || ''} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} /></div>
              <div>
                <label style={labelStyle}>CC (Informational notification sent upon submission)</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {(leaveForm.cc_employee_ids || []).map(ccId => {
                    const ccEmp = employees.find(e => e.id === ccId);
                    return (
                      <span key={ccId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}>
                        {ccEmp ? ccEmp.name : `Emp #${ccId}`}
                        <X size={12} style={{ cursor: 'pointer', color: 'var(--text3)' }} onClick={() => {
                          setLeaveForm({ ...leaveForm, cc_employee_ids: (leaveForm.cc_employee_ids || []).filter(id => id !== ccId) });
                        }} />
                      </span>
                    );
                  })}
                </div>
                <select value="" onChange={e => {
                  if (!e.target.value) return;
                  const val = parseInt(e.target.value);
                  const curr = leaveForm.cc_employee_ids || [];
                  if (!curr.includes(val)) {
                    setLeaveForm({ ...leaveForm, cc_employee_ids: [...curr, val] });
                  }
                }} style={inputStyle}>
                  <option value="">+ Add CC Person...</option>
                  {employees.filter(emp => emp.id !== parseInt(leaveForm.employee_id || selectedEmp || user?.employee_id) && !(leaveForm.cc_employee_ids || []).includes(emp.id)).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowLeaveModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={applyLeave} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* On-Duty Apply Modal */}
      {showODModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 440, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Apply On-Duty</h3>
              <button onClick={() => setShowODModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {user?.is_superadmin && (
                <div>
                  <label style={labelStyle}>Employee</label>
                  <select value={odForm.employee_id || ''} onChange={e => setODForm({ ...odForm, employee_id: parseInt(e.target.value) })} style={inputStyle}>
                    <option value="">— Select —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
                  </select>
                </div>
              )}
              <div><label style={labelStyle}>Date</label><input type="date" value={odForm.date || ''} onChange={e => setODForm({ ...odForm, date: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>From Time</label>
                  <input 
                    type="time" 
                    value={odForm.from_time || ''} 
                    onChange={e => {
                      const newFrom = e.target.value;
                      const calculatedTo = calculateToTime(newFrom, odForm.duration);
                      setODForm({ 
                        ...odForm, 
                        from_time: newFrom,
                        ...(calculatedTo ? { to_time: calculatedTo } : {})
                      });
                    }} 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>Hours (Optional)</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    min="0" 
                    placeholder="e.g. 2" 
                    value={odForm.duration || ''} 
                    onChange={e => {
                      const dur = e.target.value;
                      const calculatedTo = calculateToTime(odForm.from_time, dur);
                      setODForm({ 
                        ...odForm, 
                        duration: dur,
                        ...(calculatedTo ? { to_time: calculatedTo } : {})
                      });
                    }} 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>To Time</label>
                  <input 
                    type="time" 
                    value={odForm.to_time || ''} 
                    onChange={e => setODForm({ ...odForm, to_time: e.target.value })} 
                    style={inputStyle} 
                  />
                </div>
              </div>
              <div><label style={labelStyle}>Work Location</label><input type="text" value={odForm.work_location || ''} onChange={e => setODForm({ ...odForm, work_location: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Purpose</label><textarea value={odForm.purpose || ''} onChange={e => setODForm({ ...odForm, purpose: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowODModal(false)} className="btn" style={{ flex: 1, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
              <button onClick={applyOD} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
