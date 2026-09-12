// ==============================================================================
// KisanFlow — Crop Master & MSP Rate Engine Controller
// Provides official crop standards, moisture limits, and guaranteed MSP rates
// ==============================================================================

import { Request, Response } from 'express';
import { prisma } from '../config/prisma.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';
import { logger } from '../utils/logger.ts';

/**
 * GET /api/crops
 * List all active master crops with their moisture thresholds and current MSP rates
 */
export async function getMasterCrops(req: Request, res: Response): Promise<Response> {
  try {
    const { category, activeOnly = 'true' } = req.query;

    const whereClause: { isActive?: boolean; category?: string } = {};
    if (activeOnly === 'true') {
      whereClause.isActive = true;
    }
    if (category && typeof category === 'string') {
      whereClause.category = category;
    }

    const crops = await prisma.crop.findMany({
      where: whereClause,
      include: {
        mspRates: true,
      },
    });

    const formatted = crops.map((crop) => {
      const activeMsp = (crop as any).mspRates?.find((m: any) => m.isActive) || (crop as any).mspRates?.[0];
      return {
        id: crop.id,
        name: crop.name,
        code: crop.code,
        category: crop.category,
        standardMoistureLimit: crop.standardMoistureLimit,
        description: crop.description,
        isActive: crop.isActive,
        currentMSP: activeMsp
          ? {
              id: activeMsp.id,
              season: activeMsp.season,
              marketingYear: activeMsp.marketingYear,
              ratePerQuintal: activeMsp.ratePerQuintal,
              bonusPerQuintal: activeMsp.bonusPerQuintal || 0,
              effectiveDate: activeMsp.effectiveDate,
              sourceReference: activeMsp.sourceReference,
            }
          : null,
      };
    });

    return sendSuccess(res, { crops: formatted, totalCount: formatted.length }, 'Master crops retrieved successfully');
  } catch (error) {
    logger.error('Error fetching master crops catalog', 'CropController', error);
    throw error;
  }
}

/**
 * GET /api/crops/:cropId
 * Retrieve detailed crop master specifications by ID or code
 */
export async function getMasterCropById(req: Request, res: Response): Promise<Response> {
  try {
    const { cropId } = req.params;

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        mspRates: true,
      },
    });

    if (!crop) {
      return sendError(res, `Crop record with ID '${cropId}' was not found in the master catalog`, 404, 'NOT_FOUND');
    }

    return sendSuccess(res, { crop }, 'Master crop details retrieved successfully');
  } catch (error) {
    logger.error('Error fetching master crop by ID', 'CropController', { cropId: req.params.cropId, error });
    throw error;
  }
}

/**
 * GET /api/msp
 * Retrieve official MSP price benchmarks and season rates
 */
export async function getOfficialMSPRates(req: Request, res: Response): Promise<Response> {
  try {
    const { marketingYear = '2026', season } = req.query;

    const whereClause: { isActive?: boolean; marketingYear?: number; season?: any } = {
      isActive: true,
      marketingYear: parseInt(marketingYear as string, 10) || 2026,
    };

    if (season && typeof season === 'string') {
      whereClause.season = season;
    }

    const rates = await prisma.mSPRate.findMany({
      where: whereClause,
      include: {
        crop: true,
      },
    });

    return sendSuccess(
      res,
      {
        marketingYear: whereClause.marketingYear,
        rates,
        totalCount: rates.length,
      },
      'Official MSP rates retrieved successfully'
    );
  } catch (error) {
    logger.error('Error fetching MSP rates', 'CropController', error);
    throw error;
  }
}
