import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MatchingRadarProps {
  searchRadiusKm: number;
  initialSecondsElapsed?: number;
  estimatedFare?: number;
  boostAmount?: number;
  onBoostFare?: (newBoostAmount: number) => void;
  isBoosting?: boolean;
  onCancel: () => void;
}

export const MatchingRadar: React.FC<MatchingRadarProps> = ({
  searchRadiusKm = 2.0,
  initialSecondsElapsed = 0,
  estimatedFare = 0,
  boostAmount = 0,
  onBoostFare,
  isBoosting = false,
  onCancel,
}) => {
  const safeInitial = Math.max(0, Math.min(300, initialSecondsElapsed || 0));
  const [secondsElapsed, setSecondsElapsed] = useState(safeInitial);

  useEffect(() => {
    setSecondsElapsed(Math.max(0, Math.min(300, initialSecondsElapsed || 0)));
  }, [initialSecondsElapsed]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= 300) {
          return 300;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const BOOST_OPTIONS = [10, 20, 30, 40];

  return (
    <View style={styles.container}>
      {/* Radar Animation Area */}
      <View style={styles.radarCircleOuter}>
        <View style={styles.radarCircleMid}>
          <View style={styles.radarCircleInner}>
            <Ionicons name="car" size={26} color="#ffffff" />
          </View>
        </View>
      </View>

      <Text style={styles.title}>
        {searchRadiusKm > 2.0
          ? `Expanding Search Area (${searchRadiusKm} km)`
          : `Finding Nearby Drivers (${searchRadiusKm} km)`}
      </Text>
      <Text style={styles.subtitle}>
        Dispatching request to nearest verified riders within 2-3 km...
      </Text>

      <View style={styles.timerBadge}>
        <ActivityIndicator size="small" color="#10b981" style={{ marginRight: 6 }} />
        <Text style={styles.timerText}>Searching: {formatTimer(secondsElapsed)}</Text>
      </View>

      {/* Dynamic Driver Incentive / Fare Boost Box */}
      <View style={styles.boostCard}>
        <View style={styles.boostHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flash" size={17} color="#f59e0b" />
            <Text style={styles.boostTitle}>Get Picked Up Faster</Text>
          </View>
          {boostAmount > 0 && (
            <View style={styles.activeBoostBadge}>
              <Text style={styles.activeBoostBadgeText}>+₹{boostAmount} Active 🔥</Text>
            </View>
          )}
        </View>

        <Text style={styles.boostSubtitle}>
          Slow to find a driver? Increase your offer by up to +₹40 to motivate nearby drivers to accept instantly.
        </Text>

        <View style={styles.boostChipsRow}>
          {BOOST_OPTIONS.map((amount) => {
            const isSelected = boostAmount === amount;
            return (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.boostChip,
                  isSelected && styles.boostChipSelected,
                  isBoosting && { opacity: 0.6 }
                ]}
                disabled={isBoosting}
                onPress={() => onBoostFare && onBoostFare(amount)}
                activeOpacity={0.7}
              >
                <Text style={[styles.boostChipText, isSelected && styles.boostChipTextSelected]}>
                  +₹{amount}
                </Text>
              </TouchableOpacity>
            );
          })}

          {boostAmount > 0 && (
            <TouchableOpacity
              style={[styles.boostChipReset, isBoosting && { opacity: 0.6 }]}
              disabled={isBoosting}
              onPress={() => onBoostFare && onBoostFare(0)}
              activeOpacity={0.7}
            >
              <Text style={styles.boostChipResetText}>Reset (₹0)</Text>
            </TouchableOpacity>
          )}
        </View>

        {isBoosting ? (
          <View style={styles.boostingLoaderRow}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={styles.boostingLoaderText}>Updating driver offer...</Text>
          </View>
        ) : (
          <View style={styles.fareSummaryRow}>
            <Text style={styles.fareSummaryLabel}>Total Driver Offer:</Text>
            <Text style={styles.fareSummaryValue}>₹{Math.round(estimatedFare)}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancel Search</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  radarCircleOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  radarCircleMid: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircleInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(16,185,129,0.35)',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  boostCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  boostHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  boostTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  activeBoostBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBoostBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  boostSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  boostChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  boostChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 54,
    alignItems: 'center',
  },
  boostChipSelected: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  boostChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  boostChipTextSelected: {
    color: '#ffffff',
  },
  boostChipReset: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  boostChipResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  boostingLoaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  boostingLoaderText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
  },
  fareSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  fareSummaryLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  fareSummaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  driverAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  driverAppBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
  },
  simulateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
