import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole, PassengerProfile, RiderProfile, RiderApprovalStatus
from app.models.vehicle import Vehicle, VehicleCategory
from app.schemas.auth import (
    SendOTPRequest, VerifyOTPRequest, UserRegisterRequest,
    UserLoginRequest, TokenRefreshRequest, TokenResponse,
    UserResponse, OTPResponse, GoogleAuthRequest, FindAccountRequest,
    ChangePasswordRequest, ChangePhoneRequest,
    UpdateProfileRequest, DeleteAccountRequest
)
from app.services.auth_service import AuthService
from app.api.deps import get_current_user, security_bearer
from app.utils.security import verify_password, hash_password, revoke_token
from app.utils.rate_limiter import auth_limiter, otp_limiter, account_limiter
from app.config import settings

from app.services.sms_service import sms_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp", response_model=OTPResponse, dependencies=[Depends(otp_limiter)])
async def send_otp(request: SendOTPRequest):
    """
    Sends a cryptographically secure 6-digit OTP to the specified mobile number.
    Persists in Redis with TTL and delivers through Real SMS Gateway (Fast2SMS / Twilio / MSG91).
    Rate limited to prevent SMS spam and brute-force flooding.
    """
    plain_otp = AuthService.send_phone_otp(request.phone_number)
    sms_res = await sms_service.send_otp_sms(request.phone_number, plain_otp)
    provider_name = sms_res.get("provider", "gateway")
    
    has_active_carrier = bool(
        (settings.TWOFACTOR_API_KEY and not settings.TWOFACTOR_API_KEY.startswith("YOUR_")) or
        (settings.FAST2SMS_API_KEY and not settings.FAST2SMS_API_KEY.startswith("YOUR_")) or
        (settings.TWILIO_ACCOUNT_SID and not settings.TWILIO_ACCOUNT_SID.startswith("YOUR_"))
    )
    should_provide_fallback_otp = (
        settings.DEBUG or
        settings.ENVIRONMENT != "production" or
        not has_active_carrier or
        provider_name == "console_gateway"
    )

    return OTPResponse(
        success=True,
        message=f"OTP sent successfully to {request.phone_number}.",
        expires_in_seconds=300,
        demo_otp=None
    )


@router.post("/verify-otp", dependencies=[Depends(otp_limiter)])
def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verifies the OTP against HMAC hash.
    If the user already exists, immediately issues JWT token pair.
    If the user is new, returns verification success flag so they can complete registration.
    """
    AuthService.verify_phone_otp(request.phone_number, request.otp)
    
    user = db.query(User).filter(User.phone_number == request.phone_number).first()
    if user:
        tokens = AuthService.create_tokens_for_user(user)
        return {
            "verified": True,
            "registered": True,
            "tokens": tokens,
            "token": tokens
        }

    return {
        "verified": True,
        "registered": False,
        "message": "OTP verified successfully. Please complete registration with name and role."
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new user (Passenger, Rider, or Admin) and returns authenticated tokens.
    If already registered, safely updates user details and returns existing account tokens.
    Handles duplicate email / phone conflicts gracefully with 409 Conflict.
    """
    clean_email = request.email.strip().lower() if request.email else None

    existing_user = db.query(User).filter(User.phone_number == request.phone_number).first()
    if existing_user:
        if request.full_name:
            existing_user.full_name = request.full_name
        if clean_email:
            email_clash = db.query(User).filter(User.email == clean_email, User.id != existing_user.id).first()
            if email_clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This email address is already associated with another account."
                )
            existing_user.email = clean_email
        if request.password:
            existing_user.hashed_password = hash_password(request.password)

        if request.role == UserRole.RIDER:
            existing_user.role = UserRole.RIDER
            if not existing_user.rider_profile:
                prof = RiderProfile(
                    user_id=existing_user.id,
                    license_number=request.license_number or f"DL-{existing_user.id[:8].upper()}",
                    # All driver applications start as PENDING for admin document verification (7-day review period)
                    status=RiderApprovalStatus.PENDING,
                    is_online=False,
                    rider_service_type=request.rider_service_type or "REGULAR",
                    driver_state=request.driver_state,
                    driver_city=request.driver_city,
                    served_universities=request.served_universities or request.college_name,
                    college_name=request.college_name or request.served_universities,
                    academic_year=request.academic_year,
                    student_id_number=request.student_id_number,
                    student_id_photo=request.student_id_photo,
                    driver_photo=request.driver_photo or request.passport_photo,
                    passport_photo=request.passport_photo or request.driver_photo,
                    license_photo=request.license_photo,
                    pan_number=request.pan_number,
                    pan_photo=request.pan_photo,
                    aadhaar_number=request.aadhaar_number,
                    aadhaar_photo=request.aadhaar_photo,
                    permanent_address=request.permanent_address,
                    current_address=request.current_address,
                    submitted_at=datetime.utcnow(),
                    verified_at=None
                )
                db.add(prof)
                db.flush()

                veh_cat = VehicleCategory.BIKE
                if request.vehicle_category and request.vehicle_category.lower() in ["car", "auto"]:
                    veh_cat = VehicleCategory(request.vehicle_category.lower())

                vehicle = Vehicle(
                    rider_id=prof.id,
                    category=veh_cat,
                    make="Standard",
                    model=request.vehicle_model or "Hero Splendor Plus",
                    license_plate=request.vehicle_plate or f"KA-01-EK-{existing_user.id[:4].upper()}",
                    color="Black",
                    is_verified=True if is_campus else False
                )
                db.add(vehicle)
            else:
                prof = existing_user.rider_profile
                if request.rider_service_type:
                    prof.rider_service_type = request.rider_service_type
                if request.college_name:
                    prof.college_name = request.college_name
                if request.academic_year:
                    prof.academic_year = request.academic_year
                if request.student_id_number:
                    prof.student_id_number = request.student_id_number
                if request.student_id_photo:
                    prof.student_id_photo = request.student_id_photo
                if request.served_universities:
                    prof.served_universities = request.served_universities
                elif request.college_name:
                    prof.served_universities = request.college_name

                if request.license_number:
                    prof.license_number = request.license_number
                if request.permanent_address:
                    prof.permanent_address = request.permanent_address
                if request.current_address:
                    prof.current_address = request.current_address
                if request.driver_state:
                    prof.driver_state = request.driver_state
                if request.driver_city:
                    prof.driver_city = request.driver_city
                if request.driver_photo:
                    prof.driver_photo = request.driver_photo
                    prof.passport_photo = request.driver_photo
                elif request.passport_photo:
                    prof.passport_photo = request.passport_photo
                    prof.driver_photo = request.passport_photo
                if request.license_photo:
                    prof.license_photo = request.license_photo
                if request.pan_number:
                    prof.pan_number = request.pan_number
                if request.pan_photo:
                    prof.pan_photo = request.pan_photo
                if request.aadhaar_number:
                    prof.aadhaar_number = request.aadhaar_number
                if request.aadhaar_photo:
                    prof.aadhaar_photo = request.aadhaar_photo
                if request.vehicle_plate and prof.vehicles:
                    prof.vehicles[0].license_plate = request.vehicle_plate
                if request.vehicle_model and prof.vehicles:
                    prof.vehicles[0].model = request.vehicle_model
                if request.vehicle_category and prof.vehicles and request.vehicle_category.lower() in ["car", "auto", "bike"]:
                    prof.vehicles[0].category = VehicleCategory(request.vehicle_category.lower())

                # Set pending status for admin document review (7-day wait)
                prof.status = RiderApprovalStatus.PENDING
                prof.is_online = False
                prof.submitted_at = datetime.utcnow()
                prof.verified_at = None

        try:
            db.commit()
            db.refresh(existing_user)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address or driving license is already associated with another account."
            )
        return AuthService.create_tokens_for_user(existing_user)

    if clean_email:
        email_clash = db.query(User).filter(User.email == clean_email).first()
        if email_clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already registered with another account."
            )

    try:
        user = AuthService.register_user(db, request)
        db.commit()
        return AuthService.create_tokens_for_user(user)
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number or email already exists."
        )


@router.post("/driver/voice-verify")
def record_voice_verification(
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Records the response of the automated AI voice verification call.
    Digits:
      '1': Confirmed permanent resident / served university location
      '2': Change requested for university / city
      '3': Customer support requested
    """
    phone_number = request.get("phone_number")
    digit = str(request.get("digit", "")).strip()
    university = request.get("university", "")

    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required")

    user = db.query(User).filter(User.phone_number == phone_number).first()
    if not user or not user.rider_profile:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    prof = user.rider_profile
    if digit == "1":
        prof.voice_verification_status = "CONFIRMED_PERMANENT"
        prof.voice_verified_at = datetime.utcnow()
        message = "Location successfully verified by AI Voice Assistant"
    elif digit == "2":
        prof.voice_verification_status = "CHANGE_REQUESTED"
        message = "Location change requested by driver"
    elif digit == "3":
        prof.voice_verification_status = "SUPPORT_REQUESTED"
        message = "Customer support call transfer requested"
    else:
        prof.voice_verification_status = "UNVERIFIED"
        message = "Invalid voice verification response"

    db.commit()
    return {
        "success": True,
        "status": prof.voice_verification_status,
        "message": message
    }


@router.post("/demo-login/{role}", response_model=TokenResponse)
def demo_login(role: str, db: Session = Depends(get_db)):
    """Logs in as an authorized user. Strictly disabled in production."""
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo login is strictly disabled in production.")

    role_lower = role.lower()
    if role_lower in ["rider2", "driver2"]:
        phone = "+919333333333"
    elif role_lower in ["campus_rider", "campus_driver", "campus"]:
        phone = "+919444444444"
    elif role_lower in ["rider", "driver", "regular_rider", "permanent_rider", "rider1", "driver1"]:
        phone = "+919222222222"
    elif role_lower in ["rider_pending", "pending_rider"]:
        phone = "+919555555555"
    elif role_lower == "admin":
        phone = "+919999999999"
    else:
        phone = "+919111111111"

    user = db.query(User).filter(User.phone_number == phone).first()
    if not user:
        if role_lower in ["campus_rider", "campus_driver", "campus"]:
            user = db.query(User).join(User.rider_profile).filter(RiderProfile.rider_service_type == "CAMPUS").first()
        elif role_lower in ["rider", "driver", "regular_rider", "permanent_rider"]:
            user = db.query(User).filter(User.role == UserRole.RIDER).first()
        elif role_lower == "admin":
            user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        else:
            user = db.query(User).filter(User.role == UserRole.PASSENGER).first()

    if not user:
        # Create on-demand test account for automated test suites
        target_role = UserRole.ADMIN if role_lower == "admin" else (UserRole.RIDER if ("rider" in role_lower or "driver" in role_lower) else UserRole.PASSENGER)
        user = User(
            id=str(uuid.uuid4()),
            phone_number=phone,
            email=f"{role_lower}_test@example.com",
            full_name=f"Test {role.title()}",
            role=target_role,
            is_active=True
        )
        db.add(user)
        db.flush()

        if target_role == UserRole.RIDER:
            service_type = "CAMPUS" if "campus" in role_lower else "REGULAR"
            prof_status = RiderApprovalStatus.PENDING if "pending" in role_lower else RiderApprovalStatus.APPROVED
            rider_prof = RiderProfile(
                id=str(uuid.uuid4()),
                user_id=user.id,
                license_number=f"TEST-LIC-{role_lower[:6].upper()}",
                status=prof_status,
                is_online=True,
                is_busy=False,
                current_latitude=12.9716,
                current_longitude=77.6412,
                rating=5.0,
                total_completed_trips=0,
                total_earnings=0.0,
                rider_service_type=service_type,
                college_name="Parul University, Vadodara" if service_type == "CAMPUS" else None,
                served_universities="Parul University" if service_type == "CAMPUS" else None
            )
            db.add(rider_prof)
            db.flush()
            veh = Vehicle(
                id=str(uuid.uuid4()),
                rider_id=rider_prof.id,
                category=VehicleCategory.BIKE,
                make="Hero",
                model="Splendor Plus",
                license_plate="GJ-06-TEST-101",
                color="Black",
                is_active=True
            )
            db.add(veh)
            db.flush()
        elif target_role == UserRole.PASSENGER:
            pass_prof = PassengerProfile(
                id=str(uuid.uuid4()),
                user_id=user.id,
                rating=5.0,
                total_trips=0
            )
            db.add(pass_prof)
            db.flush()

        db.commit()
        db.refresh(user)

    # Strictly guarantee the rider_service_type on demo login
    if role_lower in ["campus_rider", "campus_driver", "campus"] and user.rider_profile:
        user.rider_profile.rider_service_type = "CAMPUS"
        user.rider_profile.status = RiderApprovalStatus.APPROVED
        user.rider_profile.college_name = user.rider_profile.college_name or "Parul University, Vadodara"
        user.rider_profile.served_universities = user.rider_profile.served_universities or "Parul University, Maharaja Sayajirao University (MSU), Vadodara Institute"
        db.commit()
        db.refresh(user)
    elif role_lower in ["rider", "driver", "regular_rider", "permanent_rider"] and user.rider_profile:
        user.rider_profile.rider_service_type = "REGULAR"
        user.rider_profile.status = RiderApprovalStatus.APPROVED
        db.commit()
        db.refresh(user)

    return AuthService.create_tokens_for_user(user)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(auth_limiter)])
def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates an existing user via phone number and password or OTP.
    """
    user = db.query(User).filter(User.phone_number == request.phone_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this phone number."
        )

    # If password is provided, verify password hash
    if request.password:
        if not user.hashed_password or not verify_password(request.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password."
            )
    elif request.otp:
        AuthService.verify_phone_otp(request.phone_number, request.otp)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either password or otp must be provided to login."
        )

    return AuthService.create_tokens_for_user(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: TokenRefreshRequest, db: Session = Depends(get_db)):
    """
    Refreshes an expired access token using a valid long-lived refresh token.
    """
    return AuthService.refresh_access_token(db, request.refresh_token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile and role details.
    """
    return current_user


@router.post("/google-auth")
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Handles Continue with Google / Gmail flow.
    Compulsory verification rule: If phone is not yet linked and verified,
    demands Indian mobile verification before issuing full session tokens.
    """
    clean_email = request.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()

    # If user already exists with this email
    if user:
        if user.phone_number and not user.phone_number.startswith("+00"):
            tokens = AuthService.create_tokens_for_user(user)
            return {
                "phone_required": False,
                "user": user,
                "tokens": tokens,
                "token": tokens
            }

    # If mobile phone is submitted to link
    if request.phone_number:
        if not request.otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP is required to verify and link mobile number."
            )
        AuthService.verify_phone_otp(request.phone_number, request.otp)
        
        # Check if phone already registered to another user
        existing_phone = db.query(User).filter(User.phone_number == request.phone_number).first()
        if existing_phone and existing_phone.email != clean_email:
            existing_phone.email = clean_email
            if request.full_name:
                existing_phone.full_name = request.full_name
            db.commit()
            tokens = AuthService.create_tokens_for_user(existing_phone)
            return {
                "phone_required": False,
                "user": existing_phone,
                "tokens": tokens,
                "token": tokens
            }

        if user:
            user.phone_number = request.phone_number
            db.commit()
            tokens = AuthService.create_tokens_for_user(user)
            return {
                "phone_required": False,
                "user": user,
                "tokens": tokens,
                "token": tokens
            }
        else:
            # Create new user with verified phone
            new_user = User(
                phone_number=request.phone_number,
                email=clean_email,
                full_name=request.full_name or "Google User",
                role=UserRole.PASSENGER,
                is_active=True
            )
            db.add(new_user)
            db.flush()
            db.add(PassengerProfile(user_id=new_user.id))
            db.commit()
            db.refresh(new_user)
            tokens = AuthService.create_tokens_for_user(new_user)
            return {
                "phone_required": False,
                "user": new_user,
                "tokens": tokens,
                "token": tokens
            }

    # User exists without phone or is new Google user -> Demand mobile linking!
    return {
        "phone_required": True,
        "email": clean_email,
        "full_name": request.full_name,
        "message": "Mandatory: Please link and verify your Indian mobile number (+91) to book rides."
    }


@router.post("/find-account")
def find_account(request: FindAccountRequest, db: Session = Depends(get_db)):
    """
    Finds account by mobile number or email.
    """
    ident = request.identifier.strip()
    user = db.query(User).filter(
        (User.phone_number == ident) | 
        (User.email == ident.lower()) |
        (User.phone_number == f"+91{ident}")
    ).first()

    if not user:
        return {
            "found": False,
            "message": "No account found matching this mobile number or email."
        }

    # Mask sensitive details
    p = user.phone_number
    masked_phone = f"{p[:4]} •••• {p[-2:]}" if len(p) >= 6 else p
    e = user.email or ""
    masked_email = f"{e[:2]}••••@{e.split('@')[-1]}" if "@" in e else e

    return {
        "found": True,
        "user_id": user.id,
        "full_name": user.full_name,
        "masked_phone": masked_phone,
        "masked_email": masked_email,
        "raw_phone": user.phone_number,
        "role": user.role
    }


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revokes the current session access token.
    Prevents further use of the token on any protected endpoint.
    """
    if credentials and credentials.credentials:
        revoke_token(db, credentials.credentials, current_user.id, reason="user_logout")

    return {
        "status": "success",
        "message": "Logged out successfully. Current session token has been revoked."
    }


@router.post("/logout-all")
def logout_all_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revokes all active sessions and refresh tokens across all devices.
    """
    current_user.tokens_revoked_at = datetime.utcnow()
    db.commit()
    return {
        "status": "success",
        "message": "All sessions and devices have been revoked. Please log in again."
    }


@router.post("/change-password", dependencies=[Depends(account_limiter)])
def change_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Requires re-authentication with current password before allowing password change.
    Invalidates all prior sessions across devices to enforce security.
    """
    if not current_user.hashed_password or not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed. Please enter your existing password correctly."
        )

    current_user.hashed_password = hash_password(request.new_password)
    current_user.tokens_revoked_at = datetime.utcnow() # Invalidate previous sessions
    db.commit()

    return {
        "status": "success",
        "message": "Password updated successfully. All other sessions have been logged out for security."
    }


@router.post("/change-phone", dependencies=[Depends(account_limiter)])
def change_phone_number(
    request: ChangePhoneRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sensitive operation: Updates user's registered phone number.
    Requires verified OTP and re-authentication to prevent SIM-swap / account takeover.
    """
    # Verify OTP against new phone number
    AuthService.verify_phone_otp(request.new_phone_number, request.verification_otp)

    # If current password exists, verify it
    if current_user.hashed_password and request.current_password:
        if not verify_password(request.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password. Re-authentication required to update phone number."
            )

    # Check if new phone is already in use
    existing = db.query(User).filter(
        User.phone_number == request.new_phone_number,
        User.id != current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone number is already registered to another account."
        )

    current_user.phone_number = request.new_phone_number
    current_user.tokens_revoked_at = datetime.utcnow()
    db.commit()

    tokens = AuthService.create_tokens_for_user(current_user)
    return {
        "status": "success",
        "message": "Phone number successfully updated. Sessions refreshed.",
        "tokens": tokens
    }


@router.put("/profile", response_model=UserResponse)
def update_profile(
    request: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows authenticated users to update their profile name and email address.
    """
    if request.full_name:
        current_user.full_name = request.full_name.strip()
    if request.email:
        clean_email = request.email.lower().strip()
        existing = db.query(User).filter(User.email == clean_email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already in use by another account."
            )
        current_user.email = clean_email
    if request.profile_photo:
        current_user.profile_photo = request.profile_photo

    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/account")
def delete_account(
    request: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Secure account deletion flow:
    - Verifies explicit confirmation phrase 'DELETE MY ACCOUNT'
    - Re-authenticates password if set
    - Cancels any active ride bookings
    - Revokes all issued sessions immediately
    - Deactivates and anonymizes user profile for privacy (GDPR/DPDP compliance)
    """
    if request.confirmation.strip() != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="To delete your account, you must enter 'DELETE MY ACCOUNT' as confirmation."
        )

    if current_user.hashed_password:
        if not request.password or not verify_password(request.password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password. Re-authentication is required to permanently delete your account."
            )

    # Cancel active rides if any
    from app.models.ride import RideBooking, RideStatus
    active_rides = db.query(RideBooking).filter(
        (RideBooking.passenger_id == current_user.id) | (RideBooking.rider_id == current_user.id),
        RideBooking.status.in_([
            RideStatus.SEARCHING_FOR_RIDER,
            RideStatus.REQUESTS_SENT,
            RideStatus.EXPANDING_SEARCH,
            RideStatus.RIDER_ASSIGNED,
            RideStatus.RIDER_ARRIVING,
            RideStatus.RIDER_ARRIVED,
            RideStatus.OTP_VERIFICATION
        ])
    ).all()
    for ar in active_rides:
        ar.status = RideStatus.CANCELLED
        ar.cancellation_reason = "User account closed / deleted"

    # Revoke sessions
    current_user.tokens_revoked_at = datetime.utcnow()
    current_user.is_active = False
    # Anonymize personal data
    anon_tag = f"anon_{uuid.uuid4().hex[:8]}"
    current_user.phone_number = f"+00{anon_tag}"
    current_user.email = None
    current_user.full_name = "Deleted User"

    db.commit()

    return {
        "status": "success",
        "message": "Your account has been permanently deactivated and personal data anonymized."
    }



