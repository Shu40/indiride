from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging
import uuid

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.api.auth import router as auth_router
from app.api.location import router as location_router
from app.api.fare import router as fare_router
from app.api.rides import router as rides_router
from app.api.rider import router as rider_router
from app.api.websocket import router as websocket_router
from app.api.admin import router as admin_router
from app.api.community_rides import router as community_rides_router
from app.api.campus_rides import router as campus_rides_router
from app.api.payments import router as payments_router
from app.api.documents import router as documents_router
from app.api.loyalty import router as loyalty_router

from app.models.fare import FareConfiguration
from app.models.vehicle import Vehicle, VehicleCategory
from app.models.user import User, UserRole, RiderProfile, RiderApprovalStatus, PassengerProfile
from app.models.campus import University, Campus, CampusRideAlert, RecurringRideSchedule, PassengerRideRequest
from datetime import datetime, timedelta, timezone
import json
from app.models.festival import FestivalCampaign
from app.models.admin import PromoCode
from app.models.community_ride import CommunityRide
from app.models.ride import RideBooking, RideStatus
from app.utils.security import hash_password


def seed_initial_data(db: Session):
    """Seeds default fare rates (Bike: ₹7/km, Car: ₹15/km), user loyalty tiers, and default admin."""
    is_sqlite = db.bind.dialect.name == "sqlite"
    bool_def = "0" if is_sqlite else "FALSE"
    dt_type = "DATETIME" if is_sqlite else "TIMESTAMP"

    # Ensure loyalty columns exist on passenger_profiles
    try:
        from sqlalchemy import text
        cols_to_check = [
            ("loyalty_tier", "VARCHAR(30) DEFAULT 'NEW_USER'"),
            ("free_rides_vouchers", "INTEGER DEFAULT 0"),
            ("total_discount_saved", "FLOAT DEFAULT 0.0"),
            ("is_diamond_member", f"BOOLEAN DEFAULT {bool_def}")
        ]
        for col, col_type in cols_to_check:
            try:
                db.execute(text(f"ALTER TABLE passenger_profiles ADD COLUMN {col} {col_type}"))
                db.commit()
            except Exception:
                db.rollback()
    except Exception as e:
        logger.warning(f"Loyalty schema migration note: {e}")

    # Ensure columns exist on festival_campaigns
    try:
        from sqlalchemy import text
        fest_cols = [
            ("start_date", dt_type),
            ("end_date", dt_type),
            ("banner_title", "VARCHAR(150)"),
            ("banner_subtitle", "VARCHAR(255)")
        ]
        for col, col_type in fest_cols:
            try:
                db.execute(text(f"ALTER TABLE festival_campaigns ADD COLUMN {col} {col_type}"))
                db.commit()
            except Exception:
                db.rollback()
    except Exception as e:
        logger.warning(f"Festival schema migration note: {e}")

    # Seed New User 90% Discount Configuration
    try:
        from app.services.loyalty_service import LoyaltyService
        LoyaltyService.get_or_create_new_user_config(db)
    except Exception as e:
        logger.warning(f"Error seeding new user discount config: {e}")

    # Seed Bike Fare Config (₹7/km base rule)
    bike_config = db.query(FareConfiguration).filter(FareConfiguration.vehicle_category == VehicleCategory.BIKE).first()
    if not bike_config:
        db.add(FareConfiguration(
            vehicle_category=VehicleCategory.BIKE,
            base_fare=0.0,
            per_km_rate=settings.DEFAULT_BIKE_RATE_PER_KM,  # ₹7/km
            min_fare=settings.MIN_FARE_BIKE,
            cancellation_fee=20.0,
            surge_multiplier=1.0,
            tax_percent=5.0,
            is_active=True
        ))

    # Seed Car Fare Config (₹15/km base rule)
    car_config = db.query(FareConfiguration).filter(FareConfiguration.vehicle_category == VehicleCategory.CAR).first()
    if not car_config:
        db.add(FareConfiguration(
            vehicle_category=VehicleCategory.CAR,
            base_fare=0.0,
            per_km_rate=settings.DEFAULT_CAR_RATE_PER_KM,  # ₹15/km
            min_fare=settings.MIN_FARE_CAR,
            cancellation_fee=50.0,
            surge_multiplier=1.0,
            tax_percent=5.0,
            is_active=True
        ))

    # Seed Auto Fare Config (Configurable, ₹10/km)
    auto_config = db.query(FareConfiguration).filter(FareConfiguration.vehicle_category == VehicleCategory.AUTO).first()
    if not auto_config:
        db.add(FareConfiguration(
            vehicle_category=VehicleCategory.AUTO,
            base_fare=0.0,
            per_km_rate=settings.DEFAULT_AUTO_RATE_PER_KM,
            min_fare=settings.MIN_FARE_AUTO,
            cancellation_fee=30.0,
            surge_multiplier=1.0,
            tax_percent=5.0,
            is_active=True
        ))

    # Seed Default Super Admin for dashboard
    admin_user = db.query(User).filter(User.phone_number == "+919999999999").first()
    if not admin_user:
        admin_user = User(
            phone_number="+919999999999",
            email="admin@ridehailing.app",
            full_name="System Administrator",
            hashed_password=hash_password("Shubham@#$2004"),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        db.flush()
    else:
        # Keep admin password updated to requested Shubham@#$2004
        admin_user.hashed_password = hash_password("Shubham@#$2004")
        admin_user.role = UserRole.ADMIN
        db.flush()

    # Seed Demo Passenger for feature testing
    pass_user = db.query(User).filter(User.phone_number == "+919111111111").first()
    if not pass_user:
        pass_user = User(
            phone_number="+919111111111",
            email="demo.passenger@ridehailing.app",
            full_name="Aakash (Demo Passenger)",
            role=UserRole.PASSENGER,
            is_active=True
        )
        db.add(pass_user)
        db.flush()
        db.add(PassengerProfile(user_id=pass_user.id, rating=5.0, total_trips=0))
        db.flush()

    # Seed Demo Driver 1 (Online in Indiranagar, Bike/Auto/Car)
    r1_user = db.query(User).filter(User.phone_number == "+919222222222").first()
    if not r1_user:
        r1_user = User(
            phone_number="+919222222222",
            email="driver1@ridehailing.app",
            full_name="Rajesh Kumar (Driver 1)",
            role=UserRole.RIDER,
            is_active=True
        )
        db.add(r1_user)
        db.flush()
        r1_prof = RiderProfile(
            user_id=r1_user.id,
            license_number="KA-01-2024-DRV01",
            status=RiderApprovalStatus.APPROVED,
            is_online=True,
            is_busy=False,
            current_latitude=12.9716,
            current_longitude=77.6412,
            rating=4.9,
            total_completed_trips=0,
            total_earnings=0.0,
            rider_service_type="REGULAR"
        )
        db.add(r1_prof)
        db.flush()
        db.add(Vehicle(rider_id=r1_prof.id, category=VehicleCategory.BIKE, make="Hero", model="Splendor Plus", license_plate="KA-01-EK-8892", color="Black", is_active=True))
        db.add(Vehicle(rider_id=r1_prof.id, category=VehicleCategory.AUTO, make="Bajaj", model="RE EV Auto", license_plate="KA-01-AU-9912", color="Green", is_active=True))
        db.add(Vehicle(rider_id=r1_prof.id, category=VehicleCategory.CAR, make="Maruti Suzuki", model="Dzire Tour", license_plate="KA-03-AB-4422", color="White", is_active=True))
        db.flush()
    else:
        if r1_user.rider_profile:
            r1_user.rider_profile.is_online = True
            r1_user.rider_profile.is_busy = False
            r1_user.rider_profile.status = RiderApprovalStatus.APPROVED
            r1_user.rider_profile.current_latitude = 12.9716
            r1_user.rider_profile.current_longitude = 77.6412

    # Seed Demo Driver 2 (Online in Indiranagar, ~60m away, for multi-driver race testing)
    r2_user = db.query(User).filter(User.phone_number == "+919333333333").first()
    if not r2_user:
        r2_user = User(
            phone_number="+919333333333",
            email="driver2@ridehailing.app",
            full_name="Vikram Singh (Driver 2)",
            role=UserRole.RIDER,
            is_active=True
        )
        db.add(r2_user)
        db.flush()
        r2_prof = RiderProfile(
            user_id=r2_user.id,
            license_number="KA-04-2024-DRV02",
            status=RiderApprovalStatus.APPROVED,
            is_online=True,
            is_busy=False,
            current_latitude=12.9720,
            current_longitude=77.6418,
            rating=4.95,
            total_completed_trips=0,
            total_earnings=0.0,
            rider_service_type="REGULAR"
        )
        db.add(r2_prof)
        db.flush()
        db.add(Vehicle(rider_id=r2_prof.id, category=VehicleCategory.BIKE, make="Bajaj", model="Pulsar 150", license_plate="KA-05-AB-5511", color="Blue", is_active=True))
        db.add(Vehicle(rider_id=r2_prof.id, category=VehicleCategory.AUTO, make="Mahindra", model="Treo EV Auto", license_plate="KA-02-EE-3344", color="Yellow", is_active=True))
        db.add(Vehicle(rider_id=r2_prof.id, category=VehicleCategory.CAR, make="Hyundai", model="Aura Prime", license_plate="KA-04-CD-7788", color="Silver", is_active=True))
        db.flush()
    else:
        if r2_user.rider_profile:
            r2_user.rider_profile.is_online = True
            r2_user.rider_profile.is_busy = False
            r2_user.rider_profile.status = RiderApprovalStatus.APPROVED
            r2_user.rider_profile.current_latitude = 12.9720
            r2_user.rider_profile.current_longitude = 77.6418
    db.flush()

    # Check Festival Campaign - seed only if table is completely empty
    camp = db.query(FestivalCampaign).filter(FestivalCampaign.id == "active").first()
    if not camp:
        camp = FestivalCampaign(
            id="active",
            festival_name="Grand Welcome Offer 🎁",
            tagline="Enjoy special discounts on all your rides!",
            banner_title="Grand Welcome Offer 🎁",
            banner_subtitle="Enjoy special discounts on all your rides!",
            promo_code="WELCOME10",
            discount_percent=10.0,
            is_active=False,
            theme_color="#0284c7"
        )
        db.add(camp)

    # Seed CHHATH10, DIWALI5, and CAMPUS20 promo codes if not already existing
    promos_to_seed = [
        ("CHHATH10", 10.0, 50.0, 20.0, "Chhath Puja Mahaparv Special 🌅 10% OFF on all rides"),
        ("DIWALI5", 5.0, 50.0, 20.0, "Shubh Diwali Festival Dhamaka 🪔 5% OFF"),
        ("CAMPUS20", 20.0, 50.0, 20.0, "Campus Special • Self Ride 20% OFF for students & faculty"),
        ("DIWALI50", 5.0, 50.0, 20.0, "Diwali Festival Dhamaka 🪔 5% OFF"),
    ]
    for p_code, p_pct, p_max, p_min, p_desc in promos_to_seed:
        existing_p = db.query(PromoCode).filter(PromoCode.code == p_code).first()
        if not existing_p:
            db.add(PromoCode(
                id=str(uuid.uuid4()),
                code=p_code,
                discount_percent=p_pct,
                max_discount_amount=p_max,
                min_order_amount=p_min,
                description=p_desc,
                is_active=True
            ))
        else:
            if p_code in ("DIWALI50", "DIWALI5"):
                existing_p.discount_percent = 5.0
            elif p_code == "CHHATH10":
                existing_p.discount_percent = 10.0
    db.flush()

    # Purge any demo or sold-out community rides so only real active rides are kept
    db.query(CommunityRide).filter(
        (CommunityRide.id.like("demo_%")) |
        (CommunityRide.creator_name.like("%Host Ankit%")) |
        (CommunityRide.pickup_address.like("%Electronic City%")) |
        (CommunityRide.available_seats <= 0) |
        (CommunityRide.status.in_(["FULL", "SOLD_OUT", "CANCELLED"]))
    ).delete(synchronize_session=False)
    db.flush()

    # Seed Universities and Campuses
    parul_uni = db.query(University).filter(University.name == "Parul University").first()
    if not parul_uni:
        parul_uni = University(
            id="uni_parul_vadodara",
            name="Parul University",
            short_name="PU",
            city="Vadodara",
            state="Gujarat",
            country="India",
            status="ACTIVE",
            logo_url="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150"
        )
        db.add(parul_uni)
        db.flush()

        c1 = Campus(
            id="campus_parul_limda",
            university_id=parul_uni.id,
            name="Main Campus (Limda)",
            address="P.O. Limda, Ta. Waghodia, Dist. Vadodara, Gujarat - 391760",
            city="Vadodara",
            state="Gujarat",
            latitude=22.2887,
            longitude=73.3634,
            status="ACTIVE",
            common_locations=json.dumps([
                "University Main Gate",
                "Engineering Hostel Block A",
                "Girls Hostel (Limda)",
                "Medical Campus & Hospital",
                "Central Library & Food Court",
                "Vadodara Railway Station",
                "Makarpura Bus Terminal",
                "Waghodia Cross Road"
            ])
        )
        c2 = Campus(
            id="campus_parul_alkapuri",
            university_id=parul_uni.id,
            name="City Campus (Alkapuri)",
            address="RC Dutt Road, Alkapuri, Vadodara, Gujarat - 390007",
            city="Vadodara",
            state="Gujarat",
            latitude=22.3107,
            longitude=73.1812,
            status="ACTIVE",
            common_locations=json.dumps([
                "Alkapuri City Office",
                "Vadodara Railway Station Platform 1",
                "Sayajigunj Circle",
                "Akota Bridge",
                "Parul Main Campus Shuttle Stand"
            ])
        )
        db.add_all([c1, c2])
        db.flush()

    du_uni = db.query(University).filter(University.name == "Delhi University").first()
    if not du_uni:
        du_uni = University(
            id="uni_delhi_university",
            name="Delhi University",
            short_name="DU",
            city="New Delhi",
            state="Delhi",
            country="India",
            status="ACTIVE",
            logo_url="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=150"
        )
        db.add(du_uni)
        db.flush()

        db.add(Campus(
            id="campus_du_north",
            university_id=du_uni.id,
            name="North Campus",
            address="University Enclave, North Campus, Delhi - 110007",
            city="New Delhi",
            state="Delhi",
            latitude=28.6892,
            longitude=77.2104,
            status="ACTIVE",
            common_locations=json.dumps([
                "Vishwavidyalaya Metro Gate 3",
                "Hansraj / SRCC Crossroad",
                "Arts Faculty Gate",
                "Kamla Nagar Market",
                "GTB Nagar Metro Station",
                "University Hostel Complex",
                "Kashmere Gate ISBT"
            ])
        ))
        db.add(Campus(
            id="campus_du_south",
            university_id=du_uni.id,
            name="South Campus",
            address="Benito Juarez Marg, Dhaula Kuan, New Delhi - 110021",
            city="New Delhi",
            state="Delhi",
            latitude=28.5835,
            longitude=77.1648,
            status="ACTIVE",
            common_locations=json.dumps([
                "South Campus Metro Station Gate 1",
                "Satya Niketan Market",
                "Sri Venkateswara College Gate",
                "Dhaula Kuan Bus Terminal",
                "Anand Niketan Roundabout"
            ])
        ))
        db.flush()

    # Clean any leftover demo rides or requests
    db.query(CommunityRide).filter(
        (CommunityRide.id.like("campus_ride_parul_%")) |
        (CommunityRide.id.like("demo_%"))
    ).delete(synchronize_session=False)
    db.query(PassengerRideRequest).filter(
        (PassengerRideRequest.id.like("pass_req_parul_%"))
    ).delete(synchronize_session=False)
    db.flush()

    # Seed all Gujarat Government & Private Universities, Colleges, and Schools
    try:
        from app.seeds.gujarat_institutions import seed_gujarat_institutions
        seed_gujarat_institutions(db)
    except Exception as e:
        logger.warning(f"Error seeding Gujarat institutions: {e}")

    db.commit()


import asyncio
from app.services.matching_service import MatchingService


async def background_matching_worker():
    """
    Autonomous background matching worker:
    - Monitors in-flight matching rides every 3-4 seconds
    - Advances Stage 1 (2km) to Stage 2 (3km) when 3 minutes elapse
    - Times out rides to NO_RIDER_AVAILABLE when 5 minutes elapse
    - Never resets the 3-minute timer on browser refresh
    """
    while True:
        try:
            await asyncio.sleep(4)
            db = SessionLocal()
            try:
                active_rides = db.query(RideBooking).filter(
                    RideBooking.status.in_([
                        RideStatus.SEARCHING_FOR_RIDER,
                        RideStatus.REQUESTS_SENT,
                        RideStatus.EXPANDING_SEARCH
                    ])
                ).all()
                for r in active_rides:
                    await MatchingService.check_and_progress_ride(db, r.id)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(2)


def auto_migrate_sqlite(engine):
    """Safely adds missing columns to SQLite tables if they don't exist."""
    if engine.dialect.name != "sqlite":
        return
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            # 1. rider_profiles
            result = conn.execute(text("PRAGMA table_info(rider_profiles)")).fetchall()
            existing_cols = {row[1] for row in result}
            new_columns = [
                ("permanent_address", "VARCHAR(300)"),
                ("current_address", "VARCHAR(300)"),
                ("passport_photo", "TEXT"),
                ("license_photo", "TEXT"),
                ("aadhaar_number", "VARCHAR(20)"),
                ("aadhaar_photo", "TEXT"),
                ("rejection_reason", "VARCHAR(300)"),
                ("submitted_at", "DATETIME"),
                ("verified_at", "DATETIME"),
                ("rider_service_type", "VARCHAR(50)"),
                ("served_universities", "TEXT"),
                ("college_name", "VARCHAR(200)"),
                ("academic_year", "VARCHAR(50)"),
                ("student_id_number", "VARCHAR(50)"),
                ("student_id_photo", "TEXT"),
            ]
            for col_name, col_type in new_columns:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE rider_profiles ADD COLUMN {col_name} {col_type}"))
            conn.commit()
        except Exception:
            pass

        try:
            # 2. community_rides
            result = conn.execute(text("PRAGMA table_info(community_rides)")).fetchall()
            existing_cols = {row[1] for row in result}
            comm_columns = [
                ("university_id", "VARCHAR(36)"),
                ("campus_id", "VARCHAR(36)"),
                ("university_name", "VARCHAR(150)"),
                ("university_short_name", "VARCHAR(50)"),
                ("category_type", "VARCHAR(50)"),
                ("poster_gender", "VARCHAR(30)"),
                ("intermediate_stops", "TEXT"),
                ("recurring_days", "VARCHAR(100)"),
                ("return_trip_time", "VARCHAR(50)"),
            ]
            for col_name, col_type in comm_columns:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE community_rides ADD COLUMN {col_name} {col_type}"))
            conn.commit()
        except Exception:
            pass

        try:
            # 2b. community_ride_bookings
            result = conn.execute(text("PRAGMA table_info(community_ride_bookings)")).fetchall()
            existing_cols = {row[1] for row in result}
            bkg_columns = [
                ("travel_date", "VARCHAR(50)"),
                ("total_price", "FLOAT"),
                ("price_per_seat", "FLOAT"),
                ("platform_fee", "FLOAT"),
                ("net_host_earnings", "FLOAT"),
                ("pickup_notes", "VARCHAR(255)"),
                ("passenger_pickup_lat", "FLOAT"),
                ("passenger_pickup_lng", "FLOAT"),
            ]
            for col_name, col_type in bkg_columns:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE community_ride_bookings ADD COLUMN {col_name} {col_type}"))
            conn.commit()
        except Exception:
            pass

        try:
            # 3. passenger_profiles
            result = conn.execute(text("PRAGMA table_info(passenger_profiles)")).fetchall()
            existing_cols = {row[1] for row in result}
            pass_columns = [
                ("university_id", "VARCHAR(36)"),
                ("campus_id", "VARCHAR(36)"),
                ("student_id_number", "VARCHAR(50)"),
                ("student_id_photo", "TEXT"),
                ("student_status", "VARCHAR(30)"),
                ("student_verification_status", "VARCHAR(30)"),
                ("college_department", "VARCHAR(100)"),
            ]
            for col_name, col_type in pass_columns:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE passenger_profiles ADD COLUMN {col_name} {col_type}"))
            conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup & shutdown events."""
    # Create all database tables
    Base.metadata.create_all(bind=engine)
    auto_migrate_sqlite(engine)
    
    # Seed default fare rules & admin
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    
    worker_task = asyncio.create_task(background_matching_worker())
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Production-grade IndiRide Platform API (High-performance matching & real-time dispatch architecture)",
    lifespan=lifespan
)

# Cross-Origin Resource Sharing (CORS) for Mobile and Admin Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(location_router, prefix=settings.API_V1_STR)
app.include_router(fare_router, prefix=settings.API_V1_STR)
app.include_router(rides_router, prefix=settings.API_V1_STR)
app.include_router(rider_router, prefix=settings.API_V1_STR)
app.include_router(websocket_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(community_rides_router, prefix=settings.API_V1_STR)
app.include_router(campus_rides_router, prefix=settings.API_V1_STR)
app.include_router(payments_router, prefix=settings.API_V1_STR)
app.include_router(documents_router, prefix=settings.API_V1_STR)
app.include_router(loyalty_router, prefix=settings.API_V1_STR)


logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Security Exception Shield:
    - Logs detailed stack trace on the backend server for diagnostics
    - Returns sanitized error message to client (NEVER leaks database schemas, credentials, or internal paths)
    - Always preserves CORS headers so browsers receive meaningful errors instead of generic CORS blocks
    """
    error_ref = str(uuid.uuid4())[:8]
    logger.error(f"Unhandled Server Error [Ref:{error_ref}] on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin")
    resp = JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. Please try again later.",
            "error_ref": error_ref
        }
    )
    if origin:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Methods"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "*"
    else:
        resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint reporting real-time database and service status."""
    from app.services.redis_service import redis_service
    from app.services.mongo_service import mongo_service

    # Check Relational Database
    db_status = "connected"
    db_dialect = engine.dialect.name
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # Check Redis
    redis_ok = redis_service.is_connected()

    # Check MongoDB
    mongo_ok = mongo_service.is_connected()

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "infrastructure": {
            "relational_db": {
                "dialect": db_dialect,
                "status": db_status
            },
            "redis": {
                "status": "connected" if redis_ok else "fallback_in_memory",
                "real_time_geo": redis_ok
            },
            "mongodb": {
                "status": "connected" if mongo_ok else "fallback_mode",
                "database": settings.MONGODB_DB_NAME
            },
            "sms_gateway": {
                "provider": getattr(settings, "SMS_PROVIDER", "fast2sms"),
                "carrier_delivery_ready": bool(
                    getattr(settings, "TWOFACTOR_API_KEY", "") or
                    getattr(settings, "FAST2SMS_API_KEY", "") or
                    getattr(settings, "TWILIO_ACCOUNT_SID", "")
                )
            }
        },
        "pricing": {
            "bike_rate_per_km": f"₹{settings.DEFAULT_BIKE_RATE_PER_KM}/km",
            "car_rate_per_km": f"₹{settings.DEFAULT_CAR_RATE_PER_KM}/km",
            "matching_radius": f"{settings.INITIAL_MATCHING_RADIUS_KM} km"
        }
    }
