import { useEffect, useState } from 'react';
import { apiClient, Restaurant, Stop, Window, Order, User } from './api';
import { QRCode } from 'react-qrcode-logo';

export default function StudentOrder() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get current user
  const user: User | null = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    Promise.all([
      apiClient.getRestaurants(),
      apiClient.getStops(),
      apiClient.getWindows(),
    ]).then(([resRes, stopRes, winRes]) => {
      setRestaurants(resRes.data);
      setStops(stopRes.data);
      setWindows(winRes.data);
    }).catch(err => {
      setError('Failed to load data: ' + err.message);
    });
  }, []);

  const currentRestaurant = restaurants.find(r => r.id === selectedRestaurant);

  const handleQuantityChange = (id: number, value: number) => {
    setQuantities(q => ({ ...q, [id]: Math.max(0, value) }));
  };

  const placeOrder = async () => {
    if (!selectedRestaurant || !selectedStop || !selectedWindow) {
      setError('Please select restaurant, stop, and time window');
      return;
    }

    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({
        menu_item_id: Number(id),
        quantity: qty,
      }));

    if (items.length === 0) {
      setError('Please select at least one item');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.createOrder({
        student_id: user?.id || 1, // Backend will override with authenticated user
        restaurant_id: selectedRestaurant,
        stop_id: selectedStop,
        window_id: selectedWindow,
        items,
      });
      setOrder(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const resetOrder = () => {
    setOrder(null);
    setQuantities({});
    setSelectedRestaurant(null);
    setSelectedStop(null);
    setSelectedWindow(null);
  };

  const getStatusMessage = (status: string): string => {
    switch (status) {
      case 'ACCEPTED': return '✅ Order received by restaurant';
      case 'PREPARING': return '👨‍🍳 Your food is being prepared';
      case 'READY_FOR_PICKUP': return '📦 Order ready, waiting for steward pickup';
      case 'ON_BUS': return '🚌 On the bus! Heading to your stop';
      case 'AT_STOP': return '📍 Arrived at your stop!';
      case 'COMPLETED': return '✨ Order delivered!';
      default: return 'Processing...';
    }
  };

  const getETA = (status: string): string => {
    switch (status) {
      case 'ACCEPTED': return '25-35 min';
      case 'PREPARING': return '20-30 min';
      case 'READY_FOR_PICKUP': return '15-20 min';
      case 'ON_BUS': return '10-15 min';
      case 'AT_STOP': return '0-5 min';
      case 'COMPLETED': return 'Delivered';
      default: return 'Calculating...';
    }
  };

  const getProgressPercentage = (status: string): number => {
    switch (status) {
      case 'ACCEPTED': return 20;
      case 'PREPARING': return 40;
      case 'READY_FOR_PICKUP': return 60;
      case 'ON_BUS': return 80;
      case 'AT_STOP': return 95;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  };

  if (order) {
    return (
      <div className="student-order-view">
        <div className="order-confirmation">
          <h2>✅ Order Confirmed!</h2>
          <div className="order-details">
            <p><strong>Order #{order.id}</strong></p>
            <p>Restaurant: {order.restaurant_name}</p>
            <p>Pickup: {order.stop.name} ({order.stop.code})</p>
            <p>Time Window: {order.window.label} ({order.window.start_time.slice(0, 5)}–{order.window.end_time.slice(0, 5)})</p>
            
            <div className="status-tracker">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${getProgressPercentage(order.status)}%` }}
                ></div>
              </div>
              
              <div className="status-current">
                <span className="status-badge">{order.status}</span>
                <p className="status-message">{getStatusMessage(order.status)}</p>
              </div>
              {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                <div className="eta-display">
                  <span className="eta-label">⏱️ Estimated Time:</span>
                  <span className="eta-value">{getETA(order.status)}</span>
                </div>
              )}
            </div>
            
            <div className="order-items">
              <h3>Items:</h3>
              {order.items.map((item, idx) => (
                <div key={idx} className="order-item">
                  {item.quantity}x {item.menu_item_name} - ${(item.price_cents / 100).toFixed(2)}
                </div>
              ))}
            </div>

            <div className="order-pricing">
              <div className="price-row">
                <span>Food Total:</span>
                <span>${(order.total_price_cents / 100).toFixed(2)}</span>
              </div>
              <div className="price-row">
                <span>Delivery Fee:</span>
                <span>${(order.delivery_fee_cents / 100).toFixed(2)}</span>
              </div>
              <div className="price-row total">
                <span><strong>Total:</strong></span>
                <span><strong>${((order.total_price_cents + order.delivery_fee_cents) / 100).toFixed(2)}</strong></span>
              </div>
            </div>

            <div className="qr-section">
              <h3>Show this at the bus stop:</h3>
              <div className="qr-code-wrapper">
                <QRCode 
                  value={order.qr_code}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  ecLevel="M"
                />
              </div>
              <p className="qr-code-text">Code: <strong>{order.qr_code}</strong></p>
            </div>

            <button onClick={resetOrder} className="btn-secondary">Place Another Order</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-order-view">
      <h2>Order via Unitrans</h2>
      <p className="subtitle">Low-cost, eco-friendly delivery to your nearest bus stop</p>

      {error && <div className="error-message">{error}</div>}

      <div className="order-form">
        <div className="form-section">
          <h3>1. Choose Restaurant</h3>
          <select
            value={selectedRestaurant ?? ''}
            onChange={e => setSelectedRestaurant(Number(e.target.value))}
            className="select-input"
          >
            <option value="">-- Select Restaurant --</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} {r.description && `- ${r.description}`}
              </option>
            ))}
          </select>
        </div>

        {currentRestaurant && (
          <div className="form-section">
            <h3>2. Choose Items</h3>
            <div className="menu-items">
              {currentRestaurant.menu_items.map(mi => (
                <div key={mi.id} className="menu-item">
                  <div className="menu-item-info">
                    <strong>{mi.name}</strong>
                    {mi.description && <p className="item-description">{mi.description}</p>}
                    <span className="item-price">${(mi.price_cents / 100).toFixed(2)}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={quantities[mi.id] ?? 0}
                    onChange={e => handleQuantityChange(mi.id, Number(e.target.value))}
                    className="quantity-input"
                  />
                </div>
              ))}
            </div>
            <p className="delivery-fee-note">
              Delivery fee: ${(currentRestaurant.delivery_fee_cents / 100).toFixed(2)}
            </p>
          </div>
        )}

        <div className="form-section">
          <h3>3. Choose Pickup Stop</h3>
          <select
            value={selectedStop ?? ''}
            onChange={e => setSelectedStop(Number(e.target.value))}
            className="select-input"
          >
            <option value="">-- Select Stop --</option>
            {stops.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} – {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-section">
          <h3>4. Choose Time Window</h3>
          <select
            value={selectedWindow ?? ''}
            onChange={e => setSelectedWindow(Number(e.target.value))}
            className="select-input"
          >
            <option value="">-- Select Window --</option>
            {windows.map(w => (
              <option key={w.id} value={w.id}>
                {w.label} ({w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)})
              </option>
            ))}
          </select>
        </div>

        <button 
          onClick={placeOrder} 
          disabled={loading || !selectedRestaurant || !selectedStop || !selectedWindow}
          className="btn-primary"
        >
          {loading ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>
    </div>
  );
}
