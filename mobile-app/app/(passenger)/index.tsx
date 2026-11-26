import '../../src/utils/suppressWarnings';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { api } from '../../src/services/api';
import { wsService } from '../../src/services/websocket';
import { MapCanvas } from '../../src/components/MapCanvas';
import { LocationSearchPanel } from '../../src/components/LocationSearchPanel';
import { VehicleSelector } from '../../src/components/VehicleSelector';
import { MatchingRadar } from '../../src/components/MatchingRadar';
import { parseUtcDate } from '../../src/utils/date';
import { ActiveRideCard } from '../../src/components/ActiveRideCard';
import { FestivalMiniPopup } from '../../src/components/FestivalMiniPopup';
import { DiyaAnimationBanner } from '../../src/components/DiyaAnimationBanner';
import { ForYouGrid } from '../../src/components/ForYouGrid';
import { ActivityTab } from '../../src/components/ActivityTab';
import { AccountTab } from '../../src/components/AccountTab';
import { ServicesTab } from '../../src/components/ServicesTab';
import { CommunityRidesPanel } from '../../src/components/CommunityRidesPanel';
import { CampusRidePanel } from '../../src/components/CampusRidePanel';
import { FounderStoryModal } from '../../src/components/FounderStoryModal';
import { PlayStoreComingSoonModal } from '../../src/components/PlayStoreComingSoonModal';
import { VehicleCategory, RideBooking } from '../../src/types';
const RIDE_STATUS_RANK: Record<string, number> = {
  SEARCHING_FOR_RIDER: 1,
  REQUESTS_SENT: 2,
  EXPANDING_SEARCH: 3,
  RIDER_ASSIGNED: 4,
  RIDER_ARRIVING: 5,
  RIDER_ARRIVED: 6,
  OTP_VERIFICATION: 7,
  IN_PROGRESS: 8,
  COMPLETED: 9,
  CANCELLED: 10,
  NO_RIDER_AVAILABLE: 10,
};

export default function PassengerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [isWsConnected, setIsWsConnected] = useState(wsService.isConnected());
  const [founderModalVisible, setFounderModalVisible] = useState(false);
  const [playStoreModalVisible, setPlayStoreModalVisible] = useState(false);

  const { user, isAuthenticated, logout } = useAuthStore();

  // Route boundary security: Only passengers can view this screen
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    if (user?.role === 'rider') {
      router.replace('/(rider)');
      return;
    }
    if (user?.role === 'admin') {
      router.replace('/(admin)');
      return;
    }
  }, [isAuthenticated, user]);
  const {
    pickup,
    destination,
    selectedCategory,
    estimates,
    routeGeometry,
    distanceKm,
    durationMins,
    activeBooking,
    driverLocation,
    driverToPickupRoute,
    isSearching,
    searchRadiusKm,
    setPickup,
    setDestination,
    swapLocations,
    setSelectedCategory,
    setFareEstimates,
    setDriverToPickupRoute,
    setActiveBooking,
    updateBookingStatus,
    updateDriverLocation,
    setDriverOffline,
    resetBooking,
  } = useRideStore();

  const activeBookingRef = useRef<RideBooking | null>(null);
  activeBookingRef.current = activeBooking;
  const isFetchingAuthoritativeRef = useRef(false);

  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const [searchModalType, setSearchModalType] = useState<'pickup' | 'destination' | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isLocationExpanded, setIsLocationExpanded] = useState(false);
  const [rideType, setRideType] = useState<'daily' | 'campus_rides' | 'package' | 'rentals'>('daily');
  const [showRentalsModal, setShowRentalsModal] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash on Drop');
  const [bottomNavTab, setBottomNavTab] = useState<'home' | 'campus' | 'services' | 'activity' | 'account'>('home');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [upcomingScheduledRides, setUpcomingScheduledRides] = useState<RideBooking[]>([]);

  // User Loyalty Tier & Voucher state
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    tierCode?: string;
    tierName?: string;
    badgeTitle?: string;
    autoDiscount?: string;
    vouchersCount?: number;
  }>({});
  const [useVoucher, setUseVoucher] = useState(false);


  // Custom Date & Time Schedule Picker
  const [scheduleDateChoice, setScheduleDateChoice] = useState<'today' | 'tomorrow' | 'day_after'>('tomorrow');
  const [scheduleHour, setScheduleHour] = useState('09');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [scheduleAmPm, setScheduleAmPm] = useState<'AM' | 'PM'>('AM');

  const handleConfirmCustomSchedule = () => {
    const targetDate = new Date();
    if (scheduleDateChoice === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (scheduleDateChoice === 'day_after') {
      targetDate.setDate(targetDate.getDate() + 2);
    }
    let hr = parseInt(scheduleHour, 10) || 9;
    if (scheduleAmPm === 'PM' && hr < 12) hr += 12;
    if (scheduleAmPm === 'AM' && hr === 12) hr = 0;
    const min = parseInt(scheduleMinute, 10) || 0;
    targetDate.setHours(hr, min, 0, 0);

    if (targetDate.getTime() <= Date.now() + 15 * 60 * 1000) {
      Alert.alert('Invalid Schedule Time', 'Scheduled trip time must be at least 15 minutes in the future.');
      return;
    }

    const iso = targetDate.toISOString();
    setShowScheduleModal(false);
    handleConfirmBooking(iso);
  };

  const fetchUpcomingScheduled = async () => {
    try {
      const data = await api.rides.getScheduledRides();
      setUpcomingScheduledRides(data || []);
    } catch (e) {
      console.warn('Could not load scheduled rides:', e);
    }
  };

  const [isBoostingFare, setIsBoostingFare] = useState(false);

  const handleBoostFare = async (newBoostAmount: number) => {
    if (!activeBooking) return;
    setIsBoostingFare(true);
    try {
      const updated = await api.rides.boostFare(activeBooking.id, newBoostAmount);
      setActiveBooking(updated);
    } catch (err: any) {
      Alert.alert('Fare Boost', err.message || 'Failed to update fare boost');
    } finally {
      setIsBoostingFare(false);
    }
  };

  const handleTogglePaymentMethod = () => {
    const methods = ['Cash on Drop', 'UPI / QR', 'IndiRide Wallet'];
    const nextIdx = (methods.indexOf(paymentMethod) + 1) % methods.length;
    setPaymentMethod(methods[nextIdx]);
  };

  // Default initial pickup (Indiranagar Bangalore)
  useEffect(() => {
    if (!pickup) {
      setPickup({
        address: '100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038',
        latitude: 12.9716,
        longitude: 77.6412,
      });
    }
  }, []);

  // Poll active ride on mount for persistent state across page refreshes
  useEffect(() => {
    async function fetchActiveRide() {
      try {
        const active = await api.rides.getActiveRide();
        if (active) {
          if (active.status === 'NO_RIDER_AVAILABLE' || active.status === 'CANCELLED' || active.status === 'COMPLETED') {
            resetBooking();
            return;
          }
          if (active.created_at && ['SEARCHING_FOR_RIDER', 'REQUESTS_SENT', 'EXPANDING_SEARCH'].includes(active.status)) {
            const elapsedSec = (Date.now() - parseUtcDate(active.created_at)) / 1000;
            if (elapsedSec > 600) {
              resetBooking();
              return;
            }
          }
          setActiveBooking(active);
          if (active.pickup_latitude && active.pickup_longitude) {
            setPickup({
              address: active.pickup_address,
              latitude: active.pickup_latitude,
              longitude: active.pickup_longitude,
            });
          }
          if (active.destination_latitude && active.destination_longitude) {
            setDestination({
              address: active.destination_address,
              latitude: active.destination_latitude,
              longitude: active.destination_longitude,
            });
          }
          if (active.rider?.current_latitude && active.rider?.current_longitude) {
            updateDriverLocation(
              active.rider.current_latitude,
              active.rider.current_longitude,
              active.rider.heading || 0,
              active.rider.speed || 0,
              active.rider.pickup_eta_mins,
              active.rider.is_stale,
              active.rider.last_location_update
            );
          }
        } else {
          resetBooking();
        }
      } catch (e) {
        console.error('Error fetching active ride:', e);
      }
    }
    fetchActiveRide();
    fetchUpcomingScheduled();
  }, []);

  // Listen for real-time WebSocket events and maintain REST fallback synchronization
  useEffect(() => {
    // 1. Connection status monitoring and authoritative reconnect sync
    const unbindConn = wsService.subscribe('connection_status', (data) => {
      setIsWsConnected(data.connected);
      if (data.connected && data.isReconnect) {
        if (isFetchingAuthoritativeRef.current) return;
        isFetchingAuthoritativeRef.current = true;
        console.log('[WS Passenger] Reconnected to dispatch. Re-fetching authoritative booking state...');
        api.rides.getActiveRide().then((active) => {
          if (active) {
            setActiveBooking(active);
          }
        }).catch((e) => console.warn('Error refetching active ride on reconnect:', e))
          .finally(() => {
            isFetchingAuthoritativeRef.current = false;
          });
      }
    });

    // 2. Incoming state transitions with out-of-order regression guards
    const unbindAccepted = wsService.subscribe('ride_accepted', (data) => {
      console.log('[WS] Ride accepted by driver:', data);
      const curBooking = activeBookingRef.current;
      if (curBooking && curBooking.id === data.ride_id) {
        const curRank = RIDE_STATUS_RANK[curBooking.status] || 0;
        const newRank = RIDE_STATUS_RANK[data.status || 'RIDER_ARRIVING'] || 0;
        if (newRank >= curRank) {
          setActiveBooking({
            ...curBooking,
            status: 'RIDER_ARRIVING',
            rider: data.rider,
            driver_to_pickup_route: data.driver_route,
            pickup_eta_mins: data.pickup_eta_mins,
          });
        }
      } else {
        api.rides.getRideDetails(data.ride_id).then((r) => setActiveBooking(r));
      }
      if (data.rider?.current_latitude && data.rider?.current_longitude) {
        updateDriverLocation(
          data.rider.current_latitude,
          data.rider.current_longitude,
          data.rider.heading || 0,
          data.rider.speed || 0,
          data.pickup_eta_mins,
          data.rider.is_stale,
          data.rider.last_location_update
        );
      }
      if (data.driver_route) {
        setDriverToPickupRoute(data.driver_route);
      }
    });

    const unbindLocation = wsService.subscribe('driver_location_update', (data) => {
      const eta = data.destination_eta_mins || data.eta_mins || data.pickup_eta_mins;
      updateDriverLocation(
        data.latitude,
        data.longitude,
        data.heading,
        data.speed,
        eta,
        data.is_stale,
        data.last_updated_at
      );
    });

    const unbindOffline = wsService.subscribe('driver_offline_alert', (data) => {
      console.log('[WS] Driver offline alert:', data);
      setDriverOffline(true);
    });

    const unbindArrived = wsService.subscribe('rider_arrived', (data) => {
      const curBooking = activeBookingRef.current;
      const curRank = curBooking ? RIDE_STATUS_RANK[curBooking.status] || 0 : 0;
      if (curRank <= RIDE_STATUS_RANK.RIDER_ARRIVED) {
        updateBookingStatus('RIDER_ARRIVED');
        Alert.alert('Driver Arrived!', 'Your driver has arrived at the pickup location. Share your 4-digit PIN.');
      }
    });

    const unbindTripStarted = wsService.subscribe('trip_started', (data) => {
      updateBookingStatus('IN_PROGRESS');
      if (data.ride_id) {
        api.rides.getRideDetails(data.ride_id).then((r) => {
          setActiveBooking(r);
        });
      }
    });

    const unbindTripCompleted = wsService.subscribe('trip_completed', (data) => {
      updateBookingStatus('COMPLETED');
      if (data.ride_id) {
        api.rides.getRideDetails(data.ride_id).then((r) => {
          setActiveBooking(r);
        });
      }
      const dist = data.actual_distance_km ? `${data.actual_distance_km} km` : '';
      const fare = Math.round(data.final_fare || 0);
      Alert.alert(
        'Trip Completed 🎉',
        `You have arrived safely at your destination!\n${dist ? `Billable Distance: ${dist}\n` : ''}Final Fare: ₹${fare}`
      );
    });

    const unbindExpanded = wsService.subscribe('ride_search_expanded', (data) => {
      console.log('[WS] Search radius expanded:', data);
      const curBooking = activeBookingRef.current;
      if (curBooking && curBooking.id === data.ride_id) {
        setActiveBooking({
          ...curBooking,
          status: 'EXPANDING_SEARCH',
          current_search_radius_km: data.search_radius_km || 3.0,
        });
      }
    });

    const unbindNoRider = wsService.subscribe('no_rider_available', (data) => {
      console.log('[WS] No rider available:', data);
      Alert.alert(
        'No Driver Available',
        data.reason || 'No nearby drivers were able to accept your ride within the matching window. Please try again shortly.'
      );
      resetBooking();
    });

    const unbindCancelled = wsService.subscribe('ride_cancelled', (data) => {
      Alert.alert('Ride Cancelled', data.reason || 'Ride was cancelled');
      resetBooking();
    });

    // 3. Fallback periodic REST polling (Never rely exclusively on push notifications)
    const fallbackPollTimer = setInterval(async () => {
      const curBooking = activeBookingRef.current;
      if (curBooking && curBooking.status !== 'COMPLETED' && curBooking.status !== 'CANCELLED') {
        if (isFetchingAuthoritativeRef.current) return;
        isFetchingAuthoritativeRef.current = true;
        try {
          const authoritative = await api.rides.getActiveRide();
          if (authoritative) {
            if (authoritative.status === 'NO_RIDER_AVAILABLE') {
              Alert.alert('No Driver Available', 'Matching window closed. Please try searching again.');
              resetBooking();
            } else if (authoritative.status !== curBooking.status) {
              console.log(`[REST Sync] State transition caught: ${curBooking.status} -> ${authoritative.status}`);
              setActiveBooking(authoritative);
            }
          } else {
            if (['SEARCHING_FOR_RIDER', 'REQUESTS_SENT', 'EXPANDING_SEARCH'].includes(curBooking.status)) {
              console.log('[REST Sync] Active search ended on server.');
              resetBooking();
            }
          }
        } catch (e) {
          // ignore transient poll error
        } finally {
          isFetchingAuthoritativeRef.current = false;
        }
      }
    }, 4000);

    return () => {
      unbindConn();
      unbindAccepted();
      unbindLocation();
      unbindOffline();
      unbindArrived();
      unbindTripStarted();
      unbindTripCompleted();
      unbindExpanded();
      unbindNoRider();
      unbindCancelled();
      clearInterval(fallbackPollTimer);
    };
  }, []);

  // Recalculate route and fares ONLY when BOTH pickup and destination are set
  useEffect(() => {
    if (pickup && destination) {
      async function calculateFares() {
        setCalculatingRoute(true);
        try {
          const resp = await api.fare.estimateFares(
            pickup!.latitude,
            pickup!.longitude,
            destination!.latitude,
            destination!.longitude,
            appliedPromo,
            rideType,
            useVoucher
          );
          setFareEstimates(
            resp.estimates,
            resp.distance_km,
            resp.duration_minutes,
            resp.route_geometry
          );
          if (resp.user_tier_code || resp.auto_discount_applied || resp.free_rides_vouchers !== undefined) {
            setLoyaltyInfo({
              tierCode: resp.user_tier_code,
              tierName: resp.user_tier_name,
              badgeTitle: resp.user_tier_badge,
              autoDiscount: resp.auto_discount_applied,
              vouchersCount: resp.free_rides_vouchers,
            });
          }
        } catch (err: any) {
          Alert.alert('Route Error', err.message || 'Could not calculate road route');
        } finally {
          setCalculatingRoute(false);
        }
      }
      calculateFares();
    }
  }, [pickup, destination, appliedPromo, rideType, useVoucher]);


  // Confirm and Create Booking
  const handleConfirmBooking = async (scheduleTime?: string) => {
    // 0. Single active ride rule check
    if (activeBooking && !['COMPLETED', 'CANCELLED', 'NO_RIDER_AVAILABLE'].includes(activeBooking.status)) {
      Alert.alert(
        'Ride in Progress 🛑',
        'Aapki ek ride already chal rahi hai. Ek passenger ek samay par kewal ek hi ride book kar sakta hai.'
      );
      return;
    }

    // Compulsory Mobile Phone Linking verification check
    if (!user?.phone_number || user.phone_number.startsWith('+00') || user.phone_number.length < 10) {
      Alert.alert(
        'Compulsory Mobile Verification',
        'Under Indian transport security regulations, you must link and verify an Indian mobile number (+91) before booking any ride.',
        [
          { text: 'Verify Mobile Now', onPress: () => router.replace('/(auth)/login') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (!pickup || !destination) {
      Alert.alert('Missing Location', 'Please select destination');
      return;
    }

    const targetSchedule = scheduleTime || scheduledFor || undefined;

    setBookingLoading(true);
    try {
      // Generate unique idempotency key for this booking request attempt
      const idempotencyKey = `book_${user?.id || 'pass'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const booking = await api.rides.createBooking({
        pickup_address: pickup.address,
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        destination_address: destination.address,
        destination_latitude: destination.latitude,
        destination_longitude: destination.longitude,
        vehicle_category: selectedCategory,
        promo_code: appliedPromo || undefined,
        ride_type: rideType,
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey,
        scheduled_for: targetSchedule,
        use_voucher: useVoucher,
      });

      if (!booking || !booking.id) {
        throw new Error('Server failed to create a persistent booking record.');
      }

      if (booking.status === 'SCHEDULED') {
        const readableTime = booking.scheduled_for
          ? new Date(booking.scheduled_for).toLocaleString()
          : 'scheduled time';
        Alert.alert(
          'Ride Scheduled Successfully! 🕒',
          `Your trip is confirmed for ${readableTime}. An available driver will be auto-dispatched prior to departure.`
        );
        setScheduledFor(null);
        setShowScheduleModal(false);
        fetchUpcomingScheduled();
      } else {
        setActiveBooking(booking);
      }
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  // Cancel Active Booking
  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    try {
      const cancelled = await api.rides.cancelRide(activeBooking.id, 'Passenger cancelled');
      if (cancelled.cancellation_fee && cancelled.cancellation_fee > 0) {
        Alert.alert(
          'Ride Cancelled',
          `Your ride was cancelled. A cancellation fee of ₹${cancelled.cancellation_fee} has been applied.`
        );
      } else {
        Alert.alert('Ride Cancelled', 'Your ride was cancelled with zero cancellation fees.');
      }
      resetBooking();
    } catch (err: any) {
      Alert.alert('Cancellation Status', err.message || 'Failed to cancel booking');
    }
  };

  // Quick Indian landmark picker
  const handleSelectQuickDest = (name: string, addr: string, lat: number, lng: number) => {
    setDestination({
      address: `${name}, ${addr}`,
      latitude: lat,
      longitude: lng,
    });
  };

  const handleMapLocationPick = async (lat: number, lng: number) => {
    try {
      const geo = await api.location.reverseGeocode(lat, lng);
      const loc = { address: geo.address, latitude: lat, longitude: lng };
      if (searchModalType === 'pickup') {
        setPickup(loc);
        if (!destination) {
          setSearchModalType('destination');
        } else {
          setSearchModalType(null);
        }
      } else {
        setDestination(loc);
        setSearchModalType(null);
      }
    } catch (e) {
      const loc = {
        address: `Selected Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        latitude: lat,
        longitude: lng,
      };
      if (searchModalType === 'pickup') {
        setPickup(loc);
        if (!destination) {
          setSearchModalType('destination');
        } else {
          setSearchModalType(null);
        }
      } else {
        setDestination(loc);
        setSearchModalType(null);
      }
    }
  };

  // 1-Click Rebook Handler from Activity Tab
  const handleRebookFromActivity = (
    rebookPickup: { address: string; latitude: number; longitude: number },
    rebookDest: { address: string; latitude: number; longitude: number },
    category: VehicleCategory
  ) => {
    setPickup(rebookPickup);
    setDestination(rebookDest);
    setSelectedCategory(category);
    setBottomNavTab('home');
  };

  if (!isAuthenticated || user?.role === 'rider' || user?.role === 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      {/* Top Mobile Passenger Header */}
      <View style={styles.topNavbar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>
            <Text style={{ color: '#2563EB' }}>Indi</Text>
            <Text style={{ color: '#ffffff' }}>Ride</Text>
          </Text>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>PASSENGER</Text>
          </View>
        </View>

        {/* Real-time Connection Status Indicator */}
        {!isWsConnected && (
          <View style={styles.reconnectingBadge}>
            <View style={styles.reconnectingDot} />
            <Text style={styles.reconnectingText}>Connecting...</Text>
          </View>
        )}

        {/* User Profile Pill & Logout */}
        <View style={styles.userControls}>
          <TouchableOpacity
            style={styles.profileChip}
            onPress={() => setBottomNavTab('account')}
            activeOpacity={0.75}
          >
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={13} color="#000000" />
            </View>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.full_name && user.full_name !== 'Rider User' && user.full_name.trim().toLowerCase() !== 'rider'
                ? user.full_name.split(' ')[0]
                : 'My Profile'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navLogoutBtn}
            onPress={() => {
              logout();
              router.replace('/(auth)/login');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Container switched by bottomNavTab */}
      <View style={[styles.mainTabContent, isDesktop && bottomNavTab !== 'home' && styles.desktopTabContainer]}>
        {bottomNavTab === 'campus' && (
          <CampusRidePanel
            onBack={() => setBottomNavTab('home')}
            onSelectRoutePreview={(oLat, oLng, dLat, dLng) => {
              setPickup({ address: 'Pickup Location', latitude: oLat, longitude: oLng });
              setDestination({ address: 'Campus Destination', latitude: dLat, longitude: dLng });
              setBottomNavTab('home');
            }}
          />
        )}

        {bottomNavTab === 'services' && (
          <ServicesTab
            onBack={() => setBottomNavTab('home')}
            onSelectVehicle={(category) => {
              setSelectedCategory(category);
              setBottomNavTab('home');
            }}
            onSelectRoutePreview={(oLat, oLng, dLat, dLng) => {
              setPickup({
                address: 'Pickup (Shared Community Route)',
                latitude: oLat,
                longitude: oLng,
              });
              setDestination({
                address: 'Dropoff (Shared Community Route)',
                latitude: dLat,
                longitude: dLng,
              });
              setBottomNavTab('home');
            }}
          />
        )}

        {bottomNavTab === 'activity' && (
          <ActivityTab
            onBack={() => setBottomNavTab('home')}
            onRebook={handleRebookFromActivity}
            onTrackActiveRide={() => setBottomNavTab('home')}
          />
        )}

        {bottomNavTab === 'account' && (
          <AccountTab onBack={() => setBottomNavTab('home')} />
        )}

        {bottomNavTab === 'home' && (
          <View style={[styles.contentLayout, isDesktop ? styles.desktopLayout : styles.mobileLayout]}>
            {/* Left Side: IndiRide Booking Panel */}
            <View
              style={[
                styles.panelDrawer,
                isDesktop
                  ? styles.desktopDrawer
                  : [styles.mobileDrawer, searchModalType ? styles.mobileDrawerExpanded : null],
                isMapFullScreen && styles.panelDrawerHidden,
              ]}
            >
              {searchModalType ? (
                <LocationSearchPanel
                  activeField={searchModalType}
                  pickup={pickup}
                  destination={destination}
                  onSelectPickup={(loc) => {
                    setPickup(loc);
                    if (!destination) {
                      setSearchModalType('destination');
                    } else {
                      setSearchModalType(null);
                    }
                  }}
                  onSelectDestination={(loc) => {
                    setDestination(loc);
                    setSearchModalType(null);
                  }}
                  onSwitchField={(field) => setSearchModalType(field)}
                  onSwapLocations={swapLocations}
                  onClose={() => setSearchModalType(null)}
                />
              ) : (
                <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
                  {/* Active Booking Card or Radar */}
                  {activeBooking ? (
                    <View style={styles.activeWrapper}>
                      {isSearching ? (
                        <MatchingRadar
                          searchRadiusKm={activeBooking.current_search_radius_km || searchRadiusKm}
                          initialSecondsElapsed={
                            activeBooking?.created_at
                              ? Math.max(0, Math.min(300, Math.floor((Date.now() - parseUtcDate(activeBooking.created_at)) / 1000)))
                              : 0
                          }
                          estimatedFare={activeBooking.estimated_fare}
                          boostAmount={activeBooking.boost_amount || 0}
                          onBoostFare={handleBoostFare}
                          isBoosting={isBoostingFare}
                          onCancel={handleCancelBooking}
                        />
                      ) : (
                        <ActiveRideCard booking={activeBooking} onCancel={handleCancelBooking} />
                      )}
                    </View>
                  ) : destination ? (
                    /* ROUTE & VEHICLE FARE REVIEW MODE (Shown ONLY after destination is chosen) */
                    <View style={styles.routeReviewWrapper}>
                      {/* Back button to return to clean home page without price */}
                      <TouchableOpacity
                        style={styles.reviewBackBtn}
                        onPress={() => setDestination(null)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="arrow-back" size={18} color="#000000" />
                        <Text style={styles.reviewBackText}>Change Destination / Back</Text>
                      </TouchableOpacity>

                      <Text style={styles.cardTitle}>Choose a Ride</Text>

                      {/* Selected Route Summary Box - Clickable rows to edit pickup or destination */}
                      <View style={styles.routeSummaryBox}>
                        <TouchableOpacity
                          style={styles.routeSummaryRow}
                          onPress={() => setSearchModalType('pickup')}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.summaryDot, { backgroundColor: '#10b981' }]} />
                          <Text style={styles.summaryAddress} numberOfLines={1}>
                            {pickup?.address || 'Set Pickup Location'}
                          </Text>
                          <Ionicons name="pencil" size={13} color="#64748b" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>

                        <View style={styles.summaryLine} />

                        <TouchableOpacity
                          style={styles.routeSummaryRow}
                          onPress={() => setSearchModalType('destination')}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.summaryDot, { backgroundColor: '#000000' }]} />
                          <Text style={[styles.summaryAddress, { fontWeight: '700' }]} numberOfLines={1}>
                            {destination?.address || 'Set Destination'}
                          </Text>
                          <Ionicons name="pencil" size={13} color="#64748b" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>

                        {distanceKm && (
                          <View style={styles.tripMetaRow}>
                            <View style={styles.tripMetaPill}>
                              <Ionicons name="speedometer-outline" size={12} color="#0284c7" />
                              <Text style={styles.tripMetaText}>{distanceKm} km</Text>
                            </View>
                            <View style={styles.tripMetaPill}>
                              <Ionicons name="time-outline" size={12} color="#0284c7" />
                              <Text style={styles.tripMetaText}>{durationMins} mins</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Route Calculating Spinner */}
                      {calculatingRoute && (
                        <View style={styles.calculatingRow}>
                          <ActivityIndicator size="small" color="#000000" />
                          <Text style={styles.calculatingText}>Calculating fastest route & fares...</Text>
                        </View>
                      )}

                      {/* Loyalty & 90% First-Ride Auto Discount Banner */}
                      {estimates.length > 0 && !!loyaltyInfo.autoDiscount && (
                        <View style={styles.autoDiscountBanner}>
                          <Ionicons name="sparkles" size={15} color="#db2777" />
                          <Text style={styles.autoDiscountBannerText}>{loyaltyInfo.autoDiscount}</Text>
                        </View>
                      )}

                      {/* Free Ride Voucher Toggle (If passenger has vouchers) */}
                      {estimates.length > 0 && (loyaltyInfo.vouchersCount || 0) > 0 && (
                        <TouchableOpacity
                          style={[styles.voucherToggleBtn, useVoucher && styles.voucherToggleBtnActive]}
                          onPress={() => setUseVoucher(!useVoucher)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="gift" size={16} color={useVoucher ? '#ffffff' : '#059669'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.voucherToggleTitle, useVoucher && styles.voucherToggleTitleActive]}>
                              {useVoucher ? '🎁 100% Free Ride Applied!' : `Apply Free Ride Voucher (${loyaltyInfo.vouchersCount} available)`}
                            </Text>
                            <Text style={[styles.voucherToggleSub, useVoucher && styles.voucherToggleSubActive]}>
                              {useVoucher ? 'Tap to remove voucher' : 'Tap to ride completely free'}
                            </Text>
                          </View>
                          <View style={[styles.voucherCheckbox, useVoucher && styles.voucherCheckboxActive]}>
                            {useVoucher && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* Vehicle Selection with calculated trip fares */}
                      {estimates.length > 0 && (
                        <VehicleSelector
                          estimates={estimates}
                          selectedCategory={selectedCategory}
                          onSelect={setSelectedCategory}
                          appliedPromo={appliedPromo}
                          paymentMethod={paymentMethod}
                          onTogglePaymentMethod={handleTogglePaymentMethod}
                        />
                      )}

                      {/* Big Bold Confirm Booking Button */}
                      {estimates.length > 0 && (
                        <>
                          <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={() => handleConfirmBooking()}
                            disabled={bookingLoading}
                            activeOpacity={0.85}
                          >
                            {bookingLoading ? (
                              <ActivityIndicator color="#ffffff" />
                            ) : (
                              <Text style={styles.confirmText}>
                                Confirm & Request {selectedCategory === 'bike' ? 'Indi Bike' : selectedCategory === 'auto' ? 'Indi Auto' : 'Indi Cab'} • ₹{Math.round(estimates.find(e => e.category === selectedCategory)?.estimated_fare || 0)}
                              </Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.scheduleLaterBtn}
                            onPress={() => setShowScheduleModal(true)}
                            disabled={bookingLoading}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="calendar-outline" size={16} color="#0f172a" />
                            <Text style={styles.scheduleLaterText}>
                              Schedule for Later (15 mins - 7 days)
                            </Text>
                          </TouchableOpacity>

                          {/* Transparent Fare Explanation Note */}
                          <Text style={styles.fareDisclaimerText}>
                            * Estimated fare is calculated using road-route distance. Final fare may differ if actual billable distance, waiting time, or configured tolls/parking differ.
                          </Text>
                        </>
                      )}
                    </View>
                  ) : (
                    /* CLEAN INITIAL HOME PAGE (NO PRICES DISPLAYED HERE!) */
                    <View>
                      {/* Upcoming Scheduled Ride Banner (Real DB State) */}
                      {upcomingScheduledRides && upcomingScheduledRides.length > 0 && (
                        <View style={styles.scheduledBanner}>
                          <View style={styles.scheduledBannerLeft}>
                            <Ionicons name="calendar" size={18} color="#0284c7" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.scheduledBannerTitle}>
                                Upcoming Scheduled Trip
                              </Text>
                              <Text style={styles.scheduledBannerSubtitle} numberOfLines={1}>
                                {new Date(upcomingScheduledRides[0].scheduled_for || '').toLocaleString()} • {upcomingScheduledRides[0].destination_address}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.scheduledBannerCancelBtn}
                            onPress={async () => {
                              try {
                                await api.rides.cancelRide(upcomingScheduledRides[0].id, 'Passenger cancelled');
                                Alert.alert('Ride Cancelled', 'Your scheduled trip has been cancelled.');
                                fetchUpcomingScheduled();
                              } catch (e: any) {
                                Alert.alert('Error', e.message || 'Could not cancel');
                              }
                            }}
                          >
                            <Text style={styles.scheduledBannerCancelText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Top Play Store Announcement Bar */}
                      <View style={{ marginBottom: 12 }}>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#ecfdf5',
                            borderWidth: 1,
                            borderColor: '#a7f3d0',
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            gap: 8,
                          }}
                          onPress={() => setPlayStoreModalVisible(true)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="logo-google-playstore" size={16} color="#059669" />
                          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#065f46' }}>
                            📱 Android APK Launching Tomorrow on Google Play Store! (Web Live Today)
                          </Text>
                          <Ionicons name="chevron-forward" size={13} color="#059669" />
                        </TouchableOpacity>
                      </View>

                      {/* INI RIDE Service Switcher Chips */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.serviceTypesRow}
                        style={{ marginBottom: 12, flexGrow: 0 }}
                      >
                        <TouchableOpacity
                          style={[styles.serviceTab, rideType === 'daily' && styles.activeServiceTab]}
                          onPress={() => setRideType('daily')}
                        >
                          <Ionicons name="car" size={16} color={rideType === 'daily' ? '#000000' : '#64748b'} />
                          <Text style={[styles.serviceTabText, rideType === 'daily' && styles.activeServiceTabText]}>
                            Daily Rides
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.serviceTab}
                          onPress={() => setBottomNavTab('campus')}
                        >
                          <Ionicons name="school" size={15} color="#0284c7" />
                          <Text style={[styles.serviceTabText, { color: '#0284c7', fontWeight: '800' }]}>
                            🎓 Campus Drive
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.serviceTab}
                          onPress={() => setBottomNavTab('services')}
                        >
                          <Ionicons name="car-sport" size={15} color="#16a34a" />
                          <Text style={[styles.serviceTabText, { color: '#16a34a', fontWeight: '700' }]}>
                            🚗 Special Drive
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.serviceTab, rideType === 'rentals' && styles.activeServiceTab]}
                          onPress={() => {
                            setRideType('rentals');
                            setShowRentalsModal(true);
                          }}
                        >
                          <Ionicons name="time" size={15} color={rideType === 'rentals' ? '#000000' : '#64748b'} />
                          <Text style={[styles.serviceTabText, rideType === 'rentals' && styles.activeServiceTabText]}>
                            Rentals
                          </Text>
                          <View style={styles.soonPill}>
                            <Text style={styles.soonPillText}>SOON</Text>
                          </View>
                        </TouchableOpacity>
                      </ScrollView>

                      {rideType === 'campus_rides' ? (
                        <View style={{ marginTop: 4 }}>
                          <CampusRidePanel
                            onSelectRoutePreview={(oLat, oLng, dLat, dLng) => {
                              setPickup({ address: 'Pickup Location', latitude: oLat, longitude: oLng });
                              setDestination({ address: 'Campus Destination', latitude: dLat, longitude: dLng });
                            }}
                            onClose={() => setRideType('daily')}
                          />
                        </View>
                      ) : (
                        <>
                          {/* 1. TOPMOST: Location Selector Box (Single 'Where to?' box initially, expands on click to show both fields) */}
                          {!isLocationExpanded && !destination ? (
                            <View style={styles.singleWhereToCard}>
                              <TouchableOpacity
                                style={styles.singleWhereToBtn}
                                onPress={() => {
                                  setIsLocationExpanded(true);
                                  setSearchModalType('destination');
                                }}
                                activeOpacity={0.88}
                              >
                                <View style={styles.singleWhereToLeft}>
                                  <View style={styles.singleWhereToSearchIcon}>
                                    <Ionicons name="search" size={20} color="#0f172a" />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.singleWhereToTitle}>Where to?</Text>
                                    <Text style={styles.singleWhereToSub} numberOfLines={1}>
                                      Pickup: {pickup ? pickup.address.split(',')[0] : 'Current location (GPS)'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.singleWhereToTimeBtn}>
                                  <Ionicons name="time" size={14} color="#0f172a" />
                                  <Text style={styles.singleWhereToTimeText}>Now</Text>
                                  <Ionicons name="chevron-down" size={13} color="#0f172a" />
                                </View>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <>
                              <View style={styles.expandedHeaderRow}>
                                <Text style={styles.cardTitle}>Where can we take you?</Text>
                                {!destination && (
                                  <TouchableOpacity
                                    onPress={() => setIsLocationExpanded(false)}
                                    style={styles.collapseBtn}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Ionicons name="chevron-up" size={18} color="#64748b" />
                                  </TouchableOpacity>
                                )}
                              </View>

                              <View style={styles.inputCard}>
                                {/* Left Connector Graphic */}
                                <View style={styles.connectorGraphic}>
                                  <View style={styles.pickupCircle} />
                                  <View style={styles.connectorLine} />
                                  <View style={styles.dropSquare} />
                                </View>

                                {/* Input Fields */}
                                <View style={styles.inputsColumn}>
                                  {/* Pickup Input */}
                                  <TouchableOpacity
                                    style={styles.fieldRow}
                                    onPress={() => setSearchModalType('pickup')}
                                  >
                                    <Text style={styles.fieldAddressText} numberOfLines={1}>
                                      {pickup
                                        ? pickup.address
                                        : rideType === 'package'
                                        ? 'Sender Pickup Address'
                                        : 'Current location (GPS)'}
                                    </Text>
                                    <Ionicons name="navigate-circle" size={20} color="#10b981" />
                                  </TouchableOpacity>

                                  <View style={styles.fieldDivider} />

                                  {/* Destination Input */}
                                  <TouchableOpacity
                                    style={styles.fieldRow}
                                    onPress={() => setSearchModalType('destination')}
                                  >
                                    <Text
                                      style={[
                                        styles.fieldAddressText,
                                        { color: destination ? '#0f172a' : '#94a3b8' },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {destination
                                        ? (destination as any).address
                                        : rideType === 'package'
                                        ? 'Where to deliver package? (Dropoff)'
                                        : rideType === 'rentals'
                                        ? 'Select rental destination / package stops'
                                        : 'Where to in India? (Tap to search)'}
                                    </Text>
                                    <Ionicons name="search" size={18} color="#000000" />
                                  </TouchableOpacity>
                                </View>

                                {/* Swap Button */}
                                <TouchableOpacity style={styles.swapButton} onPress={swapLocations}>
                                  <Ionicons name="swap-vertical" size={18} color="#475569" />
                                </TouchableOpacity>
                              </View>
                            </>
                          )}

                          {/* 2. DIRECTLY BELOW LOCATION: Small Animated Diwali Diya Banner */}
                          <View style={styles.festivalBannerWrapper}>
                            <DiyaAnimationBanner
                              onApplyPromo={(code) => {
                                setAppliedPromo(code);
                                const discMsg = code.includes('CHHATH')
                                  ? '10% Chhath Puja discount activated.'
                                  : code.includes('CAMPUS') || code.includes('SELF')
                                  ? '20% Campus • Self Ride discount activated.'
                                  : '5% Diwali festive discount activated.';
                                Alert.alert('Promo Applied! 🎉', `Code "${code}" applied! ${discMsg}`);
                              }}
                            />
                          </View>

                          {/* 3. DIRECTLY BELOW FESTIVAL: "For you" Suggestions Grid (NO PRICE DISPLAYED) */}
                          <View style={styles.forYouWrapper}>
                            <ForYouGrid
                              selectedCategory={selectedCategory}
                              onSelectCategory={(cat) => {
                                setSelectedCategory(cat);
                                if (!destination) {
                                  setSearchModalType('destination');
                                }
                              }}
                              onOpenTransit={() => {
                                handleSelectQuickDest('MG Road Metro', 'Bengaluru, Karnataka', 12.9754, 77.6066);
                                Alert.alert('Metro & Transit Connected 🚇', 'Destination set to MG Road Metro Station. Review your fastest ride!');
                              }}
                              onOpenPasses={() => {
                                setAppliedPromo('COMMUTER20');
                                Alert.alert('Save Every Day Pass Activated! 🏷️', 'Commuter 20% discount pass applied to all daily rides.');
                              }}
                              onOpenCampusRides={() => setBottomNavTab('campus')}
                            />
                          </View>

                          {/* Quick Indian Landmark Chips to easily choose destination */}
                          <View style={styles.quickChipsWrapper}>
                            <Text style={styles.quickLabel}>POPULAR DESTINATIONS</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                              <TouchableOpacity
                                style={styles.quickChip}
                                onPress={() => handleSelectQuickDest('Koramangala 5th Block', 'Bengaluru, Karnataka', 12.9352, 77.6245)}
                              >
                                <Ionicons name="location" size={14} color="#059669" />
                                <Text style={styles.quickChipText}>Koramangala</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.quickChip}
                                onPress={() => handleSelectQuickDest('MG Road Metro', 'Bengaluru, Karnataka', 12.9754, 77.6066)}
                              >
                                <Ionicons name="subway" size={14} color="#2563eb" />
                                <Text style={styles.quickChipText}>MG Road Metro</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.quickChip}
                                onPress={() => handleSelectQuickDest('Parul University', 'Waghodia Road, Vadodara', 22.2887, 73.3634)}
                              >
                                <Ionicons name="school" size={14} color="#7c3aed" />
                                <Text style={styles.quickChipText}>Parul Univ Vadodara</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.quickChip}
                                onPress={() => handleSelectQuickDest('Kempegowda Airport (BLR)', 'Devanahalli, Bengaluru', 13.1986, 77.7066)}
                              >
                                <Ionicons name="airplane" size={14} color="#f59e0b" />
                                <Text style={styles.quickChipText}>BLR Airport</Text>
                              </TouchableOpacity>
                            </ScrollView>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </ScrollView>
              )}
            </View>

            {/* Right Side: Map Canvas with Floating Animated Festival Widget */}
            <View style={[styles.mapContainer, isMapFullScreen && styles.mapFullScreenContainer]}>
              <View style={styles.mapInnerWrapper}>
                {/* Small Floating Animated Festival Widget */}
                <FestivalMiniPopup
                  onApplyPromo={(code) => {
                    setAppliedPromo(code);
                    Alert.alert('Promo Applied! 🪔', `Code "${code}" applied! 50% festive discount activated.`);
                  }}
                />

                {searchModalType && (
                  <View style={styles.mapSearchHint}>
                    <Ionicons name="location" size={16} color="#10b981" />
                    <Text style={styles.mapSearchHintText}>
                      Click anywhere on map to set {searchModalType === 'pickup' ? 'pickup' : 'destination'}
                    </Text>
                  </View>
                )}

                <MapCanvas
                  pickupLat={activeBooking?.pickup_latitude || pickup?.latitude || 12.9716}
                  pickupLng={activeBooking?.pickup_longitude || pickup?.longitude || 77.6412}
                  dropoffLat={
                    isSearching
                      ? undefined
                      : (activeBooking?.destination_latitude || destination?.latitude)
                  }
                  dropoffLng={
                    isSearching
                      ? undefined
                      : (activeBooking?.destination_longitude || destination?.longitude)
                  }
                  driverLat={driverLocation?.latitude || activeBooking?.rider?.current_latitude}
                  driverLng={driverLocation?.longitude || activeBooking?.rider?.current_longitude}
                  routeGeometry={
                    activeBooking
                      ? (activeBooking.status === 'IN_PROGRESS'
                          ? (routeGeometry && routeGeometry.length > 0
                              ? routeGeometry
                              : (activeBooking.route_polyline ? (() => { try { return JSON.parse(activeBooking.route_polyline); } catch (e) { return []; } })() : []))
                          : [])
                      : routeGeometry
                  }
                  driverToPickupRoute={
                    activeBooking?.status === 'RIDER_ARRIVING' || activeBooking?.status === 'RIDER_ASSIGNED'
                      ? (driverToPickupRoute && driverToPickupRoute.length > 0 ? driverToPickupRoute : activeBooking?.driver_to_pickup_route)
                      : []
                  }
                  pickupEtaMins={driverLocation?.pickupEtaMins || activeBooking?.rider?.pickup_eta_mins || 3}
                  isDriverStale={driverLocation?.isStale || activeBooking?.rider?.is_stale || false}
                  isFullScreen={isMapFullScreen}
                  onToggleFullScreen={() => setIsMapFullScreen(!isMapFullScreen)}
                  vehicleCategory={activeBooking?.vehicle_category || selectedCategory}
                  isSearching={isSearching}
                  radarRadiusKm={activeBooking?.current_search_radius_km || searchRadiusKm}
                  onLocationPick={handleMapLocationPick}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 5. FIXED BOTTOM NAVIGATION BAR: Home, Services, Activity, Account */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={[styles.bottomTabItem, bottomNavTab === 'home' && styles.activeBottomTabItem]}
          onPress={() => setBottomNavTab('home')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={bottomNavTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={bottomNavTab === 'home' ? '#000000' : '#64748b'}
          />
          <Text style={[styles.bottomTabText, bottomNavTab === 'home' && styles.activeBottomTabText]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, bottomNavTab === 'campus' && styles.activeBottomTabItem]}
          onPress={() => setBottomNavTab('campus')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={bottomNavTab === 'campus' ? 'school' : 'school-outline'}
            size={22}
            color={bottomNavTab === 'campus' ? '#0284c7' : '#64748b'}
          />
          <Text
            style={[
              styles.bottomTabText,
              bottomNavTab === 'campus' && { color: '#0284c7', fontWeight: '800' },
            ]}
          >
            Campus Drive
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, bottomNavTab === 'services' && styles.activeBottomTabItem]}
          onPress={() => setBottomNavTab('services')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={bottomNavTab === 'services' ? 'car-sport' : 'car-sport-outline'}
            size={22}
            color={bottomNavTab === 'services' ? '#16a34a' : '#64748b'}
          />
          <Text
            style={[
              styles.bottomTabText,
              bottomNavTab === 'services' && { color: '#16a34a', fontWeight: '800' },
            ]}
          >
            Special Drive
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, bottomNavTab === 'activity' && styles.activeBottomTabItem]}
          onPress={() => setBottomNavTab('activity')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={bottomNavTab === 'activity' ? 'receipt' : 'receipt-outline'}
            size={22}
            color={bottomNavTab === 'activity' ? '#000000' : '#64748b'}
          />
          <Text style={[styles.bottomTabText, bottomNavTab === 'activity' && styles.activeBottomTabText]}>
            Activity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTabItem, bottomNavTab === 'account' && styles.activeBottomTabItem]}
          onPress={() => setBottomNavTab('account')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={bottomNavTab === 'account' ? 'person' : 'person-outline'}
            size={22}
            color={bottomNavTab === 'account' ? '#000000' : '#64748b'}
          />
          <Text style={[styles.bottomTabText, bottomNavTab === 'account' && styles.activeBottomTabText]}>
            Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* SCHEDULE RIDE MODAL */}
      <Modal visible={showScheduleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.scheduleModalCard}>
            <View style={styles.scheduleModalHeader}>
              <View>
                <Text style={styles.scheduleModalTitle}>Schedule Ride for Later</Text>
                <Text style={styles.scheduleModalSubtitle}>
                  Advance booking from 15 minutes up to 7 days ahead
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowScheduleModal(false)}
                style={styles.scheduleModalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Custom Date & Time Picker */}
              <Text style={styles.scheduleOptionSectionLabel}>CHOOSE DATE & DEPARTURE TIME</Text>

              {/* 1. Date Selector */}
              <View style={styles.scheduleDateRow}>
                {[
                  { id: 'today', label: 'Today', sub: new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) },
                  { id: 'tomorrow', label: 'Tomorrow', sub: new Date(Date.now() + 86400000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) },
                  { id: 'day_after', label: 'Day After', sub: new Date(Date.now() + 172800000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.scheduleDateChip,
                      scheduleDateChoice === item.id && styles.scheduleDateChipActive,
                    ]}
                    onPress={() => setScheduleDateChoice(item.id as any)}
                  >
                    <Text
                      style={[
                        styles.scheduleDateChipTitle,
                        scheduleDateChoice === item.id && styles.scheduleDateChipTitleActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.scheduleDateChipSub,
                        scheduleDateChoice === item.id && styles.scheduleDateChipSubActive,
                      ]}
                    >
                      {item.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 2. Time Selector */}
              <View style={styles.scheduleTimeSelectorRow}>
                {/* Hours */}
                <View style={styles.scheduleTimeCol}>
                  <Text style={styles.scheduleTimeColLabel}>HOUR</Text>
                  <View style={styles.scheduleTimePickerBox}>
                    {['06', '07', '08', '09', '10', '11', '12', '01', '02', '03', '04', '05'].map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.scheduleTimeChip,
                          scheduleHour === h && styles.scheduleTimeChipActive,
                        ]}
                        onPress={() => setScheduleHour(h)}
                      >
                        <Text
                          style={[
                            styles.scheduleTimeChipText,
                            scheduleHour === h && styles.scheduleTimeChipTextActive,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Minutes & AM/PM */}
                <View style={[styles.scheduleTimeCol, { width: 110, flex: 0 }]}>
                  <Text style={styles.scheduleTimeColLabel}>MIN & AM/PM</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
                    {['00', '15', '30', '45'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.scheduleMinChip,
                          scheduleMinute === m && styles.scheduleTimeChipActive,
                        ]}
                        onPress={() => setScheduleMinute(m)}
                      >
                        <Text
                          style={[
                            styles.scheduleTimeChipText,
                            scheduleMinute === m && styles.scheduleTimeChipTextActive,
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(['AM', 'PM'] as const).map((ampm) => (
                      <TouchableOpacity
                        key={ampm}
                        style={[
                          styles.scheduleAmPmChip,
                          scheduleAmPm === ampm && styles.scheduleAmPmChipActive,
                        ]}
                        onPress={() => setScheduleAmPm(ampm)}
                      >
                        <Text
                          style={[
                            styles.scheduleAmPmText,
                            scheduleAmPm === ampm && styles.scheduleAmPmTextActive,
                          ]}
                        >
                          {ampm}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Notice Banner */}
              <View style={styles.scheduleDispatchNotice}>
                <Ionicons name="flash" size={14} color="#0284c7" />
                <Text style={styles.scheduleDispatchNoticeText}>
                  When time arrives, one driver is automatically assigned & competing requests are safely terminated.
                </Text>
              </View>

              {/* Confirm Custom Schedule Button */}
              <TouchableOpacity
                style={styles.confirmCustomScheduleBtn}
                onPress={handleConfirmCustomSchedule}
                activeOpacity={0.88}
              >
                <Ionicons name="calendar-outline" size={16} color="#ffffff" />
                <Text style={styles.confirmCustomScheduleBtnText}>
                  Confirm Schedule ({scheduleDateChoice.toUpperCase()} at {scheduleHour}:{scheduleMinute} {scheduleAmPm})
                </Text>
              </TouchableOpacity>

              <View style={{ marginVertical: 12, height: 1, backgroundColor: '#f1f5f9' }} />

              <Text style={styles.scheduleOptionSectionLabel}>OR QUICK ADVANCE PRESETS</Text>

              {[
                {
                  label: 'In 30 Minutes',
                  sub: 'Drivers will be notified 20 mins prior',
                  calc: () => new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                },
                {
                  label: 'In 1 Hour',
                  sub: 'Guaranteed matching window dispatch',
                  calc: () => new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                },
                {
                  label: 'In 2 Hours',
                  sub: 'Peace-of-mind scheduled commute',
                  calc: () => new Date(Date.now() + 120 * 60 * 1000).toISOString(),
                },
                {
                  label: 'Tomorrow Morning (8:00 AM)',
                  sub: 'Scheduled morning rush hour ride',
                  calc: () => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(8, 0, 0, 0);
                    return d.toISOString();
                  },
                },
                {
                  label: 'Tomorrow Evening (6:00 PM)',
                  sub: 'Scheduled evening return trip',
                  calc: () => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(18, 0, 0, 0);
                    return d.toISOString();
                  },
                },
              ].map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.scheduleOptionItem}
                  onPress={() => {
                    const iso = opt.calc();
                    setShowScheduleModal(false);
                    handleConfirmBooking(iso);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.scheduleOptionIcon}>
                    <Ionicons name="time-outline" size={18} color="#0284c7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scheduleOptionLabel}>{opt.label}</Text>
                    <Text style={styles.scheduleOptionSub}>{opt.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* RENTALS COMING SOON MODAL */}
      <Modal
        visible={showRentalsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRentalsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rentalsModalCard}>
            <View style={styles.rentalsModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.rentalsIconBubble}>
                  <Ionicons name="key" size={20} color="#2563eb" />
                </View>
                <View>
                  <Text style={styles.rentalsModalTitle}>Self-Drive Rentals</Text>
                  <Text style={styles.rentalsModalSub}>Bicycle, Motorbike & Car Hourly Packages</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowRentalsModal(false)}
                style={styles.scheduleModalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.comingSoonBanner}>
              <View style={styles.comingSoonBadgeBig}>
                <Text style={styles.comingSoonBadgeBigText}>LAUNCHING SOON</Text>
              </View>
              <Text style={styles.comingSoonHeading}>
                Rent verified bikes, bicycles & cars by the hour with zero paperwork & instant key unlock!
              </Text>
            </View>

            {/* Vehicle Rental Cards */}
            <View style={styles.rentalCardsList}>
              {/* Option 1: Cycle / Bicycle */}
              <View style={styles.rentalCard}>
                <View style={[styles.rentalCardIconBox, { backgroundColor: '#ecfdf5' }]}>
                  <MaterialCommunityIcons name="bicycle" size={28} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.rentalCardTitle}>Cycle & E-Bicycle</Text>
                    <Text style={styles.rentalCardPrice}>From ₹15/hr</Text>
                  </View>
                  <Text style={styles.rentalCardDesc}>
                    Geared cycles & battery-assist e-bikes for campus, gym & quick errands.
                  </Text>
                </View>
              </View>

              {/* Option 2: Bike / Scooter */}
              <View style={styles.rentalCard}>
                <View style={[styles.rentalCardIconBox, { backgroundColor: '#fef2f2' }]}>
                  <MaterialCommunityIcons name="motorbike" size={28} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.rentalCardTitle}>Bike & Scooter</Text>
                    <Text style={styles.rentalCardPrice}>From ₹45/hr</Text>
                  </View>
                  <Text style={styles.rentalCardDesc}>
                    Honda Activa, Hero Splendor, Royal Enfield Bullet. Free helmets & insurance.
                  </Text>
                </View>
              </View>

              {/* Option 3: Self-Drive Car */}
              <View style={styles.rentalCard}>
                <View style={[styles.rentalCardIconBox, { backgroundColor: '#eff6ff' }]}>
                  <MaterialCommunityIcons name="car-sports" size={28} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.rentalCardTitle}>Self-Drive Car</Text>
                    <Text style={styles.rentalCardPrice}>From ₹120/hr</Text>
                  </View>
                  <Text style={styles.rentalCardDesc}>
                    Maruti Swift, Hyundai i20, Mahindra Thar 4x4. Clean cars with roadside safety.
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.notifyMeBtn}
              onPress={() => {
                setShowRentalsModal(false);
                Alert.alert(
                  'Added to VIP Launch List! 🚀',
                  'We will notify you the moment self-drive bicycle, bike, and car rentals go live in your area with ₹200 free rental credits!'
                );
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications" size={16} color="#ffffff" />
              <Text style={styles.notifyMeBtnText}>Notify Me When Live (Get ₹200 Off)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Founder Story Modal */}
      <FounderStoryModal
        visible={founderModalVisible}
        onClose={() => setFounderModalVisible(false)}
      />

      {/* Play Store Coming Soon Modal */}
      <PlayStoreComingSoonModal
        visible={playStoreModalVisible}
        onClose={() => setPlayStoreModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
    width: '100%',
    overflow: 'hidden',
  },
  desktopTabContainer: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  topNavbar: {
    height: 54,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandBadgeText: {
    color: '#60a5fa',
    fontSize: 8,
    fontWeight: '800',
  },
  userControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  avatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  profileRating: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  navLogoutBtn: {
    padding: 6,
  },
  mainTabContent: {
    flex: 1,
  },
  contentLayout: {
    flex: 1,
  },
  desktopLayout: {
    flexDirection: 'row',
  },
  mobileLayout: {
    flexDirection: 'column-reverse',
  },
  panelDrawer: {
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  desktopDrawer: {
    width: 420,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    boxShadow: '4px 0 16px rgba(0, 0, 0, 0.08)',
    height: '100%',
    overflow: 'hidden',
  },
  mobileDrawer: {
    height: '62%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
  },
  mobileDrawerExpanded: {
    height: '88%',
  },
  panelScroll: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  activeWrapper: {
    marginBottom: 10,
  },
  serviceTypesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  serviceTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  activeServiceTab: {
    backgroundColor: '#000000',
  },
  serviceTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  activeServiceTabText: {
    color: '#ffffff',
  },
  singleWhereToCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  singleWhereToBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  singleWhereToLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  singleWhereToSearchIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleWhereToTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  singleWhereToSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  singleWhereToTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  singleWhereToTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  collapseBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  connectorGraphic: {
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 6,
  },
  pickupCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  connectorLine: {
    width: 2,
    height: 24,
    backgroundColor: '#cbd5e1',
    marginVertical: 4,
  },
  dropSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#000000',
  },
  inputsColumn: {
    flex: 1,
    gap: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  fieldAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 2,
  },
  swapButton: {
    padding: 6,
    marginLeft: 6,
  },
  festivalBannerWrapper: {
    marginBottom: 12,
  },
  forYouWrapper: {
    marginBottom: 12,
  },
  quickChipsWrapper: {
    marginTop: 6,
    marginBottom: 14,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipsScroll: {
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  routeReviewWrapper: {
    paddingBottom: 20,
  },
  reviewBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  reviewBackText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  routeSummaryBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  routeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryLine: {
    width: 2,
    height: 14,
    backgroundColor: '#cbd5e1',
    marginLeft: 3,
    marginVertical: 2,
  },
  summaryAddress: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  tripMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tripMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripMetaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
  },
  calculatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  calculatingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  confirmBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  mapContainer: {
    flex: 1,
    height: '100%',
    position: 'relative',
    backgroundColor: '#0b0f19',
  },
  mapFullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  panelDrawerHidden: {
    display: 'none',
  },
  mapInnerWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mapSearchHint: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25)',
  },
  mapSearchHintText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomTabBar: {
    height: 64,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 14 : 4,
    zIndex: 1000,
    boxShadow: '0 -2px 6px rgba(0, 0, 0, 0.06)',
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  activeBottomTabItem: {},
  tabIconWrapper: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#0284c7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  bottomTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 3,
  },
  activeBottomTabText: {
    color: '#000000',
    fontWeight: '800',
  },
  fareDisclaimerText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 15,
    paddingHorizontal: 8,
  },
  reconnectingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78350f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  reconnectingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
  reconnectingText: {
    color: '#fef3c7',
    fontSize: 10,
    fontWeight: '800',
  },
  scheduleLaterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  scheduleLaterText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  scheduledBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scheduledBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  scheduledBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
  },
  scheduledBannerSubtitle: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
  },
  scheduledBannerCancelBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scheduledBannerCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  scheduleModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  scheduleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  scheduleModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  scheduleModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  scheduleModalCloseBtn: {
    padding: 4,
  },
  scheduleOptionSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  scheduleOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  scheduleOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleOptionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  scheduleOptionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  // Custom Date & Time Schedule Picker Styles
  scheduleDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  scheduleDateChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  scheduleDateChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  scheduleDateChipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  scheduleDateChipTitleActive: {
    color: '#0369a1',
  },
  scheduleDateChipSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  scheduleDateChipSubActive: {
    color: '#0284c7',
  },
  scheduleTimeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  scheduleTimeCol: {
    flex: 1,
  },
  scheduleTimeColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  scheduleTimePickerBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  scheduleTimeChip: {
    width: 34,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTimeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  scheduleTimeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  scheduleTimeChipTextActive: {
    color: '#ffffff',
  },
  scheduleMinChip: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleAmPmChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleAmPmChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  scheduleAmPmText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  scheduleAmPmTextActive: {
    color: '#ffffff',
  },
  scheduleDispatchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 12,
  },
  scheduleDispatchNoticeText: {
    fontSize: 10,
    color: '#0369a1',
    fontWeight: '600',
    flex: 1,
    lineHeight: 14,
  },
  confirmCustomScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 13,
    borderRadius: 10,
    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
  },
  confirmCustomScheduleBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  soonPill: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 4,
  },
  soonPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
  },
  rentalsModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
    elevation: 10,
  },
  rentalsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rentalsIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalsModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  rentalsModalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  comingSoonBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  comingSoonBadgeBig: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  comingSoonBadgeBigText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  comingSoonHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e3a8a',
    lineHeight: 17,
  },
  rentalCardsList: {
    gap: 10,
    marginBottom: 16,
  },
  rentalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rentalCardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  rentalCardPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  rentalCardDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  notifyMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  notifyMeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  autoDiscountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fbcfe8',
    marginBottom: 8,
  },
  autoDiscountBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#be185d',
    flex: 1,
  },
  voucherToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 8,
  },
  voucherToggleBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  voucherToggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
  },
  voucherToggleTitleActive: {
    color: '#ffffff',
  },
  voucherToggleSub: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  voucherToggleSubActive: {
    color: '#d1fae5',
  },
  voucherCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  voucherCheckboxActive: {
    backgroundColor: '#047857',
    borderColor: '#ffffff',
  },
});
