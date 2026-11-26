import hmac
import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from app.config import settings


def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored bcrypt hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def generate_secure_otp(length: int = 6) -> str:
    """Generates a cryptographically strong unpredictable numeric OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))


def generate_pickup_otp() -> str:
    """Generates a 4-digit ride-start OTP."""
    return generate_secure_otp(4)


def hash_otp(otp: str, salt: Optional[str] = None) -> str:
    """
    Hashes an OTP using HMAC-SHA256 with application secret salt and optional ride binding.
    Guarantees OTPs are never stored in plaintext in the database.
    """
    secret = settings.JWT_SECRET.encode()
    data = f"{otp}:{salt or ''}".encode()
    return hmac.new(secret, data, hashlib.sha256).hexdigest()


def verify_otp_hash(plain_otp: str, stored_hash: str, salt: Optional[str] = None) -> bool:
    """Verifies plain OTP against stored HMAC hash using constant-time comparison."""
    if not plain_otp or not stored_hash or stored_hash == "INVALIDATED":
        return False
    computed_hash = hash_otp(plain_otp, salt)
    return hmac.compare_digest(computed_hash, stored_hash)


def encrypt_otp(plain_otp: str, key_context: str) -> str:
    """
    Symmetrically encrypts the 4-digit OTP using a keystream derived from secret + key_context (ride_id).
    Stored in database instead of plaintext; only backend can decrypt for authorized passenger.
    """
    key = hashlib.sha256(f"{settings.JWT_SECRET}:{key_context}".encode()).digest()
    data = plain_otp.encode("utf-8")
    encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return encrypted.hex()


def decrypt_otp(encrypted_hex: Optional[str], key_context: str) -> Optional[str]:
    """Decrypts the encrypted OTP for the authorized passenger."""
    if not encrypted_hex:
        return None
    try:
        key = hashlib.sha256(f"{settings.JWT_SECRET}:{key_context}".encode()).digest()
        encrypted = bytes.fromhex(encrypted_hex)
        decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted))
        return decrypted.decode("utf-8")
    except Exception:
        return None


def hash_token(token: str) -> str:
    """Computes SHA-256 hash of a token for secure O(1) revocation lookup without storing raw tokens."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed short-lived JWT access token with unique JTI and issued-at timestamp."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": int(now.timestamp()),
        "jti": secrets.token_hex(16),
        "type": "access"
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed long-lived JWT refresh token with unique JTI and issued-at timestamp."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({
        "exp": expire,
        "iat": int(now.timestamp()),
        "jti": secrets.token_hex(16),
        "type": "refresh"
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and cryptographically verifies a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def revoke_token(db, token: str, user_id: str, reason: str = "logout") -> bool:
    """Revokes a JWT token by storing its cryptographic hash in revoked_tokens."""
    from app.models.user import RevokedToken
    t_hash = hash_token(token)
    payload = decode_token(token) or {}
    exp_ts = payload.get("exp")
    if exp_ts:
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(tzinfo=None)
    else:
        expires_at = datetime.utcnow() + timedelta(days=1)

    existing = db.query(RevokedToken).filter(RevokedToken.token_hash == t_hash).first()
    if not existing:
        revoked = RevokedToken(
            token_hash=t_hash,
            user_id=user_id,
            reason=reason,
            revoked_at=datetime.utcnow(),
            expires_at=expires_at
        )
        db.add(revoked)
        db.commit()
    return True


def is_token_revoked(db, token: str, user_tokens_revoked_at: Optional[datetime] = None, token_iat: Optional[int] = None) -> bool:
    """
    Checks if a token has been revoked:
    1. Checks if issued prior to user.tokens_revoked_at (e.g. password reset / logout all devices)
    2. Checks if individual token hash exists in revoked_tokens table
    """
    if user_tokens_revoked_at and token_iat:
        iat_dt = datetime.fromtimestamp(token_iat, tz=timezone.utc).replace(tzinfo=None)
        revoked_dt = user_tokens_revoked_at.replace(tzinfo=None) if user_tokens_revoked_at.tzinfo else user_tokens_revoked_at
        if iat_dt < revoked_dt:
            return True

    from app.models.user import RevokedToken
    t_hash = hash_token(token)
    return db.query(RevokedToken).filter(RevokedToken.token_hash == t_hash).first() is not None
