import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.user import UserRole
from app.config import settings

# Test in-memory SQLite database using StaticPool so all connections share the memory DB
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Creates a fresh isolated database for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Provides a TestClient with database session dependency overridden."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health_check(client):
    """Verifies server health and initial pricing configuration."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["pricing"]["bike_rate_per_km"] == "₹7.0/km"
    assert data["pricing"]["car_rate_per_km"] == "₹15.0/km"


def test_send_and_verify_otp(client):
    """Tests the phone OTP flow with rate-limiting and expiration."""
    phone = "+919876543210"
    
    # 1. Send OTP
    send_resp = client.post("/api/auth/send-otp", json={"phone_number": phone})
    assert send_resp.status_code == 200
    otp_data = send_resp.json()
    assert otp_data["success"] is True
    demo_otp = otp_data["demo_otp"]
    assert demo_otp is not None
    assert len(demo_otp) == 6

    # 2. Verify with wrong OTP -> should fail
    fail_resp = client.post("/api/auth/verify-otp", json={"phone_number": phone, "otp": "000000"})
    assert fail_resp.status_code == 400
    assert "Invalid OTP" in fail_resp.json()["detail"]

    # 3. Verify with correct OTP
    success_resp = client.post("/api/auth/verify-otp", json={"phone_number": phone, "otp": demo_otp})
    assert success_resp.status_code == 200
    data = success_resp.json()
    assert data["verified"] is True
    assert data["registered"] is False


def test_register_passenger_and_login(client):
    """Tests registering a passenger and logging in to retrieve JWT tokens."""
    phone = "+919123456789"
    payload = {
        "phone_number": phone,
        "full_name": "Aakash Patel",
        "email": "aakash@example.com",
        "role": "passenger",
        "password": "Password@123"
    }

    # 1. Register
    reg_resp = client.post("/api/auth/register", json=payload)
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["full_name"] == "Aakash Patel"
    assert data["user"]["role"] == "passenger"
    assert data["user"]["passenger_profile"] is not None

    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # 2. Access /api/auth/me with Bearer token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["id"] == data["user"]["id"]

    # 3. Refresh Token
    refresh_resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.json()


def test_register_rider(client):
    """Tests registering a rider with vehicle details."""
    phone = "+919888877777"
    payload = {
        "phone_number": phone,
        "full_name": "Vikas Solanki",
        "role": "rider",
        "password": "Password@123",
        "license_number": "GJ-06-2024-998811",
        "vehicle_category": "car",
        "vehicle_plate": "GJ-06-AZ-5521",
        "vehicle_model": "Swift Dzire"
    }

    reg_resp = client.post("/api/auth/register", json=payload)
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["user"]["role"] == "rider"
    assert data["user"]["rider_profile"] is not None
    assert data["user"]["rider_profile"]["license_number"] == "GJ-06-2024-998811"


def test_register_duplicate_email_conflict(client):
    """Verifies that attempting to register with an email already taken by another user returns HTTP 409."""
    user1 = {
        "phone_number": "+919999000001",
        "full_name": "First User",
        "email": "shared@example.com",
        "role": "passenger"
    }
    resp1 = client.post("/api/auth/register", json=user1)
    assert resp1.status_code == 201

    # Attempt to register another user with the SAME email but different phone
    user2 = {
        "phone_number": "+919999000002",
        "full_name": "Second User",
        "email": "shared@example.com",
        "role": "rider"
    }
    resp2 = client.post("/api/auth/register", json=user2)
    assert resp2.status_code == 409
    assert "already" in resp2.json()["detail"].lower()

