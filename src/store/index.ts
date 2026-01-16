import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Cycle, DayLog, MonitorReading, AppSettings } from '../types';
import {
  generateId,
  getTodayISO,
  getCycleDay,
  findPeakDay,
} from '../utils/marquetteAlgorithm';
import { generateMockCycles } from '../utils/mockData';
import { parseCSVData } from '../utils/importData';

interface CycleState {
  // Data
  cycles: Cycle[];
  currentCycleId: string | null;
  settings: AppSettings;

  // Actions
  startNewCycle: (startDate?: string) => void;
  logDay: (reading: MonitorReading, notes?: string) => void;
  logDayForDate: (date: string, reading: MonitorReading, notes?: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  markMonitorReset: () => void;
  toggleIntercourse: (date: string) => void;

  // Getters (computed from state)
  getCurrentCycle: () => Cycle | null;
  getCompletedCycles: () => Cycle[];
  getTodaysCycleDay: () => number | null;
  getTodaysLog: () => DayLog | null;

  // Reset
  resetAllData: () => void;

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
      },

      // Start a new cycle
      startNewCycle: (startDate?: string) => {
        const today = startDate || getTodayISO();
        const state = get();

        // Close the current cycle if one exists
        let updatedCycles = [...state.cycles];
        if (state.currentCycleId) {
          updatedCycles = updatedCycles.map(cycle => {
            if (cycle.id === state.currentCycleId) {
              // End date is day before new cycle starts
              const startDateObj = new Date(today);
              startDateObj.setDate(startDateObj.getDate() - 1);
              const prevEndDate = startDateObj.toISOString().split('T')[0];
              
              // Calculate length using the corrected end date
              const cycleLength = getCycleDay(cycle, prevEndDate);
              
              let lutealPhaseLength: number | undefined;
              if (cycle.peakDay && cycleLength > cycle.peakDay) {
                lutealPhaseLength = cycleLength - cycle.peakDay;
              }
              return {
                ...cycle,
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
      logDay: (reading: MonitorReading, notes?: string) => {
        const today = getTodayISO();
        get().logDayForDate(today, reading, notes);
      },

      // Log a specific date's reading
      logDayForDate: (date: string, reading: MonitorReading, notes?: string) => {
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
          notes,
          isAutoPeak,
        };

        // Update or add the log
        const existingIndex = currentCycle.days.findIndex(d => d.date === date);
        let updatedDays: DayLog[];

        if (existingIndex >= 0) {
          updatedDays = [...currentCycle.days];
          updatedDays[existingIndex] = {
            ...updatedDays[existingIndex],
            ...newLog,
          };
        } else {
          updatedDays = [...currentCycle.days, newLog].sort(
            (a, b) => a.cycleDay - b.cycleDay
          );
        }

        // Update Peak day if this is a Peak reading
        let peakDay = currentCycle.peakDay;
        if (reading === 'peak' && !isAutoPeak) {
          peakDay = cycleDay;
        }

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

      // Mark that monitor was reset today
      markMonitorReset: () => {
        const state = get();
        if (!state.currentCycleId) return;

        const today = getTodayISO();
        const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
        if (!currentCycle) return;

        const cycleDay = getCycleDay(currentCycle, today);

        const resetLog: DayLog = {
          date: today,
          cycleDay,
          reading: 'none',
          isMonitorReset: true,
          notes: 'Monitor reset - set to CD4',
        };

        const existingIndex = currentCycle.days.findIndex(d => d.date === today);
        let updatedDays: DayLog[];

        if (existingIndex >= 0) {
          updatedDays = [...currentCycle.days];
          updatedDays[existingIndex] = resetLog;
        } else {
          updatedDays = [...currentCycle.days, resetLog].sort(
            (a, b) => a.cycleDay - b.cycleDay
          );
        }

        const updatedCycles = state.cycles.map(cycle => {
          if (cycle.id === state.currentCycleId) {
            return { ...cycle, days: updatedDays };
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
          updatedDays = [...currentCycle.days, newLog].sort(
            (a, b) => a.cycleDay - b.cycleDay
          );
        }

        const updatedCycles = state.cycles.map(cycle => {
          if (cycle.id === state.currentCycleId) {
            return { ...cycle, days: updatedDays };
          }
          return cycle;
        });

        set({ cycles: updatedCycles });
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
          },
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
