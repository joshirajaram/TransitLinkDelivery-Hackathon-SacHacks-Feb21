import { useEffect, useState } from 'react';
import { apiClient, Order, Restaurant } from './api';

const STATUS_ORDER = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'ON_BUS',
  'AT_STOP',
  'COMPLETED',
  'CANCELLED'
];

export default function RestaurantDashboard() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  // Load restaurant info
  useEffect(() => {
    apiClient.getMyRestaurant()
      .then(res => {
        setRestaurant(res.data);
      })
      .catch(err => {
        setError('Failed to load restaurant: ' + (err.response?.data?.detail || err.message));
        setLoading(false);
      });
  }, []);

  const loadOrders = async () => {
    if (!restaurant) return;
    
    try {
      const res = await apiClient.getRestaurantOrders(restaurant.id);
      setOrders(res.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setError(null);
    } catch (err: any) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurant) return;
    
    loadOrders();
    // Refresh orders every 10 seconds
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [restaurant]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    setUpdating(orderId);
    try {
      await apiClient.updateOrderStatus(orderId, newStatus);
      await loadOrders();
    } catch (err: any) {
      setError('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_ORDER.length - 2) return null;
    return STATUS_ORDER[currentIndex + 1];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING': return '#FFA500';
      case 'ACCEPTED': return '#4CAF50';
      case 'PREPARING': return '#2196F3';
      case 'READY_FOR_PICKUP': return '#9C27B0';
      case 'ON_BUS': return '#FF9800';
      case 'AT_STOP': return '#3F51B5';
      case 'COMPLETED': return '#4CAF50';
      case 'CANCELLED': return '#F44336';
      default: return '#757575';
    }
  };

  if (loading) {
    return <div className="restaurant-dashboard"><p>Loading...</p></div>;
  }

  if (!restaurant) {
    return <div className="restaurant-dashboard"><p className="error-message">No restaurant found</p></div>;
  }

  return (
    <div className="restaurant-dashboard">
      <h2>🍽️ Restaurant Dashboard</h2>
      <p className="subtitle">{restaurant.name} - Manage your orders</p>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-number">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{orders.filter(o => ['PENDING', 'ACCEPTED', 'PREPARING'].includes(o.status)).length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{orders.filter(o => o.status === 'COMPLETED').length}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      <div className="orders-list">
        {orders.length === 0 ? (
          <p className="empty-state">No orders yet. Waiting for customers...</p>
        ) : (
          orders.map(order => {
            const nextStatus = getNextStatus(order.status);
            return (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <h3>Order #{order.id}</h3>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="order-details">
                  <div className="detail-row">
                    <span>Time:</span>
                    <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="detail-row">
                    <span>Window:</span>
                    <span>{order.window.label} ({order.window.start_time.slice(0, 5)}–{order.window.end_time.slice(0, 5)})</span>
                  </div>
                  <div className="detail-row">
                    <span>Drop-off:</span>
                    <span>{order.stop.name} ({order.stop.code})</span>
                  </div>
                  <div className="detail-row highlight">
                    <span>📦 Package QR Code:</span>
                    <span className="qr-code-large">{order.qr_code}</span>
                  </div>
                </div>

                <div className="order-items">
                  <h4>Items:</h4>
                  {order.items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <span>{item.quantity}x {item.menu_item_name}</span>
                      <span>${(item.price_cents * item.quantity / 100).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="item-row total">
                    <strong>Total:</strong>
                    <strong>${(order.total_price_cents / 100).toFixed(2)}</strong>
                  </div>
                </div>

                {nextStatus && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleStatusChange(order.id, nextStatus)}
                    disabled={updating === order.id}
                    className="btn-primary"
                  >
                    {updating === order.id ? 'Updating...' : `Mark as ${nextStatus.replace(/_/g, ' ')}`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
