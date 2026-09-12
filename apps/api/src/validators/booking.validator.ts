// ==============================================================================
// KisanFlow — Smart Procurement Booking & MSP Lock Validation Schemas
// Enforces strict types, decimal precision, capacity constraints, and payload hygiene
// ==============================================================================

import { z } from 'zod';
import { BookingStatus } from '@prisma/client';

/**
 * Validates decimal precision up to 2 decimal places
 */
const isValidTwoDecimalPrecision = (val: number): boolean => {
  return Number.isFinite(val) && /^\d+(\.\d{1,2})?$/.test(val.toString());
};

/**
 * Zod Schema for POST /api/bookings (Slot Reservation & MSP Lock)
 */
export const createBookingSchema = z
  .object({
    cropId: z
      .string()
      .trim()
      .min(1, 'Crop ID cannot be empty'),

    procurementCenterId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    centerId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    centerBayId: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional(),

    bayId: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional(),

    bookingSlotId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    slotId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    date: z
      .string()
      .trim()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid date format (ISO-8601 or YYYY-MM-DD expected)',
      })
      .optional(),

    bookingDate: z
      .string()
      .trim()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid date format',
      })
      .optional(),

    quantity: z
      .number()
      .positive('Quantity must be greater than 0')
      .max(10000, 'Quantity cannot exceed 10,000 quintals per booking')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Quantity precision cannot exceed 2 decimal places',
      })
      .optional(),

    estimatedQuantity: z
      .number()
      .positive('Quantity must be greater than 0')
      .max(10000, 'Quantity cannot exceed 10,000 quintals per booking')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Quantity precision cannot exceed 2 decimal places',
      })
      .optional(),

    estimatedQuantityQuintals: z
      .number()
      .positive('Quantity must be greater than 0')
      .max(10000, 'Quantity cannot exceed 10,000 quintals per booking')
      .refine(isValidTwoDecimalPrecision, {
        message: 'Quantity precision cannot exceed 2 decimal places',
      })
      .optional(),

    quantityUnit: z
      .string()
      .trim()
      .default('QUINTAL')
      .optional(),

    farmId: z
      .string()
      .trim()
      .min(1)
      .optional(),

    metadata: z
      .record(z.string(), z.unknown())
      .optional(),
  })
  .strict()
  .refine((data) => !!(data.procurementCenterId || data.centerId), {
    message: 'Procurement center ID is required (use procurementCenterId or centerId)',
    path: ['procurementCenterId'],
  })
  .refine((data) => !!(data.bookingSlotId || data.slotId), {
    message: 'Booking slot ID is required (use bookingSlotId or slotId)',
    path: ['bookingSlotId'],
  })
  .refine(
    (data) =>
      data.quantity !== undefined ||
      data.estimatedQuantity !== undefined ||
      data.estimatedQuantityQuintals !== undefined,
    {
      message: 'Quantity is required (use quantity, estimatedQuantity, or estimatedQuantityQuintals)',
      path: ['quantity'],
    }
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Zod Schema for PATCH /api/bookings/:bookingId
 */
export const updateBookingSchema = z
  .object({
    status: z.nativeEnum(BookingStatus).optional(),
    cancellationReason: z.string().trim().max(500).optional(),
    centerBayId: z.string().trim().min(1).optional(),
    bookingSlotId: z.string().trim().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

/**
 * Zod Schema for POST /api/bookings/:bookingId/cancel
 */
export const cancelBookingSchema = z
  .object({
    cancellationReason: z
      .string()
      .trim()
      .max(500, 'Cancellation reason cannot exceed 500 characters')
      .optional()
      .default('Cancelled by farmer'),
  })
  .strict();

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
