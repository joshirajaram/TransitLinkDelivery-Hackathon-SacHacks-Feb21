# API Testing Guide

## Base URL
```
http://localhost:8000
```

## Health Check
```bash
curl http://localhost:8000/health
```

## Get All Restaurants
```bash
curl http://localhost:8000/restaurants | jq
```

## Get Unitrans Stops
```bash
curl http://localhost:8000/stops | jq
```

## Get Delivery Windows
```bash
curl http://localhost:8000/windows | jq
```

## Create an Order
```bash
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "restaurant_id": 1,
    "stop_id": 1,
    "window_id": 1,
    "items": [
      {"menu_item_id": 1, "quantity": 2},
      {"menu_item_id": 2, "quantity": 1}
    ]
  }' | jq
```

## Get Restaurant Orders
```bash
curl http://localhost:8000/restaurants/1/orders | jq
```

## Update Order Status
```bash
curl -X PATCH http://localhost:8000/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "PREPARING"}' | jq
```

## Steward Scan QR Code
Replace `YOUR_QR_CODE` with the actual QR code from an order:
```bash
curl -X POST http://localhost:8000/steward/scan \
  -H "Content-Type: application/json" \
  -d '{"qr_code": "YOUR_QR_CODE"}' | jq
```

## Get Real-time Bus Locations
```bash
curl http://localhost:8000/bus-locations | jq
```

## Find Optimal Bus Line
```bash
curl "http://localhost:8000/match?restaurant_lat=38.5449&restaurant_lon=-121.7405&customer_lat=38.5422&customer_lon=-121.7506" | jq
```

## Interactive API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Order Status Flow
```
PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → ON_BUS → AT_STOP → COMPLETED
```

## Testing Workflow

### 1. Student Places Order
- Use Student Order interface in frontend
- Or use the Create Order API

### 2. Restaurant Processes Order
- View order in Restaurant Dashboard
- Update status through dashboard or API

### 3. Steward Picks Up Order
- Update status to ON_BUS
- Travel to designated stop
- Update status to AT_STOP

### 4. Student Collects Order
- Show QR code at bus stop
- Steward scans QR code
- Order marked as COMPLETED

## Demo Scenario

### Quick Demo Script
1. **Start Backend**: `cd backend && uvicorn app.main:app --reload`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Open Browser**: Navigate to `http://localhost:5173`
4. **Student View**: 
   - Select "Downtown Tacos"
   - Add 2 Veggie Tacos and 1 Burrito
   - Choose "Memorial Union (MU)" stop
   - Select "Lunch (12:00–14:00)" window
   - Place order and note the QR code
5. **Restaurant View**:
   - Switch to Restaurant tab
   - See the new order
   - Click "Mark as PREPARING"
   - Click "Mark as READY_FOR_PICKUP"
   - Click "Mark as ON_BUS"
6. **Steward View**:
   - Switch to Steward Scan tab
   - Enter the QR code from step 4
   - Click "Verify Pickup"
   - Order marked as COMPLETED

## Sample QR Codes
After placing orders, you'll get QR codes like:
- `a1b2c3d4`
- `e5f6g7h8`

These are 8-character hex tokens generated automatically.
