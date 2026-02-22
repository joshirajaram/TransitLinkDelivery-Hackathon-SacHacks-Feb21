import { useState, useEffect } from 'react'
import MapView from './Map'
import UserOrder from './StudentOrder'
import StewardScan from './StewardScan'
// @ts-ignore
import UnitransManagerDashboard from './UnitransManagerDashboard'
import RestaurantDashboard from './RestaurantDashboard'
import CentralDashboard from './CentralDashboard'
import RestaurantPage from './RestaurantPage'
import Login from './Login'
import Signup from './Signup'
import Profile from './Profile'
import { User } from './api'

type View = 'map' | 'user' | 'user-track' | 'steward' | 'manager' | 'restaurant' | 'central' | 'restaurant-page' | 'profile'
type AuthView = 'login' | 'signup'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('user')
  const [authView, setAuthView] = useState<AuthView>('login')
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number>(1)

  // Check for existing user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    }
  }, [])

  // Set view based on user role when user changes (including on mount)
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') setView('central')
      else if (user.role === 'STUDENT') setView('user')
      else if (user.role === 'RESTAURANT_OWNER') setView('restaurant')
      else if (user.role === 'STEWARD') setView('steward')
    }
  }, [user])

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser)
    // Set initial view based on role
    if (loggedInUser.role === 'ADMIN') setView('central')
    else if (loggedInUser.role === 'STUDENT') setView('user')
    else if (loggedInUser.role === 'RESTAURANT_OWNER') setView('restaurant')
    else if (loggedInUser.role === 'STEWARD') setView('steward')
    else setView('user')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
    setAuthView('login')
  }

  // Show login/signup screen if not authenticated
  if (!user) {
    return authView === 'signup' 
      ? <Signup onSignup={handleLogin} onSwitchToLogin={() => setAuthView('login')} />
      : <Login onLogin={handleLogin} onSwitchToSignup={() => setAuthView('signup')} />
  }

  return (
    <div className="app-shell">
      {/* ─────────── STICKY HEADER ─────────── */}
      <header className="header">
        <div className="header-inner">
          {/* Brand */}
          <div className="header-brand" onClick={() => {
            if (user.role === 'ADMIN') setView('central')
            else if (user.role === 'STUDENT') setView('user')
            else if (user.role === 'RESTAURANT_OWNER') setView('restaurant')
            else if (user.role === 'STEWARD') setView('steward')
          }}>
            <div className="header-bus-icon">💙</div>
            <div className="header-brand-text">
              <span className="header-title">TransitLink</span>
              <span className="header-sub">UC Davis · NextGen Delivery</span>
            </div>
          </div>

          {/* User pill */}
          <button 
            className={`header-user-pill ${view === 'profile' ? 'active-pill' : ''}`}
            onClick={() => setView('profile')}
            title="View profile"
          >
            <div className="header-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="header-user-text">
              <span className="header-user-name">{user.name}</span>
              <span className="header-user-role">{user.role === 'STUDENT' ? 'UC Davis User' : user.role.replace('_', ' ')}</span>
            </div>
            <span className="header-user-chevron">▾</span>
          </button>
        </div>

        {/* ─── Tab bar (bottle caps) ─── */}
        <nav className="nav-tabs">
          {user.role === 'ADMIN' && <>
            <button onClick={() => setView('central')}       className={view === 'central'       ? 'active' : ''}>🎯 Dashboard</button>
            <button onClick={() => setView('user')}          className={view === 'user'          ? 'active' : ''}>🛒 Place Order</button>
            <button onClick={() => setView('user-track')}    className={view === 'user-track'    ? 'active' : ''}>🧾 My Orders</button>
            <button onClick={() => setView('restaurant')}    className={view === 'restaurant'    ? 'active' : ''}>🍽️ Restaurant</button>
            <button onClick={() => setView('steward')}       className={view === 'steward'       ? 'active' : ''}>🎒 Steward</button>
            <button onClick={() => setView('manager')}       className={view === 'manager'       ? 'active' : ''}>🚌 Manager</button>
            <button onClick={() => setView('map')}           className={view === 'map'           ? 'active' : ''}>🗺️ Live Map</button>
          </>}

          {user.role === 'STUDENT' && <>
            <button onClick={() => setView('user')}          className={view === 'user'          ? 'active' : ''}>🛒 Place Order</button>
            <button onClick={() => setView('user-track')}    className={view === 'user-track'    ? 'active' : ''}>🧾 My Orders</button>
            <button onClick={() => setView('map')}           className={view === 'map'           ? 'active' : ''}>🗺️ Live Map</button>
          </>}

          {user.role === 'RESTAURANT_OWNER' && <>
            <button onClick={() => setView('restaurant')}   className={view === 'restaurant'    ? 'active' : ''}>🍽️ My Restaurant</button>
            <button onClick={() => setView('map')}          className={view === 'map'           ? 'active' : ''}>🗺️ Live Map</button>
          </>}

          {user.role === 'STEWARD' && <>
            <button onClick={() => setView('steward')}      className={view === 'steward'       ? 'active' : ''}>🎒 Steward Scan</button>
            <button onClick={() => setView('manager')}      className={view === 'manager'       ? 'active' : ''}>🚌 My Route</button>
            <button onClick={() => setView('map')}          className={view === 'map'           ? 'active' : ''}>🗺️ Live Map</button>
          </>}

          <button onClick={() => setView('profile')} className={view === 'profile' ? 'active' : ''}>👤 Profile</button>
        </nav>
      </header>

      {/* ─────────── TAB BODY (bottle) ─────────── */}
      <div className="tab-body">
        <div className="view-container pageEnter">
          {view === 'central'       && <CentralDashboard />}
          {view === 'user'          && (user.role === 'STUDENT' || user.role === 'ADMIN') && <UserOrder mode="place" />}
          {view === 'user-track'    && (user.role === 'STUDENT' || user.role === 'ADMIN') && <UserOrder mode="track" />}
          {view === 'steward'       && (user.role === 'STEWARD' || user.role === 'ADMIN') && <StewardScan />}
          {view === 'manager'       && <UnitransManagerDashboard />}
          {view === 'restaurant'    && <RestaurantDashboard />}
          {view === 'restaurant-page' && <RestaurantPage restaurantId={selectedRestaurantId} />}
          {view === 'profile'       && <Profile user={user} onLogout={handleLogout} />}
          {view === 'map' && (
            <div className="map-shell">
              <MapView />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

