// ==============================================================================
// KisanFlow — Procurement Center, Bays & 90-min Booking Slot Controller
// Provides discovery endpoints for mandis, bays, daily capacity & slot availability
// ==============================================================================

import { Request, Response } from 'express';
import { prisma } from '../config/prisma.ts';

export async function getProcurementCenters(req: Request, res: Response): Promise<void> {
  const { district, state, cropId, isActive } = req.query;

  const where: Record<string, any> = {};
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }
  if (district) {
    where.district = String(district);
  }
  if (state) {
    where.state = String(state);
  }

  let centers = await prisma.procurementCenter.findMany({
    where,
    include: {
      bays: true,
      bookingSlots: true,
    },
  });

  if (cropId) {
    const targetCropId = String(cropId);
    centers = centers.filter(
      (c: any) => !c.supportedCropIds || c.supportedCropIds.length === 0 || c.supportedCropIds.includes(targetCropId)
    );
  }

  res.json({
    success: true,
    data: centers.map((c: any) => {
      const baysList = c.bays || c.centerBays || [];
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        district: c.district,
        state: c.state,
        address: c.locationAddress || c.address,
        latitude: c.latitude ? Number(c.latitude) : null,
        longitude: c.longitude ? Number(c.longitude) : null,
        contactPerson: c.contactPerson,
        contactPhone: c.contactPhone,
        supportedCropIds: c.supportedCropIds,
        totalBays: c.totalBays || baysList.length || 0,
        activeBaysCount: baysList.filter((b: any) => b.isActive).length || 0,
        dailyCapacityQuintals: c.dailyCapacityQuintals ? Number(c.dailyCapacityQuintals) : 0,
        operatingStartTime: c.operatingHoursStart || c.operatingStartTime,
        operatingEndTime: c.operatingHoursEnd || c.operatingEndTime,
        slotDurationMinutes: c.slotDurationMinutes || 90,
        isActive: c.isActive,
      };
    }),
  });
}

export async function getProcurementCenterById(req: Request, res: Response): Promise<void> {
  const { centerId } = req.params;

  const center: any = await prisma.procurementCenter.findFirst({
    where: {
      OR: [{ id: centerId }, { code: centerId }],
    },
    include: {
      bays: true,
      bookingSlots: true,
    },
  });

  if (!center) {
    res.status(404).json({
      success: false,
      error: { code: 'CENTER_NOT_FOUND', message: 'Procurement center not found' },
    });
    return;
  }

  const baysList = center.bays || center.centerBays || [];

  res.json({
    success: true,
    data: {
      id: center.id,
      code: center.code,
      name: center.name,
      district: center.district,
      state: center.state,
      address: center.locationAddress || center.address,
      latitude: center.latitude ? Number(center.latitude) : null,
      longitude: center.longitude ? Number(center.longitude) : null,
      contactPerson: center.contactPerson,
      contactPhone: center.contactPhone,
      supportedCropIds: center.supportedCropIds,
      totalBays: center.totalBays || baysList.length,
      dailyCapacityQuintals: center.dailyCapacityQuintals ? Number(center.dailyCapacityQuintals) : 0,
      operatingStartTime: center.operatingHoursStart || center.operatingStartTime,
      operatingEndTime: center.operatingHoursEnd || center.operatingEndTime,
      slotDurationMinutes: center.slotDurationMinutes || 90,
      isActive: center.isActive,
      bays: baysList.map((b: any) => ({
        id: b.id,
        bayNumber: b.bayNumber,
        name: b.name,
        bayType: b.bayType,
        status: b.status,
        supportedCropIds: b.supportedCropIds,
        hourlyCapacityQuintals: b.hourlyCapacityQuintals ? Number(b.hourlyCapacityQuintals) : (b.capacityQuintals ? Number(b.capacityQuintals) : 0),
        capacityQuintals: b.capacityQuintals ? Number(b.capacityQuintals) : 0,
        hasWeighbridge: b.hasWeighbridge,
        hasMoistureMeter: b.hasMoistureMeter,
        isActive: b.isActive,
      })),
    },
  });
}

export async function getCenterBays(req: Request, res: Response): Promise<void> {
  const { centerId } = req.params;

  const bays = await prisma.centerBay.findMany({
    where: {
      procurementCenterId: centerId,
    },
  });

  res.json({
    success: true,
    data: bays.map((b: any) => ({
      id: b.id,
      procurementCenterId: b.procurementCenterId,
      bayNumber: b.bayNumber,
      name: b.name,
      bayType: b.bayType,
      status: b.status,
      supportedCropIds: b.supportedCropIds,
      hourlyCapacityQuintals: b.hourlyCapacityQuintals ? Number(b.hourlyCapacityQuintals) : 0,
      hasWeighbridge: b.hasWeighbridge,
      hasMoistureMeter: b.hasMoistureMeter,
      isActive: b.isActive,
    })),
  });
}

export async function getCenterSlots(req: Request, res: Response): Promise<void> {
  const { centerId } = req.params;
  const { date, centerBayId, isAvailable } = req.query;

  const where: Record<string, any> = {
    procurementCenterId: centerId,
  };

  if (centerBayId) {
    where.centerBayId = String(centerBayId);
  }
  if (isAvailable !== undefined) {
    where.isAvailable = isAvailable === 'true';
  }
  if (date) {
    where.slotDate = String(date);
  }

  const slots = await prisma.bookingSlot.findMany({
    where,
    include: {
      procurementCenter: true,
      centerBay: true,
    },
  });

  res.json({
    success: true,
    data: slots.map((s: any) => {
      const maxCap = Number(s.maxCapacityQuintals);
      const bookedCap = Number(s.bookedCapacityQuintals);
      const remainingCap = Math.max(0, maxCap - bookedCap);
      return {
        id: s.id,
        procurementCenterId: s.procurementCenterId,
        centerBayId: s.centerBayId,
        bayNumber: s.centerBay?.bayNumber,
        bayName: s.centerBay?.name,
        slotDate: s.slotDate instanceof Date ? s.slotDate.toISOString().substring(0, 10) : s.slotDate,
        startTime: s.startTime instanceof Date ? s.startTime.toISOString() : s.startTime,
        endTime: s.endTime instanceof Date ? s.endTime.toISOString() : s.endTime,
        maxCapacityQuintals: maxCap,
        bookedCapacityQuintals: bookedCap,
        remainingCapacityQuintals: remainingCap,
        isAvailable: s.isAvailable && remainingCap > 0,
      };
    }),
  });
}

export async function getBookingSlotById(req: Request, res: Response): Promise<void> {
  const { slotId } = req.params;

  const slot: any = await prisma.bookingSlot.findUnique({
    where: { id: slotId },
    include: {
      procurementCenter: true,
      centerBay: true,
    },
  });

  if (!slot) {
    res.status(404).json({
      success: false,
      error: { code: 'SLOT_NOT_FOUND', message: 'Booking slot not found' },
    });
    return;
  }

  const maxCap = Number(slot.maxCapacityQuintals);
  const bookedCap = Number(slot.bookedCapacityQuintals);
  const remainingCap = Math.max(0, maxCap - bookedCap);

  res.json({
    success: true,
    data: {
      id: slot.id,
      procurementCenterId: slot.procurementCenterId,
      procurementCenterName: slot.procurementCenter?.name,
      centerBayId: slot.centerBayId,
      bayNumber: slot.centerBay?.bayNumber,
      bayName: slot.centerBay?.name,
      slotDate: slot.slotDate instanceof Date ? slot.slotDate.toISOString().substring(0, 10) : slot.slotDate,
      startTime: slot.startTime instanceof Date ? slot.startTime.toISOString() : slot.startTime,
      endTime: slot.endTime instanceof Date ? slot.endTime.toISOString() : slot.endTime,
      maxCapacityQuintals: maxCap,
      bookedCapacityQuintals: bookedCap,
      remainingCapacityQuintals: remainingCap,
      isAvailable: slot.isAvailable && remainingCap > 0,
    },
  });
}
