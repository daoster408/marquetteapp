import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy'; // Use legacy for compatibility with SDK 54
import { Alert } from 'react-native';
import { useCycleStore } from '../store';
import { getLocalDateISO } from './marquetteAlgorithm';

export const exportCyclesToCSV = async () => {
  try {
    const allCycles = useCycleStore.getState().cycles;

    if (allCycles.length === 0) {
      Alert.alert('No Data', 'There is no cycle data to export.');
      return;
    }

    // --- GENERATE DOCTOR-FRIENDLY WIDE FORMAT (Cycle Sheet) ---
    const maxDays = 45; 
    const dayHeaders = Array.from({ length: maxDays }, (_, i) => `CD${i + 1}`).join(',');
    
    let csvContent = `Cycle Num,Start Date,End Date,Length,Peak Day,Luteal Phase,${dayHeaders}\n`;

    // Chronological order for the chart
    const sortedCycles = [...allCycles].sort((a, b) => a.startDate.localeCompare(b.startDate));

    sortedCycles.forEach((cycle, index) => {
      const cycleNum = index + 1;
      
      const dayCells = Array.from({ length: maxDays }, (_, i) => {
        const cd = i + 1;
        const dayLog = cycle.days.find(d => d.cycleDay === cd);
        
        if (!dayLog) return '';
        
        let cell = '';
        if (dayLog.reading === 'peak') cell += 'P';
        else if (dayLog.reading === 'high') cell += 'H';
        else if (dayLog.reading === 'low') cell += 'L';
        else if (dayLog.reading === 'none') cell += '-';
        
        if (dayLog.isAutoPeak) cell += '*'; // Mark auto-peak with asterisk
        if (dayLog.intercourse) cell += ' (I)';
        
        return `"${cell}"`;
      });

      const row = [
        cycleNum,
        `"${cycle.startDate}"`,
        `"${cycle.endDate || 'Current'}"`,
        cycle.cycleLength || '',
        cycle.peakDay || '',
        cycle.lutealPhaseLength || '',
        ...dayCells
      ].join(',');

      csvContent += row + '\n';
    });

    // --- SAVE AND SHARE ---
    const filename = `Fidelis_Chart_${getLocalDateISO()}.csv`;
    const fileUri = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Error', 'Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export Fertility Chart'
    });

  } catch (error: any) {
    console.error('Export Error:', error);
    Alert.alert('Export Failed', `An error occurred: ${error.message || 'Unknown error'}`);
  }
};
