import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_university_rides_api():
    # Seed required test rides dynamically so tests don't rely on pre-existing fake DB data
    host_login = client.post("/api/auth/demo-login/rider")
    assert host_login.status_code == 200
    host_token = host_login.json()["access_token"]
    host_headers = {"Authorization": f"Bearer {host_token}"}

    created_ids = []
    r1 = client.post("/api/community-rides", json={
        "pickup_address": "Alkapuri, Vadodara",
        "destination_address": "Parul University Gate 1",
        "departure_time": "10:00 PM",
        "total_seats": 2,
        "price_per_seat": 40.0,
        "vehicle_info": "Hero Splendor (BIKE)",
        "vehicle_type": "bike",
        "category_type": "UNIVERSITY",
        "university_name": "Parul University",
        "university_short_name": "PU",
        "poster_gender": "MALE",
        "notes": "PU Ride"
    }, headers=host_headers)
    if r1.status_code == 201:
        created_ids.append(r1.json()["id"])

    r2 = client.post("/api/community-rides", json={
        "pickup_address": "Sayajigunj, Vadodara",
        "destination_address": "Parul University Gate 2",
        "departure_time": "09:00 PM",
        "total_seats": 2,
        "price_per_seat": 50.0,
        "vehicle_info": "Activa 6G (BIKE)",
        "vehicle_type": "bike",
        "category_type": "UNIVERSITY",
        "university_name": "Parul University",
        "university_short_name": "PU",
        "poster_gender": "FEMALE",
        "notes": "Girls Ride"
    }, headers=host_headers)
    if r2.status_code == 201:
        created_ids.append(r2.json()["id"])

    r3 = client.post("/api/community-rides", json={
        "pickup_address": "Vadodara Station",
        "destination_address": "Ahmedabad Airport",
        "departure_time": "11:00 PM",
        "total_seats": 3,
        "price_per_seat": 150.0,
        "vehicle_info": "Swift Dzire (CAR)",
        "vehicle_type": "car",
        "category_type": "CITY",
        "poster_gender": "MALE",
        "notes": "City Intercity"
    }, headers=host_headers)
    if r3.status_code == 201:
        created_ids.append(r3.json()["id"])

    r4 = client.post("/api/community-rides", json={
        "pickup_address": "Fatehgunj",
        "destination_address": "Manjalpur",
        "departure_time": "08:00 PM",
        "total_seats": 1,
        "price_per_seat": 30.0,
        "vehicle_info": "Hero HF Deluxe",
        "vehicle_type": "bike",
        "category_type": "LOCAL",
        "poster_gender": "MALE",
        "notes": "Local commute"
    }, headers=host_headers)
    if r4.status_code == 201:
        created_ids.append(r4.json()["id"])

    try:
        # 1. Test search with PU / Parul
        res_pu = client.get("/api/community-rides?university_query=PU")
        assert res_pu.status_code == 200
        pu_data = res_pu.json()
        assert isinstance(pu_data, list)
        assert len(pu_data) >= 1
        pu_ride = next((r for r in pu_data if r.get("university_short_name") == "PU"), None)
        assert pu_ride is not None
        assert pu_ride["university_name"] == "Parul University"

        # 2. Test Gender Filter
        res_female = client.get("/api/community-rides?category_type=UNIVERSITY&gender_filter=FEMALE")
        assert res_female.status_code == 200
        females = res_female.json()
        assert all(r["poster_gender"] == "FEMALE" for r in females)

        res_male = client.get("/api/community-rides?category_type=UNIVERSITY&gender_filter=MALE")
        assert res_male.status_code == 200
        males = res_male.json()
        assert all(r["poster_gender"] == "MALE" for r in males)

        # 3. Test Sort Order (asc vs desc)
        res_asc = client.get("/api/community-rides?category_type=UNIVERSITY&sort_order=asc")
        assert res_asc.status_code == 200
        res_desc = client.get("/api/community-rides?category_type=UNIVERSITY&sort_order=desc")
        assert res_desc.status_code == 200

        # 4. Test City and Local Categories
        res_city = client.get("/api/community-rides?category_type=CITY")
        assert res_city.status_code == 200
        assert all(r["category_type"] == "CITY" for r in res_city.json())

        res_local = client.get("/api/community-rides?category_type=LOCAL")
        assert res_local.status_code == 200
        assert all(r["category_type"] == "LOCAL" for r in res_local.json())
    finally:
        for cid in created_ids:
            client.delete(f"/api/community-rides/{cid}", headers=host_headers)


def test_booking_inventory_and_cancellation_flow():
    # 1. Login as rider (host) to post a ride
    host_login = client.post("/api/auth/demo-login/rider")
    assert host_login.status_code == 200
    host_token = host_login.json()["access_token"]
    host_headers = {"Authorization": f"Bearer {host_token}"}

    # Post a ride with 1 seat
    create_payload = {
        "pickup_address": "Alkapuri Station",
        "destination_address": "Parul University Gate 1",
        "departure_time": "11:45 PM",
        "total_seats": 1,
        "price_per_seat": 40.0,
        "vehicle_info": "Hero Splendor (BIKE)",
        "vehicle_type": "bike",
        "category_type": "UNIVERSITY",
        "university_name": "Parul University",
        "university_short_name": "PU",
        "poster_gender": "MALE",
        "notes": "College ride"
    }
    post_res = client.post("/api/community-rides", json=create_payload, headers=host_headers)
    assert post_res.status_code == 201
    ride = post_res.json()
    ride_id = ride["id"]
    assert ride["available_seats"] == 1
    assert ride["status"] == "OPEN"

    # 2. Login as passenger to book the seat
    passenger_login = client.post("/api/auth/demo-login/passenger")
    assert passenger_login.status_code == 200
    passenger_token = passenger_login.json()["access_token"]
    passenger_headers = {"Authorization": f"Bearer {passenger_token}"}

    # Reserve seat with passenger name, phone, and pickup landmark
    reserve_payload = {
        "seats_to_book": 1,
        "pickup_notes": "Waiting near Metro Gate 2 / Main Road",
        "passenger_name": "Arjun Sharma",
        "passenger_phone": "+91 98765 43210"
    }
    book_res = client.post(f"/api/community-rides/{ride_id}/reserve", json=reserve_payload, headers=passenger_headers)
    assert book_res.status_code == 200
    book_data = book_res.json()
    assert book_data["success"] is True
    booking_id = book_data["booking_id"]
    assert book_data["remaining_seats"] == 0

    # 3. Check public feed: ride available_seats should be 0 and status FULL
    feed_res = client.get(f"/api/community-rides?university_query=PU")
    assert feed_res.status_code == 200
    updated_ride = next((r for r in feed_res.json() if r["id"] == ride_id), None)
    assert updated_ride is not None
    assert updated_ride["available_seats"] == 0
    assert updated_ride["status"] == "FULL"

    # 4. Attempting to book again when 0 seats left or already booked must fail with 400
    second_book = client.post(f"/api/community-rides/{ride_id}/reserve", json=reserve_payload, headers=passenger_headers)
    assert second_book.status_code == 400
    assert ("FULL" in second_book.json()["detail"] or "already" in second_book.json()["detail"])

    # 5. Host views "Campus & City Bookings" (my-posted) and sees Arjun Sharma's details
    host_my_posted = client.get("/api/community-rides/my-posted", headers=host_headers)
    assert host_my_posted.status_code == 200
    host_rides = host_my_posted.json()
    my_ride_in_host = next((r for r in host_rides if r["id"] == ride_id), None)
    assert my_ride_in_host is not None
    assert len(my_ride_in_host["bookings"]) >= 1
    booking_item = next((b for b in my_ride_in_host["bookings"] if b["id"] == booking_id), None)
    assert booking_item is not None
    assert booking_item["passenger_name"] == "Arjun Sharma"
    assert booking_item["passenger_phone"] == "+91 98765 43210"
    assert "Metro Gate 2" in booking_item["pickup_notes"]
    assert booking_item["seats_booked"] == 1
    assert booking_item["status"] in ("CONFIRMED", "PENDING")

    # 6. Passenger cancels reservation (e.g. at night or anytime)
    cancel_res = client.post(f"/api/community-rides/bookings/{booking_id}/cancel", json={"reason": "Plans changed"}, headers=passenger_headers)
    assert cancel_res.status_code == 200
    cancel_data = cancel_res.json()
    assert cancel_data["success"] is True
    assert cancel_data["remaining_seats"] == 1
    assert cancel_data["ride_status"] == "OPEN"

    # 7. Check public feed: seat count replenished to 1 and status OPEN again!
    feed_after_cancel = client.get(f"/api/community-rides?university_query=PU")
    assert feed_after_cancel.status_code == 200
    restored_ride = next((r for r in feed_after_cancel.json() if r["id"] == ride_id), None)
    assert restored_ride is not None
    assert restored_ride["available_seats"] == 1
    assert restored_ride["status"] == "OPEN"

    # Clean up
    client.delete(f"/api/community-rides/{ride_id}", headers=host_headers)


def test_modify_posted_ride_by_host():
    # 1. Login as rider (host)
    host_login = client.post("/api/auth/demo-login/rider")
    assert host_login.status_code == 200
    host_token = host_login.json()["access_token"]
    host_headers = {"Authorization": f"Bearer {host_token}"}

    # Post ride
    create_payload = {
        "pickup_address": "Station Circle",
        "destination_address": "Campus Gate 3",
        "departure_time": "11:00 PM",
        "total_seats": 1,
        "price_per_seat": 35.0,
        "vehicle_info": "Honda Activa",
        "vehicle_type": "bike",
        "category_type": "LOCAL",
        "notes": "Original notes"
    }
    post_res = client.post("/api/community-rides", json=create_payload, headers=host_headers)
    assert post_res.status_code == 201
    ride_id = post_res.json()["id"]

    # 2. Host modifies ride (change departure to 11:30 PM, price to 45, seats to 2)
    update_payload = {
        "departure_time": "11:30 PM",
        "price_per_seat": 45.0,
        "total_seats": 2,
        "notes": "Updated: Timing changed to 11:30 PM"
    }
    put_res = client.put(f"/api/community-rides/{ride_id}", json=update_payload, headers=host_headers)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["departure_time"] == "11:30 PM"
    assert updated["price_per_seat"] == 45.0
    assert updated["total_seats"] == 2
    assert updated["available_seats"] == 2
    assert "Updated" in updated["notes"]

    # 3. Another user cannot modify someone else's ride
    pass_login = client.post("/api/auth/demo-login/passenger")
    pass_headers = {"Authorization": f"Bearer {pass_login.json()['access_token']}"}
    unauthorized_put = client.put(f"/api/community-rides/{ride_id}", json=update_payload, headers=pass_headers)
    assert unauthorized_put.status_code == 403

    # Clean up
    client.delete(f"/api/community-rides/{ride_id}", headers=host_headers)


def test_privacy_and_data_protection():
    # 1. Host posts a ride
    host_login = client.post("/api/auth/demo-login/rider")
    host_token = host_login.json()["access_token"]
    host_headers = {"Authorization": f"Bearer {host_token}"}

    create_payload = {
        "pickup_address": "Hostel 4",
        "destination_address": "Library Complex",
        "departure_time": "11:45 PM",
        "total_seats": 2,
        "price_per_seat": 25.0,
        "vehicle_info": "Bajaj Pulsar",
        "vehicle_type": "bike",
        "category_type": "LOCAL"
    }
    post_res = client.post("/api/community-rides", json=create_payload, headers=host_headers)
    assert post_res.status_code == 201
    ride_id = post_res.json()["id"]

    # 2. Passenger 1 books a seat
    pass_login = client.post("/api/auth/demo-login/passenger")
    pass_headers = {"Authorization": f"Bearer {pass_login.json()['access_token']}"}
    client.post(
        f"/api/community-rides/{ride_id}/reserve",
        json={"seats_to_book": 1, "passenger_name": "Secret Passenger", "passenger_phone": "+91 99999 88888", "pickup_notes": "Corner shop"},
        headers=pass_headers
    )

    # 3. Public feed requested by anonymous stranger
    public_res = client.get(f"/api/community-rides?category_type=LOCAL")
    assert public_res.status_code == 200
    ride_in_feed = next((r for r in public_res.json() if r["id"] == ride_id), None)
    assert ride_in_feed is not None
    # Bookings list is None for public viewers (never exposes passengers)
    assert ride_in_feed.get("bookings") is None
    # Host phone is masked for strangers who haven't booked
    assert "***" in ride_in_feed["creator_phone"]

    # Clean up
    client.delete(f"/api/community-rides/{ride_id}", headers=host_headers)


def test_auto_expiry_unbooked_rides():
    # 1. Host posts a ride with departure time well in the past (e.g. 05:00 AM)
    host_login = client.post("/api/auth/demo-login/rider")
    host_headers = {"Authorization": f"Bearer {host_login.json()['access_token']}"}

    past_dt = datetime.now() - timedelta(hours=2)
    create_payload = {
        "pickup_address": "Old Terminal",
        "destination_address": "North Campus",
        "departure_time": past_dt.strftime("%I:%M %p"),
        "departure_datetime": past_dt.isoformat(),
        "total_seats": 1,
        "price_per_seat": 30.0,
        "category_type": "UNIVERSITY",
        "university_name": "Expired Test Uni",
        "university_short_name": "ETU"
    }
    post_res = client.post("/api/community-rides", json=create_payload, headers=host_headers)
    assert post_res.status_code == 201
    ride_id = post_res.json()["id"]

    # 2. Trigger cleanup endpoint or request public feed (which automatically cleans expired)
    cleanup_res = client.post("/api/community-rides/cleanup-expired")
    assert cleanup_res.status_code == 200
    assert cleanup_res.json()["success"] is True

    # 3. Check public feed: the ride must NOT exist anymore
    feed_res = client.get("/api/community-rides?university_query=ETU")
    assert feed_res.status_code == 200
    assert all(r["id"] != ride_id for r in feed_res.json())

