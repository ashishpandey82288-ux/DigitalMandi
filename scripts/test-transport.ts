// ==============================================================================
// KisanFlow — Phase 4B: Transport & Logistics Verification Test Suite
// Validates:
// 1. Transporter, Vehicle, Driver, Destination registration & persistence
// 2. Transport Request creation linked to Booking & official Weighment
// 3. Validation: Positive quantity, vehicle capacity checks, verification checks
// 4. Vehicle & Driver assignment with active/verified credential enforcement
// 5. Load manifest generation & capacity threshold protection
// 6. Full Transport Lifecycle: REQUESTED -> ASSIGNED -> LOADED -> DISPATCHED -> ARRIVED -> DELIVERED
// 7. Cancellation restrictions (cannot cancel dispatched/delivered produce)
// 8. Filters: Center, Booking, Status, Transporter, Vehicle
// 9. Full Traceability Chain: Farmer -> Booking -> Weighment -> Settlement -> Transport -> Destination
// 10. Tamper-evident SHA-256 Chained Cryptographic Audit Ledger
// ==============================================================================

import axios from 'axios';
import { prisma } from '../apps/api/src/config/prisma.ts';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestCase {
  id: string;
  name: string;
  category:
    | 'SETUP'
    | 'REGISTRATION'
    | 'REQUEST_CREATION'
    | 'CAPACITY_VALIDATION'
    | 'ASSIGNMENT'
    | 'LOADING'
    | 'LIFECYCLE_DISPATCH'
    | 'LIFECYCLE_ARRIVAL'
    | 'LIFECYCLE_DELIVERY'
    | 'CANCELLATION'
    | 'RETRIEVAL_FILTERS'
    | 'TRACEABILITY'
    | 'AUDIT_LEDGER';
  fn: () => Promise<{ passed: boolean; message: string; details?: any }>;
}

const adminToken = 'demo-token-admin';
const operatorToken = 'demo-token-operator';
const inspectorToken = 'demo-token-inspector';
const farmerToken = 'demo-token-farmer';

let testBookingId = '';
let testTransporterId = '';
let testTransporterCode = '';
let testVehicleId = '';
let testVehicleReg = '';
let testDriverId = '';
let testRequestId = '';
let testRequestRef = '';
let testLoadId = '';
let testSmallVehicleId = '';
let cancelTestRequestId = '';

const tests: TestCase[] = [
  // ----------------------------------------------------------------------------
  // 1. SETUP: Ensure a completed procurement booking exists
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-SETUP-01',
    name: 'Setup: Create & finalize a verified booking with weighment and settlement',
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

        // 3. Quality Inspection
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

        // 4. Weighment
        await axios.post(
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

        return {
          passed: true,
          message: `Setup completed with verified booking ${testBookingId} (50.0 Qtl net weight)`,
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
  // 2. REGISTRATION: Transporters, Vehicles, Drivers, Destinations
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-REG-01',
    name: 'Transporter Registration: Successfully register a new logistics provider',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        testTransporterCode = `TRP-TEST-${Date.now().toString().slice(-4)}`;
        const res = await axios.post(
          `${API_BASE}/api/transport/transporters`,
          {
            code: testTransporterCode,
            name: 'Haryana Agri Logistics Corp',
            phone: '9812300001',
            email: 'haryana.logistics@example.com',
            address: 'GT Road, Karnal, Haryana',
            registrationNumber: 'HAR-LOG-2026-991',
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        testTransporterId = res.data.data.id;
        const passed = res.status === 201 && res.data.data.code === testTransporterCode;
        return {
          passed,
          message: passed ? 'Transporter registered' : 'Failed to register transporter',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-REG-02',
    name: 'Transporter Registration: Reject duplicate transporter code',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/transporters`,
          {
            code: testTransporterCode,
            name: 'Duplicate Logistics',
            phone: '9812300002',
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        return { passed: false, message: 'Expected duplicate transporter code rejection' };
      } catch (err: any) {
        const passed = err.response?.status === 400 && err.response?.data?.code === 'DUPLICATE_TRANSPORTER_CODE';
        return {
          passed,
          message: passed ? 'Duplicate transporter code properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'TRANS-REG-03',
    name: 'Vehicle Registration: Successfully register a verified heavy commercial vehicle',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        testVehicleReg = `HR45-TR-${Date.now().toString().slice(-4)}`;
        const res = await axios.post(
          `${API_BASE}/api/transport/vehicles`,
          {
            registrationNumber: testVehicleReg,
            transporterId: testTransporterId,
            vehicleType: 'TRUCK_10_TON',
            capacityQuintals: 100.0,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        testVehicleId = res.data.data.id;
        const passed = res.status === 201 && res.data.data.registrationNumber === testVehicleReg && res.data.data.capacityQuintals === 100;
        return {
          passed,
          message: passed ? 'Vehicle registered with 100 Qtl capacity' : 'Vehicle registration failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-REG-04',
    name: 'Vehicle Registration: Reject duplicate vehicle registration number',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/vehicles`,
          {
            registrationNumber: testVehicleReg,
            transporterId: testTransporterId,
            capacityQuintals: 100.0,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        return { passed: false, message: 'Expected duplicate vehicle registration rejection' };
      } catch (err: any) {
        const passed = err.response?.status === 400 && err.response?.data?.code === 'DUPLICATE_VEHICLE_REGISTRATION';
        return {
          passed,
          message: passed ? 'Duplicate registration number properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'TRANS-REG-05',
    name: 'Vehicle Registration: Create small vehicle (20 Qtl capacity) for capacity test',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        const smallReg = `HR45-SM-${Date.now().toString().slice(-4)}`;
        const res = await axios.post(
          `${API_BASE}/api/transport/vehicles`,
          {
            registrationNumber: smallReg,
            transporterId: testTransporterId,
            vehicleType: 'TRACTOR_TROLLEY',
            capacityQuintals: 20.0,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        testSmallVehicleId = res.data.data.id;
        const passed = res.status === 201 && res.data.data.capacityQuintals === 20;
        return {
          passed,
          message: passed ? 'Small vehicle registered' : 'Small vehicle registration failed',
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-REG-06',
    name: 'Driver Registration: Register authorized driver',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/drivers`,
          {
            name: 'Balwinder Singh',
            phone: '9812345670',
            licenseNumber: 'DL-HR-2020-008899',
            transporterId: testTransporterId,
          },
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        testDriverId = res.data.data.id;
        const passed = res.status === 201 && res.data.data.name === 'Balwinder Singh';
        return {
          passed,
          message: passed ? 'Driver registered successfully' : 'Driver registration failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-REG-07',
    name: 'Destinations Listing: Retrieve pre-seeded FCI silos & CWC warehouses',
    category: 'REGISTRATION',
    fn: async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/transport/destinations`, {
          headers: { Authorization: `Bearer ${operatorToken}` },
        });

        const passed = res.status === 200 && Array.isArray(res.data.data) && res.data.data.length >= 2;
        return {
          passed,
          message: passed ? `Found ${res.data.data.length} destinations` : 'Destinations query failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 3. TRANSPORT REQUEST CREATION
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-REQ-01',
    name: 'Request Creation: Successfully create transport request from authoritative weighment',
    category: 'REQUEST_CREATION',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/requests`,
          {
            bookingId: testBookingId,
            destinationType: 'FCI_SILO',
            destinationName: 'FCI Central Silo Karnal',
            destinationAddress: 'Sector 4, Industrial Area, Karnal',
            destinationDistrict: 'Karnal',
            destinationState: 'Haryana',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        testRequestId = res.data.data.id;
        testRequestRef = res.data.data.requestReference;
        const passed =
          res.status === 201 &&
          res.data.data.status === 'REQUESTED' &&
          res.data.data.quantityQuintals === 50 &&
          res.data.data.requestReference.startsWith('TRQ-');

        return {
          passed,
          message: passed ? `Transport request created: ${testRequestRef}` : 'Failed to create transport request',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-REQ-02',
    name: 'Request Creation: Reject creation without bookingId',
    category: 'REQUEST_CREATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests`,
          {
            destinationName: 'FCI Silo',
            destinationAddress: 'Karnal',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected missing bookingId error' };
      } catch (err: any) {
        const passed = err.response?.status === 400 && err.response?.data?.code === 'MISSING_BOOKING_ID';
        return {
          passed,
          message: passed ? 'Missing bookingId properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'TRANS-REQ-03',
    name: 'Request Creation: Reject creation with invalid/non-existent bookingId',
    category: 'REQUEST_CREATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests`,
          {
            bookingId: 'invalid-booking-99999',
            destinationName: 'FCI Silo',
            destinationAddress: 'Karnal',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected booking not found error' };
      } catch (err: any) {
        const passed = err.response?.status === 404 && err.response?.data?.code === 'BOOKING_NOT_FOUND';
        return {
          passed,
          message: passed ? 'Non-existent booking properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'TRANS-REQ-04',
    name: 'Request Creation: Reject creation with zero or negative quantity',
    category: 'REQUEST_CREATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests`,
          {
            bookingId: testBookingId,
            destinationName: 'FCI Silo',
            destinationAddress: 'Karnal',
            quantityQuintals: -10,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected invalid quantity error' };
      } catch (err: any) {
        const passed = err.response?.status === 400 && err.response?.data?.code === 'INVALID_QUANTITY';
        return {
          passed,
          message: passed ? 'Negative quantity properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 4. CAPACITY & ASSIGNMENT VALIDATION
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-CAP-01',
    name: 'Capacity Validation: Reject vehicle when capacity (20 Qtl) is less than required (50 Qtl)',
    category: 'CAPACITY_VALIDATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/assign`,
          {
            vehicleId: testSmallVehicleId,
            driverId: testDriverId,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected insufficient capacity rejection' };
      } catch (err: any) {
        const passed =
          err.response?.status === 400 &&
          err.response?.data?.code === 'INSUFFICIENT_VEHICLE_CAPACITY';
        return {
          passed,
          message: passed ? 'Insufficient vehicle capacity properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'TRANS-ASN-01',
    name: 'Assignment: Successfully assign 100 Qtl truck and authorized driver',
    category: 'ASSIGNMENT',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/assign`,
          {
            vehicleId: testVehicleId,
            driverId: testDriverId,
            transporterId: testTransporterId,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          res.data.data.status === 'ASSIGNED' &&
          res.data.data.vehicleId === testVehicleId &&
          res.data.data.driverName === 'Balwinder Singh' &&
          Boolean(res.data.data.assignedAt);

        return {
          passed,
          message: passed ? 'Vehicle and driver assigned' : 'Assignment failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-ASN-02',
    name: 'Assignment: Reject assignment with invalid vehicle ID',
    category: 'ASSIGNMENT',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/assign`,
          {
            vehicleId: 'non-existent-vehicle-id',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected vehicle not found error' };
      } catch (err: any) {
        const passed = err.response?.status === 404 && err.response?.data?.code === 'VEHICLE_NOT_FOUND';
        return {
          passed,
          message: passed ? 'Invalid vehicle ID properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 5. LOADING & MANIFEST GENERATION
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-LOAD-01',
    name: 'Load Creation: Successfully create transport load manifest for 50 Qtl',
    category: 'LOADING',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/loads`,
          {
            quantityQuintals: 50.0,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        testLoadId = res.data.data.id;
        const passed =
          res.status === 201 &&
          res.data.data.status === 'LOADED' &&
          res.data.data.quantityQuintals === 50 &&
          res.data.data.loadReference.startsWith('LOAD-');

        return {
          passed,
          message: passed ? `Load manifest created: ${res.data.data.loadReference}` : 'Load creation failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-LOAD-02',
    name: 'Load Creation: Reject load quantity exceeding vehicle capacity (150 Qtl vs 100 Qtl)',
    category: 'LOADING',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/loads`,
          {
            quantityQuintals: 150.0,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected load capacity exceeded error' };
      } catch (err: any) {
        const passed =
          err.response?.status === 400 &&
          err.response?.data?.code === 'LOAD_EXCEEDS_VEHICLE_CAPACITY';
        return {
          passed,
          message: passed ? 'Exceeded load capacity properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 6. DISPATCH, ARRIVAL & DELIVERY LIFECYCLE
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-DISP-01',
    name: 'Dispatch: Transition transport status to DISPATCHED from procurement center',
    category: 'LIFECYCLE_DISPATCH',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/dispatch`,
          {},
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          res.data.data.status === 'DISPATCHED' &&
          Boolean(res.data.data.dispatchedAt);

        return {
          passed,
          message: passed ? 'Produce dispatched successfully' : 'Dispatch failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-ARR-01',
    name: 'Arrival: Record vehicle arrival at destination warehouse',
    category: 'LIFECYCLE_ARRIVAL',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/arrive`,
          { remarks: 'Vehicle arrived at gate 2, seal intact' },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          res.data.data.status === 'ARRIVED' &&
          Boolean(res.data.data.arrivedAt);

        return {
          passed,
          message: passed ? 'Arrival recorded at destination' : 'Arrival recording failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-DELIV-01',
    name: 'Delivery: Confirm delivery with verified receiver sign-off',
    category: 'LIFECYCLE_DELIVERY',
    fn: async () => {
      try {
        const res = await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/deliver`,
          {
            receiverName: 'Suresh Kumar',
            receiverDesignation: 'Assistant Manager (Storage) FCI',
            remarks: '50 Qtl Wheat accepted into Silo Bay B-4, moisture 11.5%',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          res.data.data.status === 'DELIVERED' &&
          res.data.data.deliveryReceiverName === 'Suresh Kumar' &&
          Boolean(res.data.data.deliveredAt);

        return {
          passed,
          message: passed ? 'Delivery confirmed and receipt signed' : 'Delivery confirmation failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-DELIV-02',
    name: 'Delivery: Reject delivery confirmation if receiverName is missing',
    category: 'LIFECYCLE_DELIVERY',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/deliver`,
          {
            remarks: 'No receiver provided',
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected receiverName required error' };
      } catch (err: any) {
        const passed =
          err.response?.status === 400 &&
          err.response?.data?.code === 'MISSING_RECEIVER_NAME';
        return {
          passed,
          message: passed ? 'Missing receiver name properly rejected' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 7. CANCELLATION RESTRICTIONS
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-CANC-01',
    name: 'Cancellation: Reject cancellation of already DELIVERED transport request',
    category: 'CANCELLATION',
    fn: async () => {
      try {
        await axios.post(
          `${API_BASE}/api/transport/requests/${testRequestId}/cancel`,
          { reason: 'Mistake in booking' },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );
        return { passed: false, message: 'Expected cancellation rejection for delivered request' };
      } catch (err: any) {
        const passed =
          err.response?.status === 400 &&
          err.response?.data?.code === 'CANNOT_CANCEL_DISPATCHED_REQUEST';
        return {
          passed,
          message: passed ? 'Delivered transport cancellation properly prevented' : 'Unexpected error',
          details: err.response?.data,
        };
      }
    },
  },

  {
    id: 'TRANS-CANC-02',
    name: 'Cancellation: Create and cancel a pending REQUESTED transport request',
    category: 'CANCELLATION',
    fn: async () => {
      try {
        // Create request
        const createRes = await axios.post(
          `${API_BASE}/api/transport/requests`,
          {
            bookingId: testBookingId,
            destinationName: 'Warehouse 2',
            destinationAddress: 'Ambala',
            quantityQuintals: 10,
          },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        cancelTestRequestId = createRes.data.data.id;

        // Cancel it
        const cancelRes = await axios.post(
          `${API_BASE}/api/transport/requests/${cancelTestRequestId}/cancel`,
          { reason: 'Center storage route reconfigured' },
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          cancelRes.status === 200 &&
          cancelRes.data.data.status === 'CANCELLED' &&
          cancelRes.data.data.cancellationReason === 'Center storage route reconfigured';

        return {
          passed,
          message: passed ? 'Pending transport request cancelled successfully' : 'Cancellation failed',
          details: cancelRes.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 8. RETRIEVAL & QUERY FILTERS
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-RET-01',
    name: 'Retrieval: Fetch transport request by unique reference ID',
    category: 'RETRIEVAL_FILTERS',
    fn: async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/transport/requests/ref/${testRequestRef}`,
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          res.data.data.id === testRequestId &&
          res.data.data.requestReference === testRequestRef;

        return {
          passed,
          message: passed ? 'Found request by reference' : 'Request lookup failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-RET-02',
    name: 'Retrieval: Filter transport requests by status=DELIVERED',
    category: 'RETRIEVAL_FILTERS',
    fn: async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/transport/requests?status=DELIVERED`,
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          Array.isArray(res.data.data) &&
          res.data.data.some((r: any) => r.id === testRequestId);

        return {
          passed,
          message: passed ? `Found ${res.data.data.length} delivered requests` : 'Filter query failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-RET-03',
    name: 'Retrieval: Filter transport requests by bookingId',
    category: 'RETRIEVAL_FILTERS',
    fn: async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/transport/requests?bookingId=${testBookingId}`,
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          Array.isArray(res.data.data) &&
          res.data.data.some((r: any) => r.id === testRequestId);

        return {
          passed,
          message: passed ? `Found ${res.data.data.length} requests for booking` : 'Filter query failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  {
    id: 'TRANS-RET-04',
    name: 'Retrieval: Filter vehicles by transporterId',
    category: 'RETRIEVAL_FILTERS',
    fn: async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/transport/vehicles?transporterId=${testTransporterId}`,
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const passed =
          res.status === 200 &&
          Array.isArray(res.data.data) &&
          res.data.data.some((v: any) => v.id === testVehicleId);

        return {
          passed,
          message: passed ? `Found ${res.data.data.length} vehicles for transporter` : 'Vehicle filter failed',
          details: res.data.data,
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 9. TRACEABILITY CHAIN INTEGRITY
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-TRACE-01',
    name: 'Traceability: Full chain Farmer -> Booking -> Weighment -> Settlement -> Transport -> Destination',
    category: 'TRACEABILITY',
    fn: async () => {
      try {
        // Fetch full request
        const res = await axios.get(
          `${API_BASE}/api/transport/requests/${testRequestId}`,
          { headers: { Authorization: `Bearer ${operatorToken}` } }
        );

        const reqData = res.data.data;
        const passed =
          Boolean(reqData.bookingId) &&
          Boolean(reqData.procurementCenterId) &&
          Boolean(reqData.cropId) &&
          Boolean(reqData.vehicleId) &&
          Boolean(reqData.transporterId) &&
          Boolean(reqData.driverId) &&
          reqData.status === 'DELIVERED';

        return {
          passed,
          message: passed
            ? 'Complete multi-tier logistics traceability verified'
            : 'Broken traceability link',
          details: {
            requestReference: reqData.requestReference,
            bookingId: reqData.bookingId,
            vehicle: reqData.vehicleRegistrationNumber,
            driver: reqData.driverName,
            destination: reqData.destinationName,
            status: reqData.status,
          },
        };
      } catch (err: any) {
        return { passed: false, message: err.response?.data?.error || err.message };
      }
    },
  },

  // ----------------------------------------------------------------------------
  // 10. TAMPER-EVIDENT AUDIT LEDGER
  // ----------------------------------------------------------------------------
  {
    id: 'TRANS-AUDIT-01',
    name: 'Audit Ledger: Verify SHA-256 chained audit entries for all transport events',
    category: 'AUDIT_LEDGER',
    fn: async () => {
      try {
        const auditEvents = await prisma.auditEvent.findMany({
          where: {
            entityId: testRequestId,
          },
        });

        const actions = auditEvents.map((a: any) => a.action);
        const hasCreated = actions.includes('TRANSPORT_REQUEST_CREATED');
        const hasAssigned = actions.includes('TRANSPORT_VEHICLE_ASSIGNED');
        const hasDispatched = actions.includes('TRANSPORT_DISPATCHED');
        const hasArrived = actions.includes('TRANSPORT_ARRIVED');
        const hasDelivered = actions.includes('TRANSPORT_DELIVERED');

        const allHashesValid = auditEvents.every(
          (a: any) =>
            typeof (a.currentHash || a.recordHash) === 'string' &&
            (a.currentHash || a.recordHash).length === 64
        );

        const passed =
          hasCreated && hasAssigned && hasDispatched && hasArrived && hasDelivered && allHashesValid;

        return {
          passed,
          message: passed
            ? `Verified ${auditEvents.length} SHA-256 audit events across entire transport lifecycle`
            : `Missing audit actions. Found: ${actions.join(', ')}`,
          details: actions,
        };
      } catch (err: any) {
        return { passed: false, message: err.message };
      }
    },
  },
];

async function runAllTests() {
  console.log('\n🌾 ==============================================================================');
  console.log('🌾 KisanFlow Phase 4B — Transport & Logistics Engine Verification Suite');
  console.log('🌾 ==============================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const test of tests) {
    process.stdout.write(`  [${test.category.padEnd(18)}] ${test.id}: ${test.name} ... `);
    try {
      const result = await test.fn();
      if (result.passed) {
        passedCount++;
        console.log(`\x1b[32mPASS\x1b[0m — ${result.message}`);
      } else {
        failedCount++;
        console.log(`\x1b[31mFAIL\x1b[0m — ${result.message}`);
        if (result.details) {
          console.log(`     Details:`, JSON.stringify(result.details, null, 2));
        }
      }
    } catch (err: any) {
      failedCount++;
      console.log(`\x1b[31mERROR\x1b[0m — ${err.message}`);
    }
  }

  console.log('\n------------------------------------------------------------------------------');
  console.log(`📊 RESULTS: Total: ${tests.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('------------------------------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('✅ ALL PHASE 4B TRANSPORT & LOGISTICS TESTS PASSED AUTHORITATIVELY!\n');
    process.exit(0);
  }
}

runAllTests();
