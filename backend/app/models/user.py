import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, Enum):
    PASSENGER = "passenger"
    RIDER = "rider"
    ADMIN = "admin"


class RiderApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = Column(String(20), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=True) # for admin/rider optional credential
    role = Column(SQLEnum(UserRole), default=UserRole.PASSENGER, nullable=False, index=True)
    profile_photo = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    tokens_revoked_at = Column(DateTime, nullable=True) # All sessions issued prior are invalidated
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    passenger_profile = relationship("PassengerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    rider_profile = relationship("RiderProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    rides_as_passenger = relationship("RideBooking", foreign_keys="RideBooking.passenger_id", back_populates="passenger")
    rides_as_rider = relationship("RideBooking", foreign_keys="RideBooking.rider_id", back_populates="rider")


class PassengerProfile(Base):
    __tablename__ = "passenger_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    default_payment_method = Column(String(30), default="cash")
    emergency_contact = Column(String(20), nullable=True)
    rating = Column(Float, default=5.0)
    total_trips = Column(Integer, default=0)

    # User Loyalty & Tier System
    loyalty_tier = Column(String(30), default="NEW_USER") # NEW_USER, MEMBER, BRONZE, SILVER, GOLD, DIAMOND
    free_rides_vouchers = Column(Integer, default=0) # Vouchers for 100% free rides
    total_discount_saved = Column(Float, default=0.0) # Total ₹ saved via discounts
    is_diamond_member = Column(Boolean, default=False) # Permanent Member of IndiRide

    # Campus & Student Verification
    university_id = Column(String(36), ForeignKey("universities.id", ondelete="SET NULL"), nullable=True, index=True)
    campus_id = Column(String(36), ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True, index=True)
    student_id_number = Column(String(50), nullable=True)
    student_id_photo = Column(String(500), nullable=True)
    student_status = Column(String(30), default="STUDENT") # STUDENT, FACULTY, STAFF, ALUMNI, GENERAL
    student_verification_status = Column(String(30), default="UNVERIFIED", index=True) # UNVERIFIED, PENDING, VERIFIED, REJECTED
    college_department = Column(String(100), nullable=True)

    user = relationship("User", back_populates="passenger_profile")


class RiderProfile(Base):
    __tablename__ = "rider_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    status = Column(SQLEnum(RiderApprovalStatus), default=RiderApprovalStatus.PENDING, nullable=False, index=True)
    is_online = Column(Boolean, default=False, nullable=False, index=True)
    is_busy = Column(Boolean, default=False, nullable=False)
    
    # Real-time Location cache
    current_latitude = Column(Float, nullable=True, index=True)
    current_longitude = Column(Float, nullable=True, index=True)
    last_location_update = Column(DateTime, nullable=True)
    
    rating = Column(Float, default=5.0)
    total_completed_trips = Column(Integer, default=0)
    total_earnings = Column(Float, default=0.0)

    # Campus & University Driver Service Type
    rider_service_type = Column(String(50), default="REGULAR")  # "REGULAR" or "CAMPUS"
    served_universities = Column(Text, nullable=True)  # Comma-separated list of served universities
    college_name = Column(String(200), nullable=True)  # University or College name
    academic_year = Column(String(50), nullable=True)  # e.g. "Final Year", "2024-2025"
    student_id_number = Column(String(50), nullable=True)  # Student ID Card number
    student_id_photo = Column(String(500), nullable=True)  # Student ID Card document image

    # Rider KYC & Verification Data
    permanent_address = Column(String(300), nullable=True)
    current_address = Column(String(300), nullable=True)
    passport_photo = Column(String(500), nullable=True)
    license_photo = Column(String(500), nullable=True)
    aadhaar_number = Column(String(20), nullable=True)
    aadhaar_photo = Column(String(500), nullable=True)
    rejection_reason = Column(String(300), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="rider_profile")
    vehicles = relationship("Vehicle", back_populates="rider", cascade="all, delete-orphan")
    documents = relationship("RiderDocument", back_populates="rider", cascade="all, delete-orphan")
    locations_history = relationship("RiderLocationHistory", back_populates="rider", cascade="all, delete-orphan")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String(100), default="logout", nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)

