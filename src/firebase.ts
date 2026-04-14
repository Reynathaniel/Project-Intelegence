import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDoc, getDocs, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocFromServer, increment, arrayUnion, orderBy, limit, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfigFromJson from '../firebase-applet-config.json';

// Support environment variables for Vercel deployment, fallback to JSON config
const rawDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigFromJson.firestoreDatabaseId;

// CRITICAL FIX: Ensure databaseId is just the ID string, not a URL
const sanitizedDatabaseId = (rawDatabaseId && rawDatabaseId.includes('https://')) 
  ? firebaseConfigFromJson.firestoreDatabaseId 
  : (rawDatabaseId || firebaseConfigFromJson.firestoreDatabaseId);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFromJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFromJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFromJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFromJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFromJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFromJson.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigFromJson.measurementId,
  firestoreDatabaseId: sanitizedDatabaseId
};

// Use the prioritized config
const app = initializeApp(firebaseConfig);

if (import.meta.env.DEV || window.location.hostname.includes('vercel.app') || !window.location.hostname.includes('localhost')) {
  console.log('--- SYSTEM DIAGNOSTICS ---');
  console.log('Current Domain:', window.location.hostname);
  console.log('Firebase Project:', firebaseConfig.projectId);
  console.log('Auth Domain:', firebaseConfig.authDomain);
  console.log('Firestore DB ID:', firebaseConfig.firestoreDatabaseId);
  if (rawDatabaseId !== sanitizedDatabaseId) {
    console.warn('WARNING: Detected invalid Database URL in config. Sanitized to ID.');
  }
  console.log('--------------------------');
}

// Initialize Firestore with robust settings
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Test connection to Firestore with retry logic
export async function testConnection(retries = 3) {
  if (import.meta.env.DEV) console.log('Firestore: Starting connection test...');
  
  for (let i = 0; i < retries; i++) {
    try {
      // Attempt to get a document from the 'test' collection which is allowed by rules
      const testDoc = doc(db, 'test', 'connection');
      await getDocFromServer(testDoc);
      
      if (import.meta.env.DEV) console.log('Firestore: Connection verified successfully');
      return true;
    } catch (error: any) {
      console.warn(`Firestore Connection Attempt ${i + 1} failed:`, error.message);
      
      if (i < retries - 1) {
        const delay = Math.pow(2, i + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

// Call test connection on boot with a delay to allow the environment to initialize
setTimeout(() => testConnection(), 3000);

if (import.meta.env.DEV) {
  console.log('Firestore initialized with Database ID:', firebaseConfig.firestoreDatabaseId || '(default)');
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

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
  disableNetwork,
  ref,
  uploadBytesResumable,
  getDownloadURL
};
export type { FirebaseUser };
