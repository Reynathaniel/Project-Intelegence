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

if (import.meta.env.DEV) {
  console.log('Firebase Config:', { ...firebaseConfig, apiKey: '***' });
}

// Initialize Firestore
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Test connection to Firestore with retry logic
export async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Attempt to get a document from the 'test' collection which is allowed by rules
      const testDoc = doc(db, 'test', 'connection');
      await getDocFromServer(testDoc);
      if (import.meta.env.DEV) console.log('Firestore: Connection verified');
      return true;
    } catch (error: any) {
      console.warn(`Firestore Connection Attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        console.error("Firestore Connection Test Final Error:", error);
        if (error.message?.includes('the client is offline')) {
          console.error("Firestore Configuration Error: The client is offline. Please check your Firebase configuration and network.");
        }
      } else {
        // Wait before retrying (1s, 2s, 4s)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  return false;
}

// Call test connection on boot with a slight delay to allow network to stabilize
setTimeout(() => testConnection(), 1000);

if (import.meta.env.DEV) {
  console.log('Firestore initialized with Database ID:', firebaseConfig.firestoreDatabaseId || '(default)');
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
