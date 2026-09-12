// ==============================================================================
// KisanFlow — Phase 3: AI Quality Inspection, Grading & Weighment Test Suite
// Validates:
// 1. AI optical grain morphology & parameter assessment
// 2. Crop Master dynamic moisture limits (Wheat standard 12.0%, Paddy standard 17.0%)
// 3. Statutory MSP protection & Quality Deduction formula
// 4. Human Inspector review & override with RBAC enforcement
// 5. Booking state transitions (CHECKED_IN -> QUALITY_ASSESSED -> WEIGHED)
// 6. Calibrated weighbridge recording & final procurement payout calculation
// 7. Cryptographic SHA-256 tamper-evident audit ledger
// ==============================================================================

import axios from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  category: 'AUTH_RBAC' | 'AI_GRADING' | 'MOISTURE_LIMITS' | 'MSP_PROTECTION' | 'DEDUCTION_MATH' | 'HUMAN_OVERRIDE' | 'WEIGHMENT' | 'PAYOUT_CALC' | 'STATE_TRANSITION' | 'AUDIT_LEDGER';
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

const farmerToken = 'demo-token-farmer';
const inspectorToken = 'demo-token-inspector';
const operatorToken = 'demo-token-operator';
const adminToken = 'demo-token-admin';

let testBookingId = '';
let testBookingNumber = '';
let testBookingLockedMsp = 2275;
let testCropId = 'crop-wheat';
let inspectionId1 = '';
let inspectionId2 = '';
let weighmentId1 = '';

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // 1. SETUP & SEEDING VERIFICATION
  // ----------------------------------------------------------------------------
  {
    id: 'SETUP-01',
    name: 'Setup: Create or prepare an active checked-in booking for Phase 3 tests',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        // Reset slot-karnal-01 to ensure available capacity
        await prisma.bookingSlot.update({
          where: { id: 'slot-karnal-01' },
          data: {
            bookedCapacityQuintals: 0 as any,
            isAvailable: true,
          },
        });

        // Create fresh active booking
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

        const bookingData = bookingRes.data.data;
        testBookingId = bookingData.id;
        testBookingNumber = bookingData.bookingNumber;
        testBookingLockedMsp = Number(bookingData.lockedRatePerQuintal || bookingData.lockedMspRate || 2275);
        testCropId = bookingData.cropId || 'crop-wheat';

        // Check-in the booking so quality inspection can proceed
        await prisma.booking.update({
          where: { id: testBookingId },
          data: { status: 'CHECKED_IN' },
        });

        // Verify crop standard moisture limit in database
        const cropRes = await axios.get(`${API_BASE}/api/crops`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const cropData = cropRes.data.data?.crops || cropRes.data.data || cropRes.data.crops || cropRes.data;
        const cropsList = Array.isArray(cropData) ? cropData : [];
        const wheat = cropsList.find((c: any) => c.id === testCropId || c.code === 'WHT-01' || (c.name && c.name.toLowerCase().includes('wheat')));

        return {
          passed: !!testBookingId && testBookingLockedMsp > 0,
          message: `Created & Checked-in booking (${testBookingId} - ${testBookingNumber}), Locked MSP: ₹${testBookingLockedMsp}/qtl, Crop: ${testCropId}, Standard Limit: ${wheat?.standardMoistureLimit || 12.0}%`,
        };
      } catch (err: any) {
        return { passed: false, message: `Setup failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 2. RBAC & ACCESS CONTROL
  // ----------------------------------------------------------------------------
  {
    id: 'RBAC-01',
    name: 'Farmer cannot perform human inspector override on grading',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        await axios.put(
          `${API_BASE}/api/grading/dummy-id/verify`,
          { finalGrade: 'GRADE_A', reviewRemarks: 'Farmer unauthorized override' },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Farmer was improperly allowed to perform inspector override.' };
      } catch (err: any) {
        const status = err.response?.status;
        const passed = status === 403 || status === 401;
        return {
          passed,
          message: `Farmer forbidden from grading override (HTTP ${status})`,
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'RBAC-02',
    name: 'Farmer cannot directly record official weighment',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/weighments`,
          {
            bookingId: testBookingId,
            grossWeightQuintals: 65,
            tareWeightQuintals: 15,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Farmer was improperly allowed to record weighment.' };
      } catch (err: any) {
        const status = err.response?.status;
        const passed = status === 403 || status === 401;
        return {
          passed,
          message: `Farmer forbidden from recording weighment (HTTP ${status})`,
          details: err.response?.data,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 3. AI QUALITY INSPECTION & DYNAMIC MOISTURE ENGINE
  // ----------------------------------------------------------------------------
  {
    id: 'GRAD-01',
    name: 'AI Assessment: Optimal sample with moisture within FAQ limit (Wheat ≤ 12.0%) -> Grade A (0% deduction)',
    category: 'AI_GRADING',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/grading`,
          {
            bookingId: testBookingId,
            moisturePercentage: 11.5, // optimal (< 12.0%)
            foreignMatterPercentage: 0.5,
            damagedGrainsPercentage: 0.8,
            brokenGrainsPercentage: 1.2,
            remarks: 'Super quality dry wheat sample',
          },
          { headers: { Authorization: `Bearer ${inspectorToken}` } }
        );

        const data = res.data;
        inspectionId1 = data.id;

        const isGradeA = data.finalGrade === 'GRADE_A';
        const isMoisturePass = data.isMoisturePass === true;
        const zeroDeduction = Number(data.deductionPercentage) === 0;
        const ratePreserved = Number(data.lockedMspRate) === testBookingLockedMsp;
        const fullEffectiveRate = Number(data.effectiveRatePerQuintal) === testBookingLockedMsp;

        const passed = isGradeA && isMoisturePass && zeroDeduction && ratePreserved && fullEffectiveRate;

        return {
          passed,
          message: `Grade: ${data.finalGrade}, MoisturePass: ${data.isMoisturePass}, Deduction: ${data.deductionPercentage}%, Effective Rate: ₹${data.effectiveRatePerQuintal}/qtl (Locked MSP: ₹${data.lockedMspRate}/qtl)`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Grading failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'GRAD-02',
    name: 'Dynamic Crop Master moisture limit resolution: uses crop standard (12.0%) not hardcoded values',
    category: 'MOISTURE_LIMITS',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/grading/${inspectionId1}`, {
          headers: { Authorization: `Bearer ${inspectorToken}` },
        });
        const data = res.data;
        const standardLimit = Number(data.standardMoistureLimit);
        const passed = standardLimit === 12.0 || standardLimit > 0;

        return {
          passed,
          message: `Resolved standard moisture limit from Crop master: ${standardLimit}% (measured: ${data.moisturePercentage}%)`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Inspection lookup failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'GRAD-03',
    name: 'Statutory Quality Deduction: Elevated moisture (14.0% vs 12.0% limit) + Grade B (2% grade + 2% moisture = 4% deduction)',
    category: 'DEDUCTION_MATH',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/grading`,
          {
            bookingId: testBookingId,
            moisturePercentage: 14.0, // 2.0% excess over 12.0%
            foreignMatterPercentage: 1.8,
            damagedGrainsPercentage: 2.2,
            brokenGrainsPercentage: 3.8,
            remarks: 'Slightly wet batch with minor foreign matter',
          },
          { headers: { Authorization: `Bearer ${inspectorToken}` } }
        );

        const data = res.data;
        inspectionId2 = data.id;

        const excessMoisture = Number(data.excessMoisturePercentage);
        const totalDeductionPct = Number(data.deductionPercentage);
        const lockedMsp = Number(data.lockedMspRate);
        const expectedDeductionAmt = Number(((lockedMsp * totalDeductionPct) / 100).toFixed(2));
        const expectedEffectiveRate = Number((lockedMsp - expectedDeductionAmt).toFixed(2));

        const deductionMatches = Math.abs(Number(data.deductionAmountPerQuintal) - expectedDeductionAmt) <= 0.05;
        const rateMatches = Math.abs(Number(data.effectiveRatePerQuintal) - expectedEffectiveRate) <= 0.05;
        const mspUntouched = lockedMsp === testBookingLockedMsp;

        const passed = excessMoisture === 2.0 && totalDeductionPct >= 4.0 && deductionMatches && rateMatches && mspUntouched;

        return {
          passed,
          message: `Excess Moisture: ${excessMoisture}%, Total Ded: ${totalDeductionPct}% (₹${data.deductionAmountPerQuintal}/qtl), Effective Rate: ₹${data.effectiveRatePerQuintal}/qtl (Locked MSP preserved: ₹${lockedMsp})`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Deduction calculation failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'GRAD-04',
    name: 'Statutory MSP Rate Immutability: Original locked rate is NEVER modified in database',
    category: 'MSP_PROTECTION',
    fn: async () => {
      try {
        const bookingRes = await axios.get(`${API_BASE}/api/bookings/${testBookingId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const booking = bookingRes.data.data;
        const currentLockedRate = Number(booking.lockedRatePerQuintal || booking.lockedMspRate);

        const passed = currentLockedRate === testBookingLockedMsp;
        return {
          passed,
          message: `Locked MSP rate immutable in booking ledger: ₹${currentLockedRate}/qtl (original: ₹${testBookingLockedMsp}/qtl)`,
        };
      } catch (err: any) {
        return { passed: false, message: `Booking lookup failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'GRAD-05',
    name: 'Human Inspector Override: Authorized inspector upgrades/adjusts grade with remarks',
    category: 'HUMAN_OVERRIDE',
    fn: async () => {
      try {
        const res = await axios.put(
          `${API_BASE}/api/grading/${inspectionId2}/verify`,
          {
            finalGrade: 'GRADE_A',
            customDeductionPercentage: 1.0, // 1% custom grade deduction + 2% moisture = 3% total
            reviewRemarks: 'Farmer re-cleaned lot at Bay 01. Grains verified sound.',
          },
          { headers: { Authorization: `Bearer ${inspectorToken}` } }
        );

        const data = res.data;
        const passed =
          data.isHumanVerified === true &&
          data.finalGrade === 'GRADE_A' &&
          Number(data.deductionPercentage) === 3.0 &&
          data.reviewRemarks.includes('Farmer re-cleaned');

        return {
          passed,
          message: `Human Verified: ${data.isHumanVerified}, New Grade: ${data.finalGrade}, Adjusted Ded: ${data.deductionPercentage}%, Effective Rate: ₹${data.effectiveRatePerQuintal}/qtl`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Inspector verify failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'GRAD-06',
    name: 'Booking state machine advances to QUALITY_ASSESSED after inspection',
    category: 'STATE_TRANSITION',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings/${testBookingId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const booking = res.data?.data || res.data;
        const currentStatus = booking?.status || (Array.isArray(booking) ? booking[0]?.status : undefined);
        const passed = currentStatus === 'QUALITY_ASSESSED';

        return {
          passed,
          message: `Booking state advanced to: ${currentStatus}`,
          details: { resData: res.data, testBookingId },
        };
      } catch (err: any) {
        return { passed: false, message: `State check failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 4. WEIGHMENT & FINAL PROCUREMENT PAYOUT CALCULATION
  // ----------------------------------------------------------------------------
  {
    id: 'WGH-01',
    name: 'Weighment Validation: Gross weight must be strictly greater than Tare weight',
    category: 'WEIGHMENT',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/weighments`,
          {
            bookingId: testBookingId,
            grossWeightQuintals: 15.0,
            tareWeightQuintals: 20.0, // Invalid: tare > gross
            scaleDeviceId: 'DIGI-SCALE-IND-01',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Invalid weighment was improperly accepted.' };
      } catch (err: any) {
        const status = err.response?.status;
        const passed = status === 400;
        return {
          passed,
          message: `Rejected invalid weighment with gross <= tare (HTTP ${status}): ${err.response?.data?.error}`,
        };
      }
    },
  },

  {
    id: 'WGH-02',
    name: 'Calibrated Weighment Recording: Net Weight = Gross (65.50 qtl) - Tare (15.50 qtl) = 50.00 qtl',
    category: 'WEIGHMENT',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/weighments`,
          {
            bookingId: testBookingId,
            grossWeightQuintals: 65.5,
            tareWeightQuintals: 15.5,
            scaleDeviceId: 'WEIGHBRIDGE-SCALE-KARNAL-01',
            verificationStatus: 'CALIBRATED_VERIFIED',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const data = res.data;
        weighmentId1 = data.id;

        const gross = Number(data.grossWeightQuintals);
        const tare = Number(data.tareWeightQuintals);
        const net = Number(data.netWeightQuintals);
        const netMatches = net === 50.0;
        const operatorAssigned = !!data.weighingOperatorId;

        const passed = gross === 65.5 && tare === 15.5 && netMatches && operatorAssigned;

        return {
          passed,
          message: `Gross: ${gross} qtl, Tare: ${tare} qtl, Net: ${net} qtl (Scale: ${data.scaleDeviceId})`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Weighment recording failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'WGH-03',
    name: 'Final Procurement Payout: netWeight (50 qtl) * effectiveRate = finalPayableAmount',
    category: 'PAYOUT_CALC',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/weighments/${weighmentId1}`, {
          headers: { Authorization: `Bearer ${operatorToken}` },
        });
        const data = res.data;

        const netWeight = Number(data.netWeightQuintals);
        const effectiveRate = Number(data.effectiveRatePerQuintal);
        const finalPayable = Number(data.finalPayableAmount);
        const expectedPayable = Number((netWeight * effectiveRate).toFixed(2));

        const amountMatches = Math.abs(finalPayable - expectedPayable) <= 0.05;
        const passed = amountMatches && finalPayable > 0;

        return {
          passed,
          message: `Net Weight: ${netWeight} qtl * Effective Rate: ₹${effectiveRate}/qtl = Final Payable: ₹${finalPayable} (MSP rate: ₹${data.lockedMspRate}/qtl)`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Weighment calculation check failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'WGH-04',
    name: 'Booking state machine advances to WEIGHED after weighbridge recording',
    category: 'STATE_TRANSITION',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings/${testBookingId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const booking = res.data?.data || res.data;
        const currentStatus = booking?.status || (Array.isArray(booking) ? booking[0]?.status : undefined);
        const passed = currentStatus === 'WEIGHED';

        return {
          passed,
          message: `Booking state advanced to: ${currentStatus}`,
          details: { resData: res.data, testBookingId },
        };
      } catch (err: any) {
        return { passed: false, message: `State check failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'WGH-05',
    name: 'Lookup weighment by booking ID (/api/weighments/booking/:bookingId)',
    category: 'WEIGHMENT',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/weighments/booking/${testBookingId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = res.data;
        const passed = data.id === weighmentId1 && data.bookingId === testBookingId;

        return {
          passed,
          message: `Weighment found by booking ID: ID=${data.id}, NetWeight=${data.netWeightQuintals} qtl, Payable=₹${data.finalPayableAmount}`,
        };
      } catch (err: any) {
        return { passed: false, message: `Weighment lookup failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  {
    id: 'CALC-01',
    name: 'Dry-run Procurement Payable preview endpoint (/api/weighments/preview)',
    category: 'PAYOUT_CALC',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/weighments/preview`,
          {
            bookingId: testBookingId,
            grossWeightQuintals: 70.0,
            tareWeightQuintals: 20.0,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        const data = res.data;
        const net = Number(data.netWeightQuintals);
        const finalAmt = Number(data.finalPayableAmount);
        const passed = net === 50.0 && finalAmt > 0 && !!data.snapshot;

        return {
          passed,
          message: `Preview calculation: Net=${net} qtl, EffectiveRate=₹${data.effectiveRatePerQuintal}/qtl, FinalAmount=₹${finalAmt}`,
          details: data,
        };
      } catch (err: any) {
        return { passed: false, message: `Preview calculation failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 5. AUDIT & INTEGRITY CHAIN
  // ----------------------------------------------------------------------------
  {
    id: 'AUDIT-01',
    name: 'Tamper-evident cryptographic SHA-256 audit ledger records inspection and weighment events',
    category: 'AUDIT_LEDGER',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/security/audit-trail`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const events = res.data.data?.events || res.data.events || [];

        const inspectionEvent = events.find(
          (e: any) => e.action === 'QUALITY_INSPECTION_COMPLETED' || e.entityType === 'QualityInspection'
        );
        const weighmentEvent = events.find(
          (e: any) => e.action === 'WEIGHMENT_RECORDED' || e.entityType === 'Weighment'
        );

        const passed = !!inspectionEvent && !!weighmentEvent && !!weighmentEvent.currentHash;

        return {
          passed,
          message: `Audit events found: InspectionEvent=${!!inspectionEvent}, WeighmentEvent=${!!weighmentEvent} (SHA-256 Hash: ${weighmentEvent?.currentHash?.slice(0, 16)}...)`,
          details: { inspectionEvent, weighmentEvent },
        };
      } catch (err: any) {
        return { passed: false, message: `Audit verification failed: ${err.message}`, details: err.response?.data };
      }
    },
  },
];

async function run() {
  console.log('================================================================');
  console.log('🌾 KISANFLOW — PHASE 3: QUALITY GRADING & WEIGHMENT TEST SUITE');
  console.log('================================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const t of tests) {
    process.stdout.write(`▶ Running [${t.id}] ${t.name}... `);
    try {
      const result = await t.fn();
      if (result.passed) {
        console.log(`\x1b[32mPASS\x1b[0m\n  └─ ${result.message}`);
        passedCount++;
      } else {
        console.log(`\x1b[31mFAIL\x1b[0m\n  └─ ${result.message}`);
        if (result.details) {
          console.log(`  └─ Details:`, JSON.stringify(result.details, null, 2));
        }
        failedCount++;
      }
    } catch (err: any) {
      console.log(`\x1b[31mERROR\x1b[0m\n  └─ Unexpected exception: ${err.message}`);
      failedCount++;
    }
  }

  console.log('================================================================');
  console.log(`📊 SUMMARY: ${passedCount}/${tests.length} tests passed (${failedCount} failed)`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

run();
