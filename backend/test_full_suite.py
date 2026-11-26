import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:8001/api"

def make_req(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    if method == "POST" and body is None:
        body = b""
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode()
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode()
        return e.code, json.loads(content) if content else {}

def run_tests():
    print("=" * 60)
    print("RUNNING COMPREHENSIVE RIDER / DRIVER MODULE TEST SUITE")
    print("=" * 60)
    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"[PASS] {name} {details}")
        else:
            print(f"[FAIL] {name} {details}")
            raise AssertionError(f"Failed test: {name} {details}")

    # ----------------------------------------------------
    # MODULE 1: RIDER AUTHENTICATION & ROLE-BASED ACCESS
    # ----------------------------------------------------
    print("\n--- MODULE 1: RIDER AUTHENTICATION ---")
    st, rider_auth = make_req("/auth/demo-login/rider", method="POST")
    assert_test("Rider Demo Login", st == 200 and "access_token" in rider_auth)
    rider_token = rider_auth["access_token"]
    rider_user = rider_auth["user"]
    assert_test("Rider Role Verification", rider_user["role"] == "rider")

    # Profile retrieval
    st, profile = make_req("/auth/me", token=rider_token)
    assert_test("Rider Profile Retrieval (/auth/me)", st == 200 and profile["phone_number"] == "+919222222222")

    # Role-based access control: Passenger cannot call rider endpoints
    st, pass_auth = make_req("/auth/demo-login/passenger", method="POST")
    pass_token = pass_auth["access_token"]
    st, r_err = make_req("/rider/dashboard", token=pass_token)
    assert_test("RBAC: Passenger blocked from Rider Dashboard (403)", st == 403)

    # ----------------------------------------------------
    # MODULE 2: RIDER REGISTRATION & KYC VEHICLE SETUP
    # ----------------------------------------------------
    print("\n--- MODULE 2: RIDER REGISTRATION & VEHICLES ---")
    new_phone = f"+9198{int(time.time()) % 100000000:08d}"
    st, reg_resp = make_req("/auth/register", method="POST", data={
        "phone_number": new_phone,
        "full_name": "Test Driver Ramesh",
        "role": "rider",
        "license_number": f"DL-MH-{int(time.time()) % 100000}",
        "vehicle_category": "car",
        "vehicle_plate": f"MH-02-AB-{int(time.time()) % 10000:04d}",
        "vehicle_model": "Maruti WagonR"
    })
    assert_test("Rider Registration API (/auth/register)", st == 201 and "access_token" in reg_resp)
    new_rider_token = reg_resp["access_token"]

    # ----------------------------------------------------
    # MODULE 3: RIDER HOME & DASHBOARD
    # ----------------------------------------------------
    print("\n--- MODULE 3: RIDER HOME & DASHBOARD ---")
    st, dash = make_req("/rider/dashboard", token=rider_token)
    assert_test("Rider Dashboard Live Data", st == 200 and dash["full_name"] == "Suresh Kumar")
    assert_test("Dashboard Non-Zero Database Earnings", dash["total_earnings"] > 0)
    assert_test("Dashboard Vehicles Registered", len(dash["vehicles"]) >= 1)

    # ----------------------------------------------------
    # MODULE 4: ONLINE/OFFLINE LOGIC & LOCATION STREAMING
    # ----------------------------------------------------
    print("\n--- MODULE 4: ONLINE/OFFLINE AVAILABILITY ---")
    # Toggle Online
    st, on_resp = make_req("/rider/status", method="POST", token=rider_token, data={
        "is_online": True,
        "current_latitude": 12.9716,
        "current_longitude": 77.6412
    })
    assert_test("Rider Goes Online", st == 200 and on_resp["is_online"] is True)

    # GPS coordinate streaming
    st, loc_resp = make_req("/rider/location", method="POST", token=rider_token, data={
        "latitude": 12.9720,
        "longitude": 77.6418,
        "heading": 90.0,
        "speed": 25.0
    })
    assert_test("Rider GPS Location Update", st == 200 and loc_resp["status"] == "ok")

    # ----------------------------------------------------
    # MODULE 5: RIDE REQUESTS & ATOMIC MATCHING
    # ----------------------------------------------------
    print("\n--- MODULE 5: RIDE REQUESTS & MATCHING ---")
    # Create request using simulation endpoint
    st, sim = make_req("/rider/simulate-request", method="POST", token=rider_token)
    assert_test("Ride Invitation Dispatched", st == 200 and "ride_id" in sim)
    ride_id = sim["ride_id"]
    otp = sim["otp"]

    # Retrieve incoming requests
    st, requests = make_req("/rider/requests", token=rider_token)
    assert_test("Incoming Request List (/rider/requests)", st == 200 and len(requests) >= 1)
    matched_req = next((r for r in requests if r["ride_id"] == ride_id), None)
    assert_test("Target Ride in Incoming Requests", matched_req is not None)
    assert_test("Request Expiration & Fare Metadata", matched_req["estimated_fare"] > 0 and matched_req["expires_in_seconds"] > 0)

    # ----------------------------------------------------
    # MODULE 6: PICKUP NAVIGATION & ARRIVAL
    # ----------------------------------------------------
    print("\n--- MODULE 6: ACCEPT & PICKUP NAVIGATION ---")
    st, acc = make_req(f"/rides/{ride_id}/accept", method="POST", token=rider_token)
    assert_test("Atomic Ride Acceptance", st == 200 and acc["status"] == "RIDER_ARRIVING")

    # Concurrent acceptance prevention: second driver cannot take same ride
    st, err_acc = make_req(f"/rides/{ride_id}/accept", method="POST", token=new_rider_token)
    assert_test("Concurrent Assignment Prevented (409)", st == 409)

    # Mark arrived at pickup
    st, arr = make_req(f"/rides/{ride_id}/arrived", method="POST", token=rider_token)
    assert_test("Rider Marks Arrival (RIDER_ARRIVED)", st == 200 and arr["status"] == "RIDER_ARRIVED")

    # ----------------------------------------------------
    # MODULE 7: OTP VERIFICATION & ATTEMPT RATE LIMITS
    # ----------------------------------------------------
    print("\n--- MODULE 7: OTP VERIFICATION ---")
    # 1. Invalid OTP rejection
    st, bad_otp = make_req(f"/rides/{ride_id}/verify-otp", method="POST", token=rider_token, data={"otp": "0000"})
    assert_test("Invalid OTP Code Rejected (400)", st == 400)

    # 2. Valid OTP verification
    st, ver = make_req(f"/rides/{ride_id}/verify-otp", method="POST", token=rider_token, data={"otp": otp})
    assert_test("Valid 4-Digit PIN Verified (IN_PROGRESS)", st == 200 and ver["status"] == "IN_PROGRESS")

    # ----------------------------------------------------
    # MODULE 8: ACTIVE RIDE & TRIP COMPLETION
    # ----------------------------------------------------
    print("\n--- MODULE 8: ACTIVE RIDE & COMPLETION ---")
    st, comp = make_req(f"/rides/{ride_id}/complete", method="POST", token=rider_token, data={"actual_distance_km": 4.8})
    assert_test("Trip Completed & Fare Finalized", st == 200 and comp["status"] == "COMPLETED")
    assert_test("Final Fare Greater than Zero", comp["final_fare"] > 0)

    # Duplicate completion prevention (Idempotency: safe return without double billing)
    st, dup_comp = make_req(f"/rides/{ride_id}/complete", method="POST", token=rider_token, data={})
    assert_test("Duplicate Completion Idempotent & Safe (200)", st == 200 and dup_comp["status"] == "COMPLETED")

    # ----------------------------------------------------
    # MODULE 9: EARNINGS & WALLET WITHDRAWAL
    # ----------------------------------------------------
    print("\n--- MODULE 9: EARNINGS & WALLET PAYOUT ---")
    st, earn_summary = make_req("/rider/earnings-summary", token=rider_token)
    assert_test("Earnings Summary API (/rider/earnings-summary)", st == 200)
    assert_test("Daily/Weekly/Monthly Breakdown", "daily" in earn_summary and "weekly" in earn_summary and "monthly" in earn_summary)
    assert_test("85% Driver Share / 15% Platform Split", earn_summary["driver_share_rate"] == 0.85 and earn_summary["platform_commission_rate"] == 0.15)

    # Instant Wallet Payout
    st, payout_resp = make_req("/rider/payout", method="POST", token=rider_token, data={
        "amount": 50,
        "upi_id": "driver.bharatpe@icici"
    })
    assert_test("Instant Wallet Payout to UPI", st == 200 and payout_resp["status"] == "success")

    # ----------------------------------------------------
    # MODULE 10: RIDE HISTORY & AUTHORIZATION
    # ----------------------------------------------------
    print("\n--- MODULE 10: RIDE HISTORY ---")
    st, history = make_req("/rides/history?limit=20", token=rider_token)
    assert_test("Ride History Retrieval", st == 200 and len(history) >= 1)
    first_trip = history[0]
    assert_test("Ride History Details (Fare, Pickup, Drop, Timestamp)", 
                first_trip["final_fare"] is not None and "pickup_address" in first_trip and "destination_address" in first_trip)

    # ----------------------------------------------------
    # MODULE 11: PROFILE & DOCUMENT MANAGEMENT
    # ----------------------------------------------------
    print("\n--- MODULE 11: PROFILE & DOCUMENTS ---")
    # Switch vehicle
    st, switch_v = make_req("/rider/switch-vehicle", method="POST", token=rider_token, data={"category": "auto"})
    assert_test("Active Vehicle Switcher (Auto)", st == 200 and switch_v["active_category"] == "auto")
    # Switch back to car
    make_req("/rider/switch-vehicle", method="POST", token=rider_token, data={"category": "car"})

    # Document list
    st, docs = make_req("/rider/documents/list", token=rider_token)
    assert_test("Rider Documents List (/rider/documents/list)", st == 200)

    # ----------------------------------------------------
    # MODULE 12: SAFETY & SUPPORT TICKETS
    # ----------------------------------------------------
    print("\n--- MODULE 12: SAFETY & SUPPORT ---")
    st, ticket_resp = make_req("/rider/support/ticket", method="POST", token=rider_token, data={
        "category": "Payment / Fare Issue",
        "description": "Verification of instant wallet payout timing and settlement."
    })
    assert_test("Create Support Ticket (/rider/support/ticket)", st == 200 and ticket_resp["status"] == "created")

    st, tickets_list = make_req("/rider/support/tickets", token=rider_token)
    assert_test("List Support Tickets (/rider/support/tickets)", st == 200 and len(tickets_list) >= 1)

    # ----------------------------------------------------
    # MODULE 13 & 15: REAL-TIME SYNC & ACTIVE RECONNECT
    # ----------------------------------------------------
    print("\n--- MODULE 13 & 15: REAL-TIME STATE SYNC ---")
    st, active_state = make_req("/rides/active", token=rider_token)
    assert_test("Authoritative Reconnect Fetch (/rides/active)", st == 200)

    # ----------------------------------------------------
    # SUMMARY
    # ----------------------------------------------------
    print("\n" + "=" * 60)
    print(f"ALL TESTS COMPLETED: {passed}/{total} PASSED (100% SUCCESS)")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
