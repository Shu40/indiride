import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CampusRideItem } from '../../types';

interface Props {
  ride: CampusRideItem;
  travelDateLabel: string;
  onBook: (ride: CampusRideItem) => void;
}

export const CampusRideCard: React.FC<Props> = ({ ride, travelDateLabel, onBook }) => {
  const isSoldOut = ride.is_sold_out || ride.available_seats <= 0 || ride.status === 'FULL';

  return (
    <View style={[styles.card, isSoldOut && styles.cardSoldOut]}>
      {/* Top Badges Row */}
      <View style={styles.topBadgesRow}>
        <View style={styles.badgeLeftGroup}>
          {ride.is_daily ? (
            <View style={styles.dailyBadge}>
              <Ionicons name="repeat" size={12} color="#059669" />
              <Text style={styles.dailyBadgeText}>Daily Commute (All Days)</Text>
            </View>
          ) : (
            <View style={styles.oneTimeBadge}>
              <Ionicons name="calendar-outline" size={12} color="#0284c7" />
              <Text style={styles.oneTimeBadgeText}>Single Day Ride</Text>
            </View>
          )}

          {ride.gender_preference === 'FEMALE_ONLY' ? (
            <View style={[styles.genderBadge, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}>
              <Text style={[styles.genderBadgeText, { color: '#db2777' }]}>👩 Girls Only</Text>
            </View>
          ) : ride.gender_preference === 'MALE_ONLY' ? (
            <View style={[styles.genderBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
              <Text style={[styles.genderBadgeText, { color: '#2563eb' }]}>👨 Boys Only</Text>
            </View>
          ) : null}

          {ride.university_name ? (
            <View style={styles.uniBadge}>
              <Text style={styles.uniBadgeText} numberOfLines={1}>
                🏫 {ride.university_name}
              </Text>
            </View>
          ) : null}
        </View>

        {isSoldOut ? (
          <View style={styles.soldOutBadge}>
            <Ionicons name="close-circle" size={12} color="#ef4444" />
            <Text style={styles.soldOutBadgeText}>
              {ride.is_daily ? 'Sold Out Today' : 'Sold Out'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Driver Header & Fare */}
      <View style={styles.driverRow}>
        <View style={styles.driverLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ride.creator_name.charAt(0)}</Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.driverName}>{ride.creator_name}</Text>
              {ride.driver_verified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#059669" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.ratingText}>{ride.rating.toFixed(1)}</Text>
              <Text style={styles.tripsText}>• {ride.completed_trips} trips</Text>
            </View>
          </View>
        </View>

        <View style={styles.fareContainer}>
          <Text style={styles.fareAmount}>₹{ride.price_per_seat}</Text>
          <Text style={styles.fareSub}>/ seat</Text>
        </View>
      </View>

      {/* Time & Vehicle Bar */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color="#0284c7" />
          <Text style={styles.metaText}>{ride.departure_time}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons
            name={
              ride.vehicle_type?.toLowerCase().includes('auto')
                ? 'speedometer-outline'
                : ride.vehicle_type?.toLowerCase().includes('bike')
                ? 'bicycle'
                : 'car-sport-outline'
            }
            size={14}
            color="#475569"
          />
          <Text style={styles.metaText}>{ride.vehicle_info || ride.vehicle_type}</Text>
        </View>
      </View>

      {/* Route Markers */}
      <View style={styles.routeContainer}>
        <View style={styles.routeLineBox}>
          <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
          <View style={styles.verticalLine} />
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
        </View>

        <View style={styles.addressList}>
          <View>
            <Text style={styles.stopLabel}>Pickup Location:</Text>
            <Text style={styles.stopText} numberOfLines={1}>
              {ride.pickup_address}
            </Text>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.stopLabel}>Destination:</Text>
            <Text style={styles.stopText} numberOfLines={1}>
              {ride.destination_address}
            </Text>
          </View>
        </View>
      </View>

      {/* Intermediate stops if any */}
      {ride.intermediate_stops && ride.intermediate_stops.length > 0 ? (
        <View style={styles.stopsRow}>
          <Text style={styles.viaLabel}>Via:</Text>
          {ride.intermediate_stops.map((st, i) => (
            <View key={i} style={styles.stopPill}>
              <Text style={styles.stopPillText}>{st}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Notes if any */}
      {ride.notes ? (
        <View style={styles.notesRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color="#0284c7" />
          <Text style={styles.notesText} numberOfLines={2}>
            {ride.notes}
          </Text>
        </View>
      ) : null}

      {/* Footer: Seats Left & Book Button */}
      <View style={styles.footerRow}>
        <View style={styles.seatsLeftBox}>
          <Ionicons
            name="people"
            size={16}
            color={isSoldOut ? '#ef4444' : '#059669'}
          />
          <Text style={[styles.seatsLeftText, isSoldOut && { color: '#ef4444' }]}>
            {isSoldOut
              ? ride.is_daily
                ? 'Sold out on this date'
                : 'Sold Out'
              : `${ride.available_seats} of ${ride.total_seats} seats available`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.bookBtn, isSoldOut && styles.bookBtnDisabled]}
          disabled={isSoldOut}
          onPress={() => onBook(ride)}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={14} color="#ffffff" />
          <Text style={styles.bookBtnText}>
            {isSoldOut ? 'Sold Out' : 'Book Seat'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardSoldOut: {
    backgroundColor: '#fafafa',
    borderColor: '#f1f5f9',
    opacity: 0.88,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeLeftGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dailyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 4,
  },
  dailyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  oneTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 4,
  },
  oneTimeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  genderBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  genderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  uniBadge: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  uniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  soldOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 3,
  },
  soldOutBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  driverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    gap: 2,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  tripsText: {
    fontSize: 11,
    color: '#64748b',
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  fareSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginVertical: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
  },
  routeLineBox: {
    alignItems: 'center',
    width: 16,
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  verticalLine: {
    width: 1.5,
    height: 24,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  addressList: {
    flex: 1,
    marginLeft: 8,
  },
  stopLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  stopText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 1,
  },
  stopsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  viaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  stopPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stopPillText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  notesText: {
    fontSize: 11,
    color: '#0369a1',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  seatsLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  seatsLeftText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  bookBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  bookBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
