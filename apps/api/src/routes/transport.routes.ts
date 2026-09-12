// ==============================================================================
// KisanFlow — Transport & Logistics API Routes
// Mounts /api/transport
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  createTransportRequest,
  getTransportRequests,
  getTransportRequestById,
  getTransportRequestByReference,
  assignVehicle,
  createLoad,
  dispatchTransport,
  recordArrival,
  confirmDelivery,
  cancelTransportRequest,
  getTransporters,
  createTransporter,
  getVehicles,
  createVehicle,
  getDrivers,
  createDriver,
  getDestinations,
} from '../controllers/transport.controller.ts';

const router = Router();

// --- Transport Requests Lifecycle ---

/**
 * POST /api/transport/requests
 * Creates a transport request for a procured booking
 */
router.post('/requests', requireAuth, createTransportRequest);

/**
 * GET /api/transport/requests
 * Lists transport requests with filters (centerId, bookingId, status, vehicleId, transporterId)
 */
router.get('/requests', requireAuth, getTransportRequests);

/**
 * GET /api/transport/requests/ref/:ref
 * Retrieves transport request by reference string
 */
router.get('/requests/ref/:ref', requireAuth, getTransportRequestByReference);

/**
 * GET /api/transport/requests/:id
 * Retrieves transport request by unique ID
 */
router.get('/requests/:id', requireAuth, getTransportRequestById);

/**
 * POST /api/transport/requests/:id/assign
 * Assigns a verified vehicle, driver, and transporter to a transport request
 */
router.post('/requests/:id/assign', requireAuth, assignVehicle);

/**
 * POST /api/transport/requests/:id/loads
 * Creates a load manifest for a transport request
 */
router.post('/requests/:id/loads', requireAuth, createLoad);

/**
 * POST /api/transport/requests/:id/dispatch
 * Marks produce as dispatched / in-transit from procurement center
 */
router.post('/requests/:id/dispatch', requireAuth, dispatchTransport);

/**
 * POST /api/transport/requests/:id/arrive
 * Records arrival at destination warehouse / FCI depot
 */
router.post('/requests/:id/arrive', requireAuth, recordArrival);

/**
 * POST /api/transport/requests/:id/deliver
 * Confirms verified delivery with receiver sign-off
 */
router.post('/requests/:id/deliver', requireAuth, confirmDelivery);

/**
 * POST /api/transport/requests/:id/cancel
 * Cancels transport request prior to dispatch
 */
router.post('/requests/:id/cancel', requireAuth, cancelTransportRequest);

// --- Fleet & Master Entities ---

/**
 * GET /api/transport/transporters
 * Lists registered transporters
 */
router.get('/transporters', requireAuth, getTransporters);

/**
 * POST /api/transport/transporters
 * Registers a new transporter
 */
router.post('/transporters', requireAuth, createTransporter);

/**
 * GET /api/transport/vehicles
 * Lists registered vehicles
 */
router.get('/vehicles', requireAuth, getVehicles);

/**
 * POST /api/transport/vehicles
 * Registers a new transport vehicle
 */
router.post('/vehicles', requireAuth, createVehicle);

/**
 * GET /api/transport/drivers
 * Lists registered transport drivers
 */
router.get('/drivers', requireAuth, getDrivers);

/**
 * POST /api/transport/drivers
 * Registers a new driver
 */
router.post('/drivers', requireAuth, createDriver);

/**
 * GET /api/transport/destinations
 * Lists available storage destinations (FCI silos, CWC warehouses)
 */
router.get('/destinations', requireAuth, getDestinations);

export default router;
