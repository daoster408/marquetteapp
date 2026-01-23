// Monitor reading types
export type MonitorReading = 'low' | 'high' | 'peak' | 'none';

// Bleeding intensity
export type BleedingLevel = 'heavy' | 'medium' | 'light' | 'spotting' | 'none';

// Fertility status
export type FertilityStatus = 'fertile' | 'infertile' | 'period' | 'waiting';

// Daily log entry
export interface DayLog {
  date: string; // ISO date string (YYYY-MM-DD)
  cycleDay: number;
  reading: MonitorReading;
  bleeding?: BleedingLevel; // Menstrual flow intensity
  notes?: string;
  isAutoPeak?: boolean; // True for the auto-recorded 2nd Peak
  isMonitorReset?: boolean; // True if monitor was reset on this day
  intercourse?: boolean; // True if intercourse was logged for this day
}

// Cycle data
export interface Cycle {
  id: string;
  startDate: string; // ISO date string for CD1
  endDate?: string; // ISO date string when cycle ended (next cycle started)
  days: DayLog[];
  peakDay?: number;
  cycleLength?: number;
  lutealPhaseLength?: number;
  isComplete: boolean;
}

// App settings
export interface AppSettings {
  conservativeMode: boolean; // Always start fertility on CD6
  notificationsEnabled: boolean;
  reminderTime?: string; // Time for daily testing reminder
  intention: 'TTA' | 'TTC'; // Trying to Avoid (TTA) or Trying to Conceive (TTC)
}

// Fertility window calculation result
export interface FertilityWindow {
  status: FertilityStatus;
  fertileWindowStart?: number; // Cycle day fertility begins
  fertileWindowEnd?: number; // Cycle day fertility ends (evening)
  daysUntilSafe?: number; // Days until fertile window closes
  message: string; // Human-readable status message
}

// Cycle statistics
export interface CycleStats {
  totalCycles: number;
  averageCycleLength: number;
  averagePeakDay: number;
  earliestPeakInLast6: number | null;
  shortestCycle: number;
  longestCycle: number;
  averageLutealPhase?: number;
}
