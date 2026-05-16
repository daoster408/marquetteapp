import { AppSettings, CloudUser, CloudWorkspaceData, CoupleMember, Cycle, MigrationSnapshot, SharedAppSettings } from '../../types';

export interface AuthCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface CloudRepository {
  isConfigured(): boolean;
  isGoogleSignInConfigured(): boolean;
  subscribeToAuth(onChange: (user: CloudUser | null) => void): () => void;
  signInWithEmail(credentials: AuthCredentials): Promise<void>;
  signUpWithEmail(credentials: AuthCredentials): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  getUserProfile(uid: string): Promise<CloudUser | null>;
  subscribeToWorkspace(coupleId: string, onChange: (data: CloudWorkspaceData) => void, onError: (error: Error) => void): () => void;
  createWorkspace(owner: CloudUser, settings: AppSettings): Promise<string>;
  uploadMigration(coupleId: string, user: CloudUser, snapshot: MigrationSnapshot): Promise<void>;
  updateSharedSettings(coupleId: string, user: CloudUser, settings: Partial<SharedAppSettings>): Promise<void>;
  saveCycle(coupleId: string, user: CloudUser, cycle: Cycle): Promise<void>;
  deleteCycle(coupleId: string, cycleId: string): Promise<void>;
  createInviteCode(coupleId: string, owner: CloudUser): Promise<string>;
  joinWorkspaceWithInvite(user: CloudUser, inviteCode: string): Promise<string>;
  removeMember(coupleId: string, owner: CloudUser, memberUid: string): Promise<void>;
  deleteWorkspace(coupleId: string, owner: CloudUser): Promise<void>;
}

export function getActiveMember(members: CoupleMember[], uid: string | undefined): CoupleMember | null {
  if (!uid) return null;
  return members.find(member => member.uid === uid && !member.removedAt) || null;
}

export function isOwner(members: CoupleMember[], uid: string | undefined): boolean {
  return getActiveMember(members, uid)?.role === 'owner';
}
