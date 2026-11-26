import 'location_point.dart';

enum HighTripStatus {
  open,
  full,
  inTransit,
  completed,
  cancelled,
}

class HighTrip {
  final String id;
  final String creatorName;
  final String creatorPhone;
  final double creatorRating;
  final String creatorRole; // 'fellow_rider' or 'verified_captain'
  final LocationPoint origin;
  final LocationPoint destination;
  final DateTime scheduledDateTime;
  final int totalSeats;
  final int availableSeats;
  final double farePerSeat;
  final String vehicleName;
  final String vehicleNumber;
  final String vehicleType; // 'bike', 'car', 'suv'
  final String notes;
  final HighTripStatus status;
  final double? distanceFromUserKm; // dynamically computed against 2km geofence

  const HighTrip({
    required this.id,
    required this.creatorName,
    required this.creatorPhone,
    required this.creatorRating,
    required this.creatorRole,
    required this.origin,
    required this.destination,
    required this.scheduledDateTime,
    required this.totalSeats,
    required this.availableSeats,
    required this.farePerSeat,
    required this.vehicleName,
    required this.vehicleNumber,
    required this.vehicleType,
    required this.notes,
    this.status = HighTripStatus.open,
    this.distanceFromUserKm,
  });

  bool get isWithin2Km => (distanceFromUserKm ?? 99.0) <= 2.0;

  HighTrip copyWith({
    String? id,
    String? creatorName,
    String? creatorPhone,
    double? creatorRating,
    String? creatorRole,
    LocationPoint? origin,
    LocationPoint? destination,
    DateTime? scheduledDateTime,
    int? totalSeats,
    int? availableSeats,
    double? farePerSeat,
    String? vehicleName,
    String? vehicleNumber,
    String? vehicleType,
    String? notes,
    HighTripStatus? status,
    double? distanceFromUserKm,
  }) {
    return HighTrip(
      id: id ?? this.id,
      creatorName: creatorName ?? this.creatorName,
      creatorPhone: creatorPhone ?? this.creatorPhone,
      creatorRating: creatorRating ?? this.creatorRating,
      creatorRole: creatorRole ?? this.creatorRole,
      origin: origin ?? this.origin,
      destination: destination ?? this.destination,
      scheduledDateTime: scheduledDateTime ?? this.scheduledDateTime,
      totalSeats: totalSeats ?? this.totalSeats,
      availableSeats: availableSeats ?? this.availableSeats,
      farePerSeat: farePerSeat ?? this.farePerSeat,
      vehicleName: vehicleName ?? this.vehicleName,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      vehicleType: vehicleType ?? this.vehicleType,
      notes: notes ?? this.notes,
      status: status ?? this.status,
      distanceFromUserKm: distanceFromUserKm ?? this.distanceFromUserKm,
    );
  }
}
