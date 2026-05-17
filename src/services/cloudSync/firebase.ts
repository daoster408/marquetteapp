import Constants from 'expo-constants';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { parseDogfoodAllowedEmails } from './access';

interface FirebaseExtraConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  androidClientId?: string;
  webClientId?: string;
  dogfoodAllowedEmails?: string;
}

function getExtraConfig(): FirebaseExtraConfig {
  return (Constants.expoConfig?.extra?.firebase || {}) as FirebaseExtraConfig;
}

export function getFirebaseConfig() {
  const extra = getExtraConfig();

  return {
    apiKey: extra.apiKey || '',
    authDomain: extra.authDomain || '',
    projectId: extra.projectId || '',
    storageBucket: extra.storageBucket || '',
    messagingSenderId: extra.messagingSenderId || '',
    appId: extra.appId || '',
  };
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.projectId && config.appId);
}

export function isGoogleConfigured(): boolean {
  const extra = getExtraConfig();
  return Boolean(extra.androidClientId && extra.webClientId);
}

export function isDogfoodBuild(): boolean {
  return Constants.expoConfig?.extra?.appVariant === 'dogfood';
}

export function getDogfoodAllowedEmails(): string[] {
  return parseDogfoodAllowedEmails(getExtraConfig().dogfoodAllowedEmails);
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

export function getFirebaseServices(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured for this build.');
  }

  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  }

  if (!authInstance) {
    authInstance = getAuth(appInstance);
  }

  if (!firestoreInstance) {
    firestoreInstance = getFirestore(appInstance);
  }

  return {
    app: appInstance,
    auth: authInstance,
    db: firestoreInstance,
  };
}
