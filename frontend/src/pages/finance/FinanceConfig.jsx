import { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api, { getErrorMessage } from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Building2, Tag, BarChart2, Settings2, Plus, Pencil, Trash2,
  ToggleLeft, ToggleRight, X, Loader2, Save, ChevronDown,
  CheckCircle, AlertCircle, FileText, Hash, DollarSign, MapPin
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

function currentFY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-indexed
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_HEADS = ['NPD_PROD', 'COGS_WC', 'SALARY', 'AP_LOAN', 'RENT_OPEX'];

// ─── Toast / Badge helpers ────────────────────────────────────────────────────

function ActiveBadge({ active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
      background: active ? 'rgba(22,163,74,0.1)' : 'rgba(100,116,139,0.1)',
      color: active ? '#16a34a' : '#64748b',
      border: `1px solid ${active ? 'rgba(22,163,74,0.25)' : 'rgba(100,116,139,0.25)'}`
    }}>
      {active ? <CheckCircle size={9} /> : <AlertCircle size={9} />}
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function DefaultBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
      background: 'rgba(99,102,241,0.1)', color: '#4f46e5',
      border: '1px solid rgba(99,102,241,0.25)'
    }}>
      Default
    </span>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 540 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
        animation: 'fadeScale 0.18s ease'
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: Bank Accounts
// ══════════════════════════════════════════════════════════════════════════════

function BankAccountsTab() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [lienEdit, setLienEdit] = useState(null); // { id, value }

  const emptyForm = { account_name: '', bank_name: '', branch_name: '', account_number: '', ifsc_code: '', opening_balance: '', lien_amount: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/accounts', { params: { include_inactive: true } });
      setAccounts(Array.isArray(res.data) ? res.data : (res.data?.results ?? []));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load accounts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditTarget(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (acc) => {
    setEditTarget(acc);
    setForm({
      account_name: acc.account_name || '',
      bank_name: acc.bank_name || '',
      branch_name: acc.branch_name || '',
      account_number: acc.account_number || '',
      ifsc_code: acc.ifsc_code || '',
      opening_balance: acc.opening_balance ?? '',
      lien_amount: acc.lien_amount ?? '',
      notes: acc.notes || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        opening_balance: form.opening_balance !== '' ? parseFloat(form.opening_balance) : 0,
        lien_amount: form.lien_amount !== '' ? parseFloat(form.lien_amount) : 0,
      };
      if (editTarget) {
        await api.put(`/finance/accounts/${editTarget.id}`, payload);
        toast.success('Account updated');
      } else {
        await api.post('/finance/accounts', payload);
        toast.success('Account created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save account'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (acc) => {
    setToggling(acc.id);
    try {
      await api.put(`/finance/accounts/${acc.id}`, { ...acc, is_active: !acc.is_active });
      toast.success(`Account ${acc.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to toggle'));
    } finally {
      setToggling(null);
    }
  };

  const saveLien = async (acc) => {
    if (!lienEdit) return;
    try {
      await api.put(`/finance/accounts/${acc.id}`, { ...acc, lien_amount: parseFloat(lienEdit.value) || 0 });
      toast.success('Lien amount updated');
      setLienEdit(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update lien'));
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={14} /> Add Account
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table width="100%" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Account Name', 'Bank / Branch', 'Account No.', 'IFSC', 'Opening Balance', 'Lien Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>No accounts yet. Add one above.</td></tr>
              ) : accounts.map(acc => (
                <tr key={acc.id} style={{ borderBottom: '1px solid var(--border)', opacity: acc.is_active === false ? 0.6 : 1 }}>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text)' }}>{acc.account_name}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>
                    <div>{acc.bank_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{acc.branch_name}</div>
                  </td>
                  <td style={{ padding: '11px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent2)' }}>{acc.account_number || '—'}</td>
                  <td style={{ padding: '11px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--text3)' }}>{acc.ifsc_code || '—'}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>{INR(acc.opening_balance)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {lienEdit?.id === acc.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: 100, fontSize: 12, padding: '4px 8px', height: 30 }}
                          value={lienEdit.value}
                          onChange={e => setLienEdit({ ...lienEdit, value: e.target.value })}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }} onClick={() => saveLien(acc)}>
                          <Save size={11} />
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setLienEdit(null)}>
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: '#b45309' }}>{INR(acc.lien_amount)}</span>
                        <button
                          onClick={() => setLienEdit({ id: acc.id, value: acc.lien_amount ?? 0 })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                          title="Edit lien"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px' }}><ActiveBadge active={acc.is_active !== false} /></td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="action-btn" onClick={() => openEdit(acc)} title="Edit"><Pencil size={11} /></button>
                      <button
                        className="action-btn"
                        onClick={() => toggleActive(acc)}
                        disabled={toggling === acc.id}
                        title={acc.is_active !== false ? 'Deactivate' : 'Activate'}
                        style={{ color: acc.is_active !== false ? '#dc2626' : '#16a34a' }}
                      >
                        {toggling === acc.id
                          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          : acc.is_active !== false ? <ToggleRight size={11} /> : <ToggleLeft size={11} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editTarget ? 'Edit Bank Account' : 'Add Bank Account'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Account Name *</label>
                  <input className="form-input" value={form.account_name} onChange={e => set('account_name', e.target.value)} required placeholder="e.g. KOTAK Current A/c" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-input" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. Kotak Mahindra Bank" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input className="form-input" value={form.branch_name} onChange={e => set('branch_name', e.target.value)} placeholder="e.g. Andheri East" />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input className="form-input" value={form.account_number} onChange={e => set('account_number', e.target.value)} placeholder="Full account number" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input className="form-input" value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value.toUpperCase())} placeholder="KKBK0001234" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input className="form-input" type="number" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Lien Amount (₹)</label>
                  <input className="form-input" type="number" value={form.lien_amount} onChange={e => set('lien_amount', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" style={{ minHeight: 64 }} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                {saving ? 'Saving…' : editTarget ? 'Update Account' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: Account Heads
// ══════════════════════════════════════════════════════════════════════════════

function AccountHeadsTab() {
  const [heads, setHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);

  const emptyForm = { head_code: '', head_name: '', category: '' };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/heads', { params: { include_inactive: true } });
      setHeads(Array.isArray(res.data) ? res.data : (res.data?.results ?? []));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load heads'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditTarget(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (h) => {
    setEditTarget(h);
    setForm({ head_code: h.head_code || '', head_name: h.head_name || '', category: h.category || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/finance/heads/${editTarget.id}`, form);
        toast.success('Account head updated');
      } else {
        await api.post('/finance/heads', form);
        toast.success('Account head created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save head'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (h) => {
    setToggling(h.id);
    try {
      await api.put(`/finance/heads/${h.id}`, { ...h, is_active: !h.is_active });
      toast.success(h.is_active ? 'Head deactivated' : 'Head activated');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to toggle'));
    } finally {
      setToggling(null);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{heads.length} head{heads.length !== 1 ? 's' : ''}</div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Head</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table width="100%" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Code', 'Name', 'Category', 'Type', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heads.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>No heads yet.</td></tr>
              ) : heads.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--border)', opacity: h.is_active === false ? 0.6 : 1 }}>
                  <td style={{ padding: '11px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent2)', fontWeight: 700 }}>{h.head_code}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>{h.head_name}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>{h.category || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    {DEFAULT_HEADS.includes(h.head_code) && <DefaultBadge />}
                  </td>
                  <td style={{ padding: '11px 14px' }}><ActiveBadge active={h.is_active !== false} /></td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="action-btn" onClick={() => openEdit(h)}><Pencil size={11} /></button>
                      <button
                        className="action-btn"
                        onClick={() => toggleActive(h)}
                        disabled={toggling === h.id}
                        style={{ color: h.is_active !== false ? '#dc2626' : '#16a34a' }}
                      >
                        {toggling === h.id
                          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          : h.is_active !== false ? <ToggleRight size={11} /> : <ToggleLeft size={11} />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editTarget ? 'Edit Account Head' : 'Add Account Head'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Head Code *</label>
                  <input
                    className="form-input"
                    value={form.head_code}
                    onChange={e => set('head_code', e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. SALARY"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Head Name *</label>
                  <input className="form-input" value={form.head_name} onChange={e => set('head_name', e.target.value)} required placeholder="Descriptive name" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Operational, Capital…" />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                {saving ? 'Saving…' : editTarget ? 'Update Head' : 'Create Head'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: Budget Master
// ══════════════════════════════════════════════════════════════════════════════

function BudgetMasterTab() {
  const [fy, setFy] = useState(currentFY());
  const [month, setMonth] = useState(currentMonth());
  const [heads, setHeads] = useState([]);
  const [budgets, setBudgets] = useState({}); // { head_id: { planned_amount, id } }
  const [editing, setEditing] = useState({}); // { head_id: value }
  const [saving, setSaving] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [headsRes, budgetsRes] = await Promise.all([
        api.get('/finance/heads'),
        api.get('/finance/budgets', { params: { fy, month } })
      ]);
      const hList = Array.isArray(headsRes.data) ? headsRes.data : (headsRes.data?.results ?? []);
      setHeads(hList.filter(h => h.is_active !== false));

      const bList = Array.isArray(budgetsRes.data) ? budgetsRes.data : (budgetsRes.data?.results ?? []);
      const bMap = {};
      bList.forEach(b => { bMap[b.account_head_id] = b; });
      setBudgets(bMap);
      setEditing({});
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load budget data'));
    } finally {
      setLoading(false);
    }
  }, [fy, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveRow = async (head) => {
    const val = editing[head.id];
    if (val === undefined) return;
    setSaving(head.id);
    try {
      await api.post('/finance/budgets', {
        account_head_id: head.id,
        fy,
        month: parseInt(month),
        planned_amount: parseFloat(val) || 0
      });
      toast.success(`Budget for ${head.head_name} saved`);
      setBudgets(prev => ({ ...prev, [head.id]: { ...prev[head.id], planned_amount: parseFloat(val) || 0 } }));
      setEditing(prev => { const n = { ...prev }; delete n[head.id]; return n; });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save budget'));
    } finally {
      setSaving(null);
    }
  };

  const total = heads.reduce((sum, h) => {
    const v = editing[h.id] !== undefined ? parseFloat(editing[h.id]) || 0 : (budgets[h.id]?.planned_amount ?? 0);
    return sum + v;
  }, 0);

  const fyOptions = [];
  const base = new Date().getFullYear();
  for (let i = base - 2; i <= base + 1; i++) {
    fyOptions.push(`${i}-${String(i + 1).slice(2)}`);
  }

  return (
    <div>
      {/* FY + Month selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ minWidth: 120 }}>
          <label className="form-label">Financial Year</label>
          <select className="form-select" style={{ height: 36, fontSize: 13 }} value={fy} onChange={e => setFy(e.target.value)}>
            {fyOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 120 }}>
          <label className="form-label">Month</label>
          <select className="form-select" style={{ height: 36, fontSize: 13 }} value={month} onChange={e => setMonth(e.target.value)}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Showing budget for <strong style={{ color: 'var(--text)' }}>{MONTHS[parseInt(month) - 1]} {fy}</strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table width="100%" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)' }}>Account Head</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)' }}>Code</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)' }}>
                  Planned Budget ({MONTHS[parseInt(month) - 1]} {fy})
                </th>
                <th style={{ padding: '10px 16px', width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {heads.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>No active account heads. Add heads in the Account Heads tab.</td></tr>
              ) : heads.map(head => {
                const current = budgets[head.id]?.planned_amount ?? 0;
                const editVal = editing[head.id];
                const isDirty = editVal !== undefined && parseFloat(editVal) !== current;
                return (
                  <tr key={head.id} style={{ borderBottom: '1px solid var(--border)', background: isDirty ? 'rgba(25,84,2,0.03)' : 'transparent' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>{head.head_name}</td>
                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--text3)' }}>{head.head_code}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        style={{ width: 160, textAlign: 'right', height: 34, fontSize: 13, fontWeight: 600 }}
                        value={editVal !== undefined ? editVal : current}
                        onChange={e => setEditing(prev => ({ ...prev, [head.id]: e.target.value }))}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={saving === head.id || !isDirty}
                        onClick={() => saveRow(head)}
                        style={{ opacity: isDirty ? 1 : 0.35 }}
                      >
                        {saving === head.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>Total Budget</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>{INR(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4: Column Mapping
// ══════════════════════════════════════════════════════════════════════════════

function ColumnMappingTab() {
  const [accounts, setAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [heads, setHeads] = useState([]);
  const [rules, setRules] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [deletingRule, setDeletingRule] = useState(null);

  const emptyMapping = {
    date_column: '', description_column: '', debit_column: '',
    credit_column: '', balance_column: '', date_format: '%d/%m/%Y', skip_rows: 0
  };
  const [mapForm, setMapForm] = useState(emptyMapping);

  const emptyRule = { keyword: '', account_head_id: '', bank_specific: false };
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/finance/accounts').catch(() => ({ data: [] })),
      api.get('/finance/heads').catch(() => ({ data: [] })),
    ]).then(([acc, hd]) => {
      const aList = Array.isArray(acc.data) ? acc.data : (acc.data?.results ?? []);
      setAccounts(aList.filter(a => a.is_active !== false));
      setHeads(Array.isArray(hd.data) ? hd.data : (hd.data?.results ?? []));
      if (aList.length > 0) setSelectedBank(String(aList[0].id));
    });
  }, []);

  useEffect(() => {
    if (!selectedBank) return;
    setLoadingMapping(true);
    setLoadingRules(true);
    api.get(`/finance/column-mapping/${selectedBank}`)
      .then(res => {
        const d = res.data || {};
        setMapForm({
          date_column: d.date_column || '',
          description_column: d.description_column || '',
          debit_column: d.debit_column || '',
          credit_column: d.credit_column || '',
          balance_column: d.balance_column || '',
          date_format: d.date_format || '%d/%m/%Y',
          skip_rows: d.skip_rows ?? 0
        });
        setMapping(d);
      })
      .catch(() => { setMapForm(emptyMapping); setMapping(null); })
      .finally(() => setLoadingMapping(false));

    api.get('/finance/mapping-rules', { params: { bank_id: selectedBank } })
      .then(res => setRules(Array.isArray(res.data) ? res.data : (res.data?.results ?? [])))
      .catch(() => setRules([]))
      .finally(() => setLoadingRules(false));
  }, [selectedBank]);

  const setM = (k, v) => setMapForm(f => ({ ...f, [k]: v }));
  const setR = (k, v) => setRuleForm(f => ({ ...f, [k]: v }));

  const saveMapping = async (e) => {
    e.preventDefault();
    if (!selectedBank) return;
    setSavingMapping(true);
    try {
      await api.post('/finance/column-mapping', { bank_id: parseInt(selectedBank), ...mapForm, skip_rows: parseInt(mapForm.skip_rows) || 0 });
      toast.success('Column mapping saved');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save mapping'));
    } finally {
      setSavingMapping(false);
    }
  };

  const addRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.keyword || !ruleForm.account_head_id) {
      toast.error('Keyword and account head are required');
      return;
    }
    setSavingRule(true);
    try {
      await api.post('/finance/mapping-rules', {
        bank_id: parseInt(selectedBank),
        keyword: ruleForm.keyword,
        account_head_id: parseInt(ruleForm.account_head_id),
        bank_specific: ruleForm.bank_specific
      });
      toast.success('Rule added');
      setRuleForm(emptyRule);
      const res = await api.get('/finance/mapping-rules', { params: { bank_id: selectedBank } });
      setRules(Array.isArray(res.data) ? res.data : (res.data?.results ?? []));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add rule'));
    } finally {
      setSavingRule(false);
    }
  };

  const deleteRule = async (ruleId) => {
    setDeletingRule(ruleId);
    try {
      await api.delete(`/finance/mapping-rules/${ruleId}`);
      toast.success('Rule deleted');
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete rule'));
    } finally {
      setDeletingRule(null);
    }
  };

  const inputField = (label, key, type = 'text', placeholder = '', helper = null) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        className="form-input"
        type={type}
        value={mapForm[key]}
        onChange={e => setM(key, e.target.value)}
        placeholder={placeholder}
      />
      {helper && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{helper}</div>}
    </div>
  );

  return (
    <div>
      {/* Bank selector */}
      <div style={{ marginBottom: 20 }}>
        <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Select Bank</label>
        <select
          className="form-select"
          style={{ maxWidth: 280, height: 38, fontSize: 13 }}
          value={selectedBank}
          onChange={e => setSelectedBank(e.target.value)}
        >
          <option value="">Select a bank…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
        </select>
      </div>

      {!selectedBank ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
          <Settings2 size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
          Select a bank to configure column mapping
        </div>
      ) : loadingMapping ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          {/* Column Mapping Form */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} style={{ color: 'var(--accent)' }} /> CSV / Excel Column Mapping
            </div>
            <form onSubmit={saveMapping}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {inputField('Date Column Name', 'date_column', 'text', 'e.g. Date')}
                {inputField('Description Column Name', 'description_column', 'text', 'e.g. Description')}
                {inputField('Debit Column Name', 'debit_column', 'text', 'e.g. Withdrawal Amt.')}
                {inputField('Credit Column Name', 'credit_column', 'text', 'e.g. Deposit Amt.')}
                {inputField('Balance Column Name', 'balance_column', 'text', 'e.g. Closing Balance')}
                <div className="form-group">
                  <label className="form-label">Date Format</label>
                  <input
                    className="form-input"
                    type="text"
                    value={mapForm.date_format}
                    onChange={e => setM('date_format', e.target.value)}
                    placeholder="%d/%m/%Y"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                    dd/mm/yyyy = %d/%m/%Y &nbsp;·&nbsp; mm-dd-yyyy = %m-%d-%Y
                  </div>
                </div>
              </div>
              <div style={{ maxWidth: 160, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Skip Rows (Header)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={mapForm.skip_rows}
                    onChange={e => setM('skip_rows', e.target.value)}
                    style={{ height: 36 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingMapping}>
                  {savingMapping ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                  {savingMapping ? 'Saving…' : 'Save Mapping'}
                </button>
              </div>
            </form>
          </div>

          {/* Mapping Rules */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag size={14} style={{ color: 'var(--accent)' }} /> Auto-Classification Rules
            </div>

            {/* Add rule form */}
            <form onSubmit={addRule} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', padding: '14px', background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
              <div className="form-group" style={{ flex: '1 1 160px' }}>
                <label className="form-label">Keyword *</label>
                <input className="form-input" placeholder="e.g. SALARY, RENT…" value={ruleForm.keyword} onChange={e => setR('keyword', e.target.value)} style={{ height: 36 }} />
              </div>
              <div className="form-group" style={{ flex: '1 1 180px' }}>
                <label className="form-label">Account Head *</label>
                <select className="form-select" value={ruleForm.account_head_id} onChange={e => setR('account_head_id', e.target.value)} style={{ height: 36, fontSize: 13 }}>
                  <option value="">Select head…</option>
                  {heads.map(h => <option key={h.id} value={h.id}>{h.head_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
                <input
                  type="checkbox"
                  id="bank_specific"
                  checked={ruleForm.bank_specific}
                  onChange={e => setR('bank_specific', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="bank_specific" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>Bank-specific</label>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ height: 36 }} disabled={savingRule}>
                {savingRule ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                Add Rule
              </button>
            </form>

            {/* Rules list */}
            {loadingRules ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
              </div>
            ) : rules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                No classification rules yet. Add one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rules.map(rule => (
                  <div key={rule.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)'
                  }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700,
                      color: 'var(--accent2)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 5
                    }}>
                      {rule.keyword}
                    </div>
                    <ChevronDown size={13} style={{ color: 'var(--text3)', transform: 'rotate(-90deg)', flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                      {rule.account_head_name || `Head #${rule.account_head_id}`}
                    </div>
                    {rule.bank_specific && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.2)' }}>
                        Bank-specific
                      </span>
                    )}
                    <button
                      onClick={() => deleteRule(rule.id)}
                      disabled={deletingRule === rule.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center', opacity: deletingRule === rule.id ? 0.5 : 1 }}
                      title="Delete rule"
                    >
                      {deletingRule === rule.id ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Config Page
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'accounts', label: 'Bank Accounts', icon: Building2 },
  { id: 'heads',    label: 'Account Heads', icon: Tag },
  { id: 'budget',   label: 'Budget Master', icon: BarChart2 },
  { id: 'mapping',  label: 'Column Mapping', icon: Settings2 },
];

export default function FinanceConfig() {
  const [activeTab, setActiveTab] = useState('accounts');

  return (
    <Layout title="Finance Config">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .action-btn { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 4px; transition: all 0.14s; }
        .action-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .config-tab-btn { display: flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 8px; border: none; background: transparent; font-size: 13.5px; font-weight: 600; cursor: pointer; color: var(--text2); font-family: inherit; transition: all 0.15s; white-space: nowrap; }
        .config-tab-btn:hover { background: var(--bg3); color: var(--text); }
        .config-tab-btn.active { background: var(--accent-dim); color: var(--accent); }
        .config-tab-btn svg { flex-shrink: 0; }
      `}</style>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left nav */}
        <div style={{
          width: 196, flexShrink: 0, background: 'var(--bg2)',
          border: '1px solid var(--border)', borderRadius: 12,
          padding: 10, display: 'flex', flexDirection: 'column', gap: 2,
          alignSelf: 'flex-start', position: 'sticky', top: 0
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text3)', padding: '4px 8px 8px' }}>
            Configuration
          </div>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`config-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24
          }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                {activeTab === 'accounts' && 'Manage bank accounts, lien amounts, and account details'}
                {activeTab === 'heads' && 'Manage account heads for transaction classification'}
                {activeTab === 'budget' && 'Set monthly planned budgets per account head'}
                {activeTab === 'mapping' && 'Configure CSV/Excel column mappings and auto-classification rules per bank'}
              </div>
            </div>

            {activeTab === 'accounts' && <BankAccountsTab />}
            {activeTab === 'heads' && <AccountHeadsTab />}
            {activeTab === 'budget' && <BudgetMasterTab />}
            {activeTab === 'mapping' && <ColumnMappingTab />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
