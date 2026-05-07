import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCycleStore } from '../store';
import { AppSettings, Cycle, MonitorReading } from '../types';
import { getLocalDateISO } from './marquetteAlgorithm';

const BACKUP_FORMAT = 'fidelis.app.backup';
const BACKUP_VERSION = 1;

interface AppBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  cycles: Cycle[];
  currentCycleId: string | null;
  settings: AppSettings;
}

const defaultSettings: AppSettings = {
  conservativeMode: false,
  notificationsEnabled: true,
  intention: 'TTA',
};

const monitorReadings: MonitorReading[] = ['low', 'high', 'peak', 'none'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertValidCycle(value: unknown): asserts value is Cycle {
  if (!isObject(value)) {
    throw new Error('Backup contains an invalid cycle.');
  }

  if (typeof value.id !== 'string' || !isISODate(value.startDate) || !Array.isArray(value.days)) {
    throw new Error('Backup contains a cycle with missing required fields.');
  }

  if (value.endDate !== undefined && !isISODate(value.endDate)) {
    throw new Error('Backup contains a cycle with an invalid end date.');
  }

  value.days.forEach(day => {
    if (!isObject(day) || !isISODate(day.date) || typeof day.cycleDay !== 'number') {
      throw new Error('Backup contains an invalid day log.');
    }

    if (!monitorReadings.includes(day.reading as MonitorReading)) {
      throw new Error('Backup contains an invalid monitor reading.');
    }
  });
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isObject(value)) return defaultSettings;

  return {
    conservativeMode: typeof value.conservativeMode === 'boolean'
      ? value.conservativeMode
      : defaultSettings.conservativeMode,
    notificationsEnabled: typeof value.notificationsEnabled === 'boolean'
      ? value.notificationsEnabled
      : defaultSettings.notificationsEnabled,
    reminderTime: typeof value.reminderTime === 'string' ? value.reminderTime : undefined,
    intention: value.intention === 'TTC' || value.intention === 'TTA'
      ? value.intention
      : defaultSettings.intention,
  };
}

export function createBackupContent(): string {
  const { cycles, currentCycleId, settings } = useCycleStore.getState();
  const backup: AppBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    cycles,
    currentCycleId,
    settings,
  };

  return JSON.stringify(backup, null, 2);
}

export function parseBackupContent(content: string): Pick<AppBackup, 'cycles' | 'currentCycleId' | 'settings'> {
  const parsed = JSON.parse(content) as unknown;

  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    throw new Error('This does not look like a Fidelis backup file.');
  }

  if (!Array.isArray(parsed.cycles)) {
    throw new Error('Backup is missing cycle data.');
  }

  parsed.cycles.forEach(assertValidCycle);

  const cycles = parsed.cycles;
  const currentCycleId = typeof parsed.currentCycleId === 'string' ? parsed.currentCycleId : null;

  if (currentCycleId && !cycles.some(cycle => cycle.id === currentCycleId)) {
    throw new Error('Backup current cycle does not match the cycle list.');
  }

  return {
    cycles,
    currentCycleId,
    settings: normalizeSettings(parsed.settings),
  };
}

export async function exportBackupData() {
  try {
    const cycles = useCycleStore.getState().cycles;

    if (cycles.length === 0) {
      Alert.alert('No Data', 'There is no cycle data to back up.');
      return;
    }

    const filename = `Fidelis_Backup_${getLocalDateISO()}.json`;
    const fileUri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(fileUri, createBackupContent(), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Error', 'Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Export Fidelis Backup',
    });
  } catch (error: any) {
    console.error('Backup Export Error:', error);
    Alert.alert('Backup Failed', `An error occurred: ${error.message || 'Unknown error'}`);
  }
}

export async function importBackupFromUserFile() {
  const { restoreBackupData } = useCycleStore.getState();

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const uri = result.assets?.[0]?.uri;
    if (!uri) {
      throw new Error('No document URI found.');
    }

    const backupContent = await FileSystem.readAsStringAsync(uri);
    const backup = parseBackupContent(backupContent);
    restoreBackupData(backup);
    Alert.alert('Success', 'Backup data imported.');
  } catch (error: any) {
    console.error('Backup Import Error:', error);
    Alert.alert('Import Failed', `Could not import backup. Details: ${error.message || error}`);
  }
}
