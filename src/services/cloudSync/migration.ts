import { AppSettings, Cycle, MigrationSnapshot, SharedAppSettings } from '../../types';
import { normalizeCycleData } from '../../utils/cycleData';

export function createMigrationSnapshot(
  cycles: Cycle[],
  currentCycleId: string | null,
  settings: AppSettings
): MigrationSnapshot | null {
  if (cycles.length === 0) return null;

  return {
    cycles: cycles.map(normalizeCycleData),
    currentCycleId,
    settings: { ...settings },
  };
}

export function toSharedSettings(settings: AppSettings): SharedAppSettings {
  return {
    conservativeMode: settings.conservativeMode,
    intention: settings.intention,
  };
}

export function canUploadMigration(
  snapshot: MigrationSnapshot | null,
  cloudCycles: Cycle[]
): { allowed: boolean; reason?: string } {
  if (!snapshot || snapshot.cycles.length === 0) {
    return { allowed: false, reason: 'No local cycle data is available to upload.' };
  }

  if (cloudCycles.length > 0) {
    return {
      allowed: false,
      reason: 'This family chart already has cloud cycle data. Export a backup before choosing a deliberate merge path.',
    };
  }

  return { allowed: true };
}

export function shouldPromptForMigration(
  snapshot: MigrationSnapshot | null,
  coupleId: string | null | undefined,
  dismissedCoupleIds: string[],
  completedCoupleIds: string[]
): boolean {
  if (!snapshot || snapshot.cycles.length === 0 || !coupleId) return false;
  if (dismissedCoupleIds.includes(coupleId)) return false;
  if (completedCoupleIds.includes(coupleId)) return false;

  return true;
}
