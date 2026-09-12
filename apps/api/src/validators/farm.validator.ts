// ==============================================================================
// KisanFlow — Farm Input Validation Schemas
// Enforces strict types, geographic boundaries, decimal constraints, and mass-assignment protection
// ==============================================================================

import { z } from 'zod';
import { LandAreaUnit, OwnershipType } from '@prisma/client';

/**
 * Validates decimal precision up to 2 decimal places
 */
const isValidTwoDecimalPrecision = (val: number): boolean => {
  return /^\d+(\.\d{1,2})?$/.test(val.toString());
};

/**
 * Zod Schema for POST /api/farmer/farms (Creation)
 */
export const createFarmSchema = z
  .object({
    farmName: z
      .string()
      .trim()
      .min(1, 'Farm name cannot be empty')
      .max(100, 'Farm name cannot exceed 100 characters')
      .optional()
      .nullable(),

    landParcelNumber: z
      .string()
      .trim()
      .min(1, 'Land parcel number cannot be empty')
      .max(100, 'Land parcel number cannot exceed 100 characters'),

    district: z
      .string()
      .trim()
      .min(1, 'District cannot be empty')
      .max(100, 'District cannot exceed 100 characters'),

    state: z
      .string()
      .trim()
      .min(1, 'State cannot be empty')
      .max(100, 'State cannot exceed 100 characters'),

    village: z
      .string()
      .trim()
      .min(1, 'Village cannot be empty')
      .max(100, 'Village cannot exceed 100 characters'),

    totalAreaAcres: z
      .number()
      .positive('Total area must be greater than 0')
      .max(10000, 'Total area cannot exceed 10,000 acres')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Total area maximum precision is 2 decimal places',
      }),

    landAreaUnit: z
      .nativeEnum(LandAreaUnit)
      .default(LandAreaUnit.ACRE),

    ownershipType: z
      .nativeEnum(OwnershipType)
      .default(OwnershipType.OWNED),

    irrigationType: z
      .string()
      .trim()
      .min(1, 'Irrigation type cannot be empty')
      .max(100, 'Irrigation type cannot exceed 100 characters')
      .optional()
      .nullable(),

    soilType: z
      .string()
      .trim()
      .min(1, 'Soil type cannot be empty')
      .max(100, 'Soil type cannot exceed 100 characters')
      .optional()
      .nullable(),

    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90 degrees')
      .max(90, 'Latitude must be between -90 and 90 degrees')
      .optional()
      .nullable(),

    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180 degrees')
      .max(180, 'Longitude must be between -180 and 180 degrees')
      .optional()
      .nullable(),
  })
  .strict();

export type CreateFarmInput = z.infer<typeof createFarmSchema>;

/**
 * Zod Schema for PUT /api/farmer/farms/:farmId (Update)
 */
export const updateFarmSchema = z
  .object({
    farmName: z
      .string()
      .trim()
      .min(1, 'Farm name cannot be empty')
      .max(100, 'Farm name cannot exceed 100 characters')
      .optional()
      .nullable(),

    landParcelNumber: z
      .string()
      .trim()
      .min(1, 'Land parcel number cannot be empty')
      .max(100, 'Land parcel number cannot exceed 100 characters')
      .optional(),

    district: z
      .string()
      .trim()
      .min(1, 'District cannot be empty')
      .max(100, 'District cannot exceed 100 characters')
      .optional(),

    state: z
      .string()
      .trim()
      .min(1, 'State cannot be empty')
      .max(100, 'State cannot exceed 100 characters')
      .optional(),

    village: z
      .string()
      .trim()
      .min(1, 'Village cannot be empty')
      .max(100, 'Village cannot exceed 100 characters')
      .optional(),

    totalAreaAcres: z
      .number()
      .positive('Total area must be greater than 0')
      .max(10000, 'Total area cannot exceed 10,000 acres')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Total area maximum precision is 2 decimal places',
      })
      .optional(),

    landAreaUnit: z
      .nativeEnum(LandAreaUnit)
      .optional(),

    ownershipType: z
      .nativeEnum(OwnershipType)
      .optional(),

    irrigationType: z
      .string()
      .trim()
      .min(1, 'Irrigation type cannot be empty')
      .max(100, 'Irrigation type cannot exceed 100 characters')
      .optional()
      .nullable(),

    soilType: z
      .string()
      .trim()
      .min(1, 'Soil type cannot be empty')
      .max(100, 'Soil type cannot exceed 100 characters')
      .optional()
      .nullable(),

    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90 degrees')
      .max(90, 'Latitude must be between -90 and 90 degrees')
      .optional()
      .nullable(),

    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180 degrees')
      .max(180, 'Longitude must be between -180 and 180 degrees')
      .optional()
      .nullable(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
