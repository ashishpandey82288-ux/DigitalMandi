// ==============================================================================
// KisanFlow — Shared Utilities & Constants (Phase 1 Foundation)
// ==============================================================================

import { ApiResponse } from '../../types/src/index.ts';

// ------------------------------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------------------------------

export const APP_CONSTANTS = {
  DEFAULT_SLOT_DURATION_MINUTES: 90,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  STANDARD_SLOT_START_HOUR: 8,
  STANDARD_SLOT_END_HOUR: 18,
  AUDIT_GENESIS_HASH: '0000000000000000000000000000000000000000000000000000000000000000',
  SUPPORTED_LANGUAGES: [
    { code: 'hi', label: 'Hindi (हिंदी)' },
    { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
    { code: 'mr', label: 'Marathi (मराठी)' },
    { code: 'te', label: 'Telugu (తెలుగు)' },
    { code: 'en', label: 'English' },
  ],
} as const;

// ------------------------------------------------------------------------------
// STANDARDIZED API RESPONSE BUILDERS
// ------------------------------------------------------------------------------

export function createSuccessResponse<T>(
  data?: T,
  message: string = 'Operation completed successfully',
  meta?: ApiResponse<T>['meta']
): ApiResponse<T> {
  return {
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function createErrorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
