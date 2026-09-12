// ==============================================================================
// KisanFlow — Kisan Credit Card (KCC) Controller
// ==============================================================================

import { Request, Response } from 'express';
import { defaultKCCService } from '../services/kccService.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';

export async function getAdvisories(req: Request, res: Response): Promise<Response> {
  try {
    const { state, district, crop, category, search, limit } = req.query;

    const filters = {
      state: state ? String(state) : undefined,
      district: district ? String(district) : undefined,
      crop: crop ? String(crop) : undefined,
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    };

    const advisories = await defaultKCCService.getAdvisories(filters);
    return sendSuccess(res, advisories, 'KCC advisories retrieved successfully');
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'Failed to retrieve KCC advisories',
      error?.statusCode || 500,
      error?.code || 'KCC_ADVISORY_ERROR'
    );
  }
}

export async function verifyKCC(req: Request, res: Response): Promise<Response> {
  try {
    const kccNumber = req.params.kccNumber || req.body?.kccNumber;
    if (!kccNumber) {
      return sendError(res, 'KCC number parameter is required', 400, 'MISSING_PARAM');
    }

    const result = await defaultKCCService.verifyKCC(kccNumber);
    return sendSuccess(res, result, 'KCC verification completed');
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'KCC verification failed',
      error?.statusCode || 500,
      error?.code || 'KCC_VERIFICATION_ERROR'
    );
  }
}
