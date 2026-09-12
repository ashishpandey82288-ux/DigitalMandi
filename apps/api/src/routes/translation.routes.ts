// ==============================================================================
// KisanFlow — Translation Routes
// ==============================================================================

import { Router } from 'express';
import { translateText, getSupportedLanguages } from '../controllers/translation.controller.ts';

const router = Router();

// POST /api/translation/translate
router.post('/translate', translateText);

// GET /api/translation/languages
router.get('/languages', getSupportedLanguages);

export default router;
