import React, { useState } from 'react';
import { apiClient } from './api';

interface SignupProps {
  onSignup: (user: any) => void;
  onSwitchToLogin?: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSignup, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'RESTAURANT_OWNER' | 'STEWARD' | 'ADMIN'>('STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    
    if (confirmPassword && value !== confirmPassword) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    if (value !== password) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordError('');

    // Validation
    if (!email || !name || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.register({
        email,
        name,
        password,
        role
      });

      // Store token
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));

      // Notify parent
      onSignup(response.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>TransitLink</h1>
        <h2>Create Account</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="your.email@ucdavis.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Account Type</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              disabled={loading}
            >
              <option value="STUDENT">Student</option>
              <option value="RESTAURANT_OWNER">Restaurant Owner</option>
              <option value="STEWARD">Steward</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={handlePasswordChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              disabled={loading}
            />
            {passwordError && <div className="error-message" style={{ marginTop: '5px' }}>{passwordError}</div>}
          </div>

          <button
            type="submit"
            disabled={loading || !!passwordError}
            className="login-button"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="signup-prompt">
          Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin?.() }} style={{ cursor: 'pointer' }}>Sign in here</a>
        </p>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #002855 0%, #1D4F91 100%);
          padding: 20px;
        }
        .login-box {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 480px;
          width: 100%;
          border-top: 5px solid #DAAA00;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        .form-group label {
          font-weight: 600;
          color: #2d3748;
          font-size: 14px;
        }
        .form-group input, .form-group select {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group select:focus {
          outline: none;
          border-color: #1D4F91;
        }
        .error-message {
          background: #fff1f0;
          border: 1.5px solid #fca5a5;
          color: #b91c1c;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .login-button {
          background: #002855;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
        }

        .login-button:hover:not(:disabled) {
          background: #1D4F91;
        }

        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .signup-prompt {
          margin-top: 16px;
          text-align: center;
          color: #4a5568;
          font-size: 14px;
        }

        .signup-prompt a {
          color: #1D4F91;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .signup-prompt a:hover {
          color: #002855;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default Signup;
