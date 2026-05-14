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
    if (!selectedApprover) return;
    fetchData();
  }, [selectedApprover, tab]);

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
      } else {
        const [lv, od] = await Promise.all([
          api.get('/hr/leave/all'),
          api.get('/hr/onduty/all'),
        ]);
        setAllLeave(lv.data.filter(r => r.status !== 'pending'));
        setAllOD(od.data.filter(r => r.status !== 'pending'));
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...allLeave.map(r => ({ ...r, _type: 'leave' })), ...allOD.map(r => ({ ...r, _type: 'od' }))]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(r => <RequestCard key={`${r._type}-${r.id}`} req={r} type={r._type} showActions={false} />)}
          </div>
        )}
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
