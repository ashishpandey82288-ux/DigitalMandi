// ==============================================================================
// KisanFlow — Farm Controller
// Handles Farmer-owned Farm listings, retrieval, creation, and updates
// Enforces strict IDOR protection, mass-assignment blocking, and audit logging
// ==============================================================================

import { Response } from 'express';
import { Prisma, Farm, FarmVerificationStatus } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';
import { recordAuditEvent } from '../services/auditService.ts';
import { CreateFarmInput, UpdateFarmInput } from '../validators/farm.validator.ts';
import { logger } from '../utils/logger.ts';

/**
 * Standardized Farm Response Formatter
 */
export function formatFarmResponse(farm: Farm) {
  return {
    id: farm.id,
    farmerProfileId: farm.farmerProfileId,
    farmName: farm.farmName,
    landParcelNumber: farm.landParcelNumber,
    district: farm.district,
    state: farm.state,
    village: farm.village,
    totalAreaAcres: Number(farm.totalAreaAcres),
    verifiedArea: farm.verifiedArea !== null ? Number(farm.verifiedArea) : null,
    isLandVerified: farm.isLandVerified,
    landAreaUnit: farm.landAreaUnit,
    ownershipType: farm.ownershipType,
    irrigationType: farm.irrigationType,
    soilType: farm.soilType,
    latitude: farm.latitude !== null ? Number(farm.latitude) : null,
    longitude: farm.longitude !== null ? Number(farm.longitude) : null,
    verificationStatus: farm.verificationStatus,
    createdAt: farm.createdAt.toISOString(),
    updatedAt: farm.updatedAt.toISOString(),
  };
}

/**
 * GET /api/farmer/farms
 * Retrieves all farms belonging strictly to the authenticated farmer
 */
export async function getFarmerFarms(
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

    // 2. Fetch farms strictly constrained to authenticated farmerProfileId
    const farms = await prisma.farm.findMany({
      where: { farmerProfileId: farmerProfile.id },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(
      res,
      farms.map(formatFarmResponse),
      'Farms retrieved successfully'
    );
  } catch (error) {
    logger.error('Failed to retrieve farmer farms', 'FarmController', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
    });
    sendError(res, 'An error occurred while retrieving farms', 500, 'DATABASE_ERROR');
  }
}

/**
 * GET /api/farmer/farms/:farmId
 * Retrieves a single farm parcel belonging strictly to the authenticated farmer
 */
export async function getFarmerFarmById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const { farmId } = req.params;

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Ownership-constrained query: farmId AND farmerProfileId
    const farm = await prisma.farm.findFirst({
      where: {
        id: farmId,
        farmerProfileId: farmerProfile.id,
      },
    });

    // 3. Return 404 if not found or belongs to another farmer (prevent information leakage)
    if (!farm) {
      sendError(res, 'Farm not found or access denied', 404, 'FARM_NOT_FOUND');
      return;
    }

    sendSuccess(res, formatFarmResponse(farm), 'Farm retrieved successfully');
  } catch (error) {
    logger.error('Failed to retrieve farm by ID', 'FarmController', {
      error: error instanceof Error ? error.message : String(error),
      farmId: req.params.farmId,
      userId: req.user?.id,
    });
    sendError(res, 'An error occurred while retrieving the farm', 500, 'DATABASE_ERROR');
  }
}

/**
 * POST /api/farmer/farms
 * Creates a new farm parcel for the authenticated farmer
 */
export async function createFarmerFarm(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const data: CreateFarmInput = req.body;

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Application-level duplicate parcel protection (same farmer, parcel number, district, state)
    const existingDuplicate = await prisma.farm.findFirst({
      where: {
        farmerProfileId: farmerProfile.id,
        landParcelNumber: data.landParcelNumber,
        district: data.district,
        state: data.state,
      },
    });

    if (existingDuplicate) {
      sendError(
        res,
        'A farm parcel with this parcel number already exists for your profile in this district and state',
        409,
        'DUPLICATE_FARM_PARCEL'
      );
      return;
    }

    // 3. Create farm with strict server-controlled fields
    const farm = await prisma.farm.create({
      data: {
        farmerProfileId: farmerProfile.id,
        farmName: data.farmName || null,
        landParcelNumber: data.landParcelNumber,
        district: data.district,
        state: data.state,
        village: data.village,
        totalAreaAcres: new Prisma.Decimal(data.totalAreaAcres),
        landAreaUnit: data.landAreaUnit,
        ownershipType: data.ownershipType,
        irrigationType: data.irrigationType || null,
        soilType: data.soilType || null,
        latitude:
          data.latitude !== undefined && data.latitude !== null
            ? new Prisma.Decimal(data.latitude)
            : null,
        longitude:
          data.longitude !== undefined && data.longitude !== null
            ? new Prisma.Decimal(data.longitude)
            : null,
        // Server-enforced defaults
        isLandVerified: false,
        verificationStatus: FarmVerificationStatus.PENDING,
        verifiedArea: null,
      },
    });

    // 4. Record cryptographic audit event
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'FARM_CREATED',
      entityType: 'Farm',
      entityId: farm.id,
      metadata: {
        farmId: farm.id,
        farmerProfileId: farmerProfile.id,
        userId: req.user.id,
        landParcelNumber: farm.landParcelNumber,
        district: farm.district,
        state: farm.state,
        totalAreaAcres: Number(farm.totalAreaAcres),
        landAreaUnit: farm.landAreaUnit,
      },
    });

    sendSuccess(res, formatFarmResponse(farm), 'Farm created successfully', 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      sendError(
        res,
        'A farm parcel with these unique attributes already exists',
        409,
        'DUPLICATE_FARM_PARCEL'
      );
      return;
    }

    logger.error('Failed to create farm', 'FarmController', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
    });
    sendError(res, 'An error occurred while creating the farm', 500, 'DATABASE_ERROR');
  }
}

/**
 * PUT /api/farmer/farms/:farmId
 * Updates an existing farm parcel belonging strictly to the authenticated farmer
 */
export async function updateFarmerFarm(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const { farmId } = req.params;
    const data: UpdateFarmInput = req.body;

    // 1. Resolve farmer profile from authenticated user
    const farmerProfile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!farmerProfile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Ownership-constrained query: verify existence and ownership
    const existingFarm = await prisma.farm.findFirst({
      where: {
        id: farmId,
        farmerProfileId: farmerProfile.id,
      },
    });

    if (!existingFarm) {
      sendError(res, 'Farm not found or access denied', 404, 'FARM_NOT_FOUND');
      return;
    }

    // 3. Check for duplicate parcel conflict if parcel number, district, or state changed
    const newParcel = data.landParcelNumber ?? existingFarm.landParcelNumber;
    const newDistrict = data.district ?? existingFarm.district;
    const newState = data.state ?? existingFarm.state;

    if (
      (data.landParcelNumber || data.district || data.state) &&
      (newParcel !== existingFarm.landParcelNumber ||
        newDistrict !== existingFarm.district ||
        newState !== existingFarm.state)
    ) {
      const duplicate = await prisma.farm.findFirst({
        where: {
          farmerProfileId: farmerProfile.id,
          landParcelNumber: newParcel,
          district: newDistrict,
          state: newState,
          id: { not: existingFarm.id },
        },
      });

      if (duplicate) {
        sendError(
          res,
          'A farm parcel with this parcel number already exists for your profile in this district and state',
          409,
          'DUPLICATE_FARM_PARCEL'
        );
        return;
      }
    }

    // 4. Construct update payload strictly excluding server-controlled verification/identity fields
    const updatePayload: Prisma.FarmUpdateInput = {};

    if (data.farmName !== undefined) updatePayload.farmName = data.farmName;
    if (data.landParcelNumber !== undefined) updatePayload.landParcelNumber = data.landParcelNumber;
    if (data.district !== undefined) updatePayload.district = data.district;
    if (data.state !== undefined) updatePayload.state = data.state;
    if (data.village !== undefined) updatePayload.village = data.village;
    if (data.totalAreaAcres !== undefined) {
      updatePayload.totalAreaAcres = new Prisma.Decimal(data.totalAreaAcres);
    }
    if (data.landAreaUnit !== undefined) updatePayload.landAreaUnit = data.landAreaUnit;
    if (data.ownershipType !== undefined) updatePayload.ownershipType = data.ownershipType;
    if (data.irrigationType !== undefined) updatePayload.irrigationType = data.irrigationType;
    if (data.soilType !== undefined) updatePayload.soilType = data.soilType;
    if (data.latitude !== undefined) {
      updatePayload.latitude = data.latitude !== null ? new Prisma.Decimal(data.latitude) : null;
    }
    if (data.longitude !== undefined) {
      updatePayload.longitude = data.longitude !== null ? new Prisma.Decimal(data.longitude) : null;
    }

    // Note on verification: Material modifications (e.g., parcel number or acreage) preserve
    // the existing verification status until the administrative verification workflow acts on it.
    // Farmer requests NEVER set or modify isLandVerified, verifiedArea, or verificationStatus.

    const updatedFarm = await prisma.farm.update({
      where: { id: existingFarm.id },
      data: updatePayload,
    });

    // 5. Record cryptographic audit event
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'FARM_UPDATED',
      entityType: 'Farm',
      entityId: updatedFarm.id,
      metadata: {
        farmId: updatedFarm.id,
        farmerProfileId: farmerProfile.id,
        userId: req.user.id,
        updatedFields: Object.keys(data),
      },
    });

    sendSuccess(res, formatFarmResponse(updatedFarm), 'Farm updated successfully');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      sendError(
        res,
        'A farm parcel with these unique attributes already exists',
        409,
        'DUPLICATE_FARM_PARCEL'
      );
      return;
    }

    logger.error('Failed to update farm', 'FarmController', {
      error: error instanceof Error ? error.message : String(error),
      farmId: req.params.farmId,
      userId: req.user?.id,
    });
    sendError(res, 'An error occurred while updating the farm', 500, 'DATABASE_ERROR');
  }
}
