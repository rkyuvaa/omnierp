import { useState } from 'react';
import api, { getErrorMessage } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Shield, ShieldAlert, Key, Clipboard, Check, Loader2 } from 'lucide-react';

export default function TwoFactorSetup() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null); // { secret, qr_code_url }
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Check if TOTP is enabled globally for this user.
  // Wait! We added `totp_enabled` to models.py and auth.py me endpoint, but wait!
  // Let's check: does `/auth/me` return "totp_enabled"?
  // Yes! Let's check `backend/app/routers/auth.py`'s `me` endpoint.
  // Wait! In `auth.py`, does the `me` endpoint return `totp_enabled`?
  // Let's check lines 42 to 56 of `auth.py`:
  // No! The `me` endpoint returns name, email, allowed_modules, branch_id, employee_id, is_manager, etc. It does NOT return `totp_enabled`!
  // Let's modify the `me` endpoint in `auth.py` to also return `totp_enabled`!
  // Yes! That's a critical missing link!
  
  const isEnabled = user?.totp_enabled;

  const handleInitiate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/setup-totp/initiate');
      setSetupData(res.data);
      setCode('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to initiate 2FA setup'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupData(null);
    setCode('');
  };

  const handleVerifySetup = async e => {
    e.preventDefault();
    if (code.length !== 6) return toast.error('Please enter the 6-digit verification code');
    setLoading(true);
    try {
      await api.post('/auth/setup-totp/verify', { secret: setupData.secret, code });
      toast.success('Two-Factor Authentication enabled successfully! 🛡️');
      setSetupData(null);
      setCode('');
      await refreshUser();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Verification failed. Please check the code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async e => {
    e.preventDefault();
    if (code.length !== 6) return toast.error('Please enter the 6-digit verification code to disable');
    setLoading(true);
    try {
      await api.post('/auth/setup-totp/disable', { code });
      toast.success('Two-Factor Authentication disabled.');
      setCode('');
      await refreshUser();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to disable 2FA. Please verify the code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Secret key copied to clipboard');
  };

  const handleInputChange = e => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 6) {
      setCode(val);
    }
  };

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '24px',
      marginTop: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
    }}>
      {isEnabled ? (
        // State 1: 2FA is Enabled
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Two-Factor Authentication is Active</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Your account is secured with TOTP.</div>
            </div>
            <span style={{
              marginLeft: 'auto',
              background: '#22c55e',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '999px'
            }}>ENABLED</span>
          </div>

          <form onSubmit={handleDisable} style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
              Disable Two-Factor Authentication
            </div>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              To deactivate 2FA, please enter the current 6-digit verification code from your authenticator app.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className="form-input"
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={handleInputChange}
                placeholder="000000"
                required
                style={{
                  fontSize: 16,
                  letterSpacing: '4px',
                  textAlign: 'center',
                  fontWeight: 700,
                  maxWidth: '140px',
                  height: '38px',
                  borderRadius: '8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)'
                }}
              />
              <button className="btn" type="submit" disabled={loading} style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '0 16px',
                height: '38px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                {loading ? <Loader2 size={14} className="spinner" /> : 'Disable 2FA'}
              </button>
            </div>
          </form>
        </div>
      ) : setupData ? (
        // State 2: 2FA Setup Flow in Progress
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={16} style={{ color: 'var(--accent)' }} /> Configure Authenticator App
            </div>
            <button className="btn" onClick={handleCancelSetup} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg3)', border: 'none' }}>Cancel</button>
          </div>

          <div style={{ display: 'flex', gap: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Step 1: QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: 12, borderRadius: 12, border: '1px solid var(--border)', alignSelf: 'center' }}>
              <img src={setupData.qr_code_url} alt="Scan QR Code" style={{ width: 140, height: 140 }} />
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 6 }}>Scan QR Code</span>
            </div>

            {/* Step 2: Instructions and verification */}
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 12 }}>
                1. Open your authenticator app (Google Authenticator, Microsoft Authenticator, etc.).<br />
                2. Scan the QR code or enter the secret key manually below:
              </div>

              {/* Secret key display */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '6px 12px',
                marginBottom: 16,
                gap: 8
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: '1px', color: 'var(--accent)', wordBreak: 'break-all', flex: 1 }}>
                  {setupData.secret}
                </span>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Copy secret key"
                >
                  {copied ? <Check size={14} style={{ color: 'var(--accent2)' }} /> : <Clipboard size={14} />}
                </button>
              </div>

              {/* Verification form */}
              <form onSubmit={handleVerifySetup}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  3. Enter the 6-digit code to complete setup:
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="form-input"
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={handleInputChange}
                    placeholder="000000"
                    required
                    style={{
                      fontSize: 16,
                      letterSpacing: '4px',
                      textAlign: 'center',
                      fontWeight: 700,
                      maxWidth: '130px',
                      height: '38px',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)'
                    }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={loading} style={{
                    height: '38px',
                    borderRadius: '8px',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    {loading ? <Loader2 size={14} className="spinner" /> : 'Verify & Activate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        // State 3: 2FA is Not Enabled
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Two-Factor Authentication (2FA)</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Secure your account using time-based OTP.</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleInitiate} disabled={loading} style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {loading ? <Loader2 size={14} className="spinner" /> : 'Set Up 2FA'}
          </button>
        </div>
      )}
      <style>{`
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
