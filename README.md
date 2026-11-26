# Production Ride-Hailing Platform (Uber / Ola / Rapido Core Architecture)

A production-grade, multi-role ride-hailing platform built with **Python FastAPI**, **PostgreSQL / SQLite**, and a **React Native / Expo TypeScript** mobile application supporting **Passenger**, **Rider / Driver**, and **Administrator** roles.

---

## 🚀 Key Architectural Features

### 1. Fare Calculation Engine
- **Bike / Moto:** ₹7.0 / km base
- **Car / Cab:** ₹15.0 / km base
- **Auto Rickshaw:** ₹10.0 / km base
- **Configurable Pricing:** Rates, base fare, minimum fare, cancellation fee, and surge pricing are dynamically managed from the Administrator Panel.
- **Road Routing:** Uses road-network distances from OSRM / Google Directions rather than straight-line GPS.

### 2. Nearby Matching Engine (2 km $\rightarrow$ 3 km)
- **Stage 1 (Initial Search):** Dispatches ride requests to approved, online, idle drivers within a **2 km radius** of the passenger's pickup location.
- **Stage 2 (Expanded Search):** If no driver accepts within the initial window, the search radius automatically expands to **3 km**.
- **Atomic Acceptance Lock:** Database row-level locking ensures that only the first driver who accepts wins the booking; competing requests are cancelled immediately to prevent race conditions.

### 3. Safety & 4-Digit Pickup PIN
- When a ride is accepted, the server cryptographically generates a **4-digit pickup PIN** (`generate_pickup_otp()`).
- The OTP is stored in the database exclusively as an **HMAC-SHA256 hash** (`otp_hash`), never in plaintext.
- The plaintext PIN is revealed only to the passenger on their screen.
- When the driver arrives, the driver must input the passenger's 4-digit PIN; the backend verifies it in constant time before transitioning the ride state to `IN_PROGRESS`.

### 4. Real-time WebSockets & Live GPS Tracking
- Bidirectional WebSocket channel (`/api/ws?token=...`) with heartbeat and automatic reconnect.
- Real-time events:
  - `ride_incoming`: Driver receives incoming booking invitation with a 30s countdown.
  - `ride_accepted`: Passenger notified that driver has accepted, receiving driver name, vehicle plate, and model.
  - `driver_location_update`: Real-time GPS coordinates stream from driver to passenger map.
  - `rider_arrived`: Passenger notified that driver has reached the pickup point.
  - `trip_started`: State machine transitions to `IN_PROGRESS` after OTP verification.
  - `trip_completed`: Both parties receive finalized receipt with fare breakdown.

### 5. Multi-Role Authorization (RBAC)
- Role-based JWT access & refresh tokens supporting 3 distinct user roles:
  1. **Passenger:** Book rides, search Indian places, track drivers live, view 4-digit PIN, pay upon completion.
  2. **Rider / Driver:** Toggle online/offline, stream GPS location, accept incoming requests, verify 4-digit PIN, complete rides, track earnings.
  3. **Administrator:** System overview, approve/suspend drivers, configure per-km fare rates (₹7/km, ₹15/km), inspect audit logs.

---

## 📂 Project Architecture

```
d:/mobile/
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                    # API Endpoints
│   │   │   ├── auth.py             # Phone OTP & JWT authentication
│   │   │   ├── location.py         # India place search, reverse geocode, OSRM routing
│   │   │   ├── fare.py             # ₹7/km Bike, ₹15/km Car fare engine & rate updates
│   │   │   ├── rides.py            # Booking lifecycle & atomic acceptance
│   │   │   ├── rider.py            # Online/offline toggle, GPS stream, driver dashboard
│   │   │   ├── websocket.py        # Real-time WebSocket dispatch channel
│   │   │   └── admin.py            # Platform metrics, driver approvals, audit logs
│   │   ├── models/                 # SQLAlchemy 2.0 Database Models
│   │   ├── schemas/                # Pydantic v2 validation models
│   │   ├── services/               # Core business logic services
│   │   │   ├── auth_service.py     # Multi-role registration & OTP management
│   │   │   ├── location_service.py # Places autocomplete & OSRM road distance
│   │   │   ├── fare_service.py     # Breakdown calculations & rate management
│   │   │   ├── matching_service.py # 2km/3km spatial search & atomic locks
│   │   │   ├── ride_service.py     # Ride state machine & HMAC OTP verification
│   │   │   └── websocket_manager.py# Real-time WebSocket connection manager
│   │   ├── utils/
│   │   │   └── security.py         # Bcrypt, HMAC-SHA256, JWT encode/decode
│   │   ├── config.py               # Environment configuration
│   │   ├── database.py             # SQLAlchemy session & SQLite/PostgreSQL engine
│   │   └── main.py                 # FastAPI application & startup seeder
│   └── tests/                      # Automated Test Suite (11 passing tests)
│       ├── test_auth.py            # Auth, OTP, tokens
│       ├── test_location_and_fare.py # Autocomplete, routing, ₹7/km & ₹15/km rates
│       └── test_rides_and_matching.py # 2km matching, atomic lock, 4-digit OTP, admin
│
├── mobile-app/                     # React Native / Expo TypeScript App
│   ├── app/                        # Expo Router Navigation
│   │   ├── _layout.tsx             # Root layout with QueryClient & Auth
│   │   ├── index.tsx               # Role-based route guard
│   │   ├── (auth)/login.tsx        # Multi-role login with 1-click demo access
│   │   ├── (passenger)/index.tsx   # Clean booking screen, map preview, live driver tracking
│   │   ├── (rider)/index.tsx       # Driver online switch, GPS stream, OTP verification keypad
│   │   └── (admin)/index.tsx       # Admin metrics, driver approval, fare rate editor
│   ├── src/
│   │   ├── components/             # Reusable UI Components
│   │   │   ├── MapCanvas.tsx       # OpenStreetMap / Leaflet interactive map with markers
│   │   │   ├── LocationSearchModal.tsx # India autocomplete (3-5 chars) & GPS auto-detect
│   │   │   ├── VehicleSelector.tsx # Bike (₹7/km), Car (₹15/km), Auto cards & breakdown modal
│   │   │   ├── ActiveRideCard.tsx  # Driver details, phone call, 4-digit PIN display
│   │   │   └── MatchingRadar.tsx   # 2km -> 3km pulsing radar with search timer
│   │   ├── services/               # API & WebSocket client
│   │   ├── store/                  # Zustand state stores (authStore, rideStore)
│   │   └── types/                  # TypeScript interface definitions
│   ├── package.json                # Expo SDK 52 dependencies
│   └── tsconfig.json               # Strict TypeScript configuration
│
├── start_backend.bat               # 1-Click script to start FastAPI backend (Port 8000)
├── start_mobile.bat                # 1-Click script to start Expo app in Web browser (Port 8081)
└── run_tests.bat                   # Runs all 11 pytest backend tests + TypeScript compile
```

---

## ⚡ How to Run the Platform

### Option 1: Using Batch Scripts
1. **Start Backend Server:**
   Double click `start_backend.bat` or run:
   ```cmd
   d:\mobile\start_backend.bat
   ```
   Backend will start at: [http://localhost:8001](http://localhost:8001)
   API Documentation (Swagger): [http://localhost:8001/docs](http://localhost:8001/docs)

2. **Start Mobile App:**
   Double click `start_mobile.bat` or run:
   ```cmd
   d:\mobile\start_mobile.bat
   ```
   Mobile web simulator will open at: [http://localhost:8081](http://localhost:8081)

3. **Run All Tests:**
   Double click `run_tests.bat` to run all 20 backend integration tests and verify TypeScript compilation.

---

## 🧪 Production Role Workflows

On the login/signup screen ([http://localhost:8081](http://localhost:8081)):
1. **🟢 Passenger Mode:**
   - Sign up or log in using mobile number and SMS OTP.
   - Tap "Use Current GPS Location" or search landmarks (e.g. `Indiranagar`, `Koramangala`, `Connaught Place`).
   - Select destination.
   - Choose vehicle: **Bike (₹7/km)** or **Car (₹15/km)**.
   - Tap "Book Now" $\rightarrow$ Watch the 2 km Matching Radar search for drivers!
   - Note the **4-Digit PIN** displayed in the safety box.
2. **🔵 Driver / Rider Mode:**
   - Register as driver partner with vehicle model, plate, and KYC documents.
   - Toggle switch to **ONLINE**.
   - An incoming ride request modal will pop up with distance and fare.
   - Tap **"ACCEPT RIDE"**.
   - Tap **"I Have Arrived at Pickup"**.
   - Enter passenger's 4-digit PIN $\rightarrow$ Tap **"Verify & Start"**.
   - Trip enters `IN_PROGRESS` with live GPS navigation.
   - Tap **"Complete Ride"** $\rightarrow$ Earnings added to driver dashboard.
3. **🟣 Admin Mode:**
   - Log in with designated Authorized Administrator credentials.
   - View gross platform booking volume, driver earnings, and commission breakdown.
   - Adjust Bike (₹7/km) and Car (₹15/km) rates and save updated rates in real-time.
   - Review registered driver KYC documents (Driver Photo, Driving License, PAN, Aadhaar) and manage approval status (**Approve** / **Suspend** / **Reject**).
