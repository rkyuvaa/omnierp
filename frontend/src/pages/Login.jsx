import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault(); 
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      if (res.mfa_required) {
        navigate('/login/2fa', { state: { mfa_token: res.mfa_token } });
      } else {
        navigate('/');
      }
    }
    catch { setError('Invalid email or password'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">K</div>
          <div>
            <div className="logo-text">KIM ERP</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderLeft: '3px solid #ef4444',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#f87171',
                lineHeight: 1.4,
                textAlign: 'left',
                animation: 'shake 0.3s ease-in-out'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
