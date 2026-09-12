// ==============================================================================
// KisanFlow — Weather Routes
// ==============================================================================

import { Router } from 'express';
import { getWeather, getWeatherForCenter } from '../controllers/weather.controller.ts';

const router = Router();

// GET /api/weather?latitude=...&longitude=...
router.get('/', getWeather);
router.get('/forecast', getWeather);

// GET /api/weather/center/:centerId
router.get('/center/:centerId', getWeatherForCenter);

export default router;
