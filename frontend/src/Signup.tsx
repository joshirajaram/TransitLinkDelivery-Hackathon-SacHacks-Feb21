import React, { useState } from 'react';
import { apiClient } from './api';

interface SignupProps {
  onSignup: (user: any) => void;
  onSwitchToLogin?: () => void;
}

const ROLE_OPTIONS = [
  { value: 'STUDENT',          label: '🎓 UC Davis Student',    desc: 'Order food to your bus stop' },
  { value: 'RESTAURANT_OWNER', label: '🍽️ Restaurant Partner',  desc: 'Manage your restaurant & menu' },
  { value: 'STEWARD',          label: '🚌 Unitrans Steward',     desc: 'Deliver orders on your route'  },
];

const Signup: React.FC<SignupProps> = ({ onSignup, onSwitchToLogin }) => {
  const [email, setEmail]                   = useState('');
  const [name, setName]                     = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole]                     = useState<'STUDENT' | 'RESTAURANT_OWNER' | 'STEWARD' | 'ADMIN'>('STUDENT');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [passwordError, setPasswordError]   = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setPasswordError('');
    if (!email || !name || !password || !confirmPassword) { setError('All fields are required'); return; }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    if (password.length < 6) { setPasswordError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const response = await apiClient.register({ email, name, password, role });
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      onSignup(response.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* ── LEFT BRAND PANEL ── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <div className="auth-logo-row">
            <div className="auth-logo-mark">🚌</div>
            <div className="auth-logo-text">
              <strong>TransitLink</strong>
              <small>UC DAVIS</small>
            </div>
          </div>

          <h2 className="auth-tagline">Join the <em>smarter</em> way to eat on campus</h2>
          <p className="auth-sub-tagline">
            Connecting Davis restaurants, Unitrans routes, and hungry students in one seamless platform.
          </p>

          <div className="auth-features">
            {ROLE_OPTIONS.map(opt => (
              <div
                key={opt.value}
                className={`auth-feature-item ${role === opt.value ? 'selected' : ''}`}
                onClick={() => setRole(opt.value as any)}
                style={{ cursor: 'pointer', transition: 'all 0.18s',
                  borderColor: role === opt.value ? 'rgba(218,170,0,0.5)' : undefined,
                  background:  role === opt.value ? 'rgba(218,170,0,0.07)' : undefined }}
              >
                <span className="auth-feature-icon" style={{ fontSize: '1.4rem' }}>{opt.label.split(' ')[0]}</span>
                <div className="auth-feature-text">
                  <strong>{opt.label.split(' ').slice(1).join(' ')}</strong>
                  <span>{opt.desc}</span>
                </div>
                {role === opt.value && <span style={{ marginLeft: 'auto', color: '#DAAA00', fontSize: '1rem' }}>✓</span>}
              </div>
            ))}
          </div>

          <div className="auth-stats-row">
            {[
              { value: '3', label: 'User Roles'         },
              { value: '12+', label: 'Restaurants'      },
              { value: 'Free', label: 'To Register'     },
            ].map(s => (
              <div key={s.label} className="auth-stat">
                <div className="auth-stat-value">{s.value}</div>
                <div className="auth-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <h1 className="auth-form-title">Create your account</h1>
            <p className="auth-form-sub">Select your role on the left, then fill in your details</p>
          </div>

          <form onSubmit={handleSignup} className="auth-form">
            <div className="auth-field">
              <label htmlFor="su-name">Full Name</label>
              <input
                id="su-name" type="text"
                placeholder="Jane Aggie"
                value={name} onChange={e => setName(e.target.value)}
                disabled={loading} required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="su-email">Email Address</label>
              <input
                id="su-email" type="email"
                placeholder="you@ucdavis.edu"
                value={email} onChange={e => setEmail(e.target.value)}
                disabled={loading} required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="su-role">Account Type</label>
              <select
                id="su-role"
                value={role}
                onChange={e => setRole(e.target.value as any)}
                disabled={loading}
              >
                <option value="STUDENT">UC Davis Student</option>
                <option value="RESTAURANT_OWNER">Restaurant Owner</option>
                <option value="STEWARD">Unitrans Steward</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor="su-pw">Password</label>
              <input
                id="su-pw" type="password"
                placeholder="At least 6 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                disabled={loading} required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="su-cpw">Confirm Password</label>
              <input
                id="su-cpw" type="password"
                placeholder="Re-enter your password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading} required
              />
            </div>

            {(error || passwordError) && (
              <div className="auth-error">⚠️ {error || passwordError}</div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Creating Account…' : 'Create Account →'}
            </button>
          </form>

          <div className="auth-switch-prompt">
            Already have an account?{' '}
            <button type="button" className="auth-link-btn" onClick={onSwitchToLogin}>
              Sign in
            </button>
          </div>
          <p className="auth-secure-note">🔒 Your data is stored securely</p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
