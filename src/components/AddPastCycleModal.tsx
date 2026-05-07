import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCycleStore } from '../store';
import { COLORS } from '../constants';
import { generateId, getCycleDay, getLocalDateISO } from '../utils/marquetteAlgorithm';

interface AddPastCycleModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function AddPastCycleModal({ visible, onDismiss }: AddPastCycleModalProps) {
  const theme = useTheme();
  const { cycles, startNewCycle, logDayForDate } = useCycleStore();

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [peakDate, setPeakDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showDatePickerFor, setShowDatePickerFor] = useState<'start' | 'peak' | 'end' | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setStartDate(undefined);
      setPeakDate(undefined);
      setEndDate(undefined);
    }
  }, [visible]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePickerFor(null);
    }
    if (selectedDate) {
      if (showDatePickerFor === 'start') {
        setStartDate(selectedDate);
      } else if (showDatePickerFor === 'peak') {
        setPeakDate(selectedDate);
      } else if (showDatePickerFor === 'end') {
        setEndDate(selectedDate);
      }
    }
  };

  const validateAndAddCycle = () => {
    if (!startDate || !endDate) {
      Alert.alert('Missing Dates', 'Please enter both Start Date and End Date.');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Invalid Dates', 'Start Date cannot be after End Date.');
      return;
    }

    if (peakDate && (peakDate < startDate || peakDate > endDate)) {
      Alert.alert('Invalid Peak Date', 'Peak Date must be between Start Date and End Date.');
      return;
    }

    const newCycleId = generateId();
    const newCycleStartDateISO = getLocalDateISO(startDate);
    const newCycleEndDateISO = getLocalDateISO(endDate);

    // Simulate adding a new complete cycle
    // This is a simplified version for history, mainly capturing key dates.
    // We don't need to call startNewCycle from useCycleStore as that manages the current cycle.
    // Instead, we directly create and add a 'completed' cycle to the cycles array.
    const cycleLength = getCycleDay({ id: newCycleId, startDate: newCycleStartDateISO, days: [], isComplete: true }, newCycleEndDateISO);
    const peakCycleDay = peakDate ? getCycleDay({ id: newCycleId, startDate: newCycleStartDateISO, days: [], isComplete: true }, getLocalDateISO(peakDate)) : undefined;

    const newCycle = {
      id: newCycleId,
      startDate: newCycleStartDateISO,
      endDate: newCycleEndDateISO,
      cycleLength: cycleLength,
      peakDay: peakCycleDay,
      lutealPhaseLength: (peakCycleDay && cycleLength > peakCycleDay) ? (cycleLength - peakCycleDay) : undefined,
      isComplete: true,
      days: [], // No daily readings for simplified history
    };

    useCycleStore.setState(state => ({
      cycles: [...state.cycles, newCycle].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }));

    Alert.alert('Success', 'Past cycle added successfully!');
    onDismiss();
  };

  // Helper to format date for display
  const formatDisplayDate = (date?: Date): string => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const maxDate = new Date();

  // For minDate of Peak and End, ensure it's not before Start Date
  const minDateForPeak = startDate || undefined;
  const minDateForEnd = startDate || undefined;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Add Past Cycle</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.description}>Enter the key dates for a completed past cycle:</Text>

          <View style={styles.dateInputContainer}>
            <Button mode="outlined" onPress={() => setShowDatePickerFor('start')} style={styles.dateButton}>
              Start Date: {formatDisplayDate(startDate)}
            </Button>
            {showDatePickerFor === 'start' && (
              <DateTimePicker
                value={startDate || new Date()} // Default to current date if not set
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={maxDate}
              />
            )}
          </View>

          <View style={styles.dateInputContainer}>
            <Button mode="outlined" onPress={() => setShowDatePickerFor('peak')} style={styles.dateButton}>
              Peak Date: {formatDisplayDate(peakDate)}
            </Button>
            {showDatePickerFor === 'peak' && (
              <DateTimePicker
                value={peakDate || startDate || new Date()} // Default to start date if available
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={maxDate}
                minimumDate={minDateForPeak}
              />
            )}
          </View>

          <View style={styles.dateInputContainer}>
            <Button mode="outlined" onPress={() => setShowDatePickerFor('end')} style={styles.dateButton}>
              End Date: {formatDisplayDate(endDate)}
            </Button>
            {showDatePickerFor === 'end' && (
              <DateTimePicker
                value={endDate || startDate || new Date()} // Default to start date if available
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={maxDate}
                minimumDate={minDateForEnd}
              />
            )}
          </View>

        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDismiss} textColor={COLORS.textSecondary}>Cancel</Button>
          <Button onPress={validateAndAddCycle} mode="contained" >Add Cycle</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  title: {
    textAlign: 'center',
    color: COLORS.primary,
    marginBottom: 10,
  },
  description: {
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.textSecondary,
  },
  dateInputContainer: {
    marginBottom: 15,
  },
  dateButton: {
    width: '100%',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
});
