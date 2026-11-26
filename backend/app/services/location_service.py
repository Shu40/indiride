import math
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
import httpx
from fastapi import HTTPException, status
from app.config import settings
from app.schemas.location import PlaceSuggestion, PlaceSearchResponse, ReverseGeocodeResponse, RouteEstimateResponse

logger = logging.getLogger(__name__)

# Ultra-fast in-memory caching to eliminate external API latency and rate limits
_search_cache: Dict[str, Tuple[float, PlaceSearchResponse]] = {}
_reverse_cache: Dict[str, Tuple[float, ReverseGeocodeResponse]] = {}
_route_cache: Dict[str, Tuple[float, RouteEstimateResponse]] = {}
CACHE_TTL_SEC = 300  # 5 minutes cache lifetime

# Pre-seeded Indian Metro Landmarks for ultra-fast, zero-latency matching & offline fallback
COMMON_INDIAN_PLACES = [
    {"name": "Indiranagar 100 Feet Road", "formatted_address": "100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038", "lat": 12.9716, "lng": 77.6412, "type": "commercial"},
    {"name": "Koramangala 5th Block", "formatted_address": "Koramangala 5th Block, Bengaluru, Karnataka 560095", "lat": 12.9352, "lng": 77.6245, "type": "locality"},
    {"name": "MG Road Metro Station", "formatted_address": "Mahatma Gandhi Rd, Bengaluru, Karnataka 560001", "lat": 12.9754, "lng": 77.6066, "type": "transit"},
    {"name": "Domlur Flyover Junction", "formatted_address": "Domlur, Bengaluru, Karnataka 560071", "lat": 12.9609, "lng": 77.6387, "type": "transit"},
    {"name": "Whitefield ITPL", "formatted_address": "ITPB, Whitefield, Bengaluru, Karnataka 560066", "lat": 12.9866, "lng": 77.7381, "type": "commercial"},
    {"name": "HSR Layout Sector 1", "formatted_address": "HSR Layout Sector 1, Bengaluru, Karnataka 560102", "lat": 12.9116, "lng": 77.6534, "type": "locality"},
    {"name": "Kempegowda International Airport (BLR)", "formatted_address": "KIAL Rd, Devanahalli, Bengaluru, Karnataka 560300", "lat": 13.1986, "lng": 77.7066, "type": "airport"},
    {"name": "Parul University Campus", "formatted_address": "Parul University, Post Limda, Waghodia Road, Vadodara, Gujarat 391760", "lat": 22.2887, "lng": 73.3634, "type": "university"},
    {"name": "Alkapuri Railway Station", "formatted_address": "Station Rd, Alkapuri, Vadodara, Gujarat 390007", "lat": 22.3107, "lng": 73.1812, "type": "transit"},
    {"name": "Sayaji Baug Zoo", "formatted_address": "Sayaji Baug, Vinoba Bhave Rd, Dak Bunglaw, Sayajiganj, Vadodara, Gujarat 390001", "lat": 22.3135, "lng": 73.1917, "type": "landmark"},
    {"name": "SG Highway Ahmedabad", "formatted_address": "Sarkhej - Gandhinagar Hwy, Ahmedabad, Gujarat 380054", "lat": 23.0524, "lng": 72.5085, "type": "commercial"},
    {"name": "Connaught Place (CP)", "formatted_address": "Connaught Place, New Delhi, Delhi 110001", "lat": 28.6315, "lng": 77.2167, "type": "commercial"},
    {"name": "Cyber Hub Gurgaon", "formatted_address": "DLF Cyber City, DLF Phase 2, Gurugram, Haryana 122002", "lat": 28.4952, "lng": 77.0886, "type": "commercial"},
    {"name": "Indira Gandhi International Airport (DEL)", "formatted_address": "New Delhi, Delhi 110037", "lat": 28.5562, "lng": 77.1000, "type": "airport"},
    {"name": "Noida Sector 18 Market", "formatted_address": "Sector 18, Noida, Uttar Pradesh 201301", "lat": 28.5708, "lng": 77.3261, "type": "commercial"},
    {"name": "Marine Drive", "formatted_address": "Netaji Subhash Chandra Bose Rd, Churchgate, Mumbai, Maharashtra 400020", "lat": 18.9432, "lng": 72.8230, "type": "landmark"},
    {"name": "Bandra Kurla Complex (BKC)", "formatted_address": "G Block BKC, Bandra East, Mumbai, Maharashtra 400051", "lat": 19.0662, "lng": 72.8682, "type": "commercial"},
    {"name": "Chhatrapati Shivaji Maharaj International Airport (BOM)", "formatted_address": "Sahar, Andheri East, Mumbai, Maharashtra 400099", "lat": 19.0896, "lng": 72.8656, "type": "airport"},
    {"name": "Hitec City / Cyber Towers", "formatted_address": "Madhapur, Hyderabad, Telangana 500081", "lat": 17.4504, "lng": 78.3808, "type": "commercial"},
    {"name": "Gachibowli Stadium Junction", "formatted_address": "Old Mumbai Hwy, Gachibowli, Hyderabad, Telangana 500032", "lat": 17.4401, "lng": 78.3489, "type": "transit"},
    {"name": "Banjara Hills Road No 1", "formatted_address": "Banjara Hills, Hyderabad, Telangana 500034", "lat": 17.4156, "lng": 78.4350, "type": "locality"},
    {"name": "Koregaon Park North Main Road", "formatted_address": "Koregaon Park, Pune, Maharashtra 411001", "lat": 18.5362, "lng": 73.8940, "type": "locality"},
    {"name": "Viman Nagar Phoenix Marketcity", "formatted_address": "Viman Nagar, Pune, Maharashtra 411014", "lat": 18.5621, "lng": 73.9167, "type": "commercial"},
    {"name": "T Nagar Usman Road", "formatted_address": "Usman Rd, T. Nagar, Chennai, Tamil Nadu 600017", "lat": 13.0418, "lng": 80.2341, "type": "commercial"},
    {"name": "Chennai Central Railway Station", "formatted_address": "Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003", "lat": 13.0827, "lng": 80.2757, "type": "transit"},
    {"name": "Salt Lake Sector V", "formatted_address": "Sector V, Bidhannagar, Kolkata, West Bengal 700091", "lat": 22.5804, "lng": 88.4378, "type": "commercial"},
    {"name": "Howrah Railway Station", "formatted_address": "Station Rd, Howrah Railway Station, Howrah, West Bengal 711101", "lat": 22.5898, "lng": 88.3426, "type": "transit"},
]


class LocationService:
    @staticmethod
    def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates great-circle distance between two GPS coordinates in kilometers."""
        R = 6371.0  # Earth's radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    @classmethod
    async def search_places(cls, query: str, limit: int = 10) -> PlaceSearchResponse:
        """
        Searches Indian places with autocomplete.
        Queries OpenStreetMap Nominatim restricted to India (countrycodes=in).
        Blends with fast landmark search for instant results.
        Uses in-memory cache for ultra-low latency (<1ms).
        """
        clean_query = query.strip()
        cache_key = f"{clean_query.lower()}:{limit}"
        now = time.time()
        if cache_key in _search_cache:
            ts, cached_resp = _search_cache[cache_key]
            if now - ts < CACHE_TTL_SEC:
                return cached_resp

        suggestions: List[PlaceSuggestion] = []
        seen_names = set()

        # 1. First check matching Indian metro landmarks for instant, local responsiveness
        q_lower = clean_query.lower()
        for idx, item in enumerate(COMMON_INDIAN_PLACES):
            if q_lower in item["name"].lower() or q_lower in item["formatted_address"].lower():
                suggestions.append(PlaceSuggestion(
                    place_id=f"preset_{idx}",
                    name=item["name"],
                    formatted_address=item["formatted_address"],
                    latitude=item["lat"],
                    longitude=item["lng"],
                    type=item.get("type", "locality")
                ))
                seen_names.add(item["name"].lower())

        # 2. Query Nominatim API with India restriction
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                headers = {"User-Agent": "RideHailingPlatform/1.0 (contact@ridehailing.app)"}
                params = {
                    "q": f"{clean_query}, India",
                    "format": "json",
                    "addressdetails": 1,
                    "limit": limit,
                    "countrycodes": "in"
                }
                resp = await client.get(f"{settings.NOMINATIM_GEOCODE_URL}/search", params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data:
                        display_name = item.get("display_name", "")
                        # Parse short name from display_name
                        parts = display_name.split(",")
                        short_name = parts[0].strip() if parts else clean_query

                        if short_name.lower() not in seen_names:
                            suggestions.append(PlaceSuggestion(
                                place_id=str(item.get("place_id", f"osm_{item.get('osm_id', '')}")),
                                name=short_name,
                                formatted_address=display_name,
                                latitude=float(item.get("lat")),
                                longitude=float(item.get("lon")),
                                type=item.get("type", "locality")
                            ))
                            seen_names.add(short_name.lower())
        except Exception as e:
            logger.warning(f"Nominatim search exception (falling back to landmark index): {e}")

        # Limit results and store in fast cache
        limited_suggestions = suggestions[:limit]
        resp_obj = PlaceSearchResponse(
            query=clean_query,
            count=len(limited_suggestions),
            suggestions=limited_suggestions
        )
        _search_cache[cache_key] = (now, resp_obj)
        if len(_search_cache) > 300:
            oldest_key = min(_search_cache.keys(), key=lambda k: _search_cache[k][0])
            _search_cache.pop(oldest_key, None)
        return resp_obj

    @classmethod
    async def reverse_geocode(cls, lat: float, lng: float) -> ReverseGeocodeResponse:
        """Reverse geocodes a coordinate to a formatted Indian address with in-memory caching."""
        cache_key = f"{round(lat, 4)},{round(lng, 4)}"
        now = time.time()
        if cache_key in _reverse_cache:
            ts, cached_resp = _reverse_cache[cache_key]
            if now - ts < CACHE_TTL_SEC:
                return cached_resp

        # Check if very close (< 200m) to any known preset landmark
        for item in COMMON_INDIAN_PLACES:
            dist = cls.haversine_distance_km(lat, lng, item["lat"], item["lng"])
            if dist < 0.2:
                result = ReverseGeocodeResponse(
                    latitude=lat,
                    longitude=lng,
                    address=item["formatted_address"],
                    country="India"
                )
                _reverse_cache[cache_key] = (now, result)
                return result

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                headers = {"User-Agent": "RideHailingPlatform/1.0 (contact@ridehailing.app)"}
                params = {
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": 1
                }
                resp = await client.get(f"{settings.NOMINATIM_GEOCODE_URL}/reverse", params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    address_obj = data.get("address", {})
                    return ReverseGeocodeResponse(
                        latitude=lat,
                        longitude=lng,
                        address=data.get("display_name", f"Location ({lat:.4f}, {lng:.4f})"),
                        city=address_obj.get("city") or address_obj.get("town") or address_obj.get("suburb"),
                        state=address_obj.get("state"),
                        pincode=address_obj.get("postcode"),
                        country=address_obj.get("country", "India")
                    )
        except Exception as e:
            logger.warning(f"Reverse geocode failed: {e}")

        return ReverseGeocodeResponse(
            latitude=lat,
            longitude=lng,
            address=f"Location at {lat:.4f}, {lng:.4f}, India",
            country="India"
        )

    @classmethod
    async def calculate_route(cls, pickup_lat: float, pickup_lng: float, dropoff_lat: float, dropoff_lng: float) -> RouteEstimateResponse:
        """
        Calculates road-based distance, travel time, and polyline route points.
        Uses Open Source Routing Machine (OSRM).
        Falls back to haversine * 1.25 urban road factor with interpolated polyline.
        Validates coordinate ranges, service boundary, and minimum travel distance.
        Uses in-memory route caching for zero-latency repeats.
        """
        # 1. Check in-memory route cache (~100m precision)
        cache_key = f"{round(pickup_lat, 3)},{round(pickup_lng, 3)}->{round(dropoff_lat, 3)},{round(dropoff_lng, 3)}"
        now = time.time()
        if cache_key in _route_cache:
            ts, cached_route = _route_cache[cache_key]
            if now - ts < CACHE_TTL_SEC:
                return cached_route

        # 2. Reject invalid coordinates
        if not (-90.0 <= pickup_lat <= 90.0 and -180.0 <= pickup_lng <= 180.0 and -90.0 <= dropoff_lat <= 90.0 and -180.0 <= dropoff_lng <= 180.0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid GPS coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180."
            )

        # 3. Gracefully handle identical or impractically close locations (< 50 meters)
        straight_dist = cls.haversine_distance_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        if straight_dist < 0.05:
            min_resp = RouteEstimateResponse(
                distance_km=0.5,
                duration_minutes=3.0,
                route_geometry=[[pickup_lat, pickup_lng], [dropoff_lat, dropoff_lng]],
                status="OK"
            )
            return min_resp

        # 4. Check supported operating service area (India bounding box ~ 6.0N - 38.0N, 68.0E - 98.0E)
        if not (6.0 <= pickup_lat <= 38.0 and 68.0 <= pickup_lng <= 98.0 and 6.0 <= dropoff_lat <= 38.0 and 68.0 <= dropoff_lng <= 98.0):
            logger.warning(f"Coordinates ({pickup_lat}, {pickup_lng}) -> ({dropoff_lat}, {dropoff_lng}) outside India boundary. Calculating fallback route.")
            dist = max(0.5, round(straight_dist * 1.25, 2))
            dur = max(3.0, round((dist / 25.0) * 60, 1))
            return RouteEstimateResponse(
                distance_km=dist,
                duration_minutes=dur,
                route_geometry=[[pickup_lat, pickup_lng], [dropoff_lat, dropoff_lng]],
                status="OK"
            )

        # 5. Try OSRM route API: coordinates format is lng,lat;lng,lat
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                url = f"{settings.OSRM_ROUTING_URL}/route/v1/driving/{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}?overview=full&geometries=geojson"
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        best_route = data["routes"][0]
                        distance_km = round(best_route["distance"] / 1000.0, 2)
                        duration_minutes = round(best_route["duration"] / 60.0, 1)

                        # Extract geometry coordinates [ [lat, lng], ... ] (OSRM returns [lng, lat])
                        raw_coords = best_route.get("geometry", {}).get("coordinates", [])
                        geometry = [[coord[1], coord[0]] for coord in raw_coords]
                        if not geometry:
                            geometry = [[pickup_lat, pickup_lng], [dropoff_lat, dropoff_lng]]

                        route_resp = RouteEstimateResponse(
                            distance_km=distance_km,
                            duration_minutes=duration_minutes,
                            route_geometry=geometry,
                            status="OK"
                        )
                        _route_cache[cache_key] = (now, route_resp)
                        if len(_route_cache) > 200:
                            oldest_key = min(_route_cache.keys(), key=lambda k: _route_cache[k][0])
                            _route_cache.pop(oldest_key, None)
                        return route_resp
        except Exception as e:
            logger.warning(f"OSRM routing failed: {e}. Using intelligent road estimation.")

        # Robust Fallback: Haversine distance with 1.25x road tortuosity factor
        straight_dist = cls.haversine_distance_km(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        road_distance = round(max(0.5, straight_dist * 1.25), 2)
        # Average urban speed ~ 25 km/h
        duration_minutes = round(max(3.0, (road_distance / 25.0) * 60.0), 1)

        # Generate a smooth interpolated polyline (10 segments)
        num_points = 10
        geometry = []
        for i in range(num_points + 1):
            fraction = i / float(num_points)
            lat = pickup_lat + (dropoff_lat - pickup_lat) * fraction
            lng = pickup_lng + (dropoff_lng - pickup_lng) * fraction
            geometry.append([round(lat, 6), round(lng, 6)])

        fallback_resp = RouteEstimateResponse(
            distance_km=road_distance,
            duration_minutes=duration_minutes,
            route_geometry=geometry,
            status="FALLBACK_ROAD_ESTIMATE"
        )
        _route_cache[cache_key] = (now, fallback_resp)
        return fallback_resp
