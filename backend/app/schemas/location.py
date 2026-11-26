from typing import List, Optional
from pydantic import BaseModel, Field


class LocationPoint(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    address: Optional[str] = None
    name: Optional[str] = None


class PlaceSuggestion(BaseModel):
    place_id: str
    name: str
    formatted_address: str
    latitude: float
    longitude: float
    type: Optional[str] = "locality"


class PlaceSearchResponse(BaseModel):
    query: str
    count: int
    suggestions: List[PlaceSuggestion]


class ReverseGeocodeRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class ReverseGeocodeResponse(BaseModel):
    latitude: float
    longitude: float
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"


class RouteCoordinate(BaseModel):
    latitude: float
    longitude: float


class RouteEstimateRequest(BaseModel):
    pickup_latitude: float = Field(..., ge=-90.0, le=90.0)
    pickup_longitude: float = Field(..., ge=-180.0, le=180.0)
    dropoff_latitude: float = Field(..., ge=-90.0, le=90.0)
    dropoff_longitude: float = Field(..., ge=-180.0, le=180.0)


class RouteEstimateResponse(BaseModel):
    distance_km: float
    duration_minutes: float
    pickup_address: Optional[str] = None
    dropoff_address: Optional[str] = None
    route_geometry: List[List[float]]  # List of [lat, lng] points for drawing polyline
    status: str = "OK"
