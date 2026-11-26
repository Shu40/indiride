import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base


class DocumentType(str, Enum):
    DRIVING_LICENSE = "driving_license"
    VEHICLE_RC = "vehicle_rc"
    AADHAAR = "aadhaar"
    INSURANCE = "insurance"


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class RiderDocument(Base):
    __tablename__ = "rider_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rider_id = Column(String(36), ForeignKey("rider_profiles.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(SQLEnum(DocumentType), nullable=False)
    file_url = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    verification_notes = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    rider = relationship("RiderProfile", back_populates="documents")


class RiderLocationHistory(Base):
    __tablename__ = "rider_locations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rider_id = Column(String(36), ForeignKey("rider_profiles.id", ondelete="CASCADE"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    rider = relationship("RiderProfile", back_populates="locations_history")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = Column(String(36), ForeignKey("ride_bookings.id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)  # 1 to 5
    comment = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ride = relationship("RideBooking", back_populates="ratings")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    ride_id = Column(String(36), ForeignKey("ride_bookings.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="open")  # open, in_progress, resolved
    created_at = Column(DateTime, default=datetime.utcnow)


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, index=True, nullable=False)
    discount_percent = Column(Float, nullable=False) # e.g. 20.0
    max_discount_amount = Column(Float, default=100.0)
    min_order_amount = Column(Float, default=20.0)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class NewUserDiscountConfig(Base):
    __tablename__ = "new_user_discount_configs"

    id = Column(String(36), primary_key=True, default="default")
    discount_percent = Column(Float, default=90.0, nullable=False) # Default 90% discount for 1st ride
    max_discount_amount = Column(Float, default=150.0, nullable=False) # Up to ₹150 max discount
    is_active = Column(Boolean, default=True, nullable=False)
    description = Column(String(255), default="Welcome to IndiRide! Flat 90% OFF on your 1st ride (auto-applied).")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

