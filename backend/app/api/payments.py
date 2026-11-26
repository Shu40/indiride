from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.payment import (
    CreatePaymentOrderRequest,
    VerifyPaymentSignatureRequest,
    ConfirmCashPaymentRequest,
    PaymentOrderResponse,
    PaymentVerificationResponse
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments & Transactions"])


@router.post("/create-order", response_model=PaymentOrderResponse, status_code=status.HTTP_200_OK)
async def create_payment_order(
    request: CreatePaymentOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a verified backend payment order for a ride booking:
    - Never trusts client-side price
    - Generates server-side payment order (Razorpay / UPI / Cash)
    - Enforces passenger authorization
    """
    order = PaymentService.create_order(
        db=db,
        ride_id=request.ride_id,
        user_id=current_user.id,
        method=request.method
    )
    return order


@router.post("/verify-signature", response_model=PaymentVerificationResponse, status_code=status.HTTP_200_OK)
async def verify_payment_signature(
    request: VerifyPaymentSignatureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographically verifies payment authenticity via HMAC-SHA256 signature:
    - Verifies razorpay_order_id | razorpay_payment_id with secret
    - Never trusts client-reported payment success
    - Marks payment as COMPLETED upon valid signature, or FAILED if tampered
    """
    result = await PaymentService.verify_signature(
        db=db,
        ride_id=request.ride_id,
        user_id=current_user.id,
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_signature=request.razorpay_signature
    )
    return result


@router.post("/confirm-cash", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def confirm_cash_payment(
    request: ConfirmCashPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks cash payment as collected upon trip completion."""
    return await PaymentService.confirm_cash_payment(
        db=db,
        ride_id=request.ride_id,
        user_id=current_user.id
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def handle_payment_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    db: Session = Depends(get_db)
):
    """
    Secure Webhook Receiver for Payment Provider:
    - Verifies webhook cryptographic authenticity using raw body bytes
    - Idempotently processes payment.captured and order.paid
    - Handles duplicate webhook deliveries without double-processing
    - Records failed transactions with detailed failure reasons
    """
    body_bytes = await request.body()
    return await PaymentService.process_webhook(
        db=db,
        raw_body=body_bytes,
        signature_header=x_razorpay_signature
    )
