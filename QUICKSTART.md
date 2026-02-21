# 🚀 Quick Start Guide

Get Transit-Link Delivery running in **5 minutes**!

## Prerequisites Check
```bash
python --version  # Should be 3.11+
node --version    # Should be 18+
```

## 1️⃣ Backend Setup (2 minutes)

```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**What happens:**
- ✅ Creates SQLite database (`tld.db`)
- ✅ Seeds demo data (restaurant, menu, stops, windows)
- ✅ Starts polling Unitrans buses every 15 seconds
- ✅ API available at `http://localhost:8000`

**Verify it works:**
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

## 2️⃣ Frontend Setup (2 minutes)

Open a **new terminal** window:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file (optional - map will still work without Mapbox token)
cp .env.example .env
# Edit .env and add your Mapbox token if you have one

# Start the dev server
npm run dev
```

**What happens:**
- ✅ Installs React, TypeScript, axios, react-qrcode-logo, etc.
- ✅ Starts Vite dev server
- ✅ Opens at `http://localhost:5173`

## 3️⃣ Open Your Browser

Navigate to: **http://localhost:5173**

You should see the Transit-Link Delivery login page.

## 🔑 Demo Accounts (Role-Based Access)

Each role sees **only their relevant tabs**:

### 👤 **Student Account**
- **Email:** `student@ucdavis.edu`
- **Password:** `anything` (any password works)
- **Access:** 📚 Place Order, 🗺️ Live Map

### 🍽️ **Restaurant Owner Account**
- **Email:** `owner@tacomadavis.com`
- **Password:** `anything`
- **Access:** 🍽️ My Restaurant, 🗺️ Live Map

### 🎒 **ASUCD Steward Account**
- **Email:** `steward@ucdavis.edu`
- **Password:** `anything`
- **Access:** 🎒 Steward Scan, 🗺️ Live Map

### 🎯 **DDBA Admin Account** (Full Access)
- **Email:** `admin@ddba.org`
- **Password:** `anything`
- **Access:** ALL tabs (Central Dashboard, Student, Restaurant, Steward, Map, Demo)

## 🎬 Demo Flow (1 minute)

### Student Order Flow:
1. **Login as Student:** `student@ucdavis.edu`
2. Select "Downtown Tacos" from dropdown
3. Add items:
   - Veggie Taco: quantity 2
   - Burrito: quantity 1
4. Select stop: "Memorial Union (MU)"
5. Select window: "Lunch (12:00–14:00)"
6. Click "Place Order"
7. **📝 See order tracking with ETA** and note the QR code (e.g., `a1b2c3d4`)

### Restaurant Dashboard:
1. **Logout and login as Restaurant:** `owner@tacomadavis.com`
2. See your order appear in the dashboard with **📦 Package QR Code**
3. Click "Mark as PREPARING"
4. Click "Mark as READY_FOR_PICKUP"
5. Note: Student sees ETA update in real-time!

### Steward Scan:
1. **Logout and login as Steward (ASUCD):** `steward@ucdavis.edu`
2. Enter the QR code from the order (e.g., `a1b2c3d4`)
3. Click "Verify Pickup"
4. Order automatically marked as COMPLETED ✅

### Admin Dashboard:
1. **Logout and login as Admin:** `admin@ddba.org`
2. See **Central Dashboard** with platform-wide analytics
3. View total orders, revenue saved vs DoorDash
4. Access ALL tabs to monitor entire system

### Live Map:
1. **Available to all roles** - Click "Live Map" tab
2. See real Unitrans buses moving around Davis
3. (Requires Mapbox token in .env for full functionality)

## 🔧 Troubleshooting

### Backend won't start
```bash
# Make sure you're in the backend directory
cd backend

# Check if port 8000 is already in use
# Windows:
netstat -ano | findstr :8000

# If occupied, kill the process or use a different port:
uvicorn app.main:app --reload --port 8001
```

### Frontend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or try running on different port:
npm run dev -- --port 5174
```

### CORS errors in browser console
Make sure backend is running on `http://localhost:8000` or update `VITE_API_URL` in frontend/.env

### Map not showing buses
1. Check that backend is running (look for "Polled X bus locations" in backend logs)
2. Add Mapbox token to frontend/.env
3. Buses update every 15 seconds - wait a moment

### Database issues
```bash
# Reset database by deleting it:
cd backend
rm tld.db

# Restart backend - will recreate and re-seed
uvicorn app.main:app --reload
```

## 📚 Additional Resources

- **API Documentation**: http://localhost:8000/docs
- **Full README**: See `README.md` in root directory
- **API Testing Guide**: See `API_TESTING.md`
- **Hackathon Pitch**: See `PITCH.md`

## 🐛 Common Questions

**Q: Where's the demo data?**  
A: Auto-seeded on first backend startup. Check backend terminal for "Demo data seeded successfully" message.

**Q: Can I add more restaurants?**  
A: Yes! Use the API or modify `seed_demo_data()` function in `backend/app/main.py`

**Q: How do I test without the frontend?**  
A: Use curl commands in `API_TESTING.md` or use http://localhost:8000/docs (Swagger UI)

**Q: Are the bus locations real?**  
A: Yes! We poll the actual Unitrans Umo IQ feed every 15 seconds for live GPS data.

**Q: Does this work in production?**  
A: This is a hackathon MVP. For production you'd need:
- Authentication (UC Davis SSO)
- Payment processing (Stripe)
- HTTPS and proper CORS configuration
- Mobile apps
- Real QR scanner (camera)

## ✅ Success Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Can see "Transit-Link Delivery" page in browser
- [ ] Can create an order through Student interface
- [ ] Can see order in Restaurant dashboard
- [ ] Can complete order through Steward scan
- [ ] Can see buses on Live Map (if Mapbox token configured)

## 🎉 You're Ready!

Now you can demo the full end-to-end flow to judges, test the API, or continue development.

For the full pitch and business case, see `PITCH.md`.

Good luck at the hackathon! 🚀
