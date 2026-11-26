import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { CommunityRide, MyReservationItem } from '../types';
import { LocationSearchModal } from './LocationSearchModal';

interface CommunityRidesPanelProps {
  onSelectRoutePreview?: (originLat: number, originLng: number, destLat: number, destLng: number) => void;
  initialCategory?: 'UNIVERSITY' | 'CITY' | 'LOCAL';
}

export const CommunityRidesPanel: React.FC<CommunityRidesPanelProps> = ({
  onSelectRoutePreview,
  initialCategory = 'UNIVERSITY',
}) => {
  // Main Segment View: BROWSE vs MY_BOOKINGS (Campus & City Bookings)
  const [panelView, setPanelView] = useState<'BROWSE' | 'MY_BOOKINGS'>('BROWSE');

  // Browse Feed State
  const [rides, setRides] = useState<CommunityRide[]>([]);
  const [loading, setLoading] = useState(false);

  // My Posted Rides & Bookings State
  const [myPostedRides, setMyPostedRides] = useState<CommunityRide[]>([]);
  const [myBookings, setMyBookings] = useState<MyReservationItem[]>([]);
  const [loadingMyData, setLoadingMyData] = useState(false);

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState<'UNIVERSITY' | 'CITY' | 'LOCAL' | 'ALL'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Booking Confirmation Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedRideForBooking, setSelectedRideForBooking] = useState<CommunityRide | null>(null);
  const [bookPassengerName, setBookPassengerName] = useState('');
  const [bookPassengerPhone, setBookPassengerPhone] = useState('');
  const [bookPickupLocation, setBookPickupLocation] = useState('');
  const [bookSeatsCount, setBookSeatsCount] = useState(1);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Edit Ride Modal State (Host can modify posted ride)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRide, setEditingRide] = useState<CommunityRide | null>(null);
  const [editOriginAddress, setEditOriginAddress] = useState('');
  const [editDestAddress, setEditDestAddress] = useState('');
  const [editDepartureTime, setEditDepartureTime] = useState('');
  const [editTotalSeats, setEditTotalSeats] = useState('1');
  const [editPricePerSeat, setEditPricePerSeat] = useState('35');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Post Ride Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for posting a ride
  const [postCategory, setPostCategory] = useState<'UNIVERSITY' | 'CITY' | 'LOCAL'>('UNIVERSITY');
  const [universityFullName, setUniversityFullName] = useState('');
  const [universityShortName, setUniversityShortName] = useState('');
  const [posterGender, setPosterGender] = useState<'MALE' | 'FEMALE'>('MALE');

  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [vehicleType, setVehicleType] = useState<'bike' | 'bullet_ktm' | 'scooter' | 'auto' | 'car' | 'bus'>('bike');
  const [vehicleModel, setVehicleModel] = useState('');
  const [totalSeats, setTotalSeats] = useState('1');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [notes, setNotes] = useState('');

  // User's current location when browsing nearby rides
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationAddress, setUserLocationAddress] = useState<string>('');
  const [locationFetching, setLocationFetching] = useState(false);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(25); // 5, 15, 25, 50, 9999 (All)
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Form states for posting a ride with exact GPS location
  const [postOriginLat, setPostOriginLat] = useState<number | null>(null);
  const [postOriginLng, setPostOriginLng] = useState<number | null>(null);
  const [fetchingPostLocation, setFetchingPostLocation] = useState(false);

  // Distance calculator helper (Haversine formula in KM)
  const calculateGeoDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const getExactBrowserLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.warn('[CommunityRides] GPS prompt error or dismissed:', err.message);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        resolve(null);
      }
    });
  };

  const requestViewerLocation = async () => {
    setLocationFetching(true);
    const coords = await getExactBrowserLocation();
    if (coords) {
      setUserLocation(coords);
      try {
        const geo = await api.location.reverseGeocode(coords.lat, coords.lng);
        if (geo) {
          const city = geo.city;
          const state = geo.state;
          let displayLoc = '';
          if (city) {
            displayLoc = `${city}${state && state !== city ? `, ${state}` : ''}`;
          } else if (geo.address) {
            const parts = geo.address.split(',').map((p: string) => p.trim()).filter(Boolean);
            displayLoc = parts.slice(0, 2).join(', ');
          } else {
            displayLoc = `GPS (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`;
          }
          setUserLocationAddress(displayLoc);
        } else {
          setUserLocationAddress(`GPS (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`);
        }
      } catch {
        setUserLocationAddress(`GPS (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`);
      }
    }
    setLocationFetching(false);
  };

  const fetchPostGps = async () => {
    setFetchingPostLocation(true);
    const coords = await getExactBrowserLocation();
    if (coords) {
      setPostOriginLat(coords.lat);
      setPostOriginLng(coords.lng);
      setOriginAddress((prev) => (!prev ? `My Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : prev));
    }
    setFetchingPostLocation(false);
  };

  // Automatically request user location upon entering this section
  useEffect(() => {
    requestViewerLocation();
  }, []);

  // Saved vehicle & registration modal state (First-time post requirement)
  const [savedVehicle, setSavedVehicle] = useState<any>(null);
  const [checkingVehicle, setCheckingVehicle] = useState(false);
  const [showVehicleRegModal, setShowVehicleRegModal] = useState(false);
  const [regLicenseNumber, setRegLicenseNumber] = useState('');
  const [regVehiclePlate, setRegVehiclePlate] = useState('');
  const [regVehicleType, setRegVehicleType] = useState<'GENERAL_BIKE' | 'PRO_BIKE' | 'CAR' | 'AUTO'>('GENERAL_BIKE');
  const [regVehicleModel, setRegVehicleModel] = useState('');
  const [registeringVehicle, setRegisteringVehicle] = useState(false);

  const fetchSavedVehicle = async () => {
    try {
      const res = await api.communityRides.getMyVehicle();
      if (res && res.registered) {
        setSavedVehicle(res.profile);
      } else {
        setSavedVehicle(null);
      }
    } catch (e) {
      console.warn('Could not check vehicle registration:', e);
    }
  };

  useEffect(() => {
    fetchSavedVehicle();
  }, []);

  const handleOpenPostRideModal = async () => {
    fetchPostGps();
    setCheckingVehicle(true);
    try {
      const res = await api.communityRides.getMyVehicle();
      if (res && res.registered && res.profile) {
        setSavedVehicle(res.profile);
        if (res.profile.vehicle_model) setVehicleModel(res.profile.vehicle_model);
        setShowAddModal(true);
      } else {
        setShowVehicleRegModal(true);
      }
    } catch {
      setShowVehicleRegModal(true);
    } finally {
      setCheckingVehicle(false);
    }
  };

  const handleSaveVehicleAndProceed = async () => {
    if (!regLicenseNumber.trim() || !regVehiclePlate.trim()) {
      Alert.alert('Required Fields', 'Please enter your Driving License and Vehicle Registration Plate Number.');
      return;
    }
    setRegisteringVehicle(true);
    try {
      const res = await api.communityRides.registerVehicle({
        license_number: regLicenseNumber.trim().toUpperCase(),
        vehicle_plate: regVehiclePlate.trim().toUpperCase(),
        vehicle_type: regVehicleType,
        vehicle_model: regVehicleModel.trim(),
      });
      setSavedVehicle(res.profile);
      Alert.alert(
        'Vehicle & License Saved! 🚗🛡️',
        'Your Driving License and Vehicle Plate details have been saved to your profile and submitted for Admin verification.'
      );
      setShowVehicleRegModal(false);
      if (res.profile.vehicle_model) setVehicleModel(res.profile.vehicle_model);
      setShowAddModal(true);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Could not save vehicle details');
    } finally {
      setRegisteringVehicle(false);
    }
  };

  const handleFinishRide = (rideId: string) => {
    Alert.alert(
      '⚠️ Security Warning',
      'Bich me ride confirm / finish na kare, aapki and passengers ki security ke liye.\n\nMake sure all passengers have reached their drop location safely before finishing this trip.',
      [
        { text: 'Not Yet (Cancel)', style: 'cancel' },
        {
          text: 'Confirm Trip Complete',
          style: 'default',
          onPress: async () => {
            try {
              await api.communityRides.finishRide(rideId);
              Alert.alert('Trip Completed! 🎉', 'Ride marked finished. Thank you for ensuring safe campus transit!');
              loadRides();
              loadMyData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not complete trip');
            }
          },
        },
      ]
    );
  };

  const loadRides = async () => {
    setLoading(true);
    try {
      const data = await api.communityRides.list({
        universityQuery: searchQuery.trim() || undefined,
        categoryType: selectedCategory === 'ALL' ? undefined : selectedCategory,
        pickup_lat: userLocation?.lat,
        pickup_lng: userLocation?.lng,
      });

      let list = data || [];

      // Filter rides by chosen search radius (e.g. 5km, 15km, 25km, 50km)
      if (userLocation && selectedRadiusKm !== 9999) {
        list = list.filter((r) => {
          const dist = r.pickup_detour_km ?? (
            r.pickup_latitude && r.pickup_longitude
              ? calculateGeoDistance(userLocation.lat, userLocation.lng, r.pickup_latitude, r.pickup_longitude)
              : null
          );
          if (dist == null) return true;
          return dist <= selectedRadiusKm;
        });
      }

      // Sort rides so closest to user's location appear first!
      if (userLocation && list.length > 0) {
        const sorted = [...list].sort((a, b) => {
          const distA = a.pickup_detour_km ?? (a.pickup_latitude && a.pickup_longitude ? calculateGeoDistance(userLocation.lat, userLocation.lng, a.pickup_latitude, a.pickup_longitude) : 9999);
          const distB = b.pickup_detour_km ?? (b.pickup_latitude && b.pickup_longitude ? calculateGeoDistance(userLocation.lat, userLocation.lng, b.pickup_latitude, b.pickup_longitude) : 9999);
          return distA - distB;
        });
        setRides(sorted);
      } else {
        setRides(list);
      }
    } catch (err: any) {
      console.error('Error fetching university and community rides:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyData = async () => {
    setLoadingMyData(true);
    try {
      const [posted, booked] = await Promise.all([
        api.communityRides.getMyPostedRides().catch(() => []),
        api.communityRides.getMyBookings().catch(() => []),
      ]);
      setMyPostedRides(posted);
      setMyBookings(booked);
    } catch (err) {
      console.error('Error loading my rides and bookings:', err);
    } finally {
      setLoadingMyData(false);
    }
  };

  useEffect(() => {
    loadRides();
  }, [searchQuery, selectedCategory, userLocation, selectedRadiusKm]);

  useEffect(() => {
    loadMyData();
  }, [panelView]);

  // Open booking modal and pre-populate passenger info
  const handleOpenBookingModal = async (ride: CommunityRide) => {
    if (ride.available_seats <= 0) {
      Alert.alert('Unavailable', 'This ride is currently fully booked (Sold Out).');
      return;
    }
    setSelectedRideForBooking(ride);
    setBookSeatsCount(1);
    setBookPickupLocation('');
    setShowBookingModal(true);

    try {
      const profile = await api.auth.getMe();
      if (profile) {
        if (!bookPassengerName && profile.full_name) setBookPassengerName(profile.full_name);
        if (!bookPassengerPhone && profile.phone_number) setBookPassengerPhone(profile.phone_number);
      }
    } catch {
      // Ignore background profile fetch failure
    }
  };

  // Confirm reservation
  const handleConfirmBooking = async () => {
    if (!selectedRideForBooking) return;

    if (!bookPassengerName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name so the host knows who to pick up.');
      return;
    }
    if (!bookPassengerPhone.trim()) {
      Alert.alert('Phone Required', 'Please enter your contact phone number for coordination.');
      return;
    }
    if (!bookPickupLocation.trim()) {
      Alert.alert('Pickup Location Required', 'Please specify where you will wait for pickup (within 1-2 km of the route).');
      return;
    }

    setBookingInProgress(true);
    try {
      const res = await api.communityRides.reserve(
        selectedRideForBooking.id,
        bookSeatsCount,
        bookPickupLocation.trim(),
        undefined,
        undefined,
        bookPassengerName.trim(),
        bookPassengerPhone.trim()
      );

      Alert.alert(
        'Seat Confirmed! 🎓🚗',
        `You have booked ${bookSeatsCount} seat(s) with ${selectedRideForBooking.creator_name}.\n\nPickup: ${bookPickupLocation.trim()}\nTotal: ₹${res.total_fare || (bookSeatsCount * selectedRideForBooking.price_per_seat)}\n\nHost has been notified with your contact and pickup location.`
      );
      setShowBookingModal(false);
      setSelectedRideForBooking(null);
      loadRides();
      loadMyData();
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Could not complete reservation.');
    } finally {
      setBookingInProgress(false);
    }
  };

  // Cancel reservation (returns seat to inventory)
  const handleCancelReservation = (bookingId: string) => {
    Alert.alert(
      'Cancel Reservation?',
      'Are you sure you want to cancel this booking? The seat will be released immediately and returned to available inventory for other commuters.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Yes, Cancel Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.communityRides.cancelReservation(bookingId, 'Cancelled by user');
              Alert.alert('Seat Cancelled', 'Your reservation was cancelled. The seat is now open for others.');
              loadRides();
              loadMyData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not cancel reservation');
            }
          },
        },
      ]
    );
  };

  const handleCallUser = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('No Contact', `Phone number not available for ${name}`);
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Contact', `Phone: ${phone}`);
    });
  };

  const handlePostRide = async () => {
    if (!originAddress || !destAddress || !pricePerSeat) {
      Alert.alert('Incomplete Details', 'Please fill in Pickup, Destination, and Price per seat.');
      return;
    }

    if (postCategory === 'UNIVERSITY' && !universityFullName.trim()) {
      Alert.alert('University Required', 'Please enter University / College Name.');
      return;
    }

    setSubmitting(true);
    try {
      let latToSend = postOriginLat;
      let lngToSend = postOriginLng;
      if (!latToSend || !lngToSend) {
        const coords = await getExactBrowserLocation();
        if (coords) {
          latToSend = coords.lat;
          lngToSend = coords.lng;
        }
      }

      await api.communityRides.create({
        pickup_address: originAddress,
        pickup_latitude: latToSend || undefined,
        pickup_longitude: lngToSend || undefined,
        destination_address: destAddress,
        departure_time: departureTime,
        total_seats: parseInt(totalSeats, 10) || 1,
        price_per_seat: parseFloat(pricePerSeat) || 40,
        vehicle_info: vehicleModel
          ? `${vehicleModel} (${vehicleType.toUpperCase()})`
          : vehicleType.toUpperCase(),
        vehicle_type: vehicleType.includes('bike') || vehicleType === 'scooter' || vehicleType === 'bullet_ktm' ? 'bike' : vehicleType,
        category_type: postCategory,
        university_name: postCategory === 'UNIVERSITY' ? universityFullName.trim() : undefined,
        university_short_name: postCategory === 'UNIVERSITY' ? universityShortName.trim().toUpperCase() : undefined,
        poster_gender: posterGender,
        notes,
      });

      Alert.alert(
        'Ride Posted Successfully! 🎉',
        `Your ${postCategory === 'UNIVERSITY' ? `${universityFullName} (${universityShortName})` : postCategory} ride is now active. When passengers book, their details will appear in "Campus & City Bookings".`
      );
      setShowAddModal(false);
      loadRides();
      loadMyData();
    } catch (err: any) {
      Alert.alert('Failed to Post Ride', err.message || 'Error creating ride');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (ride: CommunityRide) => {
    setEditingRide(ride);
    setEditOriginAddress(ride.pickup_address || '');
    setEditDestAddress(ride.destination_address || '');
    setEditDepartureTime(ride.departure_time || '');
    setEditTotalSeats(String(ride.total_seats || 1));
    setEditPricePerSeat(String(ride.price_per_seat || 35));
    setEditNotes(ride.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEditRide = async () => {
    if (!editingRide) return;
    if (!editOriginAddress.trim() || !editDestAddress.trim() || !editPricePerSeat.trim()) {
      Alert.alert('Incomplete Details', 'Please fill in pickup, destination, and price per seat.');
      return;
    }
    setEditSubmitting(true);
    try {
      await api.communityRides.update(editingRide.id, {
        pickup_address: editOriginAddress.trim(),
        destination_address: editDestAddress.trim(),
        departure_time: editDepartureTime.trim(),
        total_seats: parseInt(editTotalSeats, 10) || 1,
        price_per_seat: parseFloat(editPricePerSeat) || 35,
        notes: editNotes.trim(),
      });
      Alert.alert('Ride Modified! 🚗✏️', 'Your ride details and schedule have been updated.');
      setShowEditModal(false);
      setEditingRide(null);
      loadRides();
      loadMyData();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update ride');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteRide = async (rideId: string) => {
    Alert.alert(
      'Cancel & Delete Ride?',
      'Are you sure you want to cancel this posted ride? All active bookings will also be cancelled.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.communityRides.delete(rideId);
              Alert.alert('Ride Cancelled', 'Your shared ride has been removed.');
              loadRides();
              loadMyData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not cancel ride');
            }
          },
        },
      ]
    );
  };

  const totalMyBookedCount = myBookings.filter((b) => b.status !== 'CANCELLED').length;
  const totalHostBookingsCount = myPostedRides.reduce(
    (acc, r) => acc + (r.bookings ? r.bookings.filter((b) => b.status !== 'CANCELLED').length : 0),
    0
  );

  return (
    <View style={styles.container}>
      {/* 1. Header & Segment Selector */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.mainTitle}>🎓 Campus & City Rides</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            University rides, daily commute & local sharing at custom prices
          </Text>
        </View>

        <TouchableOpacity
          style={styles.postRideBtn}
          onPress={handleOpenPostRideModal}
          activeOpacity={0.85}
        >
          {checkingVehicle ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="add-circle" size={16} color="#ffffff" />
              <Text style={styles.postRideBtnText}>+ Post Ride</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Mode Switcher: Browse Rides vs Campus & City Bookings */}
      <View style={styles.viewModeSwitcher}>
        <TouchableOpacity
          style={[styles.viewModeBtn, panelView === 'BROWSE' && styles.viewModeBtnActive]}
          onPress={() => setPanelView('BROWSE')}
        >
          <Ionicons
            name="search"
            size={14}
            color={panelView === 'BROWSE' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.viewModeBtnText, panelView === 'BROWSE' && styles.viewModeBtnTextActive]}>
            Browse Rides
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewModeBtn, panelView === 'MY_BOOKINGS' && styles.viewModeBtnActive]}
          onPress={() => setPanelView('MY_BOOKINGS')}
        >
          <Ionicons
            name="people"
            size={14}
            color={panelView === 'MY_BOOKINGS' ? '#ffffff' : '#64748b'}
          />
          <Text style={[styles.viewModeBtnText, panelView === 'MY_BOOKINGS' && styles.viewModeBtnTextActive]}>
            Campus & City Bookings
          </Text>
          {(totalHostBookingsCount > 0 || totalMyBookedCount > 0) && (
            <View style={styles.badgeCountPill}>
              <Text style={styles.badgeCountText}>
                {totalHostBookingsCount + totalMyBookedCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. TAB 1: BROWSE RIDES */}
      {panelView === 'BROWSE' && (
        <>
          {/* Category Switcher Chips (3 Options requested by user) */}
          <View style={styles.categoryTabsRow}>
            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'UNIVERSITY' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('UNIVERSITY')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'UNIVERSITY' && styles.categoryTabTextActive]}>
                🎓 University / College
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'CITY' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('CITY')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'CITY' && styles.categoryTabTextActive]}>
                🏙️ City / Area
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'LOCAL' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('LOCAL')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'LOCAL' && styles.categoryTabTextActive]}>
                📍 Local
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'ALL' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('ALL')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'ALL' && styles.categoryTabTextActive]}>
                🌐 All
              </Text>
            </TouchableOpacity>
          </View>

          {/* University Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={16} color="#0284c7" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                selectedCategory === 'UNIVERSITY'
                  ? 'Search University or College...'
                  : 'Search Area or Destination...'
              }
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={loadRides}>
                <Ionicons name="refresh" size={16} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Clean Proximity & Location Status Header */}
          <View style={styles.proximityStatusBar}>
            {/* Top row: Current location name & actions */}
            <View style={styles.proximityTopRow}>
              <View style={styles.proximityTitleGroup}>
                <View style={[styles.proximityPinCircle, userLocation ? styles.proximityPinCircleActive : null]}>
                  <Ionicons
                    name={userLocation ? 'location' : 'navigate-outline'}
                    size={16}
                    color={userLocation ? '#0284c7' : '#64748b'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.proximityStatusTitle} numberOfLines={1}>
                      {userLocationAddress
                        ? userLocationAddress
                        : userLocation
                        ? `GPS (${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)})`
                        : locationFetching
                        ? 'Detecting your location...'
                        : 'Location not set'}
                    </Text>
                    {userLocation && (
                      <View style={styles.liveGpsBadge}>
                        <View style={styles.greenPulseDot} />
                        <Text style={styles.liveGpsBadgeText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.proximityStatusSub} numberOfLines={1}>
                    {userLocation
                      ? `Within ${selectedRadiusKm === 9999 ? 'all areas' : `${selectedRadiusKm} km range`} • Closest rides first`
                      : 'Detect or pick location to see rides near you'}
                  </Text>
                </View>
              </View>

              <View style={styles.proximityActionsRow}>
                <TouchableOpacity
                  style={styles.changeLocBtn}
                  onPress={() => setShowLocationModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search-outline" size={12} color="#0284c7" />
                  <Text style={styles.changeLocBtnText}>Change</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.refreshLocBtn, userLocation ? styles.refreshLocBtnActive : null]}
                  onPress={requestViewerLocation}
                  disabled={locationFetching}
                  activeOpacity={0.7}
                >
                  {locationFetching ? (
                    <ActivityIndicator size="small" color="#0284c7" />
                  ) : (
                    <Ionicons name="locate" size={14} color={userLocation ? '#0284c7' : '#64748b'} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Range / Radius Selector Filter */}
            <View style={styles.rangeSelectorRow}>
              <Text style={styles.rangeLabel}>Range:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeChipsScroll}>
                {[
                  { label: '5 km', val: 5 },
                  { label: '15 km', val: 15 },
                  { label: '25 km', val: 25 },
                  { label: '50 km', val: 50 },
                  { label: '🌐 All', val: 9999 },
                ].map((chip) => {
                  const isActive = selectedRadiusKm === chip.val;
                  return (
                    <TouchableOpacity
                      key={chip.val}
                      style={[styles.rangeChip, isActive && styles.rangeChipActive]}
                      onPress={() => setSelectedRadiusKm(chip.val)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.rangeChipText, isActive && styles.rangeChipTextActive]}>
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Rides List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={styles.loadingText}>Fetching available rides...</Text>
            </View>
          ) : rides.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="location-outline" size={42} color="#94a3b8" />
              <Text style={styles.emptyTitle}>
                {selectedRadiusKm !== 9999 && userLocation
                  ? `No rides found within ${selectedRadiusKm} km`
                  : 'No matching rides found'}
              </Text>
              <Text style={styles.emptySub}>
                {userLocation && selectedRadiusKm !== 9999
                  ? `Koi ride ${selectedRadiusKm} km range me available nahi mili around "${userLocationAddress || 'your location'}". Aap search range badha sakte hain ya sabhi rides dekh sakte hain.`
                  : searchQuery
                  ? `No rides found matching "${searchQuery}". Be the first to post a ride!`
                  : 'No rides listed for this category. Post your ride to help fellow students & travelers!'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                {selectedRadiusKm !== 9999 && (
                  <TouchableOpacity
                    style={[styles.emptyActionBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}
                    onPress={() => setSelectedRadiusKm(9999)}
                  >
                    <Text style={[styles.emptyActionText, { color: '#1e293b' }]}>🌐 Show All Rides</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={handleOpenPostRideModal}
                >
                  <Text style={styles.emptyActionText}>+ Post a Ride Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.ridesScroll} showsVerticalScrollIndicator={false}>
              {rides.map((ride) => {
                const isFull = ride.available_seats <= 0;
                const isFemaleHost = ride.poster_gender === 'FEMALE';
                const isUniversityRide = ride.category_type === 'UNIVERSITY' || !!ride.university_name;
                const proximityKm = ride.pickup_detour_km ?? (
                  userLocation && ride.pickup_latitude && ride.pickup_longitude
                    ? calculateGeoDistance(userLocation.lat, userLocation.lng, ride.pickup_latitude, ride.pickup_longitude)
                    : null
                );

                return (
                  <View key={ride.id} style={styles.rideCard}>
                    {/* Header Tag Banner */}
                    <View style={styles.cardHeaderTagRow}>
                      <View
                        style={[
                          styles.categoryTagPill,
                          isUniversityRide ? styles.tagUniversity : styles.tagCity,
                        ]}
                      >
                        <Ionicons
                          name={isUniversityRide ? 'school' : ride.category_type === 'LOCAL' ? 'location' : 'business'}
                          size={12}
                          color={isUniversityRide ? '#0284c7' : '#059669'}
                        />
                        <Text
                          style={[
                            styles.categoryTagPillText,
                            isUniversityRide ? styles.tagUniversityText : styles.tagCityText,
                          ]}
                          numberOfLines={1}
                        >
                          {isUniversityRide
                            ? `${ride.university_name || 'University'}${
                                ride.university_short_name ? ` (${ride.university_short_name})` : ''
                              }`
                            : ride.category_type === 'LOCAL'
                            ? '📍 Local Campus Route'
                            : '🏙️ City Commute'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {proximityKm != null && (
                          <View style={styles.cardProximityBadge}>
                            <Ionicons name="navigate-circle" size={13} color="#0284c7" />
                            <Text style={styles.cardProximityBadgeText}>
                              {proximityKm < 1
                                ? `${Math.round(proximityKm * 1000)}m away`
                                : `${proximityKm.toFixed(1)} km from you`}
                            </Text>
                          </View>
                        )}

                        <View
                          style={[
                            styles.genderBadge,
                            isFemaleHost ? styles.genderBadgeFemale : styles.genderBadgeMale,
                          ]}
                        >
                          <Ionicons
                            name={isFemaleHost ? 'female' : 'male'}
                            size={11}
                            color={isFemaleHost ? '#db2777' : '#0284c7'}
                          />
                          <Text
                            style={[
                              styles.genderBadgeText,
                              isFemaleHost ? styles.genderBadgeTextFemale : styles.genderBadgeTextMale,
                            ]}
                          >
                            {isFemaleHost ? '👧 Girls' : '👦 Boys'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Creator & Price */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.creatorInfo}>
                        <View
                          style={[
                            styles.creatorAvatar,
                            isFemaleHost ? { backgroundColor: '#fce7f3' } : { backgroundColor: '#e0f2fe' },
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={14}
                            color={isFemaleHost ? '#db2777' : '#0284c7'}
                          />
                        </View>
                        <View>
                          <Text style={styles.creatorName}>{ride.creator_name}</Text>
                          <Text style={styles.creatorPhone}>
                            {ride.is_mine || ride.user_has_booked
                              ? `📞 ${ride.creator_phone}`
                              : `🔒 ${ride.creator_phone} (Book to reveal)`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.priceTag}>
                        <Text style={styles.priceNumber}>₹{ride.price_per_seat}</Text>
                        <Text style={styles.priceSub}>/ seat</Text>
                      </View>
                    </View>

                    {/* Route Visualizer */}
                    <View style={styles.routeBox}>
                      <View style={styles.routePoints}>
                        <View style={styles.greenDot} />
                        <View style={styles.routeDottedLine} />
                        <View style={styles.redSquare} />
                      </View>
                      <View style={styles.routeLabels}>
                        <Text style={styles.originText} numberOfLines={1}>
                          {ride.pickup_address || 'Pickup Point'}
                        </Text>
                        <Text style={styles.destText} numberOfLines={1}>
                          {ride.destination_address || 'Destination Point'}
                        </Text>
                      </View>
                    </View>

                    {/* Badges: Time, Vehicle, Seats */}
                    <View style={styles.badgesRow}>
                      <View style={styles.badgeItemTime}>
                        <Ionicons name="time" size={12} color="#0284c7" />
                        <Text style={styles.badgeTimeText}>{ride.departure_time}</Text>
                      </View>

                      <View style={styles.badgeItem}>
                        <Ionicons
                          name={
                            (ride.vehicle_info || ride.vehicle_type || '').toLowerCase().includes('bullet')
                              ? 'speedometer'
                              : (ride.vehicle_info || ride.vehicle_type || '').toLowerCase().includes('bike')
                              ? 'bicycle'
                              : (ride.vehicle_info || ride.vehicle_type || '').toLowerCase().includes('scooter')
                              ? 'bicycle'
                              : 'car-sport'
                          }
                          size={12}
                          color="#059669"
                        />
                        <Text style={styles.badgeText}>
                          {ride.vehicle_info || ride.vehicle_type || 'Vehicle'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.badgeItem,
                          isFull ? styles.badgeFull : styles.badgeSeats,
                        ]}
                      >
                        <Ionicons
                          name={isFull ? 'close-circle' : 'people-outline'}
                          size={12}
                          color={isFull ? '#dc2626' : '#b45309'}
                        />
                        <Text
                          style={[
                            styles.badgeText,
                            { color: isFull ? '#dc2626' : '#b45309', fontWeight: '700' },
                          ]}
                        >
                          {isFull ? 'Sold Out / Unavailable' : `${ride.available_seats} seat(s) left`}
                        </Text>
                      </View>
                    </View>

                    {ride.notes ? (
                      <Text style={styles.notesText} numberOfLines={2}>
                        💬 "{ride.notes}"
                      </Text>
                    ) : null}

                    {/* Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      {onSelectRoutePreview && (
                        <TouchableOpacity
                          style={styles.previewBtn}
                          onPress={() =>
                            onSelectRoutePreview(
                              ride.pickup_latitude || 12.9716,
                              ride.pickup_longitude || 77.6412,
                              ride.destination_latitude || 13.1986,
                              ride.destination_longitude || 77.7066
                            )
                          }
                        >
                          <Ionicons name="map-outline" size={13} color="#475569" />
                          <Text style={styles.previewBtnText}>Map</Text>
                        </TouchableOpacity>
                      )}

                      {ride.is_mine ? (
                        <View style={styles.ownerActionsRow}>
                          <TouchableOpacity
                            style={styles.viewMyBookingsMiniBtn}
                            onPress={() => setPanelView('MY_BOOKINGS')}
                          >
                            <Ionicons name="people" size={13} color="#0284c7" />
                            <Text style={styles.viewMyBookingsMiniText}>
                              View Passengers ({ride.bookings?.length || 0})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cancelMyRideBtn}
                            onPress={() => handleDeleteRide(ride.id)}
                          >
                            <Ionicons name="trash-outline" size={13} color="#dc2626" />
                            <Text style={styles.cancelMyRideText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : ride.user_has_booked ? (
                        <View style={styles.bookedStatusRow}>
                          <View style={styles.bookedPill}>
                            <Ionicons name="checkmark-circle" size={13} color="#059669" />
                            <Text style={styles.bookedPillText}>Seat Reserved</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.cancelBookedBtn}
                            onPress={() => setPanelView('MY_BOOKINGS')}
                          >
                            <Text style={styles.cancelBookedText}>Manage</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.joinBtn, isFull && styles.joinBtnDisabled]}
                          onPress={() => handleOpenBookingModal(ride)}
                          disabled={isFull}
                        >
                          <Ionicons
                            name={isFull ? 'ban-outline' : 'flash'}
                            size={13}
                            color="#ffffff"
                          />
                          <Text style={styles.joinBtnText}>
                            {isFull ? 'Unavailable (Sold Out)' : 'Book Seat'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* 3. TAB 2: CAMPUS & CITY BOOKINGS (HOST & PASSENGER MANAGEMENT) */}
      {panelView === 'MY_BOOKINGS' && (
        <ScrollView style={styles.bookingsScroll} showsVerticalScrollIndicator={false}>
          {loadingMyData ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={styles.loadingText}>Loading your rides & passenger bookings...</Text>
            </View>
          ) : (
            <>
              {/* SECTION A: RIDES POSTED BY ME (HOST VIEW) */}
              <View style={styles.managementSectionHeader}>
                <Ionicons name="megaphone" size={16} color="#0284c7" />
                <Text style={styles.managementSectionTitle}>Rides You Posted (Host View)</Text>
              </View>

              {myPostedRides.length === 0 ? (
                <View style={styles.emptySubBox}>
                  <Text style={styles.emptySubText}>
                    You haven't posted any shared rides yet. Tap "+ Post Ride" above to offer seats!
                  </Text>
                </View>
              ) : (
                myPostedRides.map((ride) => {
                  const activeBookings = (ride.bookings || []).filter((b) => b.status !== 'CANCELLED');
                  const isSoldOut = ride.available_seats <= 0;

                  return (
                    <View key={ride.id} style={styles.hostRideCard}>
                      {/* Host Card Header */}
                      <View style={styles.hostHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.hostRouteText}>
                            {ride.pickup_address} ➔ {ride.destination_address}
                          </Text>
                          <Text style={styles.hostMetaText}>
                            ⏰ {ride.departure_time} • 🚗 {ride.vehicle_info || ride.vehicle_type} • ₹{ride.price_per_seat}/seat
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.inventoryStatusPill,
                            isSoldOut ? styles.pillSoldOut : styles.pillOpen,
                          ]}
                        >
                          <Text
                            style={[
                              styles.inventoryStatusText,
                              isSoldOut ? styles.textSoldOut : styles.textOpen,
                            ]}
                          >
                            {isSoldOut ? 'SOLD OUT (0 Seats)' : `${ride.available_seats}/${ride.total_seats} Available`}
                          </Text>
                        </View>
                      </View>

                      {/* Passenger Bookings Container */}
                      <View style={styles.passengersContainer}>
                        <Text style={styles.passengersSectionHeading}>
                          👥 Booked Passengers ({activeBookings.length}):
                        </Text>

                        {activeBookings.length === 0 ? (
                          <View style={styles.noPassengersBox}>
                            <Ionicons name="time-outline" size={16} color="#94a3b8" />
                            <Text style={styles.noPassengersText}>
                              No passengers have booked this ride yet. Once a traveler reserves a seat, their name, contact number, and pickup landmark will appear right here.
                            </Text>
                          </View>
                        ) : (
                          activeBookings.map((b) => (
                            <View key={b.id} style={styles.passengerDetailCard}>
                              <View style={styles.passengerTopRow}>
                                <View style={styles.passengerIdentity}>
                                  <Ionicons name="person-circle" size={24} color="#0284c7" />
                                  <View>
                                    <Text style={styles.passengerNameText}>{b.passenger_name || 'Passenger'}</Text>
                                    <Text style={styles.passengerSeatsTag}>
                                      {b.seats_booked} Seat(s) • Total: ₹{b.total_price}
                                    </Text>
                                  </View>
                                </View>

                                {/* Direct Call Button */}
                                <TouchableOpacity
                                  style={styles.callPassengerBtn}
                                  onPress={() => handleCallUser(b.passenger_phone, b.passenger_name)}
                                >
                                  <Ionicons name="call" size={12} color="#ffffff" />
                                  <Text style={styles.callPassengerBtnText}>Call</Text>
                                </TouchableOpacity>
                              </View>

                              {/* Pickup Location / Landmark */}
                              <View style={styles.pickupLocationBox}>
                                <Ionicons name="location" size={13} color="#e11d48" />
                                <Text style={styles.pickupLocationText} numberOfLines={2}>
                                  Pickup Landmark: {b.pickup_notes || 'Along route'}
                                </Text>
                              </View>

                              {/* Distance & Detour Warning Badge */}
                              <View style={styles.detourNoticeBox}>
                                <Ionicons name="information-circle" size={12} color="#d97706" />
                                <Text style={styles.detourNoticeText}>
                                  Pickup should be within 1-2 km of your route.
                                </Text>
                              </View>

                              <View style={styles.passengerFooterRow}>
                                <View style={styles.bookingStatusBadge}>
                                  <Text style={styles.bookingStatusBadgeText}>
                                    Status: {b.status}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  style={styles.cancelPassengerBtn}
                                  onPress={() => handleCancelReservation(b.id)}
                                >
                                  <Text style={styles.cancelPassengerBtnText}>Cancel Booking</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))
                        )}
                      </View>

                      {/* Ride Actions */}
                      <View style={styles.hostCardFooter}>
                        {ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && (
                          <TouchableOpacity
                            style={styles.finishPostedRideBtn}
                            onPress={() => handleFinishRide(ride.id)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-done-circle" size={14} color="#ffffff" />
                            <Text style={styles.finishPostedRideText}>Finish Ride (Drop Complete)</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.editPostedRideBtn}
                          onPress={() => handleOpenEditModal(ride)}
                        >
                          <Ionicons name="create-outline" size={13} color="#0284c7" />
                          <Text style={styles.editPostedRideText}>Edit Ride</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deletePostedRideBtn}
                          onPress={() => handleDeleteRide(ride.id)}
                        >
                          <Ionicons name="trash-outline" size={13} color="#dc2626" />
                          <Text style={styles.deletePostedRideText}>Cancel & Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              {/* SECTION B: YOUR BOOKED SEATS (PASSENGER VIEW) */}
              <View style={[styles.managementSectionHeader, { marginTop: 20 }]}>
                <Ionicons name="ticket" size={16} color="#059669" />
                <Text style={styles.managementSectionTitle}>Your Booked Seats (Passenger View)</Text>
              </View>

              {myBookings.filter((b) => b.status !== 'CANCELLED').length === 0 ? (
                <View style={styles.emptySubBox}>
                  <Text style={styles.emptySubText}>
                    You haven't reserved seats on any community rides yet.
                  </Text>
                </View>
              ) : (
                myBookings
                  .filter((b) => b.status !== 'CANCELLED')
                  .map((b) => (
                    <View key={b.id} style={styles.bookedReservationCard}>
                      <View style={styles.bookedReservationHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bookedHostName}>Host: {b.host_name}</Text>
                          <Text style={styles.bookedRouteText}>
                            {b.pickup_address} ➔ {b.destination_address}
                          </Text>
                          <Text style={styles.bookedMetaText}>
                            ⏰ {b.departure_time} • 🚗 {b.vehicle_info} • {b.seats_booked} Seat(s) (₹{b.total_price})
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.callHostBtn}
                          onPress={() => handleCallUser(b.host_phone, b.host_name)}
                        >
                          <Ionicons name="call" size={12} color="#0284c7" />
                          <Text style={styles.callHostBtnText}>Call Host</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.bookedPickupBox}>
                        <Ionicons name="pin" size={13} color="#0284c7" />
                        <Text style={styles.bookedPickupText}>
                          Your Pickup Landmark: {b.pickup_notes || 'Standard Route Point'}
                        </Text>
                      </View>

                      {/* Cancel Booking Button - Replenishes seat count */}
                      <View style={styles.bookedActionRow}>
                        <View style={styles.bookingConfirmedBadge}>
                          <Ionicons name="checkmark-done" size={12} color="#059669" />
                          <Text style={styles.bookingConfirmedText}>{b.status}</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.cancelMyBookingBtn}
                          onPress={() => handleCancelReservation(b.id)}
                        >
                          <Ionicons name="close-circle-outline" size={13} color="#dc2626" />
                          <Text style={styles.cancelMyBookingBtnText}>Cancel Booking</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* 4. MODAL: PASSENGER BOOKING CONFIRMATION WITH 1-2 KM WARNING */}
      <Modal visible={showBookingModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Confirm Seat Reservation 🎒</Text>
                <Text style={styles.modalSubtitle}>Enter pickup details & contact for the host</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowBookingModal(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedRideForBooking && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
                {/* Ride Summary Preview */}
                <View style={styles.bookingRidePreviewCard}>
                  <View style={styles.previewTopRow}>
                    <Text style={styles.previewHostText}>
                      Host: {selectedRideForBooking.creator_name}
                    </Text>
                    <Text style={styles.previewFareText}>
                      ₹{selectedRideForBooking.price_per_seat} / seat
                    </Text>
                  </View>
                  <Text style={styles.previewRouteText}>
                    📍 {selectedRideForBooking.pickup_address} ➔ {selectedRideForBooking.destination_address}
                  </Text>
                  <Text style={styles.previewTimeText}>
                    ⏰ Departs: {selectedRideForBooking.departure_time} • {selectedRideForBooking.vehicle_info || 'Vehicle'}
                  </Text>
                </View>

                {/* 1. Passenger Name */}
                <Text style={styles.fieldLabel}>YOUR FULL NAME *</Text>
                <TextInput
                  style={styles.inputField}
                  value={bookPassengerName}
                  onChangeText={setBookPassengerName}
                  placeholder="e.g. Rahul Sharma"
                />

                {/* 2. Passenger Phone */}
                <Text style={styles.fieldLabel}>YOUR PHONE NUMBER *</Text>
                <TextInput
                  style={styles.inputField}
                  value={bookPassengerPhone}
                  onChangeText={setBookPassengerPhone}
                  placeholder="e.g. +91 98765 43210"
                  keyboardType="phone-pad"
                />

                {/* 3. Pickup Location / Landmark (Kaha se pickup krna hai) */}
                <Text style={styles.fieldLabel}>EXACT PICKUP LOCATION / LANDMARK *</Text>
                <TextInput
                  style={[styles.inputField, { height: 50, textAlignVertical: 'top' }]}
                  value={bookPickupLocation}
                  onChangeText={setBookPickupLocation}
                  placeholder="e.g. Near Metro Gate 2, Main Bus Stop, Outside Society Gate"
                  multiline
                />

                {/* 4. Seat Count Selector */}
                <Text style={styles.fieldLabel}>SEATS TO RESERVE</Text>
                <View style={styles.seatCounterRow}>
                  <TouchableOpacity
                    style={[styles.seatCounterBtn, bookSeatsCount <= 1 && styles.seatCounterBtnDisabled]}
                    onPress={() => setBookSeatsCount(Math.max(1, bookSeatsCount - 1))}
                    disabled={bookSeatsCount <= 1}
                  >
                    <Ionicons name="remove" size={16} color={bookSeatsCount <= 1 ? '#94a3b8' : '#0f172a'} />
                  </TouchableOpacity>
                  <Text style={styles.seatCounterValue}>{bookSeatsCount}</Text>
                  <TouchableOpacity
                    style={[
                      styles.seatCounterBtn,
                      bookSeatsCount >= selectedRideForBooking.available_seats && styles.seatCounterBtnDisabled,
                    ]}
                    onPress={() =>
                      setBookSeatsCount(Math.min(selectedRideForBooking.available_seats, bookSeatsCount + 1))
                    }
                    disabled={bookSeatsCount >= selectedRideForBooking.available_seats}
                  >
                    <Ionicons
                      name="add"
                      size={16}
                      color={
                        bookSeatsCount >= selectedRideForBooking.available_seats ? '#94a3b8' : '#0f172a'
                      }
                    />
                  </TouchableOpacity>
                  <Text style={styles.seatAvailableHint}>
                    ({selectedRideForBooking.available_seats} seat(s) available)
                  </Text>
                </View>

                {/* ⚠️ MANDATORY USER WARNING BANNER */}
                <View style={styles.mandatoryWarningBanner}>
                  <View style={styles.warningTitleRow}>
                    <Ionicons name="warning" size={18} color="#b45309" />
                    <Text style={styles.warningTitleText}>Important Pickup Range Notice</Text>
                  </View>
                  <Text style={styles.warningBodyText}>
                    ⚠️ Pickup range rider ke route se 1-2 km range me hona chahiye. Agar pickup route se dur hoga to rider aapse extra detour charge le sakta hai ya request reject kar sakta hai.
                  </Text>
                </View>

                {/* Total Fare Breakdown */}
                <View style={styles.fareBreakdownBox}>
                  <Text style={styles.fareBreakdownLabel}>Total Payable Fare:</Text>
                  <Text style={styles.fareBreakdownValue}>
                    ₹{bookSeatsCount * selectedRideForBooking.price_per_seat}
                  </Text>
                </View>

                {/* Submit Booking Button */}
                <TouchableOpacity
                  style={styles.confirmBookingBtn}
                  onPress={handleConfirmBooking}
                  disabled={bookingInProgress}
                  activeOpacity={0.85}
                >
                  {bookingInProgress ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmBookingBtnText}>
                      Confirm & Reserve Seat (₹{bookSeatsCount * selectedRideForBooking.price_per_seat})
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 5. MODAL: POST A NEW RIDE */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Post Your Ride</Text>
                <Text style={styles.modalSubtitle}>Share seats & earn at your custom fare</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {/* Category Selector */}
              <Text style={styles.fieldLabel}>CHOOSE CATEGORY</Text>
              <View style={styles.categorySelectRow}>
                {(['UNIVERSITY', 'CITY', 'LOCAL'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catSelectChip, postCategory === cat && styles.catSelectChipActive]}
                    onPress={() => {
                      setPostCategory(cat);
                    }}
                  >
                    <Text style={[styles.catSelectChipText, postCategory === cat && styles.catSelectChipTextActive]}>
                      {cat === 'UNIVERSITY' ? '🎓 Uni/College' : cat === 'CITY' ? '🏙️ City' : '📍 Local'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* University Specific Fields */}
              {postCategory === 'UNIVERSITY' && (
                <View style={styles.universityFieldsBox}>
                  <Text style={styles.fieldLabel}>UNIVERSITY FULL NAME</Text>
                  <TextInput
                    style={styles.inputField}
                    value={universityFullName}
                    onChangeText={setUniversityFullName}
                    placeholder="Enter University or College name"
                  />

                  <Text style={styles.fieldLabel}>SHORT NAME / ACRONYM</Text>
                  <TextInput
                    style={styles.inputField}
                    value={universityShortName}
                    onChangeText={setUniversityShortName}
                    placeholder="e.g. PU, DU, IIT"
                    autoCapitalize="characters"
                  />
                  <Text style={styles.helperText}>
                    💡 Travelers can search using either full name or short acronym.
                  </Text>
                </View>
              )}

              {/* Poster Gender */}
              <Text style={styles.fieldLabel}>YOUR GENDER (SHOWN TO PASSENGERS)</Text>
              <View style={styles.genderSelectRow}>
                <TouchableOpacity
                  style={[styles.genderChip, posterGender === 'MALE' && styles.genderChipActiveBlue]}
                  onPress={() => setPosterGender('MALE')}
                >
                  <Ionicons name="male" size={15} color={posterGender === 'MALE' ? '#0284c7' : '#64748b'} />
                  <Text style={[styles.genderChipText, posterGender === 'MALE' && styles.genderChipTextActiveBlue]}>
                    👦 Boy (Male)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.genderChip, posterGender === 'FEMALE' && styles.genderChipActivePink]}
                  onPress={() => setPosterGender('FEMALE')}
                >
                  <Ionicons name="female" size={15} color={posterGender === 'FEMALE' ? '#db2777' : '#64748b'} />
                  <Text style={[styles.genderChipText, posterGender === 'FEMALE' && styles.genderChipTextActivePink]}>
                    👧 Girl (Female)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Vehicle Type Row */}
              <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
              <View style={styles.vehTypesGrid}>
                {[
                  { id: 'bike', label: 'Bike', icon: 'bicycle' },
                  { id: 'bullet_ktm', label: 'Bullet / KTM', icon: 'speedometer' },
                  { id: 'scooter', label: 'Scooter', icon: 'bicycle' },
                  { id: 'car', label: 'Car', icon: 'car-sport' },
                  { id: 'auto', label: 'Auto', icon: 'car' },
                  { id: 'bus', label: 'Bus / Van', icon: 'bus' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.vehGridChip, vehicleType === item.id && styles.vehGridChipActive]}
                    onPress={() => {
                      setVehicleType(item.id as any);
                      if (item.id === 'bike' || item.id === 'bullet_ktm' || item.id === 'scooter') {
                        setTotalSeats('1');
                      } else if (item.id === 'auto') {
                        setTotalSeats('2');
                      } else if (item.id === 'car') {
                        setTotalSeats('3');
                      } else {
                        setTotalSeats('6');
                      }
                    }}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={15}
                      color={vehicleType === item.id ? '#ffffff' : '#475569'}
                    />
                    <Text style={[styles.vehGridChipText, vehicleType === item.id && styles.vehGridChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Vehicle Model & Details */}
              <Text style={styles.fieldLabel}>VEHICLE MODEL / BRAND</Text>
              <TextInput
                style={styles.inputField}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="e.g. Make / Model / Vehicle details"
              />

              {/* From / Origin */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>STARTING LOCATION (PICKUP)</Text>
                <TouchableOpacity
                  style={styles.modalGpsFetchBtn}
                  onPress={fetchPostGps}
                  disabled={fetchingPostLocation}
                  activeOpacity={0.7}
                >
                  {fetchingPostLocation ? (
                    <ActivityIndicator size="small" color="#0284c7" />
                  ) : (
                    <>
                      <Ionicons name="navigate-circle" size={13} color="#0284c7" />
                      <Text style={styles.modalGpsFetchBtnText}>
                        {postOriginLat ? '📍 GPS Attached' : '📍 Use My Live GPS'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              {postOriginLat != null && postOriginLng != null && (
                <View style={styles.modalGpsActiveNotice}>
                  <Ionicons name="checkmark-circle" size={12} color="#059669" />
                  <Text style={styles.modalGpsActiveNoticeText}>
                    Exact GPS auto-pinned: {postOriginLat.toFixed(4)}, {postOriginLng.toFixed(4)} (nearby riders will see your post)
                  </Text>
                </View>
              )}
              <TextInput
                style={styles.inputField}
                value={originAddress}
                onChangeText={setOriginAddress}
                placeholder="Enter pickup address or landmark"
              />

              {/* To / Destination */}
              <Text style={styles.fieldLabel}>DESTINATION (DROP)</Text>
              <TextInput
                style={styles.inputField}
                value={destAddress}
                onChangeText={setDestAddress}
                placeholder="Enter destination address"
              />

              {/* Departure Time */}
              <Text style={styles.fieldLabel}>DEPARTURE TIME</Text>
              <TextInput
                style={styles.inputField}
                value={departureTime}
                onChangeText={setDepartureTime}
                placeholder="e.g. Today, 5:30 PM or 08:30 AM"
              />

              {/* Seats and Custom Price Row */}
              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>EMPTY SEATS</Text>
                  <TextInput
                    style={styles.inputField}
                    value={totalSeats}
                    onChangeText={setTotalSeats}
                    keyboardType="number-pad"
                    placeholder="1 to 4"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>PRICE PER SEAT (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={pricePerSeat}
                    onChangeText={setPricePerSeat}
                    keyboardType="number-pad"
                    placeholder="e.g. 50"
                  />
                </View>
              </View>

              {/* Notes */}
              <Text style={styles.fieldLabel}>NOTES FOR TRAVELERS (OPTIONAL)</Text>
              <TextInput
                style={[styles.inputField, { height: 55, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Optional notes (e.g. helmets provided, AC ride, etc.)"
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handlePostRide}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Post Ride & Start Sharing</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 6. MODAL: EDIT / MODIFY POSTED RIDE */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Modify Ride Details ✏️</Text>
                <Text style={styles.modalSubtitle}>Update timing, seats, price, or route</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              <Text style={styles.fieldLabel}>DEPARTURE TIME</Text>
              <TextInput
                style={styles.inputField}
                value={editDepartureTime}
                onChangeText={setEditDepartureTime}
                placeholder="e.g. 09:00 AM"
              />

              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>TOTAL SEATS</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editTotalSeats}
                    onChangeText={setEditTotalSeats}
                    keyboardType="number-pad"
                    placeholder="1 to 8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>PRICE PER SEAT (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editPricePerSeat}
                    onChangeText={setEditPricePerSeat}
                    keyboardType="number-pad"
                    placeholder="e.g. 40"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>PICKUP LOCATION</Text>
              <TextInput
                style={styles.inputField}
                value={editOriginAddress}
                onChangeText={setEditOriginAddress}
                placeholder="Pickup Address"
              />

              <Text style={styles.fieldLabel}>DESTINATION LOCATION</Text>
              <TextInput
                style={styles.inputField}
                value={editDestAddress}
                onChangeText={setEditDestAddress}
                placeholder="Destination Address"
              />

              <Text style={styles.fieldLabel}>NOTES FOR PASSENGERS</Text>
              <TextInput
                style={[styles.inputField, { height: 50, textAlignVertical: 'top' }]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                placeholder="Ride notes"
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveEditRide}
                disabled={editSubmitting}
                activeOpacity={0.85}
              >
                {editSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Ride Modifications</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 7. MODAL: VEHICLE & DRIVING LICENSE REGISTRATION (Mandatory for first-time posters) */}
      <Modal visible={showVehicleRegModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Host Vehicle Registration 🛡️</Text>
                <Text style={styles.modalSubtitle}>Driving License & Vehicle verification required</Text>
              </View>
              <TouchableOpacity onPress={() => setShowVehicleRegModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {/* Prominent Legal & Safety Warning */}
              <View style={styles.legalWarningBox}>
                <View style={styles.warningTitleRow}>
                  <Ionicons name="shield-checkmark" size={18} color="#b91c1c" />
                  <Text style={styles.legalWarningTitle}>Strict Verification & Safety Warning</Text>
                </View>
                <Text style={styles.legalWarningText}>
                  ⚠️ Providing a fake driving license or vehicle plate number is strictly illegal. Admin actively verifies vehicle details. Falsified details will result in immediate permanent blocking.
                  {'\n\n'}
                  • Unverified hosts can post 1 ride per day.
                  {'\n'}
                  • Verified hosts (after Admin review) can post multiple rides per day.
                </Text>
              </View>

              {/* Driving License Number */}
              <Text style={styles.fieldLabel}>DRIVING LICENSE NUMBER *</Text>
              <TextInput
                style={styles.inputField}
                value={regLicenseNumber}
                onChangeText={setRegLicenseNumber}
                placeholder="e.g. DL-0420110012345"
                autoCapitalize="characters"
              />

              {/* Vehicle Registration Plate Number */}
              <Text style={styles.fieldLabel}>VEHICLE PLATE NUMBER *</Text>
              <TextInput
                style={styles.inputField}
                value={regVehiclePlate}
                onChangeText={setRegVehiclePlate}
                placeholder="e.g. GJ-06-AB-1234"
                autoCapitalize="characters"
              />

              {/* Vehicle Category & Tier */}
              <Text style={styles.fieldLabel}>VEHICLE CATEGORY & TIER</Text>
              <View style={styles.regTypeGrid}>
                {[
                  { id: 'GENERAL_BIKE', label: 'General Bike', desc: 'Standard 100cc-125cc (₹7/km)' },
                  { id: 'PRO_BIKE', label: 'Pro Bike', desc: 'Cruiser / Sport 150cc+ (₹13/km)' },
                  { id: 'CAR', label: 'Car / Cab', desc: 'Hatchback, Sedan, SUV' },
                  { id: 'AUTO', label: 'Auto Rickshaw', desc: 'Standard 3-Wheeler' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.regTypeChip,
                      regVehicleType === item.id && styles.regTypeChipActive,
                    ]}
                    onPress={() => {
                      setRegVehicleType(item.id as any);
                    }}
                  >
                    <Text
                      style={[
                        styles.regTypeChipTitle,
                        regVehicleType === item.id && styles.regTypeChipTitleActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.regTypeChipSub,
                        regVehicleType === item.id && styles.regTypeChipSubActive,
                      ]}
                    >
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Vehicle Model */}
              <Text style={styles.fieldLabel}>VEHICLE MODEL / MAKE</Text>
              <TextInput
                style={styles.inputField}
                value={regVehicleModel}
                onChangeText={setRegVehicleModel}
                placeholder="e.g. Make / Model / Vehicle details"
              />

              <TouchableOpacity
                style={styles.saveVehicleBtn}
                onPress={handleSaveVehicleAndProceed}
                disabled={registeringVehicle}
                activeOpacity={0.85}
              >
                {registeringVehicle ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveVehicleBtnText}>
                    Verify & Proceed to Post Ride 🚀
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Search Modal for Choosing Search Location */}
      <LocationSearchModal
        visible={showLocationModal}
        title="Choose Search Location"
        onClose={() => setShowLocationModal(false)}
        onSelect={(loc) => {
          setUserLocation({ lat: loc.latitude, lng: loc.longitude });
          const parts = loc.address.split(',').map((p) => p.trim()).filter(Boolean);
          const formatted = parts.length > 2 ? `${parts[0]}, ${parts[1]}` : loc.address;
          setUserLocationAddress(formatted);
          setShowLocationModal(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  postRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    flexShrink: 0,
    alignSelf: 'center',
  },
  postRideBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  // View Mode Switcher
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
  },
  viewModeBtnActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  viewModeBtnTextActive: {
    color: '#ffffff',
  },
  badgeCountPill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 3,
  },
  badgeCountText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  // Category Switcher Tabs
  categoryTabsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  categoryTab: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  categoryTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  categoryTabTextActive: {
    color: '#ffffff',
  },
  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginBottom: 8,
    gap: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    padding: 0,
    outlineStyle: 'none' as any,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  // Filter Controls
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  miniChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  miniChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  miniChipActiveBlue: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
  },
  miniChipActivePink: {
    backgroundColor: '#fce7f3',
    borderColor: '#f472b6',
  },
  miniChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  miniChipTextActive: {
    color: '#ffffff',
  },
  miniChipTextActiveBlue: {
    color: '#0284c7',
  },
  miniChipTextActivePink: {
    color: '#db2777',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  sortToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
    marginTop: 10,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  ridesScroll: {
    flex: 1,
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  categoryTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    flex: 1,
  },
  tagUniversity: {
    backgroundColor: '#e0f2fe',
  },
  tagCity: {
    backgroundColor: '#ecfdf5',
  },
  categoryTagPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagUniversityText: {
    color: '#0284c7',
  },
  tagCityText: {
    color: '#059669',
  },
  genderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  genderBadgeMale: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  genderBadgeFemale: {
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  genderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  genderBadgeTextMale: {
    color: '#0284c7',
  },
  genderBadgeTextFemale: {
    color: '#db2777',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  creatorPhone: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  priceSub: {
    fontSize: 9,
    color: '#64748b',
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  routePoints: {
    alignItems: 'center',
    width: 14,
    marginRight: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  routeDottedLine: {
    width: 1,
    height: 14,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  redSquare: {
    width: 6,
    height: 6,
    backgroundColor: '#ef4444',
  },
  routeLabels: {
    flex: 1,
    gap: 4,
  },
  originText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  destText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  badgeItemTime: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeSeats: {
    backgroundColor: '#fef3c7',
  },
  badgeFull: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600',
  },
  notesText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 6,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 3,
  },
  previewBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  ownerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewMyBookingsMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 4,
  },
  viewMyBookingsMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  cancelMyRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 3,
  },
  cancelMyRideText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  bookedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  bookedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  cancelBookedBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cancelBookedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    gap: 4,
  },
  joinBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  joinBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },

  // 3. CAMPUS & CITY BOOKINGS STYLES
  bookingsScroll: {
    flex: 1,
  },
  managementSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  managementSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySubBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  hostRideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  hostHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  hostRouteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  hostMetaText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  inventoryStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillOpen: {
    backgroundColor: '#ecfdf5',
  },
  pillSoldOut: {
    backgroundColor: '#fee2e2',
  },
  inventoryStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textOpen: {
    color: '#059669',
  },
  textSoldOut: {
    color: '#dc2626',
  },
  passengersContainer: {
    marginTop: 8,
  },
  passengersSectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  noPassengersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  noPassengersText: {
    flex: 1,
    fontSize: 10,
    color: '#64748b',
    lineHeight: 15,
  },
  passengerDetailCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  passengerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passengerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  passengerNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  passengerSeatsTag: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  callPassengerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  callPassengerBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  pickupLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 6,
    marginTop: 6,
    gap: 5,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pickupLocationText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '600',
    flex: 1,
  },
  detourNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
    gap: 4,
  },
  detourNoticeText: {
    fontSize: 10,
    color: '#b45309',
    fontWeight: '600',
    flex: 1,
  },
  passengerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bookingStatusBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bookingStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284c7',
  },
  cancelPassengerBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cancelPassengerBtnText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
  },
  hostCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  deletePostedRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deletePostedRideText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
  },
  editPostedRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
  },
  editPostedRideText: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '700',
  },

  // Booked Reservation (Passenger View)
  bookedReservationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  bookedReservationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookedHostName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  bookedRouteText: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
  },
  bookedMetaText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  callHostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  callHostBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  bookedPickupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
  bookedPickupText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  bookedActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  bookingConfirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bookingConfirmedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  cancelMyBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cancelMyBookingBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },

  // 4. BOOKING CONFIRMATION MODAL STYLES
  bookingRidePreviewCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    padding: 10,
    marginBottom: 12,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  previewHostText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  previewFareText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  previewRouteText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '600',
    marginBottom: 3,
  },
  previewTimeText: {
    fontSize: 10,
    color: '#64748b',
  },
  seatCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  seatCounterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  seatCounterBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  seatCounterValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    minWidth: 20,
    textAlign: 'center',
  },
  seatAvailableHint: {
    fontSize: 11,
    color: '#64748b',
  },

  // ⚠️ MANDATORY WARNING BANNER
  mandatoryWarningBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  warningTitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  warningBodyText: {
    fontSize: 11,
    color: '#78350f',
    lineHeight: 16,
    fontWeight: '600',
  },

  fareBreakdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  fareBreakdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  fareBreakdownValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  confirmBookingBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBookingBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Common Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  modalClose: {
    padding: 4,
  },
  formScroll: {
    paddingBottom: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
  },
  inputField: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    outlineStyle: 'none' as any,
  },
  categorySelectRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  catSelectChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catSelectChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  catSelectChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catSelectChipTextActive: {
    color: '#ffffff',
  },
  universityFieldsBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  genderChipActiveBlue: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
  },
  genderChipActivePink: {
    backgroundColor: '#fce7f3',
    borderColor: '#f472b6',
  },
  genderChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  genderChipTextActiveBlue: {
    color: '#0284c7',
  },
  genderChipTextActivePink: {
    color: '#db2777',
  },
  vehTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  vehGridChip: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  vehGridChipActive: {
    backgroundColor: '#0284c7',
  },
  vehGridChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  vehGridChipTextActive: {
    color: '#ffffff',
  },
  twoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  submitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 18,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  // Time Range Filter Row
  timeRangeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 10,
  },
  timeRangeChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  timeRangeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  timeRangeChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  timeRangeChipTextActive: {
    color: '#ffffff',
  },
  // Finish Posted Ride Button
  finishPostedRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    marginRight: 6,
  },
  finishPostedRideText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  // Legal & Verification Warning Box
  legalWarningBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  legalWarningTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991b1b',
  },
  legalWarningText: {
    fontSize: 10,
    color: '#7f1d1d',
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '500',
  },
  // Vehicle Registration Type Grid
  regTypeGrid: {
    gap: 6,
    marginVertical: 4,
  },
  regTypeChip: {
    padding: 9,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  regTypeChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  regTypeChipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  regTypeChipTitleActive: {
    color: '#0369a1',
  },
  regTypeChipSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  regTypeChipSubActive: {
    color: '#0284c7',
    fontWeight: '600',
  },
  saveVehicleBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  saveVehicleBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  // Proximity & Nearest Rides styles
  proximityStatusBar: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  proximityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  proximityTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  proximityPinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximityPinCircleActive: {
    backgroundColor: '#e0f2fe',
  },
  proximityStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  proximityStatusSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  liveGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveGpsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  proximityActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  changeLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  refreshLocBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshLocBtnActive: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe',
  },
  refreshLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  refreshLocBtnTextActive: {
    color: '#0284c7',
  },
  rangeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0f2fe',
    gap: 8,
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  rangeChipsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  rangeChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  rangeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  rangeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  rangeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cardProximityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cardProximityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  modalGpsFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  modalGpsFetchBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  modalGpsActiveNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  modalGpsActiveNoticeText: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '600',
  },
});
