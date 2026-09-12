// ==============================================================================
// KisanFlow — Backend Firebase Configuration Export
// Re-exports Firebase Admin client & Token Verification
// ==============================================================================

export {
  getFirebaseAdmin,
  verifyFirebaseToken,
  type DecodedAuthToken,
} from './firebaseAdmin.ts';
