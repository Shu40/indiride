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
  selectedDate: string; // "Today", "Tomorrow", or "YYYY-MM-DD"
  onSelectDate: (key: string, label: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CampusDatePickerModal: React.FC<Props> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  // Compute 7-day active boundary
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDay = new Date(today);
  maxDay.setDate(today.getDate() + 6); // Exactly 7 days (day 0 to day 6)

  const toIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayIso = toIsoDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = toIsoDate(tomorrow);

  // Build grid for current displayed month
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells = [];
  // Empty leading cells
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const iso = toIsoDate(cellDate);
    const isPast = cellDate < today;
    const isBeyond7Days = cellDate > maxDay;
    const isAvailable = !isPast && !isBeyond7Days;

    let key = iso;
    let label = `${cellDate.getDate()} ${MONTH_NAMES[month].slice(0, 3)}`;
    if (iso === todayIso) {
      key = 'Today';
      label = `Today (${cellDate.getDate()} ${MONTH_NAMES[month].slice(0, 3)})`;
    } else if (iso === tomorrowIso) {
      key = 'Tomorrow';
      label = `Tomorrow (${cellDate.getDate()} ${MONTH_NAMES[month].slice(0, 3)})`;
    }

    const isSelected =
      selectedDate === key ||
      selectedDate === iso ||
      (selectedDate === 'Today' && iso === todayIso) ||
      (selectedDate === 'Tomorrow' && iso === tomorrowIso);

    calendarCells.push({
      dayNum: d,
      iso,
      key,
      label,
      isAvailable,
      isPast,
      isBeyond7Days,
      isSelected,
      isToday: iso === todayIso,
    });
  }

  // Pre-built next 7 days for quick strip
  const quickDays = [];
  for (let i = 0; i < 7; i++) {
    const qd = new Date(today);
    qd.setDate(today.getDate() + i);
    const qIso = toIsoDate(qd);
    let qKey = qIso;
    let qLabel = `${qd.toLocaleDateString('en-US', { weekday: 'short' })} ${qd.getDate()} ${MONTH_NAMES[qd.getMonth()].slice(0, 3)}`;
    if (i === 0) {
      qKey = 'Today';
      qLabel = `Today (${qd.getDate()} ${MONTH_NAMES[qd.getMonth()].slice(0, 3)})`;
    } else if (i === 1) {
      qKey = 'Tomorrow';
      qLabel = `Tomorrow (${qd.getDate()} ${MONTH_NAMES[qd.getMonth()].slice(0, 3)})`;
    }

    const isSel =
      selectedDate === qKey ||
      selectedDate === qIso ||
      (selectedDate === 'Today' && i === 0) ||
      (selectedDate === 'Tomorrow' && i === 1);

    quickDays.push({ key: qKey, label: qLabel, iso: qIso, isSel, dayNum: qd.getDate(), weekday: qd.toLocaleDateString('en-US', { weekday: 'short' }) });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Select Travel Date</Text>
              <Text style={styles.headerSub}>Valid up to 7 days ahead for active campus rides</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Quick 7-Day Chips Strip */}
          <View style={styles.quickSection}>
            <Text style={styles.sectionTitle}>Next 7 Days (Instant Pick)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
              {quickDays.map((qd) => (
                <TouchableOpacity
                  key={qd.iso}
                  style={[styles.quickChip, qd.isSel && styles.quickChipActive]}
                  onPress={() => {
                    onSelectDate(qd.key, qd.label);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickWeekday, qd.isSel && styles.quickWeekdayActive]}>{qd.weekday}</Text>
                  <Text style={[styles.quickDateNum, qd.isSel && styles.quickDateNumActive]}>{qd.dayNum}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Calendar Month Controls */}
          <View style={styles.monthRow}>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(year, month - 1, 1))}
              disabled={year === now.getFullYear() && month <= now.getMonth()}
              style={[
                styles.navArrow,
                year === now.getFullYear() && month <= now.getMonth() && styles.navArrowDisabled
              ]}
            >
              <Ionicons name="chevron-back" size={18} color={year === now.getFullYear() && month <= now.getMonth() ? '#cbd5e1' : '#0284c7'} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(year, month + 1, 1))}
              disabled={month >= now.getMonth() + 1 && year >= now.getFullYear()}
              style={[
                styles.navArrow,
                month >= now.getMonth() + 1 && year >= now.getFullYear() && styles.navArrowDisabled
              ]}
            >
              <Ionicons name="chevron-forward" size={18} color={month >= now.getMonth() + 1 && year >= now.getFullYear() ? '#cbd5e1' : '#0284c7'} />
            </TouchableOpacity>
          </View>

          {/* Weekday Names */}
          <View style={styles.weekdaysRow}>
            {WEEK_DAYS.map((wd) => (
              <Text key={wd} style={styles.weekdayName}>{wd}</Text>
            ))}
          </View>

          {/* Calendar Month Grid */}
          <View style={styles.grid}>
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
              }

              if (!cell.isAvailable) {
                return (
                  <View key={cell.iso} style={styles.dayCellDisabled}>
                    <Text style={styles.dayNumDisabled}>{cell.dayNum}</Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={cell.iso}
                  style={[styles.dayCellAvailable, cell.isSelected && styles.dayCellSelected]}
                  onPress={() => {
                    onSelectDate(cell.key, cell.label);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayNumAvailable, cell.isSelected && styles.dayNumSelected]}>
                    {cell.dayNum}
                  </Text>
                  {cell.isToday && (
                    <View style={[styles.todayDot, cell.isSelected && styles.todayDotSelected]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#0284c7' }]} />
              <Text style={styles.legendText}>Selected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#e0f2fe', borderColor: '#0284c7', borderWidth: 1 }]} />
              <Text style={styles.legendText}>7 Days Active</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#f1f5f9' }]} />
              <Text style={styles.legendText}>Disabled (&gt;7d / Past)</Text>
            </View>
          </View>
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
  quickSection: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quickScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  quickChip: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  quickChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  quickWeekday: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  quickWeekdayActive: {
    color: '#ffffff',
  },
  quickDateNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  quickDateNumActive: {
    color: '#ffffff',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 6,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  navArrow: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowDisabled: {
    backgroundColor: '#f8fafc',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayName: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  dayCellDisabled: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.28,
  },
  dayNumDisabled: {
    fontSize: 13,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  dayCellAvailable: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: '#0284c7',
  },
  dayNumAvailable: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  dayNumSelected: {
    color: '#ffffff',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0284c7',
    marginTop: 2,
  },
  todayDotSelected: {
    backgroundColor: '#ffffff',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
});
