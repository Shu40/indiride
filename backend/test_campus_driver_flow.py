import requests
import sys
import time
import random

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8001/api"

def test_full_campus_and_permanent_flow():
    print("--- 1. Testing Campus Driver Registration (Instant Auto-Approval) ---")
    suffix = f"{int(time.time()) % 100000}{random.randint(100, 999)}"
    phone = f"+9198{suffix[:8]}"
    
    # Send OTP
    r_otp = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone_number": phone})
    print("Send OTP:", r_otp.status_code, r_otp.json())
    assert r_otp.status_code == 200

    # Verify OTP
    r_ver = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone_number": phone, "otp": "123456"})
    print("Verify OTP:", r_ver.status_code)
    assert r_ver.status_code == 200
    token = r_ver.json().get("tokens", {}).get("access_token") or r_ver.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    # Complete Campus Registration
    campus_payload = {
        "full_name": f"Arjun Sharma ({suffix})",
        "phone_number": phone,
        "email": f"arjun.{suffix}@paruluniversity.ac.in",
        "role": "rider",
        "rider_service_type": "CAMPUS",
        "college_name": "Parul University, Vadodara",
        "served_universities": "Parul University, Vadodara",
        "academic_year": "Final Year B.Tech (2024-25)",
        "student_id_number": f"PU-2022-CSE-{suffix}",
        "student_id_photo": "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
        "aadhaar_number": f"5555 {suffix[:4]} {suffix[4:]}11",
        "aadhaar_photo": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
        "vehicle_category": "bike",
        "vehicle_plate": f"GJ-06-PU-{suffix[:4]}",
        "vehicle_model": "Hero Splendor Plus",
        "license_number": f"CAMPUS-ID-{suffix}",
    }
    
    r_reg = requests.post(f"{BASE_URL}/auth/register", json=campus_payload, headers=headers)
    print("Campus Driver Registration Response:", r_reg.status_code)
    assert r_reg.status_code in (200, 201), r_reg.text
    campus_data = r_reg.json()
    campus_user = campus_data["user"]
    driver_token = campus_data["access_token"]
    
    print(f"Rider Name: {campus_user['full_name']}")
    print(f"Rider Role: {campus_user['role']}")
    print(f"Rider Status (Must be APPROVED): {campus_user['rider_profile']['status']}")
    print(f"Rider Service Type: {campus_user['rider_profile']['rider_service_type']}")
    print(f"College Name: {campus_user['rider_profile']['college_name']}")
    print(f"Academic Year: {campus_user['rider_profile']['academic_year']}")
    
    assert campus_user['rider_profile']['status'].lower() == "approved", "Campus driver must be auto-approved without admin wait!"
    assert campus_user['rider_profile']['is_online'] == True, "Campus driver must be online immediately!"
    print("✅ Campus Driver Auto-Approved Successfully!")

    print("\n--- 2. Testing Campus Driver Posting a Ride ---")
    post_payload = {
        "pickup_address": "Waghodia Road / Alkapuri",
        "destination_address": "Parul University Main Gate, Limda",
        "departure_time": "08:30 AM",
        "total_seats": 2,
        "price_per_seat": 40.0,
        "vehicle_type": "bike",
        "vehicle_info": "Hero Splendor Plus (GJ-06-PU-7771)",
        "notes": "Parul students ride together, daily college commute",
        "travel_date": "Today",
        "allowed_gender": "ALL",
        "is_daily": True,
        "is_weekdays": False,
        "schedule_type": "ALL_DAYS",
        "university_name": "Parul University",
    }
    r_post = requests.post(f"{BASE_URL}/campus-rides", json=post_payload, headers={"Authorization": f"Bearer {driver_token}"})
    print("Post Campus Ride Response:", r_post.status_code)
    assert r_post.status_code in (200, 201), r_post.text
    posted_ride = r_post.json()
    print("Posted Ride ID:", posted_ride.get("id"))
    print("✅ Campus Ride Posted Successfully!")

    print("\n--- 3. Testing Passenger Search & Watched University Alert ---")
    r_search = requests.get(f"{BASE_URL}/campus-rides", params={"university_query": "Parul University"})
    print("Passenger Search Status:", r_search.status_code)
    assert r_search.status_code == 200
    rides_found = r_search.json()
    print(f"Rides found for Parul University: {len(rides_found)}")
    matching = [r for r in rides_found if "Parul" in r.get("destination_address", "") or "Parul" in r.get("university_name", "")]
    assert len(matching) > 0, "Passenger must see the posted campus ride!"
    print(f"✅ Matching live ride alert detected: {matching[0]['creator_name']} -> {matching[0]['destination_address']} (₹{matching[0]['price_per_seat']})")

    print("\n--- 4. Testing Admin /admin/campus-drivers Endpoint ---")
    admin_login = requests.post(f"{BASE_URL}/auth/demo-login/admin")
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    
    r_admin_campus = requests.get(f"{BASE_URL}/admin/campus-drivers", headers={"Authorization": f"Bearer {admin_token}"})
    print("Admin Campus Drivers Status:", r_admin_campus.status_code)
    assert r_admin_campus.status_code == 200
    all_campus_drivers = r_admin_campus.json()
    print(f"Total Campus Drivers in Admin Panel: {len(all_campus_drivers)}")
    found_driver = next((d for d in all_campus_drivers if d.get("phone_number") == phone), None)
    assert found_driver is not None, "Newly registered campus driver must appear in Admin campus-drivers list!"
    print(f"Admin Found Driver: {found_driver['full_name']} | College: {found_driver.get('college_name')} | Student ID: {found_driver.get('student_id_number')} | Aadhaar: {found_driver.get('aadhaar_number')}")
    print("✅ Admin Campus Inspection Endpoint Working Perfectly!")

    perm_suffix = f"{int(time.time()) % 100000}{random.randint(100, 999)}"
    perm_phone = f"+9197{perm_suffix[:8]}"
    requests.post(f"{BASE_URL}/auth/send-otp", json={"phone_number": perm_phone})
    r_ver2 = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone_number": perm_phone, "otp": "123456"})

    perm_payload = {
        "full_name": f"Ramesh Yadav ({perm_suffix})",
        "phone_number": perm_phone,
        "email": f"ramesh.{perm_suffix}@taxi.com",
        "role": "rider",
        "rider_service_type": "REGULAR",
        "license_number": f"DL-04-2024-{perm_suffix}",
        "aadhaar_number": f"8888 {perm_suffix[:4]} {perm_suffix[4:]}22",
        "vehicle_category": "car",
        "vehicle_plate": f"DL-01-AB-{perm_suffix[:4]}",
        "vehicle_model": "Maruti Dzire Tour",
        "permanent_address": "House 10, Sector 15, Rohini, New Delhi",
        "current_address": "Room 5, Karol Bagh, New Delhi",
    }
    token2 = r_ver2.json().get("tokens", {}).get("access_token") or r_ver2.json().get("access_token")
    headers2 = {"Authorization": f"Bearer {token2}"} if token2 else {}
    r_reg_perm = requests.post(f"{BASE_URL}/auth/register", json=perm_payload, headers=headers2)
    print("Permanent Driver Registration Response:", r_reg_perm.status_code)
    assert r_reg_perm.status_code in (200, 201), r_reg_perm.text
    perm_user = r_reg_perm.json()["user"]
    print(f"Permanent Rider Status (Must be PENDING): {perm_user['rider_profile']['status']}")
    assert perm_user['rider_profile']['status'].lower() == "pending", "Permanent driver must require admin approval!"
    assert perm_user['rider_profile']['is_online'] == False, "Permanent driver cannot be online until approved!"
    print("✅ Permanent Driver Janch Requirement Enforced Successfully!")

    print("\n==========================================")
    print("🎉 ALL CAMPUS & PERMANENT DRIVER TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_full_campus_and_permanent_flow()
