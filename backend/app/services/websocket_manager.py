import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket

from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        # Maps user_id -> set of active WebSockets (allows multiple tabs/devices)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps user_id -> role string
        self.user_roles: Dict[str, str] = {}

    async def connect(self, user_id: str, role: str, websocket: WebSocket):
        """Registers a new WebSocket connection for a user."""
        if websocket.client_state == WebSocketState.CONNECTING:
            await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.user_roles[user_id] = role
        logger.info(f"WebSocket connected: user_id={user_id}, role={role}. Total active: {len(self.active_connections)}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        """Removes a disconnected WebSocket."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.user_roles.pop(user_id, None)
        logger.info(f"WebSocket disconnected: user_id={user_id}")

    async def send_to_user(self, user_id: str, message: Dict[str, Any]) -> bool:
        """Sends a JSON message to all active sockets of a specific user with event metadata."""
        if user_id not in self.active_connections:
            return False

        # Ensure every outgoing WebSocket payload has unique event_id and timestamp
        msg_copy = dict(message)
        if "timestamp" not in msg_copy:
            msg_copy["timestamp"] = datetime.now(timezone.utc).isoformat()
        if "event_id" not in msg_copy:
            msg_copy["event_id"] = str(uuid.uuid4())

        sockets = list(self.active_connections[user_id])
        dead_sockets = []
        payload = json.dumps(msg_copy)
        success = False

        for ws in sockets:
            try:
                await ws.send_text(payload)
                success = True
            except Exception as e:
                logger.warning(f"Error sending to user {user_id}: {e}")
                dead_sockets.append(ws)

        for ws in dead_sockets:
            self.disconnect(user_id, ws)

        return success

    async def broadcast_to_riders(self, rider_ids: Set[str], message: Dict[str, Any]):
        """Dispatches an incoming ride request or update to candidate riders."""
        for rider_id in rider_ids:
            await self.send_to_user(rider_id, message)

    async def broadcast_ride_update(
        self,
        ride_id: str,
        message: Dict[str, Any],
        passenger_id: Optional[str] = None,
        rider_id: Optional[str] = None
    ):
        """Broadcasts ride state changes and live tracking coordinates to both parties."""
        payload = {"ride_id": ride_id, **message}
        if passenger_id:
            await self.send_to_user(passenger_id, payload)
        if rider_id:
            await self.send_to_user(rider_id, payload)

    async def broadcast_to_admins(self, message: Dict[str, Any]):
        """Broadcasts real-time events to all connected admin consoles."""
        for user_id, role in self.user_roles.items():
            if role == "admin":
                await self.send_to_user(user_id, message)


# Global WebSocket manager singleton instance
ws_manager = WebSocketManager()
