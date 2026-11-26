import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { User } from '../types';

interface AccountTabProps {
  onOpenWalletModal?: () => void;
  onBack?: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({ onOpenWalletModal, onBack }) => {
  const router = useRouter();
  const { user: storeUser, updateUser, logout } = useAuthStore();

  const [user, setUser] = useState<User | null>(storeUser);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Loyalty & Tier Status
  const [loyalty, setLoyalty] = useState<{
    completed_rides: number;
    free_rides_vouchers: number;
    total_discount_saved: number;
    tier_code: string;
    tier_name: string;
    badge_title: string;
    badge_icon: string;
    badge_color: string;
    discount_percent: number;
    is_first_ride: boolean;
    next_tier_name: string | null;
    next_tier_target: number;
    rides_needed_for_next_tier: number;
    progress_percent: number;
    perks: string[];
    is_permanent_member: boolean;
    swags_eligible: boolean;
  } | null>(null);

  // Active info or action modal
  const [activeModal, setActiveModal] = useState<
    'help' | 'wallet' | 'safety' | 'inbox' | 'settings' | 'manage' | 'delete' | 'loyalty_perks' | null
  >(null);

  // Form states for profile editing in 'manage' modal
  const [editName, setEditName] = useState(storeUser?.full_name || '');
  const [editEmail, setEditEmail] = useState(storeUser?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Form states for account deletion in 'delete' modal
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Fetch authenticated passenger info & loyalty from backend
  const fetchFreshProfile = async () => {
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const fresh = await api.auth.getMe();
      if (fresh) {
        setUser(fresh);
        updateUser(fresh);
        setEditName(fresh.full_name || '');
        setEditEmail(fresh.email || '');
      }
      try {
        const myLoyalty = await api.loyalty.getMyTier();
        if (myLoyalty) {
          setLoyalty(myLoyalty);
        }
      } catch (err) {
        console.warn('Loyalty fetch note:', err);
      }
    } catch (e: any) {
      console.warn('Could not fetch fresh user profile:', e);
      setProfileError('Using stored profile data.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchFreshProfile();
  }, []);

  // Update profile handler (PUT /api/auth/profile)
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await api.auth.updateProfile({
        full_name: editName.trim(),
        email: editEmail.trim() || undefined,
      });

      setUser(updated);
      updateUser(updated);
      Alert.alert('Profile Updated! 🎉', 'Your personal details have been updated successfully.');
      setActiveModal(null);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Secure account deletion handler (DELETE /api/auth/account)
  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim() !== 'DELETE MY ACCOUNT') {
      Alert.alert(
        'Confirmation Required',
        'Please type "DELETE MY ACCOUNT" exactly to confirm permanent deletion.'
      );
      return;
    }

    setDeletingAccount(true);
    try {
      await api.auth.deleteAccount('DELETE MY ACCOUNT', deletePassword || undefined);
      logout();
      Alert.alert(
        'Account Deleted',
        'Your account and all associated personal data have been permanently deleted.'
      );
      router.replace('/(auth)/login');
    } catch (err: any) {
      Alert.alert('Deletion Failed', err.message || 'Could not delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.auth.logout();
          } catch (e) {
            console.warn('Backend logout token revocation call failed:', e);
          }
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Logout from all devices
  const handleLogoutAll = () => {
    Alert.alert('Sign Out All Devices', 'This will revoke all active sessions across all phones and browsers.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out Everywhere',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.auth.logoutAll();
          } catch (e) {
            console.warn('Backend logout all call failed:', e);
          }
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const menuItems = [
    {
      id: 'manage',
      title: 'Manage Account & Contact',
      subtitle: 'Edit full name, email, KYC & verified phone',
      icon: 'person-circle-outline',
      color: '#0f172a',
      badge: 'Editable',
    },
    {
      id: 'settings',
      title: 'Settings & Privacy Controls',
      subtitle: '30-day location retention, cache & sessions',
      icon: 'shield-checkmark-outline',
      color: '#10b981',
      badge: 'Protected',
    },
    {
      id: 'wallet',
      title: 'Wallet & Payments',
      subtitle: 'IndiRide Cash: ₹450.00 • UPI, Cards & Cash',
      icon: 'wallet-outline',
      color: '#0284c7',
      badge: '₹450.00',
    },
    {
      id: 'safety',
      title: 'Safety Toolkit & SOS',
      subtitle: 'Emergency button 112, trusted contacts & PIN',
      icon: 'alert-circle-outline',
      color: '#ef4444',
      badge: 'Active',
    },
    {
      id: 'help',
      title: 'Help & 24x7 Support',
      subtitle: 'Ride issues, lost items, safety & FAQ',
      icon: 'help-circle-outline',
      color: '#3b82f6',
    },
    {
      id: 'inbox',
      title: 'Inbox & Offers',
      subtitle: 'Diwali 50% discount voucher, trip invoices',
      icon: 'mail-outline',
      color: '#8b5cf6',
      badge: '1 Offer',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Top Back Navigation Row */}
        {onBack && (
          <TouchableOpacity style={styles.topBackBtn} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
            <Text style={styles.topBackBtnText}>Back to Home</Text>
          </TouchableOpacity>
        )}

        {/* Authenticated Passenger Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => {
            setEditName(user?.full_name || '');
            setEditEmail(user?.email || '');
            setActiveModal('manage');
          }}
          activeOpacity={0.85}
        >
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={28} color="#000000" />
          </View>
          <View style={styles.profileDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>
                {user?.full_name && user.full_name !== 'Rider User' && user.full_name.trim().toLowerCase() !== 'rider'
                  ? user.full_name
                  : 'Tap to Set Your Real Name ✏️'}
              </Text>
              <View style={styles.starBadge}>
                <Ionicons name="star" size={11} color="#f59e0b" />
                <Text style={styles.starText}>
                  {user?.passenger_profile?.rating
                    ? user.passenger_profile.rating.toFixed(1)
                    : '5.0'}
                </Text>
              </View>
            </View>
            <Text style={styles.profilePhone}>📞 {user?.phone_number || 'Phone Verified'}</Text>
            {user?.email ? (
              <Text style={styles.profileEmail}>✉️ {user.email}</Text>
            ) : (
              <Text style={styles.profileEmailPlaceholder}>+ Add email address</Text>
            )}
            <View style={styles.memberPillRow}>
              <View style={styles.memberPill}>
                <Ionicons name="shield-checkmark" size={10} color="#15803d" />
                <Text style={styles.memberText}>KYC Verified Passenger</Text>
              </View>
              <View style={styles.editPill}>
                <Ionicons name="pencil" size={10} color="#0284c7" />
                <Text style={styles.editText}>Edit Profile</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* User Loyalty & Tier Card (Bronze, Silver, Gold, Diamond, or 90% 1st Ride) */}
        <TouchableOpacity
          style={styles.loyaltyCard}
          onPress={() => setActiveModal('loyalty_perks')}
          activeOpacity={0.9}
        >
          <View style={styles.loyaltyHeaderRow}>
            <View style={styles.loyaltyBadgePill}>
              <Text style={styles.loyaltyBadgeIcon}>{loyalty?.badge_icon || '🎉'}</Text>
              <Text style={styles.loyaltyBadgeTitle}>{loyalty?.badge_title || 'New User Special'}</Text>
            </View>
            <View style={[styles.loyaltyDiscountBadge, { backgroundColor: loyalty?.badge_color ? `${loyalty.badge_color}20` : '#fdf2f8' }]}>
              <Text style={[styles.loyaltyDiscountText, { color: loyalty?.badge_color || '#db2777' }]}>
                {loyalty?.discount_percent && loyalty.discount_percent > 0
                  ? `${loyalty.discount_percent}% OFF`
                  : 'Active Member'}
              </Text>
            </View>
          </View>

          {loyalty?.is_first_ride ? (
            <View style={styles.welcomeBannerBox}>
              <Text style={styles.welcomeBannerTitle}>🎉 Welcome to IndiRide!</Text>
              <Text style={styles.welcomeBannerSub}>
                Flat 90% OFF auto-applied on your very 1st ride! After 1st ride, you transition to regular member.
              </Text>
            </View>
          ) : (
            <View style={styles.loyaltyProgressBox}>
              <View style={styles.loyaltyStatsRow}>
                <Text style={styles.loyaltyRidesCount}>
                  Completed Rides: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{loyalty?.completed_rides || 0}</Text>
                </Text>
                {loyalty?.next_tier_name && (
                  <Text style={styles.loyaltyNextTarget}>
                    Next: {loyalty.next_tier_name} ({loyalty.rides_needed_for_next_tier} more)
                  </Text>
                )}
              </View>
              {loyalty?.next_tier_name && (
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, loyalty.progress_percent)}%`, backgroundColor: loyalty?.badge_color || '#b45309' }]} />
                </View>
              )}
            </View>
          )}

          {/* Vouchers & Perks Ribbon */}
          <View style={styles.loyaltyRibbonRow}>
            {loyalty && loyalty.free_rides_vouchers > 0 ? (
              <View style={styles.voucherPill}>
                <Ionicons name="gift" size={12} color="#059669" />
                <Text style={styles.voucherPillText}>
                  {loyalty.free_rides_vouchers} Free Ride Voucher{loyalty.free_rides_vouchers > 1 ? 's' : ''} Ready!
                </Text>
              </View>
            ) : null}
            {loyalty?.is_permanent_member && (
              <View style={styles.diamondPill}>
                <Ionicons name="diamond" size={12} color="#0284c7" />
                <Text style={styles.diamondPillText}>Permanent Member • Swags & Gifts</Text>
              </View>
            )}
            <View style={styles.viewPerksLink}>
              <Text style={styles.viewPerksLinkText}>View Tiers & Rewards →</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Stats: Wallet, Safety Score & Festive Reward */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => {
              if (onOpenWalletModal) onOpenWalletModal();
              else setActiveModal('wallet');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.statIconCircle}>
              <Ionicons name="wallet" size={16} color="#10b981" />
            </View>
            <Text style={styles.statTitle}>IndiRide Cash</Text>
            <Text style={styles.statValue}>₹450.00</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => setActiveModal('safety')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconCircle, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="shield-checkmark" size={16} color="#ef4444" />
            </View>
            <Text style={styles.statTitle}>Safety Score</Text>
            <Text style={[styles.statValue, { color: '#059669' }]}>100% Safe</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => setActiveModal('inbox')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconCircle, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="gift" size={16} color="#8b5cf6" />
            </View>
            <Text style={styles.statTitle}>Festival Offer</Text>
            <Text style={[styles.statValue, { color: '#8b5cf6' }]}>50% Off</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Options List */}
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => {
                if (item.id === 'manage') {
                  setEditName(user?.full_name || '');
                  setEditEmail(user?.email || '');
                }
                setActiveModal(item.id as any);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>

              <View style={styles.menuTextColumn}>
                <View style={styles.menuTitleRow}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {item.badge && (
                    <View
                      style={[
                        styles.badgeTag,
                        item.id === 'wallet' && { backgroundColor: '#dcfce7' },
                        item.id === 'safety' && { backgroundColor: '#fee2e2' },
                        item.id === 'manage' && { backgroundColor: '#e0f2fe' },
                        item.id === 'settings' && { backgroundColor: '#dcfce7' },
                        item.id === 'inbox' && { backgroundColor: '#ede9fe' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeTagText,
                          item.id === 'wallet' && { color: '#15803d' },
                          item.id === 'safety' && { color: '#dc2626' },
                          item.id === 'manage' && { color: '#0369a1' },
                          item.id === 'settings' && { color: '#15803d' },
                          item.id === 'inbox' && { color: '#7c3aed' },
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Developer / Role Switcher */}
        <View style={styles.switcherSection}>
          <Text style={styles.switcherTitle}>DEVELOPER / ROLE CONSOLE</Text>
          <View style={styles.switcherRow}>
            <TouchableOpacity
              style={styles.switchPill}
              onPress={() => router.replace('/(rider)')}
            >
              <Text style={styles.switchPillText}>🏍️ Switch to Driver App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchPill}
              onPress={() => router.replace('/(admin)')}
            >
              <Text style={styles.switchPillText}>⚙️ Super Admin Console</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button (Revokes Token) */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
          <Text style={styles.logoutBtnText}>Sign Out of Ride</Text>
        </TouchableOpacity>

        {/* Account Deletion Flow Link */}
        <TouchableOpacity
          style={styles.deleteAccountLink}
          onPress={() => {
            setDeleteConfirmation('');
            setDeletePassword('');
            setActiveModal('delete');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={14} color="#94a3b8" />
          <Text style={styles.deleteAccountLinkText}>Delete Account & Personal Data</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: LOYALTY TIERS & REWARDS BREAKDOWN */}
      <Modal visible={activeModal === 'loyalty_perks'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeading}>IndiRide Loyalty Tiers 🏆</Text>
                <Text style={styles.modalSubheading}>Exclusive discounts, free rides & VIP prizes</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Current Status Box */}
              <View style={styles.currentTierStatusBox}>
                <View style={styles.currentTierStatusHeader}>
                  <Text style={styles.currentTierIcon}>{loyalty?.badge_icon || '👤'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentTierName}>{loyalty?.tier_name || 'Active Member'}</Text>
                    <Text style={styles.currentTierRides}>
                      Completed Rides: <Text style={{ fontWeight: '800' }}>{loyalty?.completed_rides || 0}</Text>
                    </Text>
                  </View>
                  <View style={styles.currentTierPill}>
                    <Text style={styles.currentTierPillText}>
                      {loyalty?.discount_percent && loyalty.discount_percent > 0 ? `${loyalty.discount_percent}% OFF` : 'Standard Rate'}
                    </Text>
                  </View>
                </View>
                {loyalty?.free_rides_vouchers ? (
                  <View style={styles.vouchersNoticeRow}>
                    <Ionicons name="gift" size={14} color="#059669" />
                    <Text style={styles.vouchersNoticeText}>
                      You have {loyalty.free_rides_vouchers} Free Ride Voucher(s) ready to use on booking!
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Tiers List */}
              <Text style={styles.tiersSectionHeading}>All Loyalty Tiers & Benefits</Text>

              {/* 1. New User */}
              <View style={[styles.tierDetailCard, loyalty?.tier_code === 'NEW_USER' && styles.tierDetailCardActive]}>
                <View style={styles.tierDetailHeader}>
                  <Text style={styles.tierEmoji}>🎉</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierDetailTitle}>New User Special</Text>
                    <Text style={styles.tierDetailTarget}>1st Ride</Text>
                  </View>
                  <View style={[styles.tierDiscountBadge, { backgroundColor: '#fce7f3' }]}>
                    <Text style={[styles.tierDiscountBadgeText, { color: '#db2777' }]}>90% OFF</Text>
                  </View>
                </View>
                <Text style={styles.tierDetailDesc}>
                  Automatic 90% discount applied on your first ride. After completing this ride, you transition to normal member status.
                </Text>
              </View>

              {/* 2. Bronze */}
              <View style={[styles.tierDetailCard, loyalty?.tier_code === 'BRONZE' && styles.tierDetailCardActive]}>
                <View style={styles.tierDetailHeader}>
                  <Text style={styles.tierEmoji}>🥉</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierDetailTitle}>Bronze Member</Text>
                    <Text style={styles.tierDetailTarget}>100 Completed Rides</Text>
                  </View>
                  <View style={[styles.tierDiscountBadge, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.tierDiscountBadgeText, { color: '#b45309' }]}>10% OFF</Text>
                  </View>
                </View>
                <Text style={styles.tierDetailDesc}>
                  • Flat 10% discount auto-applied on every ride{'\n'}
                  • 🎁 1 Free Ride Voucher awarded upon reaching 100 rides{'\n'}
                  • Bronze badge proudly displayed on your profile
                </Text>
              </View>

              {/* 3. Silver */}
              <View style={[styles.tierDetailCard, loyalty?.tier_code === 'SILVER' && styles.tierDetailCardActive]}>
                <View style={styles.tierDetailHeader}>
                  <Text style={styles.tierEmoji}>🥈</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierDetailTitle}>Silver Member</Text>
                    <Text style={styles.tierDetailTarget}>150 Completed Rides</Text>
                  </View>
                  <View style={[styles.tierDiscountBadge, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={[styles.tierDiscountBadgeText, { color: '#475569' }]}>15% OFF</Text>
                  </View>
                </View>
                <Text style={styles.tierDetailDesc}>
                  • Flat 15% discount auto-applied on every ride (strictly 15%, replaces Bronze 10%){'\n'}
                  • 🎁 1 Free Ride Voucher awarded upon reaching 150 rides{'\n'}
                  • Silver badge on profile & priority peak hour matching
                </Text>
              </View>

              {/* 4. Golden */}
              <View style={[styles.tierDetailCard, loyalty?.tier_code === 'GOLD' && styles.tierDetailCardActive]}>
                <View style={styles.tierDetailHeader}>
                  <Text style={styles.tierEmoji}>🥇</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierDetailTitle}>Golden Member</Text>
                    <Text style={styles.tierDetailTarget}>200 Completed Rides</Text>
                  </View>
                  <View style={[styles.tierDiscountBadge, { backgroundColor: '#fef9c3' }]}>
                    <Text style={[styles.tierDiscountBadgeText, { color: '#ca8a04' }]}>20% OFF</Text>
                  </View>
                </View>
                <Text style={styles.tierDetailDesc}>
                  • Flat 20% discount auto-applied on every ride{'\n'}
                  • 🎁 2 Free Ride Vouchers awarded upon reaching 200 rides{'\n'}
                  • Golden badge & dedicated helpline support
                </Text>
              </View>

              {/* 5. Diamond VIP */}
              <View style={[styles.tierDetailCard, loyalty?.tier_code === 'DIAMOND' && styles.tierDetailCardActive]}>
                <View style={styles.tierDetailHeader}>
                  <Text style={styles.tierEmoji}>💎</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierDetailTitle}>Diamond VIP Member</Text>
                    <Text style={styles.tierDetailTarget}>300 Completed Rides</Text>
                  </View>
                  <View style={[styles.tierDiscountBadge, { backgroundColor: '#cffafe' }]}>
                    <Text style={[styles.tierDiscountBadgeText, { color: '#0891b2' }]}>25% OFF</Text>
                  </View>
                </View>
                <Text style={styles.tierDetailDesc}>
                  • Flat 25% discount auto-applied permanently{'\n'}
                  • 👑 Permanent Member of IndiRide prestige status{'\n'}
                  • 🎁 Exclusive IndiRide Swags, Gift Box & Merchandise kit{'\n'}
                  • 🏆 Special surprise prizes by IndiRide & 24x7 priority support
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveProfileBtn} onPress={() => setActiveModal(null)}>
              <Text style={styles.saveProfileBtnText}>Got It!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 1: MANAGE ACCOUNT & PROFILE UPDATES */}
      <Modal visible={activeModal === 'manage'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeading}>Manage Profile</Text>
                <Text style={styles.modalSubheading}>Update your full name and email address</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.formStack}>
              {/* Phone (Read Only, Verified) */}
              <Text style={styles.formLabel}>REGISTERED PHONE NUMBER (VERIFIED)</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{user?.phone_number || 'N/A'}</Text>
                <View style={styles.verifiedTag}>
                  <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                  <Text style={styles.verifiedTagText}>OTP Verified</Text>
                </View>
              </View>
              <Text style={styles.fieldHelpText}>
                Phone numbers are cryptographically bound to OTP sessions. To change, use SIM verification.
              </Text>

              {/* Full Name */}
              <Text style={styles.formLabel}>FULL NAME</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your full name"
                placeholderTextColor="#94a3b8"
              />

              {/* Email Address */}
              <Text style={styles.formLabel}>EMAIL ADDRESS (FOR INVOICES)</Text>
              <TextInput
                style={styles.modalInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="e.g. name@example.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.saveProfileBtn}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.85}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveProfileBtnText}>Save Profile Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: SETTINGS & PRIVACY CONTROLS */}
      <Modal visible={activeModal === 'settings'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeading}>Settings & Privacy</Text>
                <Text style={styles.modalSubheading}>Location history retention & session security</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.infoStack}>
              {/* Location Privacy Rule */}
              <View style={styles.privacyCard}>
                <View style={styles.privacyCardHeader}>
                  <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                  <Text style={styles.privacyCardTitle}>30-Day Location Retention</Text>
                </View>
                <Text style={styles.privacyCardText}>
                  In full compliance with DPDP & privacy principles, passenger and rider GPS breadcrumbs are automatically purged from the server after 30 days. No perpetual tracking logs are retained.
                </Text>
              </View>

              {/* Cache Clearing */}
              <View style={styles.settingActionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingActionTitle}>App Cache & Temporary Files</Text>
                  <Text style={styles.settingActionDesc}>Purge cached geocoding places and map tiles</Text>
                </View>
                <TouchableOpacity
                  style={styles.cacheClearBtn}
                  onPress={() => Alert.alert('Cache Purged', 'Local temporary storage has been cleared.')}
                >
                  <Text style={styles.cacheClearBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Sign Out All Devices */}
              <View style={styles.settingActionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingActionTitle}>Revoke All Active Sessions</Text>
                  <Text style={styles.settingActionDesc}>Sign out from all other browsers and phones</Text>
                </View>
                <TouchableOpacity
                  style={styles.revokeSessionsBtn}
                  onPress={handleLogoutAll}
                >
                  <Text style={styles.revokeSessionsBtnText}>Sign Out All</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalDoneText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: SECURE ACCOUNT DELETION */}
      <Modal visible={activeModal === 'delete'} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: '#fca5a5', borderWidth: 1.5 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalHeading, { color: '#dc2626' }]}>Delete Account</Text>
                <Text style={styles.modalSubheading}>Permanent erasure of personal data</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.deleteWarningBox}>
              <Ionicons name="warning" size={18} color="#dc2626" />
              <Text style={styles.deleteWarningText}>
                WARNING: Deleting your account is irreversible. All your booking history, profile credentials, active ride sessions, and personal identifiers will be permanently destroyed.
              </Text>
            </View>

            <Text style={styles.formLabel}>TYPE "DELETE MY ACCOUNT" TO CONFIRM</Text>
            <TextInput
              style={[
                styles.modalInput,
                deleteConfirmation === 'DELETE MY ACCOUNT' && { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
              ]}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="DELETE MY ACCOUNT"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[
                styles.deleteConfirmBtn,
                deleteConfirmation.trim() !== 'DELETE MY ACCOUNT' && styles.deleteConfirmBtnDisabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={deleteConfirmation.trim() !== 'DELETE MY ACCOUNT' || deletingAccount}
              activeOpacity={0.85}
            >
              {deletingAccount ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.deleteConfirmBtnText}>Permanently Delete My Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelDeleteBtn}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.cancelDeleteBtnText}>Cancel and Keep Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: OTHER STANDARD MODALS (WALLET, SAFETY, HELP, INBOX) */}
      <Modal
        visible={['help', 'wallet', 'safety', 'inbox'].includes(activeModal || '')}
        transparent
        animationType="fade"
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>
                {activeModal === 'help'
                  ? 'Help & Support'
                  : activeModal === 'wallet'
                  ? 'Wallet & IndiRide Cash'
                  : activeModal === 'safety'
                  ? 'Safety Toolkit'
                  : 'Notifications & Offers'}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {activeModal === 'help' && (
                <View style={styles.infoStack}>
                  <Text style={styles.infoTitle}>How can we help today?</Text>
                  <Text style={styles.infoText}>• Help with a recent ride or fare inquiry</Text>
                  <Text style={styles.infoText}>• Lost an item during your trip</Text>
                  <Text style={styles.infoText}>• 24x7 Helpline: +91 1800 200 9090</Text>
                  <Text style={styles.infoText}>• Safety incident report & emergency response</Text>
                </View>
              )}

              {activeModal === 'wallet' && (
                <View style={styles.infoStack}>
                  <View style={styles.balanceHighlight}>
                    <Text style={styles.balanceLabel}>INDIRIDE CASH BALANCE</Text>
                    <Text style={styles.balanceBig}>₹450.00</Text>
                  </View>
                  <Text style={styles.infoTitle}>Supported Payment Methods</Text>
                  <Text style={styles.infoText}>✓ Google Pay / PhonePe UPI (Linked)</Text>
                  <Text style={styles.infoText}>✓ Cash on Pickup / Drop</Text>
                  <Text style={styles.infoText}>✓ Credit / Debit Cards (Secured with 2FA)</Text>
                </View>
              )}

              {activeModal === 'safety' && (
                <View style={styles.infoStack}>
                  <Text style={styles.infoTitle}>Your Safety is Our Top Priority</Text>
                  <TouchableOpacity
                    style={styles.sosButton}
                    onPress={() => Alert.alert('Emergency SOS', 'Dialing 112 Emergency Response Services...')}
                  >
                    <Ionicons name="alert-circle" size={18} color="#ffffff" />
                    <Text style={styles.sosButtonText}>Emergency SOS Call (112)</Text>
                  </TouchableOpacity>
                  <Text style={styles.infoText}>• 4-Digit Pickup OTP Verification for all rides</Text>
                  <Text style={styles.infoText}>• Real-time driver GPS tracking</Text>
                  <Text style={styles.infoText}>• Share live location with family</Text>
                </View>
              )}

              {activeModal === 'inbox' && (
                <View style={styles.infoStack}>
                  <Text style={styles.infoTitle}>Active Vouchers & Updates</Text>
                  <Text style={styles.infoText}>🪔 Diwali Special: Use DIWALI50 for flat 50% discount on all Bike & Auto rides!</Text>
                  <Text style={styles.infoText}>🛡️ Safety Tip: Confirm rider registration plate and 4-digit OTP before boarding.</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
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
  scrollBody: {
    padding: 16,
    paddingBottom: 60,
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  topBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  profileDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  starText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  profilePhone: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    marginTop: 2,
  },
  profileEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  profileEmailPlaceholder: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 1,
  },
  memberPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  memberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  editText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  menuList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextColumn: {
    flex: 1,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  badgeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  menuSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  switcherSection: {
    marginBottom: 16,
  },
  switcherTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  switcherRow: {
    flexDirection: 'row',
    gap: 10,
  },
  switchPill: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  switchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 10,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  deleteAccountLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  deleteAccountLinkText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubheading: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  formStack: {
    gap: 8,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  readOnlyText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  fieldHelpText: {
    fontSize: 10,
    color: '#94a3b8',
    lineHeight: 14,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 4,
  },
  saveProfileBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveProfileBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  privacyCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 10,
  },
  privacyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  privacyCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  privacyCardText: {
    fontSize: 11,
    color: '#14532d',
    lineHeight: 16,
  },
  settingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  settingActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  settingActionDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  cacheClearBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cacheClearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  revokeSessionsBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  revokeSessionsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
    marginBottom: 12,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#991b1b',
    lineHeight: 15,
  },
  deleteConfirmBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteConfirmBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  deleteConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelDeleteBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelDeleteBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContent: {
    marginBottom: 16,
  },
  infoStack: {
    gap: 8,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  balanceHighlight: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  balanceBig: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803d',
    marginTop: 2,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
    marginVertical: 6,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalDoneBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalDoneText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  // Loyalty & Tier Card Styles
  loyaltyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  loyaltyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  loyaltyBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loyaltyBadgeIcon: {
    fontSize: 18,
  },
  loyaltyBadgeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  loyaltyDiscountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  loyaltyDiscountText: {
    fontSize: 11,
    fontWeight: '900',
  },
  welcomeBannerBox: {
    backgroundColor: '#fdf2f8',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fbcfe8',
    marginBottom: 8,
  },
  welcomeBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#be185d',
    marginBottom: 2,
  },
  welcomeBannerSub: {
    fontSize: 11,
    color: '#9d174d',
    lineHeight: 15,
  },
  loyaltyProgressBox: {
    marginBottom: 8,
  },
  loyaltyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  loyaltyRidesCount: {
    fontSize: 11,
    color: '#64748b',
  },
  loyaltyNextTarget: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  loyaltyRibbonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  voucherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  voucherPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  diamondPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  diamondPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
  },
  viewPerksLink: {
    marginLeft: 'auto',
  },
  viewPerksLinkText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366f1',
  },
  currentTierStatusBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  currentTierStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentTierIcon: {
    fontSize: 24,
  },
  currentTierName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  currentTierRides: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  currentTierPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  currentTierPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  vouchersNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  vouchersNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  tiersSectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  tierDetailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 8,
  },
  tierDetailCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  tierDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tierEmoji: {
    fontSize: 18,
  },
  tierDetailTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  tierDetailTarget: {
    fontSize: 10,
    color: '#64748b',
  },
  tierDiscountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tierDetailDesc: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginTop: 2,
  },
});
