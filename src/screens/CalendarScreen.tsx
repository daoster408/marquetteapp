import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useCycleStore } from '../store';
import { getCycleDay, calculateFertilityStatus } from '../utils/marquetteAlgorithm';
import { COLORS } from '../constants';
import { DayLog, FertilityStatus } from '../types';

interface Props {
  navigation: any;
}

interface DayData {
  log: DayLog | null;
  cycleDay: number | null;
  status: FertilityStatus | null;
  peakDay: number | null;
  countdownDay: number | null; // 1, 2, or 3 after 2nd Peak
  isAutoPeak: boolean;
}

export default function CalendarScreen({ navigation }: Props) {
  const { getCurrentCycle, getCompletedCycles, settings } = useCycleStore();

  const currentCycle = getCurrentCycle();
  const completedCycles = getCompletedCycles();

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getDateString = (year: number, month: number, day: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getDayData = (dateString: string): DayData => {
    const emptyResult: DayData = {
      log: null,
      cycleDay: null,
      status: null,
      peakDay: null,
      countdownDay: null,
      isAutoPeak: false
    };

    if (!currentCycle) return emptyResult;

    const cycleStartDate = new Date(currentCycle.startDate);
    const targetDate = new Date(dateString);

    // Check if date is within current cycle
    if (targetDate < cycleStartDate) {
      // Check completed cycles
      for (const cycle of [...completedCycles].reverse()) {
        const cycleStart = new Date(cycle.startDate);
        const cycleEnd = cycle.endDate ? new Date(cycle.endDate) : null;

        if (targetDate >= cycleStart && (!cycleEnd || targetDate < cycleEnd)) {
          const log = cycle.days.find(d => d.date === dateString) || null;
          const cycleDay = getCycleDay(cycle, dateString);
          const peakDay = cycle.peakDay || null;

          // Calculate countdown if after peak
          let countdownDay: number | null = null;
          if (peakDay && cycleDay) {
            const secondPeakDay = peakDay + 1;
            const dayAfterSecondPeak = cycleDay - secondPeakDay;
            if (dayAfterSecondPeak >= 1 && dayAfterSecondPeak <= 3) {
              countdownDay = dayAfterSecondPeak;
            }
          }

          return {
            log,
            cycleDay,
            status: null,
            peakDay,
            countdownDay,
            isAutoPeak: log?.isAutoPeak || false
          };
        }
      }
      return emptyResult;
    }

    const log = currentCycle.days.find(d => d.date === dateString) || null;
    const cycleDay = getCycleDay(currentCycle, dateString);
    const peakDay = currentCycle.peakDay || null;

    // Calculate countdown if after peak
    let countdownDay: number | null = null;
    if (peakDay && cycleDay) {
      const secondPeakDay = peakDay + 1;
      const dayAfterSecondPeak = cycleDay - secondPeakDay;
      if (dayAfterSecondPeak >= 1 && dayAfterSecondPeak <= 3) {
        countdownDay = dayAfterSecondPeak;
      }
    }

    // Calculate fertility status for this day
    const fertilityWindow = calculateFertilityStatus(
      currentCycle,
      cycleDay,
      completedCycles,
      settings.conservativeMode
    );

    return {
      log,
      cycleDay,
      status: fertilityWindow.status,
      peakDay,
      countdownDay,
      isAutoPeak: log?.isAutoPeak || false
    };
  };

  const getDayColor = (status: FertilityStatus | null, log: DayLog | null): string => {
    if (!status && !log) return COLORS.surface;

    // If we have a reading, show reading color
    if (log) {
      switch (log.reading) {
        case 'peak':
          return COLORS.readingPeak;
        case 'high':
          return COLORS.readingHigh;
        case 'low':
          return COLORS.readingLow;
      }
    }

    // Otherwise show status color
    switch (status) {
      case 'fertile':
        return COLORS.fertile;
      case 'infertile':
        return COLORS.infertile;
      case 'period':
        return COLORS.period;
      default:
        return COLORS.surface;
    }
  };

  // Get the label to show for a day (P, P2, 1, 2, 3, L, H, etc.)
  // After Peak is detected, automatically show: P2, 1, 2, 3 for next 4 days
  const getDayLabel = (data: DayData): string | null => {
    const { log, cycleDay, peakDay } = data;

    // If we have a peakDay recorded and a valid cycleDay
    if (peakDay && cycleDay) {
      const daysAfterPeak = cycleDay - peakDay;

      // Day of Peak
      if (daysAfterPeak === 0) {
        return 'P';
      }
      // Day after Peak = P2 (auto second peak)
      if (daysAfterPeak === 1) {
        return 'P2';
      }
      // Countdown days: 1, 2, 3
      if (daysAfterPeak >= 2 && daysAfterPeak <= 4) {
        return String(daysAfterPeak - 1);
      }
    }

    // Show reading labels for days before Peak
    if (log) {
      if (log.reading === 'peak') return 'P';
      if (log.reading === 'high') return 'H';
      if (log.reading === 'low') return 'L';
    }

    return null;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const weeks: React.ReactNode[] = [];
    let days: React.ReactNode[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Add day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = getDateString(year, month, day);
      const dayData = getDayData(dateString);
      const { log, cycleDay, status, peakDay } = dayData;
      const isToday = dateString === new Date().toISOString().split('T')[0];
      const backgroundColor = getDayColor(status, log);
      const label = getDayLabel(dayData);

      // Check if this is a countdown day (1, 2, or 3)
      const isCountdownDay = peakDay && cycleDay &&
        (cycleDay - peakDay >= 2) && (cycleDay - peakDay <= 4);

      days.push(
        <View
          key={day}
          style={[
            styles.dayCell,
            { backgroundColor },
            isToday && styles.todayCell,
          ]}
        >
          <Text style={[styles.dayNumber, isToday && styles.todayText]}>
            {day}
          </Text>
          {cycleDay && (
            <Text style={styles.cycleDayLabel}>CD{cycleDay}</Text>
          )}
          {label && (
            <Text style={[
              styles.readingLabel,
              isCountdownDay && styles.countdownLabel
            ]}>
              {label}
            </Text>
          )}
          {dayData.log?.intercourse && (
            <Text style={styles.intercourseIcon}>♥</Text>
          )}
        </View>
      );

      // Start new week
      if ((firstDay + day) % 7 === 0) {
        weeks.push(
          <View key={`week-${weeks.length}`} style={styles.weekRow}>
            {days}
          </View>
        );
        days = [];
      }
    }

    // Add remaining days
    if (days.length > 0) {
      // Fill the rest of the week with empty cells
      while (days.length < 7) {
        days.push(<View key={`empty-end-${days.length}`} style={styles.dayCell} />);
      }
      weeks.push(
        <View key={`week-${weeks.length}`} style={styles.weekRow}>
          {days}
        </View>
      );
    }

    return weeks;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <ScrollView style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Text onPress={goToPreviousMonth} style={styles.navButton}>
          ← Previous
        </Text>
        <Text variant="titleLarge" style={styles.monthTitle}>
          {formatMonthYear(currentMonth)}
        </Text>
        <Text onPress={goToNextMonth} style={styles.navButton}>
          Next →
        </Text>
      </View>

      {/* Day of Week Headers */}
      <View style={styles.weekRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <View key={day} style={styles.headerCell}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      {renderCalendar()}

      {/* Legend */}
      <Card style={styles.legendCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: COLORS.period }]} />
              <Text style={styles.legendText}>Period</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: COLORS.fertile }]} />
              <Text style={styles.legendText}>Fertile</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: COLORS.infertile }]} />
              <Text style={styles.legendText}>Infertile</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendLabel}>L</Text>
              <Text style={styles.legendText}>Low</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendLabel}>H</Text>
              <Text style={styles.legendText}>High</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendLabel}>P</Text>
              <Text style={styles.legendText}>Peak</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendLabel}>P2</Text>
              <Text style={styles.legendText}>2nd Peak</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendLabel}>1-3</Text>
              <Text style={styles.legendText}>Countdown</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  navButton: {
    color: COLORS.primary,
    fontSize: 14,
  },
  monthTitle: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  todayText: {
    color: COLORS.primary,
  },
  cycleDayLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  readingLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
    backgroundColor: COLORS.warning,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  intercourseIcon: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    fontSize: 14,
    color: '#E91E63', // Pink/Red for visibility
    fontWeight: 'bold',
  },
  legendCard: {
    margin: 16,
    borderRadius: 12,
  },
  legendTitle: {
    marginBottom: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
    backgroundColor: COLORS.readingPeak,
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  legendText: {
    fontSize: 12,
    color: COLORS.text,
  },
});
