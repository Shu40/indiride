import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { PassengerRideRequestItem, University } from '../../types';
import { CampusDatePickerModal } from './CampusDatePickerModal';
import { CampusTimePickerModal } from './CampusTimePickerModal';

interface Props {
  selectedUniversity: University | null;
  onSelectUniversityModal: () => void;
  onPostSuccess?: () => void;
}

export const CampusScheduleRideView: React.FC<Props> = ({
  selectedUniversity,
  onSelectUniversityModal,
  onPostSuccess,
}) => {
  // Form fields - Clean defaults (no fake static inputs)
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [destAddress, setDestAddress] = useState<string>(
    selectedUniversity?.name || ''
  );
  const [travelDate, setTravelDate] = useState<string>('Today');
  const [travelDateLabel, setTravelDateLabel] = useState<string>('Today');
  const [preferredTime, setPreferredTime] = useState<string>('08:30 AM');
  const [passengersCount, setPassengersCount] = useState<number>(1);
  const [maxBudget, setMaxBudget] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modals
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  // Active requests list
  const [myRequests, setMyRequests] = useState<PassengerRideRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);

  // Sync destination address if university changes
  useEffect(() => {
    if (selectedUniversity && !destAddress) {
      setDestAddress(selectedUniversity.name);
    }
  }, [selectedUniversity]);

  // Load existing requests
  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await api.campusRides.getPassengerRequests({
        university_id: selectedUniversity?.id,
      });
      setMyRequests(data || []);
    } catch (e) {
      console.warn('Could not load student requests:', e);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [selectedUniversity]);

  // Post ride request
  const handlePostRequest = async () => {
    if (!pickupAddress.trim()) {
      Alert.alert('Missing Field', 'Please enter your pickup location.');
      return;
    }
    if (!destAddress.trim()) {
      Alert.alert('Missing Field', 'Please specify your destination university or address.');
      return;
    }
    if (!preferredTime.trim()) {
      Alert.alert('Missing Field', 'Please enter your preferred departure time.');
      return;
    }

    setSubmitting(true);
    try {
      await api.campusRides.createPassengerRequest({
        pickup_address: pickupAddress.trim(),
        destination_address: destAddress.trim(),
        travel_date: travelDate,
        preferred_time: preferredTime.trim(),
        passengers_count: passengersCount,
        max_budget_per_seat: maxBudget ? parseFloat(maxBudget) : undefined,
        university_id: selectedUniversity?.id,
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        'Ride Request Posted! 🎯',
        `Your request has been published. Approved drivers traveling between ${pickupAddress.slice(0, 25)} and ${destAddress.slice(0, 25)} will receive an instant alert to offer a ride!`
      );
      setNotes('');
      loadRequests();
      if (onPostSuccess) onPostSuccess();
    } catch (e: any) {
      Alert.alert('Failed to Post Request', e.message || 'Could not post ride request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete request
  const handleDeleteRequest = async (requestId: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this ride request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.campusRides.deletePassengerRequest(requestId);
            loadRequests();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not cancel request.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* Informative Header Card */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerIconCircle}>
          <Ionicons name="calendar" size={24} color="#0284c7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Schedule a Campus Commute</Text>
          <Text style={styles.bannerSub}>
            Can't find a matching ride right now? Post your schedule and budget. Verified university drivers will be notified to offer you a ride!
          </Text>
        </View>
      </View>

      {/* Main Form */}
      <View style={styles.formCard}>
        <Text style={styles.sectionHeading}>Trip Requirements</Text>

        {/* Pickup Location */}
        <Text style={styles.label}>Pickup Location *</Text>
        <View style={styles.inputBox}>
          <Ionicons name="radio-button-on" size={16} color="#10b981" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.inputField}
            placeholder="e.g. Girls Hostel, Limda / Railway Station"
            placeholderTextColor="#94a3b8"
            value={pickupAddress}
            onChangeText={setPickupAddress}
          />
        </View>

        {/* Destination Location */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Text style={styles.label}>Destination Campus / Drop *</Text>
          <TouchableOpacity onPress={onSelectUniversityModal} style={styles.changeUniBtn}>
            <Ionicons name="business-outline" size={12} color="#0284c7" />
            <Text style={styles.changeUniBtnText}>Select Campus</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputBox}>
          <Ionicons name="location" size={16} color="#ef4444" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.inputField}
            placeholder="e.g. Parul University Main Gate"
            placeholderTextColor="#94a3b8"
            value={destAddress}
            onChangeText={setDestAddress}
          />
        </View>

        {/* Date & Time Row - With 7-Day Calendar and Time Picker Modals */}
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Travel Date (Next 7 Days) *</Text>
            <TouchableOpacity
              style={styles.pickerBox}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
              <Text style={styles.pickerBoxText} numberOfLines={1}>
                {travelDateLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Preferred Time *</Text>
            <TouchableOpacity
              style={styles.pickerBox}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
              <Text style={styles.pickerBoxText} numberOfLines={1}>
                {preferredTime}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Passengers & Budget Row */}
        <View style={styles.rowTwo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Seats Needed</Text>
            <View style={styles.stepperBox}>
              <TouchableOpacity
                style={[styles.stepBtn, passengersCount <= 1 && styles.stepBtnDisabled]}
                onPress={() => setPassengersCount((c) => Math.max(1, c - 1))}
                disabled={passengersCount <= 1}
              >
                <Ionicons name="remove" size={16} color={passengersCount <= 1 ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
              <Text style={styles.stepNum}>{passengersCount}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, passengersCount >= 6 && styles.stepBtnDisabled]}
                onPress={() => setPassengersCount((c) => Math.min(6, c + 1))}
                disabled={passengersCount >= 6}
              >
                <Ionicons name="add" size={16} color={passengersCount >= 6 ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Max Budget / Seat (₹)</Text>
            <View style={styles.inputBox}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.inputField}
                placeholder="45"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={maxBudget}
                onChangeText={setMaxBudget}
              />
            </View>
          </View>
        </View>

        {/* Optional Notes */}
        <Text style={[styles.label, { marginTop: 12 }]}>Special Notes (Optional)</Text>
        <TextInput
          style={styles.notesField}
          placeholder="e.g. Commuting for lab lectures, carry small backpack."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={2}
          value={notes}
          onChangeText={setNotes}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handlePostRequest}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={16} color="#ffffff" />
              <Text style={styles.submitBtnText}>Post Schedule Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Passenger Requests Section */}
      <View style={styles.requestsSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="list" size={16} color="#0f172a" />
            <Text style={styles.sectionTitle}>
              Active Commute Requests ({myRequests.length})
            </Text>
          </View>
          <TouchableOpacity onPress={loadRequests} style={{ padding: 4 }}>
            <Ionicons name="refresh" size={16} color="#0284c7" />
          </TouchableOpacity>
        </View>

        {loadingRequests ? (
          <ActivityIndicator color="#0284c7" style={{ marginVertical: 20 }} />
        ) : myRequests.length === 0 ? (
          <View style={styles.emptyRequestsBox}>
            <Text style={styles.emptyRequestsText}>
              No active schedule requests. Submit the form above to notify campus drivers!
            </Text>
          </View>
        ) : (
          myRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.reqTopRow}>
                <View style={styles.reqDateBadge}>
                  <Ionicons name="calendar-outline" size={12} color="#0284c7" />
                  <Text style={styles.reqDateBadgeText}>
                    {req.travel_date} • {req.preferred_time}
                  </Text>
                </View>
                {req.is_mine ? (
                  <TouchableOpacity
                    onPress={() => handleDeleteRequest(req.id)}
                    style={styles.deleteReqBtn}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    <Text style={styles.deleteReqBtnText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.reqPersonRow}>
                <View style={styles.reqAvatar}>
                  <Text style={styles.reqAvatarText}>{req.passenger_name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqPersonName}>
                    {req.passenger_name} {req.is_mine ? '(You)' : ''}
                  </Text>
                  <Text style={styles.reqPersonSeats}>
                    {req.passengers_count} seat(s) • Budget: ₹{req.max_budget_per_seat || 45}/seat
                  </Text>
                </View>
              </View>

              <View style={styles.reqRouteBox}>
                <View style={styles.routeItem}>
                  <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.reqAddressText} numberOfLines={1}>
                    From: {req.pickup_address}
                  </Text>
                </View>
                <View style={styles.routeItem}>
                  <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                  <Text style={styles.reqAddressText} numberOfLines={1}>
                    To: {req.destination_address}
                  </Text>
                </View>
              </View>

              {req.notes ? (
                <Text style={styles.reqNotesText} numberOfLines={2}>
                  💬 {req.notes}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* 7-Day Date Picker Modal */}
      <CampusDatePickerModal
        visible={showDatePicker}
        selectedDate={travelDate}
        onSelectDate={(key, label) => {
          setTravelDate(key);
          setTravelDateLabel(label);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Time Picker Modal */}
      <CampusTimePickerModal
        visible={showTimePicker}
        selectedTime={preferredTime}
        onSelectTime={(t) => setPreferredTime(t)}
        onClose={() => setShowTimePicker(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  bannerCard: {
    flexDirection: 'row',
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369a1',
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 11,
    color: '#0284c7',
    lineHeight: 15,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 5,
  },
  changeUniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  changeUniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    height: 42,
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingHorizontal: 10,
    height: 42,
    justifyContent: 'space-between',
  },
  pickerBoxText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputField: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
  },
  currencyPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 4,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dateChip: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  dateChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dateChipTextActive: {
    color: '#ffffff',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 42,
    paddingHorizontal: 6,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#f1f5f9',
  },
  stepNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  notesField: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 8,
    fontSize: 12,
    color: '#0f172a',
    minHeight: 52,
    textAlignVertical: 'top',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    height: 44,
    marginTop: 14,
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  requestsSection: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyRequestsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyRequestsText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  reqTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reqDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reqDateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  deleteReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  deleteReqBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  reqPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reqAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  reqPersonName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  reqPersonSeats: {
    fontSize: 10,
    color: '#64748b',
  },
  reqRouteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    gap: 4,
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
  reqAddressText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  reqNotesText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },
});
