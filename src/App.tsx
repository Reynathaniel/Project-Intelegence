/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc, getDocFromServer, setDoc, FirebaseUser, googleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from './types';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Shield } from 'lucide-react';
import { isSuperAdmin } from './constants';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Add a larger initial delay to allow Firestore network to stabilize
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Load user profile with retry logic for "offline" errors
          let userDoc;
          let retries = 0;
          const maxRetries = 5; // Increased retries
          
          while (retries < maxRetries) {
            try {
              // Use getDocFromServer to force a real network request
              userDoc = await getDocFromServer(doc(db, 'users', firebaseUser.uid));
              break;
            } catch (err: any) {
              if (err.message.includes('offline') && retries < maxRetries - 1) {
                retries++;
                console.warn(`Firestore fetch failed (offline), retrying... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retries));
                continue;
              }
              throw err;
            }
          }
          
          if (userDoc && userDoc.exists()) {
            const data = { id: userDoc.id, ...userDoc.data() } as UserProfile;
            // Migration: Ensure roles array exists
            if (!data.roles) {
              data.roles = [data.role || 'Supervisor'];
              // Update firestore with the new roles array
              await setDoc(doc(db, 'users', firebaseUser.uid), data, { merge: true });
            }
            setProfile(data);
          } else {
            // New user setup
            const isOwner = isSuperAdmin(firebaseUser.email);
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email || '',
              role: isOwner ? 'Super Admin' : 'Supervisor', // Default role
              roles: [isOwner ? 'Super Admin' : 'Supervisor'], // Initialize roles array
              projects: [],
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              setProfile(newProfile);
            } catch (err) {
              const errMessage = err instanceof Error ? err.message : String(err);
              setError(`Failed to create profile: ${errMessage}`);
              console.error('Profile creation error:', err);
            }
          }
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          setError(`Failed to load profile: ${errMessage}`);
          console.error('Profile loading error:', err);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // Ignore cancelled popup request errors as they are usually user-triggered
      if (error.code !== 'auth/cancelled-popup-request') {
        console.error('Login failed:', error);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-neutral-950 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
          <div className="text-center space-y-2">
            <p className="text-xl font-mono tracking-widest uppercase">Initializing REY-COMMAND...</p>
            <p className="text-xs text-neutral-500 font-mono">Verifying secure connection to Firestore</p>
          </div>
          
          {/* Show retry button if loading takes too long */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 10 }}
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
          >
            Connection taking too long? Click to reload
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100 selection:bg-emerald-500/30">
      <AnimatePresence mode="wait">
        {!user ? (
          <Login onLogin={handleLogin} isLoading={loginLoading} />
        ) : error ? (
          <div className="flex items-center justify-center min-h-[100dvh] bg-neutral-950 p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md p-8 border border-red-500/20 bg-neutral-900 rounded-2xl text-center space-y-6"
            >
              <div className="p-4 bg-red-500/10 rounded-full w-fit mx-auto border border-red-500/20">
                <Shield className="w-12 h-12 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Connection Error</h2>
                <p className="text-sm text-neutral-400 font-mono break-words">{error}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors"
                >
                  RETRY CONNECTION
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-neutral-700 transition-colors"
                >
                  SIGN OUT
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          profile && <Dashboard user={user} profile={profile} onLogout={handleLogout} />
        )}
      </AnimatePresence>
    </div>
  );
}

