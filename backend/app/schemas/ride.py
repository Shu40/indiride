from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_serializer
from app.models.ride import RideStatus, RideRequestStatus
from app.models.vehicle import VehicleCategory


class CreateRideRequest(BaseModel):
    pickup_address: str = Field(..., min_length=3, max_length=255)
    pickup_latitude: float = Field(..., ge=-90.0, le=90.0)
    pickup_longitude: float = Field(..., ge=-180.0, le=180.0)
    destination_address: str = Field(..., min_length=3, max_length=255)
    destination_latitude: float = Field(..., ge=-90.0, le=90.0)
    destination_longitude: float = Field(..., ge=-180.0, le=180.0)
    vehicle_category: VehicleCategory
    promo_code: Optional[str] = None
    ride_type: Optional[str] = "daily"
    payment_method: Optional[str] = "cash"
    idempotency_key: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    use_voucher: Optional[bool] = False



class RiderSummary(BaseModel):
    id: str
    full_name: str
    phone_number: str
    profile_photo: Optional[str] = None
    rating: float
    vehicle_category: VehicleCategory
    vehicle_plate: Optional[str] = None
    vehicle_model: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    heading: Optional[float] = 0.0
    speed: Optional[float] = 0.0
    pickup_eta_mins: Optional[int] = None
    last_location_update: Optional[datetime] = None
    is_stale: Optional[bool] = False

    @field_serializer("last_location_update", check_fields=False)
    def serialize_last_update(self, dt: Optional[datetime], _info):
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class PassengerSummary(BaseModel):
    id: str
    full_name: str
    phone_number: str
    rating: float


class LiveRideTrackingResponse(BaseModel):
    ride_id: str
    status: RideStatus
    sharing_active: bool
    rider: Optional[RiderSummary] = None
    pickup_latitude: float
    pickup_longitude: float
    destination_latitude: float
    destination_longitude: float
    driver_to_pickup_route: Optional[List[List[float]]] = None
    last_updated_at: Optional[datetime] = None



class RideDetailsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    passenger_id: str
    rider_id: Optional[str] = None
    vehicle_category: VehicleCategory

    pickup_address: str
    pickup_latitude: float
    pickup_longitude: float
    destination_address: str
    destination_latitude: float
    destination_longitude: float
    route_polyline: Optional[str] = None

    estimated_distance_km: float
    estimated_duration_mins: int
    estimated_fare: float
    boost_amount: Optional[float] = 0.0
    actual_distance_km: Optional[float] = None
    final_fare: Optional[float] = None

    status: RideStatus
    current_search_radius_km: float

    # 4-Digit Pickup OTP (only populated for the passenger)
    otp: Optional[str] = None
    pickup_otp: Optional[str] = None

    passenger: Optional[PassengerSummary] = None
    rider: Optional[RiderSummary] = None

    created_at: datetime
    scheduled_for: Optional[datetime] = None
    trip_started_at: Optional[datetime] = None
    ride_started_at: Optional[datetime] = None
    trip_completed_at: Optional[datetime] = None
    ride_completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    cancellation_fee: Optional[float] = None
    cancelled_by: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None

    @field_serializer(
        "created_at", "scheduled_for", "trip_started_at", "ride_started_at",
        "trip_completed_at", "ride_completed_at", "cancelled_at",
        check_fields=False
    )
    def serialize_datetime(self, dt: Optional[datetime], _info):
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class RiderLocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    heading: Optional[float] = Field(None, ge=0.0, le=360.0)
    speed: Optional[float] = Field(None, ge=0.0)


class VerifyPickupOTPRequest(BaseModel):
    otp: str = Field(..., min_length=4, max_length=4, description="4-digit passenger OTP")


class CompleteRideRequest(BaseModel):
    actual_distance_km: Optional[float] = None


class CancelRideRequest(BaseModel):
    reason: Optional[str] = Field("Changed mind", max_length=255)


class RiderStatusToggleRequest(BaseModel):
    is_online: bool
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None


class BoostFareRequest(BaseModel):
    boost_amount: float = Field(..., ge=0.0, le=40.0, description="Additional fare boost offered by passenger, max Rs 40")


class IncomingRideRequestSchema(BaseModel):
    ride_id: str
    pickup_address: str
    pickup_latitude: float
    pickup_longitude: float
    destination_address: str
    destination_latitude: float
    destination_longitude: float
    distance_to_pickup_km: float
    trip_distance_km: float
    estimated_fare: float
    boost_amount: Optional[float] = 0.0
    vehicle_category: VehicleCategory
    expires_in_seconds: int = 30
    passenger: Optional[Dict[str, Any]] = None

