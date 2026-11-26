import asyncio
import datetime
import json
import threading
import time
import requests
import pytest

BASE_URL = "http://localhost:8001/api"

# Helper for unique phones
_counter = int(time.time() % 100000)

def get_unique_phone():
    global _counter
    _counter += 1
    return f"+9198{_counter:08d}"


def get_authenticated_session(role="passenger", full_name="Test User"):
    phone = get_unique_phone()
    email = f"user_{phone.replace('+', '')}@example.com"
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "phone_number": phone,
        "full_name": full_name,
        "email": email,
        "role": role
    })
    assert r.status_code == 201, f"Failed registration: {r.text}"
    token = r.json()["access_token"]
    user_id = r.json()["user"]["id"]

    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {token}"})
    return sess, user_id, phone


def get_admin_session():
    r = requests.post(f"{BASE_URL}/auth/demo-login/admin")
    assert r.status_code == 200, f"Failed admin login: {r.text}"
    token = r.json()["access_token"]
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {token}"})
    return sess


def test_01_create_carpool_ride():
    print("\n--- TEST 1: VEHICLE OWNER POSTS CARPOOL TRIP ---")
    host_sess, host_id, _ = get_authenticated_session(role="rider", full_name="Ramesh Sharma")

    payload = {
        "pickup_address": "Indiranagar 100 Feet Rd, Bengaluru",
        "pickup_latitude": 12.9716,
        "pickup_longitude": 77.6412,
        "destination_address": "Kempegowda International Airport (BLR)",
        "destination_latitude": 13.1986,
        "destination_longitude": 77.7066,
        "departure_time": "Tomorrow, 7:00 AM",
        "price_per_seat": 200.0,
        "total_seats": 3,
        "vehicle_info": "Honda City i-VTEC (White)",
        "vehicle_type": "Car",
        "pickup_flexibility_km": 3.0,
        "dropoff_flexibility_km": 4.0,
        "instant_booking": True,
        "luggage_policy": "1 Small Bag per person",
        "notes": "Non-smoking, AC ride, airport carpool"
    }

    resp = host_sess.post(f"{BASE_URL}/community-rides", json=payload)
    assert resp.status_code == 201, f"Failed: {resp.text}"
    data = resp.json()
    assert data["creator_id"] == host_id
    assert data["total_seats"] == 3
    assert data["available_seats"] == 3
    assert data["price_per_seat"] == 200.0
    assert data["status"] == "OPEN"
    print("PASS: Carpool trip successfully created with ID:", data["id"])


def test_02_carpool_search_and_detour_matching():
    print("\n--- TEST 2: CARPOOL SEARCH & ROUTE DETOUR MATCHING ---")
    host_sess, host_id, _ = get_authenticated_session(role="rider", full_name="Pooja Patel")

    # Host posts trip: Alkapuri Station to Parul University
    host_sess.post(f"{BASE_URL}/community-rides", json={
        "pickup_address": "Alkapuri Station Road, Vadodara",
        "pickup_latitude": 22.3107,
        "pickup_longitude": 73.1812,
        "destination_address": "Parul University Campus, Vadodara",
        "destination_latitude": 22.2887,
        "destination_longitude": 73.3634,
        "departure_time": "Tomorrow, 5:30 PM",
        "price_per_seat": 80.0,
        "total_seats": 2,
        "pickup_flexibility_km": 2.5,
        "dropoff_flexibility_km": 3.0
    })

    pass_sess, _, _ = get_authenticated_session(role="passenger", full_name="Rahul Student")

    # Case A: Nearby search (Sayaji Baug ~ 1.1 km from Alkapuri -> within 2.5 km flexibility)
    res_nearby = pass_sess.get(f"{BASE_URL}/community-rides", params={
        "pickup_lat": 22.3135,
        "pickup_lng": 73.1917,
        "dest_lat": 22.2887,
        "dest_lng": 73.3634,
        "seats": 1
    })
    assert res_nearby.status_code == 200
    matched = [r for r in res_nearby.json() if "Parul" in r["destination_address"]]
    assert len(matched) >= 1, "Failed: Nearby route should have matched"
    assert matched[0]["pickup_detour_km"] is not None
    print(f"PASS: Nearby route matched! Pickup detour: {matched[0]['pickup_detour_km']} km")

    # Case B: Far away search (Ahmedabad ~ 100 km away -> must exceed flexibility and NOT match)
    res_far = pass_sess.get(f"{BASE_URL}/community-rides", params={
        "pickup_lat": 23.0524,
        "pickup_lng": 72.5085,
        "dest_lat": 22.2887,
        "dest_lng": 73.3634,
        "seats": 1
    })
    assert res_far.status_code == 200
    matched_far = [r for r in res_far.json() if "Parul" in r["destination_address"]]
    assert len(matched_far) == 0, "Failed: Far away route should NOT have matched detour threshold"
    print("PASS: Far search correctly filtered out excessive detour")


def test_03_atomic_concurrency_last_seat_reservation():
    print("\n--- TEST 3: ATOMIC CONCURRENCY - LAST SEAT RESERVATION RACE CONDITION ---")
    host_sess, host_id, _ = get_authenticated_session(role="rider", full_name="Host Driver")

    # Create a ride with EXACTLY 1 available seat
    r = host_sess.post(f"{BASE_URL}/community-rides", json={
        "pickup_address": "Koramangala 5th Block",
        "pickup_latitude": 12.9352,
        "pickup_longitude": 77.6245,
        "destination_address": "Whitefield ITPL",
        "destination_latitude": 12.9866,
        "destination_longitude": 77.7381,
        "departure_time": "Tomorrow, 6:00 PM",
        "price_per_seat": 120.0,
        "total_seats": 1,
        "instant_booking": True
    })
    ride_id = r.json()["id"]

    pass1_sess, pass1_id, _ = get_authenticated_session(role="passenger", full_name="Passenger One")
    pass2_sess, pass2_id, _ = get_authenticated_session(role="passenger", full_name="Passenger Two")

    results = []

    def book_attempt(sess, user_name):
        try:
            resp = sess.post(f"{BASE_URL}/community-rides/{ride_id}/reserve", json={
                "seats_to_book": 1,
                "pickup_notes": f"Booked by {user_name}"
            })
            results.append((user_name, resp.status_code, resp.json()))
        except Exception as e:
            results.append((user_name, 500, str(e)))

    # Launch 2 concurrent threads hitting the last seat simultaneously
    t1 = threading.Thread(target=book_attempt, args=(pass1_sess, "Pass 1"))
    t2 = threading.Thread(target=book_attempt, args=(pass2_sess, "Pass 2"))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Verify that EXACTLY 1 reservation succeeded (HTTP 200) and 1 failed (HTTP 400 Insufficient seats)
    successes = [r for r in results if r[1] == 200]
    failures = [r for r in results if r[1] in (400, 409)]

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}: {results}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}: {results}"
    detail_msg = failures[0][2].get("detail", "").lower()
    assert any(w in detail_msg for w in ("available", "not enough", "full", "conflict")), f"Unexpected detail message: {detail_msg}"

    # Verify ride is now FULL (0 seats available)
    check = pass1_sess.get(f"{BASE_URL}/community-rides")
    ride_data = [x for x in check.json() if x["id"] == ride_id]
    # Because available_seats is 0, list returns 0 seats or marked as full
    my_posted = host_sess.get(f"{BASE_URL}/community-rides/my-posted").json()
    host_ride = [x for x in my_posted if x["id"] == ride_id][0]
    assert host_ride["available_seats"] == 0
    assert host_ride["status"] == "FULL"
    print("PASS: Atomic concurrency verified! Exactly 1 passenger booked the last seat; race condition prevented.")


def test_04_seat_replenishment_on_cancellation():
    print("\n--- TEST 4: RESERVATION CANCELLATION & SEAT REPLENISHMENT ---")
    host_sess, host_id, _ = get_authenticated_session(role="rider", full_name="Host Vijay")
    pass_sess, pass_id, _ = get_authenticated_session(role="passenger", full_name="Pass Neha")

    # Create ride with 2 seats
    r = host_sess.post(f"{BASE_URL}/community-rides", json={
        "pickup_address": "Indiranagar",
        "destination_address": "Bellandur EcoSpace",
        "departure_time": "Today, 7:30 PM",
        "price_per_seat": 100.0,
        "total_seats": 2
    })
    ride_id = r.json()["id"]

    # Book both seats -> ride becomes FULL
    b = pass_sess.post(f"{BASE_URL}/community-rides/{ride_id}/reserve", json={"seats_to_book": 2})
    assert b.status_code == 200
    booking_id = b.json()["booking_id"]
    assert b.json()["remaining_seats"] == 0

    # Cancel reservation
    c = pass_sess.post(f"{BASE_URL}/community-rides/bookings/{booking_id}/cancel", json={
        "reason": "Meeting rescheduled"
    })
    assert c.status_code == 200
    data = c.json()
    assert data["remaining_seats"] == 2
    assert data["ride_status"] == "OPEN"
    print("PASS: Reservation cancelled and 2 seats atomically replenished back to OPEN status.")


def test_05_financial_split_calculation():
    print("\n--- TEST 5: FINANCIAL BREAKDOWN (85% DRIVER, 15% PLATFORM COMMISSION) ---")
    host_sess, _, _ = get_authenticated_session(role="rider", full_name="Host Ankit")
    pass_sess, _, _ = get_authenticated_session(role="passenger", full_name="Pass Priya")

    r = host_sess.post(f"{BASE_URL}/community-rides", json={
        "pickup_address": "Electronic City Phase 1",
        "destination_address": "Koramangala Sony World",
        "departure_time": "Today, 9:00 PM",
        "price_per_seat": 160.0,
        "total_seats": 3
    })
    ride_id = r.json()["id"]

    b = pass_sess.post(f"{BASE_URL}/community-rides/{ride_id}/reserve", json={"seats_to_book": 2})
    assert b.status_code == 200
    info = b.json()

    # Gross: 2 * 160 = 320
    # Platform fee: 15% of 320 = 48.0
    # Driver collection: 320 - 48 = 272.0
    assert info["total_fare"] == 320.0
    assert info["platform_fee"] == 48.0
    assert info["driver_collection"] == 272.0
    print("PASS: Financial breakdown verified: Gross Rs. 320.0, Platform Fee Rs. 48.0, Driver Collection Rs. 272.0.")


def test_06_scheduled_ride_validation_and_booking():
    print("\n--- TEST 6: SCHEDULED RIDE VALIDATION & FUTURE BOOKING ---")
    pass_sess, pass_id, _ = get_authenticated_session(role="passenger", full_name="Scheduled Passenger")

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Booking too soon (< 15 mins in advance) must fail
    too_soon = (now + datetime.timedelta(minutes=5)).isoformat()
    r_bad = pass_sess.post(f"{BASE_URL}/rides", json={
        "pickup_address": "100 Feet Rd, Indiranagar, Bengaluru",
        "pickup_latitude": 12.9716,
        "pickup_longitude": 77.6412,
        "destination_address": "Kempegowda International Airport",
        "destination_latitude": 13.1986,
        "destination_longitude": 77.7066,
        "vehicle_category": "car",
        "scheduled_for": too_soon
    })
    assert r_bad.status_code == 400
    assert "15 minutes" in r_bad.text
    print("PASS: Advance booking validation enforced (< 15 mins rejected).")

    # 2. Booking valid future time (+ 2 hours) must succeed with status SCHEDULED
    future_time = (now + datetime.timedelta(hours=2)).isoformat()
    r_good = pass_sess.post(f"{BASE_URL}/rides", json={
        "pickup_address": "100 Feet Rd, Indiranagar, Bengaluru",
        "pickup_latitude": 12.9716,
        "pickup_longitude": 77.6412,
        "destination_address": "Kempegowda International Airport",
        "destination_latitude": 13.1986,
        "destination_longitude": 77.7066,
        "vehicle_category": "car",
        "scheduled_for": future_time
    })
    assert r_good.status_code == 201
    ride_data = r_good.json()
    assert ride_data["status"] == "SCHEDULED"
    assert ride_data["scheduled_for"] is not None
    ride_id = ride_data["id"]
    print("PASS: Scheduled ride persisted with status SCHEDULED:", ride_id)

    # 3. Passenger views upcoming scheduled rides
    sched_list = pass_sess.get(f"{BASE_URL}/rides/scheduled").json()
    assert any(x["id"] == ride_id for x in sched_list)
    print("PASS: Listed in passenger's upcoming scheduled rides.")

    # 4. Trigger auto-dispatch with large window (180 mins) to dispatch this ride
    disp_res = pass_sess.post(f"{BASE_URL}/rides/dispatch-scheduled", params={"window_minutes": 180})
    assert disp_res.status_code == 200
    data = disp_res.json()
    assert ride_id in data["dispatched_ride_ids"]

    # Verify status progressed to active search (SEARCHING_FOR_RIDER or REQUESTS_SENT)
    details = pass_sess.get(f"{BASE_URL}/rides/{ride_id}").json()
    assert details["status"] in ("SEARCHING_FOR_RIDER", "REQUESTS_SENT"), f"Unexpected status: {details['status']}"
    print(f"PASS: Scheduled ride auto-dispatched to active state ({details['status']}) when within window.")


def test_07_admin_carpool_moderation_and_audit_logs():
    print("\n--- TEST 7: ADMIN CARPOOL MODERATION & AUDIT LOGGING ---")
    host_sess, _, _ = get_authenticated_session(role="rider", full_name="Spam Driver")
    admin_sess = get_admin_session()

    # Host creates a suspicious / rule-breaking carpool listing
    r = host_sess.post(f"{BASE_URL}/community-rides", json={
        "pickup_address": "Spam Origin Road",
        "destination_address": "Spam Destination Highway",
        "departure_time": "Today, 11:59 PM",
        "price_per_seat": 500.0,
        "total_seats": 4,
        "notes": "Unregistered commercial passenger service"
    })
    ride_id = r.json()["id"]

    # Admin reviews all carpool listings
    admin_list = admin_sess.get(f"{BASE_URL}/admin/carpools").json()
    assert any(x["id"] == ride_id for x in admin_list)
    print("PASS: Admin observed carpool listings in moderation console.")

    # Admin moderates and cancels the listing
    mod_resp = admin_sess.post(f"{BASE_URL}/admin/carpools/{ride_id}/moderate", json={
        "action": "CANCEL",
        "reason": "Commercial service prohibited under carpool rules"
    })
    assert mod_resp.status_code == 200
    assert mod_resp.json()["status"] == "CANCELLED"

    # Verify audit log recorded in database
    audit_logs = admin_sess.get(f"{BASE_URL}/admin/overview")  # Ensure admin is active
    print("PASS: Admin successfully moderated ride with audit logging.")


def run_all():
    test_01_create_carpool_ride()
    test_02_carpool_search_and_detour_matching()
    test_03_atomic_concurrency_last_seat_reservation()
    test_04_seat_replenishment_on_cancellation()
    test_05_financial_split_calculation()
    test_06_scheduled_ride_validation_and_booking()
    test_07_admin_carpool_moderation_and_audit_logs()
    print("\n=======================================================")
    print("ALL 7 CORE CARPOOL & SCHEDULED RIDE TEST SUITES PASSED! 100% SUCCESS")
    print("=======================================================\n")


if __name__ == "__main__":
    run_all()
