from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.fare import FareConfiguration
from app.models.vehicle import VehicleCategory
from app.models.user import User, UserRole
from app.models.admin import PromoCode
from app.schemas.fare import (
    FareEstimateRequest,
    FareEstimateResponse,
    FareConfigUpdateRequest
)
from app.services.fare_service import FareService
from app.api.deps import get_current_user, require_roles, get_optional_current_user

from app.models.festival import FestivalCampaign

router = APIRouter(prefix="/fare", tags=["Fare Calculation & Rates"])


@router.get("/festival")
def get_public_festival(db: Session = Depends(get_db)):
    """Returns active festival campaign details for passenger app banner if within valid date window."""
    camp = db.query(FestivalCampaign).filter(FestivalCampaign.id == "active").first()
    if not camp or not camp.is_active:
        return {
            "is_active": False,
            "campaign": None,
            "message": "No active festival offer at this time."
        }

    now = datetime.now(timezone.utc)

    # Check end date: Auto-expire if date has passed
    if camp.end_date:
        end_dt = camp.end_date if camp.end_date.tzinfo else camp.end_date.replace(tzinfo=timezone.utc)
        if now > end_dt:
            camp.is_active = False
            db.commit()
            return {
                "is_active": False,
                "campaign": None,
                "expired": True,
                "message": "Festival offer has ended and expired."
            }

    # Check start date: Scheduled for future
    if camp.start_date:
        start_dt = camp.start_date if camp.start_date.tzinfo else camp.start_date.replace(tzinfo=timezone.utc)
        if now < start_dt:
            return {
                "is_active": False,
                "campaign": None,
                "scheduled": True,
                "message": "Festival offer is scheduled for a future date."
            }

    return {
        "is_active": True,
        "festival_name": camp.festival_name,
        "tagline": camp.tagline,
        "banner_title": camp.banner_title or camp.festival_name,
        "banner_subtitle": camp.banner_subtitle or camp.tagline,
        "promo_code": camp.promo_code,
        "discount_percent": camp.discount_percent,
        "start_date": camp.start_date.isoformat() if camp.start_date else None,
        "end_date": camp.end_date.isoformat() if camp.end_date else None,
        "theme_color": camp.theme_color or "#d97706"
    }


@router.post("/estimate", response_model=FareEstimateResponse)
async def estimate_fares(
    request: FareEstimateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Computes road distance and returns transparent fare estimates for:
    - Bike: ₹7/km base
    - Car: ₹15/km base
    - Auto: ₹10/km base
    Includes complete fare breakdown and auto-discounts (New User 90%, Loyalty Tiers, or Free Vouchers).
    """
    resolved_passenger_id = current_user.id if current_user else request.passenger_id
    return await FareService.estimate_all_fares(
        db=db,
        pickup_lat=request.pickup_latitude,
        pickup_lng=request.pickup_longitude,
        dropoff_lat=request.dropoff_latitude,
        dropoff_lng=request.dropoff_longitude,
        promo_code=request.promo_code,
        ride_type=request.ride_type,
        use_free_voucher=bool(request.use_voucher),
        passenger_user_id=resolved_passenger_id
    )



@router.get("/configs")
def list_fare_configs(db: Session = Depends(get_db)):
    """Lists current fare rates across all vehicle categories."""
    configs = db.query(FareConfiguration).all()
    return configs


@router.put("/configs/{category}")
def update_fare_config(
    category: VehicleCategory,
    update_data: FareConfigUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Admin-only endpoint to configure per-km rates, base fare, minimum fare, and surge pricing.
    """
    config = db.query(FareConfiguration).filter(
        FareConfiguration.vehicle_category == category
    ).first()

    if not config:
        config = FareConfiguration(vehicle_category=category)
        db.add(config)

    for field, val in update_data.model_dump(exclude_unset=True).items():
        setattr(config, field, val)

    db.commit()
    db.refresh(config)
    return config


class PromoValidationRequest(BaseModel):
    code: str
    total_amount: float = 100.0


@router.post("/validate-promo")
def validate_promo_code(
    request: PromoValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Validates user entered promo/offer code against Admin created codes in DB.
    Returns calculated discount if valid, otherwise returns clear error.
    """
    code_clean = request.code.strip().upper()
    promo = db.query(PromoCode).filter(PromoCode.code == code_clean, PromoCode.is_active == True).first()

    if not promo:
        # Also check festival active campaign code
        camp = db.query(FestivalCampaign).filter(FestivalCampaign.id == "active", FestivalCampaign.is_active == True).first()
        if camp and camp.promo_code and camp.promo_code.strip().upper() == code_clean:
            now = datetime.now(timezone.utc)
            if camp.end_date:
                end_dt = camp.end_date if camp.end_date.tzinfo else camp.end_date.replace(tzinfo=timezone.utc)
                if now > end_dt:
                    camp.is_active = False
                    db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This festival offer has expired."
                    )
            if camp.start_date:
                start_dt = camp.start_date if camp.start_date.tzinfo else camp.start_date.replace(tzinfo=timezone.utc)
                if now < start_dt:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This festival offer has not started yet."
                    )
            disc_pct = camp.discount_percent
            disc_amt = round((request.total_amount * disc_pct) / 100.0, 2)
            return {
                "valid": True,
                "code": code_clean,
                "discount_percent": disc_pct,
                "discount_amount": disc_amt,
                "final_amount": max(20.0, round(request.total_amount - disc_amt, 2)),
                "message": f"Festival offer applied! {disc_pct}% off."
            }

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not valid / Invalid promo code '{code_clean}'"
        )

    if request.total_amount < promo.min_order_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{code_clean}' requires minimum ride amount of ₹{promo.min_order_amount}."
        )

    raw_discount = round((request.total_amount * promo.discount_percent) / 100.0, 2)
    capped_discount = min(promo.max_discount_amount, raw_discount)
    final_amount = max(20.0, round(request.total_amount - capped_discount, 2))

    return {
        "valid": True,
        "code": promo.code,
        "discount_percent": promo.discount_percent,
        "discount_amount": capped_discount,
        "final_amount": final_amount,
        "description": promo.description,
        "message": f"Code '{promo.code}' applied successfully! Saved ₹{capped_discount}."
    }
