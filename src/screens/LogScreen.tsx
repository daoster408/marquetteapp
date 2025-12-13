import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  SegmentedButtons,
  Snackbar,
  List,
  Switch,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCycleStore } from '../store';
import { getTodayISO, getCycleDay } from '../utils/marquetteAlgorithm';
import { COLORS, STRINGS } from '../constants';
import { MonitorReading } from '../types';

interface Props {
  navigation: any;
}

export default function LogScreen({ navigation }: Props) {
  const { getCurrentCycle, logDayForDate, markMonitorReset, toggleIntercourse } = useCycleStore();

  const currentCycle = getCurrentCycle();
  const today = new Date();

  // Date selection state
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Get the ISO string for selected date
  const selectedDateISO = selectedDate.toISOString().split('T')[0];

  // Get existing log for selected date
  const existingLog = currentCycle?.days.find(d => d.date === selectedDateISO);

  // Calculate cycle day for selected date
  const selectedCycleDay = currentCycle
    ? getCycleDay(currentCycle, selectedDateISO)
    : null;

  const [selectedReading, setSelectedReading] = useState<MonitorReading>(
    existingLog?.reading || 'none'
  );
  const [notes, setNotes] = useState(existingLog?.notes || '');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Update form when date changes
  React.useEffect(() => {
    const log = currentCycle?.days.find(d => d.date === selectedDateISO);
    setSelectedReading(log?.reading || 'none');
    setNotes(log?.notes || '');
  }, [selectedDateISO, currentCycle]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSave = () => {
    logDayForDate(selectedDateISO, selectedReading, notes.trim() || undefined);
    setSnackbarMessage('Log saved successfully!');
    setShowSnackbar(true);
    setTimeout(() => {
      navigation.goBack();
    }, 1000);
  };

  const handleMonitorReset = () => {
    markMonitorReset();
    setSnackbarMessage('Monitor reset recorded.');
    setShowSnackbar(true);
  };

  const formatDisplayDate = (date: Date): string => {
    const isToday = date.toDateString() === today.toDateString();
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return isToday ? `${formatted} (Today)` : formatted;
  };

  // Min date is cycle start (can't log before cycle began)
  const minDate = currentCycle ? new Date(currentCycle.startDate) : undefined;

  const readingOptions = [
    { value: 'low', label: STRINGS.readingLow },
    { value: 'high', label: STRINGS.readingHigh },
    { value: 'peak', label: STRINGS.readingPeak },
    { value: 'none', label: STRINGS.readingNone },
  ];

  const getReadingDescription = (reading: MonitorReading): string => {
    switch (reading) {
      case 'low':
        return 'Low fertility indicator. Estrogen levels are baseline.';
      case 'high':
        return 'High fertility indicator. Estrogen is rising - fertile window is open.';
      case 'peak':
        return 'Peak fertility! LH surge detected. Ovulation is imminent. Stop testing - Peak will auto-record tomorrow.';
      case 'none':
        return 'No test taken today.';
      default:
        return '';
    }
  };

  if (!currentCycle) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge">No active cycle. Start a new cycle first.</Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Date Selection */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="labelMedium" style={styles.dateLabel}>
            Logging for:
          </Text>
          <Button
            mode="outlined"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
            labelStyle={styles.dateButtonLabel}
          >
            {formatDisplayDate(selectedDate)}
          </Button>
          <Text variant="bodySmall" style={styles.changeDateText}>
            Tap above to change date
          </Text>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={minDate}
            />
          )}

          <Text variant="titleMedium" style={styles.cycleDayText}>
            Cycle Day {selectedCycleDay ?? '-'}
          </Text>
        </Card.Content>
      </Card>

      {/* Monitor Reading Selection */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Monitor Reading
          </Text>
          <SegmentedButtons
            value={selectedReading}
            onValueChange={(value) => setSelectedReading(value as MonitorReading)}
            buttons={readingOptions}
            style={styles.segmentedButtons}
          />
          <Text variant="bodySmall" style={styles.readingDescription}>
            {getReadingDescription(selectedReading)}
          </Text>
        </Card.Content>
      </Card>

      {/* Intercourse Logging */}
      <Card style={styles.card}>
        <List.Item
          title="Log Intercourse"
          left={props => <List.Icon {...props} icon="heart-outline" color={COLORS.primary} />}
          right={() => (
            <Switch
              value={existingLog?.intercourse || false}
              onValueChange={() => toggleIntercourse(selectedDateISO)}
              color={COLORS.primary}
            />
          )}
          style={styles.intercourseItem}
        />
      </Card>

      {/* Notes */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Notes (Optional)
          </Text>
          <TextInput
            mode="outlined"
            placeholder="Add any notes for this day..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </Card.Content>
      </Card>

      {/* Save Button */}
      <Button
        mode="contained"
        onPress={handleSave}
        style={styles.saveButton}
      >
        {existingLog ? 'Update Log' : 'Save Log'}
      </Button>

      {/* Monitor Reset Option (for CD25+) */}
      {selectedCycleDay && selectedCycleDay >= 25 && (
        <Card style={styles.resetCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.resetTitle}>
              Monitor Reset
            </Text>
            <Text variant="bodyMedium" style={styles.resetText}>
              If no Peak has been detected and you've reset your Clearblue monitor,
              tap below to record the reset.
            </Text>
            <Button
              mode="outlined"
              onPress={handleMonitorReset}
              style={styles.resetButton}
            >
              Record Monitor Reset
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Snackbar */}
      <Snackbar
        visible={showSnackbar}
        onDismiss={() => setShowSnackbar(false)}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
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
  button: {
    marginTop: 16,
  },
  headerCard: {
    margin: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  dateLabel: {
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  dateButtonLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  changeDateText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  cycleDayText: {
    color: '#FFF',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    color: COLORS.text,
  },
  segmentedButtons: {
    marginBottom: 12,
  },
  readingDescription: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  intercourseItem: {
    paddingVertical: 8,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
  },
  saveButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  resetCard: {
    marginHorizontal: 16,
    marginBottom: 32,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
  },
  resetTitle: {
    color: COLORS.warning,
    marginBottom: 8,
  },
  resetText: {
    color: COLORS.text,
    marginBottom: 12,
  },
  resetButton: {
    borderColor: COLORS.warning,
  },
});
