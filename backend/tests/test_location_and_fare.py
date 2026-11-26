import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.fare import FareConfiguration
from app.models.vehicle import VehicleCategory
from app.models.user import User, UserRole
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
    
    # Seed default fare rules
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
    session.add(FareConfiguration(
        vehicle_category=VehicleCategory.AUTO,
        base_fare=0.0,
        per_km_rate=10.0,
        min_fare=40.0,
        cancellation_fee=30.0,
        surge_multiplier=1.0,
        tax_percent=5.0,
        is_active=True
    ))

    # Seed Admin User
    admin = User(
        phone_number="+919999999999",
        full_name="Admin",
        role=UserRole.ADMIN,
        hashed_password=hash_password("Admin@123")
    )
    session.add(admin)
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


def test_location_search_india(client):
    """Verifies that place autocomplete returns Indian landmarks with coordinates."""
    response = client.get("/api/location/search?query=Indiranagar")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] > 0
    first = data["suggestions"][0]
    assert "Indiranagar" in first["name"] or "Indiranagar" in first["formatted_address"]
    assert first["latitude"] > 0
    assert first["longitude"] > 0


def test_reverse_geocode(client):
    """Verifies reverse geocoding returns valid address."""
    response = client.get("/api/location/reverse?latitude=12.9716&longitude=77.6412")
    assert response.status_code == 200
    data = response.json()
    assert "Indiranagar" in data["address"] or "Bengaluru" in data["address"]
    assert data["country"] == "India"


def test_route_calculation(client):
    """Verifies road route calculation returns distance and polyline geometry."""
    payload = {
        "pickup_latitude": 12.9716,
        "pickup_longitude": 77.6412,
        "dropoff_latitude": 12.9352,
        "dropoff_longitude": 77.6245
    }
    response = client.post("/api/location/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] > 0
    assert data["duration_minutes"] > 0
    assert len(data["route_geometry"]) >= 2


def test_fare_estimate_rates(client):
    """
    CRITICAL TEST: Verifies Bike is calculated at ₹7/km base and Car at ₹15/km base.
    """
    payload = {
        "pickup_latitude": 12.9716,
        "pickup_longitude": 77.6412,
        "dropoff_latitude": 12.9352,
        "dropoff_longitude": 77.6245
    }
    response = client.post("/api/fare/estimate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] > 0
    estimates = {e["category"]: e for e in data["estimates"]}

    # Bike Verification
    bike = estimates["bike"]
    assert bike["rate_per_km"] == 7.0
    expected_bike_subtotal = max(25.0, data["distance_km"] * 7.0)
    expected_bike_tax = round((expected_bike_subtotal * 5.0) / 100.0, 2)
    assert bike["estimated_fare"] == round(expected_bike_subtotal + expected_bike_tax, 2)

    # Car Verification
    car = estimates["car"]
    assert car["rate_per_km"] == 15.0
    expected_car_subtotal = max(60.0, data["distance_km"] * 15.0)
    expected_car_tax = round((expected_car_subtotal * 5.0) / 100.0, 2)
    assert car["estimated_fare"] == round(expected_car_subtotal + expected_car_tax, 2)

    # Auto Verification
    auto = estimates["auto"]
    assert auto["rate_per_km"] == 10.0


def test_admin_update_fare_config(client, db_session):
    """Verifies that an admin can update per-km rates."""
    admin = db_session.query(User).filter(User.role == UserRole.ADMIN).first()
    token = create_access_token({"sub": admin.id, "role": UserRole.ADMIN})

    # Update bike rate to ₹8/km
    resp = client.put(
        "/api/fare/configs/bike",
        json={"per_km_rate": 8.5, "min_fare": 30.0},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["per_km_rate"] == 8.5
    assert data["min_fare"] == 30.0
