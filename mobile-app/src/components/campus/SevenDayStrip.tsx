import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DayOption {
  key: string; // e.g. "Today", "Tomorrow", "2026-10-22"
  isoDate: string; // "YYYY-MM-DD"
  dayName: string; // "आज", "कल", "बुध", "गुरु"...
  dayNameEn: string; // "Today", "Tomorrow", "Wed"...
  dateNumber: number; // 20
  monthShort: string; // "Oct"
  isToday: boolean;
  isTomorrow: boolean;
}

interface Props {
  selectedDate: string;
  onSelectDate: (day: DayOption) => void;
  onOpenCalendar?: () => void;
}

const HINDI_DAYS = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const generateNext7Days = (): DayOption[] => {
  const days: DayOption[] = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;

    const isToday = i === 0;
    const isTomorrow = i === 1;

    let key = isoDate;
    if (isToday) key = 'Today';
    else if (isTomorrow) key = 'Tomorrow';

    const dayOfWeek = d.getDay();
    const dayName = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : EN_DAYS[dayOfWeek];
    const dayNameEn = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : EN_DAYS[dayOfWeek];

    days.push({
      key,
      isoDate,
      dayName,
      dayNameEn,
      dateNumber: d.getDate(),
      monthShort: MONTHS[d.getMonth()],
      isToday,
      isTomorrow,
    });
  }

  return days;
};

export const SevenDayStrip: React.FC<Props> = ({ selectedDate, onSelectDate, onOpenCalendar }) => {
  const days = React.useMemo(() => generateNext7Days(), []);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="calendar-outline" size={15} color="#0284c7" />
          <Text style={styles.title}>Select Travel Date (7-Day Schedule)</Text>
        </View>
        <TouchableOpacity
          style={styles.badge}
          onPress={onOpenCalendar}
          disabled={!onOpenCalendar}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar" size={12} color="#0284c7" style={{ marginRight: 3 }} />
          <Text style={styles.badgeText}>7 Days Calendar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {days.map((item) => {
          const isSelected =
            selectedDate === item.key ||
            selectedDate === item.isoDate ||
            (selectedDate === 'Today' && item.isToday) ||
            (selectedDate === 'Tomorrow' && item.isTomorrow);

          return (
            <TouchableOpacity
              key={item.isoDate}
              style={[styles.dayCard, isSelected && styles.dayCardActive]}
              onPress={() => onSelectDate(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                {item.dayNameEn}
              </Text>

              <Text style={[styles.dateNumber, isSelected && styles.dateNumberActive]}>
                {item.dateNumber}
              </Text>

              <Text style={[styles.monthLabel, isSelected && styles.monthLabelActive]}>
                {item.monthShort}
              </Text>

              {item.isToday ? (
                <View style={[styles.dotIndicator, isSelected && styles.dotIndicatorActive]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  badge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  scrollContent: {
    paddingHorizontal: 2,
    gap: 8,
  },
  dayCard: {
    width: 62,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
    elevation: 3,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  dayLabelActive: {
    color: '#ffffff',
  },
  dateNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 1,
  },
  dateNumberActive: {
    color: '#ffffff',
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  monthLabelActive: {
    color: '#e0f2fe',
  },
  dotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0284c7',
    marginTop: 4,
  },
  dotIndicatorActive: {
    backgroundColor: '#ffffff',
  },
});
