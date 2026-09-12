// ==============================================================================
// KisanFlow — 403 Unauthorized Access Barrier
// Displays role mismatch context and clean navigation back to permitted area
// ==============================================================================

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home, LogIn } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export const UnauthorizedPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 shadow-xl p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neutral-900">Access Restricted</h2>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Your current security role{' '}
            <span className="font-mono font-bold bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">
              {user?.role || 'ANONYMOUS'}
            </span>{' '}
            does not have clearance to view this module.
          </p>
        </div>

        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-left text-xs space-y-1">
          <div className="font-semibold text-neutral-800">Statutory RBAC Boundary:</div>
          <div className="text-[11px] text-neutral-500">
            DigitalMandi enforces strict role isolation between Farmers, Mandi Operators, Quality Inspectors, and Government Regulators to prevent unauthorized manipulation of procurement and DBT ledgers.
          </div>
        </div>


        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center space-x-1.5"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </Button>

          <Link to="/" className="w-full">
            <Button variant="primary" className="w-full flex items-center justify-center space-x-1.5">
              <Home className="w-4 h-4" />
              <span>Return Home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
