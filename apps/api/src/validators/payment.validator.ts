// ==============================================================================
// KisanFlow — Payment & DBT Request Validator
// ==============================================================================

import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  settlementId: z.string().min(1, 'settlementId is required'),
  amount: z.number({ message: 'amount must be a number' }).positive('amount must be greater than 0').optional(),
  idempotencyKey: z.string().min(4, 'idempotencyKey must be valid').optional(),
  paymentMethod: z.string().optional(),
  simulateFailure: z.boolean().optional(),
  simulateFailureReason: z.string().optional(),
  farmerId: z.string().optional(),
  accountNumber: z.string().min(4, 'accountNumber must be at least 4 digits').optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional(),
  remarks: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
