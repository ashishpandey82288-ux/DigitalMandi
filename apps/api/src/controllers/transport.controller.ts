// ==============================================================================
// KisanFlow — Transport & Logistics Controller
// Handles transport requests, vehicle/driver assignment, loading, dispatch,
// arrival, delivery verification, and transporter/fleet management endpoints.
// ==============================================================================

import { Request, Response } from 'express';
import { transportService } from '../services/transportService.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

// --- Transport Requests ---

export async function createTransportRequest(req: Request, res: Response): Promise<void> {
  try {
    const {
      bookingId,
      destinationType,
      destinationName,
      destinationAddress,
      destinationDistrict,
      destinationState,
      quantityQuintals,
      metadata,
    } = req.body;

    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'bookingId is required to create a transport request.',
        code: 'MISSING_BOOKING_ID',
      });
      return;
    }

    if (!destinationName || !destinationAddress) {
      res.status(400).json({
        success: false,
        error: 'destinationName and destinationAddress are required.',
        code: 'MISSING_DESTINATION_DETAILS',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.createTransportRequest(actorId, {
      bookingId,
      destinationType,
      destinationName,
      destinationAddress,
      destinationDistrict,
      destinationState,
      quantityQuintals,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Transport request created successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to create transport request',
      code: err.code || 'TRANSPORT_REQUEST_CREATION_FAILED',
    });
  }
}

export async function getTransportRequests(req: Request, res: Response): Promise<void> {
  try {
    const { procurementCenterId, bookingId, status, vehicleId, transporterId } = req.query;

    const requests = await transportService.getTransportRequests({
      procurementCenterId: procurementCenterId as string,
      bookingId: bookingId as string,
      status: status as any,
      vehicleId: vehicleId as string,
      transporterId: transporterId as string,
    });

    res.status(200).json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to fetch transport requests',
      code: err.code || 'FETCH_TRANSPORT_REQUESTS_FAILED',
    });
  }
}

export async function getTransportRequestById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const request = await transportService.getTransportRequestById(id);

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Transport request not found',
      code: err.code || 'TRANSPORT_REQUEST_NOT_FOUND',
    });
  }
}

export async function getTransportRequestByReference(req: Request, res: Response): Promise<void> {
  try {
    const { ref } = req.params;
    const request = await transportService.getTransportRequestByReference(ref);

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Transport request not found',
      code: err.code || 'TRANSPORT_REQUEST_NOT_FOUND',
    });
  }
}

export async function assignVehicle(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { vehicleId, driverId, transporterId } = req.body;

    if (!vehicleId) {
      res.status(400).json({
        success: false,
        error: 'vehicleId is required for assignment.',
        code: 'MISSING_VEHICLE_ID',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.assignVehicleAndDriver(actorId, id, {
      vehicleId,
      driverId,
      transporterId,
    });

    res.status(200).json({
      success: true,
      message: 'Vehicle and driver assigned successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to assign vehicle',
      code: err.code || 'VEHICLE_ASSIGNMENT_FAILED',
    });
  }
}

export async function createLoad(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { vehicleId, quantityQuintals, metadata } = req.body;

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.createLoad(actorId, id, {
      vehicleId,
      quantityQuintals,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Transport load created and manifest recorded.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to create transport load',
      code: err.code || 'TRANSPORT_LOAD_FAILED',
    });
  }
}

export async function dispatchTransport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.dispatchTransport(actorId, id);

    res.status(200).json({
      success: true,
      message: 'Produce dispatched successfully from procurement center.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to dispatch transport',
      code: err.code || 'TRANSPORT_DISPATCH_FAILED',
    });
  }
}

export async function recordArrival(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.recordArrival(actorId, id, { remarks });

    res.status(200).json({
      success: true,
      message: 'Transport arrival recorded at destination.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to record arrival',
      code: err.code || 'TRANSPORT_ARRIVAL_FAILED',
    });
  }
}

export async function confirmDelivery(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { receiverName, receiverDesignation, remarks } = req.body;

    if (!receiverName) {
      res.status(400).json({
        success: false,
        error: 'receiverName is required to verify destination delivery.',
        code: 'MISSING_RECEIVER_NAME',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.confirmDelivery(actorId, id, {
      receiverName,
      receiverDesignation,
      remarks,
    });

    res.status(200).json({
      success: true,
      message: 'Produce delivery confirmed and receipt acknowledged.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to confirm delivery',
      code: err.code || 'TRANSPORT_DELIVERY_FAILED',
    });
  }
}

export async function cancelTransportRequest(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'Cancellation reason is required.',
        code: 'MISSING_CANCELLATION_REASON',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.cancelTransportRequest(actorId, id, reason);

    res.status(200).json({
      success: true,
      message: 'Transport request cancelled successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to cancel transport request',
      code: err.code || 'TRANSPORT_CANCELLATION_FAILED',
    });
  }
}

// --- Transporter & Fleet Handlers ---

export async function getTransporters(req: Request, res: Response): Promise<void> {
  try {
    const { isActive } = req.query;
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;

    const list = await transportService.getTransporters({ isActive: activeFilter });
    res.status(200).json({
      success: true,
      data: list,
      count: list.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch transporters',
      code: 'FETCH_TRANSPORTERS_FAILED',
    });
  }
}

export async function createTransporter(req: Request, res: Response): Promise<void> {
  try {
    const { code, name, phone, email, address, registrationNumber, metadata } = req.body;

    if (!code || !name || !phone) {
      res.status(400).json({
        success: false,
        error: 'code, name, and phone are required for a transporter.',
        code: 'MISSING_TRANSPORTER_FIELDS',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.createTransporter(actorId, {
      code,
      name,
      phone,
      email,
      address,
      registrationNumber,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Transporter registered successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to register transporter',
      code: err.code || 'TRANSPORTER_REGISTRATION_FAILED',
    });
  }
}

export async function getVehicles(req: Request, res: Response): Promise<void> {
  try {
    const { transporterId, isActive, verificationStatus } = req.query;
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;

    const list = await transportService.getVehicles({
      transporterId: transporterId as string,
      isActive: activeFilter,
      verificationStatus: verificationStatus as any,
    });

    res.status(200).json({
      success: true,
      data: list,
      count: list.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch vehicles',
      code: 'FETCH_VEHICLES_FAILED',
    });
  }
}

export async function createVehicle(req: Request, res: Response): Promise<void> {
  try {
    const { registrationNumber, transporterId, vehicleType, capacityQuintals, metadata } = req.body;

    if (!registrationNumber || !capacityQuintals) {
      res.status(400).json({
        success: false,
        error: 'registrationNumber and capacityQuintals are required.',
        code: 'MISSING_VEHICLE_FIELDS',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.createVehicle(actorId, {
      registrationNumber,
      transporterId,
      vehicleType,
      capacityQuintals: Number(capacityQuintals),
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle registered successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to register vehicle',
      code: err.code || 'VEHICLE_REGISTRATION_FAILED',
    });
  }
}

export async function getDrivers(req: Request, res: Response): Promise<void> {
  try {
    const { transporterId, isActive } = req.query;
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;

    const list = await transportService.getDrivers({
      transporterId: transporterId as string,
      isActive: activeFilter,
    });

    res.status(200).json({
      success: true,
      data: list,
      count: list.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch drivers',
      code: 'FETCH_DRIVERS_FAILED',
    });
  }
}

export async function createDriver(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, licenseNumber, transporterId, metadata } = req.body;

    if (!name || !phone) {
      res.status(400).json({
        success: false,
        error: 'name and phone are required for a driver.',
        code: 'MISSING_DRIVER_FIELDS',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const result = await transportService.createDriver(actorId, {
      name,
      phone,
      licenseNumber,
      transporterId,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Driver registered successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to register driver',
      code: err.code || 'DRIVER_REGISTRATION_FAILED',
    });
  }
}

export async function getDestinations(req: Request, res: Response): Promise<void> {
  try {
    const list = await transportService.getDestinations();
    res.status(200).json({
      success: true,
      data: list,
      count: list.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch transport destinations',
      code: 'FETCH_DESTINATIONS_FAILED',
    });
  }
}
