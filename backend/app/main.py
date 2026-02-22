from __future__ import annotations

import asyncio
import base64
import io
import logging
import secrets
import time
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, time as dt_time
from typing import Any

import httpx
import qrcode
import xmltodict
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session

from .auth import (
    Token,
    UserLogin,
    UserRegister,
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
    # Only seed once based on whether we already have the full restaurant set
    if db.query(RestaurantORM).count() >= 10:
        return

    # ── Users ──────────────────────────────────────────────────────────
    def get_or_create_user(email, name, role):
        u = db.query(UserORM).filter(UserORM.email == email).first()
        if not u:
            u = UserORM(email=email, name=name, role=role)
            db.add(u)
            db.flush()
        return u

    student  = get_or_create_user("student@ucdavis.edu",   "Test Student",   UserRole.STUDENT.value)
    steward  = get_or_create_user("steward@ucdavis.edu",   "ASUCD Steward",  UserRole.STEWARD.value)
    admin    = get_or_create_user("admin@ddba.org",         "DDBA Admin",     UserRole.ADMIN.value)
    owner1   = get_or_create_user("owner@woodstocks.com",  "Woodstock Owner",UserRole.RESTAURANT_OWNER.value)
    owner2   = get_or_create_user("owner@burgersbrew.com", "B&B Owner",      UserRole.RESTAURANT_OWNER.value)
    owner3   = get_or_create_user("owner@sophias.com",     "Sophia Owner",   UserRole.RESTAURANT_OWNER.value)
    owner4   = get_or_create_user("owner@crepeville.com",  "Crepe Owner",    UserRole.RESTAURANT_OWNER.value)
    owner5   = get_or_create_user("owner@doscoyotes.com",  "DC Owner",       UserRole.RESTAURANT_OWNER.value)
    owner6   = get_or_create_user("owner@alibaba.com",     "Ali Baba Owner", UserRole.RESTAURANT_OWNER.value)
    owner7   = get_or_create_user("owner@villagebakery.com","VB Owner",      UserRole.RESTAURANT_OWNER.value)
    owner8   = get_or_create_user("owner@ketmoree.com",    "KMR Owner",      UserRole.RESTAURANT_OWNER.value)
    owner9   = get_or_create_user("owner@lemongrass.com",  "LG Owner",       UserRole.RESTAURANT_OWNER.value)
    owner10  = get_or_create_user("owner@seasons.com",     "Seasons Owner",  UserRole.RESTAURANT_OWNER.value)

    # ── Helper to add a restaurant if it doesn't already exist ─────────
    def add_restaurant(name, description, cuisine_type, lat, lon, owner, fee, prep, items):
        existing = db.query(RestaurantORM).filter(RestaurantORM.name == name).first()
        if existing:
            return existing
        r = RestaurantORM(
            name=name, description=description, cuisine_type=cuisine_type,
            latitude=lat, longitude=lon,
            owner_id=owner.id, avg_prep_minutes=prep, delivery_fee_cents=fee,
        )
        db.add(r)
        db.flush()
        for item in items:
            db.add(MenuItemORM(
                restaurant_id=r.id,
                name=item["name"], description=item.get("desc"),
                price_cents=item["price"], tags=item.get("tags", ""),
            ))
        return r

    # ── 1. Woodstock's Pizza ───────────────────────────────────────────
    add_restaurant(
        "Woodstock's Pizza", "Davis' legendary late-night pizza since 1979", "Pizza",
        38.5450, -121.7406, owner1, 199, 20,
        [
            {"name": "Veggie Garden Pizza (slice)", "desc": "Fresh seasonal veggies", "price": 499, "tags": "vegetarian,staff-pick"},
            {"name": "Pepperoni Pizza (slice)",     "desc": "Classic pepperoni",        "price": 549, "tags": "non-veg"},
            {"name": "Cheese Pizza (slice)",        "desc": "Extra mozzarella",          "price": 449, "tags": "vegetarian"},
            {"name": "The Works (whole 12\")",      "desc": "Everything on it",          "price": 2299,"tags": "non-veg,staff-pick"},
            {"name": "Garlic Cheese Bread",         "desc": "House-made garlic butter",  "price": 699, "tags": "vegetarian"},
            {"name": "Caesar Salad",                "desc": "Crispy romaine & croutons", "price": 799, "tags": "vegetarian"},
            {"name": "Craft Root Beer",             "desc": "Old-fashioned root beer",   "price": 349, "tags": "beverages,vegan"},
        ]
    )

    # ── 2. Burgers & Brew ─────────────────────────────────────────────
    add_restaurant(
        "Burgers & Brew", "Award-winning burgers & local craft beers", "American",
        38.5441, -121.7394, owner2, 199, 15,
        [
            {"name": "Classic Smash Burger",   "desc": "Double smash, American cheese",        "price": 1299, "tags": "non-veg,ucd-favorite"},
            {"name": "BBQ Bacon Burger",        "desc": "Smoked bacon, cheddar, BBQ sauce",     "price": 1499, "tags": "non-veg"},
            {"name": "Veggie Burger",           "desc": "House black-bean patty",               "price": 1299, "tags": "vegetarian"},
            {"name": "Crispy Fries",            "desc": "Seasoned, skin-on",                    "price": 499,  "tags": "vegetarian,vegan"},
            {"name": "Onion Rings",             "desc": "Beer-battered",                        "price": 599,  "tags": "vegetarian"},
            {"name": "Craft IPA (pint)",        "desc": "Local Sacramento brewery",             "price": 699,  "tags": "beverages"},
            {"name": "Lemonade",                "desc": "House-squeezed",                       "price": 349,  "tags": "beverages,vegan"},
        ]
    )

    # ── 3. Sophia's Thai Kitchen ──────────────────────────────────────
    add_restaurant(
        "Sophia's Thai Kitchen", "Authentic Thai — a Davis institution since 1993", "Thai",
        38.5443, -121.7401, owner3, 199, 18,
        [
            {"name": "Pad Thai",           "desc": "Rice noodles, tamarind, peanuts",             "price": 1499, "tags": "non-veg,ucd-favorite"},
            {"name": "Pad Thai (Tofu)",    "desc": "Vegan-friendly version",                       "price": 1399, "tags": "vegan"},
            {"name": "Green Curry",        "desc": "Coconut milk, Thai basil, spicy",              "price": 1599, "tags": "spicy,non-veg"},
            {"name": "Tofu Green Curry",   "desc": "Coconut milk, Thai basil",                     "price": 1499, "tags": "spicy,vegetarian,vegan"},
            {"name": "Tom Yum Soup",       "desc": "Lemongrass, galangal, lime",                   "price": 1199, "tags": "spicy,non-veg"},
            {"name": "Spring Rolls (4pc)", "desc": "Fried, served with sweet chili",               "price": 799,  "tags": "vegetarian"},
            {"name": "Thai Iced Tea",      "desc": "Strong brew with condensed milk",              "price": 399,  "tags": "beverages"},
            {"name": "Jasmine Iced Tea",   "desc": "Light & floral",                               "price": 349,  "tags": "beverages,vegan"},
        ]
    )

    # ── 4. Crepeville ─────────────────────────────────────────────────
    add_restaurant(
        "Crepeville", "Beloved Davis breakfast & brunch crepe café", "Breakfast",
        38.5443, -121.7402, owner4, 149, 12,
        [
            {"name": "Eggs & Veggie Crepe",      "desc": "Free-range eggs, seasonal veggies",     "price": 1099, "tags": "breakfast,vegetarian"},
            {"name": "Smoked Salmon Crepe",      "desc": "Cream cheese, capers, dill",            "price": 1299, "tags": "breakfast,non-veg"},
            {"name": "Nutella Banana Crepe",     "desc": "Nutella, fresh banana, powdered sugar", "price": 999,  "tags": "breakfast,vegetarian"},
            {"name": "Avocado Toast Crepe",      "desc": "Sourdough crepe, avocado, chili flakes","price": 1149, "tags": "breakfast,vegan"},
            {"name": "Granola Power Bowl",       "desc": "House granola, yogurt, honey, berries", "price": 899,  "tags": "breakfast,vegetarian,staff-pick"},
            {"name": "French Press Coffee",      "desc": "Single-origin beans",                   "price": 499,  "tags": "beverages"},
            {"name": "Fresh-Squeezed OJ",        "desc": "Pure California oranges",               "price": 449,  "tags": "beverages,vegan"},
            {"name": "Chai Latte",               "desc": "Spiced masala chai, oat milk",          "price": 529,  "tags": "beverages,vegan"},
        ]
    )

    # ── 5. Dos Coyotes Border Café ────────────────────────────────────
    add_restaurant(
        "Dos Coyotes Border Café", "Fresh Baja-inspired Mexican since 1991", "Mexican",
        38.5452, -121.7407, owner5, 199, 12,
        [
            {"name": "Baja Burrito",        "desc": "Grilled chicken, black beans, pico",          "price": 1299, "tags": "non-veg,ucd-favorite"},
            {"name": "Vegan Buddha Bowl",   "desc": "Roasted veggies, quinoa, avocado dressing",   "price": 1199, "tags": "vegan,staff-pick"},
            {"name": "Fish Taco",           "desc": "Beer-battered cod, cabbage slaw, chipotle",   "price": 499,  "tags": "non-veg"},
            {"name": "Veggie Quesadilla",   "desc": "Roasted peppers, onion, jack cheese",         "price": 999,  "tags": "vegetarian"},
            {"name": "Chips & Salsa",       "desc": "House-made pico de gallo",                    "price": 499,  "tags": "vegan"},
            {"name": "Horchata",            "desc": "House-made rice milk drink",                  "price": 349,  "tags": "beverages,vegan"},
            {"name": "House Nachos",        "desc": "Queso, jalapeño, sour cream",                 "price": 1099, "tags": "vegetarian,spicy"},
        ]
    )

    # ── 6. Ali Baba Restaurant ────────────────────────────────────────
    add_restaurant(
        "Ali Baba Restaurant", "Family-run Mediterranean & Middle Eastern kitchen", "Mediterranean",
        38.5441, -121.7398, owner6, 149, 15,
        [
            {"name": "Falafel Plate",        "desc": "Crispy falafel, tabbouleh, pita",            "price": 1299, "tags": "vegan,staff-pick"},
            {"name": "Chicken Shawarma Wrap","desc": "Marinated chicken, garlic sauce, pickles",   "price": 1399, "tags": "non-veg"},
            {"name": "Veggie Shawarma Wrap", "desc": "Roasted veg, tahini, fresh herbs",           "price": 1199, "tags": "vegan"},
            {"name": "Hummus & Pita",        "desc": "House hummus, warm pita",                    "price": 799,  "tags": "vegan"},
            {"name": "Med Salad",            "desc": "Cucumber, tomato, olives, feta",             "price": 999,  "tags": "vegetarian,gluten-free"},
            {"name": "Lamb Kebab Plate",     "desc": "Grilled lamb, rice, grilled veg",            "price": 1599, "tags": "non-veg,spicy,gluten-free"},
            {"name": "Mint Lemonade",        "desc": "Fresh mint, lemon, sugar",                   "price": 399,  "tags": "beverages,vegan"},
        ]
    )

    # ── 7. Village Bakery ─────────────────────────────────────────────
    add_restaurant(
        "Village Bakery", "Artisan sourdough & pastries baked fresh daily", "Bakery",
        38.5437, -121.7449, owner7, 99, 8,
        [
            {"name": "Almond Croissant",   "desc": "Buttery, double-baked with almond cream",     "price": 499,  "tags": "breakfast,vegetarian,staff-pick"},
            {"name": "Blueberry Scone",    "desc": "Organic blueberries, honey glaze",            "price": 399,  "tags": "breakfast,vegetarian"},
            {"name": "Sourdough Sandwich", "desc": "House sourdough, turkey, avocado, sprouts",   "price": 999,  "tags": "breakfast,non-veg"},
            {"name": "Avocado Sourdough",  "desc": "Smashed avo, chili, lemon, seeds",            "price": 899,  "tags": "breakfast,vegan"},
            {"name": "Granola Parfait",    "desc": "House granola, local honey, seasonal fruit",  "price": 799,  "tags": "breakfast,vegetarian"},
            {"name": "Drip Coffee",        "desc": "Single-origin, Ritual Roasters",              "price": 349,  "tags": "beverages,vegan"},
            {"name": "Oat Latte",          "desc": "Double shot, steamed oat milk",               "price": 549,  "tags": "beverages,vegan"},
            {"name": "Matcha Latte",       "desc": "Ceremonial grade matcha, oat milk",           "price": 599,  "tags": "beverages,vegan"},
        ]
    )

    # ── 8. KetMoRee Thai Bistro ───────────────────────────────────────
    add_restaurant(
        "KetMoRee Thai Bistro", "Modern Thai with bold flavors — a UCD crowd favorite", "Thai",
        38.5448, -121.7409, owner8, 199, 18,
        [
            {"name": "Drunken Noodles",    "desc": "Wide rice noodles, basil, chili",             "price": 1599, "tags": "spicy,non-veg,ucd-favorite"},
            {"name": "Vegan Drunken Noodles","desc": "Tofu, wide noodles, Thai basil",            "price": 1499, "tags": "spicy,vegan"},
            {"name": "Massaman Curry",     "desc": "Slow-cooked beef, potato, peanut",            "price": 1699, "tags": "non-veg"},
            {"name": "Mango Sticky Rice",  "desc": "Sweet glutinous rice, fresh mango",           "price": 799,  "tags": "vegan,staff-pick"},
            {"name": "Thai Papaya Salad",  "desc": "Green papaya, lime, fish sauce, chili",       "price": 999,  "tags": "spicy,non-veg,gluten-free"},
            {"name": "Crispy Tofu Salad",  "desc": "Fried tofu, cucumber, peanut dressing",       "price": 999,  "tags": "vegan,gluten-free"},
            {"name": "Thai Iced Coffee",   "desc": "Strong brew, sweetened condensed milk",       "price": 449,  "tags": "beverages"},
            {"name": "Lychee Soda",        "desc": "Sparkling lychee, fresh lime",                "price": 349,  "tags": "beverages,vegan"},
        ]
    )

    # ── 9. Lemon Grass Restaurant ─────────────────────────────────────
    add_restaurant(
        "Lemon Grass Restaurant", "Vietnamese & Southeast Asian comfort food", "Vietnamese",
        38.5443, -121.7404, owner9, 149, 15,
        [
            {"name": "Pho Noodle Soup",       "desc": "Slow-simmered beef bone broth, rice noodles","price": 1399,"tags": "non-veg,ucd-favorite,gluten-free"},
            {"name": "Veggie Pho",            "desc": "Mushroom broth, tofu, rice noodles",       "price": 1299,"tags": "vegan,gluten-free"},
            {"name": "Lemongrass Chicken",    "desc": "Wok-fried with lemongrass & chili",        "price": 1499,"tags": "non-veg,spicy,gluten-free"},
            {"name": "Tofu Spring Rolls (4pc)","desc": "Fresh herbs, vermicelli, peanut sauce",   "price": 799, "tags": "vegan"},
            {"name": "Bahn Mi Sandwich",      "desc": "Grilled pork, pickled daikon, cilantro",   "price": 999, "tags": "non-veg"},
            {"name": "Mango Avocado Salad",   "desc": "Fresh mango, avocado, sesame dressing",    "price": 1099,"tags": "vegan,gluten-free"},
            {"name": "Mango Iced Tea",        "desc": "House-brewed black tea, mango syrup",      "price": 399, "tags": "beverages"},
            {"name": "Iced Coconut Coffee",   "desc": "Vietnamese drip, coconut milk",            "price": 449, "tags": "beverages"},
        ]
    )

    # ── 10. Seasons Restaurant ────────────────────────────────────────
    add_restaurant(
        "Seasons Restaurant", "Farm-to-fork American — sourcing from Yolo County farms", "American",
        38.5453, -121.7412, owner10, 249, 20,
        [
            {"name": "Yolo Farm Bowl",       "desc": "Seasonal roasted veg, grain, tahini dressing","price": 1499,"tags": "vegan,staff-pick,gluten-free"},
            {"name": "Seasonal Green Salad", "desc": "Local greens, shaved veg, vinaigrette",      "price": 1199,"tags": "vegan,gluten-free"},
            {"name": "Free-Range Roast Chicken","desc": "Half chicken, roasted root veg, jus",     "price": 1899,"tags": "non-veg,gluten-free"},
            {"name": "Grass-Fed Burger",      "desc": "Local beef, aged cheddar, aioli, brioche",  "price": 1699,"tags": "non-veg"},
            {"name": "Mushroom Risotto",      "desc": "Arborio, wild mushrooms, parmesan",         "price": 1599,"tags": "vegetarian"},
            {"name": "Local Apple Juice",     "desc": "Cold-pressed Yolo County apples",           "price": 599, "tags": "beverages,vegan"},
            {"name": "Seasonal Fruit Tart",   "desc": "Buttery pastry, seasonal local fruit",      "price": 799, "tags": "vegetarian"},
        ]
    )

    # ── Unitrans stops (add if not exists) ────────────────────────────
    stop_data = [
        ("MU",    "Memorial Union",               "Main campus hub",           38.5422, -121.7506),
        ("SILO",  "Silo Terminal",                "South campus",               38.5390, -121.7513),
        ("ARC",   "Activities & Recreation Center","West campus",               38.5378, -121.7588),
        ("COHO",  "CoHo / South Silo",            "South campus dining area",  38.5382, -121.7500),
        ("SHIELDS","Shields Library",             "Central library stop",       38.5407, -121.7490),
    ]
    for code, name, desc, lat, lon in stop_data:
        if not db.query(UnitransStopORM).filter(UnitransStopORM.code == code).first():
            db.add(UnitransStopORM(code=code, name=name, description=desc, latitude=lat, longitude=lon))

    # ── Delivery windows ──────────────────────────────────────────────
    # Remove Breakfast window if it was previously seeded
    breakfast = db.query(DeliveryWindowORM).filter(DeliveryWindowORM.label == "Breakfast").first()
    if breakfast:
        db.delete(breakfast)
        db.flush()

    if not db.query(DeliveryWindowORM).filter(DeliveryWindowORM.label == "Lunch").first():
        db.add(DeliveryWindowORM(label="Lunch",  start_time=dt_time(12, 0), end_time=dt_time(14, 0), is_active=True))
    if not db.query(DeliveryWindowORM).filter(DeliveryWindowORM.label == "Dinner").first():
        db.add(DeliveryWindowORM(label="Dinner", start_time=dt_time(18, 0), end_time=dt_time(22, 0), is_active=True))

    db.commit()
    logger.info("Demo data seeded successfully")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        # Always remove Breakfast window (may have been seeded in a prior version)
        breakfast = db.query(DeliveryWindowORM).filter(DeliveryWindowORM.label == "Breakfast").first()
        if breakfast:
            db.delete(breakfast)
            db.commit()
            logger.info("Removed legacy Breakfast delivery window")
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
    cuisine_type: str | None = None
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
    tags: str | None = None

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
    bus_route_tag: str | None = None
    qr_code: str
    created_at: datetime
    items: list[OrderItemOut]

    class Config:
        from_attributes = True


class UpdateStatusIn(BaseModel):
    status: str
    bus_route_tag: str | None = None


class QRScanIn(BaseModel):
    qr_code: str


class StewardOrdersOut(BaseModel):
    active_orders: list[OrderOut]
    completed_orders: list[OrderOut]


class OrderQRCodeOut(BaseModel):
    qr_code: str
    qr_data_url: str


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
            bus_route_tag=order.bus_route_tag,
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


@app.post("/auth/register", response_model=Token)
def register(registration: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if email already exists
    existing_user = db.query(UserORM).filter(UserORM.email == registration.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    valid_roles = ["STUDENT", "RESTAURANT_OWNER", "STEWARD", "ADMIN"]
    if registration.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Create new user
    new_user = UserORM(
        email=registration.email,
        name=registration.name,
        role=registration.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create JWT token
    access_token = create_access_token(
        data={
            "sub": new_user.email,
            "user_id": new_user.id,
            "role": new_user.role
        },
        expires_delta=timedelta(hours=8)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "name": new_user.name,
            "role": new_user.role
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
                cuisine_type=r.cuisine_type,
                latitude=r.latitude,
                longitude=r.longitude,
                delivery_fee_cents=r.delivery_fee_cents,
                menu_items=[
                    MenuItemOut(
                        id=mi.id,
                        name=mi.name,
                        description=mi.description,
                        price_cents=mi.price_cents,
                        tags=mi.tags,
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
        cuisine_type=restaurant.cuisine_type,
        latitude=restaurant.latitude,
        longitude=restaurant.longitude,
        delivery_fee_cents=restaurant.delivery_fee_cents,
        menu_items=[
            MenuItemOut(
                id=mi.id,
                name=mi.name,
                description=mi.description,
                price_cents=mi.price_cents,
                tags=mi.tags,
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
        status=OrderStatus.PENDING.value,
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
        bus_route_tag=order.bus_route_tag,
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
            bus_route_tag=order.bus_route_tag,
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
                bus_route_tag=order.bus_route_tag,
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
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    next_status = payload.status

    if current_user.role == UserRole.RESTAURANT_OWNER:
        restaurant = db.query(RestaurantORM).filter(
            RestaurantORM.id == order.restaurant_id,
            RestaurantORM.owner_id == current_user.id
        ).first()
        if not restaurant:
            raise HTTPException(403, "Access denied: Not your order")

        allowed_transitions: dict[str, set[str]] = {
            OrderStatus.PENDING.value: {OrderStatus.PREPARING.value, OrderStatus.NOT_ACCEPTED.value},
            OrderStatus.ACCEPTED.value: {OrderStatus.PREPARING.value},
            OrderStatus.PREPARING.value: {OrderStatus.READY_FOR_PICKUP.value},
        }
        if next_status not in allowed_transitions.get(order.status, set()):
            raise HTTPException(400, f"Invalid status transition from {order.status} to {next_status}")
        order.status = next_status
    elif current_user.role == UserRole.STEWARD:
        allowed_transitions: dict[str, set[str]] = {
            OrderStatus.READY_FOR_PICKUP.value: {OrderStatus.ON_BUS.value},
            OrderStatus.ON_BUS.value: {OrderStatus.AT_STOP.value},
            OrderStatus.AT_STOP.value: {OrderStatus.COMPLETED.value},
        }
        if next_status not in allowed_transitions.get(order.status, set()):
            raise HTTPException(400, f"Invalid status transition from {order.status} to {next_status}")
        if next_status == OrderStatus.ON_BUS.value:
            route_tag = (payload.bus_route_tag or "").strip()
            if not route_tag:
                raise HTTPException(400, "bus_route_tag is required when marking ON_BUS")
            if order.bus_route_tag and order.bus_route_tag.lower() != route_tag.lower():
                raise HTTPException(400, "Order already claimed by another route")
            order.bus_route_tag = route_tag.lower()
        order.status = next_status
    else:
        raise HTTPException(403, "Access denied")
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
        bus_route_tag=order.bus_route_tag,
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
        bus_route_tag=order.bus_route_tag,
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


@app.get("/steward/orders", response_model=StewardOrdersOut)
async def get_steward_orders(
    route: str | None = None,
    current_user: CurrentUser = Depends(require_steward),
    db: Session = Depends(get_db)
):
    if not route or not route.strip():
        raise HTTPException(400, "route tag is required")
    route_value = route.strip().lower()
    active_statuses = [
        OrderStatus.READY_FOR_PICKUP.value,
        OrderStatus.ON_BUS.value,
        OrderStatus.AT_STOP.value,
    ]
    active_query = db.query(OrderORM).filter(OrderORM.status.in_(active_statuses))
    completed_query = db.query(OrderORM).filter(OrderORM.status == OrderStatus.COMPLETED.value)

    active_query = active_query.filter(
        or_(
            and_(
                OrderORM.status == OrderStatus.READY_FOR_PICKUP.value,
                OrderORM.bus_route_tag.is_(None),
            ),
            OrderORM.bus_route_tag == route_value,
        )
    )
    completed_query = completed_query.filter(OrderORM.bus_route_tag == route_value)

    active_orders = active_query.order_by(OrderORM.created_at.desc()).all()
    completed_orders = completed_query.order_by(OrderORM.created_at.desc()).all()

    def build(order: OrderORM) -> OrderOut:
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
            bus_route_tag=order.bus_route_tag,
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

    return StewardOrdersOut(
        active_orders=[build(order) for order in active_orders],
        completed_orders=[build(order) for order in completed_orders],
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
        bus_route_tag=order.bus_route_tag,
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


@app.get("/orders/{order_id}/qr-code", response_model=OrderQRCodeOut)
def get_order_qr_code(
    order_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    if current_user.role == "STUDENT" and order.student_id != current_user.id:
        raise HTTPException(403, "Access denied: Not your order")
    elif current_user.role == "RESTAURANT_OWNER":
        restaurant = db.query(RestaurantORM).filter(
            RestaurantORM.id == order.restaurant_id,
            RestaurantORM.owner_id == current_user.id
        ).first()
        if not restaurant:
            raise HTTPException(403, "Access denied: Not your order")

    qr_img = qrcode.make(order.qr_code)
    buffer = io.BytesIO()
    qr_img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    data_url = f"data:image/png;base64,{encoded}"

    return OrderQRCodeOut(qr_code=order.qr_code, qr_data_url=data_url)


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
