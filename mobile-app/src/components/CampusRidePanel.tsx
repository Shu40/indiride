import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import {
  CampusRideItem,
  University,
  Campus,
} from '../types';

// Modular Child Components
import { SevenDayStrip, DayOption } from './campus/SevenDayStrip';
import { CampusRideCard } from './campus/CampusRideCard';
import { CampusBookingModal } from './campus/CampusBookingModal';
import { CampusScheduleRideView } from './campus/CampusScheduleRideView';
import { CampusMyBookingsView } from './campus/CampusMyBookingsView';
import { CampusDatePickerModal } from './campus/CampusDatePickerModal';

interface Props {
  onBack?: () => void;
  onClose?: () => void;
  onSelectRoutePreview?: (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ) => void;
}

type PassengerCampusTab = 'search' | 'schedule' | 'bookings' | 'alerts';

export const CampusRidePanel: React.FC<Props> = ({ onBack, onClose }) => {
  // Navigation & Active Tab (Strictly 3 tabs for Passengers)
  const [activeTab, setActiveTab] = useState<PassengerCampusTab>('search');

  // University & Campus selection
  const [universities, setUniversities] = useState<University[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [showUniModal, setShowUniModal] = useState<boolean>(false);
  const [uniSearchText, setUniSearchText] = useState<string>('');

  // University Alert Watchlist
  const [watchedUniversity, setWatchedUniversity] = useState<string>('Parul University');
  const [uniAlerts, setUniAlerts] = useState<CampusRideItem[]>([]);
  const [showSetUniModal, setShowSetUniModal] = useState<boolean>(false);
  const [customUniInput, setCustomUniInput] = useState<string>('Parul University');

  // Search & Filter State
  const [selectedTravelDate, setSelectedTravelDate] = useState<string>('Today');
  const [travelDateLabel, setTravelDateLabel] = useState<string>('Today');
  const [showDatePickerModal, setShowDatePickerModal] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [pickupQuery, setPickupQuery] = useState<string>('');
  const [destQuery, setDestQuery] = useState<string>('');
  const [uniFilterQuery, setUniFilterQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'FEMALE_ONLY' | 'MALE_ONLY'>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<string>('All');

  // Live Rides Feed
  const [rides, setRides] = useState<CampusRideItem[]>([]);
  const [loadingRides, setLoadingRides] = useState<boolean>(false);

  // Booking Modal State
  const [bookingModalRide, setBookingModalRide] = useState<CampusRideItem | null>(null);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);

  // Bookings Data
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);

  // 1. Initial Load: Universities & Campuses
  useEffect(() => {
    const loadUniversities = async () => {
      try {
        const list = await api.campusRides.getUniversities();
        setUniversities(list);
        if (list.length > 0) {
          const parulUni = list.find(
            (u) =>
              u.name.toLowerCase().includes('parul') ||
              (u.short_name && u.short_name.toLowerCase().includes('pu'))
          );
          const chosen = parulUni || list[0];
          setSelectedUniversity(chosen);
          if (chosen.campuses && chosen.campuses.length > 0) {
            setSelectedCampus(chosen.campuses[0]);
          }
        }
      } catch (e) {
        console.warn('Failed to load universities:', e);
      }
    };
    loadUniversities();
  }, []);

  // Check live rides for Watched University Alert
  const checkUniversityAlerts = useCallback(async (targetUni: string) => {
    if (!targetUni || !targetUni.trim()) return;
    try {
      const data = await api.campusRides.listRides({ university_query: targetUni.trim() });
      const matches = (data || []).filter(
        (r) =>
          r.status === 'ACTIVE' &&
          r.available_seats > 0 &&
          ((r.destination_address || '').toLowerCase().includes(targetUni.toLowerCase()) ||
            (r.pickup_address || '').toLowerCase().includes(targetUni.toLowerCase()) ||
            (r.university_name && r.university_name.toLowerCase().includes(targetUni.toLowerCase())))
      );
      setUniAlerts(matches);
    } catch (e) {
      console.warn('Error checking university alerts:', e);
    }
  }, []);

  useEffect(() => {
    checkUniversityAlerts(watchedUniversity);
  }, [watchedUniversity, checkUniversityAlerts]);

  // 2. Load Rides based on filters and travel date
  const loadRides = useCallback(async () => {
    setLoadingRides(true);
    try {
      const data = await api.campusRides.listRides({
        university_id: selectedUniversity?.id,
        university_query: uniFilterQuery.trim() || undefined,
        campus_id: selectedCampus?.id,
        pickup_query: pickupQuery.trim() || undefined,
        dest_query: destQuery.trim() || undefined,
        vehicle_type: vehicleFilter !== 'All' ? vehicleFilter : undefined,
        travel_date: selectedTravelDate,
        gender_filter: genderFilter,
      });
      setRides(data);
    } catch (e) {
      console.warn('Error loading campus rides:', e);
    } finally {
      setLoadingRides(false);
    }
  }, [
    selectedUniversity,
    selectedCampus,
    uniFilterQuery,
    pickupQuery,
    destQuery,
    vehicleFilter,
    selectedTravelDate,
    genderFilter,
  ]);

  // Trigger search on filter changes only after user has tapped Search
  useEffect(() => {
    if (activeTab === 'search' && hasSearched) {
      loadRides();
    }
  }, [loadRides, activeTab, hasSearched]);

  // 3. Load My Bookings
  const loadMyBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const data = await api.campusRides.getMyBookings();
      setMyBookings(data);
    } catch (e) {
      console.warn('Error loading my bookings:', e);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'bookings') {
      loadMyBookings();
    }
  }, [activeTab, loadMyBookings]);

  // Handle 7-Day Strip Selection
  const handleSelectDay = (day: DayOption) => {
    setSelectedTravelDate(day.key);
    setTravelDateLabel(`${day.dayNameEn} (${day.dateNumber} ${day.monthShort})`);
  };

  // Submit Booking
  const handleBookingSubmit = async (
    rideId: string,
    seats: number,
    travelDate: string,
    notes?: string
  ) => {
    await api.campusRides.bookSeat(rideId, {
      seats_to_book: seats,
      travel_date: travelDate,
      pickup_notes: notes,
    });
    loadRides();
    loadMyBookings();
  };

  // Passenger Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    try {
      await api.campusRides.cancelBooking(bookingId);
      Alert.alert('Reservation Cancelled', 'Your campus ride seat booking has been cancelled.');
      loadMyBookings();
      loadRides();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not cancel booking.');
    }
  };

  // Swap pickup & dest
  const handleSwapRoute = () => {
    const temp = pickupQuery;
    setPickupQuery(destQuery);
    setDestQuery(temp);
  };

  return (
    <View style={styles.root}>
      {/* 1. TOP HEADER & CAMPUS SELECTOR */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#0f172a" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.appTitle}>Campus Ride</Text>
              <View style={styles.liveChip}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveChipText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.appSubtitle}>Verified Student Commutes & Shared Rides</Text>
          </View>
        </View>

        {/* University Selector Chip */}
        <TouchableOpacity
          style={styles.uniSelectorBar}
          onPress={() => setShowUniModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="school" size={16} color="#0284c7" />
          <Text style={styles.uniSelectorText} numberOfLines={1}>
            {selectedUniversity ? `${selectedUniversity.name} (${selectedUniversity.city})` : 'Select University'}
          </Text>
          <View style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
            <Ionicons name="chevron-down" size={14} color="#0284c7" />
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. PASSENGER TABS: SEARCH, SCHEDULE, BOOKINGS, ALERTS */}
      <View style={styles.tabBar}>
        {[
          { id: 'search', label: 'Search', icon: 'search-outline' },
          { id: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
          { id: 'bookings', label: 'My Bookings', icon: 'ticket-outline' },
          { id: 'alerts', label: 'Alerts', icon: 'notifications-outline', badge: uniAlerts.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.id as PassengerCampusTab)}
              activeOpacity={0.8}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? '#0284c7' : '#64748b'}
                />
                {!!tab.badge && tab.badge > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. TAB 1: SEARCH RIDE */}
      {activeTab === 'search' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
          {/* UNIVERSITY ALERT WATCHLIST & LIVE NOTIFICATIONS */}
          <View style={styles.watchAlertBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="notifications" size={16} color="#0284c7" />
                <Text style={styles.watchAlertTitle}>University Alerts & Watchlist</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCustomUniInput(watchedUniversity);
                  setShowSetUniModal(true);
                }}
                style={styles.watchAlertSetBtn}
              >
                <Ionicons name="pencil" size={12} color="#0284c7" />
                <Text style={styles.watchAlertSetBtnText}>Set / Add University</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.watchAlertCurrentRow}>
              <Ionicons name="school" size={13} color="#0369a1" />
              <Text style={styles.watchAlertCurrentText}>
                Watching: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{watchedUniversity || 'All Universities'}</Text>
              </Text>
              {uniAlerts.length > 0 && (
                <View style={styles.watchAlertActiveBadge}>
                  <View style={styles.pulseDotGreen} />
                  <Text style={styles.watchAlertActiveBadgeText}>{uniAlerts.length} Rides Live</Text>
                </View>
              )}
            </View>

            {/* Live Ride Alert Banner Card */}
            {uniAlerts.length > 0 ? (
              <View style={{ marginTop: 8, gap: 6 }}>
                {uniAlerts.slice(0, 2).map((alertRide) => (
                  <TouchableOpacity
                    key={alertRide.id}
                    style={styles.liveAlertCard}
                    onPress={() => {
                      setDestQuery(alertRide.destination_address);
                      setPickupQuery(alertRide.pickup_address);
                      setHasSearched(true);
                      setBookingModalRide(alertRide);
                      setShowBookingModal(true);
                    }}
                    activeOpacity={0.88}
                  >
                    <View style={styles.liveAlertIconCircle}>
                      <Ionicons name="flash" size={13} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.liveAlertHeader} numberOfLines={1}>
                        🔔 {alertRide.creator_name} posted a ride to {alertRide.destination_address}!
                      </Text>
                      <Text style={styles.liveAlertSub} numberOfLines={1}>
                        {alertRide.departure_time} • ₹{alertRide.price_per_seat} • {alertRide.available_seats} seat{alertRide.available_seats > 1 ? 's' : ''} left
                      </Text>
                    </View>
                    <View style={styles.liveAlertActionBtn}>
                      <Text style={styles.liveAlertActionText}>Book</Text>
                      <Ionicons name="arrow-forward" size={11} color="#0284c7" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.watchAlertEmptyText}>
                No live driver posts for {watchedUniversity} at this moment. You will see an instant alert here as soon as a driver posts!
              </Text>
            )}
          </View>

          {/* Quick Search Card */}
          <View style={styles.searchCard}>
            {/* Direction Mode Presets */}
            <View style={styles.searchDirectionRow}>
              <TouchableOpacity
                style={[
                  styles.searchDirBtn,
                  destQuery.includes(selectedUniversity?.name || 'Parul') && styles.searchDirBtnActive,
                ]}
                onPress={() => {
                  const u = selectedUniversity?.name || 'Parul University';
                  setDestQuery(u);
                  if (pickupQuery.includes(u)) setPickupQuery('');
                }}
              >
                <Ionicons
                  name="school"
                  size={14}
                  color={destQuery.includes(selectedUniversity?.name || 'Parul') ? '#0284c7' : '#64748b'}
                />
                <Text
                  style={[
                    styles.searchDirText,
                    destQuery.includes(selectedUniversity?.name || 'Parul') && styles.searchDirTextActive,
                  ]}
                >
                  To Campus
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.searchDirBtn,
                  pickupQuery.includes(selectedUniversity?.name || 'Parul') && styles.searchDirBtnActive,
                ]}
                onPress={() => {
                  const u = selectedUniversity?.name || 'Parul University';
                  setPickupQuery(u);
                  if (destQuery.includes(u)) setDestQuery('');
                }}
              >
                <Ionicons
                  name="home"
                  size={14}
                  color={pickupQuery.includes(selectedUniversity?.name || 'Parul') ? '#0284c7' : '#64748b'}
                />
                <Text
                  style={[
                    styles.searchDirText,
                    pickupQuery.includes(selectedUniversity?.name || 'Parul') && styles.searchDirTextActive,
                  ]}
                >
                  From Campus
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pickup & Destination Inputs with Swap */}
            <View style={styles.routeBox}>
              <View style={styles.searchInputRow}>
                <Ionicons name="radio-button-on" size={16} color="#10b981" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pickup Location (e.g. Railway Station / Hostel)"
                  placeholderTextColor="#94a3b8"
                  value={pickupQuery}
                  onChangeText={setPickupQuery}
                />
                <TouchableOpacity
                  onPress={() => setPickupQuery('My Current Location (Main Road)')}
                  style={styles.inlineGpsBtn}
                >
                  <Ionicons name="navigate" size={13} color="#0284c7" />
                </TouchableOpacity>
              </View>

              <View style={styles.swapDivider}>
                <View style={styles.swapLine} />
                <TouchableOpacity style={styles.swapBtn} onPress={handleSwapRoute}>
                  <Ionicons name="swap-vertical" size={15} color="#0284c7" />
                </TouchableOpacity>
                <View style={styles.swapLine} />
              </View>

              <View style={styles.searchInputRow}>
                <Ionicons name="location" size={16} color="#ef4444" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Drop Location (e.g. Parul Main Gate / Bus Stand)"
                  placeholderTextColor="#94a3b8"
                  value={destQuery}
                  onChangeText={setDestQuery}
                />
              </View>
            </View>

            {/* Main Road Advisory Notice */}
            <View style={styles.mainRoadNotice}>
              <Ionicons name="information-circle" size={16} color="#0284c7" />
              <Text style={styles.mainRoadNoticeText}>
                Tip: Boarding points near main road junctions or campus main gates are quickest for pickup.
              </Text>
            </View>

            {/* Filter Pills (Gender & Vehicle) */}
            <View style={styles.filtersRow}>
              {/* Gender Filter */}
              <View style={styles.filterGroup}>
                {(['ALL', 'FEMALE_ONLY', 'MALE_ONLY'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.filterChip, genderFilter === g && styles.filterChipActive]}
                    onPress={() => setGenderFilter(g)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        genderFilter === g && styles.filterChipTextActive,
                      ]}
                    >
                      {g === 'ALL' ? 'All' : g === 'FEMALE_ONLY' ? '👩 Girls Only' : '👨 Boys Only'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Vehicle Filter */}
              <View style={styles.filterGroup}>
                {['All', 'Car', 'Bike', 'Auto'].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.filterChip, vehicleFilter === v && styles.filterChipActive]}
                    onPress={() => setVehicleFilter(v)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        vehicleFilter === v && styles.filterChipTextActive,
                      ]}
                    >
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 7-Day Live Strip with Calendar Modal Trigger */}
          <SevenDayStrip
            selectedDate={selectedTravelDate}
            onSelectDate={handleSelectDay}
            onOpenCalendar={() => setShowDatePickerModal(true)}
          />

          {/* Search Button (Requirement 2) */}
          <TouchableOpacity
            style={styles.searchSubmitBtn}
            onPress={() => {
              setHasSearched(true);
              loadRides();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.searchSubmitBtnText}>Search Campus Rides</Text>
          </TouchableOpacity>

          {/* Feed Content */}
          {!hasSearched ? (
            <View style={styles.preSearchCard}>
              <View style={styles.preSearchIconCircle}>
                <Ionicons name="compass-outline" size={30} color="#0284c7" />
              </View>
              <Text style={styles.preSearchTitle}>Ready to Find a Commute?</Text>
              <Text style={styles.preSearchSub}>
                Confirm your pickup, drop, and travel date above, then tap "Search Campus Rides" to view verified driver rides.
              </Text>
            </View>
          ) : (
            <>
              {/* Rides Feed Header */}
              <View style={styles.feedHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="car-sport" size={16} color="#0f172a" />
                  <Text style={styles.feedHeading}>
                    Available Rides ({rides.length})
                  </Text>
                </View>
                <TouchableOpacity onPress={loadRides} style={styles.refreshIconBtn}>
                  <Ionicons name="refresh" size={16} color="#0284c7" />
                  <Text style={styles.refreshIconText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {loadingRides ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#0284c7" />
                  <Text style={styles.loadingText}>Searching live campus rides...</Text>
                </View>
              ) : rides.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyCircle}>
                    <Ionicons name="search" size={32} color="#94a3b8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Rides Found for This Route / Date</Text>
                  <Text style={styles.emptySub}>
                    No driver has posted a ride for this date yet. You can use 'Schedule Ride' to post your travel request, and drivers will be notified!
                  </Text>
                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={() => setActiveTab('schedule')}
                  >
                    <Ionicons name="calendar" size={14} color="#ffffff" />
                    <Text style={styles.actionPillBtnText}>Schedule a Ride Request</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                rides.map((ride) => (
                  <CampusRideCard
                    key={ride.id}
                    ride={ride}
                    travelDateLabel={travelDateLabel}
                    onBook={(targetRide) => {
                      setBookingModalRide(targetRide);
                      setShowBookingModal(true);
                    }}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* 4. TAB 2: SCHEDULE RIDE */}
      {activeTab === 'schedule' && (
        <View style={{ flex: 1 }}>
          <CampusScheduleRideView
            selectedUniversity={selectedUniversity}
            onSelectUniversityModal={() => setShowUniModal(true)}
            onPostSuccess={() => {
              // Option to view active requests or search
            }}
          />
        </View>
      )}

      {/* 5. TAB 3: MY BOOKINGS */}
      {activeTab === 'bookings' && (
        <View style={{ flex: 1 }}>
          <CampusMyBookingsView
            bookings={myBookings}
            loading={loadingBookings}
            onRefresh={loadMyBookings}
            onCancelBooking={handleCancelBooking}
          />
        </View>
      )}

      {/* 5b. TAB 4: ALERTS (Dedicated Passenger University Alerts Tab) */}
      {activeTab === 'alerts' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
          {/* Watched University Control Box */}
          <View style={styles.alertsWatchedCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.alertIconCircle}>
                  <Ionicons name="notifications" size={18} color="#0284c7" />
                </View>
                <View>
                  <Text style={styles.alertCardHeading}>WATCHED UNIVERSITY</Text>
                  <Text style={styles.alertCardUniName}>{watchedUniversity}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.changeWatchBtn}
                onPress={() => setShowSetUniModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={13} color="#0284c7" />
                <Text style={styles.changeWatchBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.alertExplainRow}>
              <Ionicons name="information-circle" size={14} color="#0369a1" />
              <Text style={styles.alertExplainText}>
                Instant notifications when drivers post rides to or from {watchedUniversity}. Tap to book directly.
              </Text>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.alertFeedHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.alertFeedTitle}>Live Rides for {watchedUniversity}</Text>
              {uniAlerts.length > 0 && (
                <View style={styles.alertCountBadge}>
                  <Text style={styles.alertCountBadgeText}>{uniAlerts.length} Active</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => checkUniversityAlerts(watchedUniversity)}
              style={styles.refreshAlertBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={14} color="#0284c7" />
              <Text style={styles.refreshAlertText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Empty State vs Alerts List */}
          {uniAlerts.length === 0 ? (
            <View style={styles.emptyAlertsCard}>
              <View style={styles.emptyAlertsIconCircle}>
                <Ionicons name="notifications-off-outline" size={32} color="#94a3b8" />
              </View>
              <Text style={styles.emptyAlertsTitle}>No Live Driver Rides Right Now</Text>
              <Text style={styles.emptyAlertsSub}>
                No driver has an active posted ride for {watchedUniversity} at this moment. You will be alerted the moment a driver posts!
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={styles.emptyAlertActionBtn}
                  onPress={() => setShowSetUniModal(true)}
                >
                  <Ionicons name="school-outline" size={14} color="#0284c7" />
                  <Text style={styles.emptyAlertActionText}>Change College</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.emptyAlertActionBtn, { backgroundColor: '#0284c7', borderColor: '#0284c7' }]}
                  onPress={() => setActiveTab('schedule')}
                >
                  <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                  <Text style={[styles.emptyAlertActionText, { color: '#ffffff' }]}>Schedule Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            uniAlerts.map((ride) => (
              <CampusRideCard
                key={ride.id}
                ride={ride}
                travelDateLabel="Live Alert"
                onBook={(targetRide) => {
                  setBookingModalRide(targetRide);
                  setShowBookingModal(true);
                }}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* 6. BOOKING CONFIRMATION MODAL */}
      <CampusBookingModal
        visible={showBookingModal}
        ride={bookingModalRide}
        targetTravelDate={selectedTravelDate}
        onClose={() => {
          setShowBookingModal(false);
          setBookingModalRide(null);
        }}
        onSuccess={() => {
          loadMyBookings();
          setActiveTab('bookings');
        }}
        onSubmitBooking={handleBookingSubmit}
      />

      {/* 7. UNIVERSITY SELECTOR MODAL */}
      <Modal visible={showUniModal} animationType="slide" transparent>
        <View style={styles.uniModalOverlay}>
          <View style={styles.uniModalCard}>
            <View style={styles.uniModalHeader}>
              <View>
                <Text style={styles.uniModalTitle}>Select University / Campus</Text>
                <Text style={styles.uniModalSub}>Pick your college to discover relevant rides</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUniModal(false)}>
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={styles.uniSearchBox}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={styles.uniSearchInput}
                placeholder="Search college name or city..."
                placeholderTextColor="#94a3b8"
                value={uniSearchText}
                onChangeText={setUniSearchText}
              />
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {universities
                .filter(
                  (u) =>
                    !uniSearchText.trim() ||
                    u.name.toLowerCase().includes(uniSearchText.toLowerCase()) ||
                    u.city.toLowerCase().includes(uniSearchText.toLowerCase())
                )
                .map((u) => {
                  const isChosen = selectedUniversity?.id === u.id;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.uniItem, isChosen && styles.uniItemActive]}
                      onPress={() => {
                        setSelectedUniversity(u);
                        if (u.campuses && u.campuses.length > 0) {
                          setSelectedCampus(u.campuses[0]);
                        } else {
                          setSelectedCampus(null);
                        }
                        setShowUniModal(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.uniItemName, isChosen && styles.uniItemNameActive]}>
                          {u.name}
                        </Text>
                        <Text style={styles.uniItemCity}>
                          📍 {u.city}, {u.state}
                        </Text>
                      </View>
                      {isChosen && (
                        <Ionicons name="checkmark-circle" size={20} color="#0284c7" />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 8. 7-DAY CALENDAR DATE PICKER MODAL */}
      <CampusDatePickerModal
        visible={showDatePickerModal}
        selectedDate={selectedTravelDate}
        onSelectDate={(key, label) => {
          setSelectedTravelDate(key);
          setTravelDateLabel(label);
        }}
        onClose={() => setShowDatePickerModal(false)}
      />

      {/* 9. SET / ADD WATCHED UNIVERSITY MODAL */}
      <Modal visible={showSetUniModal} animationType="slide" transparent>
        <View style={styles.uniModalOverlay}>
          <View style={styles.uniModalCard}>
            <View style={styles.uniModalHeader}>
              <View>
                <Text style={styles.uniModalTitle}>Set University Watchlist</Text>
                <Text style={styles.uniModalSub}>Get instant alerts when any driver posts a ride to this campus</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSetUniModal(false)}>
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={styles.uniSearchBox}>
              <Ionicons name="school" size={16} color="#0284c7" />
              <TextInput
                style={styles.uniSearchInput}
                placeholder="Type or select university (e.g. Parul University)..."
                placeholderTextColor="#94a3b8"
                value={customUniInput}
                onChangeText={setCustomUniInput}
              />
            </View>

            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8 }}>
              OR SELECT FROM KNOWN UNIVERSITIES:
            </Text>

            <ScrollView style={{ maxHeight: 220 }}>
              {universities.map((u) => {
                const isSelected = customUniInput.toLowerCase() === u.name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.uniItem, isSelected && styles.uniItemActive]}
                    onPress={() => setCustomUniInput(u.name)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.uniItemName, isSelected && styles.uniItemNameActive]}>
                        {u.name}
                      </Text>
                      <Text style={styles.uniItemCity}>{u.city}, {u.state}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.searchSubmitBtn, { marginTop: 14 }]}
              onPress={() => {
                const target = customUniInput.trim() || 'Parul University';
                setWatchedUniversity(target);
                checkUniversityAlerts(target);
                setShowSetUniModal(false);
              }}
            >
              <Ionicons name="notifications-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.searchSubmitBtnText}>Set & Start Watching Alerts</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  searchSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    marginVertical: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  searchSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  preSearchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 8,
  },
  preSearchIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  preSearchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  preSearchSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  appSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  uniSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 8,
  },
  uniSelectorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0284c7',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#0284c7',
  },
  scrollArea: {
    padding: 12,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  searchDirectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchDirBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    gap: 6,
  },
  searchDirBtnActive: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  searchDirText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  searchDirTextActive: {
    color: '#0284c7',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 8,
    height: 38,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: '#0f172a',
    marginLeft: 6,
    paddingVertical: 0,
  },
  inlineGpsBtn: {
    padding: 4,
  },
  routeBox: {
    marginBottom: 6,
  },
  swapDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: -2,
    justifyContent: 'center',
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  swapBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  mainRoadNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  mainRoadNoticeText: {
    fontSize: 10,
    color: '#0369a1',
    flex: 1,
    lineHeight: 14,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  filterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#0284c7',
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  feedHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  refreshIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  refreshIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionPillBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  uniModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  uniModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  uniModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  uniModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  uniModalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  uniSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 12,
  },
  uniSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    marginLeft: 8,
  },
  uniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  uniItemActive: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  uniItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  uniItemNameActive: {
    color: '#0284c7',
  },
  uniItemCity: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  watchAlertBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  watchAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369a1',
  },
  watchAlertSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  watchAlertSetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  watchAlertCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  watchAlertCurrentText: {
    fontSize: 12,
    color: '#334155',
  },
  watchAlertActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  watchAlertActiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  pulseDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  liveAlertIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveAlertHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  liveAlertSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  liveAlertActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveAlertActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  watchAlertEmptyText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 15,
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  alertsWatchedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCardHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.6,
  },
  alertCardUniName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  changeWatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  changeWatchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  alertExplainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  alertExplainText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    lineHeight: 15,
  },
  alertFeedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  alertFeedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  alertCountBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  alertCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  refreshAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  refreshAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyAlertsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  emptyAlertsIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyAlertsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyAlertsSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  emptyAlertActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyAlertActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  alertRideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  alertRideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  alertDriverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertDriverName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  alertRatingPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  alertVehicleInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  alertFareBadge: {
    alignItems: 'flex-end',
  },
  alertFareAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  alertFareUnit: {
    fontSize: 10,
    color: '#64748b',
  },
  alertRouteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  alertRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertRouteConnector: {
    width: 2,
    height: 8,
    backgroundColor: '#cbd5e1',
    marginLeft: 4,
    marginVertical: 2,
  },
  alertRouteText: {
    fontSize: 12,
    color: '#1e293b',
    flex: 1,
  },
  alertBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  alertMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertMetaText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  alertBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 10,
  },
  alertBookBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
