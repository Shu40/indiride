class LocationPoint {
  final String title;
  final String fullAddress;
  final double latitude;
  final double longitude;

  const LocationPoint({
    required this.title,
    required this.fullAddress,
    required this.latitude,
    required this.longitude,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        'fullAddress': fullAddress,
        'latitude': latitude,
        'longitude': longitude,
      };

  factory LocationPoint.fromJson(Map<String, dynamic> json) => LocationPoint(
        title: json['title'] as String,
        fullAddress: json['fullAddress'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
      );

  // Default Fallback (Indiranagar / Cyber City Hub)
  static const LocationPoint defaultPickup = LocationPoint(
    title: 'Current Location',
    fullAddress: '100 Feet Rd, Indiranagar, Bengaluru, KA',
    latitude: 12.9784,
    longitude: 77.6408,
  );

  static const LocationPoint defaultDrop = LocationPoint(
    title: 'Tech Park Central',
    fullAddress: 'Embassy Tech Village, Bellandur, Bengaluru, KA',
    latitude: 12.9260,
    longitude: 77.6762,
  );
}
