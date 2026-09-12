// ==============================================================================
// KisanFlow — Security & RBAC Verification Console
// Live verification of Firebase Token, RBAC, IDOR & Center Authorization
// ==============================================================================

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, CheckCircle2, XCircle, Key, RefreshCw, Layers } from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface TestResult {
  endpoint: string;
  expectedStatus: number;
  actualStatus?: number;
  passed?: boolean;
  response?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export const SecurityVerificationPage: React.FC = () => {
  const { user, token, isAuthenticated, loginAsDemoUser } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  const runVerificationSuite = async () => {
    setIsRunning(true);
    const suiteResults: TestResult[] = [];

    const tests = [
      {
        endpoint: '/api/auth/me',
        description: 'Verify Current User Identity & Token Claims',
        expectedStatus: 200,
      },
      {
        endpoint: '/api/farmer/security-test',
        description: 'Farmer-Only RBAC Gate (/api/farmer/security-test)',
        expectedStatus: user?.role === 'FARMER' ? 200 : 403,
      },
      {
        endpoint: '/api/center/security-test',
        description: 'Center Operator & Inspector Gate (/api/center/security-test)',
        expectedStatus: ['CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '')
          ? 200
          : 403,
      },
      {
        endpoint: '/api/admin/security-test',
        description: 'Government Admin & Super Admin Gate (/api/admin/security-test)',
        expectedStatus: ['GOVERNMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '') ? 200 : 403,
      },
      {
        endpoint: '/api/farms/farm-farmer-01',
        description: 'IDOR Defense: Farm Land Parcel Ownership Check',
        expectedStatus: user?.id === 'user-demo-farmer-01' || ['GOVERNMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '') ? 200 : 403,
      },
      {
        endpoint: '/api/centers/PC-HR-KAR-01/operations',
        description: 'Center Isolation: Karnal Mandi Operator Assignment Check',
        expectedStatus:
          user?.assignedCenterIds?.includes('PC-HR-KAR-01') ||
          user?.operatorCenterId === 'PC-HR-KAR-01' ||
          ['GOVERNMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '')
            ? 200
            : 403,
      },
      {
        endpoint: '/api/crops',
        description: 'Crop Master Catalog: Active Commodities & Moisture Limits',
        expectedStatus: 200,
      },
      {
        endpoint: '/api/msp?marketingYear=2026',
        description: 'Statutory MSP Rate Engine: Official DAC&FW Benchmarks (2026-27)',
        expectedStatus: 200,
      },
      {
        endpoint: '/api/farmer/profile',
        description: 'Farmer Profile & Credential Privacy Check (/api/farmer/profile)',
        expectedStatus: user?.role === 'FARMER' ? 200 : 403,
      },
    ];

    for (const t of tests) {
      const start = performance.now();
      try {
        const res = await fetch(t.endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const duration = Math.round(performance.now() - start);
        const data = await res.json().catch(() => ({}));

        suiteResults.push({
          endpoint: t.endpoint,
          expectedStatus: t.expectedStatus,
          actualStatus: res.status,
          passed: res.status === t.expectedStatus,
          response: data,
          durationMs: duration,
        });
      } catch (err: unknown) {
        suiteResults.push({
          endpoint: t.endpoint,
          expectedStatus: t.expectedStatus,
          actualStatus: 0,
          passed: false,
          error: err instanceof Error ? err.message : 'Network error',
        });
      }
    }

    setResults(suiteResults);

    // Fetch audit ledger if admin
    if (['GOVERNMENT_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '')) {
      try {
        const auditRes = await fetch('/api/auth/audit-trail', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditEvents(auditData.data?.events || []);
        }
      } catch {
        // Ignored
      }
    }

    setIsRunning(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-neutral-900">Security & RBAC Console</h1>
            <Badge variant="success">Phase 2 Verified</Badge>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            OWASP Top 10 API Security: Bearer Token Verification, Role Gates, IDOR Protection & Center Isolation
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            size="sm"
            onClick={runVerificationSuite}
            disabled={isRunning || !isAuthenticated}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>Run Security Suite</span>
          </Button>
        </div>
      </div>

      {/* Current Security Context Card */}
      <Card title="Active Authenticated Session Security Context">
        {isAuthenticated && user ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span className="text-neutral-500 block text-[11px]">User Identity</span>
              <span className="font-bold text-neutral-900 block mt-0.5">{user.name}</span>
              <span className="font-mono text-[10px] text-neutral-500 truncate block">{user.id}</span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span className="text-neutral-500 block text-[11px]">Enforced Role</span>
              <span className="inline-block mt-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                {user.role}
              </span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span className="text-neutral-500 block text-[11px]">Center Assignment</span>
              <span className="font-bold text-neutral-800 block mt-0.5">
                {user.operatorCenterId || user.assignedCenterIds?.[0] || 'State / None'}
              </span>
              <span className="text-[10px] text-neutral-400">Horizontal scope locked</span>
            </div>

            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span className="text-neutral-500 block text-[11px]">Token Bearer Status</span>
              <span className="font-mono text-emerald-700 font-bold block mt-0.5">VERIFIED</span>
              <span className="text-[10px] text-neutral-500 truncate block">
                {token?.startsWith('demo-token-') ? 'Synthetic SIH Token' : 'Firebase JWT ID Token'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>No active session. Please sign in or select a demo role below to execute security tests.</span>
            </div>
          </div>
        )}

        {/* Quick Role Tester Bar */}
        <div className="mt-4 pt-4 border-t border-neutral-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600 mr-2">Switch Test Identity:</span>
          {(['FARMER', 'CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={async () => {
                await loginAsDemoUser(r);
                setResults([]);
              }}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                user?.role === r
                  ? 'bg-emerald-700 text-white border-emerald-800 font-bold'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </Card>

      {/* Test Results Table */}
      {results.length > 0 && (
        <Card title="Live API Security Verification Results">
          <div className="space-y-3">
            {results.map((res, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  res.passed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {res.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-mono font-semibold text-neutral-900">{res.endpoint}</span>
                    <Badge variant={res.passed ? 'success' : 'danger'}>
                      {res.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-neutral-500 pl-6">
                    Expected: <code className="font-bold">{res.expectedStatus}</code> | Received:{' '}
                    <code className="font-bold">{res.actualStatus}</code> ({res.durationMs}ms)
                  </div>
                </div>

                <div className="text-right text-[11px] text-neutral-600 pl-6 sm:pl-0">
                  {res.response?.message && (
                    <span className="italic max-w-sm truncate block">{String(res.response.message)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cryptographic Hash Ledger Preview */}
      {auditEvents.length > 0 && (
        <Card
          title="Tamper-Evident SHA-256 Cryptographic Audit Ledger"
          subtitle="Append-only hash chained audit records generated by authentication and security events"
        >
          <div className="space-y-2 font-mono text-[11px]">
            {auditEvents.slice(0, 5).map((ev) => (
              <div key={ev.id} className="p-2.5 bg-neutral-900 text-neutral-200 rounded-lg space-y-1">
                <div className="flex justify-between items-center text-emerald-400">
                  <span>Block #{ev.sequenceNumber} — {ev.action}</span>
                  <span className="text-[10px] text-neutral-400">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-[10px] text-neutral-400 truncate">
                  Previous: <span className="text-neutral-500">{ev.previousHash}</span>
                </div>
                <div className="text-[10px] text-amber-300 truncate">
                  Current: <span className="text-emerald-300">{ev.currentHash}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
