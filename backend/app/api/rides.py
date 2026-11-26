from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.ride import RideBooking, RideStatus, RideStatusHistory, RideRequest, RideRequestStatus
from app.schemas.ride import (
    CreateRideRequest,
    RideDetailsResponse,
    LiveRideTrackingResponse,
    RiderSummary,
    RiderLocationUpdateRequest,
    VerifyPickupOTPRequest,
    CompleteRideRequest,
    CancelRideRequest,
    RiderStatusToggleRequest,
    BoostFareRequest
)
from app.services.ride_service import RideService
from app.services.matching_service import MatchingService
from app.services.location_service import LocationService
from app.api.deps import get_current_user, require_roles
from app.utils.rate_limiter import booking_limiter

router = APIRouter(prefix="/rides", tags=["Ride Booking & Lifecycle"])


@router.post("", response_model=RideDetailsResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(booking_limiter)])
async def create_ride_booking(
    request: CreateRideRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PASSENGER))
):
    """
    Passenger books a ride:
    - Re-calculates road route & server-side fare (Bike ₹7/km, Car ₹15/km, Auto configured)
    - Verifies service area and vehicle category
    - Enforces idempotency to prevent duplicate bookings
    - Generates 4-digit pickup OTP
    - Dispatches matching requests to nearby drivers within 2km (expanding to 3km)
    """
    resolved_idempotency = idempotency_key or request.idempotency_key
    booking, plain_otp = await RideService.create_booking(
        db, current_user.id, request, idempotency_key=resolved_idempotency
    )
    return RideService.format_ride_response(booking, current_user.id)


@router.get("/active", response_model=Optional[RideDetailsResponse])
async def get_active_ride(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves current in-progress or searching ride for the user."""
    active_statuses = [
        RideStatus.SEARCHING_FOR_RIDER,
        RideStatus.REQUESTS_SENT,
        RideStatus.EXPANDING_SEARCH,
        RideStatus.RIDER_ASSIGNED,
        RideStatus.RIDER_ARRIVING,
        RideStatus.RIDER_ARRIVED,
        RideStatus.OTP_VERIFICATION,
        RideStatus.IN_PROGRESS
    ]

    if current_user.role == UserRole.PASSENGER:
        ride = db.query(RideBooking).filter(
            RideBooking.passenger_id == current_user.id,
            RideBooking.status.in_(active_statuses)
        ).order_by(RideBooking.created_at.desc()).first()
    else:
        ride = db.query(RideBooking).filter(
            RideBooking.rider_id == current_user.id,
            RideBooking.status.in_(active_statuses)
        ).order_by(RideBooking.created_at.desc()).first()

    if not ride:
        return None

    # Evaluate matching timeline on backend (never restarts on refresh)
    if ride.status in (RideStatus.SEARCHING_FOR_RIDER, RideStatus.REQUESTS_SENT, RideStatus.EXPANDING_SEARCH):
        progressed = await MatchingService.check_and_progress_ride(db, ride.id)
        if progressed:
            ride = progressed

    return RideService.format_ride_response(ride, current_user.id)


@router.get("/history", response_model=List[RideDetailsResponse])
@router.get("/history/list", response_model=List[RideDetailsResponse])
def get_ride_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50)
):
    """Returns trip history for passenger or driver."""
    if current_user.role == UserRole.PASSENGER:
        rides = db.query(RideBooking).filter(
            RideBooking.passenger_id == current_user.id
        ).order_by(RideBooking.created_at.desc()).limit(limit).all()
    else:
        rides = db.query(RideBooking).filter(
            RideBooking.rider_id == current_user.id
        ).order_by(RideBooking.created_at.desc()).limit(limit).all()

    return [RideService.format_ride_response(r, current_user.id) for r in rides]


@router.get("/passenger/{passenger_id}/history", response_model=List[RideDetailsResponse])
def get_passenger_ride_history(
    passenger_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=50)
):
    """
    Returns ride history for a specific passenger.
    SECURITY: Strictly only allows passengers to access their own ride history (403 for other users).
    """
    if current_user.role != UserRole.ADMIN and current_user.id != passenger_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You can only access your own ride history."
        )
    rides = db.query(RideBooking).filter(
        RideBooking.passenger_id == passenger_id
    ).order_by(RideBooking.created_at.desc()).limit(limit).all()

    return [RideService.format_ride_response(r, current_user.id) for r in rides]


@router.get("/scheduled", response_model=List[RideDetailsResponse])
def get_scheduled_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns passenger's upcoming scheduled rides."""
    rides = db.query(RideBooking).filter(
        RideBooking.passenger_id == current_user.id,
        RideBooking.status == RideStatus.SCHEDULED
    ).order_by(RideBooking.scheduled_for.asc()).all()
    return [RideService.format_ride_response(r, current_user.id) for r in rides]


@router.post("/dispatch-scheduled")
async def trigger_dispatch_scheduled_rides(
    window_minutes: int = Query(default=20, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers dispatch for scheduled rides whose departure is within `window_minutes`.
    Admin, background worker, or passenger can check.
    """
    dispatched = await RideService.dispatch_scheduled_rides(db, window_minutes=window_minutes)
    return {
        "success": True,
        "dispatched_count": len(dispatched),
        "dispatched_ride_ids": [r.id for r in dispatched]
    }


@router.get("/{ride_id}", response_model=RideDetailsResponse)
async def get_ride_details(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets complete ride details and tracking metadata."""
    ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")

    if current_user.role != UserRole.ADMIN and current_user.id not in (ride.passenger_id, ride.rider_id):
        raise HTTPException(status_code=403, detail="Unauthorized to view this ride.")

    # Evaluate matching timeline on backend
    if ride.status in (RideStatus.SEARCHING_FOR_RIDER, RideStatus.REQUESTS_SENT, RideStatus.EXPANDING_SEARCH):
        progressed = await MatchingService.check_and_progress_ride(db, ride.id)
        if progressed:
            ride = progressed

    return RideService.format_ride_response(ride, current_user.id)


@router.post("/{ride_id}/accept", response_model=RideDetailsResponse)
async def accept_ride(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """
    Rider accepts incoming ride:
    - Atomic database row-level lock ensures only first valid driver wins
    - Rejects expired requests or already assigned rides
    - Marks ride RIDER_ARRIVING
    - Cancels competing requests
    - Triggers instant live sync to passenger
    """
    ride, _ = await MatchingService.atomic_accept_ride(db, ride_id, current_user.id)
    return RideService.format_ride_response(ride, current_user.id)


@router.post("/{ride_id}/reject")
async def reject_ride(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider explicitly rejects an incoming ride invitation."""
    return await MatchingService.reject_ride(db, ride_id, current_user.id)


@router.post("/{ride_id}/arrived", response_model=RideDetailsResponse)
async def mark_arrived(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider marks arrival at passenger pickup location."""
    ride = await RideService.mark_rider_arrived(db, ride_id, current_user.id)
    return RideService.format_ride_response(ride, current_user.id)


@router.post("/{ride_id}/verify-otp", response_model=RideDetailsResponse)
@router.post("/{ride_id}/start", response_model=RideDetailsResponse)
async def start_trip_with_otp(
    ride_id: str,
    request: VerifyPickupOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """
    Rider enters passenger's 4-digit PIN:
    - Secure HMAC-SHA256 verification against database hash
    - Transitions ride status to IN_PROGRESS
    """
    ride = await RideService.verify_otp_and_start_trip(db, ride_id, current_user.id, request.otp)
    return RideService.format_ride_response(ride, current_user.id)


@router.post("/{ride_id}/complete", response_model=RideDetailsResponse)
async def complete_trip(
    ride_id: str,
    request: CompleteRideRequest = CompleteRideRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Rider completes ride upon reaching destination."""
    ride = await RideService.complete_trip(db, ride_id, current_user.id, request.actual_distance_km)
    return RideService.format_ride_response(ride, current_user.id)


@router.post("/{ride_id}/cancel", response_model=RideDetailsResponse)
async def cancel_ride(
    ride_id: str,
    request: CancelRideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Passenger or Rider cancels active ride."""
    ride = await RideService.cancel_ride(db, ride_id, current_user.id, request.reason)
    return RideService.format_ride_response(ride, current_user.id)


@router.get("/{ride_id}/tracking", response_model=LiveRideTrackingResponse)
async def get_live_tracking(
    ride_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dedicated secure real-time tracking endpoint:
    - Authorizes only the assigned passenger, assigned rider, or admin (403 for unauthorized)
    - Returns freshness metadata, ETA, and current driver coordinates
    - Terminates location sharing if trip is completed or cancelled
    """
    ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")

    if current_user.role != UserRole.ADMIN and current_user.id not in (ride.passenger_id, ride.rider_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to access this ride's tracking data."
        )

    # If ride is completed or cancelled, location sharing is strictly terminated
    sharing_active = ride.status in (
        RideStatus.RIDER_ASSIGNED,
        RideStatus.RIDER_ARRIVING,
        RideStatus.RIDER_ARRIVED,
        RideStatus.IN_PROGRESS
    )

    rider_summary = None
    driver_route = None

    if sharing_active and ride.rider and ride.rider.rider_profile:
        rp = ride.rider.rider_profile
        vehicle = ride.vehicle or (rp.vehicles[0] if rp.vehicles else None)

        # Staleness check
        is_stale = False
        if rp.last_location_update:
            upd = rp.last_location_update.replace(tzinfo=timezone.utc) if rp.last_location_update.tzinfo is None else rp.last_location_update
            if (datetime.now(timezone.utc) - upd).total_seconds() > 30:
                is_stale = True
        else:
            is_stale = True

        pickup_eta = None
        if rp.current_latitude and rp.current_longitude:
            if ride.status in (RideStatus.RIDER_ASSIGNED, RideStatus.RIDER_ARRIVING):
                dist_km = LocationService.haversine_distance_km(
                    rp.current_latitude, rp.current_longitude,
                    ride.pickup_latitude, ride.pickup_longitude
                )
                pickup_eta = max(1, int(round((dist_km / 25.0) * 60.0)))
                try:
                    route_res = await LocationService.calculate_route(
                        rp.current_latitude, rp.current_longitude,
                        ride.pickup_latitude, ride.pickup_longitude
                    )
                    driver_route = route_res.route_geometry
                except Exception:
                    pass

        rider_summary = RiderSummary(
            id=ride.rider.id,
            full_name=ride.rider.full_name,
            phone_number=ride.rider.phone_number,
            profile_photo=getattr(ride.rider, "profile_photo", None) or "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
            rating=rp.rating,
            vehicle_category=ride.vehicle_category,
            vehicle_plate=vehicle.license_plate if vehicle else "GJ-01-AB-1234",
            vehicle_model=vehicle.model if vehicle else "Hero Splendor / Swift",
            current_latitude=rp.current_latitude,
            current_longitude=rp.current_longitude,
            pickup_eta_mins=pickup_eta,
            last_location_update=rp.last_location_update,
            is_stale=is_stale
        )

    return LiveRideTrackingResponse(
        ride_id=ride.id,
        status=ride.status,
        sharing_active=sharing_active,
        rider=rider_summary,
        pickup_latitude=ride.pickup_latitude,
        pickup_longitude=ride.pickup_longitude,
        destination_latitude=ride.destination_latitude,
        destination_longitude=ride.destination_longitude,
        driver_to_pickup_route=driver_route,
        last_updated_at=datetime.now(timezone.utc)
    )


@router.post("/{ride_id}/boost-fare", response_model=RideDetailsResponse)
async def boost_ride_fare(
    ride_id: str,
    request: BoostFareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PASSENGER))
):
    """
    Passenger dynamically boosts fare (up to +₹40) while searching for a driver.
    Updates estimated fare, logs status history, and re-broadcasts to nearby drivers.
    """
    from app.services.websocket_manager import ws_manager

    ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found.")

    if ride.passenger_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to modify this ride.")

    if ride.status not in (RideStatus.SEARCHING_FOR_RIDER, RideStatus.REQUESTS_SENT, RideStatus.EXPANDING_SEARCH):
        raise HTTPException(
            status_code=400,
            detail=f"Fare can only be boosted while searching for a driver (current status: {ride.status.value})."
        )

    # Calculate new estimated fare
    if ride.fare_breakdown:
        base_fare_amount = (
            ride.fare_breakdown.distance_charge +
            ride.fare_breakdown.base_fare +
            ride.fare_breakdown.waiting_charge +
            ride.fare_breakdown.toll_parking_charge +
            ride.fare_breakdown.taxes -
            ride.fare_breakdown.discount
        )
        ride.fare_breakdown.surge_amount = round(request.boost_amount, 2)
        ride.fare_breakdown.total_fare = round(base_fare_amount + request.boost_amount, 2)
        ride.estimated_fare = ride.fare_breakdown.total_fare
    else:
        ride.estimated_fare = round(ride.estimated_fare + request.boost_amount, 2)

    db.add(RideStatusHistory(
        ride_id=ride.id,
        status=ride.status,
        notes=f"Passenger updated fare boost to +₹{request.boost_amount}. New estimated fare: ₹{ride.estimated_fare}"
    ))
    db.commit()
    db.refresh(ride)

    # 1. Real-time push to passenger
    await ws_manager.send_to_user(ride.passenger_id, {
        "event": "ride_updated",
        "ride_id": ride.id,
        "status": ride.status.value,
        "estimated_fare": ride.estimated_fare,
        "boost_amount": request.boost_amount
    })

    # 2. Re-dispatch / update matching requests for nearby drivers
    try:
        await MatchingService.dispatch_matching_requests(db, ride)
    except Exception as e:
        print(f"[MatchingService] boost fare redispatch error: {e}")

    return RideService.format_ride_response(ride, current_user.id)



