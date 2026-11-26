from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_user, get_optional_current_user
from app.services.loyalty_service import LoyaltyService

router = APIRouter(prefix="/loyalty", tags=["User Loyalty & Discount System"])


@router.get("/my-tier")
def get_my_loyalty_tier(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns current passenger's loyalty status, tier level (New User, Bronze, Silver, Gold, Diamond),
    badge icon, auto-discount percentage, free ride vouchers, and progress to next level.
    """
    return LoyaltyService.get_passenger_loyalty_summary(db, current_user.id)


@router.get("/tier-rules")
def get_public_tier_rules(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Public rules and benefits breakdown for all IndiRide loyalty tiers.
    """
    new_user_cfg = LoyaltyService.get_or_create_new_user_config(db)
    return {
        "new_user_welcome": {
            "discount_percent": new_user_cfg.discount_percent,
            "max_discount": new_user_cfg.max_discount_amount,
            "is_active": new_user_cfg.is_active,
            "description": new_user_cfg.description,
            "eligibility": "1st ride for all newly registered passengers"
        },
        "tiers": [
            {
                "tier_code": "NEW_USER",
                "name": "New User Special",
                "rides_required": 0,
                "discount": f"{int(new_user_cfg.discount_percent)}% OFF 1st Ride",
                "badge": "🎉 New User",
                "perks": "Auto-applied 90% discount on first ride"
            },
            {
                "tier_code": "MEMBER",
                "name": "Regular Member",
                "rides_required": "1 - 99 rides",
                "discount": "Standard Rates",
                "badge": "👤 Member",
                "perks": "Fastest neighborhood matching & zero surge on campus rides"
            },
            {
                "tier_code": "BRONZE",
                "name": "Bronze Member",
                "rides_required": "100 rides",
                "discount": "10% OFF Every Ride",
                "badge": "🥉 Bronze",
                "rewards": "1 Free Ride Voucher included",
                "perks": "Flat 10% discount auto-applied on all future rides"
            },
            {
                "tier_code": "SILVER",
                "name": "Silver Member",
                "rides_required": "150 rides",
                "discount": "15% OFF Every Ride",
                "badge": "🥈 Silver",
                "rewards": "1 Free Ride Voucher included",
                "perks": "Flat 15% discount (replaces 10%, not stacked)"
            },
            {
                "tier_code": "GOLD",
                "name": "Golden Member",
                "rides_required": "200 rides",
                "discount": "20% OFF Every Ride",
                "badge": "🥇 Golden",
                "rewards": "2 Free Ride Vouchers included",
                "perks": "Flat 20% discount on every ride"
            },
            {
                "tier_code": "DIAMOND",
                "name": "Diamond VIP Member",
                "rides_required": "300 rides",
                "discount": "25% OFF Every Ride",
                "badge": "💎 Diamond VIP",
                "rewards": "Permanent Member of IndiRide + Swag Kit & Exclusive Gifts",
                "perks": "Permanent prestige status, VIP Swags, surprise prizes, and priority support"
            }
        ]
    }
