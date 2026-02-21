import { useEffect, useState } from 'react';
import { apiClient, Restaurant, Stop, Window, Order } from './api';
import { QRCode } from 'react-qrcode-logo';

interface RestaurantPageProps {
  restaurantId: number;
}

export default function RestaurantPage({ restaurantId }: RestaurantPageProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    // Load restaurant, stops, and windows
    Promise.all([
      apiClient.getRestaurants(),
      apiClient.getStops(),
      apiClient.getWindows(),
    ])
      .then(([resRes, stopRes, winRes]) => {
        const rest = resRes.data.find((r) => r.id === restaurantId);
        if (rest) {
          setRestaurant(rest);
        } else {
          setError('Restaurant not found');
        }
        setStops(stopRes.data);
        setWindows(winRes.data);
      })
      .catch((err) => {
        setError('Failed to load restaurant: ' + err.message);
      });
  }, [restaurantId]);

  const handleQuantityChange = (id: number, value: number) => {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, value) }));
  };

  const placeOrder = async () => {
    if (!user) {
      setError('Please log in to place an order');
      return;
    }

    if (!selectedStop || !selectedWindow) {
      setError('Please select delivery stop and time window');
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
        student_id: user.id,
        restaurant_id: restaurantId,
        stop_id: selectedStop,
        window_id: selectedWindow,
        items,
      });
      setOrder(res.data);
      setQuantities({});
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = restaurant
    ? Object.entries(quantities).reduce((sum, [id, qty]) => {
        const item = restaurant.menu_items.find((i) => i.id === Number(id));
        return sum + (item?.price_cents || 0) * qty;
      }, 0)
    : 0;

  const deliveryFee = restaurant?.delivery_fee_cents || 0;
  const total = subtotal + deliveryFee;

  // DoorDash comparison
  const doorDashFee = Math.max(299, subtotal * 0.15); // $2.99 or 15% of subtotal
  const doorDashTotal = subtotal + doorDashFee + 199; // + $1.99 service fee
  const savings = doorDashTotal - total;

  if (error && !restaurant) {
    return (
      <div className="restaurant-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="restaurant-page">
        <p>Loading restaurant...</p>
      </div>
    );
  }

  if (order) {
    return (
      <div className="restaurant-page">
        <div className="order-success">
          <h2>✅ Order Confirmed!</h2>
          <p>
            Your order from <strong>{restaurant.name}</strong> has been placed.
          </p>

          <div className="order-details-card">
            <h3>Order #{order.id}</h3>
            <div className="order-items">
              {order.items.map((item, idx) => (
                <div key={idx} className="order-item-row">
                  <span>
                    {item.quantity}x {item.menu_item_name}
                  </span>
                  <span>${(item.price_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="order-total">
              <strong>Total: ${(order.total_price_cents / 100).toFixed(2)}</strong>
            </div>

            <div className="delivery-info">
              <p>
                <strong>Pickup Location:</strong> {order.stop.name}
              </p>
              <p>
                <strong>Time Window:</strong> {order.window.label}
              </p>
            </div>

            <div className="qr-section">
              <h4>Your Pickup QR Code</h4>
              <p>Show this to the steward when picking up your order</p>
              <div className="qr-container">
                <QRCode
                  value={order.qr_code}
                  size={200}
                  ecLevel="H"
                  logoImage="/logo.png"
                  logoWidth={40}
                  logoHeight={40}
                  qrStyle="squares"
                />
              </div>
              <div className="qr-code-text">{order.qr_code}</div>
            </div>
          </div>

          <button onClick={() => setOrder(null)} className="btn-secondary">
            Place Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="restaurant-page">
      {/* Restaurant Header */}
      <div className="restaurant-header">
        <h1>{restaurant.name}</h1>
        <p className="restaurant-description">{restaurant.description}</p>
        <div className="restaurant-meta">
          <span>📍 {restaurant.name}</span>
          <span>🚌 Delivery via Unitrans</span>
          <span>
            💰 Save ${(savings / 100).toFixed(2)} vs DoorDash
          </span>
        </div>
      </div>

      {/* DDBA Banner */}
      <div className="ddba-banner">
        <div className="ddba-logo">🏪</div>
        <div className="ddba-content">
          <h3>Davis Downtown Business Association Partner</h3>
          <p>
            Supporting local restaurants • Lower fees than DoorDash • Eco-friendly delivery
          </p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Menu */}
      <div className="menu-section">
        <h2>Menu</h2>
        <div className="menu-grid">
          {restaurant.menu_items.map((item) => (
            <div key={item.id} className="menu-item-card">
              <div className="menu-item-info">
                <h3>{item.name}</h3>
                {item.description && <p>{item.description}</p>}
                <div className="menu-item-price">
                  ${(item.price_cents / 100).toFixed(2)}
                </div>
              </div>
              <div className="menu-item-controls">
                <button
                  onClick={() =>
                    handleQuantityChange(item.id, (quantities[item.id] || 0) - 1)
                  }
                  disabled={!quantities[item.id]}
                  className="qty-btn"
                >
                  −
                </button>
                <span className="qty-display">{quantities[item.id] || 0}</span>
                <button
                  onClick={() =>
                    handleQuantityChange(item.id, (quantities[item.id] || 0) + 1)
                  }
                  className="qty-btn"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Options */}
      {subtotal > 0 && (
        <div className="delivery-section">
          <h2>Delivery Options</h2>

          <div className="form-section">
            <label>Pickup Location</label>
            <select
              value={selectedStop || ''}
              onChange={(e) => setSelectedStop(Number(e.target.value))}
              className="select-input"
            >
              <option value="">Select a stop...</option>
              {stops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.name} ({stop.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <label>Time Window</label>
            <select
              value={selectedWindow || ''}
              onChange={(e) => setSelectedWindow(Number(e.target.value))}
              className="select-input"
            >
              <option value="">Select a time...</option>
              {windows.map((window) => (
                <option key={window.id} value={window.id}>
                  {window.label} ({window.start_time} - {window.end_time})
                </option>
              ))}
            </select>
          </div>

          {/* Order Summary */}
          <div className="order-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>${(subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Delivery Fee</span>
              <span>${(deliveryFee / 100).toFixed(2)}</span>
            </div>
            <div className="summary-row savings-row">
              <span>💰 Savings vs DoorDash</span>
              <span className="savings">${(savings / 100).toFixed(2)}</span>
            </div>
            <div className="summary-row total-row">
              <strong>Total</strong>
              <strong>${(total / 100).toFixed(2)}</strong>
            </div>

            <button
              onClick={placeOrder}
              disabled={!selectedStop || !selectedWindow || loading}
              className="btn-order"
            >
              {loading ? 'Placing Order...' : 'Place Order 🚌'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
