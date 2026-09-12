// ==============================================================================
// KisanFlow — Frontend AuthContext Re-export
// Supports both @/auth/AuthContext and @/context/AuthContext import conventions
// ==============================================================================

export {
  AuthProvider,
  useAuth,
} from '../context/AuthContext.tsx';
export type { RegisterPayload } from '../context/AuthContext.tsx';
export type { UserRole, UserDTO } from '../../../../packages/types/src/index.ts';
