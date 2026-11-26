import 'dart:math';

/// High-performance spatial math utilities for 2KM geofencing and route matching.
class GeoCalculator {
  static const double earthRadiusKm = 6371.0;

  /// Haversine Formula: Calculates precise great-circle distance in Kilometers.
  static double calculateDistanceKm({
    required double lat1,
    required double lon1,
    required double lat2,
    required double lon2,
  }) {
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) *
            cos(_toRadians(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusKm * c;
  }

  /// Checks if a trip's pickup or corridor is strictly within the threshold (Default: 2.0 KM).
  static bool isWithinRadius({
    required double userLat,
    required double userLon,
    required double targetLat,
    required double targetLon,
    double radiusKm = 2.0,
  }) {
    final distance = calculateDistanceKm(
      lat1: userLat,
      lon1: userLon,
      lat2: targetLat,
      lon2: targetLon,
    );
    return distance <= radiusKm;
  }

  /// Formats distance into clean human-readable text.
  static String formatDistance(double distanceKm) {
    if (distanceKm < 1.0) {
      final meters = (distanceKm * 1000).round();
      return '$meters m away';
    }
    return '${distanceKm.toStringAsFixed(1)} km away';
  }

  /// Calculates ETA in minutes based on traffic and vehicle type.
  static int estimateDurationMinutes(double distanceKm, String vehicleType) {
    double averageSpeedKmh = 25.0; // City traffic average
    if (vehicleType.toLowerCase().contains('bike')) {
      averageSpeedKmh = 35.0; // Bikes maneuver faster in city traffic
    } else if (vehicleType.toLowerCase().contains('suv')) {
      averageSpeedKmh = 22.0;
    }
    final hours = distanceKm / averageSpeedKmh;
    final minutes = (hours * 60).round();
    return max(5, minutes); // Minimum 5 mins
  }

  /// Fair Split pricing algorithm for High Trip (Carpool/Shared ride).
  /// Significantly cheaper per seat than booking a solo cab.
  static double calculateHighTripFare({
    required double distanceKm,
    required int seats,
    required String vehicleType,
  }) {
    double baseRatePerKm = 12.0;
    double baseFare = 50.0;

    if (vehicleType.toLowerCase().contains('bike')) {
      baseRatePerKm = 6.0;
      baseFare = 25.0;
    } else if (vehicleType.toLowerCase().contains('suv')) {
      baseRatePerKm = 18.0;
      baseFare = 90.0;
    }

    final totalTripEstimate = baseFare + (distanceKm * baseRatePerKm);
    
    // In a shared high-trip, the single seat cost has a 35% discount for passenger
    // while giving high total earnings to the trip creator.
    final costPerSeat = (totalTripEstimate * 0.65).clamp(30.0, 5000.0);
    return (costPerSeat / 10).round() * 10.0; // round to nearest 10
  }

  static double _toRadians(double degree) {
    return degree * (pi / 180.0);
  }
}
