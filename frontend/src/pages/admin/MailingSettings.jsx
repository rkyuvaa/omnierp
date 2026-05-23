import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Mail, Settings, Save, Send, AlertTriangle, Info, Eye, EyeOff, FileText, CheckCircle2 } from 'lucide-react';

const TEMPLATE_INFO = {
  payslip_notification: {
    label: "Salary Payslip Send Out",
    description: "Dispatched when monthly employee payroll payslips are issued.",
    placeholders: [
      { name: "{employee_name}", desc: "Full name of the employee" },
      { name: "{month}", desc: "Issue month (e.g. May)" },
      { name: "{year}", desc: "Issue year (e.g. 2026)" },
      { name: "{net_salary}", desc: "Calculated net payout (e.g. 45,000.00)" }
    ]
  },
  leave_status_update: {
    label: "Leave Request Status Change",
    description: "Dispatched automatically when a leave request is approved or rejected.",
    placeholders: [
      { name: "{employee_name}", desc: "Full name of the employee" },
      { name: "{leave_type}", desc: "Leave category (e.g. Sick Leave)" },
      { name: "{from_date}", desc: "Leave starting date (e.g. 2026-05-24)" },
      { name: "{to_date}", desc: "Leave ending date (e.g. 2026-05-26)" },
      { name: "{status}", desc: "New state: approved or rejected" },
      { name: "{approver_name}", desc: "Name of the approving HR/Manager" },
      { name: "{reason}", desc: "HR Approval/Rejection remarks" }
    ]
  },
  onduty_status_update: {
    label: "On-Duty Request Status Change",
    description: "Dispatched automatically when an On-Duty request is approved or rejected.",
    placeholders: [
      { name: "{employee_name}", desc: "Full name of the employee" },
      { name: "{date}", desc: "Request date (e.g. 2026-05-24)" },
      { name: "{status}", desc: "New state: approved or rejected" },
      { name: "{approver_name}", desc: "Name of the approving HR/Manager" },
      { name: "{reason}", desc: "HR Approval/Rejection remarks" }
    ]
  }
};

export default function MailingSettings() {
  const [activeTab, setActiveTab] = useState('smtp'); // 'smtp' or 'templates'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // SMTP settings state
  const [smtp, setSmtp] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    sender_email: '',
    sender_name: '',
    use_tls: true,
    use_ssl: false,
    password_configured: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('payslip_notification');
  const [tplForm, setTplForm] = useState({
    subject: '',
    body_html: ''
  });

  useEffect(() => {
    fetchSmtpSettings();
    fetchTemplates();
  }, []);

  async function fetchSmtpSettings() {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings/settings');
      setSmtp({
        ...res.data,
        password: res.data.password_configured ? '******' : ''
      });
    } catch {
      toast.error('Failed to load SMTP configurations');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await api.get('/admin/settings/templates');
      setTemplates(res.data);
      // Load first template details
      const defaultTpl = res.data.find(t => t.name === selectedTemplateName);
      if (defaultTpl) {
        setTplForm({
          subject: defaultTpl.subject,
          body_html: defaultTpl.body_html
        });
      }
    } catch {
      toast.error('Failed to load email templates');
    }
  }

  const handleTemplateChange = (name) => {
    setSelectedTemplateName(name);
    const selected = templates.find(t => t.name === name);
    if (selected) {
      setTplForm({
        subject: selected.subject,
        body_html: selected.body_html
      });
    }
  };

  async function saveSmtpSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/settings/settings', smtp);
      toast.success('SMTP Configurations saved successfully!');
      fetchSmtpSettings();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection(e) {
    e.preventDefault();
    if (!testEmail) return toast.error('Please enter a recipient test email address');
    
    setTesting(true);
    try {
      await api.post('/admin/settings/smtp/test', {
        test_email: testEmail,
        config: smtp
      });
      toast.success(`Connection verified! Test email successfully sent to ${testEmail}`);
      setTestModalOpen(false);
      setTestEmail('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'SMTP Connection failed');
    } finally {
      setTesting(false);
    }
  }

  async function saveTemplateSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/settings/templates', {
        name: selectedTemplateName,
        subject: tplForm.subject,
        body_html: tplForm.body_html
      });
      toast.success('Email Template saved successfully!');
      // Update local templates list
      setTemplates(prev => prev.map(t => t.name === selectedTemplateName ? { ...t, subject: tplForm.subject, body_html: tplForm.body_html } : t));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg2)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  };

  const selectedInfo = TEMPLATE_INFO[selectedTemplateName] || { label: '', description: '', placeholders: [] };

  return (
    <Layout title="Mailing & Templates">
      <div style={{ padding: '0 24px 24px' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {[
            { id: 'smtp', label: 'SMTP Server Settings', icon: Settings },
            { id: 'templates', label: 'Email Templates', icon: FileText }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--text3)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }}></div>
            <div>Loading configurations...</div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg2)',
            borderRadius: 16,
            border: '1px solid rgba(226, 232, 240, 0.8)',
            padding: 24,
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
          }}>
            
            {/* SMTP TAB FORM */}
            {activeTab === 'smtp' && (
              <form onSubmit={saveSmtpSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(99, 102, 241, 0.04)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                  <Info size={16} color="#6366f1" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                    Configure the SMTP parameters used by the server to dispatch automatic ERP updates. Changes will take effect immediately. Default credentials will fall back to Environment Variables if left blank.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                  
                  {/* SMTP Host */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>SMTP Host *</label>
                    <input
                      type="text"
                      required
                      value={smtp.host}
                      onChange={e => setSmtp({ ...smtp, host: e.target.value })}
                      placeholder="e.g. smtp.gmail.com"
                      style={inputStyle}
                    />
                  </div>

                  {/* SMTP Port */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>SMTP Port *</label>
                    <input
                      type="number"
                      required
                      value={smtp.port}
                      onChange={e => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
                      placeholder="e.g. 587"
                      style={inputStyle}
                    />
                  </div>

                  {/* SMTP Username */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Username / Login Email</label>
                    <input
                      type="text"
                      value={smtp.username}
                      onChange={e => setSmtp({ ...smtp, username: e.target.value })}
                      placeholder="e.g. user@gmail.com"
                      style={inputStyle}
                    />
                  </div>

                  {/* SMTP Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Password / App Key</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={smtp.password}
                        onChange={e => setSmtp({ ...smtp, password: e.target.value })}
                        placeholder={smtp.password_configured ? '******' : 'Enter app password'}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text3)'
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Sender Address */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Sender Email Address *</label>
                    <input
                      type="email"
                      required
                      value={smtp.sender_email}
                      onChange={e => setSmtp({ ...smtp, sender_email: e.target.value })}
                      placeholder="No-Reply@domain.com"
                      style={inputStyle}
                    />
                  </div>

                  {/* Sender Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Sender Display Name</label>
                    <input
                      type="text"
                      value={smtp.sender_name}
                      onChange={e => setSmtp({ ...smtp, sender_name: e.target.value })}
                      placeholder="KIM ERP Alerts"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Encryption Settings Toggles */}
                <div style={{ display: 'flex', gap: 30, background: 'var(--bg3)', padding: '14px 20px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  
                  {/* TLS Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={smtp.use_tls}
                      onChange={e => setSmtp({ ...smtp, use_tls: e.target.checked, use_ssl: e.target.checked ? false : smtp.use_ssl })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Use STARTTLS (Recommended for Port 587)</span>
                  </label>

                  {/* SSL Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={smtp.use_ssl}
                      onChange={e => setSmtp({ ...smtp, use_ssl: e.target.checked, use_tls: e.target.checked ? false : smtp.use_tls })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Use SSL Encryption (Required for Port 465)</span>
                  </label>
                </div>

                {/* Save & Test Buttons */}
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 700,
                      boxShadow: '0 4px 10px rgba(25, 84, 2, 0.15)'
                    }}
                  >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Configuration'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestModalOpen(true);
                      setTestEmail('');
                    }}
                    className="btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--bg3)',
                      fontWeight: 700,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <Send size={14} style={{ color: 'var(--accent)' }} /> Test Connection
                  </button>
                </div>
              </form>
            )}

            {/* EMAIL TEMPLATES TAB FORM */}
            {activeTab === 'templates' && (
              <div style={{ display: 'flex', gap: 24 }}>
                
                {/* Left Side: Editor Form */}
                <form onSubmit={saveTemplateSettings} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Select Template Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Choose System Template</label>
                    <select
                      value={selectedTemplateName}
                      onChange={e => handleTemplateChange(e.target.value)}
                      style={{ ...inputStyle, background: 'var(--bg3)' }}
                    >
                      {templates.map(t => (
                        <option key={t.name} value={t.name}>
                          {TEMPLATE_INFO[t.name]?.label || t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description Box */}
                  <div style={{ background: 'rgba(25, 84, 2, 0.02)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(25, 84, 2, 0.1)', fontSize: 12, color: 'var(--text2)' }}>
                    <strong>Template:</strong> {selectedInfo.description}
                  </div>

                  {/* Subject input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Email Subject Line *</label>
                    <input
                      type="text"
                      required
                      value={tplForm.subject}
                      onChange={e => setTplForm({ ...tplForm, subject: e.target.value })}
                      placeholder="Template Subject"
                      style={inputStyle}
                    />
                  </div>

                  {/* Rich HTML body editor */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>HTML Email Template Body *</label>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Supports raw HTML layout & inline styles</span>
                    </div>
                    <textarea
                      required
                      value={tplForm.body_html}
                      onChange={e => setTplForm({ ...tplForm, body_html: e.target.value })}
                      style={{
                        ...inputStyle,
                        minHeight: 280,
                        fontFamily: 'monospace',
                        lineHeight: 1.5,
                        fontSize: 12,
                        resize: 'vertical'
                      }}
                      placeholder="Write HTML content here..."
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 700,
                      boxShadow: '0 4px 10px rgba(25, 84, 2, 0.15)'
                    }}
                  >
                    <Save size={14} /> {saving ? 'Saving Template...' : 'Save Template'}
                  </button>
                </form>

                {/* Right Side: Placeholders Panel */}
                <div style={{
                  width: 250,
                  flexShrink: 0,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 18,
                  alignSelf: 'flex-start'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Info size={15} color="var(--accent)" />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text)' }}>Dynamic Variables</span>
                  </div>
                  <p style={{ margin: '0 0 14px 0', fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                    You can copy and paste these dynamic variables into the Subject or HTML body. They will be replaced automatically before sending:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedInfo.placeholders.map(p => (
                      <div key={p.name} style={{ borderBottom: '1px solid rgba(226,232,240,0.5)', paddingBottom: 8 }}>
                        <code style={{
                          background: 'rgba(25, 84, 2, 0.08)',
                          color: 'var(--accent)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-block',
                          marginBottom: 4
                        }}>{p.name}</code>
                        <div style={{ fontSize: 10, color: 'var(--text2)' }}>{p.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Connection Test Modal */}
      {testModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleTestConnection} style={{ background: 'var(--bg2)', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(25, 84, 2, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Test SMTP Connection</h3>
                <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>Sends a quick HTML email to verify connection and credentials</p>
              </div>
            </div>
            
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Recipient Email Address *</label>
              <input
                type="email"
                required
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test-recipient@domain.com"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="btn"
                style={{ flex: 1, background: 'var(--bg3)', border: 'none', borderRadius: 8, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={testing}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  borderRadius: 8,
                  fontWeight: 600,
                  boxShadow: '0 4px 10px rgba(25, 84, 2, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                {testing ? 'Verifying...' : 'Send Test Mail'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
