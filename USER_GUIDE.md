# 👥 User Guide - How Each Role Uses Transit-Link Delivery

## 🎓 STUDENT - "I want food delivered to my bus stop"

### Step-by-Step Process:

#### 1. **Login** (Production)
```
Visit: transitlink.ucdavis.edu
Click: "Login with UC Davis"
→ Redirects to CAS
→ Enter Kerberos credentials
→ Returns to site, logged in
```

#### 2. **Browse & Order**
1. See list of participating downtown restaurants
2. Click "Downtown Tacos"
3. Add items to cart:
   - 2x Veggie Tacos ($5.00 each)
   - 1x Burrito ($9.00)
4. See total: $19.00 food + $1.50 delivery = **$20.50**

#### 3. **Choose Delivery**
1. Select Unitrans stop: "Memorial Union (MU)"
2. Select time window: "Dinner (6:00pm-8:00pm)"
3. Confirm: "I'll be at MU between 6-8pm"

#### 4. **Pay & Confirm**
1. Pay with credit card or campus card
2. Receive confirmation email
3. **QR code displayed**: `a1b2c3d4`
4. Save QR code to phone

#### 5. **Pick Up**
1. Go to Memorial Union bus stop at 6:30pm
2. Wait for Unitrans delivery bus
3. Steward arrives with insulated bags
4. Show QR code on phone
5. Steward scans → Hands over food
6. Enjoy your meal! 🌮

### What Students Can Do:
- ✅ Browse all restaurants & menus
- ✅ Place unlimited orders
- ✅ View order history
- ✅ Track order status in real-time
- ✅ Cancel pending orders (before restaurant accepts)
- ✅ Rate restaurants & delivery experience
- ✅ Add favorite restaurants
- ✅ Set delivery preferences

### What Students CAN'T Do:
- ❌ See other students' orders
- ❌ Modify orders after restaurant accepts
- ❌ Access restaurant/steward interfaces
- ❌ Change delivery windows after placing order

---

## 🍽️ RESTAURANT - "I need to manage incoming orders"

### Step-by-Step Process:

#### 1. **Login**
```
Visit: transitlink.ucdavis.edu/restaurant
Login with restaurant credentials
See: Dashboard with today's orders
```

#### 2. **Receive Orders**
1. Notification: "New order received!"
2. Order appears in dashboard:
   ```
   Order #42
   Time: 5:45pm
   Window: Dinner (6-8pm)
   Stop: Memorial Union
   Items: 2x Veggie Taco, 1x Burrito
   Total: $19.00
   Status: PENDING
   ```

#### 3. **Accept & Prepare**
1. Click "Accept Order" (or auto-accept)
2. Status changes: PENDING → ACCEPTED
3. Start cooking
4. Click "Mark as Preparing"
5. Status: PREPARING

#### 4. **Ready for Pickup**
1. Food is ready at 6:15pm
2. Package in insulated bag
3. Label with order number: #42
4. Click "Ready for Pickup"
5. Status: READY_FOR_PICKUP
6. Alert: "Steward will arrive at 6:25pm"

#### 5. **Hand Off to Steward**
1. Steward arrives at 6:25pm
2. Verify order number
3. Hand over food
4. Click "On Bus"
5. Status: ON_BUS
6. Done! Payment deposited at end of day

### Restaurant Dashboard View:
```
TODAY'S ORDERS          REVENUE TODAY
    12                     $456.00

ACTIVE ORDERS (3)
┌─────────────────────────────────┐
│ Order #42 | 6:15pm | PREPARING  │
│ 2x Veggie Taco, 1x Burrito      │
│ Drop-off: Memorial Union        │
│ [Mark as Ready]                 │
├─────────────────────────────────┤
│ Order #43 | 6:30pm | ACCEPTED   │
│ ...                             │
└─────────────────────────────────┘

COMPLETED ORDERS (9)
Revenue today: $456.00
Platform fees: -$25.00
Your earnings: $431.00
```

### What Restaurants Can Do:
- ✅ View orders for THEIR restaurant only
- ✅ Accept/reject orders (within time limit)
- ✅ Update order status
- ✅ Manage menu items (add/edit/disable/prices)
- ✅ Set operating hours & delivery windows
- ✅ View daily/weekly/monthly revenue
- ✅ Download financial reports
- ✅ Contact support for issues

### What Restaurants CAN'T Do:
- ❌ See other restaurants' orders
- ❌ Complete orders (only stewards can)
- ❌ Modify delivery fees (ASUCD sets these)
- ❌ Access student payment information

---

## 🚌 STEWARD - "I deliver orders on Unitrans buses"

### Step-by-Step Process:

#### 1. **Login & Check Schedule**
```
Visit: transitlink.ucdavis.edu/steward
Login with ASUCD employee ID
See shift schedule:
  TODAY: Dinner Window (6:00pm-8:00pm)
  Route: A Line (Downtown → Campus)
  Orders: 8 pickups, 12 drop-offs
```

#### 2. **Pre-Shift Prep**
1. Review order list at 5:45pm
2. See which restaurants to visit:
   - Downtown Tacos: 3 orders
   - Davis Pizzeria: 2 orders
   - Pluto's: 3 orders
3. Check insulated bags & equipment
4. Board assigned Unitrans bus at 6:00pm

#### 3. **Restaurant Pickups** (6:00pm-6:30pm)
1. Bus stops at downtown hub
2. Go to Downtown Tacos
3. Show steward ID
4. Restaurant hands over 3 orders
5. Verify order numbers: #42, #43, #44
6. Load into insulated bags
7. Click "Picked Up" in app for each
8. Status: READY_FOR_PICKUP → ON_BUS
9. Repeat for other restaurants

#### 4. **On the Bus** (6:30pm-7:30pm)
1. Organize orders by stop:
   - Memorial Union: Orders #42, #45, #47
   - Silo: Orders #43, #46
   - ARC: Orders #44, #48
2. Monitor app for real-time updates
3. Bus follows normal Unitrans route

#### 5. **Drop-offs at Each Stop**
**Memorial Union stop (6:45pm):**
1. Bus arrives at MU
2. Stand near bus door with insulated bags
3. Students approach showing phones
4. Student #1 shows QR: `a1b2c3d4`
5. Scan QR code with phone
6. App confirms: "Order #42 - 2x Veggie Taco, 1x Burrito"
7. Hand over food
8. Status automatically: ON_BUS → COMPLETED
9. Repeat for other students at this stop
10. Bus continues route

**Handle no-shows:**
- Student doesn't arrive within 3 minutes
- Click "Mark as No-Show"
- Order returned to restaurant or donated
- Student charged cancellation fee

#### 6. **End of Shift** (8:00pm)
1. All orders delivered
2. Return any no-shows
3. Submit shift report in app
4. Get paid for hours worked

### Steward Interface View:
```
ACTIVE DELIVERY WINDOW
Dinner (6:00pm-8:00pm) | Route: A Line

PICKUPS COMPLETE ✅
Downtown Tacos: 3 orders picked up
Davis Pizzeria: 2 orders picked up

NEXT STOP: Memorial Union (2 min)
┌─────────────────────────────────┐
│ Order #42 | QR: a1b2c3d4        │
│ 2x Veggie Taco, 1x Burrito      │
│ Student: John D.                │
│ [Scan QR]                       │
├─────────────────────────────────┤
│ Order #45 | QR: e5f6g7h8        │
│ ...                             │
└─────────────────────────────────┘

COMPLETED TODAY: 6/8 orders
REMAINING STOPS: Silo (next), ARC
```

### What Stewards Can Do:
- ✅ View orders for their assigned window/route
- ✅ Scan QR codes to verify pickup
- ✅ Mark orders as completed
- ✅ Report issues (no-shows, wrong orders, spills)
- ✅ Contact restaurants for problems
- ✅ View shift schedule & earnings
- ✅ Request time off or shift swaps

### What Stewards CAN'T Do:
- ❌ Create or place orders
- ❌ Modify restaurant menus
- ❌ Complete orders without QR verification
- ❌ Access student payment info
- ❌ View orders outside their assigned window

---

## 👔 ASUCD ADMIN - "I manage the platform"

### Step-by-Step Process:

#### 1. **Login & Dashboard**
```
Visit: transitlink.ucdavis.edu/admin
Login with ASUCD admin credentials
See main dashboard:
```

```
PLATFORM OVERVIEW - Today

ORDERS                  REVENUE
  45                    $1,234

ACTIVE STEWARDS        RESTAURANTS
     4                      12

┌── ALERTS (2) ──────────────────┐
│ ⚠️  Order #38 - No-show         │
│ 📋  New restaurant application  │
└────────────────────────────────┘
```

#### 2. **Manage Restaurants**
1. Review new restaurant application:
   - Name: "Burgers & Brew"
   - Location: 403 3rd St
   - Menu submitted
   - Owner verification pending
2. Actions:
   - Verify business license
   - Check health permits
   - Approve or reject
   - Set commission rate
   - Assign account credentials

#### 3. **Manage Delivery Operations**
**Delivery Windows Management:**
```
LUNCH (12:00pm-2:00pm)
Status: Active
Stewards: 2 assigned
Daily Orders Avg: 25
[Edit] [Disable]

DINNER (6:00pm-8:00pm)
Status: Active
Stewards: 4 assigned
Daily Orders Avg: 45
[Edit] [Disable]

[+ Add New Window]
```

**Unitrans Stops Management:**
```
ACTIVE STOPS (10)
┌────────────────────────────────┐
│ Memorial Union (MU)            │
│ Orders/day: 15 | Active: ✅     │
│ [Edit] [View History]          │
├────────────────────────────────┤
│ Silo Terminal                  │
│ Orders/day: 12 | Active: ✅     │
└────────────────────────────────┘

[+ Add New Stop]
```

#### 4. **Manage Stewards**
```
STEWARD ROSTER
┌─────────────────────────────────┐
│ Sarah Chen                      │
│ ID: 12345 | Hired: 09/2025     │
│ Shifts this week: 4             │
│ Rating: 4.9⭐                    │
│ [View Profile] [Schedule]       │
├─────────────────────────────────┤
│ Marcus Johnson                  │
│ ...                             │
└─────────────────────────────────┘

[+ Hire New Steward]
[📅 Manage Schedule]
```

#### 5. **View Analytics**
```
REVENUE REPORT - This Month
Total Orders: 1,234
Gross Revenue: $45,678
Restaurant Payments: $42,000
Steward Wages: $2,500
Platform Costs: $500
Net Revenue (ASUCD): $678

MOST POPULAR:
1. Downtown Tacos - 345 orders
2. Davis Pizzeria - 289 orders
3. Pluto's - 234 orders

BUSIEST STOPS:
1. Memorial Union - 456 orders
2. Silo Terminal - 398 orders
3. ARC - 234 orders
```

#### 6. **Handle Issues**
When problems occur:
1. View issue reports
2. Contact relevant parties
3. Issue refunds if needed
4. Update policies
5. Train stewards on resolution

### What Admins Can Do:
- ✅ View ALL orders across platform
- ✅ Add/remove restaurants
- ✅ Approve restaurant applications
- ✅ Manage delivery windows & stops
- ✅ Hire & manage stewards
- ✅ Assign steward shifts
- ✅ Override any order status
- ✅ Issue refunds
- ✅ View complete financial reports
- ✅ Modify platform settings
- ✅ Handle customer support
- ✅ Generate analytics reports
- ✅ Manage user roles & permissions

### What Admins CAN'T Do:
- ❌ See student payment card numbers
- ❌ Impersonate users (audit trail always maintained)

---

## 🔐 Security & Privacy

### Data Each Role Can See:

**Students:**
- ✅ Their own orders & history
- ✅ Restaurant menus & info
- ❌ Other students' orders
- ❌ Restaurant revenue

**Restaurants:**
- ✅ Their orders only
- ✅ Their revenue & stats
- ❌ Other restaurants' data
- ❌ Student personal info (only first name + last initial)

**Stewards:**
- ✅ Orders in their assigned window
- ✅ Student first name + last initial for verification
- ❌ Full student profile
- ❌ Payment information
- ❌ Orders outside their shift

**Admins:**
- ✅ Aggregated platform data
- ✅ Order histories (for support)
- ✅ Restaurant & steward info
- ❌ Student payment card numbers (handled by Stripe)

---

## 📱 Access Methods

### Students:
- Website: transitlink.ucdavis.edu
- Mobile app: iOS & Android
- Progressive Web App (PWA)

### Restaurants:
- Restaurant portal: transitlink.ucdavis.edu/restaurant
- Tablet app for kitchen display

### Stewards:
- Mobile app optimized for scanning
- Works offline for poor bus WiFi

### Admins:
- Admin panel: transitlink.ucdavis.edu/admin
- Desktop-optimized interface

---

## 💡 Key Differences from DoorDash

| Feature | DoorDash | Transit-Link |
|---------|----------|--------------|
| Order flow | Driver picks up → drives to customer | Bus carries multiple orders → stop pickup |
| Delivery | Door-to-door | Bus stop pickup |
| Cost (student) | $5-7 per order | $1.50 per order |
| Cost (restaurant) | 25-30% commission | $2-3 flat fee |
| Timing | 30-45 min anytime | Fixed windows (lunch/dinner) |
| Sustainability | Gas car per order | Zero additional emissions |
| Jobs | Gig contractors | Student employees with benefits |
| Customer data | DoorDash owns | Restaurant owns |

---

## 🎯 Summary

**Each role has a specific purpose:**
- **Students**: Order food conveniently and cheaply
- **Restaurants**: Fulfill orders without high fees
- **Stewards**: Earn money delivering on existing bus routes
- **ASUCD**: Generate revenue while supporting community

**The system works because:**
- Clear role separation
- Proper authentication
- Real-time communication
- Existing infrastructure (Unitrans)
- Community benefit over profit

**Want me to create the authentication code to implement these role separations now?**
