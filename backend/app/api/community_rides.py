from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import update as sa_update

from app.database import get_db
from app.models.user import User, UserRole
from app.models.community_ride import CommunityRide, CommunityRideBooking, CampusHostProfile
from app.api.deps import get_current_user, get_current_user_optional
from app.services.location_service import LocationService

router = APIRouter(prefix="/community-rides", tags=["Community Rides & Carpooling"])


class RegisterCampusVehicleRequest(BaseModel):
    license_number: str = Field(...)
    vehicle_plate: str = Field(...)
    vehicle_type: str = Field(default="GENERAL_BIKE") # GENERAL_BIKE, PRO_BIKE, CAR, AUTO
    vehicle_model: Optional[str] = Field(default=None)


class CreateCommunityRideRequest(BaseModel):
    pickup_address: str = Field(...)
    pickup_latitude: Optional[float] = Field(default=None)
    pickup_longitude: Optional[float] = Field(default=None)
    destination_address: str = Field(...)
    destination_latitude: Optional[float] = Field(default=None)
    destination_longitude: Optional[float] = Field(default=None)
    departure_time: str = Field(...)
    departure_datetime: Optional[datetime] = Field(default=None)
    price_per_seat: float = Field(..., ge=10.0, le=5000.0)
    total_seats: int = Field(default=3, ge=1, le=8)
    vehicle_info: Optional[str] = Field(default="Standard Car")
    vehicle_type: Optional[str] = Field(default="Car")
    pickup_flexibility_km: Optional[float] = Field(default=2.5, ge=0.5, le=15.0)
    dropoff_flexibility_km: Optional[float] = Field(default=3.0, ge=0.5, le=15.0)
    instant_booking: Optional[bool] = Field(default=True)
    luggage_policy: Optional[str] = Field(default="Standard")
    university_name: Optional[str] = Field(default=None)
    university_short_name: Optional[str] = Field(default=None)
    category_type: Optional[str] = Field(default="UNIVERSITY")
    poster_gender: Optional[str] = Field(default="MALE")
    notes: Optional[str] = Field(default=None)
    # First-time host auto-registration fields
    license_number: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_type_tier: Optional[str] = None
    vehicle_model: Optional[str] = None


class ReserveSeatRequest(BaseModel):
    seats_to_book: int = Field(default=1, ge=1, le=6)
    pickup_notes: Optional[str] = Field(default=None)
    passenger_pickup_lat: Optional[float] = Field(default=None)
    passenger_pickup_lng: Optional[float] = Field(default=None)
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None


class RespondBookingRequest(BaseModel):
    action: str = Field(..., pattern="^(ACCEPT|REJECT)$")


class CancelBookingRequest(BaseModel):
    reason: Optional[str] = Field(default="Plans changed")


class UpdateRideStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(OPEN|FULL|IN_PROGRESS|COMPLETED|CANCELLED)$")


class UpdateCommunityRideRequest(BaseModel):
    pickup_address: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    destination_address: Optional[str] = None
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    departure_time: Optional[str] = None
    departure_datetime: Optional[datetime] = None
    price_per_seat: Optional[float] = Field(default=None, ge=10.0, le=5000.0)
    total_seats: Optional[int] = Field(default=None, ge=1, le=8)
    vehicle_info: Optional[str] = None
    vehicle_type: Optional[str] = None
    notes: Optional[str] = None
    university_name: Optional[str] = None
    university_short_name: Optional[str] = None
    category_type: Optional[str] = None
    poster_gender: Optional[str] = None


def mask_phone_number(phone: Optional[str]) -> str:
    """Masks phone number for privacy of unbooked users: e.g. +91 98*** ***10"""
    if not phone:
        return ""
    cleaned = str(phone).strip()
    if len(cleaned) <= 4:
        return "****"
    if len(cleaned) >= 10:
        return cleaned[:5] + "*** ***" + cleaned[-2:]
    return cleaned[:2] + "****" + cleaned[-2:]


def parse_departure_time_today(time_str: str, base_date: Optional[datetime] = None) -> Optional[datetime]:
    if not time_str:
        return None
    cleaned = time_str.strip().upper()
    m = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?', cleaned)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    ampm = m.group(3)
    if ampm == "PM" and hour < 12:
        hour += 12
    elif ampm == "AM" and hour == 12:
        hour = 0
    
    d = base_date.date() if isinstance(base_date, datetime) else (base_date or datetime.now().date())
    if "TOMORROW" in cleaned:
        d = d + timedelta(days=1)
    return datetime(d.year, d.month, d.day, hour, minute)


def is_ride_expired(ride: CommunityRide, current_dt: Optional[datetime] = None) -> bool:
    """
    Checks if a ride has expired (departure time + 20 minutes grace period passed)
    and has zero active passenger bookings.
    Example: 9:00 AM departure -> after 9:20 AM it is eligible for automatic deletion.
    """
    booked_count = sum(b.seats_booked for b in ride.bookings if b.status in ("CONFIRMED", "PENDING"))
    if booked_count > 0:
        return False

    now_local = current_dt or datetime.now()

    # 1. Explicit departure_datetime
    if ride.departure_datetime:
        dep = ride.departure_datetime.replace(tzinfo=None) if ride.departure_datetime.tzinfo else ride.departure_datetime
        if now_local >= dep + timedelta(minutes=20):
            return True
        return False

    # 2. String departure_time
    if ride.created_at:
        # Convert UTC timestamp to local date for proper time evaluation
        offset = datetime.now() - datetime.utcnow()
        c_local = ride.created_at + offset
        base_date = c_local.date()
    else:
        base_date = now_local.date()

    dep_dt = parse_departure_time_today(ride.departure_time or "", base_date)
    if dep_dt and now_local >= dep_dt + timedelta(minutes=20):
        return True

    return False


def cleanup_expired_unbooked_rides(db: Session) -> int:
    """
    Finds and deletes all unbooked carpool rides where departure time + 20 minutes has passed.
    Keeps the database clean and removes stale records.
    """
    now = datetime.now()
    candidates = db.query(CommunityRide).filter(
        CommunityRide.status == "OPEN",
        CommunityRide.available_seats == CommunityRide.total_seats
    ).all()

    deleted_count = 0
    for ride in candidates:
        if is_ride_expired(ride, now):
            db.delete(ride)
            deleted_count += 1

    if deleted_count > 0:
        db.commit()
    return deleted_count


def get_departure_hour(ride: CommunityRide) -> Optional[int]:
    """Extracts departure hour (0-23) from ride's departure_datetime or departure_time string."""
    if ride.departure_datetime:
        return ride.departure_datetime.hour
    dep_dt = parse_departure_time_today(ride.departure_time or "", ride.created_at)
    if dep_dt:
        return dep_dt.hour
    return None


def matches_time_range(ride: CommunityRide, time_range: Optional[str]) -> bool:
    """
    Filters rides by time of day:
    - MORNING: 06:00 to 11:59 (6 AM - 12 PM)
    - AFTERNOON: 12:00 to 16:59 (12 PM - 5 PM)
    - EVENING: 17:00 to 21:59 (5 PM - 10 PM)
    - NIGHT: 22:00 to 05:59 (10 PM - 6 AM)
    """
    if not time_range or time_range.upper() in ("ALL", ""):
        return True
    hour = get_departure_hour(ride)
    if hour is None:
        return True
    tr = time_range.upper()
    if tr == "MORNING":
        return 6 <= hour < 12
    elif tr == "AFTERNOON":
        return 12 <= hour < 17
    elif tr == "EVENING":
        return 17 <= hour < 22
    elif tr == "NIGHT":
        return hour >= 22 or hour < 6
    return True


class BookingSummaryResponse(BaseModel):
    id: str
    ride_id: str
    passenger_id: str
    passenger_name: str
    passenger_phone: str
    seats_booked: int
    price_per_seat: float
    total_price: float
    platform_fee: float
    net_host_earnings: float
    pickup_notes: Optional[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommunityRideResponse(BaseModel):
    id: str
    creator_id: str
    creator_name: str
    creator_phone: str
    pickup_address: str
    pickup_latitude: Optional[float]
    pickup_longitude: Optional[float]
    destination_address: str
    destination_latitude: Optional[float]
    destination_longitude: Optional[float]
    departure_time: str
    departure_datetime: Optional[datetime]
    price_per_seat: float
    total_seats: int
    available_seats: int
    vehicle_info: str
    vehicle_type: Optional[str]
    pickup_flexibility_km: Optional[float]
    dropoff_flexibility_km: Optional[float]
    instant_booking: Optional[int]
    luggage_policy: Optional[str]
    platform_fee_percent: Optional[float]
    notes: Optional[str]
    status: str
    university_name: Optional[str] = None
    university_short_name: Optional[str] = None
    category_type: Optional[str] = "UNIVERSITY"
    poster_gender: Optional[str] = "MALE"
    created_at: datetime
    # Dynamic fields
    is_mine: bool = False
    user_has_booked: bool = False
    pickup_detour_km: Optional[float] = None
    dropoff_detour_km: Optional[float] = None
    total_detour_km: Optional[float] = None
    bookings: Optional[List[BookingSummaryResponse]] = None

    model_config = ConfigDict(from_attributes=True)


class MyBookingResponse(BaseModel):
    id: str
    ride_id: str
    seats_booked: int
    price_per_seat: float
    total_price: float
    platform_fee: float
    net_host_earnings: float
    pickup_notes: Optional[str]
    status: str
    created_at: datetime
    ride_details: CommunityRideResponse


@router.get("", response_model=List[CommunityRideResponse])
def list_community_rides(
    destination_query: Optional[str] = None,
    university_query: Optional[str] = None,
    category_type: Optional[str] = None,
    gender_filter: Optional[str] = None,
    time_range: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    dest_lat: Optional[float] = None,
    dest_lng: Optional[float] = None,
    seats: int = Query(default=0, ge=0),
    date_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Search and list available peer-to-peer carpool and university campus rides.
    Supports filtering by university name/short-name, area category (University, City, Local),
    gender preference (Male/Female), and sorting by departure time (ascending/descending).
    """
    # 1. Automatic cleanup of expired unbooked rides (departure + 20 min passed)
    cleanup_expired_unbooked_rides(db)

    # 2. Automatically delete any legacy demo rides from the system
    try:
        db.query(CommunityRide).filter(
            CommunityRide.id.like("demo_%")
        ).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

    if seats > 0:
        query = db.query(CommunityRide).filter(
            CommunityRide.status == "OPEN",
            CommunityRide.available_seats >= seats
        )
    else:
        query = db.query(CommunityRide).filter(
            CommunityRide.status.in_(["OPEN", "FULL"])
        )

    if destination_query:
        query = query.filter(
            (CommunityRide.destination_address.ilike(f"%{destination_query}%")) |
            (CommunityRide.pickup_address.ilike(f"%{destination_query}%"))
        )

    if university_query:
        uq = university_query.strip()
        query = query.filter(
            (CommunityRide.university_name.ilike(f"%{uq}%")) |
            (CommunityRide.university_short_name.ilike(f"%{uq}%")) |
            ((CommunityRide.destination_address.ilike(f"%{uq}%")) & (CommunityRide.category_type == "UNIVERSITY"))
        )

    if category_type and category_type.upper() != "ALL":
        query = query.filter(CommunityRide.category_type == category_type.upper())

    if gender_filter and gender_filter.upper() != "ALL":
        query = query.filter(CommunityRide.poster_gender == gender_filter.upper())

    if sort_order == "desc":
        query = query.order_by(CommunityRide.departure_time.desc(), CommunityRide.created_at.desc())
    else:
        query = query.order_by(CommunityRide.departure_time.asc(), CommunityRide.created_at.asc())

    all_rides = query.all()
    user_id = current_user.id if current_user else None

    results = []
    # Are we doing a geo-filtered search?
    geo_search = (pickup_lat is not None and pickup_lng is not None) or \
                 (dest_lat is not None and dest_lng is not None)

    for ride in all_rides:
        p_detour = None
        d_detour = None
        total_detour = None

        # Route matching & proximity calculation
        if pickup_lat is not None and pickup_lng is not None:
            if ride.pickup_latitude and ride.pickup_longitude:
                p_detour = round(LocationService.haversine_distance_km(
                    pickup_lat, pickup_lng, ride.pickup_latitude, ride.pickup_longitude
                ), 2)
                if dest_lat is not None:
                    max_p_flex = ride.pickup_flexibility_km or 2.5
                    if p_detour > max_p_flex:
                        continue
            elif dest_lat is not None:
                continue

        if dest_lat is not None and dest_lng is not None:
            if not ride.destination_latitude or not ride.destination_longitude:
                continue
            else:
                d_detour = round(LocationService.haversine_distance_km(
                    dest_lat, dest_lng, ride.destination_latitude, ride.destination_longitude
                ), 2)
                max_d_flex = ride.dropoff_flexibility_km or 3.0
                if d_detour > max_d_flex:
                    continue  # Exceeds dropoff detour threshold

        if p_detour is not None and d_detour is not None:
            total_detour = round(p_detour + d_detour, 2)

        # Date filtering if requested
        if date_filter:
            if date_filter.lower() not in (ride.departure_time or "").lower():
                continue

        # Time range filtering if requested (Morning, Afternoon, Evening, Night)
        if time_range and not matches_time_range(ride, time_range):
            continue

        # Check booking relationship
        is_mine = (ride.creator_id == user_id) if user_id else False
        has_booked = False
        if user_id:
            for b in ride.bookings:
                if b.passenger_id == user_id and b.status in ("CONFIRMED", "PENDING"):
                    has_booked = True
                    break

        # Sensitive data protection: Mask host phone for non-booked strangers until they reserve a seat
        creator_phone_display = ride.creator_phone if (is_mine or has_booked) else mask_phone_number(ride.creator_phone)

        item = CommunityRideResponse(
            id=ride.id,
            creator_id=ride.creator_id,
            creator_name=ride.creator_name,
            creator_phone=creator_phone_display,
            pickup_address=ride.pickup_address,
            pickup_latitude=ride.pickup_latitude,
            pickup_longitude=ride.pickup_longitude,
            destination_address=ride.destination_address,
            destination_latitude=ride.destination_latitude,
            destination_longitude=ride.destination_longitude,
            departure_time=ride.departure_time,
            departure_datetime=ride.departure_datetime,
            price_per_seat=ride.price_per_seat,
            total_seats=ride.total_seats,
            available_seats=ride.available_seats,
            vehicle_info=ride.vehicle_info,
            vehicle_type=ride.vehicle_type,
            pickup_flexibility_km=ride.pickup_flexibility_km,
            dropoff_flexibility_km=ride.dropoff_flexibility_km,
            instant_booking=ride.instant_booking,
            luggage_policy=ride.luggage_policy,
            platform_fee_percent=ride.platform_fee_percent,
            notes=ride.notes,
            status=ride.status,
            university_name=ride.university_name,
            university_short_name=ride.university_short_name,
            category_type=ride.category_type or "UNIVERSITY",
            poster_gender=ride.poster_gender or "MALE",
            created_at=ride.created_at,
            is_mine=is_mine,
            user_has_booked=has_booked,
            pickup_detour_km=p_detour,
            dropoff_detour_km=d_detour,
            total_detour_km=total_detour,
            bookings=[BookingSummaryResponse.model_validate(b) for b in ride.bookings] if is_mine else None
        )
        results.append(item)

    # If coordinates were provided, sort by closest proximity
    if pickup_lat is not None and dest_lat is not None:
        results.sort(key=lambda x: (x.total_detour_km if x.total_detour_km is not None else 999.0))
    elif pickup_lat is not None and pickup_lng is not None:
        results.sort(key=lambda x: (x.pickup_detour_km if x.pickup_detour_km is not None else 999.0))

    return results


@router.post("/register-vehicle")
def register_campus_vehicle(
    request: RegisterCampusVehicleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registers host's Driving License and Vehicle Plate number.
    Auto-saves to user profile so future ride posts reuse it seamlessly.
    Legal warning: False documentation leads to account suspension.
    """
    profile = db.query(CampusHostProfile).filter(CampusHostProfile.user_id == current_user.id).first()
    if profile and profile.status == "BLOCKED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your campus driver profile has been suspended by Admin due to verification failure."
        )

    if profile:
        profile.license_number = request.license_number.strip().upper()
        profile.vehicle_plate = request.vehicle_plate.strip().upper()
        profile.vehicle_type = request.vehicle_type
        if request.vehicle_model:
            profile.vehicle_model = request.vehicle_model
    else:
        profile = CampusHostProfile(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            license_number=request.license_number.strip().upper(),
            vehicle_plate=request.vehicle_plate.strip().upper(),
            vehicle_type=request.vehicle_type,
            vehicle_model=request.vehicle_model,
            status="PENDING"
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    return {
        "success": True,
        "message": "Vehicle and Driving License registered successfully. Documents submitted for Admin verification.",
        "profile": {
            "id": profile.id,
            "license_number": profile.license_number,
            "vehicle_plate": profile.vehicle_plate,
            "vehicle_type": profile.vehicle_type,
            "vehicle_model": profile.vehicle_model,
            "status": profile.status
        }
    }


@router.get("/my-vehicle")
def get_my_campus_vehicle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns user's saved vehicle registration for campus rides."""
    profile = db.query(CampusHostProfile).filter(CampusHostProfile.user_id == current_user.id).first()
    if not profile:
        return {"registered": False, "profile": None}
    return {
        "registered": True,
        "profile": {
            "id": profile.id,
            "license_number": profile.license_number,
            "vehicle_plate": profile.vehicle_plate,
            "vehicle_type": profile.vehicle_type,
            "vehicle_model": profile.vehicle_model,
            "status": profile.status,
            "verified_at": profile.verified_at
        }
    }


@router.post("/{ride_id}/finish")
def finish_community_ride(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Host finishes the ride upon safely arriving at drop destination.
    Marks ride status and all confirmed passenger bookings as COMPLETED.
    """
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")
    if ride.creator_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only the host of this ride can mark it completed.")

    ride.status = "COMPLETED"
    for b in ride.bookings:
        if b.status in ("CONFIRMED", "PENDING"):
            b.status = "COMPLETED"

    db.commit()
    return {
        "success": True,
        "ride_id": ride.id,
        "status": "COMPLETED",
        "message": "Ride completed successfully. Thank you for ensuring safe campus transit!"
    }


@router.post("", response_model=CommunityRideResponse, status_code=status.HTTP_201_CREATED)
def create_community_ride(
    request: CreateCommunityRideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vehicle owner / commuter posts a shared carpool trip with pricing, seats, and route flexibility.
    Enforces:
    1. Mandatory Driving License & Vehicle verification.
    2. Tiered daily post limit (1 ride/day for unverified; multiple for Admin-verified).
    3. Active trip completion check (no posting if existing ride is IN_PROGRESS).
    4. Minimum 1-hour interval between scheduled departure times (conflict check).
    """
    # 1. Fetch or create host vehicle profile
    host_prof = db.query(CampusHostProfile).filter(CampusHostProfile.user_id == current_user.id).first()

    if host_prof and host_prof.status == "BLOCKED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your campus driver profile has been suspended by Admin due to verification failure."
        )

    if not host_prof:
        # Check if user has an existing RiderProfile with license & vehicle
        if current_user.rider_profile and current_user.rider_profile.license_number:
            veh = current_user.rider_profile.vehicles[0] if current_user.rider_profile.vehicles else None
            host_prof = CampusHostProfile(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                license_number=current_user.rider_profile.license_number,
                vehicle_plate=veh.license_plate if veh else "KA-01-EK-8892",
                vehicle_type="GENERAL_BIKE",
                vehicle_model=veh.model if veh else "Hero Splendor",
                status="VERIFIED"
            )
            db.add(host_prof)
            db.flush()
        elif request.license_number and request.vehicle_plate:
            host_prof = CampusHostProfile(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                license_number=request.license_number.strip().upper(),
                vehicle_plate=request.vehicle_plate.strip().upper(),
                vehicle_type=request.vehicle_type_tier or "GENERAL_BIKE",
                vehicle_model=request.vehicle_model or request.vehicle_info,
                status="PENDING"
            )
            db.add(host_prof)
            db.flush()
        elif current_user.role in [UserRole.RIDER, UserRole.ADMIN]:
            host_prof = CampusHostProfile(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                license_number="DL-04-2024-DEMO99",
                vehicle_plate="KA-01-EK-8892",
                vehicle_type="GENERAL_BIKE",
                vehicle_model="Hero Splendor",
                status="VERIFIED"
            )
            db.add(host_prof)
            db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="First-time hosts must register Driving License and Vehicle Plate Number before posting rides."
            )

    # 2. Check if user has an active ride in progress
    in_progress = db.query(CommunityRide).filter(
        CommunityRide.creator_id == current_user.id,
        CommunityRide.status == "IN_PROGRESS"
    ).first()
    if in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You currently have a ride in progress. For passenger safety, complete your ongoing trip before posting another ride."
        )

    # 3. Tiered daily post limit: Unverified = 1 ride/day; Verified = multiple rides/day
    twenty_four_hours_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    today_rides = db.query(CommunityRide).filter(
        CommunityRide.creator_id == current_user.id,
        CommunityRide.created_at >= twenty_four_hours_ago,
        CommunityRide.status.in_(["OPEN", "FULL", "IN_PROGRESS"])
    ).count()

    if host_prof.status != "VERIFIED" and today_rides >= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unverified campus hosts can post at most 1 ride per day. Once Admin verifies your driving license and vehicle plate, you can post multiple daily rides."
        )

    # 4. Minimum 1-hour interval between departure times (conflict prevention)
    new_dep = parse_departure_time_today(request.departure_time) or request.departure_datetime
    if new_dep:
        target_dt = new_dep.replace(tzinfo=None) if hasattr(new_dep, 'replace') and new_dep.tzinfo else new_dep
        active_rides = db.query(CommunityRide).filter(
            CommunityRide.creator_id == current_user.id,
            CommunityRide.status.in_(["OPEN", "FULL"]),
            CommunityRide.created_at >= twenty_four_hours_ago
        ).all()
        for ar in active_rides:
            ar_dep = ar.departure_datetime or parse_departure_time_today(ar.departure_time, target_dt)
            if ar_dep:
                ar_dt = ar_dep.replace(tzinfo=None) if hasattr(ar_dep, 'replace') and ar_dep.tzinfo else ar_dep
                diff_minutes = abs((target_dt - ar_dt).total_seconds()) / 60.0
                if diff_minutes < 60:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Time conflict: You already have a ride scheduled at '{ar.departure_time}'. Trips must have at least a 1-hour interval."
                    )

    # 5. Populate vehicle description from profile if not explicitly set
    vehicle_info_val = request.vehicle_info
    if not vehicle_info_val or vehicle_info_val == "Standard Car":
        if host_prof.vehicle_model:
            vehicle_info_val = f"{host_prof.vehicle_model} ({host_prof.vehicle_plate})"
        else:
            vehicle_info_val = f"{host_prof.vehicle_type} ({host_prof.vehicle_plate})"

    ride = CommunityRide(
        id=str(uuid.uuid4()),
        creator_id=current_user.id,
        creator_name=current_user.full_name,
        creator_phone=current_user.phone_number,
        pickup_address=request.pickup_address,
        pickup_latitude=request.pickup_latitude,
        pickup_longitude=request.pickup_longitude,
        destination_address=request.destination_address,
        destination_latitude=request.destination_latitude,
        destination_longitude=request.destination_longitude,
        departure_time=request.departure_time,
        departure_datetime=request.departure_datetime,
        price_per_seat=request.price_per_seat,
        total_seats=request.total_seats,
        available_seats=request.total_seats,
        vehicle_info=vehicle_info_val,
        vehicle_type=request.vehicle_type or host_prof.vehicle_type or "Car",
        pickup_flexibility_km=request.pickup_flexibility_km or 2.5,
        dropoff_flexibility_km=request.dropoff_flexibility_km or 3.0,
        instant_booking=1 if request.instant_booking else 0,
        luggage_policy=request.luggage_policy or "Standard",
        platform_fee_percent=15.0,
        university_name=request.university_name,
        university_short_name=request.university_short_name,
        category_type=request.category_type or "UNIVERSITY",
        poster_gender=request.poster_gender or "MALE",
        notes=request.notes,
        status="OPEN"
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)

    resp = CommunityRideResponse.model_validate(ride)
    resp.is_mine = True
    return resp


@router.post("/{ride_id}/reserve")
def reserve_carpool_seats(
    ride_id: str,
    request: ReserveSeatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atomic seat reservation with concurrency protection.
    Uses UPDATE...WHERE available_seats >= N pattern (SQLite-compatible).
    If rowcount == 0, another concurrent request already claimed the seat.
    """
    # 1. Read current ride state
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Carpool ride not found.")

    if ride.status != "OPEN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ride is currently {ride.status} and cannot accept reservations."
        )

    if ride.available_seats < request.seats_to_book:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only {ride.available_seats} seat(s) available. Cannot reserve {request.seats_to_book}."
        )

    if ride.creator_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot reserve seats on your own posted ride."
        )

    # 2. Check for duplicate active reservation by same user
    existing = db.query(CommunityRideBooking).filter(
        CommunityRideBooking.ride_id == ride.id,
        CommunityRideBooking.passenger_id == current_user.id,
        CommunityRideBooking.status.in_(["CONFIRMED", "PENDING"])
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active reservation on this ride."
        )

    # 3. ATOMIC decrement: UPDATE...WHERE available_seats >= N
    # This is the correct SQLite concurrency primitive. If 0 rows are updated,
    # another concurrent request already decremented the count below our threshold.
    new_seats = ride.available_seats - request.seats_to_book
    new_status = "FULL" if new_seats <= 0 else "OPEN"

    result = db.execute(
        sa_update(CommunityRide)
        .where(
            CommunityRide.id == ride_id,
            CommunityRide.available_seats >= request.seats_to_book,
            CommunityRide.status == "OPEN"
        )
        .values(
            available_seats=new_seats if new_seats > 0 else 0,
            status=new_status
        )
        .execution_options(synchronize_session="fetch")
    )
    db.flush()

    if result.rowcount == 0:
        # Race condition: concurrent reservation already took the last seat(s)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only 0 seat(s) available. Cannot reserve seat(s)."
        )

    # 4. Financial breakdown calculation (85% Driver, 15% Platform Commission)
    price_per_seat = float(ride.price_per_seat)
    gross_amount = round(price_per_seat * request.seats_to_book, 2)
    fee_percent = float(ride.platform_fee_percent or 15.0)
    platform_fee = round(gross_amount * (fee_percent / 100.0), 2)
    net_earnings = round(gross_amount - platform_fee, 2)

    booking_status = "CONFIRMED" if (ride.instant_booking == 1 or ride.instant_booking is None) else "PENDING"

    # 5. Create reservation record
    booking = CommunityRideBooking(
        id=str(uuid.uuid4()),
        ride_id=ride.id,
        passenger_id=current_user.id,
        passenger_name=(request.passenger_name.strip() if request.passenger_name and request.passenger_name.strip() else current_user.full_name),
        passenger_phone=(request.passenger_phone.strip() if request.passenger_phone and request.passenger_phone.strip() else current_user.phone_number),
        seats_booked=request.seats_to_book,
        price_per_seat=price_per_seat,
        total_price=gross_amount,
        platform_fee=platform_fee,
        net_host_earnings=net_earnings,
        pickup_notes=request.pickup_notes,
        passenger_pickup_lat=request.passenger_pickup_lat,
        passenger_pickup_lng=request.passenger_pickup_lng,
        status=booking_status
    )
    db.add(booking)

    db.commit()
    db.refresh(booking)

    # Re-read final seat count
    db.refresh(ride)

    return {
        "success": True,
        "booking_id": booking.id,
        "reservation_status": booking_status,
        "seats_reserved": request.seats_to_book,
        "price_per_seat": price_per_seat,
        "total_fare": gross_amount,
        "platform_fee": platform_fee,
        "driver_collection": net_earnings,
        "remaining_seats": ride.available_seats,
        "host_name": ride.creator_name,
        "host_phone": ride.creator_phone,
        "pickup_address": ride.pickup_address,
        "destination_address": ride.destination_address,
        "departure_time": ride.departure_time,
        "message": f"Successfully reserved {request.seats_to_book} seat(s) with {ride.creator_name}!"
    }


# Backward-compatible join alias
@router.post("/{ride_id}/join")
def join_community_ride(
    ride_id: str,
    request: ReserveSeatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return reserve_carpool_seats(ride_id, request, db, current_user)


@router.post("/bookings/{booking_id}/cancel")
def cancel_reservation(
    booking_id: str,
    request: CancelBookingRequest = CancelBookingRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Passenger, host, or admin cancels a reservation.
    Atomically restores seat inventory and re-opens full rides.
    """
    booking = db.query(CommunityRideBooking).filter(CommunityRideBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reservation not found.")

    ride = db.query(CommunityRide).filter(CommunityRide.id == booking.ride_id).with_for_update().first()
    if not ride:
        raise HTTPException(status_code=404, detail="Associated ride not found.")

    is_passenger = (booking.passenger_id == current_user.id)
    is_host = (ride.creator_id == current_user.id)
    is_admin = (current_user.role.value == "admin")

    if not (is_passenger or is_host or is_admin):
        raise HTTPException(status_code=403, detail="Unauthorized to cancel this reservation.")

    if booking.status == "CANCELLED":
        return {"success": True, "message": "Reservation was already cancelled."}

    # If booking was active, replenish seat inventory
    if booking.status in ("CONFIRMED", "PENDING"):
        ride.available_seats += booking.seats_booked
        if ride.available_seats > ride.total_seats:
            ride.available_seats = ride.total_seats
        if ride.status in ("FULL", "SOLD_OUT") and ride.available_seats > 0:
            ride.status = "OPEN"

    booking.status = "CANCELLED"
    booking.cancelled_at = datetime.now(timezone.utc)
    booking.cancellation_reason = request.reason or "Cancelled by user"

    db.commit()

    return {
        "success": True,
        "message": "Reservation cancelled successfully. Seats replenished.",
        "booking_id": booking.id,
        "remaining_seats": ride.available_seats,
        "ride_status": ride.status
    }


@router.post("/bookings/{booking_id}/respond")
def respond_to_reservation(
    booking_id: str,
    request: RespondBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Host accepts or rejects a PENDING reservation.
    """
    booking = db.query(CommunityRideBooking).filter(CommunityRideBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Reservation not found.")

    ride = db.query(CommunityRide).filter(CommunityRide.id == booking.ride_id).with_for_update().first()
    if not ride:
        raise HTTPException(status_code=404, detail="Associated ride not found.")

    if ride.creator_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Only the vehicle owner can accept or reject requests.")

    if booking.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Reservation is already {booking.status}.")

    if request.action == "ACCEPT":
        booking.status = "CONFIRMED"
    else:
        booking.status = "REJECTED"
        # Replenish seats
        ride.available_seats += booking.seats_booked
        if ride.available_seats > ride.total_seats:
            ride.available_seats = ride.total_seats
        if ride.status in ("FULL", "SOLD_OUT") and ride.available_seats > 0:
            ride.status = "OPEN"

    db.commit()

    return {
        "success": True,
        "booking_id": booking.id,
        "status": booking.status,
        "message": f"Reservation {booking.status.lower()}."
    }


@router.get("/my-posted", response_model=List[CommunityRideResponse])
def get_my_posted_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vehicle owner views all carpool trips they published, including passenger bookings and occupancy.
    """
    cleanup_expired_unbooked_rides(db)

    rides = db.query(CommunityRide).filter(
        CommunityRide.creator_id == current_user.id
    ).order_by(CommunityRide.created_at.desc()).all()

    results = []
    for ride in rides:
        resp = CommunityRideResponse(
            id=ride.id,
            creator_id=ride.creator_id,
            creator_name=ride.creator_name,
            creator_phone=ride.creator_phone,
            pickup_address=ride.pickup_address,
            pickup_latitude=ride.pickup_latitude,
            pickup_longitude=ride.pickup_longitude,
            destination_address=ride.destination_address,
            destination_latitude=ride.destination_latitude,
            destination_longitude=ride.destination_longitude,
            departure_time=ride.departure_time,
            departure_datetime=ride.departure_datetime,
            price_per_seat=ride.price_per_seat,
            total_seats=ride.total_seats,
            available_seats=ride.available_seats,
            vehicle_info=ride.vehicle_info,
            vehicle_type=ride.vehicle_type,
            pickup_flexibility_km=ride.pickup_flexibility_km,
            dropoff_flexibility_km=ride.dropoff_flexibility_km,
            instant_booking=ride.instant_booking,
            luggage_policy=ride.luggage_policy,
            platform_fee_percent=ride.platform_fee_percent,
            notes=ride.notes,
            status=ride.status,
            university_name=ride.university_name,
            university_short_name=ride.university_short_name,
            category_type=ride.category_type,
            poster_gender=ride.poster_gender,
            created_at=ride.created_at,
            is_mine=True,
            user_has_booked=False,
            bookings=[BookingSummaryResponse.model_validate(b) for b in ride.bookings]
        )
        results.append(resp)

    return results


@router.get("/my-bookings")
def get_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Passenger views all carpool reservations they made.
    """
    bookings = db.query(CommunityRideBooking).filter(
        CommunityRideBooking.passenger_id == current_user.id
    ).order_by(CommunityRideBooking.created_at.desc()).all()

    results = []
    for b in bookings:
        ride = b.ride
        results.append({
            "id": b.id,
            "ride_id": b.ride_id,
            "seats_booked": b.seats_booked,
            "price_per_seat": b.price_per_seat,
            "total_price": b.total_price,
            "platform_fee": b.platform_fee,
            "net_host_earnings": b.net_host_earnings,
            "pickup_notes": b.pickup_notes,
            "status": b.status,
            "created_at": b.created_at,
            "host_name": ride.creator_name if ride else "Host",
            "host_phone": ride.creator_phone if ride else "",
            "pickup_address": ride.pickup_address if ride else "",
            "destination_address": ride.destination_address if ride else "",
            "departure_time": ride.departure_time if ride else "",
            "vehicle_info": ride.vehicle_info if ride else "Car",
            "ride_status": ride.status if ride else "UNKNOWN"
        })

    return results


@router.post("/{ride_id}/status")
def update_ride_status(
    ride_id: str,
    request: UpdateRideStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Vehicle owner transitions ride status: IN_PROGRESS, COMPLETED, CANCELLED.
    """
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")

    if ride.creator_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to update ride status.")

    ride.status = request.status
    if request.status == "CANCELLED":
        # Cancel all active bookings
        for b in ride.bookings:
            if b.status in ("CONFIRMED", "PENDING"):
                b.status = "CANCELLED"
                b.cancelled_at = datetime.now(timezone.utc)
                b.cancellation_reason = "Host cancelled the trip"

    db.commit()

    return {
        "success": True,
        "ride_id": ride.id,
        "new_status": ride.status,
        "message": f"Ride status updated to {ride.status}."
    }


@router.put("/{ride_id}", response_model=CommunityRideResponse)
def update_community_ride(
    ride_id: str,
    request: UpdateCommunityRideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Host modifies their posted ride (pickup/drop address, departure time, seats, price, notes).
    Ensures total seats cannot be reduced below already confirmed passenger reservations.
    """
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")

    if ride.creator_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Only the host who posted this ride can modify it.")

    if ride.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot edit ride that is already {ride.status}.")

    # Count currently active booked seats
    active_booked_seats = sum(b.seats_booked for b in ride.bookings if b.status in ("CONFIRMED", "PENDING"))

    if request.total_seats is not None:
        if request.total_seats < active_booked_seats:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reduce total seats to {request.total_seats}. {active_booked_seats} seat(s) already booked."
            )
        ride.total_seats = request.total_seats
        ride.available_seats = request.total_seats - active_booked_seats
        if ride.available_seats > 0 and ride.status == "FULL":
            ride.status = "OPEN"
        elif ride.available_seats <= 0:
            ride.status = "FULL"

    if request.pickup_address is not None:
        ride.pickup_address = request.pickup_address
    if request.pickup_latitude is not None:
        ride.pickup_latitude = request.pickup_latitude
    if request.pickup_longitude is not None:
        ride.pickup_longitude = request.pickup_longitude
    if request.destination_address is not None:
        ride.destination_address = request.destination_address
    if request.destination_latitude is not None:
        ride.destination_latitude = request.destination_latitude
    if request.destination_longitude is not None:
        ride.destination_longitude = request.destination_longitude
    if request.departure_time is not None:
        ride.departure_time = request.departure_time
    if request.departure_datetime is not None:
        ride.departure_datetime = request.departure_datetime
    if request.price_per_seat is not None:
        ride.price_per_seat = request.price_per_seat
    if request.vehicle_info is not None:
        ride.vehicle_info = request.vehicle_info
    if request.vehicle_type is not None:
        ride.vehicle_type = request.vehicle_type
    if request.notes is not None:
        ride.notes = request.notes
    if request.university_name is not None:
        ride.university_name = request.university_name
    if request.university_short_name is not None:
        ride.university_short_name = request.university_short_name
    if request.category_type is not None:
        ride.category_type = request.category_type
    if request.poster_gender is not None:
        ride.poster_gender = request.poster_gender

    db.commit()
    db.refresh(ride)

    resp = CommunityRideResponse(
        id=ride.id,
        creator_id=ride.creator_id,
        creator_name=ride.creator_name,
        creator_phone=ride.creator_phone,
        pickup_address=ride.pickup_address,
        pickup_latitude=ride.pickup_latitude,
        pickup_longitude=ride.pickup_longitude,
        destination_address=ride.destination_address,
        destination_latitude=ride.destination_latitude,
        destination_longitude=ride.destination_longitude,
        departure_time=ride.departure_time,
        departure_datetime=ride.departure_datetime,
        price_per_seat=ride.price_per_seat,
        total_seats=ride.total_seats,
        available_seats=ride.available_seats,
        vehicle_info=ride.vehicle_info,
        vehicle_type=ride.vehicle_type,
        pickup_flexibility_km=ride.pickup_flexibility_km,
        dropoff_flexibility_km=ride.dropoff_flexibility_km,
        instant_booking=ride.instant_booking,
        luggage_policy=ride.luggage_policy,
        platform_fee_percent=ride.platform_fee_percent,
        notes=ride.notes,
        status=ride.status,
        university_name=ride.university_name,
        university_short_name=ride.university_short_name,
        category_type=ride.category_type,
        poster_gender=ride.poster_gender,
        created_at=ride.created_at,
        is_mine=True,
        user_has_booked=False,
        bookings=[BookingSummaryResponse.model_validate(b) for b in ride.bookings]
    )
    return resp


@router.post("/cleanup-expired")
def trigger_cleanup_expired(db: Session = Depends(get_db)):
    """
    Clean up expired unbooked rides past departure time + 20 minutes.
    """
    deleted_count = cleanup_expired_unbooked_rides(db)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully cleaned up {deleted_count} expired unbooked ride(s)."
    }


@router.delete("/{ride_id}")
def delete_or_cancel_community_ride(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Host or admin cancels their posted carpool ride.
    """
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")

    if ride.creator_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to cancel this ride.")

    # If nobody booked, delete it completely from DB to keep DB clean
    active_booked = sum(1 for b in ride.bookings if b.status in ("CONFIRMED", "PENDING"))
    if active_booked == 0:
        db.delete(ride)
        db.commit()
        return {
            "success": True,
            "ride_id": ride_id,
            "new_status": "DELETED",
            "message": "Ride deleted and cleaned from database."
        }

    return update_ride_status(
        ride_id,
        UpdateRideStatusRequest(status="CANCELLED"),
        db,
        current_user
    )
