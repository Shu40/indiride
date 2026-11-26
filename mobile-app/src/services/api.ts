import Constants from 'expo-constants';
import {
  User,
  PlaceSuggestion,
  FareEstimateResponse,
  RideBooking,
  IncomingRideRequest,
  VehicleCategory,
  RiderApprovalStatus,
  RideStatus,
  FestivalCampaign,
  CommunityRide,
  MyReservationItem,
  University,
  Campus,
  CampusRideItem,
  CampusRideAlert,
  StudentProfile,
} from '../types';

export const getHostname = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return '10.221.112.192';
};

export const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const customApi = window.localStorage?.getItem('custom_api_url');
    if (customApi) return customApi.replace(/\/$/, '');

    const host = window.location?.hostname || '';
    if (host.includes('vercel.app')) {
      return 'https://indiride-api.onrender.com/api';
    }
    if (host && !['localhost', '127.0.0.1'].includes(host)) {
      const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
      return `${protocol}://${host}:8001/api`;
    }
  }
  return `http://${getHostname()}:8001/api`;
};

export const getWsBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const customWs = window.localStorage?.getItem('custom_ws_url');
    if (customWs) return customWs.replace(/\/$/, '');

    const host = window.location?.hostname || '';
    if (host.includes('vercel.app')) {
      return 'wss://indiride-api.onrender.com/api/ws';
    }
    if (host && !['localhost', '127.0.0.1'].includes(host)) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${wsProtocol}://${host}:8001/api/ws`;
    }
  }
  return `ws://${getHostname()}:8001/api/ws`;
};

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem('auth_token', token);
    } else {
      window.localStorage.removeItem('auth_token');
    }
  }
};

export const getStoredToken = (): string | null => {
  if (authToken) return authToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    authToken = window.localStorage.getItem('auth_token');
  }
  return authToken;
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/verify-otp')) {
      console.warn('[API] 401 Unauthorized for', endpoint, '- token expired or invalid');
      setAuthToken(null);
    }
    const errorMsg = data.detail || response.statusText || 'Network request failed';
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  auth: {
    sendOtp: (phone_number: string) =>
      apiRequest<{ success: boolean; message: string; demo_otp?: string }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number }),
      }),

    verifyOtp: (phone_number: string, otp: string) =>
      apiRequest<{ verified: boolean; registered: boolean; token?: any; tokens?: any }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone_number, otp }),
      }),

    register: (payload: {
      phone_number: string;
      full_name: string;
      email?: string;
      role: string;
      password?: string;
      license_number?: string;
      vehicle_category?: string;
      vehicle_plate?: string;
      vehicle_model?: string;
      rider_service_type?: string;
      served_universities?: string;
      college_name?: string;
      academic_year?: string;
      student_id_number?: string;
      student_id_photo?: string;
      permanent_address?: string;
      current_address?: string;
      passport_photo?: string;
      driver_photo?: string;
      license_photo?: string;
      pan_number?: string;
      pan_photo?: string;
      aadhaar_number?: string;
      aadhaar_photo?: string;
      driver_state?: string;
      driver_city?: string;
    }) =>
      apiRequest<{ access_token: string; refresh_token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    recordVoiceVerification: (phone_number: string, digit: string, university?: string) =>
      apiRequest<{ success: boolean; status: string; message: string }>('/auth/driver/voice-verify', {
        method: 'POST',
        body: JSON.stringify({ phone_number, digit, university }),
      }),

    login: (phone_number: string, password?: string, otp?: string) =>
      apiRequest<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone_number, password, otp }),
      }),

    demoLogin: (role: 'passenger' | 'rider' | 'admin' | string) =>
      apiRequest<{ access_token: string; refresh_token: string; user: User }>(`/auth/demo-login/${role}`, {
        method: 'POST',
      }),

    googleAuth: (payload: { email: string; full_name: string; phone_number?: string; otp?: string }) =>
      apiRequest<{ phone_required: boolean; user?: User; tokens?: any; token?: any; message?: string }>('/auth/google-auth', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    findAccount: (identifier: string) =>
      apiRequest<{ found: boolean; full_name?: string; masked_phone?: string; masked_email?: string; raw_phone?: string; role?: string; message?: string }>('/auth/find-account', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }),

    getMe: () => apiRequest<User>('/auth/me'),

    logout: () => apiRequest<{ status: string; message: string }>('/auth/logout', { method: 'POST' }),

    logoutAll: () => apiRequest<{ status: string; message: string }>('/auth/logout-all', { method: 'POST' }),

    updateProfile: (payload: { full_name?: string; email?: string; profile_photo?: string }) =>
      apiRequest<User>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    deleteAccount: (confirmation: string = 'DELETE MY ACCOUNT', password?: string) =>
      apiRequest<{ status: string; message: string }>('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation, password }),
      }),
  },

  location: {
    searchPlaces: (query: string, limit: number = 10) =>
      apiRequest<{ query: string; count: number; suggestions: PlaceSuggestion[] }>(
        `/location/search?query=${encodeURIComponent(query)}&limit=${limit}`
      ),

    reverseGeocode: (latitude: number, longitude: number) =>
      apiRequest<{ latitude: number; longitude: number; address: string; country: string; city?: string; state?: string; pincode?: string }>(
        `/location/reverse?latitude=${latitude}&longitude=${longitude}`
      ),

    calculateRoute: (pickupLat: number, pickupLng: number, dropLat: number, dropLng: number) =>
      apiRequest<{ distance_km: number; duration_minutes: number; route_geometry: [number, number][] }>(
        '/location/route',
        {
          method: 'POST',
          body: JSON.stringify({
            pickup_latitude: pickupLat,
            pickup_longitude: pickupLng,
            dropoff_latitude: dropLat,
            dropoff_longitude: dropLng,
          }),
        }
      ),
  },

  fare: {
    estimateFares: (
      pickupLat: number,
      pickupLng: number,
      dropLat: number,
      dropLng: number,
      promoCode?: string | null,
      rideType?: string,
      useVoucher?: boolean
    ) =>
      apiRequest<FareEstimateResponse>('/fare/estimate', {
        method: 'POST',
        body: JSON.stringify({
          pickup_latitude: pickupLat,
          pickup_longitude: pickupLng,
          dropoff_latitude: dropLat,
          dropoff_longitude: dropLng,
          promo_code: promoCode || undefined,
          ride_type: rideType || 'daily',
          use_voucher: !!useVoucher,
        }),
      }),

    getConfigs: () => apiRequest<any[]>('/fare/configs'),

    updateConfig: (category: VehicleCategory, update: { per_km_rate?: number; base_fare?: number; min_fare?: number; surge_multiplier?: number }) =>
      apiRequest<any>(`/fare/configs/${category}`, {
        method: 'PUT',
        body: JSON.stringify(update),
      }),

    validatePromo: (code: string, totalAmount: number = 100) =>
      apiRequest<{
        valid: boolean;
        code: string;
        discount_percent: number;
        discount_amount: number;
        final_amount: number;
        description?: string;
        message: string;
      }>('/fare/validate-promo', {
        method: 'POST',
        body: JSON.stringify({ code, total_amount: totalAmount }),
      }),
  },

  rides: {
    createBooking: (payload: {
      pickup_address: string;
      pickup_latitude: number;
      pickup_longitude: number;
      destination_address: string;
      destination_latitude: number;
      destination_longitude: number;
      vehicle_category: VehicleCategory;
      promo_code?: string;
      ride_type?: string;
      payment_method?: string;
      idempotency_key?: string;
      scheduled_for?: string;
      use_voucher?: boolean;
    }) =>
      apiRequest<RideBooking>('/rides', {
        method: 'POST',
        headers: payload.idempotency_key ? { 'Idempotency-Key': payload.idempotency_key } : undefined,
        body: JSON.stringify(payload),
      }),

    getScheduledRides: () => apiRequest<RideBooking[]>('/rides/scheduled'),

    dispatchScheduledRides: (windowMinutes: number = 20) =>
      apiRequest<{ success: boolean; dispatched_count: number }>(
        `/rides/dispatch-scheduled?window_minutes=${windowMinutes}`,
        { method: 'POST' }
      ),

    getActiveRide: () => apiRequest<RideBooking | null>('/rides/active'),

    getRideDetails: (rideId: string) => apiRequest<RideBooking>(`/rides/${rideId}`),

    acceptRide: (rideId: string) =>
      apiRequest<RideBooking>(`/rides/${rideId}/accept`, {
        method: 'POST',
      }),

    rejectRide: (rideId: string) =>
      apiRequest<{ status: string; ride_id: string }>(`/rides/${rideId}/reject`, {
        method: 'POST',
      }),

    markArrived: (rideId: string) =>
      apiRequest<RideBooking>(`/rides/${rideId}/arrived`, {
        method: 'POST',
      }),

    verifyOtpAndStart: (rideId: string, otp: string) =>
      apiRequest<RideBooking>(`/rides/${rideId}/start`, {
        method: 'POST',
        body: JSON.stringify({ otp }),
      }),

    completeRide: (rideId: string, actualDistanceKm?: number) =>
      apiRequest<RideBooking>(`/rides/${rideId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ actual_distance_km: actualDistanceKm }),
      }),

    cancelRide: (rideId: string, reason?: string) =>
      apiRequest<RideBooking>(`/rides/${rideId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    boostFare: (rideId: string, boostAmount: number) =>
      apiRequest<RideBooking>(`/rides/${rideId}/boost-fare`, {
        method: 'POST',
        body: JSON.stringify({ boost_amount: boostAmount }),
      }),

    getLiveTracking: (rideId: string) => apiRequest<any>(`/rides/${rideId}/tracking`),

    getHistory: (limit: number = 20) =>
      apiRequest<RideBooking[]>(`/rides/history/list?limit=${limit}`),
  },

  payments: {
    createOrder: (rideId: string, method: string = 'razorpay') =>
      apiRequest<{
        order_id: string | null;
        amount: number;
        currency: string;
        key_id?: string;
        method: string;
        status: string;
        ride_id: string;
      }>('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ ride_id: rideId, method }),
      }),

    verifySignature: (payload: {
      ride_id: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) =>
      apiRequest<{ status: string; message: string; payment_id: string; amount: number }>(
        '/payments/verify-signature',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),

    confirmCash: (rideId: string) =>
      apiRequest<{ status: string; message: string; amount: number; method: string }>(
        '/payments/confirm-cash',
        {
          method: 'POST',
          body: JSON.stringify({ ride_id: rideId }),
        }
      ),
  },

  rider: {
    toggleStatus: (isOnline: boolean, lat?: number, lng?: number) =>
      apiRequest<{ is_online: boolean; is_busy: boolean; message: string }>('/rider/status', {
        method: 'POST',
        body: JSON.stringify({
          is_online: isOnline,
          current_latitude: lat,
          current_longitude: lng,
        }),
      }),

    updateLocation: (latitude: number, longitude: number, heading?: number, speed?: number) =>
      apiRequest<{ status: string }>('/rider/location', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, heading, speed }),
      }),

    getRequests: () => apiRequest<IncomingRideRequest[]>('/rider/requests'),

    getDashboard: () =>
      apiRequest<{
        rider_id: string;
        full_name: string;
        phone_number: string;
        approval_status: RiderApprovalStatus;
        is_online: boolean;
        is_busy: boolean;
        rating: number;
        total_completed_trips: number;
        total_earnings: number;
        today_earnings?: number;
        today_trips?: number;
        wallet_balance?: number;
        operating_city?: string;
        vehicle?: { category: string; plate: string; model: string };
        vehicles?: Array<{ category: string; plate: string; model: string; is_active: boolean }>;
        documents?: { license: string; rc_book: string; insurance: string; police_verification: string };
      }>('/rider/dashboard'),

    simulateRequest: () =>
      apiRequest<{ status: string; ride_id: string; otp: string }>('/rider/simulate-request', {
        method: 'POST',
      }),

    switchVehicle: (category: string) =>
      apiRequest<{ status: string; active_category: string }>('/rider/switch-vehicle', {
        method: 'POST',
        body: JSON.stringify({ category }),
      }),

    requestPayout: (amount: number, upi_id?: string) =>
      apiRequest<{ status: string; transfer_id: string; amount: number; message: string }>('/rider/payout', {
        method: 'POST',
        body: JSON.stringify({ amount, upi_id }),
      }),

    getEarningsSummary: () =>
      apiRequest<{
        daily: { gross_earnings: number; net_payout: number; trips_count: number };
        weekly: { gross_earnings: number; net_payout: number; trips_count: number };
        monthly: { gross_earnings: number; net_payout: number; trips_count: number };
        lifetime: { gross_earnings: number; wallet_balance: number; total_trips: number };
        platform_commission_rate: number;
        driver_share_rate: number;
      }>('/rider/earnings-summary'),

    getDocuments: () =>
      apiRequest<Array<{ id: string; document_type: string; is_verified: boolean; verification_notes?: string; uploaded_at: string }>>('/rider/documents/list'),

    createSupportTicket: (subject: string, description: string, ride_id?: string) =>
      apiRequest<{ status: string; ticket_id: string; subject: string; ticket_status: string }>('/rider/support/ticket', {
        method: 'POST',
        body: JSON.stringify({ subject, description, ride_id }),
      }),

    getSupportTickets: () =>
      apiRequest<Array<{ id: string; subject: string; description: string; status: string; created_at: string }>>('/rider/support/tickets'),

    getCampusProfile: () =>
      apiRequest<{
        rider_service_type: string;
        served_universities: string;
        full_name: string;
        phone_number: string;
        is_approved: boolean;
      }>('/rider/campus-profile'),

    updateCampusProfile: (payload: { rider_service_type: string; served_universities: string }) =>
      apiRequest<{
        success: boolean;
        rider_service_type: string;
        served_universities: string;
        message: string;
      }>('/rider/campus-profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    getCampusStudentRequests: () =>
      apiRequest<import('../types').PassengerRideRequestItem[]>('/rider/campus/student-requests'),
  },

  admin: {
    getOverview: () =>
      apiRequest<{
        passengers: number;
        riders: { total: number; pending_approvals: number; online: number };
        trips: { total: number; active: number; completed: number };
        revenue: { total_gross_inr: number; platform_commission_20pct: number };
      }>('/admin/overview'),

    getRiders: (statusFilter?: string) =>
      apiRequest<any[]>(`/admin/riders${statusFilter ? `?status_filter=${statusFilter}` : ''}`),

    updateRiderStatus: (riderUserId: string, status: RiderApprovalStatus, reason?: string) =>
      apiRequest<any>(`/admin/riders/${riderUserId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      }),

    getRides: (statusFilter?: RideStatus, limit: number = 50) =>
      apiRequest<any[]>(`/admin/rides?limit=${limit}${statusFilter ? `&status_filter=${statusFilter}` : ''}`),

    getFestival: () =>
      apiRequest<FestivalCampaign>('/admin/festival'),

    updateFestival: (campaign: Partial<FestivalCampaign>) =>
      apiRequest<FestivalCampaign>('/admin/festival', {
        method: 'POST',
        body: JSON.stringify(campaign),
      }),

    deleteFestival: () =>
      apiRequest<{ success: boolean; message: string }>('/admin/festival', {
        method: 'DELETE',
      }),

    getCarpools: (statusFilter?: string) =>
      apiRequest<any[]>(`/admin/carpools${statusFilter ? `?status_filter=${statusFilter}` : ''}`),

    moderateCarpool: (rideId: string, action: string, reason: string) =>
      apiRequest<{ success: boolean; ride_id: string; status: string; message: string }>(
        `/admin/carpools/${rideId}/moderate`,
        {
          method: 'POST',
          body: JSON.stringify({ action, reason }),
        }
      ),

    getScheduledRides: () => apiRequest<any[]>('/admin/scheduled-rides'),

    getCampusVehicles: (statusFilter?: string) =>
      apiRequest<any[]>(`/admin/campus-vehicles${statusFilter ? `?status_filter=${statusFilter}` : ''}`),

    getCampusDrivers: () => apiRequest<any[]>('/admin/campus-drivers'),

    updateCampusVehicleStatus: (profileId: string, status: string, notes?: string) =>
      apiRequest<{ success: boolean; new_status: string; message: string }>(
        `/admin/campus-vehicles/${profileId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status, notes }),
        }
      ),

    getPromoCodes: () => apiRequest<any[]>('/admin/promo-codes'),

    createPromoCode: (payload: { code: string; discount_percent: number; max_discount_amount?: number; min_order_amount?: number; description?: string }) =>
      apiRequest<{ success: boolean; message: string; promo: any }>('/admin/promo-codes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    togglePromoCode: (codeId: string) =>
      apiRequest<{ success: boolean; id: string; code: string; is_active: boolean; message: string }>(
        `/admin/promo-codes/${codeId}/toggle`,
        { method: 'PUT' }
      ),

    deletePromoCode: (codeId: string) =>
      apiRequest<{ success: boolean; message: string }>(`/admin/promo-codes/${codeId}`, {
        method: 'DELETE',
      }),

    getLoyaltyConfig: () =>
      apiRequest<{
        new_user_discount: {
          discount_percent: number;
          max_discount_amount: number;
          is_active: boolean;
          description: string;
        };
        tiers: any[];
      }>('/admin/loyalty/config'),

    updateLoyaltyConfig: (payload: {
      discount_percent?: number;
      max_discount_amount?: number;
      is_active?: boolean;
      description?: string;
    }) =>
      apiRequest<{ success: boolean; message: string; config: any }>('/admin/loyalty/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    getLoyaltyUsers: () =>
      apiRequest<any[]>('/admin/loyalty/users'),

    grantVoucher: (userId: string, voucherCount: number = 1) =>
      apiRequest<{ success: boolean; message: string; free_rides_vouchers: number }>(
        '/admin/loyalty/grant-voucher',
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, voucher_count: voucherCount }),
        }
      ),

    setUserTrips: (userId: string, totalTrips: number) =>
      apiRequest<{ success: boolean; message: string; total_trips: number; tier: string }>(
        '/admin/loyalty/set-user-trips',
        {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, total_trips: totalTrips }),
        }
      ),
  },

  loyalty: {
    getMyTier: () =>
      apiRequest<{
        user_id: string;
        full_name: string;
        completed_rides: number;
        free_rides_vouchers: number;
        total_discount_saved: number;
        tier_code: string;
        tier_name: string;
        badge_title: string;
        badge_icon: string;
        badge_color: string;
        discount_percent: number;
        is_first_ride: boolean;
        next_tier_name: string | null;
        next_tier_target: number;
        rides_needed_for_next_tier: number;
        progress_percent: number;
        perks: string[];
        is_permanent_member: boolean;
        swags_eligible: boolean;
      }>('/loyalty/my-tier'),

    getTierRules: () =>
      apiRequest<any>('/loyalty/tier-rules'),
  },


  festival: {
    getPublic: () =>
      apiRequest<{ active: boolean; campaign: FestivalCampaign | null }>('/fare/festival'),
  },

  communityRides: {
    list: (
      paramsOrQuery?:
        | string
        | {
            destinationQuery?: string;
            universityQuery?: string;
            categoryType?: string;
            genderFilter?: string;
            timeRange?: string;
            sortOrder?: string;
            pickup_lat?: number;
            pickup_lng?: number;
            dest_lat?: number;
            dest_lng?: number;
            seats?: number;
            date_filter?: string;
          }
    ) => {
      const q = new URLSearchParams();
      if (typeof paramsOrQuery === 'string') {
        if (paramsOrQuery) q.append('destination_query', paramsOrQuery);
      } else if (paramsOrQuery) {
        if (paramsOrQuery.destinationQuery) q.append('destination_query', paramsOrQuery.destinationQuery);
        if (paramsOrQuery.universityQuery) q.append('university_query', paramsOrQuery.universityQuery);
        if (paramsOrQuery.categoryType) q.append('category_type', paramsOrQuery.categoryType);
        if (paramsOrQuery.genderFilter) q.append('gender_filter', paramsOrQuery.genderFilter);
        if (paramsOrQuery.timeRange) q.append('time_range', paramsOrQuery.timeRange);
        if (paramsOrQuery.sortOrder) q.append('sort_order', paramsOrQuery.sortOrder);
        if (paramsOrQuery.pickup_lat != null) q.append('pickup_lat', paramsOrQuery.pickup_lat.toString());
        if (paramsOrQuery.pickup_lng != null) q.append('pickup_lng', paramsOrQuery.pickup_lng.toString());
        if (paramsOrQuery.dest_lat != null) q.append('dest_lat', paramsOrQuery.dest_lat.toString());
        if (paramsOrQuery.dest_lng != null) q.append('dest_lng', paramsOrQuery.dest_lng.toString());
        if (paramsOrQuery.seats != null) q.append('seats', paramsOrQuery.seats.toString());
        if (paramsOrQuery.date_filter) q.append('date_filter', paramsOrQuery.date_filter);
      }
      const qs = q.toString();
      return apiRequest<CommunityRide[]>(`/community-rides${qs ? `?${qs}` : ''}`);
    },

    create: (payload: {
      pickup_address: string;
      pickup_latitude?: number;
      pickup_longitude?: number;
      destination_address: string;
      destination_latitude?: number;
      destination_longitude?: number;
      departure_time: string;
      departure_datetime?: string;
      price_per_seat: number;
      total_seats?: number;
      vehicle_info?: string;
      vehicle_type?: string;
      pickup_flexibility_km?: number;
      dropoff_flexibility_km?: number;
      instant_booking?: boolean;
      university_name?: string;
      university_short_name?: string;
      category_type?: string;
      poster_gender?: string;
      luggage_policy?: string;
      notes?: string;
    }) =>
      apiRequest<CommunityRide>('/community-rides', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    reserve: (
      rideId: string,
      seatsToBook: number = 1,
      pickupNotes?: string,
      lat?: number,
      lng?: number,
      passengerName?: string,
      passengerPhone?: string
    ) =>
      apiRequest<{
        success: boolean;
        booking_id: string;
        reservation_status: string;
        seats_reserved: number;
        price_per_seat: number;
        total_fare: number;
        platform_fee: number;
        driver_collection: number;
        remaining_seats: number;
        host_name: string;
        host_phone: string;
        pickup_address: string;
        destination_address: string;
        departure_time: string;
        message: string;
      }>(`/community-rides/${rideId}/reserve`, {
        method: 'POST',
        body: JSON.stringify({
          seats_to_book: seatsToBook,
          pickup_notes: pickupNotes,
          passenger_pickup_lat: lat,
          passenger_pickup_lng: lng,
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
        }),
      }),

    join: (
      rideId: string,
      seatsToBook: number = 1,
      pickupNotes?: string,
      passengerName?: string,
      passengerPhone?: string
    ) =>
      apiRequest<{
        success: boolean;
        booking_id: string;
        total_fare: number;
        remaining_seats: number;
        message: string;
      }>(`/community-rides/${rideId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          seats_to_book: seatsToBook,
          pickup_notes: pickupNotes,
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
        }),
      }),

    cancelReservation: (bookingId: string, reason?: string) =>
      apiRequest<{ success: boolean; message: string; remaining_seats: number }>(
        `/community-rides/bookings/${bookingId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      ),

    respondReservation: (bookingId: string, action: 'ACCEPT' | 'REJECT') =>
      apiRequest<{ success: boolean; booking_id: string; status: string; message: string }>(
        `/community-rides/bookings/${bookingId}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        }
      ),

    getMyPostedRides: () => apiRequest<CommunityRide[]>('/community-rides/my-posted'),

    getMyBookings: () => apiRequest<MyReservationItem[]>('/community-rides/my-bookings'),

    updateRideStatus: (rideId: string, status: string) =>
      apiRequest<{ success: boolean; ride_id: string; new_status: string; message: string }>(
        `/community-rides/${rideId}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ status }),
        }
      ),

    delete: (rideId: string) =>
      apiRequest<{ message: string; success?: boolean; new_status?: string }>(`/community-rides/${rideId}`, {
        method: 'DELETE',
      }),

    update: (rideId: string, payload: any) =>
      apiRequest<CommunityRide>(`/community-rides/${rideId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    registerVehicle: (payload: {
      license_number: string;
      vehicle_plate: string;
      vehicle_type: string;
      vehicle_model?: string;
    }) =>
      apiRequest<{ success: boolean; message: string; profile: any }>('/community-rides/register-vehicle', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getMyVehicle: () =>
      apiRequest<{ registered: boolean; profile: any }>('/community-rides/my-vehicle'),

    finishRide: (rideId: string) =>
      apiRequest<{ success: boolean; ride_id: string; status: string; message: string }>(
        `/community-rides/${rideId}/finish`,
        { method: 'POST' }
      ),
  },

  campusRides: {
    getUniversities: (params?: { city?: string; state?: string; query?: string }) => {
      const q = new URLSearchParams();
      if (params?.city) q.set('city', params.city);
      if (params?.state) q.set('state', params.state);
      if (params?.query) q.set('query', params.query);
      const str = q.toString();
      return apiRequest<University[]>(`/campus-rides/universities${str ? `?${str}` : ''}`);
    },

    createUniversity: (payload: { name: string; short_name?: string; city?: string; state?: string }) =>
      apiRequest<University>('/campus-rides/universities', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getCampuses: (universityId: string) =>
      apiRequest<Campus[]>(`/campus-rides/universities/${universityId}/campuses`),

    getCampusDetails: (campusId: string) =>
      apiRequest<Campus>(`/campus-rides/campuses/${campusId}`),

    listRides: (params?: {
      university_id?: string;
      university_query?: string;
      campus_id?: string;
      pickup_query?: string;
      dest_query?: string;
      travel_date?: string;
      time_window?: string;
      vehicle_type?: string;
      gender_filter?: string;
      category_type?: string;
      seats?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.university_id) q.set('university_id', params.university_id);
      if (params?.university_query) q.set('university_query', params.university_query);
      if (params?.campus_id) q.set('campus_id', params.campus_id);
      if (params?.pickup_query) q.set('pickup_query', params.pickup_query);
      if (params?.dest_query) q.set('dest_query', params.dest_query);
      if (params?.travel_date) q.set('travel_date', params.travel_date);
      if (params?.time_window) q.set('time_window', params.time_window);
      if (params?.vehicle_type) q.set('vehicle_type', params.vehicle_type);
      if (params?.gender_filter) q.set('gender_filter', params.gender_filter);
      if (params?.category_type) q.set('category_type', params.category_type);
      if (params?.seats) q.set('seats', String(params.seats));
      const str = q.toString();
      return apiRequest<CampusRideItem[]>(`/campus-rides${str ? `?${str}` : ''}`);
    },

    postRide: (payload: {
      pickup_address: string;
      pickup_latitude?: number;
      pickup_longitude?: number;
      destination_address: string;
      destination_latitude?: number;
      destination_longitude?: number;
      departure_time: string;
      departure_datetime?: string;
      travel_date?: string;
      price_per_seat: number;
      total_seats: number;
      vehicle_type?: string;
      vehicle_info?: string;
      university_id?: string;
      campus_id?: string;
      university_name?: string;
      category_type?: string;
      is_daily?: boolean;
      gender_preference?: string;
      intermediate_stops?: string[];
      recurring_days?: string;
      return_trip_time?: string;
      notes?: string;
      instant_booking?: boolean;
    }) =>
      apiRequest<{ success: boolean; message: string; ride_id: string; available_seats: number; status: string }>(
        '/campus-rides',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),

    bookSeat: (rideId: string, payload: { seats_to_book: number; travel_date?: string; pickup_notes?: string }) =>
      apiRequest<{
        success: boolean;
        booking_id: string;
        ride_id: string;
        seats_booked: number;
        total_fare: number;
        status: string;
        message: string;
      }>(`/campus-rides/${rideId}/book`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getMyBookings: () =>
      apiRequest<
        Array<{
          booking_id: string;
          ride_id: string;
          status: string;
          seats_booked: number;
          total_fare: number;
          created_at: string;
          ride?: {
            pickup_address: string;
            destination_address: string;
            departure_time: string;
            vehicle_type: string;
            vehicle_info: string;
            driver_name: string;
            driver_phone: string;
            university_name?: string;
            status: string;
          };
        }>
      >('/campus-rides/my-bookings'),

    getMyPosted: () =>
      apiRequest<
        Array<{
          id: string;
          pickup_address: string;
          destination_address: string;
          departure_time: string;
          price_per_seat: number;
          available_seats: number;
          total_seats: number;
          vehicle_type: string;
          vehicle_info: string;
          status: string;
          university_name?: string;
          bookings: Array<{
            booking_id: string;
            passenger_name: string;
            passenger_phone: string;
            seats_booked: number;
            total_fare: number;
            status: string;
          }>;
          created_at: string;
        }>
      >('/campus-rides/my-posted'),

    getAlerts: () => apiRequest<CampusRideAlert[]>('/campus-rides/alerts'),

    createAlert: (payload: {
      university_id?: string;
      campus_id?: string;
      pickup_text: string;
      destination_text: string;
      travel_date?: string;
      preferred_time_window?: string;
      seats_needed?: number;
    }) =>
      apiRequest<{ success: boolean; message: string; alert_id: string }>('/campus-rides/alerts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    toggleAlert: (alertId: string, active: boolean) =>
      apiRequest<{ success: boolean; alert_id: string; is_active: boolean }>(
        `/campus-rides/alerts/${alertId}?active=${active}`,
        { method: 'PATCH' }
      ),

    deleteAlert: (alertId: string) =>
      apiRequest<{ success: boolean; message: string }>(`/campus-rides/alerts/${alertId}`, {
        method: 'DELETE',
      }),

    getStudentProfile: () => apiRequest<StudentProfile>('/campus-rides/student-profile'),

    updateStudentProfile: (payload: {
      university_id?: string;
      campus_id?: string;
      student_id_number?: string;
      student_id_photo?: string;
      student_status?: string;
      college_department?: string;
    }) =>
      apiRequest<{ success: boolean; message: string; verification_status: string }>(
        '/campus-rides/student-profile',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),

    acceptBooking: (bookingId: string) =>
      apiRequest<{ success: boolean; message: string; status: string; available_seats?: number }>(
        `/campus-rides/bookings/${bookingId}/accept`,
        { method: 'POST' }
      ),

    rejectBooking: (bookingId: string) =>
      apiRequest<{ success: boolean; message: string; status: string }>(
        `/campus-rides/bookings/${bookingId}/reject`,
        { method: 'POST' }
      ),

    cancelBooking: (bookingId: string) =>
      apiRequest<{ success: boolean; message: string; status: string }>(
        `/campus-rides/bookings/${bookingId}/cancel`,
        { method: 'POST' }
      ),

    getPassengerRequests: (params?: { university_id?: string; campus_id?: string; travel_date?: string }) => {
      const q = new URLSearchParams();
      if (params?.university_id) q.set('university_id', params.university_id);
      if (params?.campus_id) q.set('campus_id', params.campus_id);
      if (params?.travel_date) q.set('travel_date', params.travel_date);
      const str = q.toString();
      return apiRequest<import('../types').PassengerRideRequestItem[]>(`/campus-rides/passenger-requests${str ? `?${str}` : ''}`);
    },

    createPassengerRequest: (payload: {
      pickup_address: string;
      destination_address: string;
      travel_date: string;
      preferred_time: string;
      passengers_count?: number;
      max_budget_per_seat?: number;
      university_id?: string;
      campus_id?: string;
      notes?: string;
    }) =>
      apiRequest<{ success: boolean; message: string; request_id: string }>('/campus-rides/passenger-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    deletePassengerRequest: (requestId: string) =>
      apiRequest<{ success: boolean; message: string }>(`/campus-rides/passenger-requests/${requestId}`, {
        method: 'DELETE',
      }),
  },
};
