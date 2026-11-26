import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PostedRideType {
  id: string;
  pickup_address: string;
  destination_address: string;
  departure_time: string;
  price_per_seat: number;
  available_seats: number;
  total_seats: number;
  vehicle_type: string;
  vehicle_info: string;
  is_daily?: boolean;
  gender_preference?: string;
  status: string;
  university_name?: string;
  bookings: Array<{
    booking_id: string;
    passenger_name: string;
    passenger_phone: string;
    seats_booked: number;
    travel_date?: string;
    total_fare: number;
    pickup_notes?: string;
    status: string;
  }>;
  created_at?: string;
}

interface Props {
  postedRides: PostedRideType[];
  loading: boolean;
  onRefresh: () => void;
  onAcceptBooking: (bookingId: string) => Promise<void>;
  onRejectBooking: (bookingId: string) => Promise<void>;
  onCancelRide: (rideId: string) => Promise<void>;
}

export const CampusMyPostedView: React.FC<Props> = ({
  postedRides,
  loading,
  onRefresh,
  onAcceptBooking,
  onRejectBooking,
  onCancelRide,
}) => {
  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading your posted campus rides...</Text>
      </View>
    );
  }

  if (postedRides.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="car-outline" size={36} color="#94a3b8" />
        </View>
        <Text style={styles.emptyTitle}>No Posted Rides</Text>
        <Text style={styles.emptySub}>
          You have not posted any campus rides yet. Use the 'Post Ride' tab to publish your commute and share empty seats!
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={16} color="#0284c7" />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>My Posted Campus Rides ({postedRides.length})</Text>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Ionicons name="refresh" size={18} color="#0284c7" />
        </TouchableOpacity>
      </View>

      {postedRides.map((ride) => {
        const isDaily = ride.is_daily;
        const pendingBookings = (ride.bookings || []).filter((b) => b.status === 'PENDING');
        const confirmedBookings = (ride.bookings || []).filter((b) => b.status === 'CONFIRMED');

        return (
          <View key={ride.id} style={styles.card}>
            {/* Header: All Days vs Single & Status */}
            <View style={styles.cardTop}>
              {isDaily ? (
                <View style={styles.allDaysBadge}>
                  <Ionicons name="repeat" size={12} color="#059669" />
                  <Text style={styles.allDaysBadgeText}>Daily Active (All Days)</Text>
                </View>
              ) : (
                <View style={styles.singleBadge}>
                  <Ionicons name="calendar-outline" size={12} color="#0284c7" />
                  <Text style={styles.singleBadgeText}>{ride.departure_time}</Text>
                </View>
              )}

              <View style={styles.seatsPill}>
                <Text style={styles.seatsPillText}>
                  {ride.available_seats} of {ride.total_seats} seats available
                </Text>
              </View>
            </View>

            {/* Route */}
            <View style={styles.routeBox}>
              <View style={styles.routePoint}>
                <Ionicons name="radio-button-on" size={14} color="#10b981" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {ride.pickup_address}
                </Text>
              </View>
              <View style={styles.routePoint}>
                <Ionicons name="location" size={14} color="#ef4444" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {ride.destination_address}
                </Text>
              </View>
            </View>

            {/* Price & Vehicle */}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {ride.vehicle_info || ride.vehicle_type} • ₹{ride.price_per_seat} / seat
              </Text>
              <Text style={styles.metaText}>Time: {ride.departure_time}</Text>
            </View>

            {/* INCOMING PENDING REQUESTS */}
            {pendingBookings.length > 0 && (
              <View style={styles.pendingSection}>
                <View style={styles.pendingHeader}>
                  <Ionicons name="notifications-circle" size={18} color="#d97706" />
                  <Text style={styles.pendingTitle}>
                    Incoming Booking Requests ({pendingBookings.length})
                  </Text>
                </View>

                {pendingBookings.map((b) => (
                  <View key={b.booking_id} style={styles.bookingCard}>
                    <View style={styles.bookingTop}>
                      <View>
                        <Text style={styles.passengerName}>{b.passenger_name}</Text>
                        <Text style={styles.passengerMeta}>
                          Date: {b.travel_date || 'Today'} • {b.seats_booked} seat(s) • ₹{b.total_fare}
                        </Text>
                      </View>
                    </View>

                    {b.pickup_notes ? (
                      <Text style={styles.bookingNotes}>Note: "{b.pickup_notes}"</Text>
                    ) : null}

                    {/* Accept / Reject Buttons */}
                    <View style={styles.actionBtnRow}>
                      <TouchableOpacity
                        style={[styles.btn, styles.rejectBtn]}
                        onPress={() => {
                          Alert.alert('Decline Request', 'Are you sure you want to decline this passenger booking?', [
                            { text: 'No', style: 'cancel' },
                            { text: 'Yes, Decline', onPress: () => onRejectBooking(b.booking_id) },
                          ]);
                        }}
                      >
                        <Ionicons name="close-circle" size={14} color="#ef4444" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btn, styles.acceptBtn]}
                        onPress={() => onAcceptBooking(b.booking_id)}
                      >
                        <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* CONFIRMED PASSENGERS */}
            {confirmedBookings.length > 0 && (
              <View style={styles.confirmedSection}>
                <Text style={styles.confirmedTitle}>
                  Confirmed Passengers ({confirmedBookings.length})
                </Text>
                {confirmedBookings.map((b) => (
                  <View key={b.booking_id} style={styles.confirmedRow}>
                    <View>
                      <Text style={styles.confirmedName}>{b.passenger_name}</Text>
                      <Text style={styles.confirmedPhone}>{b.passenger_phone}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.confirmedSeats}>{b.seats_booked} seat(s)</Text>
                      <Text style={styles.confirmedDate}>{b.travel_date || 'Today'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Cancel Ride Option */}
            <TouchableOpacity
              style={styles.cancelRideBtn}
              onPress={() => {
                Alert.alert('Delete Ride', 'Are you sure you want to delete this posted campus ride?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes, Delete',
                    style: 'destructive',
                    onPress: () => onCancelRide(ride.id),
                  },
                ]);
              }}
            >
              <Ionicons name="trash-outline" size={13} color="#94a3b8" />
              <Text style={styles.cancelRideText}>Delete Ride</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  allDaysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  allDaysBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  singleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  singleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  seatsPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  seatsPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  routeBox: {
    marginVertical: 6,
    gap: 4,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  pendingSection: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  bookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  passengerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  passengerMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  bookingNotes: {
    fontSize: 11,
    color: '#0284c7',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  rejectBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  acceptBtn: {
    backgroundColor: '#16a34a',
  },
  acceptBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  confirmedSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  confirmedTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    marginBottom: 6,
  },
  confirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  confirmedName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  confirmedPhone: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
  },
  confirmedSeats: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  confirmedDate: {
    fontSize: 10,
    color: '#64748b',
  },
  cancelRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    marginTop: 6,
  },
  cancelRideText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
