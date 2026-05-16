import { createMigrationSnapshot, canUploadMigration, toSharedSettings } from '../services/cloudSync/migration';
import { formatInviteCode, hashInviteSecret, parseInviteCode } from '../services/cloudSync/inviteCodes';
import { getActiveMember, isOwner } from '../services/cloudSync/repository';
import { dayLogToFirestore } from '../services/cloudSync/serialization';
import { AppSettings, CoupleMember, Cycle } from '../types';

const settings: AppSettings = {
  conservativeMode: true,
  notificationsEnabled: true,
  reminderTime: '08:30',
  intention: 'TTC',
};

const localCycle: Cycle = {
  id: 'cycle-1',
  startDate: '2026-05-01',
  isComplete: false,
  days: [
    {
      date: '2026-05-14',
      cycleDay: 14,
      reading: 'peak',
    },
  ],
};

describe('cloud sync migration', () => {
  it('creates a migration snapshot from local cycle data', () => {
    const snapshot = createMigrationSnapshot([localCycle], 'cycle-1', settings);

    expect(snapshot?.cycles).toHaveLength(1);
    expect(snapshot?.currentCycleId).toBe('cycle-1');
    expect(snapshot?.cycles[0].peakDay).toBe(14);
  });

  it('does not create a migration snapshot without local cycles', () => {
    expect(createMigrationSnapshot([], null, settings)).toBeNull();
  });

  it('blocks migration when the cloud workspace already has cycles', () => {
    const snapshot = createMigrationSnapshot([localCycle], 'cycle-1', settings);

    expect(canUploadMigration(snapshot, [localCycle])).toEqual({
      allowed: false,
      reason: 'This workspace already has cloud cycle data. Export a backup before choosing a deliberate merge path.',
    });
  });

  it('keeps reminder settings local when creating shared settings', () => {
    expect(toSharedSettings(settings)).toEqual({
      conservativeMode: true,
      intention: 'TTC',
    });
  });
});

describe('cloud sync roles', () => {
  const members: CoupleMember[] = [
    { uid: 'owner-1', role: 'owner', removedAt: null },
    { uid: 'member-1', role: 'member', removedAt: null },
    { uid: 'removed-1', role: 'member', removedAt: '2026-05-15T12:00:00.000Z' },
  ];

  it('identifies active owners only', () => {
    expect(isOwner(members, 'owner-1')).toBe(true);
    expect(isOwner(members, 'member-1')).toBe(false);
    expect(isOwner(members, 'removed-1')).toBe(false);
  });

  it('ignores removed member records', () => {
    expect(getActiveMember(members, 'removed-1')).toBeNull();
  });
});

describe('cloud sync invite codes', () => {
  it('formats and parses invite codes without changing the couple id case', () => {
    const code = formatInviteCode('MixedCaseCoupleId', 'ABC123');

    expect(parseInviteCode(code)).toEqual({
      coupleId: 'MixedCaseCoupleId',
      secret: 'ABC123',
    });
  });

  it('hashes invite secrets deterministically', async () => {
    await expect(hashInviteSecret('couple-1', 'SECRET')).resolves.toBe(
      await hashInviteSecret('couple-1', 'secret')
    );
  });
});

describe('cloud sync firestore serialization', () => {
  it('does not leave undefined values in day logs before upload', () => {
    const day = {
      date: '2026-05-16',
      cycleDay: 1,
      reading: 'none' as const,
      bleeding: undefined,
      notes: undefined,
      isAutoPeak: false,
    };

    expect(dayLogToFirestore(day)).toEqual({
      date: '2026-05-16',
      cycleDay: 1,
      reading: 'none',
      isAutoPeak: false,
    });
  });
});
