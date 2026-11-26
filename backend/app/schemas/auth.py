from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from app.models.user import UserRole, RiderApprovalStatus


class SendOTPRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15, description="E.164 or 10-digit Indian mobile number")


class VerifyOTPRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=6, description="4 or 6 digit verification OTP")


class UserRegisterRequest(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15)
    full_name: str = Field(..., min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    role: UserRole = Field(default=UserRole.PASSENGER)
    password: Optional[str] = Field(None, min_length=6, description="Optional password for Admin or Rider direct login")
    
    # Rider KYC & Verification details
    license_number: Optional[str] = None
    vehicle_category: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_model: Optional[str] = None
    rider_service_type: Optional[str] = Field(default="REGULAR", description="REGULAR or CAMPUS")
    served_universities: Optional[str] = Field(default=None, description="Comma-separated universities driver serves")
    college_name: Optional[str] = None
    academic_year: Optional[str] = None
    student_id_number: Optional[str] = None
    student_id_photo: Optional[str] = None
    permanent_address: Optional[str] = None
    current_address: Optional[str] = None
    passport_photo: Optional[str] = None
    license_photo: Optional[str] = None
    aadhaar_number: Optional[str] = None
    aadhaar_photo: Optional[str] = None


class UserLoginRequest(BaseModel):
    phone_number: str
    password: Optional[str] = None
    otp: Optional[str] = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class PassengerProfileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rating: float
    total_trips: int


class RiderProfileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    license_number: str
    status: RiderApprovalStatus
    is_online: bool
    is_busy: bool
    rating: float
    total_completed_trips: int
    total_earnings: float
    rider_service_type: Optional[str] = "REGULAR"
    served_universities: Optional[str] = None
    college_name: Optional[str] = None
    academic_year: Optional[str] = None
    student_id_number: Optional[str] = None
    student_id_photo: Optional[str] = None
    permanent_address: Optional[str] = None
    current_address: Optional[str] = None
    passport_photo: Optional[str] = None
    license_photo: Optional[str] = None
    aadhaar_number: Optional[str] = None
    aadhaar_photo: Optional[str] = None
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phone_number: str
    full_name: str
    email: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime
    passenger_profile: Optional[PassengerProfileSchema] = None
    rider_profile: Optional[RiderProfileSchema] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserResponse


class OTPResponse(BaseModel):
    success: bool
    message: str
    expires_in_seconds: int = 300
    # In demo/testing mode, return OTP for easy verification without SMS gateway
    demo_otp: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    email: str
    full_name: str
    phone_number: Optional[str] = None
    otp: Optional[str] = None


class FindAccountRequest(BaseModel):
    identifier: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, description="Current password for verification")
    new_password: str = Field(..., min_length=6, description="New strong password")


class ChangePhoneRequest(BaseModel):
    new_phone_number: str = Field(..., min_length=10, max_length=15)
    verification_otp: str = Field(..., min_length=4, max_length=6, description="OTP verified on current or new phone")
    current_password: Optional[str] = Field(None, description="Current password for re-authentication")


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    profile_photo: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    confirmation: str = Field(..., description="Confirmation text 'DELETE MY ACCOUNT'")
    password: Optional[str] = Field(None, description="Password if account has password set")



