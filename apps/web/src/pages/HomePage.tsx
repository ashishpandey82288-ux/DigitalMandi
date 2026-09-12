// ==============================================================================
// KisanFlow — Home & System Architecture Overview Page (Phase 1 Foundation)
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sprout,
  Calendar,
  Lock,
  QrCode,
  LogIn,
  Layers,
  Scale,
  Camera,
  CreditCard,
  History,
  CheckCircle2,
  RefreshCw,
  Server,
  Database,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { fetchHealthStatus, HealthData } from '../services/healthService.ts';

export const HomePage: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealthStatus(true);
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API connection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const journeySteps = [
    { icon: Sprout, title: '1. Farmer', desc: 'Aadhaar hash, verified land parcel' },
    { icon: Calendar, title: '2. 90-Min Slot', desc: 'Configurable booking slots' },
    { icon: Lock, title: '3. MSP Lock', desc: 'Snapshot official rate at booking' },
    { icon: QrCode, title: '4. QR & PIN', desc: 'Encrypted gate pass generation' },
    { icon: LogIn, title: '5. Gate Check-in', desc: 'Vehicle plate & security log' },
    { icon: Layers, title: '6. Redis Queue', desc: 'Virtual FIFO queue tokening' },
    { icon: Layers, title: '7. Bay Assign', desc: 'Direct allocation to unloading bays' },
    { icon: Camera, title: '8. AI Grading', desc: 'YOLOv8 defect & moisture analysis' },
    { icon: Scale, title: '9. Weighbridge', desc: 'Automated tare & gross weights' },
    { icon: CreditCard, title: '10. DBT Payment', desc: 'Direct PFMS / Bank transfer' },
    { icon: History, title: '11. Audit Ledger', desc: 'Append-only SHA-256 hash chain' },
  ];

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative rounded-2xl bg-gradient-to-b from-emerald-900 to-emerald-950 text-white p-8 sm:p-12 overflow-hidden shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-600/60 text-emerald-200 text-xs font-semibold mb-4">
            <span>Smart India Hackathon 2026</span>
            <span>•</span>
            <span>Phase 6 Full-Stack Production System</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            KisanFlow — Smart Procurement & Direct MSP Engine
          </h1>
          <p className="mt-4 text-emerald-100/90 text-sm sm:text-base leading-relaxed">
            Eliminating mandi distress sales, corrupt intermediaries, and long physical queues through
            AI-driven slot allocation, official <strong>MSP Lock</strong>, virtual queuing, computer vision grading,
            and tamper-evident cryptographic audit logs.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/farmer">
              <Button variant="secondary" size="md" className="font-semibold">
                <span>Farmer Portal</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link to="/center">
              <Button variant="outline" size="md" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                <span>Mandi Operator</span>
              </Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline" size="md" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                <span>Govt Admin</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Subtle decorative grid overlay */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Live System Health Diagnostic Card */}
      <Card
        title="Foundation Health & System Diagnostics"
        subtitle="Live verification of Phase 1 backend Express API, runtime environment, and microservice bridges"
        footer={
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Target Port: 3000 | Host: 0.0.0.0</span>
            <Button size="sm" variant="outline" onClick={checkHealth} isLoading={loading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Ping API</span>
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-600 flex items-center">
                <Server className="w-4 h-4 mr-1.5 text-emerald-600" />
                Express API
              </span>
              <Badge variant={health?.status === 'running' ? 'success' : error ? 'danger' : 'warning'}>
                {health?.status === 'running' ? 'Active' : error ? 'Error' : 'Checking'}
              </Badge>
            </div>
            <p className="text-lg font-bold text-neutral-900">{health?.service || 'KisanFlow API'}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {health?.version || 'v1.0.0-phase1'} ({health?.environment || 'dev'})
            </p>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-600 flex items-center">
                <Database className="w-4 h-4 mr-1.5 text-sky-600" />
                Database & Cache
              </span>
              <Badge variant="info">Prisma & Redis</Badge>
            </div>
            <p className="text-lg font-bold text-neutral-900">PostgreSQL 16</p>
            <p className="text-xs text-neutral-500 mt-0.5">22 Entities, Strict FKs & Enums</p>
          </div>

          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-600 flex items-center">
                <Cpu className="w-4 h-4 mr-1.5 text-amber-600" />
                ML Service
              </span>
              <Badge variant="neutral">FastAPI</Badge>
            </div>
            <p className="text-lg font-bold text-neutral-900">Port 8000</p>
            <p className="text-xs text-neutral-500 mt-0.5">YOLOv8 + ARIMA Models</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            API Ping Error: {error}
          </div>
        )}
      </Card>

      {/* Complete Planned Farmer Journey */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-neutral-900">End-to-End Procurement Lifecycle</h2>
          <p className="text-xs text-neutral-500">
            The database schema and architectural contracts are designed to support this full workflow:
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {journeySteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="p-3.5 bg-white rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-neutral-900 leading-snug">{step.title}</h4>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-normal">{step.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center text-[10px] text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  <span>Schema Ready</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Module Route Placeholders & Architectural Readiness */}
      <Card
        title="Prepared API Route Modules (Phase 1 Baseline)"
        subtitle="Express endpoints pre-routed with validation, standardized error handling, and Zod contracts"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs font-mono">
          {[
            '/api/health',
            '/api/auth',
            '/api/users',
            '/api/farmers',
            '/api/farms',
            '/api/crops',
            '/api/msp',
            '/api/centers',
            '/api/bookings',
            '/api/queue',
            '/api/gate',
            '/api/grading',
            '/api/procurement',
            '/api/payments',
            '/api/forecasts',
            '/api/anomalies',
            '/api/notifications',
            '/api/disputes',
            '/api/audit',
            '/api/admin',
          ].map((endpoint) => (
            <div
              key={endpoint}
              className="p-2 rounded bg-neutral-50 border border-neutral-200/80 text-neutral-700 flex items-center justify-between"
            >
              <span>{endpoint}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
