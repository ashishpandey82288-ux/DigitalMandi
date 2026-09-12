// ==============================================================================
// KisanFlow — Secure Sign In Portal
// Email & Password Authentication with SIH 2026 Evaluator Quick-Switcher
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { LogIn, Lock, Mail, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../../../../packages/types/src/index.ts';
import { IS_DEMO_MODE } from '../config/firebase.ts';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const LoginPage: React.FC = () => {
  const { login, loginAsDemoUser, user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Return path from ProtectedRoute if redirected
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setFieldErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const formatted = result.error.format();
      setFieldErrors({
        email: formatted.email?._errors[0],
        password: formatted.password?._errors[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      // Navigate to intended page or default role home
      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        setAuthError('Incorrect email or password. Please verify your credentials.');
      } else if (msg.includes('auth/user-not-found')) {
        setAuthError('No account found with this email address. Please register first.');
      } else if (msg.includes('auth/user-disabled')) {
        setAuthError('This account has been deactivated. Please contact the administrator.');
      } else if (msg.includes('network')) {
        setAuthError('Network communication error. Please check your internet connection.');
      } else {
        setAuthError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSwitch = async (role: UserRole) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await loginAsDemoUser(role);
      if (role === 'FARMER') navigate('/farmer');
      else if (role === 'CENTER_OPERATOR' || role === 'QUALITY_INSPECTOR') navigate('/center');
      else navigate('/admin');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Demo switch failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already authenticated
  if (isAuthenticated && user) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card title="Active Session">
          <div className="space-y-4 py-2">
            <div className="flex items-center space-x-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-neutral-900">{user.name}</div>
                <div className="text-neutral-600">{user.email}</div>
                <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Role: {user.role}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  if (user.role === 'FARMER') navigate('/farmer');
                  else if (user.role === 'CENTER_OPERATOR' || user.role === 'QUALITY_INSPECTOR') navigate('/center');
                  else navigate('/admin');
                }}
              >
                <span>Go to Dashboard</span>
              </Button>
              <Button variant="secondary" onClick={() => logout()}>
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 space-y-6">
      <Card
        title="Sign In to KisanFlow"
        subtitle="Secure Identity & Role-Based Access Control Architecture"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                  fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
              />
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>
            {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                  fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
              />
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>
            {fieldErrors.password && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password}</p>}
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-1.5">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In with Credentials</span>
                </div>
              )}
            </Button>
          </div>

          <div className="text-center text-xs text-neutral-500 pt-1">
            Need a farmer account?{' '}
            <Link to="/register" className="text-emerald-700 font-semibold hover:underline">
              Register Farmer Profile
            </Link>
          </div>
        </form>
      </Card>

      {/* SIH 2026 Evaluator Quick Switcher */}
      {IS_DEMO_MODE && (
        <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-neutral-800">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>SIH 2026 Evaluation Demo Accounts</span>
          </div>
          <p className="text-[11px] text-neutral-500">
            Test full RBAC boundaries instantly. Backend verifies cryptographic demo tokens against PostgreSQL role
            records:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoSwitch('FARMER')}
              disabled={isSubmitting}
              className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-left transition-colors"
            >
              <div className="font-bold text-xs text-emerald-900">🌾 Kisan (Farmer)</div>
              <div className="text-[10px] text-emerald-700">demo.farmer@kisanflow.local</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('CENTER_OPERATOR')}
              disabled={isSubmitting}
              className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-left transition-colors"
            >
              <div className="font-bold text-xs text-blue-900">🏢 Center Operator</div>
              <div className="text-[10px] text-blue-700">demo.operator@kisanflow.local</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('QUALITY_INSPECTOR')}
              disabled={isSubmitting}
              className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-left transition-colors"
            >
              <div className="font-bold text-xs text-indigo-900">🔬 Quality Inspector</div>
              <div className="text-[10px] text-indigo-700">demo.inspector@kisanflow.local</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('GOVERNMENT_ADMIN')}
              disabled={isSubmitting}
              className="p-2.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-left transition-colors"
            >
              <div className="font-bold text-xs text-purple-900">🏛️ Govt Admin</div>
              <div className="text-[10px] text-purple-700">demo.admin@kisanflow.local</div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleDemoSwitch('SUPER_ADMIN')}
            disabled={isSubmitting}
            className="w-full p-2 text-center rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-medium text-neutral-700 transition-colors"
          >
            🛡️ Super Admin (National Administrator) — demo.superadmin@kisanflow.local
          </button>
        </div>
      )}
    </div>
  );
};
