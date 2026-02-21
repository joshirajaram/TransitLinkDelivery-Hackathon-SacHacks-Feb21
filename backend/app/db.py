from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Time, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./tld.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class UserORM(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)


class RestaurantORM(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    description = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    avg_prep_minutes = Column(Integer, default=15)
    delivery_fee_cents = Column(Integer, default=150)

    owner = relationship("UserORM")
    orders = relationship("OrderORM", back_populates="restaurant")
    menu_items = relationship("MenuItemORM", back_populates="restaurant")


class MenuItemORM(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price_cents = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)

    restaurant = relationship("RestaurantORM", back_populates="menu_items")


class UnitransStopORM(Base):
    __tablename__ = "unitrans_stops"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)


class DeliveryWindowORM(Base):
    __tablename__ = "delivery_windows"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True)


class OrderORM(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    stop_id = Column(Integer, ForeignKey("unitrans_stops.id"), nullable=False)
    window_id = Column(Integer, ForeignKey("delivery_windows.id"), nullable=False)
    total_price_cents = Column(Integer, nullable=False)
    delivery_fee_cents = Column(Integer, nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    qr_code = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student = relationship("UserORM", foreign_keys=[student_id])
    restaurant = relationship("RestaurantORM", back_populates="orders")
    stop = relationship("UnitransStopORM")
    window = relationship("DeliveryWindowORM")
    items = relationship("OrderItemORM", back_populates="order")


class OrderItemORM(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    price_cents = Column(Integer, nullable=False)

    order = relationship("OrderORM", back_populates="items")
    menu_item = relationship("MenuItemORM")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
