import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class University(Base):
    __tablename__ = "universities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(150), nullable=False, unique=True, index=True)
    short_name = Column(String(50), nullable=True, index=True)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    country = Column(String(50), default="India")
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, INACTIVE
    logo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    campuses = relationship("Campus", back_populates="university", cascade="all, delete-orphan")


class Campus(Base):
    __tablename__ = "campuses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    university_id = Column(String(36), ForeignKey("universities.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    address = Column(String(300), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, INACTIVE
    common_locations = Column(Text, nullable=True) # JSON list of common pickup/drop points
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    university = relationship("University", back_populates="campuses")

    def get_common_locations(self):
        if not self.common_locations:
            return []
        try:
            return json.loads(self.common_locations)
        except Exception:
            return [loc.strip() for loc in self.common_locations.split(",") if loc.strip()]


class CampusRideAlert(Base):
    __tablename__ = "campus_ride_alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    university_id = Column(String(36), ForeignKey("universities.id", ondelete="CASCADE"), nullable=True, index=True)
    campus_id = Column(String(36), ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True, index=True)
    pickup_text = Column(String(255), nullable=False)
    destination_text = Column(String(255), nullable=False)
    travel_date = Column(String(50), nullable=False) # e.g. "2026-10-21" or "Today"
    preferred_time_window = Column(String(30), default="ANY") # ANY, MORNING, AFTERNOON, EVENING, NIGHT
    seats_needed = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    university = relationship("University", foreign_keys=[university_id])
    campus = relationship("Campus", foreign_keys=[campus_id])


class RecurringRideSchedule(Base):
    __tablename__ = "recurring_ride_schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    university_id = Column(String(36), ForeignKey("universities.id", ondelete="CASCADE"), nullable=True, index=True)
    campus_id = Column(String(36), ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True, index=True)
    pickup_address = Column(String(255), nullable=False)
    destination_address = Column(String(255), nullable=False)
    departure_time = Column(String(50), nullable=False) # e.g. "08:30 AM"
    days_of_week = Column(String(100), default="MON,TUE,WED,THU,FRI")
    vehicle_type = Column(String(50), default="Car")
    total_seats = Column(Integer, default=3)
    price_per_seat = Column(Float, default=40.0)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    university = relationship("University", foreign_keys=[university_id])
    campus = relationship("Campus", foreign_keys=[campus_id])


class PassengerRideRequest(Base):
    __tablename__ = "passenger_ride_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    passenger_name = Column(String(100), nullable=False)
    passenger_phone = Column(String(20), nullable=False)
    university_id = Column(String(36), ForeignKey("universities.id", ondelete="CASCADE"), nullable=True, index=True)
    campus_id = Column(String(36), ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True, index=True)
    pickup_address = Column(String(255), nullable=False)
    destination_address = Column(String(255), nullable=False)
    travel_date = Column(String(50), nullable=False) # e.g. "Today", "Tomorrow", "2026-10-21"
    preferred_time = Column(String(50), nullable=False) # e.g. "09:30 AM"
    passengers_count = Column(Integer, default=1)
    max_budget_per_seat = Column(Float, nullable=True) # budget willing to pay
    notes = Column(Text, nullable=True)
    status = Column(String(30), default="OPEN", index=True) # OPEN, MATCHED, FULFILLED, CANCELLED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    university = relationship("University", foreign_keys=[university_id])
    campus = relationship("Campus", foreign_keys=[campus_id])
