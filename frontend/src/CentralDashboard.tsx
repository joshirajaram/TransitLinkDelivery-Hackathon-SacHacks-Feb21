import { useEffect, useState } from 'react';
import { apiClient, Order } from './api';

interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  totalRevenue: number;
  doorDashSavings: number;
  totalRestaurants: number;
  avgDeliveryTime: number;
}

interface RestaurantStats {
  id: number;
  name: string;
  totalOrders: number;
  revenue: number;
  feeSaved: number;
}

interface DashboardData {
  stats: {
    total_orders: number;
    total_revenue_cents: number;
    active_orders: number;
    total_restaurants: number;
    avg_delivery_time_mins: number;
  };
  restaurant_performance: Array<{
    restaurant_id: number;
    restaurant_name: string;
    order_count: number;
    revenue_cents: number;
  }>;
  recent_orders: Order[];
}

export default function CentralDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    activeOrders: 0,
    totalRevenue: 0,
    doorDashSavings: 0,
    totalRestaurants: 0,
    avgDeliveryTime: 25,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantStats, setRestaurantStats] = useState<RestaurantStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      // Fetch dashboard data from new admin endpoint
      const response = await apiClient.getDashboardData();
      const data = response.data as DashboardData;

      // Calculate DoorDash savings
      // DoorDash typically charges 30% commission + $2.99-$4.99 delivery + $1.99 service fee
      // TransitLink charges 5% + $0.99 delivery
      // Savings = ~25% of revenue + $2.50 per order
      const doorDashSavings = Math.floor(data.stats.total_revenue_cents * 0.25 + data.stats.total_orders * 250);

      setStats({
        totalOrders: data.stats.total_orders,
        activeOrders: data.stats.active_orders,
        totalRevenue: data.stats.total_revenue_cents,
        doorDashSavings: doorDashSavings,
        totalRestaurants: data.stats.total_restaurants,
        avgDeliveryTime: data.stats.avg_delivery_time_mins,
      });

      // Map restaurant performance
      const restaurantStatsData = data.restaurant_performance.map((r: any) => ({
        id: r.restaurant_id,
        name: r.restaurant_name,
        totalOrders: r.order_count,
        revenue: r.revenue_cents,
        feeSaved: Math.floor(r.revenue_cents * 0.25 + r.order_count * 250), // Same calculation
      }));

      setRestaurantStats(restaurantStatsData);
      setOrders(data.recent_orders);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.detail || 'Failed to load dashboard data');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="central-dashboard">
        <h2>🎯 DDBA Central Dashboard</h2>
        <p>Loading platform analytics...</p>
      </div>
    );
  }

  return (
    <div className="central-dashboard">
      <div className="dashboard-header">
        <h2>🎯 DDBA Central Dashboard</h2>
        <p className="subtitle">
          Davis Downtown Business Association • Empowering Local Restaurants
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-label">Total Revenue</div>
            <div className="metric-value">{formatCurrency(stats.totalRevenue)}</div>
            <div className="metric-info">{stats.totalOrders} orders</div>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon">💵</div>
          <div className="metric-content">
            <div className="metric-label">Saved vs DoorDash</div>
            <div className="metric-value highlight">
              {formatCurrency(stats.doorDashSavings)}
            </div>
            <div className="metric-info">
              ~{((stats.doorDashSavings / (stats.totalRevenue || 1)) * 100).toFixed(0)}% savings
            </div>
          </div>
        </div>

        <div className="metric-card info">
          <div className="metric-icon">📦</div>
          <div className="metric-content">
            <div className="metric-label">Active Orders</div>
            <div className="metric-value">{stats.activeOrders}</div>
            <div className="metric-info">In progress now</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🍽️</div>
          <div className="metric-content">
            <div className="metric-label">Partner Restaurants</div>
            <div className="metric-value">{stats.totalRestaurants}</div>
            <div className="metric-info">Downtown Davis</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🚌</div>
          <div className="metric-content">
            <div className="metric-label">Avg Delivery Time</div>
            <div className="metric-value">{stats.avgDeliveryTime} min</div>
            <div className="metric-info">Via Unitrans</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🌱</div>
          <div className="metric-content">
            <div className="metric-label">Sustainability</div>
            <div className="metric-value">100%</div>
            <div className="metric-info">Zero-emission delivery</div>
          </div>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="value-proposition">
        <h3>💡 Why Local Restaurants Choose TransitLink</h3>
        <div className="comparison-grid">
          <div className="comparison-card doordash">
            <h4>🔴 DoorDash</h4>
            <ul>
              <li>
                <strong>30%</strong> commission per order
              </li>
              <li>
                <strong>$2.99+</strong> delivery fee (to customer)
              </li>
              <li>Additional marketing fees</li>
              <li>No control over pricing</li>
              <li>Car-based delivery emissions</li>
            </ul>
            <div className="comparison-total">
              Total cost: <strong className="bad">~35% of revenue</strong>
            </div>
          </div>

          <div className="comparison-card transitlink">
            <h4>✅ TransitLink (DDBA)</h4>
            <ul>
              <li>
                <strong>5%</strong> platform fee
              </li>
              <li>
                <strong>$0.99</strong> delivery fee (to customer)
              </li>
              <li>No hidden fees</li>
              <li>Full pricing control</li>
              <li>Zero-emission bus delivery</li>
            </ul>
            <div className="comparison-total">
              Total cost: <strong className="good">~7% of revenue</strong>
            </div>
          </div>
        </div>
        <div className="savings-banner">
          🎉 Restaurants save <strong>28%</strong> on every order • Over{' '}
          <strong>{formatCurrency(stats.doorDashSavings)}</strong> saved so far!
        </div>
      </div>

      {/* Restaurant Performance */}
      <div className="restaurant-performance">
        <h3>📊 Restaurant Performance</h3>
        <div className="restaurant-table">
          <table>
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>💰 Saved vs DoorDash</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurantStats.map((restaurant) => (
                <tr key={restaurant.id}>
                  <td>
                    <strong>{restaurant.name}</strong>
                  </td>
                  <td>{restaurant.totalOrders}</td>
                  <td>{formatCurrency(restaurant.revenue)}</td>
                  <td className="savings-cell">
                    {formatCurrency(restaurant.feeSaved)}
                  </td>
                  <td>
                    <a
                      href={`/restaurant/${restaurant.id}`}
                      className="btn-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Page
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders Feed */}
      <div className="orders-feed">
        <h3>📋 Recent Orders</h3>
        <div className="orders-list">
          {orders
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10)
            .map((order) => (
              <div key={order.id} className="order-feed-item">
                <div className="order-feed-icon">
                  {order.status === 'COMPLETED' ? '✅' : '🔄'}
                </div>
                <div className="order-feed-content">
                  <div className="order-feed-header">
                    <strong>{order.restaurant_name}</strong>
                    <span className={`status-badge ${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="order-feed-details">
                    {order.items.length} items • {formatCurrency(order.total_price_cents)} •{' '}
                    {order.stop.name}
                  </div>
                  <div className="order-feed-time">
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
