import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { PassengerRideRequestItem } from '../../types';
import { CampusPostRideView } from './CampusPostRideView';
import { CampusMyPostedView, PostedRideType } from './CampusMyPostedView';

type DriverCampusSubTab = 'post' | 'studentRequests' | 'settings' | 'activeRides';

interface CampusProfileData {
  rider_service_type: string;
  served_universities: string;
  full_name: string;
  phone_number: string;
  is_approved: boolean;
}

export const CampusDriverPanel: React.FC = () => {
  const [currentSubTab, setCurrentSubTab] = useState<DriverCampusSubTab>('activeRides');

  // Campus Profile Data
  const [profile, setProfile] = useState<CampusProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  // Edit Served Universities in Settings
  const [editServedUnis, setEditServedUnis] = useState<string>('');
  const [editServiceType, setEditServiceType] = useState<string>('CAMPUS');
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [newUniInput, setNewUniInput] = useState<string>('');

  // Active Posted Rides & Bookings
  const [postedRides, setPostedRides] = useState<PostedRideType[]>([]);
  const [loadingPosted, setLoadingPosted] = useState<boolean>(false);

  // Pending bookings count across all posted rides for live tab badge
  const pendingBookingsCount = postedRides.reduce(
    (total, ride) => total + (ride.bookings || []).filter((b) => b.status === 'PENDING').length,
    0
  );

  // Student Requests matching driver's universities
  const [studentRequests, setStudentRequests] = useState<PassengerRideRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);

  // Pre-fill for Post Ride if matched from Student Request
  const [prefillUniversity, setPrefillUniversity] = useState<string>('Parul University');

  // 1. Load Driver Campus Profile
  const loadProfile = useCallback(async () => {
    try {
      const data = await api.rider.getCampusProfile();
      setProfile(data);
      setEditServedUnis(data.served_universities || '');
      setEditServiceType(data.rider_service_type || 'CAMPUS');
      if (data.served_universities) {
        const firstUni = data.served_universities.split(',')[0].trim();
        if (firstUni) setPrefillUniversity(firstUni);
      }
    } catch (e) {
      console.warn('Could not load campus profile:', e);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // 2. Load Driver Posted Rides
  const loadPostedRides = useCallback(async () => {
    setLoadingPosted(true);
    try {
      const data = await api.campusRides.getMyPosted();
      setPostedRides(data as any);
    } catch (e) {
      console.warn('Could not load posted campus rides:', e);
    } finally {
      setLoadingPosted(false);
    }
  }, []);

  // 3. Load Student Commute Requests
  const loadStudentRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const data = await api.rider.getCampusStudentRequests();
      setStudentRequests(data || []);
    } catch (e) {
      console.warn('Could not load student requests:', e);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadPostedRides();
    loadStudentRequests();
  }, [loadProfile, loadPostedRides, loadStudentRequests]);

  // Handle Booking Accept
  const handleAcceptBooking = async (bookingId: string) => {
    try {
      await api.campusRides.acceptBooking(bookingId);
      Alert.alert('Booking Confirmed! ✅', 'Passenger seat is confirmed. Your phone and ride details have been shared with the passenger.');
      loadPostedRides();
    } catch (e: any) {
      Alert.alert('Action Failed', e.message || 'Could not accept booking request.');
    }
  };

  // Handle Booking Reject
  const handleRejectBooking = async (bookingId: string) => {
    try {
      await api.campusRides.rejectBooking(bookingId);
      Alert.alert('Booking Declined', 'The passenger booking request was declined.');
      loadPostedRides();
    } catch (e: any) {
      Alert.alert('Action Failed', e.message || 'Could not decline booking request.');
    }
  };

  // Handle Cancel Posted Ride
  const handleCancelRide = async (rideId: string) => {
    try {
      await api.communityRides.delete(rideId);
      Alert.alert('Ride Deleted', 'Your posted campus ride has been deleted.');
      loadPostedRides();
    } catch (e: any) {
      Alert.alert('Action Failed', e.message || 'Could not delete ride.');
    }
  };

  // Handle Post Ride Submit
  const handlePostSubmit = async (rideData: any) => {
    return await api.campusRides.postRide(rideData);
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.rider.updateCampusProfile({
        rider_service_type: editServiceType,
        served_universities: editServedUnis.trim(),
      });
      Alert.alert('Profile Saved! 🎓', res.message || 'Campus driver settings updated successfully.');
      loadProfile();
      loadStudentRequests();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Multiple Universities Helpers (Case-Insensitive p=P matching)
  const handleAddUniversity = (targetName: string) => {
    const trimmed = targetName.trim();
    if (!trimmed) return;
    const currentList = editServedUnis
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    // Case-insensitive check (p=P, Parul = parul)
    const exists = currentList.some((u) => u.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      Alert.alert('Already Added', `"${trimmed}" is already in your served universities list.`);
      return;
    }

    const updated = [...currentList, trimmed];
    setEditServedUnis(updated.join(', '));
    setNewUniInput('');
  };

  const handleRemoveUniversity = (targetName: string) => {
    const currentList = editServedUnis
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    const updated = currentList.filter(
      (u) => u.toLowerCase() !== targetName.trim().toLowerCase()
    );
    setEditServedUnis(updated.join(', '));
  };

  const servedList = (profile?.served_universities || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  return (
    <View style={styles.container}>
      {/* 1. DRIVER PROFILE HEADER */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>Campus Driver Hub</Text>
              <View style={[styles.typeBadge, profile?.rider_service_type === 'CAMPUS' ? styles.typeBadgeCampus : styles.typeBadgeRegular]}>
                <Ionicons
                  name={profile?.rider_service_type === 'CAMPUS' ? 'school' : 'car'}
                  size={12}
                  color={profile?.rider_service_type === 'CAMPUS' ? '#166534' : '#0369a1'}
                />
                <Text style={[styles.typeBadgeText, profile?.rider_service_type === 'CAMPUS' ? { color: '#166534' } : { color: '#0369a1' }]}>
                  {profile?.rider_service_type === 'CAMPUS' ? 'University Driver' : 'City Driver'}
                </Text>
              </View>
            </View>
            <Text style={styles.driverNameText}>
              {profile?.full_name || 'Driver Partner'} • {profile?.phone_number || ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editUnisBtn}
            onPress={() => setCurrentSubTab('settings')}
          >
            <Ionicons name="school" size={14} color="#0284c7" />
            <Text style={styles.editUnisBtnText}>Universities</Text>
          </TouchableOpacity>
        </View>

        {/* Served Universities Chips */}
        {profile?.rider_service_type === 'CAMPUS' && servedList.length > 0 ? (
          <View style={styles.unisChipRow}>
            <Text style={styles.unisLabel}>Served Campuses:</Text>
            {servedList.map((uni, idx) => (
              <View key={idx} style={styles.uniChip}>
                <Ionicons name="business" size={11} color="#059669" />
                <Text style={styles.uniChipText}>{uni}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* 2. SUB-TABS BAR (Post Ride, Student Requests, Universities, My Bookings) */}
      <View style={styles.subTabBar}>
        {[
          { id: 'post', label: 'Post Ride', icon: 'add-circle' },
          { id: 'studentRequests', label: 'Student Requests', icon: 'people' },
          { id: 'settings', label: 'Universities', icon: 'school' },
          { id: 'activeRides', label: 'My Bookings', icon: 'ticket', badge: pendingBookingsCount },
        ].map((tab) => {
          const isActive = currentSubTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTabItem, isActive && styles.subTabItemActive]}
              onPress={() => setCurrentSubTab(tab.id as DriverCampusSubTab)}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? '#0284c7' : '#64748b'}
                />
                {!!tab.badge && tab.badge > 0 && (
                  <View style={styles.subTabBadge}>
                    <Text style={styles.subTabBadgeText}>{tab.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.subTabLabel, isActive && styles.subTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. SUB-TAB CONTENT */}
      <View style={{ flex: 1, padding: 12 }}>
        {/* TAB 1: ACTIVE RIDES & INCOMING BOOKINGS */}
        {currentSubTab === 'activeRides' && (
          <CampusMyPostedView
            postedRides={postedRides}
            loading={loadingPosted}
            onRefresh={loadPostedRides}
            onAcceptBooking={handleAcceptBooking}
            onRejectBooking={handleRejectBooking}
            onCancelRide={handleCancelRide}
          />
        )}

        {/* TAB 2: POST NEW CAMPUS RIDE */}
        {currentSubTab === 'post' && (
          <CampusPostRideView
            defaultUniversityName={prefillUniversity}
            onPostSubmit={handlePostSubmit}
            onPostSuccess={() => {
              loadPostedRides();
              setCurrentSubTab('activeRides');
            }}
          />
        )}

        {/* TAB 3: STUDENT COMMUTE REQUESTS */}
        {currentSubTab === 'studentRequests' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  Students Needing Rides ({studentRequests.length})
                </Text>
                <Text style={styles.sectionSub}>
                  Live passenger requests matching your registered universities
                </Text>
              </View>
              <TouchableOpacity onPress={loadStudentRequests} style={{ padding: 4 }}>
                <Ionicons name="refresh" size={18} color="#0284c7" />
              </TouchableOpacity>
            </View>

            {loadingRequests ? (
              <ActivityIndicator size="large" color="#0284c7" style={{ marginVertical: 30 }} />
            ) : studentRequests.length === 0 ? (
              <View style={styles.emptyRequestsBox}>
                <Ionicons name="checkmark-done-circle" size={44} color="#94a3b8" />
                <Text style={styles.emptyRequestsTitle}>No Unmatched Student Requests</Text>
                <Text style={styles.emptyRequestsSub}>
                  All recent passenger requests for your universities have been answered. You can also post a scheduled ride to let students discover you!
                </Text>
                <TouchableOpacity
                  style={styles.postNowBtn}
                  onPress={() => setCurrentSubTab('post')}
                >
                  <Ionicons name="add-circle" size={16} color="#ffffff" />
                  <Text style={styles.postNowBtnText}>Post a Scheduled Ride</Text>
                </TouchableOpacity>
              </View>
            ) : (
              studentRequests.map((req) => (
                <View key={req.id} style={styles.studentReqCard}>
                  <View style={styles.reqHeaderRow}>
                    <View style={styles.timeBadge}>
                      <Ionicons name="calendar-outline" size={12} color="#0284c7" />
                      <Text style={styles.timeBadgeText}>
                        {req.travel_date} • {req.preferred_time}
                      </Text>
                    </View>
                    <View style={styles.seatsBudgetBadge}>
                      <Text style={styles.seatsBudgetText}>
                        {req.passengers_count} seat(s) • ₹{req.max_budget_per_seat || 45}/seat
                      </Text>
                    </View>
                  </View>

                  <View style={styles.studentInfoRow}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarText}>{req.passenger_name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{req.passenger_name}</Text>
                      <Text style={styles.studentPhone}>{req.passenger_phone}</Text>
                    </View>
                  </View>

                  {/* Route */}
                  <View style={styles.reqRouteBox}>
                    <View style={styles.routeItem}>
                      <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        From: {req.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.routeItem}>
                      <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        To: {req.destination_address}
                      </Text>
                    </View>
                  </View>

                  {req.notes ? (
                    <Text style={styles.notesText} numberOfLines={2}>
                      💬 "{req.notes}"
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.offerRideBtn}
                    onPress={() => {
                      setPrefillUniversity(req.destination_address);
                      setCurrentSubTab('post');
                    }}
                  >
                    <Ionicons name="paper-plane" size={14} color="#ffffff" />
                    <Text style={styles.offerRideBtnText}>Offer Ride / Post Matching Trip</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* TAB 4: SERVED UNIVERSITIES SETTINGS */}
        {currentSubTab === 'settings' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>Campus Driver Configuration</Text>
              <Text style={styles.settingsSub}>
                Manage your service type and the universities or colleges you commute to and serve.
              </Text>

              {/* Service Type Switch */}
              <Text style={styles.settingLabel}>Driver Service Type</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.typeOptionCard,
                    editServiceType === 'REGULAR' && styles.typeOptionCardActive,
                  ]}
                  onPress={() => setEditServiceType('REGULAR')}
                >
                  <MaterialCommunityIcons
                    name="taxi"
                    size={20}
                    color={editServiceType === 'REGULAR' ? '#ffffff' : '#0284c7'}
                  />
                  <Text style={[styles.typeOptionTitle, editServiceType === 'REGULAR' && styles.typeOptionTitleActive]}>
                    City Driver
                  </Text>
                  <Text style={[styles.typeOptionDesc, editServiceType === 'REGULAR' && styles.typeOptionDescActive]}>
                    Applicable anywhere across general city routes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeOptionCard,
                    editServiceType === 'CAMPUS' && styles.typeOptionCardActive,
                  ]}
                  onPress={() => setEditServiceType('CAMPUS')}
                >
                  <Ionicons
                    name="school"
                    size={20}
                    color={editServiceType === 'CAMPUS' ? '#ffffff' : '#059669'}
                  />
                  <Text style={[styles.typeOptionTitle, editServiceType === 'CAMPUS' && styles.typeOptionTitleActive]}>
                    Campus Driver
                  </Text>
                  <Text style={[styles.typeOptionDesc, editServiceType === 'CAMPUS' && styles.typeOptionDescActive]}>
                    Specialized in university/college commutes
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Served Universities Multi-College Manager */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.settingLabel}>Add University or College (Case-Insensitive)</Text>
                <View style={styles.addUniRow}>
                  <TextInput
                    style={styles.addUniInput}
                    placeholder="Type college name (e.g. Parul, MSU, DU, IIT)..."
                    placeholderTextColor="#94a3b8"
                    value={newUniInput}
                    onChangeText={setNewUniInput}
                    onSubmitEditing={() => handleAddUniversity(newUniInput)}
                  />
                  <TouchableOpacity
                    style={styles.addUniBtn}
                    onPress={() => handleAddUniversity(newUniInput)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={16} color="#ffffff" />
                    <Text style={styles.addUniBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Popular Suggestions */}
                <Text style={styles.quickSuggestLabel}>POPULAR COLLEGES (TAP TO ADD):</Text>
                <View style={styles.quickChipsRow}>
                  {[
                    'Parul University',
                    'Maharaja Sayajirao University (MSU)',
                    'Vadodara Institute of Technology',
                    'Delhi University',
                    'IIT Delhi',
                  ].map((sUni, sIdx) => {
                    const isAdded = editServedUnis
                      .split(',')
                      .map((u) => u.trim().toLowerCase())
                      .includes(sUni.toLowerCase());
                    return (
                      <TouchableOpacity
                        key={sIdx}
                        style={[styles.quickChip, isAdded && styles.quickChipAdded]}
                        onPress={() => !isAdded && handleAddUniversity(sUni)}
                        disabled={isAdded}
                      >
                        <Ionicons
                          name={isAdded ? 'checkmark' : 'add'}
                          size={12}
                          color={isAdded ? '#166534' : '#0284c7'}
                        />
                        <Text style={[styles.quickChipText, isAdded && styles.quickChipTextAdded]}>
                          {sUni}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Active Served Universities List */}
                <Text style={[styles.settingLabel, { marginTop: 16 }]}>
                  Active Served Colleges ({editServedUnis.split(',').filter((u) => u.trim()).length}):
                </Text>

                {editServedUnis.split(',').filter((u) => u.trim()).length === 0 ? (
                  <View style={styles.noUnisNotice}>
                    <Text style={styles.noUnisNoticeText}>
                      No university added yet. Add at least one university above to accept student rides.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.activeUnisList}>
                    {editServedUnis
                      .split(',')
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((uName, uIdx) => (
                        <View key={uIdx} style={styles.activeUniTagCard}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Ionicons name="school" size={14} color="#059669" />
                            <Text style={styles.activeUniTagText} numberOfLines={1}>
                              {uName}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeUniBtn}
                            onPress={() => handleRemoveUniversity(uName)}
                          >
                            <Ionicons name="close-circle" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                )}

                <Text style={styles.helperText}>
                  💡 Enter one or multiple universities. Both small and capital letters (p=P) match automatically.
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveBtn, savingSettings && styles.saveBtnDisabled]}
                onPress={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="save" size={16} color="#ffffff" />
                    <Text style={styles.saveBtnText}>Save Served Universities</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  driverNameText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeCampus: {
    backgroundColor: '#dcfce7',
  },
  typeBadgeRegular: {
    backgroundColor: '#e0f2fe',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  editUnisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  editUnisBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  unisChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  unisLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  uniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  uniChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 6,
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  subTabItemActive: {
    borderBottomColor: '#0284c7',
  },
  subTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  subTabLabelActive: {
    color: '#0284c7',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  emptyRequestsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyRequestsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyRequestsSub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  postNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  postNowBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  studentReqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  seatsBudgetBadge: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  seatsBudgetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentPhone: {
    fontSize: 11,
    color: '#64748b',
  },
  reqRouteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    marginBottom: 8,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  routeText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  notesText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  offerRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 8,
  },
  offerRideBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  settingsSub: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
    marginBottom: 14,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  typeOptionCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 10,
    alignItems: 'center',
  },
  typeOptionCardActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  typeOptionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  typeOptionTitleActive: {
    color: '#ffffff',
  },
  typeOptionDesc: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  typeOptionDescActive: {
    color: '#e0f2fe',
  },
  settingsInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 42,
    fontSize: 12,
    color: '#0f172a',
  },
  helperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 15,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    height: 44,
    marginTop: 18,
  },
  saveBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  subTabBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  subTabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  addUniRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  addUniInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#0f172a',
  },
  addUniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 42,
  },
  addUniBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  quickSuggestLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickChipAdded: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  quickChipTextAdded: {
    color: '#166534',
  },
  noUnisNotice: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 8,
  },
  noUnisNoticeText: {
    fontSize: 11,
    color: '#dc2626',
    lineHeight: 15,
  },
  activeUnisList: {
    gap: 6,
    marginBottom: 10,
  },
  activeUniTagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeUniTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  removeUniBtn: {
    padding: 2,
  },
});
