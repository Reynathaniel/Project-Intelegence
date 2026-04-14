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

// Check if Firebase is properly configured
export const isFirebaseConfigured = !!firebaseConfigFromJson.apiKey && firebaseConfigFromJson.apiKey.startsWith("AIza");

const firebaseConfig = {
  apiKey: isFirebaseConfigured ? firebaseConfigFromJson.apiKey : "AIza-BYPASS-MODE-PLACEHOLDER",
  authDomain: firebaseConfigFromJson.authDomain || "bypass.firebaseapp.com",
  projectId: firebaseConfigFromJson.projectId || "bypass-project",
  storageBucket: firebaseConfigFromJson.storageBucket || "bypass.appspot.com",
  messagingSenderId: firebaseConfigFromJson.messagingSenderId || "123456789",
  appId: firebaseConfigFromJson.appId || "1:123456789:web:bypass",
  measurementId: firebaseConfigFromJson.measurementId,
  firestoreDatabaseId: sanitizedDatabaseId
};

// Use the prioritized config
const app = initializeApp(firebaseConfig);

if (!isFirebaseConfigured) {
  console.warn('--- SYSTEM WARNING ---');
  console.warn('Firebase API Key is missing. Application is running in OFFLINE/BYPASS mode.');
  console.warn('----------------------');
} else if (import.meta.env.DEV || window.location.hostname.includes('vercel.app') || !window.location.hostname.includes('localhost')) {
  console.log('--- SYSTEM DIAGNOSTICS ---');
  console.log('Current Domain:', window.location.hostname);
  console.log('Firebase Project ID:', firebaseConfig.projectId);
  console.log('Firebase App ID:', firebaseConfig.appId);
  console.log('Messaging Sender ID:', firebaseConfig.messagingSenderId);
  console.log('Auth Domain:', firebaseConfig.authDomain);
  console.log('API Key (First 10):', firebaseConfig.apiKey?.substring(0, 10) + '...');
  console.log('Firestore DB ID:', firebaseConfig.firestoreDatabaseId);
  if (rawDatabaseId !== sanitizedDatabaseId) {
    console.warn('WARNING: Detected invalid Database URL in config. Sanitized to ID.');
  }
  console.log('--------------------------');
}

// Initialize Firestore with robust settings and fallback
const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
}, dbId);

// Test connection to Firestore with retry logic and fallback attempt
export async function testConnection(retries = 3) {
  if (!isFirebaseConfigured) return { success: false, error: 'Firebase not configured' };
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  
  for (let i = 0; i < retries; i++) {
    try {
      // Attempt to get a document from the 'test' collection which is allowed by rules
      const testDoc = doc(db, 'test', 'connection');
      await getDocFromServer(testDoc);
      
      if (import.meta.env.DEV) console.log('Firestore: Connection verified successfully');
      return { success: true, error: null };
    } catch (error: any) {
      console.warn(`Firestore Connection Attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        return { success: false, error: error.message };
      }

      const delay = Math.pow(2, i + 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return { success: false, error: 'Unknown connection error' };
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
