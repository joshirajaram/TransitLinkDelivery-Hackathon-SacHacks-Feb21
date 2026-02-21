# 🚌 Transit-Link Delivery

**SacHacks 2025 Hackathon Project**

A sustainable, low-cost delivery platform that uses UC Davis Unitrans buses as middle-mile infrastructure to help downtown Davis restaurants escape high DoorDash fees.

## 🎯 The Problem

Downtown Davis restaurants struggle with:
- **25-30% commission fees** from DoorDash/UberEats
- Loss of customer data and direct relationships
- High delivery costs passed to students
- Unsustainable business model for small local restaurants

## 💡 Our Solution

**"Aggie Express Delivery"** - A DDBA-hosted platform where:
- Restaurants pay **0% commission** on food, only flat delivery fees ($1.50)
- Unitrans buses carry orders during fixed time windows (Lunch & Dinner)
- Student "delivery stewards" manage orders on buses, creating campus jobs
- Students pick up orders at nearby bus stops with QR authentication
- Low-carbon, cost-efficient delivery using existing transit infrastructure

## 🏗️ Architecture

### Backend (FastAPI + SQLite)
- **Real-time Unitrans bus tracking** via Umo IQ XML feed
- Complete order management system
- Restaurant menu and order processing
- QR code generation and verification
- RESTful API with automatic documentation

### Frontend (React + TypeScript + Vite)
- **Student ordering interface** - Browse restaurants, select items, choose stops/windows
- **Steward scanning interface** - Verify QR codes and complete deliveries
- **Restaurant dashboard** - Manage orders and update status
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
3. Select nearest Unitrans stop
4. Choose delivery window (Lunch 12-2pm or Dinner 6-8pm)
5. Receive QR code for pickup
6. Go to bus stop during window
7. Show QR to steward and collect order

### Restaurant Journey
1. Receive order notification
2. Update status: PREPARING → READY_FOR_PICKUP
3. Hand order to steward when Unitrans arrives
4. Track delivery completion

### Steward Journey
1. Log in to steward interface
2. Pick up orders from restaurants
3. Mark orders as ON_BUS
4. Navigate to designated stops
5. Scan student QR codes to verify
6. Hand over orders and mark COMPLETED

## 🎨 Features

### ✅ Core Features Implemented
- [x] Complete order lifecycle management
- [x] Menu browsing and ordering
- [x] QR code generation and verification
- [x] Restaurant dashboard with real-time updates
- [x] Steward scanning interface
- [x] Fixed time windows (Lunch & Dinner)
- [x] Unitrans stop selection
- [x] Real-time bus tracking
- [x] Order status tracking
- [x] Responsive UI design

### 🔮 Future Enhancements
- [ ] UC Davis SSO authentication
- [ ] Real QR scanner (camera integration)
- [ ] Push notifications for order updates
- [ ] Payment integration (Stripe)
- [ ] Route optimization for multiple stops
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
- `GET /stops` - List Unitrans stops
- `GET /windows` - List delivery windows
- `POST /orders` - Create new order
- `GET /orders/{id}` - Get order details
- `PATCH /orders/{id}/status` - Update order status
- `POST /steward/scan` - Verify QR code
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
- Start with 2 time windows, 3 stops
- Expand to all Unitrans routes
- Add groceries, bakeries, retail
- Partner with other university transit systems

## 📊 Demo Data

Seeded automatically on first run:
- **1 Restaurant**: Downtown Tacos
- **4 Menu Items**: Veggie Taco, Chicken Taco, Fish Taco, Burrito
- **3 Unitrans Stops**: Memorial Union, Silo Terminal, ARC
- **2 Time Windows**: Lunch (12-2pm), Dinner (6-8pm)
- **3 Users**: Student, Restaurant Owner, Steward

## 🤝 Team

Built for SacHacks 2025 to address the Davis Downtown Business Association challenge.

## 📝 License

MIT License - See [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Davis Downtown Business Association (DDBA)
- UC Davis ASUCD & Unitrans
- Umo IQ for real-time bus tracking API
- SacHacks organizers

---

**Made with ❤️ for Davis local businesses and students**
