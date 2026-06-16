import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check, Loader2 } from 'lucide-react';

// Password strength calculator removed for login screen

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Animation states
  const [shakeLock, setShakeLock] = useState(false);
  const [shakeButton, setShakeButton] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const [submittedValid, setSubmittedValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorHint, setErrorHint] = useState('');
  const [btnHovered, setBtnHovered] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Validate email format
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setErrorHint(''); // clear error when typing
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setErrorHint(''); // clear error when typing
  };

  const handleTogglePassword = () => {
    setPasswordVisible(!passwordVisible);
    setShakeLock(true);
    setTimeout(() => setShakeLock(false), 500);
  };

  const handleInvalidSubmit = (hint) => {
    setShakeButton(true);
    setFlashRed(true);
    setErrorHint(hint);
    setTimeout(() => {
      setShakeButton(false);
      setFlashRed(false);
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailValid) {
      handleInvalidSubmit("Enter a valid email");
      return;
    }
    if (!password) {
      handleInvalidSubmit("Check your password");
      return;
    }

    setSubmitting(true);
    setErrorHint('');

    try {
      const res = await login(email, password);
      // Valid submission animation
      setSubmittedValid(true);
      setTimeout(() => {
        setSubmittedValid(false);
        setSubmitting(false);
        if (res.mfa_required) {
          navigate('/login/2fa', { state: { mfa_token: res.mfa_token } });
        } else {
          navigate('/');
        }
      }, 2500);
    } catch (err) {
      handleInvalidSubmit("Check your password");
      setSubmitting(false);
    }
  };

  // Dynamic Header title text & color
  let titleText = 'Sign in to your account';
  let titleColor = '#1a2e18';

  if (submittedValid) {
    titleText = 'Welcome to KIM ERP';
    titleColor = '#16a34a';
  } else if (errorHint) {
    titleText = errorHint;
    titleColor = '#ef4444';
  } else if (passwordFocused) {
    titleText = 'Enter your password';
    titleColor = '#eab308';
  } else if (emailValid && !password) {
    titleText = 'Now enter your password';
    titleColor = '#1a2e18';
  } else if (emailFocused) {
    titleText = 'Enter your email address';
    titleColor = '#eab308';
  }

  // Dynamic icon styling
  const mailIconColor = emailValid ? 'var(--accent)' : emailFocused ? '#eab308' : '#88a878';
  const mailIconTransform = `translateY(-50%) ${emailFocused ? 'scale(1.15)' : 'scale(1)'}`;

  const lockIconColor = passwordFocused ? 'var(--accent)' : '#88a878';
  const lockIconTransform = `translateY(-50%) ${passwordFocused ? 'scale(1.15)' : 'scale(1)'}`;

  return (
    <div className="login-wrapper">
      <style>{`
        .login-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f4fbf0;
          padding: 24px;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .login-card-container {
          width: 100%;
          max-width: 450px;
          height: 540px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(25, 84, 2, 0.08);
          display: flex;
          overflow: hidden;
        }
        .login-right-panel {
          width: 100%;
          height: 100%;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px;
          box-sizing: border-box;
        }
        @keyframes levitate {
          0% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes shakeButton {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes wiggleLock {
          0%, 100% { transform: translateY(-50%) rotate(0deg); }
          25% { transform: translateY(-50%) rotate(-12deg) scale(1.15); }
          75% { transform: translateY(-50%) rotate(12deg) scale(1.15); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .logo-levitate {
          animation: levitate 4s ease-in-out infinite;
        }
        .pulse-dot {
          animation: pulseDot 2s infinite ease-in-out;
        }
        .secure-pulse-dot {
          width: 6px;
          height: 6px;
          background-color: var(--accent);
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(59, 109, 17, 0.4);
          animation: pulseSecure 1.5s infinite;
        }
        @keyframes pulseSecure {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(59, 109, 17, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(59, 109, 17, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(59, 109, 17, 0);
          }
        }
        @keyframes bounceArrow {
          0% { transform: translateX(0); }
          100% { transform: translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 480px) {
          .login-card-container {
            height: auto !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 25px rgba(25, 84, 2, 0.05) !important;
          }
          .login-right-panel {
            padding: 28px 20px !important;
          }
        }
      `}</style>

      <div className="login-card-container">
        {/* RIGHT PANEL — LOGIN FORM */}
        <div className="login-right-panel">
          <div>
            {/* Logo Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <img src="/favicon.png" className="logo-levitate" style={{ width: 36, height: 36, objectFit: 'contain' }} alt="Logo" />
              <span style={{ color: '#1a2e18', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>KIM ERP</span>
            </div>

            {/* Greeting */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B6D11', marginRight: 8 }} />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#3B6D11' }}>
                Welcome back
              </span>
            </div>

            {/* Dynamic Title */}
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: titleColor,
              margin: '0 0 32px 0',
              lineHeight: 1.25,
              transition: 'color 0.3s ease'
            }}>
              {titleText}
            </h2>

            {/* Input Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Email */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b825e' }}>
                    Email
                  </label>
                  {emailValid && <Check size={12} color="var(--accent)" style={{ strokeWidth: 3 }} />}
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: mailIconTransform,
                      color: mailIconColor,
                      transition: 'all 0.2s ease'
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 40px',
                      background: '#f7fbf4',
                      border: `1px solid ${emailValid ? 'var(--accent)' : emailFocused ? '#eab308' : '#c8d8c0'}`,
                      borderRadius: 8,
                      outline: 'none',
                      color: '#1a2e18',
                      fontSize: 14,
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b825e' }}>
                    Password
                  </label>
                  {password.length > 0 && <Check size={12} color="var(--accent)" style={{ strokeWidth: 3 }} />}
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: lockIconTransform,
                      color: lockIconColor,
                      transition: 'all 0.2s ease',
                      animation: shakeLock ? 'wiggleLock 0.4s ease' : 'none'
                    }}
                  />
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 40px 12px 40px',
                      background: '#f7fbf4',
                      border: `1px solid ${passwordFocused ? 'var(--accent)' : '#c8d8c0'}`,
                      borderRadius: 8,
                      outline: 'none',
                      color: '#1a2e18',
                      fontSize: 14,
                      transition: 'border-color 0.2s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleTogglePassword}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#88a878',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      outline: 'none'
                    }}
                  >
                    {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Secure password entry indicator */}
                {passwordFocused && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#88a878',
                    marginTop: 8,
                    animation: 'fadeIn 0.25s ease'
                  }}>
                    <span className="secure-pulse-dot" />
                    <span style={{ fontWeight: 600 }}>Secure encrypted password entry</span>
                  </div>
                )}
              </div>

              {/* Forgot password */}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); }}
                className="forgot-pwd-link"
                style={{
                  fontSize: 12,
                  color: '#2d5a27',
                  textDecoration: 'none',
                  fontWeight: 600,
                  alignSelf: 'flex-end',
                  marginTop: -8,
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#eab308'}
                onMouseLeave={e => e.currentTarget.style.color = '#2d5a27'}
              >
                Forgot password?
              </a>

              {/* Submit Button */}
              <button
                type="submit"
                onMouseEnter={() => setBtnHovered(true)}
                onMouseLeave={() => setBtnHovered(false)}
                disabled={submitting}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 46,
                  background: submittedValid ? '#16a34a' : flashRed ? '#ef4444' : btnHovered ? '#3B6D11' : '#2d5a27',
                  color: '#f0f7ea',
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.25s ease',
                  animation: shakeButton ? 'shakeButton 0.4s ease' : 'none',
                  outline: 'none'
                }}
              >
                {/* Accent gold bar left edge */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: btnHovered ? 8 : 4,
                  background: '#eab308',
                  transition: 'width 0.18s ease'
                }} />

                {submitting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} style={{ animation: password.length > 0 ? 'bounceArrow 0.8s infinite alternate' : 'none' }} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Secure login footer */}
          <div style={{ fontSize: 11, color: '#a3bfa2', textAlign: 'center', fontWeight: 500, letterSpacing: '0.2px' }}>
            Secure login · Konwert India Motors · © 2026
          </div>
        </div>
      </div>
    </div>
  );
}
