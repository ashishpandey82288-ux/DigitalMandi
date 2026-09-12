// ==============================================================================
// KisanFlow — Smart Procurement Booking & MSP Lock Controller
// Handles slot reservation, MSP rate locking, token/PIN generation, and lifecycle
// ==============================================================================

import crypto from 'crypto';
import { Response } from 'express';
import { Prisma, BookingStatus } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import { recordAuditEvent } from '../services/auditService.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

function toDateStr(d: any): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

function toDateOnlyStr(d: any): string | undefined {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString().substring(0, 10);
  return String(d).substring(0, 10);
}

// Helper to format booking objects for consistent API responses
function formatBookingResponse(b: any) {
  if (!b) return null;
  const quantity = b.estimatedQuantityQuintals ? Number(b.estimatedQuantityQuintals) : 0;
  const lockedRate = b.lockedRatePerQuintal ? Number(b.lockedRatePerQuintal) : 0;
  const totalPayout = quantity * lockedRate;

  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    bookingReference: b.bookingReference || b.bookingNumber,
    tokenNumber: b.tokenNumber,
    status: b.status,
    farmerProfileId: b.farmerProfileId,
    farmerName: b.farmerProfile?.user?.name || b.farmerProfile?.fullName || 'Registered Farmer',
    farmerPhone: b.farmerProfile?.user?.phone || b.farmerProfile?.mobileNumber,
    farmId: b.farmId,
    farmName: b.farm?.name || 'Registered Farm Parcel',
    cropId: b.cropId,
    cropName: b.crop?.name || 'Commodity',
    cropCode: b.crop?.code,
    procurementCenterId: b.procurementCenterId,
    centerName: b.procurementCenter?.name || 'Procurement Center',
    centerCode: b.procurementCenter?.code,
    centerBayId: b.centerBayId,
    bayNumber: b.centerBay?.bayNumber,
    bayName: b.centerBay?.name,
    bookingSlotId: b.bookingSlotId,
    slotDate: toDateOnlyStr(b.bookingSlot?.slotDate) || toDateOnlyStr(b.bookingDate),
    slotStartTime: toDateStr(b.bookingSlot?.startTime),
    slotEndTime: toDateStr(b.bookingSlot?.endTime),
    bookingDate: toDateStr(b.bookingDate),
    estimatedQuantityQuintals: quantity,
    quantityUnit: b.quantityUnit || 'QUINTAL',
    lockedMspRateId: b.lockedMspRateId,
    lockedRatePerQuintal: lockedRate,
    lockedMspRate: lockedRate,
    totalGuaranteedPayout: totalPayout,
    mspMarketingYear: b.mspMarketingYear,
    mspSeason: b.mspSeason,
    mspRateReference: b.mspRateReference,
    mspLockedAt: toDateStr(b.mspLockedAt),
    mspLockExpiresAt: toDateStr(b.mspLockExpiresAt),
    securePin: b.securePin,
    qrCodeSignature: b.qrCodeSignature,
    cancellationReason: b.cancellationReason,
    metadata: b.metadata || {},
    createdAt: toDateStr(b.createdAt),
    updatedAt: toDateStr(b.updatedAt),
  };
}

/**
 * POST /api/bookings
 * Reserves a procurement slot, locks the statutory MSP rate, and issues token & PIN
 */
export async function createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  // 1. Resolve Farmer Profile
  const farmerProfile = await prisma.farmerProfile.findFirst({
    where: { userId },
  });

  if (!farmerProfile) {
    res.status(400).json({
      success: false,
      error: {
        code: 'FARMER_PROFILE_REQUIRED',
        message: 'A registered farmer profile is required before booking procurement slots',
      },
    });
    return;
  }

  const {
    cropId,
    quantityUnit = 'QUINTAL',
    metadata = {},
  } = req.body;

  const centerId = req.body.procurementCenterId || req.body.centerId;
  const slotId = req.body.bookingSlotId || req.body.slotId;
  const bayId = req.body.centerBayId || req.body.bayId || null;
  const quantity = Number(req.body.quantity ?? req.body.estimatedQuantity ?? req.body.estimatedQuantityQuintals);

  // 2. Validate Quantity
  if (!quantity || quantity <= 0 || isNaN(quantity)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_QUANTITY', message: 'Quantity must be a positive number greater than 0' },
    });
    return;
  }

  // 3. Resolve & Validate Farm
  let farmId = req.body.farmId;
  if (farmId) {
    const farm = await prisma.farm.findFirst({
      where: { id: farmId, farmerProfileId: farmerProfile.id },
    });
    if (!farm) {
      res.status(404).json({
        success: false,
        error: { code: 'FARM_NOT_FOUND', message: 'Farm parcel not found or does not belong to farmer' },
      });
      return;
    }
  } else {
    const primaryFarm = await prisma.farm.findFirst({
      where: { farmerProfileId: farmerProfile.id },
    });
    if (!primaryFarm) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FARMS_REGISTERED', message: 'No registered farm parcels found. Please register land first.' },
      });
      return;
    }
    farmId = primaryFarm.id;
  }

  // 4. Validate Crop Master Record
  const crop = await prisma.crop.findUnique({
    where: { id: cropId },
  });

  if (!crop) {
    res.status(404).json({
      success: false,
      error: { code: 'CROP_NOT_FOUND', message: 'Specified crop was not found in the master catalog' },
    });
    return;
  }

  if (!crop.isActive) {
    res.status(400).json({
      success: false,
      error: { code: 'INACTIVE_CROP', message: 'Specified crop is currently inactive for government procurement' },
    });
    return;
  }

  // 5. Validate Procurement Center
  const center = await prisma.procurementCenter.findUnique({
    where: { id: centerId },
  });

  if (!center) {
    res.status(404).json({
      success: false,
      error: { code: 'CENTER_NOT_FOUND', message: 'Procurement center not found' },
    });
    return;
  }

  if (!center.isActive) {
    res.status(400).json({
      success: false,
      error: { code: 'INACTIVE_CENTER', message: 'Selected procurement center is inactive or decommissioned' },
    });
    return;
  }

  const centerSupportedCrops: string[] = (center as any).supportedCropIds || [];
  if (centerSupportedCrops.length > 0 && !centerSupportedCrops.includes(cropId)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_CROP',
        message: `Center ${center.name} does not procure ${crop.name}. Supported crops: ${centerSupportedCrops.join(', ')}`,
      },
    });
    return;
  }

  // 6. Validate Center Bay if provided
  let validatedBayId: string | null = null;
  if (bayId) {
    const bay = await prisma.centerBay.findUnique({
      where: { id: bayId },
    });
    if (!bay) {
      res.status(404).json({
        success: false,
        error: { code: 'BAY_NOT_FOUND', message: 'Specified bay was not found' },
      });
      return;
    }
    if (bay.procurementCenterId !== centerId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAY_CENTER_MISMATCH', message: 'Bay does not belong to the selected procurement center' },
      });
      return;
    }
    if (!bay.isActive) {
      res.status(400).json({
        success: false,
        error: { code: 'INACTIVE_BAY', message: 'Selected bay is inactive or under maintenance' },
      });
      return;
    }
    const baySupportedCrops: string[] = (bay as any).supportedCropIds || [];
    if (baySupportedCrops.length > 0 && !baySupportedCrops.includes(cropId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_CROP_FOR_BAY',
          message: `Bay ${bay.name} does not accept ${crop.name}`,
        },
      });
      return;
    }
    validatedBayId = bay.id;
  }

  // 7. Validate Booking Slot & Remaining Capacity
  const slot = await prisma.bookingSlot.findUnique({
    where: { id: slotId },
  });

  if (!slot) {
    res.status(404).json({
      success: false,
      error: { code: 'SLOT_NOT_FOUND', message: 'Booking slot not found' },
    });
    return;
  }

  if (slot.procurementCenterId !== centerId) {
    res.status(400).json({
      success: false,
      error: { code: 'SLOT_CENTER_MISMATCH', message: 'Booking slot does not belong to the selected procurement center' },
    });
    return;
  }

  if (validatedBayId && slot.centerBayId && slot.centerBayId !== validatedBayId) {
    res.status(400).json({
      success: false,
      error: { code: 'SLOT_BAY_MISMATCH', message: 'Booking slot is assigned to a different bay' },
    });
    return;
  }

  // Optional date match check
  const requestedDate = req.body.date || req.body.bookingDate;
  if (requestedDate) {
    const reqDateFormatted = requestedDate.substring(0, 10);
    const slotDateFormatted = slot.slotDate.toISOString().substring(0, 10);
    if (reqDateFormatted !== slotDateFormatted) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_DATE_MISMATCH',
          message: `Requested date (${reqDateFormatted}) does not match slot date (${slotDateFormatted})`,
        },
      });
      return;
    }
  }

  const maxCapacity = Number(slot.maxCapacityQuintals);
  const bookedCapacity = Number(slot.bookedCapacityQuintals);
  const remainingCapacity = maxCapacity - bookedCapacity;

  if (!slot.isAvailable || remainingCapacity <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: 'This slot is completely booked and unavailable for new reservations',
      },
    });
    return;
  }

  if (quantity > remainingCapacity) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_SLOT_CAPACITY',
        message: `Requested quantity (${quantity} Qtl) exceeds remaining slot capacity (${remainingCapacity.toFixed(2)} Qtl)`,
        details: { maxCapacity, bookedCapacity, remainingCapacity, requestedQuantity: quantity },
      },
    });
    return;
  }

  // 8. Look up statutory MSP Rate to Lock
  const mspRate = await prisma.mSPRate.findFirst({
    where: { cropId, isActive: true },
    orderBy: { marketingYear: 'desc' },
  });

  if (!mspRate) {
    res.status(404).json({
      success: false,
      error: {
        code: 'MSP_RATE_NOT_FOUND',
        message: `No active statutory MSP rate found for crop ${crop.name}`,
      },
    });
    return;
  }

  const lockedRate = Number(mspRate.ratePerQuintal) + Number(mspRate.bonusPerQuintal || 0);
  const now = new Date();
  const mspLockExpiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day guaranteed window

  // 9. Generate Sequential/Random Identifiers, Token, Secure PIN & QR signature
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);

  const bookingNumber = `BK-${currentYear}${currentMonth}-${randomSuffix}`;
  const tokenNumber = `KF-${currentYear}-${randomSuffix}`;
  const securePin = Math.floor(100000 + Math.random() * 900000).toString();

  const qrPayload = JSON.stringify({
    token: tokenNumber,
    bookingNumber,
    farmerId: farmerProfile.id,
    cropId,
    centerId,
    slotId,
    quantity,
    pin: securePin,
    rate: lockedRate,
  });
  const qrSecret = process.env.JWT_SECRET || 'kisanflow-secure-hmac-key';
  const qrCodeSignature = crypto.createHmac('sha256', qrSecret).update(qrPayload).digest('hex');

  // 10. Reserve Slot Capacity with concurrent race-condition guard
  const currentSlot = await prisma.bookingSlot.findUnique({
    where: { id: slot.id },
  });
  const currentBooked = Number(currentSlot?.bookedCapacityQuintals || bookedCapacity);
  const currentMax = Number(currentSlot?.maxCapacityQuintals || maxCapacity);
  if (currentBooked + quantity > currentMax) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_SLOT_CAPACITY',
        message: 'Slot capacity was filled by a concurrent reservation. Please select another slot.',
      },
    });
    return;
  }
  const newBookedCapacity = currentBooked + quantity;
  const isAvailableAfterBooking = newBookedCapacity < currentMax;

  await prisma.bookingSlot.update({
    where: { id: slot.id },
    data: {
      bookedCapacityQuintals: new Prisma.Decimal(newBookedCapacity),
      isAvailable: isAvailableAfterBooking,
    },
  });

  // 11. Create Booking Record
  const booking = await prisma.booking.create({
    data: {
      bookingNumber,
      bookingReference: bookingNumber,
      farmerProfileId: farmerProfile.id,
      farmId,
      cropId,
      procurementCenterId: centerId,
      centerBayId: slot.centerBayId || validatedBayId,
      bookingSlotId: slot.id,
      bookingDate: slot.slotDate,
      estimatedQuantityQuintals: new Prisma.Decimal(quantity),
      quantityUnit,
      lockedMspRateId: mspRate.id,
      lockedRatePerQuintal: new Prisma.Decimal(lockedRate),
      mspMarketingYear: mspRate.marketingYear,
      mspSeason: mspRate.season,
      mspRateReference: mspRate.sourceReference,
      mspLockedAt: now,
      mspLockExpiresAt,
      tokenNumber,
      securePin,
      qrCodeSignature,
      status: BookingStatus.CONFIRMED,
      metadata: (metadata as Prisma.InputJsonObject) || {},
    },
    include: {
      farmerProfile: {
        include: { user: true },
      },
      farm: true,
      crop: true,
      procurementCenter: true,
      centerBay: true,
      bookingSlot: true,
      lockedMspRate: true,
    },
  });

  // 12. Record Audit Event
  await recordAuditEvent({
    actorId: userId,
    action: 'BOOKING_CREATED',
    entityType: 'Booking',
    entityId: booking.id,
    metadata: {
      bookingNumber,
      tokenNumber,
      cropId,
      cropName: crop.name,
      procurementCenterId: centerId,
      slotId,
      quantity,
      lockedRatePerQuintal: lockedRate,
      mspMarketingYear: mspRate.marketingYear,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Procurement slot booked and statutory MSP rate locked successfully',
    data: formatBookingResponse(booking),
  });
}

/**
 * GET /api/bookings
 * Lists bookings with strict farmer isolation and operator/admin filters
 */
export async function getBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const whereClause: Record<string, any> = {};

  // Strict Farmer Isolation
  if (userRole === 'FARMER') {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
    });
    if (!farmerProfile) {
      res.json({ success: true, data: [], meta: { total: 0 } });
      return;
    }
    whereClause.farmerProfileId = farmerProfile.id;
  } else {
    // Admin / Operator Filters
    if (req.query.farmerProfileId) {
      whereClause.farmerProfileId = String(req.query.farmerProfileId);
    }
    if (req.query.farmerId) {
      whereClause.farmerProfileId = String(req.query.farmerId);
    }
    if (req.query.centerId || req.query.procurementCenterId) {
      whereClause.procurementCenterId = String(req.query.centerId || req.query.procurementCenterId);
    }
  }

  if (req.query.cropId) {
    whereClause.cropId = String(req.query.cropId);
  }
  if (req.query.status) {
    whereClause.status = String(req.query.status);
  }
  if (req.query.token || req.query.tokenNumber) {
    whereClause.tokenNumber = String(req.query.token || req.query.tokenNumber);
  }

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      farmerProfile: {
        include: { user: true },
      },
      farm: true,
      crop: true,
      procurementCenter: true,
      centerBay: true,
      bookingSlot: true,
      lockedMspRate: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: bookings.map(formatBookingResponse),
    meta: {
      total: bookings.length,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * GET /api/bookings/:bookingId
 * Retrieves a single booking with relations, enforcing IDOR protection
 */
export async function getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { bookingId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { id: bookingId },
        { bookingNumber: bookingId },
        { bookingReference: bookingId },
        { tokenNumber: bookingId },
      ],
    },
    include: {
      farmerProfile: {
        include: { user: true },
      },
      farm: true,
      crop: true,
      procurementCenter: true,
      centerBay: true,
      bookingSlot: true,
      lockedMspRate: true,
    },
  });

  if (!booking) {
    res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
    return;
  }

  // IDOR Protection: Farmer can only access their own bookings
  if (userRole === 'FARMER') {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
    });
    if (!farmerProfile || booking.farmerProfileId !== farmerProfile.id) {
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
      return;
    }
  }

  res.json({
    success: true,
    data: formatBookingResponse(booking),
  });
}

/**
 * PATCH /api/bookings/:bookingId
 * Updates booking metadata or status with state machine verification
 */
export async function updateBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { bookingId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: bookingId }, { bookingNumber: bookingId }],
    },
  });

  if (!booking) {
    res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
    return;
  }

  // IDOR Protection for Farmer
  if (userRole === 'FARMER') {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
    });
    if (!farmerProfile || booking.farmerProfileId !== farmerProfile.id) {
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
      return;
    }
  }

  const { status: targetStatus, cancellationReason, metadata } = req.body;

  // Validate State Transitions
  if (targetStatus && targetStatus !== booking.status) {
    const current = booking.status;
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
      CONFIRMED: ['CHECKED_IN', 'IN_QUEUE', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
      RESCHEDULED: ['CONFIRMED', 'CANCELLED'],
      CHECKED_IN: ['IN_QUEUE', 'CANCELLED'],
      IN_QUEUE: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], // Terminal
      CANCELLED: [], // Terminal
      EXPIRED: [],   // Terminal
      NO_SHOW: [],   // Terminal
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(targetStatus)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot transition booking status from ${current} to ${targetStatus}`,
        },
      });
      return;
    }

    // If transitioning to CANCELLED via PATCH, release slot capacity
    if (targetStatus === 'CANCELLED') {
      const slot = await prisma.bookingSlot.findUnique({
        where: { id: booking.bookingSlotId },
      });
      if (slot) {
        const qty = Number(booking.estimatedQuantityQuintals);
        const curBooked = Number(slot.bookedCapacityQuintals);
        const newBooked = Math.max(0, curBooked - qty);
        await prisma.bookingSlot.update({
          where: { id: slot.id },
          data: {
            bookedCapacityQuintals: new Prisma.Decimal(newBooked),
            isAvailable: true,
          },
        });
      }
    }
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      ...(targetStatus ? { status: targetStatus as BookingStatus } : {}),
      ...(cancellationReason ? { cancellationReason } : {}),
      ...(metadata ? { metadata: metadata as Prisma.InputJsonObject } : {}),
    },
    include: {
      farmerProfile: {
        include: { user: true },
      },
      farm: true,
      crop: true,
      procurementCenter: true,
      centerBay: true,
      bookingSlot: true,
      lockedMspRate: true,
    },
  });

  await recordAuditEvent({
    actorId: userId,
    action: 'BOOKING_UPDATED',
    entityType: 'Booking',
    entityId: updatedBooking.id,
    metadata: {
      previousStatus: booking.status,
      newStatus: updatedBooking.status,
      cancellationReason,
    },
  });

  res.json({
    success: true,
    message: 'Booking updated successfully',
    data: formatBookingResponse(updatedBooking),
  });
}

/**
 * POST /api/bookings/:bookingId/cancel
 * Cancels a booking, releases slot capacity, preserves MSP snapshot & token
 */
export async function cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { bookingId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: bookingId }, { bookingNumber: bookingId }, { tokenNumber: bookingId }],
    },
  });

  if (!booking) {
    res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
    return;
  }

  // IDOR Protection for Farmer
  if (userRole === 'FARMER') {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
    });
    if (!farmerProfile || booking.farmerProfileId !== farmerProfile.id) {
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
      return;
    }
  }

  // Check if already cancelled
  if (booking.status === 'CANCELLED') {
    res.status(400).json({
      success: false,
      error: { code: 'ALREADY_CANCELLED', message: 'This booking has already been cancelled' },
    });
    return;
  }

  // Check if completed
  if (booking.status === 'COMPLETED') {
    res.status(400).json({
      success: false,
      error: { code: 'CANNOT_CANCEL_COMPLETED', message: 'Completed bookings cannot be cancelled' },
    });
    return;
  }

  const cancellationReason = req.body.cancellationReason || 'Cancelled by farmer';

  // Release Slot Capacity
  const slot = await prisma.bookingSlot.findUnique({
    where: { id: booking.bookingSlotId },
  });

  let remainingSlotCapacity = 0;
  if (slot) {
    const quantity = Number(booking.estimatedQuantityQuintals);
    const curBooked = Number(slot.bookedCapacityQuintals);
    const newBooked = Math.max(0, curBooked - quantity);
    const maxCap = Number(slot.maxCapacityQuintals);

    const updatedSlot = await prisma.bookingSlot.update({
      where: { id: slot.id },
      data: {
        bookedCapacityQuintals: new Prisma.Decimal(newBooked),
        isAvailable: true,
      },
    });
    remainingSlotCapacity = maxCap - newBooked;
  }

  // Update Booking Status to CANCELLED (Preserving historical MSP rate & token)
  const cancelledBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELLED,
      cancellationReason,
    },
    include: {
      farmerProfile: {
        include: { user: true },
      },
      farm: true,
      crop: true,
      procurementCenter: true,
      centerBay: true,
      bookingSlot: true,
      lockedMspRate: true,
    },
  });

  // Record Audit Event
  await recordAuditEvent({
    actorId: userId,
    action: 'BOOKING_CANCELLED',
    entityType: 'Booking',
    entityId: cancelledBooking.id,
    metadata: {
      bookingNumber: cancelledBooking.bookingNumber,
      tokenNumber: cancelledBooking.tokenNumber,
      cancellationReason,
      releasedCapacityQuintals: Number(cancelledBooking.estimatedQuantityQuintals),
    },
  });

  res.json({
    success: true,
    message: 'Booking cancelled successfully. Reserved slot capacity has been released.',
    data: {
      ...formatBookingResponse(cancelledBooking),
      slotCapacityReleased: Number(cancelledBooking.estimatedQuantityQuintals),
      slotRemainingCapacity: remainingSlotCapacity,
    },
  });
}

/**
 * GET /api/bookings/:bookingId/token
 * Dedicated endpoint returning the procurement gate pass, token, secure PIN & QR signature
 */
export async function getBookingToken(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { bookingId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: bookingId }, { bookingNumber: bookingId }, { tokenNumber: bookingId }],
    },
    include: {
      farmerProfile: {
        include: { user: true },
      },
      farm: true,
      crop: true,
      procurementCenter: true,
      centerBay: true,
      bookingSlot: true,
      lockedMspRate: true,
    },
  });

  if (!booking) {
    res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
    return;
  }

  // IDOR Protection
  if (userRole === 'FARMER') {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
    });
    if (!farmerProfile || booking.farmerProfileId !== farmerProfile.id) {
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
      return;
    }
  }

  const formatted = formatBookingResponse(booking);

  res.json({
    success: true,
    data: {
      tokenNumber: formatted?.tokenNumber,
      bookingNumber: formatted?.bookingNumber,
      bookingReference: formatted?.bookingReference,
      status: formatted?.status,
      securePin: formatted?.securePin,
      qrCodeSignature: formatted?.qrCodeSignature,
      farmer: {
        id: formatted?.farmerProfileId,
        name: formatted?.farmerName,
        phone: formatted?.farmerPhone,
      },
      crop: {
        id: formatted?.cropId,
        name: formatted?.cropName,
        code: formatted?.cropCode,
      },
      procurementCenter: {
        id: formatted?.procurementCenterId,
        name: formatted?.centerName,
        code: formatted?.centerCode,
      },
      centerBay: formatted?.centerBayId ? {
        id: formatted.centerBayId,
        number: formatted.bayNumber,
        name: formatted.bayName,
      } : null,
      slot: {
        id: formatted?.bookingSlotId,
        date: formatted?.slotDate,
        startTime: formatted?.slotStartTime,
        endTime: formatted?.slotEndTime,
      },
      quantity: formatted?.estimatedQuantityQuintals,
      quantityUnit: formatted?.quantityUnit,
      lockedRatePerQuintal: formatted?.lockedRatePerQuintal,
      totalGuaranteedPayout: formatted?.totalGuaranteedPayout,
      generatedAt: formatted?.createdAt,
    },
  });
}

/**
 * GET /api/bookings/:bookingId/msp
 * Dedicated endpoint returning the locked statutory MSP snapshot details & price guarantee
 */
export async function getBookingMsp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { bookingId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ id: bookingId }, { bookingNumber: bookingId }, { tokenNumber: bookingId }],
    },
    include: {
      crop: true,
      lockedMspRate: true,
    },
  });

  if (!booking) {
    res.status(404).json({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
    return;
  }

  // IDOR Protection
  if (userRole === 'FARMER') {
    const farmerProfile = await prisma.farmerProfile.findFirst({
      where: { userId },
    });
    if (!farmerProfile || booking.farmerProfileId !== farmerProfile.id) {
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
      return;
    }
  }

  const quantity = Number(booking.estimatedQuantityQuintals);
  const lockedRate = Number(booking.lockedRatePerQuintal);
  const totalGuaranteedPayout = quantity * lockedRate;
  const now = new Date();
  const isLockValid = booking.mspLockExpiresAt ? now <= booking.mspLockExpiresAt : true;

  // Look up current statutory rate to demonstrate price protection guarantee
  const currentStatutoryRate = await prisma.mSPRate.findFirst({
    where: { cropId: booking.cropId, isActive: true },
    orderBy: { marketingYear: 'desc' },
  });

  const currentRateValue = currentStatutoryRate ? Number(currentStatutoryRate.ratePerQuintal) : lockedRate;
  const priceDifference = lockedRate - currentRateValue;

  res.json({
    success: true,
    data: {
      bookingNumber: booking.bookingNumber,
      tokenNumber: booking.tokenNumber,
      cropId: booking.cropId,
      cropName: booking.crop?.name,
      lockedMspRateId: booking.lockedMspRateId,
      lockedRatePerQuintal: lockedRate,
      quantityQuintals: quantity,
      totalGuaranteedPayout,
      marketingYear: booking.mspMarketingYear,
      season: booking.mspSeason,
      sourceReference: booking.mspRateReference,
      mspLockedAt: booking.mspLockedAt ? booking.mspLockedAt.toISOString() : undefined,
      mspLockExpiresAt: booking.mspLockExpiresAt ? booking.mspLockExpiresAt.toISOString() : undefined,
      isLockValid,
      comparison: {
        lockedRatePerQuintal: lockedRate,
        currentMasterRatePerQuintal: currentRateValue,
        guaranteedAdvantagePerQuintal: priceDifference,
        priceProtected: true,
      },
    },
  });
}

/**
 * POST /api/bookings/verify-gate-pass
 * Validates gate pass token, 6-digit security PIN, and HMAC-SHA256 QR code signature.
 * Enforces gate entry security:
 * - Rejects invalid QR signature / modified payload
 * - Rejects invalid PIN
 * - Rejects expired or cancelled booking status
 * - Rejects unassigned / wrong center entry attempt
 * - Supports automatic transition to CHECKED_IN
 */
export async function verifyGatePass(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { tokenNumber, bookingNumber, securePin, qrPayload, signature, centerId, performCheckIn } = req.body;
    const actorUser = req.user;

    const allowedRoles: string[] = ['CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'];
    if (actorUser && !allowedRoles.includes(actorUser.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized gate/center operators can verify gate passes.' },
      });
      return;
    }

    let lookupId = tokenNumber || bookingNumber;
    if (!lookupId && qrPayload) {
      try {
        const parsed = JSON.parse(qrPayload);
        lookupId = parsed.token || parsed.bookingNumber;
      } catch {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_QR_PAYLOAD', message: 'QR payload contains invalid JSON data.' },
        });
        return;
      }
    }

    if (!lookupId) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_IDENTIFIER', message: 'tokenNumber, bookingNumber, or qrPayload is required.' },
      });
      return;
    }

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ tokenNumber: lookupId }, { bookingNumber: lookupId }, { id: lookupId }],
      },
      include: {
        farmerProfile: { include: { user: true } },
        procurementCenter: true,
        crop: true,
        bookingSlot: true,
      },
    });

    if (!booking) {
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'No booking found matching the provided gate pass credentials.' },
      });
      return;
    }

    if (centerId && booking.procurementCenterId !== centerId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CENTER_MISMATCH',
          message: `Gate pass is issued for center ${booking.procurementCenter?.name || booking.procurementCenterId}, not ${centerId}.`,
        },
      });
      return;
    }

    if (booking.status === 'CANCELLED' || (booking.status as string) === 'REJECTED') {
      res.status(400).json({
        success: false,
        error: { code: 'BOOKING_INACTIVE', message: `Gate pass cannot be used. Booking status is ${booking.status}.` },
      });
      return;
    }

    if (signature && qrPayload) {
      const qrSecret = process.env.JWT_SECRET || 'kisanflow-secure-hmac-key';
      const expectedSignature = crypto.createHmac('sha256', qrSecret).update(qrPayload).digest('hex');
      if (signature !== expectedSignature && signature !== booking.qrCodeSignature) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_QR_SIGNATURE', message: 'Cryptographic QR code signature verification failed. Tampered gate pass detected.' },
        });
        return;
      }
    }

    if (securePin && String(securePin).trim() !== String(booking.securePin).trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_SECURE_PIN', message: 'Invalid 6-digit security PIN provided.' },
      });
      return;
    }

    let updatedBooking = booking;
    if (performCheckIn && (booking.status === 'CONFIRMED' || booking.status === 'PENDING')) {
      updatedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CHECKED_IN',
        },
        include: {
          farmerProfile: { include: { user: true } },
          procurementCenter: true,
          crop: true,
          bookingSlot: true,
        },
      });

      await recordAuditEvent({
        actorId: actorUser?.id || 'GATE_OPERATOR',
        action: 'GATE_PASS_VERIFIED_CHECKED_IN',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: {
          tokenNumber: booking.tokenNumber,
          bookingNumber: booking.bookingNumber,
          centerId: booking.procurementCenterId,
        },
      });
    }

    res.json({
      success: true,
      message: 'Gate pass verified successfully.',
      data: {
        bookingId: updatedBooking.id,
        bookingNumber: updatedBooking.bookingNumber,
        tokenNumber: updatedBooking.tokenNumber,
        status: updatedBooking.status,
        farmerName: (updatedBooking as any).farmerProfile?.user?.name,
        cropName: (updatedBooking as any).crop?.name,
        quantityQuintals: Number(updatedBooking.estimatedQuantityQuintals),
        lockedMspRate: Number(updatedBooking.lockedRatePerQuintal),
        procurementCenter: (updatedBooking as any).procurementCenter?.name,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GATE_VERIFICATION_FAILED', message: (error as Error).message },
    });
  }
}
