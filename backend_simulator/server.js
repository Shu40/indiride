const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

// Ensure data folder and persistent JSON files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(filePath, defaultData = []) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content || '[]');
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultData;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error saving ${filePath}:`, e.message);
  }
}

// In-Memory state loaded from real persistent disk files
let activeTrips = loadJSON(TRIPS_FILE, []);
let bookings = loadJSON(BOOKINGS_FILE, []);
const globalGeocodeCache = new Map();

// Real-Time Server-Sent Events (SSE) subscribers
const sseClients = new Set();

function broadcastEvent(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Earth Radius for Spatial Geofence Matching (Haversine Formula)
const EARTH_RADIUS_KM = 6371.0;
function toRadians(deg) {
  return deg * (Math.PI / 180.0);
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Real-Time SSE Stream for Instant Map Sync
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. Real Geocoding Search Proxy (Nominatim OpenStreetMap with In-Memory Cache)
  if (req.method === 'GET' && pathname === '/api/geocode') {
    const query = (parsedUrl.query.q || '').trim();
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing q query parameter' }));
      return;
    }

    if (globalGeocodeCache.has(query.toLowerCase())) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(globalGeocodeCache.get(query.toLowerCase()));
      return;
    }

    // Restrict strictly to India region (countrycodes=in)
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=8&q=${encodeURIComponent(query)}`;
    
    https.get(
      nominatimUrl,
      { headers: { 'User-Agent': 'HighTripRideApp/2.0 (contact: support@hightrip.app)' } },
      (nominatimRes) => {
        let body = '';
        nominatimRes.on('data', (chunk) => (body += chunk));
        nominatimRes.on('end', () => {
          globalGeocodeCache.set(query.toLowerCase(), body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(body);
        });
      }
    ).on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Geocoding failed', details: err.message }));
    });
    return;
  }

  // 2b. Reverse Geocoding Proxy (Lat, Lon to Indian Address)
  if (req.method === 'GET' && pathname === '/api/reverse') {
    const lat = parsedUrl.query.lat;
    const lon = parsedUrl.query.lon;
    if (!lat || !lon) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing lat or lon parameter' }));
      return;
    }

    const cacheKey = `rev_${lat}_${lon}`;
    if (globalGeocodeCache.has(cacheKey)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(globalGeocodeCache.get(cacheKey));
      return;
    }

    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`;
    https.get(
      reverseUrl,
      { headers: { 'User-Agent': 'HighTripRideApp/2.0 (contact: support@hightrip.app)' } },
      (revRes) => {
        let body = '';
        revRes.on('data', (chunk) => (body += chunk));
        revRes.on('end', () => {
          globalGeocodeCache.set(cacheKey, body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(body);
        });
      }
    ).on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Reverse geocoding failed', details: err.message }));
    });
    return;
  }

  // 3. GET /api/trips (All active real trips)
  if (req.method === 'GET' && pathname === '/api/trips') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: activeTrips.length, trips: activeTrips }));
    return;
  }

  // 4. GET /api/trips/nearby (Real 2KM Geofenced Filter)
  if (req.method === 'GET' && pathname === '/api/trips/nearby') {
    const userLat = parseFloat(parsedUrl.query.lat);
    const userLon = parseFloat(parsedUrl.query.lon);
    const radiusKm = parseFloat(parsedUrl.query.radiusKm) || 2.0;

    if (isNaN(userLat) || isNaN(userLon)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid user lat and lon required' }));
      return;
    }

    const matched = activeTrips
      .filter((t) => t.status === 'OPEN' && t.availableSeats > 0)
      .map((trip) => {
        const distance = calculateDistanceKm(
          userLat,
          userLon,
          trip.origin.latitude,
          trip.origin.longitude
        );
        return {
          ...trip,
          distanceFromUserKm: Math.round(distance * 100) / 100,
          isWithinRadius: distance <= radiusKm,
        };
      })
      .filter((trip) => trip.distanceFromUserKm <= radiusKm)
      .sort((a, b) => a.distanceFromUserKm - b.distanceFromUserKm);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        userLocation: { latitude: userLat, longitude: userLon },
        radiusKm: radiusKm,
        totalMatched: matched.length,
        trips: matched,
      })
    );
    return;
  }

  // 5. POST /api/trips (Rider / Normal user posts real ride with their own price)
  if (req.method === 'POST' && pathname === '/api/trips') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.origin || !data.destination || !data.origin.latitude || !data.destination.latitude) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Origin and Destination coordinates required' }));
          return;
        }

        const totalSeats = parseInt(data.totalSeats) || (data.vehicleType === 'bike' ? 1 : 3);
        const farePerSeat = parseFloat(data.farePerSeat);

        if (isNaN(farePerSeat) || farePerSeat <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Rider must set a valid price per seat (e.g. ₹50)' }));
          return;
        }

        const newTrip = {
          id: 'trip_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
          creatorName: (data.creatorName || 'Rider').trim(),
          creatorPhone: (data.creatorPhone || '').trim(),
          creatorRole: data.creatorRole || (data.vehicleType === 'bike' ? 'Bike Rider' : 'Car Host'),
          vehicleType: data.vehicleType || 'bike', // 'bike' or 'car'
          vehicleName: data.vehicleName || (data.vehicleType === 'bike' ? 'Motorbike' : 'Car'),
          vehicleNumber: (data.vehicleNumber || '').toUpperCase().trim(),
          origin: {
            title: data.origin.title || 'Pickup Location',
            fullAddress: data.origin.fullAddress || data.origin.title,
            latitude: parseFloat(data.origin.latitude),
            longitude: parseFloat(data.origin.longitude),
          },
          destination: {
            title: data.destination.title || 'Drop Location',
            fullAddress: data.destination.fullAddress || data.destination.title,
            latitude: parseFloat(data.destination.latitude),
            longitude: parseFloat(data.destination.longitude),
          },
          scheduledTime: data.scheduledTime || 'Leaving Soon',
          totalSeats: totalSeats,
          availableSeats: totalSeats,
          farePerSeat: farePerSeat, // User-defined price
          notes: data.notes || '',
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        };

        activeTrips.unshift(newTrip);
        saveJSON(TRIPS_FILE, activeTrips);

        // Broadcast to all connected clients in real-time
        broadcastEvent('new_trip', newTrip);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, trip: newTrip }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload', details: err.message }));
      }
    });
    return;
  }

  // 6. POST /api/trips/:id/book (Passenger books real seat)
  if (req.method === 'POST' && pathname.startsWith('/api/trips/') && pathname.endsWith('/book')) {
    const tripId = pathname.split('/')[3];
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const seatsToBook = parseInt(data.seats) || 1;
        const trip = activeTrips.find((t) => t.id === tripId);

        if (!trip) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Trip not found' }));
          return;
        }

        if (trip.availableSeats < seatsToBook) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Only ${trip.availableSeats} seat(s) remaining.` }));
          return;
        }

        trip.availableSeats -= seatsToBook;
        if (trip.availableSeats === 0) trip.status = 'FULL';
        saveJSON(TRIPS_FILE, activeTrips);

        // 4-Digit OTP verification
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const booking = {
          id: 'bk_' + Date.now().toString(36),
          tripId: trip.id,
          passengerName: (data.passengerName || 'Passenger').trim(),
          passengerPhone: (data.passengerPhone || '').trim(),
          seatsBooked: seatsToBook,
          totalFare: trip.farePerSeat * seatsToBook,
          otpCode: otpCode,
          status: 'CONFIRMED',
          bookedAt: new Date().toISOString(),
          tripDetails: {
            creatorName: trip.creatorName,
            creatorPhone: trip.creatorPhone,
            vehicleName: trip.vehicleName,
            vehicleNumber: trip.vehicleNumber,
            origin: trip.origin,
            destination: trip.destination,
            farePerSeat: trip.farePerSeat,
          },
        };

        bookings.unshift(booking);
        saveJSON(BOOKINGS_FILE, bookings);

        // Broadcast seat update to all screens
        broadcastEvent('trip_booked', { tripId: trip.id, availableSeats: trip.availableSeats, status: trip.status });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, booking: booking }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Booking failed', details: err.message }));
      }
    });
    return;
  }

  // 7. GET /api/bookings (View real bookings)
  if (req.method === 'GET' && pathname === '/api/bookings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: bookings.length, bookings: bookings }));
    return;
  }

  // 8. DELETE /api/trips/:id (Cancel / Delete trip)
  if (req.method === 'DELETE' && pathname.startsWith('/api/trips/')) {
    const tripId = pathname.split('/')[3];
    const index = activeTrips.findIndex((t) => t.id === tripId);
    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Trip not found' }));
      return;
    }

    activeTrips.splice(index, 1);
    saveJSON(TRIPS_FILE, activeTrips);
    broadcastEvent('trip_deleted', { tripId });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Trip deleted' }));
    return;
  }

  // 9. Static File Server (public/ folder)
  const publicDir = path.join(__dirname, 'public');
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Real-Data HighTrip Server active on http://localhost:${PORT}`);
  console.log(`💾 Persistent Storage enabled at ${DATA_DIR}`);
});
