import 'dart:math';
import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';
import '../models/location_point.dart';

class InteractiveMapCanvas extends StatefulWidget {
  final LocationPoint userLocation;
  final LocationPoint? destination;
  final double radiusKm;
  final bool showRadiusCircle;
  final bool isSearching;

  const InteractiveMapCanvas({
    super.key,
    required this.userLocation,
    this.destination,
    this.radiusKm = 2.0,
    this.showRadiusCircle = true,
    this.isSearching = false,
  });

  @override
  State<InteractiveMapCanvas> createState() => _InteractiveMapCanvasState();
}

class _InteractiveMapCanvasState extends State<InteractiveMapCanvas>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();

    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return CustomPaint(
          size: Size.infinite,
          painter: _MapPainter(
            pulseScale: _pulseAnimation.value,
            radiusKm: widget.radiusKm,
            showRadius: widget.showRadiusCircle,
            hasDestination: widget.destination != null,
            isSearching: widget.isSearching,
          ),
        );
      },
    );
  }
}

class _MapPainter extends CustomPainter {
  final double pulseScale;
  final double radiusKm;
  final bool showRadius;
  final bool hasDestination;
  final bool isSearching;

  _MapPainter({
    required this.pulseScale,
    required this.radiusKm,
    required this.showRadius,
    required this.hasDestination,
    required this.isSearching,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFF111420);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    // Draw stylized city road network
    final roadPaint = Paint()
      ..color = const Color(0xFF1E2335)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;

    final highwayPaint = Paint()
      ..color = const Color(0xFF282F48)
      ..strokeWidth = 6.0
      ..style = PaintingStyle.stroke;

    // Highway Curves
    final highwayPath = Path()
      ..moveTo(0, size.height * 0.35)
      ..cubicTo(size.width * 0.4, size.height * 0.3, size.width * 0.6,
          size.height * 0.7, size.width, size.height * 0.65);
    canvas.drawPath(highwayPath, highwayPaint);

    // Grid Roads
    for (double i = 40; i < size.width; i += 70) {
      canvas.drawLine(Offset(i, 0), Offset(i + 20, size.height), roadPaint);
    }
    for (double j = 30; j < size.height; j += 60) {
      canvas.drawLine(Offset(0, j), Offset(size.width, j - 15), roadPaint);
    }

    final center = Offset(size.width * 0.5, size.height * 0.48);

    // 2KM Geofenced Radar Ring
    if (showRadius) {
      final radiusPixels = (radiusKm * 65.0) * pulseScale;

      final radarFillPaint = Paint()
        ..color = AppColors.primaryCyan.withOpacity(0.08)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(center, radiusPixels, radarFillPaint);

      final radarBorderPaint = Paint()
        ..color = AppColors.primaryCyan.withOpacity(0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;
      canvas.drawCircle(center, radiusPixels, radarBorderPaint);
    }

    // Route Polyline if destination set
    if (hasDestination) {
      final destOffset = Offset(size.width * 0.75, size.height * 0.22);

      final routePaint = Paint()
        ..color = AppColors.routePolyline
        ..strokeWidth = 4.0
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;

      final routePath = Path()
        ..moveTo(center.dx, center.dy)
        ..lineTo(center.dx + 40, center.dy - 30)
        ..lineTo(destOffset.dx - 20, destOffset.dy + 30)
        ..lineTo(destOffset.dx, destOffset.dy);

      canvas.drawPath(routePath, routePaint);

      // Destination Pin
      final destPinPaint = Paint()..color = AppColors.highTripAccent;
      canvas.drawCircle(destOffset, 8, destPinPaint);
      canvas.drawCircle(
          destOffset, 3, Paint()..color = Colors.white);
    }

    // Nearby Simulated Cabs
    _drawVehicleIcon(canvas, Offset(center.dx - 60, center.dy + 40), 'bike');
    _drawVehicleIcon(canvas, Offset(center.dx + 80, center.dy - 50), 'car');
    _drawVehicleIcon(canvas, Offset(center.dx - 30, center.dy - 70), 'car');

    // User Location Pin (Center with pulse)
    final userPulsePaint = Paint()
      ..color = AppColors.primaryBlue.withOpacity(0.25)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, 22 * pulseScale, userPulsePaint);

    final userPinPaint = Paint()..color = AppColors.primaryBlue;
    canvas.drawCircle(center, 9, userPinPaint);

    final userInnerDot = Paint()..color = Colors.white;
    canvas.drawCircle(center, 4, userInnerDot);
  }

  void _drawVehicleIcon(Canvas canvas, Offset pos, String type) {
    final cabPaint = Paint()..color = const Color(0xFFFBBF24);
    canvas.drawCircle(pos, 5, cabPaint);
    canvas.drawCircle(pos, 2, Paint()..color = Colors.black);
  }

  @override
  bool shouldRepaint(covariant _MapPainter oldDelegate) {
    return oldDelegate.pulseScale != pulseScale ||
        oldDelegate.radiusKm != radiusKm ||
        oldDelegate.hasDestination != hasDestination ||
        oldDelegate.isSearching != isSearching;
  }
}
