import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  selectedTime: string; // e.g. "08:30 AM"
  onSelectTime: (timeStr: string) => void;
  onClose: () => void;
}

const MORNING_SLOTS = [
  '07:00 AM', '07:30 AM', '08:00 AM', '08:15 AM',
  '08:30 AM', '08:45 AM', '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
];

const AFTERNOON_SLOTS = [
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM',
];

const EVENING_SLOTS = [
  '05:00 PM', '05:15 PM', '05:30 PM', '05:45 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM',
];

export const CampusTimePickerModal: React.FC<Props> = ({
  visible,
  selectedTime,
  onSelectTime,
  onClose,
}) => {
  const [periodTab, setPeriodTab] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [customHour, setCustomHour] = useState<number>(8);
  const [customMinute, setCustomMinute] = useState<number>(30);
  const [customMeridiem, setCustomMeridiem] = useState<'AM' | 'PM'>('AM');

  const currentSlots =
    periodTab === 'morning'
      ? MORNING_SLOTS
      : periodTab === 'afternoon'
      ? AFTERNOON_SLOTS
      : EVENING_SLOTS;

  const handleApplyCustom = () => {
    const hh = String(customHour).padStart(2, '0');
    const mm = String(customMinute).padStart(2, '0');
    const timeStr = `${hh}:${mm} ${customMeridiem}`;
    onSelectTime(timeStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Select Commute Time</Text>
              <Text style={styles.headerSub}>Choose your preferred departure time slot</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Period Tabs */}
          <View style={styles.tabRow}>
            {[
              { id: 'morning', label: '🌅 Morning', range: '7 AM - 11:30 AM' },
              { id: 'afternoon', label: '☀️ Afternoon', range: '12 PM - 4:30 PM' },
              { id: 'evening', label: '🌆 Evening', range: '5 PM - 9 PM' },
            ].map((t) => {
              const active = periodTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  onPress={() => setPeriodTab(t.id as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time Slots Grid */}
          <ScrollView style={styles.slotsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.slotsGrid}>
              {currentSlots.map((slot) => {
                const isSelected = selectedTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotCard, isSelected && styles.slotCardActive]}
                    onPress={() => {
                      onSelectTime(slot);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={isSelected ? '#ffffff' : '#0284c7'}
                    />
                    <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Time Selector */}
            <View style={styles.customSection}>
              <Text style={styles.customTitle}>Or Pick Exact Hour & Minute</Text>
              <View style={styles.customRow}>
                {/* Hour */}
                <View style={styles.wheelBox}>
                  <TouchableOpacity
                    style={styles.wheelArrow}
                    onPress={() => setCustomHour((h) => (h >= 12 ? 1 : h + 1))}
                  >
                    <Ionicons name="chevron-up" size={16} color="#0284c7" />
                  </TouchableOpacity>
                  <Text style={styles.wheelValue}>{String(customHour).padStart(2, '0')}</Text>
                  <TouchableOpacity
                    style={styles.wheelArrow}
                    onPress={() => setCustomHour((h) => (h <= 1 ? 12 : h - 1))}
                  >
                    <Ionicons name="chevron-down" size={16} color="#0284c7" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.colon}>:</Text>

                {/* Minute (00, 15, 30, 45) */}
                <View style={styles.wheelBox}>
                  <TouchableOpacity
                    style={styles.wheelArrow}
                    onPress={() => setCustomMinute((m) => (m + 15) % 60)}
                  >
                    <Ionicons name="chevron-up" size={16} color="#0284c7" />
                  </TouchableOpacity>
                  <Text style={styles.wheelValue}>{String(customMinute).padStart(2, '0')}</Text>
                  <TouchableOpacity
                    style={styles.wheelArrow}
                    onPress={() => setCustomMinute((m) => (m - 15 + 60) % 60)}
                  >
                    <Ionicons name="chevron-down" size={16} color="#0284c7" />
                  </TouchableOpacity>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.ampmBox}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, customMeridiem === 'AM' && styles.ampmBtnActive]}
                    onPress={() => setCustomMeridiem('AM')}
                  >
                    <Text style={[styles.ampmText, customMeridiem === 'AM' && styles.ampmTextActive]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, customMeridiem === 'PM' && styles.ampmBtnActive]}
                    onPress={() => setCustomMeridiem('PM')}
                  >
                    <Text style={[styles.ampmText, customMeridiem === 'PM' && styles.ampmTextActive]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCustom}>
                <Text style={styles.applyBtnText}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  slotsScroll: {
    maxHeight: 340,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  slotCardActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  slotTextActive: {
    color: '#ffffff',
  },
  customSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
    alignItems: 'center',
  },
  customTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  wheelBox: {
    width: 60,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
  },
  wheelArrow: {
    padding: 4,
  },
  wheelValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 2,
  },
  colon: {
    fontSize: 22,
    fontWeight: '800',
    color: '#64748b',
  },
  ampmBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  ampmBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  ampmBtnActive: {
    backgroundColor: '#0284c7',
  },
  ampmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  ampmTextActive: {
    color: '#ffffff',
  },
  applyBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
