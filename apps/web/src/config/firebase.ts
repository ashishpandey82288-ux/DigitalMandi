// ==============================================================================
// KisanFlow — Firebase Client SDK Configuration (Frontend Only)
// Zero-Crash Lazy Initialization with DEMO_MODE Fallback
// ==============================================================================

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoDummyKeyForSIH2026PreviewOnly',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'kisanflow-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kisanflow-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'kisanflow-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
};

let app: FirebaseApp;
let auth: Auth;

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.warn('⚠️ Firebase Client initialization warning:', error);
  // Re-attempt with dummy config
  app = initializeApp(firebaseConfig, 'kisanflow-fallback');
  auth = getAuth(app);
}

export { app, auth };
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';
