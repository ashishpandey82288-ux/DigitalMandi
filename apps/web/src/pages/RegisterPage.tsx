// ==============================================================================
// KisanFlow — Farmer Enrollment & Self-Registration Portal
// Strict Enforcement: Self-Registration is restricted solely to role FARMER
// ==============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Sprout, Lock, Mail, User, Phone, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { useAuth } from '../context/AuthContext.tsx';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Please provide a valid email address'),
    phone: z
      .string()
      .min(10, 'Phone number must be at least 10 digits')
      .regex(/^\+?[0-9\s-]+$/, 'Invalid phone number format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
    district: z.string().min(2, 'District is required'),
    state: z.string().min(2, 'State is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    district: '',
    state: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[e.target.name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!errs[path]) errs[path] = issue.message;
      });
      setFieldErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        district: formData.district,
        state: formData.state,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/farmer');
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('auth/email-already-in-use')) {
        setSubmitError('An account with this email address already exists. Please sign in.');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card title="Registration Successful">
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">Welcome to KisanFlow!</h3>
            <p className="text-xs text-neutral-600 max-w-xs mx-auto">
              Your farmer profile and secure credentials have been provisioned with default role <span className="font-semibold text-emerald-800">FARMER</span>.
            </p>
            <p className="text-[11px] text-neutral-400">Redirecting to your farmer dashboard...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10 space-y-4">
      <Card
        title="Register as Kisan (Farmer)"
        subtitle="Self-registration is configured exclusively for farmers. Administrative roles are assigned by system governance."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name (as per Aadhaar)</label>
            <div className="relative">
              <input
                type="text"
                name="name"
                placeholder="e.g. Harpreet Singh"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                  fieldErrors.name ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
              />
              <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>
            {fieldErrors.name && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.name}</p>}
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  placeholder="harpreet@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                    fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              </div>
              {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Mobile Number</label>
              <div className="relative">
                <input
                  type="tel"
                  name="phone"
                  placeholder="+91 98123 45601"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                    fieldErrors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              </div>
              {fieldErrors.phone && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phone}</p>}
            </div>
          </div>

          {/* District & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">State</label>
              <div className="relative">
                <input
                  type="text"
                  name="state"
                  placeholder="e.g. Haryana"
                  value={formData.state}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                    fieldErrors.state ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
                <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              </div>
              {fieldErrors.state && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.state}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">District</label>
              <div className="relative">
                <input
                  type="text"
                  name="district"
                  placeholder="e.g. Karnal"
                  value={formData.district}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                    fieldErrors.district ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
                <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              </div>
              {fieldErrors.district && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.district}</p>}
            </div>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                    fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              </div>
              {fieldErrors.password && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pl-9 text-xs rounded-lg border ${
                    fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/20' : 'border-neutral-300'
                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-600">
            <strong>Security Boundary Policy:</strong> Newly enrolled accounts are safely assigned the{' '}
            <span className="font-semibold text-emerald-800">FARMER</span> role by default. Operator and Administrative
            credentials cannot be self-selected.
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enrolling Farmer Account...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-1.5">
                  <Sprout className="w-4 h-4" />
                  <span>Submit Farmer Registration</span>
                </div>
              )}
            </Button>
          </div>

          <div className="text-center text-xs text-neutral-500 pt-1">
            Already registered?{' '}
            <Link to="/login" className="text-emerald-700 font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
