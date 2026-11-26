# 🚀 INI RIDE - Production Deployment & Real System Setup Guide
**Platform Name:** INI RIDE (`ini ride`)  
**Founder & CEO:** **Shubham Kumar**  
**Headquarters / Roots:** **Bihar, India**  
**Tagline:** *Bihar's Smart & Affordable Ride-Hailing Network* (Bike ₹7/km • Auto ₹10/km • Car ₹15/km)

---

## 📋 Table of Contents
1. [Aaj Web Version Deploy Kaise Karein (Step-by-Step Today)](#1-aaj-web-version-deploy-kaise-karein)
2. [Real Database Setup (PostgreSQL, Redis, MongoDB)](#2-real-database-setup)
3. [Real Mobile SMS OTP Gateway (Indian Numbers)](#3-real-mobile-sms-otp-gateway)
4. [Google Sign-In Direct + Compulsory Phone Verification](#4-google-sign-in--compulsory-phone-verification)
5. [SEO & Founder Shubham Kumar (Bihar) Configuration](#5-seo--founder-shubham-kumar-bihar-configuration)
6. [Kal Android APK & Play Store Deploy Kaise Karein (Tomorrow's Plan)](#6-kal-android-apk--play-store-deploy-kaise-karein)

---

## 1. 🌐 Aaj Web Version Deploy Kaise Karein

Aapka frontend aur backend dono deploy hone ke liye 100% tayyar hain:

### Frontend (Expo Web) -> Vercel / Netlify par Deploy:
Aapka web build test ho chuka hai aur `dist/` folder ready ho chuka hai.

#### Option A: Vercel (Sabse Aasan - 2 Minute)
1. [vercel.com](https://vercel.com) par free account banayein ya login karein.
2. Terminal me `mobile-app` directory me jayein:
   ```bash
   cd mobile-main/mobile-app
   npx vercel
   ```
   (Ya GitHub par repository push karke Vercel Dashboard se import karein).
3. **Build Command:** `npx expo export -p web`
4. **Output Directory:** `dist`
5. **Environment Variable add karein:**
   - `EXPO_PUBLIC_API_URL` = `https://your-backend-service.onrender.com/api`
   - `EXPO_PUBLIC_WS_URL` = `wss://your-backend-service.onrender.com/api/ws`
6. Click **Deploy**! Aapki website `https://iniride.vercel.app` (ya aapka custom domain) live ho jayegi.

#### Option B: Netlify
- `mobile-app/dist` folder ko direct Netlify Drop par drag & drop karein, ya GitHub se connect karein. Humne `_redirects` aur `manifest.json` pehle se `dist` me inject kar diya hai.

---

### Backend (Python FastAPI) -> Render / Railway par Deploy:
Humne `Procfile` aur `Dockerfile` dono backend folder me bana diye hain.

#### Render.com (Free Tier):
1. [render.com](https://render.com) par jayein -> **New +** -> **Web Service**.
2. GitHub repo connect karein aur root directory `mobile-main/backend` select karein.
3. **Environment:** `Python 3`
4. **Build Command:** `pip install -r requirements.txt`
5. **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 4`
6. **Environment Variables:**
   - `ENVIRONMENT` = `production`
   - `DEBUG` = `false`
   - `DATABASE_URL` = (Supabase / Neon PostgreSQL URL)
   - `REDIS_URL` = (Upstash Redis URL)
   - `SMS_PROVIDER` = `cascade` (ya `2factor` / `fast2sms`)
   - `TWOFACTOR_API_KEY` = (Aapki 2Factor.in key)
7. Click **Create Web Service**. Aapka backend `https://api.iniride.com` live ho jayega!

---

## 2. 🗄️ Real Database Setup (Kaun sa lagega aur kaise lagega?)

Real production ride-hailing ke liye 3 databases use hote hain:

| Database | Kaam (Purpose) | Best Free Cloud Provider |
| :--- | :--- | :--- |
| **Relational DB** | Users, Rides, Bookings, Payments, Drivers | **Supabase** (PostgreSQL 15) ya **Neon DB** |
| **In-Memory Cache** | GPS Driver Radar (2km/3km), Atomic Locks, OTP | **Upstash Redis** (10,000 commands/day free) |
| **Telemetry / Logs** | Live Breadcrumbs, GPS History, Audit Logs | **MongoDB Atlas** (M0 512MB free) |

### Step 1: PostgreSQL Setup (Supabase - Recommended):
1. [supabase.com](https://supabase.com) par jayein aur **New Project** create karein.
2. Project Name: `ini-ride-db`, Database Password set karein.
3. **Project Settings -> Database -> Connection string (URI)** copy karein:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```
4. Is string ko backend `.env` me `DATABASE_URL` me paste karein.
5. FastAPI start hote hi sare tables (`users`, `ride_bookings`, `rider_profiles`, `vehicles`, `fare_configurations`) automatically create kar dega!

### Step 2: Redis Setup (Upstash):
1. [upstash.com](https://upstash.com) par free account banayein.
2. Create Database -> Name: `iniride-redis` -> Region: Mumbai/Singapore.
3. Connect tab se `rediss://...` URL copy karke `REDIS_URL` me dalein.

*(Note: Agar abhi Redis account nahi banana chahein, toh backend me resilient in-memory fallback laga hai, app bina ruke chalega).*

---

## 3. 📱 Real Mobile SMS OTP Gateway (Real OTP Kaise Jayega?)

Jab user login karega, uske phone par sach me 6-digit OTP SMS jayega. Backend me **Universal SMS Service** configured hai:

### Option 1: 2Factor.in (Sabse Fast & Recommended for Testing in India)
- **Kyu best hai?** Isme testing ke liye turant DLT registration ki zaroorat nahi padti.
- [2factor.in](https://2factor.in) par account banayein -> Free 250 credits milte hain.
- API Key copy karke `.env` me dalein:
  ```env
  SMS_PROVIDER="2factor"
  TWOFACTOR_API_KEY="your_api_key_here"
  ```

### Option 2: Fast2SMS (Direct Indian OTP Route)
- [fast2sms.com](https://fast2sms.com) par sign up karein -> Quick OTP route.
- API Key copy karein:
  ```env
  SMS_PROVIDER="fast2sms"
  FAST2SMS_API_KEY="your_fast2sms_key"
  ```

### Option 3: Cascade Mode
- `.env` me `SMS_PROVIDER="cascade"` rakhein. Agar 2Factor fail hua toh Fast2SMS try karega, agar wo fail hua toh Twilio try karega!
- Production me `ENVIRONMENT="production"` set karne par demo OTP `123456` band ho jata hai aur sirf real phone SMS OTP hi accept hota hai.

---

## 4. 🔑 Google Sign-In Direct + Compulsory Phone Verification

Aapka rule: **"Google se direct login ho, lekin Google ke baad Mobile number compulsory verify hona chahiye!"**

### Flow Kaise Kaam Karta Hai:
1. User login screen par **Google** button par click karta hai.
2. User apna Google email aur name provide karta hai.
3. Backend check karta hai:
   - Kya is Google email ke sath verified Indian phone number linked hai?
   - **Agar Ha:** Direct session token milta hai aur passenger dashboard khul jata hai.
   - **Agar Naya User hai / Phone link nahi hai:** Backend `phone_required: true` bhejta hai.
4. Screen turant **Mandatory Phone Verification** par switch hoti hai:
   - Google account verified badge dikhta hai (`user@gmail.com` ✅).
   - User ko apna 10-digit Indian Mobile Number (`+91`) dalna padta hai.
   - **Send Real SMS OTP** click karne par phone par real OTP jata hai.
   - 6-digit OTP enter karke verify karte hi phone Google account ke sath permanently link ho jata hai aur login ho jata hai!
5. Agli baar user jab bhi Google se login karega, usse dubara phone OTP nahi mangega kyunki uska number verified hai!

---

## 5. 🔍 SEO & Founder Shubham Kumar (Bihar) Configuration

Humne pure web app me SEO aur Founder Shubham Kumar ki identity inject kar di hai:

1. **`public/robots.txt`**:
   Search engines (Google, Bing) ko allow karta hai aur sitemap link karta hai.
2. **`public/sitemap.xml`**:
   Sabhi core routes (`/`, `/passenger`, `/rider`, `/about-founder`, `/android-app`) indexed hain.
3. **`public/manifest.json`**:
   PWA support - Phone me Chrome se "Add to Home Screen" karne par app ki tarah install hota hai.
4. **Structured Schema.org (JSON-LD)**:
   Google search ke liye rich snippet:
   - **Organization:** INI RIDE
   - **Founder:** Shubham Kumar (Born & Based in Bihar, India)
   - **Service:** Bike Taxi (₹7/km), Auto (₹10/km), Car Cab (₹15/km).
5. **In-App Founder Modal (`FounderStoryModal.tsx`)**:
   Login screen aur Passenger home dono par **"🇮🇳 Founder: Shubham Kumar (Bihar) • View Story"** badge hai, jisse kholne par puri company aur founder ki story dikhti hai.

---

## 6. 📱 Kal Android APK & Play Store Deploy Kaise Karein

Aapne kaha: **"display coming soon on android apk on playstore... mobile wala kal"**

### Humne Aaj App me kya add kar diya hai:
1. **Top Play Store Badge:**
   *"📱 Android APK Launching Tomorrow on Google Play Store! (Web Live Today)"*
2. **Play Store Modal (`PlayStoreComingSoonModal.tsx`):**
   User click karta hai toh roadmap dikhta hai:
   - Today: Production Web App Live (Full booking & live GPS tracking)
   - Tomorrow: Standalone APK download release
   - Next: Google Play Store official review & listing
   - Guide: How to install as app right now using Chrome "Add to Home Screen".

### Kal APK Generate Karne ke Steps:
1. Terminal me EAS CLI install karein:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. `mobile-app` directory me project configure karein:
   ```bash
   cd mobile-main/mobile-app
   eas build:configure
   ```
3. **Direct Testing APK ke liye (Kal subah):**
   ```bash
   eas build -p android --profile preview
   ```
   Ye Expo cloud par build banayega aur aapko direct `.apk` file ka download link de dega jisko aap kisi bhi Android phone me install kar sakte hain!
4. **Google Play Store `.aab` (Bundle) ke liye:**
   ```bash
   eas build -p android --profile production
   ```
   Ye `.aab` file dega jise aap Google Play Console par upload kar sakte hain!

---

## 🏁 Summary Checklist for Today's Deployment:
- [x] Web build tested successfully (`dist/` generated with zero errors).
- [x] SEO files added (`robots.txt`, `sitemap.xml`, `manifest.json`, dynamic Schema.org tags).
- [x] Founder Shubham Kumar (Bihar, India) story and modal integrated.
- [x] "Android APK Coming Soon on Google Play Store" badge & modal live.
- [x] Google Login + Compulsory Mobile SMS OTP linking implemented on frontend & backend.
- [x] Vercel config (`vercel.json`) and Netlify (`_redirects`) created.
- [x] Backend `Procfile`, `Dockerfile`, and `.env.production.example` created.
