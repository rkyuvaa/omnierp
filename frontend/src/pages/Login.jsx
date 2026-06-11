import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check, Loader2 } from 'lucide-react';

// Password strength calculator
function checkStrength(pwd) {
  if (!pwd) return 0;
  if (pwd.length < 4) return 1;
  let score = 1;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  const hasMixed = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[^a-zA-Z\d]/.test(pwd);
  if (hasMixed) score += 1;
  if (hasDigit || hasSpecial) score += 1;
  return Math.min(5, score);
}

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
  const passwordStrength = checkStrength(password);

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
    if (passwordStrength >= 4) {
      titleText = 'Looking good!';
      titleColor = '#16a34a';
    } else if (password.length > 0 && passwordStrength < 4) {
      titleText = 'Make it stronger';
      titleColor = '#f59e0b';
    } else {
      titleText = 'Enter Your Password';
      titleColor = '#eab308';
    }
  } else if (emailValid && !password) {
    titleText = 'Now enter your password';
    titleColor = '#1a2e18';
  } else if (emailFocused) {
    titleText = 'Enter your email address';
    titleColor = '#eab308';
  }

  // Focal geometry variables
  const cx = 225;
  const cy = 260;
  const hexAngles = [30, 90, 150, 210, 270, 330].map(a => a * Math.PI / 180);

  const getHexPoints = (r) => {
    return hexAngles.map(angle => {
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const getHexPointsSpecific = (x_c, y_c, r) => {
    return hexAngles.map(angle => {
      const x = x_c + r * Math.cos(angle);
      const y = y_c + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const hexOuterPoints = hexAngles.map(angle => ({
    x: cx + 150 * Math.cos(angle),
    y: cy + 150 * Math.sin(angle)
  }));

  const hexInnerPoints = hexAngles.map(angle => ({
    x: cx + 20 * Math.cos(angle),
    y: cy + 20 * Math.sin(angle)
  }));

  // Dynamic center node attributes
  let centerNodeRadius = 6;
  let centerNodeGlow = '0 0 4px #eab308';
  let centerNodeColor = '#eab308';

  if (submittedValid) {
    centerNodeRadius = 24;
    centerNodeColor = '#16a34a';
    centerNodeGlow = '0 0 16px #16a34a';
  } else if (password.length > 0) {
    centerNodeRadius = 8 + password.length * 0.4;
    centerNodeColor = passwordStrength === 1 ? '#ef4444' :
                      passwordStrength === 2 ? '#f59e0b' :
                      passwordStrength === 3 ? '#d97706' :
                      passwordStrength === 4 ? '#16a34a' : '#195402';
    centerNodeGlow = `0 0 12px ${centerNodeColor}`;
  } else if (passwordFocused) {
    centerNodeRadius = 10;
    centerNodeGlow = '0 0 10px #eab308';
  } else if (emailFocused) {
    centerNodeRadius = 8;
    centerNodeGlow = '0 0 8px #eab308';
  }

  // Dynamic icon styling
  const mailIconColor = emailValid ? 'var(--accent)' : emailFocused ? '#eab308' : '#88a878';
  const mailIconTransform = `translateY(-50%) ${emailFocused ? 'scale(1.15)' : 'scale(1)'}`;

  const lockIconColor = passwordFocused
    ? (passwordStrength === 1 ? '#ef4444' :
       passwordStrength === 2 ? '#f59e0b' :
       passwordStrength === 3 ? '#d97706' :
       passwordStrength === 4 ? '#16a34a' :
       passwordStrength === 5 ? '#195402' : '#eab308')
    : '#88a878';
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
          font-family: 'DM Sans', sans-serif;
        }
        .login-card-container {
          width: 100%;
          max-width: 900px;
          height: 520px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(25, 84, 2, 0.08);
          display: flex;
          overflow: hidden;
        }
        .login-left-panel {
          width: 50%;
          height: 100%;
          position: relative;
          background: #195402;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 32px;
        }
        .login-right-panel {
          width: 50%;
          height: 100%;
          background: #ffffff;
          border-left: 0.5px solid #e0ead8;
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
        
        @media (max-width: 768px) {
          .login-card-container {
            flex-direction: column !important;
            height: auto !important;
            max-width: 450px !important;
          }
          .login-left-panel {
            display: none !important;
          }
          .login-right-panel {
            width: 100% !important;
            border-left: none !important;
            padding: 32px 24px !important;
          }
        }
      `}</style>

      <div className="login-card-container">
        {/* LEFT PANEL — BRAND & PATTERN */}
        <div className="login-left-panel">
          {/* SVG Textured & Geometric Background Layer */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <svg width="100%" height="100%">
              <defs>
                {/* Honeycomb grid */}
                <pattern id="honeycomb" width="30" height="52" patternUnits="userSpaceOnUse">
                  <path d="M15 0 L30 8.66 L30 26 L15 34.64 L0 26 L0 8.66 Z M0 52 L15 43.34 L30 52" fill="none" stroke="#103801" strokeWidth="1" strokeOpacity="0.25" />
                </pattern>
                {/* Dot grid */}
                <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="8" cy="8" r="1" fill="#97C459" fillOpacity="0.2" />
                </pattern>
              </defs>
              
              {/* Patterns */}
              <rect width="100%" height="100%" fill="url(#honeycomb)" />
              <rect width="100%" height="100%" fill="url(#dots)" />

              {/* Orbital reticle rings */}
              <circle cx={cx} cy={cy} r="120" fill="none" stroke="#eab308" strokeWidth="1.2" strokeOpacity="0.12" strokeDasharray="3 6" />
              <circle cx={cx} cy={cy} r="170" fill="none" stroke="#97C459" strokeWidth="1" strokeOpacity="0.1" />

              {/* Connector lines web */}
              {hexAngles.map((_, i) => (
                <line
                  key={i}
                  x1={hexOuterPoints[i].x}
                  y1={hexOuterPoints[i].y}
                  x2={hexInnerPoints[i].x}
                  y2={hexInnerPoints[i].y}
                  stroke="#c8d8c0"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              ))}

              {/* Concentric hexagons */}
              {/* Outermost R=150 filled */}
              <polygon points={getHexPoints(150)} fill="#123d01" fillOpacity={submittedValid ? 0.75 : emailValid ? 0.6 : 0.4} stroke={submittedValid ? '#16a34a' : 'var(--accent)'} strokeWidth="1.8" style={{ transition: 'all 0.4s ease' }} />
              {/* R=100 light green outline */}
              <polygon points={getHexPoints(100)} fill="none" stroke={emailValid ? '#97C459' : '#103801'} strokeWidth="1.5" strokeOpacity={emailValid ? 0.95 : 0.35} style={{ transition: 'all 0.3s ease' }} />
              {/* R=60 gold outline */}
              <polygon points={getHexPoints(60)} fill="none" stroke="#eab308" strokeWidth="1.5" strokeOpacity={emailFocused || passwordFocused ? 1 : 0.35} style={{ transition: 'all 0.3s ease' }} />
              {/* R=20 gold filled */}
              <polygon points={getHexPoints(20)} fill="#eab308" fillOpacity={emailFocused || passwordFocused ? 0.9 : 0.6} stroke="none" style={{ transition: 'all 0.3s ease' }} />

              {/* Small circular nodes sit at each vertex — alternating between light green and gold */}
              {[150, 100, 60, 20].map((r, rIdx) => 
                hexAngles.map((angle, i) => {
                  const x = cx + r * Math.cos(angle);
                  const y = cy + r * Math.sin(angle);
                  const color = (rIdx + i) % 2 === 0 ? '#eab308' : '#97C459';
                  return (
                    <circle 
                      key={`${r}-${i}`} 
                      cx={x} 
                      cy={y} 
                      r={r === 20 ? 3 : 4} 
                      fill={color} 
                      stroke="#123d01" 
                      strokeWidth="1.2" 
                      style={{ transition: 'all 0.3s ease' }}
                    />
                  );
                })
              )}

              {/* Corner accent hexagons */}
              {getHexPointsSpecific(50, 470, 16) && <polygon points={getHexPointsSpecific(50, 470, 16)} fill="none" stroke="#103801" strokeWidth="1.2" strokeOpacity="0.4" />}
              {getHexPointsSpecific(400, 50, 12) && <polygon points={getHexPointsSpecific(400, 50, 12)} fill="none" stroke="#eab308" strokeWidth="1" strokeOpacity="0.3" />}
              {getHexPointsSpecific(400, 470, 14) && <polygon points={getHexPointsSpecific(400, 470, 14)} fill="none" stroke="#103801" strokeWidth="1.2" strokeOpacity="0.4" />}

              {/* Center dynamic node */}
              <circle
                cx={cx}
                cy={cy}
                r={centerNodeRadius}
                fill={centerNodeColor}
                style={{
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  filter: `drop-shadow(${centerNodeGlow})`
                }}
              />
            </svg>
          </div>

          {/* Foreground UI Components */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 2, position: 'relative' }}>
            <img src="/favicon.png" className="logo-levitate" style={{ width: 42, height: 42, objectFit: 'contain' }} alt="Logo" />
            <span style={{ color: '#f0f7ea', fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px' }}>KIM ERP</span>
          </div>

          <div style={{ color: '#97C459', fontSize: 11, fontWeight: 600, zIndex: 2, position: 'relative', letterSpacing: '0.4px' }}>
            app.konwertindiamotors.com
          </div>
        </div>

        {/* RIGHT PANEL — LOGIN FORM */}
        <div className="login-right-panel">
          <div>
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
                  {passwordStrength >= 4 && <Check size={12} color="var(--accent)" style={{ strokeWidth: 3 }} />}
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
                      border: `1px solid ${passwordStrength >= 4 ? 'var(--accent)' : passwordFocused ? '#eab308' : '#c8d8c0'}`,
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

                {/* Password strength indicators */}
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ background: '#e0ead8', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${passwordStrength * 20}%`,
                        background: passwordStrength === 1 ? '#ef4444' :
                                    passwordStrength === 2 ? '#f59e0b' :
                                    passwordStrength === 3 ? '#d97706' :
                                    passwordStrength === 4 ? '#16a34a' : '#195402',
                        transition: 'width 0.3s ease, background-color 0.3s ease'
                      }} />
                    </div>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      marginTop: 4,
                      color: passwordStrength === 1 ? '#ef4444' :
                             passwordStrength === 2 ? '#f59e0b' :
                             passwordStrength === 3 ? '#d97706' :
                             passwordStrength === 4 ? '#16a34a' : '#195402',
                      transition: 'color 0.3s ease'
                    }}>
                      {passwordStrength === 1 && 'Very weak'}
                      {passwordStrength === 2 && 'Weak'}
                      {passwordStrength === 3 && 'Fair'}
                      {passwordStrength === 4 && 'Strong'}
                      {passwordStrength === 5 && 'Very strong'}
                    </div>
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
                    <ArrowRight size={16} />
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
