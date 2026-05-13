import { useCycleStore } from '../store';
import { AppSettings, Cycle } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const defaultSettings: AppSettings = {
  conservativeMode: false,
  notificationsEnabled: true,
  intention: 'TTA',
};

function resetStore(cycles: Cycle[] = [], currentCycleId: string | null = null) {
  useCycleStore.setState({
    cycles,
    currentCycleId,
    settings: defaultSettings,
  });
}

describe('cycle store data integrity', () => {
  beforeEach(() => {
    resetStore();
  });

  it('clears stale peakDay when a Peak log is edited away', () => {
    resetStore([
      {
        id: 'current-cycle',
        startDate: '2026-05-01',
        isComplete: false,
        peakDay: 14,
        days: [
          {
            date: '2026-05-14',
            cycleDay: 14,
            reading: 'peak',
          },
        ],
      },
    ], 'current-cycle');

    useCycleStore.getState().logDayForDate('2026-05-14', 'low');

    const cycle = useCycleStore.getState().cycles[0];
    expect(cycle.peakDay).toBeUndefined();
    expect(cycle.days[0].reading).toBe('low');
  });

  it('records monitor reset on the selected date', () => {
    resetStore([
      {
        id: 'current-cycle',
        startDate: '2026-04-01',
        isComplete: false,
        days: [],
      },
    ], 'current-cycle');

    useCycleStore.getState().markMonitorReset('2026-04-25');

    const resetLog = useCycleStore.getState().cycles[0].days[0];
    expect(resetLog.date).toBe('2026-04-25');
    expect(resetLog.cycleDay).toBe(25);
    expect(resetLog.isMonitorReset).toBe(true);
  });

  it('refuses to start a new cycle on or before the current cycle start', () => {
    resetStore([
      {
        id: 'current-cycle',
        startDate: '2026-05-01',
        isComplete: false,
        days: [],
      },
    ], 'current-cycle');

    useCycleStore.getState().startNewCycle('2026-05-01');
    useCycleStore.getState().startNewCycle('2026-04-30');

    expect(useCycleStore.getState().cycles).toHaveLength(1);
    expect(useCycleStore.getState().currentCycleId).toBe('current-cycle');
  });

  it('refuses to start a future cycle', () => {
    resetStore();

    useCycleStore.getState().startNewCycle('2999-01-01');

    expect(useCycleStore.getState().cycles).toHaveLength(0);
    expect(useCycleStore.getState().currentCycleId).toBeNull();
  });
});
