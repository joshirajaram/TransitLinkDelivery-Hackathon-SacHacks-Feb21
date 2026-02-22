import { useEffect, useMemo, useState } from 'react';
import { apiClient, Order, User } from './api';

interface ProfileProps {
  user: User;
  onLogout: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#4ade80', COMPLETE: '#4ade80',
  CANCELLED: '#f87171', NOT_ACCEPTED: '#f87171',
  ON_BUS: '#60a5fa', AT_STOP: '#34d399',
  PREPARING: '#fbbf24', READY_FOR_PICKUP: '#a78bfa',
  ACCEPTED: '#94a3b8',
};

const ROLE_META: Record<string, { icon: string; color: string; label: string }> = {
  STUDENT:          { icon: '🎓', color: '#60a5fa', label: 'UC Davis Student' },
  RESTAURANT_OWNER: { icon: '🍽️', color: '#fbbf24', label: 'Restaurant Partner' },
  STEWARD:          { icon: '🚌', color: '#34d399', label: 'Unitrans Steward'  },
  ADMIN:            { icon: '🎯', color: '#c084fc', label: 'Platform Admin'    },
};

export default function Profile({ user, onLogout }: ProfileProps) {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (user.role === 'STUDENT' || user.role === 'ADMIN') {
      apiClient.getMyOrders()
        .then(res  => { setOrders(res.data); setLoading(false); })
        .catch(err => { setError('Failed to load order history'); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [user]);

  const completedOrders = useMemo(() =>
    orders.filter(o => ['COMPLETED', 'COMPLETE'].includes(o.status)), [orders]);

  const totalSpent = useMemo(() =>
    orders.reduce((s, o) => s + o.total_price_cents, 0), [orders]);

  const co2Saved = (completedOrders.length * 0.42).toFixed(1);   // ~420g per ordre vs car
  const treeDays  = (completedOrders.length * 0.42 / 21).toFixed(2); // trees
  const onTimeRate = orders.length
    ? Math.round((completedOrders.length / orders.length) * 100)
    : 0;

  const roleMeta = ROLE_META[user.role] ?? ROLE_META['STUDENT'];
  const joinDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="profile-page">

      {/* ── HERO ── */}
      <div className="profile-hero">
        <div className="profile-hero-bg" />
        <div className="profile-hero-content">
          <div className="profile-avatar-xl">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-hero-info">
            <h1 className="profile-name">{user.name}</h1>
            <span className="profile-role-tag" style={{ borderColor: roleMeta.color, color: roleMeta.color }}>
              {roleMeta.icon} {roleMeta.label}
            </span>
            <p className="profile-email-txt">✉️ {user.email}</p>
            <p className="profile-joined-txt">📅 Member since {joinDate}</p>
          </div>
          <button className="profile-logout-btn" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      {(user.role === 'STUDENT' || user.role === 'ADMIN') && (
        <div className="profile-stats-strip">
          {[
            { icon: '🛒', value: orders.length,                   label: 'Total Orders',    color: '#60a5fa' },
            { icon: '✅', value: completedOrders.length,           label: 'Delivered',       color: '#4ade80' },
            { icon: '💰', value: `$${(totalSpent/100).toFixed(0)}`, label: 'Total Spent',   color: '#fbbf24' },
            { icon: '⚡', value: `${onTimeRate}%`,                  label: 'On-Time Rate',   color: '#c084fc' },
          ].map(stat => (
            <div key={stat.label} className="profile-stat-pill">
              <div className="profile-stat-icon" style={{ background: `${stat.color}22`, color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <div className="profile-stat-value">{stat.value}</div>
                <div className="profile-stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="profile-grid">
        {/* ── LEFT COLUMN ── */}
        <div className="profile-left">

          {/* Account info */}
          <div className="profile-section-card">
            <h3 className="section-heading">👤 Account Details</h3>
            <div className="profile-info-list">
              {[
                { label: 'Full Name', value: user.name },
                { label: 'Email',    value: user.email },
                { label: 'Role',     value: roleMeta.label },
                { label: 'Account ID', value: `#${user.id ?? 'N/A'}` },
              ].map(row => (
                <div key={row.label} className="profile-info-row">
                  <span className="profile-info-label">{row.label}</span>
                  <span className="profile-info-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eco impact */}
          {(user.role === 'STUDENT' || user.role === 'ADMIN') && completedOrders.length > 0 && (
            <div className="profile-eco-card">
              <div className="eco-header">
                <span className="eco-leaf">🌿</span>
                <div>
                  <h3>Your Eco Impact</h3>
                  <p>By ordering via Unitrans instead of a car service</p>
                </div>
              </div>
              <div className="eco-stats">
                <div className="eco-stat">
                  <span className="eco-big">{co2Saved} kg</span>
                  <span>CO₂ saved</span>
                </div>
                <div className="eco-stat">
                  <span className="eco-big">{treeDays}</span>
                  <span>tree-days equivalent</span>
                </div>
                <div className="eco-stat">
                  <span className="eco-big">{completedOrders.length}</span>
                  <span>green deliveries</span>
                </div>
              </div>
              <div className="eco-bar-wrap">
                <div className="eco-bar" style={{ width: `${Math.min(100, completedOrders.length * 5)}%` }} />
              </div>
              <p className="eco-footnote">
                Unitrans buses run the Davis loop regardless — your order adds zero extra car trips. 🚌
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: ORDER HISTORY ── */}
        <div className="profile-right">
          <div className="profile-section-card">
            <h3 className="section-heading">🧾 Order History</h3>
            {loading ? (
              <div className="skeleton-list">
                {[1,2,3].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : orders.length === 0 ? (
              <div className="profile-empty-orders">
                <span>🍽️</span>
                <p>No orders yet — let's fix that!</p>
                <small>Head to Place Order to get started</small>
              </div>
            ) : (
              <div className="profile-orders-list">
                {[...orders]
                  .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 20)
                  .map(order => (
                  <div key={order.id} className="profile-order-card">
                    <div className="poc-left">
                      <div className="poc-restaurant">{order.restaurant_name}</div>
                      <div className="poc-meta">
                        Order #{order.id} · {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="poc-stop">📍 {order.stop?.name}</div>
                    </div>
                    <div className="poc-right">
                      <span
                        className="poc-status"
                        style={{
                          background: `${STATUS_COLOR[order.status] ?? '#94a3b8'}22`,
                          color: STATUS_COLOR[order.status] ?? '#94a3b8',
                          borderColor: `${STATUS_COLOR[order.status] ?? '#94a3b8'}44`,
                        }}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                      <div className="poc-price">${(order.total_price_cents / 100).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
