import '../../src/utils/suppressWarnings';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Modal,
  Switch,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

export default function AdminScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [overview, setOverview] = useState<any>(null);
  const [riders, setRiders] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [fareConfigs, setFareConfigs] = useState<any[]>([]);
  const [carpools, setCarpools] = useState<any[]>([]);
  const [scheduledRides, setScheduledRides] = useState<any[]>([]);
  const [campusVehicles, setCampusVehicles] = useState<any[]>([]);
  const [campusDrivers, setCampusDrivers] = useState<any[]>([]);
  const [promoCodesList, setPromoCodesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'fares' | 'campaign' | 'riders' | 'rides' | 'carpools' | 'scheduled' | 'campus_vehicles' | 'promos' | 'loyalty'
  >('overview');
  const [dispatching, setDispatching] = useState(false);

  // Loyalty & New User state
  const [loyaltyConfig, setLoyaltyConfig] = useState<any>(null);
  const [loyaltyUsers, setLoyaltyUsers] = useState<any[]>([]);
  const [newUserDiscountPct, setNewUserDiscountPct] = useState('90');
  const [newUserMaxDisc, setNewUserMaxDisc] = useState('150');
  const [isNewUserDiscountActive, setIsNewUserDiscountActive] = useState(true);
  const [savingLoyaltyCfg, setSavingLoyaltyCfg] = useState(false);


  // Rates editor state
  const [bikeRate, setBikeRate] = useState('7.0');
  const [carRate, setCarRate] = useState('15.0');
  const [autoRate, setAutoRate] = useState('10.0');
  const [savingRates, setSavingRates] = useState(false);

  // Festive campaign management state
  const [festivalName, setFestivalName] = useState('Diwali');
  const [bannerTitle, setBannerTitle] = useState('🪔 Shubh Diwali Festive Dhamaka');
  const [bannerSubtitle, setBannerSubtitle] = useState('Celebrate the Festival of Lights with 50% OFF on all Bike & Auto rides!');
  const [discountPercent, setDiscountPercent] = useState('50');
  const [promoCode, setPromoCode] = useState('DIWALI50');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campaignStatus, setCampaignStatus] = useState<string>('inactive');
  const [isFestivalActive, setIsFestivalActive] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  // Promo code creation modal state
  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('20');
  const [newPromoMaxDisc, setNewPromoMaxDisc] = useState('100');
  const [newPromoMinOrder, setNewPromoMinOrder] = useState('50');
  const [newPromoDesc, setNewPromoDesc] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Rider Approval & Document Inspection state
  const [riderFilter, setRiderFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [selectedZoomPhoto, setSelectedZoomPhoto] = useState<{ url: string; title: string; driverName: string } | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRider, setRejectingRider] = useState<any | null>(null);
  const [customRejectReason, setCustomRejectReason] = useState('');

  const pendingRiders = useMemo(() => riders.filter((r) => (r.status || '').toLowerCase() === 'pending'), [riders]);
  const approvedRiders = useMemo(() => riders.filter((r) => (r.status || '').toLowerCase() === 'approved'), [riders]);
  const rejectedRiders = useMemo(() => riders.filter((r) => (r.status || '').toLowerCase() === 'rejected'), [riders]);

  const displayedRiders = useMemo(() => {
    if (riderFilter === 'pending') return pendingRiders;
    if (riderFilter === 'approved') return approvedRiders;
    if (riderFilter === 'rejected') return rejectedRiders;
    return riders;
  }, [riders, riderFilter, pendingRiders, approvedRiders, rejectedRiders]);

  // Route boundary security: Only admin users can access this screen
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    if (user?.role !== 'admin') {
      // Silently redirect to their respective home dashboard without any admin error prompt
      if (user?.role === 'rider') {
        router.replace('/(rider)');
      } else {
        router.replace('/(passenger)');
      }
      return;
    }
    loadAllData();
  }, [isAuthenticated, user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ov, rds, rlist, cfgs, fest, cps, sched, cvs, prms, cdrivers, lcfg, lusers] = await Promise.all([
        api.admin.getOverview(),
        api.admin.getRiders(),
        api.admin.getRides(undefined, 20),
        api.fare.getConfigs(),
        api.admin.getFestival().catch(() => null),
        api.admin.getCarpools().catch(() => []),
        api.admin.getScheduledRides().catch(() => []),
        api.admin.getCampusVehicles().catch(() => []),
        api.admin.getPromoCodes().catch(() => []),
        api.admin.getCampusDrivers().catch(() => []),
        api.admin.getLoyaltyConfig().catch(() => null),
        api.admin.getLoyaltyUsers().catch(() => []),
      ]);
      setOverview(ov);
      setRiders(rds);
      setRides(rlist);
      setFareConfigs(cfgs);
      setCarpools(cps || []);
      setScheduledRides(sched || []);
      setCampusVehicles(cvs || []);
      setCampusDrivers(cdrivers || []);
      setPromoCodesList(prms || []);
      if (lcfg) {
        setLoyaltyConfig(lcfg);
        if (lcfg.new_user_discount) {
          setNewUserDiscountPct(String(lcfg.new_user_discount.discount_percent || 90));
          setNewUserMaxDisc(String(lcfg.new_user_discount.max_discount_amount || 150));
          setIsNewUserDiscountActive(lcfg.new_user_discount.is_active ?? true);
        }
      }
      setLoyaltyUsers(lusers || []);

      // Populate fare inputs
      cfgs.forEach((c: any) => {
        if (c.vehicle_category === 'bike') setBikeRate(String(c.per_km_rate));
        if (c.vehicle_category === 'car') setCarRate(String(c.per_km_rate));
        if (c.vehicle_category === 'auto') setAutoRate(String(c.per_km_rate));
      });

      // Populate festival campaign inputs
      if (fest) {
        setFestivalName(fest.festival_name || '');
        setBannerTitle(fest.banner_title || '');
        setBannerSubtitle(fest.banner_subtitle || '');
        setDiscountPercent(String(fest.discount_percent ?? 10));
        setPromoCode(fest.promo_code || '');
        setIsFestivalActive(fest.is_active ?? false);
        setStartDate(fest.start_date ? fest.start_date.substring(0, 10) : '');
        setEndDate(fest.end_date ? fest.end_date.substring(0, 10) : '');
        setCampaignStatus(fest.status || (fest.is_active ? 'live' : 'inactive'));
      }
    } catch (e: any) {
      console.error('Admin data load error:', e);
      Alert.alert('Error', e.message || 'Failed to load admin metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleModerateCarpool = async (rideId: string) => {
    Alert.alert(
      'Moderate Carpool',
      'Are you sure you want to cancel this carpool ride for policy compliance? All reserved passenger seats will be cancelled and refunded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.admin.moderateCarpool(rideId, 'CANCEL', 'Administrative safety and policy moderation');
              Alert.alert('Moderated', 'Carpool ride and passenger reservations have been cancelled.');
              loadAllData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to moderate carpool');
            }
          },
        },
      ]
    );
  };

  const handleDispatchScheduled = async () => {
    setDispatching(true);
    try {
      const res = await api.rides.dispatchScheduledRides(60);
      Alert.alert(
        'Scheduled Dispatch Engine',
        `Dispatched ${res.dispatched_count || 0} upcoming rides to driver search queue.`
      );
      loadAllData();
    } catch (err: any) {
      Alert.alert('Dispatch Error', err.message || 'Failed to run dispatch engine');
    } finally {
      setDispatching(false);
    }
  };

  const handleUpdateRiderStatus = async (riderUserId: string, status: 'approved' | 'rejected' | 'suspended', reason?: string) => {
    try {
      await api.admin.updateRiderStatus(riderUserId, status, reason || 'Admin console verification');
      Alert.alert(
        status === 'approved' ? 'Rider Approved! ✅' : (status === 'rejected' ? 'Rider Declined ❌' : 'Status Updated'),
        `Driver status changed to ${status}.`
      );
      setShowRejectModal(false);
      setRejectingRider(null);
      setCustomRejectReason('');
      loadAllData();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    }
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    try {
      await Promise.all([
        api.fare.updateConfig('bike', { per_km_rate: parseFloat(bikeRate) }),
        api.fare.updateConfig('car', { per_km_rate: parseFloat(carRate) }),
        api.fare.updateConfig('auto', { per_km_rate: parseFloat(autoRate) }),
      ]);
      Alert.alert('Rates Saved', 'Platform per-km fare rates updated successfully!');
      loadAllData();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSavingRates(false);
    }
  };

  const handleSaveFestival = async () => {
    setSavingCampaign(true);
    try {
      await api.admin.updateFestival({
        festival_name: festivalName.trim(),
        tagline: bannerSubtitle || bannerTitle,
        banner_title: bannerTitle.trim(),
        banner_subtitle: bannerSubtitle.trim(),
        discount_percent: parseInt(discountPercent, 10) || 10,
        promo_code: promoCode.trim().toUpperCase(),
        start_date: startDate.trim() || undefined,
        end_date: endDate.trim() || undefined,
        is_active: isFestivalActive,
      });
      await loadAllData();
      Alert.alert(
        'Campaign Saved! 🎉',
        `'${festivalName}' is set.${endDate ? ` It will auto-expire on ${endDate}.` : ''}`
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not save campaign');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleDeleteFestival = async () => {
    Alert.alert(
      'Delete / End Offer?',
      'This will immediately remove this offer from all passenger screens.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Remove',
          style: 'destructive',
          onPress: async () => {
            setDeletingCampaign(true);
            try {
              await api.admin.deleteFestival();
              setIsFestivalActive(false);
              setCampaignStatus('expired');
              await loadAllData();
              Alert.alert('Offer Deleted', 'Campaign has ended and is now hidden from users.');
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete campaign');
            } finally {
              setDeletingCampaign(false);
            }
          },
        },
      ]
    );
  };

  const applyFestivalPreset = (name: string, title: string, sub: string, code: string, discount: number) => {
    setFestivalName(name);
    setBannerTitle(title);
    setBannerSubtitle(sub);
    setPromoCode(code);
    setDiscountPercent(String(discount));
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setStartDate(now.toISOString().substring(0, 10));
    setEndDate(end.toISOString().substring(0, 10));
    setIsFestivalActive(true);
  };

  const handleUpdateCampusVehicleStatus = async (profileId: string, status: 'VERIFIED' | 'BLOCKED' | 'PENDING') => {
    try {
      await api.admin.updateCampusVehicleStatus(profileId, status);
      Alert.alert('Status Updated', `Vehicle registration marked as ${status}.`);
      loadAllData();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update vehicle status');
    }
  };

  const handleTogglePromoCode = async (codeId: string) => {
    try {
      const res = await api.admin.togglePromoCode(codeId);
      Alert.alert('Promo Code', res.message || 'Promo status updated');
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to toggle promo code');
    }
  };

  const handleDeletePromoCode = async (codeId: string) => {
    Alert.alert(
      'Delete Promo Code',
      'Are you sure you want to permanently delete this discount offer code?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.admin.deletePromoCode(codeId);
              Alert.alert('Deleted', 'Promo code removed successfully');
              loadAllData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete promo');
            }
          },
        },
      ]
    );
  };

  const handleCreatePromoCode = async () => {
    if (!newPromoCode.trim()) {
      Alert.alert('Code Required', 'Please enter a valid uppercase promo code (e.g. CAMPUS30)');
      return;
    }
    const disc = parseInt(newPromoDiscount, 10);
    if (isNaN(disc) || disc <= 0 || disc > 100) {
      Alert.alert('Invalid Discount', 'Discount percent must be between 1 and 100');
      return;
    }
    setCreatingPromo(true);
    try {
      await api.admin.createPromoCode({
        code: newPromoCode.trim().toUpperCase(),
        discount_percent: disc,
        max_discount_amount: parseFloat(newPromoMaxDisc) || 100,
        min_order_amount: parseFloat(newPromoMinOrder) || 0,
        description: newPromoDesc.trim() || undefined,
      });
      Alert.alert('Promo Code Created! 🎟️', `Code ${newPromoCode.trim().toUpperCase()} is now live.`);
      setShowAddPromoModal(false);
      setNewPromoCode('');
      setNewPromoDesc('');
      loadAllData();
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message || 'Could not create promo code');
    } finally {
      setCreatingPromo(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  const handleSaveLoyaltyConfig = async () => {
    setSavingLoyaltyCfg(true);
    try {
      const updated = await api.admin.updateLoyaltyConfig({
        discount_percent: parseFloat(newUserDiscountPct) || 90,
        max_discount_amount: parseFloat(newUserMaxDisc) || 150,
        is_active: isNewUserDiscountActive,
      });
      Alert.alert('Loyalty Config Saved! 🎉', 'New user 1st ride discount configuration updated successfully.');
      setLoyaltyConfig((prev: any) => ({
        ...prev,
        new_user_discount: updated.config,
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update loyalty config');
    } finally {
      setSavingLoyaltyCfg(false);
    }
  };

  const handleGrantVoucher = async (userId: string, userName: string) => {
    try {
      await api.admin.grantVoucher(userId, 1);
      Alert.alert('Voucher Granted! 🎁', `1 Free Ride Voucher granted to ${userName}`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to grant voucher');
    }
  };

  const handleSetTrips = async (userId: string, userName: string, trips: number) => {
    try {
      const res = await api.admin.setUserTrips(userId, trips);
      Alert.alert('Trips Updated! 🚀', `${userName} is now at ${trips} rides (${res.tier})`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update trips');
    }
  };

  return (
    <View style={styles.container}>
      {/* Admin Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield" size={20} color="#8b5cf6" />
            </View>
            <View>
              <Text style={styles.adminName}>Super Admin Console</Text>
              <Text style={styles.adminSub}>Platform Governance & Fare Engine</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace('/(auth)/login');
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {(['overview', 'fares', 'loyalty', 'campaign', 'riders', 'rides', 'carpools', 'scheduled', 'campus_vehicles', 'promos'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'fares'
                  ? 'Fare Engine'
                  : tab === 'loyalty'
                  ? 'User Levels & 90% 1st Ride 🏆'
                  : tab === 'campaign'
                  ? 'Festivals 🪔'
                  : tab === 'riders'
                  ? `Driver Approvals 📋 ${pendingRiders.length > 0 ? `(${pendingRiders.length} Pending)` : `(${riders.length})`}`
                  : tab === 'rides'
                  ? 'Trips'
                  : tab === 'carpools'
                  ? `Carpools (${carpools.length})`
                  : tab === 'scheduled'
                  ? `Scheduled (${scheduledRides.length})`
                  : tab === 'campus_vehicles'
                  ? `🎓 Campus Drivers (${campusDrivers.length})`
                  : `Promo Codes (${promoCodesList.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loaderText}>Loading platform metrics...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {/* TAB 1: OVERVIEW METRICS */}
          {activeTab === 'overview' && overview && (
            <View>
              {/* Official 1-Month Featured Partner Banner: HubDwar.online */}
              <View style={styles.hubdwarAdminBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: '#4f46e5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 }}>OFFICIAL PARTNERSHIP</Text>
                    </View>
                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#b45309' }}>ACTIVE FOR 30 DAYS</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="code-tags" size={18} color="#4f46e5" />
                </View>

                <Text style={{ fontSize: 15, fontWeight: '800', color: '#1e1b4b', marginBottom: 2 }}>
                  🚀 HubDwar (hubdwar.online) Is Live!
                </Text>
                <Text style={{ fontSize: 12, color: '#4338ca', lineHeight: 18, marginBottom: 10 }}>
                  India's biggest upcoming AI career &amp; coding platform for Coding Interview Prep, AI Mock Interviews, ATS Resume Builder, and curated Company Opportunities &amp; Internships.
                </Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#4f46e5',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.open('https://hubdwar.online', '_blank');
                    }
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons name="open-outline" size={15} color="#ffffff" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#ffffff' }}>
                    Visit HubDwar.online ➔
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionHeader}>PLATFORM METRICS</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{overview.passengers}</Text>
                  <Text style={styles.statLabel}>Total Passengers</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: '#3b82f6' }]}>{overview.riders.total}</Text>
                  <Text style={styles.statLabel}>Total Drivers ({overview.riders.online} Online)</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: '#f59e0b' }]}>{overview.riders.pending_approvals}</Text>
                  <Text style={styles.statLabel}>Pending Driver Approvals</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: '#10b981' }]}>{overview.trips.active}</Text>
                  <Text style={styles.statLabel}>Active Trips Now</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{overview.trips.total}</Text>
                  <Text style={styles.statLabel}>Total Lifetime Trips</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: '#059669' }]}>
                    ₹{Math.round(overview.revenue.total_gross_inr)}
                  </Text>
                  <Text style={styles.statLabel}>Gross Booking Revenue</Text>
                </View>
              </View>

              {/* Commission Card */}
              <View style={styles.commissionCard}>
                <Text style={styles.commTitle}>Platform Revenue (20% Net Commission)</Text>
                <Text style={styles.commValue}>₹{Math.round(overview.revenue.platform_commission_20pct)}</Text>
                <Text style={styles.commSub}>Automatically calculated from completed rides</Text>
              </View>
            </View>
          )}

          {/* TAB 2: FARE ENGINE & CONFIGURATION */}
          {activeTab === 'fares' && (
            <View>
              <Text style={styles.sectionHeader}>VEHICLE FARE RATES ENGINE</Text>
              <Text style={styles.sectionSub}>
                Platform base pricing rules: Bike default ₹7/km, Car default ₹15/km.
              </Text>

              <View style={styles.rateCard}>
                <View style={styles.rateRow}>
                  <View style={styles.rateHeaderRow}>
                    <MaterialCommunityIcons name="motorbike" size={24} color="#10b981" />
                    <Text style={styles.rateVehicleName}>Bike / Moto Rate</Text>
                  </View>
                  <View style={styles.rateInputRow}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.rateInput}
                      keyboardType="numeric"
                      value={bikeRate}
                      onChangeText={setBikeRate}
                    />
                    <Text style={styles.ratePerKm}>/ km</Text>
                  </View>
                </View>

                <View style={styles.rateRow}>
                  <View style={styles.rateHeaderRow}>
                    <MaterialCommunityIcons name="car-side" size={24} color="#3b82f6" />
                    <Text style={styles.rateVehicleName}>Car / Cab Rate</Text>
                  </View>
                  <View style={styles.rateInputRow}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.rateInput}
                      keyboardType="numeric"
                      value={carRate}
                      onChangeText={setCarRate}
                    />
                    <Text style={styles.ratePerKm}>/ km</Text>
                  </View>
                </View>

                <View style={styles.rateRow}>
                  <View style={styles.rateHeaderRow}>
                    <MaterialCommunityIcons name="rickshaw" size={24} color="#f59e0b" />
                    <Text style={styles.rateVehicleName}>Auto Rickshaw Rate</Text>
                  </View>
                  <View style={styles.rateInputRow}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.rateInput}
                      keyboardType="numeric"
                      value={autoRate}
                      onChangeText={setAutoRate}
                    />
                    <Text style={styles.ratePerKm}>/ km</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.saveRatesBtn}
                  onPress={handleSaveRates}
                  disabled={savingRates}
                >
                  {savingRates ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveRatesText}>Save Updated Rates</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB: USER LEVELS & 90% FIRST-RIDE CONTROLLER */}
          {activeTab === 'loyalty' && (
            <View>
              <Text style={styles.sectionHeader}>USER LEVELS & 90% FIRST-RIDE CONTROLLER 🏆</Text>
              <Text style={styles.sectionSub}>
                Manage automatic first-ride 90% discounts for new users and inspect the 4 milestone loyalty tiers.
              </Text>

              {/* SECTION 1: NEW USER FIRST-RIDE DISCOUNT CONFIG */}
              <View style={styles.adminCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>🎉 New User 1st Ride Discount</Text>
                    <Text style={styles.cardSub}>Auto-applied on the passenger's very first ride</Text>
                  </View>
                  <Switch
                    value={isNewUserDiscountActive}
                    onValueChange={setIsNewUserDiscountActive}
                    trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
                    thumbColor={isNewUserDiscountActive ? '#10b981' : '#f43f5e'}
                  />
                </View>

                <View style={styles.twoInputsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalFieldLabel}>DISCOUNT PERCENTAGE (%)</Text>
                    <TextInput
                      style={styles.adminInputField}
                      value={newUserDiscountPct}
                      onChangeText={setNewUserDiscountPct}
                      keyboardType="number-pad"
                      placeholder="e.g. 90"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalFieldLabel}>MAX DISCOUNT CAP (₹)</Text>
                    <TextInput
                      style={styles.adminInputField}
                      value={newUserMaxDisc}
                      onChangeText={setNewUserMaxDisc}
                      keyboardType="number-pad"
                      placeholder="e.g. 150"
                    />
                  </View>
                </View>

                <View style={{ backgroundColor: '#fdf2f8', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#fbcfe8' }}>
                  <Text style={{ fontSize: 11, color: '#9d174d', lineHeight: 16 }}>
                    ℹ️ <Text style={{ fontWeight: '800' }}>Startup Rule:</Text> Jab koi naya user signup karta hai (0 rides), use pehli ride par ye 90% discount automatically lagta hai. 1 ride complete hone ke baad wah normal member ban jata hai.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.saveRatesBtn, { marginTop: 14, backgroundColor: '#db2777' }]}
                  onPress={handleSaveLoyaltyConfig}
                  disabled={savingLoyaltyCfg}
                >
                  {savingLoyaltyCfg ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveRatesText}>Save 90% First-Ride Settings 💾</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* SECTION 2: 4 MILESTONE TIERS REFERENCE */}
              <View style={[styles.adminCard, { marginTop: 14 }]}>
                <Text style={styles.cardTitle}>🏅 4 IndiRide Loyalty Tiers & Milestone Rules</Text>
                <Text style={[styles.cardSub, { marginBottom: 10 }]}>Discounts do not stack; each tier replaces the previous rate</Text>

                <View style={{ gap: 8 }}>
                  <View style={{ backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400e' }}>🥉 Bronze Tier (100 Rides)</Text>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: '#b45309' }}>10% OFF Every Ride</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#78350f', marginTop: 3 }}>
                      Reward: 🎁 1 Free Ride Voucher + Bronze profile badge
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#334155' }}>🥈 Silver Tier (150 Rides)</Text>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: '#0284c7' }}>15% OFF Every Ride</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                      Reward: 🎁 1 Free Ride Voucher + Silver badge (strictly 15%, not 25%)
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#fef9c3', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#fef08a' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#854d0e' }}>🥇 Golden Tier (200 Rides)</Text>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: '#ca8a04' }}>20% OFF Every Ride</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#713f12', marginTop: 3 }}>
                      Reward: 🎁 2 Free Ride Vouchers + Golden badge & helpline
                    </Text>
                  </View>

                  <View style={{ backgroundColor: '#cffafe', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#a5f3fc' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#155e75' }}>💎 Diamond VIP Tier (300+ Rides)</Text>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: '#0891b2' }}>25% OFF Permanent</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#164e63', marginTop: 3 }}>
                      Reward: 👑 Permanent Member of IndiRide + Swags & Gift Box + Special Prizes by IndiRide
                    </Text>
                  </View>
                </View>
              </View>

              {/* SECTION 3: PASSENGERS LOYALTY STATUS & 1-CLICK TESTING */}
              <View style={[styles.adminCard, { marginTop: 14 }]}>
                <Text style={styles.cardTitle}>👥 Registered Passengers & Tier Simulation Tools</Text>
                <Text style={[styles.cardSub, { marginBottom: 12 }]}>
                  Test different tier levels with 1 click to verify discounts in the passenger app
                </Text>

                {loyaltyUsers.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginVertical: 10 }}>
                    No passenger records found.
                  </Text>
                ) : (
                  loyaltyUsers.map((u) => (
                    <View
                      key={u.user_id}
                      style={{
                        backgroundColor: '#f8fafc',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{u.full_name}</Text>
                          <Text style={{ fontSize: 11, color: '#64748b' }}>
                            Rides: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{u.completed_rides}</Text> • Vouchers:{' '}
                            <Text style={{ fontWeight: '800', color: '#059669' }}>{u.free_rides_vouchers}</Text> • Total Saved: ₹{u.total_discount_saved}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>
                            {u.badge_icon} {u.tier_name} ({u.discount_percent}% OFF)
                          </Text>
                        </View>
                      </View>

                      {/* 1-Click Simulation Buttons */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                        <TouchableOpacity
                          style={{ backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                          onPress={() => handleSetTrips(u.user_id, u.full_name, 0)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155' }}>Reset to 0 (New 90%)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#fde68a', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                          onPress={() => handleSetTrips(u.user_id, u.full_name, 100)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#92400e' }}>Set Bronze (100)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#cbd5e1', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                          onPress={() => handleSetTrips(u.user_id, u.full_name, 150)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#1e293b' }}>Set Silver (150)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#fef08a', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                          onPress={() => handleSetTrips(u.user_id, u.full_name, 200)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#854d0e' }}>Set Gold (200)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#a5f3fc', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                          onPress={() => handleSetTrips(u.user_id, u.full_name, 300)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#155e75' }}>Set Diamond (300)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                          onPress={() => handleGrantVoucher(u.user_id, u.full_name)}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#065f46' }}>+1 Free Voucher 🎁</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* TAB: FESTIVE CAMPAIGN CONTROLLER */}
          {activeTab === 'campaign' && (
            <View>
              <Text style={styles.sectionHeader}>FESTIVAL CAMPAIGN MANAGER</Text>
              <Text style={styles.sectionSub}>
                Change the active festival banner, promo code, and discounts displayed to all passengers in real-time.
              </Text>

              {/* Quick Festival Presets */}
              <View style={styles.presetsCard}>
                <Text style={styles.presetsTitle}>QUICK FESTIVAL PRESETS</Text>
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    style={[styles.presetBtn, festivalName.toLowerCase() === 'diwali' && styles.presetBtnActive]}
                    onPress={() =>
                      applyFestivalPreset(
                        'Diwali',
                        '🪔 Shubh Diwali Festive Dhamaka',
                        'Celebrate the Festival of Lights with 5% OFF on all rides!',
                        'DIWALI5',
                        5
                      )
                    }
                  >
                    <Text style={styles.presetEmoji}>🪔</Text>
                    <Text style={styles.presetText}>Diwali (5%)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, festivalName.toLowerCase().includes('chhath') && styles.presetBtnActive]}
                    onPress={() =>
                      applyFestivalPreset(
                        'Chhath Puja',
                        '🌅 Chhath Puja Mahaparv Special',
                        'Pavitra ghat transit & safe family journeys with 10% OFF on all rides!',
                        'CHHATH10',
                        10
                      )
                    }
                  >
                    <Text style={styles.presetEmoji}>🌅</Text>
                    <Text style={styles.presetText}>Chhath Puja (10%)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, festivalName.toLowerCase() === 'holi' && styles.presetBtnActive]}
                    onPress={() =>
                      applyFestivalPreset(
                        'Holi',
                        '🎨 Rang Barse Holi Special Offer',
                        'Splash into vibrant celebrations with 40% OFF all city rides!',
                        'HOLI40',
                        40
                      )
                    }
                  >
                    <Text style={styles.presetEmoji}>🎨</Text>
                    <Text style={styles.presetText}>Holi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, festivalName.toLowerCase() === 'eid' && styles.presetBtnActive]}
                    onPress={() =>
                      applyFestivalPreset(
                        'Eid',
                        '🌙 Eid Mubarak Special Savings',
                        'Celebrate with family and friends! Save up to 50% on car & auto bookings.',
                        'EIDMUBARAK',
                        50
                      )
                    }
                  >
                    <Text style={styles.presetEmoji}>🌙</Text>
                    <Text style={styles.presetText}>Eid</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetBtn, festivalName.toLowerCase() === 'new year' && styles.presetBtnActive]}
                    onPress={() =>
                      applyFestivalPreset(
                        'New Year',
                        '🎆 Happy New Year 2027 Bonanza',
                        'Kickstart the new year with zero surge and 35% discount on night rides!',
                        'NEWYEAR2027',
                        35
                      )
                    }
                  >
                    <Text style={styles.presetEmoji}>🎆</Text>
                    <Text style={styles.presetText}>New Year</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Custom Campaign Form */}
              <View style={styles.campaignFormCard}>
                {/* Live Status Badge */}
                <View
                  style={[
                    styles.festStatusBanner,
                    campaignStatus === 'live' && isFestivalActive
                      ? styles.festStatusLive
                      : campaignStatus === 'expired'
                      ? styles.festStatusExpired
                      : styles.festStatusInactive,
                  ]}
                >
                  <Text style={styles.festStatusBannerText}>
                    {campaignStatus === 'live' && isFestivalActive
                      ? `🟢 LIVE ON PASSENGER APP • Ends: ${endDate || 'Ongoing'}`
                      : campaignStatus === 'expired'
                      ? `🔴 EXPIRED • Auto-hidden from passenger app`
                      : campaignStatus === 'scheduled'
                      ? `🟡 SCHEDULED • Will appear on ${startDate}`
                      : `⚪ PAUSED / INACTIVE • Hidden from users`}
                  </Text>
                </View>

                <View style={styles.formFieldRow}>
                  <Text style={styles.inputFieldLabel}>FESTIVAL / OFFER NAME</Text>
                  <TextInput
                    style={styles.adminInputField}
                    value={festivalName}
                    onChangeText={setFestivalName}
                    placeholder="e.g. Diwali Dhamaka, Holi Splash, New Year"
                  />
                </View>

                <View style={styles.formFieldRow}>
                  <Text style={styles.inputFieldLabel}>BANNER HEADLINE</Text>
                  <TextInput
                    style={styles.adminInputField}
                    value={bannerTitle}
                    onChangeText={setBannerTitle}
                    placeholder="e.g. 🪔 Shubh Diwali Festive Dhamaka"
                  />
                </View>

                <View style={styles.formFieldRow}>
                  <Text style={styles.inputFieldLabel}>BANNER SUBTITLE / DESCRIPTION</Text>
                  <TextInput
                    style={[styles.adminInputField, { height: 60, textAlignVertical: 'top' }]}
                    value={bannerSubtitle}
                    onChangeText={setBannerSubtitle}
                    multiline
                    placeholder="Offer description shown on passenger map card"
                  />
                </View>

                <View style={styles.twoInputsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>DISCOUNT PERCENT (%)</Text>
                    <TextInput
                      style={styles.adminInputField}
                      keyboardType="numeric"
                      value={discountPercent}
                      onChangeText={setDiscountPercent}
                      placeholder="e.g. 10"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>PROMO CODE</Text>
                    <TextInput
                      style={styles.adminInputField}
                      value={promoCode}
                      onChangeText={(t) => setPromoCode(t.toUpperCase())}
                      placeholder="e.g. OFFER10"
                    />
                  </View>
                </View>

                {/* Date Controls (Start Date & End Date Auto-Expiry) */}
                <View style={styles.twoInputsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>START DATE (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.adminInputField}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="e.g. 2026-11-24"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputFieldLabel}>END DATE (AUTO-EXPIRE)</Text>
                    <TextInput
                      style={styles.adminInputField}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="e.g. 2026-11-30"
                    />
                  </View>
                </View>
                <Text style={styles.dateHelperText}>
                  ℹ️ After the End Date passes, this offer is automatically deleted from passenger screens.
                </Text>

                {/* Campaign Status Toggle */}
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.toggleLabel}>CAMPAIGN VISIBILITY</Text>
                    <Text style={styles.toggleSub}>
                      {isFestivalActive ? 'Active and visible on Passenger app' : 'Paused / Hidden'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, isFestivalActive ? styles.toggleActive : styles.toggleInactive]}
                    onPress={() => setIsFestivalActive(!isFestivalActive)}
                  >
                    <Text style={styles.toggleBtnText}>
                      {isFestivalActive ? '✓ ACTIVE' : 'PAUSED'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Action Buttons: Save & Expire/Delete */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.saveCampaignBtn, { flex: 2 }]}
                    onPress={handleSaveFestival}
                    disabled={savingCampaign}
                  >
                    {savingCampaign ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.saveCampaignText}>
                        Publish / Update Offer
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteCampaignBtn}
                    onPress={handleDeleteFestival}
                    disabled={deletingCampaign}
                  >
                    {deletingCampaign ? (
                      <ActivityIndicator color="#ef4444" />
                    ) : (
                      <Text style={styles.deleteCampaignBtnText}>🗑️ Expire Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* TAB 3: DRIVERS & APPROVALS */}
          {activeTab === 'riders' && (
            <View>
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.sectionHeader}>
                  DRIVER PARTNERS & KYC APPROVALS ({riders.length})
                </Text>
                <Text style={styles.sectionSub}>
                  Verify Driving License, Vehicle Details, Passport Photo, and Addresses before approving driver partner applications.
                </Text>
              </View>

              {/* Status Filter Chips */}
              <View style={styles.riderFilterRow}>
                <TouchableOpacity
                  style={[styles.riderFilterChip, riderFilter === 'pending' && styles.riderFilterChipPendingActive]}
                  onPress={() => setRiderFilter('pending')}
                >
                  <Text style={[styles.riderFilterChipText, riderFilter === 'pending' && styles.riderFilterChipPendingTextActive]}>
                    ⏳ Pending Approval ({pendingRiders.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.riderFilterChip, riderFilter === 'all' && styles.riderFilterChipActive]}
                  onPress={() => setRiderFilter('all')}
                >
                  <Text style={[styles.riderFilterChipText, riderFilter === 'all' && styles.riderFilterChipTextActive]}>
                    All Drivers ({riders.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.riderFilterChip, riderFilter === 'approved' && styles.riderFilterChipActive]}
                  onPress={() => setRiderFilter('approved')}
                >
                  <Text style={[styles.riderFilterChipText, riderFilter === 'approved' && styles.riderFilterChipTextActive]}>
                    Approved ({approvedRiders.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.riderFilterChip, riderFilter === 'rejected' && styles.riderFilterChipActive]}
                  onPress={() => setRiderFilter('rejected')}
                >
                  <Text style={[styles.riderFilterChipText, riderFilter === 'rejected' && styles.riderFilterChipTextActive]}>
                    Declined ({rejectedRiders.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {displayedRiders.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="shield-checkmark-outline" size={44} color="#9ca3af" />
                  <Text style={styles.emptyStateTitle}>
                    {riderFilter === 'pending' ? 'No Pending Driver Applications' : 'No Drivers Found'}
                  </Text>
                  <Text style={styles.emptyStateSub}>
                    {riderFilter === 'pending'
                      ? 'All driver partner applications have been reviewed.'
                      : 'Driver accounts matching this filter will appear here.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {displayedRiders.map((r) => {
                    const statusLower = (r.status || '').toLowerCase();
                    const isPending = statusLower === 'pending';
                    const isApproved = statusLower === 'approved';
                    const isRejected = statusLower === 'rejected';

                    const handleSaveLoyaltyConfig = async () => {
    setSavingLoyaltyCfg(true);
    try {
      const updated = await api.admin.updateLoyaltyConfig({
        discount_percent: parseFloat(newUserDiscountPct) || 90,
        max_discount_amount: parseFloat(newUserMaxDisc) || 150,
        is_active: isNewUserDiscountActive,
      });
      Alert.alert('Loyalty Config Saved! 🎉', 'New user 1st ride discount configuration updated successfully.');
      setLoyaltyConfig((prev: any) => ({
        ...prev,
        new_user_discount: updated.config,
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update loyalty config');
    } finally {
      setSavingLoyaltyCfg(false);
    }
  };

  const handleGrantVoucher = async (userId: string, userName: string) => {
    try {
      await api.admin.grantVoucher(userId, 1);
      Alert.alert('Voucher Granted! 🎁', `1 Free Ride Voucher granted to ${userName}`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to grant voucher');
    }
  };

  const handleSetTrips = async (userId: string, userName: string, trips: number) => {
    try {
      const res = await api.admin.setUserTrips(userId, trips);
      Alert.alert('Trips Updated! 🚀', `${userName} is now at ${trips} rides (${res.tier})`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update trips');
    }
  };

  return (
                      <View
                        key={r.rider_id || r.profile_id}
                        style={[
                          styles.driverKycCard,
                          isPending && styles.driverKycCardPendingBorder,
                        ]}
                      >
                        {/* Driver Card Header */}
                        <View style={styles.driverItemHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.driverItemName}>{r.full_name || 'Driver Partner'}</Text>
                              {isApproved && <Ionicons name="checkmark-circle" size={16} color="#10b981" />}
                            </View>
                            <Text style={styles.driverItemPhone}>📞 {r.phone_number} {r.email ? `• ✉️ ${r.email}` : ''}</Text>
                            {r.submitted_at && (
                              <Text style={styles.driverSubmittedTime}>
                                Submitted: {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            )}
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: isApproved ? '#ecfdf5' : isPending ? '#fef3c7' : '#fee2e2',
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: isApproved ? '#059669' : isPending ? '#d97706' : '#dc2626',
                                fontSize: 11,
                                fontWeight: '800',
                              }}
                            >
                              {isPending ? 'PENDING APPROVAL' : (r.status || 'UNKNOWN').toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* License & Vehicle Details Box */}
                        <View style={styles.driverInfoGrid}>
                          <View style={styles.driverInfoGridItem}>
                            <Text style={styles.driverGridLabel}>DRIVING LICENSE</Text>
                            <Text style={styles.driverGridValue}>{r.license_number || 'N/A'}</Text>
                          </View>

                          <View style={styles.driverInfoGridItem}>
                            <Text style={styles.driverGridLabel}>VEHICLE PLATE</Text>
                            <Text style={styles.driverGridValue}>
                              {r.vehicle?.plate || 'No Plate'}
                            </Text>
                          </View>

                          <View style={styles.driverInfoGridItem}>
                            <Text style={styles.driverGridLabel}>VEHICLE TYPE & MODEL</Text>
                            <Text style={styles.driverGridValue}>
                              {(r.vehicle?.category || 'car').toUpperCase()} • {r.vehicle?.model || 'Standard'}
                            </Text>
                          </View>

                          <View style={styles.driverInfoGridItem}>
                            <Text style={styles.driverGridLabel}>AADHAAR CARD</Text>
                            <Text style={[styles.driverGridValue, { color: '#0284c7' }]}>{r.aadhaar_number || 'Not Submitted'}</Text>
                          </View>

                          <View style={styles.driverInfoGridItem}>
                            <Text style={styles.driverGridLabel}>LIFETIME TRIPS</Text>
                            <Text style={styles.driverGridValue}>{r.total_trips || 0} Trips (★ {r.rating?.toFixed(1) || '5.0'})</Text>
                          </View>
                        </View>

                        {/* Addresses */}
                        <View style={styles.addressBox}>
                          <View style={styles.addressItem}>
                            <Text style={styles.addressLabel}>Permanent Address:</Text>
                            <Text style={styles.addressText}>{r.permanent_address || 'Not provided'}</Text>
                          </View>
                          <View style={[styles.addressItem, { marginTop: 6 }]}>
                            <Text style={styles.addressLabel}>Current / Operating Address:</Text>
                            <Text style={styles.addressText}>{r.current_address || r.permanent_address || 'Not provided'}</Text>
                          </View>
                        </View>

                        {/* KYC Uploaded Documents Preview Row */}
                        <View style={styles.docsPreviewContainer}>
                          <Text style={styles.docsSectionTitle}>DOCUMENT PHOTOS INSPECTION (PASSPORT • DL • AADHAAR)</Text>
                          <View style={styles.docsRow}>
                            {/* Passport Photo */}
                            <View style={styles.docItemCard}>
                              <Text style={styles.docTitleLabel}>Passport / Driver Photo</Text>
                              {r.passport_photo ? (
                                <TouchableOpacity
                                  style={styles.docThumbClickable}
                                  onPress={() =>
                                    setSelectedZoomPhoto({
                                      url: r.passport_photo,
                                      title: 'Passport / Driver Photo',
                                      driverName: r.full_name,
                                    })
                                  }
                                  activeOpacity={0.8}
                                >
                                  <Image source={{ uri: r.passport_photo }} style={styles.docThumbImage} resizeMode="cover" />
                                  <View style={styles.zoomOverlayBadge}>
                                    <Ionicons name="expand" size={12} color="#ffffff" />
                                    <Text style={styles.zoomOverlayText}>Tap to Zoom</Text>
                                  </View>
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.docPlaceholderBox}>
                                  <Ionicons name="person-circle-outline" size={32} color="#9ca3af" />
                                  <Text style={styles.docPlaceholderText}>No photo on file</Text>
                                </View>
                              )}
                            </View>

                            {/* Driving License */}
                            <View style={styles.docItemCard}>
                              <Text style={styles.docTitleLabel}>Driving License</Text>
                              {r.license_photo ? (
                                <TouchableOpacity
                                  style={styles.docThumbClickable}
                                  onPress={() =>
                                    setSelectedZoomPhoto({
                                      url: r.license_photo,
                                      title: 'Driving License Document',
                                      driverName: r.full_name,
                                    })
                                  }
                                  activeOpacity={0.8}
                                >
                                  <Image source={{ uri: r.license_photo }} style={styles.docThumbImage} resizeMode="cover" />
                                  <View style={styles.zoomOverlayBadge}>
                                    <Ionicons name="expand" size={12} color="#ffffff" />
                                    <Text style={styles.zoomOverlayText}>Tap to Zoom</Text>
                                  </View>
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.docPlaceholderBox}>
                                  <Ionicons name="card-outline" size={32} color="#9ca3af" />
                                  <Text style={styles.docPlaceholderText}>No document on file</Text>
                                </View>
                              )}
                            </View>

                            {/* Aadhaar Card Document */}
                            <View style={styles.docItemCard}>
                              <Text style={styles.docTitleLabel}>Aadhaar Card Document</Text>
                              {r.aadhaar_photo ? (
                                <TouchableOpacity
                                  style={styles.docThumbClickable}
                                  onPress={() =>
                                    setSelectedZoomPhoto({
                                      url: r.aadhaar_photo,
                                      title: 'Aadhaar Card Document',
                                      driverName: r.full_name,
                                    })
                                  }
                                  activeOpacity={0.8}
                                >
                                  <Image source={{ uri: r.aadhaar_photo }} style={styles.docThumbImage} resizeMode="cover" />
                                  <View style={styles.zoomOverlayBadge}>
                                    <Ionicons name="expand" size={12} color="#ffffff" />
                                    <Text style={styles.zoomOverlayText}>Tap to Zoom</Text>
                                  </View>
                                </TouchableOpacity>
                              ) : (
                                <View style={styles.docPlaceholderBox}>
                                  <Ionicons name="finger-print-outline" size={32} color="#9ca3af" />
                                  <Text style={styles.docPlaceholderText}>No Aadhaar on file</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Rejection notice if declined */}
                        {isRejected && r.rejection_reason && (
                          <View style={styles.rejectionNoticeCard}>
                            <Ionicons name="alert-circle" size={16} color="#dc2626" />
                            <Text style={styles.rejectionNoticeText}>
                              Declined Reason: {r.rejection_reason}
                            </Text>
                          </View>
                        )}

                        {/* Action Buttons Row */}
                        <View style={styles.approvalButtonsRow}>
                          {!isApproved && (
                            <TouchableOpacity
                              style={[styles.smallActionBtn, { backgroundColor: '#10b981', flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                              onPress={() => handleUpdateRiderStatus(r.rider_id, 'approved')}
                            >
                              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                              <Text style={[styles.smallActionText, { fontSize: 13 }]}>Approve Driver</Text>
                            </TouchableOpacity>
                          )}

                          {!isRejected && (
                            <TouchableOpacity
                              style={[styles.smallActionBtn, { backgroundColor: '#ef4444', flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                              onPress={() => {
                                setRejectingRider(r);
                                setCustomRejectReason('');
                                setShowRejectModal(true);
                              }}
                            >
                              <Ionicons name="close-circle" size={16} color="#ffffff" />
                              <Text style={[styles.smallActionText, { fontSize: 13 }]}>Decline / Reject</Text>
                            </TouchableOpacity>
                          )}

                          {isApproved && (
                            <TouchableOpacity
                              style={[styles.smallActionBtn, { backgroundColor: '#f59e0b', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                              onPress={() => handleUpdateRiderStatus(r.rider_id, 'suspended', 'Admin suspended account')}
                            >
                              <Ionicons name="pause" size={14} color="#ffffff" />
                              <Text style={styles.smallActionText}>Suspend</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: RECENT RIDES */}
          {activeTab === 'rides' && (
            <View>
              <Text style={styles.sectionHeader}>RECENT PLATFORM TRIPS ({rides.length})</Text>
              <View style={styles.listContainer}>
                {rides.map((trip) => (
                  <View key={trip.id} style={styles.tripItemCard}>
                    <View style={styles.tripItemHeader}>
                      <Text style={styles.tripCategory}>{trip.vehicle_category.toUpperCase()}</Text>
                      <Text style={styles.tripStatus}>{trip.status}</Text>
                    </View>

                    <Text style={styles.tripAddress} numberOfLines={1}>📍 {trip.pickup_address}</Text>
                    <Text style={styles.tripAddress} numberOfLines={1}>🏁 {trip.destination_address}</Text>

                    <View style={styles.tripMetaRow}>
                      <Text style={styles.tripMetaText}>Dist: {trip.distance_km} km</Text>
                      <Text style={styles.tripFare}>₹{Math.round(trip.fare)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 5: CARPOOL LISTINGS & MODERATION */}
          {activeTab === 'carpools' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionHeader}>COMMUNITY CARPOOLS ({carpools.length})</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                  onPress={loadAllData}
                >
                  <Ionicons name="refresh" size={14} color="#4b5563" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#4b5563' }}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {carpools.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="people-outline" size={40} color="#9ca3af" />
                  <Text style={styles.emptyStateTitle}>No Carpools Listed</Text>
                  <Text style={styles.emptyStateSub}>No active or scheduled carpool rides found.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {carpools.map((cp) => (
                    <View key={cp.id} style={styles.tripItemCard}>
                      <View style={styles.tripItemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="person-circle-outline" size={18} color="#8b5cf6" />
                          <Text style={[styles.tripCategory, { color: '#111827' }]}>{cp.creator_name}</Text>
                          {cp.creator_phone ? (
                            <Text style={{ fontSize: 11, color: '#6b7280' }}>({cp.creator_phone})</Text>
                          ) : null}
                        </View>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: cp.status === 'COMPLETED' ? '#ecfdf5' : (cp.status === 'CANCELLED' ? '#fee2e2' : '#eff6ff') }
                        ]}>
                          <Text style={{
                            color: cp.status === 'COMPLETED' ? '#059669' : (cp.status === 'CANCELLED' ? '#dc2626' : '#2563eb'),
                            fontSize: 10,
                            fontWeight: '800'
                          }}>
                            {cp.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.tripAddress} numberOfLines={1}>📍 Origin: {cp.pickup_address}</Text>
                      <Text style={styles.tripAddress} numberOfLines={1}>🏁 Dest: {cp.destination_address}</Text>

                      <View style={styles.tripMetaRow}>
                        <Text style={styles.tripMetaText}>
                          🕒 {cp.departure_time || 'Flexible'} • 🚗 {cp.vehicle_info || 'Car'}
                        </Text>
                        <Text style={styles.tripFare}>₹{cp.price_per_seat}/seat</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                        <Text style={{ fontSize: 12, color: '#4b5563' }}>
                          Seats: <Text style={{ fontWeight: '700', color: '#111827' }}>{cp.available_seats}</Text> avail / <Text style={{ fontWeight: '700', color: '#111827' }}>{cp.total_seats}</Text> total ({cp.total_bookings} bookings)
                        </Text>
                        {cp.status !== 'CANCELLED' && cp.status !== 'COMPLETED' && (
                          <TouchableOpacity
                            style={[styles.smallActionBtn, { backgroundColor: '#ef4444' }]}
                            onPress={() => handleModerateCarpool(cp.id)}
                          >
                            <Text style={styles.smallActionText}>Moderate / Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 6: SCHEDULED RIDES */}
          {activeTab === 'scheduled' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionHeader}>UPCOMING SCHEDULED RIDES ({scheduledRides.length})</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#8b5cf6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                  onPress={handleDispatchScheduled}
                  disabled={dispatching}
                >
                  {dispatching ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="flash-outline" size={14} color="#ffffff" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>Run Auto-Dispatch</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {scheduledRides.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="calendar-outline" size={40} color="#9ca3af" />
                  <Text style={styles.emptyStateTitle}>No Scheduled Rides</Text>
                  <Text style={styles.emptyStateSub}>No future rides currently waiting for dispatch window.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {scheduledRides.map((sr) => (
                    <View key={sr.id} style={styles.tripItemCard}>
                      <View style={styles.tripItemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="time-outline" size={16} color="#8b5cf6" />
                          <Text style={[styles.tripCategory, { color: '#8b5cf6' }]}>{sr.vehicle_category?.toUpperCase()}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827' }}>{sr.passenger_name}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: '#fef3c7' }]}>
                          <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '800' }}>SCHEDULED</Text>
                        </View>
                      </View>

                      <Text style={styles.tripAddress} numberOfLines={1}>📍 {sr.pickup_address}</Text>
                      <Text style={styles.tripAddress} numberOfLines={1}>🏁 {sr.destination_address}</Text>

                      <View style={styles.tripMetaRow}>
                        <Text style={styles.tripMetaText}>
                          ⏰ For: {sr.scheduled_for ? new Date(sr.scheduled_for).toLocaleString() : 'Pending'}
                        </Text>
                        <Text style={styles.tripFare}>₹{Math.round(sr.estimated_fare || 0)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 7: CAMPUS DRIVERS & HOST VEHICLES VERIFICATION */}
          {activeTab === 'campus_vehicles' && (
            <View>
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.sectionHeader}>
                  CAMPUS RIDERS & VEHICLE VERIFICATION
                </Text>
                <Text style={styles.sectionSub}>
                  Campus student drivers are auto-approved for instant mobility. Review uploaded Student ID cards and Aadhaar credentials below. Suspend or block invalid accounts.
                </Text>
              </View>

              {/* Admin Policy Warning Card */}
              <View style={styles.adminSecurityNoticeCard}>
                <Ionicons name="school" size={22} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminSecurityNoticeTitle}>
                    Campus Driver Policy: Instant Auto-Approval & Fraud Review
                  </Text>
                  <Text style={styles.adminSecurityNoticeText}>
                    • ⚡ INSTANT ACTIVE: Campus drivers go live immediately upon Student ID & Aadhaar submission without waiting for admin approval.
                    {'\n'}• 🛡️ ADMIN AUDIT: Inspect Student ID card photos and Aadhaar numbers below. One-click suspend any suspicious account.
                    {'\n'}• 🚕 PERMANENT DRIVERS: Commercial drivers still require manual Janch under Driver Approvals.
                  </Text>
                </View>
              </View>

              {/* SECTION 1: REGISTERED CAMPUS DRIVERS */}
              <View style={{ marginTop: 8, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>
                    🎓 REGISTERED CAMPUS DRIVERS ({campusDrivers.length})
                  </Text>
                  <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>⚡ Auto-Approved</Text>
                  </View>
                </View>

                {campusDrivers.length === 0 ? (
                  <View style={[styles.emptyStateContainer, { paddingVertical: 24 }]}>
                    <Ionicons name="school-outline" size={36} color="#9ca3af" />
                    <Text style={styles.emptyStateTitle}>No Campus Drivers Registered Yet</Text>
                    <Text style={styles.emptyStateSub}>
                      Students registering via the Campus Reg flow with their Student ID and Aadhaar card will appear here instantly.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.listContainer}>
                    {campusDrivers.map((cd: any) => {
                      const isApproved = (cd.status || '').toLowerCase() === 'approved';

                      const handleSaveLoyaltyConfig = async () => {
    setSavingLoyaltyCfg(true);
    try {
      const updated = await api.admin.updateLoyaltyConfig({
        discount_percent: parseFloat(newUserDiscountPct) || 90,
        max_discount_amount: parseFloat(newUserMaxDisc) || 150,
        is_active: isNewUserDiscountActive,
      });
      Alert.alert('Loyalty Config Saved! 🎉', 'New user 1st ride discount configuration updated successfully.');
      setLoyaltyConfig((prev: any) => ({
        ...prev,
        new_user_discount: updated.config,
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update loyalty config');
    } finally {
      setSavingLoyaltyCfg(false);
    }
  };

  const handleGrantVoucher = async (userId: string, userName: string) => {
    try {
      await api.admin.grantVoucher(userId, 1);
      Alert.alert('Voucher Granted! 🎁', `1 Free Ride Voucher granted to ${userName}`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to grant voucher');
    }
  };

  const handleSetTrips = async (userId: string, userName: string, trips: number) => {
    try {
      const res = await api.admin.setUserTrips(userId, trips);
      Alert.alert('Trips Updated! 🚀', `${userName} is now at ${trips} rides (${res.tier})`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update trips');
    }
  };

  return (
                        <View key={cd.id || cd.user_id} style={[styles.campusVehicleCard, { borderLeftWidth: 4, borderLeftColor: isApproved ? '#10b981' : '#ef4444' }]}>
                          {/* Header: Rider Name & Status */}
                          <View style={styles.campusVehicleCardHeader}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.campusHostName}>{cd.full_name || 'Campus Rider'}</Text>
                                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>🎓 CAMPUS</Text>
                                </View>
                              </View>
                              <Text style={styles.campusHostPhone}>
                                📞 {cd.phone_number || 'N/A'} • {cd.email || 'No Email'}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.campusStatusBadge,
                                isApproved ? styles.statusBadgeVerified : styles.statusBadgeBlocked,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.campusStatusBadgeText,
                                  isApproved ? styles.statusTextVerified : styles.statusTextBlocked,
                                ]}
                              >
                                {isApproved ? '⚡ ACTIVE' : (cd.status || 'SUSPENDED').toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          {/* University & Academic Info */}
                          <View style={styles.docDetailsGrid}>
                            <View style={styles.docDetailBox}>
                              <Text style={styles.docDetailLabel}>COLLEGE / UNIVERSITY</Text>
                              <Text style={[styles.docDetailValue, { color: '#0f172a', fontWeight: '700' }]}>
                                {cd.college_name || cd.served_universities || 'Campus Area'}
                              </Text>
                            </View>

                            <View style={styles.docDetailBox}>
                              <Text style={styles.docDetailLabel}>ACADEMIC YEAR / VALID TILL</Text>
                              <Text style={styles.docDetailValue}>{cd.academic_year || 'Current Year'}</Text>
                            </View>
                          </View>

                          {/* Vehicle Details */}
                          <View style={styles.docDetailsGrid}>
                            <View style={styles.docDetailBox}>
                              <Text style={styles.docDetailLabel}>VEHICLE PLATE & TYPE</Text>
                              <Text style={[styles.docDetailValue, { fontWeight: '700' }]}>
                                {cd.vehicle_plate || 'N/A'} ({cd.vehicle_category?.toUpperCase() || 'BIKE'})
                              </Text>
                            </View>

                            <View style={styles.docDetailBox}>
                              <Text style={styles.docDetailLabel}>VEHICLE MODEL</Text>
                              <Text style={styles.docDetailValue}>{cd.vehicle_model || 'Standard'}</Text>
                            </View>
                          </View>

                          {/* Document Inspection Thumbnails */}
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 12 }}>
                            {/* Student ID Thumbnail */}
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: '#f8fafc',
                                borderRadius: 10,
                                padding: 8,
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                alignItems: 'center',
                              }}
                              onPress={() => {
                                if (cd.student_id_photo) {
                                  setSelectedZoomPhoto({
                                    url: cd.student_id_photo,
                                    title: 'Student ID Card Document',
                                    driverName: cd.full_name || 'Driver',
                                  });
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>
                                STUDENT ID ({cd.student_id_number || 'CARD'})
                              </Text>
                              {cd.student_id_photo ? (
                                <Image source={{ uri: cd.student_id_photo }} style={{ width: '100%', height: 75, borderRadius: 6 }} resizeMode="cover" />
                              ) : (
                                <View style={{ height: 75, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 6 }}>
                                  <Ionicons name="id-card-outline" size={24} color="#94a3b8" />
                                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>No Photo</Text>
                                </View>
                              )}
                              <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '700', marginTop: 4 }}>🔍 Tap to Zoom</Text>
                            </TouchableOpacity>

                            {/* Aadhaar Card Thumbnail */}
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: '#f8fafc',
                                borderRadius: 10,
                                padding: 8,
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                                alignItems: 'center',
                              }}
                              onPress={() => {
                                if (cd.aadhaar_photo) {
                                  setSelectedZoomPhoto({
                                    url: cd.aadhaar_photo,
                                    title: 'Aadhaar Card Document',
                                    driverName: cd.full_name || 'Driver',
                                  });
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 4 }}>
                                AADHAAR ({cd.aadhaar_number ? `...${cd.aadhaar_number.slice(-4)}` : 'CARD'})
                              </Text>
                              {cd.aadhaar_photo ? (
                                <Image source={{ uri: cd.aadhaar_photo }} style={{ width: '100%', height: 75, borderRadius: 6 }} resizeMode="cover" />
                              ) : (
                                <View style={{ height: 75, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 6 }}>
                                  <Ionicons name="finger-print-outline" size={24} color="#94a3b8" />
                                  <Text style={{ fontSize: 10, color: '#94a3b8' }}>No Photo</Text>
                                </View>
                              )}
                              <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '700', marginTop: 4 }}>🔍 Tap to Zoom</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Admin Action Row */}
                          <View style={styles.campusActionButtonsRow}>
                            {isApproved ? (
                              <TouchableOpacity
                                style={[styles.cvActionBtn, { backgroundColor: '#ef4444' }]}
                                onPress={() => handleUpdateRiderStatus(cd.user_id, 'suspended', 'Admin suspended campus privileges')}
                              >
                                <Ionicons name="ban" size={14} color="#ffffff" />
                                <Text style={styles.cvActionBtnText}>Suspend / Block Driver</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={[styles.cvActionBtn, { backgroundColor: '#10b981' }]}
                                onPress={() => handleUpdateRiderStatus(cd.user_id, 'approved', 'Reactivated by admin')}
                              >
                                <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                                <Text style={styles.cvActionBtnText}>Re-Activate Driver</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* SECTION 2: CAMPUS HOST VEHICLES */}
              <View style={{ marginBottom: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16 }}>
                <Text style={styles.sectionHeader}>
                  CAMPUS HOST VEHICLES & LICENSES ({campusVehicles.length})
                </Text>
                <Text style={styles.sectionSub}>
                  Review driving licenses and vehicle plates submitted by campus ride hosts. Fake details should be blocked immediately to protect passengers.
                </Text>
              </View>

              {campusVehicles.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="car-outline" size={40} color="#9ca3af" />
                  <Text style={styles.emptyStateTitle}>No Host Vehicles Registered</Text>
                  <Text style={styles.emptyStateSub}>
                    When users attempt to post campus rides for the first time, their driving license and vehicle registration details will appear here for review.
                  </Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {campusVehicles.map((cv) => {
                    const isVerified = cv.status === 'VERIFIED';
                    const isBlocked = cv.status === 'BLOCKED';
                    const isPending = cv.status === 'PENDING';

                    const handleSaveLoyaltyConfig = async () => {
    setSavingLoyaltyCfg(true);
    try {
      const updated = await api.admin.updateLoyaltyConfig({
        discount_percent: parseFloat(newUserDiscountPct) || 90,
        max_discount_amount: parseFloat(newUserMaxDisc) || 150,
        is_active: isNewUserDiscountActive,
      });
      Alert.alert('Loyalty Config Saved! 🎉', 'New user 1st ride discount configuration updated successfully.');
      setLoyaltyConfig((prev: any) => ({
        ...prev,
        new_user_discount: updated.config,
      }));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update loyalty config');
    } finally {
      setSavingLoyaltyCfg(false);
    }
  };

  const handleGrantVoucher = async (userId: string, userName: string) => {
    try {
      await api.admin.grantVoucher(userId, 1);
      Alert.alert('Voucher Granted! 🎁', `1 Free Ride Voucher granted to ${userName}`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to grant voucher');
    }
  };

  const handleSetTrips = async (userId: string, userName: string, trips: number) => {
    try {
      const res = await api.admin.setUserTrips(userId, trips);
      Alert.alert('Trips Updated! 🚀', `${userName} is now at ${trips} rides (${res.tier})`);
      const freshUsers = await api.admin.getLoyaltyUsers();
      setLoyaltyUsers(freshUsers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update trips');
    }
  };

  return (
                      <View key={cv.id} style={styles.campusVehicleCard}>
                        {/* Header: User & Status Badge */}
                        <View style={styles.campusVehicleCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.campusHostName}>
                              {cv.user?.full_name || cv.full_name || 'Host User'}
                            </Text>
                            <Text style={styles.campusHostPhone}>
                              📞 {cv.user?.phone_number || cv.phone_number || 'N/A'} • {cv.user?.email || ''}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.campusStatusBadge,
                              isVerified
                                ? styles.statusBadgeVerified
                                : isBlocked
                                ? styles.statusBadgeBlocked
                                : styles.statusBadgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.campusStatusBadgeText,
                                isVerified
                                  ? styles.statusTextVerified
                                  : isBlocked
                                  ? styles.statusTextBlocked
                                  : styles.statusTextPending,
                              ]}
                            >
                              {cv.status}
                            </Text>
                          </View>
                        </View>

                        {/* Document Details Grid */}
                        <View style={styles.docDetailsGrid}>
                          <View style={styles.docDetailBox}>
                            <Text style={styles.docDetailLabel}>DRIVING LICENSE</Text>
                            <Text style={styles.docDetailValue}>{cv.license_number || 'NOT PROVIDED'}</Text>
                          </View>

                          <View style={styles.docDetailBox}>
                            <Text style={styles.docDetailLabel}>VEHICLE PLATE</Text>
                            <Text style={styles.docDetailValue}>{cv.vehicle_plate || 'NOT PROVIDED'}</Text>
                          </View>
                        </View>

                        <View style={styles.docDetailsGrid}>
                          <View style={styles.docDetailBox}>
                            <Text style={styles.docDetailLabel}>VEHICLE TIER</Text>
                            <Text style={[styles.docDetailValue, { color: cv.vehicle_type === 'PRO_BIKE' ? '#8b5cf6' : '#059669' }]}>
                              {cv.vehicle_type === 'PRO_BIKE' ? '🏍️ Pro Bike (₹13/km)' : cv.vehicle_type === 'GENERAL_BIKE' ? '🛵 General Bike (₹7/km)' : cv.vehicle_type || 'General'}
                            </Text>
                          </View>

                          <View style={styles.docDetailBox}>
                            <Text style={styles.docDetailLabel}>VEHICLE MODEL</Text>
                            <Text style={styles.docDetailValue}>{cv.vehicle_model || 'Standard'}</Text>
                          </View>
                        </View>

                        {/* Post count & Stats */}
                        <View style={styles.campusMetaRow}>
                          <Text style={styles.campusMetaText}>
                            Total Rides Posted: <Text style={{ fontWeight: '700', color: '#111827' }}>{cv.rides_posted_count ?? 0}</Text>
                          </Text>
                          {cv.verified_at && (
                            <Text style={styles.campusMetaText}>
                              Verified: {new Date(cv.verified_at).toLocaleDateString()}
                            </Text>
                          )}
                        </View>

                        {/* Verification Action Buttons */}
                        <View style={styles.campusActionButtonsRow}>
                          {!isVerified && (
                            <TouchableOpacity
                              style={[styles.cvActionBtn, { backgroundColor: '#10b981' }]}
                              onPress={() => handleUpdateCampusVehicleStatus(cv.id, 'VERIFIED')}
                            >
                              <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                              <Text style={styles.cvActionBtnText}>Approve & Verify</Text>
                            </TouchableOpacity>
                          )}

                          {!isBlocked && (
                            <TouchableOpacity
                              style={[styles.cvActionBtn, { backgroundColor: '#ef4444' }]}
                              onPress={() => handleUpdateCampusVehicleStatus(cv.id, 'BLOCKED')}
                            >
                              <Ionicons name="ban" size={14} color="#ffffff" />
                              <Text style={styles.cvActionBtnText}>Block User</Text>
                            </TouchableOpacity>
                          )}

                          {(isVerified || isBlocked) && (
                            <TouchableOpacity
                              style={[styles.cvActionBtn, { backgroundColor: '#6b7280' }]}
                              onPress={() => handleUpdateCampusVehicleStatus(cv.id, 'PENDING')}
                            >
                              <Ionicons name="refresh" size={14} color="#ffffff" />
                              <Text style={styles.cvActionBtnText}>Reset to Pending</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* TAB 8: PROMO CODES ENGINE */}
          {activeTab === 'promos' && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={styles.sectionHeader}>PROMO CODES & OFFERS ({promoCodesList.length})</Text>
                  <Text style={styles.sectionSub}>Create, toggle, and manage dynamic promo codes for passengers.</Text>
                </View>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#8b5cf6',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                  onPress={() => setShowAddPromoModal(true)}
                >
                  <Ionicons name="add-circle" size={16} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>+ New Promo Code</Text>
                </TouchableOpacity>
              </View>

              {promoCodesList.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="pricetag-outline" size={40} color="#9ca3af" />
                  <Text style={styles.emptyStateTitle}>No Promo Codes Created</Text>
                  <Text style={styles.emptyStateSub}>Tap "+ New Promo Code" above to launch a discount offer.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {promoCodesList.map((p) => (
                    <View key={p.id} style={styles.promoCodeCard}>
                      <View style={styles.promoCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.promoCodeBadge}>
                            <Text style={styles.promoCodeBadgeText}>{p.code}</Text>
                          </View>
                          <Text style={styles.promoDiscountPercent}>{p.discount_percent}% OFF</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            style={[
                              styles.promoToggleBtn,
                              p.is_active ? styles.promoToggleActive : styles.promoToggleInactive,
                            ]}
                            onPress={() => handleTogglePromoCode(p.id)}
                          >
                            <Text style={styles.promoToggleBtnText}>
                              {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.promoDeleteBtn}
                            onPress={() => handleDeletePromoCode(p.id)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {p.description ? (
                        <Text style={styles.promoDescriptionText}>{p.description}</Text>
                      ) : null}

                      <View style={styles.promoMetaRow}>
                        <Text style={styles.promoMetaItem}>Max Disc: ₹{p.max_discount_amount || 'Unlimited'}</Text>
                        <Text style={styles.promoMetaItem}>Min Order: ₹{p.min_order_amount || 0}</Text>
                        <Text style={styles.promoMetaItem}>Uses: {p.uses_count || 0}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* MODAL: ADD NEW PROMO CODE */}
      <Modal visible={showAddPromoModal} animationType="slide" transparent>
        <View style={styles.adminModalOverlay}>
          <View style={styles.adminModalCard}>
            <View style={styles.adminModalHeader}>
              <View>
                <Text style={styles.adminModalTitle}>Create Promo Code 🎟️</Text>
                <Text style={styles.adminModalSubtitle}>Offer discount to riders and passengers</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddPromoModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalFieldLabel}>PROMO CODE (UPPERCASE) *</Text>
              <TextInput
                style={styles.adminInputField}
                value={newPromoCode}
                onChangeText={setNewPromoCode}
                placeholder="e.g. CAMPUS50, SUPER20, FESTIVAL"
                autoCapitalize="characters"
              />

              <View style={styles.twoInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>DISCOUNT PERCENT (%) *</Text>
                  <TextInput
                    style={styles.adminInputField}
                    value={newPromoDiscount}
                    onChangeText={setNewPromoDiscount}
                    keyboardType="number-pad"
                    placeholder="e.g. 25"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.modalFieldLabel}>MAX DISCOUNT (₹)</Text>
                  <TextInput
                    style={styles.adminInputField}
                    value={newPromoMaxDisc}
                    onChangeText={setNewPromoMaxDisc}
                    keyboardType="number-pad"
                    placeholder="e.g. 100"
                  />
                </View>
              </View>

              <Text style={styles.modalFieldLabel}>MINIMUM ORDER AMOUNT (₹)</Text>
              <TextInput
                style={styles.adminInputField}
                value={newPromoMinOrder}
                onChangeText={setNewPromoMinOrder}
                keyboardType="number-pad"
                placeholder="e.g. 50"
              />

              <Text style={styles.modalFieldLabel}>DESCRIPTION / TERMS</Text>
              <TextInput
                style={[styles.adminInputField, { height: 60, textAlignVertical: 'top' }]}
                value={newPromoDesc}
                onChangeText={setNewPromoDesc}
                placeholder="e.g. 25% off on all campus and city shared rides"
                multiline
              />

              <TouchableOpacity
                style={styles.saveCampaignBtn}
                onPress={handleCreatePromoCode}
                disabled={creatingPromo}
              >
                {creatingPromo ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveCampaignText}>Launch Promo Code 🚀</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: DOCUMENT PHOTO ZOOM VIEWER */}
      <Modal visible={!!selectedZoomPhoto} transparent animationType="fade">
        <View style={styles.imageZoomOverlay}>
          <View style={styles.imageZoomCard}>
            <View style={styles.imageZoomHeader}>
              <View>
                <Text style={styles.imageZoomTitle}>{selectedZoomPhoto?.title}</Text>
                <Text style={styles.imageZoomSubtitle}>Driver: {selectedZoomPhoto?.driverName}</Text>
              </View>
              <TouchableOpacity
                style={styles.imageZoomCloseBtn}
                onPress={() => setSelectedZoomPhoto(null)}
              >
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            {selectedZoomPhoto?.url && (
              <Image
                source={{ uri: selectedZoomPhoto.url }}
                style={styles.imageZoomFull}
                resizeMode="contain"
              />
            )}

            <TouchableOpacity
              style={styles.imageZoomDoneBtn}
              onPress={() => setSelectedZoomPhoto(null)}
            >
              <Text style={styles.imageZoomDoneBtnText}>Close View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: DRIVER DECLINE / REJECT REASON */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={styles.adminModalOverlay}>
          <View style={styles.adminModalCard}>
            <View style={styles.adminModalHeader}>
              <View>
                <Text style={styles.adminModalTitle}>Decline Driver Application ❌</Text>
                <Text style={styles.adminModalSubtitle}>
                  Driver: {rejectingRider?.full_name} ({rejectingRider?.phone_number})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowRejectModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalFieldLabel}>SELECT REASON OR TYPE BELOW:</Text>
              <View style={{ gap: 8, marginBottom: 12 }}>
                {[
                  'Driving License photo is blurry or unreadable',
                  'Vehicle registration plate number mismatch',
                  'Permanent address document is incomplete',
                  'Passport photo is unclear / selfie required',
                  'Documents expired or invalid criteria',
                ].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.rejectPresetChip,
                      customRejectReason === preset && styles.rejectPresetChipActive,
                    ]}
                    onPress={() => setCustomRejectReason(preset)}
                  >
                    <Ionicons
                      name={customRejectReason === preset ? 'radio-button-on' : 'radio-button-off'}
                      size={15}
                      color={customRejectReason === preset ? '#ef4444' : '#9ca3af'}
                    />
                    <Text
                      style={[
                        styles.rejectPresetChipText,
                        customRejectReason === preset && styles.rejectPresetChipTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalFieldLabel}>CUSTOM REJECTION MESSAGE TO DRIVER *</Text>
              <TextInput
                style={[styles.adminInputField, { height: 75, textAlignVertical: 'top' }]}
                value={customRejectReason}
                onChangeText={setCustomRejectReason}
                multiline
                placeholder="Enter specific reason for declining this driver application..."
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSecondaryBtn, { flex: 1 }]}
                  onPress={() => setShowRejectModal(false)}
                >
                  <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalDangerBtn, { flex: 1 }]}
                  onPress={() => {
                    if (!customRejectReason.trim()) {
                      Alert.alert('Reason Required', 'Please provide a decline reason so the driver knows why.');
                      return;
                    }
                    if (rejectingRider) {
                      handleUpdateRiderStatus(rejectingRider.rider_id, 'rejected', customRejectReason.trim());
                    }
                  }}
                >
                  <Text style={styles.modalDangerBtnText}>Confirm Decline</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  adminSub: {
    fontSize: 11,
    color: '#6b7280',
  },
  logoutBtn: {
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#8b5cf6',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#8b5cf6',
    fontWeight: '700',
  },
  loaderCenter: {
    marginTop: 60,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  scrollBody: {
    padding: 16,
    paddingBottom: 60,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionSub: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '48%',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  commissionCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    alignItems: 'center',
  },
  commTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },
  commValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#047857',
    marginVertical: 4,
  },
  commSub: {
    fontSize: 11,
    color: '#059669',
  },
  rateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 14,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rateVehicleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  rateInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  ratePerKm: {
    fontSize: 13,
    color: '#6b7280',
  },
  saveRatesBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveRatesText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContainer: {
    gap: 10,
  },
  driverItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  driverItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  driverItemPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  driverLicense: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#4b5563',
    marginVertical: 8,
  },
  approvalButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  smallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Driver KYC & Approvals Styles
  riderFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  riderFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  riderFilterChipActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  riderFilterChipPendingActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  riderFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  riderFilterChipTextActive: {
    color: '#ffffff',
  },
  riderFilterChipPendingTextActive: {
    color: '#ffffff',
  },
  driverKycCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  driverKycCardPendingBorder: {
    borderColor: '#fbbf24',
    borderWidth: 1.5,
    backgroundColor: '#fffdfa',
  },
  driverSubmittedTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
  },
  driverInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    gap: 10,
  },
  driverInfoGridItem: {
    width: '48%',
  },
  driverGridLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  driverGridValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  addressBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 10,
    marginTop: 10,
  },
  addressItem: {},
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  addressText: {
    fontSize: 12,
    color: '#1e293b',
    marginTop: 2,
    lineHeight: 16,
  },
  docsPreviewContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  docsSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4b5563',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  docsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  docItemCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
  },
  docTitleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
  },
  docThumbClickable: {
    position: 'relative',
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  docThumbImage: {
    width: '100%',
    height: '100%',
  },
  zoomOverlayBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  zoomOverlayText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  docPlaceholderBox: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  docPlaceholderText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  rejectionNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  rejectionNoticeText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  // Document Zoom Modal
  imageZoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageZoomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    padding: 16,
    alignItems: 'center',
  },
  imageZoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  imageZoomTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  imageZoomSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  imageZoomCloseBtn: {
    padding: 6,
  },
  imageZoomFull: {
    width: '100%',
    height: 380,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  imageZoomDoneBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 14,
  },
  imageZoomDoneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rejectPresetChipActive: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  rejectPresetChipText: {
    fontSize: 12,
    color: '#374151',
  },
  rejectPresetChipTextActive: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  modalDangerBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalDangerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalSecondaryBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '700',
  },
  tripItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  tripItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3b82f6',
  },
  tripStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
  },
  tripAddress: {
    fontSize: 12,
    color: '#374151',
  },
  tripMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 6,
  },
  tripMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  tripFare: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10b981',
  },
  // Campaign Manager styles
  presetsCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    marginBottom: 16,
  },
  presetsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  presetBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
  },
  presetEmoji: {
    fontSize: 16,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350f',
  },
  campaignFormCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    gap: 14,
  },
  formFieldRow: {
    flexDirection: 'column',
    gap: 6,
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4b5563',
    letterSpacing: 0.5,
  },
  adminInputField: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  twoInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  toggleSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: '#10b981',
  },
  toggleInactive: {
    backgroundColor: '#ef4444',
  },
  toggleBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  saveCampaignBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    boxShadow: '0 4px 8px rgba(139, 92, 246, 0.25)',
  },
  saveCampaignText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteCampaignBtn: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteCampaignBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },
  festStatusBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
  },
  festStatusLive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  festStatusExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  festStatusInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  festStatusBannerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  dateHelperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    marginBottom: 10,
    fontWeight: '500',
  },
  adminBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  adminBackBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Campus Vehicle Admin Styles
  adminSecurityNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  adminSecurityNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
  },
  adminSecurityNoticeText: {
    fontSize: 11,
    color: '#047857',
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '500',
  },
  campusVehicleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
  },
  campusVehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  campusHostName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  campusHostPhone: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  campusStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeVerified: {
    backgroundColor: '#d1fae5',
  },
  statusBadgeBlocked: {
    backgroundColor: '#fee2e2',
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  campusStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextVerified: {
    color: '#059669',
  },
  statusTextBlocked: {
    color: '#dc2626',
  },
  statusTextPending: {
    color: '#d97706',
  },
  docDetailsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  docDetailBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  docDetailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6b7280',
    marginBottom: 2,
  },
  docDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  campusMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
    paddingTop: 4,
  },
  campusMetaText: {
    fontSize: 11,
    color: '#6b7280',
  },
  campusActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cvActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cvActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Promo Codes Styles
  promoCodeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  promoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoCodeBadge: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoCodeBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7c3aed',
    letterSpacing: 1,
  },
  promoDiscountPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  promoToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  promoToggleActive: {
    backgroundColor: '#10b981',
  },
  promoToggleInactive: {
    backgroundColor: '#9ca3af',
  },
  promoToggleBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  promoDeleteBtn: {
    padding: 4,
  },
  promoDescriptionText: {
    fontSize: 11,
    color: '#4b5563',
    marginVertical: 6,
  },
  promoMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  promoMetaItem: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  // Common Admin Modal Styles
  adminModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  adminModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    padding: 20,
  },
  adminModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  adminModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  adminModalSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  modalFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4b5563',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  adminCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  cardSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  hubdwarAdminBanner: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
});
