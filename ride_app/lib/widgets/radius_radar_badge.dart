import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

class RadiusRadarBadge extends StatelessWidget {
  final double currentRadiusKm;
  final int matchedCount;
  final ValueChanged<double> onRadiusSelected;

  const RadiusRadarBadge({
    super.key,
    required this.currentRadiusKm,
    required this.matchedCount,
    required this.onRadiusSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder),
      ),
      child: Row(
        children: [
          // Animated Pulse Indicator
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.radarPulseFill,
                ),
              ),
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryCyan,
                ),
              ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      'Area Geofence: ${currentRadiusKm.toStringAsFixed(1)} KM',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primaryCyan.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '$matchedCount Available',
                        style: const TextStyle(
                          color: AppColors.primaryCyan,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                const Text(
                  'Showing pre-booked trips within your immediate corridor',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          // Filter Chips
          PopupMenuButton<double>(
            color: AppColors.surfaceElevated,
            icon: const Icon(Icons.tune, color: AppColors.primaryCyan, size: 20),
            tooltip: 'Change Geofence Radius',
            onSelected: onRadiusSelected,
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 1.0,
                child: Text('1.0 KM (Walkable)', style: TextStyle(color: Colors.white)),
              ),
              const PopupMenuItem(
                value: 2.0,
                child: Text('2.0 KM (Recommended Core)', style: TextStyle(color: AppColors.primaryCyan, fontWeight: FontWeight.bold)),
              ),
              const PopupMenuItem(
                value: 5.0,
                child: Text('5.0 KM (Wider Zone)', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
