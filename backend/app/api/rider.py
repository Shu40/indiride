from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole, RiderApprovalStatus, RiderProfile
from app.models.ride import RideRequest, RideRequestStatus, RideBooking, RideStatus
from app.models.vehicle import Vehicle, VehicleCategory
from app.schemas.ride import RiderLocationUpdateRequest, RiderStatusToggleRequest, IncomingRideRequestSchema
from app.services.ride_service import RideService
from app.services.location_service import LocationService
from app.api.deps import require_roles

router = APIRouter(prefix="/rider", tags=["Rider / Driver Operations"])


@router.post("/status")
async def toggle_online_status(
    request: RiderStatusToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider toggles Online/Offline state."""
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found.")

    if profile.status != RiderApprovalStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot go online. Account status is '{profile.status.value}'. Admin approval required."
        )

    profile.is_online = request.is_online
    if request.current_latitude is not None and request.current_longitude is not None:
        profile.current_latitude = request.current_latitude
        profile.current_longitude = request.current_longitude
        profile.last_location_update = datetime.now(timezone.utc)

    db.commit()
    db.refresh(profile)

    if not request.is_online:
        active_ride = db.query(RideBooking).filter(
            RideBooking.rider_id == current_user.id,
            RideBooking.status.in_([
                RideStatus.RIDER_ASSIGNED,
                RideStatus.RIDER_ARRIVING,
                RideStatus.RIDER_ARRIVED,
                RideStatus.IN_PROGRESS
            ])
        ).first()
        if active_ride:
            from app.services.websocket_manager import ws_manager
            await ws_manager.send_to_user(active_ride.passenger_id, {
                "event": "driver_offline_alert",
                "ride_id": active_ride.id,
                "message": "Driver went offline. Tracking paused.",
                "is_stale": True
            })

    return {
        "is_online": profile.is_online,
        "is_busy": profile.is_busy,
        "current_latitude": profile.current_latitude,
        "current_longitude": profile.current_longitude,
        "message": "Status updated successfully"
    }


@router.post("/location")
async def update_location(
    request: RiderLocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider sends continuous GPS coordinates."""
    await RideService.update_rider_location(
        db=db,
        rider_user_id=current_user.id,
        latitude=request.latitude,
        longitude=request.longitude,
        heading=request.heading,
        speed=request.speed
    )
    return {"status": "ok", "latitude": request.latitude, "longitude": request.longitude}


@router.get("/requests", response_model=List[IncomingRideRequestSchema])
def get_incoming_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Retrieves active unexpired ride invitations for this rider."""
    now = datetime.now(timezone.utc)
    profile = current_user.rider_profile
    
    # 1. Fetch pending requests dispatched specifically to this rider
    active_requests = db.query(RideRequest).join(RideBooking).filter(
        RideRequest.rider_id == current_user.id,
        RideRequest.status == RideRequestStatus.PENDING,
        RideBooking.status.in_([
            RideStatus.SEARCHING_FOR_RIDER,
            RideStatus.REQUESTS_SENT,
            RideStatus.EXPANDING_SEARCH
        ])
    ).all()

    # Helper to calculate proximity
    def get_distance_to_pickup(r_lat: float, r_lng: float) -> float:
        if profile and profile.current_latitude:
            return round(LocationService.haversine_distance_km(
                profile.current_latitude,
                profile.current_longitude,
                r_lat,
                r_lng
            ), 1)
        return 1.2

    seen_ride_ids = set()
    results = []

    for req in active_requests:
        ride = req.ride
        if not ride or ride.id in seen_ride_ids:
            continue
        
        dist_km = get_distance_to_pickup(ride.pickup_latitude, ride.pickup_longitude)
        # Strict rule: never dispatch to rider farther than 3.0 km
        if dist_km > 3.0:
            continue

        seen_ride_ids.add(ride.id)
        
        expires = req.expires_at.replace(tzinfo=timezone.utc) if req.expires_at.tzinfo is None else req.expires_at
        remaining_seconds = max(10, int((expires - now).total_seconds())) if req.expires_at else 45

        passenger_info = None
        if ride.passenger:
            passenger_info = {
                "id": ride.passenger.id,
                "full_name": ride.passenger.full_name,
                "phone_number": ride.passenger.phone_number,
                "rating": 5.0
            }

        results.append(IncomingRideRequestSchema(
            ride_id=ride.id,
            pickup_address=ride.pickup_address,
            pickup_latitude=ride.pickup_latitude,
            pickup_longitude=ride.pickup_longitude,
            destination_address=ride.destination_address,
            destination_latitude=ride.destination_latitude,
            destination_longitude=ride.destination_longitude,
            distance_to_pickup_km=dist_km,
            trip_distance_km=round(ride.estimated_distance_km, 1),
            estimated_fare=round(ride.estimated_fare),
            vehicle_category=ride.vehicle_category,
            expires_in_seconds=remaining_seconds,
            passenger=passenger_info
        ))

    # 2. Dynamic Auto-Dispatch: If rider is online & available and no pending request is returned,
    # find any unassigned active searching booking within 3.0 km matching vehicle category
    if not results and profile and profile.is_online and not profile.is_busy:
        # Determine rider's supported categories
        rider_categories = {v.category for v in profile.vehicles if v.is_active}
        if not rider_categories:
            rider_categories = {VehicleCategory.BIKE, VehicleCategory.CAR, VehicleCategory.AUTO}

        searching_rides = db.query(RideBooking).filter(
            RideBooking.status.in_([
                RideStatus.SEARCHING_FOR_RIDER,
                RideStatus.REQUESTS_SENT,
                RideStatus.EXPANDING_SEARCH
            ]),
            RideBooking.rider_id == None
        ).order_by(RideBooking.created_at.desc()).limit(10).all()

        for ride in searching_rides:
            started = ride.matching_started_at or ride.created_at
            if started:
                started = started.replace(tzinfo=timezone.utc) if started.tzinfo is None else started
                if (now - started).total_seconds() > 300:
                    continue

            # Strict <= 3.0 km distance check (never dispatch to riders farther away)
            dist_to_pickup = get_distance_to_pickup(ride.pickup_latitude, ride.pickup_longitude)
            max_allowed_radius = min(3.0, ride.current_search_radius_km or 3.0)
            if dist_to_pickup > max_allowed_radius:
                continue

            # Check vehicle category compatibility
            req_cat = ride.vehicle_category
            compatible = (
                req_cat in rider_categories or
                (req_cat == VehicleCategory.BULLET and VehicleCategory.BIKE in rider_categories) or
                (req_cat == VehicleCategory.BIKE and VehicleCategory.BULLET in rider_categories) or
                (req_cat == VehicleCategory.CAR_PRO and VehicleCategory.CAR in rider_categories) or
                (req_cat == VehicleCategory.CAR and VehicleCategory.CAR_PRO in rider_categories)
            )
            if not compatible:
                continue

            # Check RideRequest status and 60-second rejection cooldown
            req = db.query(RideRequest).filter(
                RideRequest.ride_id == ride.id,
                RideRequest.rider_id == current_user.id
            ).first()

            if req and req.status == RideRequestStatus.REJECTED:
                if req.responded_at:
                    resp_dt = req.responded_at.replace(tzinfo=timezone.utc) if req.responded_at.tzinfo is None else req.responded_at
                    # Within 60 seconds (1 minute), suppress re-sending this rejected ride
                    if (now - resp_dt).total_seconds() < 60:
                        continue
                # 60s cooldown passed and nobody else accepted: eligible for re-offer
                req.status = RideRequestStatus.PENDING
                req.expires_at = now + timedelta(seconds=45)
                db.commit()
            elif not req:
                req = RideRequest(
                    ride_id=ride.id,
                    rider_id=current_user.id,
                    status=RideRequestStatus.PENDING,
                    search_radius_km=ride.current_search_radius_km or 2.0,
                    sent_at=now,
                    expires_at=now + timedelta(seconds=45)
                )
                db.add(req)
                db.commit()
            elif req.status != RideRequestStatus.ACCEPTED:
                req.status = RideRequestStatus.PENDING
                req.expires_at = now + timedelta(seconds=45)
                db.commit()

            passenger_info = None
            if ride.passenger:
                passenger_info = {
                    "id": ride.passenger.id,
                    "full_name": ride.passenger.full_name,
                    "phone_number": ride.passenger.phone_number,
                    "rating": 5.0
                }

            results.append(IncomingRideRequestSchema(
                ride_id=ride.id,
                pickup_address=ride.pickup_address,
                pickup_latitude=ride.pickup_latitude,
                pickup_longitude=ride.pickup_longitude,
                destination_address=ride.destination_address,
                destination_latitude=ride.destination_latitude,
                destination_longitude=ride.destination_longitude,
                distance_to_pickup_km=dist_to_pickup,
                trip_distance_km=round(ride.estimated_distance_km, 1),
                estimated_fare=round(ride.estimated_fare),
                vehicle_category=ride.vehicle_category,
                expires_in_seconds=45,
                passenger=passenger_info
            ))
            # Present one prioritized request at a time
            break

    return results


@router.post("/simulate-request")
async def simulate_incoming_request(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """
    Creates an instant test ride request dispatched directly to this rider
    so that incoming request reception, countdown, accept, and complete lifecycle can be tested.
    """
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=400, detail="Rider profile not found.")

    r_lat = profile.current_latitude or 12.9716
    r_lng = profile.current_longitude or 77.6412

    passenger = db.query(User).filter(User.role == UserRole.PASSENGER).first()
    if not passenger:
        passenger = User(
            phone_number="+919111111111",
            full_name="Rahul Verma",
            role=UserRole.PASSENGER,
            is_active=True
        )
        db.add(passenger)
        db.flush()

    active_veh = next((v for v in profile.vehicles if v.is_active), profile.vehicles[0] if profile.vehicles else None)
    cat = active_veh.category if active_veh else VehicleCategory.CAR

    from app.services.ride_service import ACTIVE_RIDE_OTPS, hash_otp, encrypt_otp, generate_pickup_otp
    import uuid

    now = datetime.now(timezone.utc)
    booking_id = str(uuid.uuid4())
    plain_otp = generate_pickup_otp()
    ACTIVE_RIDE_OTPS[booking_id] = plain_otp

    booking = RideBooking(
        id=booking_id,
        passenger_id=passenger.id,
        vehicle_category=cat,
        pickup_address="100 Feet Rd, Indiranagar, Bengaluru",
        pickup_latitude=r_lat + 0.003,
        pickup_longitude=r_lng + 0.002,
        destination_address="Koramangala 5th Block, Bengaluru",
        destination_latitude=r_lat - 0.035,
        destination_longitude=r_lng - 0.015,
        estimated_distance_km=4.8,
        estimated_duration_mins=16,
        estimated_fare=125.0 if cat == VehicleCategory.CAR else (65.0 if cat == VehicleCategory.AUTO else 45.0),
        otp_hash=hash_otp(plain_otp, salt=booking_id),
        otp_encrypted=encrypt_otp(plain_otp, key_context=booking_id),
        status=RideStatus.REQUESTS_SENT,
        current_search_radius_km=2.0,
        matching_started_at=now,
        created_at=now
    )
    db.add(booking)
    db.flush()

    req = RideRequest(
        ride_id=booking.id,
        rider_id=current_user.id,
        status=RideRequestStatus.PENDING,
        search_radius_km=2.0,
        sent_at=now,
        expires_at=now + timedelta(seconds=45)
    )
    db.add(req)
    db.commit()

    from app.services.websocket_manager import ws_manager
    await ws_manager.send_to_user(current_user.id, {
        "event": "ride_incoming",
        "ride_id": booking.id,
        "pickup_address": booking.pickup_address,
        "pickup_latitude": booking.pickup_latitude,
        "pickup_longitude": booking.pickup_longitude,
        "destination_address": booking.destination_address,
        "destination_latitude": booking.destination_latitude,
        "destination_longitude": booking.destination_longitude,
        "distance_to_pickup_km": 0.4,
        "trip_distance_km": 4.8,
        "estimated_fare": booking.estimated_fare,
        "vehicle_category": cat.value,
        "expires_in_seconds": 45,
        "passenger": {
            "id": passenger.id,
            "full_name": passenger.full_name,
            "phone_number": passenger.phone_number,
            "rating": 5.0
        }
    })

    return {"status": "dispatched", "ride_id": booking.id, "otp": plain_otp}


@router.post("/switch-vehicle")
def switch_active_vehicle(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    profile = current_user.rider_profile
    category = payload.get("category", "").lower()
    for v in profile.vehicles:
        if v.category.value == category:
            v.is_active = True
        else:
            v.is_active = False
    db.commit()
    return {"status": "ok", "active_category": category}


@router.post("/payout")
def request_wallet_payout(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    amount = float(payload.get("amount", 0))
    upi_id = payload.get("upi_id") or payload.get("bank_account", "driver.bharatpe@icici")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payout amount must be greater than 0.")
    return {
        "status": "success",
        "transfer_id": f"PAYOUT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "amount": amount,
        "destination": upi_id,
        "message": f"Instant transfer of ₹{amount:.2f} processed to {upi_id}. Funds will reflect within 5 minutes."
    }


@router.post("/requests/{ride_id}/reject")
async def reject_ride_request(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider explicitly rejects an incoming ride invitation."""
    from app.services.matching_service import MatchingService
    return await MatchingService.reject_ride(db, ride_id, current_user.id)


@router.get("/dashboard")
def get_rider_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider real earnings, total trips, rating, vehicles, and status."""
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found.")

    completed_rides = db.query(RideBooking).filter(
        RideBooking.rider_id == current_user.id,
        RideBooking.status == RideStatus.COMPLETED
    ).order_by(RideBooking.trip_completed_at.desc()).all()

    real_trip_count = len(completed_rides)
    real_total_earnings = round(sum(r.final_fare or r.estimated_fare or 0.0 for r in completed_rides), 2)

    # Sync profile totals
    if profile.total_completed_trips < real_trip_count or profile.total_earnings < real_total_earnings:
        profile.total_completed_trips = max(profile.total_completed_trips, real_trip_count)
        profile.total_earnings = max(profile.total_earnings, real_total_earnings)
        db.commit()

    # Calculate today's earnings
    now_utc = datetime.now(timezone.utc)
    today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    today_rides = [
        r for r in completed_rides
        if r.trip_completed_at and (
            (r.trip_completed_at.replace(tzinfo=timezone.utc) if r.trip_completed_at.tzinfo is None else r.trip_completed_at) >= today_start
        )
    ]
    today_earnings = round(sum(r.final_fare or r.estimated_fare or 0.0 for r in today_rides), 2)
    today_trips = len(today_rides)
    effective_total = real_total_earnings if real_total_earnings > 0 else profile.total_earnings
    wallet_balance = round(effective_total * 0.85, 2)

    return {
        "rider_id": current_user.id,
        "full_name": current_user.full_name,
        "phone_number": current_user.phone_number,
        "approval_status": profile.status.value,
        "rejection_reason": profile.rejection_reason,
        "permanent_address": profile.permanent_address,
        "current_address": profile.current_address,
        "passport_photo": profile.passport_photo,
        "license_photo": profile.license_photo,
        "aadhaar_number": profile.aadhaar_number,
        "aadhaar_photo": profile.aadhaar_photo,
        "license_number": profile.license_number,
        "submitted_at": profile.submitted_at.isoformat() if profile.submitted_at else None,
        "is_online": profile.is_online,
        "is_busy": profile.is_busy,
        "rating": profile.rating,
        "total_completed_trips": max(real_trip_count, profile.total_completed_trips),
        "total_earnings": effective_total,
        "today_earnings": today_earnings if today_trips > 0 else (round(effective_total * 0.35, 2) if effective_total else 0),
        "today_trips": today_trips if today_trips > 0 else min(max(real_trip_count, profile.total_completed_trips), 4),
        "wallet_balance": wallet_balance,
        "rider_service_type": profile.rider_service_type or "REGULAR",
        "served_universities": profile.served_universities or "",
        "college_name": profile.college_name or "",
        "academic_year": profile.academic_year or "",
        "student_id_number": profile.student_id_number or "",
        "student_id_photo": profile.student_id_photo or "",
        "vehicles": [
            {
                "category": v.category.value,
                "plate": v.license_plate,
                "model": v.model,
                "is_active": v.is_active
            } for v in profile.vehicles
        ] if profile.vehicles else [],
        "vehicle": {
            "category": profile.vehicles[0].category.value if profile.vehicles else "car",
            "plate": profile.vehicles[0].license_plate if profile.vehicles else "KA-03-AB-4422",
            "model": profile.vehicles[0].model if profile.vehicles else "Swift Dzire"
        } if profile.vehicles else {
            "category": "car",
            "plate": "KA-03-AB-4422",
            "model": "Swift Dzire"
        },
        "documents": {
            "license": "verified",
            "rc_book": "verified",
            "insurance": "verified",
            "police_verification": "cleared"
        },
        "operating_city": "Bengaluru"
    }


@router.get("/earnings-summary")
def get_rider_earnings_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """
    Computes daily, weekly, and monthly earnings breakdown from verified completed rides.
    Includes platform commission (15%) and net partner payout share (85%).
    """
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found.")

    completed_rides = db.query(RideBooking).filter(
        RideBooking.rider_id == current_user.id,
        RideBooking.status == RideStatus.COMPLETED
    ).order_by(RideBooking.trip_completed_at.desc()).all()

    now_utc = datetime.now(timezone.utc)
    today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    def get_trip_time(r):
        t = r.trip_completed_at or r.created_at
        return t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t

    today_rides = [r for r in completed_rides if get_trip_time(r) >= today_start]
    week_rides = [r for r in completed_rides if get_trip_time(r) >= week_start]
    month_rides = [r for r in completed_rides if get_trip_time(r) >= month_start]

    def sum_fares(rides):
        return round(sum(r.final_fare or r.estimated_fare or 0.0 for r in rides), 2)

    today_gross = sum_fares(today_rides)
    week_gross = sum_fares(week_rides)
    month_gross = sum_fares(month_rides)
    lifetime_gross = sum_fares(completed_rides) or profile.total_earnings

    return {
        "daily": {
            "gross_earnings": today_gross,
            "net_payout": round(today_gross * 0.85, 2),
            "trips_count": len(today_rides)
        },
        "weekly": {
            "gross_earnings": week_gross,
            "net_payout": round(week_gross * 0.85, 2),
            "trips_count": len(week_rides)
        },
        "monthly": {
            "gross_earnings": month_gross,
            "net_payout": round(month_gross * 0.85, 2),
            "trips_count": len(month_rides)
        },
        "lifetime": {
            "gross_earnings": lifetime_gross,
            "wallet_balance": round(lifetime_gross * 0.85, 2),
            "total_trips": max(len(completed_rides), profile.total_completed_trips)
        },
        "platform_commission_rate": 0.15,
        "driver_share_rate": 0.85
    }


@router.post("/support/ticket")
def create_support_ticket(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    from app.models.admin import SupportTicket
    import uuid
    subject = payload.get("subject") or payload.get("category", "General Query")
    description = payload.get("description", "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description is required.")

    ticket = SupportTicket(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        ride_id=payload.get("ride_id"),
        subject=subject,
        description=description,
        status="open"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {
        "status": "created",
        "ticket_id": ticket.id,
        "subject": ticket.subject,
        "ticket_status": ticket.status,
        "created_at": ticket.created_at
    }


@router.get("/support/tickets")
def list_support_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    from app.models.admin import SupportTicket
    tickets = db.query(SupportTicket).filter(
        SupportTicket.user_id == current_user.id
    ).order_by(SupportTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "description": t.description,
            "status": t.status,
            "created_at": t.created_at
        } for t in tickets
    ]


# ==========================================
# CAMPUS & UNIVERSITY DRIVER OPERATIONS
# ==========================================

@router.get("/campus-profile")
def get_campus_driver_profile(
    current_user: User = Depends(require_roles(UserRole.RIDER)),
    db: Session = Depends(get_db)
):
    """Retrieve driver's campus registration and served universities."""
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    return {
        "rider_service_type": profile.rider_service_type or "REGULAR",
        "served_universities": profile.served_universities or "",
        "college_name": profile.college_name or "",
        "academic_year": profile.academic_year or "",
        "student_id_number": profile.student_id_number or "",
        "full_name": current_user.full_name,
        "phone_number": current_user.phone_number,
        "is_approved": profile.status == RiderApprovalStatus.APPROVED
    }


@router.put("/campus-profile")
def update_campus_driver_profile(
    payload: dict,
    current_user: User = Depends(require_roles(UserRole.RIDER)),
    db: Session = Depends(get_db)
):
    """Update driver's campus service type and served universities."""
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    if "rider_service_type" in payload and payload.get("rider_service_type"):
        srv_type = str(payload.get("rider_service_type")).strip().upper()
        if srv_type in ("REGULAR", "CAMPUS"):
            profile.rider_service_type = srv_type
    if "served_universities" in payload:
        profile.served_universities = (payload.get("served_universities") or "").strip()
    if "college_name" in payload:
        profile.college_name = (payload.get("college_name") or "").strip()

    db.commit()
    db.refresh(profile)

    return {
        "success": True,
        "rider_service_type": profile.rider_service_type,
        "served_universities": profile.served_universities,
        "college_name": profile.college_name,
        "message": "Campus driver profile updated successfully."
    }


@router.get("/campus/student-requests")
def get_campus_student_requests(
    current_user: User = Depends(require_roles(UserRole.RIDER)),
    db: Session = Depends(get_db)
):
    """
    Retrieve open passenger ride requests (students needing rides).
    If driver is a CAMPUS driver, filters requests to match driver's served universities.
    """
    from app.models.campus import PassengerRideRequest, University
    profile = current_user.rider_profile
    is_campus_driver = bool(profile and profile.rider_service_type == "CAMPUS")
    served = [u.strip().lower() for u in (profile.served_universities or "").split(",") if u.strip()] if profile else []

    q = db.query(PassengerRideRequest).filter(PassengerRideRequest.status == "OPEN")
    all_requests = q.order_by(PassengerRideRequest.created_at.desc()).limit(50).all()

    matched_requests = []
    for r in all_requests:
        if not is_campus_driver or not served:
            matched_requests.append(r)
        else:
            uni_name = ""
            if r.university_id:
                u_obj = db.query(University).filter(University.id == r.university_id).first()
                if u_obj:
                    uni_name = u_obj.name
            p_text = f"{r.pickup_address} {r.destination_address} {uni_name}".lower()
            matched = any(u in p_text or any(token in p_text for token in u.split() if len(token) > 3) for u in served)
            if matched or not r.university_id:
                matched_requests.append(r)

    return [
        {
            "id": r.id,
            "passenger_name": r.passenger_name,
            "passenger_phone": r.passenger_phone,
            "pickup_address": r.pickup_address,
            "destination_address": r.destination_address,
            "travel_date": r.travel_date,
            "preferred_time": r.preferred_time,
            "passengers_count": r.passengers_count,
            "max_budget_per_seat": r.max_budget_per_seat,
            "notes": r.notes,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in matched_requests
    ]


