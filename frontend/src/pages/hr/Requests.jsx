import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { PlusCircle, Clock, X, ChevronDown } from 'lucide-react';

const STATUS_BADGE = {
  pending:       { bg: '#fef3c7', color: '#d97706', label: 'Pending' },
  approved:      { bg: '#dcfce7', color: '#16a34a', label: 'Approved' },
  auto_approved: { bg: '#dbeafe', color: '#2563eb', label: 'Auto-Approved' },
  rejected:      { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
  cancelled:     { bg: '#f1f5f9', color: '#64748b', label: 'Cancelled' },
};

export default function Requests() {
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [myLeave, setMyLeave] = useState([]);
  const [myOD, setMyOD] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leave');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showODModal, setShowODModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ is_half_day: false });
  const [odForm, setODForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState('');

  useEffect(() => {
    api.get('/hr/employees/', { params: { is_active: true } }).then(r => { setEmployees(r.data); if (r.data[0]) setSelectedEmp(r.data[0].id); });
    api.get('/hr/leave/types').then(r => setLeaveTypes(r.data.filter(t => t.is_active)));
  }, []);

  useEffect(() => {
    if (!selectedEmp) return;
    fetchRequests();
  }, [selectedEmp]);

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

  async function applyLeave() {
    if (!leaveForm.employee_id || !leaveForm.leave_type_id || !leaveForm.from_date || !leaveForm.to_date)
      return toast.error('Please fill all required fields');
    setSaving(true);
    try {
      await api.post('/hr/leave/apply', leaveForm);
      toast.success('Leave request submitted');
      setShowLeaveModal(false);
      setLeaveForm({ is_half_day: false });
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to apply'); }
    finally { setSaving(false); }
  }

  async function applyOD() {
    if (!odForm.employee_id || !odForm.date || !odForm.from_time || !odForm.to_time)
      return toast.error('Please fill all required fields');
    setSaving(true);
    try {
      await api.post('/hr/onduty/apply', odForm);
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
          <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 200 }}>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabStyle(tab === 'leave')} onClick={() => setTab('leave')}>Leave Requests</button>
            <button style={tabStyle(tab === 'od')} onClick={() => setTab('od')}>On-Duty Requests</button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { setLeaveForm({ is_half_day: false, employee_id: selectedEmp }); setShowLeaveModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <PlusCircle size={14} /> Apply Leave
            </button>
            <button className="btn" onClick={() => { setODForm({ employee_id: selectedEmp }); setShowODModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <PlusCircle size={14} /> Apply On-Duty
            </button>
          </div>
        </div>

        {/* Request List */}
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'leave' && (myLeave.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>No leave requests</div>
            ) : myLeave.map(req => (
              <div key={req.id} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{req.leave_type_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: STATUS_BADGE[req.status]?.bg, color: STATUS_BADGE[req.status]?.color }}>
                        {STATUS_BADGE[req.status]?.label}
                      </span>
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
            )))}

            {tab === 'od' && (myOD.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>No on-duty requests</div>
            ) : myOD.map(req => (
              <div key={req.id} style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>On-Duty — {req.date}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: STATUS_BADGE[req.status]?.bg, color: STATUS_BADGE[req.status]?.color }}>
                        {STATUS_BADGE[req.status]?.label}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text2)', fontSize: 13 }}>{req.from_time} – {req.to_time} · {req.work_location}</div>
                    {req.purpose && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>Purpose: {req.purpose}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{req.reference}</div>
                </div>
              </div>
            )))}
          </div>
        )}
      </div>

      {/* Leave Apply Modal */}
      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 440, maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Apply Leave</h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Employee</label>
                <select value={leaveForm.employee_id || ''} onChange={e => setLeaveForm({ ...leaveForm, employee_id: parseInt(e.target.value) })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Leave Type</label>
                <select value={leaveForm.leave_type_id || ''} onChange={e => setLeaveForm({ ...leaveForm, leave_type_id: parseInt(e.target.value) })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                </select>
              </div>
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
              <div>
                <label style={labelStyle}>Employee</label>
                <select value={odForm.employee_id || ''} onChange={e => setODForm({ ...odForm, employee_id: parseInt(e.target.value) })} style={inputStyle}>
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Date</label><input type="date" value={odForm.date || ''} onChange={e => setODForm({ ...odForm, date: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>From Time</label><input type="time" value={odForm.from_time || ''} onChange={e => setODForm({ ...odForm, from_time: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>To Time</label><input type="time" value={odForm.to_time || ''} onChange={e => setODForm({ ...odForm, to_time: e.target.value })} style={inputStyle} /></div>
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
