import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

import uuid
from app.database import get_db
from app.models.user import User, UserRole, RiderProfile, RiderApprovalStatus, PassengerProfile
from app.models.ride import RideBooking, RideStatus
from app.models.admin import AdminAuditLog, PromoCode
from app.models.festival import FestivalCampaign
from app.models.community_ride import CommunityRide, CampusHostProfile
from app.api.deps import require_roles

router = APIRouter(prefix="/admin", tags=["Admin Portal & Platform Control"])


class RiderApprovalRequest(BaseModel):
    status: RiderApprovalStatus
    reason: Optional[str] = None


@router.get("/overview")
def get_system_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Provides high-level platform health metrics for admin console."""
    total_passengers = db.query(PassengerProfile).count()
    total_riders = db.query(RiderProfile).count()
    pending_approvals = db.query(RiderProfile).filter(RiderProfile.status == RiderApprovalStatus.PENDING).count()
    online_riders = db.query(RiderProfile).filter(RiderProfile.is_online == True).count()
    total_trips = db.query(RideBooking).count()
    active_trips = db.query(RideBooking).filter(
        RideBooking.status.in_([
            RideStatus.SEARCHING_FOR_RIDER,
            RideStatus.REQUESTS_SENT,
            RideStatus.EXPANDING_SEARCH,
            RideStatus.RIDER_ASSIGNED,
            RideStatus.RIDER_ARRIVING,
            RideStatus.RIDER_ARRIVED,
            RideStatus.IN_PROGRESS
        ])
    ).count()

    completed_rides = db.query(RideBooking).filter(RideBooking.status == RideStatus.COMPLETED).all()
    total_revenue = sum(r.final_fare or r.estimated_fare for r in completed_rides)

    return {
        "passengers": total_passengers,
        "riders": {
            "total": total_riders,
            "pending_approvals": pending_approvals,
            "online": online_riders
        },
        "trips": {
            "total": total_trips,
            "active": active_trips,
            "completed": len(completed_rides)
        },
        "revenue": {
            "total_gross_inr": round(total_revenue, 2),
            "platform_commission_20pct": round(total_revenue * 0.20, 2)
        }
    }


@router.get("/riders")
def list_riders(
    status_filter: Optional[RiderApprovalStatus] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Lists registered riders with approval status, vehicles, and license."""
    query = db.query(RiderProfile).join(User)
    if status_filter:
        query = query.filter(RiderProfile.status == status_filter)

    riders = query.all()
    results = []
    for r in riders:
        user = r.user
        vehicle = r.vehicles[0] if r.vehicles else None
        results.append({
            "rider_id": user.id,
            "profile_id": r.id,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "email": user.email,
            "license_number": r.license_number,
            "status": r.status.value,
            "is_online": r.is_online,
            "is_busy": r.is_busy,
            "rating": r.rating,
            "total_trips": r.total_completed_trips,
            "total_earnings": r.total_earnings,
            "permanent_address": r.permanent_address,
            "current_address": r.current_address,
            "passport_photo": r.passport_photo or user.profile_photo,
            "license_photo": r.license_photo,
            "aadhaar_number": r.aadhaar_number,
            "aadhaar_photo": r.aadhaar_photo,
            "rejection_reason": r.rejection_reason,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else (user.created_at.isoformat() if user.created_at else None),
            "verified_at": r.verified_at.isoformat() if r.verified_at else None,
            "vehicle": {
                "category": vehicle.category.value if vehicle else None,
                "model": vehicle.model if vehicle else None,
                "plate": vehicle.license_plate if vehicle else None
            } if vehicle else None,
            "rider_service_type": r.rider_service_type or "REGULAR",
            "served_universities": r.served_universities,
            "college_name": r.college_name,
            "academic_year": r.academic_year,
            "student_id_number": r.student_id_number,
            "student_id_photo": r.student_id_photo,
            "created_at": user.created_at
        })
    return results


@router.get("/campus-drivers")
def list_campus_drivers(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Lists all registered Campus Drivers with college/university, academic year,
    student ID card, Aadhaar, vehicle details and active campus rides.
    """
    campus_riders = db.query(RiderProfile).join(User).filter(
        or_(
            RiderProfile.rider_service_type == "CAMPUS",
            RiderProfile.college_name != None,
            RiderProfile.served_universities != None
        )
    ).all()
    results = []
    for r in campus_riders:
        user = r.user
        vehicle = r.vehicles[0] if r.vehicles else None
        results.append({
            "id": r.id,
            "rider_id": user.id,
            "user_id": user.id,
            "profile_id": r.id,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "email": user.email,
            "college_name": r.college_name or r.served_universities or "Parul University",
            "served_universities": r.served_universities,
            "academic_year": r.academic_year or "Current Academic Year",
            "student_id_number": r.student_id_number or "Uploaded / Attached",
            "student_id_photo": r.student_id_photo or r.passport_photo,
            "aadhaar_number": r.aadhaar_number,
            "aadhaar_photo": r.aadhaar_photo,
            "vehicle_plate": vehicle.license_plate if vehicle else (r.license_number or "N/A"),
            "vehicle_category": vehicle.category.value if vehicle else "bike",
            "vehicle_model": vehicle.model if vehicle else "Hero Splendor",
            "status": r.status.value,
            "is_online": r.is_online,
            "rating": r.rating,
            "vehicle": {
                "category": vehicle.category.value if vehicle else "Bike",
                "model": vehicle.model if vehicle else "Two Wheeler",
                "plate": vehicle.license_plate if vehicle else "N/A"
            } if vehicle else None,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None
        })
    return results


@router.put("/riders/{rider_user_id}/status")
def update_rider_approval_status(
    rider_user_id: str,
    request: RiderApprovalRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin approves or rejects a rider application with optional reason."""
    user = db.query(User).filter(User.id == rider_user_id).first()
    if not user or not user.rider_profile:
        raise HTTPException(status_code=404, detail="Rider not found.")

    profile = user.rider_profile
    old_status = profile.status
    profile.status = request.status

    if request.status == RiderApprovalStatus.APPROVED:
        profile.verified_at = datetime.utcnow()
        profile.rejection_reason = None
    elif request.status == RiderApprovalStatus.REJECTED:
        profile.rejection_reason = request.reason or "Documents do not match verification criteria"
        profile.is_online = False
    elif request.status == RiderApprovalStatus.SUSPENDED:
        profile.is_online = False

    # Record Audit Log
    db.add(AdminAuditLog(
        admin_id=current_admin.id,
        action="update_rider_approval_status",
        entity_type="RiderProfile",
        entity_id=profile.id,
        details=json.dumps({
            "old_status": old_status.value,
            "new_status": request.status.value,
            "reason": request.reason
        })
    ))

    db.commit()
    db.refresh(profile)
    return {
        "rider_id": user.id,
        "full_name": user.full_name,
        "new_status": profile.status.value,
        "rejection_reason": profile.rejection_reason,
        "message": f"Rider status updated to {profile.status.value}"
    }


@router.get("/rides")
def list_all_rides(
    status_filter: Optional[RideStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Lists all rides across the platform with filtering."""
    query = db.query(RideBooking)
    if status_filter:
        query = query.filter(RideBooking.status == status_filter)

    rides = query.order_by(RideBooking.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "passenger_id": r.passenger_id,
            "passenger_name": r.passenger.full_name if r.passenger else None,
            "rider_id": r.rider_id,
            "rider_name": r.rider.full_name if r.rider else None,
            "vehicle_category": r.vehicle_category.value,
            "pickup_address": r.pickup_address,
            "destination_address": r.destination_address,
            "distance_km": r.estimated_distance_km,
            "fare": r.final_fare or r.estimated_fare,
            "status": r.status.value,
            "created_at": r.created_at
        }
        for r in rides
    ]


class FestivalUpdateRequest(BaseModel):
    festival_name: str
    tagline: str
    banner_title: Optional[str] = None
    banner_subtitle: Optional[str] = None
    promo_code: str
    discount_percent: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True
    theme_color: Optional[str] = "#d97706"


def _parse_campaign_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str or not dt_str.strip():
        return None
    cleaned = dt_str.strip()
    try:
        return datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(cleaned, fmt)
        except Exception:
            pass
    return None


@router.get("/festival")
def get_admin_festival(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin retrieves active festival campaign with start/end date status."""
    camp = db.query(FestivalCampaign).filter(FestivalCampaign.id == "active").first()
    if not camp:
        camp = FestivalCampaign(
            id="active",
            festival_name="General Festive Offer",
            tagline="Enjoy special discounts on rides!",
            banner_title="Special Offer",
            banner_subtitle="Enjoy special discounts on rides!",
            promo_code="OFFER10",
            discount_percent=10.0,
            is_active=False,
            theme_color="#d97706"
        )
        db.add(camp)
        db.commit()
        db.refresh(camp)

    now = datetime.now(timezone.utc)
    status_label = "inactive"
    if camp.is_active:
        status_label = "live"
        if camp.end_date:
            end_dt = camp.end_date if camp.end_date.tzinfo else camp.end_date.replace(tzinfo=timezone.utc)
            if now > end_dt:
                status_label = "expired"
                camp.is_active = False
                db.commit()
        if camp.start_date:
            start_dt = camp.start_date if camp.start_date.tzinfo else camp.start_date.replace(tzinfo=timezone.utc)
            if now < start_dt:
                status_label = "scheduled"

    return {
        "id": camp.id,
        "festival_name": camp.festival_name,
        "tagline": camp.tagline,
        "banner_title": camp.banner_title or camp.festival_name,
        "banner_subtitle": camp.banner_subtitle or camp.tagline,
        "promo_code": camp.promo_code,
        "discount_percent": camp.discount_percent,
        "start_date": camp.start_date.isoformat() if camp.start_date else None,
        "end_date": camp.end_date.isoformat() if camp.end_date else None,
        "is_active": camp.is_active,
        "theme_color": camp.theme_color,
        "status": status_label
    }


@router.post("/festival")
def update_admin_festival(
    request: FestivalUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin uploads / updates festival campaign details (Dates, Name, Code, Discount)."""
    camp = db.query(FestivalCampaign).filter(FestivalCampaign.id == "active").first()
    if not camp:
        camp = FestivalCampaign(id="active")
        db.add(camp)

    camp.festival_name = request.festival_name.strip()
    camp.tagline = request.tagline.strip()
    camp.banner_title = request.banner_title.strip() if request.banner_title else request.festival_name.strip()
    camp.banner_subtitle = request.banner_subtitle.strip() if request.banner_subtitle else request.tagline.strip()
    camp.promo_code = request.promo_code.strip().upper()
    camp.discount_percent = float(request.discount_percent)
    camp.is_active = bool(request.is_active)
    if request.theme_color:
        camp.theme_color = request.theme_color

    parsed_start = _parse_campaign_datetime(request.start_date)
    parsed_end = _parse_campaign_datetime(request.end_date)
    camp.start_date = parsed_start
    camp.end_date = parsed_end

    # If end date is in the past, mark inactive
    now = datetime.now(timezone.utc)
    if parsed_end:
        end_check = parsed_end if parsed_end.tzinfo else parsed_end.replace(tzinfo=timezone.utc)
        if now > end_check:
            camp.is_active = False

    db.commit()
    db.refresh(camp)
    return {
        "success": True,
        "message": f"Festival campaign '{camp.festival_name}' saved successfully.",
        "campaign": {
            "festival_name": camp.festival_name,
            "banner_title": camp.banner_title,
            "banner_subtitle": camp.banner_subtitle,
            "promo_code": camp.promo_code,
            "discount_percent": camp.discount_percent,
            "start_date": camp.start_date.isoformat() if camp.start_date else None,
            "end_date": camp.end_date.isoformat() if camp.end_date else None,
            "is_active": camp.is_active
        }
    }


@router.delete("/festival")
def delete_admin_festival(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin deletes/clears the active festival campaign so no expired offer shows."""
    camp = db.query(FestivalCampaign).filter(FestivalCampaign.id == "active").first()
    if camp:
        camp.is_active = False
        camp.end_date = datetime.now(timezone.utc)
        db.commit()
    return {"success": True, "message": "Festival campaign deleted and deactivated."}


@router.post("/retention/purge-locations")
def purge_location_history(
    retention_days: int = Query(30, ge=1, le=365),
    anonymize_trips: bool = Query(True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Admin-only endpoint to execute location data retention and privacy purging policies.
    Deletes breadcrumb tracking points older than retention_days.
    Optionally anonymizes exact coordinates on completed trips older than 90 days.
    """
    from app.services.retention_service import LocationRetentionService
    result = LocationRetentionService.purge_expired_location_data(db, retention_days=retention_days)
    if anonymize_trips:
        anonymized = LocationRetentionService.anonymize_old_completed_trips(db, days=90)
        result["anonymized_trips"] = anonymized

    # Record Admin Audit Log
    db.add(AdminAuditLog(
        admin_id=current_admin.id,
        action="purge_location_history",
        entity_type="TripLocationPoint",
        entity_id="retention_batch",
        details=json.dumps(result)
    ))
    db.commit()

    return result


@router.get("/passengers")
def list_passengers(
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin queries registered passengers with trip history count and total spend."""
    query = db.query(User).filter(User.role == UserRole.PASSENGER)
    if search:
        query = query.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.phone_number.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    users = query.order_by(User.created_at.desc()).limit(limit).all()
    results = []
    for u in users:
        trips = db.query(RideBooking).filter(RideBooking.passenger_id == u.id).all()
        completed = [t for t in trips if t.status == RideStatus.COMPLETED]
        total_spend = sum(t.final_fare or t.estimated_fare or 0.0 for t in completed)
        results.append({
            "passenger_id": u.id,
            "full_name": u.full_name,
            "phone_number": u.phone_number,
            "email": u.email,
            "is_active": u.is_active,
            "total_bookings": len(trips),
            "completed_trips": len(completed),
            "total_spend_inr": round(total_spend, 2),
            "created_at": u.created_at
        })
    return results


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin retrieves immutable audit logs of sensitive operations."""
    logs = db.query(AdminAuditLog).order_by(AdminAuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "admin_id": l.admin_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": json.loads(l.details) if l.details else None,
            "timestamp": l.timestamp
        }
        for l in logs
    ]


@router.get("/finance/summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Provides financial reconciliation: gross revenue, 15% platform split, and 85% driver net."""
    completed = db.query(RideBooking).filter(RideBooking.status == RideStatus.COMPLETED).all()
    gross = sum(r.final_fare or r.estimated_fare or 0.0 for r in completed)
    commission = gross * 0.15
    driver_payout = gross * 0.85
    avg_ticket = (gross / len(completed)) if completed else 0.0

    return {
        "completed_rides_count": len(completed),
        "gross_booking_value_inr": round(gross, 2),
        "platform_commission_inr": round(commission, 2),
        "driver_earnings_payout_inr": round(driver_payout, 2),
        "average_ticket_size_inr": round(avg_ticket, 2),
        "commission_rate": "15%",
        "driver_share_rate": "85%"
    }


@router.get("/support/tickets")
def list_support_tickets(
    status_filter: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin retrieves passenger and driver support cases."""
    from app.models.admin import SupportTicket
    query = db.query(SupportTicket)
    if status_filter:
        query = query.filter(SupportTicket.status == status_filter)

    tickets = query.order_by(SupportTicket.created_at.desc()).limit(limit).all()
    results = []
    for t in tickets:
        user = db.query(User).filter(User.id == t.user_id).first()
        results.append({
            "ticket_id": t.id,
            "user_id": t.user_id,
            "user_name": user.full_name if user else "User",
            "user_role": user.role.value if user else "unknown",
            "user_phone": user.phone_number if user else "",
            "ride_id": t.ride_id,
            "subject": t.subject,
            "description": t.description,
            "status": t.status,
            "created_at": t.created_at
        })
    return results


@router.put("/support/tickets/{ticket_id}")
def update_support_ticket(
    ticket_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin updates resolution status for a support ticket."""
    from app.models.admin import SupportTicket
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found.")

    new_status = payload.get("status", ticket.status)
    ticket.status = new_status

    db.add(AdminAuditLog(
        admin_id=current_admin.id,
        action="update_support_ticket",
        entity_type="SupportTicket",
        entity_id=ticket.id,
        details=json.dumps({"new_status": new_status, "notes": payload.get("notes")})
    ))
    db.commit()
    db.refresh(ticket)
    return {"status": "updated", "ticket_id": ticket.id, "ticket_status": ticket.status}


# ==================================================
# CARPOOL MODERATION & SCHEDULED RIDE MONITORING
# ==================================================

@router.get("/carpools")
def list_carpools_for_admin(
    status_filter: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin reviews all community carpools with seat occupancy and bookings."""
    from app.models.community_ride import CommunityRide
    query = db.query(CommunityRide)
    if status_filter:
        query = query.filter(CommunityRide.status == status_filter)
    rides = query.order_by(CommunityRide.created_at.desc()).limit(limit).all()

    results = []
    for r in rides:
        results.append({
            "id": r.id,
            "creator_id": r.creator_id,
            "creator_name": r.creator_name,
            "creator_phone": r.creator_phone,
            "pickup_address": r.pickup_address,
            "destination_address": r.destination_address,
            "departure_time": r.departure_time,
            "departure_datetime": r.departure_datetime,
            "price_per_seat": r.price_per_seat,
            "total_seats": r.total_seats,
            "available_seats": r.available_seats,
            "booked_seats": r.total_seats - r.available_seats,
            "vehicle_info": r.vehicle_info,
            "status": r.status,
            "created_at": r.created_at,
            "total_bookings": len(r.bookings),
            "reservations": [
                {
                    "booking_id": b.id,
                    "passenger_name": b.passenger_name,
                    "passenger_phone": b.passenger_phone,
                    "seats_booked": b.seats_booked,
                    "total_price": b.total_price,
                    "platform_fee": b.platform_fee,
                    "status": b.status,
                    "created_at": b.created_at
                }
                for b in r.bookings
            ]
        })
    return results


@router.post("/carpools/{ride_id}/moderate")
def moderate_carpool_ride(
    ride_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin cancels or suspends a carpool trip for policy violations with audit logging."""
    from app.models.community_ride import CommunityRide
    ride = db.query(CommunityRide).filter(CommunityRide.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Carpool ride not found.")

    action = payload.get("action", "CANCEL")  # CANCEL, REMOVE
    reason = payload.get("reason", "Violation of platform policies")

    ride.status = "CANCELLED"
    # Cancel all active bookings
    for b in ride.bookings:
        if b.status in ("CONFIRMED", "PENDING"):
            b.status = "CANCELLED"
            b.cancellation_reason = f"Cancelled by Administrator: {reason}"

    db.add(AdminAuditLog(
        admin_id=current_admin.id,
        action="moderate_carpool_ride",
        entity_type="CommunityRide",
        entity_id=ride.id,
        details=json.dumps({"action": action, "reason": reason, "host": ride.creator_name})
    ))
    db.commit()

    return {
        "success": True,
        "ride_id": ride.id,
        "status": ride.status,
        "message": f"Carpool moderated ({action}): {reason}"
    }


@router.get("/scheduled-rides")
def list_scheduled_rides_for_admin(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin monitors all upcoming scheduled bookings and dispatch readiness."""
    rides = db.query(RideBooking).filter(
        RideBooking.status == RideStatus.SCHEDULED
    ).order_by(RideBooking.scheduled_for.asc()).limit(limit).all()

    results = []
    for r in rides:
        results.append({
            "id": r.id,
            "passenger_id": r.passenger_id,
            "passenger_name": r.passenger.full_name if r.passenger else "Unknown",
            "passenger_phone": r.passenger.phone_number if r.passenger else "",
            "vehicle_category": r.vehicle_category.value if hasattr(r.vehicle_category, "value") else str(r.vehicle_category),
            "pickup_address": r.pickup_address,
            "destination_address": r.destination_address,
            "estimated_fare": r.estimated_fare,
            "scheduled_for": r.scheduled_for,
            "created_at": r.created_at,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status)
        })
    return results


# ==========================================
# CAMPUS VEHICLES & HOST VERIFICATION
# ==========================================

class CampusVehicleStatusRequest(BaseModel):
    status: str # "VERIFIED", "BLOCKED", "PENDING"
    notes: Optional[str] = None


@router.get("/campus-vehicles")
def list_campus_vehicles(
    status_filter: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Admin views all users who registered vehicles for campus rides/carpools,
    with their Driving License, Vehicle Plate, Vehicle Type, verification status,
    and total posted rides count.
    """
    query = db.query(CampusHostProfile).join(User, CampusHostProfile.user_id == User.id)
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(CampusHostProfile.status == status_filter.upper())

    profiles = query.order_by(CampusHostProfile.created_at.desc()).limit(limit).all()
    results = []
    for p in profiles:
        user = p.user
        rides_count = db.query(CommunityRide).filter(CommunityRide.creator_id == user.id).count() if user else 0
        completed_count = db.query(CommunityRide).filter(
            CommunityRide.creator_id == user.id,
            CommunityRide.status == "COMPLETED"
        ).count() if user else 0

        results.append({
            "profile_id": p.id,
            "user_id": p.user_id,
            "full_name": user.full_name if user else "Unknown User",
            "phone_number": user.phone_number if user else "",
            "email": user.email if user else None,
            "license_number": p.license_number,
            "vehicle_plate": p.vehicle_plate,
            "vehicle_type": p.vehicle_type,
            "vehicle_model": p.vehicle_model or "Not specified",
            "status": p.status,
            "verification_notes": p.verification_notes,
            "verified_at": p.verified_at,
            "created_at": p.created_at,
            "total_posted_rides": rides_count,
            "completed_rides": completed_count,
            "can_post_multiple": p.status == "VERIFIED"
        })
    return results


@router.put("/campus-vehicles/{profile_id}/status")
def update_campus_vehicle_status(
    profile_id: str,
    request: CampusVehicleStatusRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Admin verifies (APPROVES) or BLOCKS a campus ride poster.
    When VERIFIED: user can post multiple rides per day.
    When BLOCKED: user is prohibited from posting any rides.
    """
    profile = db.query(CampusHostProfile).filter(CampusHostProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Campus vehicle profile not found.")

    new_status = request.status.upper()
    if new_status not in ["VERIFIED", "BLOCKED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Status must be VERIFIED, BLOCKED, or PENDING.")

    old_status = profile.status
    profile.status = new_status
    profile.verification_notes = request.notes
    if new_status == "VERIFIED":
        profile.verified_at = datetime.now(timezone.utc)

    db.add(AdminAuditLog(
        admin_id=current_admin.id,
        action="update_campus_vehicle_status",
        entity_type="CampusHostProfile",
        entity_id=profile.id,
        details=json.dumps({
            "old_status": old_status,
            "new_status": new_status,
            "user_id": profile.user_id,
            "notes": request.notes
        })
    ))

    db.commit()
    db.refresh(profile)
    return {
        "success": True,
        "profile_id": profile.id,
        "user_id": profile.user_id,
        "new_status": profile.status,
        "message": f"Host status updated to {new_status}. {'Host can now post multiple daily rides.' if new_status == 'VERIFIED' else ''}"
    }


# ==========================================
# PROMO & OFFER CODES MANAGEMENT
# ==========================================

class CreatePromoCodeRequest(BaseModel):
    code: str
    discount_percent: float
    max_discount_amount: Optional[float] = 100.0
    min_order_amount: Optional[float] = 20.0
    description: Optional[str] = None
    is_active: bool = True


@router.get("/promo-codes")
def list_promo_codes(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin retrieves all created discount & promo codes."""
    codes = db.query(PromoCode).order_by(PromoCode.created_at.desc()).all()
    # Seed default active codes if table is empty
    if not codes:
        default_codes = [
            PromoCode(
                id=str(uuid.uuid4()),
                code="CHHATH10",
                discount_percent=10.0,
                max_discount_amount=50.0,
                min_order_amount=20.0,
                description="Chhath Puja Mahaparv Special 🌅 10% OFF on all rides",
                is_active=True
            ),
            PromoCode(
                id=str(uuid.uuid4()),
                code="DIWALI5",
                discount_percent=5.0,
                max_discount_amount=50.0,
                min_order_amount=20.0,
                description="Shubh Diwali Festival Dhamaka 🪔 5% OFF",
                is_active=True
            ),
            PromoCode(
                id=str(uuid.uuid4()),
                code="CAMPUS20",
                discount_percent=20.0,
                max_discount_amount=50.0,
                min_order_amount=20.0,
                description="Campus Special • Self Ride 20% OFF for students & faculty",
                is_active=True
            ),
            PromoCode(
                id=str(uuid.uuid4()),
                code="INDIRIDE50",
                discount_percent=50.0,
                max_discount_amount=75.0,
                min_order_amount=30.0,
                description="Flat 50% discount on first ride",
                is_active=True
            ),
            PromoCode(
                id=str(uuid.uuid4()),
                code="DIWALI50",
                discount_percent=5.0,
                max_discount_amount=50.0,
                min_order_amount=20.0,
                description="Diwali Festival Dhamaka 🪔 5% OFF",
                is_active=True
            ),
        ]
        db.add_all(default_codes)
        db.commit()
        codes = default_codes

    return [
        {
            "id": c.id,
            "code": c.code,
            "discount_percent": c.discount_percent,
            "max_discount_amount": c.max_discount_amount,
            "min_order_amount": c.min_order_amount,
            "description": c.description,
            "is_active": c.is_active,
            "created_at": c.created_at
        }
        for c in codes
    ]


@router.post("/promo-codes")
def create_promo_code(
    request: CreatePromoCodeRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin creates a new offer/promo code."""
    cleaned_code = request.code.strip().upper()
    existing = db.query(PromoCode).filter(PromoCode.code == cleaned_code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Promo code '{cleaned_code}' already exists. Edit or delete the existing one."
        )

    promo = PromoCode(
        id=str(uuid.uuid4()),
        code=cleaned_code,
        discount_percent=request.discount_percent,
        max_discount_amount=request.max_discount_amount or 100.0,
        min_order_amount=request.min_order_amount or 20.0,
        description=request.description or f"{request.discount_percent}% Discount Code",
        is_active=request.is_active
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)

    return {
        "success": True,
        "message": f"Promo code '{cleaned_code}' created successfully!",
        "promo": {
            "id": promo.id,
            "code": promo.code,
            "discount_percent": promo.discount_percent,
            "description": promo.description,
            "is_active": promo.is_active
        }
    }


@router.put("/promo-codes/{code_id}/toggle")
def toggle_promo_code(
    code_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin activates or deactivates an offer code."""
    promo = db.query(PromoCode).filter(PromoCode.id == code_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found.")

    promo.is_active = not promo.is_active
    db.commit()
    db.refresh(promo)
    return {
        "success": True,
        "id": promo.id,
        "code": promo.code,
        "is_active": promo.is_active,
        "message": f"Promo code {promo.code} is now {'ACTIVE' if promo.is_active else 'INACTIVE'}."
    }


class UpdateNewUserDiscountRequest(BaseModel):
    discount_percent: Optional[float] = None
    max_discount_amount: Optional[float] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class GrantVoucherRequest(BaseModel):
    user_id: str
    voucher_count: int = 1


class SetUserTripsRequest(BaseModel):
    user_id: str
    total_trips: int


@router.get("/loyalty/config")
def get_admin_loyalty_config(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin views current New User 90% discount config and loyalty tier rules."""
    from app.services.loyalty_service import LoyaltyService
    cfg = LoyaltyService.get_or_create_new_user_config(db)
    return {
        "new_user_discount": {
            "discount_percent": cfg.discount_percent,
            "max_discount_amount": cfg.max_discount_amount,
            "is_active": cfg.is_active,
            "description": cfg.description,
            "updated_at": cfg.updated_at
        },
        "tiers": [
            {"tier": "NEW_USER", "rides": 0, "discount": f"{cfg.discount_percent}% (1st ride)", "rewards": "Auto-applied welcome discount"},
            {"tier": "MEMBER", "rides": "1-99", "discount": "0%", "rewards": "Member rates"},
            {"tier": "BRONZE", "rides": 100, "discount": "10%", "rewards": "1 Free Ride Voucher + Bronze Badge"},
            {"tier": "SILVER", "rides": 150, "discount": "15%", "rewards": "1 Free Ride Voucher + Silver Badge (Strictly 15%, not 25%)"},
            {"tier": "GOLD", "rides": 200, "discount": "20%", "rewards": "2 Free Ride Vouchers + Golden Badge"},
            {"tier": "DIAMOND", "rides": 300, "discount": "25%", "rewards": "Permanent Member of IndiRide + VIP Swags, Gifts & Prizes"}
        ]
    }


@router.put("/loyalty/config")
def update_admin_loyalty_config(
    request: UpdateNewUserDiscountRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin configures or toggles the New User 1st ride discount (e.g. 90%)."""
    from app.services.loyalty_service import LoyaltyService
    cfg = LoyaltyService.get_or_create_new_user_config(db)
    if request.discount_percent is not None:
        cfg.discount_percent = float(request.discount_percent)
    if request.max_discount_amount is not None:
        cfg.max_discount_amount = float(request.max_discount_amount)
    if request.is_active is not None:
        cfg.is_active = bool(request.is_active)
    if request.description is not None:
        cfg.description = str(request.description)

    db.commit()
    db.refresh(cfg)
    return {
        "success": True,
        "message": "New User discount configuration updated successfully.",
        "config": {
            "discount_percent": cfg.discount_percent,
            "max_discount_amount": cfg.max_discount_amount,
            "is_active": cfg.is_active,
            "description": cfg.description
        }
    }


@router.get("/loyalty/users")
def get_admin_loyalty_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin views all passengers with their current loyalty tiers, completed rides, and vouchers."""
    from app.services.loyalty_service import LoyaltyService
    passengers = db.query(User).filter(User.role == UserRole.PASSENGER).all()
    results = []
    for p in passengers:
        summary = LoyaltyService.get_passenger_loyalty_summary(db, p.id)
        results.append(summary)
    return results


@router.post("/loyalty/grant-voucher")
def admin_grant_voucher(
    request: GrantVoucherRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin grants free ride vouchers to a user."""
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user or not user.passenger_profile:
        raise HTTPException(status_code=404, detail="Passenger user not found.")

    user.passenger_profile.free_rides_vouchers = (user.passenger_profile.free_rides_vouchers or 0) + max(1, request.voucher_count)
    db.commit()
    return {
        "success": True,
        "user_id": user.id,
        "full_name": user.full_name,
        "free_rides_vouchers": user.passenger_profile.free_rides_vouchers,
        "message": f"Successfully granted {request.voucher_count} free ride voucher(s) to {user.full_name}."
    }


@router.post("/loyalty/set-user-trips")
def admin_set_user_trips(
    request: SetUserTripsRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN))
):
    """Admin sets user completed trips count to test tiers (0 for New, 100 Bronze, 150 Silver, 200 Gold, 300 Diamond)."""
    from app.services.loyalty_service import LoyaltyService
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user or not user.passenger_profile:
        raise HTTPException(status_code=404, detail="Passenger user not found.")

    user.passenger_profile.total_trips = max(0, request.total_trips)
    tier_info = LoyaltyService.calculate_tier_info(user.passenger_profile.total_trips)
    user.passenger_profile.loyalty_tier = tier_info["tier_code"]
    if request.total_trips >= 300:
        user.passenger_profile.is_diamond_member = True

    db.commit()
    return {
        "success": True,
        "user_id": user.id,
        "full_name": user.full_name,
        "total_trips": user.passenger_profile.total_trips,
        "tier": tier_info["tier_name"],
        "badge": tier_info["badge_title"],
        "discount_percent": tier_info["discount_percent"],
        "message": f"Successfully updated {user.full_name}'s completed trips to {request.total_trips} ({tier_info['tier_name']})."
    }





