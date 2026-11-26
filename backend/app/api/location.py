from fastapi import APIRouter, Query, HTTPException
from app.schemas.location import PlaceSearchResponse, ReverseGeocodeResponse, RouteEstimateRequest, RouteEstimateResponse
from app.services.location_service import LocationService

router = APIRouter(prefix="/location", tags=["Location & Navigation"])


@router.get("/search", response_model=PlaceSearchResponse)
async def search_places(
    query: str = Query(..., min_length=2, description="Place or landmark name in India"),
    limit: int = Query(10, ge=1, le=20)
):
    """
    Autocomplete search for Indian landmarks, localities, and addresses.
    Restricted to India region.
    """
    return await LocationService.search_places(query=query, limit=limit)


@router.get("/reverse", response_model=ReverseGeocodeResponse)
async def reverse_geocode(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0)
):
    """
    Reverse geocode GPS coordinates to a formatted Indian address.
    """
    return await LocationService.reverse_geocode(lat=latitude, lng=longitude)


@router.post("/route", response_model=RouteEstimateResponse)
async def calculate_route(request: RouteEstimateRequest):
    """
    Computes road distance, travel duration, and route polyline using OSRM road network.
    """
    return await LocationService.calculate_route(
        pickup_lat=request.pickup_latitude,
        pickup_lng=request.pickup_longitude,
        dropoff_lat=request.dropoff_latitude,
        dropoff_lng=request.dropoff_longitude
    )
