import { useState, useEffect } from 'react';
import { login, googleAuth } from './api';

interface LoginProps {
  onLogin: (user: any) => void;
}

// Google Sign-In configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''; // Add to .env

declare global {
  interface Window {
    google: any;
  }
}

const Login = ({ onLogin }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleSignIn,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('googleSignInButton'),
          {
            theme: 'outline',
            size: 'large',
            width: 400,
            text: 'continue_with',
          }
        );
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleSignIn = async (response: any) => {
    setError('');
    setLoading(true);

    try {
      const result = await googleAuth(response.credential);
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));
      onLogin(result.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ email, password });
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      onLogin(response.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>🚌 TransitLink Delivery</h1>
          <p>UC Davis Campus Food Delivery via Unitrans</p>
        </div>

        {/* Google Sign-In Button */}
        {GOOGLE_CLIENT_ID ? (
          <div className="google-signin-section">
            <div id="googleSignInButton" className="google-button-container"></div>
            
            <div className="divider">
              <span>OR</span>
            </div>
          </div>
        ) : (
          <div className="info-message">
            <p>⚙️ To enable Google Sign-In, add your Google Client ID to .env:</p>
            <code>VITE_GOOGLE_CLIENT_ID=your-client-id</code>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@ucdavis.edu"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In with Email'}
          </button>
        </form>

        <div className="login-footer">
          <p>🔐 Secure Authentication</p>
          <small>Sign in with Google or your UC Davis account</small>
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .login-box {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          padding: 40px;
          max-width: 480px;
          width: 100%;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-header h1 {
          font-size: 28px;
          margin: 0 0 8px 0;
          color: #1a202c;
        }

        .login-header p {
          color: #718096;
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          color: #2d3748;
          font-size: 14px;
        }

        .form-group input {
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-group input:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }

        .error-message {
          background: #fed7d7;
          color: #c53030;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
        }

        .btn-primary {
          background: #667eea;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #5568d3;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .divider {
          margin: 24px 0;
          text-align: center;
          position: relative;
        }

        .divider::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          background: #e2e8f0;
        }

        .divider span {
          background: white;
          padding: 0 12px;
          position: relative;
          color: #a0aec0;
          font-size: 14px;
        }

        .google-signin-section {
          margin-bottom: 16px;
        }

        .google-button-container {
          display: flex;
          justify-content: center;
          margin: 16px 0;
        }

        .info-message {
          background: #e6fffa;
          border: 1px solid #81e6d9;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .info-message p {
          margin: 0 0 8px 0;
          color: #234e52;
          font-size: 14px;
          font-weight: 600;
        }

        .info-message code {
          display: block;
          background: #fff;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #2d3748;
          word-break: break-all;
        }

        .login-footer {
          margin-top: 24px;
          text-align: center;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
        }

        .login-footer p {
          margin: 0 0 4px 0;
          color: #4a5568;
          font-size: 13px;
          font-weight: 600;
        }

        .login-footer small {
          color: #a0aec0;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default Login;
