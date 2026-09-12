// ==============================================================================
// KisanFlow — FarmerCrop Controller
// Handles Farmer-owned Cultivation listings, retrieval, creation, updates, and deletion
// Enforces strict IDOR protection, farm ownership, area capacity limits, and audit logging
// ==============================================================================

import { Response } from 'express';
import { Prisma, FarmerCrop, Crop, Farm, LandAreaUnit, FarmerCropStatus } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';
import { recordAuditEvent } from '../services/auditService.ts';
import { CreateFarmerCropInput, UpdateFarmerCropInput } from '../validators/farmerCrop.validator.ts';
import { logger } from '../utils/logger.ts';

// 1 Hectare = 2.47105 Acres
const HECTARE_TO_ACRE_MULTIPLIER = 2.47105;
const CAPACITY_EPSILON = 0.0001;

/**
 * Normalizes any area to Acres for uniform arithmetic comparisons
 */
function normalizeToAcres(area: number, unit: LandAreaUnit): number {
  return unit === LandAreaUnit.HECTARE ? area * HECTARE_TO_ACRE_MULTIPLIER : area;
}

/**
 * Standardized FarmerCrop Response Formatter
 */
export function formatFarmerCropResponse(
  farmerCrop: FarmerCrop & {
    crop?: Partial<Crop> | null;
    farm?: Partial<Farm> | null;
  }
) {
  return {
    id: farmerCrop.id,
    farmerProfileId: farmerCrop.farmerProfileId,
    farmId: farmerCrop.farmId,
    cropId: farmerCrop.cropId,
    season: farmerCrop.season,
    sowingDate: farmerCrop.sowingDate ? farmerCrop.sowingDate.toISOString() : null,
    expectedHarvestDate: farmerCrop.expectedHarvestDate ? farmerCrop.expectedHarvestDate.toISOString() : null,
    cultivatedArea: Number(farmerCrop.cultivatedArea),
    areaUnit: farmerCrop.areaUnit,
    expectedYield: farmerCrop.expectedYield !== null && farmerCrop.expectedYield !== undefined
      ? Number(farmerCrop.expectedYield)
      : null,
    yieldUnit: farmerCrop.yieldUnit,
    status: farmerCrop.status,
    createdAt: farmerCrop.createdAt.toISOString(),
    updatedAt: farmerCrop.updatedAt.toISOString(),
    ...(farmerCrop.crop
      ? {
          crop: {
            id: farmerCrop.crop.id,
            name: farmerCrop.crop.name,
            code: farmerCrop.crop.code,
            category: farmerCrop.crop.category,
            standardMoistureLimit: farmerCrop.crop.standardMoistureLimit !== undefined && farmerCrop.crop.standardMoistureLimit !== null
              ? Number(farmerCrop.crop.standardMoistureLimit)
              : undefined,
            description: farmerCrop.crop.description,
          },
        }
      : {}),
    ...(farmerCrop.farm
      ? {
          farm: {
            id: farmerCrop.farm.id,
            farmName: farmerCrop.farm.farmName,
            landParcelNumber: farmerCrop.farm.landParcelNumber,
            district: farmerCrop.farm.district,
            state: farmerCrop.farm.state,
            village: farmerCrop.farm.village,
          },
        }
      : {}),
  };
}

/**
 * GET /api/farmer/crops
 * Retrieves all crop cultivations belonging strictly to the authenticated farmer
 */
export async function getFarmerCrops(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Fetch all farmer crops belonging strictly to this profile
    const crops = await prisma.farmerCrop.findMany({
      where: { farmerProfileId: farmerProfile.id },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            standardMoistureLimit: true,
            description: true,
          },
        },
        farm: {
          select: {
            id: true,
            farmName: true,
            landParcelNumber: true,
            district: true,
            state: true,
            village: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(
      res,
      crops.map(formatFarmerCropResponse),
      `Successfully retrieved ${crops.length} farmer crop record(s)`,
      200,
      { timestamp: new Date().toISOString(), total: crops.length }
    );
  } catch (err: unknown) {
    logger.error('Failed to retrieve farmer crops', 'FarmerCropController', err);
    sendError(res, 'Internal error retrieving farmer crops', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/farmer/crops/:farmerCropId
 * Retrieves a single crop cultivation record owned by the authenticated farmer
 */
export async function getFarmerCropById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const { farmerCropId } = req.params;
    if (!farmerCropId) {
      sendError(res, 'Farmer crop ID is required', 400, 'VALIDATION_ERROR');
      return;
    }

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Fetch crop cultivation record strictly scoped to this farmer profile (IDOR Defense)
    const crop = await prisma.farmerCrop.findFirst({
      where: {
        id: farmerCropId,
        farmerProfileId: farmerProfile.id,
      },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            standardMoistureLimit: true,
            description: true,
          },
        },
        farm: {
          select: {
            id: true,
            farmName: true,
            landParcelNumber: true,
            district: true,
            state: true,
            village: true,
          },
        },
      },
    });

    if (!crop) {
      sendError(res, 'Farmer crop record not found', 404, 'CROP_NOT_FOUND');
      return;
    }

    sendSuccess(res, formatFarmerCropResponse(crop), 'Farmer crop retrieved successfully', 200);
  } catch (err: unknown) {
    logger.error('Failed to retrieve farmer crop by ID', 'FarmerCropController', err);
    sendError(res, 'Internal error retrieving farmer crop', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/farmer/crops
 * Creates a new crop cultivation record for the authenticated farmer
 */
export async function createFarmerCrop(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    const input: CreateFarmerCropInput = req.body;

    // 2. Verify Farm Ownership (Farm must exist AND belong to authenticated farmer profile)
    const farm = await prisma.farm.findFirst({
      where: {
        id: input.farmId,
        farmerProfileId: farmerProfile.id,
      },
      select: {
        id: true,
        farmName: true,
        landParcelNumber: true,
        totalAreaAcres: true,
        landAreaUnit: true,
        district: true,
        state: true,
        village: true,
      },
    });

    if (!farm) {
      sendError(
        res,
        'Farm not found or does not belong to the authenticated farmer',
        404,
        'FARM_NOT_FOUND'
      );
      return;
    }

    // 3. Verify Crop Master Record (Must exist and be active)
    const crop = await prisma.crop.findUnique({
      where: { id: input.cropId },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        standardMoistureLimit: true,
        description: true,
        isActive: true,
      },
    });

    if (!crop) {
      sendError(res, 'Crop not found in master catalog', 404, 'CROP_NOT_FOUND');
      return;
    }

    if (!crop.isActive) {
      sendError(res, 'Crop is inactive in master catalog', 400, 'INACTIVE_CROP');
      return;
    }

    // 4. Verify Farm Cultivated Area Capacity Limit
    const farmCapacityAcres = normalizeToAcres(Number(farm.totalAreaAcres), farm.landAreaUnit);
    const requestedAreaUnit = input.areaUnit || LandAreaUnit.ACRE;
    const requestedAcres = normalizeToAcres(input.cultivatedArea, requestedAreaUnit);

    // Sum all currently cultivated active (non-harvested) crops on this farm
    const existingCropsOnFarm = await prisma.farmerCrop.findMany({
      where: {
        farmId: farm.id,
        status: { not: FarmerCropStatus.HARVESTED },
      },
      select: {
        cultivatedArea: true,
        areaUnit: true,
      },
    });

    const currentUsedAcres = existingCropsOnFarm.reduce((acc, c) => {
      return acc + normalizeToAcres(Number(c.cultivatedArea), c.areaUnit);
    }, 0);

    const totalRequiredAcres = currentUsedAcres + requestedAcres;

    if (totalRequiredAcres > farmCapacityAcres + CAPACITY_EPSILON) {
      const availableAcres = Math.max(0, farmCapacityAcres - currentUsedAcres);
      sendError(
        res,
        `Cultivated area (${input.cultivatedArea} ${requestedAreaUnit}) exceeds available farm capacity. Available: ${availableAcres.toFixed(2)} acres, Total farm size: ${farmCapacityAcres.toFixed(2)} acres.`,
        400,
        'AREA_EXCEEDS_CAPACITY',
        {
          requestedArea: input.cultivatedArea,
          requestedAreaUnit,
          farmTotalAcres: farmCapacityAcres,
          currentUsedAcres,
          availableAcres,
        }
      );
      return;
    }

    // 5. Create FarmerCrop record
    const newFarmerCrop = await prisma.farmerCrop.create({
      data: {
        farmerProfileId: farmerProfile.id,
        farmId: farm.id,
        cropId: crop.id,
        season: input.season,
        sowingDate: input.sowingDate ? new Date(input.sowingDate) : null,
        expectedHarvestDate: input.expectedHarvestDate ? new Date(input.expectedHarvestDate) : null,
        cultivatedArea: new Prisma.Decimal(input.cultivatedArea),
        areaUnit: requestedAreaUnit,
        expectedYield: input.expectedYield !== undefined && input.expectedYield !== null
          ? new Prisma.Decimal(input.expectedYield)
          : null,
        yieldUnit: input.yieldUnit || 'QUINTAL',
        status: input.status || FarmerCropStatus.PLANNED,
      },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            standardMoistureLimit: true,
            description: true,
          },
        },
        farm: {
          select: {
            id: true,
            farmName: true,
            landParcelNumber: true,
            district: true,
            state: true,
            village: true,
          },
        },
      },
    });

    // 6. Cryptographic Audit Logging
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'FARMER_CROP_CREATED',
      entityType: 'FarmerCrop',
      entityId: newFarmerCrop.id,
      metadata: {
        farmerCropId: newFarmerCrop.id,
        farmerProfileId: farmerProfile.id,
        farmId: farm.id,
        cropId: crop.id,
        cropName: crop.name,
        cropCode: crop.code,
        season: newFarmerCrop.season,
        cultivatedArea: Number(newFarmerCrop.cultivatedArea),
        areaUnit: newFarmerCrop.areaUnit,
        status: newFarmerCrop.status,
      },
    });

    sendSuccess(
      res,
      formatFarmerCropResponse(newFarmerCrop),
      'Farmer crop registered successfully',
      201
    );
  } catch (err: unknown) {
    logger.error('Failed to create farmer crop', 'FarmerCropController', err);
    sendError(res, 'Internal error creating farmer crop', 500, 'INTERNAL_ERROR');
  }
}

/**
 * PUT /api/farmer/crops/:farmerCropId
 * Updates an existing crop cultivation record owned by the authenticated farmer
 */
export async function updateFarmerCrop(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const { farmerCropId } = req.params;
    if (!farmerCropId) {
      sendError(res, 'Farmer crop ID is required', 400, 'VALIDATION_ERROR');
      return;
    }

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Fetch existing crop record strictly owned by this farmer profile (IDOR Defense)
    const existingCrop = await prisma.farmerCrop.findFirst({
      where: {
        id: farmerCropId,
        farmerProfileId: farmerProfile.id,
      },
      include: {
        farm: true,
        crop: true,
      },
    });

    if (!existingCrop) {
      sendError(res, 'Farmer crop record not found', 404, 'CROP_NOT_FOUND');
      return;
    }

    const input: UpdateFarmerCropInput = req.body;

    // 3. If farmId is being modified, verify new farm ownership
    let targetFarm = existingCrop.farm;
    if (input.farmId && input.farmId !== existingCrop.farmId) {
      const newFarm = await prisma.farm.findFirst({
        where: {
          id: input.farmId,
          farmerProfileId: farmerProfile.id,
        },
      });

      if (!newFarm) {
        sendError(
          res,
          'Specified farm not found or does not belong to the authenticated farmer',
          404,
          'FARM_NOT_FOUND'
        );
        return;
      }
      targetFarm = newFarm;
    }

    // 4. If cropId is being modified, verify new crop master
    if (input.cropId && input.cropId !== existingCrop.cropId) {
      const newCrop = await prisma.crop.findUnique({
        where: { id: input.cropId },
      });

      if (!newCrop) {
        sendError(res, 'Crop not found in master catalog', 404, 'CROP_NOT_FOUND');
        return;
      }

      if (!newCrop.isActive) {
        sendError(res, 'Crop is inactive in master catalog', 400, 'INACTIVE_CROP');
        return;
      }
    }

    // 5. Temporal Chronology Validation (Sowing vs Harvest Date)
    const effectiveSowing = input.sowingDate !== undefined
      ? (input.sowingDate ? new Date(input.sowingDate) : null)
      : existingCrop.sowingDate;

    const effectiveHarvest = input.expectedHarvestDate !== undefined
      ? (input.expectedHarvestDate ? new Date(input.expectedHarvestDate) : null)
      : existingCrop.expectedHarvestDate;

    if (effectiveSowing && effectiveHarvest && effectiveHarvest.getTime() < effectiveSowing.getTime()) {
      sendError(
        res,
        'Expected harvest date cannot be earlier than sowing date',
        400,
        'VALIDATION_ERROR',
        [{ path: 'expectedHarvestDate', message: 'Expected harvest date cannot be earlier than sowing date' }]
      );
      return;
    }

    // 6. Area Capacity Validation
    const effectiveArea = input.cultivatedArea !== undefined
      ? input.cultivatedArea
      : Number(existingCrop.cultivatedArea);

    const effectiveUnit = input.areaUnit !== undefined
      ? input.areaUnit
      : existingCrop.areaUnit;

    const effectiveStatus = input.status !== undefined
      ? input.status
      : existingCrop.status;

    // Check capacity if the updated crop remains active (non-harvested)
    if (effectiveStatus !== FarmerCropStatus.HARVESTED) {
      const farmCapacityAcres = normalizeToAcres(Number(targetFarm.totalAreaAcres), targetFarm.landAreaUnit);
      const requestedAcres = normalizeToAcres(effectiveArea, effectiveUnit);

      // Fetch other active crops on target farm, EXCLUDING the current record
      const otherCropsOnFarm = await prisma.farmerCrop.findMany({
        where: {
          farmId: targetFarm.id,
          id: { not: existingCrop.id },
          status: { not: FarmerCropStatus.HARVESTED },
        },
        select: {
          cultivatedArea: true,
          areaUnit: true,
        },
      });

      const otherUsedAcres = otherCropsOnFarm.reduce((acc, c) => {
        return acc + normalizeToAcres(Number(c.cultivatedArea), c.areaUnit);
      }, 0);

      const totalRequiredAcres = otherUsedAcres + requestedAcres;

      if (totalRequiredAcres > farmCapacityAcres + CAPACITY_EPSILON) {
        const availableAcres = Math.max(0, farmCapacityAcres - otherUsedAcres);
        sendError(
          res,
          `Cultivated area (${effectiveArea} ${effectiveUnit}) exceeds available farm capacity. Available: ${availableAcres.toFixed(2)} acres, Total farm size: ${farmCapacityAcres.toFixed(2)} acres.`,
          400,
          'AREA_EXCEEDS_CAPACITY',
          {
            requestedArea: effectiveArea,
            effectiveUnit,
            farmTotalAcres: farmCapacityAcres,
            otherUsedAcres,
            availableAcres,
          }
        );
        return;
      }
    }

    // 7. Update FarmerCrop record
    const updatedFarmerCrop = await prisma.farmerCrop.update({
      where: { id: existingCrop.id },
      data: {
        ...(input.farmId ? { farmId: input.farmId } : {}),
        ...(input.cropId ? { cropId: input.cropId } : {}),
        ...(input.season ? { season: input.season } : {}),
        ...(input.sowingDate !== undefined
          ? { sowingDate: input.sowingDate ? new Date(input.sowingDate) : null }
          : {}),
        ...(input.expectedHarvestDate !== undefined
          ? { expectedHarvestDate: input.expectedHarvestDate ? new Date(input.expectedHarvestDate) : null }
          : {}),
        ...(input.cultivatedArea !== undefined
          ? { cultivatedArea: new Prisma.Decimal(input.cultivatedArea) }
          : {}),
        ...(input.areaUnit ? { areaUnit: input.areaUnit } : {}),
        ...(input.expectedYield !== undefined
          ? {
              expectedYield: input.expectedYield !== null
                ? new Prisma.Decimal(input.expectedYield)
                : null,
            }
          : {}),
        ...(input.yieldUnit ? { yieldUnit: input.yieldUnit } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: {
        crop: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            standardMoistureLimit: true,
            description: true,
          },
        },
        farm: {
          select: {
            id: true,
            farmName: true,
            landParcelNumber: true,
            district: true,
            state: true,
            village: true,
          },
        },
      },
    });

    // 8. Cryptographic Audit Logging
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'FARMER_CROP_UPDATED',
      entityType: 'FarmerCrop',
      entityId: updatedFarmerCrop.id,
      metadata: {
        farmerCropId: updatedFarmerCrop.id,
        farmerProfileId: farmerProfile.id,
        updatedFields: Object.keys(req.body),
        farmId: updatedFarmerCrop.farmId,
        cropId: updatedFarmerCrop.cropId,
        season: updatedFarmerCrop.season,
        status: updatedFarmerCrop.status,
        cultivatedArea: Number(updatedFarmerCrop.cultivatedArea),
      },
    });

    sendSuccess(
      res,
      formatFarmerCropResponse(updatedFarmerCrop),
      'Farmer crop updated successfully',
      200
    );
  } catch (err: unknown) {
    logger.error('Failed to update farmer crop', 'FarmerCropController', err);
    sendError(res, 'Internal error updating farmer crop', 500, 'INTERNAL_ERROR');
  }
}

/**
 * DELETE /api/farmer/crops/:farmerCropId
 * Deletes an existing crop cultivation record owned by the authenticated farmer
 */
export async function deleteFarmerCrop(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const { farmerCropId } = req.params;
    if (!farmerCropId) {
      sendError(res, 'Farmer crop ID is required', 400, 'VALIDATION_ERROR');
      return;
    }

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Fetch existing crop record strictly owned by this farmer profile (IDOR Defense)
    const existingCrop = await prisma.farmerCrop.findFirst({
      where: {
        id: farmerCropId,
        farmerProfileId: farmerProfile.id,
      },
      include: {
        crop: { select: { id: true, name: true, code: true } },
        farm: { select: { id: true, landParcelNumber: true } },
      },
    });

    if (!existingCrop) {
      sendError(res, 'Farmer crop record not found', 404, 'CROP_NOT_FOUND');
      return;
    }

    // 3. Delete record
    await prisma.farmerCrop.delete({
      where: { id: existingCrop.id },
    });

    // 4. Cryptographic Audit Logging
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'FARMER_CROP_DELETED',
      entityType: 'FarmerCrop',
      entityId: existingCrop.id,
      metadata: {
        farmerCropId: existingCrop.id,
        farmerProfileId: farmerProfile.id,
        farmId: existingCrop.farmId,
        cropId: existingCrop.cropId,
        cropName: existingCrop.crop.name,
        cropCode: existingCrop.crop.code,
        season: existingCrop.season,
        cultivatedArea: Number(existingCrop.cultivatedArea),
      },
    });

    sendSuccess(
      res,
      { id: existingCrop.id },
      'Farmer crop record deleted successfully',
      200
    );
  } catch (err: unknown) {
    logger.error('Failed to delete farmer crop', 'FarmerCropController', err);
    sendError(res, 'Internal error deleting farmer crop', 500, 'INTERNAL_ERROR');
  }
}
