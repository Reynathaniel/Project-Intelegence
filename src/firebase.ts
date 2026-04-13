import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDoc, getDocs, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocFromServer, increment, arrayUnion, orderBy, limit, enableNetwork, disableNetwork } from 'firebase/firestore';
import firebaseConfigFromJson from '../firebase-applet-config.json';

// Support environment variables for Vercel deployment, fallback to JSON config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFromJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFromJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFromJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFromJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFromJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFromJson.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigFromJson.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigFromJson.firestoreDatabaseId
};

// Use the prioritized config
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
}, dbId);

if (import.meta.env.DEV) {
  console.log('Firestore initialized with Database ID:', dbId || '(default)');
}

// Explicitly enable network
enableNetwork(db).catch(err => {
  console.warn('Firestore: Failed to enable network:', err);
});

if (import.meta.env.DEV) {
  window.addEventListener('online', () => {
    console.log('Browser: Online - Re-enabling Firestore network');
    enableNetwork(db).catch(() => {});
  });
  window.addEventListener('offline', () => console.log('Browser: Offline'));
  console.log('Browser initial status:', navigator.onLine ? 'Online' : 'Offline');
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error handling for Firestore permissions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  getDocFromServer,
  increment,
  arrayUnion,
  orderBy,
  limit,
  enableNetwork,
  disableNetwork
};
export type { FirebaseUser };
