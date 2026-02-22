import { useEffect, useState } from 'react';
import { apiClient, Order, Restaurant } from './api';

const STATUS_ORDER = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'NOT_ACCEPTED',
  'CANCELLED'
];

interface QRCodeData {
  qr_code: string;
  qr_data_url: string;
}

export default function RestaurantDashboard() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [qrCodes, setQrCodes] = useState<{ [key: number]: QRCodeData }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

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
      const sortedOrders = res.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(sortedOrders);
      setError(null);
      
      // Load QR codes for orders that need them
      for (const order of sortedOrders) {
        if (!qrCodes[order.id]) {
          try {
            const qrRes = await apiClient.getOrderQRCode(order.id);
            setQrCodes(prev => ({ ...prev, [order.id]: qrRes.data }));
          } catch (err) {
            // Silently fail, not critical
          }
        }
      }
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

  const handleDecision = async (orderId: number, accepted: boolean) => {
    if (accepted) {
      await handleStatusChange(orderId, 'PREPARING');
    } else {
      await handleStatusChange(orderId, 'NOT_ACCEPTED');
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
      case 'NOT_ACCEPTED': return '#EF4444';
      case 'CANCELLED': return '#F44336';
      default: return '#757575';
    }
  };

  const formatETA = (eta: string | undefined): string => {
    if (!eta) return 'N/A';
    const etaDate = new Date(eta);
    const now = new Date();
    const diffMs = etaDate.getTime() - now.getTime();
    const diffMins = Math.max(0, Math.round(diffMs / 60000));
    return `${diffMins} min`;
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
          <div className="stat-number">{orders.filter(o => ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'ON_BUS', 'AT_STOP'].includes(o.status)).length}</div>
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
            const qrData = qrCodes[order.id];
            const isExpanded = expandedOrder === order.id;
            
            return (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div style={{ flex: 1 }}>
                    <h3>Order #{order.id}</h3>
                    {order.estimated_delivery_time && (
                      <p style={{ fontSize: '0.9em', color: '#666', margin: '4px 0 0 0' }}>
                        ⏱️ ETA: {formatETA(order.estimated_delivery_time)}
                      </p>
                    )}
                  </div>
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
                  
                  {/* QR Code Section */}
                  <div className="detail-row highlight" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ marginBottom: '8px' }}>📦 Package QR Code:</span>
                    {qrData && qrData.qr_data_url ? (
                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'center',
                        backgroundColor: '#f5f5f5',
                        padding: '8px',
                        borderRadius: '4px'
                      }}>
                        <img 
                          src={qrData.qr_data_url} 
                          alt="QR Code" 
                          style={{ width: '100px', height: '100px' }}
                        />
                        <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                          {order.qr_code}
                        </code>
                      </div>
                    ) : (
                      <span className="qr-code-large">{order.qr_code}</span>
                    )}
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

                {/* Status Timeline */}
                <div style={{ 
                  fontSize: '12px', 
                  marginTop: '12px', 
                  padding: '8px', 
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px'
                }}>
                  <div style={{ marginBottom: '6px' }}>📅 Status Timeline:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px' }}>
                    <div>✓ Accepted: {order.accepted_at ? new Date(order.accepted_at).toLocaleTimeString() : '-'}</div>
                    <div>✓ Ready: {order.ready_at ? new Date(order.ready_at).toLocaleTimeString() : '-'}</div>
                    <div>✓ On Bus: {order.on_bus_at ? new Date(order.on_bus_at).toLocaleTimeString() : '-'}</div>
                    <div>✓ Done: {order.completed_at ? new Date(order.completed_at).toLocaleTimeString() : '-'}</div>
                  </div>
                </div>

                {order.status === 'PENDING' ? (
                  <div className="order-accept">
                    <span className="order-accept-label">Accept this order?</span>
                    <div className="order-accept-actions">
                      <button
                        onClick={() => handleDecision(order.id, true)}
                        disabled={updating === order.id}
                        className="btn-primary"
                      >
                        {updating === order.id ? 'Updating...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleDecision(order.id, false)}
                        disabled={updating === order.id}
                        className="btn-secondary"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : order.status === 'PREPARING' ? (
                  <button
                    onClick={() => handleStatusChange(order.id, 'READY_FOR_PICKUP')}
                    disabled={updating === order.id}
                    className="btn-primary"
                    style={{ marginTop: '12px', width: '100%' }}
                  >
                    {updating === order.id ? 'Updating...' : 'Mark as READY FOR PICKUP'}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
