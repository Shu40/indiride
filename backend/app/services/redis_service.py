import json
import time
import logging
from typing import Dict, Any, Optional, List, Tuple
import redis
from app.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    """
    High-Performance Redis Client for Real-Time Operations:
    - Geospatial driver positioning (GEOADD, GEOSEARCH)
    - Distributed atomic locks for race-condition-free ride acceptance (FIFO)
    - TTL-backed Phone OTP store
    - Real-time ride request queue
    - In-memory fallback if Redis is temporarily unreachable
    """

    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._connected: bool = False
        self._last_attempt: float = 0.0
        self._fallback_memory: Dict[str, Any] = {}
        self._fallback_geo: Dict[str, Tuple[float, float, float]] = {}  # id -> (lat, lng, ts)
        self._init_connection()

    def _init_connection(self):
        self._last_attempt = time.time()
        try:
            is_cloud = "upstash" in settings.REDIS_URL or settings.REDIS_URL.startswith("rediss://")
            timeout = 3.0 if is_cloud else 0.5
            self._client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=timeout,
                socket_timeout=timeout,
                retry_on_timeout=False
            )
            # Test ping
            self._client.ping()
            self._connected = True
            logger.info(" Connected to Redis at %s", settings.REDIS_URL.split('@')[-1] if '@' in settings.REDIS_URL else settings.REDIS_URL)
        except Exception as e:
            self._connected = False
            self._client = None
            logger.warning(" Redis connection failed (%s). Falling back to resilient in-memory mode.", str(e))

    def get_client(self) -> Optional[redis.Redis]:
        if not self._connected or not self._client:
            # Don't retry more than once every 5 minutes to prevent blocking requests
            if time.time() - self._last_attempt < 300:
                return None
            self._init_connection()
        return self._client if self._connected else None

    def is_connected(self) -> bool:
        if not self._connected or not self._client:
            return False
        try:
            return bool(self._client.ping())
        except Exception:
            self._connected = False
            return False

    # -------------------------------------------------------------
    # OTP Management
    # -------------------------------------------------------------
    def store_otp(self, phone: str, otp_hash: str, plain_otp: Optional[str] = None, ttl_seconds: int = 300) -> bool:
        data = {
            "hash": otp_hash,
            "plain": plain_otp,
            "attempts": 0,
            "created_at": time.time(),
            "expires_at": time.time() + ttl_seconds
        }
        client = self.get_client()
        if client:
            try:
                client.setex(f"otp:{phone}", ttl_seconds, json.dumps(data))
                return True
            except Exception as e:
                logger.error("Redis store_otp error: %s", str(e))

        # Fallback in-memory
        self._fallback_memory[f"otp:{phone}"] = data
        return True

    def get_otp(self, phone: str) -> Optional[Dict[str, Any]]:
        client = self.get_client()
        if client:
            try:
                raw = client.get(f"otp:{phone}")
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.error("Redis get_otp error: %s", str(e))

        # Fallback
        entry = self._fallback_memory.get(f"otp:{phone}")
        if entry and time.time() < entry.get("expires_at", 0):
            return entry
        return None

    def update_otp_attempts(self, phone: str, attempts: int, ttl_remaining: int = 300):
        data = self.get_otp(phone)
        if data:
            data["attempts"] = attempts
            client = self.get_client()
            if client:
                try:
                    ttl = client.ttl(f"otp:{phone}")
                    ttl = ttl if ttl > 0 else ttl_remaining
                    client.setex(f"otp:{phone}", ttl, json.dumps(data))
                    return
                except Exception:
                    pass
            self._fallback_memory[f"otp:{phone}"] = data

    def delete_otp(self, phone: str):
        client = self.get_client()
        if client:
            try:
                client.delete(f"otp:{phone}")
            except Exception:
                pass
        self._fallback_memory.pop(f"otp:{phone}", None)

    # -------------------------------------------------------------
    # Geospatial Driver Tracking
    # -------------------------------------------------------------
    def update_driver_location(self, driver_id: str, lat: float, lng: float, metadata: Optional[Dict[str, Any]] = None):
        """
        Stores driver coordinate using Redis GEOADD for spatial queries
        and HSET for quick metadata access (speed, heading, vehicle category).
        """
        client = self.get_client()
        now = time.time()
        if client:
            try:
                pipeline = client.pipeline()
                # Redis GEOADD expects (longitude, latitude, member)
                pipeline.geoadd("drivers:geo", (lng, lat, driver_id))
                driver_meta = {
                    "driver_id": driver_id,
                    "lat": str(lat),
                    "lng": str(lng),
                    "updated_at": str(now)
                }
                if metadata:
                    for k, v in metadata.items():
                        driver_meta[str(k)] = str(v)
                pipeline.hset(f"driver:meta:{driver_id}", mapping=driver_meta)
                pipeline.expire(f"driver:meta:{driver_id}", 3600)  # 1 hour TTL
                pipeline.execute()
                return True
            except Exception as e:
                logger.error("Redis update_driver_location error: %s", str(e))

        # Fallback
        self._fallback_geo[driver_id] = (lat, lng, now)
        return True

    def remove_driver_location(self, driver_id: str):
        client = self.get_client()
        if client:
            try:
                client.zrem("drivers:geo", driver_id)
                client.delete(f"driver:meta:{driver_id}")
            except Exception:
                pass
        self._fallback_geo.pop(driver_id, None)

    def find_nearby_drivers(self, lat: float, lng: float, radius_km: float = 3.0) -> List[Dict[str, Any]]:
        """
        Uses Redis GEORADIUS / GEOSEARCH to find drivers within radius_km.
        Returns list of {driver_id, distance_km, lat, lng}.
        """
        client = self.get_client()
        results: List[Dict[str, Any]] = []

        if client:
            try:
                # Redis geosearch by radius
                res = client.geosearch(
                    "drivers:geo",
                    longitude=lng,
                    latitude=lat,
                    radius=radius_km,
                    unit="km",
                    withdist=True,
                    withcoord=True,
                    sort="ASC"
                )
                for item in res:
                    # item format: [driver_id, distance, (lon, lat)]
                    driver_id = item[0]
                    dist_km = round(float(item[1]), 2)
                    coord = item[2] if len(item) > 2 else (lng, lat)
                    driver_lon, driver_lat = coord[0], coord[1]

                    # Fetch metadata
                    meta = client.hgetall(f"driver:meta:{driver_id}") or {}
                    results.append({
                        "driver_id": driver_id,
                        "distance_km": dist_km,
                        "latitude": driver_lat,
                        "longitude": driver_lon,
                        "category": meta.get("category", "bike"),
                        "rating": float(meta.get("rating", 5.0)),
                        "full_name": meta.get("full_name", "Driver")
                    })
                return results
            except Exception as e:
                logger.error("Redis find_nearby_drivers error: %s", str(e))

        # Fallback math
        import math
        for d_id, (d_lat, d_lng, ts) in self._fallback_geo.items():
            # Haversine distance
            R = 6371.0
            dlat = math.radians(d_lat - lat)
            dlng = math.radians(d_lng - lng)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(d_lat)) * math.sin(dlng / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            dist = round(R * c, 2)
            if dist <= radius_km:
                results.append({
                    "driver_id": d_id,
                    "distance_km": dist,
                    "latitude": d_lat,
                    "longitude": d_lng,
                    "category": "bike",
                    "rating": 5.0,
                    "full_name": "Driver"
                })
        results.sort(key=lambda x: x["distance_km"])
        return results

    # -------------------------------------------------------------
    # Atomic Ride Locking (Race Condition & Double-Acceptance Prevention)
    # -------------------------------------------------------------
    def acquire_ride_lock(self, ride_id: str, driver_id: str, ttl_ms: int = 15000) -> bool:
        """
        Attempts to acquire an atomic distributed lock on the ride booking.
        Only the first driver to call this receives True (FIFO).
        """
        client = self.get_client()
        lock_key = f"ride:lock:{ride_id}"
        if client:
            try:
                # SET key value NX PX ttl_ms
                acquired = client.set(lock_key, driver_id, nx=True, px=ttl_ms)
                return bool(acquired)
            except Exception as e:
                logger.error("Redis acquire_ride_lock error: %s", str(e))

        # In-memory lock fallback
        if lock_key not in self._fallback_memory:
            self._fallback_memory[lock_key] = {"driver_id": driver_id, "expires_at": time.time() + (ttl_ms / 1000.0)}
            return True
        lock_entry = self._fallback_memory[lock_key]
        if time.time() > lock_entry["expires_at"]:
            self._fallback_memory[lock_key] = {"driver_id": driver_id, "expires_at": time.time() + (ttl_ms / 1000.0)}
            return True
        return lock_entry["driver_id"] == driver_id

    def release_ride_lock(self, ride_id: str, driver_id: str) -> bool:
        client = self.get_client()
        lock_key = f"ride:lock:{ride_id}"
        if client:
            try:
                # Lua script to release lock only if driver_id matches
                lua_script = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                res = client.eval(lua_script, 1, lock_key, driver_id)
                return bool(res)
            except Exception as e:
                logger.error("Redis release_ride_lock error: %s", str(e))

        if lock_key in self._fallback_memory and self._fallback_memory[lock_key]["driver_id"] == driver_id:
            del self._fallback_memory[lock_key]
            return True
        return False

    # -------------------------------------------------------------
    # Real-Time Ride Queue
    # -------------------------------------------------------------
    def enqueue_ride_request(self, ride_id: str) -> int:
        client = self.get_client()
        if client:
            try:
                return client.rpush("rides:queue", ride_id)
            except Exception:
                pass
        return 0

    def get_pending_queue(self) -> List[str]:
        client = self.get_client()
        if client:
            try:
                return client.lrange("rides:queue", 0, -1)
            except Exception:
                pass
        return []

    def remove_from_queue(self, ride_id: str):
        client = self.get_client()
        if client:
            try:
                client.lrem("rides:queue", 0, ride_id)
            except Exception:
                pass


# Singleton instance
redis_service = RedisService()
