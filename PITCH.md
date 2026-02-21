# 🚌 Transit-Link Delivery - Hackathon Pitch

## The One-Liner
**"Transit-Link Delivery uses Unitrans buses with student stewards to provide ultra-low-cost ($1.50), eco-friendly food delivery for Davis Downtown restaurants, helping them escape DoorDash's 30% fees while creating campus jobs."**

---

## The Problem (30 seconds)

Downtown Davis restaurants are **hemorrhaging money** to DoorDash and UberEats:

- 📉 **25-30% commission fees** on every order
- 🎭 **Lost customer relationships** - marketplace owns the data
- 💸 **High delivery costs** passed to students ($5-7 per order)
- 🏪 Result: Local businesses can't compete with chains

**Real impact**: A restaurant making $50,000/month in delivery pays $15,000 in fees annually - enough to hire 2 full-time employees!

---

## Our Solution (45 seconds)

### "Aggie Express" - Unitrans as Delivery Infrastructure

**Core Concept**: Instead of cars driving point-to-point, we use **buses that are already running**:

1. 🍽️ **Restaurants** hand orders to Unitrans during fixed windows
2. 🚌 **Student stewards** on buses manage multiple orders
3. 🎓 **Students** pick up at nearest bus stop with QR authentication
4. 💚 **Zero additional emissions** - buses already making these trips

**Economics**:
- Restaurants pay **$2-3 flat fee** (vs. 30% = $6-9 on a $30 order)
- Students pay **$1.50** (vs. $5-7 on DoorDash)
- ASUCD earns **~$1/order** as new revenue stream
- Creates **20-30 student jobs** as delivery stewards

---

## Why It Works (30 seconds)

### 🎯 The Magic: "Predictable Time Windows"

Instead of all-day service:
- **Lunch Window**: 12:00-2:00 PM
- **Dinner Window**: 6:00-8:00 PM

This means:
- ✅ Concentrate orders → high efficiency
- ✅ No idle payroll → ASUCD doesn't lose money
- ✅ Predictable for everyone → easy to plan
- ✅ Matches student eating patterns

**Risk Mitigation**: If < 10 orders in a window? Cancel that run, no loss!

---

## Technical Implementation (45 seconds)

### Backend (FastAPI + Python)
- ⏱️ **Real-time Unitrans tracking** via Umo IQ API (polls every 15 seconds)
- 🗄️ Complete order management with SQLite
- 🔐 QR code generation/verification system
- 📍 Geospatial matching (Shapely + GeoPy)

### Frontend (React + TypeScript)
- 📱 **Student ordering** - Restaurant browsing, cart, stop selection
- 🔍 **Steward interface** - QR scanning, order verification
- 🍽️ **Restaurant dashboard** - Real-time order management
- 🗺️ **Live map** - See buses in real-time

### Data Flow
```
Student Order → Restaurant Prepares → Steward Picks Up → 
Bus Transport → Stop Arrival → QR Scan → Completed
```

---

## The Demo (2 minutes)

### What You'll See:

1. **Student Journey**:
   - Browse Downtown Tacos menu
   - Add items (Veggie Taco, Burrito)
   - Select Memorial Union stop
   - Choose Lunch window
   - Receive QR code for pickup

2. **Restaurant Dashboard**:
   - Auto-accepted order appears
   - Progress: PREPARING → READY → ON_BUS
   - Clear visibility of all orders

3. **Steward Interface**:
   - Enter QR code
   - Instant verification
   - Order marked COMPLETED
   - Student gets their food!

4. **Live Map**:
   - See real Unitrans buses moving
   - Actual GPS data from UCD fleet

---

## Business Model (30 seconds)

### Revenue Streams:
- Restaurants: $2.50 per order
- Students: $1.50 per order
- **Total: $4.00 per order**

### Costs:
- Payment processing: $0.10
- Tech platform: $0.10
- Steward wage allocation: $2.00
- **Total cost: $2.20**

### Net Revenue: **$1.80 per order to ASUCD**

**At Scale**:
- 100 orders/day = **$65,700/year**
- 250 orders/day = **$164,250/year**
- Funds sustainability initiatives, more student jobs

---

## Impact Metrics

### 💰 Economic
- Saves restaurants **$180,000/year** (vs. DoorDash @ 100 orders/day)
- Students save **$350,000/year** in delivery fees
- Creates **25 new student jobs**

### 🌱 Environmental
- **Zero new vehicle emissions**
- Leverages CNG/electric Unitrans fleet
- Consolidates 100+ trips/day → 6-8 bus routes
- Reduces downtown traffic congestion

### 🤝 Community
- Keeps money in Davis (vs. SF tech companies)
- Strengthens DDBA-ASUCD partnership
- Builds student workforce experience
- Supports local restaurants = local jobs

---

## Scalability (20 seconds)

### Phase 1: MVP (Now)
- 5-10 restaurants
- 3 major stops
- 2 time windows
- 1-2 steward shifts

### Phase 2: Expansion (3 months)
- All DDBA restaurants
- 10+ Unitrans stops
- Add late-night window
- 5-10 steward shifts

### Phase 3: Beyond Food (6 months)
- Campus bookstore deliveries
- Groceries from downtown markets
- Pharmacy prescriptions
- Laundry service

### Phase 4: Regional (1 year)
- Partner with other UC transit systems
- Berkeley, Santa Cruz, Irvine, LA
- State-wide network
- 100,000+ students served

---

## Competitive Advantages

### vs. DoorDash/UberEats:
- ✅ **10x lower fees** for restaurants
- ✅ **3x lower fees** for students
- ✅ **Zero emissions** vs. gas cars
- ✅ **Community ownership** vs. VC profit extraction

### vs. Restaurant In-House Delivery:
- ✅ **Shared infrastructure** - lower cost
- ✅ **Professional platform** - better UX
- ✅ **Pooled delivery** - higher efficiency
- ✅ **DDBA brand** - trusted consortium

### vs. Other University Delivery:
- ✅ **Most eco-friendly** - uses public transit
- ✅ **Lowest cost** - marginal cost near zero
- ✅ **Creates student jobs** - not contractors
- ✅ **Real-time tracking** - integrated Unitrans API

---

## What We Built in 24 Hours

✅ **Complete Backend**:
- 8 API endpoints
- Real-time Unitrans integration
- Order lifecycle management
- QR authentication system
- Auto-seeding demo data

✅ **Full Frontend**:
- 3 role-based interfaces
- Real-time map visualization
- Responsive design
- Complete order flow

✅ **Infrastructure**:
- SQLite database with 8 tables
- RESTful API with auto-docs
- CORS-enabled for production
- Error handling and validation

---

## Next Steps (Post-Hackathon)

### Week 1-2: Validation
- [ ] Present to DDBA board
- [ ] Survey 100 students on demand
- [ ] Get 3-5 restaurants committed
- [ ] Meet with ASUCD/Unitrans leadership

### Week 3-4: Pilot Prep
- [ ] UC Davis SSO integration
- [ ] Stripe payment integration
- [ ] Mobile app (React Native)
- [ ] Insurance and liability review

### Month 2: Soft Launch
- [ ] 2-week pilot with 3 restaurants
- [ ] 1 lunch window, 1 route
- [ ] 2 steward positions
- [ ] 50 orders target

### Month 3: Official Launch
- [ ] Full DDBA partnership
- [ ] 10+ restaurants
- [ ] All major Unitrans routes
- [ ] Marketing campaign: "Keep Davis Dollars in Davis"

---

## Team Asks

### From Judges:
- 🎯 Feedback on business model
- 🤝 Introductions to DDBA/ASUCD contacts
- 💡 Suggestions on regulatory hurdles
- 🏆 **Vote for us if you believe in local businesses!**

### From DDBA:
- Partner as platform host
- Recruit initial restaurant cohort
- Co-marketing support
- Advisory board seat

### From ASUCD:
- Unitrans partnership approval
- Student steward hiring infrastructure
- Insurance coordination
- Revenue-sharing agreement

---

## Closing Statement (15 seconds)

**"Transit-Link Delivery isn't just an app - it's a movement to:**
- 💪 **Empower local restaurants**
- 🌍 **Reduce carbon emissions**
- 🎓 **Create student opportunities**
- 🏘️ **Keep Davis dollars in Davis**

**Join us in building a more sustainable, equitable future for campus food delivery."**

---

## Contact & Links

- 🌐 Live Demo: `http://localhost:5173`
- 📊 API Docs: `http://localhost:8000/docs`
- 💻 GitHub: [Repository Link]
- 📧 Email: [Your Email]

**Built with ❤️ for Davis at SacHacks 2025**
