# 🚌 Transit-Link Delivery

**SacHacks 2026 Hackathon Project**

A sustainable, low-cost delivery platform that uses the ASUCD Unitrans network as middle‑mile infrastructure to help downtown Davis restaurants escape high DoorDash fees.

## 🎯 The Problem

Downtown Davis restaurants struggle with:
- **25-30% commission fees** from DoorDash/UberEats
- Loss of customer data and direct relationships
- High delivery costs passed to students
- Unsustainable business model for small local restaurants

## 💡 Our Solution

**TransitLink Delivery** - A DDBA-hosted platform where:
- Restaurants pay **0% commission** on food, only a flat delivery fee
- The extremely well‑connected ASUCD Unitrans network powers delivery through downtown and across the city
- Customers share their location; the system assigns the closest downtown‑serving stop and a compatible route
- Student stewards manage on‑bus handoff with QR verification
- Live tracking uses the public Unitrans feed once an order is ON_BUS

## 🏗️ Architecture

### Backend (FastAPI + SQLite)
- **Static route assignment** using Unitrans routeConfig and a downtown‑route map
- **Live Unitrans tracking** via the public Umo IQ XML feed (ON_BUS only)
- Order lifecycle management with role‑based permissions
- QR code generation and steward scan verification
- RESTful API with automatic documentation

### Frontend (React + TypeScript + Vite)
- **Student ordering interface** - Browse restaurants, select items, set location for nearest downtown stop
- **Steward scanning interface** - Scan to mark ON_BUS and scan again to complete
- **Restaurant dashboard** - Accept/decline and mark READY_FOR_PICKUP
- **Unitrans manager view** - Route‑filtered active and completed orders
- **Live map view** - Real-time Unitrans bus locations

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Mapbox API token (for map view)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will:
- Initialize SQLite database
- Seed demo data (restaurants, menu items, stops, windows)
- Start polling Unitrans feed every 15 seconds
- Serve API at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Create a `.env` file in frontend directory:
```
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Frontend will be available at `http://localhost:5173`

## 📱 User Flows

### Student Journey
1. Browse downtown restaurants and menus
2. Add items to order
3. Share location or pin it on the map
4. System assigns the closest downtown‑serving stop and route
5. Choose delivery window
6. Receive QR code for pickup
7. Track live status; show QR at handoff

### Restaurant Journey
1. Receive order notification
2. Accept or decline the order
3. Update status: PREPARING → READY_FOR_PICKUP
4. Hand order to steward when Unitrans arrives

### Steward Journey
1. Log in to steward interface
2. Pick up orders from restaurants
3. Scan QR to mark ON_BUS (route verified)
4. Navigate to designated stops
5. Scan again at drop‑off to mark COMPLETED

## 🎨 Features

### ✅ Core Features Implemented
- [x] Complete order lifecycle management
- [x] Menu browsing and ordering
- [x] QR code generation and verification
- [x] Restaurant dashboard with real-time updates
- [x] Steward scanning interface
- [x] Location-based nearest stop assignment
- [x] Downtown route mapping via Unitrans routeConfig
- [x] Real-time bus tracking (ON_BUS)
- [x] Order status tracking
- [x] Responsive UI design

### 🔮 Future Enhancements
- [ ] UC Davis SSO authentication
- [ ] Real QR scanner (camera integration)
- [ ] Push notifications for order updates
- [ ] Payment integration (Stripe)
- [ ] Route optimization for multi-order batches
- [ ] Analytics dashboard for ASUCD
- [ ] Student feedback system
- [ ] Multi-restaurant batching

## 💰 Economics

### For Restaurants
- **0% commission** on food sales
- Only **$2-3 flat fee** per order to ASUCD/Unitrans
- Standard payment processing (~3%)
- Keep 100% of customer data

### For Students
- **$1.50 delivery fee** (vs. $5-7 on DoorDash)
- Support local businesses and campus jobs
- Eco-friendly delivery option
- Convenient bus stop pickup

### For ASUCD/Unitrans
- New revenue stream from delivery fees
- Minimal marginal cost (buses already running)
- Creates student jobs (delivery stewards)
- Aligns with sustainability mission

## 🌱 Sustainability Impact

- **Zero additional vehicle emissions** - uses existing bus routes
- **CNG and electric Unitrans fleet**
- **Reduced single-occupancy delivery vehicles**
- **Consolidates multiple orders** per bus trip
- **Predictable time windows** minimize idle time

## 🔧 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Key Endpoints
- `GET /restaurants` - List all restaurants with menus
- `GET /restaurants/my-restaurant` - Restaurant owner profile
- `GET /stops` - List Unitrans stops
- `POST /stops/closest-downtown` - Closest downtown-serving stop for a location
- `GET /windows` - List delivery windows
- `POST /orders` - Create new order
- `GET /orders/{id}` - Get order details
- `GET /orders/my` - Student order history
- `PATCH /orders/{id}/status` - Update order status
- `GET /orders/{id}/qr-code` - QR code image
- `POST /steward/scan` - Verify QR code
- `GET /steward/orders` - Route-filtered steward orders
- `GET /bus-locations` - Real-time bus positions

## 🏆 Hackathon Pitch

**One-Sentence Pitch:**
"Transit-Link Delivery uses Unitrans buses with student stewards to provide ultra-low-cost ($1.50), eco-friendly food delivery for Davis Downtown restaurants, helping them escape DoorDash's 30% fees while creating campus jobs."

**Revenue Model:**
- Restaurants pay flat $2-3 per order
- Students pay $1.50 delivery fee
- ASUCD keeps remaining ~$1 per order
- At 100 orders/day: $36,500/year revenue

**Scalability:**
- Start with 2 time windows
- Expand to all Unitrans routes
- Add groceries, bakeries, retail
- Partner with other university transit systems

## 📊 Demo Data

Seeded automatically on first run:
- **10 Restaurants** with menus across cuisines
- **Multiple Unitrans Stops**, including downtown‑area stops
- **2 Delivery Windows**: Lunch and Dinner
- **Demo Users**: Student, Restaurant Owners, Steward, Admin

## 🤝 Team

Built for SacHacks 2026 to address the Davis Downtown Business Association challenge.

## 📝 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Davis Downtown Business Association (DDBA)
- UC Davis ASUCD & Unitrans
- Umo IQ for real-time bus tracking API
- SacHacks organizers

---

**Made with ❤️ for Davis local businesses and students**
