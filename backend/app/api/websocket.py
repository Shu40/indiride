import json
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.database import SessionLocal
from app.utils.security import decode_token
from app.services.websocket_manager import ws_manager
from app.services.ride_service import RideService
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Real-time WebSockets"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    Real-time bidirectional WebSocket channel for passengers, riders, and admins.
    Authenticates client using JWT bearer token query param.
    """
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        try:
            await websocket.accept()
            await websocket.send_text(json.dumps({
                "event": "auth_error",
                "error": "token_expired",
                "message": "Authentication token is invalid or expired. Please log in again."
            }))
            await websocket.close(code=1008, reason="Invalid or expired token")
        except Exception:
            pass
        return

    user_id = payload.get("sub")
    user_role = payload.get("role", "passenger")

    await websocket.accept()
    await ws_manager.connect(user_id=user_id, role=user_role, websocket=websocket)

    # Send initial connection acknowledgment
    await websocket.send_text(json.dumps({
        "event": "connected",
        "user_id": user_id,
        "role": user_role,
        "message": "Connected to real-time dispatch channel",
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
                msg_type = data.get("type") or data.get("event")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "rider_location" and user_role == "rider":
                    # Instant rider location ingestion via WebSocket
                    lat = data.get("latitude")
                    lng = data.get("longitude")
                    heading = data.get("heading")
                    speed = data.get("speed")
                    if lat and lng:
                        db = SessionLocal()
                        try:
                            await RideService.update_rider_location(
                                db=db,
                                rider_user_id=user_id,
                                latitude=lat,
                                longitude=lng,
                                heading=heading,
                                speed=speed
                            )
                        finally:
                            db.close()

            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
        if user_role == "rider":
            db = SessionLocal()
            try:
                from app.models.ride import RideBooking, RideStatus
                active_ride = db.query(RideBooking).filter(
                    RideBooking.rider_id == user_id,
                    RideBooking.status.in_([
                        RideStatus.RIDER_ASSIGNED,
                        RideStatus.RIDER_ARRIVING,
                        RideStatus.RIDER_ARRIVED,
                        RideStatus.IN_PROGRESS
                    ])
                ).first()
                if active_ride:
                    import asyncio
                    asyncio.create_task(ws_manager.send_to_user(active_ride.passenger_id, {
                        "event": "driver_offline_alert",
                        "ride_id": active_ride.id,
                        "message": "Driver device temporarily disconnected. Live tracking paused.",
                        "is_stale": True
                    }))
            finally:
                db.close()
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        ws_manager.disconnect(user_id, websocket)

