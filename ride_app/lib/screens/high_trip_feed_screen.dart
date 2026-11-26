import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../providers/high_trip_provider.dart';
import '../widgets/high_trip_card.dart';
import '../widgets/radius_radar_badge.dart';
import 'booking_confirmation_sheet.dart';
import 'create_high_trip_screen.dart';

class HighTripFeedScreen extends StatelessWidget {
  const HighTripFeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HighTripProvider>();
    final trips = provider.filteredTrips;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    AppColors.highTripGradientStart,
                    AppColors.highTripGradientEnd,
                  ],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.share_location, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'High Trip Corridor',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                  ),
                ),
                Text(
                  'Area Pre-booked Rides',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => provider.updateUserLocation(provider.userLocation),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.highTripGradientStart,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'Post High Trip',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const CreateHighTripScreen(),
            ),
          );
        },
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          provider.updateUserLocation(provider.userLocation);
        },
        color: AppColors.primaryCyan,
        backgroundColor: AppColors.surface,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Geofence Radar Header
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: RadiusRadarBadge(
                  currentRadiusKm: provider.currentRadiusKm,
                  matchedCount: trips.length,
                  onRadiusSelected: (radius) {
                    provider.setRadiusFilter(radius);
                  },
                ),
              ),
            ),

            // Feed Content
            if (trips.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.radar_outlined,
                            size: 64, color: AppColors.textMuted),
                        const SizedBox(height: 16),
                        Text(
                          'No High Trips within ${provider.currentRadiusKm} KM',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'You can expand the search radius or be the first person in your area to post a scheduled route!',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 18),
                        ElevatedButton.icon(
                          onPressed: () => provider.setRadiusFilter(5.0),
                          icon: const Icon(Icons.zoom_out_map, size: 16),
                          label: const Text('Expand to 5 KM Radius'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.surfaceElevated,
                            foregroundColor: AppColors.primaryCyan,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final trip = trips[index];
                      return HighTripCard(
                        trip: trip,
                        onBookTap: () {
                          BookingConfirmationSheet.show(context, trip);
                        },
                      );
                    },
                    childCount: trips.length,
                  ),
                ),
              ),

            const SliverToBoxAdapter(
              child: SizedBox(height: 80),
            ),
          ],
        ),
      ),
    );
  }
}
