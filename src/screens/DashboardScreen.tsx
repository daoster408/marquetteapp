import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Surface } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCycleStore } from '../store';
import {
  calculateFertilityStatus,
  getTodayISO,
  getCycleDay,
  needsMonitorReset,
  shouldAutoRecordPeak,
} from '../utils/marquetteAlgorithm';
import { COLORS, STRINGS } from '../constants';
import { FertilityStatus } from '../types';

interface Props {
  navigation: any;
}

export default function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const {
    getCurrentCycle,
    getCompletedCycles,
    getTodaysCycleDay,
    getTodaysLog,
    settings,
    startNewCycle,
    logDay,
  } = useCycleStore();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState(new Date());

  const currentCycle = getCurrentCycle();
  const completedCycles = getCompletedCycles();
  const todaysCycleDay = getTodaysCycleDay();
  const todaysLog = getTodaysLog();

  // Calculate fertility status
  const fertilityWindow = currentCycle && todaysCycleDay
    ? calculateFertilityStatus(
        currentCycle,
        todaysCycleDay,
        completedCycles,
        settings.conservativeMode,
        settings.intention // Pass intention here
      )
    : null;

  // Check for auto-peak
  const needsAutoPeak = currentCycle && todaysCycleDay
    ? shouldAutoRecordPeak(currentCycle, todaysCycleDay)
    : false;

  // Check for monitor reset warning
  const showResetWarning = currentCycle && todaysCycleDay
    ? needsMonitorReset(currentCycle, todaysCycleDay)
    : false;

  // Handle auto-peak recording
  React.useEffect(() => {
    if (needsAutoPeak && !todaysLog) {
      logDay('peak', undefined, 'Auto-recorded 2nd Peak');
    }
  }, [needsAutoPeak, todaysLog]);

  const handleStartCyclePress = () => {
    Alert.alert(
      'Start New Cycle',
      currentCycle 
        ? 'Do you want to start a new cycle? This will complete your current cycle.' 
        : 'Do you want to start a new cycle?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pick Date', onPress: () => setShowDatePicker(true) },
        { text: 'Start Today', onPress: () => startNewCycle() },
      ]
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed') return;
    
    if (selectedDate) {
      // Create local YYYY-MM-DD string to avoid UTC shifts
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      startNewCycle(dateString);
    }
  };

  const getStatusColor = (status: FertilityStatus | undefined): string => {
    switch (status) {
      case 'fertile':
        return COLORS.fertile;
      case 'infertile':
        return COLORS.infertile;
      case 'period':
        return COLORS.period;
      case 'waiting':
        return COLORS.waiting;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status: FertilityStatus | undefined): string => {
    switch (status) {
      case 'fertile':
        return STRINGS.statusFertile;
      case 'infertile':
        return STRINGS.statusInfertile;
      case 'period':
        return STRINGS.statusPeriod;
      case 'waiting':
        return STRINGS.statusWaiting;
      default:
        return 'No Active Cycle';
    }
  };

  // No active cycle
  if (!currentCycle) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text variant="headlineMedium" style={styles.title}>
            {STRINGS.appName}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Welcome! Start tracking your cycle.
          </Text>
          <Button
            mode="contained"
            onPress={handleStartCyclePress}
            style={styles.startButton}
          >
            {STRINGS.startNewCycle}
          </Button>
          <Text variant="bodySmall" style={styles.disclaimer}>
            {STRINGS.disclaimer}
          </Text>
          {showDatePicker && (
            <DateTimePicker
              value={datePickerDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Fertility Status Card */}
      <Card style={[styles.statusCard, { backgroundColor: getStatusColor(fertilityWindow?.status) }]}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.statusTitle}>
            {getStatusLabel(fertilityWindow?.status)}
          </Text>
          <Text variant="displayLarge" style={styles.cycleDay}>
            Day {todaysCycleDay ?? '-'}
          </Text>
          {fertilityWindow?.daysUntilSafe && currentCycle?.peakDay && todaysCycleDay && (
            <View style={styles.countdownContainer}>
              <Text variant="bodyLarge" style={styles.countdown}>
                {todaysCycleDay === currentCycle.peakDay
                  ? 'Peak Day (P)'
                  : todaysCycleDay === currentCycle.peakDay + 1
                  ? '2nd Peak Day (P2)'
                  : `Countdown Day ${todaysCycleDay - (currentCycle.peakDay + 1)} of 3`}
              </Text>
              <Text variant="bodyMedium" style={styles.countdownSub}>
                {fertilityWindow.daysUntilSafe} day(s) until low fertility
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Guidance Message */}
      <Surface style={styles.guidanceCard} elevation={1}>
        <Text variant="bodyMedium" style={styles.guidanceText}>
          {fertilityWindow?.message || 'Log your monitor reading to get guidance.'}
        </Text>
      </Surface>

      {/* Monitor Reset Warning */}
      {showResetWarning && (
        <Card style={styles.warningCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.warningTitle}>
              ⚠️ Monitor Reset Needed
            </Text>
            <Text variant="bodyMedium" style={styles.warningText}>
              {STRINGS.day25Warning}
            </Text>
            <Text variant="bodySmall" style={styles.warningInstructions}>
              {STRINGS.resetInstructions}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Today's Log Status */}
      <Card style={styles.logCard}>
        <Card.Content>
          <Text variant="titleMedium">Today's Log</Text>
          {todaysLog ? (
            <View style={styles.logInfo}>
              <Text variant="bodyLarge">
                Reading: <Text style={styles.bold}>{todaysLog.reading.toUpperCase()}</Text>
              </Text>
              {todaysLog.notes && (
                <Text variant="bodyMedium" style={styles.notes}>
                  Notes: {todaysLog.notes}
                </Text>
              )}
              {todaysLog.isAutoPeak && (
                <Text variant="bodySmall" style={styles.autoPeakNote}>
                  (Auto-recorded 2nd Peak)
                </Text>
              )}
            </View>
          ) : (
            <Text variant="bodyMedium" style={styles.noLog}>
              No reading logged yet today.
            </Text>
          )}
        </Card.Content>
        <Card.Actions>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Log')}
          >
            {todaysLog ? 'Update Log' : STRINGS.logToday}
          </Button>
        </Card.Actions>
      </Card>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate('Calendar')}
          style={styles.actionButton}
        >
          View Calendar
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate('History')}
          style={styles.actionButton}
        >
          {STRINGS.viewHistory}
        </Button>
      </View>

      {/* Start New Cycle Button */}
      <Button
        mode="text"
        onPress={handleStartCyclePress}
        style={styles.newCycleButton}
      >
        {STRINGS.startNewCycle}
      </Button>
      
      {showDatePicker && (
        <DateTimePicker
          value={datePickerDate}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: COLORS.primary,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: COLORS.textSecondary,
  },
  startButton: {
    marginBottom: 24,
  },
  disclaimer: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingHorizontal: 24,
  },
  statusCard: {
    margin: 16,
    borderRadius: 16,
  },
  statusTitle: {
    color: '#FFF',
    textAlign: 'center',
  },
  cycleDay: {
    color: '#FFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  countdownContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    padding: 8,
  },
  countdown: {
    color: '#FFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  countdownSub: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  guidanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  guidanceText: {
    textAlign: 'center',
    color: COLORS.text,
  },
  warningCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
  },
  warningTitle: {
    color: COLORS.warning,
    marginBottom: 8,
  },
  warningText: {
    color: COLORS.text,
    marginBottom: 8,
  },
  warningInstructions: {
    color: COLORS.textSecondary,
  },
  logCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  logInfo: {
    marginTop: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
  notes: {
    marginTop: 4,
    color: COLORS.textSecondary,
  },
  autoPeakNote: {
    marginTop: 4,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
  },
  noLog: {
    marginTop: 8,
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  newCycleButton: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
});
