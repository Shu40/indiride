import '../core/utils/geo_calculator.dart';
import '../models/high_trip.dart';
import '../models/location_point.dart';

class GeofenceService {
  /// Filters trips that fall strictly within the geofenced radius (Default: 2.0 KM).
  List<HighTrip> filterTripsWithinRadius({
    required List<HighTrip> allTrips,
    required LocationPoint userLocation,
    double radiusKm = 2.0,
  }) {
    final List<HighTrip> matchedTrips = [];

    for (final trip in allTrips) {
      final distance = GeoCalculator.calculateDistanceKm(
        lat1: userLocation.latitude,
        lon1: userLocation.longitude,
        lat2: trip.origin.latitude,
        lon2: trip.origin.longitude,
      );

      if (distance <= radiusKm) {
        matchedTrips.add(trip.copyWith(distanceFromUserKm: distance));
      }
    }

    // Sort by nearest pickup first
    matchedTrips.sort((a, b) =>
        (a.distanceFromUserKm ?? 0).compareTo(b.distanceFromUserKm ?? 0));

    return matchedTrips;
  }

  /// Initial Realistic Seed Data for High Trips (Bangalore Corridor / Tech Hub)
  /// Some trips are inside the 2km radius (e.g., 0.5km, 1.2km, 1.8km) and some outside (e.g., 3.8km)
  List<HighTrip> getInitialMockHighTrips(LocationPoint userLocation) {
    return [
      HighTrip(
        id: 'ht-101',
        creatorName: 'Arjun Verma',
        creatorPhone: '+91 98765 43210',
        creatorRating: 4.9,
        creatorRole: 'Verified Captain',
        origin: LocationPoint(
          title: 'Indiranagar Metro (Pillar 82)',
          fullAddress: 'CMH Road, Indiranagar, Bengaluru',
          latitude: userLocation.latitude + 0.0045, // ~500m away
          longitude: userLocation.longitude + 0.0030,
        ),
        destination: const LocationPoint(
          title: 'EcoWorld Campus 4B',
          fullAddress: 'Outer Ring Road, Bellandur, Bengaluru',
          latitude: 12.9240,
          longitude: 77.6830,
        ),
        scheduledDateTime: DateTime.now().add(const Duration(minutes: 45)),
        totalSeats: 3,
        availableSeats: 2,
        farePerSeat: 140.0,
        vehicleName: 'Hyundai Verna (Silver)',
        vehicleNumber: 'KA-03-MK-4421',
        vehicleType: 'car',
        notes: 'Leaving at 9:30 AM sharp. AC on, non-smoking, boot space available.',
        status: HighTripStatus.open,
      ),
      HighTrip(
        id: 'ht-102',
        creatorName: 'Priya Sundaram',
        creatorPhone: '+91 98112 34567',
        creatorRating: 4.8,
        creatorRole: 'Tech Professional',
        origin: LocationPoint(
          title: 'Defense Colony Main Gate',
          fullAddress: '12th Main, HAL 2nd Stage, Indiranagar',
          latitude: userLocation.latitude - 0.0080, // ~950m away
          longitude: userLocation.longitude + 0.0040,
        ),
        destination: const LocationPoint(
          title: 'Electronic City Phase 1',
          fullAddress: 'Infosys Gate 1, Hosur Road, Bengaluru',
          latitude: 12.8452,
          longitude: 77.6602,
        ),
        scheduledDateTime: DateTime.now().add(const Duration(hours: 1, minutes: 15)),
        totalSeats: 4,
        availableSeats: 3,
        farePerSeat: 220.0,
        vehicleName: 'Honda City (Pearl White)',
        vehicleNumber: 'KA-01-AB-9012',
        vehicleType: 'car',
        notes: 'Daily carpool. Friendly riders welcome. UPI payment preferred.',
        status: HighTripStatus.open,
      ),
      HighTrip(
        id: 'ht-103',
        creatorName: 'Vikram Joshi',
        creatorPhone: '+91 97400 12890',
        creatorRating: 5.0,
        creatorRole: 'Daily Commuter',
        origin: LocationPoint(
          title: 'Domlur Flyover Corner',
          fullAddress: 'Near Domlur Club, Bengaluru',
          latitude: userLocation.latitude - 0.0120, // ~1.5km away (Inside 2KM)
          longitude: userLocation.longitude - 0.0050,
        ),
        destination: const LocationPoint(
          title: 'Manyata Tech Park',
          fullAddress: 'Nagawara, Outer Ring Road, Bengaluru',
          latitude: 13.0475,
          longitude: 77.6200,
        ),
        scheduledDateTime: DateTime.now().add(const Duration(minutes: 30)),
        totalSeats: 1,
        availableSeats: 1,
        farePerSeat: 90.0,
        vehicleName: 'Royal Enfield Hunter 350',
        vehicleNumber: 'KA-04-ER-1188',
        vehicleType: 'bike',
        notes: 'Extra sanitized helmet provided. Quick commute without traffic hassle.',
        status: HighTripStatus.open,
      ),
      HighTrip(
        id: 'ht-104',
        creatorName: 'Karan Mehra',
        creatorPhone: '+91 99001 77654',
        creatorRating: 4.7,
        creatorRole: 'Host Driver',
        origin: LocationPoint(
          title: 'Koramangala 4th Block Club',
          fullAddress: '80 Feet Road, Koramangala, Bengaluru',
          latitude: userLocation.latitude - 0.0350, // ~4.2km away (OUTSIDE 2KM)
          longitude: userLocation.longitude - 0.0150,
        ),
        destination: const LocationPoint(
          title: 'Kempegowda International Airport (BLR)',
          fullAddress: 'Airport Road, Devanahalli, Bengaluru',
          latitude: 13.1986,
          longitude: 77.7066,
        ),
        scheduledDateTime: DateTime.now().add(const Duration(hours: 3)),
        totalSeats: 3,
        availableSeats: 2,
        farePerSeat: 450.0,
        vehicleName: 'Toyota Innova Crysta',
        vehicleNumber: 'KA-05-ZZ-3301',
        vehicleType: 'suv',
        notes: 'Luggage friendly, toll included in fare split.',
        status: HighTripStatus.open,
      ),
    ];
  }
}
