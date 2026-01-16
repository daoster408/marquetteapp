import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useCycleStore } from '../store';
import { Cycle, DayLog, MonitorReading } from '../types';
import { generateId, getCycleDay } from './marquetteAlgorithm';

export const parseCSVData = (csvContent: string): { cycles: Cycle[]; currentCycleId: string | null } => {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) throw new Error('CSV is empty or invalid');

  // Basic CSV parsing (assuming headers are present but strict order not guaranteed, 
  // but for now we'll implement a robust enough parser for the standard format we export)
  // Expected headers: Cycle ID,Start Date,End Date,Cycle Length,Peak Day,Luteal Phase Length,Is Complete,Date,Cycle Day,Reading,Intercourse,Notes,Is Auto Peak,Is Monitor Reset

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const cyclesMap = new Map<string, Cycle>();

  // Helper to get value by header name
  const getValue = (row: string[], header: string) => {
    const index = headers.indexOf(header);
    if (index === -1) return undefined;
    // Handle quoted values
    let val = row[index];
    if (val && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    return val;
  };

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    // Handle comma-separated values, respecting quotes
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    // Simple split for now if regex fails (simple CSVs)
    const values = row ? row.map(s => s.replace(/,$/, '').trim()) : lines[i].split(','); 

    if (!values || values.length < headers.length) continue;

    // We need to map the values to our Cycle/DayLog structure
    // Since the export format is flat (DayLog + Cycle Info), we reconstruct the hierarchy.

    // Note: To properly implement a generic CSV parser here that matches the export format
    // is complex. For the MVP "Restore" functionality, we'll assume the standard Export format.

    // ... Implementation simplified for stability ... 
    // If you need a robust parser, we should use a library like 'papaparse'.
    // For now, let's look for critical fields.
    
    // Actually, to avoid complexity and bugs in this quick fix, let's implement a 
    // simpler parser if we assume the structure matches our export.
    
    // Let's rely on column indices if headers match standard export
    const cycleId = getValue(values, 'Cycle ID') || generateId();
    const startDate = getValue(values, 'Start Date');
    const endDate = getValue(values, 'End Date');
    const isComplete = getValue(values, 'Is Complete') === 'TRUE';
    
    if (!startDate) continue;

    if (!cyclesMap.has(cycleId)) {
      cyclesMap.set(cycleId, {
        id: cycleId,
        startDate,
        endDate: endDate || undefined,
        cycleLength: Number(getValue(values, 'Cycle Length')) || 0,
        peakDay: Number(getValue(values, 'Peak Day')) || undefined,
        lutealPhaseLength: Number(getValue(values, 'Luteal Phase Length')) || undefined,
        isComplete,
        days: [],
      });
    }

    const cycle = cyclesMap.get(cycleId)!;
    const date = getValue(values, 'Date');
    
    if (date) {
        cycle.days.push({
            date,
            cycleDay: Number(getValue(values, 'Cycle Day')),
            reading: (getValue(values, 'Reading') as MonitorReading) || 'none',
            intercourse: getValue(values, 'Intercourse') === 'TRUE',
            notes: getValue(values, 'Notes') || '',
            isAutoPeak: getValue(values, 'Is Auto Peak') === 'TRUE',
            isMonitorReset: getValue(values, 'Is Monitor Reset') === 'TRUE',
        });
    }
  }

  const cycles = Array.from(cyclesMap.values());
  // Sort cycles by date
  cycles.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  
  // Determine current cycle (last one if not complete, or null)
  let currentCycleId = null;
  if (cycles.length > 0) {
      const lastCycle = cycles[cycles.length - 1];
      if (!lastCycle.isComplete) {
          currentCycleId = lastCycle.id;
      }
  }

  return { cycles, currentCycleId };
};

export const importCyclesFromUserCSV = async () => {
  const { importCyclesFromCSV } = useCycleStore.getState();

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'text/csv',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      console.log('Document picking cancelled');
      return;
    }

    if (!result.assets || result.assets.length === 0 || !result.assets[0].uri) {
        throw new Error("No document URI found.");
    }

    const csvContent = await FileSystem.readAsStringAsync(result.assets[0].uri);

    Alert.alert(
      'Import CSV Data',
      'This will erase all existing data and import cycles from the selected CSV file. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: () => {
            try {
              importCyclesFromCSV(csvContent);
              Alert.alert('Success', 'CSV data imported!');
            } catch (error: any) {
              console.error('Error processing CSV content:', error);
              Alert.alert('Error', `Failed to import CSV data. Details: ${error.message || error}`);
            }
          },
        },
      ]
    );

  } catch (error: any) {
    console.error('Error picking or reading CSV:', error);
    Alert.alert('Error', `Failed to pick or read CSV file. Details: ${error.message || error}`);
  }
};