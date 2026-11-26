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
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../services/api';
import { CommunityRide, VehicleCategory, MyReservationItem } from '../types';
import { CommunityRidesPanel } from './CommunityRidesPanel';

interface ServicesTabProps {
  onSelectRoutePreview?: (originLat: number, originLng: number, destLat: number, destLng: number) => void;
  onSelectVehicle?: (category: VehicleCategory) => void;
  onBack?: () => void;
}

interface FareConfigItem {
  id?: string;
  vehicle_category: VehicleCategory;
  per_km_rate: number;
  base_fare: number;
  min_fare: number;
  surge_multiplier?: number;
  is_active: boolean;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({
  onSelectRoutePreview,
  onSelectVehicle,
  onBack,
}) => {
  // Services & Vehicle Rates from Real Backend
  const [fareConfigs, setFareConfigs] = useState<FareConfigItem[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Community Carpool Rides State
  const [rides, setRides] = useState<CommunityRide[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // My Reservations State
  const [myReservations, setMyReservations] = useState<MyReservationItem[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [showMyReservations, setShowMyReservations] = useState(false);

  // Active section toggle: 'all' | 'vehicles' | 'carpool'
  const [activeSection, setActiveSection] = useState<'all' | 'vehicles' | 'carpool'>('all');

  // Form states for posting a community ride
  const [postCategory, setPostCategory] = useState<'UNIVERSITY' | 'CITY' | 'LOCAL'>('UNIVERSITY');
  const [universityFullName, setUniversityFullName] = useState('');
  const [universityShortName, setUniversityShortName] = useState('');
  const [posterGender, setPosterGender] = useState<'MALE' | 'FEMALE'>('MALE');

  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [rideTimeType, setRideTimeType] = useState<'day' | 'night'>('day');
  const [departureTime, setDepartureTime] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'bike' | 'auto'>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [totalSeats, setTotalSeats] = useState('1');
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch real fare configurations from backend
  const loadFareConfigs = async () => {
    setLoadingConfigs(true);
    setConfigError(null);
    try {
      const data = await api.fare.getConfigs();
      if (Array.isArray(data) && data.length > 0) {
        setFareConfigs(data);
      } else {
        // Fallback to real defaults defined on backend
        setFareConfigs([
          { vehicle_category: 'bike', per_km_rate: 7, base_fare: 0, min_fare: 25, is_active: true },
          { vehicle_category: 'auto', per_km_rate: 10, base_fare: 0, min_fare: 30, is_active: true },
          { vehicle_category: 'car', per_km_rate: 15, base_fare: 0, min_fare: 50, is_active: true },
        ]);
      }
    } catch (e: any) {
      console.warn('Could not fetch fare configs:', e);
      setConfigError('Unable to load live fare rates. Showing baseline values.');
      setFareConfigs([
        { vehicle_category: 'bike', per_km_rate: 7, base_fare: 0, min_fare: 25, is_active: true },
        { vehicle_category: 'auto', per_km_rate: 10, base_fare: 0, min_fare: 30, is_active: true },
        { vehicle_category: 'car', per_km_rate: 15, base_fare: 0, min_fare: 50, is_active: true },
      ]);
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Fetch community rides from backend
  const loadRides = async () => {
    setLoadingRides(true);
    try {
      const data = await api.communityRides.list(searchQuery);
      setRides(data || []);
    } catch (err: any) {
      console.error('Error fetching community rides:', err);
    } finally {
      setLoadingRides(false);
    }
  };

  useEffect(() => {
    loadFareConfigs();
    loadReservations();
  }, []);

  useEffect(() => {
    loadRides();
  }, [searchQuery]);

  const handlePostRide = async () => {
    if (!originAddress || !destAddress || !pricePerSeat) {
      Alert.alert('Incomplete Details', 'Please fill in From, To, and Price per seat.');
      return;
    }

    if (postCategory === 'UNIVERSITY' && !universityFullName.trim()) {
      Alert.alert('University Required', 'Please enter University / College Name.');
      return;
    }

    setSubmitting(true);
    try {
      await api.communityRides.create({
        pickup_address: originAddress,
        destination_address: destAddress,
        departure_time: departureTime,
        total_seats: parseInt(totalSeats, 10) || 1,
        price_per_seat: parseFloat(pricePerSeat) || 50,
        vehicle_info: vehicleModel
          ? `${vehicleModel} (${vehicleType.toUpperCase()})`
          : vehicleType.toUpperCase(),
        vehicle_type: vehicleType,
        category_type: postCategory,
        university_name: postCategory === 'UNIVERSITY' ? universityFullName.trim() : undefined,
        university_short_name: postCategory === 'UNIVERSITY' ? universityShortName.trim().toUpperCase() : undefined,
        poster_gender: posterGender,
        notes,
      });

      Alert.alert(
        'Ride Shared Successfully! 🎉',
        'Your ride is now visible to all students & commuters in this section.'
      );
      setShowAddModal(false);
      loadRides();
    } catch (err: any) {
      Alert.alert('Failed to Post Ride', err.message || 'Error creating community ride');
    } finally {
      setSubmitting(false);
    }
  };

  // Load passenger reservations
  const loadReservations = async () => {
    setLoadingReservations(true);
    try {
      const data = await api.communityRides.getMyBookings();
      setMyReservations(data || []);
    } catch (err: any) {
      console.warn('Could not fetch reservations:', err);
    } finally {
      setLoadingReservations(false);
    }
  };

  const handleJoinRide = async (ride: CommunityRide) => {
    const gross = Math.round(ride.price_per_seat);
    const fee = Math.round(gross * ((ride.platform_fee_percent || 15) / 100));
    const driverEarnings = gross - fee;

    Alert.alert(
      'Confirm Carpool Seat',
      `Route: ${ride.pickup_address} -> ${ride.destination_address}\nTotal Fare: ₹${gross}\n(Driver: ₹${driverEarnings} | Platform Fee: ₹${fee})\n\nReserve 1 seat now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Reserve',
          onPress: async () => {
            try {
              const res = await api.communityRides.reserve(ride.id, 1);
              Alert.alert(
                'Seat Confirmed! 🚗',
                `You have reserved a seat with ${res.host_name}.\nTotal Fare: ₹${res.total_fare}\nDeparture: ${res.departure_time}`
              );
              loadRides();
              loadReservations();
            } catch (err: any) {
              Alert.alert('Cannot Reserve Seat', err.message || 'Error reserving seat');
            }
          },
        },
      ]
    );
  };

  const handleCancelReservation = async (bookingId: string) => {
    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel your seat reservation? Your seat will be restored to the pool.',
      [
        { text: 'Keep Reservation', style: 'cancel' },
        {
          text: 'Yes, Cancel Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.communityRides.cancelReservation(bookingId, 'Passenger cancelled');
              Alert.alert('Cancelled', 'Your seat reservation was cancelled and released.');
              loadRides();
              loadReservations();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not cancel reservation');
            }
          },
        },
      ]
    );
  };

  const handleCallHost = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert(`Call ${name}`, `Direct Phone: ${cleanPhone}`);
        }
      })
      .catch(() => {
        Alert.alert(`Call ${name}`, `Direct Phone: ${cleanPhone}`);
      });
  };

  // Helper to get rate from backend config
  const getRateForCategory = (cat: VehicleCategory): { rate: number; minFare: number } => {
    const conf = fareConfigs.find((c) => c.vehicle_category === cat);
    if (conf) {
      return { rate: conf.per_km_rate, minFare: conf.min_fare };
    }
    if (cat === 'bike') return { rate: 7, minFare: 25 };
    if (cat === 'auto') return { rate: 10, minFare: 30 };
    return { rate: 15, minFare: 50 };
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Back Navigation Row */}
        {onBack && (
          <TouchableOpacity style={styles.topBackBtn} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
            <Text style={styles.topBackBtnText}>Back to Home</Text>
          </TouchableOpacity>
        )}

        {/* Header Banner */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.mainTitle}>Special Drive & Carpool (स्पेशल ड्राइव)</Text>
            <Text style={styles.subtitle}>
              Intercity, special drives, long journeys & shared community rides
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              loadFareConfigs();
              loadRides();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Section Filter Tabs */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, activeSection === 'all' && styles.filterTabActive]}
            onPress={() => setActiveSection('all')}
          >
            <Text style={[styles.filterTabText, activeSection === 'all' && styles.filterTabTextActive]}>
              All Drives
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeSection === 'vehicles' && styles.filterTabActive]}
            onPress={() => setActiveSection('vehicles')}
          >
            <Text style={[styles.filterTabText, activeSection === 'vehicles' && styles.filterTabTextActive]}>
              Cab Rates
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeSection === 'carpool' && styles.filterTabActive]}
            onPress={() => setActiveSection('carpool')}
          >
            <Text style={[styles.filterTabText, activeSection === 'carpool' && styles.filterTabTextActive]}>
              Special Drives ({rides.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TOP QUICK ACTION BANNER: BOOK OR POST RIDE */}
        <View style={styles.topActionBanner}>
          <View style={styles.topActionTextContainer}>
            <View style={styles.topActionTitleRow}>
              <Ionicons name="flash" size={17} color="#0284c7" />
              <Text style={styles.topActionHeading}>Book or Post a Ride</Text>
            </View>
            <Text style={styles.topActionSubheading}>
              Book instant rides below or add empty seats (University, City, Local) at custom fare!
            </Text>
          </View>
          <TouchableOpacity
            style={styles.topAddRideBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={16} color="#ffffff" />
            <Text style={styles.topAddRideBtnText}>+ Add Ride</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 1: OPERATIONAL VEHICLE CATEGORIES */}
        {(activeSection === 'all' || activeSection === 'vehicles') && (
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                <Text style={styles.sectionTitle}>OPERATIONAL VEHICLES & LIVE RATES</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.greenPulse} />
                <Text style={styles.liveBadgeText}>BACKEND ENGINE ACTIVE</Text>
              </View>
            </View>

            {loadingConfigs ? (
              <View style={styles.configsLoading}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={styles.configsLoadingText}>Loading verified pricing from backend...</Text>
              </View>
            ) : (
              <View style={styles.operationalCardsGrid}>
                {/* 1. BIKE TAXI */}
                <View style={styles.serviceCard}>
                  <View style={styles.serviceCardHeader}>
                    <View style={[styles.serviceIconCircle, { backgroundColor: '#dcfce7' }]}>
                      <Image source={require('../../assets/vehicles/bike.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    </View>
                    <View style={styles.serviceMeta}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={styles.serviceTitle}>Indi Bike</Text>
                        <View style={styles.statusPillOperational}>
                          <Text style={styles.statusPillOperationalText}>OPERATIONAL</Text>
                        </View>
                      </View>
                      <Text style={styles.serviceDesc}>Fastest for solo city commutes & traffic dodging</Text>
                    </View>
                  </View>

                  <View style={styles.servicePricingRow}>
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>RATE PER KM</Text>
                      <Text style={styles.pricePointValue}>₹{getRateForCategory('bike').rate}/km</Text>
                    </View>
                    <View style={styles.priceDivider} />
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>MIN FARE</Text>
                      <Text style={styles.pricePointValue}>₹{getRateForCategory('bike').minFare}</Text>
                    </View>
                    <View style={styles.priceDivider} />
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>CAPACITY</Text>
                      <Text style={styles.pricePointValue}>1 Seat</Text>
                    </View>
                  </View>

                  <View style={styles.cardBtnRow}>
                    {onSelectVehicle && (
                      <TouchableOpacity
                        style={[styles.selectVehicleBtn, { flex: 1 }]}
                        onPress={() => onSelectVehicle('bike')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.selectVehicleBtnText}>Book Bike ➔</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.addVehicleRideBtn}
                      onPress={() => {
                        setVehicleType('bike');
                        setTotalSeats('1');
                        setVehicleModel('');
                        setPricePerSeat('');
                        setShowAddModal(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#0284c7" />
                      <Text style={styles.addVehicleRideBtnText}>+ Add Ride</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. AUTO RICKSHAW */}
                <View style={styles.serviceCard}>
                  <View style={styles.serviceCardHeader}>
                    <View style={[styles.serviceIconCircle, { backgroundColor: '#fef3c7' }]}>
                      <Image source={require('../../assets/vehicles/auto.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    </View>
                    <View style={styles.serviceMeta}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={styles.serviceTitle}>Indi Auto</Text>
                        <View style={styles.statusPillOperational}>
                          <Text style={styles.statusPillOperationalText}>OPERATIONAL</Text>
                        </View>
                      </View>
                      <Text style={styles.serviceDesc}>Affordable metered city travel for up to 3 people</Text>
                    </View>
                  </View>

                  <View style={styles.servicePricingRow}>
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>RATE PER KM</Text>
                      <Text style={styles.pricePointValue}>₹{getRateForCategory('auto').rate}/km</Text>
                    </View>
                    <View style={styles.priceDivider} />
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>MIN FARE</Text>
                      <Text style={styles.pricePointValue}>₹{getRateForCategory('auto').minFare}</Text>
                    </View>
                    <View style={styles.priceDivider} />
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>CAPACITY</Text>
                      <Text style={styles.pricePointValue}>3 Seats</Text>
                    </View>
                  </View>

                  <View style={styles.cardBtnRow}>
                    {onSelectVehicle && (
                      <TouchableOpacity
                        style={[styles.selectVehicleBtn, { flex: 1 }]}
                        onPress={() => onSelectVehicle('auto')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.selectVehicleBtnText}>Book Auto ➔</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.addVehicleRideBtn}
                      onPress={() => {
                        setVehicleType('auto');
                        setTotalSeats('2');
                        setVehicleModel('');
                        setPricePerSeat('');
                        setShowAddModal(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#0284c7" />
                      <Text style={styles.addVehicleRideBtnText}>+ Add Ride</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3. ECONOMY CAB / CAR */}
                <View style={styles.serviceCard}>
                  <View style={styles.serviceCardHeader}>
                    <View style={[styles.serviceIconCircle, { backgroundColor: '#e0f2fe' }]}>
                      <Image source={require('../../assets/vehicles/car.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                    </View>
                    <View style={styles.serviceMeta}>
                      <View style={styles.serviceTitleRow}>
                        <Text style={styles.serviceTitle}>Indi Cab (Car)</Text>
                        <View style={styles.statusPillOperational}>
                          <Text style={styles.statusPillOperationalText}>OPERATIONAL</Text>
                        </View>
                      </View>
                      <Text style={styles.serviceDesc}>Comfortable AC rides with boot space for up to 4 passengers</Text>
                    </View>
                  </View>

                  <View style={styles.servicePricingRow}>
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>RATE PER KM</Text>
                      <Text style={styles.pricePointValue}>₹{getRateForCategory('car').rate}/km</Text>
                    </View>
                    <View style={styles.priceDivider} />
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>MIN FARE</Text>
                      <Text style={styles.pricePointValue}>₹{getRateForCategory('car').minFare}</Text>
                    </View>
                    <View style={styles.priceDivider} />
                    <View style={styles.pricePoint}>
                      <Text style={styles.pricePointLabel}>CAPACITY</Text>
                      <Text style={styles.pricePointValue}>4 Seats</Text>
                    </View>
                  </View>

                  <View style={styles.cardBtnRow}>
                    {onSelectVehicle && (
                      <TouchableOpacity
                        style={[styles.selectVehicleBtn, { flex: 1 }]}
                        onPress={() => onSelectVehicle('car')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.selectVehicleBtnText}>Book Car ➔</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.addVehicleRideBtn}
                      onPress={() => {
                        setVehicleType('car');
                        setTotalSeats('3');
                        setVehicleModel('');
                        setPricePerSeat('');
                        setShowAddModal(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#0284c7" />
                      <Text style={styles.addVehicleRideBtnText}>+ Add Ride</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* SECTION 2: NON-OPERATIONAL SERVICES DISCLOSURE */}
        {(activeSection === 'all' || activeSection === 'vehicles') && (
          <View style={styles.sectionWrapper}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="information-circle" size={16} color="#64748b" />
                <Text style={styles.sectionTitle}>UNAVAILABLE & NON-OPERATIONAL SERVICES</Text>
              </View>
            </View>

            <View style={styles.noticeBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#64748b" />
              <Text style={styles.noticeText}>
                We do not advertise unavailable services as operational. The following services are currently NOT active for direct booking in this zone:
              </Text>
            </View>

            <View style={styles.unavailableCardsList}>
              {/* Package Delivery */}
              <View style={styles.unavailableCard}>
                <View style={styles.unavailableHeader}>
                  <View style={[styles.serviceIconCircle, { backgroundColor: '#f1f5f9' }]}>
                    <Ionicons name="cube-outline" size={20} color="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.serviceTitleRow}>
                      <Text style={styles.unavailableTitle}>Package & Courier Delivery</Text>
                      <View style={styles.statusPillUnavailable}>
                        <Text style={styles.statusPillUnavailableText}>NOT OPERATIONAL</Text>
                      </View>
                    </View>
                    <Text style={styles.unavailableDesc}>
                      On-demand courier delivery is currently in closed pilot testing. Direct bookings are disabled.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Hourly Rentals */}
              <View style={styles.unavailableCard}>
                <View style={styles.unavailableHeader}>
                  <View style={[styles.serviceIconCircle, { backgroundColor: '#f1f5f9' }]}>
                    <Ionicons name="time-outline" size={20} color="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.serviceTitleRow}>
                      <Text style={styles.unavailableTitle}>Hourly Chauffeur Rentals</Text>
                      <View style={styles.statusPillUnavailable}>
                        <Text style={styles.statusPillUnavailableText}>NOT OPERATIONAL</Text>
                      </View>
                    </View>
                    <Text style={styles.unavailableDesc}>
                      Multi-stop hourly vehicle packages are pending regional regulatory certification.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Intercity Outstation */}
              <View style={styles.unavailableCard}>
                <View style={styles.unavailableHeader}>
                  <View style={[styles.serviceIconCircle, { backgroundColor: '#f1f5f9' }]}>
                    <Ionicons name="trail-sign-outline" size={20} color="#64748b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.serviceTitleRow}>
                      <Text style={styles.unavailableTitle}>Intercity & Outstation</Text>
                      <View style={styles.statusPillUnavailable}>
                        <Text style={styles.statusPillUnavailableText}>NOT OPERATIONAL</Text>
                      </View>
                    </View>
                    <Text style={styles.unavailableDesc}>
                      Long-distance inter-city permits not yet active. Operational boundaries are restricted to municipal metro limits.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* SECTION 3: COMMUNITY & UNIVERSITY CARPOOL */}
        {(activeSection === 'all' || activeSection === 'carpool') && (
          <View style={[styles.sectionWrapper, { marginTop: 8 }]}>
            <CommunityRidesPanel onSelectRoutePreview={onSelectRoutePreview} />
          </View>
        )}
      </ScrollView>

      {/* Modal: Post / Set a New Community Ride */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Set Your Route & Share Ride</Text>
                <Text style={styles.modalSubtitle}>
                  Set timing (Day/Night), payment & seats for other users
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {/* Category Selector */}
              <Text style={styles.fieldLabel}>CHOOSE CATEGORY</Text>
              <View style={styles.catSelectRow}>
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
                <View style={styles.uniFieldsBox}>
                  <Text style={styles.fieldLabel}>UNIVERSITY FULL NAME</Text>
                  <TextInput
                    style={styles.inputField}
                    value={universityFullName}
                    onChangeText={setUniversityFullName}
                    placeholder="Enter University or College name"
                  />

                  <Text style={styles.fieldLabel}>SHORT CODE / ACRONYM</Text>
                  <TextInput
                    style={styles.inputField}
                    value={universityShortName}
                    onChangeText={setUniversityShortName}
                    placeholder="e.g. PU, DU, IIT"
                    autoCapitalize="characters"
                  />
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

              {/* Day or Night Switcher */}
              <Text style={styles.fieldLabel}>RIDE TIMING (DAY OR NIGHT)</Text>
              <View style={styles.timeTypeRow}>
                <TouchableOpacity
                  style={[styles.timeTypeChip, rideTimeType === 'day' && styles.timeTypeChipActive]}
                  onPress={() => {
                    setRideTimeType('day');
                  }}
                >
                  <Ionicons
                    name="sunny"
                    size={16}
                    color={rideTimeType === 'day' ? '#ffffff' : '#f59e0b'}
                  />
                  <Text style={[styles.timeTypeChipText, rideTimeType === 'day' && styles.timeTypeChipTextActive]}>
                    ☀️ Day Ride
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.timeTypeChip, rideTimeType === 'night' && styles.timeTypeChipNightActive]}
                  onPress={() => {
                    setRideTimeType('night');
                  }}
                >
                  <Ionicons
                    name="moon"
                    size={16}
                    color={rideTimeType === 'night' ? '#ffffff' : '#8b5cf6'}
                  />
                  <Text style={[styles.timeTypeChipText, rideTimeType === 'night' && styles.timeTypeChipTextActive]}>
                    🌙 Night Ride
                  </Text>
                </TouchableOpacity>
              </View>

              {/* From / Origin */}
              <Text style={styles.fieldLabel}>PICKUP LOCATION (FROM)</Text>
              <TextInput
                style={styles.inputField}
                value={originAddress}
                onChangeText={setOriginAddress}
                placeholder="Enter pickup address or landmark"
              />

              {/* To / Destination */}
              <Text style={styles.fieldLabel}>DESTINATION (TO)</Text>
              <TextInput
                style={styles.inputField}
                value={destAddress}
                onChangeText={setDestAddress}
                placeholder="Enter destination address"
              />

              {/* Departure Time String */}
              <Text style={styles.fieldLabel}>DEPARTURE TIME DETAILS</Text>
              <TextInput
                style={styles.inputField}
                value={departureTime}
                onChangeText={setDepartureTime}
                placeholder="e.g. Today, 5:30 PM"
              />

              {/* Vehicle Type Row */}
              <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
              <View style={styles.vehTypesRow}>
                {(['car', 'bike', 'auto'] as const).map((vt) => (
                  <TouchableOpacity
                    key={vt}
                    style={[styles.vehTypeChip, vehicleType === vt && styles.vehTypeChipActive]}
                    onPress={() => {
                      setVehicleType(vt);
                      if (vt === 'bike') {
                        setTotalSeats('1');
                      } else if (vt === 'auto') {
                        setTotalSeats('2');
                      } else {
                        setTotalSeats('3');
                      }
                    }}
                  >
                    <Ionicons
                      name={vt === 'bike' ? 'bicycle' : vt === 'auto' ? 'car-sport' : 'car'}
                      size={15}
                      color={vehicleType === vt ? '#ffffff' : '#475569'}
                    />
                    <Text style={[styles.vehTypeChipText, vehicleType === vt && styles.vehTypeChipTextActive]}>
                      {vt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Vehicle Model & Details */}
              <Text style={styles.fieldLabel}>VEHICLE MODEL / COLOR</Text>
              <TextInput
                style={styles.inputField}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="e.g. Make / Model / Vehicle details"
              />

              {/* Seats and Payment per Seat */}
              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>AVAILABLE SEATS</Text>
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
              <Text style={styles.fieldLabel}>PASSENGER NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.inputField, { height: 55, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Optional notes (e.g. AC ride, luggage space, etc.)"
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
                  <Text style={styles.submitBtnText}>Confirm & Publish Online</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  topBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterTabActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  sectionWrapper: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  configsLoading: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  configsLoadingText: {
    fontSize: 11,
    color: '#64748b',
  },
  operationalCardsGrid: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  serviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceMeta: {
    flex: 1,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  serviceDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  statusPillOperational: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillOperationalText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  servicePricingRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  pricePoint: {
    alignItems: 'center',
  },
  pricePointLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
  },
  pricePointValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  priceDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
  },
  selectVehicleBtn: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectVehicleBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  unavailableCardsList: {
    gap: 8,
  },
  unavailableCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    opacity: 0.85,
  },
  unavailableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unavailableTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  unavailableDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 14,
  },
  statusPillUnavailable: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillUnavailableText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#dc2626',
  },
  communityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  communitySub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  postRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
    flexShrink: 0,
    alignSelf: 'center',
  },
  postRideBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    padding: 0,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
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
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  emptyActionBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  ridesContainer: {
    gap: 10,
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  creatorPhone: {
    fontSize: 10,
    color: '#64748b',
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },
  priceSub: {
    fontSize: 8,
    color: '#64748b',
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  routePoints: {
    alignItems: 'center',
    width: 10,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  routeDottedLine: {
    width: 1,
    height: 12,
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
  },
  originText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  destText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeDay: {
    backgroundColor: '#fffbeb',
  },
  badgeNight: {
    backgroundColor: '#f5f3ff',
  },
  badgeSeats: {
    backgroundColor: '#fef3c7',
  },
  badgeFull: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  notesText: {
    fontSize: 10,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  previewBtnText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  callBtnText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '700',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  joinBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  modalClose: {
    padding: 4,
  },
  formScroll: {
    paddingBottom: 20,
  },
  quickPresetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    gap: 6,
  },
  quickPresetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  timeTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  timeTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  timeTypeChipActive: {
    backgroundColor: '#f59e0b',
  },
  timeTypeChipNightActive: {
    backgroundColor: '#8b5cf6',
  },
  timeTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  timeTypeChipTextActive: {
    color: '#ffffff',
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  vehTypesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vehTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  vehTypeChipActive: {
    backgroundColor: '#0284c7',
  },
  vehTypeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  vehTypeChipTextActive: {
    color: '#ffffff',
  },
  twoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  submitBtn: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  myReservationsSection: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  myResHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  myResSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  myResCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  myResTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  myResRoute: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  myResHost: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  myResBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myResBadgeCancelled: {
    backgroundColor: '#fee2e2',
  },
  myResBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  myResBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  myResFare: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  cancelResBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cancelResBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  topActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  topActionTextContainer: {
    flex: 1,
  },
  topActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topActionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369a1',
  },
  topActionSubheading: {
    fontSize: 11,
    color: '#0284c7',
    marginTop: 2,
    lineHeight: 15,
  },
  topAddRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
    flexShrink: 0,
  },
  topAddRideBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  cardBtnRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addVehicleRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  addVehicleRideBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  catSelectRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  catSelectChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
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
  uniFieldsBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  genderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
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
});
