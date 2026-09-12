// ==============================================================================
// KisanFlow — Farmer Profile Zod Validation Schemas
// Validates updates for PUT /api/farmer/profile with strict schema enforcement
// ==============================================================================

import { z } from 'zod';

/**
 * Indian Mobile Phone Number Regex:
 * Standard 10 digits starting with 6, 7, 8, or 9,
 * optionally prefixed with +91 or +91- or +91 (space)
 */
const INDIAN_PHONE_REGEX = /^(?:\+91[- ]?)?[6-9]\d{9}$/;

/**
 * Indian Postal PIN Code Regex:
 * Exactly 6 digits, first digit between 1-9
 */
const INDIAN_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * Zod schema for PUT /api/farmer/profile
 * Enforces .strict() to reject any unknown or forbidden fields (mass assignment prevention).
 */
export const updateFarmerProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name cannot be empty string')
      .max(100, 'Full name cannot exceed 100 characters')
      .optional(),

    alternatePhone: z
      .union([
        z
          .string()
          .trim()
          .regex(INDIAN_PHONE_REGEX, 'Invalid Indian phone number format (must be 10 digits starting with 6-9)'),
        z.null(),
      ])
      .optional(),

    dateOfBirth: z
      .union([
        z
          .string()
          .trim()
          .refine((val) => !isNaN(Date.parse(val)), {
            message: 'Invalid date format for date of birth',
          })
          .refine((val) => new Date(val) < new Date(), {
            message: 'Date of birth cannot be in the future',
          })
          .refine((val) => new Date(val) > new Date('1900-01-01'), {
            message: 'Date of birth is unreasonably distant in the past',
          }),
        z.null(),
      ])
      .optional(),

    gender: z
      .union([
        z
          .string()
          .trim()
          .min(1, 'Gender cannot be empty string')
          .max(30, 'Gender value cannot exceed 30 characters'),
        z.null(),
      ])
      .optional(),

    address: z
      .union([
        z
          .string()
          .trim()
          .min(1, 'Address cannot be empty string')
          .max(255, 'Address cannot exceed 255 characters'),
        z.null(),
      ])
      .optional(),

    village: z
      .union([
        z
          .string()
          .trim()
          .min(1, 'Village cannot be empty string')
          .max(100, 'Village cannot exceed 100 characters'),
        z.null(),
      ])
      .optional(),

    primaryDistrict: z
      .string()
      .trim()
      .min(1, 'Primary district cannot be empty string')
      .max(100, 'Primary district cannot exceed 100 characters')
      .optional(),

    primaryState: z
      .string()
      .trim()
      .min(1, 'Primary state cannot be empty string')
      .max(100, 'Primary state cannot exceed 100 characters')
      .optional(),

    pincode: z
      .string()
      .trim()
      .regex(INDIAN_PINCODE_REGEX, 'Invalid Indian PIN code format (must be 6 digits starting with 1-9)')
      .optional(),

    preferredLanguage: z
      .string()
      .trim()
      .min(2, 'Preferred language code must be at least 2 characters')
      .max(10, 'Preferred language code cannot exceed 10 characters')
      .optional(),
  })
  .strict();

export type UpdateFarmerProfileInput = z.infer<typeof updateFarmerProfileSchema>;
