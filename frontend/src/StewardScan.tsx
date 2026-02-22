import { useMemo, useState } from 'react';
import { apiClient, Order } from './api';

const ROUTE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'G', 'J', 'K', 'L', 'P', 'Q', 'S', 'T', 'U', 'V', 'W', 'X', 'Z'];

export default function StewardScan() {
  const [code, setCode] = useState('');
  const [route, setRoute] = useState('');
  const [busId, setBusId] = useState('');
  const [result, setResult] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!code.trim()) {
      setError('Please enter a QR code');
      return;
    }
    if (!route.trim()) {
      setError('Please select your route');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.stewardScan(code.trim(), route.trim(), busId.trim() || undefined);
      setResult(res.data);
      setCode(''); // Clear input after successful scan
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Invalid code or error scanning';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const statusMessage = useMemo(() => {
    if (!result) return '';
    if (result.status === 'ON_BUS') return '📦 Order loaded on bus.';
    if (result.status === 'COMPLETED') return '✅ Order completed.';
    return `Status: ${result.status}`;
  }, [result]);

  return (
    <div className="steward-scan-view">
      <h2>🚌 Steward Delivery Verification</h2>
      <p className="subtitle">Scan at pickup to load, scan again to complete</p>

      <div className="scan-section">
        <div className="input-group">
          <select
            value={route}
            onChange={e => setRoute(e.target.value)}
            className="select-input"
          >
            <option value="">Select your route</option>
            {ROUTE_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter QR code"
            className="scan-input"
            autoFocus
          />
          <input
            type="text"
            value={busId}
            onChange={e => setBusId(e.target.value)}
            placeholder="Bus ID (optional)"
            className="scan-input"
          />
          <button 
            onClick={handleScan} 
            disabled={loading || !code.trim() || !route.trim()}
            className="btn-primary"
          >
            {loading ? 'Verifying...' : 'Verify Pickup'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <h3>Order #{result.id}</h3>
          <p>{statusMessage}</p>
          <div className="order-summary">
            <div className="summary-row">
              <span>Restaurant:</span>
              <strong>{result.restaurant_name}</strong>
            </div>
            <div className="summary-row">
              <span>Stop:</span>
              <strong>{result.stop.name}</strong>
            </div>
            <div className="summary-row">
              <span>Status:</span>
              <span className="status-badge status-completed">{result.status}</span>
            </div>
            <div className="summary-row">
              <span>Items:</span>
              <div className="items-list">
                {result.items.map((item, idx) => (
                  <div key={idx}>
                    {item.quantity}x {item.menu_item_name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="instructions">
        <h3>Instructions:</h3>
        <ul>
          <li>Select the route you are operating</li>
          <li>Scan at the restaurant to mark ON BUS</li>
          <li>Scan again at drop-off to complete</li>
          <li>Verify student matches the order</li>
        </ul>
      </div>
    </div>
  );
}
