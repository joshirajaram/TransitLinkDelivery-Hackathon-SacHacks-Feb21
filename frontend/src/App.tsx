import { useState, useEffect } from 'react'
import MapView from './Map'
import StudentOrder from './StudentOrder'
import StewardScan from './StewardScan'
import RestaurantDashboard from './RestaurantDashboard'
import CentralDashboard from './CentralDashboard'
import RestaurantPage from './RestaurantPage'
import Login from './Login'
import { User } from './api'

type View = 'map' | 'student' | 'steward' | 'restaurant' | 'central' | 'restaurant-page'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('student')
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

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser)
    // Set initial view based on role
    if (loggedInUser.role === 'ADMIN') setView('central')
    else if (loggedInUser.role === 'STUDENT') setView('student')
    else if (loggedInUser.role === 'RESTAURANT_OWNER') setView('restaurant')
    else if (loggedInUser.role === 'STEWARD') setView('steward')
    else setView('student')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <main>
      <header className="header">
        <h1>🚌 Transit-Link Delivery</h1>
        <p>Unitrans-powered, eco-friendly delivery for Davis Downtown restaurants</p>
        <div className="user-info">
          <span>👤 {user.name} ({user.role})</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
        <nav className="nav-tabs">
          {/* Admin: Full access to all tabs */}
          {user.role === 'ADMIN' && (
            <>
              <button 
                onClick={() => setView('central')}
                className={view === 'central' ? 'active' : ''}
              >
                🎯 Central Dashboard
              </button>
              <button 
                onClick={() => setView('student')}
                className={view === 'student' ? 'active' : ''}
              >
                📚 Student
              </button>
              <button 
                onClick={() => setView('restaurant')}
                className={view === 'restaurant' ? 'active' : ''}
              >
                🍽️ Restaurant
              </button>
              <button 
                onClick={() => setView('steward')}
                className={view === 'steward' ? 'active' : ''}
              >
                🎒 ASUCD Steward
              </button>
              <button 
                onClick={() => setView('map')}
                className={view === 'map' ? 'active' : ''}
              >
                🗺️ Live Map
              </button>
              <button 
                onClick={() => { setView('restaurant-page'); setSelectedRestaurantId(1); }}
                className={view === 'restaurant-page' ? 'active' : ''}
              >
                🍔 Restaurant Page Demo
              </button>
            </>
          )}

          {/* Student: Only Student Order & Map */}
          {user.role === 'STUDENT' && (
            <>
              <button 
                onClick={() => setView('student')}
                className={view === 'student' ? 'active' : ''}
              >
                📚 Place Order
              </button>
              <button 
                onClick={() => setView('map')}
                className={view === 'map' ? 'active' : ''}
              >
                🗺️ Live Map
              </button>
            </>
          )}

          {/* Restaurant Owner: Only Restaurant Dashboard & Map */}
          {user.role === 'RESTAURANT_OWNER' && (
            <>
              <button 
                onClick={() => setView('restaurant')}
                className={view === 'restaurant' ? 'active' : ''}
              >
                🍽️ My Restaurant
              </button>
              <button 
                onClick={() => setView('map')}
                className={view === 'map' ? 'active' : ''}
              >
                🗺️ Live Map
              </button>
            </>
          )}

          {/* ASUCD Steward: Only Steward Scan & Map */}
          {user.role === 'STEWARD' && (
            <>
              <button 
                onClick={() => setView('steward')}
                className={view === 'steward' ? 'active' : ''}
              >
                🎒 Steward Scan
              </button>
              <button 
                onClick={() => setView('map')}
                className={view === 'map' ? 'active' : ''}
              >
                🗺️ Live Map
              </button>
            </>
          )}
        </nav>
      </header>
      <section className="content">
        {view === 'central' && <CentralDashboard />}
        {view === 'student' && <StudentOrder />}
        {view === 'steward' && <StewardScan />}
        {view === 'restaurant' && <RestaurantDashboard />}
        {view === 'restaurant-page' && <RestaurantPage restaurantId={selectedRestaurantId} />}
        {view === 'map' && (
          <div className="map-shell">
            <MapView />
          </div>
        )}
      </section>
    </main>
  )
}
