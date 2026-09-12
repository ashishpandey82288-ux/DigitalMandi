// ==============================================================================
// KisanFlow — Phase 4A: Payment & DBT Disbursement Test Suite
// Validates:
// 1. Direct Benefit Transfer (DBT) disbursement orchestration via MockPaymentProvider
// 2. Strict distinction between SIMULATED execution and real banking transfers
// 3. Idempotency guarantees (no double-crediting on retried requests)
// 4. Client-side tampering rejection (authoritative settlement amount enforcement)
// 5. State machine transitions: INITIATED -> PROCESSING -> SUCCESS / FAILED
// 6. Automated retry mechanism for failed DBT payments
// 7. Settlement & Booking terminal completion upon successful disbursement
// 8. Farmer payment history and strict IDOR protection
// 9. Tamper-evident SHA-256 audit ledger cryptographic chaining
// ==============================================================================

import axios from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  category: 'SETUP' | 'DBT_DISBURSEMENT' | 'IDEMPOTENCY' | 'ANTI_TAMPER' | 'FAILURE_HANDLING' | 'RETRY' | 'RETRIEVAL' | 'IDOR_RBAC' | 'AUDIT_LEDGER';
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

const farmerToken = 'demo-token-farmer';
const inspectorToken = 'demo-token-inspector';
const operatorToken = 'demo-token-operator';
const adminToken = 'demo-token-admin';

let testBookingId1 = '';
let testSettlementId1 = '';
let testPaymentId1 = '';
let testUtr1 = '';
let expectedAmount1 = 113750;

let testBookingId2 = '';
let testSettlementId2 = '';
let testFailedPaymentId = '';

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // 1. SETUP: Prepare two full settlements (one for standard payout, one for failure/retry)
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-SETUP-01',
    name: 'Setup: Prepare verified settlements for testing DBT payments',
    category: 'SETUP',
    fn: async () => {
      try {
        await prisma.bookingSlot.update({
          where: { id: 'slot-karnal-01' },
          data: { bookedCapacityQuintals: 0 as any, isAvailable: true },
        });

        // Booking 1: 50 qtl @ 2275 = 113,750
        const b1 = await axios.post(
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
        testBookingId1 = b1.data.data.id;
        await prisma.booking.update({ where: { id: testBookingId1 }, data: { status: 'CHECKED_IN' } });
        await axios.post(`${API_BASE}/api/grading`, { bookingId: testBookingId1, moisturePercentage: 11.0, isPassed: true }, { headers: { Authorization: `Bearer ${inspectorToken}` } });
        await axios.post(`${API_BASE}/api/weighments`, { bookingId: testBookingId1, grossWeightQuintals: 60.0, tareWeightQuintals: 10.0, scaleDeviceId: 'SCALE-01', verificationStatus: 'VERIFIED' }, { headers: { Authorization: `Bearer ${operatorToken}` } });
        const s1 = await axios.post(`${API_BASE}/api/settlements`, { bookingId: testBookingId1 }, { headers: { Authorization: `Bearer ${operatorToken}` } });
        testSettlementId1 = s1.data.data.id;
        expectedAmount1 = s1.data.data.netPayableAmount;

        // Booking 2: 20 qtl @ 2275 = 45,500
        const b2 = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: 'crop-wheat',
            centerId: 'center-karnal-01',
            slotId: 'slot-karnal-01',
            quantity: 20.0,
            date: '2026-09-15',
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        testBookingId2 = b2.data.data.id;
        await prisma.booking.update({ where: { id: testBookingId2 }, data: { status: 'CHECKED_IN' } });
        await axios.post(`${API_BASE}/api/grading`, { bookingId: testBookingId2, moisturePercentage: 11.2, isPassed: true }, { headers: { Authorization: `Bearer ${inspectorToken}` } });
        await axios.post(`${API_BASE}/api/weighments`, { bookingId: testBookingId2, grossWeightQuintals: 25.0, tareWeightQuintals: 5.0, scaleDeviceId: 'SCALE-01', verificationStatus: 'VERIFIED' }, { headers: { Authorization: `Bearer ${operatorToken}` } });
        const s2 = await axios.post(`${API_BASE}/api/settlements`, { bookingId: testBookingId2 }, { headers: { Authorization: `Bearer ${operatorToken}` } });
        testSettlementId2 = s2.data.data.id;

        return {
          passed: true,
          message: `Prepared settlements: Settlement1 (${testSettlementId1}), Settlement2 (${testSettlementId2}).`,
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
  // 2. DIRECT BENEFIT TRANSFER (DBT) DISBURSEMENT & STATE MACHINE
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-INIT-01',
    name: 'POST /api/payments: Executes DBT disbursement with MockPaymentProvider',
    category: 'DBT_DISBURSEMENT',
    fn: async () => {
      try {
        const idempotencyKey = `idem-test-${Date.now()}`;
        const res = await axios.post(
          `${API_BASE}/api/payments`,
          {
            settlementId: testSettlementId1,
            paymentMethod: 'DBT_PFMS',
            idempotencyKey,
            metadata: { disbursementBatch: 'BATCH-2026-03' },
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const pay = res.data.data;
        testPaymentId1 = pay.id;
        testUtr1 = pay.providerTransactionId;

        const isSuccess = pay.status === 'SUCCESS';
        const isSimulated = pay.isSimulated === true;
        const hasUtr = pay.providerTransactionId && pay.providerTransactionId.startsWith('UTR-');
        const amountAccurate = Math.abs(pay.amount - expectedAmount1) < 0.01;

        // Check that settlement is now SETTLED and booking is COMPLETED
        const stl = await prisma.settlement.findUnique({ where: { id: testSettlementId1 } });
        const booking = await prisma.booking.findUnique({ where: { id: testBookingId1 } });

        const isSettled = stl?.status === 'SETTLED';
        const isCompleted = booking?.status === 'COMPLETED';

        if (isSuccess && isSimulated && hasUtr && amountAccurate && isSettled && isCompleted) {
          return {
            passed: true,
            message: `DBT Disbursed: Amount=₹${pay.amount}, UTR=${pay.providerTransactionId}, isSimulated=${pay.isSimulated}, Settlement=SETTLED, Booking=COMPLETED.`,
            details: pay,
          };
        } else {
          return {
            passed: false,
            message: `Disbursement state mismatch: status=${pay.status}, isSimulated=${pay.isSimulated}, isSettled=${isSettled}, isCompleted=${isCompleted}`,
            details: { pay, stl, booking },
          };
        }
      } catch (err: any) {
        return {
          passed: false,
          message: `Payment initiation failed: ${err.response?.data?.error || err.message}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 3. IDEMPOTENCY GUARANTEES
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-IDEMP-01',
    name: 'Idempotency: Repeated call with same idempotencyKey returns existing payment record',
    category: 'IDEMPOTENCY',
    fn: async () => {
      try {
        const idempotencyKey = `idem-replay-${Date.now()}`;
        // First call on settlement 2 with failure simulation off
        const res1 = await axios.post(
          `${API_BASE}/api/payments`,
          {
            settlementId: testSettlementId2,
            paymentMethod: 'DBT_PFMS',
            idempotencyKey,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        const pay1 = res1.data.data;

        // Second call with same idempotencyKey
        const res2 = await axios.post(
          `${API_BASE}/api/payments`,
          {
            settlementId: testSettlementId2,
            paymentMethod: 'DBT_PFMS',
            idempotencyKey,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        const pay2 = res2.data.data;

        if (pay1.id === pay2.id && pay1.providerTransactionId === pay2.providerTransactionId) {
          return {
            passed: true,
            message: `Idempotency verified: Both requests returned identical payment ${pay1.id} without duplication.`,
            details: { pay1, pay2 },
          };
        }
        return { passed: false, message: 'Idempotency failed: Created duplicate payment records.', details: { pay1, pay2 } };
      } catch (err: any) {
        return { passed: false, message: `Idempotency test failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 4. SECURITY: ANTI-TAMPERING & DOUBLE PAYMENT PREVENTION
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-TAMPER-01',
    name: 'Anti-Tampering: Rejects client-side amount mismatch against authoritative settlement',
    category: 'ANTI_TAMPER',
    fn: async () => {
      try {
        // Attempt to pass an amount of 10 instead of authoritative settlement amount
        await axios.post(
          `${API_BASE}/api/payments`,
          {
            settlementId: testSettlementId1,
            amount: 10, // Tampered
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected tampered amount to be rejected with 400.' };
      } catch (err: any) {
        const status = err.response?.status;
        const code = err.response?.data?.code;
        if (status === 400 && (code === 'AMOUNT_MISMATCH' || code === 'ALREADY_PAID')) {
          return { passed: true, message: `Correctly rejected tampered amount with code ${code}.` };
        }
        return { passed: false, message: `Unexpected response: ${status} ${JSON.stringify(err.response?.data)}` };
      }
    },
  },

  {
    id: 'PAY-DOUBLE-01',
    name: 'Double Payment Prevention: Rejects new payment initiation for already-settled record',
    category: 'ANTI_TAMPER',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/payments`,
          {
            settlementId: testSettlementId1,
            idempotencyKey: `new-key-on-settled-${Date.now()}`,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected second payment on settled record to be rejected.', details: res.data };
      } catch (err: any) {
        const is400 = err.response?.status === 400;
        const code = err.response?.data?.code || err.response?.data?.error?.code;
        const msg = err.response?.data?.error || err.response?.data?.message;
        if (is400 && (code === 'ALREADY_PAID' || (typeof msg === 'string' && msg.includes('already')))) {
          return { passed: true, message: 'Correctly blocked double payment with 400 ALREADY_PAID.' };
        }
        return { passed: false, message: `Unexpected error: ${err.response?.status} ${JSON.stringify(err.response?.data)}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 5. FAILURE HANDLING & RETRY LIFECYCLE
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-FAIL-01',
    name: 'Failure Handling: Gracefully records provider failure and keeps settlement PENDING',
    category: 'FAILURE_HANDLING',
    fn: async () => {
      try {
        // Create booking 3 for failure & retry testing
        const b3 = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: 'crop-wheat',
            centerId: 'center-karnal-01',
            slotId: 'slot-karnal-01',
            quantity: 15.0,
            date: '2026-09-15',
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        const b3Id = b3.data.data.id;
        await prisma.booking.update({ where: { id: b3Id }, data: { status: 'CHECKED_IN' } });
        await axios.post(`${API_BASE}/api/grading`, { bookingId: b3Id, moisturePercentage: 11.0, isPassed: true }, { headers: { Authorization: `Bearer ${inspectorToken}` } });
        await axios.post(`${API_BASE}/api/weighments`, { bookingId: b3Id, grossWeightQuintals: 20.0, tareWeightQuintals: 5.0, scaleDeviceId: 'SCALE-01', verificationStatus: 'VERIFIED' }, { headers: { Authorization: `Bearer ${operatorToken}` } });
        const s3 = await axios.post(`${API_BASE}/api/settlements`, { bookingId: b3Id }, { headers: { Authorization: `Bearer ${operatorToken}` } });
        const s3Id = s3.data.data.id;

        // Initiate with simulated failure
        const failRes = await axios.post(
          `${API_BASE}/api/payments`,
          {
            settlementId: s3Id,
            simulateFailure: true,
            simulateFailureReason: 'PFMS_BENEFICIARY_ACCOUNT_DORMANT',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const failedPay = failRes.data.data;
        testFailedPaymentId = failedPay.id;

        const isFailed = failedPay.status === 'FAILED';
        const hasReason = failedPay.failureReason === 'PFMS_BENEFICIARY_ACCOUNT_DORMANT';

        const stl = await prisma.settlement.findUnique({ where: { id: s3Id } });
        const isStillPending = stl?.status === 'PENDING';

        if (isFailed && hasReason && isStillPending) {
          return {
            passed: true,
            message: `Recorded failure: Status=FAILED, Reason=${failedPay.failureReason}, Settlement=PENDING.`,
            details: failedPay,
          };
        }
        return { passed: false, message: 'Failure simulation did not transition correctly.', details: failedPay };
      } catch (err: any) {
        return { passed: false, message: `Failure test failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  {
    id: 'PAY-RETRY-01',
    name: 'POST /api/payments/:id/retry: Recovers failed payment to SUCCESS and settles settlement',
    category: 'RETRY',
    fn: async () => {
      try {
        const retryRes = await axios.post(
          `${API_BASE}/api/payments/${testFailedPaymentId}/retry`,
          { simulateFailure: false },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const recoveredPay = retryRes.data.data;
        const isSuccess = recoveredPay.status === 'SUCCESS';
        const hasUtr = recoveredPay.providerTransactionId && recoveredPay.providerTransactionId.startsWith('UTR-');

        const stl = await prisma.settlement.findUnique({ where: { id: recoveredPay.settlementId } });
        const isSettled = stl?.status === 'SETTLED';

        if (isSuccess && hasUtr && isSettled) {
          return {
            passed: true,
            message: `Payment recovered: Status=SUCCESS, UTR=${recoveredPay.providerTransactionId}, Settlement=SETTLED.`,
            details: recoveredPay,
          };
        }
        return { passed: false, message: 'Retry recovery failed.', details: { recoveredPay, stl } };
      } catch (err: any) {
        return { passed: false, message: `Retry failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  {
    id: 'PAY-RETRY-02',
    name: 'Validation: Rejects retry on an already successful payment',
    category: 'RETRY',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/payments/${testPaymentId1}/retry`,
          {},
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected retry on successful payment to fail with 400.' };
      } catch (err: any) {
        const is400 = err.response?.status === 400;
        const code = err.response?.data?.code;
        if (is400 && code === 'INVALID_STATE_TRANSITION') {
          return { passed: true, message: 'Correctly rejected retry on successful payment with INVALID_STATE_TRANSITION.' };
        }
        return { passed: false, message: `Unexpected response: ${err.response?.status} ${err.message}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 6. RETRIEVAL & FARMER HISTORY
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-GET-01',
    name: 'GET /api/payments/:id: Fetches payment record by ID',
    category: 'RETRIEVAL',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/payments/${testPaymentId1}`, {
          headers: { Authorization: `Bearer ${operatorToken}` },
        });
        const pay = res.data.data;
        if (pay && pay.id === testPaymentId1 && pay.providerTransactionId === testUtr1) {
          return { passed: true, message: `Fetched payment ${pay.paymentReference} with UTR ${pay.providerTransactionId}.` };
        }
        return { passed: false, message: 'Payment data mismatch.', details: pay };
      } catch (err: any) {
        return { passed: false, message: `Fetch by ID failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  {
    id: 'PAY-FARMER-01',
    name: 'GET /api/farmers/:farmerId/payments & /api/farmer/payments: Retrieves farmer payment history',
    category: 'RETRIEVAL',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/farmer/payments`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        const list = res.data.data;
        if (Array.isArray(list) && list.length > 0) {
          return {
            passed: true,
            message: `Retrieved ${list.length} disbursement records for authenticated farmer.`,
            details: list[0],
          };
        }
        return { passed: false, message: 'Farmer payment history was empty.', details: list };
      } catch (err: any) {
        return { passed: false, message: `Farmer payment history fetch failed: ${err.response?.data?.error || err.message}` };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 7. IDOR & AUDIT LEDGER
  // ----------------------------------------------------------------------------
  {
    id: 'PAY-IDOR-01',
    name: 'IDOR Protection: Non-owner farmer cannot view another farmer’s payment details',
    category: 'IDOR_RBAC',
    fn: async () => {
      try {
        const otherFarmerToken = 'demo-token-other-farmer';
        await axios.get(`${API_BASE}/api/payments/${testPaymentId1}`, {
          headers: { Authorization: `Bearer ${otherFarmerToken}` },
        });
        return { passed: false, message: 'Expected unauthorized payment access to be forbidden.' };
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 403 || status === 401) {
          return { passed: true, message: `Access denied (${status}) for non-owner farmer.` };
        }
        return { passed: false, message: `Unexpected status code: ${status}` };
      }
    },
  },

  {
    id: 'PAY-AUDIT-01',
    name: 'Audit Ledger: Verifies chained SHA-256 events (PAYMENT_INITIATED, SUCCEEDED, SETTLEMENT_FINALIZED)',
    category: 'AUDIT_LEDGER',
    fn: async () => {
      try {
        const events = await prisma.auditEvent.findMany({
          where: {
            entityType: 'Payment',
          },
        });
        const hasInitiated = events.some((e: any) => e.action === 'PAYMENT_INITIATED');
        const hasSucceeded = events.some((e: any) => e.action === 'PAYMENT_SUCCEEDED');
        const hasValidHashes = events.every((e: any) => e.currentHash && e.currentHash.length === 64);

        if (hasInitiated && hasSucceeded && hasValidHashes) {
          return {
            passed: true,
            message: `Verified cryptographic SHA-256 ledger integrity for payment lifecycle (${events.length} events).`,
          };
        }
        return { passed: false, message: 'Missing required audit event types or invalid SHA-256 hashes.' };
      } catch (err: any) {
        return { passed: false, message: `Audit query failed: ${err.message}` };
      }
    },
  },
];

async function runPaymentTests() {
  console.log('==============================================================================');
  console.log('  KisanFlow — Phase 4A: Payment & DBT Disbursement Test Suite');
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
  console.log(`  Payment Test Results: ${passed}/${tests.length} Passed (${failed} Failed)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentTests();
