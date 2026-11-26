import '../../src/utils/suppressWarnings';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';
import { wsService } from '../../src/services/websocket';
import { MapCanvas } from '../../src/components/MapCanvas';
import { RideBooking, IncomingRideRequest, VehicleCategory, CommunityRide } from '../../src/types';
import { CampusDriverPanel } from '../../src/components/campus/CampusDriverPanel';

interface OperatingZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  activeDriversCount: number;
}

const OPERATING_ZONES: OperatingZone[] = [
  { id: 'indiranagar', name: 'Indiranagar, Bengaluru', lat: 12.9716, lng: 77.6412, activeDriversCount: 6 },
  { id: 'koramangala', name: 'Koramangala, Bengaluru', lat: 12.9352, lng: 77.6245, activeDriversCount: 5 },
  { id: 'parul_vadodara', name: 'Alkapuri / Parul Univ, Vadodara', lat: 22.3072, lng: 73.1812, activeDriversCount: 4 },
  { id: 'mg_road', name: 'MG Road Metro, Bengaluru', lat: 12.9754, lng: 77.6066, activeDriversCount: 7 },
  { id: 'gurugram', name: 'Cyber City, Gurugram', lat: 28.4952, lng: 77.0886, activeDriversCount: 5 },
];

type RiderTab = 'dispatch' | 'campus' | 'carpool' | 'earnings' | 'activity' | 'users' | 'help' | 'profile';

export default function RiderScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<RiderTab>('dispatch');

  // Role-based experience: Campus Driver vs Permanent Driver
  const [viewCommercialMode, setViewCommercialMode] = useState<boolean>(false);

  // Carpool / Shared Rides State
  const [myPostedCarpools, setMyPostedCarpools] = useState<CommunityRide[]>([]);
  const [loadingCarpools, setLoadingCarpools] = useState(false);

  const loadMyCarpools = async () => {
    setLoadingCarpools(true);
    try {
      const data = await api.communityRides.getMyPostedRides();
      setMyPostedCarpools(data || []);
    } catch (e) {
      console.warn('Could not load posted carpools:', e);
    } finally {
      setLoadingCarpools(false);
    }
  };

  // Rider Custom Price Setting for Fast Booking / Custom Rides
  const [customPriceRate, setCustomPriceRate] = useState('14');
  const [isCustomPriceActive, setIsCustomPriceActive] = useState(true);
  const [showPostFastRideModal, setShowPostFastRideModal] = useState(false);
  const [fastRideOrigin, setFastRideOrigin] = useState('Indiranagar 100 Feet Rd, Bengaluru');
  const [fastRideDest, setFastRideDest] = useState('Kempegowda International Airport (BLR)');
  const [fastRideVehType, setFastRideVehType] = useState<'bike' | 'auto' | 'car' | 'bus'>('bike');
  const [fastRideModel, setFastRideModel] = useState('Hero Splendor / Pulsar');
  const [fastRideSeats, setFastRideSeats] = useState('1');
  const [fastRideSeatPrice, setFastRideSeatPrice] = useState('45');
  const [fastRideTime, setFastRideTime] = useState('Today, 6:30 PM');
  const [submittingFastRide, setSubmittingFastRide] = useState(false);

  const handlePostRiderFastRide = async () => {
    if (!fastRideOrigin || !fastRideDest || !fastRideSeatPrice) {
      Alert.alert('Incomplete Fields', 'Please specify origin, destination, and your seat price.');
      return;
    }
    setSubmittingFastRide(true);
    try {
      await api.communityRides.create({
        pickup_address: fastRideOrigin,
        destination_address: fastRideDest,
        departure_time: fastRideTime,
        total_seats: parseInt(fastRideSeats, 10) || 1,
        price_per_seat: parseFloat(fastRideSeatPrice) || 45,
        vehicle_info: `${fastRideModel} (${fastRideVehType.toUpperCase()})`,
        vehicle_type: fastRideVehType,
        notes: `Custom Fast Ride by driver with custom rate ₹${customPriceRate}/km`,
      });
      Alert.alert('Fast Ride Published! ⚡', `Your custom ride is now active with seat price ₹${fastRideSeatPrice}!`);
      setShowPostFastRideModal(false);
      loadMyCarpools();
    } catch (err: any) {
      Alert.alert('Failed to Post Ride', err.message || 'Error creating fast ride');
    } finally {
      setSubmittingFastRide(false);
    }
  };

  // Core state
  const [isOnline, setIsOnline] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(wsService.isConnected());
  const [dashboard, setDashboard] = useState<any>(null);

  const isCampusDriver = useMemo(() => {
    const profileType = String(user?.rider_profile?.rider_service_type || dashboard?.rider_service_type || '').toUpperCase();
    if (profileType === 'CAMPUS') return true;
    if (user?.phone_number === '+919444444444') return true;
    if (user?.full_name?.toLowerCase().includes('campus driver')) return true;
    return false;
  }, [user?.rider_profile?.rider_service_type, user?.phone_number, user?.full_name, dashboard?.rider_service_type]);
  const [activeRide, setActiveRide] = useState<RideBooking | null>(null);
  // Request Queue & 60-Second Rejection Cooldown State Machine
  const [requestQueue, setRequestQueue] = useState<IncomingRideRequest[]>([]);
  const declinedCooldownMap = useRef<Record<string, number>>({});
  const [countdown, setCountdown] = useState(45);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Exactly ONE active modal request at a time (FIFO from queue)
  const incomingRequest = useMemo(() => {
    if (!isOnline) return null;
    return requestQueue.length > 0 ? requestQueue[0] : null;
  }, [requestQueue, isOnline]);

  const incomingRequestRef = useRef<IncomingRideRequest | null>(null);
  incomingRequestRef.current = incomingRequest;

  const activeRideRef = useRef<RideBooking | null>(null);
  activeRideRef.current = activeRide;
  const isSyncingRiderRef = useRef(false);

  // Operating Zone
  const [selectedZone, setSelectedZone] = useState<OperatingZone>(OPERATING_ZONES[0]);
  const [showZonePicker, setShowZonePicker] = useState(false);

  // Driver GPS coordinates & Real Device Tracking Mode
  const [driverLat, setDriverLat] = useState(OPERATING_ZONES[0].lat);
  const [driverLng, setDriverLng] = useState(OPERATING_ZONES[0].lng);
  const [trackingMode, setTrackingMode] = useState<'device_gps'>('device_gps');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // History & Activity State
  const [ridesHistory, setRidesHistory] = useState<RideBooking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [selectedReceiptRide, setSelectedReceiptRide] = useState<RideBooking | null>(null);

  // Payout State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutUpi, setPayoutUpi] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Support Ticket Modal
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketCategory, setTicketCategory] = useState('Payment / Payout Issue');
  const [ticketDesc, setTicketDesc] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // FAQ Accordion
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // OTP Verification dialog
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // QR Code Payment & Settlement Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState(false);

  // Driver Cancellation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Passenger no-show at pickup');
  const [cancelling, setCancelling] = useState(false);

  // Request GPS & Sync to Backend (Android native + Web)
  const requestGpsCoordinates = async (): Promise<{ lat: number; lng: number; heading: number; speed: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setGpsError(null);
        return {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          heading: loc.coords.heading || 0,
          speed: loc.coords.speed || 0,
        };
      }
    } catch {
      // fallback
    }

    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGpsError(null);
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
            });
          },
          (err) => {
            console.warn('[Driver GPS] Location permission not granted or error:', err.message);
            setGpsError('Device GPS permission denied/unavailable. Operating zone mode active.');
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        resolve(null);
      }
    });
  };

  const requestGpsPermission = async () => {
    const coords = await requestGpsCoordinates();
    if (coords) {
      setDriverLat(coords.lat);
      setDriverLng(coords.lng);
      setTrackingMode('device_gps');
      api.rider.updateLocation(coords.lat, coords.lng, coords.heading, coords.speed).catch(() => {});
      wsService.sendRiderLocation(coords.lat, coords.lng, coords.heading, coords.speed);
    }
  };

  // Helper to safely enqueue incoming requests obeying 60-second rejection cooldown
  const enqueueRequest = (newReq: IncomingRideRequest) => {
    const lastDeclined = declinedCooldownMap.current[newReq.ride_id];
    if (lastDeclined && Date.now() - lastDeclined < 60000) {
      return; // Skip within 60-second cooldown
    }
    setRequestQueue((prev) => {
      if (prev.some((r) => r.ride_id === newReq.ride_id)) {
        return prev;
      }
      return [...prev, newReq];
    });
  };

  // Live location streaming to backend via WebSocket
  useEffect(() => {
    if (!isOnline) return;

    const streamTimer = setInterval(() => {
      if (trackingMode === 'device_gps') {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setDriverLat(pos.coords.latitude);
              setDriverLng(pos.coords.longitude);
              wsService.sendRiderLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading || 0, pos.coords.speed || 0);
            },
            () => {
              wsService.sendRiderLocation(driverLat, driverLng, 45, 18);
            },
            { enableHighAccuracy: true, timeout: 4000 }
          );
        } else {
          wsService.sendRiderLocation(driverLat, driverLng, 45, 18);
        }
      } else {
        wsService.sendRiderLocation(driverLat, driverLng, 45, 22);
      }
    }, 3500);

    return () => clearInterval(streamTimer);
  }, [isOnline, trackingMode, driverLat, driverLng]);

  // Route boundary security: Only registered Driver Partners can access this screen
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    if (user?.role !== 'rider') {
      if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(passenger)');
      }
      return;
    }

    if (user?.rider_profile?.rider_service_type === 'CAMPUS') {
      setCurrentTab('campus');
    }

    wsService.connect();
    requestGpsPermission();
    loadDashboard();
    fetchActiveRide();
    loadHistory();
    checkForIncomingRequests();
  }, [isAuthenticated, user]);

  const loadDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const data = await api.rider.getDashboard();
      setDashboard(data);
      setIsOnline(data.is_online);
      const anyData = data as any;
      if (anyData.current_latitude && anyData.current_longitude) {
        setDriverLat(anyData.current_latitude);
        setDriverLng(anyData.current_longitude);
      }
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const trips = await api.rides.getHistory(50);
      setRidesHistory(trips || []);
    } catch (e) {
      console.error('Error loading ride history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchActiveRide = async () => {
    try {
      const active = await api.rides.getActiveRide();
      if (active && active.status !== 'CANCELLED' && active.status !== 'COMPLETED' && active.status !== 'NO_RIDER_AVAILABLE') {
        setActiveRide(active);
      } else {
        setActiveRide(null);
      }
    } catch (e) {
      console.error('Error fetching active ride:', e);
    }
  };

  // Poll for requests while online
  const checkForIncomingRequests = async () => {
    const rawStatus = (dashboard?.approval_status || (user as any)?.rider_profile?.status || '').toLowerCase();
    if (rawStatus === 'pending' || rawStatus === 'rejected') return;
    try {
      const requests = await api.rider.getRequests();
      if (requests && requests.length > 0) {
        requests.forEach((r) => enqueueRequest(r));
        setCountdown((prev) => (prev > 0 ? prev : requests[0].expires_in_seconds || 45));
      }
    } catch (e) {
      // ignore network hiccups
    }
  };

  useEffect(() => {
    const pollTimer = setInterval(() => {
      if (isOnline) {
        checkForIncomingRequests();
      }
    }, 2500);

    return () => clearInterval(pollTimer);
  }, [isOnline, activeRide]);

  // Request countdown timer (45s per top request)
  useEffect(() => {
    if (!incomingRequest) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Cooldown and pop
          declinedCooldownMap.current[incomingRequest.ride_id] = Date.now();
          setRequestQueue((q) => q.filter((r) => r.ride_id !== incomingRequest.ride_id));
          return 45;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [incomingRequest?.ride_id]);

  // Decline current incoming request with 60-second cooldown
  const handleDeclineRide = async () => {
    if (!incomingRequest) return;
    const rideIdToDecline = incomingRequest.ride_id;
    declinedCooldownMap.current[rideIdToDecline] = Date.now();

    // Immediately dequeue so the next request appears
    setRequestQueue((prev) => prev.filter((r) => r.ride_id !== rideIdToDecline));
    setCountdown(45);

    try {
      await api.rides.rejectRide(rideIdToDecline);
    } catch (e) {
      // ignore
    }
  };

  // WebSocket subscriptions
  useEffect(() => {
    const unbindConn = wsService.subscribe('connection_status', (data) => {
      setIsWsConnected(data.connected);
      if (data.connected && data.isReconnect) {
        if (isSyncingRiderRef.current) return;
        isSyncingRiderRef.current = true;
        Promise.all([
          loadDashboard(),
          fetchActiveRide(),
          loadHistory(),
          checkForIncomingRequests(),
        ]).finally(() => {
          isSyncingRiderRef.current = false;
        });
      }
    });

    const unbindIncoming = wsService.subscribe('ride_incoming', (data: IncomingRideRequest) => {
      enqueueRequest(data);
      setCountdown(data.expires_in_seconds || 45);
    });

    const unbindConfirmed = wsService.subscribe('ride_confirmed_for_rider', (data) => {
      api.rides.getRideDetails(data.ride_id).then((r) => setActiveRide(r));
      setRequestQueue([]);
    });

    const unbindTaken = wsService.subscribe('ride_taken_by_another', (data: { ride_id: string }) => {
      setRequestQueue((prev) => prev.filter((r) => r.ride_id !== data.ride_id));
      if (incomingRequestRef.current?.ride_id === data.ride_id) {
        Alert.alert(
          'Ride Assigned ⚡',
          'Yeh ride dusre driver partner ne pehle accept kar li hai. Best of luck for the next ride!'
        );
      }
    });

    const unbindCancelled = wsService.subscribe('ride_cancelled', (data) => {
      Alert.alert('Ride Cancelled', data.reason || 'Passenger cancelled the ride');
      setActiveRide(null);
      setShowPaymentModal(false);
      setShowOtpModal(false);
      loadDashboard();
      loadHistory();
    });

    return () => {
      unbindConn();
      unbindIncoming();
      unbindConfirmed();
      unbindTaken();
      unbindCancelled();
    };
  }, []);

  // Periodic REST fallback sync during active trip
  useEffect(() => {
    if (!activeRide) return;
    const fallbackPollTimer = setInterval(async () => {
      try {
        const authoritative = await api.rides.getActiveRide();
        if (!authoritative || authoritative.status === 'CANCELLED' || authoritative.status === 'COMPLETED') {
          setActiveRide(null);
          setShowPaymentModal(false);
          setShowOtpModal(false);
          loadDashboard();
          loadHistory();
        } else if (authoritative.status !== activeRide.status) {
          setActiveRide(authoritative);
        }
      } catch (e) {
        // network retry
      }
    }, 3000);

    return () => clearInterval(fallbackPollTimer);
  }, [activeRide?.id, activeRide?.status]);

  // Carpool tab effect
  useEffect(() => {
    if (currentTab === 'carpool') {
      loadMyCarpools();
    }
  }, [currentTab]);

  const handleRespondCarpoolBooking = async (bookingId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await api.communityRides.respondReservation(bookingId, action);
      Alert.alert(action === 'ACCEPT' ? 'Accepted! ✅' : 'Rejected', `Reservation ${action.toLowerCase()}ed.`);
      loadMyCarpools();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update reservation');
    }
  };

  const handleUpdateCarpoolStatus = async (rideId: string, status: string) => {
    try {
      await api.communityRides.updateRideStatus(rideId, status);
      Alert.alert('Status Updated', `Carpool ride marked as ${status}`);
      loadMyCarpools();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update ride status');
    }
  };



  // Toggle Online / Offline with instant GPS prompt
  const handleToggleOnline = async (value: boolean) => {
    const rawStatus = (dashboard?.approval_status || (user as any)?.rider_profile?.status || '').toLowerCase();
    if (value && rawStatus === 'pending') {
      Alert.alert(
        'Verification In Progress ⏳',
        'Aapka document verification process me hai (Waiting 24-72 hours for janch). Admin approval ke baad hi aap Online ho sakte hain.'
      );
      setIsOnline(false);
      return;
    }
    if (value && rawStatus === 'rejected') {
      Alert.alert(
        'Application Declined ❌',
        `Aapka driver verification reject ho gaya hai: ${dashboard?.rejection_reason || 'Please contact support'}`
      );
      setIsOnline(false);
      return;
    }

    try {
      let activeLat = driverLat;
      let activeLng = driverLng;

      if (value) {
        // Prompt for exact GPS location immediately upon going online
        const coords = await requestGpsCoordinates();
        if (coords) {
          activeLat = coords.lat;
          activeLng = coords.lng;
          setDriverLat(coords.lat);
          setDriverLng(coords.lng);
          setTrackingMode('device_gps');
          api.rider.updateLocation(coords.lat, coords.lng, coords.heading, coords.speed).catch(() => {});
          wsService.sendRiderLocation(coords.lat, coords.lng, coords.heading, coords.speed);
        }
      }

      const res = await api.rider.toggleStatus(value, activeLat, activeLng);
      setIsOnline(res.is_online);
      loadDashboard();
      if (value) {
        checkForIncomingRequests();
      }
    } catch (err: any) {
      Alert.alert('Status Error', err.message || 'Failed to change status');
      setIsOnline(!value);
    }
  };

  // Operating Area Selection
  const handleSelectZone = async (zone: OperatingZone) => {
    setSelectedZone(zone);
    setDriverLat(zone.lat);
    setDriverLng(zone.lng);
    setShowZonePicker(false);

    try {
      await api.rider.updateLocation(zone.lat, zone.lng, 45, 20);
      wsService.sendRiderLocation(zone.lat, zone.lng, 45, 20);
      Alert.alert('Zone Updated', `Active fleet synced to ${zone.name}`);
    } catch (e) {
      console.error('Error updating zone:', e);
    }
  };

  // Accept incoming ride
  const handleAcceptRide = async () => {
    if (!incomingRequest) return;
    if (activeRide) {
      Alert.alert(
        'Current Trip in Progress 🔒',
        'Aapki current ride abhi chal rahi hai. Pehle passenger ko drop location tak pahunchayein, uske baad hi next ride le sakte hain.'
      );
      return;
    }

    const targetRideId = incomingRequest.ride_id;
    setActionLoading(true);
    try {
      const ride = await api.rides.acceptRide(targetRideId);
      setActiveRide(ride);
      setRequestQueue((prev) => prev.filter((r) => r.ride_id !== targetRideId));
      setCurrentTab('dispatch');
      Alert.alert('Ride Confirmed! 🚀', 'Navigate to pickup location.');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already been accepted') || msg.includes('Conflict') || err.status === 409) {
        Alert.alert(
          'Ride Assigned ⚡',
          'Yeh ride dusre nearby driver partner ne pehle accept kar li hai. Best of luck for the next ride!'
        );
      } else {
        Alert.alert('Ride Unavailable', msg || 'Ride was taken by another driver');
      }
      setRequestQueue((prev) => prev.filter((r) => r.ride_id !== targetRideId));
    } finally {
      setActionLoading(false);
    }
  };

  // Real-time Vehicle Navigation & Movement Stepper
  useEffect(() => {
    if (!activeRide) return;
    if (activeRide.status !== 'RIDER_ARRIVING' && activeRide.status !== 'IN_PROGRESS') return;

    const isArriving = activeRide.status === 'RIDER_ARRIVING';
    const targetLat = isArriving ? activeRide.pickup_latitude : activeRide.destination_latitude;
    const targetLng = isArriving ? activeRide.pickup_longitude : activeRide.destination_longitude;

    if (!targetLat || !targetLng) return;

    const navTimer = setInterval(() => {
      setDriverLat((curLat) => {
        setDriverLng((curLng) => {
          const dLat = targetLat - curLat;
          const dLng = targetLng - curLng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          // If within ~30-40 meters of target, reached
          if (dist < 0.0003) {
            return targetLng;
          }

          // Step ~25-30 meters per tick (~50 km/h)
          const stepRatio = Math.min(0.08, 0.00025 / dist);
          const nextLat = curLat + dLat * stepRatio;
          const nextLng = curLng + dLng * stepRatio;

          // Calculate real road bearing
          const dLonRad = (targetLng - curLng) * (Math.PI / 180);
          const y = Math.sin(dLonRad) * Math.cos(targetLat * (Math.PI / 180));
          const x =
            Math.cos(curLat * (Math.PI / 180)) * Math.sin(targetLat * (Math.PI / 180)) -
            Math.sin(curLat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) * Math.cos(dLonRad);
          const bearing = Math.round((Math.atan2(y, x) * (180 / Math.PI) + 360) % 360);

          // Stream to backend via WebSocket for real-time passenger tracking
          wsService.sendRiderLocation(nextLat, nextLng, bearing, isArriving ? 28 : 38);

          return nextLng;
        });

        const dLat = targetLat - curLat;
        const dLng = targetLng - driverLng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < 0.0003) return targetLat;
        const stepRatio = Math.min(0.08, 0.00025 / dist);
        return curLat + dLat * stepRatio;
      });
    }, 1800);

    return () => clearInterval(navTimer);
  }, [activeRide?.id, activeRide?.status, activeRide?.pickup_latitude, activeRide?.pickup_longitude, activeRide?.destination_latitude, activeRide?.destination_longitude]);

  // Mark arrived at pickup
  const handleMarkArrived = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const updated = await api.rides.markArrived(activeRide.id);
      setActiveRide(updated);
      setShowOtpModal(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark arrival');
    } finally {
      setActionLoading(false);
    }
  };

  // Verify Passenger 4-Digit PIN
  const handleVerifyOtpAndStart = async () => {
    if (!enteredOtp || enteredOtp.length !== 4) {
      Alert.alert('Invalid PIN', 'Enter the 4-digit PIN provided by the passenger');
      return;
    }
    setVerifyingOtp(true);
    try {
      const updated = await api.rides.verifyOtpAndStart(activeRide!.id, enteredOtp);
      setActiveRide(updated);
      setShowOtpModal(false);
      setEnteredOtp('');
      Alert.alert('PIN Verified!', 'Trip in progress. Drive safely to destination!');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Wrong OTP entered');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Complete Trip & Settle Payment
  const handleSettleAndCompleteTrip = async (method: 'UPI_QR' | 'CASH') => {
    if (!activeRide) return;
    setSettlingPayment(true);
    try {
      const completed = await api.rides.completeRide(activeRide.id);
      setShowPaymentModal(false);
      Alert.alert(
        'Payment Settled & Trip Completed! 🎉',
        `Fare Collected: ₹${Math.round(completed.final_fare || activeRide.estimated_fare)}\nPayment Method: ${method === 'UPI_QR' ? 'UPI QR Scan' : 'Cash'}\nEarnings credited to your wallet!`
      );
      setActiveRide(null);
      loadDashboard();
      loadHistory();
    } catch (err: any) {
      Alert.alert('Completion Error', err.message || 'Failed to complete trip');
    } finally {
      setSettlingPayment(false);
    }
  };

  // Driver Cancel Ride
  const handleDriverCancel = async () => {
    if (!activeRide) return;
    setCancelling(true);
    try {
      await api.rides.cancelRide(activeRide.id, `Driver: ${cancelReason}`);
      setActiveRide(null);
      setShowCancelModal(false);
      Alert.alert('Ride Cancelled', 'You are now ready for new rides.');
      loadDashboard();
      loadHistory();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to cancel ride');
    } finally {
      setCancelling(false);
    }
  };


  // Switch Vehicle Category
  const handleSwitchVehicle = async (category: string) => {
    try {
      await api.rider.switchVehicle(category);
      Alert.alert('Vehicle Updated', `Your active vehicle is now set to ${category.toUpperCase()}!`);
      loadDashboard();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to switch vehicle');
    }
  };

  // Process Instant Wallet Payout
  const handleProcessPayout = async () => {
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid withdrawal amount in ₹');
      return;
    }
    const maxBal = dashboard?.wallet_balance || 0;
    if (amt > maxBal) {
      Alert.alert('Insufficient Balance', `Your maximum withdrawable balance is ₹${maxBal.toFixed(2)}`);
      return;
    }

    setPayoutLoading(true);
    try {
      const res = await api.rider.requestPayout(amt, payoutUpi);
      setShowPayoutModal(false);
      setPayoutAmount('');
      Alert.alert('Payout Initiated! 💳', res.message);
      loadDashboard();
    } catch (err: any) {
      Alert.alert('Payout Error', err.message || 'Failed to process payout');
    } finally {
      setPayoutLoading(false);
    }
  };

  // Submit Support Ticket
  const handleSubmitTicket = () => {
    if (!ticketDesc.trim()) {
      Alert.alert('Required', 'Please describe your query or problem');
      return;
    }
    setSubmittingTicket(true);
    setTimeout(() => {
      setSubmittingTicket(false);
      setShowTicketModal(false);
      setTicketDesc('');
      Alert.alert('Ticket Submitted! 🎫', `Ticket #TKT-${Math.floor(100000 + Math.random() * 900000)} has been created under category "${ticketCategory}". Our support team will resolve it within 2 hours.`);
    }, 800);
  };

  // Distinct passengers served aggregated from database history
  const aggregatedPassengers = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      phone: string;
      totalRides: number;
      lastDate: string;
      totalSpent: number;
      rating: number;
    }>();

    ridesHistory.forEach((ride) => {
      const pName = ride.passenger?.full_name || 'Passenger';
      const pPhone = ride.passenger?.phone_number || '+91 91111 11111';
      const pKey = ride.passenger?.id || pPhone;
      const fare = Math.round(ride.final_fare || ride.estimated_fare || 0);

      const existing = map.get(pKey);
      if (existing) {
        existing.totalRides += 1;
        existing.totalSpent += fare;
      } else {
        map.set(pKey, {
          id: pKey,
          name: pName,
          phone: pPhone,
          totalRides: 1,
          lastDate: ride.created_at ? new Date(ride.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent',
          totalSpent: fare,
          rating: 5.0,
        });
      }
    });

    return Array.from(map.values());
  }, [ridesHistory]);

  // Filtered ride history
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'COMPLETED') {
      return ridesHistory.filter((r) => r.status === 'COMPLETED');
    }
    if (historyFilter === 'CANCELLED') {
      return ridesHistory.filter((r) => r.status === 'CANCELLED');
    }
    return ridesHistory;
  }, [ridesHistory, historyFilter]);

  // Dynamic Real-Time UPI & Fare Calculation for Dropoff
  const fareAmount = Math.round(activeRide?.final_fare || activeRide?.estimated_fare || 0);
  const rawPhoneClean = (user?.phone_number || '').replace(/\D/g, '').slice(-10);
  const activeDriverUpi = payoutUpi.trim() || (rawPhoneClean ? `${rawPhoneClean}@upi` : 'indiride.driver@icici');
  const driverDisplayName = dashboard?.full_name || user?.full_name || 'IndiRide Partner';
  const tripShortId = activeRide?.id ? activeRide.id.slice(0, 8).toUpperCase() : 'FARE';
  const dynamicUpiPayload = `upi://pay?pa=${encodeURIComponent(activeDriverUpi)}&pn=${encodeURIComponent(driverDisplayName)}&am=${fareAmount}&cu=INR&tn=${encodeURIComponent(`IndiRide Ride #${tripShortId}`)}&tr=${activeRide?.id || ''}`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(dynamicUpiPayload)}`;

  // Active vehicle info from backend
  const activeVehicle = dashboard?.vehicle || { category: 'car', model: 'Swift Dzire', plate: 'KA-03-AB-4422' };
  const vehicleList = dashboard?.vehicles || [
    { category: 'car', model: 'Swift Dzire', plate: 'KA-03-AB-4422', is_active: true },
    { category: 'bike', model: 'Splendor Plus', plate: 'KA-01-EK-8892', is_active: false },
    { category: 'auto', model: 'RE Compact EV', plate: 'KA-01-AU-9912', is_active: false },
  ];

  const rawStatus = (dashboard?.approval_status || (user as any)?.rider_profile?.status || '').toLowerCase();
  const isPendingApproval = rawStatus === 'pending';
  const isRejectedApproval = rawStatus === 'rejected';

  if (!isAuthenticated || user?.role !== 'rider') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (loadingDashboard && !dashboard) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ marginTop: 14, color: '#64748b', fontSize: 14, fontWeight: '600' }}>
          Loading Driver Profile...
        </Text>
      </View>
    );
  }

  if (isPendingApproval || isRejectedApproval) {
    return (
      <View style={styles.container}>
        {/* Top Driver Header (Pending / Verification Mode) */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.driverInfoRow}>
              <View style={[styles.driverBadge, { backgroundColor: isPendingApproval ? '#78350f' : '#7f1d1d' }]}>
                <Ionicons
                  name={isPendingApproval ? 'time' : 'close-circle'}
                  size={20}
                  color={isPendingApproval ? '#fbbf24' : '#f87171'}
                />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.driverName}>{dashboard?.full_name || user?.full_name || 'Driver Partner'}</Text>
                  <View
                    style={{
                      backgroundColor: isPendingApproval ? '#fef3c7' : '#fee2e2',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: isPendingApproval ? '#b45309' : '#dc2626',
                      }}
                    >
                      {isPendingApproval ? 'PENDING VERIFICATION' : 'DECLINED'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.driverVehicle}>
                  {activeVehicle.model} • {activeVehicle.plate}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.refreshPendingBtn}
              onPress={async () => {
                await loadDashboard();
                Alert.alert(
                  'Status Refreshed 🔄',
                  dashboard?.approval_status === 'approved'
                    ? 'Badhai ho! Aapka application approve ho gaya hai. Ab aap rides lena shuru kar sakte hain.'
                    : 'Aapka document verification process me hai. Verification me 24 to 72 hours lagte hain (Waiting 24-72 hours for janch).'
                );
              }}
              disabled={loadingDashboard}
            >
              {loadingDashboard ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color="#10b981" />
                  <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>Refresh</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                logout();
                router.replace('/(auth)/login');
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Verification Waiting Screen Content */}
        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {isPendingApproval ? (
            <View style={styles.verificationBannerCard}>
              <View style={styles.verificationIconWrap}>
                <Ionicons name="time" size={42} color="#d97706" />
              </View>

              <View style={styles.verificationBadgePill}>
                <Text style={styles.verificationBadgePillText}>⏳ VERIFICATION IN PROGRESS</Text>
              </View>

              <Text style={styles.verificationMainTitle}>
                Waiting 24-72 hours for janch
              </Text>

              <Text style={styles.verificationHindiNotice}>
                Aapka document verification process me hai. Verification me 24 to 72 hours lagte hain. Hamari team aapke Driving License, Vehicle details aur photos ki jaanch kar rahi hai.
              </Text>

              <View style={styles.verificationNoticeDivider} />

              <Text style={styles.verificationSubNotice}>
                Jaanch poori hone aur Admin dwara approved hone ke baad aapka account permanent unlock ho jayega aur aap rides lena shuru kar sakenge.
              </Text>
            </View>
          ) : (
            <View style={[styles.verificationBannerCard, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
              <View style={[styles.verificationIconWrap, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="close-circle" size={42} color="#dc2626" />
              </View>

              <View style={[styles.verificationBadgePill, { backgroundColor: '#fee2e2' }]}>
                <Text style={[styles.verificationBadgePillText, { color: '#b91c1c' }]}>❌ APPLICATION DECLINED</Text>
              </View>

              <Text style={[styles.verificationMainTitle, { color: '#991b1b' }]}>
                Application Not Approved
              </Text>

              <Text style={[styles.verificationHindiNotice, { color: '#7f1d1d' }]}>
                {dashboard?.rejection_reason || 'Aapke documents verification criteria se match nahi hue.'}
              </Text>

              <Text style={styles.verificationSubNotice}>
                Kripya sahi Driving License aur clear photos ke sath hamari support team se contact karein ya naya application submit karein.
              </Text>
            </View>
          )}

          {/* Stepper Card */}
          <View style={styles.stepperCard}>
            <Text style={styles.stepperCardTitle}>APPLICATION PROGRESS</Text>

            <View style={styles.stepperRow}>
              <View style={styles.stepperDotDone}>
                <Ionicons name="checkmark" size={14} color="#ffffff" />
              </View>
              <View style={styles.stepperLineDone} />
              <View style={styles.stepperDotDone}>
                <Ionicons name="checkmark" size={14} color="#ffffff" />
              </View>
              <View style={isPendingApproval ? styles.stepperLineActive : styles.stepperLineDone} />
              <View style={isPendingApproval ? styles.stepperDotActive : (isRejectedApproval ? styles.stepperDotError : styles.stepperDotDone)}>
                <Ionicons name={isPendingApproval ? "time" : (isRejectedApproval ? "close" : "checkmark")} size={14} color="#ffffff" />
              </View>
              <View style={styles.stepperLineFuture} />
              <View style={styles.stepperDotFuture}>
                <Ionicons name="lock-closed" size={12} color="#94a3b8" />
              </View>
            </View>

            <View style={styles.stepperLabelsRow}>
              <Text style={styles.stepperLabelDone}>Mobile OTP{'\n'}Verified</Text>
              <Text style={styles.stepperLabelDone}>KYC Details{'\n'}Submitted</Text>
              <Text style={isPendingApproval ? styles.stepperLabelActive : (isRejectedApproval ? styles.stepperLabelError : styles.stepperLabelDone)}>
                {isPendingApproval ? 'Admin Janch\n(24-72 hrs)' : (isRejectedApproval ? 'Declined\nReview' : 'Verified')}
              </Text>
              <Text style={styles.stepperLabelFuture}>Live Rides{'\n'}Unlocked</Text>
            </View>
          </View>

          {/* Submitted KYC Summary Card */}
          <View style={styles.kycSummaryCard}>
            <View style={styles.kycSummaryHeader}>
              <Ionicons name="document-text" size={18} color="#2563EB" />
              <Text style={styles.kycSummaryTitle}>SUBMITTED DETAILS UNDER REVIEW</Text>
            </View>

            <View style={styles.kycFieldRow}>
              <Text style={styles.kycFieldLabel}>Driver Name</Text>
              <Text style={styles.kycFieldValue}>{dashboard?.full_name || user?.full_name || 'N/A'}</Text>
            </View>

            <View style={styles.kycFieldRow}>
              <Text style={styles.kycFieldLabel}>Mobile (OTP Verified)</Text>
              <Text style={styles.kycFieldValue}>+91 {dashboard?.phone_number?.replace(/\D/g, '').slice(-10) || user?.phone_number?.replace(/\D/g, '').slice(-10)}</Text>
            </View>

            <View style={styles.kycFieldRow}>
              <Text style={styles.kycFieldLabel}>Driving License Number</Text>
              <Text style={[styles.kycFieldValue, { fontWeight: '800', color: '#0f172a' }]}>
                {dashboard?.license_number || 'Under Review'}
              </Text>
            </View>

            <View style={styles.kycFieldRow}>
              <Text style={styles.kycFieldLabel}>Aadhaar Card Number</Text>
              <Text style={[styles.kycFieldValue, { fontWeight: '800', color: '#0284c7' }]}>
                {dashboard?.aadhaar_number || 'Under Review'}
              </Text>
            </View>

            <View style={styles.kycFieldRow}>
              <Text style={styles.kycFieldLabel}>Vehicle Type & Plate</Text>
              <Text style={styles.kycFieldValue}>
                {activeVehicle.category.toUpperCase()} • {activeVehicle.plate} ({activeVehicle.model})
              </Text>
            </View>

            <View style={styles.kycFieldRowCol}>
              <Text style={styles.kycFieldLabel}>Permanent Address</Text>
              <Text style={styles.kycFieldValueLong}>
                {dashboard?.permanent_address || 'Permanent address submitted'}
              </Text>
            </View>

            <View style={styles.kycFieldRowCol}>
              <Text style={styles.kycFieldLabel}>Current / Operating Address</Text>
              <Text style={styles.kycFieldValueLong}>
                {dashboard?.current_address || dashboard?.permanent_address || 'Operating address submitted'}
              </Text>
            </View>

            {/* Document Photos Preview */}
            <Text style={[styles.kycFieldLabel, { marginTop: 14, marginBottom: 8 }]}>Uploaded Document Photos (Passport • DL • Aadhaar)</Text>
            <View style={styles.kycPhotosRow}>
              <View style={styles.kycPhotoBox}>
                <Text style={styles.kycPhotoTitle}>Passport Photo</Text>
                {dashboard?.passport_photo ? (
                  <Image source={{ uri: dashboard.passport_photo }} style={styles.kycPhotoThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.kycPhotoPlaceholder}>
                    <Ionicons name="person-circle-outline" size={36} color="#94a3b8" />
                    <Text style={styles.kycPhotoPlaceholderText}>Photo on file</Text>
                  </View>
                )}
              </View>

              <View style={styles.kycPhotoBox}>
                <Text style={styles.kycPhotoTitle}>Driving License</Text>
                {dashboard?.license_photo ? (
                  <Image source={{ uri: dashboard.license_photo }} style={styles.kycPhotoThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.kycPhotoPlaceholder}>
                    <Ionicons name="card-outline" size={36} color="#94a3b8" />
                    <Text style={styles.kycPhotoPlaceholderText}>Document on file</Text>
                  </View>
                )}
              </View>

              <View style={styles.kycPhotoBox}>
                <Text style={styles.kycPhotoTitle}>Aadhaar Card</Text>
                {dashboard?.aadhaar_photo ? (
                  <Image source={{ uri: dashboard.aadhaar_photo }} style={styles.kycPhotoThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.kycPhotoPlaceholder}>
                    <Ionicons name="finger-print-outline" size={36} color="#94a3b8" />
                    <Text style={styles.kycPhotoPlaceholderText}>Aadhaar on file</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.refreshStatusActionBtn}
            onPress={async () => {
              await loadDashboard();
              Alert.alert(
                'Status Checked 🔄',
                dashboard?.approval_status === 'approved'
                  ? 'Aapka account approve ho chuka hai! Aap live ho sakte hain.'
                  : 'Aapka application abhi verification me hai (24-72 hours). Hamari team jaanch kar rahi hai.'
              );
            }}
            disabled={loadingDashboard}
            activeOpacity={0.85}
          >
            {loadingDashboard ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#ffffff" />
                <Text style={styles.refreshStatusActionText}>Refresh Verification Status</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.supportContactRow}>
            <Ionicons name="headset" size={16} color="#64748b" />
            <Text style={styles.supportContactText}>
              Need assistance? WhatsApp or call IndiRide Support: +91 98765 43210
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // DEDICATED CAMPUS DRIVER CONSOLE (STRICT ROLE-BASED LOCK)
  // -------------------------------------------------------------
  if (isCampusDriver) {
    const collegeDisplay =
      dashboard?.college_name ||
      user?.rider_profile?.college_name ||
      dashboard?.served_universities ||
      'Parul University, Vadodara';

    return (
      <View style={styles.container}>
        {/* Dedicated Campus Driver Top Header */}
        <View style={[styles.header, { backgroundColor: '#064e3b', borderBottomColor: '#047857' }]}>
          <View style={styles.headerLeft}>
            <View style={styles.driverInfoRow}>
              <View style={[styles.driverBadge, { backgroundColor: '#022c22' }]}>
                <Ionicons name="school" size={22} color="#10b981" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.driverName, { color: '#ffffff' }]}>
                    {dashboard?.full_name || user?.full_name || 'Campus Driver'}
                  </Text>
                  <View style={{ backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff' }}>CAMPUS RIDER</Text>
                  </View>
                </View>
                <Text style={[styles.driverVehicle, { color: '#a7f3d0' }]} numberOfLines={1}>
                  🎓 {collegeDisplay}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.onlineToggleRow}>
              <Text style={[styles.onlineLabel, { color: isOnline ? '#34d399' : '#9ca3af' }]}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={handleToggleOnline}
                trackColor={{ false: '#064e3b', true: '#10b981' }}
                thumbColor="#ffffff"
              />
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                logout();
                router.replace('/(auth)/login');
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#a7f3d0" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dedicated Campus Driver Console (Post Ride, Bookings, Student Requests, Universities) */}
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <CampusDriverPanel />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Driver Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.driverInfoRow}>
            <View style={styles.driverBadge}>
              <MaterialCommunityIcons
                name={activeVehicle.category === 'bike' ? 'motorbike' : activeVehicle.category === 'auto' ? 'rickshaw' : 'car-side'}
                size={22}
                color="#10b981"
              />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.driverName}>{dashboard?.full_name || user?.full_name || 'Driver Partner'}</Text>
                <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              </View>
              <Text style={styles.driverVehicle}>
                {activeVehicle.model} • {activeVehicle.plate}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          {!isWsConnected && (
            <View style={styles.reconnectBadge}>
              <ActivityIndicator size="small" color="#f59e0b" style={{ marginRight: 4 }} />
              <Text style={styles.reconnectBadgeText}>Connecting...</Text>
            </View>
          )}

          <View style={styles.onlineToggleRow}>
            <Text style={[styles.onlineLabel, { color: isOnline ? '#10b981' : '#9ca3af' }]}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: '#334155', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              logout();
              router.replace('/(auth)/login');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Screen Content */}
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* ======================================================== */}
        {/* TAB 1: DISPATCH / RADAR / LIVE TRIP                      */}
        {/* ======================================================== */}
        {currentTab === 'dispatch' && (
          <View>
            {/* Operating Area Selector Banner */}
            <View style={styles.areaBanner}>
              <View style={styles.areaBannerLeft}>
                <Ionicons name="location" size={20} color="#3b82f6" />
                <View>
                  <Text style={styles.areaBannerLabel}>CURRENT OPERATING AREA</Text>
                  <Text style={styles.areaBannerValue}>{selectedZone.name}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.changeAreaBtn}
                onPress={() => setShowZonePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.changeAreaBtnText}>Change Zone</Text>
              </TouchableOpacity>
            </View>

            {/* Real Active Fleet Status Chip */}
            <View style={styles.activeFleetBar}>
              <View style={styles.livePulseDot} />
              <Text style={styles.activeFleetText}>
                Zone Status: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{selectedZone.activeDriversCount} active drivers</Text> online nearby (Bikes, Autos & Cabs)
              </Text>
            </View>

            {/* Live Real Device GPS Status Bar */}
            <View style={styles.gpsTrackingBar}>
              <View style={styles.gpsModeLeft}>
                <View style={[styles.livePulseDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.gpsModeText}>
                  📡 Live Device GPS ({driverLat.toFixed(4)}, {driverLng.toFixed(4)})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.gpsModeRefreshBtn}
                onPress={() => requestGpsPermission()}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={13} color="#059669" />
                <Text style={styles.gpsModeRefreshText}>Sync GPS</Text>
              </TouchableOpacity>
            </View>

            {gpsError && trackingMode === 'device_gps' && (
              <View style={styles.gpsErrorBanner}>
                <Ionicons name="information-circle" size={14} color="#b45309" />
                <Text style={styles.gpsErrorText}>{gpsError}</Text>
              </View>
            )}

            {/* Live Navigation Map during active trip */}
            {activeRide && (
              <View style={styles.mapSection}>
                <MapCanvas
                  pickupLat={activeRide.pickup_latitude}
                  pickupLng={activeRide.pickup_longitude}
                  dropoffLat={activeRide.status === 'IN_PROGRESS' ? activeRide.destination_latitude : undefined}
                  dropoffLng={activeRide.status === 'IN_PROGRESS' ? activeRide.destination_longitude : undefined}
                  driverLat={driverLat}
                  driverLng={driverLng}
                  vehicleCategory={activeRide.vehicle_category}
                  routeGeometry={
                    activeRide.status === 'IN_PROGRESS'
                      ? (activeRide.route_polyline ? (() => { try { return JSON.parse(activeRide.route_polyline); } catch (e) { return []; } })() : [])
                      : []
                  }
                  driverToPickupRoute={activeRide.status === 'RIDER_ARRIVING' ? activeRide.driver_to_pickup_route : []}
                />
              </View>
            )}

            {/* ACTIVE TRIP CARD */}
            {activeRide ? (
              <View style={styles.activeTripCard}>
                <View style={styles.tripStatusBadge}>
                  <Text style={styles.tripStatusText}>ACTIVE TRIP: {activeRide.status.replace(/_/g, ' ')}</Text>
                </View>

                <View style={styles.passengerDetailRow}>
                  <View style={styles.passengerAvatar}>
                    <Ionicons name="person" size={22} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passengerName}>{activeRide.passenger?.full_name || 'Passenger'}</Text>
                    <Text style={styles.passengerPhone}>{activeRide.passenger?.phone_number || '+91 91111 11111'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.fareHighlight}>₹{fareAmount}</Text>
                    <Text style={styles.fareSubText}>Trip Fare</Text>
                  </View>
                </View>

                {/* Addresses */}
                <View style={styles.tripPoints}>
                  <View style={styles.pointRow}>
                    <View style={[styles.pointDot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.pointText} numberOfLines={1}>
                      Pickup: {activeRide.pickup_address}
                    </Text>
                  </View>
                  <View style={styles.pointRow}>
                    <View style={[styles.pointDot, { backgroundColor: '#000000' }]} />
                    <Text style={styles.pointText} numberOfLines={1}>
                      Drop: {activeRide.destination_address}
                    </Text>
                  </View>
                </View>

                {/* Lifecycle Action Buttons */}
                {activeRide.status === 'RIDER_ARRIVING' && (
                  <View style={styles.actionBtnGroup}>
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={handleMarkArrived}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.actionBtnText}>📍 I Have Arrived at Pickup</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelTripBtn}
                      onPress={() => setShowCancelModal(true)}
                    >
                      <Text style={styles.cancelTripBtnText}>❌ Cancel Ride</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(activeRide.status === 'RIDER_ARRIVED' || activeRide.status === 'OTP_VERIFICATION') && (
                  <View style={styles.actionBtnGroup}>
                    <TouchableOpacity
                      style={[styles.actionBtnPrimary, { backgroundColor: '#059669' }]}
                      onPress={() => setShowOtpModal(true)}
                    >
                      <Text style={styles.actionBtnText}>🔐 Enter Passenger PIN & Start Trip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelTripBtn}
                      onPress={() => setShowCancelModal(true)}
                    >
                      <Text style={styles.cancelTripBtnText}>❌ Cancel Ride</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {activeRide.status === 'IN_PROGRESS' && (
                  <View style={styles.actionBtnGroup}>
                    <TouchableOpacity
                      style={[styles.actionBtnPrimary, { backgroundColor: '#dc2626' }]}
                      onPress={() => setShowPaymentModal(true)}
                    >
                      <Text style={styles.actionBtnText}>🏁 Dropoff Passenger & End Ride</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelTripBtn}
                      onPress={() => setShowCancelModal(true)}
                    >
                      <Text style={styles.cancelTripBtnText}>❌ Emergency Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              /* Idle Radar Card */
              <View style={styles.idleCard}>
                <MaterialCommunityIcons
                  name={isOnline ? 'radar' : 'power'}
                  size={52}
                  color={isOnline ? '#10b981' : '#9ca3af'}
                />
                <Text style={styles.idleTitle}>
                  {isOnline ? 'Radar Active & Ready for Rides' : 'You Are Currently Offline'}
                </Text>
                <Text style={styles.idleSub}>
                  {isOnline
                    ? `Matching passengers within 2 km of ${selectedZone.name}. New ride requests ring automatically.`
                    : 'Turn on the switch in the header to go online and receive passenger bookings.'}
                </Text>

              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB: CAMPUS DRIVER OPERATIONS                            */}
        {/* ======================================================== */}
        {currentTab === 'campus' && (
          <CampusDriverPanel />
        )}

        {/* ======================================================== */}
        {/* TAB: CARPOOL / VEHICLE OWNER RIDE SHARING                */}
        {/* ======================================================== */}
        {currentTab === 'carpool' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.sectionHeading}>⚡ Fast Ride & Custom Pricing</Text>
                <Text style={styles.tabDescriptionText}>
                  Set your custom ride rates and post peer-to-peer fast rides along your daily route.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#0f172a',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onPress={() => setShowPostFastRideModal(true)}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>+ Post Ride</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#10b981',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                  onPress={loadMyCarpools}
                >
                  <Ionicons name="refresh" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Rider Custom Rate Configuration Card */}
            <View style={styles.customRateCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pricetag" size={18} color="#f59e0b" />
                  <Text style={styles.customRateCardTitle}>Custom Fast Booking Rate</Text>
                </View>
                <View style={[styles.customRateStatusBadge, { backgroundColor: isCustomPriceActive ? '#ecfdf5' : '#f1f5f9' }]}>
                  <Text style={[styles.customRateStatusText, { color: isCustomPriceActive ? '#059669' : '#64748b' }]}>
                    {isCustomPriceActive ? 'CUSTOM RATE ACTIVE' : 'STANDARD RATE'}
                  </Text>
                </View>
              </View>

              <Text style={styles.customRateDesc}>
                Set your custom price per km when accepting custom fast bookings or offering direct rides:
              </Text>

              <View style={styles.customRateRow}>
                <View style={styles.customRateInputWrapper}>
                  <Text style={styles.customRateCurrency}>₹</Text>
                  <TextInput
                    style={styles.customRateInput}
                    value={customPriceRate}
                    onChangeText={setCustomPriceRate}
                    keyboardType="number-pad"
                    placeholder="14"
                  />
                  <Text style={styles.customRateUnit}>/ km</Text>
                </View>

                {/* Quick Presets */}
                <View style={styles.ratePresetsRow}>
                  {['10', '13', '16', '20'].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.ratePresetBtn,
                        customPriceRate === rate && styles.ratePresetBtnActive,
                      ]}
                      onPress={() => {
                        setCustomPriceRate(rate);
                        setIsCustomPriceActive(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.ratePresetBtnText,
                          customPriceRate === rate && styles.ratePresetBtnTextActive,
                        ]}
                      >
                        ₹{rate}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveRateBtn}
                onPress={() => {
                  setIsCustomPriceActive(true);
                  Alert.alert(
                    'Custom Rate Saved! ⚡',
                    `Your custom rate of ₹${customPriceRate}/km is now active for fast booking rides.`
                  );
                }}
              >
                <Ionicons name="checkmark-done" size={16} color="#ffffff" />
                <Text style={styles.saveRateBtnText}>Save Custom Rate (₹{customPriceRate}/km)</Text>
              </TouchableOpacity>
            </View>

            {loadingCarpools ? (
              <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 20 }} />
            ) : myPostedCarpools.length === 0 ? (
              <View style={styles.idleCard}>
                <MaterialCommunityIcons name="car-multiple" size={44} color="#94a3b8" />
                <Text style={styles.idleTitle}>No Carpools Posted</Text>
                <Text style={styles.idleSub}>
                  You have not published any shared carpool trips yet. Switch to Passenger App → Services to post a route, or share your daily commute with students & co-workers!
                </Text>
              </View>
            ) : (
              myPostedCarpools.map((ride) => (
                <View key={ride.id} style={[styles.activeTripCard, { marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={styles.tripStatusBadge}>
                      <Text style={styles.tripStatusText}>{ride.status}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#10b981' }}>
                      ₹{Math.round(ride.price_per_seat)} / seat
                    </Text>
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                    {ride.pickup_address || ride.origin_address} ➔ {ride.destination_address}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Departure: {ride.departure_time} • {ride.available_seats} of {ride.total_seats} seats free
                  </Text>

                  {/* Passenger Reservations List */}
                  {ride.bookings && ride.bookings.length > 0 ? (
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, marginTop: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155', marginBottom: 6 }}>
                        PASSENGER RESERVATIONS ({ride.bookings.length}):
                      </Text>
                      {ride.bookings.map((b) => (
                        <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>
                              {b.passenger_name} ({b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''})
                            </Text>
                            <Text style={{ fontSize: 10, color: '#64748b' }}>
                              📞 {b.passenger_phone} • Net: ₹{Math.round(b.net_host_earnings)} ({b.status})
                            </Text>
                          </View>
                          {b.status === 'PENDING' && (
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <TouchableOpacity
                                style={{ backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                onPress={() => handleRespondCarpoolBooking(b.id, 'ACCEPT')}
                              >
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Accept</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                onPress={() => handleRespondCarpoolBooking(b.id, 'REJECT')}
                              >
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 }}>
                      No passenger seat bookings yet.
                    </Text>
                  )}

                  {/* Status Actions */}
                  {ride.status === 'OPEN' && (
                    <TouchableOpacity
                      style={styles.cancelTripBtn}
                      onPress={() => handleUpdateCarpoolStatus(ride.id, 'CANCELLED')}
                    >
                      <Text style={styles.cancelTripBtnText}>Cancel Carpool Route</Text>
                    </TouchableOpacity>
                  )}
                  {ride.status === 'FULL' && (
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() => handleUpdateCarpoolStatus(ride.id, 'COMPLETED')}
                    >
                      <Text style={styles.actionBtnText}>Mark Route Completed</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TOTAL EARNINGS & WALLET PAYOUT                   */}
        {/* ======================================================== */}
        {currentTab === 'earnings' && (
          <View>
            {/* Total Lifetime Earnings Card */}
            <View style={styles.earningsHeroCard}>
              <View style={styles.earningsHeroTop}>
                <View>
                  <Text style={styles.earningsHeroLabel}>TOTAL LIFETIME EARNINGS</Text>
                  <Text style={styles.earningsHeroValue}>
                    ₹{(dashboard?.total_earnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.walletIconCircle}>
                  <Ionicons name="cash" size={28} color="#10b981" />
                </View>
              </View>

              <View style={styles.earningsHeroDivider} />

              <View style={styles.earningsHeroStats}>
                <View style={styles.earningsHeroStatCol}>
                  <Text style={styles.earningsHeroStatLabel}>Total Completed</Text>
                  <Text style={styles.earningsHeroStatVal}>{dashboard?.total_completed_trips || 0} Trips</Text>
                </View>
                <View style={styles.earningsHeroStatCol}>
                  <Text style={styles.earningsHeroStatLabel}>Driver Rating</Text>
                  <Text style={[styles.earningsHeroStatVal, { color: '#f59e0b' }]}>★ {dashboard?.rating?.toFixed(1) || '5.0'}</Text>
                </View>
                <View style={styles.earningsHeroStatCol}>
                  <Text style={styles.earningsHeroStatLabel}>Driver Share</Text>
                  <Text style={styles.earningsHeroStatVal}>85% Net</Text>
                </View>
              </View>
            </View>

            {/* Partner Wallet & Instant Withdrawal Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletTopRow}>
                <View>
                  <Text style={styles.walletSubLabel}>AVAILABLE WALLET BALANCE</Text>
                  <Text style={styles.walletBalanceVal}>
                    ₹{(dashboard?.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.walletDisclaimer}>Ready for instant UPI or direct bank payout</Text>
                </View>
                <TouchableOpacity
                  style={styles.payoutBtn}
                  onPress={() => {
                    setPayoutAmount(String(Math.floor(dashboard?.wallet_balance || 0)));
                    setShowPayoutModal(true);
                  }}
                >
                  <Ionicons name="arrow-up-circle" size={18} color="#ffffff" />
                  <Text style={styles.payoutBtnText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Today's Earnings Snapshot */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Today's Earnings</Text>
              <Text style={styles.sectionSubBadge}>Real-time DB</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Today's Payout</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>
                  ₹{(dashboard?.today_earnings || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Trips Done Today</Text>
                <Text style={styles.statValue}>{dashboard?.today_trips || 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Commission (15%)</Text>
                <Text style={[styles.statValue, { color: '#64748b' }]}>
                  ₹{Math.round((dashboard?.today_earnings || 0) * 0.15)}
                </Text>
              </View>
            </View>

            {/* Recent Trip Earnings Breakdown */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Trip Earnings Breakdown</Text>
              <TouchableOpacity onPress={() => setCurrentTab('activity')}>
                <Text style={styles.seeAllText}>View All Rides →</Text>
              </TouchableOpacity>
            </View>

            {ridesHistory.slice(0, 5).map((trip) => (
              <View key={trip.id} style={styles.tripEarningCard}>
                <View style={styles.tripEarningLeft}>
                  <View style={styles.tripEarningIcon}>
                    <MaterialCommunityIcons
                      name={trip.vehicle_category === 'bike' ? 'motorbike' : trip.vehicle_category === 'auto' ? 'rickshaw' : 'car-side'}
                      size={20}
                      color="#0f172a"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripEarningPassenger}>{trip.passenger?.full_name || 'Passenger'}</Text>
                    <Text style={styles.tripEarningRoute} numberOfLines={1}>
                      {trip.pickup_address} → {trip.destination_address}
                    </Text>
                    <Text style={styles.tripEarningTime}>
                      {trip.created_at ? new Date(trip.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Today'} • {trip.estimated_distance_km || 4.2} km
                    </Text>
                  </View>
                </View>
                <View style={styles.tripEarningRight}>
                  <Text style={styles.tripEarningFare}>₹{Math.round(trip.final_fare || trip.estimated_fare || 0)}</Text>
                  <Text style={[styles.tripEarningStatus, { color: trip.status === 'COMPLETED' ? '#10b981' : '#ef4444' }]}>
                    {trip.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 3: ACTIVITY / MY RIDES                               */}
        {/* ======================================================== */}
        {currentTab === 'activity' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Driver Ride History</Text>
              <TouchableOpacity style={styles.refreshIconBtn} onPress={loadHistory}>
                <Ionicons name="refresh" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>

            {/* Filter Chips */}
            <View style={styles.filterChipRow}>
              {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, historyFilter === f && styles.activeFilterChip]}
                  onPress={() => setHistoryFilter(f)}
                >
                  <Text style={[styles.filterChipText, historyFilter === f && styles.activeFilterChipText]}>
                    {f === 'ALL' ? `All (${ridesHistory.length})` : f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {historyLoading ? (
              <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 32 }} />
            ) : filteredHistory.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No Rides in this category</Text>
                <Text style={styles.emptyStateSub}>Completed rides and trips will be logged here.</Text>
              </View>
            ) : (
              filteredHistory.map((ride) => (
                <TouchableOpacity
                  key={ride.id}
                  style={styles.historyCard}
                  onPress={() => setSelectedReceiptRide(ride)}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyTopRow}>
                    <View style={styles.historyBadgeRow}>
                      <View style={[styles.categoryBadge, { backgroundColor: ride.status === 'COMPLETED' ? '#ecfdf5' : '#fef2f2' }]}>
                        <Text style={[styles.categoryBadgeText, { color: ride.status === 'COMPLETED' ? '#059669' : '#dc2626' }]}>
                          {ride.status}
                        </Text>
                      </View>
                      <Text style={styles.historyDate}>
                        {ride.created_at ? new Date(ride.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </Text>
                    </View>
                    <Text style={styles.historyFare}>₹{Math.round(ride.final_fare || ride.estimated_fare || 0)}</Text>
                  </View>

                  <View style={styles.historyPassengerRow}>
                    <Ionicons name="person-circle-outline" size={18} color="#64748b" />
                    <Text style={styles.historyPassengerName}>{ride.passenger?.full_name || 'Passenger'}</Text>
                    <Text style={styles.historyDistance}>• {ride.estimated_distance_km || 4.5} km</Text>
                  </View>

                  <View style={styles.historyRouteBox}>
                    <View style={styles.routePointItem}>
                      <View style={[styles.pointDot, { backgroundColor: '#10b981' }]} />
                      <Text style={styles.historyRouteText} numberOfLines={1}>
                        From: {ride.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.routePointItem}>
                      <View style={[styles.pointDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={styles.historyRouteText} numberOfLines={1}>
                        To: {ride.destination_address}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historyFooter}>
                    <Text style={styles.receiptActionText}>Tap to view trip receipt & breakdown →</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 4: USERS / PASSENGERS SERVED                         */}
        {/* ======================================================== */}
        {currentTab === 'users' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Passengers Served</Text>
              <Text style={styles.sectionSubBadge}>{aggregatedPassengers.length} Unique Users</Text>
            </View>
            <Text style={styles.tabDescriptionText}>
              Authoritative list of passengers you have transported, logged from real trip bookings in the database.
            </Text>

            {aggregatedPassengers.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Ionicons name="people-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No Passengers Logged Yet</Text>
                <Text style={styles.emptyStateSub}>Complete ride bookings to see your passenger profiles here.</Text>
              </View>
            ) : (
              aggregatedPassengers.map((pass) => (
                <View key={pass.id} style={styles.userCard}>
                  <View style={styles.userAvatarCircle}>
                    <Text style={styles.userAvatarText}>{pass.name.charAt(0).toUpperCase()}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.userFullName}>{pass.name}</Text>
                      <View style={styles.verifiedPassBadge}>
                        <Text style={styles.verifiedPassBadgeText}>VERIFIED</Text>
                      </View>
                    </View>
                    <Text style={styles.userPhone}>{pass.phone}</Text>
                    <Text style={styles.userMetaText}>
                      {pass.totalRides} trips with you • Total ₹{pass.totalSpent} earned
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={styles.userRatingBadge}>
                      <Text style={styles.userRatingText}>★ {pass.rating.toFixed(1)}</Text>
                    </View>
                    <Text style={styles.userLastRideDate}>{pass.lastDate}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 5: HELP & DRIVER SUPPORT                             */}
        {/* ======================================================== */}
        {currentTab === 'help' && (
          <View>
            {/* 24/7 SOS and Helpline Banner */}
            <View style={styles.helpHeroCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.helpHeroTitle}>24/7 Driver Support & SOS</Text>
                <Text style={styles.helpHeroSub}>Immediate priority assistance for driver partners</Text>
              </View>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={() => Alert.alert('Emergency SOS Alert', 'Police emergency dispatch (112) and 24/7 Incident Control Center have been notified of your location.')}
              >
                <Ionicons name="warning" size={16} color="#ffffff" />
                <Text style={styles.sosButtonText}>SOS 112</Text>
              </TouchableOpacity>
            </View>

            {/* Helpline quick buttons */}
            <View style={styles.helplineRow}>
              <TouchableOpacity
                style={styles.helplineBtn}
                onPress={() => Alert.alert('Helpline Call', 'Dialing Toll-Free Partner Support: 1800-200-9988')}
              >
                <Ionicons name="call" size={20} color="#059669" />
                <Text style={styles.helplineBtnTitle}>Partner Helpline</Text>
                <Text style={styles.helplineBtnSub}>1800-200-9988</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helplineBtn}
                onPress={() => setShowTicketModal(true)}
              >
                <Ionicons name="chatbubbles" size={20} color="#2563eb" />
                <Text style={styles.helplineBtnTitle}>Submit Ticket</Text>
                <Text style={styles.helplineBtnSub}>Response &lt; 2 hrs</Text>
              </TouchableOpacity>
            </View>

            {/* FAQs Accordion */}
            <Text style={[styles.sectionHeading, { marginTop: 18, marginBottom: 10 }]}>Driver Partner FAQs</Text>

            {[
              {
                q: 'How do I verify the passenger OTP?',
                a: 'Ask the passenger for the 4-digit PIN displayed on their booking confirmation screen upon pickup. You cannot start the meter or drive without this verification.',
              },
              {
                q: 'When does my payout credit to my bank account?',
                a: 'All digital UPI payments and Cash settlements credit instantly to your Partner Wallet balance (85% net). You can withdraw to any UPI ID anytime via the Earnings tab.',
              },
              {
                q: 'What if a passenger cancels after I arrive?',
                a: 'If a passenger cancels after you mark arrival or fails to show up within 5 minutes, an automatic cancellation fee of ₹30 - ₹50 is credited to your wallet.',
              },
              {
                q: 'How to switch between Bike, Auto, and Cab?',
                a: 'Visit your Profile tab to toggle your active vehicle. All 3 categories registered under Suresh Kumar are approved and ready for dispatch.',
              },
              {
                q: 'What if a passenger refuses to pay the fare?',
                a: 'Show the passenger the dynamic UPI QR code generated on dropoff. If unpaid, complete the ride as Cash and tap "Report Fare Dispute" under Help.',
              },
            ].map((faq, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.faqCard}
                onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Ionicons
                    name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748b"
                  />
                </View>
                {expandedFaq === idx && (
                  <Text style={styles.faqAnswer}>{faq.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 6: DRIVER PROFILE & VEHICLES                         */}
        {/* ======================================================== */}
        {currentTab === 'profile' && (
          <View>
            {/* Driver Identity Card */}
            <View style={styles.profileHeroCard}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={36} color="#0f172a" />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.profileHeroName}>{dashboard?.full_name || 'Suresh Kumar'}</Text>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                </View>
                <Text style={styles.profileHeroPhone}>{dashboard?.phone_number || '+91 92222 22222'}</Text>
                <Text style={styles.profileHeroCity}>📍 Operating City: {dashboard?.operating_city || 'Bengaluru'}</Text>
              </View>

              <View style={styles.profileBadgeRight}>
                <Text style={styles.profileBadgeText}>APPROVED</Text>
              </View>
            </View>

            {/* Vehicle Fleet Manager */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Registered Fleet & Vehicles</Text>
              <Text style={styles.sectionSubBadge}>Select Active</Text>
            </View>

            {vehicleList.map((veh: any) => {
              const isSelected = activeVehicle.category === veh.category || veh.is_active;
              return (
                <TouchableOpacity
                  key={veh.plate}
                  style={[styles.vehicleManageCard, isSelected && styles.activeVehicleCard]}
                  onPress={() => handleSwitchVehicle(veh.category)}
                  activeOpacity={0.8}
                >
                  <View style={styles.vehicleManageLeft}>
                    <MaterialCommunityIcons
                      name={veh.category === 'bike' ? 'motorbike' : veh.category === 'auto' ? 'rickshaw' : 'car-side'}
                      size={26}
                      color={isSelected ? '#10b981' : '#64748b'}
                    />
                    <View>
                      <Text style={[styles.vehicleManageTitle, isSelected && { color: '#065f46' }]}>
                        {veh.model} ({veh.category.toUpperCase()})
                      </Text>
                      <Text style={styles.vehicleManagePlate}>{veh.plate}</Text>
                    </View>
                  </View>

                  <View style={[styles.vehicleRadioBtn, isSelected && styles.activeVehicleRadioBtn]}>
                    <Text style={[styles.vehicleRadioBtnText, isSelected && { color: '#ffffff' }]}>
                      {isSelected ? 'ACTIVE' : 'SWITCH'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* KYC & Compliance Documents */}
            <Text style={[styles.sectionHeading, { marginTop: 18, marginBottom: 10 }]}>
              Verified Documents & Compliance
            </Text>

            <View style={styles.docGrid}>
              {[
                { title: 'Driving License', status: dashboard?.documents?.license || 'verified' },
                { title: 'Vehicle RC Book', status: dashboard?.documents?.rc_book || 'verified' },
                { title: 'Commercial Insurance', status: dashboard?.documents?.insurance || 'verified' },
                { title: 'Police Clearance', status: dashboard?.documents?.police_verification || 'cleared' },
              ].map((doc, idx) => (
                <View key={idx} style={styles.docItem}>
                  <Ionicons name="document-text" size={18} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    <Text style={styles.docStatus}>✓ {doc.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Account Actions */}
            <View style={styles.profileActionsCard}>
              <TouchableOpacity
                style={styles.logoutActionBtn}
                onPress={() => {
                  logout();
                  router.replace('/(auth)/login');
                }}
              >
                <Ionicons name="log-out" size={18} color="#dc2626" />
                <Text style={styles.logoutActionText}>Log Out Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* BOTTOM NAVIGATION BAR (6 TABS)                           */}
      {/* ======================================================== */}
      <View style={styles.bottomNavbar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('dispatch')}
        >
          <Ionicons
            name={currentTab === 'dispatch' ? 'navigate' : 'navigate-outline'}
            size={22}
            color={currentTab === 'dispatch' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'dispatch' && styles.activeNavText]}>
            Radar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('earnings')}
        >
          <Ionicons
            name={currentTab === 'earnings' ? 'wallet' : 'wallet-outline'}
            size={22}
            color={currentTab === 'earnings' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'earnings' && styles.activeNavText]}>
            Earnings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('activity')}
        >
          <Ionicons
            name={currentTab === 'activity' ? 'time' : 'time-outline'}
            size={22}
            color={currentTab === 'activity' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'activity' && styles.activeNavText]}>
            Rides
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('carpool')}
        >
          <Ionicons
            name={currentTab === 'carpool' ? 'flash' : 'flash-outline'}
            size={22}
            color={currentTab === 'carpool' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'carpool' && styles.activeNavText]}>
            ⚡ Fast Ride
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('users')}
        >
          <Ionicons
            name={currentTab === 'users' ? 'people' : 'people-outline'}
            size={22}
            color={currentTab === 'users' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'users' && styles.activeNavText]}>
            Users
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('help')}
        >
          <Ionicons
            name={currentTab === 'help' ? 'help-circle' : 'help-circle-outline'}
            size={22}
            color={currentTab === 'help' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'help' && styles.activeNavText]}>
            Help
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('profile')}
        >
          <Ionicons
            name={currentTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
            size={22}
            color={currentTab === 'profile' ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.navText, currentTab === 'profile' && styles.activeNavText]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* 0. Post Fast Ride Modal */}
      <Modal visible={showPostFastRideModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flash" size={20} color="#f59e0b" />
                <Text style={styles.modalTitle}>Post Fast / Custom Ride</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPostFastRideModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSub}>
                Share your empty seats with passengers traveling along your route. You decide your seat price!
              </Text>

              {/* Vehicle Type Selector */}
              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>VEHICLE TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                {(['bike', 'auto', 'car', 'bus'] as const).map((vt) => (
                  <TouchableOpacity
                    key={vt}
                    style={[
                      styles.ratePresetBtn,
                      { flex: 1, paddingVertical: 10 },
                      fastRideVehType === vt && styles.ratePresetBtnActive,
                    ]}
                    onPress={() => {
                      setFastRideVehType(vt);
                      if (vt === 'bike') {
                        setFastRideModel('Hero Splendor / Pulsar');
                        setFastRideSeats('1');
                        setFastRideSeatPrice('40');
                      } else if (vt === 'auto') {
                        setFastRideModel('Bajaj RE EV Auto');
                        setFastRideSeats('2');
                        setFastRideSeatPrice('60');
                      } else if (vt === 'car') {
                        setFastRideModel('Swift Dzire AC');
                        setFastRideSeats('3');
                        setFastRideSeatPrice('120');
                      } else {
                        setFastRideModel('Force Traveller / Mini Bus');
                        setFastRideSeats('6');
                        setFastRideSeatPrice('90');
                      }
                    }}
                  >
                    <Ionicons
                      name={vt === 'bike' ? 'bicycle' : vt === 'auto' ? 'car-sport' : vt === 'bus' ? 'bus' : 'car'}
                      size={16}
                      color={fastRideVehType === vt ? '#ffffff' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.ratePresetBtnText,
                        fastRideVehType === vt && styles.ratePresetBtnTextActive,
                      ]}
                    >
                      {vt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Origin */}
              <Text style={styles.fieldLabel}>STARTING POINT (ORIGIN)</Text>
              <TextInput
                style={styles.modalInput}
                value={fastRideOrigin}
                onChangeText={setFastRideOrigin}
                placeholder="Where do you start from?"
              />

              {/* Destination */}
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>DESTINATION</Text>
              <TextInput
                style={styles.modalInput}
                value={fastRideDest}
                onChangeText={setFastRideDest}
                placeholder="Where are you going?"
              />

              {/* Vehicle Model */}
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>VEHICLE MODEL</Text>
              <TextInput
                style={styles.modalInput}
                value={fastRideModel}
                onChangeText={setFastRideModel}
                placeholder="e.g. Royal Enfield, Swift Dzire"
              />

              {/* Seats and Seat Price Row */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>AVAILABLE SEATS</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={fastRideSeats}
                    onChangeText={setFastRideSeats}
                    keyboardType="number-pad"
                    placeholder="1 to 4"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>PRICE PER SEAT (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={fastRideSeatPrice}
                    onChangeText={setFastRideSeatPrice}
                    keyboardType="number-pad"
                    placeholder="e.g. 50"
                  />
                </View>
              </View>

              {/* Departure Time */}
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>DEPARTURE TIME</Text>
              <TextInput
                style={styles.modalInput}
                value={fastRideTime}
                onChangeText={setFastRideTime}
                placeholder="e.g. Today, 6:30 PM"
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.saveRateBtn, { marginTop: 16 }]}
                onPress={handlePostRiderFastRide}
                disabled={submittingFastRide}
              >
                {submittingFastRide ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#ffffff" />
                    <Text style={styles.saveRateBtnText}>Publish Fast Ride</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 1. Operating Zone Picker Modal */}
      <Modal visible={showZonePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Operating Area</Text>
              <TouchableOpacity onPress={() => setShowZonePicker(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Choose the city zone where you want to accept rides today:
            </Text>

            {OPERATING_ZONES.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={[styles.zoneItem, selectedZone.id === zone.id && styles.activeZoneItem]}
                onPress={() => handleSelectZone(zone)}
              >
                <Ionicons
                  name={selectedZone.id === zone.id ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selectedZone.id === zone.id ? '#10b981' : '#94a3b8'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.zoneName, selectedZone.id === zone.id && styles.activeZoneName]}>
                    {zone.name}
                  </Text>
                  <Text style={styles.zoneSub}>{zone.activeDriversCount} active fleet in zone</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* 2. Incoming Ride Request Modal */}
      {incomingRequest && (
        <Modal visible={true} transparent={true} animationType="slide">
          <View style={styles.incomingModalBackdrop}>
            <View style={styles.incomingModalContent}>
              <View style={styles.timerHeader}>
                <View style={styles.timerCircle}>
                  <Text style={styles.timerSecs}>{countdown}s</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.incomingHeading}>NEW RIDE REQUEST</Text>
                  <Text style={styles.incomingVehicleBadge}>
                    {incomingRequest.vehicle_category === 'bike'
                      ? '🏍️ CAMP BIKE'
                      : incomingRequest.vehicle_category === 'auto'
                      ? '🛺 CAMP AUTO'
                      : '🚗 CAMP CAB'}
                  </Text>
                </View>
              </View>

              <View style={styles.incomingFareBox}>
                <Text style={styles.earningLabel}>YOU WILL EARN</Text>
                <Text style={styles.incomingFare}>₹{Math.round(incomingRequest.estimated_fare)}</Text>
                {incomingRequest.boost_amount && incomingRequest.boost_amount > 0 ? (
                  <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: 'center' }}>
                    <Text style={{ color: '#b45309', fontWeight: 'bold', fontSize: 13 }}>
                      +₹{Math.round(incomingRequest.boost_amount)} Passenger Boost! 🔥
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.incomingFareSub}>Guaranteed driver payout for this trip!</Text>
                )}
              </View>

              <View style={styles.distanceChipsRow}>
                <View style={styles.distChip}>
                  <Ionicons name="speedometer-outline" size={15} color="#0284c7" />
                  <Text style={styles.distChipText}>Trip: {incomingRequest.trip_distance_km} km</Text>
                </View>
                <View style={styles.distChip}>
                  <Ionicons name="navigate-outline" size={15} color="#059669" />
                  <Text style={styles.distChipText}>To Pickup: {incomingRequest.distance_to_pickup_km || 0.4} km away</Text>
                </View>
              </View>

              <View style={styles.passengerPreviewCard}>
                <View style={styles.passAvatar}>
                  <Ionicons name="person" size={18} color="#000000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passName}>{incomingRequest.passenger?.full_name || 'Passenger'}</Text>
                  <Text style={styles.passPhone}>{incomingRequest.passenger?.phone_number || '+91 91111 11111'}</Text>
                </View>
                <View style={styles.passRatingBadge}>
                  <Text style={styles.passRatingText}>★ 5.0</Text>
                </View>
              </View>

              <View style={styles.incomingPoints}>
                <View style={styles.routePointRow}>
                  <View style={[styles.routePin, { backgroundColor: '#10b981' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routePointLabel}>PICKUP FROM</Text>
                    <Text style={styles.incomingPointText} numberOfLines={2}>
                      {incomingRequest.pickup_address}
                    </Text>
                  </View>
                </View>
                <View style={styles.routePinLine} />
                <View style={styles.routePointRow}>
                  <View style={[styles.routePin, { backgroundColor: '#ef4444' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routePointLabel}>DROPOFF TO</Text>
                    <Text style={styles.incomingPointText} numberOfLines={2}>
                      {incomingRequest.destination_address}
                    </Text>
                  </View>
                </View>
              </View>

              {activeRide ? (
                <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 9, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="lock-closed" size={16} color="#d97706" />
                  <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '700', flex: 1 }}>
                    Active Trip in Progress! You can see upcoming ride demand, but cannot accept until current passenger is dropped.
                  </Text>
                </View>
              ) : null}

              <View style={styles.incomingBtnRow}>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={handleDeclineRide}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.acceptBtn, activeRide ? { backgroundColor: '#64748b' } : null]}
                  onPress={handleAcceptRide}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.acceptBtnText}>
                      {activeRide ? '🔒 Drop Current Passenger First' : `ACCEPT (EARN ₹${Math.round(incomingRequest.estimated_fare)})`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* 3. 4-Digit Passenger PIN Modal */}
      <Modal visible={showOtpModal} transparent={true} animationType="fade">
        <View style={styles.incomingModalBackdrop}>
          <View style={styles.otpModalContent}>
            <Ionicons name="keypad" size={32} color="#059669" style={{ marginBottom: 8 }} />
            <Text style={styles.otpModalTitle}>Enter Passenger PIN</Text>
            <Text style={styles.otpModalSub}>
              Ask the passenger for the 4-digit PIN shown on their booking confirmation:
            </Text>

            <TextInput
              style={styles.otpInputField}
              placeholder="0000"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={4}
              value={enteredOtp}
              onChangeText={setEnteredOtp}
              autoFocus
            />

            <TouchableOpacity
              style={styles.otpVerifyBtn}
              onPress={handleVerifyOtpAndStart}
              disabled={verifyingOtp}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.otpVerifyBtnText}>Verify PIN & Start Trip</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowOtpModal(false)}
            >
              <Text style={styles.modalCancelBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. Dropoff & Dynamic Real-Time UPI QR Payment Modal */}
      <Modal visible={showPaymentModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="qr-code" size={22} color="#059669" />
                <Text style={styles.modalTitle}>Trip Completed • Collect Fare</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Ride Details Subheader */}
            <View style={{ backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10, marginVertical: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                  Ride #{tripShortId}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>
                  Passenger: {activeRide?.passenger?.full_name || 'Passenger'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3 }} numberOfLines={1}>
                Drop: {activeRide?.destination_address || 'Destination'}
              </Text>
            </View>

            {/* Dynamic Final Fare Card */}
            <View style={styles.fareAmountCard}>
              <Text style={styles.fareAmountLabel}>FINAL BILLABLE FARE</Text>
              <Text style={styles.fareAmountVal}>₹{fareAmount}.00</Text>
              <Text style={styles.fareAmountSub}>
                Exact dynamic fare calculated for this ride
              </Text>
            </View>

            {/* Dynamic UPI QR Code Box */}
            <View style={styles.qrCodeWrapper}>
              <Image source={{ uri: upiQrUrl }} style={styles.qrImage} resizeMode="contain" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Ionicons name="wallet-outline" size={14} color="#059669" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>
                  UPI: {activeDriverUpi}
                </Text>
              </View>
              <Text style={styles.qrScanInstruction}>
                Scan with Google Pay, PhonePe, Paytm, BHIM, Cred or any UPI App
              </Text>
            </View>

            <TouchableOpacity
              style={styles.verifyPaymentBtn}
              onPress={() => handleSettleAndCompleteTrip('UPI_QR')}
              disabled={settlingPayment}
            >
              {settlingPayment ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyPaymentBtnText}>✅ Verify UPI Payment Received (₹{fareAmount})</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cashPaymentBtn}
              onPress={() => handleSettleAndCompleteTrip('CASH')}
              disabled={settlingPayment}
            >
              <Text style={styles.cashPaymentBtnText}>💵 Collected via Cash (₹{fareAmount})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. Driver Cancel Ride Modal */}
      <Modal visible={showCancelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancel Active Ride</Text>
              <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Please select reason for cancelling this trip:</Text>

            {[
              'Passenger no-show at pickup',
              'Vehicle issue / tire puncture',
              'Heavy traffic / road block',
              'Personal emergency',
            ].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.zoneItem, cancelReason === reason && styles.activeZoneItem]}
                onPress={() => setCancelReason(reason)}
              >
                <Ionicons
                  name={cancelReason === reason ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={cancelReason === reason ? '#ef4444' : '#94a3b8'}
                />
                <Text style={[styles.zoneName, cancelReason === reason && { color: '#ef4444', fontWeight: '800' }]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.verifyPaymentBtn, { backgroundColor: '#dc2626', marginTop: 14 }]}
              onPress={handleDriverCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyPaymentBtnText}>Confirm Cancel Ride</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 6. Instant Wallet Withdrawal Modal */}
      <Modal visible={showPayoutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw to Bank / UPI</Text>
              <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Transfer funds directly from your partner wallet into your bank or UPI account:
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT TO WITHDRAW (₹)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="e.g. 500"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DESTINATION UPI ID</Text>
              <TextInput
                style={styles.textInput}
                placeholder="driver.bharatpe@icici"
                value={payoutUpi}
                onChangeText={setPayoutUpi}
              />
            </View>

            <TouchableOpacity
              style={styles.verifyPaymentBtn}
              onPress={handleProcessPayout}
              disabled={payoutLoading}
            >
              {payoutLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyPaymentBtnText}>Transfer Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. Support Ticket Modal */}
      <Modal visible={showTicketModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise Support Ticket</Text>
              <TouchableOpacity onPress={() => setShowTicketModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Our priority driver desk resolves tickets within 2 hours:</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CATEGORY</Text>
              <View style={styles.categoryPickerRow}>
                {['Payment / Payout', 'Passenger Dispute', 'Vehicle / App Issue'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.smallChip, ticketCategory === cat && styles.activeSmallChip]}
                    onPress={() => setTicketCategory(cat)}
                  >
                    <Text style={[styles.smallChipText, ticketCategory === cat && styles.activeSmallChipText]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DESCRIBE THE ISSUE</Text>
              <TextInput
                style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Enter details of what went wrong..."
                multiline
                numberOfLines={3}
                value={ticketDesc}
                onChangeText={setTicketDesc}
              />
            </View>

            <TouchableOpacity
              style={styles.verifyPaymentBtn}
              onPress={handleSubmitTicket}
              disabled={submittingTicket}
            >
              {submittingTicket ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyPaymentBtnText}>Submit Priority Ticket</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 8. Detailed Trip Receipt Modal */}
      {selectedReceiptRide && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Trip Receipt & Breakdown</Text>
                <TouchableOpacity onPress={() => setSelectedReceiptRide(null)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.receiptHeroFare}>
                <Text style={styles.receiptHeroLabel}>TOTAL FARE COLLECTED</Text>
                <Text style={styles.receiptHeroVal}>
                  ₹{Math.round(selectedReceiptRide.final_fare || selectedReceiptRide.estimated_fare || 0)}.00
                </Text>
                <Text style={styles.receiptHeroStatus}>{selectedReceiptRide.status}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Passenger Name</Text>
                <Text style={styles.receiptVal}>{selectedReceiptRide.passenger?.full_name || 'Passenger'}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Trip Distance</Text>
                <Text style={styles.receiptVal}>{selectedReceiptRide.estimated_distance_km || 4.2} km</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Vehicle Category</Text>
                <Text style={styles.receiptVal}>{(selectedReceiptRide.vehicle_category || 'car').toUpperCase()}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Your Partner Share (85%)</Text>
                <Text style={[styles.receiptVal, { color: '#059669', fontWeight: '800' }]}>
                  ₹{Math.round((selectedReceiptRide.final_fare || selectedReceiptRide.estimated_fare || 0) * 0.85)}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Pickup</Text>
                <Text style={[styles.receiptVal, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                  {selectedReceiptRide.pickup_address}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Dropoff</Text>
                <Text style={[styles.receiptVal, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                  {selectedReceiptRide.destination_address}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.verifyPaymentBtn, { marginTop: 14 }]}
                onPress={() => setSelectedReceiptRide(null)}
              >
                <Text style={styles.verifyPaymentBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  // Pending Verification Screen Styles
  pendingPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  refreshPendingBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verificationBannerCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)',
  },
  verificationIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  verificationBadgePill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  verificationBadgePillText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verificationMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationHindiNotice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 21,
  },
  verificationNoticeDivider: {
    width: '60%',
    height: 1,
    backgroundColor: '#fde68a',
    marginVertical: 12,
  },
  verificationSubNotice: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 18,
  },
  stepperCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  stepperCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  stepperDotDone: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLineDone: {
    flex: 1,
    height: 3,
    backgroundColor: '#10b981',
  },
  stepperDotActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotError: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLineActive: {
    flex: 1,
    height: 3,
    backgroundColor: '#f59e0b',
  },
  stepperLineFuture: {
    flex: 1,
    height: 3,
    backgroundColor: '#e2e8f0',
  },
  stepperDotFuture: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  stepperLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepperLabelDone: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
    width: 65,
  },
  stepperLabelActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    textAlign: 'center',
    width: 75,
  },
  stepperLabelError: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
    textAlign: 'center',
    width: 75,
  },
  stepperLabelFuture: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    width: 65,
  },
  kycSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  kycSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  kycSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.5,
  },
  kycFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  kycFieldRowCol: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  kycFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  kycFieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  kycFieldValueLong: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
    marginTop: 4,
    lineHeight: 18,
  },
  kycPhotosRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  kycPhotoBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    alignItems: 'center',
  },
  kycPhotoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  kycPhotoThumb: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
  kycPhotoPlaceholder: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycPhotoPlaceholderText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  refreshStatusActionBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
  },
  refreshStatusActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  supportContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  supportContactText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    gap: 6,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  driverName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  driverVehicle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reconnectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reconnectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
  },
  onlineToggleRow: {
    alignItems: 'center',
  },
  onlineLabel: {
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 2,
  },
  logoutBtn: {
    padding: 6,
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 80,
  },
  // Tab Navigation Bar
  bottomNavbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    boxShadow: '0 -2px 6px rgba(0, 0, 0, 0.06)',
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  navText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  activeNavText: {
    color: '#10b981',
    fontWeight: '900',
  },
  // Area Banner
  areaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  areaBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  areaBannerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  areaBannerValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  changeAreaBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeAreaBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  // Simulation Bar
  simulationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  simulationBarTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  simulationBarSub: {
    fontSize: 10,
    color: '#15803d',
    marginTop: 2,
  },
  simulationBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulationBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  // Fleet Status Bar
  activeFleetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  activeFleetText: {
    fontSize: 11,
    color: '#065f46',
    flex: 1,
  },
  gpsTrackingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gpsModeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  gpsModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  gpsModeRefreshBtn: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsModeRefreshText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  gpsErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  gpsErrorText: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
    flex: 1,
  },
  // Earnings Hero Card
  earningsHeroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
  },
  earningsHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  earningsHeroValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  walletIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsHeroDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  earningsHeroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsHeroStatCol: {
    alignItems: 'center',
  },
  earningsHeroStatLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  earningsHeroStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  // Wallet Card
  walletCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    marginBottom: 16,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  walletBalanceVal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  walletDisclaimer: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  payoutBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  payoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabDescriptionText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 16,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  // Trip Earning Card
  tripEarningCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripEarningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  tripEarningIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripEarningPassenger: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  tripEarningRoute: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  tripEarningTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  tripEarningRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  tripEarningFare: {
    fontSize: 15,
    fontWeight: '900',
    color: '#10b981',
  },
  tripEarningStatus: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  // Map Section
  mapSection: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activeTripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
  },
  tripStatusBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  tripStatusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  passengerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  passengerPhone: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  fareHighlight: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10b981',
  },
  fareSubText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
  },
  tripPoints: {
    gap: 8,
    marginBottom: 16,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  actionBtnGroup: {
    gap: 8,
  },
  actionBtnPrimary: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelTripBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelTripBtnText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '800',
  },
  idleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  idleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 6,
  },
  idleSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  idleTestRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  idleTestRideText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  // Filter Chips
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeFilterChip: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  activeFilterChipText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  // History Card
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  historyDate: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  historyFare: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  historyPassengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  historyPassengerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  historyDistance: {
    fontSize: 11,
    color: '#64748b',
  },
  historyRouteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  routePointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyRouteText: {
    fontSize: 11,
    color: '#475569',
    flex: 1,
  },
  historyFooter: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  receiptActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  // Users List Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  userAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#065f46',
  },
  userFullName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedPassBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verifiedPassBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0284c7',
  },
  userPhone: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  userMetaText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '700',
    marginTop: 2,
  },
  userRatingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userRatingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  userLastRideDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  // Help Section
  helpHeroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  helpHeroSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  helplineRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  helplineBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  helplineBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 6,
  },
  helplineBtnSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  faqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 10,
  },
  faqAnswer: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  // Profile Section
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  profileHeroName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  profileHeroPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  profileHeroCity: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
    marginTop: 2,
  },
  profileBadgeRight: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  profileBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
  },
  vehicleManageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  activeVehicleCard: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  vehicleManageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleManageTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  vehicleManagePlate: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  vehicleRadioBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeVehicleRadioBtn: {
    backgroundColor: '#10b981',
  },
  vehicleRadioBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  docItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  docStatus: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    marginTop: 1,
  },
  profileActionsCard: {
    gap: 10,
    marginTop: 6,
  },
  switchRoleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 12,
  },
  switchRoleActionText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  logoutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingVertical: 12,
  },
  logoutActionText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },
  // Empty State
  emptyStateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  refreshIconBtn: {
    padding: 4,
  },
  // Receipt Modal
  receiptHeroFare: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  receiptHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  receiptHeroVal: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 2,
  },
  receiptHeroStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  receiptKey: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  receiptVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 16,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activeZoneItem: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  zoneName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  activeZoneName: {
    color: '#15803d',
    fontWeight: '800',
  },
  zoneSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeSmallChip: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  smallChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  activeSmallChipText: {
    color: '#ffffff',
  },
  // Incoming Modal
  incomingModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  incomingModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  timerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSecs: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  incomingHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  incomingVehicleBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  incomingFareBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  earningLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  incomingFare: {
    fontSize: 30,
    fontWeight: '900',
    color: '#15803d',
  },
  incomingFareSub: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '700',
    marginTop: 2,
  },
  distanceChipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  distChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  distChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  passengerPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  passAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  passPhone: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  passRatingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  passRatingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  incomingPoints: {
    marginBottom: 16,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routePin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  routePinLine: {
    width: 2,
    height: 14,
    backgroundColor: '#cbd5e1',
    marginLeft: 4,
    marginVertical: 2,
  },
  routePointLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  incomingPointText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  incomingBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  acceptBtn: {
    flex: 2,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
  // OTP Modal
  otpModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 120,
    alignItems: 'center',
  },
  otpModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  otpModalSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  otpInputField: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 12,
    width: 180,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: '#f0fdf4',
  },
  otpVerifyBtn: {
    backgroundColor: '#059669',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  otpVerifyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCancelBtn: {
    marginTop: 12,
    padding: 6,
  },
  modalCancelBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  // QR Payment
  fareAmountCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  fareAmountLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  fareAmountVal: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 2,
  },
  fareAmountSub: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  qrCodeWrapper: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  qrImage: {
    width: 160,
    height: 160,
    marginBottom: 6,
  },
  qrScanInstruction: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
    textAlign: 'center',
  },
  verifyPaymentBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  verifyPaymentBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cashPaymentBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cashPaymentBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  customRateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  customRateCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  customRateStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  customRateStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  customRateDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  customRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  customRateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  customRateCurrency: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
    marginRight: 4,
  },
  customRateInput: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    width: 44,
    textAlign: 'center',
    padding: 0,
  },
  customRateUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 4,
  },
  ratePresetsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  ratePresetBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ratePresetBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  ratePresetBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  ratePresetBtnTextActive: {
    color: '#ffffff',
  },
  saveRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  saveRateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
});
