// ==============================================================================
// KisanFlow — RoleBasedRoute Component
// Enforces role-level accessibility for specific dashboard views
// ==============================================================================

import React from 'react';
import { ProtectedRoute } from './ProtectedRoute.tsx';
import { UserRole } from '../../../../../packages/types/src/index.ts';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ children, allowedRoles }) => {
  return <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>;
};

export default RoleBasedRoute;
