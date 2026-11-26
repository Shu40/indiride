import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class CommunityRide(Base):
    __tablename__ = "community_rides"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    creator_name = Column(String(100), nullable=False)
    creator_phone = Column(String(20), nullable=False)
    pickup_address = Column(String(255), nullable=False)
    destination_address = Column(String(255), nullable=False)

    # Geographic coordinates for route matching & detour calculation
    pickup_latitude = Column(Float, nullable=True, index=True)
    pickup_longitude = Column(Float, nullable=True, index=True)
    destination_latitude = Column(Float, nullable=True, index=True)
    destination_longitude = Column(Float, nullable=True, index=True)

    # Departure timing
    departure_time = Column(String(100), nullable=False)  # e.g. "Today, 6:30 PM"
    departure_datetime = Column(DateTime, nullable=True, index=True)

    # Pricing & Capacity
    price_per_seat = Column(Float, nullable=False)        # e.g. 150.0
    total_seats = Column(Integer, default=3)
    available_seats = Column(Integer, default=3)

    # Vehicle and Flexibilities
    vehicle_info = Column(String(100), default="Car / Bike") # e.g. "Honda City (White)"
    vehicle_type = Column(String(50), default="Car")         # Car, Bike, Auto, SUV
    pickup_flexibility_km = Column(Float, default=2.5)       # Allowed detour at pickup
    dropoff_flexibility_km = Column(Float, default=3.0)      # Allowed detour at dropoff
    instant_booking = Column(Integer, default=1)             # 1 = Instant, 0 = Requires approval
    luggage_policy = Column(String(100), default="Standard") # Small bag, Medium, None
    platform_fee_percent = Column(Float, default=15.0)       # 15% platform commission

    # University, Area Category & Gender
    university_id = Column(String(36), ForeignKey("universities.id", ondelete="SET NULL"), nullable=True, index=True)
    campus_id = Column(String(36), ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True, index=True)
    university_name = Column(String(150), nullable=True, index=True)
    university_short_name = Column(String(50), nullable=True, index=True)
    category_type = Column(String(30), default="UNIVERSITY", index=True) # UNIVERSITY, CITY, LOCAL
    poster_gender = Column(String(20), default="MALE")                  # MALE, FEMALE, ANY

    # Extended campus routing and recurrence
    intermediate_stops = Column(Text, nullable=True)     # JSON array or string of intermediate stop landmarks
    recurring_days = Column(String(100), nullable=True)  # e.g. "MON,TUE,WED,THU,FRI"
    return_trip_time = Column(String(50), nullable=True) # e.g. "5:30 PM"
    notes = Column(Text, nullable=True)                   # e.g. "AC on, trunk space available"
    status = Column(String(30), default="OPEN", index=True) # OPEN, FULL, IN_PROGRESS, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Concurrency constraint to ensure seats cannot go negative
    __table_args__ = (
        CheckConstraint('available_seats >= 0', name='check_available_seats_non_negative'),
    )

    bookings = relationship("CommunityRideBooking", back_populates="ride", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[creator_id])


class CommunityRideBooking(Base):
    __tablename__ = "community_ride_bookings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = Column(String(36), ForeignKey("community_rides.id", ondelete="CASCADE"), nullable=False, index=True)
    passenger_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    passenger_name = Column(String(100), nullable=False)
    passenger_phone = Column(String(20), nullable=False)
    seats_booked = Column(Integer, default=1)
    travel_date = Column(String(50), nullable=True, index=True) # e.g. "2026-10-20" or "Today"

    # Pricing breakdown
    price_per_seat = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    platform_fee = Column(Float, default=0.0)
    net_host_earnings = Column(Float, default=0.0)

    # Pickup coordination
    pickup_notes = Column(String(255), nullable=True)
    passenger_pickup_lat = Column(Float, nullable=True)
    passenger_pickup_lng = Column(Float, nullable=True)

    status = Column(String(30), default="CONFIRMED", index=True) # PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    ride = relationship("CommunityRide", back_populates="bookings")
    passenger = relationship("User", foreign_keys=[passenger_id])


class CampusHostProfile(Base):
    __tablename__ = "campus_host_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    license_number = Column(String(50), nullable=False)
    vehicle_plate = Column(String(30), nullable=False)
    vehicle_type = Column(String(50), default="GENERAL_BIKE") # GENERAL_BIKE, PRO_BIKE, CAR, AUTO
    vehicle_model = Column(String(100), nullable=True) # e.g. "Royal Enfield Classic 350", "Hero Splendor"
    status = Column(String(30), default="PENDING", index=True) # PENDING, VERIFIED, BLOCKED
    verification_notes = Column(String(255), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
