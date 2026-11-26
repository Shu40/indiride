export type UserRole = 'passenger' | 'rider' | 'admin';

export type RiderApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type VehicleCategory = 'bike' | 'bullet' | 'auto' | 'car' | 'car_pro';

export type RideStatus =
  | 'SCHEDULED'
  | 'SEARCHING_FOR_RIDER'
  | 'REQUESTS_SENT'
  | 'EXPANDING_SEARCH'
  | 'RIDER_ASSIGNED'
  | 'RIDER_ARRIVING'
  | 'RIDER_ARRIVED'
  | 'OTP_VERIFICATION'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_RIDER_AVAILABLE';

export interface User {
  id: string;
  phone_number: string;
  full_name: string;
  email?: string;
  role: UserRole;
  is_active: boolean;
  passenger_profile?: {
    id: string;
    rating: number;
    total_trips: number;
  };
  rider_profile?: {
    id: string;
    license_number: string;
    status: RiderApprovalStatus;
    is_online: boolean;
    is_busy: boolean;
    rating: number;
    total_completed_trips: number;
    total_earnings: number;
    rider_service_type?: 'REGULAR' | 'CAMPUS';
    served_universities?: string;
    college_name?: string;
    academic_year?: string;
    student_id_number?: string;
    student_id_photo?: string;
    permanent_address?: string;
    current_address?: string;
    passport_photo?: string;
    license_photo?: string;
    aadhaar_number?: string;
    aadhaar_photo?: string;
    rejection_reason?: string;
    submitted_at?: string;
    verified_at?: string;
    current_latitude?: number;
    current_longitude?: number;
  };
}

export interface PlaceSuggestion {
  place_id: string;
  name: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  type?: string;
}

export interface FareItemBreakdown {
  base_fare: number;
  distance_km: number;
  rate_per_km: number;
  distance_fare: number;
  surge_multiplier: number;
  surge_amount: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount?: number;
  discount_code?: string;
  total_fare: number;
}

export interface VehicleFareEstimate {
  category: VehicleCategory;
  display_name: string;
  capacity: number;
  eta_minutes: number;
  icon: string;
  rate_per_km: number;
  distance_km: number;
  duration_minutes: number;
  estimated_fare: number;
  original_fare?: number;
  discount_amount?: number;
  fare_breakdown: FareItemBreakdown;
  available: boolean;
  description: string;
}

export interface FareEstimateResponse {
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  distance_km: number;
  duration_minutes: number;
  estimates: VehicleFareEstimate[];
  route_geometry?: [number, number][];
  applied_promo?: string;
  user_tier_code?: string;
  user_tier_name?: string;
  user_tier_badge?: string;
  auto_discount_applied?: string;
  free_rides_vouchers?: number;
}

export interface RiderSummary {
  id: string;
  full_name: string;
  phone_number: string;
  profile_photo?: string;
  rating: number;
  vehicle_category: VehicleCategory;
  vehicle_plate?: string;
  vehicle_model?: string;
  current_latitude?: number;
  current_longitude?: number;
  heading?: number;
  speed?: number;
  pickup_eta_mins?: number;
  last_location_update?: string;
  is_stale?: boolean;
}

export interface PassengerSummary {
  id: string;
  full_name: string;
  phone_number: string;
  rating: number;
}

export interface RideBooking {
  id: string;
  passenger_id: string;
  rider_id?: string;
  vehicle_category: VehicleCategory;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  route_polyline?: string;
  driver_to_pickup_route?: [number, number][];
  pickup_eta_mins?: number;
  estimated_distance_km: number;
  estimated_duration_mins: number;
  estimated_fare: number;
  boost_amount?: number;
  actual_distance_km?: number;
  final_fare?: number;
  status: RideStatus;
  current_search_radius_km: number;
  otp?: string;
  pickup_otp?: string;
  passenger?: PassengerSummary;
  rider?: RiderSummary;
  created_at: string;
  scheduled_for?: string;
  trip_started_at?: string;
  ride_started_at?: string;
  trip_completed_at?: string;
  ride_completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  cancellation_fee?: number;
  cancelled_by?: string;
  payment_status?: string;
  payment_method?: string;
}

export interface IncomingRideRequest {
  ride_id: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  distance_to_pickup_km: number;
  trip_distance_km: number;
  estimated_fare: number;
  boost_amount?: number;
  vehicle_category: VehicleCategory;
  expires_in_seconds: number;
  passenger?: {
    id: string;
    full_name: string;
    phone_number: string;
    rating?: number;
  };
}

export interface FestivalCampaign {
  id?: string;
  festival_name: string;
  tagline?: string;
  banner_title?: string;
  banner_subtitle?: string;
  discount_percent: number;
  promo_code: string;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  theme_color?: string;
}

export interface CommunityRideBookingItem {
  id: string;
  ride_id: string;
  passenger_id: string;
  passenger_name: string;
  passenger_phone: string;
  seats_booked: number;
  price_per_seat: number;
  total_price: number;
  platform_fee: number;
  net_host_earnings: number;
  pickup_notes?: string;
  status: string;
  created_at: string;
}

export interface CommunityRide {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_phone: string;
  pickup_address?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  origin_address?: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_address: string;
  destination_latitude?: number;
  destination_longitude?: number;
  departure_time: string;
  departure_datetime?: string;
  vehicle_info?: string;
  vehicle_type?: string;
  vehicle_model?: string;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  pickup_flexibility_km?: number;
  dropoff_flexibility_km?: number;
  instant_booking?: number;
  luggage_policy?: string;
  platform_fee_percent?: number;
  university_name?: string;
  university_short_name?: string;
  category_type?: 'UNIVERSITY' | 'CITY' | 'LOCAL';
  poster_gender?: 'MALE' | 'FEMALE' | 'COED';
  notes?: string;
  status: string;
  created_at: string;
  is_mine?: boolean;
  user_has_booked?: boolean;
  pickup_detour_km?: number;
  dropoff_detour_km?: number;
  total_detour_km?: number;
  bookings?: CommunityRideBookingItem[];
}

export interface MyReservationItem {
  id: string;
  ride_id: string;
  seats_booked: number;
  price_per_seat: number;
  total_price: number;
  platform_fee: number;
  net_host_earnings: number;
  pickup_notes?: string;
  status: string;
  created_at: string;
  host_name: string;
  host_phone: string;
  pickup_address: string;
  destination_address: string;
  departure_time?: string;
  vehicle_info?: string;
  ride_status: string;
}

export interface Campus {
  id: string;
  university_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  status: string;
  common_locations: string[];
}

export interface University {
  id: string;
  name: string;
  short_name?: string;
  city: string;
  state: string;
  country: string;
  status: string;
  logo_url?: string;
  campuses: Campus[];
}

export interface CampusRideItem {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_phone: string;
  is_owner?: boolean;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  destination_address: string;
  destination_latitude?: number;
  destination_longitude?: number;
  departure_time: string;
  departure_datetime?: string;
  price_per_seat: number;
  available_seats: number;
  total_seats: number;
  vehicle_type: string;
  vehicle_info: string;
  instant_booking: boolean;
  university_id?: string;
  campus_id?: string;
  university_name?: string;
  category_type?: string;
  intermediate_stops: string[];
  recurring_days?: string;
  notes?: string;
  driver_verified: boolean;
  verification_label: string;
  rating: number;
  completed_trips: number;
  status: string;
  is_sold_out?: boolean;
  is_daily?: boolean;
  gender_preference?: string;
  query_travel_date?: string;
  created_at?: string;
}

export interface PassengerRideRequestItem {
  id: string;
  user_id: string;
  passenger_name: string;
  passenger_phone: string;
  is_mine?: boolean;
  pickup_address: string;
  destination_address: string;
  travel_date: string;
  preferred_time: string;
  passengers_count: number;
  max_budget_per_seat?: number;
  notes?: string;
  status: string;
  created_at?: string;
}

export interface CampusBookingDetailItem {
  booking_id: string;
  ride_id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
  seats_booked: number;
  travel_date?: string;
  price_per_seat?: number;
  total_fare: number;
  pickup_notes?: string;
  can_contact_driver?: boolean;
  created_at?: string;
  ride?: {
    pickup_address: string;
    destination_address: string;
    departure_time: string;
    departure_datetime?: string;
    vehicle_type: string;
    vehicle_info: string;
    driver_name: string;
    driver_phone: string;
    university_name?: string;
    category_type?: string;
    gender_preference?: string;
    is_daily?: boolean;
    intermediate_stops?: string[];
    notes?: string;
    status: string;
  };
}

export interface CampusPostedRideDetailItem {
  id: string;
  pickup_address: string;
  destination_address: string;
  departure_time: string;
  departure_datetime?: string;
  price_per_seat: number;
  available_seats: number;
  total_seats: number;
  vehicle_type: string;
  vehicle_info: string;
  category_type?: string;
  gender_preference?: string;
  is_daily?: boolean;
  intermediate_stops?: string[];
  status: string;
  is_sold_out?: boolean;
  is_expired?: boolean;
  university_name?: string;
  pending_requests_count?: number;
  bookings: Array<{
    booking_id: string;
    passenger_name: string;
    passenger_phone: string;
    seats_booked: number;
    travel_date?: string;
    total_fare: number;
    pickup_notes?: string;
    status: string;
    created_at?: string;
  }>;
  created_at?: string;
}

export interface CampusRideAlert {
  id: string;
  university_id?: string;
  campus_id?: string;
  pickup_text: string;
  destination_text: string;
  travel_date: string;
  preferred_time_window: string;
  seats_needed: number;
  is_active: boolean;
  created_at?: string;
}

export interface StudentProfile {
  user_id: string;
  full_name?: string;
  phone_number?: string;
  university_id?: string;
  university_name?: string;
  campus_id?: string;
  campus_name?: string;
  student_id_number?: string;
  student_status: string;
  student_verification_status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  college_department?: string;
}

