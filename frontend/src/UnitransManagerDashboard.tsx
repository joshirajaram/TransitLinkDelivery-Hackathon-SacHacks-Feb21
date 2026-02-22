import { useEffect, useMemo, useState } from 'react';
import { apiClient, Order } from './api';

const ACTIVE_STATUSES = ['READY_FOR_PICKUP', 'ON_BUS', 'AT_STOP'];
const ROUTE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'G', 'J', 'K', 'L', 'P', 'Q', 'S', 'T', 'U', 'V', 'W', 'X', 'Z'];

export default function UnitransManagerDashboard() {
  const [route, setRoute] = useState('');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const loadOrders = async () => {
    if (!route.trim()) {
      setActiveOrders([]);
      setCompletedOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getStewardOrders(route.trim() || undefined);
      setActiveOrders(res.data.active_orders || []);
      setCompletedOrders(res.data.completed_orders || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 12000);
    return () => clearInterval(interval);
  }, [route]);

  const filteredActive = useMemo(
    () => activeOrders.filter(order => ACTIVE_STATUSES.includes(order.status)),
    [activeOrders]
  );

  return (
    <div className="restaurant-dashboard">
      <h2>🚌 Unitrans Order Manager</h2>
      <p className="subtitle">Monitor downtown pickups and delivery history</p>
      <p className="subtitle">Use Steward Scan to load and complete orders</p>

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
          <button onClick={loadOrders} className="btn-primary" disabled={loading || !route.trim()}>
            {loading ? 'Refreshing...' : 'Fetch Orders'}
          </button>
        </div>
      </div>

      <div className="nav-tabs manager-tabs">
        <button
          onClick={() => setTab('active')}
          className={tab === 'active' ? 'active' : ''}
        >
          Active Orders
        </button>
        <button
          onClick={() => setTab('completed')}
          className={tab === 'completed' ? 'active' : ''}
        >
          Completed History
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {tab === 'active' && (
        <div className="orders-list">
          {!route.trim() ? (
            <p className="empty-state">Select a route to see active orders.</p>
          ) : filteredActive.length === 0 ? (
            <p className="empty-state">No active orders for this route.</p>
          ) : (
            <>
              <div className="order-card">
                <div className="order-header">
                  <h3>Downtown Pickup List</h3>
                </div>
                <div className="order-details">
                  {filteredActive.filter(order => order.status === 'READY_FOR_PICKUP').length === 0 ? (
                    <p className="empty-state">No ready orders to load.</p>
                  ) : (
                    filteredActive
                      .filter(order => order.status === 'READY_FOR_PICKUP')
                      .map(order => (
                        <div key={`pickup-${order.id}`} className="detail-row">
                          <span>Order #{order.id}</span>
                          <span>{order.stop.code} – {order.stop.name}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
              {filteredActive.map(order => {
              return (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <h3>Order #{order.id}</h3>
                  <span className="status-badge">{order.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="order-details">
                  <div className="detail-row">
                    <span>Restaurant:</span>
                    <span>{order.restaurant_name}</span>
                  </div>
                  <div className="detail-row">
                    <span>Stop:</span>
                    <span>{order.stop.code} – {order.stop.name}</span>
                  </div>
                  <div className="detail-row">
                    <span>Route:</span>
                    <span>{order.bus_route_tag?.toUpperCase() || 'Unassigned'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Window:</span>
                    <span>{order.window.label} ({order.window.start_time.slice(0, 5)}–{order.window.end_time.slice(0, 5)})</span>
                  </div>
                  <div className="detail-row">
                    <span>Placed:</span>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              );
              })}
            </>
          )}
        </div>
      )}

      {tab === 'completed' && (
        <div className="orders-list">
          {!route.trim() ? (
            <p className="empty-state">Select a route to see completed orders.</p>
          ) : completedOrders.length === 0 ? (
            <p className="empty-state">No completed orders yet.</p>
          ) : (
            completedOrders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <h3>Order #{order.id}</h3>
                  <span className="status-badge status-completed">{order.status}</span>
                </div>
                <div className="order-details">
                  <div className="detail-row">
                    <span>Restaurant:</span>
                    <span>{order.restaurant_name}</span>
                  </div>
                  <div className="detail-row">
                    <span>Stop:</span>
                    <span>{order.stop.code} – {order.stop.name}</span>
                  </div>
                  <div className="detail-row">
                    <span>Completed:</span>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
