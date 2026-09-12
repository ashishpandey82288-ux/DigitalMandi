// ==============================================================================
// KisanFlow — Protected Route & Role-Based UX Gate
// Redirects unauthenticated users and presents clear feedback for unauthorized roles
// ==============================================================================

import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { UserRole } from '../../../../../packages/types/src/index.ts';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-neutral-500 font-medium">Verifying security credentials...</p>
      </div>
    );
  }

  // 1. Unauthenticated -> Redirect to Login with return path
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role Check (Frontend UX protection)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card title="Unauthorized Access Attempt">
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900">Access Restricted by Role</h3>
              <p className="text-xs text-neutral-600">
                Your account holds role <span className="font-semibold text-neutral-900">{user.role}</span>.
                This portal requires one of: <span className="font-mono text-emerald-700 font-semibold">{allowedRoles.join(', ')}</span>.
              </p>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg text-left text-xs space-y-1 text-neutral-600 border border-neutral-200">
              <div className="font-semibold text-neutral-800">Security Architecture Notice:</div>
              <p className="text-[11px] text-neutral-500">
                In DigitalMandi, frontend guards provide guided user experience, while backend API endpoints strictly
                enforce cryptographic ID token and PostgreSQL RBAC checks (<code className="font-mono">requireRole</code>).
              </p>

            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Link to="/">
                <Button variant="secondary" size="sm">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Return to Home</span>
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="primary" size="sm">
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  <span>Switch Account / Role</span>
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
