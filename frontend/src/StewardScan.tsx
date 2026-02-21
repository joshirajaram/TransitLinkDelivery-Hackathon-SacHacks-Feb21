import { useState } from 'react';
import { apiClient, Order } from './api';

export default function StewardScan() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!code.trim()) {
      setError('Please enter a QR code');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiClient.stewardScan(code.trim());
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

  return (
    <div className="steward-scan-view">
      <h2>🚌 Steward Delivery Verification</h2>
      <p className="subtitle">Scan or enter QR code to verify student pickup</p>

      <div className="scan-section">
        <div className="input-group">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter QR code"
            className="scan-input"
            autoFocus
          />
          <button 
            onClick={handleScan} 
            disabled={loading || !code.trim()}
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
          <h3>✅ Order #{result.id} Completed!</h3>
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
          <li>Ask student to show their QR code</li>
          <li>Scan with camera or enter code manually</li>
          <li>Verify student name matches order</li>
          <li>Hand over food package</li>
          <li>Confirm completion in system</li>
        </ul>
      </div>
    </div>
  );
}
