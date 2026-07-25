import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppSettings,
  BleedingLevel,
  CloudMode,
  CloudUser,
  CoupleMember,
  Cycle,
  DayLog,
  MigrationSnapshot,
  MonitorReading,
  SharedAppSettings,
} from '../types';
import {
  addDaysToISO,
  findPeakDay,
  generateId,
  getCycleDay,
  getTodayISO,
} from '../utils/marquetteAlgorithm';
import { getCyclePeakDay, normalizeCycleData, sortCycleDays } from '../utils/cycleData';
import { generateMockCycles } from '../utils/mockData';
import { parseCSVData } from '../utils/importData';
import { canUploadMigration, createMigrationSnapshot } from '../services/cloudSync/migration';
import { CloudRepository, getActiveMember, GoogleCredentials, isOwner } from '../services/cloudSync/repository';

const defaultSettings: AppSettings = {
  conservativeMode: false,
  notificationsEnabled: true,
  intention: 'TTA',
  appLockEnabled: false,
};

let authUnsubscribe: (() => void) | null = null;
let workspaceUnsubscribe: (() => void) | null = null;
let cloudRepository: CloudRepository | null = null;
let authRestoreTimeout: ReturnType<typeof setTimeout> | null = null;
let workspaceSyncTimeout: ReturnType<typeof setTimeout> | null = null;

function getCloudRepository(): CloudRepository {
  if (!cloudRepository) {
    cloudRepository = require('../services/cloudSync/firestoreRepository').firestoreCycleRepository;
  }

  return cloudRepository as CloudRepository;
}

function getCurrentCycleId(cycles: Cycle[]): string | null {
  const current = [...cycles]
    .filter(cycle => !cycle.isComplete)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  return current?.id || null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/account-exists-with-different-credential') {
      return 'That Google email already has a password account. Sign in with email/password for now; Google account linking still needs one more app update.';
    }
    if (code === 'auth/invalid-credential') {
      return 'Google sign-in returned an invalid credential for Firebase. Try again after reopening the app.';
    }
    return error.message;
  }

  return 'Something went wrong.';
}

interface CycleState {
  // Local/screen-facing data
  cycles: Cycle[];
  currentCycleId: string | null;
  settings: AppSettings;

  // Cloud session/workspace state
  cloudMode: CloudMode;
  cloudConfigured: boolean;
  googleSignInConfigured: boolean;
  cloudUser: CloudUser | null;
  activeCoupleId: string | null;
  members: CoupleMember[];
  cloudError: string | null;
  latestInviteCode: string | null;
  pendingLocalMigration: MigrationSnapshot | null;
  migrationDismissedCoupleIds: string[];
  migrationCompletedCoupleIds: string[];

  // Cloud actions
  initializeCloudSync: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: (credentials: GoogleCredentials) => Promise<void>;
  signOutUser: () => Promise<void>;
  createCloudWorkspace: () => Promise<void>;
  uploadLocalDataToCloud: () => Promise<void>;
  dismissLocalMigration: () => void;
  createSpouseInviteCode: () => Promise<void>;
  joinWorkspaceWithInvite: (inviteCode: string) => Promise<void>;
  removeWorkspaceMember: (memberUid: string) => Promise<void>;
  deleteCloudWorkspace: () => Promise<void>;
  clearCloudError: () => void;
  isCurrentUserOwner: () => boolean;

  // Cycle actions
  startNewCycle: (startDate?: string) => void;
  logDay: (reading: MonitorReading, bleeding?: BleedingLevel, notes?: string) => void;
  logDayForDate: (date: string, reading: MonitorReading, bleeding?: BleedingLevel, notes?: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  markMonitorReset: (date?: string) => void;
  toggleIntercourse: (date: string) => void;
  deleteCompletedCycle: (cycleId: string) => void;
  addCompletedCycle: (cycle: Cycle) => void;

  // Getters
  getCurrentCycle: () => Cycle | null;
  getCompletedCycles: () => Cycle[];
  getTodaysCycleDay: () => number | null;
  getTodaysLog: () => DayLog | null;

  // Reset/import
  resetAllData: () => void;
  restoreBackupData: (backup: Pick<CycleState, 'cycles' | 'currentCycleId' | 'settings'>) => void;

  // Developer actions
  loadMockCycles: () => void;
  importCyclesFromCSV: (csvContent: string) => void;
}

export const useCycleStore = create<CycleState>()(
  persist(
    (set, get) => {
      const setCloudError = (error: unknown) => {
        set({ cloudError: getErrorMessage(error) });
      };

      const getCloudContext = () => {
        const state = get();
        if (!state.cloudUser || !state.activeCoupleId || state.cloudMode !== 'ready') {
          return null;
        }
        return { user: state.cloudUser, coupleId: state.activeCoupleId };
      };

      const saveCycleToCloud = (cycle: Cycle) => {
        const context = getCloudContext();
        if (!context) return;

        getCloudRepository()
          .saveCycle(context.coupleId, context.user, normalizeCycleData(cycle))
          .catch(setCloudError);
      };

      const deleteCycleFromCloud = (cycleId: string) => {
        const context = getCloudContext();
        if (!context) return;

        getCloudRepository()
          .deleteCycle(context.coupleId, cycleId)
          .catch(setCloudError);
      };

      const subscribeToWorkspace = (coupleId: string) => {
        workspaceUnsubscribe?.();
        workspaceSyncTimeout && clearTimeout(workspaceSyncTimeout);

        workspaceUnsubscribe = getCloudRepository().subscribeToWorkspace(
          coupleId,
          data => {
            workspaceSyncTimeout && clearTimeout(workspaceSyncTimeout);
            const activeMember = getActiveMember(data.members, get().cloudUser?.uid);
            const localSettings = get().settings;

            if (!data.couple || data.couple.deletedAt || !activeMember) {
              set({
                cloudMode: 'workspace-required',
                activeCoupleId: null,
                members: data.members,
                cycles: [],
                currentCycleId: null,
              });
              return;
            }

            set({
              cloudMode: 'ready',
              activeCoupleId: coupleId,
              members: data.members,
              cycles: data.cycles,
              currentCycleId: getCurrentCycleId(data.cycles),
              settings: {
                ...localSettings,
                conservativeMode: data.settings.conservativeMode,
                intention: data.settings.intention,
              },
              pendingLocalMigration:
                get().migrationDismissedCoupleIds.includes(coupleId) ||
                get().migrationCompletedCoupleIds.includes(coupleId)
                  ? null
                  : get().pendingLocalMigration,
              cloudError: null,
            });
          },
          error => {
            workspaceSyncTimeout && clearTimeout(workspaceSyncTimeout);
            set({ cloudMode: 'error', cloudError: getErrorMessage(error) });
          }
        );

        workspaceSyncTimeout = setTimeout(() => {
          const state = get();
          if (state.cloudMode === 'syncing' && state.activeCoupleId === coupleId) {
            set({
              cloudMode: 'error',
              cloudError: 'Cloud sync is taking too long. Check your connection and reopen the app.',
            });
          }
        }, 20000);
      };

      return {
        cycles: [],
        currentCycleId: null,
        settings: defaultSettings,
        cloudMode: 'local',
        cloudConfigured: false,
        googleSignInConfigured: false,
        cloudUser: null,
        activeCoupleId: null,
        members: [],
        cloudError: null,
        latestInviteCode: null,
        pendingLocalMigration: null,
        migrationDismissedCoupleIds: [],
        migrationCompletedCoupleIds: [],

        initializeCloudSync: () => {
          let repository: CloudRepository;
          try {
            repository = getCloudRepository();
          } catch (error) {
            set({
              cloudConfigured: false,
              googleSignInConfigured: false,
              cloudMode: 'local',
              cloudError: getErrorMessage(error),
            });
            return;
          }

          const cloudConfigured = repository.isConfigured();
          const googleSignInConfigured = repository.isGoogleSignInConfigured();
          const migrationSnapshot = createMigrationSnapshot(
            get().cycles,
            get().currentCycleId,
            get().settings
          );

          set({
            cloudConfigured,
            googleSignInConfigured,
            pendingLocalMigration: migrationSnapshot,
            cloudMode: cloudConfigured ? 'restoring-auth' : 'local',
          });

          if (!cloudConfigured || authUnsubscribe) return;
          authRestoreTimeout && clearTimeout(authRestoreTimeout);
          authRestoreTimeout = setTimeout(() => {
            if (get().cloudMode === 'restoring-auth') {
              set({
                cloudMode: 'signed-out',
                cloudError: 'Sign-in restore is taking too long. Sign in again to continue.',
              });
            }
          }, 15000);

          try {
            authUnsubscribe = repository.subscribeToAuth(
              user => {
                authRestoreTimeout && clearTimeout(authRestoreTimeout);
                workspaceUnsubscribe?.();
                workspaceUnsubscribe = null;

                if (!user) {
                  set({
                    cloudUser: null,
                    activeCoupleId: null,
                    members: [],
                    cloudMode: 'signed-out',
                    latestInviteCode: null,
                  });
                  return;
                }

                set({
                  cloudUser: user,
                  activeCoupleId: user.activeCoupleId || null,
                  cloudMode: user.activeCoupleId ? 'syncing' : 'workspace-required',
                  cloudError: null,
                });

                if (user.activeCoupleId) {
                  subscribeToWorkspace(user.activeCoupleId);
                }
              },
              error => {
                authRestoreTimeout && clearTimeout(authRestoreTimeout);
                set({ cloudError: getErrorMessage(error), cloudMode: 'signed-out' });
              }
            );
          } catch (error) {
            authRestoreTimeout && clearTimeout(authRestoreTimeout);
            set({
              cloudMode: 'local',
              cloudError: getErrorMessage(error),
            });
          }
        },

        signInWithEmail: async (email, password) => {
          try {
            await getCloudRepository().signInWithEmail({ email, password });
          } catch (error) {
            setCloudError(error);
            throw error;
          }
        },

        signUpWithEmail: async (email, password, displayName) => {
          try {
            await getCloudRepository().signUpWithEmail({ email, password, displayName });
          } catch (error) {
            setCloudError(error);
            throw error;
          }
        },

        signInWithGoogle: async credentials => {
          try {
            await getCloudRepository().signInWithGoogle(credentials);
          } catch (error) {
            setCloudError(error);
            throw error;
          }
        },

        signOutUser: async () => {
          try {
            workspaceUnsubscribe?.();
            workspaceUnsubscribe = null;
            await getCloudRepository().signOut();
            set({
              cloudUser: null,
              activeCoupleId: null,
              members: [],
              cloudMode: get().cloudConfigured ? 'signed-out' : 'local',
              latestInviteCode: null,
            });
          } catch (error) {
            setCloudError(error);
          }
        },

        createCloudWorkspace: async () => {
          const user = get().cloudUser;
          if (!user) return;

          try {
            const coupleId = await getCloudRepository().createWorkspace(user, get().settings);
            const updatedUser = { ...user, activeCoupleId: coupleId };
            set({
              cloudUser: updatedUser,
              activeCoupleId: coupleId,
              cloudMode: 'syncing',
              cloudError: null,
            });
            subscribeToWorkspace(coupleId);
          } catch (error) {
            setCloudError(error);
          }
        },

        uploadLocalDataToCloud: async () => {
          const { activeCoupleId, cloudUser, pendingLocalMigration, cycles, migrationCompletedCoupleIds } = get();
          if (!activeCoupleId || !cloudUser) return;

          const permission = canUploadMigration(pendingLocalMigration, cycles);
          if (!permission.allowed || !pendingLocalMigration) {
            set({ cloudError: permission.reason || 'Migration is not available.' });
            return;
          }

          try {
            await getCloudRepository().uploadMigration(activeCoupleId, cloudUser, pendingLocalMigration);
            set({
              pendingLocalMigration: null,
              migrationCompletedCoupleIds: [...new Set([...migrationCompletedCoupleIds, activeCoupleId])],
              cloudError: null,
            });
          } catch (error) {
            setCloudError(error);
          }
        },

        dismissLocalMigration: () => {
          const { activeCoupleId, migrationDismissedCoupleIds } = get();
          set({
            pendingLocalMigration: null,
            migrationDismissedCoupleIds: activeCoupleId
              ? [...new Set([...migrationDismissedCoupleIds, activeCoupleId])]
              : migrationDismissedCoupleIds,
          });
        },

        createSpouseInviteCode: async () => {
          const { activeCoupleId, cloudUser, members } = get();
          if (!activeCoupleId || !cloudUser || !isOwner(members, cloudUser.uid)) {
            set({ cloudError: 'Only family chart owners can create invite codes.' });
            return;
          }

          try {
            const code = await getCloudRepository().createInviteCode(activeCoupleId, cloudUser);
            set({ latestInviteCode: code, cloudError: null });
          } catch (error) {
            setCloudError(error);
          }
        },

        joinWorkspaceWithInvite: async inviteCode => {
          const user = get().cloudUser;
          if (!user) return;

          try {
            const coupleId = await getCloudRepository().joinWorkspaceWithInvite(user, inviteCode);
            const updatedUser = { ...user, activeCoupleId: coupleId };
            set({
              cloudUser: updatedUser,
              activeCoupleId: coupleId,
              cloudMode: 'syncing',
              cloudError: null,
            });
            subscribeToWorkspace(coupleId);
          } catch (error) {
            setCloudError(error);
          }
        },

        removeWorkspaceMember: async memberUid => {
          const { activeCoupleId, cloudUser, members } = get();
          if (!activeCoupleId || !cloudUser || !isOwner(members, cloudUser.uid)) {
            set({ cloudError: 'Only family chart owners can remove members.' });
            return;
          }

          try {
            await getCloudRepository().removeMember(activeCoupleId, cloudUser, memberUid);
          } catch (error) {
            setCloudError(error);
          }
        },

        deleteCloudWorkspace: async () => {
          const { activeCoupleId, cloudUser, members } = get();
          if (!activeCoupleId || !cloudUser || !isOwner(members, cloudUser.uid)) {
            set({ cloudError: 'Only family chart owners can delete the family chart.' });
            return;
          }

          try {
            await getCloudRepository().deleteWorkspace(activeCoupleId, cloudUser);
            set({
              activeCoupleId: null,
              members: [],
              cycles: [],
              currentCycleId: null,
              cloudMode: 'workspace-required',
            });
          } catch (error) {
            setCloudError(error);
          }
        },

        clearCloudError: () => set({ cloudError: null }),

        isCurrentUserOwner: () => {
          const { cloudUser, members } = get();
          return isOwner(members, cloudUser?.uid);
        },

        startNewCycle: (startDate?: string) => {
          const today = startDate || getTodayISO();
          const state = get();
          const currentCycle = state.currentCycleId
            ? state.cycles.find(c => c.id === state.currentCycleId)
            : null;

          if (today > getTodayISO() || (currentCycle && today <= currentCycle.startDate)) {
            return;
          }

          let updatedCycles = [...state.cycles];
          const cyclesToSync: Cycle[] = [];

          if (state.currentCycleId) {
            updatedCycles = updatedCycles.map(cycle => {
              if (cycle.id !== state.currentCycleId) return cycle;

              const prevEndDate = addDaysToISO(today, -1);
              const cycleLength = getCycleDay(cycle, prevEndDate);
              const days = sortCycleDays(cycle.days);
              const peakDay = getCyclePeakDay({ ...cycle, days });
              const lutealPhaseLength = peakDay && cycleLength > peakDay
                ? cycleLength - peakDay
                : undefined;
              const completedCycle = {
                ...cycle,
                days,
                peakDay,
                endDate: prevEndDate,
                cycleLength,
                lutealPhaseLength,
                isComplete: true,
              };
              cyclesToSync.push(completedCycle);
              return completedCycle;
            });
          }

          const newCycle: Cycle = {
            id: generateId(),
            startDate: today,
            days: [],
            isComplete: false,
          };
          cyclesToSync.push(newCycle);

          set({
            cycles: [...updatedCycles, newCycle],
            currentCycleId: newCycle.id,
          });
          cyclesToSync.forEach(saveCycleToCloud);
        },

        logDay: (reading, bleeding, notes) => {
          get().logDayForDate(getTodayISO(), reading, bleeding, notes);
        },

        logDayForDate: (date, reading, bleeding, notes) => {
          const state = get();
          if (!state.currentCycleId) return;

          const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
          if (!currentCycle) return;

          const cycleDay = getCycleDay(currentCycle, date);
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

          const existingIndex = currentCycle.days.findIndex(d => d.date === date);
          let updatedDays: DayLog[];

          if (existingIndex >= 0) {
            updatedDays = [...currentCycle.days];
            updatedDays[existingIndex] = {
              ...updatedDays[existingIndex],
              ...newLog,
              intercourse: updatedDays[existingIndex].intercourse,
            };
          } else {
            updatedDays = sortCycleDays([...currentCycle.days, newLog]);
          }

          const peakDay = findPeakDay(updatedDays) ?? undefined;
          let updatedCycle: Cycle | null = null;
          const updatedCycles = state.cycles.map(cycle => {
            if (cycle.id !== state.currentCycleId) return cycle;
            updatedCycle = { ...cycle, days: updatedDays, peakDay };
            return updatedCycle;
          });

          set({ cycles: updatedCycles });
          if (updatedCycle) saveCycleToCloud(updatedCycle);
        },

        updateSettings: newSettings => {
          set(state => ({
            settings: { ...state.settings, ...newSettings },
          }));

          const context = getCloudContext();
          const sharedSettings: Partial<SharedAppSettings> = {};
          if ('conservativeMode' in newSettings) sharedSettings.conservativeMode = newSettings.conservativeMode;
          if ('intention' in newSettings) sharedSettings.intention = newSettings.intention;

          if (context && Object.keys(sharedSettings).length > 0) {
            getCloudRepository()
              .updateSharedSettings(context.coupleId, context.user, sharedSettings)
              .catch(setCloudError);
          }
        },

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
          const updatedDays = existingIndex >= 0
            ? currentCycle.days.map((day, index) => index === existingIndex
              ? { ...day, ...resetLog, intercourse: day.intercourse }
              : day)
            : sortCycleDays([...currentCycle.days, resetLog]);

          const peakDay = findPeakDay(updatedDays) ?? undefined;
          const updatedCycle = { ...currentCycle, days: updatedDays, peakDay };
          set({
            cycles: state.cycles.map(cycle => cycle.id === state.currentCycleId ? updatedCycle : cycle),
          });
          saveCycleToCloud(updatedCycle);
        },

        toggleIntercourse: date => {
          const state = get();
          if (!state.currentCycleId) return;

          const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
          if (!currentCycle) return;

          const existingIndex = currentCycle.days.findIndex(d => d.date === date);
          const updatedDays = existingIndex >= 0
            ? currentCycle.days.map((day, index) => index === existingIndex
              ? { ...day, intercourse: !day.intercourse }
              : day)
            : sortCycleDays([
                ...currentCycle.days,
                {
                  date,
                  cycleDay: getCycleDay(currentCycle, date),
                  reading: 'none',
                  intercourse: true,
                },
              ]);

          const updatedCycle = { ...currentCycle, days: updatedDays };
          set({
            cycles: state.cycles.map(cycle => cycle.id === state.currentCycleId ? updatedCycle : cycle),
          });
          saveCycleToCloud(updatedCycle);
        },

        deleteCompletedCycle: cycleId => {
          const state = get();
          const cycleToDelete = state.cycles.find(cycle => cycle.id === cycleId);

          if (!cycleToDelete || !cycleToDelete.isComplete || cycleId === state.currentCycleId) {
            return;
          }

          set({
            cycles: state.cycles.filter(cycle => cycle.id !== cycleId),
          });
          deleteCycleFromCloud(cycleId);
        },

        addCompletedCycle: cycle => {
          const normalized = normalizeCycleData(cycle);
          set(state => ({
            cycles: [...state.cycles, normalized].sort((a, b) => a.startDate.localeCompare(b.startDate)),
          }));
          saveCycleToCloud(normalized);
        },

        getCurrentCycle: () => {
          const state = get();
          if (!state.currentCycleId) return null;
          return state.cycles.find(c => c.id === state.currentCycleId) || null;
        },

        getCompletedCycles: () => get().cycles.filter(c => c.isComplete),

        getTodaysCycleDay: () => {
          const currentCycle = get().getCurrentCycle();
          if (!currentCycle) return null;
          return getCycleDay(currentCycle, getTodayISO());
        },

        getTodaysLog: () => {
          const currentCycle = get().getCurrentCycle();
          if (!currentCycle) return null;
          return currentCycle.days.find(d => d.date === getTodayISO()) || null;
        },

        resetAllData: () => {
          set({
            cycles: [],
            currentCycleId: null,
            settings: defaultSettings,
            pendingLocalMigration: null,
          });
        },

        restoreBackupData: backup => {
          const cycles = backup.cycles.map(normalizeCycleData);
          set({
            cycles,
            currentCycleId: backup.currentCycleId,
            settings: backup.settings,
            pendingLocalMigration: createMigrationSnapshot(cycles, backup.currentCycleId, backup.settings),
          });
        },

        loadMockCycles: () => {
          const { cycles, currentCycleId } = generateMockCycles();
          set({
            cycles,
            currentCycleId,
            settings: defaultSettings,
            pendingLocalMigration: createMigrationSnapshot(cycles, currentCycleId, defaultSettings),
          });
        },

        importCyclesFromCSV: csvContent => {
          const { cycles, currentCycleId } = parseCSVData(csvContent);
          set({
            cycles,
            currentCycleId,
            settings: defaultSettings,
            pendingLocalMigration: createMigrationSnapshot(cycles, currentCycleId, defaultSettings),
          });
        },
      };
    },
    {
      name: 'marquette-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        cycles: state.cycles,
        currentCycleId: state.currentCycleId,
        settings: state.settings,
        migrationDismissedCoupleIds: state.migrationDismissedCoupleIds,
        migrationCompletedCoupleIds: state.migrationCompletedCoupleIds,
      }),
    }
  )
);
