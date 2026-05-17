import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { AppSettings, CloudUser, CloudWorkspaceData, CoupleMember, CoupleWorkspace, Cycle, MigrationSnapshot, SharedAppSettings } from '../../types';
import { normalizeCycleData } from '../../utils/cycleData';
import { createInviteCode as createRawInviteCode, hashInviteSecret, parseInviteCode } from './inviteCodes';
import { getFirebaseServices, isFirebaseConfigured, isGoogleConfigured } from './firebase';
import { AuthCredentials, CloudRepository } from './repository';
import { toSharedSettings } from './migration';
import { dayLogToFirestore } from './serialization';

function timestampToIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value : undefined;
}

function toCloudUser(user: User, profile?: Partial<CloudUser> | null): CloudUser {
  return {
    uid: user.uid,
    displayName: user.displayName || profile?.displayName || null,
    email: user.email || profile?.email || null,
    photoURL: user.photoURL || profile?.photoURL || null,
    activeCoupleId: profile?.activeCoupleId || null,
  };
}

function toMember(uid: string, data: Record<string, any>): CoupleMember {
  return {
    uid,
    role: data.role === 'owner' ? 'owner' : 'member',
    joinedAt: timestampToIso(data.joinedAt),
    invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : undefined,
    removedAt: timestampToIso(data.removedAt) || null,
  };
}

function toCouple(id: string, data: Record<string, any>): CoupleWorkspace {
  return {
    id,
    createdBy: String(data.createdBy || ''),
    createdAt: timestampToIso(data.createdAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    updatedAt: timestampToIso(data.updatedAt),
    deletedAt: timestampToIso(data.deletedAt) || null,
  };
}

function toCycle(id: string, data: Record<string, any>): Cycle {
  return normalizeCycleData({
    id,
    startDate: String(data.startDate),
    endDate: typeof data.endDate === 'string' ? data.endDate : undefined,
    days: Array.isArray(data.days) ? data.days : [],
    peakDay: typeof data.peakDay === 'number' ? data.peakDay : undefined,
    cycleLength: typeof data.cycleLength === 'number' ? data.cycleLength : undefined,
    lutealPhaseLength: typeof data.lutealPhaseLength === 'number' ? data.lutealPhaseLength : undefined,
    isComplete: Boolean(data.isComplete),
  });
}

function cycleToFirestore(cycle: Cycle, uid: string) {
  return {
    id: cycle.id,
    startDate: cycle.startDate,
    endDate: cycle.endDate || null,
    days: cycle.days.map(dayLogToFirestore),
    peakDay: cycle.peakDay || null,
    cycleLength: cycle.cycleLength || null,
    lutealPhaseLength: cycle.lutealPhaseLength || null,
    isComplete: cycle.isComplete,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
}

async function ensureUserProfile(user: User): Promise<CloudUser> {
  const { db } = getFirebaseServices();
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  const existingData = existing.exists() ? (existing.data() as Partial<CloudUser>) : null;

  await setDoc(userRef, {
    uid: user.uid,
    displayName: user.displayName || existingData?.displayName || null,
    email: user.email || existingData?.email || null,
    photoURL: user.photoURL || existingData?.photoURL || null,
    activeCoupleId: existingData?.activeCoupleId || null,
    createdAt: existingData ? (existingData as Record<string, unknown>).createdAt : serverTimestamp(),
    lastSignedInAt: serverTimestamp(),
  }, { merge: true });

  return toCloudUser(user, existingData);
}

export const firestoreCycleRepository: CloudRepository = {
  isConfigured() {
    return isFirebaseConfigured();
  },

  isGoogleSignInConfigured() {
    return isGoogleConfigured();
  },

  subscribeToAuth(onChange) {
    if (!isFirebaseConfigured()) {
      onChange(null);
      return () => undefined;
    }

    const { auth } = getFirebaseServices();
    return onAuthStateChanged(auth, async user => {
      if (!user) {
        onChange(null);
        return;
      }

      const profile = await ensureUserProfile(user);
      onChange(profile);
    });
  },

  async signInWithEmail({ email, password }) {
    const { auth } = getFirebaseServices();
    await signInWithEmailAndPassword(auth, email.trim(), password);
  },

  async signUpWithEmail({ email, password, displayName }) {
    const { auth } = getFirebaseServices();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName?.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    await ensureUserProfile(credential.user);
  },

  async signInWithGoogle() {
    throw new Error('Google sign-in needs Firebase Console OAuth client IDs before it can be enabled in this build.');
  },

  async signOut() {
    const { auth } = getFirebaseServices();
    await firebaseSignOut(auth);
  },

  async getUserProfile(uid) {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (!snapshot.exists()) return null;
    return snapshot.data() as CloudUser;
  },

  subscribeToWorkspace(coupleId, onChange, onError) {
    const { db } = getFirebaseServices();
    let couple: CoupleWorkspace | null = null;
    let cycles: Cycle[] = [];
    let settings: SharedAppSettings = { conservativeMode: false, intention: 'TTA' };
    let members: CoupleMember[] = [];

    const emit = () => onChange({ couple, cycles, settings, members });

    const unsubscribers = [
      onSnapshot(doc(db, 'couples', coupleId), snapshot => {
        couple = snapshot.exists() ? toCouple(snapshot.id, snapshot.data()) : null;
        emit();
      }, onError),
      onSnapshot(query(collection(db, 'couples', coupleId, 'cycles'), orderBy('startDate', 'asc')), snapshot => {
        cycles = snapshot.docs.map(item => toCycle(item.id, item.data()));
        emit();
      }, onError),
      onSnapshot(doc(db, 'couples', coupleId, 'settings', 'app'), snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          settings = {
            conservativeMode: Boolean(data.conservativeMode),
            intention: data.intention === 'TTC' ? 'TTC' : 'TTA',
          };
        }
        emit();
      }, onError),
      onSnapshot(collection(db, 'couples', coupleId, 'members'), snapshot => {
        members = snapshot.docs.map(item => toMember(item.id, item.data()));
        emit();
      }, onError),
    ];

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  },

  async createWorkspace(owner, settings) {
    const { db } = getFirebaseServices();
    const coupleRef = doc(collection(db, 'couples'));
    const batch = writeBatch(db);

    batch.set(coupleRef, {
      createdAt: serverTimestamp(),
      createdBy: owner.uid,
      updatedAt: serverTimestamp(),
      updatedBy: owner.uid,
      deletedAt: null,
    });
    batch.set(doc(coupleRef, 'members', owner.uid), {
      uid: owner.uid,
      role: 'owner',
      joinedAt: serverTimestamp(),
      removedAt: null,
    });
    batch.set(doc(coupleRef, 'settings', 'app'), {
      ...toSharedSettings(settings),
      updatedAt: serverTimestamp(),
      updatedBy: owner.uid,
    });
    batch.set(doc(db, 'users', owner.uid), {
      activeCoupleId: coupleRef.id,
      lastSignedInAt: serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    return coupleRef.id;
  },

  async uploadMigration(coupleId, user, snapshot) {
    const { db } = getFirebaseServices();
    const batch = writeBatch(db);

    snapshot.cycles.forEach(cycle => {
      batch.set(doc(db, 'couples', coupleId, 'cycles', cycle.id), {
        ...cycleToFirestore(cycle, user.uid),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
    });

    batch.set(doc(db, 'couples', coupleId, 'settings', 'app'), {
      ...toSharedSettings(snapshot.settings),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });
    batch.set(doc(db, 'couples', coupleId), {
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });

    await batch.commit();
  },

  async updateSharedSettings(coupleId, user, settings) {
    const { db } = getFirebaseServices();
    await setDoc(doc(db, 'couples', coupleId, 'settings', 'app'), {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });
  },

  async saveCycle(coupleId, user, cycle) {
    const { db } = getFirebaseServices();
    const cycleRef = doc(db, 'couples', coupleId, 'cycles', cycle.id);
    const existing = await getDoc(cycleRef);
    await setDoc(cycleRef, {
      ...cycleToFirestore(cycle, user.uid),
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      createdBy: existing.exists() ? existing.data().createdBy : user.uid,
    }, { merge: true });
    await setDoc(doc(db, 'couples', coupleId), {
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });
  },

  async deleteCycle(coupleId, cycleId) {
    const { db } = getFirebaseServices();
    await deleteDoc(doc(db, 'couples', coupleId, 'cycles', cycleId));
  },

  async createInviteCode(coupleId, owner) {
    const { db } = getFirebaseServices();
    const invite = await createRawInviteCode(coupleId);

    await setDoc(doc(db, 'couples', coupleId, 'inviteCodes', invite.codeId), {
      codeHash: invite.codeHash,
      createdAt: serverTimestamp(),
      createdBy: owner.uid,
      expiresAt: invite.expiresAt,
      usedAt: null,
      usedBy: null,
    });

    return invite.code;
  },

  async joinWorkspaceWithInvite(user, inviteCode) {
    const { db } = getFirebaseServices();
    const parsed = parseInviteCode(inviteCode);
    const codeHash = await hashInviteSecret(parsed.coupleId, parsed.secret);
    const codeId = codeHash.slice(0, 24);
    const inviteRef = doc(db, 'couples', parsed.coupleId, 'inviteCodes', codeId);
    const memberRef = doc(db, 'couples', parsed.coupleId, 'members', user.uid);
    const userRef = doc(db, 'users', user.uid);

    await runTransaction(db, async transaction => {
      const inviteSnapshot = await transaction.get(inviteRef);
      if (!inviteSnapshot.exists()) {
        throw new Error('Invite code was not found.');
      }

      const invite = inviteSnapshot.data();
      const expiresAt = invite.expiresAt instanceof Timestamp ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
      if (invite.codeHash !== codeHash || invite.usedAt || expiresAt.getTime() < Date.now()) {
        throw new Error('Invite code is invalid or expired.');
      }

      const memberSnapshot = await transaction.get(memberRef);
      if (memberSnapshot.exists() && !memberSnapshot.data().removedAt) {
        throw new Error('This account is already a member of the workspace.');
      }

      transaction.set(memberRef, {
        uid: user.uid,
        role: 'member',
        inviteCodeId: codeId,
        joinedAt: serverTimestamp(),
        invitedBy: invite.createdBy,
        removedAt: null,
      });
      transaction.update(inviteRef, {
        usedAt: serverTimestamp(),
        usedBy: user.uid,
      });
      transaction.set(userRef, {
        uid: user.uid,
        displayName: user.displayName || null,
        email: user.email || null,
        photoURL: user.photoURL || null,
        activeCoupleId: parsed.coupleId,
        lastSignedInAt: serverTimestamp(),
      }, { merge: true });
    });

    return parsed.coupleId;
  },

  async removeMember(coupleId, owner, memberUid) {
    if (owner.uid === memberUid) {
      throw new Error('Owners cannot remove themselves. Delete the workspace instead.');
    }

    const { db } = getFirebaseServices();
    await updateDoc(doc(db, 'couples', coupleId, 'members', memberUid), {
      removedAt: serverTimestamp(),
    });
  },

  async deleteWorkspace(coupleId, owner) {
    const { db } = getFirebaseServices();
    const batch = writeBatch(db);
    const cycleSnapshots = await getDocs(collection(db, 'couples', coupleId, 'cycles'));
    const inviteSnapshots = await getDocs(collection(db, 'couples', coupleId, 'inviteCodes'));
    const memberSnapshots = await getDocs(collection(db, 'couples', coupleId, 'members'));

    cycleSnapshots.docs.forEach(snapshot => batch.delete(snapshot.ref));
    inviteSnapshots.docs.forEach(snapshot => batch.delete(snapshot.ref));
    batch.delete(doc(db, 'couples', coupleId, 'settings', 'app'));
    memberSnapshots.docs.forEach(snapshot => {
      batch.update(snapshot.ref, { removedAt: serverTimestamp() });
    });
    batch.update(doc(db, 'couples', coupleId), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: owner.uid,
    });
    await batch.commit();
  },
};
