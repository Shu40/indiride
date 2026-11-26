import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../services/api';
import { RideBooking, VehicleCategory } from '../types';

interface ActivityTabProps {
  onRebook: (
    pickup: { address: string; latitude: number; longitude: number },
    destination: { address: string; latitude: number; longitude: number },
    category: VehicleCategory
  ) => void;
  onBack?: () => void;
  onTrackActiveRide?: (ride: RideBooking) => void;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ onRebook, onBack, onTrackActiveRide }) => {
  const [rides, setRides] = useState<RideBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideBooking | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    setIsSessionExpired(false);
    try {
      const data = await api.rides.getHistory(30);
      setRides(data || []);
    } catch (e: any) {
      const msg = e?.message || 'Failed to load activity history.';
      setError(msg);
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')) {
        setIsSessionExpired(true);
      }
      setRides([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const getVehicleIcon = (category: string) => {
    switch (category) {
      case 'bike':
        return <MaterialCommunityIcons name="motorbike" size={20} color="#10b981" />;
      case 'auto':
        return <MaterialCommunityIcons name="rickshaw" size={20} color="#f59e0b" />;
      default:
        return <MaterialCommunityIcons name="car-side" size={20} color="#3b82f6" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'bike':
        return 'Camp Bike';
      case 'auto':
        return 'Camp Auto';
      default:
        return 'Camp Cab';
    }
  };

  const isActiveStatus = (status: string) =>
    [
      'SEARCHING_FOR_RIDER',
      'REQUESTS_SENT',
      'EXPANDING_SEARCH',
      'RIDER_ASSIGNED',
      'RIDER_ARRIVING',
      'RIDER_ARRIVED',
      'OTP_VERIFICATION',
      'IN_PROGRESS',
    ].includes(status);

  const activeRide = rides.find((r) => isActiveStatus(r.status));

  return (
    <View style={styles.container}>
      {/* Top Back Navigation Row */}
      {onBack && (
        <TouchableOpacity style={styles.topBackBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
          <Text style={styles.topBackBtnText}>Back to Home</Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Activity</Text>
          <TouchableOpacity onPress={loadHistory} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Verified trip history, booking status & live tracking</Text>
      </View>

      {/* Active Ongoing Trip Banner */}
      {activeRide && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() => {
            if (onTrackActiveRide) {
              onTrackActiveRide(activeRide);
            } else if (onBack) {
              onBack();
            }
          }}
          activeOpacity={0.9}
        >
          <View style={styles.activeBannerLeft}>
            <View style={styles.livePulseDot} />
            <View>
              <Text style={styles.activeBannerTitle}>Active Trip in Progress 📍</Text>
              <Text style={styles.activeBannerSub} numberOfLines={1}>
                {activeRide.status.replace(/_/g, ' ')} • To: {activeRide.destination_address}
              </Text>
            </View>
          </View>
          <View style={styles.activeBannerAction}>
            <Text style={styles.activeBannerActionText}>Track Map</Text>
            <Ionicons name="chevron-forward" size={14} color="#ffffff" />
          </View>
        </TouchableOpacity>
      )}

      {/* Body States: Loading, Error, Empty, List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="small" color="#000000" />
          <Text style={styles.loaderText}>Loading your trip history from backend...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={42} color="#ef4444" />
          <Text style={styles.errorTitle}>
            {isSessionExpired ? 'Session Expired' : 'Unable to Load Activity'}
          </Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadHistory} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="car-multiple" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No past trips yet</Text>
          <Text style={styles.emptySub}>
            Your completed and ongoing rides will appear here with fare receipts and driver details.
          </Text>
          {onBack && (
            <TouchableOpacity style={styles.emptyActionBtn} onPress={onBack} activeOpacity={0.85}>
              <Text style={styles.emptyActionText}>+ Book a Ride on Home</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
          {rides.map((ride, idx) => {
            const isCancelled = ride.status === 'CANCELLED';
            const isActive = isActiveStatus(ride.status);
            const fare = isCancelled
              ? (ride.cancellation_fee || 0)
              : (ride.final_fare || ride.estimated_fare || 0);

            const dateStr = ride.created_at?.includes('T')
              ? new Date(ride.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ride.created_at || 'Recent Ride';

            const statusLabel = isCancelled
              ? 'Cancelled'
              : ride.status === 'COMPLETED'
              ? 'Completed'
              : isActive
              ? ride.status.replace(/_/g, ' ')
              : 'Finished';

            const statusBg = isCancelled
              ? '#fee2e2'
              : ride.status === 'COMPLETED'
              ? '#dcfce7'
              : '#eff6ff';

            const statusColor = isCancelled
              ? '#b91c1c'
              : ride.status === 'COMPLETED'
              ? '#15803d'
              : '#1d4ed8';

            const paymentText = isCancelled
              ? (ride.cancellation_fee ? `Fee ₹${ride.cancellation_fee}` : 'Free Cancel')
              : ride.payment_method
              ? `${ride.payment_method.toUpperCase()} • ${ride.payment_status ? (ride.payment_status.toLowerCase() === 'completed' ? 'Paid' : ride.payment_status) : 'Pending'}`
              : 'Cash on Drop';

            return (
              <TouchableOpacity
                key={ride.id || idx}
                style={[styles.rideCard, isActive && styles.rideCardActive]}
                onPress={() => setSelectedRide(ride)}
                activeOpacity={0.85}
              >
                {/* Top Row: Vehicle Icon, Category & Fare */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.categoryLeft}>
                    <View style={styles.iconCircle}>
                      {getVehicleIcon(ride.vehicle_category)}
                    </View>
                    <View>
                      <Text style={styles.categoryName}>
                        {getCategoryTitle(ride.vehicle_category)}
                      </Text>
                      <Text style={styles.dateText}>{dateStr} • {paymentText}</Text>
                    </View>
                  </View>

                  <View style={styles.fareRight}>
                    <Text style={styles.fareAmount}>₹{Math.round(fare)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Route Visualizer */}
                <View style={styles.routeBox}>
                  <View style={styles.routeGraphic}>
                    <View style={styles.greenDot} />
                    <View style={styles.dottedLine} />
                    <View style={styles.redDot} />
                  </View>
                  <View style={styles.addressesColumn}>
                    <Text style={styles.addressText} numberOfLines={1}>
                      {ride.pickup_address}
                    </Text>
                    <Text style={[styles.addressText, styles.destAddressText]} numberOfLines={1}>
                      {ride.destination_address}
                    </Text>
                  </View>
                </View>

                {/* Cancellation Note if applicable */}
                {isCancelled && !!ride.cancellation_reason && (
                  <Text style={styles.reasonText}>
                    Cancellation reason: {ride.cancellation_reason}
                  </Text>
                )}

                {/* Action Row */}
                <View style={styles.actionRow}>
                  {isActive && (
                    <TouchableOpacity
                      style={styles.trackLiveBtn}
                      onPress={() => {
                        if (onTrackActiveRide) {
                          onTrackActiveRide(ride);
                        } else if (onBack) {
                          onBack();
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="navigate" size={13} color="#ffffff" />
                      <Text style={styles.trackLiveBtnText}>Track Live 📍</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => setSelectedRide(ride)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="information-circle-outline" size={13} color="#475569" />
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rebookBtn}
                    onPress={() =>
                      onRebook(
                        {
                          address: ride.pickup_address,
                          latitude: ride.pickup_latitude,
                          longitude: ride.pickup_longitude,
                        },
                        {
                          address: ride.destination_address,
                          latitude: ride.destination_latitude,
                          longitude: ride.destination_longitude,
                        },
                        ride.vehicle_category
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons name="repeat" size={13} color="#000000" />
                    <Text style={styles.rebookBtnText}>Rebook</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Ride Details Modal */}
      <Modal visible={selectedRide !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedRide && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Trip Details</Text>
                    <Text style={styles.modalSub}>ID: {selectedRide.id.slice(0, 13)}...</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedRide(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                  {/* Status Banner */}
                  <View style={styles.modalStatusRow}>
                    <View style={styles.modalCategory}>
                      {getVehicleIcon(selectedRide.vehicle_category)}
                      <Text style={styles.modalCategoryTitle}>
                        {getCategoryTitle(selectedRide.vehicle_category)}
                      </Text>
                    </View>
                    <View style={styles.modalFareBox}>
                      <Text style={styles.modalFareLabel}>
                        {selectedRide.status === 'CANCELLED' ? 'Cancellation Fee' : 'Total Fare'}
                      </Text>
                      <Text style={styles.modalFareVal}>
                        ₹{Math.round(selectedRide.status === 'CANCELLED' ? (selectedRide.cancellation_fee || 0) : (selectedRide.final_fare || selectedRide.estimated_fare || 0))}
                      </Text>
                    </View>
                  </View>

                  {/* Route Card */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionHeading}>ROUTE</Text>
                    <View style={styles.routeBox}>
                      <View style={styles.routeGraphic}>
                        <View style={styles.greenDot} />
                        <View style={styles.dottedLine} />
                        <View style={styles.redDot} />
                      </View>
                      <View style={styles.addressesColumn}>
                        <Text style={styles.modalAddr}>From: {selectedRide.pickup_address}</Text>
                        <Text style={[styles.modalAddr, { marginTop: 12 }]}>To: {selectedRide.destination_address}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Trip Metadata */}
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionHeading}>TRIP SPECIFICATIONS</Text>
                    <View style={styles.metaGrid}>
                      <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>Status</Text>
                        <Text style={styles.metaVal}>{selectedRide.status.replace(/_/g, ' ')}</Text>
                      </View>
                      <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>Distance</Text>
                        <Text style={styles.metaVal}>
                          {selectedRide.actual_distance_km || selectedRide.estimated_distance_km || 0} km
                        </Text>
                      </View>
                      <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>Payment</Text>
                        <Text style={styles.metaVal}>
                          {selectedRide.payment_method?.toUpperCase() || 'CASH'} ({selectedRide.payment_status || 'Paid'})
                        </Text>
                      </View>
                      <View style={styles.metaCell}>
                        <Text style={styles.metaLabel}>Date</Text>
                        <Text style={styles.metaVal}>
                          {new Date(selectedRide.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Driver Details if Assigned */}
                  {selectedRide.rider && (
                    <View style={styles.modalSection}>
                      <Text style={styles.sectionHeading}>DRIVER DETAILS</Text>
                      <View style={styles.driverBox}>
                        <View style={styles.driverAvatar}>
                          <Ionicons name="person" size={20} color="#0284c7" />
                        </View>
                        <View style={styles.driverInfo}>
                          <Text style={styles.driverName}>{selectedRide.rider.full_name}</Text>
                          <Text style={styles.driverPlate}>
                            {selectedRide.rider.vehicle_model} • {selectedRide.rider.vehicle_plate}
                          </Text>
                          <Text style={styles.driverRating}>★ {selectedRide.rider.rating || 5.0} Rating</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Actions inside modal */}
                  <View style={styles.modalActions}>
                    {isActiveStatus(selectedRide.status) && (
                      <TouchableOpacity
                        style={styles.modalTrackBtn}
                        onPress={() => {
                          setSelectedRide(null);
                          if (onTrackActiveRide) {
                            onTrackActiveRide(selectedRide);
                          } else if (onBack) {
                            onBack();
                          }
                        }}
                      >
                        <Ionicons name="navigate" size={16} color="#ffffff" />
                        <Text style={styles.modalTrackBtnText}>Track Live on Map 📍</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.modalRebookBtn}
                      onPress={() => {
                        const r = selectedRide;
                        setSelectedRide(null);
                        onRebook(
                          {
                            address: r.pickup_address,
                            latitude: r.pickup_latitude,
                            longitude: r.pickup_longitude,
                          },
                          {
                            address: r.destination_address,
                            latitude: r.destination_latitude,
                            longitude: r.destination_longitude,
                          },
                          r.vehicle_category
                        );
                      }}
                    >
                      <Ionicons name="repeat" size={16} color="#000000" />
                      <Text style={styles.modalRebookBtnText}>Rebook This Trip</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  activeBanner: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  activeBannerTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  activeBannerSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  activeBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  activeBannerActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  loaderCenter: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: '#64748b',
  },
  errorBox: {
    margin: 24,
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991b1b',
  },
  errorSub: {
    fontSize: 12,
    color: '#b91c1c',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#334155',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionBtn: {
    marginTop: 12,
    backgroundColor: '#000000',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollList: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  rideCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rideCardActive: {
    borderColor: '#3b82f6',
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  fareRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fareAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  routeBox: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 4,
  },
  routeGraphic: {
    alignItems: 'center',
    paddingVertical: 4,
    width: 14,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  dottedLine: {
    width: 1,
    height: 20,
    borderLeftWidth: 1,
    borderLeftColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  redDot: {
    width: 8,
    height: 8,
    backgroundColor: '#ef4444',
  },
  addressesColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  addressText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  destAddressText: {
    marginTop: 8,
  },
  reasonText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 6,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 8,
  },
  trackLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trackLiveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  detailsBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  rebookBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  modalClose: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  modalScroll: {
    padding: 18,
    gap: 16,
  },
  modalStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
  },
  modalCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalCategoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalFareBox: {
    alignItems: 'flex-end',
  },
  modalFareLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  modalFareVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSection: {
    gap: 6,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  modalAddr: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  metaLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  driverBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInfo: {
    gap: 2,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369a1',
  },
  driverPlate: {
    fontSize: 11,
    color: '#0284c7',
  },
  driverRating: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  modalActions: {
    gap: 10,
    marginTop: 10,
  },
  modalTrackBtn: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalTrackBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalRebookBtn: {
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalRebookBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
});
