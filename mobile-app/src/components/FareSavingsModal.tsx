import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface FareSavingsModalProps {
  visible: boolean;
  onClose: () => void;
  onBookRide: () => void;
}

export const FareSavingsModal: React.FC<FareSavingsModalProps> = ({
  visible,
  onClose,
  onBookRide,
}) => {
  const [distanceKm, setDistanceKm] = useState<number>(5);
  const [isStudent, setIsStudent] = useState<boolean>(true);

  // Fare calculations
  const bikeBase = distanceKm * 7;
  const autoBase = distanceKm * 10;
  const cabBase = distanceKm * 15;

  const discountMultiplier = isStudent ? 0.85 : 1.0;

  const indiBike = Math.round(bikeBase * discountMultiplier);
  const indiAuto = Math.round(autoBase * discountMultiplier);
  const indiCab = Math.round(cabBase * discountMultiplier);

  // Benchmark other apps (Ola/Uber typical base + minimum surge)
  const otherBike = Math.max(40, Math.round(distanceKm * 14 + 15));
  const otherAuto = Math.max(50, Math.round(distanceKm * 16 + 10));
  const otherCab = Math.max(80, Math.round(distanceKm * 25 + 30));

  const totalSavedBike = Math.max(10, otherBike - indiBike);
  const totalSavedAuto = Math.max(15, otherAuto - indiAuto);
  const totalSavedCab = Math.max(30, otherCab - indiCab);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="calculator" size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Ride Savings Calculator</Text>
                <Text style={styles.modalSubtitle}>Transparent Pricing vs Ola / Uber</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Distance Selectors */}
            <Text style={styles.inputSectionLabel}>Select Trip Distance:</Text>
            <View style={styles.distanceChipsRow}>
              {[
                { km: 3, label: '3 km (Campus)' },
                { km: 5, label: '5 km (City/Market)' },
                { km: 10, label: '10 km (Cross-Town)' },
                { km: 15, label: '15 km (Station)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.km}
                  style={[
                    styles.distanceChip,
                    distanceKm === item.km && styles.distanceChipActive,
                  ]}
                  onPress={() => setDistanceKm(item.km)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.distanceChipText,
                      distanceKm === item.km && styles.distanceChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Student 15% OFF Switch Toggle */}
            <TouchableOpacity
              style={styles.studentToggleBox}
              onPress={() => setIsStudent(!isStudent)}
              activeOpacity={0.88}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 18 }}>🎓</Text>
                <View>
                  <Text style={styles.studentToggleTitle}>College Student Discount</Text>
                  <Text style={styles.studentToggleSub}>Extra 15% OFF with Valid Student ID</Text>
                </View>
              </View>
              <View style={[styles.switchTrack, isStudent && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, isStudent && styles.switchThumbActive]} />
              </View>
            </TouchableOpacity>

            {/* Comparison Cards */}
            <View style={styles.comparisonList}>
              {/* Bike Taxi */}
              <View style={styles.comparisonCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.vehicleIconBox, { backgroundColor: '#fff7ed' }]}>
                      <Ionicons name="bicycle" size={16} color="#ea580c" />
                    </View>
                    <View>
                      <Text style={styles.vehicleName}>Bike Taxi</Text>
                      <Text style={styles.vehicleRate}>Base: ₹7/km</Text>
                    </View>
                  </View>
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>Save ₹{totalSavedBike}</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>IndiRide Fare</Text>
                    <Text style={styles.indiPrice}>₹{indiBike}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.otherPriceLabel}>Ola / Uber (approx)</Text>
                    <Text style={styles.otherPrice}>₹{otherBike}</Text>
                  </View>
                </View>
              </View>

              {/* Auto Rickshaw */}
              <View style={styles.comparisonCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.vehicleIconBox, { backgroundColor: '#ecfdf5' }]}>
                      <MaterialCommunityIcons name="rickshaw" size={16} color="#059669" />
                    </View>
                    <View>
                      <Text style={styles.vehicleName}>Auto Rickshaw</Text>
                      <Text style={styles.vehicleRate}>Base: ₹10/km</Text>
                    </View>
                  </View>
                  <View style={[styles.savingsBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                    <Text style={[styles.savingsBadgeText, { color: '#047857' }]}>Save ₹{totalSavedAuto}</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>IndiRide Fare</Text>
                    <Text style={styles.indiPrice}>₹{indiAuto}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.otherPriceLabel}>Street Meter / Apps</Text>
                    <Text style={styles.otherPrice}>₹{otherAuto}</Text>
                  </View>
                </View>
              </View>

              {/* Cab / Car */}
              <View style={styles.comparisonCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.vehicleIconBox, { backgroundColor: '#eff6ff' }]}>
                      <Ionicons name="car-sport" size={16} color="#2563eb" />
                    </View>
                    <View>
                      <Text style={styles.vehicleName}>Cab / Mini</Text>
                      <Text style={styles.vehicleRate}>Base: ₹15/km</Text>
                    </View>
                  </View>
                  <View style={[styles.savingsBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                    <Text style={[styles.savingsBadgeText, { color: '#1d4ed8' }]}>Save ₹{totalSavedCab}</Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>IndiRide Fare</Text>
                    <Text style={styles.indiPrice}>₹{indiCab}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.otherPriceLabel}>Surge Cabs (approx)</Text>
                    <Text style={styles.otherPrice}>₹{otherCab}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Zero Surge & Transparent Guarantee */}
            <View style={styles.zeroSurgeNote}>
              <Ionicons name="flash-off" size={14} color="#059669" />
              <Text style={styles.zeroSurgeText}>
                No rain surge or peak-hour multiplier. Pay directly via UPI to drivers.
              </Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.bookNowBtn}
              onPress={() => {
                onClose();
                onBookRide();
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.bookNowBtnText}>Log In &amp; Start Saving ➔</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  distanceChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  distanceChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  distanceChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  distanceChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  distanceChipTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  studentToggleBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  studentToggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  studentToggleSub: {
    fontSize: 10,
    color: '#b45309',
    marginTop: 1,
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#d97706',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  comparisonList: {
    gap: 10,
    marginBottom: 14,
  },
  comparisonCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  vehicleRate: {
    fontSize: 10,
    color: '#64748b',
  },
  savingsBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
  },
  priceLabel: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
  },
  indiPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  otherPriceLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  otherPrice: {
    fontSize: 14,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  zeroSurgeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
  zeroSurgeText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },
  bookNowBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookNowBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
