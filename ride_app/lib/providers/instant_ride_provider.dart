import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../core/utils/geo_calculator.dart';
import '../models/location_point.dart';
import '../models/ride_booking.dart';
import '../models/vehicle_type.dart';

enum InstantRideState {
  idle,
  selectingRide,
  searchingDriver,
  driverAssigned,
  arrivingAtPickup,
  inTrip,
  completed,
}

class InstantRideProvider extends ChangeNotifier {
  LocationPoint _pickup = LocationPoint.defaultPickup;
  LocationPoint _drop = LocationPoint.defaultDrop;
  VehicleOption _selectedVehicle = VehicleOption.availableVehicles[2]; // Uber Go / Mini default
  InstantRideState _state = InstantRideState.idle;
  RideBooking? _activeBooking;
  Timer? _rideSimulationTimer;

  LocationPoint get pickup => _pickup;
  LocationPoint get drop => _drop;
  VehicleOption get selectedVehicle => _selectedVehicle;
  InstantRideState get state => _state;
  RideBooking? get activeBooking => _activeBooking;

  double get tripDistanceKm => GeoCalculator.calculateDistanceKm(
        lat1: _pickup.latitude,
        lon1: _pickup.longitude,
        lat2: _drop.latitude,
        lon2: _drop.longitude,
      );

  double get estimatedFare => _selectedVehicle.calculateFare(tripDistanceKm);

  void setPickup(LocationPoint point) {
    _pickup = point;
    notifyListeners();
  }

  void setDrop(LocationPoint point) {
    _drop = point;
    _state = InstantRideState.selectingRide;
    notifyListeners();
  }

  void selectVehicle(VehicleOption option) {
    _selectedVehicle = option;
    notifyListeners();
  }

  void resetToIdle() {
    _rideSimulationTimer?.cancel();
    _state = InstantRideState.idle;
    _activeBooking = null;
    notifyListeners();
  }

  /// Initiates instant ride search & driver matching simulation
  void requestRide() {
    _state = InstantRideState.searchingDriver;
    notifyListeners();

    // Simulate real-time dispatching (2.5 seconds)
    _rideSimulationTimer?.cancel();
    _rideSimulationTimer = Timer(const Duration(milliseconds: 2500), () {
      final randomOtp = (1000 + Random().nextInt(9000)).toString();

      _activeBooking = RideBooking(
        id: 'uber-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
        type: BookingType.instantRide,
        passengerName: 'Current User',
        passengerPhone: '+91 99887 76655',
        pickup: _pickup,
        drop: _drop,
        seatsBooked: 1,
        totalFare: estimatedFare,
        otpCode: randomOtp,
        vehicleInfo: '${_selectedVehicle.name} - White Dzire (KA-05-AA-7890)',
        driverName: 'Ramesh Kumar (4.9 ★)',
        driverPhone: '+91 98765 12345',
        status: BookingStatus.driverArriving,
        bookedAt: DateTime.now(),
      );

      _state = InstantRideState.driverAssigned;
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _rideSimulationTimer?.cancel();
    super.dispose();
  }
}
