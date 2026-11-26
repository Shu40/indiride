from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime
from app.database import Base

class FestivalCampaign(Base):
    __tablename__ = "festival_campaigns"

    id = Column(String(36), primary_key=True, default="active")
    festival_name = Column(String(100), nullable=False, default="Festival Dhamaka")
    tagline = Column(String(255), nullable=False, default="Special festive discount on all rides!")
    banner_title = Column(String(150), nullable=True)
    banner_subtitle = Column(String(255), nullable=True)
    promo_code = Column(String(30), nullable=False, default="OFFER20")
    discount_percent = Column(Float, nullable=False, default=20.0)
    start_date = Column(DateTime, nullable=True) # Campaign start date
    end_date = Column(DateTime, nullable=True) # Campaign end date (auto-expires after this date)
    is_active = Column(Boolean, default=True)
    theme_color = Column(String(30), default="#d97706")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

