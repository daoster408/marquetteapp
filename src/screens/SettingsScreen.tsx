import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Text, Card, Switch, Divider, List, Button, Portal, Dialog } from 'react-native-paper';
import { useCycleStore } from '../store';
import { COLORS, STRINGS } from '../constants';
import { importCSVFile } from '../utils/devTools';

interface Props {
  navigation: any;
}

export default function SettingsScreen({ navigation }: Props) {
  const { settings, updateSettings, resetAllData, loadMockCycles } = useCycleStore();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showMockDataDialog, setShowMockDataDialog] = useState(false);
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false);

  const handleResetAllData = () => {
    resetAllData();
    setShowResetDialog(false);
  };

  const handleLoadMockData = () => {
    loadMockCycles();
    setShowMockDataDialog(false);
  };

  const handleImportCSV = () => {
    // The actual importCSVFile handles its own Alert and state update via zustand
    importCSVFile();
    setShowCSVImportDialog(false);
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
            onPress={() => setShowCSVImportDialog(true)}
            style={styles.devButton}
          >
            Import Cycles from CSV
          </Button>
          <Text variant="bodySmall" style={styles.resetWarning}>
            This will erase data and import from hardcoded CSV.
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
              onValueChange={(value) => updateSettings({ notificationsEnabled: value })}
              color={COLORS.primary}
            />
          </View>
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
            Future updates may include cloud backup options.
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
              This will permanently delete all your current cycle history, logs, and settings, and replace it with data from `app/assets/import.csv`. This action cannot be undone. Ensure your `import.csv` file is correctly formatted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCSVImportDialog(false)}>Cancel</Button>
            <Button onPress={handleImportCSV} textColor={COLORS.primary}>
              Import CSV
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
});
