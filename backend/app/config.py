import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_backend_dir, ".env")


class Settings(BaseSettings):
    PROJECT_NAME: str = "IndiRide"
    FOUNDER_NAME: str = "Shubham Kumar"
    FOUNDER_LOCATION: str = "Bihar, India"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api"

    # Security
    JWT_SECRET: str = "b63c7b80a4f5d178e24c538e1b34ad2689c47012d4d9c73efb2512a8039c2947"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for stable mobile sessions
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90

    # PostgreSQL Relational Database (with resilient SQLite auto-fallback)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ride_hailing"
    FALLBACK_SQLITE_URL: str = f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ride_hailing.db').replace(chr(92), '/')}"

    # Redis In-Memory Data Store (Geospatial, atomic locks, OTP, queues)
    REDIS_URL: str = "redis://localhost:6379/0"

    # MongoDB Document Database (Live GPS telemetry, breadcrumbs, audit logs, chats)
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "ride_hailing"

    # Real-Time SMS Gateway Configuration
    # Supported: "fast2sms", "2factor", "twilio", "msg91", "cascade", "console"
    SMS_PROVIDER: str = "cascade"
    FAST2SMS_API_KEY: str = ""
    TWOFACTOR_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""

    # Matching Policy (Initial 2km / 3min / 3km)
    INITIAL_MATCHING_RADIUS_KM: float = 2.0
    INITIAL_MATCHING_DURATION_SEC: int = 180
    EXPANDED_MATCHING_RADIUS_KM: float = 3.0
    MAX_BOOKING_TIMEOUT_SEC: int = 300
    RIDER_REQUEST_EXPIRY_SEC: int = 45
    ENABLE_TRAFFIC_AWARE_EXPANSION: bool = False
    TRAFFIC_CONGESTION_RADIUS_MULTIPLIER: float = 1.25

    # Pricing (Bike: ₹7/km, Bullet: ₹13/km, Auto: ₹10/km, Car: ₹15/km, Car Pro: ₹22/km)
    DEFAULT_BIKE_RATE_PER_KM: float = 7.0
    DEFAULT_BULLET_RATE_PER_KM: float = 13.0
    DEFAULT_AUTO_RATE_PER_KM: float = 10.0
    DEFAULT_CAR_RATE_PER_KM: float = 15.0
    DEFAULT_CAR_PRO_RATE_PER_KM: float = 22.0
    MIN_FARE_BIKE: float = 25.0
    MIN_FARE_BULLET: float = 40.0
    MIN_FARE_AUTO: float = 40.0
    MIN_FARE_CAR: float = 60.0
    MIN_FARE_CAR_PRO: float = 90.0

    # Third Party
    RAZORPAY_KEY_ID: str = "rzp_test_placeholder"
    RAZORPAY_KEY_SECRET: str = "rzp_secret_placeholder"
    OSRM_ROUTING_URL: str = "https://router.project-osrm.org"
    NOMINATIM_GEOCODE_URL: str = "https://nominatim.openstreetmap.org"

    model_config = SettingsConfigDict(
        env_file=_env_path,
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
