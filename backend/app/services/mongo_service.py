import time
import logging
from typing import Dict, Any, Optional, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from app.config import settings

logger = logging.getLogger(__name__)


class MongoService:
    """
    MongoDB Service for High-Volume Real-Time Telemetry and Document Storage:
    - Live Ride Breadcrumbs (GPS breadcrumbs recorded every second)
    - Rider-Driver Chat history
    - Ride State Transition Audit Trails
    - Driver Telemetry and System Events
    """

    def __init__(self):
        self._client: Optional[MongoClient] = None
        self._db = None
        self._connected: bool = False
        self._last_attempt: float = 0.0
        self._init_connection()

    def _init_connection(self):
        self._last_attempt = time.time()
        try:
            self._client = MongoClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=400,
                connectTimeoutMS=400
            )
            # Force server check
            self._client.admin.command('ping')
            self._db = self._client[settings.MONGODB_DB_NAME]
            self._connected = True
            self._setup_indexes()
            logger.info(" Connected to MongoDB at %s (DB: %s)", settings.MONGODB_URL, settings.MONGODB_DB_NAME)
        except Exception as e:
            self._connected = False
            self._db = None
            self._client = None
            logger.warning(" MongoDB connection failed (%s). Real-time telemetry will run in graceful fallback mode.", str(e))

    def _setup_indexes(self):
        if self._db is not None:
            try:
                # Breadcrumbs index
                self._db.ride_breadcrumbs.create_index([("ride_id", ASCENDING), ("timestamp", ASCENDING)])
                # Chat index
                self._db.ride_chats.create_index([("ride_id", ASCENDING), ("timestamp", ASCENDING)])
                # Audit logs index
                self._db.audit_logs.create_index([("ride_id", ASCENDING), ("timestamp", DESCENDING)])
                # Telemetry index with 7-day TTL expiration
                self._db.driver_telemetry.create_index([("created_at", ASCENDING)], expireAfterSeconds=604800)
            except Exception as e:
                logger.error("Error creating MongoDB indexes: %s", str(e))

    def is_connected(self) -> bool:
        if not self._connected or self._client is None:
            if time.time() - self._last_attempt < 300:
                return False
            self._init_connection()
        return self._connected

    # -------------------------------------------------------------
    # Live GPS Breadcrumb Tracking
    # -------------------------------------------------------------
    def save_breadcrumb(
        self,
        ride_id: str,
        lat: float,
        lng: float,
        speed: float = 0.0,
        heading: float = 0.0,
        accuracy: float = 0.0
    ) -> bool:
        """Saves a high-precision GPS coordinate point for the ongoing trip."""
        if not self.is_connected() or self._db is None:
            return False
        try:
            doc = {
                "ride_id": ride_id,
                "latitude": float(lat),
                "longitude": float(lng),
                "speed": float(speed),
                "heading": float(heading),
                "accuracy": float(accuracy),
                "timestamp": time.time()
            }
            self._db.ride_breadcrumbs.insert_one(doc)
            return True
        except Exception as e:
            logger.error("Mongo save_breadcrumb error: %s", str(e))
            return False

    def get_ride_breadcrumbs(self, ride_id: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """Returns ordered GPS trail for map replay or receipt review."""
        if not self.is_connected() or self._db is None:
            return []
        try:
            cursor = self._db.ride_breadcrumbs.find(
                {"ride_id": ride_id},
                {"_id": 0}
            ).sort("timestamp", ASCENDING).limit(limit)
            return list(cursor)
        except Exception as e:
            logger.error("Mongo get_ride_breadcrumbs error: %s", str(e))
            return []

    # -------------------------------------------------------------
    # In-Ride Chat Messages
    # -------------------------------------------------------------
    def save_chat_message(self, ride_id: str, sender_id: str, sender_role: str, text: str) -> Optional[Dict[str, Any]]:
        if not self.is_connected() or self._db is None:
            return None
        try:
            doc = {
                "ride_id": ride_id,
                "sender_id": sender_id,
                "sender_role": sender_role,
                "text": text,
                "timestamp": time.time()
            }
            res = self._db.ride_chats.insert_one(doc)
            doc["_id"] = str(res.inserted_id)
            return doc
        except Exception as e:
            logger.error("Mongo save_chat_message error: %s", str(e))
            return None

    def get_ride_chats(self, ride_id: str) -> List[Dict[str, Any]]:
        if not self.is_connected() or self._db is None:
            return []
        try:
            cursor = self._db.ride_chats.find({"ride_id": ride_id}, {"_id": 0}).sort("timestamp", ASCENDING)
            return list(cursor)
        except Exception as e:
            logger.error("Mongo get_ride_chats error: %s", str(e))
            return []

    # -------------------------------------------------------------
    # Audit & Ride Event Logging
    # -------------------------------------------------------------
    def log_ride_event(self, ride_id: str, event_type: str, actor_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        if not self.is_connected() or self._db is None:
            return
        try:
            doc = {
                "ride_id": ride_id,
                "event": event_type,
                "actor_id": actor_id,
                "details": details or {},
                "timestamp": time.time()
            }
            self._db.audit_logs.insert_one(doc)
        except Exception as e:
            logger.error("Mongo log_ride_event error: %s", str(e))


# Singleton instance
mongo_service = MongoService()
