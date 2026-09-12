// ==============================================================================
// KisanFlow — Mandi Data Controller
// Commodity market price queries and filtering.
// ==============================================================================

import { Request, Response } from 'express';
import { defaultMandiDataService } from '../services/mandiDataService.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';

export async function getMandiPrices(req: Request, res: Response): Promise<Response> {
  try {
    const { commodity, state, district, market, limit } = req.query;

    const filters = {
      commodity: commodity ? String(commodity) : undefined,
      state: state ? String(state) : undefined,
      district: district ? String(district) : undefined,
      market: market ? String(market) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    };

    const result = await defaultMandiDataService.getMandiPrices(filters);
    return sendSuccess(res, result, 'Mandi prices retrieved successfully');
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'Failed to retrieve mandi prices',
      error?.statusCode || 500,
      error?.code || 'MANDI_PRICE_ERROR'
    );
  }
}

export async function getMandiPriceByCommodity(req: Request, res: Response): Promise<Response> {
  try {
    const { commodity } = req.params;
    if (!commodity) {
      return sendError(res, 'Commodity parameter is required', 400, 'MISSING_PARAM');
    }

    const result = await defaultMandiDataService.getMandiPriceByCommodity(commodity);
    return sendSuccess(res, result, `Mandi prices for ${commodity} retrieved successfully`);
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'Failed to retrieve commodity prices',
      error?.statusCode || 500,
      error?.code || 'COMMODITY_PRICE_ERROR'
    );
  }
}
