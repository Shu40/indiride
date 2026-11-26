import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { VehicleFareEstimate, VehicleCategory } from '../types';

interface VehicleSelectorProps {
  estimates: VehicleFareEstimate[];
  selectedCategory: VehicleCategory;
  onSelect: (category: VehicleCategory) => void;
  appliedPromo?: string | null;
  paymentMethod?: string;
  onTogglePaymentMethod?: () => void;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  estimates,
  selectedCategory,
  onSelect,
  appliedPromo,
  paymentMethod = 'Cash on Drop',
  onTogglePaymentMethod,
}) => {
  const [detailModalItem, setDetailModalItem] = useState<VehicleFareEstimate | null>(null);

  if (!estimates || estimates.length === 0) {
    return null;
  }

  const getVehicleAsset = (category: VehicleCategory, ratePerKm?: number) => {
    switch (category) {
      case 'bike':
        return {
          image: require('../../assets/vehicles/bike.png'),
          bg: '#ecfdf5',
          title: 'General Bike (Splendor)',
          sub: `Hero Splendor, Shine • ₹${ratePerKm || 7}/km`,
        };
      case 'bullet':
        return {
          image: require('../../assets/vehicles/bullet.png'),
          bg: '#fee2e2',
          title: 'Bullet / KTM Superbike',
          sub: `Royal Enfield, KTM Duke • ₹${ratePerKm || 13}/km`,
        };
      case 'auto':
        return {
          image: require('../../assets/vehicles/auto.png'),
          bg: '#fef3c7',
          title: 'Camp Auto',
          sub: `Doorstep metered auto • ₹${ratePerKm || 10}/km`,
        };
      case 'car':
        return {
          image: require('../../assets/vehicles/car.png'),
          bg: '#eff6ff',
          title: 'Economy Car (Cab)',
          sub: `Swift, WagonR, Tiago AC • ₹${ratePerKm || 15}/km`,
        };
      case 'car_pro':
        return {
          image: require('../../assets/vehicles/car_pro.png'),
          bg: '#ede9fe',
          title: 'Pro Car / Sedan (AC)',
          sub: `Innova Crysta, Honda City AC • ₹${ratePerKm || 22}/km`,
        };
      default:
        return {
          image: require('../../assets/vehicles/car.png'),
          bg: '#f1f5f9',
          title: 'Ride',
          sub: `Standard ride • ₹${ratePerKm || 15}/km`,
        };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>RECOMMENDED RIDES</Text>
        <Text style={styles.distanceBadge}>{estimates[0]?.distance_km} km</Text>
      </View>

      <View style={styles.cardList}>
        {estimates.map((item) => {
          const isSelected = item.category === selectedCategory;
          const meta = getVehicleAsset(item.category, item.rate_per_km);
          const hasDiscount = item.original_fare && item.original_fare > item.estimated_fare;

          return (
            <TouchableOpacity
              key={item.category}
              style={[styles.card, isSelected && styles.selectedCard]}
              onPress={() => onSelect(item.category)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
                <Image source={meta.image} style={styles.vehicleImg} resizeMode="contain" />
              </View>

              <View style={styles.infoCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.vehicleTitle}>{meta.title}</Text>
                  <View style={styles.capacityBadge}>
                    <Ionicons name="person" size={10} color="#6b7280" />
                    <Text style={styles.capacityText}>{item.capacity}</Text>
                  </View>
                </View>

                <Text style={styles.etaText}>
                  {item.eta_minutes} mins away • ₹{item.rate_per_km}/km
                </Text>
                <Text style={styles.subText} numberOfLines={1}>
                  {meta.sub}
                </Text>
              </View>

              <View style={styles.fareCol}>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>₹{Math.round(item.original_fare!)}</Text>
                )}
                <Text style={styles.farePrice}>₹{Math.round(item.estimated_fare)}</Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setDetailModalItem(item);
                  }}
                  style={styles.infoIconBtn}
                >
                  <Ionicons name="information-circle-outline" size={16} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Payment Method Selector Bar */}
      <View style={styles.paymentBar}>
        <TouchableOpacity
          style={styles.paymentMethod}
          onPress={onTogglePaymentMethod}
          activeOpacity={0.7}
        >
          <Ionicons
            name={
              paymentMethod === 'UPI / QR'
                ? 'qr-code-outline'
                : paymentMethod === 'IndiRide Wallet'
                ? 'wallet-outline'
                : 'cash-outline'
            }
            size={18}
            color="#059669"
          />
          <Text style={styles.paymentText}>{paymentMethod}</Text>
          <Ionicons name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>

        <View style={[styles.promoBadge, appliedPromo ? { backgroundColor: '#fef3c7' } : null]}>
          <Ionicons
            name="pricetag-outline"
            size={14}
            color={appliedPromo ? '#d97706' : '#2563eb'}
          />
          <Text style={[styles.promoText, appliedPromo ? { color: '#b45309' } : null]}>
            {appliedPromo ? `${appliedPromo} Applied` : 'DIWALI50 Available'}
          </Text>
        </View>
      </View>

      {/* Transparent Fare Breakdown Modal */}
      {detailModalItem && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>Fare Breakdown</Text>
                <TouchableOpacity onPress={() => setDetailModalItem(null)}>
                  <Ionicons name="close" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalRideName}>{detailModalItem.display_name}</Text>
              <Text style={styles.modalRideDist}>
                Estimated Route: {detailModalItem.distance_km} km ({detailModalItem.duration_minutes} mins)
              </Text>

              <View style={styles.breakdownTable}>
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>Base Fare</Text>
                  <Text style={styles.tableValue}>₹{detailModalItem.fare_breakdown.base_fare.toFixed(2)}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableLabel}>
                    Distance Charge ({detailModalItem.distance_km} km @ ₹{detailModalItem.rate_per_km}/km)
                  </Text>
                  <Text style={styles.tableValue}>₹{detailModalItem.fare_breakdown.distance_fare.toFixed(2)}</Text>
                </View>
                {detailModalItem.fare_breakdown.surge_amount > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Surge Multiplier</Text>
                    <Text style={[styles.tableValue, { color: '#ef4444' }]}>
                      +₹{detailModalItem.fare_breakdown.surge_amount.toFixed(2)}
                    </Text>
                  </View>
                )}
                {detailModalItem.fare_breakdown.tax_amount > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>GST / Service Tax ({detailModalItem.fare_breakdown.tax_percent}%)</Text>
                    <Text style={styles.tableValue}>₹{detailModalItem.fare_breakdown.tax_amount.toFixed(2)}</Text>
                  </View>
                )}
                {detailModalItem.fare_breakdown.discount_amount !== undefined &&
                  detailModalItem.fare_breakdown.discount_amount > 0 && (
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableLabel, { color: '#16a34a', fontWeight: '700' }]}>
                        Festive Discount ({detailModalItem.fare_breakdown.discount_code || 'APPLIED'})
                      </Text>
                      <Text style={[styles.tableValue, { color: '#16a34a', fontWeight: '700' }]}>
                        -₹{detailModalItem.fare_breakdown.discount_amount.toFixed(2)}
                      </Text>
                    </View>
                  )}

                <View style={[styles.tableRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Fare</Text>
                  <Text style={styles.totalValue}>₹{detailModalItem.estimated_fare.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setDetailModalItem(null)}
              >
                <Text style={styles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.8,
  },
  distanceBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  cardList: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: '#f3f4f6',
  },
  selectedCard: {
    borderColor: '#000000',
    backgroundColor: '#f8fafc',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vehicleImg: {
    width: 44,
    height: 44,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  capacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  capacityText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  etaText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  subText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  fareCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  originalPrice: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
    marginBottom: -2,
  },
  farePrice: {
    fontSize: 19,
    fontWeight: '900',
    color: '#000000',
  },
  infoIconBtn: {
    padding: 2,
    marginTop: 2,
  },
  paymentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  promoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  modalRideName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#059669',
  },
  modalRideDist: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 16,
  },
  breakdownTable: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  tableLabel: {
    fontSize: 13,
    color: '#475569',
  },
  tableValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 10,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
  doneBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
