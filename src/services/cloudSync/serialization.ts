import { DayLog } from '../../types';

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

export function dayLogToFirestore(day: DayLog) {
  return removeUndefined({
    date: day.date,
    cycleDay: day.cycleDay,
    reading: day.reading,
    bleeding: day.bleeding,
    notes: day.notes,
    isAutoPeak: day.isAutoPeak,
    isMonitorReset: day.isMonitorReset,
    intercourse: day.intercourse,
  });
}
