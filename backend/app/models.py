from __future__ import annotations

from datetime import datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, Field
from enum import Enum


# Enums
class OrderStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    ON_BUS = "ON_BUS"
    AT_STOP = "AT_STOP"
    COMPLETED = "COMPLETED"
    NOT_ACCEPTED = "NOT_ACCEPTED"
    CANCELLED = "CANCELLED"


class UserRole(str, Enum):
    STUDENT = "STUDENT"
    RESTAURANT_OWNER = "RESTAURANT_OWNER"
    STEWARD = "STEWARD"
    ADMIN = "ADMIN"


# Pydantic models for API
class Restaurant(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    description: Optional[str] = None
    latitude: float
    longitude: float
    avg_prep_minutes: int = 15
    delivery_fee_cents: int = 150


class MenuItem(BaseModel):
    id: int
    restaurant_id: int
    name: str
    description: Optional[str] = None
    price_cents: int
    is_active: bool = True


class BusLocation(BaseModel):
    vehicle_id: str = Field(..., description="Unitrans vehicle identifier")
    route_tag: str = Field(..., description="Route/line tag from Umo IQ feed")
    latitude: float
    longitude: float
    heading: Optional[float] = None
    speed_kmh: Optional[float] = None
    last_reported_epoch_ms: Optional[int] = None


class BusStop(BaseModel):
    stop_id: str
    title: str
    latitude: float
    longitude: float
    route_tag: Optional[str] = None


class UnitransStop(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float


class DeliveryWindow(BaseModel):
    id: int
    label: str
    start_time: time
    end_time: time
    is_active: bool = True


class Order(BaseModel):
    id: int
    student_id: int
    restaurant_id: int
    stop_id: int
    window_id: int
    total_price_cents: int
    delivery_fee_cents: int
    status: OrderStatus = OrderStatus.PENDING
    qr_code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OrderItem(BaseModel):
    id: int
    order_id: int
    menu_item_id: int
    quantity: int
    price_cents: int


class User(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
