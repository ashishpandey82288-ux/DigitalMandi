// ==============================================================================
// KisanFlow — Transport & Logistics Service
// Encapsulates Transport Request creation, vehicle/driver assignment, loading,
// dispatch tracking, destination delivery verification, and tamper-evident audit chaining.
// ==============================================================================

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import {
  TransportStatus,
  VehicleVerificationStatus,
  TransportRequestDTO,
  TransportLoadDTO,
  TransporterDTO,
  VehicleDTO,
  DriverDTO,
  TransportDestinationDTO,
} from '@kisanflow/types';
import { recordAuditEvent } from './auditService.ts';

export class TransportService {
  /**
   * Create a new transport request for a procured booking.
   * Traceable back to booking and official weighment.
   */
  public async createTransportRequest(
    actorId: string,
    data: {
      bookingId: string;
      destinationType?: string;
      destinationName: string;
      destinationAddress: string;
      destinationDistrict?: string;
      destinationState?: string;
      quantityQuintals?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TransportRequestDTO> {
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        crop: true,
        procurementCenter: true,
      },
    });

    if (!booking) {
      const err: any = new Error(`Booking ${data.bookingId} not found`);
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    // Determine authoritative quantity: use weighment net weight if available, else booking estimate
    let quantity = data.quantityQuintals;
    if (quantity === undefined || quantity === null) {
      const weighment = await prisma.weighment.findFirst({
        where: { bookingId: data.bookingId },
      });
      if (weighment && weighment.netWeightQuintals) {
        quantity = Number(weighment.netWeightQuintals);
      } else {
        quantity = Number(booking.estimatedQuantityQuintals);
      }
    }

    if (quantity <= 0) {
      const err: any = new Error('Transport request quantity must be greater than 0');
      err.statusCode = 400;
      err.code = 'INVALID_QUANTITY';
      throw err;
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const requestReference = `TRQ-${yearMonth}-${randSuffix}`;

    const newRequest = await prisma.transportRequest.create({
      data: {
        requestReference,
        bookingId: booking.id,
        procurementCenterId: booking.procurementCenterId,
        cropId: booking.cropId,
        quantityQuintals: new Prisma.Decimal(quantity),
        quantityUnit: 'QUINTAL',
        destinationType: data.destinationType || 'WAREHOUSE',
        destinationName: data.destinationName,
        destinationAddress: data.destinationAddress,
        destinationDistrict: data.destinationDistrict || null,
        destinationState: data.destinationState || null,
        requestedDate: now,
        requiredCapacityQuintals: new Prisma.Decimal(quantity),
        status: 'REQUESTED',
        metadata: data.metadata || null,
      },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_REQUEST_CREATED',
      entityType: 'TRANSPORT_REQUEST',
      entityId: newRequest.id,
      metadata: {
        requestReference,
        bookingId: booking.id,
        quantityQuintals: quantity,
        destinationName: data.destinationName,
      },
    });

    return this.mapTransportRequestToDTO(newRequest);
  }

  /**
   * Assign Vehicle, Driver, and Transporter to a Transport Request.
   * Validates capacity, active status, and verification credentials.
   */
  public async assignVehicleAndDriver(
    actorId: string,
    requestId: string,
    data: {
      vehicleId: string;
      driverId?: string;
      transporterId?: string;
    }
  ): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: {
        vehicle: true,
        transporter: true,
        driver: true,
      },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${requestId} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    if (
      request.status !== 'REQUESTED' &&
      request.status !== 'ASSIGNED'
    ) {
      const err: any = new Error(
        `Cannot assign vehicle to transport request with status ${request.status}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_ASSIGNMENT';
      throw err;
    }

    // 1. Verify vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
      include: { transporter: true },
    });

    if (!vehicle) {
      const err: any = new Error(`Vehicle ${data.vehicleId} not found`);
      err.statusCode = 404;
      err.code = 'VEHICLE_NOT_FOUND';
      throw err;
    }

    if (!vehicle.isActive) {
      const err: any = new Error(`Vehicle ${vehicle.registrationNumber} is inactive`);
      err.statusCode = 400;
      err.code = 'VEHICLE_INACTIVE';
      throw err;
    }

    if (vehicle.verificationStatus !== 'VERIFIED') {
      const err: any = new Error(
        `Vehicle ${vehicle.registrationNumber} is not verified (status: ${vehicle.verificationStatus})`
      );
      err.statusCode = 400;
      err.code = 'VEHICLE_NOT_VERIFIED';
      throw err;
    }

    // Capacity Validation: Vehicle capacity must accommodate required quantity
    const requiredCapacity = Number(request.requiredCapacityQuintals);
    const vehicleCapacity = Number(vehicle.capacityQuintals);
    if (vehicleCapacity < requiredCapacity) {
      const err: any = new Error(
        `Vehicle capacity (${vehicleCapacity} Qtl) is insufficient for required load (${requiredCapacity} Qtl)`
      );
      err.statusCode = 400;
      err.code = 'INSUFFICIENT_VEHICLE_CAPACITY';
      throw err;
    }

    // 2. Verify driver if provided
    let driver = null;
    if (data.driverId) {
      driver = await prisma.driver.findUnique({
        where: { id: data.driverId },
      });
      if (!driver) {
        const err: any = new Error(`Driver ${data.driverId} not found`);
        err.statusCode = 404;
        err.code = 'DRIVER_NOT_FOUND';
        throw err;
      }
      if (!driver.isActive) {
        const err: any = new Error(`Driver ${driver.name} is inactive`);
        err.statusCode = 400;
        err.code = 'DRIVER_INACTIVE';
        throw err;
      }
    }

    // 3. Determine transporter (from param or vehicle)
    const transporterId = data.transporterId || vehicle.transporterId;
    if (transporterId) {
      const transporter = await prisma.transporter.findUnique({
        where: { id: transporterId },
      });
      if (transporter && !transporter.isActive) {
        const err: any = new Error(`Transporter ${transporter.name} is inactive`);
        err.statusCode = 400;
        err.code = 'TRANSPORTER_INACTIVE';
        throw err;
      }
    }

    const updated = await prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        vehicleId: vehicle.id,
        driverId: driver ? driver.id : null,
        driverName: driver ? driver.name : null,
        driverPhone: driver ? driver.phone : null,
        transporterId: transporterId || null,
        assignedAt: new Date(),
        status: 'ASSIGNED',
      },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_VEHICLE_ASSIGNED',
      entityType: 'TRANSPORT_REQUEST',
      entityId: requestId,
      metadata: {
        requestReference: updated.requestReference,
        vehicleRegistrationNumber: vehicle.registrationNumber,
        driverName: driver?.name,
        transporterId,
      },
    });

    return this.mapTransportRequestToDTO(updated);
  }

  /**
   * Create a specific Load manifest for a transport request.
   */
  public async createLoad(
    actorId: string,
    requestId: string,
    data: {
      vehicleId?: string;
      quantityQuintals?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TransportLoadDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: {
        booking: true,
        vehicle: true,
      },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${requestId} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    if (
      request.status !== 'ASSIGNED' &&
      request.status !== 'REQUESTED' &&
      request.status !== 'LOADED'
    ) {
      const err: any = new Error(
        `Cannot create load for request with status ${request.status}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_LOADING';
      throw err;
    }

    const vehicleId = data.vehicleId || request.vehicleId;
    if (!vehicleId) {
      const err: any = new Error('No vehicle assigned or specified for load');
      err.statusCode = 400;
      err.code = 'VEHICLE_REQUIRED';
      throw err;
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || !vehicle.isActive) {
      const err: any = new Error('Vehicle not found or inactive');
      err.statusCode = 400;
      err.code = 'INVALID_VEHICLE';
      throw err;
    }

    const quantity = data.quantityQuintals || Number(request.quantityQuintals);
    if (quantity > Number(vehicle.capacityQuintals)) {
      const err: any = new Error(
        `Load quantity (${quantity} Qtl) exceeds vehicle capacity (${Number(vehicle.capacityQuintals)} Qtl)`
      );
      err.statusCode = 400;
      err.code = 'LOAD_EXCEEDS_VEHICLE_CAPACITY';
      throw err;
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const loadReference = `LOAD-${yearMonth}-${randSuffix}`;

    const newLoad = await prisma.transportLoad.create({
      data: {
        loadReference,
        transportRequestId: request.id,
        bookingId: request.bookingId,
        vehicleId: vehicle.id,
        sourceCenterId: request.procurementCenterId,
        destinationName: request.destinationName,
        cropId: request.cropId,
        quantityQuintals: new Prisma.Decimal(quantity),
        quantityUnit: 'QUINTAL',
        loadingStartedAt: now,
        loadedAt: now,
        status: 'LOADED',
        metadata: data.metadata || null,
      },
      include: {
        vehicle: true,
        transportRequest: true,
      },
    });

    // Update transport request status to LOADED
    await prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'LOADED',
      },
    });

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_LOAD_CREATED',
      entityType: 'TRANSPORT_LOAD',
      entityId: newLoad.id,
      metadata: {
        loadReference,
        transportRequestId: requestId,
        vehicleId: vehicle.id,
        quantityQuintals: quantity,
      },
    });

    return this.mapTransportLoadToDTO(newLoad);
  }

  /**
   * Dispatch Transport Request (Produce leaves Procurement Center).
   */
  public async dispatchTransport(
    actorId: string,
    requestId: string
  ): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
      include: {
        loads: true,
      },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${requestId} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    if (
      request.status !== 'ASSIGNED' &&
      request.status !== 'LOADED'
    ) {
      const err: any = new Error(
        `Cannot dispatch transport request with status ${request.status}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_DISPATCH';
      throw err;
    }

    const now = new Date();

    const updated = await prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'DISPATCHED',
        dispatchedAt: now,
      },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    // Update associated loads
    const loads = await prisma.transportLoad.findMany({
      where: { transportRequestId: requestId },
    });
    for (const load of loads) {
      await prisma.transportLoad.update({
        where: { id: load.id },
        data: {
          status: 'DISPATCHED',
          dispatchedAt: now,
        },
      });
    }

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_DISPATCHED',
      entityType: 'TRANSPORT_REQUEST',
      entityId: requestId,
      metadata: {
        requestReference: updated.requestReference,
        dispatchedAt: now.toISOString(),
      },
    });

    return this.mapTransportRequestToDTO(updated);
  }

  /**
   * Mark Transport as Arrived at Destination.
   */
  public async recordArrival(
    actorId: string,
    requestId: string,
    data?: { remarks?: string }
  ): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${requestId} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    if (
      request.status !== 'DISPATCHED' &&
      request.status !== 'IN_TRANSIT'
    ) {
      const err: any = new Error(
        `Cannot mark arrival for request with status ${request.status}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_ARRIVAL';
      throw err;
    }

    const now = new Date();

    const updated = await prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'ARRIVED',
        arrivedAt: now,
        deliveryRemarks: data?.remarks || request.deliveryRemarks,
      },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    // Update loads
    const loads = await prisma.transportLoad.findMany({
      where: { transportRequestId: requestId },
    });
    for (const load of loads) {
      await prisma.transportLoad.update({
        where: { id: load.id },
        data: {
          status: 'ARRIVED',
          arrivedAt: now,
        },
      });
    }

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_ARRIVED',
      entityType: 'TRANSPORT_REQUEST',
      entityId: requestId,
      metadata: {
        requestReference: updated.requestReference,
        arrivedAt: now.toISOString(),
      },
    });

    return this.mapTransportRequestToDTO(updated);
  }

  /**
   * Confirm Delivery at Destination (Warehouse / FCI Godown receiver signs off).
   */
  public async confirmDelivery(
    actorId: string,
    requestId: string,
    data: {
      receiverName: string;
      receiverDesignation?: string;
      remarks?: string;
    }
  ): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${requestId} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    if (
      request.status !== 'ARRIVED' &&
      request.status !== 'DISPATCHED' &&
      request.status !== 'IN_TRANSIT'
    ) {
      const err: any = new Error(
        `Cannot confirm delivery for transport request with status ${request.status}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_STATUS_FOR_DELIVERY';
      throw err;
    }

    if (!data.receiverName || data.receiverName.trim().length === 0) {
      const err: any = new Error('Receiver name is required to confirm delivery');
      err.statusCode = 400;
      err.code = 'RECEIVER_NAME_REQUIRED';
      throw err;
    }

    const now = new Date();

    const updated = await prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'DELIVERED',
        deliveredAt: now,
        arrivedAt: request.arrivedAt || now,
        deliveryReceiverName: data.receiverName,
        deliveryReceiverDesignation: data.receiverDesignation || 'Depot In-charge',
        deliveryRemarks: data.remarks || null,
      },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    // Update loads
    const loads = await prisma.transportLoad.findMany({
      where: { transportRequestId: requestId },
    });
    for (const load of loads) {
      await prisma.transportLoad.update({
        where: { id: load.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
        },
      });
    }

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_DELIVERED',
      entityType: 'TRANSPORT_REQUEST',
      entityId: requestId,
      metadata: {
        requestReference: updated.requestReference,
        deliveredAt: now.toISOString(),
        receiverName: data.receiverName,
        receiverDesignation: data.receiverDesignation,
      },
    });

    return this.mapTransportRequestToDTO(updated);
  }

  /**
   * Cancel Transport Request (Only allowed prior to dispatch).
   */
  public async cancelTransportRequest(
    actorId: string,
    requestId: string,
    reason: string
  ): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${requestId} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    if (
      request.status === 'DISPATCHED' ||
      request.status === 'IN_TRANSIT' ||
      request.status === 'ARRIVED' ||
      request.status === 'DELIVERED'
    ) {
      const err: any = new Error(
        `Cannot cancel transport request already in status ${request.status}`
      );
      err.statusCode = 400;
      err.code = 'CANNOT_CANCEL_DISPATCHED_REQUEST';
      throw err;
    }

    const now = new Date();

    const updated = await prisma.transportRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: reason,
      },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    // Record Tamper-Evident Audit Event
    await recordAuditEvent({
      actorId,
      action: 'TRANSPORT_CANCELLED',
      entityType: 'TRANSPORT_REQUEST',
      entityId: requestId,
      metadata: {
        requestReference: updated.requestReference,
        reason,
        cancelledAt: now.toISOString(),
      },
    });

    return this.mapTransportRequestToDTO(updated);
  }

  // --- QUERY & MANAGEMENT METHODS ---

  public async getTransportRequests(filters?: {
    procurementCenterId?: string;
    bookingId?: string;
    status?: TransportStatus;
    vehicleId?: string;
    transporterId?: string;
  }): Promise<TransportRequestDTO[]> {
    const where: any = {};
    if (filters?.procurementCenterId) where.procurementCenterId = filters.procurementCenterId;
    if (filters?.bookingId) where.bookingId = filters.bookingId;
    if (filters?.status) where.status = filters.status;
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters?.transporterId) where.transporterId = filters.transporterId;

    const list = await prisma.transportRequest.findMany({
      where,
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    return list.map((item: any) => this.mapTransportRequestToDTO(item));
  }

  public async getTransportRequestById(id: string): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { id },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    if (!request) {
      const err: any = new Error(`Transport request ${id} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    return this.mapTransportRequestToDTO(request);
  }

  public async getTransportRequestByReference(requestReference: string): Promise<TransportRequestDTO> {
    const request = await prisma.transportRequest.findUnique({
      where: { requestReference },
      include: {
        booking: true,
        procurementCenter: true,
        crop: true,
        vehicle: true,
        transporter: true,
        driver: true,
        loads: true,
      },
    });

    if (!request) {
      const err: any = new Error(`Transport request with reference ${requestReference} not found`);
      err.statusCode = 404;
      err.code = 'TRANSPORT_REQUEST_NOT_FOUND';
      throw err;
    }

    return this.mapTransportRequestToDTO(request);
  }

  // --- Transporter Management ---

  public async getTransporters(filters?: { isActive?: boolean }): Promise<TransporterDTO[]> {
    const where: any = {};
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const list = await prisma.transporter.findMany({
      where,
      include: {
        vehicles: true,
        drivers: true,
      },
    });

    return list.map((t: any) => this.mapTransporterToDTO(t));
  }

  public async createTransporter(
    actorId: string,
    data: {
      code: string;
      name: string;
      phone: string;
      email?: string;
      address?: string;
      registrationNumber?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TransporterDTO> {
    const existing = await prisma.transporter.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      const err: any = new Error(`Transporter code ${data.code} already exists`);
      err.statusCode = 400;
      err.code = 'DUPLICATE_TRANSPORTER_CODE';
      throw err;
    }

    const newTransporter = await prisma.transporter.create({
      data: {
        code: data.code,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        registrationNumber: data.registrationNumber || null,
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: data.metadata || null,
      },
    });

    await recordAuditEvent({
      actorId,
      action: 'TRANSPORTER_CREATED',
      entityType: 'TRANSPORTER',
      entityId: newTransporter.id,
      metadata: { code: data.code, name: data.name },
    });

    return this.mapTransporterToDTO(newTransporter);
  }

  // --- Vehicle Management ---

  public async getVehicles(filters?: {
    transporterId?: string;
    isActive?: boolean;
    verificationStatus?: VehicleVerificationStatus;
  }): Promise<VehicleDTO[]> {
    const where: any = {};
    if (filters?.transporterId) where.transporterId = filters.transporterId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.verificationStatus) where.verificationStatus = filters.verificationStatus;

    const list = await prisma.vehicle.findMany({
      where,
      include: {
        transporter: true,
      },
    });

    return list.map((v: any) => this.mapVehicleToDTO(v));
  }

  public async createVehicle(
    actorId: string,
    data: {
      registrationNumber: string;
      transporterId?: string;
      vehicleType?: string;
      capacityQuintals: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<VehicleDTO> {
    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber: data.registrationNumber },
    });

    if (existing) {
      const err: any = new Error(
        `Vehicle with registration number ${data.registrationNumber} already exists`
      );
      err.statusCode = 400;
      err.code = 'DUPLICATE_VEHICLE_REGISTRATION';
      throw err;
    }

    if (data.capacityQuintals <= 0) {
      const err: any = new Error('Vehicle capacity must be greater than 0');
      err.statusCode = 400;
      err.code = 'INVALID_CAPACITY';
      throw err;
    }

    const newVehicle = await prisma.vehicle.create({
      data: {
        registrationNumber: data.registrationNumber,
        transporterId: data.transporterId || null,
        vehicleType: data.vehicleType || 'TRUCK_10_TON',
        capacityQuintals: new Prisma.Decimal(data.capacityQuintals),
        capacityUnit: 'QUINTAL',
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: data.metadata || null,
      },
      include: {
        transporter: true,
      },
    });

    await recordAuditEvent({
      actorId,
      action: 'VEHICLE_REGISTERED',
      entityType: 'VEHICLE',
      entityId: newVehicle.id,
      metadata: {
        registrationNumber: data.registrationNumber,
        capacityQuintals: data.capacityQuintals,
      },
    });

    return this.mapVehicleToDTO(newVehicle);
  }

  // --- Driver Management ---

  public async getDrivers(filters?: { transporterId?: string; isActive?: boolean }): Promise<DriverDTO[]> {
    const where: any = {};
    if (filters?.transporterId) where.transporterId = filters.transporterId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const list = await prisma.driver.findMany({
      where,
      include: {
        transporter: true,
      },
    });

    return list.map((d: any) => this.mapDriverToDTO(d));
  }

  public async createDriver(
    actorId: string,
    data: {
      name: string;
      phone: string;
      licenseNumber?: string;
      transporterId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<DriverDTO> {
    const newDriver = await prisma.driver.create({
      data: {
        name: data.name,
        phone: data.phone,
        licenseNumber: data.licenseNumber || null,
        transporterId: data.transporterId || null,
        isActive: true,
        verificationStatus: 'VERIFIED',
        metadata: data.metadata || null,
      },
      include: {
        transporter: true,
      },
    });

    await recordAuditEvent({
      actorId,
      action: 'DRIVER_REGISTERED',
      entityType: 'DRIVER',
      entityId: newDriver.id,
      metadata: { name: data.name, phone: data.phone },
    });

    return this.mapDriverToDTO(newDriver);
  }

  // --- Destination Management ---

  public async getDestinations(): Promise<TransportDestinationDTO[]> {
    const list = await prisma.transportDestination.findMany({
      where: { isActive: true },
    });
    return list.map((d: any) => this.mapDestinationToDTO(d));
  }

  // --- MAPPER HELPERS ---

  private mapTransportRequestToDTO(req: any): TransportRequestDTO {
    return {
      id: req.id,
      requestReference: req.requestReference,
      bookingId: req.bookingId,
      procurementCenterId: req.procurementCenterId,
      cropId: req.cropId,
      quantityQuintals: Number(req.quantityQuintals),
      quantityUnit: req.quantityUnit || 'QUINTAL',
      destinationType: req.destinationType,
      destinationName: req.destinationName,
      destinationAddress: req.destinationAddress,
      destinationDistrict: req.destinationDistrict || undefined,
      destinationState: req.destinationState || undefined,
      requestedDate: req.requestedDate instanceof Date ? req.requestedDate.toISOString() : String(req.requestedDate),
      requiredCapacityQuintals: Number(req.requiredCapacityQuintals),
      status: req.status,
      vehicleId: req.vehicleId || undefined,
      vehicleRegistrationNumber: req.vehicle?.registrationNumber || undefined,
      transporterId: req.transporterId || undefined,
      transporterName: req.transporter?.name || undefined,
      driverId: req.driverId || undefined,
      driverName: req.driverName || req.driver?.name || undefined,
      driverPhone: req.driverPhone || req.driver?.phone || undefined,
      assignedAt: req.assignedAt ? (req.assignedAt instanceof Date ? req.assignedAt.toISOString() : String(req.assignedAt)) : undefined,
      dispatchedAt: req.dispatchedAt ? (req.dispatchedAt instanceof Date ? req.dispatchedAt.toISOString() : String(req.dispatchedAt)) : undefined,
      arrivedAt: req.arrivedAt ? (req.arrivedAt instanceof Date ? req.arrivedAt.toISOString() : String(req.arrivedAt)) : undefined,
      deliveredAt: req.deliveredAt ? (req.deliveredAt instanceof Date ? req.deliveredAt.toISOString() : String(req.deliveredAt)) : undefined,
      cancelledAt: req.cancelledAt ? (req.cancelledAt instanceof Date ? req.cancelledAt.toISOString() : String(req.cancelledAt)) : undefined,
      cancellationReason: req.cancellationReason || undefined,
      deliveryReceiverName: req.deliveryReceiverName || undefined,
      deliveryReceiverDesignation: req.deliveryReceiverDesignation || undefined,
      deliveryRemarks: req.deliveryRemarks || undefined,
      metadata: req.metadata || undefined,
      createdAt: req.createdAt instanceof Date ? req.createdAt.toISOString() : String(req.createdAt),
      updatedAt: req.updatedAt instanceof Date ? req.updatedAt.toISOString() : String(req.updatedAt),
    };
  }

  private mapTransportLoadToDTO(load: any): TransportLoadDTO {
    return {
      id: load.id,
      loadReference: load.loadReference,
      transportRequestId: load.transportRequestId,
      bookingId: load.bookingId,
      vehicleId: load.vehicleId,
      vehicleRegistrationNumber: load.vehicle?.registrationNumber || undefined,
      sourceCenterId: load.sourceCenterId,
      destinationName: load.destinationName,
      cropId: load.cropId,
      quantityQuintals: Number(load.quantityQuintals),
      quantityUnit: load.quantityUnit || 'QUINTAL',
      loadingStartedAt: load.loadingStartedAt ? (load.loadingStartedAt instanceof Date ? load.loadingStartedAt.toISOString() : String(load.loadingStartedAt)) : undefined,
      loadedAt: load.loadedAt ? (load.loadedAt instanceof Date ? load.loadedAt.toISOString() : String(load.loadedAt)) : undefined,
      dispatchedAt: load.dispatchedAt ? (load.dispatchedAt instanceof Date ? load.dispatchedAt.toISOString() : String(load.dispatchedAt)) : undefined,
      arrivedAt: load.arrivedAt ? (load.arrivedAt instanceof Date ? load.arrivedAt.toISOString() : String(load.arrivedAt)) : undefined,
      deliveredAt: load.deliveredAt ? (load.deliveredAt instanceof Date ? load.deliveredAt.toISOString() : String(load.deliveredAt)) : undefined,
      status: load.status,
      metadata: load.metadata || undefined,
      createdAt: load.createdAt instanceof Date ? load.createdAt.toISOString() : String(load.createdAt),
      updatedAt: load.updatedAt instanceof Date ? load.updatedAt.toISOString() : String(load.updatedAt),
    };
  }

  private mapTransporterToDTO(t: any): TransporterDTO {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      phone: t.phone,
      email: t.email || undefined,
      address: t.address || undefined,
      registrationNumber: t.registrationNumber || undefined,
      isActive: t.isActive,
      verificationStatus: t.verificationStatus,
      metadata: t.metadata || undefined,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt),
    };
  }

  private mapVehicleToDTO(v: any): VehicleDTO {
    return {
      id: v.id,
      registrationNumber: v.registrationNumber,
      transporterId: v.transporterId || undefined,
      transporterName: v.transporter?.name || undefined,
      vehicleType: v.vehicleType,
      capacityQuintals: Number(v.capacityQuintals),
      capacityUnit: v.capacityUnit || 'QUINTAL',
      isActive: v.isActive,
      verificationStatus: v.verificationStatus,
      currentLocation: v.currentLocation || undefined,
      metadata: v.metadata || undefined,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
      updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : String(v.updatedAt),
    };
  }

  private mapDriverToDTO(d: any): DriverDTO {
    return {
      id: d.id,
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber || undefined,
      transporterId: d.transporterId || undefined,
      transporterName: d.transporter?.name || undefined,
      isActive: d.isActive,
      verificationStatus: d.verificationStatus,
      metadata: d.metadata || undefined,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt),
    };
  }

  private mapDestinationToDTO(d: any): TransportDestinationDTO {
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      destinationType: d.destinationType,
      address: d.address,
      district: d.district,
      state: d.state,
      pincode: d.pincode || undefined,
      contactPerson: d.contactPerson || undefined,
      contactPhone: d.contactPhone || undefined,
      capacityQuintals: d.capacityQuintals ? Number(d.capacityQuintals) : undefined,
      isActive: d.isActive,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt),
    };
  }
}

export const transportService = new TransportService();
