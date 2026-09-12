// ==============================================================================
// KisanFlow — Unified Authentication & Role State Context
// Handles Firebase Authentication, Token Refresh & Role Synchronization
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, IS_DEMO_MODE } from '../config/firebase.ts';
import { UserRole, UserDTO } from '../../../../packages/types/src/index.ts';

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  district?: string;
  state?: string;
}

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  loginAsDemoUser: (role: UserRole) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'kisanflow_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [loading, setLoading] = useState<boolean>(true);

  // Syncs user profile from Express backend /api/auth/me
  const fetchUserProfile = useCallback(async (authToken: string): Promise<UserDTO | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      if (data.success && data.data?.user) {
        setUser(data.data.user);
        return data.data.user;
      }
    } catch (err) {
      console.warn('Unable to resolve backend user session:', err);
    }
    return null;
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        const profile = await fetchUserProfile(storedToken);
        if (!profile && isMounted) {
          // Stored token was invalid or expired
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
      }

      // Listen to Firebase client auth state changes
      try {
        onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
          if (!isMounted) return;

          if (fbUser) {
            try {
              const idToken = await fbUser.getIdToken();
              localStorage.setItem(TOKEN_STORAGE_KEY, idToken);
              setToken(idToken);

              // Sync with backend to ensure PostgreSQL record and role resolution
              const syncRes = await fetch('/api/auth/sync', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${idToken}`,
                  'Content-Type': 'application/json',
                },
              });

              if (syncRes.ok) {
                const syncData = await syncRes.json();
                if (syncData.success && syncData.data?.user) {
                  setUser(syncData.data.user);
                }
              }
            } catch (error) {
              console.error('Error synchronizing Firebase user:', error);
            }
          }
          setLoading(false);
        });
      } catch {
        setLoading(false);
      }

      if (isMounted) setLoading(false);
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [fetchUserProfile]);

  // Standard Email / Password Sign In
  const login = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    try {
      // In DEMO_MODE, if email matches demo pattern, use demo login endpoint directly
      if (IS_DEMO_MODE && email.includes('@kisanflow.local')) {
        let role: UserRole = 'FARMER';
        if (email.includes('operator')) role = 'CENTER_OPERATOR';
        else if (email.includes('inspector')) role = 'QUALITY_INSPECTOR';
        else if (email.includes('superadmin')) role = 'SUPER_ADMIN';
        else if (email.includes('admin')) role = 'GOVERNMENT_ADMIN';

        await loginAsDemoUser(role);
        return;
      }

      // Live Firebase Sign-in
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await cred.user.getIdToken();

      localStorage.setItem(TOKEN_STORAGE_KEY, idToken);
      setToken(idToken);

      const profile = await fetchUserProfile(idToken);
      if (!profile) {
        throw new Error('Authentication succeeded but user profile was not found.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Farmer Self-Registration
  const register = async (payload: RegisterPayload): Promise<void> => {
    setLoading(true);
    try {
      // Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      const idToken = await cred.user.getIdToken();

      localStorage.setItem(TOKEN_STORAGE_KEY, idToken);
      setToken(idToken);

      // Call backend to initialize PostgreSQL user (strictly role FARMER)
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to initialize application profile');
      }

      const syncData = await res.json();
      if (syncData.success && syncData.data?.user) {
        setUser(syncData.data.user);
      }
    } finally {
      setLoading(false);
    }
  };

  // One-Click Demo Mode Switcher for SIH presentation
  const loginAsDemoUser = async (role: UserRole): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        throw new Error('Demo authentication failed');
      }

      const data = await res.json();
      if (data.success && data.data?.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign out cleanly
  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Best effort
        }
      }

      try {
        await firebaseSignOut(auth);
      } catch {
        // Ignored
      }

      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserProfile = async () => {
    if (token) {
      await fetchUserProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        loginAsDemoUser,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
