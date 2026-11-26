import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface BookingItemType {
  booking_id: string;
  ride_id: string;
  status: string;
  seats_booked: number;
  total_fare: number;
  travel_date?: string;
  created_at?: string;
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
}

interface Props {
  bookings: BookingItemType[];
  loading: boolean;
  onRefresh: () => void;
  onCancelBooking: (bookingId: string) => Promise<void>;
}

export const CampusMyBookingsView: React.FC<Props> = ({
  bookings,
  loading,
  onRefresh,
  onCancelBooking,
}) => {
  const handleCall = (phone?: string) => {
    if (!phone || phone.includes('*')) {
      Alert.alert('Privacy Protection', 'Driver mobile number unlocks strictly after the driver confirms your booking.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="ticket-outline" size={36} color="#94a3b8" />
        </View>
        <Text style={styles.emptyTitle}>No Bookings Found</Text>
        <Text style={styles.emptySub}>
          You have not booked any campus ride seats yet. Discover rides easily from the 'Search Ride' tab!
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
        <Text style={styles.sectionTitle}>My Reserved Seats ({bookings.length})</Text>
        <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
          <Ionicons name="refresh" size={18} color="#0284c7" />
        </TouchableOpacity>
      </View>

      {bookings.map((b) => {
        const isConfirmed = b.status === 'CONFIRMED';
        const isPending = b.status === 'PENDING';
        const isRejected = b.status === 'REJECTED' || b.status === 'CANCELLED';
        const ride = b.ride;

        return (
          <View key={b.booking_id} style={styles.card}>
            {/* Top Status & Date */}
            <View style={styles.cardTop}>
              <View style={styles.dateTag}>
                <Ionicons name="calendar-outline" size={13} color="#0284c7" />
                <Text style={styles.dateTagText}>
                  {b.travel_date ? `Date: ${b.travel_date}` : 'Today'}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isConfirmed && styles.statusConfirmed,
                  isPending && styles.statusPending,
                  isRejected && styles.statusRejected,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isConfirmed && { color: '#059669' },
                    isPending && { color: '#d97706' },
                    isRejected && { color: '#ef4444' },
                  ]}
                >
                  {isConfirmed
                    ? '✅ CONFIRMED'
                    : isPending
                    ? '⏳ PENDING CONFIRMATION'
                    : b.status}
                </Text>
              </View>
            </View>

            {/* Host Name & Departure */}
            <View style={styles.hostRow}>
              <View>
                <Text style={styles.hostLabel}>Host / Driver:</Text>
                <Text style={styles.hostName}>{ride?.driver_name || 'Campus Host'}</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.fareTotal}>₹{b.total_fare}</Text>
                <Text style={styles.seatsCount}>{b.seats_booked} Seat(s)</Text>
              </View>
            </View>

            {/* Route */}
            <View style={styles.routeBox}>
              <View style={styles.routePoint}>
                <Ionicons name="radio-button-on" size={14} color="#10b981" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {ride?.pickup_address || 'Pickup Point'}
                </Text>
              </View>
              <View style={styles.routePoint}>
                <Ionicons name="location" size={14} color="#ef4444" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {ride?.destination_address || 'Destination'}
                </Text>
              </View>
            </View>

            {/* Privacy & Contact Box */}
            {isConfirmed && ride?.driver_phone ? (
              <View style={styles.contactBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>Driver Contact Details:</Text>
                  <Text style={styles.contactPhone}>{ride.driver_phone}</Text>
                </View>

                {!ride.driver_phone.includes('*') ? (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => handleCall(ride.driver_phone)}
                  >
                    <Ionicons name="call" size={14} color="#ffffff" />
                    <Text style={styles.callBtnText}>Call</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.privacyNoticeBox}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" />
                <Text style={styles.privacyNoticeText}>
                  For safety & privacy, driver contact unlocks immediately upon booking confirmation.
                </Text>
              </View>
            )}

            {/* Cancel Button */}
            {!isRejected && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  Alert.alert('Cancel Reservation', 'Are you sure you want to cancel this campus seat reservation?', [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Yes, Cancel',
                      style: 'destructive',
                      onPress: () => onCancelBooking(b.booking_id),
                    },
                  ]);
                }}
              >
                <Ionicons name="close-circle-outline" size={14} color="#64748b" />
                <Text style={styles.cancelBtnText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
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
    marginBottom: 10,
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusConfirmed: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  hostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  hostLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  hostName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  fareTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  seatsCount: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  routeBox: {
    marginVertical: 8,
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
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  contactTitle: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '700',
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065f46',
    marginTop: 2,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  privacyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  privacyNoticeText: {
    fontSize: 10,
    color: '#64748b',
    flex: 1,
    lineHeight: 14,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
});
