import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../core/utils/geo_calculator.dart';
import '../models/location_point.dart';
import '../providers/high_trip_provider.dart';

class CreateHighTripScreen extends StatefulWidget {
  const CreateHighTripScreen({super.key});

  @override
  State<CreateHighTripScreen> createState() => _CreateHighTripScreenState();
}

class _CreateHighTripScreenState extends State<CreateHighTripScreen> {
  final _formKey = GlobalKey<FormState>();

  final _originTitleController = TextEditingController(text: 'Indiranagar 100ft Road');
  final _originAddressController =
      TextEditingController(text: 'Near CMH Hospital, Bengaluru');

  final _destTitleController = TextEditingController(text: 'Whitefield ITPL');
  final _destAddressController =
      TextEditingController(text: 'Main Gate, International Tech Park, Bengaluru');

  final _vehicleNameController = TextEditingController(text: 'Tata Nexon EV');
  final _vehicleNumberController = TextEditingController(text: 'KA-53-MB-2024');
  final _notesController = TextEditingController(
      text: 'Daily work commute. Leaving on time. AC & phone charger available.');

  DateTime _scheduledTime = DateTime.now().add(const Duration(hours: 1));
  String _selectedVehicleType = 'bike';
  int _totalSeats = 1;
  final _fareController = TextEditingController(text: '80'); // Rider sets own price!

  @override
  void initState() {
    super.initState();
  }

  void _onVehicleChanged(String type) {
    setState(() {
      _selectedVehicleType = type;
      if (type == 'bike') {
        _totalSeats = 1;
        _fareController.text = '60';
      } else if (type == 'car') {
        _totalSeats = 3;
        _fareController.text = '120';
      } else if (type == 'suv') {
        _totalSeats = 5;
        _fareController.text = '180';
      }
    });
  }

  @override
  void dispose() {
    _originTitleController.dispose();
    _originAddressController.dispose();
    _destTitleController.dispose();
    _destAddressController.dispose();
    _vehicleNameController.dispose();
    _vehicleNumberController.dispose();
    _fareController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final timeFormat = DateFormat('EEE, d MMM - h:mm a');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Post a High Trip',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info Banner explaining the 2KM feature
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [
                      AppColors.highTripGradientStart,
                      AppColors.highTripGradientEnd,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.radar, color: Colors.white, size: 28),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Your trip will be broadcast to all passengers in your 2 KM radius area so they can join & share fares!',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Route Section
              const Text(
                'Route & Locations',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),

              _buildInputField(
                label: 'Pickup / Origin Landmark',
                controller: _originTitleController,
                prefixIcon: Icons.my_location,
              ),
              const SizedBox(height: 10),
              _buildInputField(
                label: 'Full Origin Address',
                controller: _originAddressController,
                prefixIcon: Icons.place,
              ),
              const SizedBox(height: 14),

              _buildInputField(
                label: 'Destination Landmark',
                controller: _destTitleController,
                prefixIcon: Icons.flag,
              ),
              const SizedBox(height: 10),
              _buildInputField(
                label: 'Full Destination Address',
                controller: _destAddressController,
                prefixIcon: Icons.location_on,
              ),
              const SizedBox(height: 24),

              // Schedule Section
              const Text(
                'Departure Schedule',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: _pickDateTime,
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.surfaceBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today,
                          color: AppColors.primaryCyan, size: 18),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          timeFormat.format(_scheduledTime),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios,
                          color: AppColors.textMuted, size: 14),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Vehicle & Seats
              const Text(
                'Vehicle & Available Seats',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),

              // Vehicle Type Chips
              Row(
                children: [
                  _buildVehicleTypeChip('car', 'Car / Cab', Icons.directions_car),
                  const SizedBox(width: 10),
                  _buildVehicleTypeChip('bike', 'Motorbike', Icons.two_wheeler),
                  const SizedBox(width: 10),
                  _buildVehicleTypeChip('suv', 'SUV / XL', Icons.airport_shuttle),
                ],
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _buildInputField(
                      label: 'Vehicle Model',
                      controller: _vehicleNameController,
                      prefixIcon: Icons.directions_car_filled,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildInputField(
                      label: 'Plate Number',
                      controller: _vehicleNumberController,
                      prefixIcon: Icons.confirmation_number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Seats & Fare row
              Row(
                children: [
                  // Seats selector
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.surfaceBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Seats to Share',
                            style: TextStyle(
                                color: AppColors.textSecondary, fontSize: 11),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '$_totalSeats Seats',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                              Row(
                                children: [
                                  GestureDetector(
                                    onTap: _totalSeats > 1
                                        ? () {
                                            setState(() => _totalSeats--);
                                            _recalculateFare();
                                          }
                                        : null,
                                    child: const Icon(Icons.remove,
                                        color: AppColors.primaryCyan, size: 20),
                                  ),
                                  const SizedBox(width: 8),
                                  GestureDetector(
                                    onTap: _totalSeats < 6
                                        ? () {
                                            setState(() => _totalSeats++);
                                            _recalculateFare();
                                          }
                                        : null,
                                    child: const Icon(Icons.add,
                                        color: AppColors.primaryCyan, size: 20),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Fare input (Custom price set directly by the Rider)
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.success),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Your Price (₹/Seat)',
                            style: TextStyle(
                                color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          TextFormField(
                            controller: _fareController,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                            decoration: const InputDecoration(
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                              prefixText: '₹ ',
                              prefixStyle: TextStyle(
                                color: AppColors.success,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                              border: InputBorder.none,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Notes
              _buildInputField(
                label: 'Rider Notes / Instructions',
                controller: _notesController,
                prefixIcon: Icons.notes,
                maxLines: 2,
              ),
              const SizedBox(height: 30),

              // Submit Button
              Consumer<HighTripProvider>(
                builder: (context, provider, child) {
                  return SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: provider.isLoading ? null : _submitTrip,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryBlue,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: provider.isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text(
                              'Publish High Trip to 2KM Area',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required IconData prefixIcon,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white, fontSize: 13),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
        prefixIcon: Icon(prefixIcon, color: AppColors.primaryCyan, size: 18),
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.surfaceBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.surfaceBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.primaryCyan),
        ),
      ),
      validator: (val) => val == null || val.isEmpty ? 'Required field' : null,
    );
  }

  Widget _buildVehicleTypeChip(String type, String title, IconData icon) {
    final isSelected = _selectedVehicleType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _selectedVehicleType = type);
          _recalculateFare();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primaryCyan.withOpacity(0.15)
                : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.primaryCyan : AppColors.surfaceBorder,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isSelected ? AppColors.primaryCyan : AppColors.textMuted,
                size: 20,
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _scheduledTime,
      firstDate: now,
      lastDate: now.add(const Duration(days: 7)),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.primaryCyan,
            surface: AppColors.surface,
          ),
        ),
        child: child!,
      ),
    );

    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduledTime),
      builder: (context, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(
            primary: AppColors.primaryCyan,
            surface: AppColors.surface,
          ),
        ),
        child: child!,
      ),
    );

    if (pickedTime == null || !mounted) return;

    setState(() {
      _scheduledTime = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  Future<void> _submitTrip() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<HighTripProvider>();

    final userLoc = provider.userLocation;
    final origin = LocationPoint(
      title: _originTitleController.text,
      fullAddress: _originAddressController.text,
      latitude: userLoc.latitude,
      longitude: userLoc.longitude,
    );

    final destination = LocationPoint(
      title: _destTitleController.text,
      fullAddress: _destAddressController.text,
      latitude: 12.9850,
      longitude: 77.7280,
    );

    final enteredPrice = double.tryParse(_fareController.text.trim()) ?? 80.0;

    await provider.createHighTrip(
      origin: origin,
      destination: destination,
      scheduledDateTime: _scheduledTime,
      totalSeats: _totalSeats,
      farePerSeat: enteredPrice,
      vehicleName: _vehicleNameController.text,
      vehicleNumber: _vehicleNumberController.text,
      vehicleType: _selectedVehicleType,
      notes: _notesController.text,
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('🎉 High Trip Published! Available to nearby 2KM users.'),
        backgroundColor: AppColors.success,
      ),
    );
    Navigator.pop(context);
  }
}
