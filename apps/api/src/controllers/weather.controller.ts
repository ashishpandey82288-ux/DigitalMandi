// ==============================================================================
// KisanFlow — Weather Controller
// Endpoints for coordinates-based forecast and center-based weather inspection.
// ==============================================================================

import { Request, Response } from 'express';
import { defaultWeatherService } from '../services/weatherService.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';

export async function getWeather(req: Request, res: Response): Promise<Response> {
  try {
    const latStr = req.query.latitude as string;
    const lonStr = req.query.longitude as string;

    // Default to Karnal, Haryana (major agricultural grain procurement hub) if not provided
    const latitude = latStr ? parseFloat(latStr) : 29.6857;
    const longitude = lonStr ? parseFloat(lonStr) : 76.9905;

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return sendError(res, 'Invalid latitude: must be a number between -90 and 90', 400, 'INVALID_COORDINATES');
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return sendError(res, 'Invalid longitude: must be a number between -180 and 180', 400, 'INVALID_COORDINATES');
    }

    const weather = await defaultWeatherService.getWeatherByCoordinates(latitude, longitude);
    return sendSuccess(res, weather, 'Weather forecast retrieved successfully');
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'Failed to retrieve weather data',
      error?.statusCode || 500,
      error?.code || 'WEATHER_FETCH_ERROR'
    );
  }
}

export async function getWeatherForCenter(req: Request, res: Response): Promise<Response> {
  try {
    const { centerId } = req.params;
    if (!centerId) {
      return sendError(res, 'Procurement Center ID is required', 400, 'MISSING_PARAM');
    }

    const weather = await defaultWeatherService.getWeatherForCenter(centerId);
    return sendSuccess(res, weather, `Weather for center ${weather.centerName} retrieved successfully`);
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'Failed to retrieve center weather data',
      error?.statusCode || 500,
      error?.code || 'CENTER_WEATHER_ERROR'
    );
  }
}
