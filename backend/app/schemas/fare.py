from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.vehicle import VehicleCategory


class FareItemBreakdown(BaseModel):
    base_fare: float
    distance_km: float
    rate_per_km: float
    distance_fare: float
    waiting_minutes: float = 0.0
    waiting_charge: float = 0.0
    surge_multiplier: float
    surge_amount: float
    tolls_and_parking: float = 0.0
    tax_percent: float
    tax_amount: float
    discount_amount: float = 0.0
    discount_code: Optional[str] = None
    total_fare: float


class VehicleFareEstimate(BaseModel):
    category: VehicleCategory
    display_name: str
    capacity: int
    eta_minutes: int
    icon: str
    rate_per_km: float
    distance_km: float
    duration_minutes: float
    estimated_fare: float
    original_fare: Optional[float] = None
    discount_amount: float = 0.0
    fare_breakdown: FareItemBreakdown
    available: bool = True
    description: str


class FareEstimateRequest(BaseModel):
    pickup_latitude: float = Field(..., ge=-90.0, le=90.0)
    pickup_longitude: float = Field(..., ge=-180.0, le=180.0)
    dropoff_latitude: float = Field(..., ge=-90.0, le=90.0)
    dropoff_longitude: float = Field(..., ge=-180.0, le=180.0)
    pickup_address: Optional[str] = None
    dropoff_address: Optional[str] = None
    promo_code: Optional[str] = None
    ride_type: Optional[str] = "daily"
    use_voucher: Optional[bool] = False
    passenger_id: Optional[str] = None


class FareEstimateResponse(BaseModel):
    pickup_latitude: float
    pickup_longitude: float
    dropoff_latitude: float
    dropoff_longitude: float
    distance_km: float
    duration_minutes: float
    estimates: List[VehicleFareEstimate]
    route_geometry: Optional[List[List[float]]] = None
    applied_promo: Optional[str] = None
    user_tier_code: Optional[str] = None
    user_tier_name: Optional[str] = None
    user_tier_badge: Optional[str] = None
    auto_discount_applied: Optional[str] = None
    free_rides_vouchers: Optional[int] = 0



class FareConfigUpdateRequest(BaseModel):
    base_fare: Optional[float] = None
    per_km_rate: Optional[float] = None
    min_fare: Optional[float] = None
    waiting_charge_per_minute: Optional[float] = None
    per_minute_rate: Optional[float] = None
    cancellation_fee: Optional[float] = None
    surge_multiplier: Optional[float] = None
    tax_percent: Optional[float] = None
    tolls_and_parking: Optional[float] = None
    is_active: Optional[bool] = None
