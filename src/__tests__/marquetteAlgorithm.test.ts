import {
  getEarliestPeakInLastCycles,
  calculateFertilityStart,
  findPeakDay,
  findFirstHighDay,
  calculateFertilityStatus,
  shouldAutoRecordPeak,
  needsMonitorReset,
  calculateCycleStats,
  getCycleDay,
  addDaysToISO,
  parseISODateLocal,
  getTodayISO,
  generateId,
} from '../utils/marquetteAlgorithm';
import { Cycle, DayLog } from '../types';
import { ALGORITHM } from '../constants';

// Helper function to create a cycle with specific data
function createCycle(
  startDate: string,
  days: Partial<DayLog>[] = [],
  peakDay?: number,
  isComplete = false,
  cycleLength?: number
): Cycle {
  return {
    id: generateId(),
    startDate,
    days: days.map((d, i) => ({
      date: d.date || `2024-01-${String(i + 1).padStart(2, '0')}`,
      cycleDay: d.cycleDay || i + 1,
      reading: d.reading || 'low',
      notes: d.notes,
      isAutoPeak: d.isAutoPeak,
      isMonitorReset: d.isMonitorReset,
    })),
    peakDay,
    isComplete,
    cycleLength,
    endDate: isComplete ? '2024-02-01' : undefined,
  };
}

// Helper to create multiple completed cycles with specific Peak days
function createCompletedCyclesWithPeaks(peakDays: number[]): Cycle[] {
  return peakDays.map((peakDay, i) => ({
    id: `cycle-${i}`,
    startDate: `2024-0${i + 1}-01`,
    endDate: `2024-0${i + 1}-28`,
    days: [],
    peakDay,
    cycleLength: 28,
    isComplete: true,
  }));
}

describe('Marquette Algorithm', () => {
  // ==========================================
  // Peak Day Detection Tests
  // ==========================================
  describe('findPeakDay', () => {
    it('should return null when no Peak recorded', () => {
      const days: DayLog[] = [
        { date: '2024-01-06', cycleDay: 6, reading: 'low' },
        { date: '2024-01-07', cycleDay: 7, reading: 'low' },
        { date: '2024-01-08', cycleDay: 8, reading: 'high' },
      ];
      expect(findPeakDay(days)).toBeNull();
    });

    it('should return the cycle day of first Peak', () => {
      const days: DayLog[] = [
        { date: '2024-01-06', cycleDay: 6, reading: 'low' },
        { date: '2024-01-14', cycleDay: 14, reading: 'peak' },
      ];
      expect(findPeakDay(days)).toBe(14);
    });

    it('should ignore auto-recorded 2nd Peak', () => {
      const days: DayLog[] = [
        { date: '2024-01-14', cycleDay: 14, reading: 'peak' },
        { date: '2024-01-15', cycleDay: 15, reading: 'peak', isAutoPeak: true },
      ];
      expect(findPeakDay(days)).toBe(14);
    });
  });

  describe('findFirstHighDay', () => {
    it('should return null when no High recorded', () => {
      const days: DayLog[] = [
        { date: '2024-01-06', cycleDay: 6, reading: 'low' },
        { date: '2024-01-07', cycleDay: 7, reading: 'low' },
      ];
      expect(findFirstHighDay(days)).toBeNull();
    });

    it('should return the cycle day of first High', () => {
      const days: DayLog[] = [
        { date: '2024-01-06', cycleDay: 6, reading: 'low' },
        { date: '2024-01-08', cycleDay: 8, reading: 'high' },
        { date: '2024-01-09', cycleDay: 9, reading: 'high' },
      ];
      expect(findFirstHighDay(days)).toBe(8);
    });
  });

  // ==========================================
  // Earliest Peak Lookback Tests
  // ==========================================
  describe('getEarliestPeakInLastCycles', () => {
    it('should return null when no completed cycles', () => {
      expect(getEarliestPeakInLastCycles([])).toBeNull();
    });

    it('should return null when no cycles have Peak days', () => {
      const cycles = [
        createCycle('2024-01-01', [], undefined, true, 28),
        createCycle('2024-02-01', [], undefined, true, 28),
      ];
      expect(getEarliestPeakInLastCycles(cycles)).toBeNull();
    });

    it('should return earliest Peak from last 6 cycles', () => {
      const cycles = createCompletedCyclesWithPeaks([14, 15, 13, 16, 14, 15]);
      expect(getEarliestPeakInLastCycles(cycles)).toBe(13);
    });

    it('should only consider last 6 cycles', () => {
      // 8 cycles: [10, 11, 14, 15, 13, 16, 14, 15]
      // Last 6: [14, 15, 13, 16, 14, 15] -> earliest is 13
      const cycles = createCompletedCyclesWithPeaks([10, 11, 14, 15, 13, 16, 14, 15]);
      expect(getEarliestPeakInLastCycles(cycles, 6)).toBe(13);
    });

    it('should work with fewer than 6 cycles', () => {
      const cycles = createCompletedCyclesWithPeaks([14, 12, 15]);
      expect(getEarliestPeakInLastCycles(cycles)).toBe(12);
    });
  });

  // ==========================================
  // Fertility Start Calculation Tests
  // ==========================================
  describe('calculateFertilityStart', () => {
    it('should return CD6 for first 6 cycles', () => {
      expect(calculateFertilityStart(0, null, false)).toBe(6);
      expect(calculateFertilityStart(3, null, false)).toBe(6);
      expect(calculateFertilityStart(5, null, false)).toBe(6);
    });

    it('should return CD6 when conservative mode is on', () => {
      expect(calculateFertilityStart(10, 14, true)).toBe(6);
    });

    it('should calculate fertility start after 6 cycles: earliest Peak - 6', () => {
      // Earliest Peak = 14, so fertility start = 14 - 6 = 8
      expect(calculateFertilityStart(6, 14, false)).toBe(8);

      // Earliest Peak = 19, so fertility start = 19 - 6 = 13
      expect(calculateFertilityStart(6, 19, false)).toBe(13);
    });

    it('should never return earlier than CD6', () => {
      // Earliest Peak = 10, so 10 - 6 = 4, but should be capped at 6
      expect(calculateFertilityStart(6, 10, false)).toBe(6);

      // Earliest Peak = 11, so 11 - 6 = 5, but should be capped at 6
      expect(calculateFertilityStart(6, 11, false)).toBe(6);
    });

    it('should return CD6 if no earliest Peak data available after 6 cycles', () => {
      expect(calculateFertilityStart(6, null, false)).toBe(6);
    });
  });

  // ==========================================
  // Fertility Status Calculation Tests
  // ==========================================
  describe('calculateFertilityStatus', () => {
    describe('Period days (CD1-5)', () => {
      it('should return period status for CD1-5', () => {
        const cycle = createCycle('2024-01-01');

        expect(calculateFertilityStatus(cycle, 1, [], false).status).toBe('period');
        expect(calculateFertilityStatus(cycle, 3, [], false).status).toBe('period');
        expect(calculateFertilityStatus(cycle, 5, [], false).status).toBe('period');
      });
    });

    describe('Fertile window (first 6 cycles)', () => {
      it('should open fertile window on CD6', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 6, reading: 'low' },
        ]);

        const result = calculateFertilityStatus(cycle, 6, [], false);
        expect(result.status).toBe('fertile');
      });

      it('should be fertile after first High reading', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 6, reading: 'low' },
          { cycleDay: 7, reading: 'low' },
          { cycleDay: 8, reading: 'high' },
        ]);

        const result = calculateFertilityStatus(cycle, 8, [], false);
        expect(result.status).toBe('fertile');
      });
    });

    describe('Peak and fertile window closing', () => {
      it('should remain fertile on Peak day', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 14, reading: 'peak' },
        ], 14);

        const result = calculateFertilityStatus(cycle, 14, [], false);
        expect(result.status).toBe('fertile');
      });

      it('should remain fertile on Peak+1 (auto 2nd Peak)', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 14, reading: 'peak' },
          { cycleDay: 15, reading: 'peak', isAutoPeak: true },
        ], 14);

        const result = calculateFertilityStatus(cycle, 15, [], false);
        expect(result.status).toBe('fertile');
      });

      it('should remain fertile for 3 days after 2nd Peak (CD16, 17, 18)', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 14, reading: 'peak' },
          { cycleDay: 15, reading: 'peak', isAutoPeak: true },
        ], 14);

        // Peak on CD14, auto-Peak on CD15
        // Wait 3 days: CD16, CD17, CD18
        // First safe day: CD19

        expect(calculateFertilityStatus(cycle, 16, [], false).status).toBe('fertile');
        expect(calculateFertilityStatus(cycle, 17, [], false).status).toBe('fertile');
        expect(calculateFertilityStatus(cycle, 18, [], false).status).toBe('fertile');
      });

      it('should be infertile on first safe day (Peak + 1 + 3 + 1 = Peak + 5)', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 14, reading: 'peak' },
          { cycleDay: 15, reading: 'peak', isAutoPeak: true },
        ], 14);

        // Peak CD14 + auto-Peak CD15 + 3 wait days (16,17,18) = first safe CD19
        const result = calculateFertilityStatus(cycle, 19, [], false);
        expect(result.status).toBe('infertile');
      });

      it('should calculate countdown correctly', () => {
        const cycle = createCycle('2024-01-01', [
          { cycleDay: 14, reading: 'peak' },
          { cycleDay: 15, reading: 'peak', isAutoPeak: true },
        ], 14);

        // On CD16, 3 days until safe (CD19)
        const result16 = calculateFertilityStatus(cycle, 16, [], false);
        expect(result16.daysUntilSafe).toBe(3);

        // On CD17, 2 days until safe
        const result17 = calculateFertilityStatus(cycle, 17, [], false);
        expect(result17.daysUntilSafe).toBe(2);

        // On CD18, 1 day until safe
        const result18 = calculateFertilityStatus(cycle, 18, [], false);
        expect(result18.daysUntilSafe).toBe(1);
      });
    });

    describe('Fertility window after 6 cycles (earliest Peak lookback)', () => {
      it('should use calculated fertility start after 6 cycles', () => {
        // 6 completed cycles with earliest Peak at CD14
        // New fertility start = 14 - 6 = 8
        const completedCycles = createCompletedCyclesWithPeaks([14, 15, 16, 14, 15, 16]);
        const currentCycle = createCycle('2024-07-01', [
          { cycleDay: 6, reading: 'low' },
          { cycleDay: 7, reading: 'low' },
        ]);

        // CD7 should be infertile (before calculated start of CD8)
        const result7 = calculateFertilityStatus(currentCycle, 7, completedCycles, false);
        expect(result7.status).toBe('infertile');

        // CD8 should be fertile (calculated start day)
        const result8 = calculateFertilityStatus(currentCycle, 8, completedCycles, false);
        expect(result8.status).toBe('fertile');
      });

      it('should open fertility early if High reading comes before calculated start', () => {
        // Earliest Peak = 19, calculated start = 13
        const completedCycles = createCompletedCyclesWithPeaks([19, 20, 19, 21, 19, 20]);
        const currentCycle = createCycle('2024-07-01', [
          { cycleDay: 6, reading: 'low' },
          { cycleDay: 7, reading: 'low' },
          { cycleDay: 8, reading: 'high' }, // High before calculated CD13
        ]);

        // CD8 should be fertile because High reading
        const result = calculateFertilityStatus(currentCycle, 8, completedCycles, false);
        expect(result.status).toBe('fertile');
      });
    });
  });

  // ==========================================
  // Auto-Peak Recording Tests
  // ==========================================
  describe('shouldAutoRecordPeak', () => {
    it('should return false if no Peak recorded', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 6, reading: 'low' },
      ]);
      expect(shouldAutoRecordPeak(cycle, 7)).toBe(false);
    });

    it('should return true on day after Peak', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 14, reading: 'peak' },
      ], 14);
      expect(shouldAutoRecordPeak(cycle, 15)).toBe(true);
    });

    it('should return false if day after Peak already logged', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 14, reading: 'peak' },
        { cycleDay: 15, reading: 'peak', isAutoPeak: true },
      ], 14);
      expect(shouldAutoRecordPeak(cycle, 15)).toBe(false);
    });

    it('should return false on days other than Peak+1', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 14, reading: 'peak' },
      ], 14);
      expect(shouldAutoRecordPeak(cycle, 14)).toBe(false);
      expect(shouldAutoRecordPeak(cycle, 16)).toBe(false);
    });
  });

  // ==========================================
  // Monitor Reset Tests
  // ==========================================
  describe('needsMonitorReset', () => {
    it('should return false before CD25', () => {
      const cycle = createCycle('2024-01-01');
      expect(needsMonitorReset(cycle, 20)).toBe(false);
      expect(needsMonitorReset(cycle, 24)).toBe(false);
    });

    it('should return true on CD25+ with no Peak', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 6, reading: 'low' },
        { cycleDay: 20, reading: 'high' },
      ]);
      expect(needsMonitorReset(cycle, 25)).toBe(true);
      expect(needsMonitorReset(cycle, 26)).toBe(true);
    });

    it('should return false on CD25+ if Peak was recorded', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 14, reading: 'peak' },
      ], 14);
      expect(needsMonitorReset(cycle, 25)).toBe(false);
    });
  });

  // ==========================================
  // Cycle Statistics Tests
  // ==========================================
  describe('calculateCycleStats', () => {
    it('should return zeros for empty cycles', () => {
      const stats = calculateCycleStats([]);
      expect(stats.totalCycles).toBe(0);
      expect(stats.averageCycleLength).toBe(0);
    });

    it('should calculate average cycle length', () => {
      const cycles = [
        createCycle('2024-01-01', [], 14, true, 28),
        createCycle('2024-02-01', [], 14, true, 30),
        createCycle('2024-03-01', [], 14, true, 26),
      ];
      const stats = calculateCycleStats(cycles);
      expect(stats.averageCycleLength).toBe(28); // (28+30+26)/3 = 28
    });

    it('should calculate average Peak day', () => {
      const cycles = [
        createCycle('2024-01-01', [], 14, true, 28),
        createCycle('2024-02-01', [], 16, true, 28),
        createCycle('2024-03-01', [], 15, true, 28),
      ];
      const stats = calculateCycleStats(cycles);
      expect(stats.averagePeakDay).toBe(15); // (14+16+15)/3 = 15
    });

    it('should find earliest Peak in last 6 cycles', () => {
      const cycles = createCompletedCyclesWithPeaks([14, 15, 12, 16, 14, 15]);
      const stats = calculateCycleStats(cycles);
      expect(stats.earliestPeakInLast6).toBe(12);
    });

    it('should track shortest and longest cycles', () => {
      const cycles = [
        createCycle('2024-01-01', [], 14, true, 25),
        createCycle('2024-02-01', [], 14, true, 32),
        createCycle('2024-03-01', [], 14, true, 28),
      ];
      const stats = calculateCycleStats(cycles);
      expect(stats.shortestCycle).toBe(25);
      expect(stats.longestCycle).toBe(32);
    });
  });

  // ==========================================
  // Utility Function Tests
  // ==========================================
  describe('getCycleDay', () => {
    it('should return 1 for the start date', () => {
      const cycle = createCycle('2024-01-15');
      expect(getCycleDay(cycle, '2024-01-15')).toBe(1);
    });

    it('should calculate correct cycle day', () => {
      const cycle = createCycle('2024-01-01');
      expect(getCycleDay(cycle, '2024-01-01')).toBe(1);
      expect(getCycleDay(cycle, '2024-01-06')).toBe(6);
      expect(getCycleDay(cycle, '2024-01-14')).toBe(14);
      expect(getCycleDay(cycle, '2024-01-25')).toBe(25);
    });

    it('should handle Daylight Saving Time (DST) spring forward correctly', () => {
      // In US, March 8, 2026 is DST Spring Forward.
      const cycle = createCycle('2026-03-04');
      // March 4 (CD1), March 5 (CD2), March 6 (CD3), March 7 (CD4)
      // March 8 (CD5 - DST day), March 9 (CD6), March 10 (CD7)
      expect(getCycleDay(cycle, '2026-03-07')).toBe(4);
      expect(getCycleDay(cycle, '2026-03-08')).toBe(5);
      expect(getCycleDay(cycle, '2026-03-09')).toBe(6);
      expect(getCycleDay(cycle, '2026-03-10')).toBe(7);
    });
  });

  describe('calendar date helpers', () => {
    it('should parse ISO dates as local calendar dates', () => {
      const date = parseISODateLocal('2026-03-08');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(2);
      expect(date.getDate()).toBe(8);
    });

    it('should add calendar days across DST without shifting dates', () => {
      expect(addDaysToISO('2026-03-07', 1)).toBe('2026-03-08');
      expect(addDaysToISO('2026-03-08', 1)).toBe('2026-03-09');
      expect(addDaysToISO('2026-03-09', -1)).toBe('2026-03-08');
    });
  });

  describe('getTodayISO', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = getTodayISO();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate non-empty strings', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Edge Case Tests
  // ==========================================
  describe('Edge Cases', () => {
    it('should handle cycle with no logs', () => {
      const cycle = createCycle('2024-01-01');
      const result = calculateFertilityStatus(cycle, 10, [], false);
      expect(result.status).toBe('fertile');
    });

    it('should handle Peak on very early day', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 8, reading: 'peak' },
      ], 8);

      // Peak CD8, auto-Peak CD9, wait CD10,11,12, safe CD13
      expect(calculateFertilityStatus(cycle, 12, [], false).status).toBe('fertile');
      expect(calculateFertilityStatus(cycle, 13, [], false).status).toBe('infertile');
    });

    it('should handle Peak on late day (CD20+)', () => {
      const cycle = createCycle('2024-01-01', [
        { cycleDay: 22, reading: 'peak' },
      ], 22);

      // Peak CD22, auto-Peak CD23, wait CD24,25,26, safe CD27
      expect(calculateFertilityStatus(cycle, 26, [], false).status).toBe('fertile');
      expect(calculateFertilityStatus(cycle, 27, [], false).status).toBe('infertile');
    });
  });
});
