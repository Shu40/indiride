import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  defaultUniversityName?: string;
  onPostSuccess: () => void;
  onPostSubmit: (rideData: {
    pickup_address: string;
    destination_address: string;
    departure_time: string;
    travel_date?: string;
    total_seats: number;
    price_per_seat: number;
    vehicle_type: string;
    vehicle_info: string;
    is_daily: boolean;
    gender_preference: string;
    university_name: string;
    intermediate_stops?: string[];
    recurring_days?: string;
    notes?: string;
  }) => Promise<any>;
}

type RecurrenceMode = 'ALL_DAYS' | 'ONE_DAY' | 'WEEKDAYS';
type DirectionMode = 'TO_UNI' | 'FROM_UNI' | 'CAMPUS_TO_CAMPUS';

export const CampusPostRideView: React.FC<Props> = ({
  defaultUniversityName = 'Parul University',
  onPostSuccess,
  onPostSubmit,
}) => {
  // Recurrence & Direction Mode
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('ALL_DAYS');
  const [directionMode, setDirectionMode] = useState<DirectionMode>('TO_UNI');

  // University & Route
  const [uniName, setUniName] = useState<string>(defaultUniversityName);
  const [pickup, setPickup] = useState<string>('');
  const [dest, setDest] = useState<string>(`${defaultUniversityName} Main Gate`);

  // Time & Date
  const [departureTime, setDepartureTime] = useState<string>('08:30 AM');
  const [travelDate, setTravelDate] = useState<string>('Today');

  // Capacity & Price
  const [seats, setSeats] = useState<string>('3');
  const [price, setPrice] = useState<string>('45');

  // Vehicle & Preferences
  const [vehicleType, setVehicleType] = useState<string>('Car');
  const [vehicleInfo, setVehicleInfo] = useState<string>('');
  const [genderPref, setGenderPref] = useState<string>('ANY');
  const [intermediateStops, setIntermediateStops] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Direction Mode Switcher
  const handleSelectDirection = (dir: DirectionMode) => {
    setDirectionMode(dir);
    const targetUni = uniName.trim() || defaultUniversityName;
    if (dir === 'TO_UNI') {
      setDest(`${targetUni} Main Gate`);
      if (pickup === `${targetUni} Main Gate` || pickup === `${targetUni} Campus`) {
        setPickup('');
      }
    } else if (dir === 'FROM_UNI') {
      setPickup(`${targetUni} Main Gate`);
      if (dest === `${targetUni} Main Gate` || dest === `${targetUni} Campus`) {
        setDest('');
      }
    } else {
      setPickup(`${targetUni} Engineering Block`);
      setDest(`${targetUni} Central Library & Food Court`);
    }
  };

  // Swap Locations
  const handleSwap = () => {
    const temp = pickup;
    setPickup(dest);
    setDest(temp);
  };

  // Set Current Location Helper
  const handleUseCurrentLocation = () => {
    setPickup('My Current Location (Main Road)');
  };

  const handleSubmit = async () => {
    if (!pickup.trim() || !dest.trim()) {
      Alert.alert('Incomplete Route', 'Please enter both pickup and destination locations.');
      return;
    }

    const seatsNum = parseInt(seats, 10);
    const priceNum = parseFloat(price);

    if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 8) {
      Alert.alert('Invalid Seats', 'Please select between 1 and 8 seats.');
      return;
    }

    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price per seat.');
      return;
    }

    setSubmitting(true);
    try {
      const stopsArray = intermediateStops
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const isDailyBool = recurrenceMode === 'ALL_DAYS' || recurrenceMode === 'WEEKDAYS';
      const recurringDaysStr =
        recurrenceMode === 'WEEKDAYS'
          ? 'DAILY_WEEKDAYS'
          : recurrenceMode === 'ALL_DAYS'
          ? 'DAILY'
          : undefined;

      const departureStr = isDailyBool ? `Daily, ${departureTime}` : `${travelDate}, ${departureTime}`;

      const res = await onPostSubmit({
        pickup_address: pickup.trim(),
        destination_address: dest.trim(),
        departure_time: departureStr,
        travel_date: isDailyBool ? 'Today' : travelDate,
        total_seats: seatsNum,
        price_per_seat: priceNum,
        vehicle_type: vehicleType,
        vehicle_info: vehicleInfo.trim() || `${vehicleType} (${uniName})`,
        is_daily: isDailyBool,
        recurring_days: recurringDaysStr,
        gender_preference: genderPref,
        university_name: uniName.trim() || defaultUniversityName,
        intermediate_stops: stopsArray,
        notes: notes.trim() || undefined,
      });

      const matchedNote =
        res && res.matched_passenger_requests > 0
          ? `\n🎉 Alert sent to ${res.matched_passenger_requests} student(s) waiting for this route!`
          : '';

      Alert.alert(
        'Ride Published Live! 🚗',
        recurrenceMode === 'ALL_DAYS'
          ? `Your daily ride has been published. It will remain active for the next 7 days.${matchedNote}`
          : recurrenceMode === 'WEEKDAYS'
          ? `Your Mon-Fri weekday campus ride has been published!${matchedNote}`
          : `Your campus ride has been published!${matchedNote}`
      );

      setPickup('');
      setDest('');
      setNotes('');
      setIntermediateStops('');
      onPostSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post campus ride.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Header Card */}
      <View style={styles.headerBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Post Campus Ride</Text>
          <Text style={styles.subtitle}>
            Share empty vehicle seats, split fuel expenses, and help students commute!
          </Text>
        </View>
        <View style={styles.iconCircle}>
          <Ionicons name="car-sport" size={24} color="#16a34a" />
        </View>
      </View>

      {/* 2. RECURRENCE SELECTOR (All Days vs One Day vs Weekdays) */}
      <Text style={styles.sectionLabel}>Trip Recurrence Schedule *</Text>
      <View style={styles.recurrenceCardsRow}>
        <TouchableOpacity
          style={[styles.recCard, recurrenceMode === 'ALL_DAYS' && styles.recCardActive]}
          onPress={() => setRecurrenceMode('ALL_DAYS')}
          activeOpacity={0.8}
        >
          <View style={styles.recIconCircle}>
            <Ionicons
              name="repeat"
              size={18}
              color={recurrenceMode === 'ALL_DAYS' ? '#059669' : '#64748b'}
            />
          </View>
          <Text style={[styles.recTitle, recurrenceMode === 'ALL_DAYS' && styles.recTitleActive]}>
            All Days (Daily)
          </Text>
          <Text style={styles.recSub}>Active 7 days ahead</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.recCard, recurrenceMode === 'ONE_DAY' && styles.recCardActive]}
          onPress={() => setRecurrenceMode('ONE_DAY')}
          activeOpacity={0.8}
        >
          <View style={[styles.recIconCircle, { backgroundColor: '#f0f9ff' }]}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={recurrenceMode === 'ONE_DAY' ? '#0284c7' : '#64748b'}
            />
          </View>
          <Text style={[styles.recTitle, recurrenceMode === 'ONE_DAY' && styles.recTitleActive]}>
            One Day
          </Text>
          <Text style={styles.recSub}>Today or Tomorrow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.recCard, recurrenceMode === 'WEEKDAYS' && styles.recCardActive]}
          onPress={() => setRecurrenceMode('WEEKDAYS')}
          activeOpacity={0.8}
        >
          <View style={[styles.recIconCircle, { backgroundColor: '#fdf2f8' }]}>
            <Ionicons
              name="school-outline"
              size={18}
              color={recurrenceMode === 'WEEKDAYS' ? '#db2777' : '#64748b'}
            />
          </View>
          <Text style={[styles.recTitle, recurrenceMode === 'WEEKDAYS' && styles.recTitleActive]}>
            Mon - Fri
          </Text>
          <Text style={styles.recSub}>College lecture days</Text>
        </TouchableOpacity>
      </View>

      {/* 3. DIRECTION PRESETS */}
      <Text style={styles.sectionLabel}>Travel Direction *</Text>
      <View style={styles.directionRow}>
        {[
          { id: 'TO_UNI', label: '🏫 Towards Campus', icon: 'arrow-forward' },
          { id: 'FROM_UNI', label: '🏛️ From Campus', icon: 'arrow-back' },
          { id: 'CAMPUS_TO_CAMPUS', label: '🎒 Campus ⇄ Campus', icon: 'swap-horizontal' },
        ].map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[styles.dirBtn, directionMode === d.id && styles.dirBtnActive]}
            onPress={() => handleSelectDirection(d.id as DirectionMode)}
          >
            <Text style={[styles.dirBtnText, directionMode === d.id && styles.dirBtnTextActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 4. University / College Name */}
      <Text style={styles.label}>Served University / College *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Parul University, Delhi University, IIT..."
        placeholderTextColor="#94a3b8"
        value={uniName}
        onChangeText={setUniName}
      />

      {/* 5. Pickup & Destination with Swap & Live Location */}
      <View style={styles.routeInputBlock}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.label}>Pickup Location *</Text>
          <TouchableOpacity style={styles.useLocBtn} onPress={handleUseCurrentLocation}>
            <Ionicons name="navigate" size={12} color="#0284c7" />
            <Text style={styles.useLocText}>Use My Location</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          placeholder="e.g. Engineering Hostel Block A or Railway Station"
          placeholderTextColor="#94a3b8"
          value={pickup}
          onChangeText={setPickup}
        />

        <View style={styles.swapBar}>
          <View style={styles.swapLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={handleSwap}>
            <Ionicons name="swap-vertical" size={16} color="#0284c7" />
          </TouchableOpacity>
          <View style={styles.swapLine} />
        </View>

        <Text style={styles.label}>Destination Campus / Drop Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Parul University Main Gate or Vadodara Bus Station"
          placeholderTextColor="#94a3b8"
          value={dest}
          onChangeText={setDest}
        />
      </View>

      {/* 6. MAIN ROAD ADVISORY WARNING (User Requirement) */}
      <View style={styles.advisoryCard}>
        <Ionicons name="information-circle" size={18} color="#0284c7" />
        <View style={{ flex: 1 }}>
          <Text style={styles.advisoryTitle}>Main Road Pickup Advisory</Text>
          <Text style={styles.advisoryText}>
            For convenient passenger boarding, ensure your pickup location is at a main road junction, campus main gate, or designated landmark.
          </Text>
        </View>
      </View>

      {/* 7. Departure Time & Date (if One Day) */}
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Text style={styles.label}>Departure Time *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 08:30 AM"
            placeholderTextColor="#94a3b8"
            value={departureTime}
            onChangeText={setDepartureTime}
          />
        </View>

        {recurrenceMode === 'ONE_DAY' && (
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.label}>Travel Date *</Text>
            <View style={styles.dateToggleRow}>
              {['Today', 'Tomorrow'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dateMiniBtn, travelDate === d && styles.dateMiniBtnActive]}
                  onPress={() => setTravelDate(d)}
                >
                  <Text style={[styles.dateMiniText, travelDate === d && styles.dateMiniTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 8. Vehicle Type (Car, Bike, Auto) */}
      <Text style={styles.label}>Vehicle Type *</Text>
      <View style={styles.vehicleRow}>
        {[
          { id: 'Car', label: 'Car', icon: 'car-sport-outline' },
          { id: 'Bike', label: 'Bike', icon: 'bicycle-outline' },
          { id: 'Auto', label: 'Auto', icon: 'speedometer-outline' },
        ].map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.vehicleBtn, vehicleType === v.id && styles.vehicleBtnActive]}
            onPress={() => setVehicleType(v.id)}
          >
            <Ionicons
              name={v.icon as any}
              size={18}
              color={vehicleType === v.id ? '#0284c7' : '#64748b'}
            />
            <Text style={[styles.vehicleBtnText, vehicleType === v.id && styles.vehicleBtnTextActive]}>
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 9. Seats & Price */}
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Text style={styles.label}>Available Seats *</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="3"
            placeholderTextColor="#94a3b8"
            value={seats}
            onChangeText={setSeats}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={styles.label}>Price / Seat (₹) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="45"
            placeholderTextColor="#94a3b8"
            value={price}
            onChangeText={setPrice}
          />
        </View>
      </View>

      {/* 10. Gender Preference */}
      <Text style={styles.label}>Passenger Preference *</Text>
      <View style={styles.genderRow}>
        {[
          { id: 'ANY', label: '👥 Everyone (All Students)' },
          { id: 'FEMALE_ONLY', label: '👩 Female Students Only' },
          { id: 'MALE_ONLY', label: '👨 Male Students Only' },
        ].map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.genderBtn, genderPref === g.id && styles.genderBtnActive]}
            onPress={() => setGenderPref(g.id)}
          >
            <Text style={[styles.genderBtnText, genderPref === g.id && styles.genderBtnTextActive]}>
              {g.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 11. Intermediate Stops */}
      <Text style={styles.label}>Intermediate Stops (comma-separated, optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alkapuri Circle, Makarpura Cross Road"
        placeholderTextColor="#94a3b8"
        value={intermediateStops}
        onChangeText={setIntermediateStops}
      />

      {/* 12. Notes */}
      <Text style={styles.label}>Ride Notes (Optional)</Text>
      <TextInput
        style={[styles.input, { height: 60 }]}
        multiline
        placeholder="e.g. Please carry College ID. AC on."
        placeholderTextColor="#94a3b8"
        value={notes}
        onChangeText={setNotes}
      />

      {/* 13. Publish Button */}
      <TouchableOpacity
        style={styles.publishBtn}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Ionicons name="paper-plane" size={18} color="#ffffff" />
            <Text style={styles.publishBtnText}>
              {recurrenceMode === 'ALL_DAYS'
                ? 'Publish All Days (Daily) Ride'
                : recurrenceMode === 'WEEKDAYS'
                ? 'Publish Weekdays (Mon-Fri) Ride'
                : 'Publish Campus Ride'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    marginTop: 8,
  },
  recurrenceCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  recCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  recCardActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  recIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  recTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  recTitleActive: {
    color: '#059669',
  },
  recSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  directionRow: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 10,
  },
  dirBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dirBtnActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0284c7',
  },
  dirBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dirBtnTextActive: {
    color: '#0284c7',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeInputBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 6,
  },
  useLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  useLocText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  swapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  advisoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginVertical: 8,
  },
  advisoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
  },
  advisoryText: {
    fontSize: 10,
    color: '#0284c7',
    marginTop: 2,
    lineHeight: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateToggleRow: {
    flexDirection: 'row',
    gap: 6,
    height: 42,
    alignItems: 'center',
  },
  dateMiniBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateMiniBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  dateMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dateMiniTextActive: {
    color: '#ffffff',
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  vehicleBtnActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  vehicleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  vehicleBtnTextActive: {
    color: '#0284c7',
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  genderBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  genderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  genderBtnTextActive: {
    color: '#ffffff',
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    marginTop: 18,
    elevation: 3,
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
