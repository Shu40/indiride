import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CampusRideItem } from '../../types';

interface Props {
  visible: boolean;
  ride: CampusRideItem | null;
  targetTravelDate: string; // "Today", "Tomorrow", or "2026-10-22"
  onClose: () => void;
  onSuccess: () => void;
  onSubmitBooking: (rideId: string, seats: number, travelDate: string, notes?: string) => Promise<void>;
}

export const CampusBookingModal: React.FC<Props> = ({
  visible,
  ride,
  targetTravelDate,
  onClose,
  onSuccess,
  onSubmitBooking,
}) => {
  const [seats, setSeats] = useState<number>(1);
  const [pickupNotes, setPickupNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!ride) return null;

  const maxAllowedSeats = Math.max(0, ride.available_seats);
  const pricePerSeat = ride.price_per_seat;
  const totalPrice = Math.round(pricePerSeat * seats);

  const handleIncrement = () => {
    if (seats >= maxAllowedSeats) {
      Alert.alert(
        'Seat Limit Exceeded',
        `Only ${maxAllowedSeats} seat(s) are available on this date.`
      );
      return;
    }
    setSeats((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (seats > 1) {
      setSeats((prev) => prev - 1);
    }
  };

  const handleConfirm = async () => {
    if (maxAllowedSeats <= 0) {
      Alert.alert('Sold Out', 'All seats are sold out on this date.');
      return;
    }
    if (seats > maxAllowedSeats) {
      Alert.alert(
        'Seat Selection Invalid',
        `You cannot select ${seats} seats. Only ${maxAllowedSeats} seat(s) remain.`
      );
      return;
    }

    setLoading(true);
    try {
      await onSubmitBooking(ride.id, seats, targetTravelDate, pickupNotes.trim() || undefined);
      Alert.alert(
        'Booking Request Sent! ⏳',
        `Your request for ${seats} seat(s) was sent to ${ride.creator_name}.\nDriver phone and direct chat unlock immediately upon driver confirmation!`
      );
      setSeats(1);
      setPickupNotes('');
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Booking Error', e.message || 'Could not complete booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Reserve Campus Seat</Text>
              <Text style={styles.headerSub}>Date: {targetTravelDate}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Ride Details Summary */}
          <View style={styles.rideSummary}>
            <View style={styles.routeItem}>
              <Ionicons name="location" size={16} color="#10b981" />
              <Text style={styles.routeText} numberOfLines={1}>
                {ride.pickup_address}
              </Text>
            </View>
            <Ionicons name="arrow-down" size={14} color="#94a3b8" style={{ marginLeft: 2 }} />
            <View style={styles.routeItem}>
              <Ionicons name="location" size={16} color="#ef4444" />
              <Text style={styles.routeText} numberOfLines={1}>
                {ride.destination_address}
              </Text>
            </View>
          </View>

          {/* Availability Alert */}
          <View style={[styles.availBox, maxAllowedSeats <= 1 && styles.availBoxWarning]}>
            <Ionicons
              name={maxAllowedSeats > 0 ? 'information-circle' : 'alert-circle'}
              size={16}
              color={maxAllowedSeats > 0 ? '#0284c7' : '#ef4444'}
            />
            <Text style={[styles.availText, maxAllowedSeats <= 0 && { color: '#ef4444' }]}>
              {maxAllowedSeats > 0
                ? `${maxAllowedSeats} seat(s) available on this date`
                : 'All seats are full for this date!'}
            </Text>
          </View>

          {/* Seat Counter */}
          <View style={styles.counterRow}>
            <Text style={styles.counterLabel}>Number of Seats:</Text>
            <View style={styles.counterControls}>
              <TouchableOpacity
                style={[styles.counterBtn, seats <= 1 && styles.counterBtnDisabled]}
                onPress={handleDecrement}
                disabled={seats <= 1}
              >
                <Ionicons name="remove" size={18} color={seats <= 1 ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>

              <Text style={styles.seatNumber}>{seats}</Text>

              <TouchableOpacity
                style={[styles.counterBtn, seats >= maxAllowedSeats && styles.counterBtnDisabled]}
                onPress={handleIncrement}
                disabled={seats >= maxAllowedSeats}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={seats >= maxAllowedSeats ? '#cbd5e1' : '#0f172a'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fare Breakdown */}
          <View style={styles.fareBreakdown}>
            <View style={styles.fareLine}>
              <Text style={styles.fareLineLabel}>Fuel Split / Seat:</Text>
              <Text style={styles.fareLineVal}>₹{pricePerSeat}</Text>
            </View>
            <View style={styles.fareLine}>
              <Text style={styles.fareLineLabel}>Selected Seats:</Text>
              <Text style={styles.fareLineVal}>× {seats}</Text>
            </View>
            <View style={[styles.fareLine, styles.fareLineTotal]}>
              <Text style={styles.totalLabel}>Total Fuel Contribution:</Text>
              <Text style={styles.totalVal}>₹{totalPrice}</Text>
            </View>
          </View>

          {/* Optional Pickup Note */}
          <TextInput
            style={styles.notesInput}
            placeholder="Pickup notes (e.g. waiting near hostel main gate)"
            placeholderTextColor="#94a3b8"
            value={pickupNotes}
            onChangeText={setPickupNotes}
          />

          {/* Actions */}
          <TouchableOpacity
            style={[styles.confirmBtn, (maxAllowedSeats <= 0 || loading) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={maxAllowedSeats <= 0 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                <Text style={styles.confirmBtnText}>
                  {maxAllowedSeats <= 0 ? 'Sold Out' : `Request Seat (₹${totalPrice})`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 440,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  rideSummary: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  availBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0f2fe',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  availBoxWarning: {
    backgroundColor: '#fee2e2',
  },
  availText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 6,
  },
  counterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  counterBtnDisabled: {
    backgroundColor: '#f8fafc',
    elevation: 0,
  },
  seatNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    paddingHorizontal: 16,
  },
  fareBreakdown: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  fareLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  fareLineLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  fareLineVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  fareLineTotal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 14,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
