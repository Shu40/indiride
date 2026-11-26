from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.models.payment import PaymentMethod, PaymentStatus


class CreatePaymentOrderRequest(BaseModel):
    ride_id: str = Field(..., description="Active or completed ride ID")
    method: PaymentMethod = Field(default=PaymentMethod.RAZORPAY, description="Payment method")

    @field_validator("method", mode="before")
    @classmethod
    def parse_method(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            try:
                return PaymentMethod[v_upper]
            except KeyError:
                return PaymentMethod.CASH
        return v


class VerifyPaymentSignatureRequest(BaseModel):
    ride_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ConfirmCashPaymentRequest(BaseModel):
    ride_id: str


class PaymentOrderResponse(BaseModel):
    order_id: Optional[str] = None
    amount: float
    currency: str
    key_id: Optional[str] = None
    method: str
    status: str
    ride_id: str
    message: Optional[str] = None
    created_at: Optional[str] = None


class PaymentVerificationResponse(BaseModel):
    status: str
    message: str
    payment_id: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
