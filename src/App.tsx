/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc, getDocFromServer, setDoc, FirebaseUser, googleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType, enableNetwork, disableNetwork, onSnapshot } from './firebase';
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
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Initializing...');
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthResolved(true);
      
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        return;
      }

      // If we already have this user and profile, don't restart subscription
      if (user?.uid === firebaseUser.uid && profile) {
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      setConnectionStatus('Establishing secure connection...');
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      
      if (unsubscribeProfile) unsubscribeProfile();

      // Use a one-time get first to handle initial profile creation more reliably
      try {
        const initialSnap = await getDoc(userDocRef);
        if (!initialSnap.exists()) {
          setConnectionStatus('Initializing new user profile...');
          const isOwner = isSuperAdmin(firebaseUser.email);
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'New User',
            email: firebaseUser.email || '',
            role: isOwner ? 'Super Admin' : 'Supervisor',
            roles: [isOwner ? 'Super Admin' : 'Supervisor'],
            projects: [],
          };
          await setDoc(userDocRef, newProfile);
        }
      } catch (err: any) {
        console.error('Initial profile check failed:', err);
        // If it's a permission error, it might be because the doc doesn't exist yet
        // and rules are strict, but our rules should allow this.
        // We'll continue to the snapshot listener which might have better luck
      }

      // Now set up the real-time listener
      unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          
          // Ensure roles array exists (migration)
          if (!data.roles && data.role) {
            const updatedRoles = [data.role];
            setDoc(userDocRef, { roles: updatedRoles }, { merge: true }).catch(console.error);
            data.roles = updatedRoles;
          }
          
          setProfile(data);
          setError(null);
          setLoading(false);
        } else {
          // This shouldn't happen often after the initial getDoc/setDoc
          setConnectionStatus('Waiting for profile data...');
        }
      }, (err) => {
        console.error('Profile snapshot error:', err);
        const errStr = err.message?.toLowerCase() || '';
        
        if (errStr.includes('permission-denied')) {
          setError(`ACCESS DENIED: Your account (${firebaseUser.email}) does not have permission to access its profile. Please contact an administrator.`);
          setLoading(false);
        } else if (!profile) {
          setConnectionStatus('Syncing profile...');
          // Don't set hard error yet, let the timeout handle it
        }
      });

      // Safety timeout
      const timeoutId = setTimeout(() => {
        if (!profile && !error) {
          if (!navigator.onLine) {
            setConnectionStatus('System Offline. Waiting for internet...');
          } else {
            setError("AUTHENTICATION TIMEOUT: The system is taking too long to sync your profile. This usually happens due to network issues or if the database is initializing. Please try refreshing or signing out.");
            setLoading(false);
          }
        }
      }, 15000); // 15 seconds is plenty for a healthy connection

      return () => clearTimeout(timeoutId);
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [user?.uid]); // Only depend on user.uid to avoid loops

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.code === 'auth/unauthorized-domain') {
        setError(`UNAUTHORIZED DOMAIN: The domain "${window.location.hostname}" is not authorized in your Firebase Console. Please add it to Authentication > Settings > Authorized domains.`);
      } else if (error.code === 'auth/popup-blocked') {
        setError("POPUP BLOCKED: Please enable popups for this site to authenticate.");
      } else if (error.code !== 'auth/cancelled-popup-request') {
        setError(`Authentication Error: ${error.message}`);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      setLoading(true);
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setError(null);
    setLoading(true);
    setConnectionStatus('Manual reconnecting...');
    try {
      await disableNetwork(db);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await enableNetwork(db);
      // Force a re-fetch of the profile
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDocFromServer(userDocRef);
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() } as UserProfile);
          setLoading(false);
        } else {
          setError("Profile not found after reconnect. Please try signing out and in again.");
          setLoading(false);
        }
      }
    } catch (err: any) {
      setError(`Manual Reconnect Failed: ${err.message}`);
      setLoading(false);
    }
  };

  if (loading || !isAuthResolved) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-neutral-950 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-sm px-6"
        >
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight uppercase font-mono">REY-COMMAND</h2>
            <div className="flex flex-col gap-1">
              <p className="text-emerald-500 font-mono text-sm uppercase tracking-widest animate-pulse">
                {connectionStatus}
              </p>
              <p className="text-neutral-500 font-mono text-[10px] uppercase tracking-tighter">
                Verifying secure connection to Firestore
              </p>
            </div>
          </div>
          
          <div className="pt-4 flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
            >
              STUCK? RELOAD SYSTEM
            </button>
            {user && (
              <button
                onClick={handleLogout}
                className="w-full py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-mono text-red-400 hover:bg-red-500/20 transition-colors"
              >
                RESET SESSION (SIGN OUT)
              </button>
            )}
          </div>
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
                <h2 className="text-xl font-bold text-white">System Alert</h2>
                <div className="p-4 bg-black/40 rounded-xl border border-white/5 text-left space-y-3">
                  <p className="text-xs text-red-400 font-mono break-words leading-relaxed">
                    <span className="text-white/40 mr-2">[ERROR]</span>
                    {error}
                  </p>
                  
                  {error?.includes('UNAUTHORIZED DOMAIN') && (
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Required Action:</p>
                      <ol className="text-[10px] text-neutral-400 space-y-1 list-decimal ml-4">
                        <li>Go to Firebase Console</li>
                        <li>Authentication &gt; Settings &gt; Authorized domains</li>
                        <li>Add <span className="text-white font-mono">{window.location.hostname}</span></li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.href = window.location.href}
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors"
                >
                  HARD REFRESH
                </button>
                <button
                  onClick={handleRetry}
                  className="w-full py-3 bg-neutral-800 text-white font-bold rounded-xl hover:bg-neutral-700 transition-colors"
                >
                  RETRY CONNECTION
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 bg-neutral-900 text-neutral-400 font-bold rounded-xl hover:text-white transition-colors"
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

