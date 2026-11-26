import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.user import User, PassengerProfile
from app.models.admin import NewUserDiscountConfig

logger = logging.getLogger(__name__)


class LoyaltyService:
    @staticmethod
    def get_or_create_new_user_config(db: Session) -> NewUserDiscountConfig:
        """Retrieves or creates the admin configuration for 1st ride 90% discount."""
        config = db.query(NewUserDiscountConfig).filter(NewUserDiscountConfig.id == "default").first()
        if not config:
            config = NewUserDiscountConfig(
                id="default",
                discount_percent=90.0,
                max_discount_amount=150.0,
                is_active=True,
                description="Welcome to IndiRide! Flat 90% OFF on your 1st ride (auto-applied)."
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @classmethod
    def calculate_tier_info(cls, completed_rides: int, is_diamond_member: bool = False) -> Dict[str, Any]:
        """
        Calculates User Loyalty Tier strictly according to IndiRide rules:
        - 0 rides: New User (Eligible for 90% 1st Ride Welcome Discount)
        - 1 to 99 rides: Normal IndiRide Member (Standard rates)
        - 100 to 149 rides: Bronze Tier (10% discount on every ride + 1 free ride voucher)
        - 150 to 199 rides: Silver Tier (Strictly 15% discount, not 25% + 1 free ride voucher)
        - 200 to 299 rides: Golden Tier (Strictly 20% discount + 2 free ride vouchers)
        - 300+ rides: Diamond Tier (25% VIP discount + Permanent Member of IndiRide + Swags & Gifts)
        """
        if completed_rides == 0:
            return {
                "tier_code": "NEW_USER",
                "tier_name": "New User",
                "badge_title": "New User (90% OFF 1st Ride)",
                "badge_icon": "🎉",
                "badge_color": "#ec4899",
                "discount_percent": 90.0,
                "is_first_ride": True,
                "next_tier_name": "Bronze Member",
                "next_tier_target": 100,
                "rides_needed_for_next_tier": 100,
                "progress_percent": 0.0,
                "perks": [
                    "Flat 90% OFF auto-applied on your very 1st ride",
                    "Seamless doorstep pickup with verified drivers",
                    "Safety toolkit & 24x7 support"
                ],
                "is_permanent_member": False,
                "swags_eligible": False
            }

        if 1 <= completed_rides < 100:
            progress = round((completed_rides / 100.0) * 100, 1)
            return {
                "tier_code": "MEMBER",
                "tier_name": "IndiRide Member",
                "badge_title": "Active Member",
                "badge_icon": "👤",
                "badge_color": "#64748b",
                "discount_percent": 0.0,
                "is_first_ride": False,
                "next_tier_name": "Bronze Member",
                "next_tier_target": 100,
                "rides_needed_for_next_tier": 100 - completed_rides,
                "progress_percent": progress,
                "perks": [
                    f"Complete {100 - completed_rides} more rides to unlock Bronze (10% OFF + 1 Free Ride)!",
                    "Fastest matching in your neighborhood",
                    "Zero surge guarantee on campus rides"
                ],
                "is_permanent_member": False,
                "swags_eligible": False
            }

        if 100 <= completed_rides < 150:
            progress = round(((completed_rides - 100) / 50.0) * 100, 1)
            return {
                "tier_code": "BRONZE",
                "tier_name": "Bronze Member",
                "badge_title": "🥉 Bronze Member",
                "badge_icon": "🥉",
                "badge_color": "#b45309", # Bronze brown
                "discount_percent": 10.0,
                "is_first_ride": False,
                "next_tier_name": "Silver Member",
                "next_tier_target": 150,
                "rides_needed_for_next_tier": 150 - completed_rides,
                "progress_percent": progress,
                "perks": [
                    "Flat 10% discount auto-applied on every ride",
                    "1 Free Ride Voucher awarded upon reaching Bronze",
                    "Bronze badge proudly displayed on your profile"
                ],
                "is_permanent_member": False,
                "swags_eligible": False
            }

        if 150 <= completed_rides < 200:
            progress = round(((completed_rides - 150) / 50.0) * 100, 1)
            return {
                "tier_code": "SILVER",
                "tier_name": "Silver Member",
                "badge_title": "🥈 Silver Member",
                "badge_icon": "🥈",
                "badge_color": "#94a3b8", # Silver grey
                "discount_percent": 15.0, # Strictly 15%, not 25%!
                "is_first_ride": False,
                "next_tier_name": "Golden Member",
                "next_tier_target": 200,
                "rides_needed_for_next_tier": 200 - completed_rides,
                "progress_percent": progress,
                "perks": [
                    "Flat 15% discount auto-applied on every ride (Replaces Bronze 10%)",
                    "1 Free Ride Voucher awarded upon reaching Silver",
                    "Silver badge proudly displayed on your profile",
                    "Priority matching during peak hours"
                ],
                "is_permanent_member": False,
                "swags_eligible": False
            }

        if 200 <= completed_rides < 300:
            progress = round(((completed_rides - 200) / 100.0) * 100, 1)
            return {
                "tier_code": "GOLD",
                "tier_name": "Golden Member",
                "badge_title": "🥇 Golden Member",
                "badge_icon": "🥇",
                "badge_color": "#eab308", # Gold yellow
                "discount_percent": 20.0, # Strictly 20%
                "is_first_ride": False,
                "next_tier_name": "Diamond VIP Member",
                "next_tier_target": 300,
                "rides_needed_for_next_tier": 300 - completed_rides,
                "progress_percent": progress,
                "perks": [
                    "Flat 20% discount auto-applied on every ride",
                    "2 Free Ride Vouchers awarded upon reaching Gold",
                    "Golden badge proudly displayed on your profile",
                    "Dedicated customer support helpline"
                ],
                "is_permanent_member": False,
                "swags_eligible": False
            }

        # 300+ rides: Diamond Tier VIP
        return {
            "tier_code": "DIAMOND",
            "tier_name": "Diamond VIP Member",
            "badge_title": "💎 Diamond VIP: Permanent Member of IndiRide",
            "badge_icon": "💎",
            "badge_color": "#06b6d4", # Cyan / Diamond blue
            "discount_percent": 25.0,
            "is_first_ride": False,
            "next_tier_name": None,
            "next_tier_target": 300,
            "rides_needed_for_next_tier": 0,
            "progress_percent": 100.0,
            "perks": [
                "Flat 25% discount auto-applied on every ride permanently",
                "Permanent Member of IndiRide prestige status",
                "Exclusive IndiRide Swags, Gift Box & Merchandise",
                "Special surprise prizes & reward vouchers by IndiRide",
                "24x7 Priority VIP Support with zero wait time"
            ],
            "is_permanent_member": True,
            "swags_eligible": True
        }

    @classmethod
    def get_passenger_loyalty_summary(cls, db: Session, passenger_user_id: str) -> Dict[str, Any]:
        """Returns comprehensive loyalty information for a passenger."""
        user = db.query(User).filter(User.id == passenger_user_id).first()
        if not user:
            return cls.calculate_tier_info(0)

        profile = user.passenger_profile
        if not profile:
            completed_rides = 0
            vouchers = 0
            total_saved = 0.0
            is_diamond = False
        else:
            completed_rides = profile.total_trips or 0
            vouchers = profile.free_rides_vouchers or 0
            total_saved = round(profile.total_discount_saved or 0.0, 2)
            is_diamond = profile.is_diamond_member or (completed_rides >= 300)

        tier_info = cls.calculate_tier_info(completed_rides, is_diamond)

        # Check admin new user discount config
        new_user_cfg = cls.get_or_create_new_user_config(db)
        if completed_rides == 0:
            if new_user_cfg.is_active:
                tier_info["discount_percent"] = new_user_cfg.discount_percent
                tier_info["max_discount_amount"] = new_user_cfg.max_discount_amount
            else:
                tier_info["discount_percent"] = 0.0

        return {
            "user_id": passenger_user_id,
            "full_name": user.full_name,
            "completed_rides": completed_rides,
            "free_rides_vouchers": vouchers,
            "total_discount_saved": total_saved,
            "new_user_discount_active": new_user_cfg.is_active,
            "new_user_discount_percent": new_user_cfg.discount_percent,
            **tier_info
        }

    @classmethod
    def apply_ride_completion_rewards(
        cls,
        db: Session,
        passenger_id: str,
        discount_saved: float = 0.0
    ) -> Dict[str, Any]:
        """
        Called when a ride is completed:
        1. Increments passenger total_trips
        2. Checks milestone thresholds (100, 150, 200, 300)
        3. Awards Free Ride Vouchers:
           - 100 rides -> +1 voucher
           - 150 rides -> +1 voucher
           - 200 rides -> +2 vouchers
           - 300 rides -> Permanent Diamond VIP + Swags
        4. Updates profile record
        """
        user = db.query(User).filter(User.id == passenger_id).first()
        if not user or not user.passenger_profile:
            return {}

        profile = user.passenger_profile
        old_trips = profile.total_trips or 0
        new_trips = old_trips + 1

        profile.total_trips = new_trips
        profile.total_discount_saved = round((profile.total_discount_saved or 0.0) + discount_saved, 2)

        vouchers_awarded = 0
        new_badge_unlocked = None

        # Milestone 1: Reached 100 rides -> Bronze Tier (+1 Free Ride Voucher)
        if old_trips < 100 and new_trips >= 100:
            vouchers_awarded += 1
            new_badge_unlocked = "Bronze Member (10% OFF Every Ride + 1 Free Ride Voucher!)"

        # Milestone 2: Reached 150 rides -> Silver Tier (+1 Free Ride Voucher)
        if old_trips < 150 and new_trips >= 150:
            vouchers_awarded += 1
            new_badge_unlocked = "Silver Member (15% OFF Every Ride + 1 Free Ride Voucher!)"

        # Milestone 3: Reached 200 rides -> Golden Tier (+2 Free Ride Vouchers)
        if old_trips < 200 and new_trips >= 200:
            vouchers_awarded += 2
            new_badge_unlocked = "Golden Member (20% OFF Every Ride + 2 Free Ride Vouchers!)"

        # Milestone 4: Reached 300 rides -> Diamond VIP (+ Permanent Member of IndiRide + Swags)
        if old_trips < 300 and new_trips >= 300:
            profile.is_diamond_member = True
            new_badge_unlocked = "Diamond VIP (Permanent Member of IndiRide + Swags & Gifts!)"

        if vouchers_awarded > 0:
            profile.free_rides_vouchers = (profile.free_rides_vouchers or 0) + vouchers_awarded

        tier_info = cls.calculate_tier_info(new_trips, profile.is_diamond_member)
        profile.loyalty_tier = tier_info["tier_code"]

        db.commit()
        db.refresh(profile)

        return {
            "previous_trips": old_trips,
            "new_trips": new_trips,
            "vouchers_awarded": vouchers_awarded,
            "current_voucher_balance": profile.free_rides_vouchers,
            "new_badge_unlocked": new_badge_unlocked,
            "tier_code": tier_info["tier_code"],
            "tier_name": tier_info["tier_name"],
            "discount_percent": tier_info["discount_percent"]
        }
