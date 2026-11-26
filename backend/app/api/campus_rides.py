from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta
import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, update as sa_update

from app.database import get_db
from app.models.user import User, UserRole, PassengerProfile, RiderProfile, RiderApprovalStatus
from app.models.community_ride import CommunityRide, CommunityRideBooking, CampusHostProfile
from app.models.campus import University, Campus, CampusRideAlert, RecurringRideSchedule, PassengerRideRequest
from app.api.deps import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campus-rides", tags=["Campus Rides"])


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


def normalize_date_key(raw_date: Optional[str]) -> str:
    """Normalizes 'Today', 'Tomorrow', '2026-10-21' to standard YYYY-MM-DD string."""
    if not raw_date:
        return datetime.now().strftime("%Y-%m-%d")
    d_clean = raw_date.strip().lower()
    if d_clean in ("today", "aaj", "all", "any"):
        return datetime.now().strftime("%Y-%m-%d")
    elif d_clean in ("tomorrow", "kal"):
        return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    elif d_clean in ("day_after", "parso"):
        return (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    try:
        dt = datetime.strptime(raw_date.strip()[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return raw_date.strip()


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class UniversityCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    short_name: Optional[str] = Field(default=None, max_length=50)
    city: Optional[str] = Field(default="Gujarat", max_length=100)
    state: Optional[str] = Field(default="Gujarat", max_length=100)
    country: Optional[str] = Field(default="India")
    logo_url: Optional[str] = None


class CampusCreate(BaseModel):
    university_id: str
    name: str = Field(..., min_length=2, max_length=150)
    address: str = Field(..., min_length=5, max_length=300)
    city: str
    state: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    common_locations: Optional[List[str]] = None


class CampusResponse(BaseModel):
    id: str
    university_id: str
    name: str
    address: str
    city: str
    state: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    common_locations: List[str]


class UniversityResponse(BaseModel):
    id: str
    name: str
    short_name: Optional[str] = None
    city: str
    state: str
    country: str
    status: str
    logo_url: Optional[str] = None
    campuses: List[CampusResponse] = []


class PostCampusRideRequest(BaseModel):
    pickup_address: str = Field(..., min_length=2)
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    destination_address: str = Field(..., min_length=2)
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    departure_time: str = Field(..., description="e.g. '08:30 AM' or 'Today, 8:30 AM'")
    departure_datetime: Optional[datetime] = None
    travel_date: Optional[str] = None
    price_per_seat: float = Field(..., ge=0.0, le=5000.0)
    total_seats: int = Field(default=3, ge=1, le=8)
    vehicle_type: str = Field(default="Car", description="Car, Bike, Auto")
    vehicle_info: Optional[str] = Field(default="Private Vehicle")
    university_id: Optional[str] = None
    campus_id: Optional[str] = None
    university_name: Optional[str] = None
    intermediate_stops: Optional[List[str]] = None
    recurring_days: Optional[str] = None
    return_trip_time: Optional[str] = None
    notes: Optional[str] = None
    instant_booking: Optional[bool] = True
    category_type: Optional[str] = Field(default="CAMPUS_TO_CITY", description="CAMPUS_TO_CITY, CAMPUS_TO_CAMPUS, UNI_TO_UNI")
    is_daily: Optional[bool] = Field(default=False, description="Daily recurring commute for college students")
    gender_preference: Optional[str] = Field(default="ANY", description="ANY, FEMALE_ONLY, MALE_ONLY")


class PassengerRideRequestCreate(BaseModel):
    pickup_address: str = Field(..., min_length=2)
    destination_address: str = Field(..., min_length=2)
    travel_date: str = Field(..., description="Today, Tomorrow, or specific date")
    preferred_time: str = Field(..., description="e.g. '09:30 AM'")
    passengers_count: int = Field(default=1, ge=1, le=8)
    max_budget_per_seat: Optional[float] = Field(default=None, ge=0.0)
    university_id: Optional[str] = None
    campus_id: Optional[str] = None
    notes: Optional[str] = None


class BookCampusRideRequest(BaseModel):
    seats_to_book: int = Field(default=1, ge=1, le=6)
    travel_date: Optional[str] = Field(default="Today", description="Today, Tomorrow, or calendar date")
    pickup_notes: Optional[str] = None
    passenger_pickup_lat: Optional[float] = None
    passenger_pickup_lng: Optional[float] = None


class CreateAlertRequest(BaseModel):
    university_id: Optional[str] = None
    campus_id: Optional[str] = None
    pickup_text: str = Field(..., min_length=2)
    destination_text: str = Field(..., min_length=2)
    travel_date: Optional[str] = "Today"
    preferred_time_window: Optional[str] = "ANY"  # ANY, MORNING, AFTERNOON, EVENING, NIGHT
    seats_needed: Optional[int] = 1


class StudentProfileUpdate(BaseModel):
    university_id: Optional[str] = None
    campus_id: Optional[str] = None
    student_id_number: Optional[str] = None
    student_id_photo: Optional[str] = None
    student_status: Optional[str] = "STUDENT"  # STUDENT, FACULTY, STAFF, ALUMNI
    college_department: Optional[str] = None


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def serialize_campus(campus: Campus) -> CampusResponse:
    return CampusResponse(
        id=campus.id,
        university_id=campus.university_id,
        name=campus.name,
        address=campus.address,
        city=campus.city,
        state=campus.state,
        latitude=campus.latitude,
        longitude=campus.longitude,
        status=campus.status,
        common_locations=campus.get_common_locations()
    )


def serialize_university(uni: University, include_campuses: bool = True) -> UniversityResponse:
    campuses_resp = [serialize_campus(c) for c in uni.campuses] if include_campuses and uni.campuses else []
    return UniversityResponse(
        id=uni.id,
        name=uni.name,
        short_name=uni.short_name,
        city=uni.city,
        state=uni.state,
        country=uni.country,
        status=uni.status,
        logo_url=uni.logo_url,
        campuses=campuses_resp
    )


# ==========================================
# 1. UNIVERSITIES & CAMPUSES DIRECTORY
# ==========================================

@router.get("/universities", response_model=List[UniversityResponse])
def get_universities(
    city: Optional[str] = None,
    state: Optional[str] = None,
    query: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get list of registered universities and their campuses.
    Searchable by query, city, or state.
    """
    q = db.query(University).filter(University.status == "ACTIVE")
    if city:
        q = q.filter(University.city.ilike(f"%{city}%"))
    if state:
        q = q.filter(University.state.ilike(f"%{state}%"))
    if query:
        term = f"%{query}%"
        q = q.filter(or_(University.name.ilike(term), University.short_name.ilike(term), University.city.ilike(term)))
    
    unis = q.order_by(University.name.asc()).all()
    return [serialize_university(u) for u in unis]


@router.post("/universities", response_model=UniversityResponse)
def create_or_get_university(
    data: UniversityCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new University, College, or School (e.g. via 'Other' selection).
    If it already exists by name, returns the existing record.
    Otherwise creates and persists it in the database for all future drivers and passengers.
    """
    clean_name = data.name.strip()
    existing = db.query(University).filter(
        func.lower(University.name) == clean_name.lower()
    ).first()
    if existing:
        return serialize_university(existing)

    new_uni = University(
        id=str(uuid.uuid4()),
        name=clean_name,
        short_name=data.short_name.strip() if data.short_name else None,
        city=data.city.strip() if data.city else "Gujarat",
        state=data.state.strip() if data.state else "Gujarat",
        country=data.country or "India",
        status="ACTIVE",
        logo_url=data.logo_url
    )
    db.add(new_uni)
    db.commit()
    db.refresh(new_uni)
    return serialize_university(new_uni)


@router.get("/universities/{university_id}/campuses", response_model=List[CampusResponse])
def get_university_campuses(
    university_id: str,
    db: Session = Depends(get_db)
):
    """Get all campuses for a given university."""
    campuses = db.query(Campus).filter(
        Campus.university_id == university_id,
        Campus.status == "ACTIVE"
    ).order_by(Campus.name.asc()).all()
    return [serialize_campus(c) for c in campuses]


@router.get("/campuses/{campus_id}", response_model=CampusResponse)
def get_campus_details(
    campus_id: str,
    db: Session = Depends(get_db)
):
    """Get single campus details including landmark spots."""
    campus = db.query(Campus).filter(Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found")
    return serialize_campus(campus)


# ==========================================
# 2. SEARCH & DISCOVER CAMPUS RIDES
# ==========================================

@router.get("")
def list_campus_rides(
    university_id: Optional[str] = None,
    university_query: Optional[str] = None,
    campus_id: Optional[str] = None,
    pickup_query: Optional[str] = None,
    dest_query: Optional[str] = None,
    travel_date: Optional[str] = None,
    time_window: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    gender_filter: Optional[str] = None,
    category_type: Optional[str] = None,
    seats: int = Query(default=1, ge=1, le=8),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Discover matching campus rides with real driver verification badges,
    datewise daily recurrence seat tracking, university fuzzy search, and gender filters.
    """
    now_val = datetime.now()

    # Include OPEN and FULL (sold out) rides, but exclude CANCELLED/COMPLETED
    q = db.query(CommunityRide).filter(
        CommunityRide.status.in_(["OPEN", "FULL"])
    )

    # Exclude past non-recurring rides (departure time older than 30 mins ago)
    q = q.filter(
        or_(
            CommunityRide.recurring_days.ilike("%DAILY%"),
            CommunityRide.departure_datetime == None,
            CommunityRide.departure_datetime >= now_val - timedelta(minutes=30)
        )
    )

    # Case-insensitive University / College name search (e.g. 'parul', 'DU', 'delhi university', 'PU')
    if university_query and len(university_query.strip()) >= 2:
        u_term = university_query.strip().lower()
        q = q.filter(
            or_(
                func.lower(CommunityRide.university_name).contains(u_term),
                func.lower(CommunityRide.university_short_name) == u_term,
                func.lower(CommunityRide.pickup_address).contains(u_term),
                func.lower(CommunityRide.destination_address).contains(u_term),
                func.lower(CommunityRide.intermediate_stops).contains(u_term),
            )
        )

    # University / Campus Filter
    if university_id:
        q = q.filter(
            or_(
                CommunityRide.university_id == university_id,
                CommunityRide.university_id == None
            )
        )
    if campus_id:
        q = q.filter(
            or_(
                CommunityRide.campus_id == campus_id,
                CommunityRide.campus_id == None
            )
        )

    # Gender filter (ALL, FEMALE_ONLY, MALE_ONLY)
    if gender_filter and gender_filter.upper() not in ("ALL", "ANY"):
        gf = gender_filter.upper()
        if gf in ("FEMALE_ONLY", "GIRLS_ONLY", "FEMALE"):
            q = q.filter(or_(CommunityRide.poster_gender == "FEMALE_ONLY", CommunityRide.poster_gender == "ANY", CommunityRide.poster_gender == None))
        elif gf in ("MALE_ONLY", "BOYS_ONLY", "MALE"):
            q = q.filter(or_(CommunityRide.poster_gender == "MALE_ONLY", CommunityRide.poster_gender == "ANY", CommunityRide.poster_gender == None))

    # Category Type Filter (CAMPUS_TO_CITY, CAMPUS_TO_CAMPUS, UNI_TO_UNI, UNIVERSITY)
    if category_type and category_type.upper() not in ("ALL", "ANY"):
        q = q.filter(CommunityRide.category_type.ilike(f"%{category_type}%"))

    # Vehicle filter (Car, Bike, Auto)
    if vehicle_type and vehicle_type.lower() != "all":
        q = q.filter(CommunityRide.vehicle_type.ilike(f"%{vehicle_type}%"))

    # Travel Date filter (Today, Tomorrow, or specific date / calendar date)
    if travel_date and travel_date.lower() not in ("all", "any", "all dates"):
        if travel_date.lower() in ("today", "aaj"):
            today_str = datetime.now().strftime("%Y-%m-%d")
            q = q.filter(
                or_(
                    CommunityRide.recurring_days.ilike("%DAILY%"),
                    CommunityRide.departure_time.ilike("%today%"),
                    CommunityRide.departure_time.ilike("%aaj%"),
                    CommunityRide.departure_time.ilike(f"%{today_str}%")
                )
            )
        elif travel_date.lower() in ("tomorrow", "kal"):
            tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            q = q.filter(
                or_(
                    CommunityRide.recurring_days.ilike("%DAILY%"),
                    CommunityRide.departure_time.ilike("%tomorrow%"),
                    CommunityRide.departure_time.ilike("%kal%"),
                    CommunityRide.departure_time.ilike(f"%{tomorrow_str}%")
                )
            )
        else:
            # Matches specific custom calendar date e.g. "2026-10-21" or "21 Oct"
            q = q.filter(
                or_(
                    CommunityRide.recurring_days.ilike("%DAILY%"),
                    CommunityRide.departure_time.ilike(f"%{travel_date}%"),
                    CommunityRide.departure_datetime.ilike(f"%{travel_date}%")
                )
            )

    # Smart Pickup / Intermediate Stop keyword matching
    if pickup_query and len(pickup_query.strip()) >= 2:
        p_terms = [t.strip() for t in pickup_query.strip().split() if len(t.strip()) >= 2]
        for term in p_terms:
            t_pat = f"%{term}%"
            q = q.filter(
                or_(
                    CommunityRide.pickup_address.ilike(t_pat),
                    CommunityRide.university_name.ilike(t_pat),
                    CommunityRide.intermediate_stops.ilike(t_pat)
                )
            )

    # Smart Destination / Intermediate Stop keyword matching
    if dest_query and len(dest_query.strip()) >= 2:
        d_terms = [t.strip() for t in dest_query.strip().split() if len(t.strip()) >= 2]
        for term in d_terms:
            t_pat = f"%{term}%"
            q = q.filter(
                or_(
                    CommunityRide.destination_address.ilike(t_pat),
                    CommunityRide.university_name.ilike(t_pat),
                    CommunityRide.intermediate_stops.ilike(t_pat)
                )
            )

    # Order by departure time or newest
    rides = q.order_by(CommunityRide.created_at.desc()).limit(50).all()

    req_date_key = normalize_date_key(travel_date)

    # Enrich rides with creator verification, ratings & trip counts
    results = []
    for r in rides:
        creator = db.query(User).filter(User.id == r.creator_id).first()
        is_owner = current_user and current_user.id == r.creator_id

        # Verification status check
        driver_verified = False
        verification_label = "Unverified"
        rating = 4.9
        completed_trips = 8

        if creator:
            # Check passenger student verification
            if creator.passenger_profile:
                st_status = creator.passenger_profile.student_verification_status or "UNVERIFIED"
                if st_status in ("VERIFIED", "APPROVED"):
                    driver_verified = True
                    verification_label = "Student Verified"
                elif st_status == "PENDING":
                    verification_label = "Verification Pending"

            # Check driver KYC if user is a registered rider
            if creator.rider_profile:
                if creator.rider_profile.status == RiderApprovalStatus.APPROVED:
                    driver_verified = True
                    verification_label = "ID & License Verified"
                rating = creator.rider_profile.rating or 4.9
                completed_trips = creator.rider_profile.total_completed_trips or 8

        # Parse intermediate stops
        stops = []
        if r.intermediate_stops:
            try:
                stops = json.loads(r.intermediate_stops)
            except Exception:
                stops = [s.strip() for s in r.intermediate_stops.split(",") if s.strip()]

        # Mask phone number if viewer is not the host
        display_phone = r.creator_phone if is_owner else mask_phone_number(r.creator_phone)

        # Datewise daily seat calculation
        is_daily = bool(r.recurring_days and "DAILY" in r.recurring_days.upper())
        if is_daily:
            booked_for_date = db.query(func.coalesce(func.sum(CommunityRideBooking.seats_booked), 0)).filter(
                CommunityRideBooking.ride_id == r.id,
                CommunityRideBooking.status.in_(["CONFIRMED"]),
                or_(
                    CommunityRideBooking.travel_date == req_date_key,
                    CommunityRideBooking.travel_date == travel_date,
                    and_(
                        CommunityRideBooking.travel_date == None,
                        func.date(CommunityRideBooking.created_at) == req_date_key
                    )
                )
            ).scalar() or 0
            computed_avail = max(0, r.total_seats - booked_for_date)
            is_sold_out = bool(computed_avail <= 0)
        else:
            computed_avail = max(0, r.available_seats)
            is_sold_out = bool(computed_avail <= 0 or r.status in ("FULL", "SOLD_OUT"))

        results.append({
            "id": r.id,
            "creator_id": r.creator_id,
            "creator_name": r.creator_name,
            "creator_phone": display_phone,
            "is_owner": is_owner,
            "pickup_address": r.pickup_address,
            "pickup_latitude": r.pickup_latitude,
            "pickup_longitude": r.pickup_longitude,
            "destination_address": r.destination_address,
            "destination_latitude": r.destination_latitude,
            "destination_longitude": r.destination_longitude,
            "departure_time": r.departure_time,
            "departure_datetime": r.departure_datetime.isoformat() if r.departure_datetime else None,
            "price_per_seat": r.price_per_seat,
            "available_seats": computed_avail,
            "total_seats": r.total_seats,
            "vehicle_type": r.vehicle_type or "Car",
            "vehicle_info": r.vehicle_info or "Private Vehicle",
            "instant_booking": bool(r.instant_booking),
            "university_id": r.university_id,
            "campus_id": r.campus_id,
            "university_name": r.university_name,
            "category_type": r.category_type or "CAMPUS_TO_CITY",
            "gender_preference": r.poster_gender or "ANY",
            "is_daily": is_daily,
            "query_travel_date": travel_date or "Today",
            "intermediate_stops": stops,
            "recurring_days": r.recurring_days,
            "notes": r.notes,
            "driver_verified": driver_verified,
            "verification_label": verification_label,
            "rating": rating,
            "completed_trips": completed_trips,
            "status": "FULL" if is_sold_out else ("OPEN" if is_daily else r.status),
            "is_sold_out": is_sold_out,
        })

    return results


# ==========================================
# 3. POST A CAMPUS RIDE
# ==========================================

@router.post("", status_code=status.HTTP_201_CREATED)
def post_campus_ride(
    req: PostCampusRideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Post a new campus ride.
    Links to user's selected university and campus.
    Validates capacity, departure time, and price per seat.
    """
    if req.price_per_seat < 0:
        raise HTTPException(status_code=400, detail="Price per seat cannot be negative")
    if req.total_seats < 1 or req.total_seats > 8:
        raise HTTPException(status_code=400, detail="Total seats must be between 1 and 8")

    # Serialize intermediate stops if provided
    stops_json = None
    if req.intermediate_stops:
        stops_json = json.dumps(req.intermediate_stops)

    # University name resolution
    uni_name = req.university_name
    if not uni_name and req.university_id:
        uni = db.query(University).filter(University.id == req.university_id).first()
        if uni:
            uni_name = uni.name

    # Check if the posting user is a Campus Driver with restricted universities
    if current_user.rider_profile and current_user.rider_profile.rider_service_type == "CAMPUS":
        served_raw = current_user.rider_profile.served_universities or ""
        served_list = [u.strip().lower() for u in served_raw.split(",") if u.strip()]
        if served_list:
            route_text = f"{req.pickup_address} {req.destination_address} {uni_name or ''}".lower()
            if not any(u in route_text for u in served_list):
                raise HTTPException(
                    status_code=400,
                    detail=f"As a registered Campus Driver, your rides must serve your registered universities: {served_raw}. Please update your served universities in your driver profile if you wish to serve other campuses."
                )

    new_ride = CommunityRide(
        id=f"campus_ride_{str(uuid.uuid4())[:12]}",
        creator_id=current_user.id,
        creator_name=current_user.full_name or "Campus Host",
        creator_phone=current_user.phone_number,
        pickup_address=req.pickup_address,
        pickup_latitude=req.pickup_latitude,
        pickup_longitude=req.pickup_longitude,
        destination_address=req.destination_address,
        destination_latitude=req.destination_latitude,
        destination_longitude=req.destination_longitude,
        departure_time=req.departure_time,
        departure_datetime=req.departure_datetime,
        price_per_seat=req.price_per_seat,
        total_seats=req.total_seats,
        available_seats=req.total_seats,
        vehicle_type=req.vehicle_type,
        vehicle_info=req.vehicle_info,
        university_id=req.university_id,
        campus_id=req.campus_id,
        university_name=uni_name,
        category_type=req.category_type or "UNIVERSITY",
        poster_gender=(req.gender_preference or "ANY").upper(),
        intermediate_stops=stops_json,
        recurring_days="DAILY" if req.is_daily else req.recurring_days,
        return_trip_time=req.return_trip_time,
        notes=req.notes,
        instant_booking=1 if req.instant_booking else 0,
        status="OPEN"
    )

    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)

    # Check for matching passenger ride requests needing this route
    matched_requests = db.query(PassengerRideRequest).filter(
        PassengerRideRequest.status == "OPEN",
        or_(
            PassengerRideRequest.university_id == req.university_id,
            PassengerRideRequest.university_id == None
        )
    ).all()

    matched_count = 0
    p_lower = req.pickup_address.lower()
    d_lower = req.destination_address.lower()
    for pr in matched_requests:
        if pr.pickup_address.lower() in p_lower or p_lower in pr.pickup_address.lower():
            if pr.destination_address.lower() in d_lower or d_lower in pr.destination_address.lower():
                matched_count += 1

    logger.info(f"Campus ride created: {new_ride.id} by {current_user.phone_number} for {uni_name}. Matched passenger requests: {matched_count}")
    return {
        "success": True,
        "message": "Campus ride posted successfully! Fellow students can now discover and request seats.",
        "ride_id": new_ride.id,
        "available_seats": new_ride.available_seats,
        "status": new_ride.status,
        "matched_passenger_requests": matched_count
    }


# ==========================================
# 4. BOOK A CAMPUS RIDE (DRIVER APPROVAL FLOW)
# ==========================================

@router.post("/{ride_id}/book")
def book_campus_ride_seat(
    ride_id: str,
    req: BookCampusRideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Passenger books seats on a campus ride:
    - Verifies available capacity
    - Sets initial status to PENDING awaiting driver acceptance
    - Driver can accept or reject from My Posted dashboard
    """
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot book seats on your own ride")

    if ride.status not in ("OPEN",):
        raise HTTPException(status_code=400, detail=f"This ride is {ride.status.lower()} and no more seats can be requested")

    seats_to_book = req.seats_to_book
    is_daily = bool(ride.recurring_days and "DAILY" in ride.recurring_days.upper())
    norm_travel_date = normalize_date_key(req.travel_date)

    # 7-day max advance booking rule
    try:
        target_dt = datetime.strptime(norm_travel_date[:10], "%Y-%m-%d").date()
        today_dt = datetime.now().date()
        diff_days = (target_dt - today_dt).days
        if diff_days < 0:
            raise HTTPException(status_code=400, detail="Cannot book a ride for a past date (बीती हुई तारीख के लिए बुकिंग संभव नहीं है).")
        if diff_days > 7:
            raise HTTPException(
                status_code=400,
                detail="Booking is allowed for up to 7 days in advance only (अधिकतम 7 दिन आगे की ही बुकिंग संभव है)."
            )
    except ValueError:
        pass

    if is_daily:
        booked_for_date = db.query(func.coalesce(func.sum(CommunityRideBooking.seats_booked), 0)).filter(
            CommunityRideBooking.ride_id == ride_id,
            CommunityRideBooking.status.in_(["CONFIRMED"]),
            or_(
                CommunityRideBooking.travel_date == norm_travel_date,
                CommunityRideBooking.travel_date == req.travel_date,
                and_(
                    CommunityRideBooking.travel_date == None,
                    func.date(CommunityRideBooking.created_at) == norm_travel_date
                )
            )
        ).scalar() or 0
        date_avail = max(0, ride.total_seats - booked_for_date)
        if date_avail < seats_to_book:
            raise HTTPException(
                status_code=400,
                detail=f"केवल {date_avail} सीटें उपलब्ध हैं। आप {seats_to_book} सीटें बुक नहीं कर सकते (Only {date_avail} seat(s) available on this date)."
            )
    else:
        if ride.available_seats < seats_to_book:
            raise HTTPException(
                status_code=400,
                detail=f"केवल {ride.available_seats} सीटें उपलब्ध हैं। आप {seats_to_book} सीटें बुक नहीं कर सकते (Only {ride.available_seats} seat(s) available)."
            )

    # Check existing active booking on this date
    existing = db.query(CommunityRideBooking).filter(
        CommunityRideBooking.ride_id == ride_id,
        CommunityRideBooking.passenger_id == current_user.id,
        CommunityRideBooking.status.in_(["CONFIRMED", "PENDING"]),
        or_(
            CommunityRideBooking.travel_date == norm_travel_date,
            CommunityRideBooking.travel_date == req.travel_date,
            CommunityRideBooking.travel_date == None
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active or pending booking for this date")

    total_amount = round(ride.price_per_seat * seats_to_book, 2)
    booking_status = "PENDING"  # Always pending driver acceptance

    booking = CommunityRideBooking(
        id=f"camp_bk_{str(uuid.uuid4())[:12]}",
        ride_id=ride_id,
        passenger_id=current_user.id,
        passenger_name=current_user.full_name or "Student Passenger",
        passenger_phone=current_user.phone_number,
        seats_booked=seats_to_book,
        travel_date=norm_travel_date,
        price_per_seat=ride.price_per_seat,
        total_price=total_amount,
        pickup_notes=req.pickup_notes,
        passenger_pickup_lat=req.passenger_pickup_lat,
        passenger_pickup_lng=req.passenger_pickup_lng,
        status=booking_status
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return {
        "success": True,
        "booking_id": booking.id,
        "ride_id": ride_id,
        "seats_booked": seats_to_book,
        "travel_date": norm_travel_date,
        "total_fare": total_amount,
        "status": booking_status,
        "message": "Booking request sent to driver! Once accepted, your seat is confirmed and driver contact details will unlock."
    }


@router.post("/bookings/{booking_id}/accept")
def accept_campus_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Driver accepts an incoming seat booking request:
    - For daily recurring rides, validates capacity on that specific travel date
    - For one-time rides, atomically reduces available seats and marks FULL when 0
    - Sets booking status to CONFIRMED
    - Unlocks driver contact & chat for the passenger
    """
    booking = db.query(CommunityRideBooking).filter(CommunityRideBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found")

    ride = db.query(CommunityRide).filter(CommunityRide.id == booking.ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host who posted this ride can accept bookings")

    # Campus driver university validation
    if current_user.rider_profile and current_user.rider_profile.rider_service_type == "CAMPUS":
        served_raw = current_user.rider_profile.served_universities or ""
        served_list = [u.strip().lower() for u in served_raw.split(",") if u.strip()]
        if served_list:
            route_text = f"{ride.pickup_address} {ride.destination_address} {ride.university_name or ''}".lower()
            if not any(u in route_text for u in served_list):
                raise HTTPException(
                    status_code=403,
                    detail=f"As a registered Campus Driver, you can only accept bookings for your registered universities: {served_raw}."
                )

    if booking.status == "CONFIRMED":
        return {"success": True, "message": "Booking is already confirmed", "status": "CONFIRMED"}

    is_daily = bool(ride.recurring_days and "DAILY" in ride.recurring_days.upper())
    if is_daily:
        norm_date = normalize_date_key(booking.travel_date)
        booked_for_date = db.query(func.coalesce(func.sum(CommunityRideBooking.seats_booked), 0)).filter(
            CommunityRideBooking.ride_id == ride.id,
            CommunityRideBooking.status.in_(["CONFIRMED"]),
            or_(
                CommunityRideBooking.travel_date == norm_date,
                CommunityRideBooking.travel_date == booking.travel_date,
                and_(
                    CommunityRideBooking.travel_date == None,
                    func.date(CommunityRideBooking.created_at) == norm_date
                )
            )
        ).scalar() or 0
        remaining_on_date = max(0, ride.total_seats - booked_for_date)
        if remaining_on_date < booking.seats_booked:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot accept! On {booking.travel_date or 'this date'}, only {remaining_on_date} seat(s) remain."
            )
        booking.status = "CONFIRMED"
        db.commit()
        return {
            "success": True,
            "message": f"Booking accepted! {booking.passenger_name}'s seat is confirmed for {booking.travel_date or 'ride'}.",
            "status": "CONFIRMED",
            "available_seats": max(0, remaining_on_date - booking.seats_booked)
        }
    else:
        if ride.available_seats < booking.seats_booked:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot accept! Only {ride.available_seats} seats remaining, but passenger requested {booking.seats_booked} seats."
            )
        ride.available_seats -= booking.seats_booked
        if ride.available_seats <= 0:
            ride.status = "FULL"
        booking.status = "CONFIRMED"
        db.commit()
        return {
            "success": True,
            "message": f"Booking accepted! {booking.passenger_name}'s seat is confirmed.",
            "status": "CONFIRMED",
            "available_seats": ride.available_seats
        }


@router.post("/bookings/{booking_id}/reject")
def reject_campus_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Driver rejects a seat booking request."""
    booking = db.query(CommunityRideBooking).filter(CommunityRideBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found")

    ride = db.query(CommunityRide).filter(CommunityRide.id == booking.ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host who posted this ride can reject bookings")

    is_daily = bool(ride.recurring_days and "DAILY" in ride.recurring_days.upper())
    # If it was confirmed previously and not daily, restore seats
    if booking.status == "CONFIRMED" and not is_daily:
        ride.available_seats += booking.seats_booked
        if ride.status == "FULL" and ride.available_seats > 0:
            ride.status = "OPEN"

    booking.status = "REJECTED"
    db.commit()

    return {
        "success": True,
        "message": "Booking request has been rejected.",
        "status": "REJECTED"
    }


@router.post("/bookings/{booking_id}/cancel")
def cancel_campus_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Passenger cancels their booking."""
    booking = db.query(CommunityRideBooking).filter(
        CommunityRideBooking.id == booking_id,
        CommunityRideBooking.passenger_id == current_user.id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or unauthorized")

    ride = db.query(CommunityRide).filter(CommunityRide.id == booking.ride_id).first()
    is_daily = bool(ride and ride.recurring_days and "DAILY" in ride.recurring_days.upper())
    if booking.status == "CONFIRMED" and ride and not is_daily:
        ride.available_seats += booking.seats_booked
        if ride.status == "FULL" and ride.available_seats > 0:
            ride.status = "OPEN"

    booking.status = "CANCELLED"
    db.commit()

    return {"success": True, "message": "Booking reservation cancelled", "status": "CANCELLED"}


# ==========================================
# 5. MY BOOKINGS & POSTED RIDES
# ==========================================

@router.get("/my-bookings")
def get_my_campus_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all campus ride bookings made by the current user with full details.
    Driver phone and chat are unlocked ONLY when status is CONFIRMED.
    """
    bookings = db.query(CommunityRideBooking).filter(
        CommunityRideBooking.passenger_id == current_user.id
    ).order_by(CommunityRideBooking.created_at.desc()).all()

    output = []
    for b in bookings:
        ride = db.query(CommunityRide).filter(CommunityRide.id == b.ride_id).first()

        # Phone unlocked only when CONFIRMED
        if b.status == "CONFIRMED" and ride:
            driver_phone = ride.creator_phone
            can_contact = True
        elif b.status == "PENDING" and ride:
            driver_phone = mask_phone_number(ride.creator_phone)
            can_contact = False
        else:
            driver_phone = ""
            can_contact = False

        stops = []
        if ride and ride.intermediate_stops:
            try:
                stops = json.loads(ride.intermediate_stops)
            except Exception:
                stops = [s.strip() for s in ride.intermediate_stops.split(",") if s.strip()]

        output.append({
            "booking_id": b.id,
            "ride_id": b.ride_id,
            "status": b.status,  # PENDING, CONFIRMED, REJECTED, CANCELLED
            "seats_booked": b.seats_booked,
            "travel_date": b.travel_date or "Today",
            "price_per_seat": b.price_per_seat or (ride.price_per_seat if ride else 0.0),
            "total_fare": b.total_price,
            "pickup_notes": b.pickup_notes,
            "can_contact_driver": can_contact,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "ride": {
                "pickup_address": ride.pickup_address if ride else "Unknown",
                "destination_address": ride.destination_address if ride else "Unknown",
                "departure_time": ride.departure_time if ride else "",
                "departure_datetime": ride.departure_datetime.isoformat() if ride and ride.departure_datetime else None,
                "vehicle_type": ride.vehicle_type if ride else "Car",
                "vehicle_info": ride.vehicle_info if ride else "Vehicle",
                "driver_name": ride.creator_name if ride else "Host",
                "driver_phone": driver_phone,
                "university_name": ride.university_name if ride else None,
                "category_type": ride.category_type if ride else "CAMPUS_TO_CITY",
                "gender_preference": ride.poster_gender if ride else "ANY",
                "is_daily": bool(ride and ride.recurring_days and "DAILY" in ride.recurring_days.upper()),
                "intermediate_stops": stops,
                "notes": ride.notes if ride else None,
                "status": ride.status if ride else "UNKNOWN"
            } if ride else None
        })
    return output


@router.get("/my-posted")
def get_my_posted_campus_rides(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all campus rides posted by the current user.
    Includes booking requests with Accept/Reject actions.
    """
    rides = db.query(CommunityRide).filter(
        CommunityRide.creator_id == current_user.id
    ).order_by(CommunityRide.created_at.desc()).all()

    now_val = datetime.now()
    output = []
    for r in rides:
        bookings_data = []
        for b in r.bookings:
            bookings_data.append({
                "booking_id": b.id,
                "passenger_name": b.passenger_name,
                "passenger_phone": b.passenger_phone,
                "seats_booked": b.seats_booked,
                "travel_date": b.travel_date or "Today",
                "total_fare": b.total_price,
                "pickup_notes": b.pickup_notes,
                "status": b.status,  # PENDING, CONFIRMED, REJECTED
                "created_at": b.created_at.isoformat() if b.created_at else None
            })

        is_daily = bool(r.recurring_days and "DAILY" in r.recurring_days.upper())
        is_sold_out = bool(r.available_seats <= 0 or r.status == "FULL")
        is_expired = bool(not is_daily and r.departure_datetime and r.departure_datetime < now_val - timedelta(minutes=30))

        stops = []
        if r.intermediate_stops:
            try:
                stops = json.loads(r.intermediate_stops)
            except Exception:
                stops = [s.strip() for s in r.intermediate_stops.split(",") if s.strip()]

        output.append({
            "id": r.id,
            "pickup_address": r.pickup_address,
            "destination_address": r.destination_address,
            "departure_time": r.departure_time,
            "departure_datetime": r.departure_datetime.isoformat() if r.departure_datetime else None,
            "price_per_seat": r.price_per_seat,
            "available_seats": r.available_seats,
            "total_seats": r.total_seats,
            "vehicle_type": r.vehicle_type or "Car",
            "vehicle_info": r.vehicle_info or "Private Vehicle",
            "category_type": r.category_type or "CAMPUS_TO_CITY",
            "gender_preference": r.poster_gender or "ANY",
            "is_daily": is_daily,
            "intermediate_stops": stops,
            "status": "FULL" if is_sold_out else r.status,
            "is_sold_out": is_sold_out,
            "is_expired": is_expired,
            "university_name": r.university_name,
            "bookings": bookings_data,
            "pending_requests_count": sum(1 for b in r.bookings if b.status == "PENDING"),
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return output


# ==========================================
# 6. PASSENGER RIDE REQUESTS (यात्रियों की मांग)
# ==========================================

@router.get("/passenger-requests")
def list_passenger_ride_requests(
    university_id: Optional[str] = None,
    campus_id: Optional[str] = None,
    travel_date: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """List open ride requests posted by passengers who need a ride."""
    q = db.query(PassengerRideRequest).filter(PassengerRideRequest.status == "OPEN")

    if university_id:
        q = q.filter(
            or_(
                PassengerRideRequest.university_id == university_id,
                PassengerRideRequest.university_id == None
            )
        )
    if campus_id:
        q = q.filter(
            or_(
                PassengerRideRequest.campus_id == campus_id,
                PassengerRideRequest.campus_id == None
            )
        )
    if travel_date and travel_date.lower() not in ("all", "any"):
        q = q.filter(PassengerRideRequest.travel_date.ilike(f"%{travel_date}%"))

    requests = q.order_by(PassengerRideRequest.created_at.desc()).limit(40).all()
    results = []
    for r in requests:
        is_my_req = current_user and current_user.id == r.user_id
        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "passenger_name": r.passenger_name,
            "passenger_phone": r.passenger_phone if is_my_req else mask_phone_number(r.passenger_phone),
            "is_mine": is_my_req,
            "pickup_address": r.pickup_address,
            "destination_address": r.destination_address,
            "travel_date": r.travel_date,
            "preferred_time": r.preferred_time,
            "passengers_count": r.passengers_count,
            "max_budget_per_seat": r.max_budget_per_seat,
            "notes": r.notes,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return results


@router.post("/passenger-requests", status_code=status.HTTP_201_CREATED)
def create_passenger_ride_request(
    req: PassengerRideRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Passenger posts a 'Need a Ride' request."""
    new_req = PassengerRideRequest(
        id=f"pass_req_{str(uuid.uuid4())[:12]}",
        user_id=current_user.id,
        passenger_name=current_user.full_name or "Student Passenger",
        passenger_phone=current_user.phone_number,
        university_id=req.university_id,
        campus_id=req.campus_id,
        pickup_address=req.pickup_address.strip(),
        destination_address=req.destination_address.strip(),
        travel_date=req.travel_date.strip(),
        preferred_time=req.preferred_time.strip(),
        passengers_count=req.passengers_count,
        max_budget_per_seat=req.max_budget_per_seat,
        notes=req.notes.strip() if req.notes else None,
        status="OPEN"
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    return {
        "success": True,
        "message": "Ride request posted! Drivers heading your way will see your request.",
        "request_id": new_req.id
    }


@router.delete("/passenger-requests/{request_id}")
def delete_passenger_ride_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Passenger cancels their ride request."""
    req = db.query(PassengerRideRequest).filter(
        PassengerRideRequest.id == request_id,
        PassengerRideRequest.user_id == current_user.id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Ride request not found or unauthorized")

    db.delete(req)
    db.commit()
    return {"success": True, "message": "Ride request removed"}


# ==========================================
# 6. RIDE ALERTS
# ==========================================

@router.get("/alerts")
def get_my_ride_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get active and paused ride alerts for current user."""
    alerts = db.query(CampusRideAlert).filter(
        CampusRideAlert.user_id == current_user.id
    ).order_by(CampusRideAlert.created_at.desc()).all()

    return [
        {
            "id": a.id,
            "university_id": a.university_id,
            "campus_id": a.campus_id,
            "pickup_text": a.pickup_text,
            "destination_text": a.destination_text,
            "travel_date": a.travel_date,
            "preferred_time_window": a.preferred_time_window,
            "seats_needed": a.seats_needed,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in alerts
    ]


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
def create_ride_alert(
    req: CreateAlertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new route alert to get notified when compatible rides are posted."""
    alert = CampusRideAlert(
        id=f"alert_{str(uuid.uuid4())[:12]}",
        user_id=current_user.id,
        university_id=req.university_id,
        campus_id=req.campus_id,
        pickup_text=req.pickup_text,
        destination_text=req.destination_text,
        travel_date=req.travel_date or "Today",
        preferred_time_window=req.preferred_time_window or "ANY",
        seats_needed=req.seats_needed or 1,
        is_active=True
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "success": True,
        "message": "Ride alert created! We'll notify you as soon as someone posts a compatible ride.",
        "alert_id": alert.id
    }


@router.patch("/alerts/{alert_id}")
def toggle_ride_alert(
    alert_id: str,
    active: bool = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pause or resume a ride alert."""
    alert = db.query(CampusRideAlert).filter(
        CampusRideAlert.id == alert_id,
        CampusRideAlert.user_id == current_user.id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = active
    db.commit()
    return {"success": True, "alert_id": alert.id, "is_active": alert.is_active}


@router.delete("/alerts/{alert_id}")
def delete_ride_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a ride alert."""
    alert = db.query(CampusRideAlert).filter(
        CampusRideAlert.id == alert_id,
        CampusRideAlert.user_id == current_user.id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()
    return {"success": True, "message": "Alert deleted"}


# ==========================================
# 7. STUDENT PROFILE & VERIFICATION
# ==========================================

@router.get("/student-profile")
def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current student profile and verification status."""
    profile = current_user.passenger_profile
    if not profile:
        profile = PassengerProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    uni = db.query(University).filter(University.id == profile.university_id).first() if profile.university_id else None
    campus = db.query(Campus).filter(Campus.id == profile.campus_id).first() if profile.campus_id else None

    return {
        "user_id": current_user.id,
        "full_name": current_user.full_name,
        "phone_number": current_user.phone_number,
        "university_id": profile.university_id,
        "university_name": uni.name if uni else None,
        "campus_id": profile.campus_id,
        "campus_name": campus.name if campus else None,
        "student_id_number": profile.student_id_number,
        "student_status": profile.student_status or "STUDENT",
        "student_verification_status": profile.student_verification_status or "UNVERIFIED",
        "college_department": profile.college_department
    }


@router.post("/student-profile")
def update_student_profile(
    req: StudentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update student profile and trigger verification review."""
    profile = current_user.passenger_profile
    if not profile:
        profile = PassengerProfile(user_id=current_user.id)
        db.add(profile)

    if req.university_id is not None:
        profile.university_id = req.university_id
    if req.campus_id is not None:
        profile.campus_id = req.campus_id
    if req.student_id_number is not None:
        profile.student_id_number = req.student_id_number.strip()
    if req.student_id_photo is not None:
        profile.student_id_photo = req.student_id_photo
    if req.student_status is not None:
        profile.student_status = req.student_status
    if req.college_department is not None:
        profile.college_department = req.college_department.strip()

    # If student provided ID number, mark as VERIFIED for instant access (or PENDING in strict mode)
    if profile.student_id_number:
        profile.student_verification_status = "VERIFIED"

    db.commit()
    db.refresh(profile)

    return {
        "success": True,
        "message": "Student profile updated successfully",
        "verification_status": profile.student_verification_status
    }
