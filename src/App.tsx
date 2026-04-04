/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc, setDoc, FirebaseUser, googleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from './types';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { isSuperAdmin } from './constants';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
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
              handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`);
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
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
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
          <p className="text-xl font-mono tracking-widest uppercase">Initializing REY-COMMAND...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100 selection:bg-emerald-500/30">
      <AnimatePresence mode="wait">
        {!user ? (
          <Login onLogin={handleLogin} isLoading={loginLoading} />
        ) : (
          profile && <Dashboard user={user} profile={profile} onLogout={handleLogout} />
        )}
      </AnimatePresence>
    </div>
  );
}

