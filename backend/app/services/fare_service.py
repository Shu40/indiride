import math
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.fare import FareConfiguration
from app.models.vehicle import VehicleCategory
from app.schemas.fare import (
    FareEstimateResponse,
    VehicleFareEstimate,
    FareItemBreakdown,
    FareConfigUpdateRequest
)
from app.services.location_service import LocationService

logger = logging.getLogger(__name__)


class FareService:
    @staticmethod
    def get_or_create_config(db: Session, category: VehicleCategory) -> FareConfiguration:
        """Retrieves active fare configuration for vehicle category or defaults."""
        config = db.query(FareConfiguration).filter(
            FareConfiguration.vehicle_category == category,
            FareConfiguration.is_active == True
        ).first()

        if not config:
            if category == VehicleCategory.BIKE:
                default_rate = settings.DEFAULT_BIKE_RATE_PER_KM
                min_fare = settings.MIN_FARE_BIKE
                cancellation_fee = 20.0
            elif category == VehicleCategory.BULLET:
                default_rate = getattr(settings, 'DEFAULT_BULLET_RATE_PER_KM', 13.0)
                min_fare = getattr(settings, 'MIN_FARE_BULLET', 40.0)
                cancellation_fee = 25.0
            elif category == VehicleCategory.AUTO:
                default_rate = settings.DEFAULT_AUTO_RATE_PER_KM
                min_fare = settings.MIN_FARE_AUTO
                cancellation_fee = 30.0
            elif category == VehicleCategory.CAR_PRO:
                default_rate = getattr(settings, 'DEFAULT_CAR_PRO_RATE_PER_KM', 22.0)
                min_fare = getattr(settings, 'MIN_FARE_CAR_PRO', 90.0)
                cancellation_fee = 60.0
            else: # CAR
                default_rate = settings.DEFAULT_CAR_RATE_PER_KM
                min_fare = settings.MIN_FARE_CAR
                cancellation_fee = 50.0
            # Additional charges (base fare, waiting charges, taxes, surge, tolls) are initially disabled (0 / 1.0x)
            # unless explicitly configured by the administrator.
            config = FareConfiguration(
                vehicle_category=category,
                base_fare=0.0,
                per_km_rate=default_rate,
                per_minute_rate=0.0,
                min_fare=min_fare,
                cancellation_fee=cancellation_fee,
                waiting_charge_per_minute=0.0,
                tolls_and_parking=0.0,
                surge_multiplier=1.0,
                tax_percent=0.0,
                is_active=True
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @classmethod
    def calculate_single_fare(
        cls,
        config: FareConfiguration,
        distance_km: float,
        duration_minutes: float = 0.0,
        waiting_minutes: float = 0.0,
        surge_override: Optional[float] = None,
        promo_code: Optional[str] = None,
        user_completed_trips: Optional[int] = None,
        use_free_voucher: bool = False,
        is_diamond_member: bool = False
    ) -> FareItemBreakdown:
        """
        Calculates detailed fare breakdown according to platform rules:
        - Distance charge based strictly on actual road-route distance (Bike: ₹7/km, Car: ₹15/km, Auto: admin configured)
        - Base fare (initially 0 unless configured)
        - Waiting charges (initially 0 unless configured)
        - Minimum fare enforcement
        - Peak / surge pricing (initially 1.0x unless configured)
        - Tolls and parking charges (initially 0 unless configured)
        - Applicable taxes (initially 0% unless configured)
        - Auto-applied New User 90% discount on 1st ride (admin configured)
        - Loyalty Tier discounts (Bronze: 10%, Silver: 15%, Gold: 20%, Diamond: 25%)
        - Free Ride Vouchers (100% discount)
        - Promo code discounts (e.g. DIWALI50, COMMUTER20, RIDEINDIA)
        """
        rate_per_km = float(config.per_km_rate)
        base_fare = float(getattr(config, "base_fare", 0.0) or 0.0)
        min_fare = float(config.min_fare)
        waiting_rate = float(getattr(config, "waiting_charge_per_minute", 0.0) or 0.0)
        tolls_and_parking = float(getattr(config, "tolls_and_parking", 0.0) or 0.0)
        tax_percent = float(getattr(config, "tax_percent", 0.0) or 0.0)
        surge = surge_override if surge_override is not None else float(getattr(config, "surge_multiplier", 1.0) or 1.0)

        # 1. Road distance charge: actual road distance × per-km rate
        distance_fare = round(distance_km * rate_per_km, 2)

        # 2. Optional waiting charges (if configured)
        waiting_charge = round(waiting_minutes * waiting_rate, 2) if waiting_rate > 0 else 0.0

        # 3. Subtotal before surge and tax
        subtotal = round(base_fare + distance_fare + waiting_charge, 2)

        # 4. Enforce minimum fare
        if subtotal < min_fare:
            distance_fare = round(min_fare - base_fare - waiting_charge, 2)
            subtotal = min_fare

        # 5. Optional peak pricing / surge multiplier
        surge_multiplier = max(1.0, float(surge))
        if surge_multiplier > 1.0:
            surged_total = round(subtotal * surge_multiplier, 2)
            surge_amount = round(surged_total - subtotal, 2)
        else:
            surged_total = subtotal
            surge_amount = 0.0

        # 6. Optional tolls and parking charges
        post_tolls = round(surged_total + tolls_and_parking, 2)

        # 7. Applicable taxes (initially 0% unless configured)
        if tax_percent > 0.0:
            tax_amount = round((post_tolls * tax_percent) / 100.0, 2)
        else:
            tax_amount = 0.0

        total_before_discount = round(post_tolls + tax_amount, 2)

        # 8. User Loyalty & Automatic Discount Calculation
        # (New User 90% 1st Ride, Bronze 10%, Silver 15%, Gold 20%, Diamond 25%, Free Voucher)
        discount_amount = 0.0
        discount_code = None
        is_special_nominal_fare = False

        if use_free_voucher:
            # 100% Free Ride using awarded voucher
            discount_amount = total_before_discount
            discount_code = "FREE_RIDE_VOUCHER"
            is_special_nominal_fare = True
        elif user_completed_trips == 0:
            # New User 1st Ride Welcome Discount (Default 90% OFF, admin managed)
            try:
                from app.services.loyalty_service import LoyaltyService
                from app.database import SessionLocal
                with SessionLocal() as db_session:
                    new_user_cfg = LoyaltyService.get_or_create_new_user_config(db_session)
                    if new_user_cfg.is_active and new_user_cfg.discount_percent > 0:
                        pct = new_user_cfg.discount_percent / 100.0
                        raw_disc = round(total_before_discount * pct, 2)
                        applied_disc = min(float(new_user_cfg.max_discount_amount), raw_disc)
                        discount_amount = applied_disc
                        discount_code = f"NEW_USER_{int(new_user_cfg.discount_percent)}"
                        is_special_nominal_fare = True
            except Exception as e:
                logger.warning(f"Error checking new user discount config: {e}")
        elif user_completed_trips is not None and user_completed_trips >= 100:
            # User Tier Discount (Bronze 10%, Silver 15%, Gold 20%, Diamond 25%)
            try:
                from app.services.loyalty_service import LoyaltyService
                tier_info = LoyaltyService.calculate_tier_info(user_completed_trips, is_diamond_member)
                tier_pct = tier_info.get("discount_percent", 0.0)
                if tier_pct > 0:
                    raw_disc = round(total_before_discount * (tier_pct / 100.0), 2)
                    discount_amount = raw_disc
                    discount_code = f"{tier_info['tier_code']}_{int(tier_pct)}"
            except Exception as e:
                logger.warning(f"Error checking loyalty tier discount: {e}")

        # 9. Optional Manual Promo Code Calculation (Overrides if higher discount)
        if promo_code:
            code_clean = promo_code.strip().upper()
            promo_disc = 0.0
            # Check dynamic DB promo codes created by Admin
            try:
                from app.models.admin import PromoCode
                from app.database import SessionLocal
                with SessionLocal() as db_session:
                    db_promo = db_session.query(PromoCode).filter(PromoCode.code == code_clean, PromoCode.is_active == True).first()
                    if db_promo and total_before_discount >= db_promo.min_order_amount:
                        pct = db_promo.discount_percent / 100.0
                        raw_discount = round(total_before_discount * pct, 2)
                        promo_disc = min(db_promo.max_discount_amount, raw_discount)
            except Exception:
                pass

            if promo_disc <= 0.0:
                if code_clean in ["DIWALI5", "DIWALI"]:
                    promo_disc = round(total_before_discount * 0.05, 2)
                elif code_clean in ["CHHATH10", "CHHATH", "CHHATHPUJA", "CHHATHPUJA10"]:
                    promo_disc = round(total_before_discount * 0.10, 2)
                elif code_clean in ["CAMPUS20", "CAMPUS", "SELFRIDE"]:
                    promo_disc = round(total_before_discount * 0.20, 2)
                elif code_clean in ["DIWALI50"]:
                    promo_disc = round(total_before_discount * 0.05, 2)
                elif code_clean in ["COMMUTER20", "COMMUTER", "SAVEEVERYDAY"]:
                    promo_disc = round(total_before_discount * 0.20, 2)
                elif code_clean in ["RIDEINDIA", "FIRST50"]:
                    promo_disc = min(50.0, round(total_before_discount * 0.30, 2))

            if promo_disc > discount_amount:
                discount_amount = promo_disc
                discount_code = code_clean
                is_special_nominal_fare = False

        if is_special_nominal_fare:
            if discount_code == "FREE_RIDE_VOUCHER":
                final_total = 0.0
            else:
                # 90% discount allows fare down to nominal minimum (₹1)
                final_total = max(1.0, round(total_before_discount - discount_amount, 2))
        else:
            final_total = max(min_fare, round(total_before_discount - discount_amount, 2)) if discount_amount > 0 else total_before_discount

        return FareItemBreakdown(
            base_fare=base_fare,
            distance_km=distance_km,
            rate_per_km=rate_per_km,
            distance_fare=distance_fare,
            waiting_minutes=waiting_minutes,
            waiting_charge=waiting_charge,
            surge_multiplier=surge_multiplier,
            surge_amount=surge_amount,
            tolls_and_parking=tolls_and_parking,
            tax_percent=tax_percent,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            discount_code=discount_code,
            total_fare=final_total
        )


    @classmethod
    async def estimate_all_fares(
        cls,
        db: Session,
        pickup_lat: float,
        pickup_lng: float,
        dropoff_lat: float,
        dropoff_lng: float,
        promo_code: Optional[str] = None,
        ride_type: Optional[str] = "daily",
        user_completed_trips: Optional[int] = None,
        use_free_voucher: bool = False,
        is_diamond_member: bool = False,
        passenger_user_id: Optional[str] = None
    ) -> FareEstimateResponse:
        """
        Calculates road route distance using LocationService and returns transparent fare estimates
        for Bike (₹7/km), Car (₹15/km), and Auto with automatic user discounts (New User 90%, Bronze 10%,
        Silver 15%, Gold 20%, Diamond 25%, or Voucher).
        """
        # Lookup passenger profile if ID provided and completed trips not explicitly passed
        resolved_trips = user_completed_trips
        resolved_diamond = is_diamond_member
        vouchers_count = 0
        tier_code = None
        tier_name = None
        tier_badge = None
        auto_applied_label = None

        if passenger_user_id:
            try:
                from app.models.user import User
                from app.services.loyalty_service import LoyaltyService
                pass_user = db.query(User).filter(User.id == passenger_user_id).first()
                if pass_user and pass_user.passenger_profile:
                    resolved_trips = pass_user.passenger_profile.total_trips or 0
                    resolved_diamond = pass_user.passenger_profile.is_diamond_member or (resolved_trips >= 300)
                    vouchers_count = pass_user.passenger_profile.free_rides_vouchers or 0
                    tier_info = LoyaltyService.calculate_tier_info(resolved_trips, resolved_diamond)
                    tier_code = tier_info["tier_code"]
                    tier_name = tier_info["tier_name"]
                    tier_badge = tier_info["badge_title"]
                    if resolved_trips == 0:
                        auto_applied_label = "🎉 Flat 90% OFF Auto-Applied (1st Ride Special)"
                    elif tier_info.get("discount_percent", 0) > 0:
                        auto_applied_label = f"{tier_info['badge_title']} ({int(tier_info['discount_percent'])}% OFF Applied)"
            except Exception as e:
                logger.warning(f"Error fetching user loyalty profile for estimate: {e}")

        # 1. Road distance calculation
        route_resp = await LocationService.calculate_route(
            pickup_lat, pickup_lng, dropoff_lat, dropoff_lng
        )
        distance_km = route_resp.distance_km
        duration_mins = route_resp.duration_minutes

        # 2. Get active configurations
        bike_cfg = cls.get_or_create_config(db, VehicleCategory.BIKE)
        bullet_cfg = cls.get_or_create_config(db, VehicleCategory.BULLET)
        auto_cfg = cls.get_or_create_config(db, VehicleCategory.AUTO)
        car_cfg = cls.get_or_create_config(db, VehicleCategory.CAR)
        car_pro_cfg = cls.get_or_create_config(db, VehicleCategory.CAR_PRO)

        # 3. Compute estimates with user discount
        bike_breakdown = cls.calculate_single_fare(
            bike_cfg, distance_km, duration_mins, promo_code=promo_code,
            user_completed_trips=resolved_trips, use_free_voucher=use_free_voucher, is_diamond_member=resolved_diamond
        )
        bullet_breakdown = cls.calculate_single_fare(
            bullet_cfg, distance_km, duration_mins, promo_code=promo_code,
            user_completed_trips=resolved_trips, use_free_voucher=use_free_voucher, is_diamond_member=resolved_diamond
        )
        auto_breakdown = cls.calculate_single_fare(
            auto_cfg, distance_km, duration_mins, promo_code=promo_code,
            user_completed_trips=resolved_trips, use_free_voucher=use_free_voucher, is_diamond_member=resolved_diamond
        )
        car_breakdown = cls.calculate_single_fare(
            car_cfg, distance_km, duration_mins, promo_code=promo_code,
            user_completed_trips=resolved_trips, use_free_voucher=use_free_voucher, is_diamond_member=resolved_diamond
        )
        car_pro_breakdown = cls.calculate_single_fare(
            car_pro_cfg, distance_km, duration_mins, promo_code=promo_code,
            user_completed_trips=resolved_trips, use_free_voucher=use_free_voucher, is_diamond_member=resolved_diamond
        )

        estimates = [
            VehicleFareEstimate(
                category=VehicleCategory.BIKE,
                display_name="General Moto (₹7/km)",
                capacity=1,
                eta_minutes=max(2, int(duration_mins * 0.7)),
                icon="two-wheeler",
                rate_per_km=bike_cfg.per_km_rate,
                distance_km=distance_km,
                duration_minutes=duration_mins,
                estimated_fare=bike_breakdown.total_fare,
                original_fare=round(bike_breakdown.total_fare + bike_breakdown.discount_amount, 2) if bike_breakdown.discount_amount > 0 else None,
                discount_amount=bike_breakdown.discount_amount,
                fare_breakdown=bike_breakdown,
                available=True,
                description="Hero Splendor, Shine, Platina — Fastest solo commute @ ₹7/km"
            ),
            VehicleFareEstimate(
                category=VehicleCategory.BULLET,
                display_name="Bullet / KTM (₹13/km)",
                capacity=1,
                eta_minutes=max(2, int(duration_mins * 0.65)),
                icon="two-wheeler",
                rate_per_km=bullet_cfg.per_km_rate,
                distance_km=distance_km,
                duration_minutes=duration_mins,
                estimated_fare=bullet_breakdown.total_fare,
                original_fare=round(bullet_breakdown.total_fare + bullet_breakdown.discount_amount, 2) if bullet_breakdown.discount_amount > 0 else None,
                discount_amount=bullet_breakdown.discount_amount,
                fare_breakdown=bullet_breakdown,
                available=True,
                description="Royal Enfield Classic, Bullet, KTM Duke @ ₹13/km"
            ),
            VehicleFareEstimate(
                category=VehicleCategory.AUTO,
                display_name="Auto Rickshaw (₹10/km)",
                capacity=3,
                eta_minutes=max(3, int(duration_mins * 0.9)),
                icon="electric-rickshaw",
                rate_per_km=auto_cfg.per_km_rate,
                distance_km=distance_km,
                duration_minutes=duration_mins,
                estimated_fare=auto_breakdown.total_fare,
                original_fare=round(auto_breakdown.total_fare + auto_breakdown.discount_amount, 2) if auto_breakdown.discount_amount > 0 else None,
                discount_amount=auto_breakdown.discount_amount,
                fare_breakdown=auto_breakdown,
                available=True,
                description="Affordable doorstep 3-seater auto rides @ ₹10/km"
            ),
            VehicleFareEstimate(
                category=VehicleCategory.CAR,
                display_name="Normal Car (Go) (₹15/km)",
                capacity=4,
                eta_minutes=max(4, int(duration_mins)),
                icon="local-taxi",
                rate_per_km=car_cfg.per_km_rate,
                distance_km=distance_km,
                duration_minutes=duration_mins,
                estimated_fare=car_breakdown.total_fare,
                original_fare=round(car_breakdown.total_fare + car_breakdown.discount_amount, 2) if car_breakdown.discount_amount > 0 else None,
                discount_amount=car_breakdown.discount_amount,
                fare_breakdown=car_breakdown,
                available=True,
                description="Maruti Swift, WagonR, Tiago AC cab @ ₹15/km"
            ),
            VehicleFareEstimate(
                category=VehicleCategory.CAR_PRO,
                display_name="Pro Car / Sedan (₹22/km)",
                capacity=4,
                eta_minutes=max(3, int(duration_mins * 0.95)),
                icon="local-taxi",
                rate_per_km=car_pro_cfg.per_km_rate,
                distance_km=distance_km,
                duration_minutes=duration_mins,
                estimated_fare=car_pro_breakdown.total_fare,
                original_fare=round(car_pro_breakdown.total_fare + car_pro_breakdown.discount_amount, 2) if car_pro_breakdown.discount_amount > 0 else None,
                discount_amount=car_pro_breakdown.discount_amount,
                fare_breakdown=car_pro_breakdown,
                available=True,
                description="Innova Crysta, Honda City, Ertiga Premium AC @ ₹22/km"
            )
        ]

        # Use applied discount code from breakdown if set
        effective_promo = bike_breakdown.discount_code or promo_code

        return FareEstimateResponse(
            pickup_latitude=pickup_lat,
            pickup_longitude=pickup_lng,
            dropoff_latitude=dropoff_lat,
            dropoff_longitude=dropoff_lng,
            distance_km=distance_km,
            duration_minutes=duration_mins,
            estimates=estimates,
            route_geometry=route_resp.route_geometry,
            applied_promo=effective_promo,
            user_tier_code=tier_code,
            user_tier_name=tier_name,
            user_tier_badge=tier_badge,
            auto_discount_applied=auto_applied_label,
            free_rides_vouchers=vouchers_count
        )

