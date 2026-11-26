import json
import logging
import uuid
import time
import collections
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.config import settings
from app.models.ride import RideBooking, RideRequest, RideRequestStatus, RideStatus, RideStatusHistory, TripLocationPoint
from app.models.user import User, UserRole, RiderProfile
from app.models.vehicle import Vehicle, VehicleCategory
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.fare import FareBreakdown
from app.schemas.ride import CreateRideRequest, RideDetailsResponse, RiderSummary, PassengerSummary
from app.services.location_service import LocationService
from app.services.fare_service import FareService
from app.services.matching_service import MatchingService
from app.services.websocket_manager import ws_manager
from app.services.redis_service import redis_service
from app.services.mongo_service import mongo_service
from app.utils.security import generate_pickup_otp, hash_otp, verify_otp_hash, encrypt_otp, decrypt_otp

logger = logging.getLogger(__name__)

# In-memory cache for passenger's active OTP view
ACTIVE_RIDE_OTPS: Dict[str, str] = {}

# Rate-limiter tracking verification attempts per ride_id
_OTP_VERIFY_RATE_LIMIT: Dict[str, List[float]] = collections.defaultdict(list)


class RideService:
    @classmethod
    async def create_booking(
        cls,
        db: Session,
        passenger_id: str,
        request: CreateRideRequest,
        idempotency_key: Optional[str] = None
    ) -> Tuple[RideBooking, str]:
        # 0. Idempotency Check: Prevent duplicate booking requests
        resolved_idempotency = idempotency_key or request.idempotency_key
        if resolved_idempotency:
            existing_idempotent = db.query(RideBooking).filter(
                RideBooking.passenger_id == passenger_id,
                RideBooking.idempotency_key == resolved_idempotency
            ).first()
            if existing_idempotent:
                logger.info(f"Idempotent request hit for key {resolved_idempotency}: returning booking {existing_idempotent.id}")
                cached_otp = ACTIVE_RIDE_OTPS.get(existing_idempotent.id, "1234")
                return existing_idempotent, cached_otp

        # 1. Validate Vehicle Category
        if request.vehicle_category not in [VehicleCategory.BIKE, VehicleCategory.AUTO, VehicleCategory.CAR]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid vehicle category '{request.vehicle_category}'. Supported categories are Bike, Auto, and Car."
            )

        # 2. Concurrency Check & Scheduled Ride Validation
        is_scheduled = False
        scheduled_target = None
        now_utc = datetime.now(timezone.utc)

        if request.scheduled_for:
            scheduled_target = request.scheduled_for
            cmp_dt = scheduled_target
            if cmp_dt.tzinfo is None:
                cmp_dt = cmp_dt.replace(tzinfo=timezone.utc)

            if cmp_dt < now_utc + timedelta(minutes=15):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Scheduled rides must be booked at least 15 minutes in advance."
                )
            if cmp_dt > now_utc + timedelta(days=7):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Scheduled rides cannot be booked more than 7 days in advance."
                )
            is_scheduled = True

        if not is_scheduled:
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
            existing_active = db.query(RideBooking).filter(
                RideBooking.passenger_id == passenger_id,
                RideBooking.status.in_(active_statuses)
            ).first()
            if existing_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You already have an active ride in progress. A passenger can only book one ride at a time."
                )

        # 3. Road distance & polyline calculation (never trusts client coordinates or straight-line distances)
        route_resp = await LocationService.calculate_route(
            pickup_lat=request.pickup_latitude,
            pickup_lng=request.pickup_longitude,
            dropoff_lat=request.destination_latitude,
            dropoff_lng=request.destination_longitude
        )

        # 4. Server-Side Fare Calculation with User Loyalty & 90% 1st Ride Auto-Discount
        passenger_user = db.query(User).filter(User.id == passenger_id).first()
        completed_trips = 0
        is_diamond = False
        vouchers = 0
        if passenger_user and passenger_user.passenger_profile:
            completed_trips = passenger_user.passenger_profile.total_trips or 0
            is_diamond = bool(passenger_user.passenger_profile.is_diamond_member or (completed_trips >= 300))
            vouchers = passenger_user.passenger_profile.free_rides_vouchers or 0

        use_voucher = bool(request.use_voucher and vouchers > 0)
        if use_voucher and passenger_user and passenger_user.passenger_profile:
            passenger_user.passenger_profile.free_rides_vouchers = max(0, vouchers - 1)
            db.flush()

        fare_cfg = FareService.get_or_create_config(db, request.vehicle_category)
        breakdown = FareService.calculate_single_fare(
            config=fare_cfg,
            distance_km=route_resp.distance_km,
            duration_minutes=route_resp.duration_minutes,
            promo_code=request.promo_code,
            user_completed_trips=completed_trips,
            use_free_voucher=use_voucher,
            is_diamond_member=is_diamond
        )


        # 5. Generate 4-digit OTP, bound HMAC hash, and encrypted token
        booking_id = str(uuid.uuid4())
        plain_otp = generate_pickup_otp()
        hashed_otp = hash_otp(plain_otp, salt=booking_id)
        encrypted_otp = encrypt_otp(plain_otp, key_context=booking_id)

        # 6. Create persistent RideBooking record
        polyline_str = json.dumps(route_resp.route_geometry)
        now = datetime.now(timezone.utc)
        otp_expiry = now + timedelta(minutes=25)

        booking = RideBooking(
            id=booking_id,
            idempotency_key=resolved_idempotency,
            passenger_id=passenger_id,
            vehicle_category=request.vehicle_category,
            pickup_address=request.pickup_address,
            pickup_latitude=request.pickup_latitude,
            pickup_longitude=request.pickup_longitude,
            destination_address=request.destination_address,
            destination_latitude=request.destination_latitude,
            destination_longitude=request.destination_longitude,
            route_polyline=polyline_str,
            estimated_distance_km=route_resp.distance_km,
            estimated_duration_mins=int(route_resp.duration_minutes),
            estimated_fare=breakdown.total_fare,
            otp_hash=hashed_otp,
            otp_encrypted=encrypted_otp,
            otp_attempts=0,
            otp_max_attempts=3,
            otp_expires_at=otp_expiry,
            otp_locked=0,
            status=RideStatus.SCHEDULED if is_scheduled else RideStatus.SEARCHING_FOR_RIDER,
            current_search_radius_km=settings.INITIAL_MATCHING_RADIUS_KM,
            created_at=now,
            scheduled_for=scheduled_target,
            matching_started_at=None if is_scheduled else now
        )
        db.add(booking)
        db.flush()

        # Cache plain OTP for passenger session retrieval fallback
        ACTIVE_RIDE_OTPS[booking.id] = plain_otp

        # Record Initial Status History
        if is_scheduled:
            notes_str = f"Ride scheduled for {scheduled_target.isoformat()}. Route: {route_resp.distance_km} km, ₹{breakdown.total_fare}"
            init_status = RideStatus.SCHEDULED
        else:
            notes_str = f"Booking created. Estimating route: {route_resp.distance_km} km, ₹{breakdown.total_fare}"
            init_status = RideStatus.SEARCHING_FOR_RIDER

        if breakdown.discount_amount > 0:
            notes_str += f" (Promo {breakdown.discount_code} saved ₹{breakdown.discount_amount})"

        db.add(RideStatusHistory(
            ride_id=booking.id,
            status=init_status,
            notes=notes_str
        ))

        # Attach Detailed Fare Breakdown
        db.add(FareBreakdown(
            ride_id=booking.id,
            billable_distance_km=breakdown.distance_km,
            per_km_rate_used=breakdown.rate_per_km,
            base_fare=breakdown.base_fare,
            distance_charge=breakdown.distance_fare,
            waiting_charge=breakdown.waiting_charge,
            toll_parking_charge=breakdown.tolls_and_parking,
            surge_amount=breakdown.surge_amount,
            taxes=breakdown.tax_amount,
            discount=breakdown.discount_amount,
            total_fare=breakdown.total_fare
        ))

        db.commit()
        db.refresh(booking)

        # Real-time event logging to MongoDB & Redis
        mongo_service.log_ride_event(
            ride_id=booking.id,
            event_type="booking_created",
            actor_id=passenger_id,
            details={
                "passenger_id": passenger_id,
                "pickup": booking.pickup_address,
                "destination": booking.destination_address,
                "fare": booking.estimated_fare,
                "vehicle": booking.vehicle_category.value
            }
        )
        if not is_scheduled:
            redis_service.enqueue_ride_request(booking.id)

        # 7. Start rider matching (immediate rides only)
        if not is_scheduled:
            await MatchingService.dispatch_matching_requests(db, booking)

        return booking, plain_otp

    @classmethod
    async def update_rider_location(
        cls,
        db: Session,
        rider_user_id: str,
        latitude: float,
        longitude: float,
        heading: Optional[float] = None,
        speed: Optional[float] = None
    ):
        """
        Updates rider live GPS location with strict validation:
        - Validates coordinate bounds and India operating boundary
        - Prevents teleportation spoofing
        - Checks update freshness
        - Calculates live pickup / destination ETA
        - Exclusively broadcasts to the assigned passenger
        - Terminates broadcasting when ride is completed or cancelled
        """
        # 1. Location Validation
        if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
            logger.warning(f"Rejected invalid coordinates: ({latitude}, {longitude})")
            return

        if not (6.0 <= latitude <= 38.0 and 68.0 <= longitude <= 98.0):
            logger.warning(f"Rejected coordinates outside service boundary: ({latitude}, {longitude})")
            return

        rider_user = db.query(User).filter(User.id == rider_user_id).first()
        if not rider_user or not rider_user.rider_profile:
            return

        profile = rider_user.rider_profile
        now = datetime.now(timezone.utc)

        # 2. Check if rider is currently on an active ride
        active_ride = db.query(RideBooking).filter(
            RideBooking.rider_id == rider_user_id,
            RideBooking.status.in_([
                RideStatus.RIDER_ASSIGNED,
                RideStatus.RIDER_ARRIVING,
                RideStatus.RIDER_ARRIVED,
                RideStatus.IN_PROGRESS
            ])
        ).first()

        # Teleportation / spoofing check (> 150 km/h) ONLY applies during an active trip.
        # Idle drivers can switch zones, move between shifts, or initialize GPS freely.
        if active_ride and profile.current_latitude and profile.current_longitude and profile.last_location_update:
            last_dt = profile.last_location_update.replace(tzinfo=timezone.utc) if profile.last_location_update.tzinfo is None else profile.last_location_update
            delta_sec = max(1.0, (now - last_dt).total_seconds())
            if delta_sec < 60.0:
                dist_km = LocationService.haversine_distance_km(
                    profile.current_latitude, profile.current_longitude,
                    latitude, longitude
                )
                implied_speed = (dist_km / (delta_sec / 3600.0))
                if implied_speed > 150.0 and dist_km > 0.3:
                    logger.warning(f"Rejected impossible GPS jump for rider {rider_user_id}: {dist_km:.2f}km in {delta_sec:.1f}s ({implied_speed:.1f} km/h)")
                    return

        profile.current_latitude = latitude
        profile.current_longitude = longitude
        profile.last_location_update = now
        db.commit()

        # Real-Time Geospatial Index in Redis
        vehicle_cat = profile.vehicles[0].category.value if profile.vehicles else "bike"
        redis_service.update_driver_location(
            driver_id=rider_user_id,
            lat=latitude,
            lng=longitude,
            metadata={
                "category": vehicle_cat,
                "rating": profile.rating or 5.0,
                "full_name": rider_user.full_name or "Driver"
            }
        )

        if active_ride and active_ride.status not in (RideStatus.COMPLETED, RideStatus.CANCELLED):
            # Save High-Precision Telemetry Breadcrumb in MongoDB
            mongo_service.save_breadcrumb(
                ride_id=active_ride.id,
                lat=latitude,
                lng=longitude,
                speed=speed or 0.0,
                heading=heading or 0.0
            )

            # Filter duplicate points: ignore if within 5 meters of previous point
            last_point = db.query(TripLocationPoint).filter(
                TripLocationPoint.ride_id == active_ride.id
            ).order_by(TripLocationPoint.recorded_at.desc()).first()

            is_duplicate = False
            if last_point:
                d_last = LocationService.haversine_distance_km(
                    last_point.latitude, last_point.longitude,
                    latitude, longitude
                )
                if d_last < 0.005:  # within 5 meters
                    is_duplicate = True

            if not is_duplicate:
                db.add(TripLocationPoint(
                    ride_id=active_ride.id,
                    latitude=latitude,
                    longitude=longitude,
                    speed=speed,
                    recorded_at=now
                ))
                db.commit()

            # Compute ETA
            pickup_eta = None
            dest_eta = None
            if active_ride.status in (RideStatus.RIDER_ASSIGNED, RideStatus.RIDER_ARRIVING):
                dist_to_p = LocationService.haversine_distance_km(
                    latitude, longitude,
                    active_ride.pickup_latitude, active_ride.pickup_longitude
                )
                pickup_eta = max(1, int(round((dist_to_p / 25.0) * 60.0)))
            elif active_ride.status == RideStatus.IN_PROGRESS:
                dist_to_d = LocationService.haversine_distance_km(
                    latitude, longitude,
                    active_ride.destination_latitude, active_ride.destination_longitude
                )
                dest_eta = max(1, int(round((dist_to_d / 25.0) * 60.0)))

            # Exclusively broadcast to assigned passenger
            await ws_manager.send_to_user(active_ride.passenger_id, {
                "event": "driver_location_update",
                "ride_id": active_ride.id,
                "latitude": latitude,
                "longitude": longitude,
                "heading": heading or 0.0,
                "speed": speed or 0.0,
                "status": active_ride.status.value,
                "pickup_eta_mins": pickup_eta,
                "destination_eta_mins": dest_eta,
                "eta_mins": dest_eta if active_ride.status == RideStatus.IN_PROGRESS else pickup_eta,
                "last_updated_at": now.isoformat(),
                "is_stale": False
            })


    @classmethod
    async def mark_rider_arrived(cls, db: Session, ride_id: str, rider_user_id: str) -> RideBooking:
        """Transitions ride to RIDER_ARRIVED and notifies passenger to share 4-digit OTP."""
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride booking not found.")

        if ride.rider_id != rider_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: Only the assigned rider can mark arrival at pickup."
            )

        if ride.status == RideStatus.RIDER_ARRIVED:
            return ride

        if ride.status == RideStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="Cannot mark arrived: booking has been cancelled.")

        if ride.status != RideStatus.RIDER_ARRIVING:
            raise HTTPException(status_code=400, detail=f"Cannot mark arrived from status {ride.status.value}")

        ride.status = RideStatus.RIDER_ARRIVED
        ride.rider_arrived_at = datetime.now(timezone.utc)
        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.RIDER_ARRIVED,
            notes="Rider reached pickup location. Awaiting OTP verification."
        ))
        db.commit()
        db.refresh(ride)

        # Broadcast arrival event to passenger
        await ws_manager.send_to_user(ride.passenger_id, {
            "event": "rider_arrived",
            "ride_id": ride.id,
            "status": ride.status.value,
            "message": "Your driver has arrived at the pickup location. Share the 4-digit OTP to start the trip."
        })

        return ride

    @classmethod
    async def verify_otp_and_start_trip(
        cls,
        db: Session,
        ride_id: str,
        rider_user_id: str,
        otp: str
    ) -> RideBooking:
        """
        Securely validates passenger's 4-digit OTP against stored HMAC-SHA256 hash.
        Transitions ride state to IN_PROGRESS only upon successful verification.
        Enforces:
        - Correct booking validation (404)
        - Rider assignment authorization (403)
        - Rate limiting on verification attempts (429)
        - Max attempt limit & locking (400)
        - Expiration checking (400)
        - Single-use OTP invalidation / reuse prevention (400)
        - Audit trail recording for all attempts
        """
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride booking not found.")

        # 1. Prevent riders from verifying another rider's booking
        if ride.rider_id != rider_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: Only the assigned rider can verify the pickup OTP."
            )

        # 2. Prevent repeated verification / already started or completed
        if ride.status in (RideStatus.IN_PROGRESS, RideStatus.COMPLETED) or ride.trip_started_at is not None or ride.otp_hash == "INVALIDATED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has already been verified and used. Trip is already in progress or completed."
            )

        # 3. Validate correct lifecycle state
        if ride.status == RideStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start trip: booking has been cancelled."
            )

        if ride.status not in (RideStatus.RIDER_ARRIVING, RideStatus.RIDER_ARRIVED, RideStatus.OTP_VERIFICATION):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start trip: ride is currently in status '{ride.status.value}'. Rider must arrive first."
            )

        # 4. Check if verification is locked due to too many failed attempts
        max_attempts = getattr(ride, "otp_max_attempts", 3) or 3
        if getattr(ride, "otp_locked", 0) or (ride.otp_attempts or 0) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum OTP verification attempts exceeded ({ride.otp_attempts}/{max_attempts}). Verification is locked for security."
            )

        # 5. Check OTP expiration
        if ride.otp_expires_at:
            exp = ride.otp_expires_at.replace(tzinfo=timezone.utc) if ride.otp_expires_at.tzinfo is None else ride.otp_expires_at
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Pickup OTP has expired. Please request a new ride or contact support."
                )

        # 6. Sliding-window rate limiting on verification endpoint
        now_ts = time.time()
        recent_attempts = [t for t in _OTP_VERIFY_RATE_LIMIT[ride_id] if now_ts - t < 30.0]
        if len(recent_attempts) >= 15:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many verification attempts. Please wait 30 seconds before retrying."
            )
        recent_attempts.append(now_ts)
        _OTP_VERIFY_RATE_LIMIT[ride_id] = recent_attempts

        # 7. Constant-time cryptographic HMAC verification
        is_valid = (
            verify_otp_hash(otp, ride.otp_hash, salt=ride.id)
            or verify_otp_hash(otp, ride.otp_hash)
        )

        if not is_valid:
            ride.otp_attempts = (ride.otp_attempts or 0) + 1
            if ride.otp_attempts >= max_attempts:
                ride.otp_locked = 1
                db.add(RideStatusHistory(
                    ride_id=ride.id,
                    status=ride.status,
                    notes=f"OTP verification locked: exceeded maximum {max_attempts} failed attempts"
                ))
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid OTP. Maximum attempts exceeded ({ride.otp_attempts}/{max_attempts}). Verification is now locked."
                )

            db.add(RideStatusHistory(
                ride_id=ride.id,
                status=ride.status,
                notes=f"Failed OTP verification attempt ({ride.otp_attempts}/{max_attempts})"
            ))
            db.commit()
            remaining = max_attempts - ride.otp_attempts
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid 4-digit OTP. {remaining} attempt(s) remaining."
            )

        # 8. OTP IS VALID: Invalidate OTP & transition to IN_PROGRESS
        now = datetime.now(timezone.utc)
        ride.status = RideStatus.IN_PROGRESS
        ride.trip_started_at = now
        ride.otp_verified_at = now
        ride.otp_hash = "INVALIDATED"
        ride.otp_encrypted = None
        ACTIVE_RIDE_OTPS.pop(ride.id, None)

        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.IN_PROGRESS,
            notes="Pickup OTP verified successfully. Trip started."
        ))
        db.commit()
        db.refresh(ride)

        # Notify passenger & rider via WebSocket
        await ws_manager.broadcast_ride_update(
            ride_id=ride.id,
            message={
                "event": "trip_started",
                "status": RideStatus.IN_PROGRESS.value,
                "message": "Pickup OTP verified! Trip started. Have a safe journey!"
            },
            passenger_id=ride.passenger_id,
            rider_id=rider_user_id
        )

        return ride

    @classmethod
    async def complete_trip(
        cls,
        db: Session,
        ride_id: str,
        rider_user_id: str,
        actual_distance_km: Optional[float] = None
    ) -> RideBooking:
        """
        Completes the trip:
        - Calculates final fare
        - Creates payment record
        - Updates rider stats & unmarks is_busy
        - Broadcasts trip completion receipt
        """
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride booking not found.")

        # 1. Strict authorization: Only the assigned rider can request trip completion
        if ride.rider_id != rider_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: Only the assigned rider can request ride completion."
            )

        # 2. Idempotent completion: if already COMPLETED, return without double-billing
        if ride.status == RideStatus.COMPLETED:
            return ride

        # 3. Verify currently IN_PROGRESS
        if ride.status != RideStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete trip: ride is currently in status '{ride.status.value}'. Trip must be in progress."
            )

        now = datetime.now(timezone.utc)

        # 4. Reconcile distance from validated TripLocationPoints
        points = db.query(TripLocationPoint).filter(
            TripLocationPoint.ride_id == ride.id
        ).order_by(TripLocationPoint.recorded_at.asc()).all()

        gps_dist = 0.0
        if len(points) >= 2:
            for i in range(len(points) - 1):
                d = LocationService.haversine_distance_km(
                    points[i].latitude, points[i].longitude,
                    points[i+1].latitude, points[i+1].longitude
                )
                if d < 2.0:  # ignore sensor glitch jumps > 2km
                    gps_dist += d
        gps_dist = round(gps_dist, 1)

        # Fallback to road-route distance if GPS was sparse or interrupted
        if gps_dist >= 0.5 and gps_dist <= ride.estimated_distance_km * 2.0:
            reconciled_distance = gps_dist
        else:
            reconciled_distance = round(ride.estimated_distance_km, 1)

        # If driver app passed measured odometer, validate it strictly
        if actual_distance_km and 0.5 <= actual_distance_km <= ride.estimated_distance_km * 2.0:
            final_distance = round(actual_distance_km, 1)
        else:
            final_distance = reconciled_distance

        # 5. Calculate final fare on backend (Never trust client-supplied fare)
        fare_cfg = FareService.get_or_create_config(db, ride.vehicle_category)
        start_t = ride.trip_started_at.replace(tzinfo=timezone.utc) if ride.trip_started_at and ride.trip_started_at.tzinfo is None else (ride.trip_started_at or now)
        duration_mins = int(max(1, (now - start_t).total_seconds() / 60.0))

        passenger_user = db.query(User).filter(User.id == ride.passenger_id).first()
        p_trips = passenger_user.passenger_profile.total_trips if (passenger_user and passenger_user.passenger_profile) else 0
        p_diamond = bool(passenger_user.passenger_profile.is_diamond_member or (p_trips >= 300)) if (passenger_user and passenger_user.passenger_profile) else False

        final_breakdown = FareService.calculate_single_fare(
            config=fare_cfg,
            distance_km=final_distance,
            duration_minutes=duration_mins,
            user_completed_trips=p_trips,
            is_diamond_member=p_diamond
        )


        # 6. Save finalized trip details
        ride.actual_distance_km = final_distance
        ride.final_fare = final_breakdown.total_fare
        ride.status = RideStatus.COMPLETED
        ride.trip_completed_at = now

        # 7. Prevent multiple final bills: create payment record only once
        existing_payment = db.query(Payment).filter(Payment.ride_id == ride.id).first()
        if not existing_payment:
            payment = Payment(
                ride_id=ride.id,
                user_id=ride.passenger_id,
                amount=final_breakdown.total_fare,
                currency="INR",
                method=PaymentMethod.CASH,
                status=PaymentStatus.PENDING
            )
            db.add(payment)

        # 8. Update FareBreakdown snapshot
        fb = db.query(FareBreakdown).filter(FareBreakdown.ride_id == ride.id).first()
        if fb:
            fb.billable_distance_km = final_distance
            fb.per_km_rate_used = final_breakdown.rate_per_km
            fb.base_fare = final_breakdown.base_fare
            fb.distance_charge = final_breakdown.distance_fare
            fb.total_fare = final_breakdown.total_fare

        # 9. Update Rider Profile
        rider_user = db.query(User).filter(User.id == rider_user_id).first()
        if rider_user and rider_user.rider_profile:
            rider_user.rider_profile.is_busy = False
            rider_user.rider_profile.total_completed_trips += 1
            rider_user.rider_profile.total_earnings += final_breakdown.total_fare

        # 9b. Update Passenger Profile & Loyalty Milestones (Bronze 100, Silver 150, Gold 200, Diamond 300)
        from app.services.loyalty_service import LoyaltyService
        LoyaltyService.apply_ride_completion_rewards(
            db=db,
            passenger_id=ride.passenger_id,
            discount_saved=final_breakdown.discount_amount
        )


        # 10. Status History
        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.COMPLETED,
            notes=f"Trip completed. Actual billable distance: {final_distance} km, Final fare: ₹{final_breakdown.total_fare}"
        ))

        db.commit()
        db.refresh(ride)

        ACTIVE_RIDE_OTPS.pop(ride.id, None)

        # Broadcast completion with receipt to both passenger and rider
        receipt = {
            "event": "trip_completed",
            "ride_id": ride.id,
            "status": RideStatus.COMPLETED.value,
            "actual_distance_km": final_distance,
            "final_fare": final_breakdown.total_fare,
            "fare_breakdown": {
                "base_fare": final_breakdown.base_fare,
                "distance_fare": final_breakdown.distance_fare,
                "surge_amount": final_breakdown.surge_amount,
                "tax_amount": final_breakdown.tax_amount,
                "total_fare": final_breakdown.total_fare
            }
        }
        await ws_manager.broadcast_ride_update(
            ride_id=ride.id,
            message=receipt,
            passenger_id=ride.passenger_id,
            rider_id=rider_user_id
        )

        return ride

    @classmethod
    async def cancel_ride(
        cls,
        db: Session,
        ride_id: str,
        user_id: str,
        reason: Optional[str] = None
    ) -> RideBooking:
        """
        Cancels an active ride booking according to configurable platform policy:
        - Allows cancellation when permitted by booking state (searching, assigned, arriving, arrived)
        - Strictly forbids cancelling in-progress or completed trips
        - Authorizes only the booking passenger, assigned rider, or admin
        - Idempotent: repeated cancellations return cancelled booking without duplicate processing
        - Configurable cancellation fee: never charged unless policy is explicitly enabled and free window has elapsed
        - Resets assigned rider's availability
        - Expires pending rider requests
        - Notifies assigned rider and passenger via real-time WebSocket
        """
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found.")

        # 1. Authorization: Only passenger, assigned rider, or admin
        requesting_user = db.query(User).filter(User.id == user_id).first()
        is_admin = requesting_user and requesting_user.role == UserRole.ADMIN
        if not is_admin and user_id not in (ride.passenger_id, ride.rider_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: Only the booking passenger or assigned rider can cancel this ride."
            )

        # 2. Idempotency: If already cancelled, return existing cancelled booking
        if ride.status == RideStatus.CANCELLED:
            return ride

        # 3. State validation
        if ride.status == RideStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Cannot cancel a completed ride.")

        if ride.status == RideStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel a trip that is already in progress. The assigned driver must complete the ride."
            )

        now = datetime.now(timezone.utc)

        # 4. Configurable Cancellation Rules & Fee Calculation
        # - Free cancellation while searching for riders
        # - Free cancellation within free window (e.g. 2 mins) after rider assignment
        # - Never charge a fee unless cancellation_fee_enabled is True in fare configuration
        # - Never charge a fee if rider or admin initiates cancellation
        cancellation_fee = 0.0
        fare_cfg = FareService.get_or_create_config(db, ride.vehicle_category)
        fee_enabled = getattr(fare_cfg, "cancellation_fee_enabled", False)
        free_window_mins = getattr(fare_cfg, "free_cancellation_window_mins", 2) or 2

        if fee_enabled and user_id == ride.passenger_id:
            if ride.status in (RideStatus.RIDER_ASSIGNED, RideStatus.RIDER_ARRIVING):
                if ride.rider_assigned_at:
                    assigned_dt = ride.rider_assigned_at.replace(tzinfo=timezone.utc) if ride.rider_assigned_at.tzinfo is None else ride.rider_assigned_at
                    elapsed_mins = (now - assigned_dt).total_seconds() / 60.0
                    if elapsed_mins > free_window_mins:
                        cancellation_fee = round(fare_cfg.cancellation_fee, 2)
                else:
                    cancellation_fee = round(fare_cfg.cancellation_fee, 2)
            elif ride.status == RideStatus.RIDER_ARRIVED:
                cancellation_fee = round(fare_cfg.cancellation_fee, 2)

        ride.status = RideStatus.CANCELLED
        ride.cancelled_at = now
        ride.cancellation_reason = reason or "Cancelled by user"
        ride.cancelled_by = user_id
        ride.cancellation_fee = cancellation_fee

        # If cancellation fee applies, record pending payment for fee
        if cancellation_fee > 0:
            existing_p = db.query(Payment).filter(Payment.ride_id == ride.id).first()
            if existing_p:
                existing_p.amount = cancellation_fee
                existing_p.status = PaymentStatus.PENDING
            else:
                db.add(Payment(
                    ride_id=ride.id,
                    user_id=ride.passenger_id,
                    amount=cancellation_fee,
                    currency="INR",
                    method=PaymentMethod.CASH,
                    status=PaymentStatus.PENDING
                ))

        # 5. If rider was assigned, free rider up and notify
        if ride.rider_id:
            rider_user = db.query(User).filter(User.id == ride.rider_id).first()
            if rider_user and rider_user.rider_profile:
                rider_user.rider_profile.is_busy = False

        # 6. Expire any pending ride requests sent to riders
        db.query(RideRequest).filter(
            RideRequest.ride_id == ride.id,
            RideRequest.status.in_([RideRequestStatus.PENDING, "pending", "PENDING"])
        ).update({"status": RideRequestStatus.EXPIRED, "responded_at": now}, synchronize_session=False)

        # 7. Record status history audit trail
        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.CANCELLED,
            notes=f"Ride cancelled by {user_id}. Reason: {reason}. Cancellation fee: ₹{cancellation_fee}"
        ))

        db.commit()
        db.refresh(ride)

        ACTIVE_RIDE_OTPS.pop(ride.id, None)

        # 8. Broadcast cancellation to passenger and assigned rider
        await ws_manager.broadcast_ride_update(
            ride_id=ride.id,
            message={
                "event": "ride_cancelled",
                "ride_id": ride.id,
                "reason": reason or "Cancelled",
                "cancelled_by": user_id,
                "cancellation_fee": cancellation_fee
            },
            passenger_id=ride.passenger_id,
            rider_id=ride.rider_id
        )

        return ride

    @classmethod
    def format_ride_response(cls, ride: RideBooking, viewer_user_id: str) -> RideDetailsResponse:
        """Formats RideBooking database model into rich RideDetailsResponse."""
        passenger_summary = None
        if ride.passenger:
            passenger_summary = PassengerSummary(
                id=ride.passenger.id,
                full_name=ride.passenger.full_name,
                phone_number=ride.passenger.phone_number,
                rating=ride.passenger.passenger_profile.rating if ride.passenger.passenger_profile else 5.0
            )

        rider_summary = None
        if ride.rider and ride.rider.rider_profile:
            rp = ride.rider.rider_profile
            vehicle = ride.vehicle or (rp.vehicles[0] if rp.vehicles else None)
            
            # Compute ETA: Pickup ETA if arriving; Destination ETA if trip in progress
            eta_mins = None
            if rp.current_latitude and rp.current_longitude:
                if ride.status in (RideStatus.RIDER_ASSIGNED, RideStatus.RIDER_ARRIVING):
                    dist_to_p = LocationService.haversine_distance_km(
                        rp.current_latitude, rp.current_longitude,
                        ride.pickup_latitude, ride.pickup_longitude
                    )
                    eta_mins = max(1, int(round((dist_to_p / 25.0) * 60.0)))
                elif ride.status == RideStatus.IN_PROGRESS:
                    dist_to_d = LocationService.haversine_distance_km(
                        rp.current_latitude, rp.current_longitude,
                        ride.destination_latitude, ride.destination_longitude
                    )
                    eta_mins = max(1, int(round((dist_to_d / 25.0) * 60.0)))

            # Staleness check (> 30s)
            is_stale = False
            if rp.last_location_update:
                upd = rp.last_location_update.replace(tzinfo=timezone.utc) if rp.last_location_update.tzinfo is None else rp.last_location_update
                if (datetime.now(timezone.utc) - upd).total_seconds() > 30:
                    is_stale = True

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
                pickup_eta_mins=eta_mins,
                last_location_update=rp.last_location_update,
                is_stale=is_stale
            )

        # 4-digit OTP is exclusively displayed for the authenticated passenger prior to trip start
        otp = None
        if viewer_user_id == ride.passenger_id:
            if ride.status in (
                RideStatus.SEARCHING_FOR_RIDER,
                RideStatus.REQUESTS_SENT,
                RideStatus.EXPANDING_SEARCH,
                RideStatus.RIDER_ASSIGNED,
                RideStatus.RIDER_ARRIVING,
                RideStatus.RIDER_ARRIVED,
                RideStatus.OTP_VERIFICATION
            ):
                if getattr(ride, "otp_encrypted", None):
                    otp = decrypt_otp(ride.otp_encrypted, ride.id)
                if not otp:
                    otp = ACTIVE_RIDE_OTPS.get(ride.id)

        payment_status = None
        payment_method = None
        if getattr(ride, "payment", None):
            raw_status = ride.payment.status.value if hasattr(ride.payment.status, "value") else str(ride.payment.status)
            payment_status = raw_status.lower() if raw_status else None
            raw_method = ride.payment.method.value if hasattr(ride.payment.method, "value") else str(ride.payment.method)
            payment_method = raw_method.lower() if raw_method else None
        elif ride.status == RideStatus.COMPLETED:
            payment_status = "pending"
            payment_method = "cash"

        return RideDetailsResponse(
            id=ride.id,
            passenger_id=ride.passenger_id,
            rider_id=ride.rider_id,
            vehicle_category=ride.vehicle_category,
            pickup_address=ride.pickup_address,
            pickup_latitude=ride.pickup_latitude,
            pickup_longitude=ride.pickup_longitude,
            destination_address=ride.destination_address,
            destination_latitude=ride.destination_latitude,
            destination_longitude=ride.destination_longitude,
            route_polyline=ride.route_polyline,
            estimated_distance_km=ride.estimated_distance_km,
            estimated_duration_mins=ride.estimated_duration_mins,
            estimated_fare=ride.estimated_fare,
            boost_amount=ride.fare_breakdown.surge_amount if getattr(ride, "fare_breakdown", None) and ride.fare_breakdown.surge_amount else 0.0,
            actual_distance_km=ride.actual_distance_km,
            final_fare=ride.final_fare,
            status=ride.status,
            current_search_radius_km=ride.current_search_radius_km,
            otp=otp,
            pickup_otp=otp,
            passenger=passenger_summary,
            rider=rider_summary,
            created_at=ride.created_at,
            scheduled_for=getattr(ride, "scheduled_for", None),
            trip_started_at=ride.trip_started_at,
            ride_started_at=ride.trip_started_at,
            trip_completed_at=ride.trip_completed_at,
            ride_completed_at=ride.trip_completed_at,
            cancelled_at=ride.cancelled_at,
            cancellation_reason=ride.cancellation_reason,
            cancellation_fee=getattr(ride, "cancellation_fee", 0.0) or 0.0,
            cancelled_by=ride.cancelled_by,
            payment_status=payment_status,
            payment_method=payment_method
        )

    @classmethod
    async def dispatch_scheduled_rides(cls, db: Session, window_minutes: int = 20) -> List[RideBooking]:
        """
        Dispatches upcoming scheduled rides whose departure is within `window_minutes`.
        Transitions ride from SCHEDULED to SEARCHING_FOR_RIDER and triggers Stage 1 driver matching.
        """
        now = datetime.now(timezone.utc)
        dispatch_cutoff = now + timedelta(minutes=window_minutes)

        scheduled_rides = db.query(RideBooking).filter(
            RideBooking.status == RideStatus.SCHEDULED,
            RideBooking.scheduled_for <= dispatch_cutoff
        ).all()

        dispatched = []
        for ride in scheduled_rides:
            logger.info(f"Auto-dispatching scheduled ride {ride.id} (Scheduled for: {ride.scheduled_for})")
            ride.status = RideStatus.SEARCHING_FOR_RIDER
            ride.matching_started_at = now
            ride.current_search_radius_km = settings.INITIAL_MATCHING_RADIUS_KM
            ride.matching_stage = 1

            db.add(RideStatusHistory(
                ride_id=ride.id,
                status=RideStatus.SEARCHING_FOR_RIDER,
                notes=f"Auto-dispatched from schedule (scheduled for {ride.scheduled_for})"
            ))
            db.commit()
            db.refresh(ride)

            await MatchingService.dispatch_matching_requests(db, ride)
            dispatched.append(ride)

        return dispatched
