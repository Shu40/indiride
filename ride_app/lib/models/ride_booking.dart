import 'location_point.dart';

enum BookingType {
  instantRide,
  highTripPool,
}

enum BookingStatus {
  pending,
  confirmed,
  driverArriving,
  inTrip,
  completed,
  cancelled,
}

class RideBooking {
  final String id;
  final BookingType type;
  final String? highTripId;
  final String passengerName;
  final String passengerPhone;
  final LocationPoint pickup;
  final LocationPoint drop;
  final int seatsBooked;
  final double totalFare;
  final String otpCode;
  final String vehicleInfo;
  final String driverName;
  final String driverPhone;
  final BookingStatus status;
  final DateTime bookedAt;

  const RideBooking({
    required this.id,
    required this.type,
    this.highTripId,
    required this.passengerName,
    required this.passengerPhone,
    required this.pickup,
    required this.drop,
    required this.seatsBooked,
    required this.totalFare,
    required this.otpCode,
    required this.vehicleInfo,
    required this.driverName,
    required this.driverPhone,
    required this.status,
    required this.bookedAt,
  });
}
