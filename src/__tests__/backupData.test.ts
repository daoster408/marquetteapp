import { parseBackupContent } from '../utils/backupData';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const validBackup = {
  format: 'fidelis.app.backup',
  version: 1,
  exportedAt: '2026-05-07T12:00:00.000Z',
  cycles: [
    {
      id: 'cycle-1',
      startDate: '2026-04-01',
      endDate: '2026-04-28',
      cycleLength: 28,
      peakDay: 14,
      isComplete: true,
      days: [
        {
          date: '2026-04-14',
          cycleDay: 14,
          reading: 'peak',
          notes: 'Peak',
          intercourse: true,
        },
      ],
    },
    {
      id: 'cycle-2',
      startDate: '2026-04-29',
      isComplete: false,
      days: [],
    },
  ],
  currentCycleId: 'cycle-2',
  settings: {
    conservativeMode: true,
    notificationsEnabled: false,
    reminderTime: '07:30',
    intention: 'TTC',
  },
};

describe('backup data', () => {
  it('parses a valid app backup without changing data', () => {
    const parsed = parseBackupContent(JSON.stringify(validBackup));

    expect(parsed.cycles).toHaveLength(2);
    expect(parsed.currentCycleId).toBe('cycle-2');
    expect(parsed.settings).toEqual(validBackup.settings);
    expect(parsed.cycles[0].days[0].reading).toBe('peak');
  });

  it('rejects a backup whose current cycle is not in the cycle list', () => {
    const invalidBackup = {
      ...validBackup,
      currentCycleId: 'missing-cycle',
    };

    expect(() => parseBackupContent(JSON.stringify(invalidBackup))).toThrow(
      'Backup current cycle does not match the cycle list.'
    );
  });

  it('rejects non-Fidelis backup content', () => {
    expect(() => parseBackupContent(JSON.stringify({ cycles: [] }))).toThrow(
      'This does not look like a Fidelis backup file.'
    );
  });
});
