import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import {
  Upload, FileText, CheckCircle2, AlertCircle, ChevronRight,
  ChevronLeft, X, Filter, RotateCcw, ArrowRight, Loader2,
  CloudUpload, Receipt, Building2, Check, Info
} from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const STEPS = [
  { label: 'Upload', icon: CloudUpload },
  { label: 'Review & Map', icon: FileText },
  { label: 'Confirm & Post', icon: CheckCircle2 },
];

export default function FinanceImport() {
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [heads, setHeads] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [rows, setRows] = useState([]);
  const [filterUnmapped, setFilterUnmapped] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [postError, setPostError] = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    api.get('/api/finance/accounts').then(r => setAccounts(r.data || [])).catch(() => {});
    api.get('/api/finance/heads').then(r => setHeads(r.data || [])).catch(() => {});
  }, []);

  // Drag & drop handlers
  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedAccount || !file) return;
    setUploading(true); setUploadError('');
    try {
      const fd = new FormData();
      fd.append('bank_account_id', selectedAccount);
      fd.append('file', file);
      const res = await api.post('/api/finance/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      setPreviewData(data);
      // Initialize rows with saveRule and headId state
      setRows((data.rows || []).map(row => ({
        ...row,
        headId: row.account_head_id || '',
        saveRule: false,
      })));
      setStep(1);
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const autoMapped = rows.filter(r => r.transaction_type === 'DEBIT' && r.auto_mapped).length;
  const needMapping = rows.filter(r => r.transaction_type === 'DEBIT' && !r.auto_mapped).length;
  const credits = rows.filter(r => r.transaction_type === 'CREDIT').length;
  const unmappedDebit = rows.filter(r => r.transaction_type === 'DEBIT' && !r.headId).length;
  const saveRuleRows = rows.filter(r => r.saveRule);
  const displayRows = filterUnmapped ? rows.filter(r => r.transaction_type === 'DEBIT' && !r.headId) : rows;

  const handleHeadChange = (idx, val) => {
    const globalIdx = rows.indexOf(displayRows[idx]);
    setRows(prev => {
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], headId: val };
      return next;
    });
  };
  const handleSaveRuleChange = (idx, val) => {
    const globalIdx = rows.indexOf(displayRows[idx]);
    setRows(prev => {
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], saveRule: val };
      return next;
    });
  };

  const handlePost = async () => {
    setPosting(true); setPostError('');
    try {
      const payload = {
        bank_account_id: Number(selectedAccount),
        filename: previewData?.filename,
        rows: rows.map(r => ({
          transaction_date: r.transaction_date,
          description: r.description,
          debit_amount: r.debit_amount,
          credit_amount: r.credit_amount,
          balance: r.balance,
          transaction_type: r.transaction_type,
          account_head_id: r.headId ? Number(r.headId) : null,
        })),
      };
      const res = await api.post('/api/finance/import/post', payload);
      // Save mapping rules
      for (const row of saveRuleRows) {
        if (row.headId) {
          try {
            await api.post('/api/finance/mapping-rules', {
              description_keyword: row.description,
              account_head_id: Number(row.headId),
            });
          } catch (_) {}
        }
      }
      setPostResult(res.data);
    } catch (err) {
      setPostError(err?.response?.data?.message || 'Post failed. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const resetWizard = () => {
    setStep(0); setFile(null); setSelectedAccount('');
    setPreviewData(null); setRows([]); setPostResult(null); setPostError('');
    setUploadError(''); setFilterUnmapped(false);
  };

  const s = {
    page: { minHeight: '100vh', padding: '0' },
    stepper: {
      display: 'flex', alignItems: 'center', gap: '0',
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      padding: '0 32px',
    },
    stepItem: (active, done) => ({
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '18px 24px 18px 0',
      opacity: done || active ? 1 : 0.45,
      cursor: done ? 'pointer' : 'default',
      position: 'relative',
    }),
    stepDot: (active, done) => ({
      width: 32, height: 32, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: done ? 'var(--accent)' : active ? 'var(--accent2)' : 'var(--bg3)',
      color: done || active ? '#fff' : 'var(--text3)',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
      border: active ? '2px solid var(--accent)' : '2px solid transparent',
      transition: 'all .2s',
    }),
    stepLabel: (active) => ({
      fontSize: 14, fontWeight: active ? 700 : 500,
      color: active ? 'var(--accent)' : 'var(--text2)',
    }),
    stepArrow: { color: 'var(--border)', margin: '0 8px' },
    body: { padding: '32px' },
    card: {
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '28px',
      marginBottom: 24, boxShadow: 'var(--shadow)',
    },
    label: { fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block' },
    select: {
      width: '100%', padding: '10px 14px', borderRadius: 8,
      border: '1px solid var(--border)', background: 'var(--bg3)',
      color: 'var(--text)', fontSize: 14, outline: 'none',
      appearance: 'none', cursor: 'pointer',
    },
    dropzone: (dragging) => ({
      border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 12, padding: '40px 24px',
      textAlign: 'center', cursor: 'pointer',
      background: dragging ? 'rgba(25,84,2,0.06)' : 'var(--bg3)',
      transition: 'all .2s', marginTop: 16,
    }),
    btn: (variant = 'primary', disabled = false) => ({
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '10px 22px', borderRadius: 8, border: 'none',
      fontWeight: 600, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'all .15s',
      background: variant === 'primary' ? 'var(--accent)' :
                  variant === 'secondary' ? 'var(--bg3)' : 'transparent',
      color: variant === 'primary' ? '#fff' : 'var(--text)',
      border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      padding: '10px 12px', textAlign: 'left', fontWeight: 600,
      color: 'var(--text2)', borderBottom: '2px solid var(--border)',
      background: 'var(--bg3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em',
    },
    td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)', verticalAlign: 'middle' },
    badge: (color) => ({
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color === 'green' ? 'rgba(25,84,2,0.12)' :
                  color === 'orange' ? 'rgba(245,158,11,0.12)' :
                  color === 'blue' ? 'rgba(59,130,246,0.12)' : 'rgba(107,114,128,0.12)',
      color: color === 'green' ? 'var(--accent)' :
             color === 'orange' ? '#d97706' :
             color === 'blue' ? '#3b82f6' : 'var(--text3)',
    }),
    summaryCard: (color) => ({
      flex: 1, background: 'var(--bg3)', borderRadius: 10,
      padding: '16px 20px', border: `1px solid ${
        color === 'green' ? 'rgba(25,84,2,0.2)' :
        color === 'orange' ? 'rgba(245,158,11,0.2)' : 'var(--border)'
      }`,
    }),
    error: {
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 8, padding: '12px 16px', color: '#ef4444',
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16,
    },
    infoRow: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  };

  const headName = (id) => {
    const h = heads.find(h => String(h.id) === String(id));
    return h ? h.name : '';
  };

  if (postResult) {
    return (
      <Layout title="Bank Statement Import">
        <div style={{ padding: 32, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 32px', boxShadow: 'var(--shadow)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(25,84,2,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={36} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Import Successful!</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 24, fontSize: 15 }}>
              <strong style={{ color: 'var(--accent)' }}>{postResult.posted ?? postResult.transactions_posted ?? 0}</strong> transactions posted
              {(postResult.duplicates_skipped ?? postResult.skipped) > 0 && (
                <>, <strong style={{ color: '#d97706' }}>{postResult.duplicates_skipped ?? postResult.skipped}</strong> duplicates skipped</>
              )}
            </p>
            {saveRuleRows.length > 0 && (
              <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>
                {saveRuleRows.length} mapping rule{saveRuleRows.length > 1 ? 's' : ''} saved.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={s.btn('secondary')} onClick={() => window.location.href = '/finance/transactions'}>
                <Receipt size={15} /> View Transactions
              </button>
              <button style={s.btn()} onClick={resetWizard}>
                <CloudUpload size={15} /> Import Another
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Bank Statement Import">
      <div style={s.page}>
        {/* Step Indicator */}
        <div style={s.stepper}>
          {STEPS.map((st, i) => {
            const done = step > i;
            const active = step === i;
            const Icon = st.icon;
            return (
              <React.Fragment key={i}>
                <div style={s.stepItem(active, done)} onClick={() => done && setStep(i)}>
                  <div style={s.stepDot(active, done)}>
                    {done ? <Check size={15} /> : <Icon size={15} />}
                  </div>
                  <span style={s.stepLabel(active)}>{st.label}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={16} style={s.stepArrow} />}
              </React.Fragment>
            );
          })}
        </div>

        <div style={s.body}>
          {/* STEP 0 */}
          {step === 0 && (
            <div style={{ maxWidth: 600 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Upload Bank Statement</h2>
              <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 24 }}>Select your bank and upload a CSV or Excel file to begin.</p>

              {uploadError && (
                <div style={s.error}><AlertCircle size={16} />{uploadError}</div>
              )}

              <div style={s.card}>
                <label style={s.label}>Select Bank Account</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <select
                    style={{ ...s.select, paddingLeft: 36 }}
                    value={selectedAccount}
                    onChange={e => setSelectedAccount(e.target.value)}
                  >
                    <option value="">— Select bank account —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</option>
                    ))}
                  </select>
                </div>

                <div
                  style={s.dropzone(dragging)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                      <FileText size={22} color="var(--accent)" />
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text)', margin: 0 }}>{file.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', marginLeft: 8 }}
                        onClick={e => { e.stopPropagation(); setFile(null); }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <CloudUpload size={36} color="var(--text3)" style={{ marginBottom: 10 }} />
                      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Drag & drop your file here</p>
                      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 0 }}>or click to browse — supports .csv, .xlsx, .xls</p>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  style={s.btn('primary', !selectedAccount || !file || uploading)}
                  disabled={!selectedAccount || !file || uploading}
                  onClick={handleUpload}
                >
                  {uploading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
                  {uploading ? 'Parsing...' : 'Upload & Preview'}
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && previewData && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Review & Map Transactions</h2>
                  <p style={{ color: 'var(--text3)', fontSize: 14 }}>File: <strong>{previewData.filename}</strong></p>
                </div>
                <button
                  style={{ ...s.btn('secondary'), gap: 6 }}
                  onClick={() => setFilterUnmapped(f => !f)}
                >
                  <Filter size={14} />
                  {filterUnmapped ? 'Show All' : 'Show Unmapped Only'}
                  {!filterUnmapped && needMapping > 0 && (
                    <span style={{ background: '#d97706', color: '#fff', borderRadius: 20, fontSize: 11, padding: '1px 7px' }}>{needMapping}</span>
                  )}
                </button>
              </div>

              {/* Summary row */}
              <div style={s.infoRow}>
                <div style={s.summaryCard()}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Total Rows</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{rows.length}</p>
                </div>
                <div style={s.summaryCard('green')}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Auto-Mapped</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{autoMapped}</p>
                </div>
                <div style={s.summaryCard('orange')}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Need Mapping</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#d97706', margin: 0 }}>{needMapping}</p>
                </div>
                <div style={s.summaryCard()}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Credits</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{credits}</p>
                </div>
              </div>

              <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Type', 'Account Head'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row, i) => {
                        const isCredit = row.transaction_type === 'CREDIT';
                        const isAutoMapped = row.auto_mapped;
                        const needsHead = !isCredit && !row.headId;
                        return (
                          <React.Fragment key={i}>
                            <tr style={{ background: needsHead ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                              <td style={s.td}>{row.transaction_date}</td>
                              <td style={{ ...s.td, maxWidth: 200 }}>
                                <span style={{ fontSize: 13, color: 'var(--text)' }}>{row.description}</span>
                              </td>
                              <td style={s.td}>
                                {row.debit_amount > 0 ? <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(row.debit_amount)}</span> : '—'}
                              </td>
                              <td style={s.td}>
                                {row.credit_amount > 0 ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(row.credit_amount)}</span> : '—'}
                              </td>
                              <td style={s.td}>{fmt(row.balance)}</td>
                              <td style={s.td}>
                                <span style={s.badge(isCredit ? 'blue' : 'orange')}>
                                  {isCredit ? 'CREDIT' : 'DEBIT'}
                                </span>
                              </td>
                              <td style={s.td}>
                                {isCredit ? (
                                  <span style={s.badge('blue')}>RECEIPT</span>
                                ) : isAutoMapped && !row.headId ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
                                    <CheckCircle2 size={13} /> {headName(row.account_head_id)}
                                  </span>
                                ) : row.headId ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
                                    <CheckCircle2 size={13} /> {headName(row.headId)}
                                  </span>
                                ) : (
                                  <select
                                    style={{ ...s.select, width: 180, padding: '6px 10px', fontSize: 12 }}
                                    value={row.headId || ''}
                                    onChange={e => {
                                      const globalIdx = rows.indexOf(displayRows[i]);
                                      setRows(prev => {
                                        const next = [...prev];
                                        next[globalIdx] = { ...next[globalIdx], headId: e.target.value };
                                        return next;
                                      });
                                    }}
                                  >
                                    <option value="">— Select head —</option>
                                    {heads.map(h => (
                                      <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            </tr>
                            {!isCredit && !isAutoMapped && (
                              <tr style={{ background: 'rgba(245,158,11,0.04)' }}>
                                <td colSpan={7} style={{ ...s.td, paddingTop: 4, paddingBottom: 10, borderBottom: '2px solid var(--border)' }}>
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={row.saveRule}
                                      onChange={e => {
                                        const globalIdx = rows.indexOf(displayRows[i]);
                                        setRows(prev => {
                                          const next = [...prev];
                                          next[globalIdx] = { ...next[globalIdx], saveRule: e.target.checked };
                                          return next;
                                        });
                                      }}
                                      style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                                    />
                                    Save rule: always map &ldquo;<em>{row.description}</em>&rdquo; to this head
                                  </label>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button style={s.btn('secondary')} onClick={() => setStep(0)}>
                  <ChevronLeft size={15} /> Back
                </button>
                <button style={s.btn()} onClick={() => setStep(2)}>
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div style={{ maxWidth: 700 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Confirm & Post</h2>
              <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 24 }}>Review the import summary before posting to the ledger.</p>

              {postError && (
                <div style={s.error}><AlertCircle size={16} />{postError}</div>
              )}

              {unmappedDebit > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, color: '#d97706', fontSize: 13 }}>
                  <AlertCircle size={16} />
                  <strong>{unmappedDebit}</strong> debit row{unmappedDebit > 1 ? 's are' : ' is'} still missing an account head assignment.
                </div>
              )}

              {/* Summary */}
              <div style={s.card}>
                <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 14, fontSize: 15 }}>Import Summary</p>
                <table style={{ ...s.table, fontSize: 14 }}>
                  <tbody>
                    {[
                      ['Total Rows', rows.length],
                      ['Debit Rows', rows.filter(r => r.transaction_type === 'DEBIT').length],
                      ['Credit Rows', credits],
                      ['Rows Missing Account Head', unmappedDebit],
                    ].map(([label, val]) => (
                      <tr key={label}>
                        <td style={{ ...s.td, color: 'var(--text2)', width: '60%' }}>{label}</td>
                        <td style={{ ...s.td, fontWeight: 700, color: val > 0 && label.includes('Missing') ? '#d97706' : 'var(--text)' }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mapping rules */}
              {saveRuleRows.length > 0 && (
                <div style={s.card}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 12, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Info size={15} color="var(--accent)" /> Mapping Rules to Save ({saveRuleRows.length})
                  </p>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Description Keyword</th>
                        <th style={s.th}>Account Head</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saveRuleRows.map((r, i) => (
                        <tr key={i}>
                          <td style={s.td}><em>{r.description}</em></td>
                          <td style={{ ...s.td, color: 'var(--accent)', fontWeight: 600 }}>{headName(r.headId)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button style={s.btn('secondary')} onClick={() => setStep(1)}>
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  style={s.btn('primary', posting)}
                  disabled={posting}
                  onClick={handlePost}
                >
                  {posting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={15} />}
                  {posting ? 'Posting...' : 'Post All Transactions'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}
