// ==============================================================================
// KisanFlow — Firebase Admin SDK Initialization (Backend Only)
// Zero-Crash Lazy Initialization with DEMO_MODE Fallback
// ==============================================================================

import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.ts';

let firebaseAdminApp: App | null = null;

export function getFirebaseAdmin(): App | null {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAdminApp = existingApps[0];
    return firebaseAdminApp;
  }

  // Check if Firebase service account or project credentials are provided
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    try {
      const formattedKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      firebaseAdminApp = initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: formattedKey,
        }),
      });

      return firebaseAdminApp;
    } catch (error) {
      console.warn('⚠️ Warning: Failed to initialize Firebase Admin with provided credentials:', error instanceof Error ? error.message : error);
    }
  } else if (env.FIREBASE_PROJECT_ID) {
    try {
      firebaseAdminApp = initializeApp({
        projectId: env.FIREBASE_PROJECT_ID,
      });
      return firebaseAdminApp;
    } catch (error) {
      console.warn('⚠️ Warning: Firebase Admin default init failed:', error instanceof Error ? error.message : error);
    }
  }

  return null;
}

export interface DecodedAuthToken {
  uid: string;
  email?: string;
  phone_number?: string;
  name?: string;
  isDemo?: boolean;
}

/**
 * Verifies a Firebase ID token securely.
 * Supports fallback for DEMO_MODE synthetic test accounts.
 */
export async function verifyFirebaseToken(token: string): Promise<DecodedAuthToken> {
  // 1. In DEMO_MODE, verify synthetic tokens
  if (env.DEMO_MODE && token.startsWith('demo-token-')) {
    const roleKey = token.replace('demo-token-', '');
    const demoMapping: Record<string, DecodedAuthToken> = {
      farmer: {
        uid: 'firebase-demo-farmer-uid',
        email: 'demo.farmer@kisanflow.local',
        name: 'Harpreet Singh (Demo Farmer)',
        phone_number: '+91-9812345601',
        isDemo: true,
      },
      farmer2: {
        uid: 'firebase-demo-farmer2-uid',
        email: 'demo.farmer2@kisanflow.local',
        name: 'Balwinder Singh (Demo Farmer 2)',
        phone_number: '+91-9812345602',
        isDemo: true,
      },
      operator: {
        uid: 'firebase-demo-operator-uid',
        email: 'demo.operator@kisanflow.local',
        name: 'Suresh Verma (Demo Operator)',
        phone_number: '+91-9876543211',
        isDemo: true,
      },
      inspector: {
        uid: 'firebase-demo-inspector-uid',
        email: 'demo.inspector@kisanflow.local',
        name: 'Anjali Sharma (Demo Quality Inspector)',
        phone_number: '+91-9876543212',
        isDemo: true,
      },
      admin: {
        uid: 'firebase-demo-admin-uid',
        email: 'demo.admin@kisanflow.local',
        name: 'Rameshwar Sharma (Demo Govt Admin)',
        phone_number: '+91-9876543210',
        isDemo: true,
      },
      superadmin: {
        uid: 'firebase-demo-superadmin-uid',
        email: 'demo.superadmin@kisanflow.local',
        name: 'Vikramaditya (Demo Super Admin)',
        phone_number: '+91-9876543299',
        isDemo: true,
      },
      inactive: {
        uid: 'firebase-demo-inactive-uid',
        email: 'demo.inactive@kisanflow.local',
        name: 'Inactive User (Disabled Account)',
        phone_number: '+91-9876500000',
        isDemo: true,
      },
    };

    if (demoMapping[roleKey]) {
      return demoMapping[roleKey];
    }
  }

  const app = getFirebaseAdmin();

  // 2. Production Firebase verification
  if (!app) {
    if (env.DEMO_MODE) {
      throw new Error('Firebase Admin SDK is not configured. For demonstration, use a synthetic demo account or provide FIREBASE_* in .env');
    }
    throw new Error('Authentication service unavailable: Firebase Admin SDK is not initialized');
  }

  try {
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      phone_number: decoded.phone_number,
      name: decoded.name,
      isDemo: false,
    };
  } catch (error) {
    throw new Error('Invalid, expired, or revoked authentication token');
  }
}
