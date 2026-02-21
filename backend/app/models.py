from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Restaurant(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float


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


class Order(BaseModel):
    id: int
    restaurant_id: int
    customer_latitude: float
    customer_longitude: float
    status: Literal["pending", "in_transit", "delivered"] = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
