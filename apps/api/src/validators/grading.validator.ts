// ==============================================================================
// KisanFlow — AI Quality Inspection & Grading Request Validator
// Enforces schema, value ranges, and secure image input boundaries
// ==============================================================================

import { z } from 'zod';
import { CropQualityGrade } from '@prisma/client';

const SAFE_IMAGE_URL_REGEX = /^(https?:\/\/[^\s$.?#].[^\s]*|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)$/i;

export const createQualityInspectionSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  moisturePercentage: z
    .number({ message: 'moisturePercentage must be a number' })
    .min(0, 'moisturePercentage cannot be negative')
    .max(100, 'moisturePercentage cannot exceed 100'),
  foreignMatterPercentage: z
    .number()
    .min(0, 'foreignMatterPercentage cannot be negative')
    .max(100, 'foreignMatterPercentage cannot exceed 100')
    .optional(),
  damagedGrainsPercentage: z
    .number()
    .min(0, 'damagedGrainsPercentage cannot be negative')
    .max(100, 'damagedGrainsPercentage cannot exceed 100')
    .optional(),
  brokenGrainsPercentage: z
    .number()
    .min(0, 'brokenGrainsPercentage cannot be negative')
    .max(100, 'brokenGrainsPercentage cannot exceed 100')
    .optional(),
  sampleImageUrl: z
    .string()
    .max(10 * 1024 * 1024, 'Image payload exceeds 10MB limit')
    .regex(SAFE_IMAGE_URL_REGEX, 'sampleImageUrl must be an HTTPS URL or base64 image (jpeg/png/webp)')
    .optional()
    .nullable(),
  overrideGrade: z
    .nativeEnum(CropQualityGrade)
    .optional()
    .nullable(),
  remarks: z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional().nullable(),
});

export const verifyQualityInspectionSchema = z.object({
  inspectorId: z.string().optional(),
  finalGrade: z.nativeEnum(CropQualityGrade).optional(),
  verifiedGrade: z.nativeEnum(CropQualityGrade).optional(),
  customDeductionPercentage: z.number().min(0).max(100).optional(),
  reviewRemarks: z.string().max(1000).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),
}).refine((data) => !!(data.finalGrade || data.verifiedGrade), {
  message: 'finalGrade or verifiedGrade is required',
  path: ['finalGrade'],
});
