import 'package:flutter/material.dart';

class VehicleOption {
  final String id;
  final String name;
  final String description;
  final IconData icon;
  final int capacity;
  final double basePrice;
  final double perKmRate;
  final int estimatedEtaMinutes;

  const VehicleOption({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.capacity,
    required this.basePrice,
    required this.perKmRate,
    required this.estimatedEtaMinutes,
  });

  double calculateFare(double distanceKm) {
    return (basePrice + (distanceKm * perKmRate)).roundToDouble();
  }

  static const List<VehicleOption> availableVehicles = [
    VehicleOption(
      id: 'bike',
      name: 'Moto Bike',
      description: 'Quickest ride through city traffic',
      icon: Icons.two_wheeler,
      capacity: 1,
      basePrice: 25.0,
      perKmRate: 7.0,
      estimatedEtaMinutes: 2,
    ),
    VehicleOption(
      id: 'auto',
      name: 'Auto Rickshaw',
      description: 'Affordable doorstep pickup',
      icon: Icons.electric_rickshaw,
      capacity: 3,
      basePrice: 35.0,
      perKmRate: 11.0,
      estimatedEtaMinutes: 4,
    ),
    VehicleOption(
      id: 'mini',
      name: 'Uber Go / Mini',
      description: 'Comfy AC compact hatchbacks',
      icon: Icons.directions_car,
      capacity: 4,
      basePrice: 60.0,
      perKmRate: 14.0,
      estimatedEtaMinutes: 5,
    ),
    VehicleOption(
      id: 'sedan',
      name: 'Prime Sedan',
      description: 'Spacious sedans with top-rated drivers',
      icon: Icons.local_taxi,
      capacity: 4,
      basePrice: 90.0,
      perKmRate: 18.0,
      estimatedEtaMinutes: 6,
    ),
    VehicleOption(
      id: 'suv',
      name: 'Prime XL / SUV',
      description: '6-Seater SUVs for group travel',
      icon: Icons.airport_shuttle,
      capacity: 6,
      basePrice: 140.0,
      perKmRate: 24.0,
      estimatedEtaMinutes: 8,
    ),
  ];
}
