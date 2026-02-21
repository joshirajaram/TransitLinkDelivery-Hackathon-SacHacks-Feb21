# Authentication Implementation Guide

## 🔐 Authentication System Overview

This guide shows how to implement proper authentication for Transit-Link Delivery.

## Current State vs. Production

### Hackathon MVP (Current)
- Hardcoded user IDs for quick demo
- No login required
- Anyone can access any interface

### Production System (To Implement)
- UC Davis CAS SSO authentication
- JWT token-based sessions
- Role-based access control
- Protected API endpoints

---

## 🎯 User Flows & Authentication

### 1. **STUDENT Flow**

**What they do:**
1. Visit website
2. Click "Order Food"
3. Login with UC Davis credentials (CAS SSO)
4. Browse restaurants → Add to cart
5. Select Unitrans stop + time window
6. Place order → Receive QR code
7. Go to bus stop → Show QR to steward
8. Get food!

**Access Level:**
- ✅ Browse restaurants & menus
- ✅ Place orders
- ✅ View their orders only
- ✅ Cancel their pending orders
- ❌ Cannot see other students' orders
- ❌ Cannot access restaurant/steward functions

**Implementation:**
```python
# Protected endpoint - students only
@app.post("/orders")
async def create_order(
    order_data: CreateOrderIn,
    current_user: CurrentUser = Depends(require_student)
):
    # current_user.id is automatically the student_id
    # No manual student_id input needed
    order_data.student_id = current_user.id
    # ... create order
```

---

### 2. **RESTAURANT OWNER/STAFF Flow**

**What they do:**
1. Visit website → Login with restaurant credentials
2. See dashboard with today's orders
3. Click "Mark as Preparing" when cooking starts
4. Click "Ready for Pickup" when food is done
5. Hand orders to steward when bus arrives
6. Click "On Bus" to confirm handoff

**Access Level:**
- ✅ View orders for THEIR restaurant only
- ✅ Update order status
- ✅ Manage their menu items
- ✅ View their revenue stats
- ❌ Cannot see other restaurants' orders
- ❌ Cannot create/complete orders

**Implementation:**
```python
# Protected endpoint - restaurant owners only
@app.get("/restaurants/{restaurant_id}/orders")
async def get_restaurant_orders(
    restaurant_id: int,
    current_user: CurrentUser = Depends(require_restaurant),
    db: Session = Depends(get_db)
):
    # Verify user owns this restaurant
    restaurant = db.query(RestaurantORM).filter(
        RestaurantORM.id == restaurant_id,
        RestaurantORM.owner_id == current_user.id
    ).first()
    
    if not restaurant:
        raise HTTPException(403, "Not your restaurant")
    
    # Return orders
```

---

### 3. **ASUCD STEWARD Flow**

**What they do:**
1. Login with ASUCD employee credentials
2. See assigned delivery window (e.g., "Dinner 6-8pm")
3. Pick up orders from restaurants
4. Load onto Unitrans bus
5. At each stop: scan QR codes from students
6. Hand over food → Mark as delivered
7. Report any issues (no-shows, wrong orders)

**Access Level:**
- ✅ View orders in active delivery windows
- ✅ Scan QR codes to verify pickup
- ✅ Mark orders as completed
- ✅ Report delivery issues
- ❌ Cannot create orders
- ❌ Cannot modify restaurant menus
- ❌ Limited to assigned time windows

**Implementation:**
```python
# Protected endpoint - stewards only
@app.post("/steward/scan")
async def steward_scan_qr(
    qr_data: QRScanIn,
    current_user: CurrentUser = Depends(require_steward),
    db: Session = Depends(get_db)
):
    # Verify order status is ON_BUS or AT_STOP
    order = db.query(OrderORM).filter(OrderORM.qr_code == qr_data.qr_code).first()
    
    if not order:
        raise HTTPException(404, "Invalid QR code")
    
    if order.status not in ["ON_BUS", "AT_STOP"]:
        raise HTTPException(400, "Order not ready for pickup")
    
    # Mark as completed
    order.status = "COMPLETED"
    order.completed_by_steward_id = current_user.id
    order.completed_at = datetime.utcnow()
    db.commit()
    
    return order
```

---

### 4. **ASUCD ADMIN Flow**

**What they do:**
1. Login with admin credentials
2. Dashboard shows:
   - Total orders today
   - Revenue generated
   - Active stewards
   - Any issues/alerts
3. Manage restaurants (add/remove/approve)
4. Manage delivery windows
5. Assign stewards to shifts
6. View analytics & reports
7. Handle customer support issues

**Access Level:**
- ✅ Full platform access
- ✅ View ALL orders
- ✅ Manage restaurants, stops, windows
- ✅ Assign steward shifts
- ✅ Override/cancel orders
- ✅ View financial reports
- ✅ Manage user roles

**Implementation:**
```python
# Protected endpoint - admins only
@app.post("/admin/restaurants")
async def create_restaurant(
    restaurant_data: RestaurantCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Create new restaurant
    # Only admins can add restaurants
```

---

## 🔧 Implementation Steps

### Step 1: Add Authentication Dependencies

Update `requirements.txt`:
```txt
python-jose[cryptography]
passlib[bcrypt]
python-multipart
```

Install:
```bash
pip install python-jose[cryptography] passlib[bcrypt] python-multipart
```

### Step 2: Add Auth Endpoints to main.py

```python
from .auth import (
    Token,
    UserLogin,
    create_access_token,
    get_current_user,
    require_student,
    require_restaurant,
    require_steward,
    require_admin,
    get_password_hash,
    verify_password,
)

# Login endpoint (for demo/testing - production uses CAS)
@app.post("/auth/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Demo login - production would use CAS SSO"""
    user = db.query(UserORM).filter(UserORM.email == user_credentials.email).first()
    
    if not user:
        raise HTTPException(401, "Invalid credentials")
    
    # For demo, check if password field exists (it doesn't in current schema)
    # In production, this would validate CAS ticket
    
    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "role": user.role
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }

# Get current user info
@app.get("/auth/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Get current logged-in user info"""
    return current_user

# CAS Login redirect
@app.get("/auth/cas/login")
def cas_login():
    """Redirect to UC Davis CAS login"""
    from .auth import generate_cas_login_url
    login_url = generate_cas_login_url()
    return {"login_url": login_url}

# CAS Callback handler
@app.get("/auth/cas/callback")
def cas_callback(ticket: str, db: Session = Depends(get_db)):
    """Handle CAS authentication callback"""
    from .auth import validate_cas_ticket, get_or_create_user_from_cas
    
    # Validate ticket with CAS server
    cas_user_info = validate_cas_ticket(ticket)
    
    if not cas_user_info:
        raise HTTPException(401, "CAS authentication failed")
    
    # Get or create user
    user = get_or_create_user_from_cas(cas_user_info, db)
    
    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "role": user.role
        }
    )
    
    # Redirect to frontend with token
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }
```

### Step 3: Protect Existing Endpoints

**Student Endpoints:**
```python
@app.post("/orders")
def create_order(
    payload: CreateOrderIn,
    current_user: CurrentUser = Depends(require_student),  # ADD THIS
    db: Session = Depends(get_db)
):
    payload.student_id = current_user.id  # Use authenticated user ID
    # ... rest of code

@app.get("/orders/{order_id}")
def get_order(
    order_id: int,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db)
):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Students can only see their own orders
    if order.student_id != current_user.id:
        raise HTTPException(403, "Not your order")
    
    return order
```

**Restaurant Endpoints:**
```python
@app.get("/restaurants/{restaurant_id}/orders")
def restaurant_orders(
    restaurant_id: int,
    current_user: CurrentUser = Depends(require_restaurant),  # ADD THIS
    db: Session = Depends(get_db)
):
    # Verify user owns this restaurant
    restaurant = db.query(RestaurantORM).filter(
        RestaurantORM.id == restaurant_id,
        RestaurantORM.owner_id == current_user.id
    ).first()
    
    if not restaurant:
        raise HTTPException(403, "Not your restaurant")
    
    orders = db.query(OrderORM).filter(OrderORM.restaurant_id == restaurant_id).all()
    return orders

@app.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    payload: UpdateStatusIn,
    current_user: CurrentUser = Depends(require_restaurant),
    db: Session = Depends(get_db)
):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Verify restaurant owns this order
    restaurant = db.query(RestaurantORM).filter(
        RestaurantORM.id == order.restaurant_id,
        RestaurantORM.owner_id == current_user.id
    ).first()
    
    if not restaurant:
        raise HTTPException(403, "Not your order")
    
    order.status = payload.status
    db.commit()
    return order
```

**Steward Endpoints:**
```python
@app.post("/steward/scan")
def steward_scan(
    payload: QRScanIn,
    current_user: CurrentUser = Depends(require_steward),  # ADD THIS
    db: Session = Depends(get_db)
):
    # ... existing code
```

**Admin Endpoints:**
```python
@app.post("/admin/restaurants", response_model=RestaurantOut)
async def create_restaurant(
    restaurant_data: RestaurantCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin only - create new restaurant"""
    # ... create restaurant

@app.delete("/admin/orders/{order_id}")
async def cancel_order_admin(
    order_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin only - cancel any order"""
    # ... cancel order
```

---

## 🎨 Frontend Authentication

### Update api.ts:
```typescript
// Store JWT token
export const authService = {
  token: localStorage.getItem('auth_token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),

  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    authService.token = res.data.access_token;
    authService.user = res.data.user;
    localStorage.setItem('auth_token', res.data.access_token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    return res.data;
  },

  logout: () => {
    authService.token = null;
    authService.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  casLogin: () => {
    // Redirect to CAS
    window.location.href = 'http://localhost:8000/auth/cas/login';
  },
};

// Add token to all requests
api.interceptors.request.use((config) => {
  if (authService.token) {
    config.headers.Authorization = `Bearer ${authService.token}`;
  }
  return config;
});
```

### Add Login Component:
```typescript
// src/Login.tsx
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const data = await authService.login(email, password);
      // Redirect based on role
      if (data.user.role === 'STUDENT') {
        navigate('/student');
      } else if (data.user.role === 'RESTAURANT_OWNER') {
        navigate('/restaurant');
      } else if (data.user.role === 'STEWARD') {
        navigate('/steward');
      } else if (data.user.role === 'ADMIN') {
        navigate('/admin');
      }
    } catch (err) {
      alert('Login failed');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <button onClick={() => authService.casLogin()}>
        Login with UC Davis
      </button>
      
      {/* Demo login for testing */}
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Demo Login</button>
    </div>
  );
}
```

### Protect Routes:
```typescript
// App.tsx
const user = authService.user;

if (!user) {
  return <Login />;
}

// Show interface based on role
if (user.role === 'STUDENT') {
  return <StudentOrder />;
} else if (user.role === 'RESTAURANT_OWNER') {
  return <RestaurantDashboard />;
} else if (user.role === 'STEWARD') {
  return <StewardScan />;
} else if (user.role === 'ADMIN') {
  return <AdminDashboard />;
}
```

---

## 📱 Mobile App Considerations

For stewards using mobile devices:
- Implement camera QR scanning (not just text input)
- Optimize UI for one-handed operation
- Add offline mode for poor connectivity on buses
- Push notifications for new orders

---

## 🚀 Quick Implementation for Hackathon Demo

For your presentation, you can:

1. **Keep hardcoded IDs** for demo flow
2. **Add visual role indicators** - show "Logged in as: Student" banner
3. **Mock authentication UI** - Login buttons that just set role in localStorage
4. **Explain in pitch**: "Demo uses mock auth; production integrates UC Davis CAS SSO"

Want me to implement the full authentication system now, or create a simplified mock version for your hackathon demo?
