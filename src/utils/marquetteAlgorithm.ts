import { Cycle, DayLog, FertilityStatus, FertilityWindow, CycleStats } from '../types';
import { ALGORITHM, STRINGS } from '../constants';

/**
 * Get the earliest Peak day from the last N cycles
 */
export function getEarliestPeakInLastCycles(
  cycles: Cycle[],
  count: number = ALGORITHM.LOOKBACK_CYCLES
): number | null {
  const completedCycles = cycles
    .filter(c => c.isComplete && c.peakDay !== undefined)
    .slice(-count);

  if (completedCycles.length === 0) return null;

  const peakDays = completedCycles.map(c => c.peakDay!);
  return Math.min(...peakDays);
}

/**
 * Calculate when fertility window should open
 * - First 6 cycles: CD6
 * - After 6 cycles: earliest of (first High) or (earliest Peak in last 6 - 6)
 */
export function calculateFertilityStart(
  completedCycleCount: number,
  earliestPeakInLast6: number | null,
  conservativeMode: boolean = false
): number {
  // Conservative mode always uses CD6
  if (conservativeMode) {
    return ALGORITHM.FIRST_TEST_DAY;
  }

  // First 6 cycles: use CD6
  if (completedCycleCount < ALGORITHM.LOOKBACK_CYCLES) {
    return ALGORITHM.FIRST_TEST_DAY;
  }

  // After 6 cycles: use (earliest Peak - 6) or CD6, whichever is later
  if (earliestPeakInLast6 !== null) {
    const calculatedStart = earliestPeakInLast6 - ALGORITHM.PEAK_MINUS_DAYS;
    // Never start fertility before CD6 (testing day)
    return Math.max(calculatedStart, ALGORITHM.FIRST_TEST_DAY);
  }

  return ALGORITHM.FIRST_TEST_DAY;
}

/**
 * Find the first Peak day in a cycle's logs
 */
export function findPeakDay(days: DayLog[]): number | null {
  const peakLog = days.find(d => d.reading === 'peak' && !d.isAutoPeak);
  return peakLog ? peakLog.cycleDay : null;
}

/**
 * Find the first High reading day in a cycle's logs
 */
export function findFirstHighDay(days: DayLog[]): number | null {
  const highLog = days.find(d => d.reading === 'high');
  return highLog ? highLog.cycleDay : null;
}

/**
 * Calculate the current fertility status for a cycle
 */
export function calculateFertilityStatus(
  cycle: Cycle,
  currentCycleDay: number,
  completedCycles: Cycle[],
  conservativeMode: boolean = false,
  intention: 'TTA' | 'TTC' = 'TTA'
): FertilityWindow {
  const completedCycleCount = completedCycles.length;
  const earliestPeak = getEarliestPeakInLastCycles(completedCycles);
  const calculatedFertilityStart = calculateFertilityStart(
    completedCycleCount,
    earliestPeak,
    conservativeMode
  );

  // Messages based on Intention
  const msgPeriod = STRINGS.statusPeriod;
  const msgInfertile = intention === 'TTC' 
    ? 'Low chance of conception.' 
    : STRINGS.infertileGuidance;
  const msgFertile = intention === 'TTC'
    ? 'High chance of conception! Intercourse recommended.'
    : STRINGS.fertileGuidance; // "Abstain if postponing"
  const msgWaiting = intention === 'TTC'
    ? 'Continue testing to find Peak fertility.'
    : STRINGS.waitingForPeak;
  const msgAfterPeak = intention === 'TTC'
    ? 'Peak passed. Chance of conception decreasing.'
    : STRINGS.afterPeakGuidance; // "Abstain for 3 days"


  // Period days (CD1-5)
  if (currentCycleDay <= 5) {
    return {
      status: 'period',
      message: msgPeriod,
    };
  }

  // Find Peak in current cycle
  const peakDay = findPeakDay(cycle.days);
  const firstHighDay = findFirstHighDay(cycle.days);

  // If Peak was recorded, check if we're past the fertile window
  if (peakDay !== null) {
    const secondPeakDay = peakDay + 1; // Auto-recorded 2nd Peak
    const fertileWindowEnd = secondPeakDay + ALGORITHM.PEAK_WAIT_DAYS;
    const firstSafeDay = fertileWindowEnd + 1;

    if (currentCycleDay >= firstSafeDay) {
      // Past fertile window - infertile
      return {
        status: 'infertile',
        fertileWindowEnd,
        message: msgInfertile,
      };
    } else if (currentCycleDay > peakDay) {
      // After Peak, counting down
      const daysUntilSafe = firstSafeDay - currentCycleDay;
      return {
        status: 'fertile',
        fertileWindowEnd,
        daysUntilSafe,
        message: `${msgAfterPeak} ${intention === 'TTA' ? daysUntilSafe + ' day(s) remaining.' : ''}`,
      };
    }
  }

  // Determine if currently in fertile window (no Peak yet)
  // Fertility starts on:
  // - First High reading, OR
  // - Calculated fertility start day (based on history)
  // Whichever comes FIRST

  let isFertile = false;
  let fertileReason = '';

  // Check if we've hit a High reading
  if (firstHighDay !== null && currentCycleDay >= firstHighDay) {
    isFertile = true;
    fertileReason = 'High reading detected';
  }

  // Check if we've reached the calculated fertility start
  if (currentCycleDay >= calculatedFertilityStart) {
    isFertile = true;
    if (!fertileReason) {
      fertileReason = `Cycle Day ${calculatedFertilityStart} reached`;
    }
  }

  if (isFertile) {
    // Check for CD25 warning
    if (currentCycleDay >= ALGORITHM.MAX_TEST_DAY && peakDay === null) {
      return {
        status: 'fertile',
        fertileWindowStart: Math.min(calculatedFertilityStart, firstHighDay || 999),
        message: STRINGS.day25Warning,
      };
    }

    return {
      status: 'fertile',
      fertileWindowStart: Math.min(calculatedFertilityStart, firstHighDay || 999),
      message: msgFertile, // "High chance" or "Abstain"
    };
  }

  // Before fertility window opens (only possible in cycles 7+ with history)
  return {
    status: 'infertile',
    fertileWindowStart: calculatedFertilityStart,
    message: intention === 'TTC' 
      ? `Low chance until around Cycle Day ${calculatedFertilityStart}.`
      : `Low Fertility until ${firstHighDay ? 'first High reading or ' : ''}Cycle Day ${calculatedFertilityStart}.`,
  };
}

/**
 * Check if today should auto-record as 2nd Peak
 */
export function shouldAutoRecordPeak(cycle: Cycle, currentCycleDay: number): boolean {
  const peakDay = findPeakDay(cycle.days);
  if (peakDay === null) return false;

  // Check if current day is the day after Peak
  if (currentCycleDay === peakDay + 1) {
    // Check if we already have a log for this day
    const existingLog = cycle.days.find(d => d.cycleDay === currentCycleDay);
    if (!existingLog) {
      return true;
    }
  }

  return false;
}

/**
 * Check if monitor reset is needed (CD25+ with no Peak)
 */
export function needsMonitorReset(cycle: Cycle, currentCycleDay: number): boolean {
  if (currentCycleDay < ALGORITHM.MAX_TEST_DAY) return false;

  const peakDay = findPeakDay(cycle.days);
  return peakDay === null;
}

/**
 * Calculate cycle statistics from completed cycles
 */
export function calculateCycleStats(cycles: Cycle[]): CycleStats {
  const completedCycles = cycles.filter(c => c.isComplete && c.cycleLength);

  if (completedCycles.length === 0) {
    return {
      totalCycles: 0,
      averageCycleLength: 0,
      averagePeakDay: 0,
      earliestPeakInLast6: null,
      shortestCycle: 0,
      longestCycle: 0,
    };
  }

  const cycleLengths = completedCycles.map(c => c.cycleLength!);
  const peakDays = completedCycles
    .filter(c => c.peakDay !== undefined)
    .map(c => c.peakDay!);

  const lutealLengths = completedCycles
    .filter(c => c.lutealPhaseLength !== undefined)
    .map(c => c.lutealPhaseLength!);

  return {
    totalCycles: completedCycles.length,
    averageCycleLength: Math.round(
      cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
    ),
    averagePeakDay: peakDays.length > 0
      ? Math.round(peakDays.reduce((a, b) => a + b, 0) / peakDays.length)
      : 0,
    earliestPeakInLast6: getEarliestPeakInLastCycles(completedCycles),
    shortestCycle: Math.min(...cycleLengths),
    longestCycle: Math.max(...cycleLengths),
    averageLutealPhase: lutealLengths.length > 0
      ? Math.round(lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length)
      : 0,
  };
}

/**
 * Get the cycle day for a given date within a cycle
 */
export function getCycleDay(cycle: Cycle, date: string): number {
  // Parse manually to ensure we are comparing local calendar dates
  // avoiding any UTC parsing shifts
  const [sYear, sMonth, sDay] = cycle.startDate.split('-').map(Number);
  const startDate = new Date(sYear, sMonth - 1, sDay);

  const [tYear, tMonth, tDay] = date.split('-').map(Number);
  const targetDate = new Date(tYear, tMonth - 1, tDay);

  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // CD1 is day 0 difference
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
