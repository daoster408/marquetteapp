import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Cycle, DayLog, MonitorReading, AppSettings, BleedingLevel } from '../types';
import {
  generateId,
  getTodayISO,
  addDaysToISO,
  getCycleDay,
  findPeakDay,
} from '../utils/marquetteAlgorithm';
import { getCyclePeakDay, normalizeCycleData, sortCycleDays } from '../utils/cycleData';
import { generateMockCycles } from '../utils/mockData';
import { parseCSVData } from '../utils/importData';

interface CycleState {
  // Data
  cycles: Cycle[];
  currentCycleId: string | null;
  settings: AppSettings;

  // Actions
  startNewCycle: (startDate?: string) => void;
  logDay: (reading: MonitorReading, bleeding?: BleedingLevel, notes?: string) => void;
  logDayForDate: (date: string, reading: MonitorReading, bleeding?: BleedingLevel, notes?: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  markMonitorReset: (date?: string) => void;
  toggleIntercourse: (date: string) => void;
  deleteCompletedCycle: (cycleId: string) => void;

  // Getters (computed from state)
  getCurrentCycle: () => Cycle | null;
  getCompletedCycles: () => Cycle[];
  getTodaysCycleDay: () => number | null;
  getTodaysLog: () => DayLog | null;

  // Reset
  resetAllData: () => void;
  restoreBackupData: (backup: Pick<CycleState, 'cycles' | 'currentCycleId' | 'settings'>) => void;

  // --- Developer Actions ---
  loadMockCycles: () => void;
  importCyclesFromCSV: (csvContent: string) => void;
}

export const useCycleStore = create<CycleState>()(
  persist(
    (set, get) => ({
      // Initial state
      cycles: [],
      currentCycleId: null,
      settings: {
        conservativeMode: false,
        notificationsEnabled: true,
        intention: 'TTA',
      },

      // Start a new cycle
      startNewCycle: (startDate?: string) => {
        const today = startDate || getTodayISO();
        const state = get();
        const currentCycle = state.currentCycleId
          ? state.cycles.find(c => c.id === state.currentCycleId)
          : null;

        if (today > getTodayISO() || (currentCycle && today <= currentCycle.startDate)) {
          return;
        }

        // Close the current cycle if one exists
        let updatedCycles = [...state.cycles];
        if (state.currentCycleId) {
          updatedCycles = updatedCycles.map(cycle => {
            if (cycle.id === state.currentCycleId) {
              // End date is day before new cycle starts
              const prevEndDate = addDaysToISO(today, -1);
              
              // Calculate length using the corrected end date
              const cycleLength = getCycleDay(cycle, prevEndDate);
              
              const days = sortCycleDays(cycle.days);
              const peakDay = getCyclePeakDay({ ...cycle, days });
              let lutealPhaseLength: number | undefined;
              if (peakDay && cycleLength > peakDay) {
                lutealPhaseLength = cycleLength - peakDay;
              }
              return {
                ...cycle,
                days,
                peakDay,
                endDate: prevEndDate,
                cycleLength,
                lutealPhaseLength,
                isComplete: true,
              };
            }
            return cycle;
          });
        }

        // Create new cycle
        const newCycle: Cycle = {
          id: generateId(),
          startDate: today,
          days: [],
          isComplete: false,
        };

        set({
          cycles: [...updatedCycles, newCycle],
          currentCycleId: newCycle.id,
        });
      },

      // Log today's reading
      logDay: (reading: MonitorReading, bleeding?: BleedingLevel, notes?: string) => {
        const today = getTodayISO();
        get().logDayForDate(today, reading, bleeding, notes);
      },

      // Log a specific date's reading
      logDayForDate: (date: string, reading: MonitorReading, bleeding?: BleedingLevel, notes?: string) => {
        const state = get();
        if (!state.currentCycleId) return;

        const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
        if (!currentCycle) return;

        const cycleDay = getCycleDay(currentCycle, date);

        // Check if this is an auto-peak day (day after first Peak)
        const existingPeakDay = findPeakDay(currentCycle.days);
        const isAutoPeak = existingPeakDay !== null &&
          cycleDay === existingPeakDay + 1 &&
          reading === 'peak';

        const newLog: DayLog = {
          date,
          cycleDay,
          reading,
          bleeding,
          notes,
          isAutoPeak,
        };

        // Update or add the log
        const existingIndex = currentCycle.days.findIndex(d => d.date === date);
        let updatedDays: DayLog[];

        if (existingIndex >= 0) {
          updatedDays = [...currentCycle.days];
          // Merge with existing log to preserve fields not being updated if we were partially updating
          // But here we are overwriting core fields. 
          // However, we want to ensure we don't lose 'intercourse' if it's not passed here (it's not).
          // 'newLog' doesn't have intercourse field, so spreading newLog over existingLog would be safer if we want to preserve intercourse.
          
          updatedDays[existingIndex] = {
            ...updatedDays[existingIndex],
            ...newLog,
            // Explicitly preserve intercourse if it exists in the old log
            intercourse: updatedDays[existingIndex].intercourse
          };
        } else {
          updatedDays = sortCycleDays([...currentCycle.days, newLog]);
        }

        const peakDay = findPeakDay(updatedDays) ?? undefined;

        const updatedCycles = state.cycles.map(cycle => {
          if (cycle.id === state.currentCycleId) {
            return {
              ...cycle,
              days: updatedDays,
              peakDay,
            };
          }
          return cycle;
        });

        set({ cycles: updatedCycles });
      },

      // Update app settings
      updateSettings: (newSettings: Partial<AppSettings>) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // Mark that monitor was reset on the selected date
      markMonitorReset: (date?: string) => {
        const state = get();
        if (!state.currentCycleId) return;

        const resetDate = date || getTodayISO();
        const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
        if (!currentCycle) return;

        const cycleDay = getCycleDay(currentCycle, resetDate);

        const resetLog: DayLog = {
          date: resetDate,
          cycleDay,
          reading: 'none',
          isMonitorReset: true,
          notes: 'Monitor reset - set to CD4',
        };

        const existingIndex = currentCycle.days.findIndex(d => d.date === resetDate);
        let updatedDays: DayLog[];

        if (existingIndex >= 0) {
          updatedDays = [...currentCycle.days];
          updatedDays[existingIndex] = {
            ...updatedDays[existingIndex],
            ...resetLog,
            intercourse: updatedDays[existingIndex].intercourse,
          };
        } else {
          updatedDays = sortCycleDays([...currentCycle.days, resetLog]);
        }

        const peakDay = findPeakDay(updatedDays) ?? undefined;
        const updatedCycles = state.cycles.map(cycle => {
          if (cycle.id === state.currentCycleId) {
            return { ...cycle, days: updatedDays, peakDay };
          }
          return cycle;
        });

        set({ cycles: updatedCycles });
      },

      // Toggle intercourse for a specific date
      toggleIntercourse: (date: string) => {
        const state = get();
        if (!state.currentCycleId) return;

        const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
        if (!currentCycle) return;

        const existingIndex = currentCycle.days.findIndex(d => d.date === date);
        let updatedDays: DayLog[];

        if (existingIndex >= 0) {
          // Log exists, toggle intercourse status
          updatedDays = [...currentCycle.days];
          const existingLog = updatedDays[existingIndex];
          updatedDays[existingIndex] = {
            ...existingLog,
            intercourse: !existingLog.intercourse,
          };
        } else {
          // No log exists, create a new one
          const cycleDay = getCycleDay(currentCycle, date);
          const newLog: DayLog = {
            date,
            cycleDay,
            reading: 'none',
            intercourse: true,
          };
          updatedDays = sortCycleDays([...currentCycle.days, newLog]);
        }

        const updatedCycles = state.cycles.map(cycle => {
          if (cycle.id === state.currentCycleId) {
            return { ...cycle, days: updatedDays };
          }
          return cycle;
        });

        set({ cycles: updatedCycles });
      },

      deleteCompletedCycle: (cycleId: string) => {
        set(state => {
          const cycleToDelete = state.cycles.find(cycle => cycle.id === cycleId);

          if (!cycleToDelete || !cycleToDelete.isComplete || cycleId === state.currentCycleId) {
            return {};
          }

          return {
            cycles: state.cycles.filter(cycle => cycle.id !== cycleId),
          };
        });
      },

      // Get current cycle
      getCurrentCycle: () => {
        const state = get();
        if (!state.currentCycleId) return null;
        return state.cycles.find(c => c.id === state.currentCycleId) || null;
      },

      // Get completed cycles
      getCompletedCycles: () => {
        return get().cycles.filter(c => c.isComplete);
      },

      // Get today's cycle day
      getTodaysCycleDay: () => {
        const currentCycle = get().getCurrentCycle();
        if (!currentCycle) return null;
        return getCycleDay(currentCycle, getTodayISO());
      },

      // Get today's log entry
      getTodaysLog: () => {
        const currentCycle = get().getCurrentCycle();
        if (!currentCycle) return null;
        const today = getTodayISO();
        return currentCycle.days.find(d => d.date === today) || null;
      },

      // Reset all data
      resetAllData: () => {
        set({
          cycles: [],
          currentCycleId: null,
          settings: {
            conservativeMode: false,
            notificationsEnabled: true,
            intention: 'TTA',
          },
        });
      },

      restoreBackupData: (backup) => {
        set({
          cycles: backup.cycles.map(normalizeCycleData),
          currentCycleId: backup.currentCycleId,
          settings: backup.settings,
        });
      },

      // --- Developer Actions ---
      loadMockCycles: () => {
        const { cycles, currentCycleId } = generateMockCycles();
        set({
          cycles,
          currentCycleId,
          settings: { // Reset settings to default
            conservativeMode: false,
            notificationsEnabled: true,
            intention: 'TTA',
          },
        });
      },

      // Import cycles from CSV data
      importCyclesFromCSV: (csvContent: string) => {
        const { cycles, currentCycleId } = parseCSVData(csvContent);
        set({
          cycles,
          currentCycleId,
          settings: { // Reset settings to default
            conservativeMode: false,
            notificationsEnabled: true,
            intention: 'TTA',
          },
        });
      },
    }),
    {
      name: 'marquette-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
