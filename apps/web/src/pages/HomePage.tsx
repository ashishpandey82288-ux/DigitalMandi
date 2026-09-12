// ==============================================================================
// DigitalMandi — National Agricultural Procurement Platform
// Flagship Public Portal & Citizen/Farmer Entryway
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wheat,
  Calendar,
  ShieldCheck,
  QrCode,
  Scale,
  Camera,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Clock,
  Building2,
  Users,
  Award,
  Sparkles,
  PhoneCall,
  ChevronRight,
  FileCheck2,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { fetchHealthStatus, HealthData } from '../services/healthService.ts';

export const HomePage: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    fetchHealthStatus()
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  const journeySteps = [
    {
      step: '01',
      icon: Users,
      title: 'Farmer Enrollment',
      desc: 'Quick registration with Aadhaar hash, verified land records, and direct bank account details.',
      highlight: 'Aadhaar & Land Verified',
    },
    {
      step: '02',
      icon: Calendar,
      title: 'Guaranteed Slot Booking',
      desc: 'Select your preferred mandi center and convenient 90-minute arrival slot with official MSP lock.',
      highlight: 'Zero Mandi Queue',
    },
    {
      step: '03',
      icon: QrCode,
      title: 'Digital Gate Pass',
      desc: 'Receive an encrypted QR gate pass on your phone with instant vehicle check-in upon arrival.',
      highlight: 'Instant Gate Check-in',
    },
    {
      step: '04',
      icon: Camera,
      title: 'AI Quality Grading',
      desc: 'Computer vision camera analyzes crop moisture, grain size, and defect rate without human bias.',
      highlight: 'Unbiased AI Inspection',
    },
    {
      step: '05',
      icon: Scale,
      title: 'Automated Weighbridge',
      desc: 'Precision digital weighment captures gross and tare weights directly into the tamper-proof ledger.',
      highlight: 'Calibrated Precision',
    },
    {
      step: '06',
      icon: CreditCard,
      title: 'Direct DBT Settlement',
      desc: 'Funds are directly transferred into the farmer bank account via PFMS at the guaranteed MSP.',
      highlight: 'Instant Bank Payout',
    },
  ];

  const platformPillars = [
    {
      icon: TrendingUp,
      title: 'Transparent MSP Pricing',
      desc: 'Government-mandated Minimum Support Price locked at booking time. Eliminates distress sales and price volatility.',
      badge: 'Price Benchmark',
    },
    {
      icon: Clock,
      title: 'Scheduled Procurement Slots',
      desc: 'Predictive virtual slot scheduling prevents long physical truck queues outside mandi yards, saving fuel and time.',
      badge: 'Queue Optimization',
    },
    {
      icon: Sparkles,
      title: 'Transparent AI Quality Analysis',
      desc: 'High-resolution imaging and machine learning grade agricultural produce objectively, preventing arbitrary deductions.',
      badge: 'Objective Grading',
    },
    {
      icon: ShieldCheck,
      title: 'Cryptographic Audit Ledger',
      desc: 'Every booking, inspection, weighment, and payment is recorded in an immutable append-only hash chain for complete auditability.',
      badge: 'Tamper-Evident',
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 pb-8">
      {/* Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white p-8 sm:p-12 lg:p-16 overflow-hidden shadow-xl border border-emerald-800/40">
        {/* Background decorative styling */}
        <div className="absolute inset-0 bg-grid-pattern opacity-15 pointer-events-none" />
        <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          {/* National Trust Pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-900/90 border border-emerald-600/50 text-emerald-200 text-xs font-semibold mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>National Agricultural Procurement Initiative</span>
            <span className="text-emerald-400">•</span>
            <span className="text-amber-300 font-bold">Transparent MSP Pricing</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight sm:leading-tight">
            Fair Pricing & Transparent Procurement for Every Indian Farmer.
          </h1>

          <p className="mt-5 text-emerald-100/90 text-sm sm:text-lg leading-relaxed max-w-2xl font-normal">
            DigitalMandi modernizes agricultural procurement with official Minimum Support Prices, AI-driven quality grading, scheduled mandi arrival slots, and direct digital bank settlement tracking.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link to="/farmer">
              <Button
                variant="accent"
                size="lg"
                className="font-bold text-neutral-950 shadow-md hover:scale-[1.02] transition-transform"
              >
                <span>Enter Farmer Portal</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>

            <Link to="/center">
              <Button
                variant="outline"
                size="lg"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm"
              >
                <Building2 className="w-4 h-4 mr-1.5 text-emerald-300" />
                <span>Mandi Center Operations</span>
              </Button>
            </Link>

            <Link to="/register">
              <Button
                variant="ghost"
                size="lg"
                className="text-emerald-200 hover:text-white hover:bg-emerald-800/60"
              >
                <span>New Farmer Registration</span>
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </Link>
          </div>

          {/* Key Value Metrics Bar */}
          <div className="mt-10 pt-8 border-t border-emerald-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <div className="text-base sm:text-lg font-bold text-amber-300 tracking-tight">Transparent</div>
              <div className="text-xs text-emerald-200/80 mt-0.5 font-medium">MSP Pricing</div>
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-white tracking-tight">Scheduled</div>
              <div className="text-xs text-emerald-200/80 mt-0.5 font-medium">Procurement Slots</div>
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-white tracking-tight">Direct DBT</div>
              <div className="text-xs text-emerald-200/80 mt-0.5 font-medium">Settlement Tracking</div>
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-amber-300 tracking-tight">Zero Intermediary</div>
              <div className="text-xs text-emerald-200/80 mt-0.5 font-medium">Distortion</div>
            </div>
          </div>
        </div>
      </div>


      {/* Primary Highlights Bar / Live Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-neutral-900">Current Kharif & Rabi Procurement Season</h4>
            <p className="text-xs text-neutral-500">
              Procurement centers operating across all registered districts with active slot allocation.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 shrink-0 w-full md:w-auto">
          <Link to="/farmer" className="w-full md:w-auto">
            <Button variant="primary" size="sm" className="w-full md:w-auto">
              <span>View Active Crop Rates</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* End-to-End Procurement Lifecycle (User-centric 6-step Journey) */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Seamless Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            How DigitalMandi Works for Farmers
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            From initial registration to direct bank payout, every step is streamlined, transparent, and verified.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {journeySteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="group p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-neutral-400 group-hover:text-emerald-700 transition-colors">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-neutral-900 group-hover:text-emerald-800 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  <span>{step.highlight}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform Pillars / Benefits Section */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Why DigitalMandi
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
            Transforming Agricultural Commerce
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            Engineered to eliminate systemic inefficiencies, eliminate exploitative commission practices, and protect farmer income.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {platformPillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:border-neutral-300 transition-all flex items-start space-x-4"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-neutral-900">{pillar.title}</h3>
                    <Badge variant="accent">{pillar.badge}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">{pillar.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role Portal Quick Access Cards */}
      <div className="p-8 sm:p-10 rounded-3xl bg-neutral-100/80 border border-neutral-200/90 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
              Select Your Operational Portal
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Secure role-isolated interfaces tailored for Farmers, Mandi Operators, and Government Inspectors.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-lg border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
            <span>Role-Based Security Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Farmer Portal Card */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Wheat className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Farmer Portal</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Register farms, schedule 90-minute mandi slots, check live MSP rates, download QR gate passes, and track bank transfers.
              </p>
            </div>
            <Link to="/farmer" className="mt-5">
              <Button variant="primary" size="sm" className="w-full">
                <span>Open Farmer Portal</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Mandi Center Operator Card */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-700" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Mandi Operator</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Scan arrival gate passes, route arrivals to bays, conduct computer vision inspection, record weighment, and dispatch logistics.
              </p>
            </div>
            <Link to="/center" className="mt-5">
              <Button variant="outline" size="sm" className="w-full">
                <span>Enter Mandi Center</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Government Oversight Card */}
          <div className="p-5 bg-white rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Govt Oversight</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Monitor state-wide procurement quotas, inspect DBT payment queues, audit tamper-evident hash chains, and generate reports.
              </p>
            </div>
            <Link to="/admin" className="mt-5">
              <Button variant="outline" size="sm" className="w-full">
                <span>Oversight Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Citizen Helpline & Assistance Section */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-950 text-white flex flex-col sm:flex-row items-center justify-between gap-6 border border-emerald-800 shadow-sm">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center space-x-2 text-amber-300 text-xs font-semibold">
            <PhoneCall className="w-4 h-4" />
            <span>Dedicated Kisan Support Helpline</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
            Need Assistance with Slot Booking or Payment Status?
          </h3>
          <p className="text-xs sm:text-sm text-emerald-200/90 max-w-xl">
            Dial toll-free 1800-180-1551 to speak with an agricultural procurement specialist in your regional language.
          </p>
        </div>
        <div className="shrink-0 flex items-center space-x-3">
          <Link to="/register">
            <Button variant="accent" size="md" className="font-bold text-neutral-950">
              <span>Register Online</span>
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="md" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <span>Sign In</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

