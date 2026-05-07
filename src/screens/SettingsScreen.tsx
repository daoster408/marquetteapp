import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, Platform, Modal } from 'react-native';
import { Text, Card, Switch, Divider, List, Button, Portal, Dialog } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCycleStore } from '../store';
import { COLORS, STRINGS } from '../constants';
import { importCyclesFromUserCSV } from '../utils/importData'; 
import { exportCyclesToCSV } from '../utils/exportData'; 
import { exportBackupData, importBackupFromUserFile } from '../utils/backupData';
import { registerForPushNotificationsAsync, scheduleDailyReminder, cancelAllNotifications } from '../utils/notifications';
import Constants from 'expo-constants'; 

interface Props {
  navigation: any;
}

export default function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings, resetAllData, loadMockCycles } = useCycleStore();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showMockDataDialog, setShowMockDataDialog] = useState(false);
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false);
  const [showBackupImportDialog, setShowBackupImportDialog] = useState(false);
  
  // Notification Time Picker State
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => {
    // Initialize date object from stored string "HH:MM" or default 08:00
    const d = new Date();
    const [hours, minutes] = (settings.reminderTime || "08:00").split(':').map(Number);
    d.setHours(hours);
    d.setMinutes(minutes);
    d.setSeconds(0);
    return d;
  });

  const appVersion = Constants.expoConfig?.version || 'Unknown';
  const deviceName = Constants.deviceName || 'Unknown';
  const platformOS = Platform.OS;

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      // User turning ON notifications
      const hasPermission = await registerForPushNotificationsAsync();
      if (hasPermission) {
        updateSettings({ notificationsEnabled: true });
        // Schedule immediately based on current time
        const hour = reminderDate.getHours();
        const minute = reminderDate.getMinutes();
        await scheduleDailyReminder(hour, minute);
      } else {
        // Permission denied
        updateSettings({ notificationsEnabled: false });
        Alert.alert("Permission Required", "Please enable notifications in your device settings to use reminders.");
      }
    } else {
      // User turning OFF notifications
      updateSettings({ notificationsEnabled: false });
      await cancelAllNotifications();
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedDate) {
      setReminderDate(selectedDate);
      
      // Save string "HH:MM" to store
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      updateSettings({ reminderTime: timeString });

      // Reschedule if enabled
      if (settings.notificationsEnabled) {
        await scheduleDailyReminder(selectedDate.getHours(), selectedDate.getMinutes());
      }
    }
  };

  const handleResetAllData = () => {
    resetAllData();
    setShowResetDialog(false);
  };

  const handleLoadMockData = () => {
    loadMockCycles();
    setShowMockDataDialog(false);
  };

  const handleImportCSV = async () => {
    // This will open the dialog before actual import
    setShowCSVImportDialog(true);
  };

  const confirmImportCSV = async () => {
    setShowCSVImportDialog(false);
    await importCyclesFromUserCSV();
  };

  const handleExportData = async () => {
    await exportCyclesToCSV();
  };

  const handleExportBackup = async () => {
    await exportBackupData();
  };

  const confirmImportBackup = async () => {
    setShowBackupImportDialog(false);
    await importBackupFromUserFile();
  };

  const handleReportBug = () => {
    const emailSubject = `Fidelis Bug Report - v${appVersion}`;
    const emailBody = `\n\n---
Device: ${deviceName}
OS: ${platformOS}
App Version: ${appVersion}
---
Please describe the bug or feedback below:\n\n`;
    const emailAddress = 'fidelis.app.beta@gmail.com'; 

    const mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    Linking.canOpenURL(mailtoUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(mailtoUrl);
        } else {
          Alert.alert('Cannot Open Email', 'Please configure an email client on your device.');
        }
      })
      .catch(err => console.error('An error occurred', err));
  };

  const openMarquetteInfo = () => {
    Linking.openURL('https://www.marquette.edu/nursing/natural-family-planning.php');
  };

  const openChurchTeaching = () => {
    Linking.openURL('https://www.vatican.va/content/paul-vi/en/encyclicals/documents/hf_p-vi_enc_25071968_humanae-vitae.html');
  };

  return (
    <ScrollView style={styles.container}>
      {/* --- DEVELOPER TOOLS --- */}
      {__DEV__ && (
        <Card style={[styles.card, styles.devCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Developer Tools (BETA)
            </Text>
            <Text variant="bodySmall" style={styles.dataInfo}>
              These tools are for testing purposes.
            </Text>
            <Button
              mode="contained"
              onPress={() => setShowMockDataDialog(true)}
              style={styles.devButton}
            >
              Load 7 Mock Cycles
            </Button>
            <Text variant="bodySmall" style={styles.resetWarning}>
              This will erase your current data and create a fresh set of 7
              completed cycles and 1 current cycle.
            </Text>
            <Button
              mode="contained"
              onPress={handleImportCSV} // Now triggers the dialog
              style={styles.devButton}
            >
              Import Cycles from CSV
            </Button>
            <Text variant="bodySmall" style={styles.resetWarning}>
              This will erase current data and import from a selected CSV file.
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Intention Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your Goal
          </Text>

          <View style={styles.intentionContainer}>
            <Button 
              mode={settings.intention === 'TTA' ? 'contained' : 'outlined'}
              onPress={() => updateSettings({ intention: 'TTA' })}
              style={styles.intentionButton}
              icon="shield-check"
            >
              Avoid Pregnancy
            </Button>
            
            <Button 
              mode={settings.intention === 'TTC' ? 'contained' : 'outlined'}
              onPress={() => updateSettings({ intention: 'TTC' })}
              style={styles.intentionButton}
              icon="baby-carriage"
            >
              Achieve Pregnancy
            </Button>
          </View>
          
          <Text variant="bodySmall" style={styles.settingDescription}>
            This changes the guidance messages on your dashboard. The algorithm calculations remain the same.
          </Text>
        </Card.Content>
      </Card>

      {/* Algorithm Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Algorithm Settings
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge">Conservative Mode</Text>
              <Text variant="bodySmall" style={styles.settingDescription}>
                Always start fertility window on Cycle Day 6, regardless of your
                cycle history. Recommended for extra caution when postponing.
              </Text>
            </View>
            <Switch
              value={settings.conservativeMode}
              onValueChange={(value) => updateSettings({ conservativeMode: value })}
              color={COLORS.primary}
            />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoBox}>
            <Text variant="bodySmall" style={styles.infoText}>
              When Conservative Mode is OFF, after 6 tracked cycles, the app will
              calculate your fertility window start based on your earliest Peak
              day in the last 6 cycles (minus 6 days).
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Notifications */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Notifications
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge">Daily Reminders</Text>
              <Text variant="bodySmall" style={styles.settingDescription}>
                Get reminded to log your monitor reading each day.
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleNotificationToggle}
              color={COLORS.primary}
            />
          </View>

          {settings.notificationsEnabled && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.settingRow}>
                <Text variant="bodyLarge">Reminder Time</Text>
                <Button 
                  mode="outlined" 
                  onPress={() => setShowTimePicker(true)}
                >
                  {reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Button>
              </View>

              {/* Android Date Picker */}
              {showTimePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={reminderDate}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={handleTimeChange}
                />
              )}

              {/* iOS Date Picker Modal */}
              {Platform.OS === 'ios' && (
                <Modal
                  visible={showTimePicker}
                  transparent={true}
                  animationType="slide"
                  onRequestClose={() => setShowTimePicker(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Button onPress={() => setShowTimePicker(false)}>Cancel</Button>
                        <Button onPress={() => setShowTimePicker(false)} mode="text">Done</Button>
                      </View>
                      <DateTimePicker
                        value={reminderDate}
                        mode="time"
                        display="spinner"
                        onChange={handleTimeChange}
                        textColor="black"
                      />
                    </View>
                  </View>
                </Modal>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      {/* Resources */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Resources
          </Text>

          <List.Item
            title="Marquette Method Information"
            description="Learn more about the Marquette Method at Marquette University"
            left={props => <List.Icon {...props} icon="school" />}
            onPress={openMarquetteInfo}
            style={styles.listItem}
          />

          <Divider />

          <List.Item
            title="Church Teaching"
            description="Humanae Vitae - On the Regulation of Birth"
            left={props => <List.Icon {...props} icon="book-open-variant" />}
            onPress={openChurchTeaching}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* Support */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Support & Sharing
          </Text>

          <Button
            mode="outlined"
            onPress={handleExportData}
            style={styles.actionButton}
            icon="file-export-outline"
          >
            Export Doctor Chart (CSV)
          </Button>
          <Text variant="bodySmall" style={styles.actionDescription}>
            Exports a readable cycle chart for sharing with an instructor or doctor.
          </Text>

          <Divider style={styles.divider} />

          <Button
            mode="outlined"
            onPress={handleReportBug}
            style={styles.actionButton}
            icon="bug"
          >
            Report a Bug
          </Button>
          <Text variant="bodySmall" style={styles.actionDescription}>
            Opens your email client to send a bug report to the developer, including basic app information.
          </Text>
        </Card.Content>
      </Card>

      {/* About */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            About
          </Text>

          <Text variant="bodyMedium" style={styles.aboutText}>
            {STRINGS.appName}
          </Text>

          <Text variant="bodySmall" style={styles.disclaimer}>
            {STRINGS.disclaimer}
          </Text>

          <Text variant="bodySmall" style={styles.disclaimer}>
            This app is designed to help you chart your fertility signs using
            the Marquette Method. It is not a substitute for instruction from
            a certified Marquette Method instructor.
          </Text>

          <Text variant="bodySmall" style={styles.disclaimer}>
            For questions about the method or to find an instructor, visit the
            Marquette University Natural Family Planning website.
          </Text>
        </Card.Content>
      </Card>

      {/* Data Management */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Data
          </Text>

          <Text variant="bodySmall" style={styles.dataInfo}>
            Your data is stored locally on your device. No data is sent to
            external servers. If you uninstall the app, your data will be lost.
          </Text>

          <Text variant="bodySmall" style={styles.dataInfo}>
            Backups are local files you can save to cloud storage or another device.
          </Text>

          <Divider style={styles.divider} />

          <Button
            mode="outlined"
            onPress={handleExportBackup}
            style={styles.actionButton}
            icon="content-save-outline"
          >
            Export Backup (JSON)
          </Button>

          <Button
            mode="outlined"
            onPress={() => setShowBackupImportDialog(true)}
            style={styles.actionButton}
            icon="restore"
          >
            Import Backup (JSON)
          </Button>

          <Text variant="bodySmall" style={styles.resetWarning}>
            Importing a backup replaces all current cycle history and settings.
          </Text>

          <Divider style={styles.divider} />

          <Button
            mode="outlined"
            onPress={() => setShowResetDialog(true)}
            style={styles.resetButton}
            textColor={COLORS.warning}
          >
            Reset All Data
          </Button>

          <Text variant="bodySmall" style={styles.resetWarning}>
            This will permanently delete all your cycle history and settings.
          </Text>
        </Card.Content>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog visible={showResetDialog} onDismiss={() => setShowResetDialog(false)}>
          <Dialog.Title>Reset All Data?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will permanently delete all your cycle history, logs, and settings. This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)}>Cancel</Button>
            <Button onPress={handleResetAllData} textColor={COLORS.warning}>
              Reset Everything
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Mock Data Confirmation Dialog */}
      <Portal>
        <Dialog visible={showMockDataDialog} onDismiss={() => setShowMockDataDialog(false)}>
          <Dialog.Title>Load Mock Data?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will erase all your current data and replace it with 7 mock completed cycles and 1 current cycle for testing purposes.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowMockDataDialog(false)}>Cancel</Button>
            <Button onPress={handleLoadMockData} textColor={COLORS.primary}>
              Load Mock Data
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* CSV Import Confirmation Dialog */}
      <Portal>
        <Dialog visible={showCSVImportDialog} onDismiss={() => setShowCSVImportDialog(false)}>
          <Dialog.Title>Import Cycles from CSV?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will permanently delete all your current cycle history, logs, and settings, and replace it with data from the selected CSV file. This action cannot be undone. Ensure your CSV file is correctly formatted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCSVImportDialog(false)}>Cancel</Button>
            <Button onPress={confirmImportCSV} textColor={COLORS.primary}>
              Import CSV
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Backup Import Confirmation Dialog */}
      <Portal>
        <Dialog visible={showBackupImportDialog} onDismiss={() => setShowBackupImportDialog(false)}>
          <Dialog.Title>Import Backup?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will replace all current cycle history, logs, and settings with the selected backup file. This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowBackupImportDialog(false)}>Cancel</Button>
            <Button onPress={confirmImportBackup} textColor={COLORS.primary}>
              Import Backup
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  devCard: {
    backgroundColor: '#fff8e1', // A light yellow to distinguish it
    borderColor: '#ffecb3',
    borderWidth: 1,
  },
  devButton: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    color: COLORS.primary,
  },
  intentionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  intentionButton: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingDescription: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  infoBox: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
  },
  listItem: {
    paddingVertical: 8,
  },
  aboutText: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  disclaimer: {
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  dataInfo: {
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  resetButton: {
    borderColor: COLORS.warning,
    marginTop: 8,
  },
  resetWarning: {
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 12,
    marginBottom: 4,
  },
  actionDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
