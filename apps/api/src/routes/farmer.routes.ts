// ==============================================================================
// KisanFlow — Farmer API Routes
// Mounts /api/farmer/profile (GET/PUT) protected by authentication and FARMER RBAC
// ==============================================================================

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { validateRequest } from '../middleware/validate.ts';
import { updateFarmerProfileSchema } from '../validators/farmerProfile.validator.ts';
import {
  getFarmerProfile,
  updateFarmerProfile,
} from '../controllers/farmerProfile.controller.ts';
import {
  createFarmSchema,
  updateFarmSchema,
} from '../validators/farm.validator.ts';
import {
  createFarmerCropSchema,
  updateFarmerCropSchema,
} from '../validators/farmerCrop.validator.ts';
import {
  getFarmerFarms,
  getFarmerFarmById,
  createFarmerFarm,
  updateFarmerFarm,
} from '../controllers/farm.controller.ts';
import {
  getFarmerCrops,
  getFarmerCropById,
  createFarmerCrop,
  updateFarmerCrop,
  deleteFarmerCrop,
} from '../controllers/farmerCrop.controller.ts';
import { getPaymentsByFarmer } from '../controllers/payment.controller.ts';

const router = Router();

/**
 * GET /api/farmer/profile
 * Authenticated FARMER view of their own profile
 */
router.get(
  '/profile',
  requireAuth,
  requireRole(UserRole.FARMER),
  getFarmerProfile
);

/**
 * PUT /api/farmer/profile
 * Authenticated FARMER update of their own profile
 */
router.put(
  '/profile',
  requireAuth,
  requireRole(UserRole.FARMER),
  validateRequest({ body: updateFarmerProfileSchema }),
  updateFarmerProfile
);

/**
 * GET /api/farmer/farms
 * Authenticated FARMER view of all owned farms
 */
router.get(
  '/farms',
  requireAuth,
  requireRole(UserRole.FARMER),
  getFarmerFarms
);

/**
 * GET /api/farmer/farms/:farmId
 * Authenticated FARMER view of a single owned farm
 */
router.get(
  '/farms/:farmId',
  requireAuth,
  requireRole(UserRole.FARMER),
  getFarmerFarmById
);

/**
 * POST /api/farmer/farms
 * Authenticated FARMER creation of a farm parcel
 */
router.post(
  '/farms',
  requireAuth,
  requireRole(UserRole.FARMER),
  validateRequest({ body: createFarmSchema }),
  createFarmerFarm
);

/**
 * PUT /api/farmer/farms/:farmId
 * Authenticated FARMER update of an owned farm parcel
 */
router.put(
  '/farms/:farmId',
  requireAuth,
  requireRole(UserRole.FARMER),
  validateRequest({ body: updateFarmSchema }),
  updateFarmerFarm
);

/**
 * GET /api/farmer/crops
 * Authenticated FARMER view of all registered crop cultivations
 */
router.get(
  '/crops',
  requireAuth,
  requireRole(UserRole.FARMER),
  getFarmerCrops
);

/**
 * GET /api/farmer/crops/:farmerCropId
 * Authenticated FARMER view of a single owned crop cultivation
 */
router.get(
  '/crops/:farmerCropId',
  requireAuth,
  requireRole(UserRole.FARMER),
  getFarmerCropById
);

/**
 * POST /api/farmer/crops
 * Authenticated FARMER creation of a crop cultivation record
 */
router.post(
  '/crops',
  requireAuth,
  requireRole(UserRole.FARMER),
  validateRequest({ body: createFarmerCropSchema }),
  createFarmerCrop
);

/**
 * PUT /api/farmer/crops/:farmerCropId
 * Authenticated FARMER update of an owned crop cultivation record
 */
router.put(
  '/crops/:farmerCropId',
  requireAuth,
  requireRole(UserRole.FARMER),
  validateRequest({ body: updateFarmerCropSchema }),
  updateFarmerCrop
);

/**
 * DELETE /api/farmer/crops/:farmerCropId
 * Authenticated FARMER deletion of an owned crop cultivation record
 */
router.delete(
  '/crops/:farmerCropId',
  requireAuth,
  requireRole(UserRole.FARMER),
  deleteFarmerCrop
);

/**
 * GET /api/farmer/payments
 * Authenticated FARMER view of their DBT payment disbursement history
 */
router.get(
  '/payments',
  requireAuth,
  requireRole(UserRole.FARMER),
  (req, res) => {
    (req.params as any).farmerId = (req as any).user?.id;
    return getPaymentsByFarmer(req, res);
  }
);

export default router;
