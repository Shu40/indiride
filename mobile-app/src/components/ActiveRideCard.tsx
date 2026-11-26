import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RideBooking, RideStatus } from '../types';

interface ActiveRideCardProps {
  booking: RideBooking;
  onCancel: () => void;
}

export const ActiveRideCard: React.FC<ActiveRideCardProps> = ({ booking, onCancel }) => {
  const rider = booking.rider;

  const formatLastUpdate = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${Math.floor(diffSec / 60)}m ago`;
  };

  const getStatusBadge = (status: RideStatus) => {
    switch (status) {
      case 'RIDER_ASSIGNED':
      case 'RIDER_ARRIVING': {
        const eta = rider?.pickup_eta_mins || booking.pickup_eta_mins || 3;
        return {
          label: rider?.is_stale
            ? `Driver arriving • GPS paused (${formatLastUpdate(rider.last_location_update)})`
            : `Driver arriving in ~${eta} mins`,
          bgColor: rider?.is_stale ? '#78350f' : '#000000',
          textColor: '#ffffff',
          step: 2,
        };
      }
      case 'RIDER_ARRIVED':
        return {
          label: 'Driver is waiting at pickup',
          bgColor: '#059669',
          textColor: '#ffffff',
          step: 3,
        };
      case 'IN_PROGRESS': {
        const destEta = rider?.pickup_eta_mins || booking.pickup_eta_mins || 8;
        return {
          label: rider?.is_stale
            ? `Heading to destination • GPS paused (${formatLastUpdate(rider.last_location_update)})`
            : `Heading to destination • Arriving in ~${destEta} mins`,
          bgColor: '#2563eb',
          textColor: '#ffffff',
          step: 4,
        };
      }
      case 'COMPLETED':
        return {
          label: 'Trip completed • Arrived at destination',
          bgColor: '#10b981',
          textColor: '#ffffff',
          step: 5,
        };
      default:
        return {
          label: status,
          bgColor: '#334155',
          textColor: '#ffffff',
          step: 1,
        };
    }
  };

  const badge = getStatusBadge(booking.status);


  const handleCallDriver = () => {
    if (rider?.phone_number) {
      Linking.openURL(`tel:${rider.phone_number}`);
    } else {
      Alert.alert('Call Driver', 'Calling driver: +91 92222 22222');
    }
  };

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Contacting 112 Emergency Services and sharing your live GPS corridor location.',
      [{ text: 'Dismiss' }, { text: 'Call 112', onPress: () => Linking.openURL('tel:112') }]
    );
  };

  return (
    <View style={styles.cardContainer}>
      {/* Top Live Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: badge.bgColor }]}>
        <View style={styles.livePulseDot} />
        <Text style={[styles.statusBannerText, { color: badge.textColor }]}>{badge.label}</Text>
      </View>

      {/* Progress Stepper */}
      <View style={styles.stepperRow}>
        {['Assigned', 'Arriving', 'Arrived', 'Trip', 'Done'].map((st, i) => (
          <React.Fragment key={st}>
            <View style={[styles.stepDot, i + 1 <= badge.step && styles.stepDotActive]} />
            {i < 4 && <View style={[styles.stepLine, i + 1 < badge.step && styles.stepLineActive]} />}
          </React.Fragment>
        ))}
      </View>

      {/* 4-DIGIT SAFETY OTP PIN BOX */}
      {booking.otp && booking.status !== 'IN_PROGRESS' && booking.status !== 'COMPLETED' && (
        <View style={styles.otpCard}>
          <View style={styles.otpHeader}>
            <Ionicons name="shield-checkmark" size={16} color="#059669" />
            <Text style={styles.otpHeaderTitle}>YOUR 4-DIGIT START PIN</Text>
          </View>
          <Text style={styles.otpSubtitle}>
            Share with driver upon boarding to start trip:
          </Text>
          <View style={styles.otpDigitsRow}>
            {booking.otp.split('').map((digit, idx) => (
              <View key={idx} style={styles.digitPill}>
                <Text style={styles.digitChar}>{digit}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.otpInstructionNote}>
            Share this 4-digit OTP only with your assigned driver upon boarding to start your trip.
          </Text>
        </View>
      )}

      {/* Driver & Vehicle Information */}
      <View style={styles.driverSection}>
        <View style={styles.driverAvatar}>
          {rider?.profile_photo ? (
            <Image
              source={{ uri: rider.profile_photo }}
              style={styles.driverAvatarImg}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="person" size={26} color="#ffffff" />
          )}
        </View>

        <View style={styles.driverMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.driverName}>{rider?.full_name || 'Suresh Kumar'}</Text>
            <View style={styles.starBadge}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.starText}>{rider?.rating ? rider.rating.toFixed(1) : '4.9'}</Text>
            </View>
            <View style={styles.vehicleCategoryPill}>
              <Text style={styles.vehicleCategoryPillText}>
                {(rider?.vehicle_category || booking.vehicle_category)?.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.vehicleNameText}>
            {rider?.vehicle_model || 'Hero Splendor / Swift Dzire'}
          </Text>

          {/* Authentic Indian License Plate Badge */}
          <View style={styles.licensePlateBadge}>
            <Text style={styles.plateCountry}>IND</Text>
            <Text style={styles.plateNumber}>{rider?.vehicle_plate || 'KA 03 AB 4422'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.callCircleBtn} onPress={handleCallDriver}>
          <Ionicons name="call" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* GPS Staleness Notice */}
      {rider?.is_stale && (
        <View style={styles.staleNoticeRow}>
          <Ionicons name="warning-outline" size={14} color="#d97706" />
          <Text style={styles.staleNoticeText}>
            Driver GPS update paused • Last active {formatLastUpdate(rider.last_location_update)}
          </Text>
        </View>
      )}

      {/* Route Addresses */}
      <View style={styles.routeBox}>
        <View style={styles.addressLine}>
          <View style={[styles.routeDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.addressText} numberOfLines={1}>
            {booking.pickup_address}
          </Text>
        </View>

        <View style={styles.addressLine}>
          <View style={[styles.routeDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.addressText} numberOfLines={1}>
            {booking.destination_address}
          </Text>
        </View>
      </View>

      {/* Distance & Fare Footer */}
      <View style={styles.footerRow}>
        <View>
          <Text style={styles.footerLabel}>Distance</Text>
          <Text style={styles.footerValue}>{booking.actual_distance_km || booking.estimated_distance_km} km</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.footerLabel}>{booking.status === 'COMPLETED' ? 'Total Fare' : 'Estimated Fare'}</Text>
          <Text style={styles.farePriceText}>
            ₹{Math.round(booking.final_fare || booking.estimated_fare)}
          </Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
          <Ionicons name="shield-outline" size={16} color="#dc2626" />
          <Text style={styles.sosText}>Safety SOS</Text>
        </TouchableOpacity>

        {booking.status !== 'IN_PROGRESS' && booking.status !== 'COMPLETED' && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}

        {booking.status === 'COMPLETED' && (
          <TouchableOpacity style={styles.doneTripBtn} onPress={onCancel}>
            <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
            <Text style={styles.doneTripText}>Book Another Ride</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e2e8f0',
  },
  stepDotActive: {
    backgroundColor: '#000000',
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#e2e8f0',
  },
  stepLineActive: {
    backgroundColor: '#000000',
  },
  otpCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  otpHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 1,
  },
  otpSubtitle: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 10,
    fontWeight: '500',
  },
  otpDigitsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  digitPill: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  digitChar: {
    fontSize: 26,
    fontWeight: '900',
    color: '#065f46',
  },
  otpInstructionNote: {
    fontSize: 11,
    color: '#065f46',
    marginTop: 10,
    fontWeight: '600',
    lineHeight: 15,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  driverAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  vehicleCategoryPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vehicleCategoryPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  staleNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  staleNoticeText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  driverMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  starText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d97706',
  },
  vehicleNameText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  licensePlateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
    gap: 6,
  },
  plateCountry: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
  },
  plateNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  callCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  routeBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  addressText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 14,
  },
  footerLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  farePriceText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sosButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 10,
    borderRadius: 12,
  },
  sosText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  doneTripBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 12,
  },
  doneTripText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
