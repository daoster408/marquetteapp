import { Cycle, DayLog } from '../types';
import { findPeakDay, getCycleDay } from './marquetteAlgorithm';

export function sortCycleDays(days: DayLog[]): DayLog[] {
  return [...days].sort((a, b) => a.cycleDay - b.cycleDay);
}

export function getCyclePeakDay(cycle: Pick<Cycle, 'days' | 'peakDay'>): number | undefined {
  const peakFromLogs = findPeakDay(cycle.days);
  if (peakFromLogs !== null) return peakFromLogs;

  return cycle.days.length === 0 ? cycle.peakDay : undefined;
}

export function normalizeCycleData(cycle: Cycle): Cycle {
  const days = sortCycleDays(cycle.days);
  const peakDay = getCyclePeakDay({ ...cycle, days });
  const cycleLength = cycle.isComplete && cycle.endDate
    ? getCycleDay(cycle, cycle.endDate)
    : cycle.cycleLength;
  const lutealPhaseLength = cycle.isComplete && cycleLength && peakDay && cycleLength > peakDay
    ? cycleLength - peakDay
    : undefined;

  return {
    ...cycle,
    days,
    peakDay,
    cycleLength,
    lutealPhaseLength,
  };
}
