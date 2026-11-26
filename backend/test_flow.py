import urllib.request
import json

base_url = "http://localhost:8001/api"

# 1. Login as rider
req = urllib.request.Request(f"{base_url}/auth/demo-login/rider", data=b"", method="POST")
resp = json.loads(urllib.request.urlopen(req).read().decode())
tok = resp["access_token"]
print("Rider logged in successfully:", resp["user"]["full_name"])

# 2. Check dashboard
req_dash = urllib.request.Request(f"{base_url}/rider/dashboard", headers={"Authorization": f"Bearer {tok}"})
dash = json.loads(urllib.request.urlopen(req_dash).read().decode())
print(f"Initial Dashboard -> Total Earnings: {dash['total_earnings']}, Wallet: {dash['wallet_balance']}, Completed Trips: {dash['total_completed_trips']}")

# 3. Simulate request
req_sim = urllib.request.Request(f"{base_url}/rider/simulate-request", data=b"", method="POST", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
sim = json.loads(urllib.request.urlopen(req_sim).read().decode())
print("Simulated Request Created -> Ride ID:", sim["ride_id"], "OTP:", sim["otp"])

# 4. Check incoming requests
req_inc = urllib.request.Request(f"{base_url}/rider/requests", headers={"Authorization": f"Bearer {tok}"})
inc = json.loads(urllib.request.urlopen(req_inc).read().decode())
print("Incoming requests count:", len(inc))
assert len(inc) > 0, "No incoming request received!"
top = inc[0]
print(f"Top request details -> Fare: Rs {top['estimated_fare']}, Passenger: {top['passenger']['full_name']}, Distance: {top['trip_distance_km']} km")

import time
time.sleep(0.5)

# 5. Accept ride
ride_id = sim["ride_id"]
otp = sim["otp"]
req_acc = urllib.request.Request(f"{base_url}/rides/{ride_id}/accept", data=b"", method="POST", headers={"Authorization": f"Bearer {tok}"})
acc = json.loads(urllib.request.urlopen(req_acc).read().decode())
print("Ride Accepted -> Status:", acc["status"])
time.sleep(0.5)

# 6. Mark Arrived
req_arr = urllib.request.Request(f"{base_url}/rides/{ride_id}/arrived", data=b"", method="POST", headers={"Authorization": f"Bearer {tok}"})
arr = json.loads(urllib.request.urlopen(req_arr).read().decode())
print("Driver Arrived -> Status:", arr["status"])
time.sleep(0.5)

# 7. Verify OTP & start
req_otp = urllib.request.Request(f"{base_url}/rides/{ride_id}/verify-otp", data=json.dumps({"otp": otp}).encode(), method="POST", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
ver = json.loads(urllib.request.urlopen(req_otp).read().decode())
print("OTP Verified -> Trip Status:", ver["status"])

# 8. Complete Ride
req_comp = urllib.request.Request(f"{base_url}/rides/{ride_id}/complete", data=json.dumps({}).encode(), method="POST", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
comp = json.loads(urllib.request.urlopen(req_comp).read().decode())
print(f"Trip Completed -> Final Fare: Rs {comp['final_fare']}, Status: {comp['status']}")

# 9. Test Wallet Payout
req_payout = urllib.request.Request(f"{base_url}/rider/payout", data=json.dumps({"amount": 100, "upi_id": "driver.bharatpe@icici"}).encode(), method="POST", headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
payout = json.loads(urllib.request.urlopen(req_payout).read().decode())
print("Instant Wallet Payout ->", payout["message"].encode("ascii", "replace").decode())

# 10. Check updated dashboard
dash2 = json.loads(urllib.request.urlopen(req_dash).read().decode())
print(f"Updated Dashboard -> Total Earnings: {dash2['total_earnings']}, Wallet: {dash2['wallet_balance']}, Completed Trips: {dash2['total_completed_trips']}")

# 11. Check ride history
req_hist = urllib.request.Request(f"{base_url}/rides/history", headers={"Authorization": f"Bearer {tok}"})
hist = json.loads(urllib.request.urlopen(req_hist).read().decode())
print(f"History verified -> Total {len(hist)} trips logged for driver.")
