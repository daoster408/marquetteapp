import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { useCycleStore } from '../store';
import { Cycle, DayLog } from '../types';

export const exportCyclesToCSV = async () => {
  const allCycles = useCycleStore.getState().cycles;

  if (allCycles.length === 0) {
    Alert.alert('No Data to Export', 'There is no cycle data to export.');
    return;
  }

  let csvContent = 'Cycle ID,Start Date,End Date,Cycle Length,Peak Day,Luteal Phase Length,Is Complete,Date,Cycle Day,Reading,Intercourse,Notes,Is Auto Peak,Is Monitor Reset\n';

  allCycles.forEach(cycle => {
    if (cycle.days.length === 0) {
       // Handle cycles with no daily logs (e.g. historical manual entries)
       csvContent += [
        `"${cycle.id}"`,
        `"${cycle.startDate}"`,
        `"${cycle.endDate || ''}"`,
        cycle.cycleLength || '',
        cycle.peakDay || '',
        cycle.lutealPhaseLength || '',
        cycle.isComplete ? 'TRUE' : 'FALSE',
        '', '', '', '', '', '', '' // Empty day fields
      ].join(',') + '\n';
    } else {
      cycle.days.forEach(day => {
        csvContent += [
          `"${cycle.id}"`,
          `"${cycle.startDate}"`,
          `"${cycle.endDate || ''}"`,
          cycle.cycleLength || '',
          cycle.peakDay || '',
          cycle.lutealPhaseLength || '',
          cycle.isComplete ? 'TRUE' : 'FALSE',
          `"${day.date}"`,
          day.cycleDay,
          `"${day.reading}"`,
          day.intercourse ? 'TRUE' : 'FALSE',
          `"${day.notes || ''}"`,
          day.isAutoPeak ? 'TRUE' : 'FALSE',
          day.isMonitorReset ? 'TRUE' : 'FALSE',
        ].join(',') + '\n';
      });
    }
  });

  const filename = `Fidelis_Export_${new Date().toISOString().split('T')[0]}.csv`;
  const fileUri = FileSystem.documentDirectory + filename; // Changed to documentDirectory

  try {
    await FileSystem.writeAsStringAsync(fileUri, csvContent);

    if (Platform.OS === 'ios' && !(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.csv', dialogTitle: 'Export Cycle Data' });

  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    Alert.alert('Export Failed', `Could not export data. Error: ${error.message || error}`);
  }
};
