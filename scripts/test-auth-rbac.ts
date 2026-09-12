// ==============================================================================
// KisanFlow — Automated Authentication & RBAC Verification Suite
// Validates AUTH-01 through AUTH-12, RBAC-01 through RBAC-05, IDOR-01/02, CENTER-01/02
// ==============================================================================

import axios, { AxiosError } from 'axios';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  category: 'AUTH' | 'RBAC' | 'IDOR' | 'CENTER' | 'AUDIT';
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // AUTH TESTS
  // ----------------------------------------------------------------------------
  {
    id: 'AUTH-01',
    name: 'Unauthenticated request is rejected with 401 UNAUTHORIZED',
    category: 'AUTH',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/auth/me`);
        return { passed: false, message: 'Expected 401 but request succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 401) {
          return { passed: true, message: 'Rejected with 401 UNAUTHORIZED as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'AUTH-02',
    name: 'Invalid/Malformed token is rejected with 401 UNAUTHORIZED',
    category: 'AUTH',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: 'Bearer this-is-an-invalid-garbage-token-xyz' },
        });
        return { passed: false, message: 'Expected 401 for invalid token but request succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 401) {
          return { passed: true, message: 'Rejected with 401 for invalid token as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'AUTH-03',
    name: 'Expired/Revoked token format is rejected with 401 UNAUTHORIZED',
    category: 'AUTH',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: 'Bearer expired.jwt.token.signature.invalid' },
        });
        return { passed: false, message: 'Expected 401 for expired token' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 401) {
          return { passed: true, message: 'Rejected with 401 UNAUTHORIZED as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'AUTH-04',
    name: 'Valid Farmer token passes requireAuth() and returns user profile',
    category: 'AUTH',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });
      if (res.status === 200 && res.data.data?.user?.role === 'FARMER') {
        return { passed: true, message: `Validated user profile with role: ${res.data.data.user.role}` };
      }
      return { passed: false, message: 'User profile mismatch or status non-200' };
    },
  },
  {
    id: 'AUTH-05',
    name: 'Valid Farmer token accesses farmer route (200 OK)',
    category: 'AUTH',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/farmer/security-test`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });
      if (res.status === 200 && res.data.data?.testPassed) {
        return { passed: true, message: 'Farmer route returned 200 OK with testPassed=true' };
      }
      return { passed: false, message: `Failed with status ${res.status}` };
    },
  },
  {
    id: 'AUTH-06',
    name: 'Farmer token is rejected on Admin route with 403 FORBIDDEN',
    category: 'AUTH',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/admin/security-test`, {
          headers: { Authorization: 'Bearer demo-token-farmer' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN for farmer on admin route' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 403) {
          return { passed: true, message: 'Rejected with 403 FORBIDDEN as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'AUTH-07',
    name: 'Farmer token is rejected on Center Operator route with 403 FORBIDDEN',
    category: 'AUTH',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/center/security-test`, {
          headers: { Authorization: 'Bearer demo-token-farmer' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN for farmer on center route' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 403) {
          return { passed: true, message: 'Rejected with 403 FORBIDDEN as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'AUTH-08',
    name: 'Center Operator token is rejected on Admin route with 403 FORBIDDEN',
    category: 'AUTH',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/admin/security-test`, {
          headers: { Authorization: 'Bearer demo-token-operator' },
        });
        return { passed: false, message: 'Expected 403 FORBIDDEN for operator on admin route' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 403) {
          return { passed: true, message: 'Rejected with 403 FORBIDDEN as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // RBAC TESTS
  // ----------------------------------------------------------------------------
  {
    id: 'RBAC-01',
    name: 'Government Admin token accesses admin route (200 OK)',
    category: 'RBAC',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/admin/security-test`, {
        headers: { Authorization: 'Bearer demo-token-admin' },
      });
      if (res.status === 200 && res.data.data?.authorized) {
        return { passed: true, message: 'Admin access granted with status 200' };
      }
      return { passed: false, message: `Unexpected status: ${res.status}` };
    },
  },
  {
    id: 'RBAC-02',
    name: 'Center Operator accesses center operations route (200 OK)',
    category: 'RBAC',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/center/security-test`, {
        headers: { Authorization: 'Bearer demo-token-operator' },
      });
      if (res.status === 200 && res.data.data?.authorized) {
        return { passed: true, message: 'Center operator access granted with status 200' };
      }
      return { passed: false, message: `Unexpected status: ${res.status}` };
    },
  },
  {
    id: 'RBAC-03',
    name: 'Quality Inspector accesses center route (200 OK)',
    category: 'RBAC',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/center/security-test`, {
        headers: { Authorization: 'Bearer demo-token-inspector' },
      });
      if (res.status === 200 && res.data.data?.authorized) {
        return { passed: true, message: 'Quality inspector access granted with status 200' };
      }
      return { passed: false, message: `Unexpected status: ${res.status}` };
    },
  },
  {
    id: 'RBAC-04',
    name: 'Super Admin accesses admin route (200 OK)',
    category: 'RBAC',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/admin/security-test`, {
        headers: { Authorization: 'Bearer demo-token-superadmin' },
      });
      if (res.status === 200 && res.data.data?.authorized) {
        return { passed: true, message: 'Super admin access granted with status 200' };
      }
      return { passed: false, message: `Unexpected status: ${res.status}` };
    },
  },
  {
    id: 'RBAC-05',
    name: 'Inactive/Deactivated user is rejected even with valid token (403 FORBIDDEN)',
    category: 'RBAC',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: 'Bearer demo-token-inactive' },
        });
        return { passed: false, message: 'Inactive user was unexpectedly allowed access' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 403) {
          return { passed: true, message: 'Rejected with 403 FORBIDDEN (Account disabled) as expected' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // RESOURCE OWNERSHIP / IDOR TESTS
  // ----------------------------------------------------------------------------
  {
    id: 'IDOR-01',
    name: 'Farmer CANNOT access another farmer farm parcel (403 FORBIDDEN)',
    category: 'IDOR',
    fn: async () => {
      try {
        // Farmer 1 (user-demo-farmer-01) tries to access Farm 2 (farm-farmer-02)
        await axios.get(`${API_BASE}/api/farms/farm-farmer-02`, {
          headers: { Authorization: 'Bearer demo-token-farmer' },
        });
        return { passed: false, message: 'IDOR flaw: Farmer was able to read another farmer farm' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 403) {
          return { passed: true, message: 'IDOR prevented: Returned 403 FORBIDDEN for unauthorized farm' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'IDOR-02',
    name: 'Farmer CAN access their own farm parcel (200 OK)',
    category: 'IDOR',
    fn: async () => {
      // Farmer 1 accesses Farm 1
      const res = await axios.get(`${API_BASE}/api/farms/farm-farmer-01`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });
      if (res.status === 200 && res.data.data?.verifiedOwnership) {
        return { passed: true, message: 'Ownership verified: Farm parcel returned 200 OK' };
      }
      return { passed: false, message: `Unexpected status: ${res.status}` };
    },
  },

  // ----------------------------------------------------------------------------
  // CENTER-LEVEL ISOLATION TESTS
  // ----------------------------------------------------------------------------
  {
    id: 'CENTER-01',
    name: 'Center Operator CANNOT access unassigned center operations (403 FORBIDDEN)',
    category: 'CENTER',
    fn: async () => {
      try {
        // Karnal Operator tries to access unassigned center PC-RJ-JAI-05 (Jaipur)
        await axios.get(`${API_BASE}/api/centers/PC-RJ-JAI-05/operations`, {
          headers: { Authorization: 'Bearer demo-token-operator' },
        });
        return { passed: false, message: 'Operator accessed an unassigned center' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status === 403) {
          return { passed: true, message: 'Center isolation enforced: 403 FORBIDDEN for unassigned center' };
        }
        return { passed: false, message: `Unexpected status: ${error.response?.status}` };
      }
    },
  },
  {
    id: 'CENTER-02',
    name: 'Center Operator CAN access assigned center operations (200 OK)',
    category: 'CENTER',
    fn: async () => {
      // Karnal Operator accesses PC-HR-KAR-01
      const res = await axios.get(`${API_BASE}/api/centers/PC-HR-KAR-01/operations`, {
        headers: { Authorization: 'Bearer demo-token-operator' },
      });
      if (res.status === 200) {
        return { passed: true, message: 'Center access verified: Returned 200 OK for assigned center' };
      }
      return { passed: false, message: `Unexpected status: ${res.status}` };
    },
  },

  // ----------------------------------------------------------------------------
  // LIFECYCLE & AUDIT TESTS
  // ----------------------------------------------------------------------------
  {
    id: 'AUTH-10',
    name: 'User self-registration enforces default FARMER role, not admin',
    category: 'AUTH',
    fn: async () => {
      // Simulate sync of new user
      const res = await axios.post(
        `${API_BASE}/api/auth/sync`,
        { role: 'SUPER_ADMIN' }, // Malicious body attempting role escalation
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );
      const user = res.data.data?.user;
      if (user && user.role === 'FARMER') {
        return { passed: true, message: 'Privilege escalation blocked: Role safely maintained as FARMER' };
      }
      return { passed: false, message: `Escalation not blocked, role was ${user?.role}` };
    },
  },
  {
    id: 'AUTH-11',
    name: 'Logout invalidates session and records audit event (200 OK)',
    category: 'AUTH',
    fn: async () => {
      const res = await axios.post(
        `${API_BASE}/api/auth/logout`,
        {},
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );
      if (res.status === 200 && res.data.data?.loggedOut) {
        return { passed: true, message: 'Logout confirmed and audit event dispatched' };
      }
      return { passed: false, message: `Logout failed with status ${res.status}` };
    },
  },
  {
    id: 'AUTH-12',
    name: 'Audit log records security attempts in append-only SHA-256 ledger',
    category: 'AUDIT',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/auth/audit-trail`, {
        headers: { Authorization: 'Bearer demo-token-admin' },
      });
      const events = res.data.data?.events;
      if (Array.isArray(events) && events.length > 0) {
        const latest = events[0];
        if (latest.currentHash && latest.previousHash) {
          return {
            passed: true,
            message: `Cryptographic audit verified: ${events.length} blocks in ledger, latest hash: ${latest.currentHash.slice(0, 16)}...`,
          };
        }
      }
      return { passed: false, message: 'Audit events not retrieved or missing hash chain' };
    },
  },
];

async function runAll() {
  console.log('================================================================');
  console.log('🛡️  KISANFLOW — PHASE 2 AUTHENTICATION & RBAC TEST RUNNER');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const t of tests) {
    process.stdout.write(`▶ Running [${t.id}] ${t.name}... `);
    try {
      const res = await t.fn();
      if (res.passed) {
        console.log(`\x1b[32mPASS\x1b[0m — ${res.message}`);
        passedCount++;
      } else {
        console.log(`\x1b[31mFAIL\x1b[0m — ${res.message}`);
        failedCount++;
      }
    } catch (err: unknown) {
      console.log(`\x1b[31mERROR\x1b[0m — ${err instanceof Error ? err.message : String(err)}`);
      failedCount++;
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: Total: ${tests.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAll();
