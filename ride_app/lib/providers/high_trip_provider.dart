import 'dart:math';
import 'package:flutter/material.dart';
import '../models/high_trip.dart';
import '../models/location_point.dart';
import '../models/ride_booking.dart';
import '../services/geofence_service.dart';

class HighTripProvider extends ChangeNotifier {
  final GeofenceService _geofenceService = GeofenceService();

  LocationPoint _userLocation = LocationPoint.defaultPickup;
  double _currentRadiusKm = 2.0; // Startup USP: strictly 2km radius matching
  List<HighTrip> _allTrips = [];
  List<HighTrip> _filteredTrips = [];
  final List<RideBooking> _myBookings = [];
  bool _isLoading = false;

  LocationPoint get userLocation => _userLocation;
  double get currentRadiusKm => _currentRadiusKm;
  List<HighTrip> get filteredTrips => _filteredTrips;
  List<HighTrip> get allTrips => _allTrips;
  List<RideBooking> get myBookings => _myBookings;
  bool get isLoading => _isLoading;

  HighTripProvider() {
    _initializeSeedData();
  }

  void _initializeSeedData() {
    _allTrips = _geofenceService.getInitialMockHighTrips(_userLocation);
    _applyGeofenceFilter();
  }

  void setRadiusFilter(double radiusKm) {
    _currentRadiusKm = radiusKm;
    _applyGeofenceFilter();
    notifyListeners();
  }

  void updateUserLocation(LocationPoint newLocation) {
    _userLocation = newLocation;
    _applyGeofenceFilter();
    notifyListeners();
  }

  void _applyGeofenceFilter() {
    _filteredTrips = _geofenceService.filterTripsWithinRadius(
      allTrips: _allTrips,
      userLocation: _userLocation,
      radiusKm: _currentRadiusKm,
    );
  }

  /// Rider posts a High Trip: "mujhe iss jagah se iss jagah jana hai"
  Future<HighTrip> createHighTrip({
    required LocationPoint origin,
    required LocationPoint destination,
    required DateTime scheduledDateTime,
    required int totalSeats,
    required double farePerSeat,
    required String vehicleName,
    required String vehicleNumber,
    required String vehicleType,
    required String notes,
  }) async {
    _isLoading = true;
    notifyListeners();

    // Simulate network latency
    await Future.delayed(const Duration(milliseconds: 600));

    final newTrip = HighTrip(
      id: 'ht-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}',
      creatorName: 'You (Trip Host)',
      creatorPhone: '+91 98888 11223',
      creatorRating: 5.0,
      creatorRole: 'Trip Host',
      origin: origin,
      destination: destination,
      scheduledDateTime: scheduledDateTime,
      totalSeats: totalSeats,
      availableSeats: totalSeats,
      farePerSeat: farePerSeat,
      vehicleName: vehicleName,
      vehicleNumber: vehicleNumber,
      vehicleType: vehicleType,
      notes: notes,
      status: HighTripStatus.open,
    );

    _allTrips.insert(0, newTrip);
    _applyGeofenceFilter();
    _isLoading = false;
    notifyListeners();
    return newTrip;
  }

  /// Another nearby user within 2km books a seat
  Future<RideBooking?> bookHighTripSeat({
    required String tripId,
    required int seatsToBook,
    required String passengerName,
    required String passengerPhone,
  }) async {
    final tripIndex = _allTrips.indexWhere((t) => t.id == tripId);
    if (tripIndex == -1) return null;

    final trip = _allTrips[tripIndex];
    if (trip.availableSeats < seatsToBook) return null;

    final updatedSeats = trip.availableSeats - seatsToBook;
    _allTrips[tripIndex] = trip.copyWith(
      availableSeats: updatedSeats,
      status: updatedSeats == 0 ? HighTripStatus.full : HighTripStatus.open,
    );

    // Generate realistic 4-digit security OTP
    final randomOtp = (1000 + Random().nextInt(9000)).toString();

    final booking = RideBooking(
      id: 'bk-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      type: BookingType.highTripPool,
      highTripId: trip.id,
      passengerName: passengerName,
      passengerPhone: passengerPhone,
      pickup: trip.origin,
      drop: trip.destination,
      seatsBooked: seatsToBook,
      totalFare: trip.farePerSeat * seatsToBook,
      otpCode: randomOtp,
      vehicleInfo: '${trip.vehicleName} (${trip.vehicleNumber})',
      driverName: trip.creatorName,
      driverPhone: trip.creatorPhone,
      status: BookingStatus.confirmed,
      bookedAt: DateTime.now(),
    );

    _myBookings.insert(0, booking);
    _applyGeofenceFilter();
    notifyListeners();
    return booking;
  }
}
