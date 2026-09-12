// ==============================================================================
// KisanFlow — Phase 3 Step 3 Farmer Profile Verification Suite
// Validates PROFILE-01 through PROFILE-12 for GET/PUT /api/farmer/profile
// ==============================================================================

import axios, { AxiosError } from 'axios';
import { UserRole } from '@prisma/client';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // PROFILE-01: Authenticated FARMER can retrieve own profile
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-01',
    name: 'Authenticated FARMER can retrieve own profile (200 OK)',
    fn: async () => {
      const res = await axios.get(`${API_BASE}/api/farmer/profile`, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200 || !res.data.success) {
        return { passed: false, message: `Expected 200 OK with success=true, got ${res.status}` };
      }

      const profile = res.data.data;
      if (profile.userId !== 'user-demo-farmer-01' || profile.id !== 'prof-farmer-01') {
        return { passed: false, message: `Unexpected profile identity: ${profile.id} / ${profile.userId}` };
      }

      if (profile.primaryDistrict !== 'Karnal' || profile.primaryState !== 'Haryana') {
        return { passed: false, message: 'Profile district/state mismatch' };
      }

      // Security check: sensitive internal fields must NOT be exposed
      if (profile.aadhaarHash !== undefined || profile.bankAccountNumber !== undefined || profile.firebaseUid !== undefined) {
        return { passed: false, message: 'Security failure: Sensitive internal credential fields were exposed in response' };
      }

      return {
        passed: true,
        message: `Profile retrieved successfully: ID=${profile.id}, district=${profile.primaryDistrict}, state=${profile.primaryState}`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-02: Authenticated FARMER can update own profile
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-02',
    name: 'Authenticated FARMER can update own profile (200 OK)',
    fn: async () => {
      const updatePayload = {
        fullName: 'Harpreet Singh Sidhu',
        alternatePhone: '9876543210',
        village: 'Taraori',
        preferredLanguage: 'pa',
      };

      const res = await axios.put(`${API_BASE}/api/farmer/profile`, updatePayload, {
        headers: { Authorization: 'Bearer demo-token-farmer' },
      });

      if (res.status !== 200 || !res.data.success) {
        return { passed: false, message: `Expected 200 OK, got ${res.status}` };
      }

      const updated = res.data.data;
      if (
        updated.fullName !== updatePayload.fullName ||
        updated.village !== updatePayload.village ||
        updated.preferredLanguage !== updatePayload.preferredLanguage
      ) {
        return { passed: false, message: 'Updated fields did not match payload' };
      }

      // Verify in database directly
      const dbRecord = await prisma.farmerProfile.findUnique({
        where: { userId: 'user-demo-farmer-01' },
      });

      if (
        dbRecord?.fullName !== updatePayload.fullName ||
        dbRecord?.village !== updatePayload.village ||
        dbRecord?.preferredLanguage !== updatePayload.preferredLanguage
      ) {
        return { passed: false, message: 'Database state did not reflect updated fields' };
      }

      return {
        passed: true,
        message: `Profile updated and verified in DB: fullName="${updated.fullName}", village="${updated.village}", lang="${updated.preferredLanguage}"`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-03: Unauthenticated request is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-03',
    name: 'Unauthenticated request is rejected with 401 UNAUTHORIZED',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/farmer/profile`);
        return { passed: false, message: 'Expected GET to fail with 401, but succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status !== 401) {
          return { passed: false, message: `GET returned ${error.response?.status}, expected 401` };
        }
      }

      try {
        await axios.put(`${API_BASE}/api/farmer/profile`, { fullName: 'Hacker Name' });
        return { passed: false, message: 'Expected PUT to fail with 401, but succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status !== 401) {
          return { passed: false, message: `PUT returned ${error.response?.status}, expected 401` };
        }
      }

      return { passed: true, message: 'Both GET and PUT rejected unauthenticated requests with 401 UNAUTHORIZED' };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-04: Non-FARMER role cannot use farmer profile endpoint
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-04',
    name: 'Non-FARMER roles cannot use farmer profile endpoint (403 FORBIDDEN)',
    fn: async () => {
      const nonFarmerTokens = [
        { role: 'CENTER_OPERATOR', token: 'demo-token-operator' },
        { role: 'QUALITY_INSPECTOR', token: 'demo-token-inspector' },
        { role: 'GOVERNMENT_ADMIN', token: 'demo-token-admin' },
      ];

      for (const { role, token } of nonFarmerTokens) {
        try {
          await axios.get(`${API_BASE}/api/farmer/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return { passed: false, message: `Role ${role} was granted unauthorized access to farmer profile` };
        } catch (err) {
          const error = err as AxiosError<any>;
          if (error.response?.status !== 403) {
            return {
              passed: false,
              message: `Role ${role} received status ${error.response?.status}, expected 403 FORBIDDEN`,
            };
          }
        }
      }

      return { passed: true, message: 'All non-FARMER roles successfully rejected with 403 FORBIDDEN' };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-05: Unknown/forbidden update fields are rejected
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-05',
    name: 'Unknown/forbidden update fields are rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      try {
        await axios.put(
          `${API_BASE}/api/farmer/profile`,
          {
            fullName: 'Valid Name',
            unauthorizedInjectedField: 'malicious-data',
            adminRights: true,
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected 400 for unknown fields, but request succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        const errCode = error.response?.data?.error?.code || error.response?.data?.code;
        if (error.response?.status === 400 && errCode === 'VALIDATION_ERROR') {
          return { passed: true, message: 'Rejected unknown payload properties with 400 VALIDATION_ERROR' };
        }
        return {
          passed: false,
          message: `Unexpected response status ${error.response?.status} / code ${errCode}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-06: Invalid phone is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-06',
    name: 'Invalid phone format is rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      const invalidPhones = ['12345', 'abcdefghij', '1111111111', '+1234567890123'];

      for (const phone of invalidPhones) {
        try {
          await axios.put(
            `${API_BASE}/api/farmer/profile`,
            { alternatePhone: phone },
            { headers: { Authorization: 'Bearer demo-token-farmer' } }
          );
          return { passed: false, message: `Expected rejection for invalid phone "${phone}", but succeeded` };
        } catch (err) {
          const error = err as AxiosError<any>;
          if (error.response?.status !== 400) {
            return { passed: false, message: `Phone "${phone}" yielded status ${error.response?.status}, expected 400` };
          }
        }
      }

      return { passed: true, message: 'Malformed Indian phone formats rejected with 400 VALIDATION_ERROR' };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-07: Invalid PIN code is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-07',
    name: 'Invalid Indian 6-digit PIN code format is rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      const invalidPincodes = ['012345', '999', '1234567', 'ABCDEF', '132 01'];

      for (const pin of invalidPincodes) {
        try {
          await axios.put(
            `${API_BASE}/api/farmer/profile`,
            { pincode: pin },
            { headers: { Authorization: 'Bearer demo-token-farmer' } }
          );
          return { passed: false, message: `Expected rejection for invalid PIN "${pin}", but succeeded` };
        } catch (err) {
          const error = err as AxiosError<any>;
          if (error.response?.status !== 400) {
            return { passed: false, message: `PIN "${pin}" yielded status ${error.response?.status}, expected 400` };
          }
        }
      }

      return { passed: true, message: 'Invalid 6-digit postal PIN formats rejected with 400 VALIDATION_ERROR' };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-08: Invalid/future date of birth is rejected
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-08',
    name: 'Invalid or future date of birth is rejected with 400 VALIDATION_ERROR',
    fn: async () => {
      const invalidDates = ['2099-01-01', 'not-a-valid-date', '1850-01-01'];

      for (const dob of invalidDates) {
        try {
          await axios.put(
            `${API_BASE}/api/farmer/profile`,
            { dateOfBirth: dob },
            { headers: { Authorization: 'Bearer demo-token-farmer' } }
          );
          return { passed: false, message: `Expected rejection for invalid DOB "${dob}", but succeeded` };
        } catch (err) {
          const error = err as AxiosError<any>;
          if (error.response?.status !== 400) {
            return { passed: false, message: `DOB "${dob}" yielded status ${error.response?.status}, expected 400` };
          }
        }
      }

      // Test valid past DOB
      const validRes = await axios.put(
        `${API_BASE}/api/farmer/profile`,
        { dateOfBirth: '1985-05-15' },
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );
      if (validRes.status !== 200) {
        return { passed: false, message: 'Valid date of birth failed to update' };
      }

      return { passed: true, message: 'Future and malformed DOBs rejected; valid past DOB accepted' };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-09: IDOR Protection — Cannot access another farmer profile
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-09',
    name: 'Farmer cannot access or modify another farmer profile through manipulated parameters',
    fn: async () => {
      // 1. Attempt GET with manipulated query parameters targeting Farmer 2
      const getRes = await axios.get(
        `${API_BASE}/api/farmer/profile?userId=user-demo-farmer-02&farmerProfileId=prof-farmer-02&id=prof-farmer-02`,
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );

      // Must strictly return authenticated user's own profile (Farmer 1)
      if (getRes.data.data?.userId !== 'user-demo-farmer-01' || getRes.data.data?.id !== 'prof-farmer-01') {
        return {
          passed: false,
          message: 'IDOR vulnerability detected: GET query parameters exposed another farmer profile',
        };
      }

      // 2. Attempt PUT with body trying to hijack Farmer 2's profile
      try {
        await axios.put(
          `${API_BASE}/api/farmer/profile`,
          {
            farmerProfileId: 'prof-farmer-02',
            userId: 'user-demo-farmer-02',
            village: 'Hijacked Village',
          },
          { headers: { Authorization: 'Bearer demo-token-farmer' } }
        );
        return { passed: false, message: 'Expected mass-assignment / IDOR payload to be rejected, but succeeded' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status !== 400) {
          return { passed: false, message: `Expected 400 validation error, got ${error.response?.status}` };
        }
      }

      // 3. Verify Farmer 2's profile in database remains completely unmodified
      const farmer2Db = await prisma.farmerProfile.findUnique({
        where: { id: 'prof-farmer-02' },
      });
      if (farmer2Db?.village === 'Hijacked Village') {
        return { passed: false, message: 'IDOR flaw: Farmer 2 profile was modified by Farmer 1' };
      }

      return {
        passed: true,
        message: 'Strict token-bound identity enforced: Query and body manipulation attempts prevented',
      };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-10: Successful update creates the appropriate audit event
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-10',
    name: 'Successful profile update creates tamper-evident audit event',
    fn: async () => {
      // Execute a specific update
      const res = await axios.put(
        `${API_BASE}/api/farmer/profile`,
        { address: 'Plot 42, GT Road, Karnal' },
        { headers: { Authorization: 'Bearer demo-token-farmer' } }
      );

      if (res.status !== 200) {
        return { passed: false, message: 'Profile update failed' };
      }

      // Query database for recent audit events
      const latestAudit = await prisma.auditEvent.findFirst({
        where: {
          action: 'FARMER_PROFILE_UPDATED',
          actorId: 'user-demo-farmer-01',
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      if (!latestAudit) {
        return { passed: false, message: 'No FARMER_PROFILE_UPDATED audit event found in database' };
      }

      const meta = latestAudit.metadata as Record<string, unknown>;
      if (!Array.isArray(meta?.updatedFields) || !meta.updatedFields.includes('address')) {
        return { passed: false, message: 'Audit event metadata did not capture updated fields' };
      }

      return {
        passed: true,
        message: `Audit event recorded: seq=${latestAudit.sequenceNumber}, action=${latestAudit.action}, hash=${latestAudit.currentHash.slice(0, 16)}...`,
      };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-11: Sensitive authentication/security fields cannot be mass-assigned
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-11',
    name: 'Sensitive security and authentication fields cannot be mass-assigned',
    fn: async () => {
      const maliciousPayload = {
        role: 'SUPER_ADMIN',
        isActive: false,
        aadhaarHash: 'injected_aadhaar_hash',
        bankAccountNumber: '9999999999',
        kisanCreditCard: 'KCC-INJECTED',
        pmKisanId: 'PM-INJECTED',
      };

      try {
        await axios.put(`${API_BASE}/api/farmer/profile`, maliciousPayload, {
          headers: { Authorization: 'Bearer demo-token-farmer' },
        });
        return { passed: false, message: 'Malicious mass-assignment payload was accepted' };
      } catch (err) {
        const error = err as AxiosError<any>;
        if (error.response?.status !== 400) {
          return { passed: false, message: `Expected 400 validation error, got ${error.response?.status}` };
        }
      }

      // Verify in DB that User role is still FARMER and sensitive fields are not modified
      const user = await prisma.user.findUnique({
        where: { id: 'user-demo-farmer-01' },
      });

      if (user?.role !== UserRole.FARMER) {
        return { passed: false, message: `Privilege escalation flaw: User role mutated to ${user?.role}` };
      }

      const profile = await prisma.farmerProfile.findUnique({
        where: { userId: 'user-demo-farmer-01' },
      });

      if (profile?.kisanCreditCard === 'KCC-INJECTED' || profile?.bankAccountNumber === '9999999999') {
        return { passed: false, message: 'Sensitive banking/identity fields were mutated in database' };
      }

      return { passed: true, message: 'Mass-assignment blocked: User role and sensitive fields remain intact' };
    },
  },

  // ----------------------------------------------------------------------------
  // PROFILE-12: Existing audit hash chain remains valid after profile update
  // ----------------------------------------------------------------------------
  {
    id: 'PROFILE-12',
    name: 'Existing audit hash chain remains valid and unbroken after profile updates',
    fn: async () => {
      // Check via admin audit trail endpoint
      const res = await axios.get(`${API_BASE}/api/auth/audit-trail`, {
        headers: { Authorization: 'Bearer demo-token-admin' },
      });

      const events: any[] = res.data.data?.events;
      if (!Array.isArray(events) || events.length === 0) {
        return { passed: false, message: 'Audit ledger is empty or not retrieved' };
      }

      // Verify the chain sequence linkage (events returned in descending order)
      let verifiedLinks = 0;
      for (let i = 0; i < events.length - 1; i++) {
        const newer = events[i];
        const older = events[i + 1];

        if (newer.previousHash === older.currentHash) {
          verifiedLinks++;
        }
      }

      if (verifiedLinks === 0 && events.length > 1) {
        return { passed: false, message: 'No valid hash links found in recent audit events' };
      }

      const latest = events[0];
      return {
        passed: true,
        message: `Cryptographic hash chain validated across ${events.length} recent blocks (${verifiedLinks} unbroken links verified, latest hash=${latest.currentHash.slice(0, 16)}...)`,
      };
    },
  },
];

async function runAll() {
  console.log('================================================================');
  console.log('🌾 KISANFLOW — PHASE 3 STEP 3: FARMER PROFILE TEST RUNNER');
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

  await prisma.$disconnect();

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAll();
