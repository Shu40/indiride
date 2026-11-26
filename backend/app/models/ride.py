import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.vehicle import VehicleCategory


class RideStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    SEARCHING_FOR_RIDER = "SEARCHING_FOR_RIDER"
    REQUESTS_SENT = "REQUESTS_SENT"
    EXPANDING_SEARCH = "EXPANDING_SEARCH"
    RIDER_ASSIGNED = "RIDER_ASSIGNED"
    RIDER_ARRIVING = "RIDER_ARRIVING"
    RIDER_ARRIVED = "RIDER_ARRIVED"
    OTP_VERIFICATION = "OTP_VERIFICATION"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_RIDER_AVAILABLE = "NO_RIDER_AVAILABLE"


class RideRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class RideBooking(Base):
    __tablename__ = "ride_bookings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    passenger_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    rider_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=True)
    vehicle_category = Column(SQLEnum(VehicleCategory), nullable=False)

    # Geographic locations
    pickup_address = Column(String(255), nullable=False)
    pickup_latitude = Column(Float, nullable=False, index=True)
    pickup_longitude = Column(Float, nullable=False, index=True)

    destination_address = Column(String(255), nullable=False)
    destination_latitude = Column(Float, nullable=False, index=True)
    destination_longitude = Column(Float, nullable=False, index=True)

    route_polyline = Column(Text, nullable=True)

    # Route estimates
    estimated_distance_km = Column(Float, nullable=False)
    estimated_duration_mins = Column(Integer, nullable=False)
    estimated_fare = Column(Float, nullable=False)

    # Actual finalized trip data
    actual_distance_km = Column(Float, nullable=True)
    final_fare = Column(Float, nullable=True)

    # Security: Hashed 4-digit pickup OTP & Idempotency
    idempotency_key = Column(String(128), nullable=True, index=True)
    otp_hash = Column(String(128), nullable=False)
    otp_encrypted = Column(String(255), nullable=True)
    otp_attempts = Column(Integer, default=0)
    otp_max_attempts = Column(Integer, default=3)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_verified_at = Column(DateTime, nullable=True)
    otp_locked = Column(Integer, default=0)

    # State & Matching tracking
    status = Column(SQLEnum(RideStatus), default=RideStatus.SEARCHING_FOR_RIDER, nullable=False, index=True)
    current_search_radius_km = Column(Float, default=2.0)
    matching_stage = Column(Integer, default=1)

    # Lifecycle Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    scheduled_for = Column(DateTime, nullable=True, index=True)
    matching_started_at = Column(DateTime, default=datetime.utcnow)
    rider_assigned_at = Column(DateTime, nullable=True)
    rider_arrived_at = Column(DateTime, nullable=True)
    trip_started_at = Column(DateTime, nullable=True)
    trip_completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(String(255), nullable=True)
    cancellation_fee = Column(Float, default=0.0)
    cancelled_by = Column(String(50), nullable=True)

    # Relationships
    passenger = relationship("User", foreign_keys=[passenger_id], back_populates="rides_as_passenger")
    rider = relationship("User", foreign_keys=[rider_id], back_populates="rides_as_rider")
    vehicle = relationship("Vehicle", back_populates="rides")
    requests = relationship("RideRequest", back_populates="ride", cascade="all, delete-orphan")
    status_history = relationship("RideStatusHistory", back_populates="ride", cascade="all, delete-orphan")
    location_points = relationship("TripLocationPoint", back_populates="ride", cascade="all, delete-orphan")
    fare_breakdown = relationship("FareBreakdown", back_populates="ride", uselist=False, cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="ride", uselist=False, cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="ride", cascade="all, delete-orphan")


class RideRequest(Base):
    __tablename__ = "ride_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = Column(String(36), ForeignKey("ride_bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    rider_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(SQLEnum(RideRequestStatus), default=RideRequestStatus.PENDING, nullable=False)
    search_radius_km = Column(Float, default=2.0)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    responded_at = Column(DateTime, nullable=True)

    ride = relationship("RideBooking", back_populates="requests")


class RideStatusHistory(Base):
    __tablename__ = "ride_status_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = Column(String(36), ForeignKey("ride_bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(RideStatus), nullable=False)
    notes = Column(String(255), nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ride = relationship("RideBooking", back_populates="status_history")


class TripLocationPoint(Base):
    __tablename__ = "trip_location_points"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = Column(String(36), ForeignKey("ride_bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ride = relationship("RideBooking", back_populates="location_points")
