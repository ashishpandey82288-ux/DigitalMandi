// ==============================================================================
// KisanFlow — Translation Controller
// Endpoints for text translation and supported language listing.
// ==============================================================================

import { Request, Response } from 'express';
import { defaultTranslationService } from '../services/translationService.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';

export async function translateText(req: Request, res: Response): Promise<Response> {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || typeof text !== 'string') {
      return sendError(res, 'Field "text" is required and must be a string', 400, 'INVALID_INPUT');
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return sendError(res, 'Field "targetLanguage" is required (e.g., "hi", "pa", "mr")', 400, 'INVALID_LANGUAGE');
    }

    const result = await defaultTranslationService.translate(
      text,
      targetLanguage,
      sourceLanguage || 'en'
    );

    return sendSuccess(res, result, 'Text translated successfully');
  } catch (error: any) {
    return sendError(
      res,
      error?.message || 'Translation error occurred',
      error?.statusCode || 500,
      error?.code || 'TRANSLATION_ERROR'
    );
  }
}

export async function getSupportedLanguages(_req: Request, res: Response): Promise<Response> {
  try {
    const languages = defaultTranslationService.getSupportedLanguages();
    return sendSuccess(res, languages, 'Supported languages retrieved successfully');
  } catch (error: any) {
    return sendError(res, error?.message || 'Failed to list languages', 500, 'LANGUAGES_ERROR');
  }
}
