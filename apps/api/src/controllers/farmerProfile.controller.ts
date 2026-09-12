// ==============================================================================
// KisanFlow — Farmer Profile Controller
// Secure GET / PUT handlers for /api/farmer/profile
// Derives user identity strictly from authenticated token with IDOR protection
// ==============================================================================

import { Response } from 'express';
import { prisma } from '../config/prisma.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';
import { recordAuditEvent } from '../services/auditService.ts';
import { UpdateFarmerProfileInput } from '../validators/farmerProfile.validator.ts';
import { FarmerProfile } from '@prisma/client';

interface ProfileWithUser extends FarmerProfile {
  user?: {
    name: string;
    email: string | null;
    phone: string;
  } | null;
}

/**
 * Serializes a FarmerProfile record safely, stripping any internal credentials,
 * hashes (e.g. aadhaarHash), and unrequested fields.
 */
function formatFarmerProfileResponse(
  profile: ProfileWithUser,
  userFallback?: { name?: string; email?: string | null; phone?: string }
) {
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName ?? profile.user?.name ?? userFallback?.name ?? null,
    alternatePhone: profile.alternatePhone ?? null,
    email: profile.user?.email ?? userFallback?.email ?? null,
    phone: profile.user?.phone ?? userFallback?.phone ?? '',
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
    gender: profile.gender ?? null,
    address: profile.address ?? null,
    village: profile.village ?? null,
    primaryDistrict: profile.primaryDistrict,
    primaryState: profile.primaryState,
    pincode: profile.pincode,
    preferredLanguage: profile.preferredLanguage,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * GET /api/farmer/profile
 * Retrieves the profile of the currently authenticated FARMER.
 * Uses req.user.id directly to strictly prevent IDOR attacks.
 */
export async function getFarmerProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, 'Authentication required to access farmer profile', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    const profile = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!profile) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    sendSuccess(
      res,
      formatFarmerProfileResponse(profile, req.user),
      'Farmer profile retrieved successfully'
    );
  } catch (error) {
    sendError(
      res,
      'Failed to retrieve farmer profile',
      500,
      'INTERNAL_SERVER_ERROR',
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * PUT /api/farmer/profile
 * Updates allowed fields of the currently authenticated FARMER's profile.
 * Rejects unknown or forbidden properties and records a tamper-evident audit event.
 */
export async function updateFarmerProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, 'Authentication required to update farmer profile', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    // 1. Verify that profile exists for authenticated farmer
    const existing = await prisma.farmerProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!existing) {
      sendError(res, 'Farmer profile not found for authenticated user', 404, 'PROFILE_NOT_FOUND');
      return;
    }

    // 2. Extract validated fields from request body
    const body: UpdateFarmerProfileInput = (req.body && typeof req.body === 'object') ? req.body : {};
    const updateData: {
      fullName?: string;
      alternatePhone?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      address?: string | null;
      village?: string | null;
      primaryDistrict?: string;
      primaryState?: string;
      pincode?: string;
      preferredLanguage?: string;
    } = {};

    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.alternatePhone !== undefined) updateData.alternatePhone = body.alternatePhone;
    if (body.dateOfBirth !== undefined) {
      updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.village !== undefined) updateData.village = body.village;
    if (body.primaryDistrict !== undefined) updateData.primaryDistrict = body.primaryDistrict;
    if (body.primaryState !== undefined) updateData.primaryState = body.primaryState;
    if (body.pincode !== undefined) updateData.pincode = body.pincode;
    if (body.preferredLanguage !== undefined) updateData.preferredLanguage = body.preferredLanguage;

    // 3. Persist updates to the database
    const updated = await prisma.farmerProfile.update({
      where: { userId: req.user.id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // 4. Record tamper-evident cryptographic audit ledger event
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'FARMER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: updated.id,
      metadata: {
        userId: req.user.id,
        farmerProfileId: updated.id,
        updatedFields: Object.keys(updateData),
      },
    });

    sendSuccess(
      res,
      formatFarmerProfileResponse(updated, req.user),
      'Farmer profile updated successfully'
    );
  } catch (error) {
    sendError(
      res,
      'Failed to update farmer profile',
      500,
      'INTERNAL_SERVER_ERROR',
      error instanceof Error ? error.message : undefined
    );
  }
}
