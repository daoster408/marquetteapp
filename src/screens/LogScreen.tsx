import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Modal, TouchableOpacity } from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  SegmentedButtons,
  Snackbar,
  List,
  Switch,
  IconButton,
  Divider,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCycleStore } from '../store';
import { getTodayISO, getCycleDay } from '../utils/marquetteAlgorithm';
import { COLORS, STRINGS } from '../constants';
import { MonitorReading, BleedingLevel } from '../types';

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
  const getLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const selectedDateISO = getLocalISOString(selectedDate);

  // Get existing log
  const existingLog = currentCycle?.days.find(d => d.date === selectedDateISO);

  // Calculate cycle day
  const selectedCycleDay = currentCycle
    ? getCycleDay(currentCycle, selectedDateISO)
    : null;

  // Form State
  const [selectedReading, setSelectedReading] = useState<MonitorReading>(
    existingLog?.reading || 'none'
  );
  const [selectedBleeding, setSelectedBleeding] = useState<BleedingLevel>(
    existingLog?.bleeding || 'none'
  );
  const [notes, setNotes] = useState(existingLog?.notes || '');
  
  // Section Expansion State
  const [isBleedingExpanded, setIsBleedingExpanded] = useState(true);
  const [isMonitorExpanded, setIsMonitorExpanded] = useState(false);

  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Update form and expansion defaults when date changes
  React.useEffect(() => {
    const log = currentCycle?.days.find(d => d.date === selectedDateISO);
    setSelectedReading(log?.reading || 'none');
    setSelectedBleeding(log?.bleeding || 'none');
    setNotes(log?.notes || '');

    // Smart Expansion Logic
    if (selectedCycleDay) {
      if (selectedCycleDay <= 5) {
        setIsBleedingExpanded(true);
        setIsMonitorExpanded(false);
      } else {
        setIsBleedingExpanded(false);
        setIsMonitorExpanded(true);
      }
    }
  }, [selectedDateISO, currentCycle, selectedCycleDay]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSave = () => {
    logDayForDate(
      selectedDateISO, 
      selectedReading, 
      selectedBleeding, 
      notes.trim() || undefined
    );
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

  const minDate = currentCycle ? new Date(currentCycle.startDate) : undefined;

  const readingOptions = [
    { value: 'low', label: STRINGS.readingLow },
    { value: 'high', label: STRINGS.readingHigh },
    { value: 'peak', label: STRINGS.readingPeak },
    { value: 'none', label: STRINGS.readingNone },
  ];

  const getReadingDescription = (reading: MonitorReading): string => {
    switch (reading) {
      case 'low': return 'Low fertility indicator. Estrogen levels are baseline.';
      case 'high': return 'High fertility indicator. Estrogen is rising - fertile window is open.';
      case 'peak': return 'Peak fertility! LH surge detected. Ovulation is imminent.';
      case 'none': return 'No test taken today.';
      default: return '';
    }
  };

  // Bleeding Selector Component
  const renderBleedingOption = (level: BleedingLevel, icon: string) => {
    const isSelected = selectedBleeding === level;
    return (
      <TouchableOpacity 
        style={[styles.bleedingOption, isSelected && styles.bleedingOptionSelected]}
        onPress={() => setSelectedBleeding(level)}
      >
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </TouchableOpacity>
    );
  };

  if (!currentCycle) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text variant="bodyLarge">No active cycle. Start a new cycle first.</Text>
          <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Date Header */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="labelMedium" style={styles.dateLabel}>Logging for:</Text>
          <Button
            mode="outlined"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
            labelStyle={styles.dateButtonLabel}
          >
            {formatDisplayDate(selectedDate)}
          </Button>
          <Text variant="bodySmall" style={styles.changeDateText}>Tap to change date</Text>

          {/* Date Pickers */}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker value={selectedDate} mode="date" display="default" onChange={handleDateChange} minimumDate={minDate} />
          )}
          {Platform.OS === 'ios' && (
            <Modal visible={showDatePicker} transparent={true} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Button onPress={() => setShowDatePicker(false)}>Cancel</Button>
                    <Button onPress={() => setShowDatePicker(false)} mode="text">Done</Button>
                  </View>
                  <DateTimePicker value={selectedDate} mode="date" display="spinner" onChange={handleDateChange} minimumDate={minDate} textColor="black" />
                </View>
              </View>
            </Modal>
          )}

          <Text variant="titleMedium" style={styles.cycleDayText}>
            Cycle Day {selectedCycleDay ?? '-'}
          </Text>
        </Card.Content>
      </Card>

      {/* Menstrual Flow Section (Collapsible) */}
      <Card style={styles.card}>
        <TouchableOpacity onPress={() => setIsBleedingExpanded(!isBleedingExpanded)}>
          <Card.Title
            title="Menstrual Flow"
            right={(props) => <IconButton {...props} icon={isBleedingExpanded ? "chevron-up" : "chevron-down"} />}
          />
        </TouchableOpacity>
        {isBleedingExpanded && (
          <Card.Content>
            <View style={styles.bleedingContainer}>
              {renderBleedingOption('none', '∅')}
              {renderBleedingOption('light', '🩸')}
              {renderBleedingOption('medium', '🩸🩸')}
              {renderBleedingOption('heavy', '🩸🩸🩸')}
            </View>
          </Card.Content>
        )}
        {!isBleedingExpanded && selectedBleeding !== 'none' && (
          <Card.Content>
             <Text variant="bodyMedium" style={styles.collapsedSummary}>
               Selected: <Text style={{fontWeight: 'bold'}}>{selectedBleeding.charAt(0).toUpperCase() + selectedBleeding.slice(1)}</Text>
             </Text>
          </Card.Content>
        )}
      </Card>

      {/* Monitor Reading Section (Collapsible) */}
      <Card style={styles.card}>
        <TouchableOpacity onPress={() => setIsMonitorExpanded(!isMonitorExpanded)}>
          <Card.Title
            title="Monitor Reading"
            right={(props) => <IconButton {...props} icon={isMonitorExpanded ? "chevron-up" : "chevron-down"} />}
          />
        </TouchableOpacity>
        {isMonitorExpanded && (
          <Card.Content>
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
        )}
         {!isMonitorExpanded && selectedReading !== 'none' && (
          <Card.Content>
             <Text variant="bodyMedium" style={styles.collapsedSummary}>
               Selected: <Text style={{fontWeight: 'bold'}}>{selectedReading.toUpperCase()}</Text>
             </Text>
          </Card.Content>
        )}
      </Card>

      {/* Intercourse */}
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
          <Text variant="titleMedium" style={styles.sectionTitle}>Notes</Text>
          <TextInput
            mode="outlined"
            placeholder="Add notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />
        </Card.Content>
      </Card>

      {/* Save Button */}
      <Button mode="contained" onPress={handleSave} style={styles.saveButton}>
        {existingLog ? 'Update Log' : 'Save Log'}
      </Button>

      {/* Monitor Reset */}
      {selectedCycleDay && selectedCycleDay >= 25 && (
        <Card style={styles.resetCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.resetTitle}>Monitor Reset</Text>
            <Text variant="bodyMedium" style={styles.resetText}>
              If no Peak has been detected and you've reset your monitor, tap below.
            </Text>
            <Button mode="outlined" onPress={handleMonitorReset} style={styles.resetButton}>
              Record Monitor Reset
            </Button>
          </Card.Content>
        </Card>
      )}

      <Snackbar visible={showSnackbar} onDismiss={() => setShowSnackbar(false)} duration={2000}>
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
  dateLabel: { color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  dateButton: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  dateButtonLabel: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  changeDateText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  cycleDayText: { color: '#FFF', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12 },
  sectionTitle: { marginBottom: 12, color: COLORS.text },
  segmentedButtons: { marginBottom: 12 },
  readingDescription: { color: COLORS.textSecondary, fontStyle: 'italic' },
  intercourseItem: { paddingVertical: 8 },
  notesInput: { backgroundColor: COLORS.surface },
  saveButton: { marginHorizontal: 16, marginBottom: 16 },
  resetCard: { marginHorizontal: 16, marginBottom: 32, backgroundColor: '#FFF3E0', borderRadius: 12 },
  resetTitle: { color: COLORS.warning, marginBottom: 8 },
  resetText: { color: COLORS.text, marginBottom: 12 },
  resetButton: { borderColor: COLORS.warning },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  // Bleeding Styles
  bleedingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  bleedingOption: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bleedingOptionSelected: {
    backgroundColor: '#FFEBEE', // Very light red
    borderColor: COLORS.fertile,
  },
  collapsedSummary: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  }
});
