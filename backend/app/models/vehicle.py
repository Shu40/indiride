import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base


class VehicleCategory(str, Enum):
    BIKE = "bike"
    BULLET = "bullet"
    AUTO = "auto"
    CAR = "car"
    CAR_PRO = "car_pro"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rider_id = Column(String(36), ForeignKey("rider_profiles.id", ondelete="CASCADE"), nullable=False)
    category = Column(SQLEnum(VehicleCategory), nullable=False, index=True)
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=True)
    license_plate = Column(String(30), unique=True, nullable=False, index=True)
    color = Column(String(30), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    rider = relationship("RiderProfile", back_populates="vehicles")
    rides = relationship("RideBooking", back_populates="vehicle")
