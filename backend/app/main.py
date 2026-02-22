from __future__ import annotations

import asyncio
import logging
import secrets
import time
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, time as dt_time
from typing import Any

import httpx
import xmltodict
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .auth import (
    Token,
    UserLogin,
    CurrentUser,
    create_access_token,
    get_current_user,
    require_student,
    require_restaurant,
    require_steward,
    require_admin,
    verify_google_token,
    get_or_create_google_user,
)

from .db import (
    DeliveryWindowORM,
    MenuItemORM,
    OrderItemORM,
    OrderORM,
    RestaurantORM,
    SessionLocal,
    UnitransStopORM,
    UserORM,
    init_db,
)
from .logistics_engine import find_closest_stop_to_downtown_perimeter, find_optimal_bus_line
from .bus_matching import find_best_bus_for_order
from .models import BusLocation, BusStop, DeliveryWindow, MenuItem, Order, OrderStatus, Restaurant, UnitransStop, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tld")

UNITRANS_FEED_URL = "https://retro.umoiq.com/service/publicXMLFeed"
POLL_INTERVAL_SECONDS = 15

bus_location_cache: list[BusLocation] = []
cache_lock = asyncio.Lock()


# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def fetch_vehicle_locations_xml(client: httpx.AsyncClient) -> str:
    params = {
        "command": "vehicleLocations",
        "a": "unitrans",
        "t": str(int(time.time())),
    }
    response = await client.get(UNITRANS_FEED_URL, params=params)
    response.raise_for_status()
    return response.text


def parse_vehicle_locations_xml(xml_payload: str) -> list[BusLocation]:
    """
    Parses Umo IQ XML payload into BusLocation records.
    Supports payloads where <vehicle> may be a dict or list.
    """
    data = xmltodict.parse(xml_payload)
    if "Error" in data:
        error_msg = data.get("Error", "Unknown UmoIQ error")
        logger.warning("UmoIQ returned error payload: %s", error_msg)
        return []

    body = data.get("body", {})
    vehicles = body.get("vehicle", [])

    if isinstance(vehicles, dict):
        vehicles = [vehicles]

    parsed_locations: list[BusLocation] = []

    def get_attr(record: dict, key: str, default: str | None = None) -> str | None:
        return record.get(f"@{key}", record.get(key, default))

    for vehicle in vehicles:
        try:
            parsed_locations.append(
                BusLocation(
                    vehicle_id=str(get_attr(vehicle, "id", "unknown")),
                    route_tag=str(get_attr(vehicle, "routeTag", "unknown")),
                    latitude=float(get_attr(vehicle, "lat")),
                    longitude=float(get_attr(vehicle, "lon")),
                    heading=float(get_attr(vehicle, "heading"))
                    if get_attr(vehicle, "heading")
                    else None,
                    speed_kmh=float(get_attr(vehicle, "speedKmHr"))
                    if get_attr(vehicle, "speedKmHr")
                    else None,
                    last_reported_epoch_ms=int(get_attr(vehicle, "secsSinceReport"))
                    if get_attr(vehicle, "secsSinceReport")
                    else None,
                )
            )
        except (KeyError, TypeError, ValueError) as exc:
            logger.warning("Skipping malformed vehicle record: %s", exc)

    return parsed_locations


async def poll_unitrans_feed_forever() -> None:
    async with httpx.AsyncClient(timeout=15.0) as client:
        while True:
            try:
                xml_payload = await fetch_vehicle_locations_xml(client)
                parsed_locations = parse_vehicle_locations_xml(xml_payload)
                async with cache_lock:
                    bus_location_cache.clear()
                    bus_location_cache.extend(parsed_locations)
                logger.info("Polled %d bus locations", len(parsed_locations))
            except httpx.HTTPError as exc:
                logger.error("HTTP error while polling feed: %s", exc)
            except Exception as exc:
                logger.exception("Unexpected polling error: %s", exc)

            await asyncio.sleep(POLL_INTERVAL_SECONDS)


def seed_demo_data(db: Session) -> None:
    """Seed initial data for demo purposes."""
    # Check if already seeded
    if db.query(RestaurantORM).first():
        return

    # Create users
    student = UserORM(email="student@ucdavis.edu", name="Test Student", role=UserRole.STUDENT.value)
    owner = UserORM(email="owner@tacomadavis.com", name="Taco Owner", role=UserRole.RESTAURANT_OWNER.value)
    steward = UserORM(email="steward@ucdavis.edu", name="ASUCD Steward", role=UserRole.STEWARD.value)
    admin = UserORM(email="admin@ddba.org", name="DDBA Admin", role=UserRole.ADMIN.value)
    db.add_all([student, owner, steward, admin])
    db.flush()

    # Create restaurant with menu
    restaurant = RestaurantORM(
        name="Downtown Tacos",
        description="Local Davis tacos",
        latitude=38.5449,
        longitude=-121.7405,
        owner_id=owner.id,
        avg_prep_minutes=15,
        delivery_fee_cents=150,
    )
    db.add(restaurant)
    db.flush()

    menu_items = [
        MenuItemORM(restaurant_id=restaurant.id, name="Veggie Taco", description="Fresh vegetables", price_cents=500),
        MenuItemORM(restaurant_id=restaurant.id, name="Chicken Taco", description="Grilled chicken", price_cents=650),
        MenuItemORM(restaurant_id=restaurant.id, name="Fish Taco", description="Fresh fish", price_cents=750),
        MenuItemORM(restaurant_id=restaurant.id, name="Burrito", description="Large burrito", price_cents=900),
    ]
    db.add_all(menu_items)

    # Create Unitrans stops
    stops = [
        UnitransStopORM(code="MU", name="Memorial Union", description="Main campus hub", latitude=38.5422, longitude=-121.7506),
        UnitransStopORM(code="SILO", name="Silo Terminal", description="South campus", latitude=38.5390, longitude=-121.7513),
        UnitransStopORM(code="ARC", name="Activities & Recreation Center", description="West campus", latitude=38.5378, longitude=-121.7588),
    ]
    db.add_all(stops)

    # Create delivery windows
    lunch = DeliveryWindowORM(label="Lunch", start_time=dt_time(12, 0), end_time=dt_time(14, 0), is_active=True)
    dinner = DeliveryWindowORM(label="Dinner", start_time=dt_time(18, 0), end_time=dt_time(20, 0), is_active=True)
    db.add_all([lunch, dinner])

    db.commit()
    logger.info("Demo data seeded successfully")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    # Seed demo data
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    
    poller_task = asyncio.create_task(poll_unitrans_feed_forever())
    yield
    poller_task.cancel()
    with suppress(asyncio.CancelledError):
        await poller_task


app = FastAPI(title="Transit-Link Delivery API", version="0.1.0", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic schemas for API requests/responses
class RestaurantOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    latitude: float
    longitude: float
    delivery_fee_cents: int
    menu_items: list[MenuItemOut]

    class Config:
        from_attributes = True


class MenuItemOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    price_cents: int

    class Config:
        from_attributes = True


class StopOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    latitude: float
    longitude: float

    class Config:
        from_attributes = True


class WindowOut(BaseModel):
    id: int
    label: str
    start_time: dt_time
    end_time: dt_time

    class Config:
        from_attributes = True


class OrderItemIn(BaseModel):
    menu_item_id: int
    quantity: int


class CreateOrderIn(BaseModel):
    student_id: int
    restaurant_id: int
    stop_id: int
    window_id: int
    items: list[OrderItemIn]


class OrderItemOut(BaseModel):
    menu_item_id: int
    menu_item_name: str
    quantity: int
    price_cents: int


class OrderOut(BaseModel):
    id: int
    student_id: int
    restaurant_id: int
    restaurant_name: str
    stop: StopOut
    window: WindowOut
    total_price_cents: int
    delivery_fee_cents: int
    status: str
    bus_id: str | None = None
    qr_code: str
    created_at: datetime
    items: list[OrderItemOut]

    class Config:
        from_attributes = True


class UpdateStatusIn(BaseModel):
    status: str


class QRScanIn(BaseModel):
    qr_code: str


class DashboardStats(BaseModel):
    total_orders: int
    total_revenue_cents: int
    active_orders: int
    total_restaurants: int
    avg_delivery_time_mins: int


class RestaurantStats(BaseModel):
    restaurant_id: int
    restaurant_name: str
    order_count: int
    revenue_cents: int


class DashboardData(BaseModel):
    stats: DashboardStats
    restaurant_performance: list[RestaurantStats]
    recent_orders: list[OrderOut]


# ========== API Endpoints ==========

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/admin/dashboard", response_model=DashboardData)
def get_dashboard_data(
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get aggregated dashboard data for DDBA administrators"""
    from sqlalchemy import func
    
    # Get total stats
    total_orders = db.query(func.count(OrderORM.id)).scalar() or 0
    total_revenue = db.query(func.sum(OrderORM.total_price_cents)).scalar() or 0
    active_orders = db.query(func.count(OrderORM.id)).filter(
        OrderORM.status.in_([OrderStatus.ACCEPTED.value, OrderStatus.PICKED_UP.value])
    ).scalar() or 0
    total_restaurants = db.query(func.count(RestaurantORM.id)).scalar() or 0
    
    # Calculate average delivery time (simplified - would need tracking in production)
    avg_delivery_time = 25  # Mock value for demo
    
    stats = DashboardStats(
        total_orders=total_orders,
        total_revenue_cents=total_revenue,
        active_orders=active_orders,
        total_restaurants=total_restaurants,
        avg_delivery_time_mins=avg_delivery_time
    )
    
    # Get restaurant performance
    restaurant_stats = db.query(
        RestaurantORM.id,
        RestaurantORM.name,
        func.count(OrderORM.id).label("order_count"),
        func.sum(OrderORM.total_price_cents).label("revenue")
    ).join(OrderORM, RestaurantORM.id == OrderORM.restaurant_id, isouter=True).group_by(
        RestaurantORM.id, RestaurantORM.name
    ).all()
    
    restaurant_performance = [
        RestaurantStats(
            restaurant_id=r.id,
            restaurant_name=r.name,
            order_count=r.order_count or 0,
            revenue_cents=r.revenue or 0
        )
        for r in restaurant_stats
    ]
    
    # Get recent orders (last 10)
    recent_orders_query = db.query(OrderORM).order_by(OrderORM.created_at.desc()).limit(10).all()
    
    recent_orders = [
        OrderOut(
            id=order.id,
            student_id=order.student_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=order.restaurant.name,
            stop=StopOut.model_validate(order.stop),
            window=WindowOut.model_validate(order.window),
            total_price_cents=order.total_price_cents,
            delivery_fee_cents=order.delivery_fee_cents,
            status=order.status,
            bus_id=order.bus_id,
            qr_code=order.qr_code,
            created_at=order.created_at,
            items=[
                OrderItemOut(
                    menu_item_id=oi.menu_item_id,
                    menu_item_name=oi.menu_item.name,
                    quantity=oi.quantity,
                    price_cents=oi.price_cents,
                )
                for oi in order.items
            ],
        )
        for order in recent_orders_query
    ]
    
    return DashboardData(
        stats=stats,
        restaurant_performance=restaurant_performance,
        recent_orders=recent_orders
    )


# ========== Authentication Endpoints ==========

@app.post("/auth/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Demo login endpoint - production would use UC Davis CAS SSO"""
    user = db.query(UserORM).filter(UserORM.email == user_credentials.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # For demo purposes, accept any password
    # In production, this would validate against CAS or check hashed password
    
    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "role": user.role
        },
        expires_delta=timedelta(hours=8)
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


@app.get("/auth/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Get current logged-in user information"""
    return current_user


class GoogleAuthRequest(BaseModel):
    token: str


@app.post("/auth/google", response_model=Token)
async def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate with Google OAuth
    
    Frontend sends Google ID token, backend verifies it and creates/updates user
    """
    # Verify Google token and get user info
    google_user_info = await verify_google_token(payload.token)
    
    # Get or create user in database
    user = get_or_create_google_user(google_user_info, db)
    
    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "role": user.role
        },
        expires_delta=timedelta(hours=8)
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


@app.get("/restaurants", response_model=list[RestaurantOut])
def list_restaurants(db: Session = Depends(get_db)):
    restaurants = db.query(RestaurantORM).all()
    result = []
    for r in restaurants:
        result.append(
            RestaurantOut(
                id=r.id,
                name=r.name,
                description=r.description,
                latitude=r.latitude,
                longitude=r.longitude,
                delivery_fee_cents=r.delivery_fee_cents,
                menu_items=[
                    MenuItemOut(
                        id=mi.id,
                        name=mi.name,
                        description=mi.description,
                        price_cents=mi.price_cents,
                    )
                    for mi in r.menu_items
                    if mi.is_active
                ],
            )
        )
    return result


@app.get("/restaurants/my-restaurant", response_model=RestaurantOut)
def get_my_restaurant(
    current_user: CurrentUser = Depends(require_restaurant),
    db: Session = Depends(get_db)
):
    """Get the restaurant owned by the current user"""
    restaurant = db.query(RestaurantORM).filter(RestaurantORM.owner_id == current_user.id).first()
    
    if not restaurant:
        raise HTTPException(404, "No restaurant found for this user")
    
    return RestaurantOut(
        id=restaurant.id,
        name=restaurant.name,
        description=restaurant.description,
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        delivery_fee_cents=restaurant.delivery_fee_cents,
        menu_items=[
            MenuItemOut(
                id=mi.id,
                name=mi.name,
                description=mi.description,
                price_cents=mi.price_cents,
            )
            for mi in restaurant.menu_items
            if mi.is_active
        ],
    )


@app.get("/stops", response_model=list[StopOut])
def list_stops(db: Session = Depends(get_db)):
    stops = db.query(UnitransStopORM).all()
    return [StopOut.model_validate(s) for s in stops]


@app.get("/windows", response_model=list[WindowOut])
def list_windows(db: Session = Depends(get_db)):
    windows = db.query(DeliveryWindowORM).filter(DeliveryWindowORM.is_active == True).all()
    return [WindowOut.model_validate(w) for w in windows]


@app.post("/orders", response_model=OrderOut)
def create_order(
    payload: CreateOrderIn,
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db)
):
    # Override student_id with authenticated user
    payload.student_id = current_user.id
    
    # Validate restaurant exists
    restaurant = db.query(RestaurantORM).filter(RestaurantORM.id == payload.restaurant_id).first()
    if not restaurant:
        raise HTTPException(404, "Restaurant not found")

    # Validate stop and window
    stop = db.query(UnitransStopORM).filter(UnitransStopORM.id == payload.stop_id).first()
    window = db.query(DeliveryWindowORM).filter(DeliveryWindowORM.id == payload.window_id).first()
    if not stop or not window:
        raise HTTPException(404, "Stop or window not found")

    # Get menu items
    menu_item_ids = [i.menu_item_id for i in payload.items]
    menu_items_db = db.query(MenuItemORM).filter(MenuItemORM.id.in_(menu_item_ids)).all()
    menu_items_dict = {mi.id: mi for mi in menu_items_db}

    if len(menu_items_dict) != len(payload.items):
        raise HTTPException(400, "Invalid menu item in request")

    # Calculate total
    total = 0
    order_items_data = []
    for item in payload.items:
        mi = menu_items_dict[item.menu_item_id]
        price = mi.price_cents
        total += price * item.quantity
        order_items_data.append((mi, item.quantity, price))

    # Generate QR code
    qr_token = secrets.token_hex(4)

    # Create order
    order = OrderORM(
        student_id=payload.student_id,
        restaurant_id=payload.restaurant_id,
        stop_id=payload.stop_id,
        window_id=payload.window_id,
        total_price_cents=total,
        delivery_fee_cents=restaurant.delivery_fee_cents,
        status=OrderStatus.ACCEPTED.value,  # Auto-accept for demo
        qr_code=qr_token,
    )
    db.add(order)
    db.flush()

    # Add order items
    for mi, qty, price in order_items_data:
        db.add(OrderItemORM(order_id=order.id, menu_item_id=mi.id, quantity=qty, price_cents=price))

    db.commit()
    db.refresh(order)

    # Try to assign a bus using the matching algorithm
    try:
        # Get current bus locations from global state
        active_buses = [
            {
                "bus_id": str(bl.id),
                "lat": bl.lat,
                "lon": bl.lon,
                "route": bl.route,
                "last_updated": bl.timestamp,
            }
            for bl in latest_bus_locations.values()
        ]
        
        # Find best bus for this order
        best_bus = find_best_bus_for_order(
            order_id=order.id,
            restaurant_location=(restaurant.latitude, restaurant.longitude),
            delivery_location=(stop.latitude, stop.longitude),
            order_ready_time=datetime.now() + timedelta(minutes=15),  # Assume 15 min prep time
            delivery_window_start=datetime.now() + timedelta(minutes=window.window_start_mins),
            delivery_window_end=datetime.now() + timedelta(minutes=window.window_end_mins),
            active_buses=active_buses,
        )
        
        if best_bus:
            logger.info(f"Order {order.id} matched to bus {best_bus['bus_id']} with confidence {best_bus['confidence']}")
            order.bus_id = str(best_bus.get("bus_id"))
            db.commit()
            db.refresh(order)
    except Exception as e:
        logger.error(f"Failed to assign bus to order {order.id}: {e}")
        # Continue without bus assignment - can be done later

    # Build response
    return OrderOut(
        id=order.id,
        student_id=order.student_id,
        restaurant_id=order.restaurant_id,
        restaurant_name=restaurant.name,
        stop=StopOut.model_validate(stop),
        window=WindowOut.model_validate(window),
        total_price_cents=order.total_price_cents,
        delivery_fee_cents=order.delivery_fee_cents,
        status=order.status,
        bus_id=order.bus_id,
        qr_code=order.qr_code,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                menu_item_id=oi.menu_item_id,
                menu_item_name=oi.menu_item.name,
                quantity=oi.quantity,
                price_cents=oi.price_cents,
            )
            for oi in order.items
        ],
    )


@app.get("/orders/my", response_model=list[OrderOut])
def get_my_orders(
    current_user: CurrentUser = Depends(require_student),
    db: Session = Depends(get_db)
):
    orders = (
        db.query(OrderORM)
        .filter(OrderORM.student_id == current_user.id)
        .order_by(desc(OrderORM.created_at))
        .all()
    )
    return [
        OrderOut(
            id=order.id,
            student_id=order.student_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=order.restaurant.name,
            stop=StopOut.model_validate(order.stop),
            window=WindowOut.model_validate(order.window),
            total_price_cents=order.total_price_cents,
            delivery_fee_cents=order.delivery_fee_cents,
            status=order.status,
            bus_id=order.bus_id,
            qr_code=order.qr_code,
            created_at=order.created_at,
            items=[
                OrderItemOut(
                    menu_item_id=oi.menu_item_id,
                    menu_item_name=oi.menu_item.name,
                    quantity=oi.quantity,
                    price_cents=oi.price_cents,
                )
                for oi in order.items
            ],
        )
        for order in orders
    ]


@app.get("/restaurants/{restaurant_id}/orders", response_model=list[OrderOut])
def restaurant_orders(
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
        raise HTTPException(403, "Access denied: Not your restaurant")
    orders = db.query(OrderORM).filter(OrderORM.restaurant_id == restaurant_id).all()
    result = []
    for order in orders:
        result.append(
            OrderOut(
                id=order.id,
                student_id=order.student_id,
                restaurant_id=order.restaurant_id,
                restaurant_name=order.restaurant.name,
                stop=StopOut.model_validate(order.stop),
                window=WindowOut.model_validate(order.window),
                total_price_cents=order.total_price_cents,
                delivery_fee_cents=order.delivery_fee_cents,
                status=order.status,
                bus_id=order.bus_id,
                qr_code=order.qr_code,
                created_at=order.created_at,
                items=[
                    OrderItemOut(
                        menu_item_id=oi.menu_item_id,
                        menu_item_name=oi.menu_item.name,
                        quantity=oi.quantity,
                        price_cents=oi.price_cents,
                    )
                    for oi in order.items
                ],
            )
        )
    return result


@app.patch("/orders/{order_id}/status", response_model=OrderOut)
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
        raise HTTPException(403, "Access denied: Not your order")
    
    order.status = payload.status
    db.commit()
    db.refresh(order)

    return OrderOut(
        id=order.id,
        student_id=order.student_id,
        restaurant_id=order.restaurant_id,
        restaurant_name=order.restaurant.name,
        stop=StopOut.model_validate(order.stop),
        window=WindowOut.model_validate(order.window),
        total_price_cents=order.total_price_cents,
        delivery_fee_cents=order.delivery_fee_cents,
        status=order.status,
        bus_id=order.bus_id,
        qr_code=order.qr_code,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                menu_item_id=oi.menu_item_id,
                menu_item_name=oi.menu_item.name,
                quantity=oi.quantity,
                price_cents=oi.price_cents,
            )
            for oi in order.items
        ],
    )


@app.post("/steward/scan", response_model=OrderOut)
def steward_scan(
    payload: QRScanIn,
    current_user: CurrentUser = Depends(require_steward),
    db: Session = Depends(get_db)
):
    order = db.query(OrderORM).filter(OrderORM.qr_code == payload.qr_code).first()
    if not order:
        raise HTTPException(404, "Invalid code")
    
    if order.status not in [OrderStatus.ON_BUS.value, OrderStatus.AT_STOP.value]:
        raise HTTPException(400, f"Order not ready for pickup. Current status: {order.status}")

    order.status = OrderStatus.COMPLETED.value
    db.commit()
    db.refresh(order)

    return OrderOut(
        id=order.id,
        student_id=order.student_id,
        restaurant_id=order.restaurant_id,
        restaurant_name=order.restaurant.name,
        stop=StopOut.model_validate(order.stop),
        window=WindowOut.model_validate(order.window),
        total_price_cents=order.total_price_cents,
        delivery_fee_cents=order.delivery_fee_cents,
        status=order.status,
        bus_id=order.bus_id,
        qr_code=order.qr_code,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                menu_item_id=oi.menu_item_id,
                menu_item_name=oi.menu_item.name,
                quantity=oi.quantity,
                price_cents=oi.price_cents,
            )
            for oi in order.items
        ],
    )


@app.get("/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    
    # Students can only see their own orders, restaurants can see their orders
    if current_user.role == "STUDENT" and order.student_id != current_user.id:
        raise HTTPException(403, "Access denied: Not your order")
    elif current_user.role == "RESTAURANT_OWNER":
        restaurant = db.query(RestaurantORM).filter(
            RestaurantORM.id == order.restaurant_id,
            RestaurantORM.owner_id == current_user.id
        ).first()
        if not restaurant:
            raise HTTPException(403, "Access denied: Not your order")

    return OrderOut(
        id=order.id,
        student_id=order.student_id,
        restaurant_id=order.restaurant_id,
        restaurant_name=order.restaurant.name,
        stop=StopOut.model_validate(order.stop),
        window=WindowOut.model_validate(order.window),
        total_price_cents=order.total_price_cents,
        delivery_fee_cents=order.delivery_fee_cents,
        status=order.status,
        bus_id=order.bus_id,
        qr_code=order.qr_code,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                menu_item_id=oi.menu_item_id,
                menu_item_name=oi.menu_item.name,
                quantity=oi.quantity,
                price_cents=oi.price_cents,
            )
            for oi in order.items
        ],
    )


# ========== Original Endpoints ==========

@app.get("/bus-locations", response_model=list[BusLocation])
async def get_bus_locations() -> list[BusLocation]:
    async with cache_lock:
        return list(bus_location_cache)


@app.get("/match")
async def get_best_line(
    restaurant_lat: float,
    restaurant_lon: float,
    customer_lat: float,
    customer_lon: float,
) -> dict[str, Any]:
    async with cache_lock:
        snapshot = list(bus_location_cache)

    result = find_optimal_bus_line(
        restaurant_coords=(restaurant_lat, restaurant_lon),
        customer_coords=(customer_lat, customer_lon),
        bus_locations=snapshot,
    )

    if result is None:
        raise HTTPException(status_code=503, detail="No bus data available yet")

    return result


@app.post("/closest-stop-to-ddba")
async def closest_stop_to_ddba(stops: list[BusStop]) -> dict[str, Any]:
    result = find_closest_stop_to_downtown_perimeter(stops)
    if result is None:
        raise HTTPException(status_code=400, detail="Provide at least one stop and a valid perimeter")
    return result
