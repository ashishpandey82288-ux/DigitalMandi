// ==============================================================================
// DigitalMandi — Secure Portal Sign In
// Role-Based Authentication & Authorized Access
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { LogIn, Lock, Mail, AlertCircle, Sparkles, CheckCircle2, Wheat, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
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
        <Card title="Active DigitalMandi Session" accentBorder="emerald">
          <div className="space-y-4 py-2">
            <div className="flex items-center space-x-3 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-neutral-900">{user.name}</div>
                <div className="text-neutral-600">{user.email}</div>
                <div className="mt-1 inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Role: {user.role?.replace('_', ' ')}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  if (user.role === 'FARMER') navigate('/farmer');
                  else if (user.role === 'CENTER_OPERATOR' || user.role === 'QUALITY_INSPECTOR') navigate('/center');
                  else navigate('/admin');
                }}
              >
                <span>Go to Operational Dashboard</span>
              </Button>
              <Button variant="outline" onClick={() => logout()}>
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
      {/* Portal Identification Card */}
      <div className="text-center space-y-2 mb-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-700 text-white shadow-sm border border-emerald-600">
          <Wheat className="w-6 h-6 text-amber-300" />
        </div>
        <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
          Sign In to DigitalMandi
        </h2>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
          National Agricultural Procurement & Direct Minimum Support Price (MSP) Platform
        </p>
      </div>

      <Card accentBorder="emerald">
        <form onSubmit={handleSubmit} className="space-y-4">
          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Registered Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder="farmer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3.5 py-2.5 pl-10 text-sm rounded-lg border ${
                  fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
              />
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            </div>
            {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Account Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3.5 py-2.5 pl-10 text-sm rounded-lg border ${
                  fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
              />
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            </div>
            {fieldErrors.password && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password}</p>}
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" className="w-full py-2.5" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Portal</span>
                </div>
              )}
            </Button>
          </div>

          <div className="text-center text-xs text-neutral-500 pt-2 border-t border-neutral-100">
            First time using DigitalMandi?{' '}
            <Link to="/register" className="text-emerald-700 font-bold hover:underline">
              Register as New Farmer
            </Link>
          </div>
        </form>
      </Card>

      {/* Role Demonstration & Quick Access Drawer */}
      {IS_DEMO_MODE && (
        <div className="p-4 sm:p-5 bg-white border border-neutral-200/90 rounded-2xl shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-neutral-800">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Instant Role Access (Evaluation Accounts)</span>
            </div>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              RBAC Demo
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-normal">
            Switch between authenticated roles to experience role-isolated dashboards:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleDemoSwitch('FARMER')}
              disabled={isSubmitting}
              className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-emerald-900 group-hover:text-emerald-950">🌾 Registered Farmer</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">kisan@digitalmandi.gov.in</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('CENTER_OPERATOR')}
              disabled={isSubmitting}
              className="p-3 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-blue-900 group-hover:text-blue-950">🏢 Mandi Operator</div>
              <div className="text-[11px] text-blue-700 mt-0.5">operator@digitalmandi.gov.in</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('QUALITY_INSPECTOR')}
              disabled={isSubmitting}
              className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-indigo-900 group-hover:text-indigo-950">🔬 Quality Inspector</div>
              <div className="text-[11px] text-indigo-700 mt-0.5">inspector@digitalmandi.gov.in</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('GOVERNMENT_ADMIN')}
              disabled={isSubmitting}
              className="p-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-left transition-colors cursor-pointer group"
            >
              <div className="font-bold text-xs text-purple-900 group-hover:text-purple-950">🏛️ Government Officer</div>
              <div className="text-[11px] text-purple-700 mt-0.5">officer@digitalmandi.gov.in</div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleDemoSwitch('SUPER_ADMIN')}
            disabled={isSubmitting}
            className="w-full p-2.5 text-center rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
          >
            🛡️ National Administrator — admin@digitalmandi.gov.in
          </button>
        </div>
      )}
    </div>
  );
};


