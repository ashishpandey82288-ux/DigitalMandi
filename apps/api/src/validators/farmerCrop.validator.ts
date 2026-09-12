// ==============================================================================
// KisanFlow — FarmerCrop Input Validation Schemas
// Enforces strict types, date chronology, decimal constraints, and mass-assignment protection
// ==============================================================================

import { z } from 'zod';
import { CropSeason, FarmerCropStatus, LandAreaUnit } from '@prisma/client';

/**
 * Validates decimal precision up to 2 decimal places
 */
const isValidTwoDecimalPrecision = (val: number): boolean => {
  return Number.isFinite(val) && /^\d+(\.\d{1,2})?$/.test(val.toString());
};

/**
 * Date validation schema (ISO date string or null)
 */
const optionalDateSchema = z
  .union([
    z
      .string()
      .trim()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format',
      }),
    z.null(),
  ])
  .optional();

/**
 * Zod Schema for POST /api/farmer/crops (Creation)
 */
export const createFarmerCropSchema = z
  .object({
    farmId: z
      .string()
      .trim()
      .min(1, 'Farm ID cannot be empty'),

    cropId: z
      .string()
      .trim()
      .min(1, 'Crop ID cannot be empty'),

    season: z.nativeEnum(CropSeason),

    sowingDate: optionalDateSchema,

    expectedHarvestDate: optionalDateSchema,

    cultivatedArea: z
      .number()
      .positive('Cultivated area must be greater than 0')
      .max(10000, 'Cultivated area cannot exceed 10,000')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Cultivated area maximum precision is 2 decimal places',
      }),

    areaUnit: z
      .nativeEnum(LandAreaUnit)
      .default(LandAreaUnit.ACRE),

    expectedYield: z
      .union([
        z
          .number()
          .positive('Expected yield must be greater than 0')
          .max(100000, 'Expected yield cannot exceed 100,000')
          .refine(isValidTwoDecimalPrecision, {
            message: 'Expected yield maximum precision is 2 decimal places',
          }),
        z.null(),
      ])
      .optional(),

    yieldUnit: z
      .string()
      .trim()
      .min(1, 'Yield unit cannot be empty')
      .max(50, 'Yield unit cannot exceed 50 characters')
      .default('QUINTAL'),

    status: z
      .nativeEnum(FarmerCropStatus)
      .default(FarmerCropStatus.PLANNED),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.sowingDate && data.expectedHarvestDate) {
      const sowing = new Date(data.sowingDate).getTime();
      const harvest = new Date(data.expectedHarvestDate).getTime();
      if (harvest < sowing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expectedHarvestDate'],
          message: 'Expected harvest date cannot be earlier than sowing date',
        });
      }
    }
  });

export type CreateFarmerCropInput = z.infer<typeof createFarmerCropSchema>;

/**
 * Zod Schema for PUT /api/farmer/crops/:farmerCropId (Update)
 */
export const updateFarmerCropSchema = z
  .object({
    farmId: z
      .string()
      .trim()
      .min(1, 'Farm ID cannot be empty')
      .optional(),

    cropId: z
      .string()
      .trim()
      .min(1, 'Crop ID cannot be empty')
      .optional(),

    season: z
      .nativeEnum(CropSeason)
      .optional(),

    sowingDate: optionalDateSchema,

    expectedHarvestDate: optionalDateSchema,

    cultivatedArea: z
      .number()
      .positive('Cultivated area must be greater than 0')
      .max(10000, 'Cultivated area cannot exceed 10,000')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Cultivated area maximum precision is 2 decimal places',
      })
      .optional(),

    areaUnit: z
      .nativeEnum(LandAreaUnit)
      .optional(),

    expectedYield: z
      .union([
        z
          .number()
          .positive('Expected yield must be greater than 0')
          .max(100000, 'Expected yield cannot exceed 100,000')
          .refine(isValidTwoDecimalPrecision, {
            message: 'Expected yield maximum precision is 2 decimal places',
          }),
        z.null(),
      ])
      .optional(),

    yieldUnit: z
      .string()
      .trim()
      .min(1, 'Yield unit cannot be empty')
      .max(50, 'Yield unit cannot exceed 50 characters')
      .optional(),

    status: z
      .nativeEnum(FarmerCropStatus)
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.sowingDate && data.expectedHarvestDate) {
      const sowing = new Date(data.sowingDate).getTime();
      const harvest = new Date(data.expectedHarvestDate).getTime();
      if (harvest < sowing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expectedHarvestDate'],
          message: 'Expected harvest date cannot be earlier than sowing date',
        });
      }
    }
  });

export type UpdateFarmerCropInput = z.infer<typeof updateFarmerCropSchema>;
