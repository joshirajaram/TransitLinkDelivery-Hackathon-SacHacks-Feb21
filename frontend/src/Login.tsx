import { useState, useEffect } from 'react';
import { login, googleAuth } from './api';

interface LoginProps {
  onLogin: (user: any) => void;
  onSwitchToSignup?: () => void;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

declare global {
  interface Window { google: any; }
}

const FEATURES = [
  { icon: '🚌', title: 'Bus-to-Door Delivery', desc: 'Food delivered right to your Unitrans bus stop' },
  { icon: '🌱', title: 'Eco-Friendly', desc: 'Zero extra emissions — buses already run the route' },
  { icon: '💰', title: 'Student Pricing', desc: 'Just $1–3 delivery vs $8+ on other platforms' },
  { icon: '📍', title: 'Live Tracking', desc: 'Watch your bus arrive in real time on the map' },
];

const Login = ({ onLogin, onSwitchToSignup }: LoginProps) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.onload = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleSignIn });
        window.google.accounts.id.renderButton(
          document.getElementById('googleSignInButton'),
          { theme: 'outline', size: 'large', width: 360, text: 'continue_with' }
        );
      }
    };
    return () => { document.body.removeChild(script); };
  }, []);

  const handleGoogleSignIn = async (response: any) => {
    setError(''); setLoading(true);
    try {
      const result = await googleAuth(response.credential);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));
      onLogin(result.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Google sign-in failed');
      setErrorKey(k => k + 1);
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await login({ email, password });
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      onLogin(response.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
      setErrorKey(k => k + 1);
    } finally { setLoading(false); }
  };

  const fillDemo = (role: string) => {
    setActiveRole(role);
    if (role === 'student')    { setEmail('student@ucdavis.edu');         setPassword('demo'); }
    if (role === 'restaurant') { setEmail('owner@tacomadavis.com');        setPassword('demo'); }
    if (role === 'steward')    { setEmail('steward@ucdavis.edu');          setPassword('demo'); }
    if (role === 'admin')      { setEmail('admin@transitlink.app');        setPassword('demo'); }
    setError('');
  };

  return (
    <div className="auth-page">
      {/* ── LEFT BRAND PANEL ── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <div className="auth-logo-row">
            <span className="auth-logo-transit">TRANSIT</span>
            <span className="auth-logo-link">LINK</span>
          </div>
          <p className="auth-tagline">Smart food delivery via Unitrans bus network</p>

          <div className="auth-features">
            {FEATURES.map(f => (
              <div key={f.title} className="auth-feature-item">
                <span className="auth-feature-icon">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-partner-row">
            <span className="auth-partner-badge">UNITRANS</span>
            <span className="auth-partner-x">×</span>
            <span className="auth-partner-badge accent">DDBA</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <h1>Welcome back</h1>
            <p>Sign in to order food via Unitrans</p>
          </div>

          {/* Quick role selector */}
          <div className="auth-role-tabs">
            <span className="auth-role-label">Try demo:</span>
            {[
              { id: 'student',    icon: '🎓', label: 'Student'    },
              { id: 'restaurant', icon: '🍽️', label: 'Restaurant' },
              { id: 'steward',    icon: '🚌', label: 'Steward'    },
            ].map(r => (
              <button
                key={r.id}
                type="button"
                className={`auth-role-chip ${activeRole === r.id ? 'active' : ''}`}
                onClick={() => fillDemo(r.id)}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          {GOOGLE_CLIENT_ID && (
            <>
              <div id="googleSignInButton" className="google-btn-wrap" />
              <div className="auth-divider"><span>or continue with email</span></div>
            </>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email" type="email"
                placeholder="you@ucdavis.edu"
                value={email} onChange={e => setEmail(e.target.value)}
                disabled={loading} required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password" type="password"
                placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div key={errorKey} className="auth-error">
                <span>⚠️ {error}</span>
                <button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <p className="auth-switch-prompt">
            New to TransitLink?{' '}
            <button type="button" className="auth-link-btn" onClick={onSwitchToSignup}>
              Create an account
            </button>
          </p>

          <div className="auth-secure-note">
            <span>🔒</span> Secure authentication · UC Davis SSO supported
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
