import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDoc, getDocs, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocFromServer, increment, arrayUnion, orderBy, limit } from 'firebase/firestore';
import firebaseConfigFromJson from '../firebase-applet-config.json';

// Helper to get config value with fallback
const getConfigValue = (key: string, jsonVal: string) => {
  const envVal = import.meta.env[key];
  if (envVal && typeof envVal === 'string' && envVal.trim() !== '') {
    return envVal;
  }
  return jsonVal;
};

// Support environment variables for Vercel deployment
const firebaseConfig = {
  apiKey: getConfigValue('VITE_FIREBASE_API_KEY', firebaseConfigFromJson.apiKey),
  authDomain: getConfigValue('VITE_FIREBASE_AUTH_DOMAIN', firebaseConfigFromJson.authDomain),
  projectId: getConfigValue('VITE_FIREBASE_PROJECT_ID', firebaseConfigFromJson.projectId),
  storageBucket: getConfigValue('VITE_FIREBASE_STORAGE_BUCKET', firebaseConfigFromJson.storageBucket),
  messagingSenderId: getConfigValue('VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseConfigFromJson.messagingSenderId),
  appId: getConfigValue('VITE_FIREBASE_APP_ID', firebaseConfigFromJson.appId),
  measurementId: getConfigValue('VITE_FIREBASE_MEASUREMENT_ID', firebaseConfigFromJson.measurementId),
  firestoreDatabaseId: getConfigValue('VITE_FIREBASE_DATABASE_ID', firebaseConfigFromJson.firestoreDatabaseId)
};

if (import.meta.env.DEV) {
  console.log('Firebase Initialization:', {
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    authDomain: firebaseConfig.authDomain,
    hasApiKey: !!firebaseConfig.apiKey,
    appId: firebaseConfig.appId
  });
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with memory cache and long polling to avoid IndexedDB/WebSocket issues in iframes
const dbId = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' && firebaseConfig.firestoreDatabaseId !== '') 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true
}, dbId);

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

// Test connection
async function testConnection() {
  if (import.meta.env.DEV) {
    console.log('Testing Firestore connection...');
  }
  try {
    // Try to get a document from the server to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    if (import.meta.env.DEV) {
      console.log('Firestore connection test: SUCCESS');
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.error("Firestore Error: Client is offline. This usually means the connection was blocked or the database ID is incorrect.");
      } else if (error.message.includes('permission-denied')) {
        // Permission denied is actually a good sign - it means we reached the server!
        if (import.meta.env.DEV) {
          console.log('Firestore connection test: REACHED SERVER (Permission Denied as expected)');
        }
      } else {
        console.error("Firestore connection test: FAILED", error.message);
      }
    }
  }
}
testConnection();

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
  increment,
  arrayUnion,
  orderBy,
  limit
};
export type { FirebaseUser };
