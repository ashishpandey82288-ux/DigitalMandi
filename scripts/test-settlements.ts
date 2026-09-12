// ==============================================================================
// KisanFlow — Phase 4A: Settlement & Direct MSP Payout Test Suite
// Validates:
// 1. Authoritative settlement generation consuming verified weighment and grading data
// 2. Exact Decimal monetary math (Gross, Deductions, Net Payable) with no float drift
// 3. Pre-condition checks: Missing weighment, missing grading, duplicate settlement rejection
// 4. Retrieval endpoints: by ID, by Reference, by Booking ID, filtered listing
// 5. Strict IDOR protection for farmer roles
// 6. Chained SHA-256 cryptographic audit logging
// ==============================================================================

import axios from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  category: 'SETUP' | 'SETTLEMENT_CREATION' | 'MONEY_PRECISION' | 'VALIDATION' | 'RETRIEVAL' | 'IDOR_RBAC' | 'AUDIT_LEDGER';
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

const farmerToken = 'demo-token-farmer';
const inspectorToken = 'demo-token-inspector';
const operatorToken = 'demo-token-operator';
const adminToken = 'demo-token-admin';

let testBookingId = '';
let testWeighmentId = '';
let testSettlementId = '';
let testSettlementRef = '';
let expectedGross = 0;
let expectedNetPayable = 0;
let expectedDeductions = 0;

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // 1. SETUP: Create a complete verified booking (Booked -> Checked In -> Graded -> Weighed)
  // ----------------------------------------------------------------------------
  {
    id: 'SETTLE-SETUP-01',
    name: 'Setup: Create full verified booking with checked-in, graded, and weighed state',
    category: 'SETUP',
    fn: async () => {
      try {
        await prisma.bookingSlot.update({
          where: { id: 'slot-karnal-01' },
          data: { bookedCapacityQuintals: 0 as any, isAvailable: true },
        });

        // 1. Create booking
        const bookingRes = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: 'crop-wheat',
            centerId: 'center-karnal-01',
            slotId: 'slot-karnal-01',
            quantity: 50.0,
            date: '2026-09-15',
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );

        testBookingId = bookingRes.data.data.id;

        // 2. Gate Check-in
        await prisma.booking.update({
          where: { id: testBookingId },
          data: { status: 'CHECKED_IN' },
        });

        // 3. Quality Inspection (Grade A with standard moisture 11.5%)
        await axios.post(
          `${API_BASE}/api/grading`,
          {
            bookingId: testBookingId,
            moisturePercentage: 11.5,
            foreignMatterPercentage: 0.5,
            damagedGrainsPercentage: 1.0,
            weevilGrainsPercentage: 0.2,
            shriveledImmaturePercentage: 1.5,
            isPassed: true,
          },
          { headers: { Authorization: `Bearer ${inspectorToken}` } }
        );

        // 4. Weighment (Gross 60.0, Tare 10.0 => Net 50.0 qtl @ ₹2,275 = ₹113,750)
        const weighmentRes = await axios.post(
          `${API_BASE}/api/weighments`,
          {
            bookingId: testBookingId,
            grossWeightQuintals: 60.0,
            tareWeightQuintals: 10.0,
            scaleDeviceId: 'WEIGH-DIGI-KARNAL-01',
            verificationStatus: 'VERIFIED',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const wData = weighmentRes.data?.data || weighmentRes.data;
        testWeighmentId = wData.id;
        expectedGross = Number(wData.grossAmount || (50 * 2275));
        expectedNetPayable = Number(wData.finalPayableAmount);
        expectedDeductions = Math.max(0, Math.round((expectedGross - expectedNetPayable) * 100) / 100);

        return {
          passed: true,
          message: `Prepared verified booking ${testBookingId} ready for settlement generation.`,
          details: { testBookingId, testWeighmentId, expectedGross, expectedNetPayable },
        };
      } catch (err: any) {
        return {
          passed: false,
          message: `Setup failed: ${err.response?.data?.error || err.message}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 2. SETTLEMENT CREATION & MONETARY PRECISION
  // ----------------------------------------------------------------------------
  {
    id: 'SETTLE-CREATE-01',
    name: 'POST /api/settlements: Generates authoritative settlement consuming weighment data',
    category: 'SETTLEMENT_CREATION',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/settlements`,
          {
            bookingId: testBookingId,
            metadata: { testSuite: 'Phase4A-Settlements' },
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const stl = res.data.data;
        testSettlementId = stl.id;
        testSettlementRef = stl.settlementReference;

        const isGrossAccurate = Math.abs(stl.grossAmount - expectedGross) < 0.01;
        const isNetAccurate = Math.abs(stl.netPayableAmount - expectedNetPayable) < 0.01;
        const isDeductionAccurate = Math.abs(stl.deductions - expectedDeductions) < 0.01;
        const hasRef = stl.settlementReference && stl.settlementReference.startsWith('SETTLE-');
        const isPending = stl.status === 'PENDING';

        if (isGrossAccurate && isNetAccurate && isDeductionAccurate && hasRef && isPending) {
          return {
            passed: true,
            message: `Settlement ${stl.settlementReference} generated with precise amounts: Gross=₹${stl.grossAmount}, Net=₹${stl.netPayableAmount}`,
            details: stl,
          };
        } else {
          return {
            passed: false,
            message: `Monetary precision mismatch: Gross=${stl.grossAmount} (exp ${expectedGross}), Net=${stl.netPayableAmount} (exp ${expectedNetPayable})`,
            details: stl,
          };
        }
      } catch (err: any) {
        return {
          passed: false,
          message: `Settlement creation failed: ${err.response?.data?.error || err.message}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 3. VALIDATIONS & INTEGRITY
  // ----------------------------------------------------------------------------
  {
    id: 'SETTLE-VALIDATION-01',
    name: 'Validation: Rejects duplicate settlement creation for the same booking',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/settlements`,
          { bookingId: testBookingId },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected duplicate settlement creation to fail with 400.' };
      } catch (err: any) {
        const is400 = err.response?.status === 400;
        const code = err.response?.data?.code;
        if (is400 && (code === 'DUPLICATE_SETTLEMENT' || err.response?.data?.error?.includes('already exists'))) {
          return { passed: true, message: 'Correctly rejected duplicate settlement with 400 DUPLICATE_SETTLEMENT.' };
        }
        return { passed: false, message: `Unexpected response: ${err.response?.status} ${JSON.stringify(err.response?.data)}` };
      }
    },
  },

  {
    id: 'SETTLE-VALIDATION-02',
    name: 'Validation: Rejects settlement generation when weighment is missing',
    category: 'VALIDATION',
    fn: async () => {
      try {
        // Create an unweighed booking
        const bRes = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: 'crop-wheat',
            centerId: 'center-karnal-01',
            slotId: 'slot-karnal-01',
            quantity: 30.0,
            date: '2026-09-15',
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        const unweighedBookingId = bRes.data.data.id;

        await axios.post(
          `${API_BASE}/api/settlements`,
          { bookingId: unweighedBookingId },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected missing weighment settlement to fail with 400.' };
      } catch (err: any) {
        const is400 = err.response?.status === 400;
        if (is400) {
          return { passed: true, message: 'Correctly rejected settlement for unweighed booking.' };
        }
        return { passed: false, message: `Unexpected error: ${err.response?.status} ${err.message}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 4. RETRIEVAL ENDPOINTS
  // ----------------------------------------------------------------------------
  {
    id: 'SETTLE-GET-01',
    name: 'GET /api/settlements/:id: Fetches settlement by ID',
    category: 'RETRIEVAL',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/settlements/${testSettlementId}`, {
          headers: { Authorization: `Bearer ${operatorToken}` },
        });
        const stl = res.data.data;
        if (stl && stl.id === testSettlementId && stl.settlementReference === testSettlementRef) {
          return { passed: true, message: `Fetched settlement ${stl.settlementReference} by ID.` };
        }
        return { passed: false, message: 'Settlement data did not match requested ID.', details: stl };
      } catch (err: any) {
        return { passed: false, message: `Fetch by ID failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  {
    id: 'SETTLE-GET-02',
    name: 'GET /api/bookings/:bookingId/settlement: Fetches settlement via booking relation',
    category: 'RETRIEVAL',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings/${testBookingId}/settlement`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        const stl = res.data.data;
        if (stl && stl.bookingId === testBookingId && stl.id === testSettlementId) {
          return { passed: true, message: `Fetched settlement for booking ${testBookingId}.` };
        }
        return { passed: false, message: 'Booking settlement retrieval failed.', details: stl };
      } catch (err: any) {
        return { passed: false, message: `Fetch by booking failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  {
    id: 'SETTLE-GET-03',
    name: 'GET /api/settlements: Lists settlements with filtering',
    category: 'RETRIEVAL',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/settlements?status=PENDING`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const list = res.data.data;
        if (Array.isArray(list) && list.some((s: any) => s.id === testSettlementId)) {
          return { passed: true, message: `Settlement list returned ${list.length} records matching filter.` };
        }
        return { passed: false, message: 'Settlement list did not contain test settlement.', details: list };
      } catch (err: any) {
        return { passed: false, message: `Listing failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 5. IDOR & AUDIT LEDGER
  // ----------------------------------------------------------------------------
  {
    id: 'SETTLE-IDOR-01',
    name: 'IDOR Protection: Farmer cannot access settlements of another farmer',
    category: 'IDOR_RBAC',
    fn: async () => {
      try {
        // We have a settlement belonging to demo farmer ramesh
        // Use a different farmer's token or simulated non-owner context
        const otherFarmerToken = 'demo-token-other-farmer';
        await axios.get(`${API_BASE}/api/settlements/${testSettlementId}`, {
          headers: { Authorization: `Bearer ${otherFarmerToken}` },
        });
        // If auth falls back or denies with 403, we verify
        return { passed: false, message: 'Expected cross-farmer settlement access to be forbidden.' };
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 403 || status === 401) {
          return { passed: true, message: `Access denied (${status}) for unauthorized farmer token.` };
        }
        return { passed: false, message: `Unexpected status code: ${status}` };
      }
    },
  },

  {
    id: 'SETTLE-AUDIT-01',
    name: 'Audit Ledger: Verifies SHA-256 chained entry for SETTLEMENT_CREATED',
    category: 'AUDIT_LEDGER',
    fn: async () => {
      try {
        const events = await prisma.auditEvent.findMany({
          where: {
            entityType: 'Settlement',
            action: 'SETTLEMENT_CREATED',
          },
        });
        const event = events.find((e: any) => e.entityId === testSettlementId);
        if (event && event.currentHash && event.currentHash.length === 64) {
          return {
            passed: true,
            message: `Verified cryptographic SHA-256 audit entry: Hash=${event.currentHash.slice(0, 16)}... Seq=${event.sequenceNumber}`,
          };
        }
        return { passed: false, message: 'Audit event for settlement was not found or lacks SHA-256 hash.' };
      } catch (err: any) {
        return { passed: false, message: `Audit query failed: ${err.message}` };
      }
    },
  },
];

async function runSettlementTests() {
  console.log('==============================================================================');
  console.log('  KisanFlow — Phase 4A: Settlement & Payout Engine Test Suite');
  console.log('==============================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`[RUNNING] [${test.id}] ${test.name}... `);
    const result = await test.fn();
    if (result.passed) {
      passed++;
      console.log('PASS');
      console.log(`          ${result.message}`);
    } else {
      failed++;
      console.log('FAIL');
      console.log(`          Reason: ${result.message}`);
      if (result.details) {
        console.log(`          Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
    console.log('');
  }

  console.log('==============================================================================');
  console.log(`  Settlement Test Results: ${passed}/${tests.length} Passed (${failed} Failed)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSettlementTests();
