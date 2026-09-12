// ==============================================================================
// KisanFlow — Weighment & Procurement Value Calculation Controller
// ==============================================================================

import { Request, Response } from 'express';
import { prisma } from '../config/prisma.ts';
import { BookingStatus, CropQualityGrade, UserRole } from '@prisma/client';
import { WeighmentDTO, DeductionType, ProcurementCalculationSnapshotDTO } from '@kisanflow/types';
import { calculateWeighment } from '../services/qualityCalculationService.ts';
import { recordAuditEvent } from '../services/auditService.ts';

export async function recordWeighment(req: Request, res: Response): Promise<void> {
  try {
    const {
      bookingId,
      grossWeightQuintals,
      tareWeightQuintals,
      scaleDeviceId,
      verificationStatus,
      metadata,
    } = req.body;

    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required.' });
      return;
    }

    if (grossWeightQuintals === undefined || isNaN(Number(grossWeightQuintals))) {
      res.status(400).json({ error: 'Valid grossWeightQuintals is required.' });
      return;
    }

    if (tareWeightQuintals === undefined || isNaN(Number(tareWeightQuintals))) {
      res.status(400).json({ error: 'Valid tareWeightQuintals is required.' });
      return;
    }

    const gross = Number(grossWeightQuintals);
    const tare = Number(tareWeightQuintals);

    if (gross <= 0) {
      res.status(400).json({ error: 'Gross weight must be greater than zero quintals.' });
      return;
    }

    if (tare < 0) {
      res.status(400).json({ error: 'Tare weight cannot be negative.' });
      return;
    }

    if (gross <= tare) {
      res.status(400).json({
        error: `Gross weight (${gross} qtl) must be strictly greater than tare weight (${tare} qtl).`,
      });
      return;
    }

    if (gross > 10000 || tare > 10000) {
      res.status(400).json({
        error: 'Weighment value exceeds physical scale capacity (maximum 10,000 quintals).',
      });
      return;
    }

    const actorUser = (req as any).user;
    const allowedRoles: UserRole[] = [
      UserRole.CENTER_OPERATOR,
      UserRole.QUALITY_INSPECTOR,
      UserRole.GOVERNMENT_ADMIN,
      UserRole.SUPER_ADMIN,
    ];

    if (actorUser && !allowedRoles.includes(actorUser.role)) {
      res.status(403).json({
        error: 'Access denied: Only authorized weighment operators or procurement officials can record weighment.',
      });
      return;
    }

    // Load booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        crop: true,
        procurementCenter: true,
      },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    // Duplicate weighment check
    const existingWeighment = await prisma.weighment.findFirst({
      where: { bookingId: booking.id },
    });
    if (existingWeighment) {
      res.status(400).json({
        error: 'A weighment has already been recorded for this booking.',
        code: 'DUPLICATE_WEIGHMENT',
      });
      return;
    }

    // Look up associated quality inspection
    const inspection = await prisma.qualityInspection.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'desc' },
    });

    const lockedMspRate = Number(booking.lockedRatePerQuintal);
    let effectiveRatePerQuintal = lockedMspRate;
    let qualityGrade: CropQualityGrade = CropQualityGrade.GRADE_A;
    let deductionType: DeductionType = 'PERCENTAGE';
    let deductionValue = 0;

    if (inspection) {
      effectiveRatePerQuintal = Number(inspection.effectiveRatePerQuintal);
      qualityGrade = inspection.finalGrade as CropQualityGrade;
      deductionType = inspection.deductionType as DeductionType;
      deductionValue = Number(inspection.deductionPercentage);
    }

    // Run robust weighment calculation
    const weighmentCalc = calculateWeighment(
      {
        grossWeightQuintals: gross,
        tareWeightQuintals: tare,
        effectiveRatePerQuintal,
        lockedMspRate,
        qualityGrade,
        deductionType,
        deductionValue,
      },
      booking.id
    );

    const activeScaleDevice = scaleDeviceId || 'DIGI-SCALE-IND-01';

    const newWeighment = await prisma.weighment.create({
      data: {
        bookingId: booking.id,
        cropGradingId: inspection?.id || null,
        procurementCenterId: booking.procurementCenterId,
        weighingOperatorId: actorUser?.id || 'OPERATOR-SYS',
        grossWeightQuintals: weighmentCalc.grossWeightQuintals,
        tareWeightQuintals: weighmentCalc.tareWeightQuintals,
        netWeightQuintals: weighmentCalc.netWeightQuintals,
        quantityUnit: 'QUINTAL',
        scaleDeviceId: activeScaleDevice,
        verificationStatus: verificationStatus || 'CALIBRATED_VERIFIED',
        weighedAt: new Date(),
        lockedMspRate,
        qualityGrade,
        deductionType,
        deductionValue,
        effectiveRatePerQuintal,
        finalPayableAmount: weighmentCalc.finalPayableAmount,
        metadata: {
          ...metadata,
          snapshot: weighmentCalc.snapshot,
          deductionAmountTotal: weighmentCalc.deductionAmountTotal,
        },
      },
    });

    // Advance booking state to WEIGHED
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.WEIGHED,
      },
    });

    // Record tamper-evident audit event
    await recordAuditEvent({
      actorId: actorUser?.id || 'OPERATOR_SYS',
      action: 'WEIGHMENT_RECORDED',
      entityType: 'Weighment',
      entityId: newWeighment.id,
      metadata: {
        bookingId: booking.id,
        scaleDeviceId: activeScaleDevice,
        grossWeightQuintals: weighmentCalc.grossWeightQuintals,
        tareWeightQuintals: weighmentCalc.tareWeightQuintals,
        netWeightQuintals: weighmentCalc.netWeightQuintals,
        lockedMspRate,
        effectiveRatePerQuintal,
        finalPayableAmount: weighmentCalc.finalPayableAmount,
      },
    });

    const responseDto: WeighmentDTO = {
      id: newWeighment.id,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      inspectionId: inspection?.id || null,
      procurementCenterId: booking.procurementCenterId,
      centerName: (booking as any).procurementCenter?.name || undefined,
      weighingOperatorId: actorUser?.id || 'OPERATOR-SYS',
      operatorName: actorUser?.name || 'Weighment Operator',
      grossWeightQuintals: weighmentCalc.grossWeightQuintals,
      tareWeightQuintals: weighmentCalc.tareWeightQuintals,
      netWeightQuintals: weighmentCalc.netWeightQuintals,
      quantityUnit: 'QUINTAL',
      scaleDeviceId: activeScaleDevice,
      verificationStatus: verificationStatus || 'CALIBRATED_VERIFIED',
      weighedAt: (newWeighment as any).weighedAt.toISOString(),
      lockedMspRate,
      qualityGrade,
      deductionType,
      deductionValue,
      effectiveRatePerQuintal,
      finalPayableAmount: weighmentCalc.finalPayableAmount,
      metadata: (newWeighment as any).metadata,
      createdAt: (newWeighment as any).createdAt.toISOString(),
      updatedAt: (newWeighment as any).updatedAt.toISOString(),
    };

    res.status(201).json(responseDto);
  } catch (error) {
    console.error('Error recording weighment:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to record weighment.' });
  }
}

export async function getWeighmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const weighment = await prisma.weighment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            farmerProfile: true,
          },
        },
        procurementCenter: true,
        weighingOperator: true,
      },
    });

    if (!weighment) {
      res.status(404).json({ error: 'Weighment record not found.' });
      return;
    }

    const actorUser = (req as any).user;
    if (actorUser?.role === UserRole.FARMER) {
      if ((weighment.booking as any)?.farmerProfile?.userId && (weighment.booking as any).farmerProfile.userId !== actorUser.id) {
        res.status(403).json({ error: 'Access denied: You do not have permission to view this weighment.' });
        return;
      }
    }

    const dto = formatWeighmentDTO(weighment);
    res.status(200).json(dto);
  } catch (error) {
    console.error('Error fetching weighment:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch weighment.' });
  }
}

export async function getWeighmentByBookingId(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId } = req.params;
    const weighment = await prisma.weighment.findFirst({
      where: { bookingId },
      include: {
        booking: {
          include: {
            farmerProfile: true,
          },
        },
        procurementCenter: true,
        weighingOperator: true,
      },
    });

    if (!weighment) {
      res.status(404).json({ error: 'No weighment record found for this booking.' });
      return;
    }

    const actorUser = (req as any).user;
    if (actorUser?.role === UserRole.FARMER) {
      if ((weighment.booking as any)?.farmerProfile?.userId && (weighment.booking as any).farmerProfile.userId !== actorUser.id) {
        res.status(403).json({ error: 'Access denied: You do not have permission to view this weighment.' });
        return;
      }
    }

    const dto = formatWeighmentDTO(weighment);
    res.status(200).json(dto);
  } catch (error) {
    console.error('Error fetching weighment by booking:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch weighment.' });
  }
}

export async function listWeighments(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId, procurementCenterId, weighingOperatorId, limit } = req.query;

    const actorUser = (req as any).user;
    const where: Record<string, unknown> = {};
    if (bookingId) where.bookingId = String(bookingId);
    if (procurementCenterId) where.procurementCenterId = String(procurementCenterId);
    if (weighingOperatorId) where.weighingOperatorId = String(weighingOperatorId);

    if (actorUser?.role === UserRole.FARMER) {
      const farmerProf = await prisma.farmerProfile.findFirst({
        where: { userId: actorUser.id },
      });
      if (!farmerProf) {
        res.status(200).json([]);
        return;
      }
      where.booking = { farmerProfileId: farmerProf.id };
    }

    const list = await prisma.weighment.findMany({
      where,
      include: {
        booking: true,
        procurementCenter: true,
        weighingOperator: true,
      },
      take: limit ? Math.min(Number(limit), 200) : 100,
      orderBy: { createdAt: 'desc' },
    });

    const dtos = list.map(formatWeighmentDTO);
    res.status(200).json(dtos);
  } catch (error) {
    console.error('Error listing weighments:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to list weighments.' });
  }
}

export async function previewProcurementCalculation(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId, grossWeightQuintals, tareWeightQuintals } = req.body;

    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required.' });
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { crop: true },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const inspection = await prisma.qualityInspection.findFirst({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'desc' },
    });

    const lockedMspRate = Number(booking.lockedRatePerQuintal);
    const effectiveRate = inspection ? Number(inspection.effectiveRatePerQuintal) : lockedMspRate;
    const grade = (inspection?.finalGrade as CropQualityGrade) || CropQualityGrade.GRADE_A;
    const deductionType = (inspection?.deductionType as DeductionType) || 'PERCENTAGE';
    const deductionValue = inspection ? Number(inspection.deductionPercentage) : 0;

    const gross = Number(grossWeightQuintals || booking.estimatedQuantityQuintals);
    const tare = Number(tareWeightQuintals || 0);

    const calc = calculateWeighment(
      {
        grossWeightQuintals: gross,
        tareWeightQuintals: tare,
        effectiveRatePerQuintal: effectiveRate,
        lockedMspRate,
        qualityGrade: grade,
        deductionType,
        deductionValue,
      },
      booking.id
    );

    res.status(200).json(calc);
  } catch (error) {
    console.error('Error calculating procurement preview:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to calculate preview.' });
  }
}

function formatWeighmentDTO(w: any): WeighmentDTO {
  return {
    id: w.id,
    bookingId: w.bookingId,
    bookingNumber: w.booking?.bookingNumber,
    inspectionId: w.cropGradingId || null,
    procurementCenterId: w.procurementCenterId,
    centerName: w.procurementCenter?.name || undefined,
    weighingOperatorId: w.weighingOperatorId,
    operatorName: w.weighingOperator?.name || undefined,
    grossWeightQuintals: Number(w.grossWeightQuintals),
    tareWeightQuintals: Number(w.tareWeightQuintals),
    netWeightQuintals: Number(w.netWeightQuintals),
    quantityUnit: w.quantityUnit || 'QUINTAL',
    scaleDeviceId: w.scaleDeviceId,
    verificationStatus: w.verificationStatus,
    weighedAt: w.weighedAt instanceof Date ? w.weighedAt.toISOString() : String(w.weighedAt),
    lockedMspRate: Number(w.lockedMspRate),
    qualityGrade: w.qualityGrade,
    deductionType: w.deductionType,
    deductionValue: Number(w.deductionValue),
    effectiveRatePerQuintal: Number(w.effectiveRatePerQuintal),
    finalPayableAmount: Number(w.finalPayableAmount),
    metadata: w.metadata,
    createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : String(w.createdAt),
    updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : String(w.updatedAt),
  };
}
