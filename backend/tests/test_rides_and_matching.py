import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.fare import FareConfiguration
from app.models.vehicle import Vehicle, VehicleCategory
from app.models.user import User, UserRole, RiderApprovalStatus, PassengerProfile, RiderProfile
from app.models.ride import RideStatus
from app.utils.security import hash_password, create_access_token

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()

    # Seed Fare Configurations
    session.add(FareConfiguration(
        vehicle_category=VehicleCategory.BIKE,
        base_fare=0.0,
        per_km_rate=7.0,
        min_fare=25.0,
        cancellation_fee=20.0,
        surge_multiplier=1.0,
        tax_percent=5.0,
        is_active=True
    ))
    session.add(FareConfiguration(
        vehicle_category=VehicleCategory.CAR,
        base_fare=0.0,
        per_km_rate=15.0,
        min_fare=60.0,
        cancellation_fee=50.0,
        surge_multiplier=1.0,
        tax_percent=5.0,
        is_active=True
    ))

    # Seed Admin
    admin = User(
        id="admin_1",
        phone_number="+919999999999",
        full_name="Platform Admin",
        role=UserRole.ADMIN,
        hashed_password=hash_password("Admin@123")
    )
    session.add(admin)

    # Seed Passenger
    passenger = User(
        id="passenger_1",
        phone_number="+919111111111",
        full_name="Rahul Verma",
        role=UserRole.PASSENGER
    )
    session.add(passenger)
    session.add(PassengerProfile(user_id=passenger.id))

    # Seed Rider 1 (Approved Car Driver at Indiranagar 12.9716, 77.6412)
    rider = User(
        id="rider_1",
        phone_number="+919222222222",
        full_name="Suresh Kumar",
        role=UserRole.RIDER
    )
    session.add(rider)
    rider_prof = RiderProfile(
        id="prof_1",
        user_id=rider.id,
        license_number="DL-04-2023-009988",
        status=RiderApprovalStatus.APPROVED,
        is_online=True,
        is_busy=False,
        current_latitude=12.9716,
        current_longitude=77.6412
    )
    session.add(rider_prof)
    session.add(Vehicle(
        id="veh_1",
        rider_id=rider_prof.id,
        category=VehicleCategory.CAR,
        make="Maruti Suzuki",
        model="Swift Dzire",
        license_plate="KA-03-AB-4422",
        color="Silver",
        is_active=True
    ))

    # Seed Rider 2 (Approved Car Driver at Indiranagar for concurrency test)
    rider2 = User(
        id="rider_2",
        phone_number="+919333333333",
        full_name="Amit Sharma",
        role=UserRole.RIDER
    )
    session.add(rider2)
    rider_prof2 = RiderProfile(
        id="prof_2",
        user_id=rider2.id,
        license_number="DL-04-2023-009989",
        status=RiderApprovalStatus.APPROVED,
        is_online=True,
        is_busy=False,
        current_latitude=12.9718,
        current_longitude=77.6415
    )
    session.add(rider_prof2)
    session.add(Vehicle(
        id="veh_2",
        rider_id=rider_prof2.id,
        category=VehicleCategory.CAR,
        make="Hyundai",
        model="Aura",
        license_plate="KA-03-XY-9988",
        color="White",
        is_active=True
    ))

    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_complete_ride_matching_and_lifecycle(client):
    """
    End-to-end integration test of:
    1. Passenger books ride within 2km radius
    2. Driver matching engine finds available driver
    3. Atomic acceptance
    4. Driver marks arrived
    5. Driver inputs passenger's 4-digit OTP to start trip
    6. Driver completes trip, checks fare receipt & earnings
    """
    passenger_token = create_access_token({"sub": "passenger_1", "role": "passenger"})
    rider_token = create_access_token({"sub": "rider_1", "role": "rider"})
    rider2_token = create_access_token({"sub": "rider_2", "role": "rider"})

    # 1. Passenger Creates Booking (Indiranagar to Koramangala)
    booking_payload = {
        "pickup_address": "Indiranagar 100 Feet Rd, Bengaluru",
        "pickup_latitude": 12.9716,
        "pickup_longitude": 77.6412,
        "destination_address": "Koramangala 5th Block, Bengaluru",
        "destination_latitude": 12.9352,
        "destination_longitude": 77.6245,
        "vehicle_category": "car"
    }

    create_resp = client.post(
        "/api/rides",
        json=booking_payload,
        headers={"Authorization": f"Bearer {passenger_token}"}
    )
    assert create_resp.status_code == 201
    ride_data = create_resp.json()
    ride_id = ride_data["id"]
    assert ride_data["status"] == "REQUESTS_SENT"
    assert ride_data["otp"] is not None
    assert len(ride_data["otp"]) == 4
    passenger_otp = ride_data["otp"]

    # 2. Check Rider 1 sees incoming requests
    req_resp = client.get("/api/rider/requests", headers={"Authorization": f"Bearer {rider_token}"})
    assert req_resp.status_code == 200
    requests = req_resp.json()
    assert len(requests) >= 1
    assert requests[0]["ride_id"] == ride_id

    # 3. Rider 1 accepts ride atomically
    accept_resp = client.post(
        f"/api/rides/{ride_id}/accept",
        headers={"Authorization": f"Bearer {rider_token}"}
    )
    assert accept_resp.status_code == 200
    accepted_data = accept_resp.json()
    assert accepted_data["status"] == "RIDER_ARRIVING"
    assert accepted_data["rider_id"] == "rider_1"

    # 4. Concurrency Test: Rider 2 tries to accept same ride -> Must fail with 409 Conflict
    conflict_resp = client.post(
        f"/api/rides/{ride_id}/accept",
        headers={"Authorization": f"Bearer {rider2_token}"}
    )
    assert conflict_resp.status_code == 409
    assert "already been accepted" in conflict_resp.json()["detail"]

    # 5. Rider 1 marks arrived
    arrived_resp = client.post(
        f"/api/rides/{ride_id}/arrived",
        headers={"Authorization": f"Bearer {rider_token}"}
    )
    assert arrived_resp.status_code == 200
    assert arrived_resp.json()["status"] == "RIDER_ARRIVED"

    # 6. Rider 1 verifies OTP:
    # 6a. Wrong OTP -> should be rejected
    wrong_otp_resp = client.post(
        f"/api/rides/{ride_id}/start",
        json={"otp": "9999"},
        headers={"Authorization": f"Bearer {rider_token}"}
    )
    assert wrong_otp_resp.status_code == 400
    assert "Invalid 4-digit OTP" in wrong_otp_resp.json()["detail"]

    # 6b. Correct OTP -> Trip starts!
    start_resp = client.post(
        f"/api/rides/{ride_id}/start",
        json={"otp": passenger_otp},
        headers={"Authorization": f"Bearer {rider_token}"}
    )
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "IN_PROGRESS"

    # 7. Rider completes trip
    complete_resp = client.post(
        f"/api/rides/{ride_id}/complete",
        json={"actual_distance_km": 5.2},
        headers={"Authorization": f"Bearer {rider_token}"}
    )
    assert complete_resp.status_code == 200
    completed_data = complete_resp.json()
    assert completed_data["status"] == "COMPLETED"
    assert completed_data["actual_distance_km"] == 5.2
    assert completed_data["final_fare"] > 0

    # 8. Rider dashboard reflects earnings
    dash_resp = client.get("/api/rider/dashboard", headers={"Authorization": f"Bearer {rider_token}"})
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["total_completed_trips"] == 1
    assert dash_data["total_earnings"] > 0
    assert dash_data["is_busy"] is False


def test_admin_portal_endpoints(client):
    """Tests admin platform statistics, list of riders, and approval status change."""
    admin_token = create_access_token({"sub": "admin_1", "role": "admin"})

    # 1. Admin Overview
    overview_resp = client.get("/api/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["passengers"] >= 1
    assert overview["riders"]["total"] >= 2

    # 2. Admin List Riders
    riders_resp = client.get("/api/admin/riders", headers={"Authorization": f"Bearer {admin_token}"})
    assert riders_resp.status_code == 200
    assert len(riders_resp.json()) >= 2

    # 3. Admin Change Rider Status to suspended
    status_resp = client.put(
        "/api/admin/riders/rider_2/status",
        json={"status": "suspended", "reason": "Document compliance audit"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["new_status"] == "suspended"
