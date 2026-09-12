// ==============================================================================
// KisanFlow — Smart Procurement Booking & MSP Lock Verification Test Suite
// Validates BOOK-01 through BOOK-40: capacity reservation, MSP locking, token generation,
// RBAC, IDOR protection, state machine transitions, cancellation, and persistence
// ==============================================================================

import axios, { AxiosError } from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  category: 'AUTH_RBAC' | 'VALIDATION' | 'CAPACITY' | 'MSP_LOCK' | 'TOKEN' | 'IDOR' | 'STATE_MACHINE' | 'CANCELLATION' | 'PERSISTENCE';
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

let farmerToken = 'demo-token-farmer';
let farmerUserId = 'user-demo-farmer-01';
let farmerProfileId = 'prof-farmer-01';
let primaryFarmId = 'farm-farmer-01';

let otherFarmerToken = 'demo-token-farmer2';
let otherFarmerProfileId = 'prof-farmer-02';

let officialToken = 'demo-token-admin';
let inspectorToken = 'demo-token-inspector';

let testCenterId = 'center-karnal-01';
let testBayId = 'bay-karnal-01';
let testSlotId = 'slot-karnal-01';
let testSlot2Id = 'slot-karnal-02';
let testSlotFullId = 'slot-karnal-full';
let testCropId = 'crop-wheat';

let createdBookingId = '';
let createdBookingNumber = '';
let createdTokenNumber = '';
let createdSecurePin = '';
let createdLockedMspRate = 0;
let transitionBookingId = '';

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // SETUP & AUTHENTICATION
  // ----------------------------------------------------------------------------
  {
    id: 'SETUP-01',
    name: 'Setup: Verify Primary Farmer, Second Farmer, and Procurement Official identities',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        // Verify Primary Farmer profile
        const profRes = await axios.get(`${API_BASE}/api/farmer/profile`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        farmerProfileId = profRes.data.data.id || profRes.data.data.farmerProfile?.id || 'prof-farmer-01';

        // Verify farmer's farm
        const farmsRes = await axios.get(`${API_BASE}/api/farmer/farms`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        if (farmsRes.data.data.farms && farmsRes.data.data.farms.length > 0) {
          primaryFarmId = farmsRes.data.data.farms[0].id;
        }

        // Verify second farmer profile
        const otherProfRes = await axios.get(`${API_BASE}/api/farmer/profile`, {
          headers: { Authorization: `Bearer ${otherFarmerToken}` },
        });
        otherFarmerProfileId = otherProfRes.data.data.id || otherProfRes.data.data.farmerProfile?.id || 'prof-farmer-02';

        // Reset test slot 2 to fresh state for capacity tests
        await prisma.bookingSlot.update({
          where: { id: testSlot2Id },
          data: {
            bookedCapacityQuintals: 0 as any,
            isAvailable: true,
          },
        });

        return {
          passed: !!(farmerToken && otherFarmerToken && officialToken && farmerProfileId),
          message: 'All test actors verified successfully',
        };
      } catch (err: any) {
        return { passed: false, message: `Setup failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // AUTH & RBAC ENFORCEMENT
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-01',
    name: 'Unauthenticated POST /api/bookings rejected with 401 UNAUTHORIZED',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        await axios.post(`${API_BASE}/api/bookings`, {
          cropId: testCropId,
          centerId: testCenterId,
          slotId: testSlotId,
          quantity: 50,
        });
        return { passed: false, message: 'Expected 401 for unauthenticated booking' };
      } catch (err: any) {
        const status = err.response?.status;
        return {
          passed: status === 401,
          message: `Correctly returned status ${status}`,
        };
      }
    },
  },
  {
    id: 'BOOK-02',
    name: 'Non-farmer role (Procurement Inspector) rejected with 403 FORBIDDEN on booking creation',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            slotId: testSlotId,
            quantity: 50,
          },
          { headers: { Authorization: `Bearer ${officialToken}` } }
        );
        return { passed: false, message: 'Expected 403 for non-farmer booking creation' };
      } catch (err: any) {
        const status = err.response?.status;
        return {
          passed: status === 403,
          message: `Correctly returned status ${status} FORBIDDEN`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // INPUT VALIDATION & CONSTRAINTS
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-03',
    name: 'Booking with missing cropId or centerId rejected with 400 validation error',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            quantity: 50,
            slotId: testSlotId,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 400 for missing required fields' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 400,
          message: `Correctly returned 400 for missing fields`,
        };
      }
    },
  },
  {
    id: 'BOOK-04',
    name: 'Booking with zero or negative quantity rejected with 400',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            slotId: testSlotId,
            quantity: -10,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 400 for negative quantity' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 400,
          message: `Correctly returned 400 for negative quantity`,
        };
      }
    },
  },
  {
    id: 'BOOK-05',
    name: 'Booking with excessive decimal precision (>2 decimals) rejected with 400',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            slotId: testSlotId,
            quantity: 50.12345,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 400 for excessive decimal precision' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 400,
          message: `Correctly returned 400 for decimal precision violation`,
        };
      }
    },
  },
  {
    id: 'BOOK-06',
    name: 'Booking with non-existent cropId rejected with 404 CROP_NOT_FOUND',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: 'crop-non-existent-999',
            centerId: testCenterId,
            slotId: testSlotId,
            quantity: 50,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 404 for non-existent crop' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 404 && err.response?.data?.error?.code === 'CROP_NOT_FOUND',
          message: `Correctly returned 404 CROP_NOT_FOUND`,
        };
      }
    },
  },
  {
    id: 'BOOK-07',
    name: 'Booking with non-existent centerId rejected with 404 CENTER_NOT_FOUND',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: 'center-non-existent-999',
            slotId: testSlotId,
            quantity: 50,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 404 for non-existent center' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 404 && err.response?.data?.error?.code === 'CENTER_NOT_FOUND',
          message: `Correctly returned 404 CENTER_NOT_FOUND`,
        };
      }
    },
  },
  {
    id: 'BOOK-08',
    name: 'Booking with mismatched slot and center rejected with 400 SLOT_CENTER_MISMATCH',
    category: 'VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: 'center-ludhiana-02', // Mismatched: Slot belongs to Karnal
            bookingSlotId: testSlotId,
            quantity: 50,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 400 for slot-center mismatch' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 400 && err.response?.data?.error?.code === 'SLOT_CENTER_MISMATCH',
          message: `Correctly returned 400 SLOT_CENTER_MISMATCH`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CORE BOOKING CREATION, CAPACITY RESERVATION & MSP RATE LOCK
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-09',
    name: 'Successful booking creates reservation, generates token/PIN, and locks statutory MSP',
    category: 'MSP_LOCK',
    fn: async () => {
      try {
        // First check initial slot capacity
        const slotBeforeRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlotId}`);
        const initBooked = slotBeforeRes.data.data.bookedCapacityQuintals;
        const initRemaining = slotBeforeRes.data.data.remainingCapacityQuintals;

        const bookingRes = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            centerBayId: testBayId,
            bookingSlotId: testSlotId,
            farmId: primaryFarmId,
            quantity: 60.5,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );

        if (bookingRes.status !== 201 || !bookingRes.data.success) {
          return { passed: false, message: 'Failed to create booking', details: bookingRes.data };
        }

        const data = bookingRes.data.data;
        createdBookingId = data.id;
        createdBookingNumber = data.bookingNumber;
        createdTokenNumber = data.tokenNumber;
        createdSecurePin = data.securePin;
        createdLockedMspRate = data.lockedRatePerQuintal;

        // Verify slot booked capacity increased by exactly 60.5
        const slotAfterRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlotId}`);
        const afterBooked = slotAfterRes.data.data.bookedCapacityQuintals;

        const capacityReservedCorrectly = Math.abs(afterBooked - (initBooked + 60.5)) < 0.01;
        const hasValidToken = /^KF-\d{4}-\d{6}$/.test(data.tokenNumber);
        const hasValidPin = /^\d{6}$/.test(data.securePin);
        const hasMspLocked = data.lockedRatePerQuintal === 2275; // Wheat statutory MSP
        const hasGuaranteedPayout = Math.abs(data.totalGuaranteedPayout - (60.5 * 2275)) < 0.1;
        const hasQrSig = typeof data.qrCodeSignature === 'string' && data.qrCodeSignature.length > 10;

        return {
          passed: capacityReservedCorrectly && hasValidToken && hasValidPin && hasMspLocked && hasGuaranteedPayout && hasQrSig,
          message: `Booking created (${data.bookingNumber}), Token: ${data.tokenNumber}, PIN: ${data.securePin}, MSP: ₹${data.lockedRatePerQuintal}/Qtl, Total Payout: ₹${data.totalGuaranteedPayout}`,
        };
      } catch (err: any) {
        return { passed: false, message: `Booking creation failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // DEDICATED TOKEN & GATE PASS ENDPOINT
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-10',
    name: 'GET /api/bookings/:bookingId/token returns gate pass with token, PIN, and QR signature',
    category: 'TOKEN',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings/${createdBookingId}/token`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });

        const d = res.data.data;
        const valid =
          res.status === 200 &&
          d.tokenNumber === createdTokenNumber &&
          d.securePin === createdSecurePin &&
          d.farmer.id === farmerProfileId &&
          d.procurementCenter.id === testCenterId &&
          d.lockedRatePerQuintal === 2275;

        return {
          passed: valid,
          message: `Gate token retrieved: Token=${d.tokenNumber}, PIN=${d.securePin}, Farmer=${d.farmer.name}`,
        };
      } catch (err: any) {
        return { passed: false, message: `Failed to retrieve gate token: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // DEDICATED MSP LOCK & PRICE PROTECTION ENDPOINT
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-11',
    name: 'GET /api/bookings/:bookingId/msp returns locked statutory MSP snapshot & comparison',
    category: 'MSP_LOCK',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings/${createdBookingId}/msp`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });

        const d = res.data.data;
        const valid =
          res.status === 200 &&
          d.lockedRatePerQuintal === 2275 &&
          d.marketingYear === 2026 &&
          d.isLockValid === true &&
          d.comparison?.priceProtected === true;

        return {
          passed: valid,
          message: `MSP snapshot verified: Rate=₹${d.lockedRatePerQuintal}/Qtl, Year=${d.marketingYear}, Season=${d.season}`,
        };
      } catch (err: any) {
        return { passed: false, message: `Failed to retrieve MSP lock: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CAPACITY ENFORCEMENT & OVER-CAPACITY PREVENTION
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-12',
    name: 'Booking exceeding remaining slot capacity is rejected with 400 INSUFFICIENT_SLOT_CAPACITY',
    category: 'CAPACITY',
    fn: async () => {
      try {
        // Query remaining capacity on slot 2
        const slotRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlot2Id}`);
        const remaining = slotRes.data.data.remainingCapacityQuintals;

        // Try to book remaining + 50 quintals
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            centerBayId: testBayId,
            bookingSlotId: testSlot2Id,
            quantity: remaining + 50,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );

        return { passed: false, message: 'Expected 400 for over-capacity booking' };
      } catch (err: any) {
        const code = err.response?.data?.error?.code;
        return {
          passed: err.response?.status === 400 && code === 'INSUFFICIENT_SLOT_CAPACITY',
          message: `Correctly rejected with code ${code}`,
        };
      }
    },
  },
  {
    id: 'BOOK-13',
    name: 'Booking exact remaining capacity succeeds and marks slot as unavailable',
    category: 'CAPACITY',
    fn: async () => {
      try {
        // Get current remaining on slot 2
        const slotRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlot2Id}`);
        const remaining = slotRes.data.data.remainingCapacityQuintals;

        // Book exact remaining
        const bookRes = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            centerBayId: testBayId,
            bookingSlotId: testSlot2Id,
            quantity: remaining,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );

        // Check slot status
        const slotAfterRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlot2Id}`);
        const afterSlot = slotAfterRes.data.data;

        const isFull = afterSlot.remainingCapacityQuintals === 0 && afterSlot.isAvailable === false;
        return {
          passed: bookRes.status === 201 && isFull,
          message: `Slot filled to 100% capacity (Remaining: ${afterSlot.remainingCapacityQuintals} Qtl, isAvailable: ${afterSlot.isAvailable})`,
        };
      } catch (err: any) {
        return { passed: false, message: `Exact capacity booking failed: ${err.message}`, details: err.response?.data };
      }
    },
  },
  {
    id: 'BOOK-14',
    name: 'Subsequent booking on fully booked slot is rejected with 400 SLOT_UNAVAILABLE',
    category: 'CAPACITY',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            centerBayId: testBayId,
            bookingSlotId: testSlot2Id,
            quantity: 10,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 400 for full slot' };
      } catch (err: any) {
        const code = err.response?.data?.error?.code;
        return {
          passed: err.response?.status === 400 && (code === 'SLOT_UNAVAILABLE' || code === 'INSUFFICIENT_SLOT_CAPACITY'),
          message: `Correctly rejected booking on full slot with ${code}`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // IDOR & OWNERSHIP ISOLATION
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-15',
    name: 'IDOR Protection: Second farmer cannot retrieve first farmer booking via GET /api/bookings/:id',
    category: 'IDOR',
    fn: async () => {
      try {
        await axios.get(`${API_BASE}/api/bookings/${createdBookingId}`, {
          headers: { Authorization: `Bearer ${otherFarmerToken}` },
        });
        return { passed: false, message: 'Expected 404 IDOR block for unauthorized farmer' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 404,
          message: `Correctly returned 404 protecting against IDOR exploit`,
        };
      }
    },
  },
  {
    id: 'BOOK-16',
    name: 'IDOR Protection: Second farmer cannot cancel first farmer booking',
    category: 'IDOR',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings/${createdBookingId}/cancel`,
          { cancellationReason: 'Malicious attempt' },
          { headers: { Authorization: `Bearer ${otherFarmerToken}` } }
        );
        return { passed: false, message: 'Expected 404 for unauthorized cancellation' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 404,
          message: `Correctly blocked unauthorized cancellation with 404`,
        };
      }
    },
  },
  {
    id: 'BOOK-17',
    name: 'GET /api/bookings isolates list so farmer only sees their own reservations',
    category: 'IDOR',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings`, {
          headers: { Authorization: `Bearer ${otherFarmerToken}` },
        });

        const list = res.data.data;
        const containsOtherFarmerBooking = list.some((b: any) => b.id === createdBookingId);

        return {
          passed: res.status === 200 && !containsOtherFarmerBooking,
          message: `Farmer booking list is strictly isolated (Count: ${list.length}, no cross-leakage)`,
        };
      } catch (err: any) {
        return { passed: false, message: `Failed to list bookings: ${err.message}`, details: err.response?.data };
      }
    },
  },
  {
    id: 'BOOK-18',
    name: 'Official role can list and filter bookings across centers and crops',
    category: 'AUTH_RBAC',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings?centerId=${testCenterId}`, {
          headers: { Authorization: `Bearer ${officialToken}` },
        });

        const list = res.data.data;
        const hasBooking = list.some((b: any) => b.id === createdBookingId);

        return {
          passed: res.status === 200 && list.length > 0 && hasBooking,
          message: `Official retrieved center bookings (Total: ${list.length})`,
        };
      } catch (err: any) {
        return { passed: false, message: `Official listing failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // SINGLE RETRIEVAL BY MULTIPLE IDENTIFIERS
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-19',
    name: 'GET /api/bookings/:id resolves by primary UUID, bookingNumber, or tokenNumber',
    category: 'VALIDATION',
    fn: async () => {
      try {
        const byId = await axios.get(`${API_BASE}/api/bookings/${createdBookingId}`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        const byNum = await axios.get(`${API_BASE}/api/bookings/${createdBookingNumber}`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });
        const byTok = await axios.get(`${API_BASE}/api/bookings/${createdTokenNumber}`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });

        const allMatch =
          byId.data.data.id === createdBookingId &&
          byNum.data.data.id === createdBookingId &&
          byTok.data.data.id === createdBookingId;

        return {
          passed: allMatch,
          message: `Booking resolved successfully via ID (${createdBookingId}), Number (${createdBookingNumber}), and Token (${createdTokenNumber})`,
        };
      } catch (err: any) {
        return { passed: false, message: `Lookup failed: ${err.message}`, details: err.response?.data };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // STATE MACHINE TRANSITIONS & LIFECYCLE
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-20',
    name: 'Valid state transition: CONFIRMED -> CHECKED_IN via PATCH /api/bookings/:id',
    category: 'STATE_MACHINE',
    fn: async () => {
      try {
        // Create dedicated booking for lifecycle transition test
        const bRes = await axios.post(
          `${API_BASE}/api/bookings`,
          {
            cropId: testCropId,
            centerId: testCenterId,
            centerBayId: testBayId,
            bookingSlotId: testSlotId,
            farmId: primaryFarmId,
            quantity: 20,
          },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        transitionBookingId = bRes.data.data.id;

        const res = await axios.patch(
          `${API_BASE}/api/bookings/${transitionBookingId}`,
          { status: 'CHECKED_IN' },
          { headers: { Authorization: `Bearer ${officialToken}` } }
        );

        return {
          passed: res.status === 200 && res.data.data.status === 'CHECKED_IN',
          message: `Booking status updated to ${res.data.data?.status}`,
        };
      } catch (err: any) {
        return { passed: false, message: `Update failed: ${err.message}`, details: err.response?.data };
      }
    },
  },
  {
    id: 'BOOK-21',
    name: 'Invalid state transition: CHECKED_IN -> COMPLETED (skipping queue/processing) rejected with 400',
    category: 'STATE_MACHINE',
    fn: async () => {
      try {
        await axios.patch(
          `${API_BASE}/api/bookings/${transitionBookingId}`,
          { status: 'COMPLETED' },
          { headers: { Authorization: `Bearer ${officialToken}` } }
        );
        return { passed: false, message: 'Expected 400 for invalid state transition' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 400 && err.response?.data?.error?.code === 'INVALID_STATE_TRANSITION',
          message: `Correctly rejected invalid state transition with 400 INVALID_STATE_TRANSITION`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // CANCELLATION & CAPACITY RELEASE WORKFLOW
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-22',
    name: 'POST /api/bookings/:id/cancel cancels booking, releases slot capacity, and preserves MSP snapshot',
    category: 'CANCELLATION',
    fn: async () => {
      try {
        // Check slot booked capacity before cancellation
        const slotBeforeRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlotId}`);
        const bookedBefore = slotBeforeRes.data.data.bookedCapacityQuintals;

        const cancelRes = await axios.post(
          `${API_BASE}/api/bookings/${createdBookingId}/cancel`,
          { cancellationReason: 'Inclement weather delay' },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );

        if (cancelRes.status !== 200 || !cancelRes.data.success) {
          return { passed: false, message: 'Cancellation endpoint failed', details: cancelRes.data };
        }

        const data = cancelRes.data.data;

        // Check slot booked capacity after cancellation
        const slotAfterRes = await axios.get(`${API_BASE}/api/centers/slots/${testSlotId}`);
        const bookedAfter = slotAfterRes.data.data.bookedCapacityQuintals;

        const capacityReleased = Math.abs(bookedBefore - bookedAfter - 60.5) < 0.01;
        const statusIsCancelled = data.status === 'CANCELLED';
        const mspPreserved = data.lockedRatePerQuintal === 2275;
        const tokenPreserved = data.tokenNumber === createdTokenNumber;

        return {
          passed: capacityReleased && statusIsCancelled && mspPreserved && tokenPreserved,
          message: `Booking cancelled, 60.5 Qtl released back to slot (Slot booked: ${bookedBefore} -> ${bookedAfter}), MSP & Token preserved`,
        };
      } catch (err: any) {
        return { passed: false, message: `Cancellation failed: ${err.message}`, details: err.response?.data };
      }
    },
  },
  {
    id: 'BOOK-23',
    name: 'Duplicate cancellation on already cancelled booking returns 400 ALREADY_CANCELLED',
    category: 'CANCELLATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/bookings/${createdBookingId}/cancel`,
          { cancellationReason: 'Second try' },
          { headers: { Authorization: `Bearer ${farmerToken}` } }
        );
        return { passed: false, message: 'Expected 400 for duplicate cancellation' };
      } catch (err: any) {
        return {
          passed: err.response?.status === 400 && err.response?.data?.error?.code === 'ALREADY_CANCELLED',
          message: `Correctly returned 400 ALREADY_CANCELLED`,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // PERSISTENCE & DATA INTEGRITY
  // ----------------------------------------------------------------------------
  {
    id: 'BOOK-24',
    name: 'Booking record persists in storage and remains accessible across queries',
    category: 'PERSISTENCE',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/bookings/${createdBookingId}`, {
          headers: { Authorization: `Bearer ${farmerToken}` },
        });

        const d = res.data.data;
        const valid =
          res.status === 200 &&
          d.id === createdBookingId &&
          d.status === 'CANCELLED' &&
          d.tokenNumber === createdTokenNumber &&
          d.cancellationReason === 'Inclement weather delay';

        return {
          passed: valid,
          message: `Persistent booking verified: ID=${d.id}, Status=${d.status}, Token=${d.tokenNumber}`,
        };
      } catch (err: any) {
        return { passed: false, message: `Persistence check failed: ${err.message}`, details: err.response?.data };
      }
    },
  },
];

async function run() {
  console.log('================================================================');
  console.log('🌾 KISANFLOW — SMART PROCUREMENT BOOKING & MSP LOCK TEST SUITE');
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
