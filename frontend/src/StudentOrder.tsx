import { useCallback, useEffect, useMemo, useState } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apiClient, Restaurant, Stop, Window, Order, User, BusLocation } from './api';
import { QRCode } from 'react-qrcode-logo';

type StudentOrderProps = {
  mode?: 'track' | 'place';
};

export default function StudentOrder({ mode = 'place' }: StudentOrderProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [lastOrdersRefresh, setLastOrdersRefresh] = useState<Date | null>(null);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [busLoading, setBusLoading] = useState(false);
  const [lastBusRefresh, setLastBusRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<Order | null>(null);
  const [internalMode, setInternalMode] = useState<'place' | 'track'>(mode);
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Get current user
  const user: User | null = useMemo(
    () => JSON.parse(localStorage.getItem('user') || 'null'),
    []
  );

  const refreshOrders = useCallback(async (showLoading = false) => {
    if (!user) {
      return;
    }
    if (showLoading) {
      setOrdersLoading(true);
    }
    try {
      const res = await apiClient.getMyOrders();
      setOrders(res.data);
      setLastOrdersRefresh(new Date());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load orders');
    } finally {
      if (showLoading) {
        setOrdersLoading(false);
      }
    }
  }, [user?.id]);

  const refreshBusLocations = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setBusLoading(true);
    }
    try {
      const res = await apiClient.getBusLocations();
      setBusLocations(res.data);
      setLastBusRefresh(new Date());
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load bus locations');
    } finally {
      if (showLoading) {
        setBusLoading(false);
      }
    }
  }, []);

  const activeOrder = useMemo(
    () => orders.find(o => !['COMPLETED', 'COMPLETE', 'CANCELLED'].includes(o.status)),
    [orders]
  );

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );

  const assignedBusLocations = useMemo(() => {
    if (!activeOrder?.bus_id) {
      return [];
    }
    return busLocations.filter((bus) => bus.vehicle_id === activeOrder.bus_id);
  }, [activeOrder?.bus_id, busLocations]);

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    // Handle ISO string properly - ensure it's interpreted as local time
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Check if a delivery window is still available for today
  const isWindowAvailableToday = (window: Window): boolean => {
    const now = new Date();
    const [endHours, endMinutes, endSeconds] = window.end_time.split(':').map(Number);
    
    const endTimeToday = new Date();
    endTimeToday.setHours(endHours, endMinutes, endSeconds, 0);
    
    // Window is available if current time is before window end time
    return now < endTimeToday;
  };

  // Get reason why window is unavailable
  const getWindowUnavailableReason = (window: Window): string => {
    const now = new Date();
    const [endHours, endMinutes] = window.end_time.split(':').map(Number);
    
    const endTimeToday = new Date();
    endTimeToday.setHours(endHours, endMinutes, 0, 0);
    
    if (now >= endTimeToday) {
      return `${window.label} expired at ${window.end_time.slice(0, 5)}`;
    }
    return '';
  };

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

  useEffect(() => {
    if (!user) {
      return;
    }
    refreshOrders(true);
    const interval = setInterval(() => refreshOrders(false), 10000);
    return () => clearInterval(interval);
  }, [refreshOrders, user]);

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'ON_BUS') {
      setBusLocations([]);
      return;
    }
    refreshBusLocations(true);
    const interval = setInterval(() => refreshBusLocations(false), 15000);
    return () => clearInterval(interval);
  }, [activeOrder, refreshBusLocations]);

  const currentRestaurant = restaurants.find(r => r.id === selectedRestaurant);

  const handleQuantityChange = (id: number, value: number) => {
    setQuantities(q => ({ ...q, [id]: Math.max(0, value) }));
  };

  const placeOrder = async () => {
    if (!selectedRestaurant || !selectedStop || !selectedWindow) {
      setError('Please select restaurant, stop, and time window');
      return;
    }

    // Check if selected window is still available
    const selectedWindowObj = windows.find(w => w.id === selectedWindow);
    if (selectedWindowObj && !isWindowAvailableToday(selectedWindowObj)) {
      setError(`❌ ${selectedWindowObj.label} delivery window has closed for today. Please select another time window or try tomorrow.`);
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
      setOrders(prev => [res.data, ...prev]);
      refreshOrders(false);
      setOrderSuccess(res.data);
      resetOrder();
      // Switch to order-tracking tab
      setInternalMode('track');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const resetOrder = () => {
    setQuantities({});
    setSelectedRestaurant(null);
    setSelectedStop(null);
    setSelectedWindow(null);
  };

  const FILTERS = [
    { key: 'all',         label: 'All',           emoji: '🍽️' },
    { key: 'vegan',       label: 'Vegan',         emoji: '🌱' },
    { key: 'vegetarian',  label: 'Vegetarian',    emoji: '🥗' },
    { key: 'non-veg',     label: 'Non-Veg',       emoji: '🍖' },
    { key: 'beverages',   label: 'Beverages',     emoji: '🥤' },
    { key: 'breakfast',   label: 'Breakfast',     emoji: '🍳' },
    { key: 'spicy',       label: 'Spicy',         emoji: '🌶️' },
    { key: 'gluten-free', label: 'Gluten-Free',   emoji: '🌾' },
    { key: 'staff-pick',  label: 'Staff Pick',    emoji: '⭐' },
    { key: 'ucd-favorite',label: 'UCD Fav',       emoji: '🎓' },
  ];

  const hasItemWithTag = (r: typeof restaurants[0], tag: string) =>
    tag === 'all' || r.menu_items.some(mi => mi.tags?.split(',').map(t => t.trim()).includes(tag));

  const filteredRestaurants = restaurants.filter(r => hasItemWithTag(r, activeFilter));

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

  const normalizeStatus = (status: string) => (status === 'COMPLETE' ? 'COMPLETED' : status);

  const getStatusMessage = (status: string): string => {
    switch (normalizeStatus(status)) {
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
    switch (normalizeStatus(status)) {
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
    switch (normalizeStatus(status)) {
      case 'ACCEPTED': return 20;
      case 'PREPARING': return 40;
      case 'READY_FOR_PICKUP': return 60;
      case 'ON_BUS': return 80;
      case 'AT_STOP': return 95;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  };

  return (
    <div className="student-order-view">
      <h2>Order via Unitrans</h2>
      <p className="subtitle">Low-cost, eco-friendly delivery to your nearest bus stop</p>

      {orderSuccess && (
        <div className="order-success-banner">
          <button className="order-success-dismiss" onClick={() => setOrderSuccess(null)}>×</button>
          <div className="order-success-icon">🎉</div>
          <div className="order-success-body">
            <strong>Order #{orderSuccess.id} placed successfully!</strong>
            <p>
              {orderSuccess.restaurant_name} → {orderSuccess.stop?.name} &middot;
              &nbsp;ETA ~25 min
            </p>
          </div>
          <button
            className="order-success-track-btn"
            onClick={() => { setOrderSuccess(null); setInternalMode('track'); }}
          >
            Track order →
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {internalMode === 'track' && (
        <>
          {activeOrder ? (
            <div className="order-confirmation">
              <h2>📡 Current Active Order</h2>
              <div className="order-details">
                <p><strong>Order #{activeOrder.id}</strong></p>
                <p>Restaurant: {activeOrder.restaurant_name}</p>
                <p>Pickup: {activeOrder.stop.name} ({activeOrder.stop.code})</p>
                <p>Time Window: {activeOrder.window.label} ({activeOrder.window.start_time.slice(0, 5)}–{activeOrder.window.end_time.slice(0, 5)})</p>
                <p>Placed: {formatDateTime(activeOrder.created_at)}</p>
                {activeOrder.estimated_delivery_time && (
                  <p>📦 Expected delivery: {formatDateTime(activeOrder.estimated_delivery_time)}</p>
                )}
                {activeOrder.qr_code && (
                  <div style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '8px', 
                    borderRadius: '4px',
                    marginTop: '8px'
                  }}>
                    <p><strong>🔍 Package Code:</strong></p>
                    <p style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {activeOrder.qr_code}
                    </p>
                  </div>
                )}

                <div className="status-tracker">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${getProgressPercentage(activeOrder.status)}%` }}
                    ></div>
                  </div>

                  <div className="status-current">
                    <span className="status-badge">{activeOrder.status}</span>
                    <p className="status-message">{getStatusMessage(activeOrder.status)}</p>
                  </div>
                  {activeOrder.status !== 'COMPLETED' && activeOrder.status !== 'CANCELLED' && (
                    <div className="eta-display">
                      <span className="eta-label">⏱️ Estimated Time:</span>
                      <span className="eta-value">{getETA(activeOrder.status)}</span>
                    </div>
                  )}
                </div>

                <div className="order-items">
                  <h3>Live Order Tracking</h3>
                  {activeOrder.status === 'ON_BUS' ? (
                    <>
                      {!activeOrder.bus_id && <p>Bus assignment pending.</p>}
                      {activeOrder.bus_id && busLoading && <p>Loading live bus locations...</p>}
                      {activeOrder.bus_id && !busLoading && assignedBusLocations.length === 0 && (
                        <p>Assigned bus not reporting yet. Refreshing automatically.</p>
                      )}
                      {mapboxToken ? (
                        <div style={{ width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden' }}>
                          <Map
                            mapboxAccessToken={mapboxToken}
                            initialViewState={{
                              latitude: activeOrder.stop.latitude,
                              longitude: activeOrder.stop.longitude,
                              zoom: 13.2,
                            }}
                            mapStyle="mapbox://styles/mapbox/light-v11"
                            style={{ width: '100%', height: '100%' }}>
                            <NavigationControl position="top-right" />
                            <Marker
                              longitude={activeOrder.stop.longitude}
                              latitude={activeOrder.stop.latitude}
                              color="#1976d2"
                            />
                            {assignedBusLocations.map((bus) => (
                              <Marker
                                key={bus.vehicle_id}
                                longitude={bus.longitude}
                                latitude={bus.latitude}
                                color="#d32f2f"
                              />
                            ))}
                          </Map>
                        </div>
                      ) : (
                        <p>Set VITE_MAPBOX_TOKEN to enable map tracking.</p>
                      )}
                      {activeOrder.bus_id && (
                        <div className="eta-display">
                          <span className="eta-label">🚌 Live bus updates</span>
                          <span className="eta-value">
                            {lastBusRefresh ? `Last refreshed ${lastBusRefresh.toLocaleTimeString()}` : 'Refreshing...'}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="live-status-blink">
                      {activeOrder.status.toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="order-items">
                  <h3>Items:</h3>
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      {item.quantity}x {item.menu_item_name} - ${(item.price_cents / 100).toFixed(2)}
                    </div>
                  ))}
                </div>

                <div className="order-pricing">
                  <div className="price-row">
                    <span>Food Total:</span>
                    <span>${(activeOrder.total_price_cents / 100).toFixed(2)}</span>
                  </div>
                  <div className="price-row">
                    <span>Delivery Fee:</span>
                    <span>${(activeOrder.delivery_fee_cents / 100).toFixed(2)}</span>
                  </div>
                  <div className="price-row total">
                    <span><strong>Total:</strong></span>
                    <span><strong>${((activeOrder.total_price_cents + activeOrder.delivery_fee_cents) / 100).toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="qr-section">
                  <h3>Show this at the bus stop:</h3>
                  <div className="qr-code-wrapper">
                    <QRCode
                      value={activeOrder.qr_code}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      ecLevel="M"
                    />
                  </div>
                  <p className="qr-code-text">Code: <strong>{activeOrder.qr_code}</strong></p>
                </div>

                <div className="eta-display">
                  <span className="eta-label">🔄 Live status updates</span>
                  <span className="eta-value">{lastOrdersRefresh ? `Last refreshed ${lastOrdersRefresh.toLocaleTimeString()}` : 'Refreshing...'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="order-confirmation">
              <h2>📡 Current Active Order</h2>
              <div className="order-details">
                <p>No active orders right now.</p>
              </div>
            </div>
          )}

          <div className="order-confirmation">
            <h2>🧾 Order History</h2>
            {ordersLoading && <p>Loading order history...</p>}
            {!ordersLoading && sortedOrders.length === 0 && <p>No orders yet.</p>}
            {sortedOrders.map(order => (
              <div key={order.id} className="order-details">
                <p><strong>Order #{order.id}</strong> {order.id === activeOrder?.id ? '(Active)' : ''}</p>
                <p>{order.restaurant_name} → {order.stop.name} ({order.stop.code})</p>
                <p>Window: {order.window.label} ({order.window.start_time.slice(0, 5)}–{order.window.end_time.slice(0, 5)})</p>
                <p>Status: {order.status}</p>
                <p>Placed: {formatDateTime(order.created_at)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {internalMode === 'place' && (
        <div className="order-wizard">

          {/* ── Filter chips ── */}
          <div className="filter-chips-bar">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`filter-chip ${activeFilter === f.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(f.key);
                  // If current selection doesn't match the new filter, clear it
                  if (selectedRestaurant) {
                    const r = restaurants.find(r => r.id === selectedRestaurant);
                    if (r && !hasItemWithTag(r, f.key)) {
                      setSelectedRestaurant(null);
                      setQuantities({});
                    }
                  }
                }}
              >
                <span>{f.emoji}</span> {f.label}
              </button>
            ))}
          </div>

          {/* ── Step progress bar ── */}
          <div className="wizard-progress">
            {[
              { num: 1, label: 'Restaurant', done: !!selectedRestaurant },
              { num: 2, label: 'Menu Items', done: Object.values(quantities).some(q => q > 0) },
              { num: 3, label: 'Pickup Stop', done: !!selectedStop },
              { num: 4, label: 'Time Window', done: !!selectedWindow },
            ].map((step, idx, arr) => (
              <div key={step.num} className="wizard-progress-item">
                <div className={`wizard-step-bubble ${step.done ? 'done' : !arr.slice(0, idx).every(s => s.done) ? 'locked' : 'active'}`}>
                  {step.done ? '✓' : step.num}
                </div>
                <span className="wizard-step-label">{step.label}</span>
                {idx < arr.length - 1 && <div className={`wizard-connector ${step.done ? 'done' : ''}`} />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Restaurant ── */}
          <div className="wizard-card">
            <div className="wizard-card-header">
              <span className="wizard-card-num">1</span>
              <div>
                <h3>Choose Restaurant</h3>
                <p>Where would you like to order from?</p>
              </div>
              {selectedRestaurant && (
                <span className="wizard-card-check">✓</span>
              )}
            </div>
            <div className="restaurant-card-grid">
              {filteredRestaurants.length === 0 ? (
                <div className="filter-empty-state">
                  <span>🔍</span>
                  <p>No restaurants match <strong>{FILTERS.find(f => f.key === activeFilter)?.label}</strong>.</p>
                  <button onClick={() => setActiveFilter('all')} className="filter-chip active">Show all</button>
                </div>
              ) : filteredRestaurants.map(r => (
                <button
                  key={r.id}
                  className={`restaurant-select-card ${selectedRestaurant === r.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedRestaurant(r.id); setQuantities({}); }}
                >
                    <span className="restaurant-card-icon">{r.cuisine_type === 'Thai' ? '🍜' : r.cuisine_type === 'Pizza' ? '🍕' : r.cuisine_type === 'Mexican' ? '🌮' : r.cuisine_type === 'Mediterranean' ? '🥙' : r.cuisine_type === 'Bakery' ? '🥐' : r.cuisine_type === 'Vietnamese' ? '🍲' : r.cuisine_type === 'Breakfast' ? '🥞' : '🍽️'}</span>
                    <span className="restaurant-card-name">{r.name}</span>
                    {r.cuisine_type && <span className="restaurant-card-cuisine">{r.cuisine_type}</span>}
                    {r.description && <span className="restaurant-card-desc">{r.description}</span>}
                    <span className="restaurant-card-fee">
                      Delivery: ${(r.delivery_fee_cents / 100).toFixed(2)}
                    </span>
                    {activeFilter !== 'all' && (
                      <span className="restaurant-card-match">
                        {r.menu_items.filter(mi => mi.tags?.split(',').map(t => t.trim()).includes(activeFilter)).length} match
                      </span>
                    )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 2: Menu Items (always visible) ── */}
          <div className={`wizard-card ${!selectedRestaurant ? 'wizard-card-locked' : ''}`}>
            <div className="wizard-card-header">
              <span className={`wizard-card-num ${!selectedRestaurant ? 'locked' : ''}`}>2</span>
              <div>
                <h3>Choose Items</h3>
                <p>{selectedRestaurant ? `Menu from ${currentRestaurant?.name}` : 'Select a restaurant first'}</p>
              </div>
              {Object.values(quantities).some(q => q > 0) && (
                <span className="wizard-card-check">✓</span>
              )}
            </div>
            {!selectedRestaurant ? (
              <div className="wizard-step-placeholder">
                <span>👆</span>
                <p>Select a restaurant above to browse the menu</p>
              </div>
            ) : (
              <div className="menu-cards-grid">
                {currentRestaurant!.menu_items.map(mi => {
                  const qty = quantities[mi.id] ?? 0;
                  return (
                    <div key={mi.id} className={`menu-card ${qty > 0 ? 'in-cart' : ''} ${
                    activeFilter !== 'all' && !mi.tags?.split(',').map(t => t.trim()).includes(activeFilter)
                      ? 'menu-card-dimmed' : ''
                  }`}>
                      <div className="menu-card-body">
                        <div className="menu-card-emoji">{mi.tags?.includes('breakfast') ? '🍳' : mi.tags?.includes('beverages') ? '🥤' : mi.tags?.includes('vegan') ? '🌱' : mi.tags?.includes('spicy') ? '🌶️' : '🍽️'}</div>
                        <div className="menu-card-info">
                          <strong>{mi.name}</strong>
                          {mi.description && <p>{mi.description}</p>}
                          {mi.tags && (
                            <div className="menu-item-tag-row">
                              {mi.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                                <span key={tag} className={`item-tag item-tag-${tag}`}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="menu-card-price">${(mi.price_cents / 100).toFixed(2)}</span>
                      </div>
                      <div className="menu-card-controls">
                        <button
                          className="qty-btn"
                          onClick={() => handleQuantityChange(mi.id, qty - 1)}
                          disabled={qty === 0}
                        >−</button>
                        <span className="qty-value">{qty}</span>
                        <button
                          className="qty-btn"
                          onClick={() => handleQuantityChange(mi.id, qty + 1)}
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Step 3: Pickup Stop ── */}
          <div className="wizard-card">
            <div className="wizard-card-header">
              <span className="wizard-card-num">3</span>
              <div>
                <h3>Choose Pickup Stop</h3>
                <p>Which bus stop will you pick up at?</p>
              </div>
              {selectedStop && <span className="wizard-card-check">✓</span>}
            </div>
            <div className="stop-cards-list">
              {stops.map(s => (
                <button
                  key={s.id}
                  className={`stop-card ${selectedStop === s.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStop(s.id)}
                >
                  <span className="stop-icon">🚏</span>
                  <span className="stop-code">{s.code}</span>
                  <span className="stop-name">{s.name}</span>
                  {selectedStop === s.id && <span className="stop-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 4: Time Window ── */}
          <div className="wizard-card">
            <div className="wizard-card-header">
              <span className="wizard-card-num">4</span>
              <div>
                <h3>Choose Delivery Window</h3>
                <p>
                  Current time:&nbsp;
                  <strong>
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </strong>
                </p>
              </div>
              {selectedWindow && <span className="wizard-card-check">✓</span>}
            </div>
            <div className="window-cards-grid">
              {windows.map(w => {
                const available = isWindowAvailableToday(w);
                return (
                  <button
                    key={w.id}
                    className={`window-card ${selectedWindow === w.id ? 'selected' : ''} ${!available ? 'closed' : ''}`}
                    onClick={() => available && setSelectedWindow(w.id)}
                    disabled={!available}
                  >
                    <span className="window-time">
                      {w.start_time.slice(0, 5)} – {w.end_time.slice(0, 5)}
                    </span>
                    <span className="window-label">{w.label}</span>
                    <span className={`window-badge ${available ? 'open' : 'closed'}`}>
                      {available ? '● Open' : '✕ Closed'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Order Summary + Submit ── */}
          {(selectedRestaurant || selectedStop || selectedWindow || Object.values(quantities).some(q => q > 0)) && (
            <div className="order-summary-card">
              <h3>🧾 Order Summary</h3>
              <div className="summary-rows">
                <div className="summary-row">
                  <span>Restaurant</span>
                  <span>{currentRestaurant?.name ?? '—'}</span>
                </div>
                <div className="summary-row">
                  <span>Pickup Stop</span>
                  <span>{stops.find(s => s.id === selectedStop)?.name ?? '—'}</span>
                </div>
                <div className="summary-row">
                  <span>Time Window</span>
                  <span>{windows.find(w => w.id === selectedWindow)?.label ?? '—'}</span>
                </div>
                {currentRestaurant && Object.entries(quantities).filter(([,q]) => q > 0).map(([id, qty]) => {
                  const item = currentRestaurant.menu_items.find(mi => mi.id === Number(id));
                  return item ? (
                    <div key={id} className="summary-row item-row">
                      <span>{qty}× {item.name}</span>
                      <span>${((item.price_cents * qty) / 100).toFixed(2)}</span>
                    </div>
                  ) : null;
                })}
                {currentRestaurant && (
                  <>
                    <div className="summary-row">
                      <span>Delivery Fee</span>
                      <span>${(currentRestaurant.delivery_fee_cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="summary-row total-row">
                      <strong>Total</strong>
                      <strong>
                        ${((
                          Object.entries(quantities)
                            .filter(([,q]) => q > 0)
                            .reduce((acc, [id, qty]) => {
                              const item = currentRestaurant.menu_items.find(mi => mi.id === Number(id));
                              return acc + (item ? item.price_cents * qty : 0);
                            }, 0) + currentRestaurant.delivery_fee_cents
                        ) / 100).toFixed(2)}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <button
            onClick={placeOrder}
            disabled={
              loading ||
              !selectedRestaurant ||
              !selectedStop ||
              !selectedWindow ||
              !Object.values(quantities).some(q => q > 0) ||
              !!(selectedWindow && !isWindowAvailableToday(windows.find(w => w.id === selectedWindow)!))
            }
            className="place-order-btn"
          >
            {loading ? '⏳ Placing Order…' : '🛒 Place Order'}
          </button>
        </div>
      )}
    </div>
  );
}
