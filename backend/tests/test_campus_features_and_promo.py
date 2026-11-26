import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_campus_vehicle_registration_and_tiered_limits():
    # 1. Login as a new passenger user (unregistered vehicle)
    # Register a new unique passenger
    new_phone = f"+9193{int(datetime.now().timestamp() * 1000) % 100000000:08d}"
    reg_res = client.post("/api/auth/register", json={
        "phone_number": new_phone,
        "full_name": "Deepak Patel",
        "role": "passenger"
    })
    assert reg_res.status_code in (200, 201)
    user_token = reg_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 2. Check initial vehicle registration status (should be false)
    veh_check = client.get("/api/community-rides/my-vehicle", headers=user_headers)
    assert veh_check.status_code == 200
    assert veh_check.json()["registered"] is False

    # 3. Attempting to post without vehicle registration should fail with 400
    post_fail = client.post("/api/community-rides", json={
        "pickup_address": "Vadodara Central Bus Station",
        "destination_address": "Parul University",
        "departure_time": "08:30 AM",
        "price_per_seat": 50.0,
        "total_seats": 2,
    }, headers=user_headers)
    assert post_fail.status_code == 400
    assert "Driving License" in post_fail.json()["detail"]

    # 4. Register vehicle & license
    unique_lic = f"GJ-06-{int(datetime.now().timestamp() * 1000) % 1000000:06d}"
    reg_veh = client.post("/api/community-rides/register-vehicle", json={
        "license_number": unique_lic,
        "vehicle_plate": f"GJ-06-PU-{int(datetime.now().timestamp()) % 10000:04d}",
        "vehicle_type": "GENERAL_BIKE",
        "vehicle_model": "Hero Splendor Plus"
    }, headers=user_headers)
    assert reg_veh.status_code == 200
    veh_data = reg_veh.json()
    assert veh_data["success"] is True
    assert veh_data["profile"]["status"] == "PENDING"

    # 5. Verify my-vehicle now returns the registered details
    veh_check2 = client.get("/api/community-rides/my-vehicle", headers=user_headers)
    assert veh_check2.status_code == 200
    assert veh_check2.json()["registered"] is True
    assert veh_check2.json()["profile"]["license_number"] == unique_lic

    # 6. Post 1st ride (allowed for unverified user)
    ride1 = client.post("/api/community-rides", json={
        "pickup_address": "Vadodara Central Bus Station",
        "destination_address": "Parul University Gate 2",
        "departure_time": "08:30 AM",
        "price_per_seat": 50.0,
        "total_seats": 1,
        "university_name": "Parul University",
        "category_type": "UNIVERSITY"
    }, headers=user_headers)
    assert ride1.status_code == 201
    ride1_id = ride1.json()["id"]

    # 7. Post 2nd ride on the same day while UNVERIFIED -> must fail with 400 tiered limit error!
    ride2_fail = client.post("/api/community-rides", json={
        "pickup_address": "Vadodara Central Bus Station",
        "destination_address": "Parul University Gate 2",
        "departure_time": "11:30 AM",
        "price_per_seat": 50.0,
        "total_seats": 1,
        "university_name": "Parul University"
    }, headers=user_headers)
    assert ride2_fail.status_code == 400
    assert "at most 1 ride per day" in ride2_fail.json()["detail"]

    # 8. Admin approves/verifies this host
    admin_login = client.post("/api/auth/demo-login/admin")
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin lists campus vehicles
    admin_list = client.get("/api/admin/campus-vehicles", headers=admin_headers)
    assert admin_list.status_code == 200
    host_entry = next((h for h in admin_list.json() if h["license_number"] == unique_lic), None)
    assert host_entry is not None
    assert host_entry["status"] == "PENDING"

    # Admin verifies the host
    prof_id = host_entry["profile_id"]
    approve_res = client.put(f"/api/admin/campus-vehicles/{prof_id}/status", json={
        "status": "VERIFIED",
        "notes": "Verified genuine driving license and vehicle registration"
    }, headers=admin_headers)
    assert approve_res.status_code == 200
    assert approve_res.json()["new_status"] == "VERIFIED"

    # 9. Now that host is VERIFIED, posting 2nd ride (separated by >= 1 hour) succeeds!
    ride2_success = client.post("/api/community-rides", json={
        "pickup_address": "Vadodara Central Bus Station",
        "destination_address": "Parul University Gate 2",
        "departure_time": "10:00 PM",
        "price_per_seat": 50.0,
        "total_seats": 1,
        "university_name": "Parul University"
    }, headers=user_headers)
    assert ride2_success.status_code == 201

    # 10. Test 1-hour interval conflict prevention:
    # Attempting to post a 3rd ride at 10:20 PM (only 20 mins from 10:00 PM) must fail!
    conflict_ride = client.post("/api/community-rides", json={
        "pickup_address": "Vadodara Central Bus Station",
        "destination_address": "Parul University Gate 2",
        "departure_time": "10:20 PM",
        "price_per_seat": 50.0,
        "total_seats": 1,
        "university_name": "Parul University"
    }, headers=user_headers)
    assert conflict_ride.status_code == 400
    assert "Time conflict" in conflict_ride.json()["detail"]

    # 11. Test Finish Ride endpoint
    finish_res = client.post(f"/api/community-rides/{ride1_id}/finish", headers=user_headers)
    assert finish_res.status_code == 200
    assert finish_res.json()["status"] == "COMPLETED"


def test_time_range_filter():
    # Test morning, afternoon, evening, night filter queries
    res_morn = client.get("/api/community-rides?time_range=MORNING")
    assert res_morn.status_code == 200
    assert isinstance(res_morn.json(), list)

    res_after = client.get("/api/community-rides?time_range=AFTERNOON")
    assert res_after.status_code == 200
    assert isinstance(res_after.json(), list)

    res_eve = client.get("/api/community-rides?time_range=EVENING")
    assert res_eve.status_code == 200
    assert isinstance(res_eve.json(), list)

    res_night = client.get("/api/community-rides?time_range=NIGHT")
    assert res_night.status_code == 200
    assert isinstance(res_night.json(), list)


def test_promo_codes_admin_crud_and_validation():
    # 1. Admin login
    admin_login = client.post("/api/auth/demo-login/admin")
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Admin creates a custom promo code
    unique_code = f"CAMPUS{int(datetime.now().timestamp() * 1000) % 100000}"
    create_promo = client.post("/api/admin/promo-codes", json={
        "code": unique_code,
        "discount_percent": 30.0,
        "max_discount_amount": 90.0,
        "min_order_amount": 50.0,
        "description": "30% OFF Special Campus discount",
        "is_active": True
    }, headers=admin_headers)
    assert create_promo.status_code == 200
    promo_data = create_promo.json()
    assert promo_data["success"] is True
    assert promo_data["promo"]["code"] == unique_code

    # 3. Passenger validates this promo code
    valid_res = client.post("/api/fare/validate-promo", json={
        "code": unique_code,
        "total_amount": 100.0
    })
    assert valid_res.status_code == 200
    v_data = valid_res.json()
    assert v_data["valid"] is True
    assert v_data["discount_percent"] == 30.0
    assert v_data["discount_amount"] == 30.0
    assert v_data["final_amount"] == 70.0

    # 4. Passenger validates an invalid promo code -> returns 400 Not valid
    invalid_res = client.post("/api/fare/validate-promo", json={
        "code": "RANDOMFAKECALL99",
        "total_amount": 100.0
    })
    assert invalid_res.status_code == 400
    assert "Not valid" in invalid_res.json()["detail"] or "Invalid" in invalid_res.json()["detail"]
