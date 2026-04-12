import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDoc, getDocs, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocFromServer, increment, arrayUnion, orderBy, limit, enableNetwork } from 'firebase/firestore';
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

// Initialize Firestore with memory cache and forced long polling
// We use the default database as a fallback if the named one is not responding
const dbId = undefined; // Force default database for troubleshooting

if (import.meta.env.DEV) {
  console.log('Firestore: Forcing (default) database and long polling for troubleshooting');
}

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
});

// Explicitly enable network to ensure we're not in offline mode
enableNetwork(db).catch(err => console.error('Failed to enable network:', err));

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

// Test connection with a small delay
async function testConnection() {
  // Wait a bit for SDK to settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (import.meta.env.DEV) {
    console.log('Testing Firestore connection...');
  }
  try {
    // Try to get a document from the server to verify connectivity
    const testDocRef = doc(db, 'test', 'connection');
    await getDocFromServer(testDocRef);
    
    if (import.meta.env.DEV) {
      console.log('Firestore connection test: SUCCESS (Read)');
    }

    // Also try a write to be sure (this will fail with permission denied if not authenticated, which is fine)
    try {
      await setDoc(testDocRef, { lastCheck: serverTimestamp() });
      if (import.meta.env.DEV) {
        console.log('Firestore connection test: SUCCESS (Write)');
      }
    } catch (e: any) {
      if (e.message.includes('permission-denied')) {
        if (import.meta.env.DEV) {
          console.log('Firestore connection test: REACHED SERVER (Write Permission Denied as expected)');
        }
      } else {
        throw e;
      }
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
