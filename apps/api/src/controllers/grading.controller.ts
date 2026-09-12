// ==============================================================================
// KisanFlow — AI Quality Inspection & Grading Controller
// ==============================================================================

import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/prisma.ts';
import { BookingStatus, CropQualityGrade, UserRole } from '@prisma/client';
import { QualityInspectionDTO, QualityInspectionStatus } from '@kisanflow/types';
import { defaultGradingProvider } from '../providers/gradingProvider.ts';
import { calculateQualityDeduction } from '../services/qualityCalculationService.ts';
import { recordAuditEvent } from '../services/auditService.ts';

export async function createQualityInspection(req: Request, res: Response): Promise<void> {
  try {
    const {
      bookingId,
      moisturePercentage,
      foreignMatterPercentage,
      damagedGrainsPercentage,
      brokenGrainsPercentage,
      sampleImageUrl,
      remarks,
      overrideGrade,
    } = req.body;

    if (!bookingId) {
      res.status(400).json({ error: 'bookingId is required.' });
      return;
    }

    if (moisturePercentage === undefined || moisturePercentage === null || isNaN(Number(moisturePercentage))) {
      res.status(400).json({ error: 'Valid moisturePercentage is required.' });
      return;
    }

    const moistureVal = Number(moisturePercentage);
    if (moistureVal < 0 || moistureVal > 100) {
      res.status(400).json({ error: 'moisturePercentage must be between 0 and 100.' });
      return;
    }

    // Load booking with crop, farmer, and center relations
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        crop: true,
        procurementCenter: true,
        farmerProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }

    const actorUser = (req as any).user;

    // RBAC & IDOR: Farmers cannot perform grade overrides and cannot grade another farmer's booking
    if (actorUser?.role === UserRole.FARMER) {
      if (overrideGrade) {
        res.status(403).json({ error: 'Access denied: Farmers cannot perform grade override.' });
        return;
      }
      if (booking.farmerProfile?.userId && booking.farmerProfile.userId !== actorUser.id) {
        res.status(403).json({ error: 'Access denied: You cannot initiate quality inspection for another farmer booking.' });
        return;
      }
    }

    // Allow inspection on active checked-in or processing bookings
    const allowedStatuses: BookingStatus[] = [
      BookingStatus.CHECKED_IN,
      BookingStatus.IN_QUEUE,
      BookingStatus.PROCESSING,
      BookingStatus.CONFIRMED,
      BookingStatus.QUALITY_ASSESSED,
    ];

    if (!allowedStatuses.includes(booking.status as BookingStatus)) {
      res.status(400).json({
        error: `Cannot perform quality inspection on booking with status '${booking.status}'. Booking must be checked in.`,
      });
      return;
    }

    const crop = (booking as any).crop;
    if (!crop) {
      res.status(400).json({ error: 'Crop details associated with booking not found.' });
      return;
    }

    const standardMoistureLimit = Number(crop.standardMoistureLimit || 12.0);
    const lockedMspRate = Number(booking.lockedRatePerQuintal);

    // Generate unique sample reference
    const timestampRef = Date.now().toString().slice(-6);
    const sampleReference = `SMP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${timestampRef}`;

    // Run AI Grading inference
    const aiResult = await defaultGradingProvider.assessSample({
      sampleReference,
      cropId: crop.id,
      cropName: crop.name,
      cropCode: crop.code,
      moisturePercentage: moistureVal,
      standardMoistureLimit,
      foreignMatterPercentage: foreignMatterPercentage !== undefined ? Number(foreignMatterPercentage) : undefined,
      damagedGrainsPercentage: damagedGrainsPercentage !== undefined ? Number(damagedGrainsPercentage) : undefined,
      brokenGrainsPercentage: brokenGrainsPercentage !== undefined ? Number(brokenGrainsPercentage) : undefined,
      sampleImageUrl,
    });

    const finalGrade: CropQualityGrade =
      overrideGrade && Object.values(CropQualityGrade).includes(overrideGrade)
        ? (overrideGrade as CropQualityGrade)
        : aiResult.predictedGrade;

    const isHumanVerified = !!overrideGrade;

    // Calculate deductions preserving the locked MSP rate
    const deductionCalculation = calculateQualityDeduction({
      lockedMspRate,
      standardMoistureLimit,
      measuredMoisturePercentage: moistureVal,
      grade: finalGrade,
      isHumanOverride: isHumanVerified,
    });

    const inspectionStatus: QualityInspectionStatus = deductionCalculation.isEligibleForProcurement
      ? 'COMPLETED'
      : 'REJECTED';

    const newInspection = await prisma.qualityInspection.create({
      data: {
        bookingId: booking.id,
        farmerProfileId: booking.farmerProfileId,
        cropId: crop.id,
        procurementCenterId: booking.procurementCenterId,
        inspectorId: actorUser?.id || null,
        sampleReference,
        inspectionTimestamp: new Date(),
        status: inspectionStatus,
        moisturePercentage: moistureVal,
        standardMoistureLimit,
        isMoisturePass: deductionCalculation.isMoisturePass,
        excessMoisturePercentage: deductionCalculation.excessMoisturePercentage,
        foreignMatterPercentage: aiResult.foreignMatterPercentage,
        damagedGrainsPercentage: aiResult.damagedGrainsPercentage,
        brokenGrainsPercentage: aiResult.brokenGrainsPercentage,
        otherQualityParameters: {
          analysis: aiResult.parameterAnalysis,
          recommendation: aiResult.recommendation,
          ruleApplied: deductionCalculation.statutoryRuleApplied,
        },
        aiModelVersion: aiResult.aiModelVersion,
        aiConfidenceScore: aiResult.aiConfidenceScore,
        aiInferenceStatus: aiResult.aiInferenceStatus,
        aiPredictedGrade: aiResult.predictedGrade,
        finalGrade,
        isHumanVerified,
        verifiedByUserId: isHumanVerified ? actorUser?.id || null : null,
        verifiedAt: isHumanVerified ? new Date() : null,
        reviewRemarks: isHumanVerified ? remarks || 'Verified during initial grading' : null,
        deductionType: deductionCalculation.deductionType,
        deductionPercentage: deductionCalculation.totalDeductionPercentage,
        deductionAmountPerQuintal: deductionCalculation.deductionAmountPerQuintal,
        lockedMspRate,
        effectiveRatePerQuintal: deductionCalculation.effectiveRatePerQuintal,
        remarks: remarks || deductionCalculation.statutoryRuleApplied,
        evidenceImageUrl: sampleImageUrl || null,
        metadata: {
          statutoryRule: deductionCalculation.statutoryRuleApplied,
          ineligibilityReason: deductionCalculation.ineligibilityReason || null,
        },
      },
    });

    // Update booking status to QUALITY_ASSESSED
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.QUALITY_ASSESSED,
      },
    });

    // Record tamper-evident audit event
    await recordAuditEvent({
      actorId: actorUser?.id || 'SYSTEM_AI_GRADER',
      action: 'QUALITY_INSPECTION_COMPLETED',
      entityType: 'QualityInspection',
      entityId: newInspection.id,
      metadata: {
        bookingId: booking.id,
        sampleReference,
        grade: finalGrade,
        moisturePercentage: moistureVal,
        standardMoistureLimit,
        lockedMspRate,
        effectiveRatePerQuintal: deductionCalculation.effectiveRatePerQuintal,
        status: inspectionStatus,
      },
    });

    const responseDto: QualityInspectionDTO = {
      id: newInspection.id,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      farmerProfileId: booking.farmerProfileId,
      farmerName: (booking as any).farmerProfile?.user?.name || undefined,
      farmerPhone: (booking as any).farmerProfile?.user?.phone || undefined,
      cropId: crop.id,
      cropName: crop.name,
      cropCode: crop.code,
      procurementCenterId: booking.procurementCenterId,
      centerName: (booking as any).procurementCenter?.name || undefined,
      inspectorId: actorUser?.id || null,
      inspectorName: actorUser?.name || 'AI AgriVision Grader',
      sampleReference,
      inspectionTimestamp: (newInspection as any).inspectionTimestamp.toISOString(),
      status: inspectionStatus,
      moisturePercentage: moistureVal,
      standardMoistureLimit,
      isMoisturePass: deductionCalculation.isMoisturePass,
      excessMoisturePercentage: deductionCalculation.excessMoisturePercentage,
      foreignMatterPercentage: aiResult.foreignMatterPercentage,
      damagedGrainsPercentage: aiResult.damagedGrainsPercentage,
      brokenGrainsPercentage: aiResult.brokenGrainsPercentage,
      otherQualityParameters: (newInspection as any).otherQualityParameters,
      aiModelVersion: aiResult.aiModelVersion,
      aiConfidenceScore: aiResult.aiConfidenceScore,
      aiInferenceStatus: aiResult.aiInferenceStatus,
      aiPredictedGrade: aiResult.predictedGrade,
      finalGrade,
      isHumanVerified,
      verifiedByUserId: isHumanVerified ? actorUser?.id || null : null,
      verifiedAt: isHumanVerified ? new Date().toISOString() : null,
      reviewRemarks: isHumanVerified ? remarks || null : null,
      deductionType: deductionCalculation.deductionType,
      deductionPercentage: deductionCalculation.totalDeductionPercentage,
      deductionAmountPerQuintal: deductionCalculation.deductionAmountPerQuintal,
      lockedMspRate,
      effectiveRatePerQuintal: deductionCalculation.effectiveRatePerQuintal,
      remarks: remarks || deductionCalculation.statutoryRuleApplied,
      evidenceImageUrl: sampleImageUrl || null,
      createdAt: (newInspection as any).createdAt.toISOString(),
      updatedAt: (newInspection as any).updatedAt.toISOString(),
    };

    res.status(201).json(responseDto);
  } catch (error) {
    console.error('Error creating quality inspection:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to create quality inspection.' });
  }
}

export async function getQualityInspectionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const inspection = await prisma.qualityInspection.findUnique({
      where: { id },
      include: {
        booking: true,
        crop: true,
        procurementCenter: true,
        farmerProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!inspection) {
      res.status(404).json({ error: 'Quality inspection not found.' });
      return;
    }

    const actorUser = (req as any).user;
    if (actorUser?.role === UserRole.FARMER) {
      if (inspection.farmerProfile?.userId && inspection.farmerProfile.userId !== actorUser.id) {
        res.status(403).json({ error: 'Access denied: You do not have permission to view this inspection.' });
        return;
      }
    }

    const dto = formatInspectionDTO(inspection);
    res.status(200).json(dto);
  } catch (error) {
    console.error('Error fetching quality inspection:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch inspection.' });
  }
}

export async function getQualityInspectionByBookingId(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId } = req.params;
    const inspection = await prisma.qualityInspection.findFirst({
      where: { bookingId },
      include: {
        booking: true,
        crop: true,
        procurementCenter: true,
        farmerProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!inspection) {
      res.status(404).json({ error: 'No quality inspection found for this booking.' });
      return;
    }

    const actorUser = (req as any).user;
    if (actorUser?.role === UserRole.FARMER) {
      if (inspection.farmerProfile?.userId && inspection.farmerProfile.userId !== actorUser.id) {
        res.status(403).json({ error: 'Access denied: You do not have permission to view this inspection.' });
        return;
      }
    }

    const dto = formatInspectionDTO(inspection);
    res.status(200).json(dto);
  } catch (error) {
    console.error('Error fetching quality inspection by booking:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch inspection.' });
  }
}

export async function listQualityInspections(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId, farmerProfileId, procurementCenterId, cropId, status, limit } = req.query;

    const actorUser = (req as any).user;
    const where: Record<string, unknown> = {};
    if (bookingId) where.bookingId = String(bookingId);
    if (farmerProfileId) where.farmerProfileId = String(farmerProfileId);
    if (procurementCenterId) where.procurementCenterId = String(procurementCenterId);
    if (cropId) where.cropId = String(cropId);
    if (status) where.status = String(status);

    if (actorUser?.role === UserRole.FARMER) {
      const farmerProf = await prisma.farmerProfile.findFirst({
        where: { userId: actorUser.id },
      });
      if (!farmerProf) {
        res.status(200).json([]);
        return;
      }
      where.farmerProfileId = farmerProf.id;
    }

    const list = await prisma.qualityInspection.findMany({
      where,
      include: {
        booking: true,
        crop: true,
        procurementCenter: true,
        farmerProfile: {
          include: {
            user: true,
          },
        },
      },
      take: limit ? Math.min(Number(limit), 200) : 100,
      orderBy: { createdAt: 'desc' },
    });

    const dtos = list.map(formatInspectionDTO);
    res.status(200).json(dtos);
  } catch (error) {
    console.error('Error listing quality inspections:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to list inspections.' });
  }
}

export async function verifyQualityInspection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { finalGrade, reviewRemarks, customDeductionPercentage } = req.body;

    const actorUser = (req as any).user;
    const allowedRoles: UserRole[] = [
      UserRole.QUALITY_INSPECTOR,
      UserRole.CENTER_OPERATOR,
      UserRole.GOVERNMENT_ADMIN,
      UserRole.SUPER_ADMIN,
    ];

    if (actorUser && !allowedRoles.includes(actorUser.role)) {
      res.status(403).json({ error: 'Access denied: Only authorized quality inspectors or procurement officers can verify/override grading.' });
      return;
    }

    const existing = await prisma.qualityInspection.findUnique({
      where: { id },
      include: {
        booking: true,
        crop: true,
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Quality inspection not found.' });
      return;
    }

    const selectedGrade: CropQualityGrade =
      finalGrade && Object.values(CropQualityGrade).includes(finalGrade)
        ? (finalGrade as CropQualityGrade)
        : (existing.finalGrade as CropQualityGrade);

    // Recalculate deductions with new grade while preserving locked MSP
    const deductionCalculation = calculateQualityDeduction({
      lockedMspRate: Number(existing.lockedMspRate),
      standardMoistureLimit: Number(existing.standardMoistureLimit),
      measuredMoisturePercentage: Number(existing.moisturePercentage),
      grade: selectedGrade,
      isHumanOverride: true,
      customDeductionPercentage: customDeductionPercentage !== undefined ? Number(customDeductionPercentage) : undefined,
    });

    const newStatus: QualityInspectionStatus = deductionCalculation.isEligibleForProcurement
      ? 'COMPLETED'
      : 'REJECTED';

    const updated = await prisma.qualityInspection.update({
      where: { id },
      data: {
        finalGrade: selectedGrade,
        isHumanVerified: true,
        verifiedByUserId: actorUser?.id || null,
        verifiedAt: new Date(),
        reviewRemarks: reviewRemarks || 'Grade verified/adjusted by authorized inspector',
        status: newStatus,
        deductionType: deductionCalculation.deductionType,
        deductionPercentage: deductionCalculation.totalDeductionPercentage,
        deductionAmountPerQuintal: deductionCalculation.deductionAmountPerQuintal,
        effectiveRatePerQuintal: deductionCalculation.effectiveRatePerQuintal,
      },
      include: {
        booking: true,
        crop: true,
        procurementCenter: true,
        farmerProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    await recordAuditEvent({
      actorId: actorUser?.id || 'OFFICIAL_INSPECTOR',
      action: 'QUALITY_INSPECTION_HUMAN_VERIFIED',
      entityType: 'QualityInspection',
      entityId: id,
      metadata: {
        previousGrade: existing.finalGrade,
        newGrade: selectedGrade,
        effectiveRatePerQuintal: deductionCalculation.effectiveRatePerQuintal,
        reviewRemarks,
      },
    });

    const dto = formatInspectionDTO(updated);
    res.status(200).json(dto);
  } catch (error) {
    console.error('Error verifying quality inspection:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to verify inspection.' });
  }
}

function formatInspectionDTO(inspection: any): QualityInspectionDTO {
  return {
    id: inspection.id,
    bookingId: inspection.bookingId,
    bookingNumber: inspection.booking?.bookingNumber,
    farmerProfileId: inspection.farmerProfileId,
    farmerName: inspection.farmerProfile?.user?.name || undefined,
    farmerPhone: inspection.farmerProfile?.user?.phone || undefined,
    cropId: inspection.cropId,
    cropName: inspection.crop?.name || undefined,
    cropCode: inspection.crop?.code || undefined,
    procurementCenterId: inspection.procurementCenterId,
    centerName: inspection.procurementCenter?.name || undefined,
    inspectorId: inspection.inspectorId || null,
    inspectorName: inspection.inspector?.name || undefined,
    sampleReference: inspection.sampleReference,
    inspectionTimestamp:
      inspection.inspectionTimestamp instanceof Date
        ? inspection.inspectionTimestamp.toISOString()
        : String(inspection.inspectionTimestamp),
    status: inspection.status,
    moisturePercentage: Number(inspection.moisturePercentage),
    standardMoistureLimit: Number(inspection.standardMoistureLimit),
    isMoisturePass: Boolean(inspection.isMoisturePass),
    excessMoisturePercentage: Number(inspection.excessMoisturePercentage),
    foreignMatterPercentage: inspection.foreignMatterPercentage ? Number(inspection.foreignMatterPercentage) : undefined,
    damagedGrainsPercentage: inspection.damagedGrainsPercentage ? Number(inspection.damagedGrainsPercentage) : undefined,
    brokenGrainsPercentage: inspection.brokenGrainsPercentage ? Number(inspection.brokenGrainsPercentage) : undefined,
    otherQualityParameters: inspection.otherQualityParameters,
    aiModelVersion: inspection.aiModelVersion,
    aiConfidenceScore: Number(inspection.aiConfidenceScore),
    aiInferenceStatus: inspection.aiInferenceStatus,
    aiPredictedGrade: inspection.aiPredictedGrade,
    finalGrade: inspection.finalGrade,
    isHumanVerified: Boolean(inspection.isHumanVerified),
    verifiedByUserId: inspection.verifiedByUserId || null,
    verifiedAt: inspection.verifiedAt ? (inspection.verifiedAt instanceof Date ? inspection.verifiedAt.toISOString() : String(inspection.verifiedAt)) : null,
    reviewRemarks: inspection.reviewRemarks || null,
    deductionType: inspection.deductionType,
    deductionPercentage: Number(inspection.deductionPercentage),
    deductionAmountPerQuintal: Number(inspection.deductionAmountPerQuintal),
    lockedMspRate: Number(inspection.lockedMspRate),
    effectiveRatePerQuintal: Number(inspection.effectiveRatePerQuintal),
    remarks: inspection.remarks || null,
    evidenceImageUrl: inspection.evidenceImageUrl || null,
    createdAt: inspection.createdAt instanceof Date ? inspection.createdAt.toISOString() : String(inspection.createdAt),
    updatedAt: inspection.updatedAt instanceof Date ? inspection.updatedAt.toISOString() : String(inspection.updatedAt),
  };
}
