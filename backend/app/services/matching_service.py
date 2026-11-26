import math
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple, Dict, Any, Set
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status

from app.config import settings
from app.models.ride import RideBooking, RideRequest, RideStatus, RideStatusHistory, RideRequestStatus
from app.models.user import User, UserRole, RiderApprovalStatus, RiderProfile
from app.models.vehicle import Vehicle, VehicleCategory
from app.services.location_service import LocationService
from app.services.websocket_manager import ws_manager
from app.services.redis_service import redis_service
from app.services.mongo_service import mongo_service

logger = logging.getLogger(__name__)


class MatchingService:
    @classmethod
    def get_effective_radius(cls, base_radius_km: float) -> float:
        """
        Determines the effective search radius.
        - If settings.ENABLE_TRAFFIC_AWARE_EXPANSION is True, applies configured
          traffic congestion multiplier (e.g. 1.25x).
        - If traffic information is unavailable (default for OSRM / OpenStreetMap
          which does not provide real-time dynamic traffic feeds), it uses the standard
          matching policy (Stage 1: 2.0 km, Stage 2: 3.0 km).
        """
        if settings.ENABLE_TRAFFIC_AWARE_EXPANSION:
            return round(base_radius_km * settings.TRAFFIC_CONGESTION_RADIUS_MULTIPLIER, 2)
        return float(base_radius_km)

    @classmethod
    def find_eligible_riders(
        cls,
        db: Session,
        pickup_lat: float,
        pickup_lng: float,
        category: VehicleCategory,
        max_radius_km: float = 2.0,
        exclude_rider_ids: Optional[Set[str]] = None
    ) -> List[Tuple[RiderProfile, float]]:
        """
        Geographic Query System:
        - Uses bounding box envelope for fast spatial indexing
        - Computes exact haversine distance <= max_radius_km
        - Matches vehicle category exactly
        - Only includes riders who are online (is_online=True), approved (APPROVED),
          available (is_busy=False) and NOT assigned to another active ride in the database.
        - Excludes any rider IDs in exclude_rider_ids to avoid duplicate requests.
        - Returns list of (RiderProfile, distance_km) sorted by closest proximity.
        """
        exclude_ids = set(exclude_rider_ids or set())

        # 1. Geographic bounding box envelope
        lat_delta = max_radius_km / 111.0
        cos_lat = math.cos(math.radians(pickup_lat))
        lng_delta = max_radius_km / (111.0 * max(0.01, abs(cos_lat)))

        min_lat = pickup_lat - lat_delta
        max_lat = pickup_lat + lat_delta
        min_lng = pickup_lng - lng_delta
        max_lng = pickup_lng + lng_delta

        # 2. Exclude riders currently assigned to an active trip in DB
        active_rider_ids = {
            r[0] for r in db.query(RideBooking.rider_id).filter(
                RideBooking.rider_id.isnot(None),
                RideBooking.status.in_([
                    RideStatus.RIDER_ARRIVING,
                    RideStatus.RIDER_ARRIVED,
                    RideStatus.OTP_VERIFICATION,
                    RideStatus.IN_PROGRESS
                ])
            ).all()
        }
        all_excluded = exclude_ids.union(active_rider_ids)

        # 3. Query approved, online, available riders matching vehicle category within bbox
        matching_categories = [category]
        if category == VehicleCategory.BULLET:
            matching_categories = [VehicleCategory.BULLET, VehicleCategory.BIKE]
        elif category == VehicleCategory.BIKE:
            matching_categories = [VehicleCategory.BIKE, VehicleCategory.BULLET]
        elif category == VehicleCategory.CAR_PRO:
            matching_categories = [VehicleCategory.CAR_PRO, VehicleCategory.CAR]
        elif category == VehicleCategory.CAR:
            matching_categories = [VehicleCategory.CAR, VehicleCategory.CAR_PRO]

        query = (
            db.query(RiderProfile)
            .join(User, User.id == RiderProfile.user_id)
            .join(Vehicle, Vehicle.rider_id == RiderProfile.id)
            .filter(
                User.is_active == True,
                RiderProfile.status == RiderApprovalStatus.APPROVED,
                RiderProfile.is_online == True,
                RiderProfile.is_busy == False,
                Vehicle.category.in_(matching_categories),
                Vehicle.is_active == True,
                RiderProfile.current_latitude.isnot(None),
                RiderProfile.current_longitude.isnot(None),
                RiderProfile.current_latitude.between(min_lat, max_lat),
                RiderProfile.current_longitude.between(min_lng, max_lng)
            )
        )
        candidates = query.all()

        # 4. DSA Priority Queue Ranking (Max-Heap based on Composite Dispatch Metric)
        # Score = (1.0 / (1.0 + distance_km)) * 0.70 + (rating / 5.0) * 0.30
        # Guarantees closest, highest-rated verified drivers receive highest priority
        import heapq
        candidate_heap: List[Tuple[float, float, str, RiderProfile]] = []

        for rider in candidates:
            if rider.user_id in all_excluded:
                continue

            dist = LocationService.haversine_distance_km(
                pickup_lat, pickup_lng,
                rider.current_latitude, rider.current_longitude
            )
            if dist <= max_radius_km:
                rating = float(getattr(rider, 'rating', 5.0) or 5.0)
                # Composite normalized dispatch score in [0.0, 1.0]
                proximity_score = 1.0 / (1.0 + dist)
                rating_score = min(1.0, max(0.0, rating / 5.0))
                composite_score = round((proximity_score * 0.70) + (rating_score * 0.30), 4)

                # Push into min-heap with negative composite score to simulate Max-Heap
                heapq.heappush(candidate_heap, (-composite_score, dist, rider.id, rider))

        # Extract candidates in strictly descending priority order
        matched: List[Tuple[RiderProfile, float]] = []
        while candidate_heap:
            neg_score, dist, _, rider = heapq.heappop(candidate_heap)
            matched.append((rider, round(dist, 2)))

        return matched

    @classmethod
    async def _send_ride_invitations(
        cls,
        db: Session,
        ride: RideBooking,
        matched_riders: List[Tuple[RiderProfile, float]],
        search_radius_km: float,
        now: datetime,
        expires_at: datetime
    ) -> int:
        """Helper to create persistent RideRequest entries and dispatch real-time WebSocket invitations."""
        passenger = db.query(User).filter(User.id == ride.passenger_id).first()
        passenger_name = passenger.full_name if passenger else "Passenger"
        passenger_phone = passenger.phone_number if passenger else "+91 91111 11111"

        sent_count = 0
        for rider_profile, distance_to_pickup in matched_riders:
            req = RideRequest(
                ride_id=ride.id,
                rider_id=rider_profile.user_id,
                status=RideRequestStatus.PENDING,
                search_radius_km=search_radius_km,
                sent_at=now,
                expires_at=expires_at
            )
            db.add(req)
            sent_count += 1

            boost_amt = ride.fare_breakdown.surge_amount if getattr(ride, "fare_breakdown", None) and ride.fare_breakdown.surge_amount else 0.0

            # Real-time WebSocket invitation to rider
            payload = {
                "event": "ride_incoming",
                "ride_id": ride.id,
                "pickup_address": ride.pickup_address,
                "pickup_latitude": ride.pickup_latitude,
                "pickup_longitude": ride.pickup_longitude,
                "destination_address": ride.destination_address,
                "destination_latitude": ride.destination_latitude,
                "destination_longitude": ride.destination_longitude,
                "distance_to_pickup_km": round(distance_to_pickup, 1),
                "trip_distance_km": round(ride.estimated_distance_km, 1),
                "estimated_fare": round(ride.estimated_fare, 2),
                "boost_amount": round(boost_amt, 2),
                "vehicle_category": ride.vehicle_category.value,
                "expires_in_seconds": settings.RIDER_REQUEST_EXPIRY_SEC,
                "passenger": {
                    "id": ride.passenger_id,
                    "full_name": passenger_name,
                    "phone_number": passenger_phone,
                    "rating": 5.0
                }
            }
            await ws_manager.send_to_user(rider_profile.user_id, payload)

        return sent_count

    @classmethod
    async def dispatch_matching_requests(cls, db: Session, ride: RideBooking) -> int:
        """
        STAGE 1:
        - Search for eligible riders within 2 km of pickup location (capped at max 3.0 km).
        - Match selected vehicle category.
        - Exclude riders who rejected within the last 60 seconds.
        - Send ride requests with expiration timestamp.
        - Show booking searching status to passenger.
        - Sets matching_started_at and matching_stage = 1.
        """
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=settings.RIDER_REQUEST_EXPIRY_SEC)

        # Strictly limit search radius to 2.0 km (max 3.0 km)
        radius = min(3.0, cls.get_effective_radius(settings.INITIAL_MATCHING_RADIUS_KM))
        ride.matching_stage = 1
        ride.current_search_radius_km = radius

        # Exclude riders who rejected this ride within the last 60 seconds
        recent_rejects = {
            r[0] for r in db.query(RideRequest.rider_id).filter(
                RideRequest.ride_id == ride.id,
                RideRequest.status == RideRequestStatus.REJECTED,
                RideRequest.responded_at >= now - timedelta(seconds=60)
            ).all()
        }

        matched_riders = cls.find_eligible_riders(
            db=db,
            pickup_lat=ride.pickup_latitude,
            pickup_lng=ride.pickup_longitude,
            category=ride.vehicle_category,
            max_radius_km=radius,
            exclude_rider_ids=recent_rejects
        )

        if matched_riders:
            ride.status = RideStatus.REQUESTS_SENT
            notes = f"Stage 1: Dispatched requests to {len(matched_riders)} riders within {radius} km"
        else:
            ride.status = RideStatus.SEARCHING_FOR_RIDER
            notes = f"Stage 1: Searching for eligible riders within {radius} km"

        db.add(RideStatusHistory(ride_id=ride.id, status=ride.status, notes=notes))

        sent_count = await cls._send_ride_invitations(db, ride, matched_riders, radius, now, expires_at)
        db.commit()

        # Notify passenger of matching start
        await ws_manager.send_to_user(ride.passenger_id, {
            "event": "ride_matching_started",
            "ride_id": ride.id,
            "status": ride.status.value,
            "stage": 1,
            "search_radius_km": radius,
            "riders_notified": sent_count,
            "stage_window_seconds": settings.INITIAL_MATCHING_DURATION_SEC,
            "timeout_seconds": settings.MAX_BOOKING_TIMEOUT_SEC
        })

        return sent_count

    @classmethod
    async def expand_to_stage_2(cls, db: Session, ride: RideBooking) -> int:
        """
        STAGE 2:
        - If no eligible rider accepts within initial matching window (3 minutes),
          expand the radius to maximum 3.0 kilometres.
        - Notify eligible riders in the expanded area.
        - Avoid sending duplicate requests to the same rider within 60s cooldown.
        - Notify passenger of radius expansion.
        """
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=settings.RIDER_REQUEST_EXPIRY_SEC)

        # Strictly capped at max 3.0 km
        radius = min(3.0, cls.get_effective_radius(settings.EXPANDED_MATCHING_RADIUS_KM))
        ride.matching_stage = 2
        ride.status = RideStatus.EXPANDING_SEARCH
        ride.current_search_radius_km = radius

        # Track riders who were already sent requests OR rejected within 60 seconds
        already_contacted_ids = {
            r[0] for r in db.query(RideRequest.rider_id).filter(
                RideRequest.ride_id == ride.id,
                (RideRequest.status == RideRequestStatus.PENDING) |
                ((RideRequest.status == RideRequestStatus.REJECTED) & (RideRequest.responded_at >= now - timedelta(seconds=60)))
            ).all()
        }

        matched_riders = cls.find_eligible_riders(
            db=db,
            pickup_lat=ride.pickup_latitude,
            pickup_lng=ride.pickup_longitude,
            category=ride.vehicle_category,
            max_radius_km=radius,
            exclude_rider_ids=already_contacted_ids
        )

        notes = f"Stage 2: Expanded radius to {radius} km. Found {len(matched_riders)} additional riders."
        db.add(RideStatusHistory(ride_id=ride.id, status=RideStatus.EXPANDING_SEARCH, notes=notes))

        sent_count = await cls._send_ride_invitations(db, ride, matched_riders, radius, now, expires_at)
        db.commit()

        # Notify passenger of search expansion
        await ws_manager.send_to_user(ride.passenger_id, {
            "event": "ride_search_expanded",
            "ride_id": ride.id,
            "status": RideStatus.EXPANDING_SEARCH.value,
            "stage": 2,
            "search_radius_km": radius,
            "additional_riders_notified": sent_count
        })

        return sent_count

    @classmethod
    async def handle_booking_timeout(
        cls,
        db: Session,
        ride: RideBooking,
        reason: str = "No nearby drivers accepted within the matching window."
    ) -> RideBooking:
        """
        Marks booking as NO_RIDER_AVAILABLE when booking timeout expires or no riders are found.
        Expires all pending requests.
        Notifies passenger.
        """
        now = datetime.now(timezone.utc)
        ride.status = RideStatus.NO_RIDER_AVAILABLE

        # Expire any remaining pending requests
        db.query(RideRequest).filter(
            RideRequest.ride_id == ride.id,
            RideRequest.status == RideRequestStatus.PENDING
        ).update({"status": RideRequestStatus.EXPIRED, "responded_at": now})

        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.NO_RIDER_AVAILABLE,
            notes=f"Booking timeout: {reason}"
        ))
        db.commit()

        # Notify passenger
        await ws_manager.send_to_user(ride.passenger_id, {
            "event": "no_rider_available",
            "ride_id": ride.id,
            "status": RideStatus.NO_RIDER_AVAILABLE.value,
            "reason": reason
        })

        return ride

    @classmethod
    async def check_and_progress_ride(cls, db: Session, ride_id: str) -> Optional[RideBooking]:
        """
        Evaluates the matching timeline for an active ride:
        - Accurately tracks elapsed time from ride.matching_started_at (persisted on backend).
        - If elapsed >= 180s (3 minutes) and matching_stage == 1: expands to Stage 2 (3km).
        - If elapsed >= 300s (5 minutes): transitions to NO_RIDER_AVAILABLE timeout.
        - Does NOT restart the 3-minute timer on frontend refresh.
        """
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
        if not ride:
            return None

        if ride.status not in (RideStatus.SEARCHING_FOR_RIDER, RideStatus.REQUESTS_SENT, RideStatus.EXPANDING_SEARCH):
            return ride

        now = datetime.now(timezone.utc)
        started = ride.matching_started_at.replace(tzinfo=timezone.utc) if ride.matching_started_at.tzinfo is None else ride.matching_started_at
        elapsed_sec = (now - started).total_seconds()

        # 1. Booking Timeout Check (5 minutes total)
        if elapsed_sec >= settings.MAX_BOOKING_TIMEOUT_SEC:
            return await cls.handle_booking_timeout(
                db, ride,
                reason=f"Booking timed out after {int(elapsed_sec)} seconds. No driver available."
            )

        # 2. Stage 1 -> Stage 2 Expansion (3 minutes initial window)
        if elapsed_sec >= settings.INITIAL_MATCHING_DURATION_SEC and ride.matching_stage == 1:
            await cls.expand_to_stage_2(db, ride)
            return ride

        # 3. Clean up expired requests within current stage
        expired_reqs = db.query(RideRequest).filter(
            RideRequest.ride_id == ride.id,
            RideRequest.status == RideRequestStatus.PENDING,
            RideRequest.expires_at < now
        ).all()
        if expired_reqs:
            for req in expired_reqs:
                req.status = RideRequestStatus.EXPIRED
                req.responded_at = now
            db.commit()

        return ride

    @classmethod
    async def atomic_accept_ride(
        cls,
        db: Session,
        ride_id: str,
        rider_user_id: str
    ) -> Tuple[RideBooking, str]:
        """
        Atomically handles rider acceptance:
        - Database row-level lock (with_for_update)
        - Guarantees that only ONE rider wins a booking
        - Validates request has not expired
        - Validates rider is online, available, and not already busy
        - Marks rider profile is_busy = True
        - Cancels/expires competing requests immediately after assignment
        - Broadcasts confirmation to passenger and winning rider
        """
        # 0. Redis Distributed Lock for atomic FIFO concurrency control
        if not redis_service.acquire_ride_lock(ride_id, rider_user_id, ttl_ms=15000):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ride has already been accepted by another driver. Best of luck for next ride!"
            )

        # Lock ride record in relational database
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).with_for_update().first()
        if not ride:
            redis_service.release_ride_lock(ride_id, rider_user_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found.")

        now = datetime.now(timezone.utc)

        # Check if already accepted or cancelled
        if ride.status not in (RideStatus.SEARCHING_FOR_RIDER, RideStatus.REQUESTS_SENT, RideStatus.EXPANDING_SEARCH):
            redis_service.release_ride_lock(ride_id, rider_user_id)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ride has already been accepted by another rider or cancelled."
            )

        # Check request invitation and expiration: Rider can ONLY accept authorized requests
        ride_req = db.query(RideRequest).filter(
            RideRequest.ride_id == ride.id,
            RideRequest.rider_id == rider_user_id
        ).first()

        if not ride_req:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: You cannot accept this ride because no invitation was dispatched to your account."
            )

        expires = ride_req.expires_at.replace(tzinfo=timezone.utc) if ride_req.expires_at.tzinfo is None else ride_req.expires_at
        if now > expires or ride_req.status == RideRequestStatus.EXPIRED:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This ride request invitation has expired. You cannot accept an expired request."
            )

        # Validate Rider eligibility
        rider_user = db.query(User).filter(User.id == rider_user_id).first()
        if not rider_user or not rider_user.rider_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a registered rider.")

        rider_profile = rider_user.rider_profile
        if not rider_profile.is_online:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rider is currently offline.")

        if rider_profile.is_busy:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rider is already busy on an active trip.")

        rider_active_ride = db.query(RideBooking).filter(
            RideBooking.rider_id == rider_user.id,
            RideBooking.status.in_([
                RideStatus.RIDER_ARRIVING,
                RideStatus.RIDER_ARRIVED,
                RideStatus.OTP_VERIFICATION,
                RideStatus.IN_PROGRESS
            ])
        ).first()
        if rider_active_ride:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Rider is already on an active trip. Complete it first.")

        # Fetch rider's vehicle
        vehicle = db.query(Vehicle).filter(
            Vehicle.rider_id == rider_profile.id,
            Vehicle.is_active == True
        ).first()

        # Update Ride State
        ride.rider_id = rider_user.id
        ride.vehicle_id = vehicle.id if vehicle else None
        ride.status = RideStatus.RIDER_ARRIVING
        ride.rider_assigned_at = now

        # Mark Rider busy
        rider_profile.is_busy = True

        # Cancel/expire all competing requests after assignment
        competing_requests = db.query(RideRequest).filter(
            RideRequest.ride_id == ride.id,
            RideRequest.rider_id != rider_user.id
        ).all()
        for comp_req in competing_requests:
            comp_req.status = RideRequestStatus.EXPIRED
            comp_req.responded_at = now

        # Mark winning request as accepted
        if ride_req:
            ride_req.status = RideRequestStatus.ACCEPTED
            ride_req.responded_at = now
        else:
            db.query(RideRequest).filter(
                RideRequest.ride_id == ride.id,
                RideRequest.rider_id == rider_user.id
            ).update({"status": RideRequestStatus.ACCEPTED, "responded_at": now})

        # Record history
        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.RIDER_ARRIVING,
            notes=f"Rider {rider_user.full_name} accepted ride."
        ))

        db.commit()
        db.refresh(ride)

        # Remove from Redis queue & log to Mongo Audit
        redis_service.remove_from_queue(ride.id)
        mongo_service.log_ride_event(
            ride_id=ride.id,
            event_type="ride_accepted",
            actor_id=rider_user_id,
            details={
                "rider_id": rider_user_id,
                "passenger_id": ride.passenger_id,
                "fare": ride.estimated_fare
            }
        )

        # Calculate initial driver to pickup route and ETA
        pickup_eta = 3
        driver_route = None
        if rider_profile.current_latitude and rider_profile.current_longitude:
            try:
                from app.services.location_service import LocationService
                route_res = await LocationService.calculate_route(
                    rider_profile.current_latitude,
                    rider_profile.current_longitude,
                    ride.pickup_latitude,
                    ride.pickup_longitude
                )
                driver_route = route_res.route_geometry
                pickup_eta = max(1, int(round(route_res.duration_minutes)))
            except Exception:
                from app.services.location_service import LocationService
                dist_km = LocationService.haversine_distance_km(
                    rider_profile.current_latitude,
                    rider_profile.current_longitude,
                    ride.pickup_latitude,
                    ride.pickup_longitude
                )
                pickup_eta = max(1, int(round((dist_km / 25.0) * 60.0)))

        # Notify passenger via WebSocket
        acceptance_event = {
            "event": "ride_accepted",
            "ride_id": ride.id,
            "status": ride.status.value,
            "pickup_eta_mins": pickup_eta,
            "driver_route": driver_route,
            "rider": {
                "id": rider_user.id,
                "full_name": rider_user.full_name,
                "profile_photo": getattr(rider_user, "profile_photo", None) or "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
                "phone_number": rider_user.phone_number,
                "rating": rider_profile.rating,
                "vehicle_category": ride.vehicle_category.value,
                "vehicle_plate": vehicle.license_plate if vehicle else "KA-01-EK-8892",
                "vehicle_model": vehicle.model if vehicle else "Hero Splendor / Swift",
                "current_latitude": rider_profile.current_latitude,
                "current_longitude": rider_profile.current_longitude,
                "latitude": rider_profile.current_latitude,
                "longitude": rider_profile.current_longitude,
                "pickup_eta_mins": pickup_eta,
                "last_location_update": rider_profile.last_location_update.isoformat() if rider_profile.last_location_update else None,
                "is_stale": False
            }
        }
        await ws_manager.send_to_user(ride.passenger_id, acceptance_event)

        # Notify rider
        await ws_manager.send_to_user(rider_user.id, {
            "event": "ride_confirmed_for_rider",
            "ride_id": ride.id,
            "pickup_address": ride.pickup_address,
            "pickup_latitude": ride.pickup_latitude,
            "pickup_longitude": ride.pickup_longitude,
            "destination_address": ride.destination_address,
            "destination_latitude": ride.destination_latitude,
            "destination_longitude": ride.destination_longitude,
            "passenger_name": ride.passenger.full_name if ride.passenger else "Passenger",
            "passenger_phone": ride.passenger.phone_number if ride.passenger else ""
        })

        # Notify competing riders that ride was taken
        for comp_req in competing_requests:
            await ws_manager.send_to_user(comp_req.rider_id, {
                "event": "ride_taken_by_another",
                "ride_id": ride.id
            })

        return ride, rider_user.full_name

    @classmethod
    async def reject_ride(cls, db: Session, ride_id: str, rider_user_id: str) -> Dict[str, Any]:
        """
        Rider rejects an incoming ride request.
        Marks RideRequest as REJECTED.
        Checks if stage should advance.
        """
        now = datetime.now(timezone.utc)
        req = db.query(RideRequest).filter(
            RideRequest.ride_id == ride_id,
            RideRequest.rider_id == rider_user_id
        ).first()

        if not req:
            raise HTTPException(status_code=404, detail="Ride request not found for this rider.")

        req.status = RideRequestStatus.REJECTED
        req.responded_at = now
        db.commit()

        # Check if ride should progress
        await cls.check_and_progress_ride(db, ride_id)

        return {"status": "rejected", "ride_id": ride_id, "rider_id": rider_user_id}

    @classmethod
    async def cancel_ride_matching(cls, db: Session, ride_id: str, user_id: str, reason: str = "Passenger cancelled"):
        """
        User cancels while matching is in progress.
        Expires all pending requests, notifies invited riders, notifies passenger.
        """
        now = datetime.now(timezone.utc)
        ride = db.query(RideBooking).filter(RideBooking.id == ride_id).first()
        if not ride:
            return None

        ride.status = RideStatus.CANCELLED
        ride.cancelled_at = now
        ride.cancelled_by = user_id
        ride.cancellation_reason = reason

        pending_requests = db.query(RideRequest).filter(
            RideRequest.ride_id == ride.id,
            RideRequest.status == RideRequestStatus.PENDING
        ).all()

        for req in pending_requests:
            req.status = RideRequestStatus.EXPIRED
            req.responded_at = now
            await ws_manager.send_to_user(req.rider_id, {
                "event": "ride_cancelled",
                "ride_id": ride.id,
                "reason": reason
            })

        db.add(RideStatusHistory(
            ride_id=ride.id,
            status=RideStatus.CANCELLED,
            notes=f"Cancelled by user: {reason}"
        ))
        db.commit()

        await ws_manager.send_to_user(ride.passenger_id, {
            "event": "ride_cancelled",
            "ride_id": ride.id,
            "status": RideStatus.CANCELLED.value,
            "reason": reason
        })
        return ride
