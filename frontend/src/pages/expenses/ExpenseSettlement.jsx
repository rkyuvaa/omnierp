import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Paperclip,
  Upload,
  X,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Percent,
  TrendingUp,
  Wallet,
  TrendingDown,
  Info,
} from 'lucide-react';

const INR = v =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

const cellHeaderStyle = {
  padding: '10px 8px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text3)',
  background: 'var(--bg3)',
  whiteSpace: 'nowrap',
};

export default function ExpenseSettlement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const [advance, setAdvance] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState([]);
  const [uploadRowIndex, setUploadRowIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdvanceDetails();
    api.get('/expenses/categories').then(r => setCategories(r.data)).catch(() => {});
  }, [id]);

  async function fetchAdvanceDetails() {
    setLoading(true);
    try {
      const r = await api.get(`/expenses/advances/${id}`);
      setAdvance(r.data);
      if (r.data.lines && r.data.lines.length > 0) {
        setLines(r.data.lines);
      } else {
        // Initialize with one blank row
        setLines([createBlankRow()]);
      }
    } catch {
      toast.error('Failed to load advance details');
    } finally {
      setLoading(false);
    }
  }

  function createBlankRow() {
    return {
      date: new Date().toISOString().split('T')[0],
      expense_type: '',
      cost_code: '',
      cost_to: '',
      from_location: '',
      to_location: '',
      description: '',
      paid_to: '',
      gst_rate: 0,
      amount: 0,
      bill_attachments: [],
    };
  }

  function addRow() {
    setLines([...lines, createBlankRow()]);
  }

  function deleteRow(index) {
    if (lines.length === 1) {
      setLines([createBlankRow()]);
    } else {
      setLines(lines.filter((_, idx) => idx !== index));
    }
  }

  function updateRowField(index, field, value) {
    setLines(prev =>
      prev.map((row, idx) => {
        if (idx === index) {
          let parsedValue = value;
          if (field === 'gst_rate' || field === 'amount') {
            parsedValue = parseFloat(value) || 0;
          }
          return { ...row, [field]: parsedValue };
        }
        return row;
      })
    );
  }

  function triggerUpload(index) {
    setUploadRowIndex(index);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || uploadRowIndex === null) return;

    const fd = new FormData();
    fd.append('file', file);

    const toastId = toast.loading('Uploading bill...');
    try {
      const r = await api.post('/expenses/upload-receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newFilename = r.data.filename;

      setLines(prev =>
        prev.map((row, idx) => {
          if (idx === uploadRowIndex) {
            return {
              ...row,
              bill_attachments: [...(row.bill_attachments || []), newFilename],
            };
          }
          return row;
        })
      );
      toast.success('Bill uploaded successfully', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadRowIndex(null);
    }
  }

  function removeAttachment(rowIndex, fileIndex) {
    setLines(prev =>
      prev.map((row, idx) => {
        if (idx === rowIndex) {
          return {
            ...row,
            bill_attachments: row.bill_attachments.filter((_, fIdx) => fIdx !== fileIndex),
          };
        }
        return row;
      })
    );
    toast.success('Attachment removed');
  }

  async function handleSaveOrSubmit(isSubmit) {
    // Validate lines
    const validLines = lines.filter(l => l.amount > 0 && l.expense_type);
    if (isSubmit && validLines.length === 0) {
      toast.error('Please add at least one line item with category and amount');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        lines: validLines.map(l => ({
          date: l.date,
          expense_type: l.expense_type,
          cost_code: l.cost_code || null,
          cost_to: l.cost_to || null,
          from_location: l.from_location || null,
          to_location: l.to_location || null,
          description: l.description || null,
          paid_to: l.paid_to || null,
          gst_rate: l.gst_rate || 0,
          amount: l.amount,
          bill_attachments: l.bill_attachments || [],
        })),
        is_submit: isSubmit,
      };

      await api.post(`/expenses/advances/${id}/settle`, payload);
      toast.success(isSubmit ? 'Settlement sheet submitted successfully!' : 'Draft settlement saved!');
      fetchAdvanceDetails();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settlement');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout title="Expense Settlement">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading details...</div>
      </Layout>
    );
  }

  if (!advance) {
    return (
      <Layout title="Expense Settlement">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Advance Request not found.</div>
      </Layout>
    );
  }

  // Math calculations
  const approvedAmount = advance.amount || 0;
  const claimedAmount = lines.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const netBalance = approvedAmount - claimedAmount;
  const excessAmount = claimedAmount > approvedAmount ? claimedAmount - approvedAmount : 0;

  // Check read-only state
  // Only editable if status is approved (no settlement submitted yet) or settlement_pending
  const isReadOnly = !['approved', 'settlement_pending'].includes(advance.status);

  return (
    <Layout title={`Settlement: ${advance.reference || `Draft Request #${advance.id}`}`}>
      <div style={{ padding: '0 24px 24px' }}>
        {/* Back and Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => navigate('/expenses/my')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ flex: 1 }} />
          {!isReadOnly && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleSaveOrSubmit(false)}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Save size={14} /> Save Draft
              </button>
              <button
                onClick={() => handleSaveOrSubmit(true)}
                disabled={saving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <Send size={14} /> Submit Settlement
              </button>
            </div>
          )}
        </div>

        {/* Top Summary Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Card 1: Approved Advance */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Approved Advance</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{INR(approvedAmount)}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#3b82f615', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
              <Wallet size={16} />
            </div>
          </div>

          {/* Card 2: Total Claimed */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Claimed Expenses</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{INR(claimedAmount)}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent)15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <TrendingUp size={16} />
            </div>
          </div>

          {/* Card 3: Remaining / Excess Balance */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {excessAmount > 0 ? 'Excess Amount (Claim)' : 'Remaining Balance (Return)'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: excessAmount > 0 ? '#ef4444' : '#22c55e' }}>
                {excessAmount > 0 ? INR(excessAmount) : INR(netBalance)}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: excessAmount > 0 ? '#ef444415' : '#22c55e15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: excessAmount > 0 ? '#ef4444' : '#22c55e' }}>
              {excessAmount > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
          </div>

          {/* Card 4: Settlement Status */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Settlement Status</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
                {advance.status.replace('_', ' ')}
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: isReadOnly ? '#10b98115' : '#f59e0b15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isReadOnly ? '#10b981' : '#f59e0b' }}>
              <CheckCircle size={16} />
            </div>
          </div>
        </div>

        {/* Manager Review Status Alert */}
        {(advance.l1_remarks || advance.l2_remarks) && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)' }}>
              <Info size={14} style={{ color: 'var(--accent)' }} /> Manager Review Log
            </h4>
            {advance.l1_remarks && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                <strong>L1 Approver Remarks:</strong> {advance.l1_remarks} <span style={{ color: 'var(--text3)', fontSize: 11 }}>({advance.l1_status})</span>
              </div>
            )}
            {advance.l2_remarks && (
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                <strong>L2 Approver Remarks:</strong> {advance.l2_remarks} <span style={{ color: 'var(--text3)', fontSize: 11 }}>({advance.l2_status})</span>
              </div>
            )}
          </div>
        )}

        {/* Settlement Grid Sheet */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {/* Headers */}
                  <th style={{ ...cellHeaderStyle, width: 110 }}>Date *</th>
                  <th style={{ ...cellHeaderStyle, width: 120 }}>Expense Type *</th>
                  <th style={{ ...cellHeaderStyle, width: 90 }}>Cost Code</th>
                  <th style={{ ...cellHeaderStyle, width: 100 }}>Cost To</th>
                  <th style={{ ...cellHeaderStyle, width: 100 }}>From Location</th>
                  <th style={{ ...cellHeaderStyle, width: 100 }}>To Location</th>
                  <th style={{ ...cellHeaderStyle, width: 150 }}>Description</th>
                  <th style={{ ...cellHeaderStyle, width: 100 }}>Paid To</th>
                  <th style={{ ...cellHeaderStyle, width: 70 }}>GST %</th>
                  <th style={{ ...cellHeaderStyle, width: 100 }}>Amount (Rs) *</th>
                  <th style={{ ...cellHeaderStyle, width: 220 }}>Bill Attachments</th>
                  {!isReadOnly && <th style={{ ...cellHeaderStyle, width: 50, textAlign: 'center' }}></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((row, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                    {/* Date */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="date"
                        value={row.date}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'date', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* Expense Type / Category */}
                    <td style={{ padding: '8px' }}>
                      <select
                        value={row.expense_type}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'expense_type', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Cost Code */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        placeholder="Cost Code"
                        value={row.cost_code || ''}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'cost_code', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* Cost To */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        placeholder="e.g. Project/Client"
                        value={row.cost_to || ''}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'cost_to', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* From Location */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        placeholder="From"
                        value={row.from_location || ''}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'from_location', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* To Location */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        placeholder="To"
                        value={row.to_location || ''}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'to_location', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* Description */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        placeholder="Remarks/details"
                        value={row.description || ''}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'description', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* Paid To */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        placeholder="Vendor/Merchant"
                        value={row.paid_to || ''}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'paid_to', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* GST % */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={row.gst_rate}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'gst_rate', e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={row.amount}
                        disabled={isReadOnly}
                        onChange={e => updateRowField(idx, 'amount', e.target.value)}
                        style={{ ...inputStyle, fontWeight: 700 }}
                      />
                    </td>

                    {/* Bill Attachments */}
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* List current attachments */}
                        {row.bill_attachments && row.bill_attachments.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--bg3)',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: 11,
                              border: '1px solid var(--border)',
                              gap: 6,
                            }}
                          >
                            <a
                              href={`/api/uploads/expenses/${file}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: 'var(--accent)',
                                textDecoration: 'none',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                flex: 1,
                              }}
                            >
                              <Paperclip size={11} /> Bill {fIdx + 1}
                            </a>
                            {!isReadOnly && (
                              <button
                                onClick={() => removeAttachment(idx, fIdx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Upload trigger */}
                        {!isReadOnly && (
                          <button
                            onClick={() => triggerUpload(idx)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px dashed var(--border)',
                              background: 'transparent',
                              color: 'var(--text3)',
                              cursor: 'pointer',
                              fontSize: 11,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--accent)';
                              e.currentTarget.style.color = 'var(--text2)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.color = 'var(--text3)';
                            }}
                          >
                            <Upload size={11} /> Add Bill
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Delete button */}
                    {!isReadOnly && (
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => deleteRow(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            opacity: 0.7,
                            transition: 'opacity 0.15s',
                            padding: 4,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = 1)}
                          onMouseLeave={e => (e.currentTarget.style.opacity = 0.7)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Button under table */}
          {!isReadOnly && (
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg3)30' }}>
              <button
                onClick={addRow}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
              >
                <Plus size={14} /> Add Line Item
              </button>
            </div>
          )}
        </div>

        {/* Instructions Alert for Users */}
        {!isReadOnly && (
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <AlertCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text2)' }}>Note on Settlement Submission:</strong>
              <br />
              All rows with a valid <strong>Amount</strong> greater than zero and an <strong>Expense Type</strong> selected will be saved/submitted. You can upload multiple supporting bills (receipt images, PDF, Word, Excel, or Zip) per line item. Saving as draft lets you edit later. Submitting will lock the sheet for manager review.
            </div>
          </div>
        )}

        {/* Hidden File Input for dynamic uploading */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </Layout>
  );
}
