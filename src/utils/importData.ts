import { Cycle, DayLog, MonitorReading } from '../types';
import { generateId } from './marquetteAlgorithm';

interface CSVRow {
  cycleDay: number;
  date: string;
  reading: string;
  intercourse: string;
}

// Helper to convert CSV reading strings to MonitorReading enum
const convertReading = (csvReading: string): MonitorReading => {
  switch (csvReading.toUpperCase()) {
    case 'L':
      return 'low';
    case 'H':
      return 'high';
    case 'P':
      return 'peak';
    case '1': // Countdown day 1
    case '2': // Countdown day 2
    case '3': // Countdown day 3
    case 'NONE':
    case '': // Empty string also means no reading
      return 'none';
    default:
      return 'none'; // Default to none for unknown readings
  }
};

export const parseCSVData = (csvContent: string): { cycles: Cycle[], currentCycleId: string | null } => {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return { cycles: [], currentCycleId: null }; // No header + data

  const headers = lines[0].split(/\t|,/).map(h => h.trim()); // Use tab as delimiter
  const dataRows = lines.slice(1);

  const cycles: Cycle[] = [];
  let currentCycle: Cycle | null = null;
  let currentCycleId: string | null = null;

  for (const rowString of dataRows) {
    const values = rowString.split(/\t|,/).map(v => v.trim()); // Use tab as delimiter
    const row: CSVRow = {
      cycleDay: parseInt(values[headers.indexOf('CycleDay')], 10),
      date: values[headers.indexOf('StartDate')],
      reading: values[headers.indexOf('Reading')],
      intercourse: values[headers.indexOf('Intercourse')],
    };

    if (row.cycleDay === 1) {
      // Start of a new cycle
      if (currentCycle) {
        // Complete the previous cycle
        // The `findPeakDay` logic is usually done by the algorithm,
        // but for completed cycles, we can pre-calculate if a 'P' reading exists.
        const peakLog = currentCycle.days.find(d => d.reading === 'peak' && !d.isAutoPeak);
        currentCycle.peakDay = peakLog ? peakLog.cycleDay : undefined;
        currentCycle.cycleLength = currentCycle.days.length;
        currentCycle.endDate = currentCycle.days[currentCycle.days.length - 1].date;
        
        if (currentCycle.peakDay && currentCycle.cycleLength > currentCycle.peakDay) {
          currentCycle.lutealPhaseLength = currentCycle.cycleLength - currentCycle.peakDay;
        }
        
        currentCycle.isComplete = true;
        cycles.push(currentCycle);
      }
      currentCycle = {
        id: generateId(),
        startDate: row.date,
        days: [],
        isComplete: false,
      };
      currentCycleId = currentCycle.id; // Keep track of the last started cycle as current
    }

    if (!currentCycle) continue; // Should not happen if data is well-formed

    const monitorReading = convertReading(row.reading);

    const dayLog: DayLog = {
      date: row.date,
      cycleDay: row.cycleDay,
      reading: monitorReading,
      intercourse: row.intercourse ? (row.intercourse.toLowerCase() === 'i' || row.intercourse.toLowerCase() === 'true') : false,
      // isAutoPeak will be determined by the algorithm, not from CSV
      // notes are not in this CSV format, so leave as undefined
    };
    currentCycle.days.push(dayLog);
  }

  // Add the last current cycle (it won't be marked complete)
  if (currentCycle) {
      // For the final cycle, don't mark as complete and don't calculate length/endDate yet
      const peakLog = currentCycle.days.find(d => d.reading === 'peak' && !d.isAutoPeak);
      currentCycle.peakDay = peakLog ? peakLog.cycleDay : undefined;
      cycles.push(currentCycle);
  }

  return { cycles, currentCycleId };
};
