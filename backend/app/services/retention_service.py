import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.models.ride import TripLocationPoint, RideBooking, RideStatus
from app.models.admin import RiderLocationHistory

logger = logging.getLogger(__name__)


class LocationRetentionService:
    """
    Manages location privacy retention, pruning, and anonymization policies:
    - Retains breadcrumb points for up to 30 days for disputes/safety
    - Purges raw GPS tracking breadcrumbs older than 30 days
    - Anonymizes exact pickup/dropoff coordinates on completed rides older than 90 days
    """

    DEFAULT_RETENTION_DAYS = 30
    ANONYMIZATION_DAYS = 90

    @classmethod
    def purge_expired_location_data(
        cls,
        db: Session,
        retention_days: int = DEFAULT_RETENTION_DAYS
    ) -> Dict[str, Any]:
        """Deletes high-resolution breadcrumb coordinates older than the retention threshold."""
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        # 1. Purge trip location points
        deleted_trip_points = db.query(TripLocationPoint).filter(
            TripLocationPoint.recorded_at < cutoff_date
        ).delete(synchronize_session=False)

        # 2. Purge rider background location pings
        deleted_rider_pings = db.query(RiderLocationHistory).filter(
            RiderLocationHistory.recorded_at < cutoff_date
        ).delete(synchronize_session=False)

        db.commit()

        logger.info(
            f"Location retention cleanup completed: purged {deleted_trip_points} trip points, "
            f"{deleted_rider_pings} rider pings older than {retention_days} days (cutoff: {cutoff_date})."
        )

        return {
            "status": "success",
            "retention_days": retention_days,
            "cutoff_date": cutoff_date.isoformat(),
            "purged_trip_points": deleted_trip_points,
            "purged_rider_pings": deleted_rider_pings
        }

    @classmethod
    def anonymize_old_completed_trips(
        cls,
        db: Session,
        days: int = ANONYMIZATION_DAYS
    ) -> int:
        """Rounds exact GPS coordinates on archived completed trips to 2 decimal places (~1.1 km) for privacy."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        old_rides = db.query(RideBooking).filter(
            RideBooking.status == RideStatus.COMPLETED,
            RideBooking.created_at < cutoff_date
        ).all()

        anonymized_count = 0
        for r in old_rides:
            r.pickup_latitude = round(r.pickup_latitude, 2)
            r.pickup_longitude = round(r.pickup_longitude, 2)
            r.destination_latitude = round(r.destination_latitude, 2)
            r.destination_longitude = round(r.destination_longitude, 2)
            r.route_polyline = None # Strip exact polyline
            anonymized_count += 1

        db.commit()
        return anonymized_count
