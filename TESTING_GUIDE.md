# Transit-Link Delivery Full Testing Guide

## Overview
This guide covers testing all features of the Transit-Link Delivery system, including QR code management, ETA tracking, order status updates, and role-based dashboards.

---

## System Architecture

### Key Components
- **Backend**: FastAPI (Python) running on http://localhost:8000
- **Frontend**: Vite + React (TypeScript) running on http://localhost:5174
- **Database**: SQLite with Orders, Restaurants, Stops, Users, and Delivery Windows
- **UnitTrans API**: Real-time bus location tracking integrated via XML feed

### Role-Based Views
1. **Student**: Place orders, track delivery status and ETA, scan QR code for pickup
2. **Restaurant Owner**: View incoming orders, manage prep status, display QR codes for steward pickup
3. **Steward (ASUCD Driver)**: Scan QR codes on packages to verify pickup, update delivery status
4. **Admin (DDBA)**: View dashboard with all orders, restaurant performance, system metrics
5. **UnitTrans Team**: Access bus location data via API

---

## Test Users
The system is pre-seeded with test users:
- **Student**: student@ucdavis.edu
- **Restaurant Owner**: owner@tacomadavis.com
- **Steward**: steward@ucdavis.edu
- **Admin**: admin@ddba.org

For demo purposes, any password works (login is not encrypted).

---

## Feature 1: QR Code System

### Understanding QR Codes
- **Each order gets a unique QR code** - Generated using `secrets.token_hex(4)` 
- **QR codes are displayed as**:
  - Hex string: `a1b2c3d4`
  - Visual QR image: Base64 PNG displayed in UI
- **Same QR code throughout order lifecycle**: Identifies package from restaurant to pickup

### Test QR Code Uniqueness
1. Login as Student and place 2 orders
2. Go to Restaurant tab and view orders - see different QR codes
3. Verify each code is unique in the database

---

## Feature 2: Order Lifecycle & Status Tracking

### Complete Order Flow
```
1. PENDING → Student places order
2. ACCEPTED → Restaurant accepts order
   └─ accepted_at timestamp set
3. PREPARING → Restaurant preparing food
4. READY_FOR_PICKUP → Food ready, QR code shown
   └─ ready_at timestamp set
5. ON_BUS → Steward picks up and loads on bus
   └─ on_bus_at timestamp set
6. AT_STOP → Bus arrived at delivery stop
7. COMPLETED → Student scanned QR code
   └─ completed_at timestamp set
```

### Test Order Status Progression
1. **As Student**: Create new order
2. **As Restaurant**: View dashboard showing order
   - See QR code (hex + visual)
   - Update status → PREPARING
3. **Verify Timestamps**: Each status change records exact time

---

## Feature 3: ETA Estimation

### ETA Logic
- **Initial ETA**: Set at order creation = current_time + 25 minutes
- **ETA Display**: Via `estimated_delivery_time` field
- **Frontend**: Shows remaining minutes until ETA
- **Uses**: Restaurant prep time (15min) + bus travel time (10min)

### Test ETA Feature
1. Create order → Store creation time
2. View order in Student dashboard
3. See "📦 Expected delivery: [timestamp]"
4. Verify ETA calculates as ~25 minutes from creation

---

## Feature 4: Restaurant Dashboard with QR Codes

### Restaurant Dashboard Features
- **Orders List**: All incoming orders sorted by newest first
- **Status Management**: Buttons to advance status
- **QR Code Display**: Both visual image and hex code
- **ETA Display**: Minutes remaining
- **Timeline**: Shows when each status was reached
- **Auto-refresh**: Updates every 10 seconds

### Test Restaurant Dashboard
1. Login as `owner@tacomadavis.com`
2. Click "🍽️ Restaurant Dashboard"
3. Create orders as student
4. **Verify Dashboard Shows**:
   - QR code as visual image (PNG)
   - QR code as hex string
   - Status badges with colors
   - Time windows
   - Delivery stop info
   - Buttons to update status

---

## Feature 5: Driver/Steward QR Scanning

### Steward Scanning Interface
- **Role**: ASUCD staff member (Steward)
- **Function**: Scan QR codes to confirm package pickup
- **Requirement**: Order must be `ON_BUS` or `AT_STOP` status
- **Action**: Mark as `COMPLETED` and set `completed_at` timestamp

### Test Steward Scanning
1. Login as `steward@ucdavis.edu`
2. Go to "🚌 Steward Delivery Verification" tab
3. Get order QR code from restaurant dashboard
4. Paste QR code into scan input
5. Click "Verify Pickup"
6. See success message with order details
7. Order status updates to COMPLETED

---

## Feature 6: Admin/Central Dashboard

### Admin Dashboard Features
- **Statistics**:
  - Total orders across all restaurants
  - Total revenue in cents
  - Active orders (accepted or picked up)
  - Total restaurants in system
  - Average delivery time
- **Restaurant Performance**:
  - Orders per restaurant
  - Revenue per restaurant
  - Trends and metrics
- **Recent Orders**: Last 10 orders with full details

### Test Admin Dashboard
1. Login as `admin@ddba.org`
2. Click "🎯 Central Dashboard"
3. **Verify displays**:
   - Correct order counts
   - Revenue calculations
   - Restaurant performance table
   - Recent order list with all details

---

## Feature 7: Student Order Tracking

### Student View Features
- **Order Creation**: 
  - Select restaurant, delivery window, stop
  - Choose items and quantities
  - See QR code for package identification
  - View estimated delivery time
- **Order Tracking**:
  - Live status updates
  - Progress bar
  - ETA countdown
  - Current status message
  - Bus location when ON_BUS (with Mapbox)

### Test Student Ordering
1. Login as `student@ucdavis.edu`
2. Click "📚 Student Tab"
3. **Create Order**:
   - Select "Downtown Tacos" restaurant
   - Choose "Lunch" window (12:00-14:00)
   - Select "Memorial Union" stop
   - Add items (3x Veggie Tacos)
   - Place order
4. **See Confirmation**:
   - Order ID
   - QR code (hex) for pickup
   - Expected delivery time
   - Status: ACCEPTED

---

## Feature 8: UnitTrans Bus Integration

### Bus Data Integration
- **Source**: Real-time UnitTrans XML feed from `https://retro.umoiq.com/`
- **Data**: Vehicle locations, routes, speeds
- **Poll Interval**: 15 seconds
- **Cache**: Stored in-memory for API requests
- **Display**: Shows on student map when order ON_BUS

### Test Bus Integration
1. Check backend logs for bus polling
2. Call `/bus-locations` API endpoint
3. View student tracking map when order ON_BUS
4. See red bus marker on map

---

## Test Scenario: Complete Order Flow

### Scenario: Downtown Tacos Lunch Order
**Time**: ~5-10 minutes

#### Step 1: Place Order (Student)
- Login as `student@ucdavis.edu`
- Place order: 2x Chicken Tacos, 1x Burrito
- Delivery: Memorial Union, Lunch window
- **Expected**: Order #1, ACCEPTED status, QR: a1b2c3d4

#### Step 2: Restaurant Updates (Restaurant Owner)
- Login as `owner@tacomadavis.com`
- View "🍽️ Restaurant Dashboard"
- See order with QR code visual + hex
- Click "Mark as PREPARING"
- **Expected**: Status changes, timestamp recorded
- Click "Mark as READY_FOR_PICKUP"
- **Expected**: ready_at timestamp set

#### Step 3: Steward Pickup (Steward/Driver) 
- Restaurant clicks "Mark as ON_BUS"
- **Expected**: on_bus_at timestamp set
- Login as `steward@ucdavis.edu`
- Go to "🚌 Steward Delivery Verification"
- Enter QR code: `a1b2c3d4`
- **Expected**: Success! Order marked COMPLETED

#### Step 4: Verify Complete Timeline
- Go back to restaurant dashboard or admin
- Click order details
- See timeline:
  - ✓ Accepted: 14:30:45
  - ✓ Ready: 14:36:12
  - ✓ On Bus: 14:37:30
  - ✓ Done: 14:38:15

---

## API Endpoints to Test

### Authentication
```bash
POST /auth/login
POST /auth/google
GET /auth/me
```

### Orders
```bash
POST /orders                      # Create order
GET /orders/{id}                  # Get order
GET /orders/{id}/qr-code         # Get QR code image
PATCH /orders/{id}/status        # Update status
POST /steward/scan               # Scan QR code
```

### Restaurant Orders
```bash
GET /restaurants                 # List all restaurants
GET /restaurants/my-restaurant   # Get my restaurant
GET /restaurants/{id}/orders     # Get restaurant orders
```

### Delivery Info
```bash
GET /stops                       # List delivery stops
GET /windows                     # List delivery windows
GET /bus-locations              # Get live bus locations
GET /admin/dashboard            # Admin stats
```

---

## Key Testing Checklist

- [ ] QR code is unique for each order
- [ ] QR code displays as both hex string and PNG image
- [ ] Restaurant can see orders with QR codes
- [ ] Status updates record timestamps
- [ ] ETA calculates as ~25 minutes from order creation
- [ ] Steward can scan QR code to mark complete
- [ ] Admin dashboard shows correct statistics
- [ ] Student sees order tracking with ETA
- [ ] All role-based views accessible
- [ ] Bus locations polling every 15 seconds
- [ ] Database persists all order data
- [ ] Order statuses flow: ACCEPTED → PREPARING → READY → ON_BUS → COMPLETED

---

## Troubleshooting

### Backend Issues
- Check logs for errors: `uvicorn app.main:app --reload`
- Verify database created: `ls -la backend/tld.db`
- Verify UnitTrans API accessible: `curl https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=unitrans`

### Frontend Issues
- Clear browser cache: Ctrl+Shift+Delete
- Check console for errors: F12 → Console
- Verify API URL: `VITE_API_URL` environment variable
- Rebuild frontend: `npm install && npm run dev`

### Database Issues
- Reset database: `rm backend/tld.db` and restart backend
- Check SQLite: `sqlite3 backend/tld.db ".tables"`

---

## Performance Notes
- Initial load creates ~5 restaurants, 12 menu items, 3 stops, 2 windows
- Bus location polling runs every 15 seconds
- Order refresh auto-runs every 10 seconds in dashboards
- Database is small enough for in-memory operation

---

## Next Steps for Production
1. Replace demo login with UC Davis CAS SSO
2. Add database migrations framework
3. Implement real bus assignment algorithm
4. Add payment processing
5. Set up Mapbox token for production
6. Configure CORS for production domain
7. Add email notifications
8. Implement proper authentication tokens with expiration
9. Add audit logging
10. Set up monitoring and alerts

