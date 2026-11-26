import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.vehicle import VehicleCategory


class FareConfiguration(Base):
    __tablename__ = "fare_configurations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_category = Column(SQLEnum(VehicleCategory), unique=True, nullable=False)
    base_fare = Column(Float, default=0.0, nullable=False)
    per_km_rate = Column(Float, nullable=False)  # e.g. Bike: ₹7/km, Car: ₹15/km
    per_minute_rate = Column(Float, default=0.0, nullable=False)
    min_fare = Column(Float, default=25.0, nullable=False)
    cancellation_fee = Column(Float, default=20.0, nullable=False)
    cancellation_fee_enabled = Column(Boolean, default=False, nullable=False)
    free_cancellation_window_mins = Column(Integer, default=2, nullable=False)
    waiting_charge_per_minute = Column(Float, default=0.0, nullable=False)
    tolls_and_parking = Column(Float, default=0.0, nullable=False)
    surge_multiplier = Column(Float, default=1.0, nullable=False)
    tax_percent = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FareBreakdown(Base):
    __tablename__ = "fare_breakdowns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = Column(String(36), ForeignKey("ride_bookings.id", ondelete="CASCADE"), unique=True, nullable=False)
    billable_distance_km = Column(Float, nullable=False)
    per_km_rate_used = Column(Float, nullable=False)
    base_fare = Column(Float, default=0.0)
    distance_charge = Column(Float, nullable=False)
    time_charge = Column(Float, default=0.0)
    waiting_charge = Column(Float, default=0.0)
    toll_parking_charge = Column(Float, default=0.0)
    surge_amount = Column(Float, default=0.0)
    taxes = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    total_fare = Column(Float, nullable=False)
    calculated_at = Column(DateTime, default=datetime.utcnow)

    ride = relationship("RideBooking", back_populates="fare_breakdown")
